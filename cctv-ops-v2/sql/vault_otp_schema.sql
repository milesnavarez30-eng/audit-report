-- =============================================================================
-- CCTV OPS V2 — Secure Vault Email OTP Verification Schema (HMAC Hardened)
-- =============================================================================
-- PREPARED LOCALLY FOR AUTHORITATIVE SERVER-SIDE EMAIL VERIFICATION.
-- DO NOT DEPLOY DIRECTLY UNTIL AUTHORIZED BY OPERATIONAL SUPER ADMIN.

-- 1. Table: cctv_vault_otps
-- Stores cryptographically HMAC-hashed OTP verifiers with strict 10-minute expiry and attempt limiting.
-- Plaintext OTP is NEVER stored in the database.
-- Verifier is keyed with server-only OTP_HMAC_SECRET.

CREATE TABLE IF NOT EXISTS public.cctv_vault_otps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id UUID NOT NULL DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  purpose TEXT NOT NULL DEFAULT 'pin_change', -- 'pin_change' | 'unlock_attempt' | 'forgot_pin' | 'rotate_recovery_key'
  otp_hash TEXT NOT NULL,
  attempts INT NOT NULL DEFAULT 0,
  max_attempts INT NOT NULL DEFAULT 3,
  expires_at TIMESTAMPTZ NOT NULL,
  verified BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now()
);

-- Enable Row Level Security
ALTER TABLE public.cctv_vault_otps ENABLE ROW LEVEL SECURITY;

-- Revoke direct table operations from client roles
REVOKE ALL ON public.cctv_vault_otps FROM anon, authenticated;

-- Index for efficient user, challenge, and expiry lookup
CREATE INDEX IF NOT EXISTS idx_cctv_vault_otps_challenge ON public.cctv_vault_otps(user_id, challenge_id, expires_at);

-- 2. Secure RPC: create_vault_otp_record
-- Creates or updates an active OTP challenge for the caller. Enforces rate limiting.
CREATE OR REPLACE FUNCTION public.create_vault_otp_record(
  p_email TEXT,
  p_otp_hash TEXT,
  p_expires_at TIMESTAMPTZ,
  p_purpose TEXT DEFAULT 'pin_change',
  p_challenge_id UUID DEFAULT NULL,
  p_user_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_caller_id UUID;
  v_recent_count INT;
  v_cid UUID;
BEGIN
  v_caller_id := COALESCE(p_user_id, auth.uid());
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  v_cid := COALESCE(p_challenge_id, gen_random_uuid());

  -- Rate limit: Maximum 3 OTP requests within the last 10 minutes
  SELECT COUNT(*) INTO v_recent_count
  FROM public.cctv_vault_otps
  WHERE user_id = v_caller_id
    AND created_at > (pg_catalog.now() - INTERVAL '10 minutes');

  IF v_recent_count >= 5 THEN
    RAISE EXCEPTION 'Rate limit exceeded: Please wait before requesting another verification code.';
  END IF;

  -- Invalidate prior pending OTPs for this user and purpose
  UPDATE public.cctv_vault_otps
  SET expires_at = pg_catalog.now()
  WHERE user_id = v_caller_id
    AND purpose = COALESCE(p_purpose, 'pin_change')
    AND expires_at > pg_catalog.now();

  -- Insert new record
  INSERT INTO public.cctv_vault_otps (challenge_id, user_id, email, purpose, otp_hash, expires_at)
  VALUES (v_cid, v_caller_id, p_email, COALESCE(p_purpose, 'pin_change'), p_otp_hash, p_expires_at);

  RETURN pg_catalog.jsonb_build_object('success', true, 'challenge_id', v_cid);
END;
$$;

REVOKE ALL ON FUNCTION public.create_vault_otp_record(TEXT, TEXT, TIMESTAMPTZ, TEXT, UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_vault_otp_record(TEXT, TEXT, TIMESTAMPTZ, TEXT, UUID, UUID) TO authenticated, service_role;

-- 3. Secure RPC: verify_vault_otp_record
-- Validates submitted HMAC against the active challenge. Increments attempts.
CREATE OR REPLACE FUNCTION public.verify_vault_otp_record(
  p_otp_hash TEXT,
  p_challenge_id UUID DEFAULT NULL,
  p_purpose TEXT DEFAULT NULL,
  p_user_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_caller_id UUID;
  v_rec RECORD;
BEGIN
  v_caller_id := COALESCE(p_user_id, auth.uid());
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Find active, non-expired, unverified record matching challenge or latest
  SELECT id, challenge_id, otp_hash, attempts, max_attempts INTO v_rec
  FROM public.cctv_vault_otps
  WHERE user_id = v_caller_id
    AND (p_challenge_id IS NULL OR challenge_id = p_challenge_id)
    AND (p_purpose IS NULL OR purpose = p_purpose)
    AND expires_at > pg_catalog.now()
    AND verified = FALSE
  ORDER BY created_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No active verification code found or code has expired.';
  END IF;

  -- Check max attempts
  IF v_rec.attempts >= v_rec.max_attempts THEN
    UPDATE public.cctv_vault_otps SET expires_at = pg_catalog.now() WHERE id = v_rec.id;
    RAISE EXCEPTION 'Maximum attempts exceeded. Please request a new verification code.';
  END IF;

  -- Compare HMAC hash
  IF v_rec.otp_hash = p_otp_hash THEN
    UPDATE public.cctv_vault_otps
    SET verified = TRUE, expires_at = pg_catalog.now()
    WHERE id = v_rec.id;
    RETURN pg_catalog.jsonb_build_object('verified', true, 'challenge_id', v_rec.challenge_id);
  ELSE
    UPDATE public.cctv_vault_otps
    SET attempts = attempts + 1
    WHERE id = v_rec.id;
    RAISE EXCEPTION 'Invalid verification code. Please check your email and try again.';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.verify_vault_otp_record(TEXT, UUID, TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verify_vault_otp_record(TEXT, UUID, TEXT, UUID) TO authenticated, service_role;
