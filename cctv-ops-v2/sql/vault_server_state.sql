-- =============================================================================
-- CCTV OPS V2 — Authoritative Vault Server State Schema (Option A)
-- =============================================================================
-- STORES SERVER-SIDE ENCRYPTED VMK, KEYED VERIFIERS, AND AUTHORITATIVE LOCKOUT.
-- ZERO PLAINTEXT SECRETS, ZERO PLAINTEXT VMK, ZERO RECOVERY KEYS STORED.
-- DIRECT BROWSER TABLE ACCESS IS REVOKED. ALL ACCESS VIA SECURE EDGE FUNCTIONS.

CREATE TABLE IF NOT EXISTS public.cctv_vault_server_state (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  pin_verifier_hmac TEXT NOT NULL,
  server_wrapped_vmk TEXT NOT NULL,
  server_wrap_iv TEXT NOT NULL,
  server_wrap_version INT NOT NULL DEFAULT 1,
  recovery_verifier_hmac TEXT NOT NULL,
  pending_recovery_verifier_hmac TEXT NULL,
  pending_rotation_id TEXT NULL,
  failed_pin_attempts INT NOT NULL DEFAULT 0,
  locked_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now()
);

-- Row Level Security
ALTER TABLE public.cctv_vault_server_state ENABLE ROW LEVEL SECURITY;

-- Revoke all direct client queries
REVOKE ALL ON public.cctv_vault_server_state FROM anon, authenticated;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_cctv_vault_server_state_user ON public.cctv_vault_server_state(user_id);

-- -----------------------------------------------------------------------------
-- Transactional Atomic RPC: record_server_vault_pin_attempt
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.record_server_vault_pin_attempt(
  p_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_rec RECORD;
  v_new_attempts INT;
  v_locked BOOLEAN := FALSE;
  v_locked_at TIMESTAMPTZ := NULL;
BEGIN
  -- Acquire row-level lock for atomic increment under concurrency
  SELECT failed_pin_attempts, locked_at
  INTO v_rec
  FROM public.cctv_vault_server_state
  WHERE user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN pg_catalog.jsonb_build_object('error', 'Vault not configured');
  END IF;

  v_new_attempts := v_rec.failed_pin_attempts + 1;

  IF v_new_attempts >= 4 THEN
    v_locked := TRUE;
    v_locked_at := pg_catalog.now();
  END IF;

  UPDATE public.cctv_vault_server_state
  SET failed_pin_attempts = v_new_attempts,
      locked_at = COALESCE(v_rec.locked_at, v_locked_at),
      updated_at = pg_catalog.now()
  WHERE user_id = p_user_id;

  RETURN pg_catalog.jsonb_build_object(
    'failed_attempts', v_new_attempts,
    'locked', v_locked,
    'remaining_attempts', GREATEST(0, 4 - v_new_attempts)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.record_server_vault_pin_attempt(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_server_vault_pin_attempt(UUID) TO service_role;

-- -----------------------------------------------------------------------------
-- Transactional Atomic RPC: reset_server_vault_pin_attempts
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.reset_server_vault_pin_attempts(
  p_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.cctv_vault_server_state
  SET failed_pin_attempts = 0,
      locked_at = NULL,
      updated_at = pg_catalog.now()
  WHERE user_id = p_user_id;

  RETURN pg_catalog.jsonb_build_object('reset', true);
END;
$$;

REVOKE ALL ON FUNCTION public.reset_server_vault_pin_attempts(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reset_server_vault_pin_attempts(UUID) TO service_role;
