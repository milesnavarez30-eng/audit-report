-- =============================================================================
-- CCTV OPS V2 — Verified Recovery Email Registration & OTP Schema (HMAC Hardened)
-- =============================================================================
-- DEDICATED, PRIVACY-ISOLATED STORAGE FOR RECOVERY EMAIL CONTACTS.
-- DIRECT BROWSER TABLE ACCESS IS REVOKED. ALL ACCESS VIA SECURE EDGE FUNCTIONS / RPCS.
-- ZERO SENSITIVE DATA LEAKS TO ACCOUNT LISTINGS OR PROFILES.

-- 1. Table: cctv_recovery_contacts
CREATE TABLE IF NOT EXISTS public.cctv_recovery_contacts (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  recovery_email TEXT NOT NULL,
  recovery_email_verified BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now()
);

-- Enable Row Level Security & Revoke direct client access
ALTER TABLE public.cctv_recovery_contacts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.cctv_recovery_contacts FROM anon, authenticated;

-- Index
CREATE INDEX IF NOT EXISTS idx_cctv_recovery_contacts_user ON public.cctv_recovery_contacts(user_id);

-- 2. Table: cctv_recovery_email_otps
CREATE TABLE IF NOT EXISTS public.cctv_recovery_email_otps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id UUID NOT NULL DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  new_recovery_email TEXT NOT NULL,
  otp_hash TEXT NOT NULL,
  attempts INT NOT NULL DEFAULT 0,
  max_attempts INT NOT NULL DEFAULT 3,
  expires_at TIMESTAMPTZ NOT NULL,
  verified BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now()
);

-- Enable Row Level Security
ALTER TABLE public.cctv_recovery_email_otps ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.cctv_recovery_email_otps FROM anon, authenticated;

-- Index
CREATE INDEX IF NOT EXISTS idx_cctv_rec_email_challenge ON public.cctv_recovery_email_otps(user_id, challenge_id, expires_at);

-- 3. Secure RPC: create_recovery_email_challenge
CREATE OR REPLACE FUNCTION public.create_recovery_email_challenge(
  p_new_email TEXT,
  p_otp_hash TEXT,
  p_expires_at TIMESTAMPTZ,
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

  -- Rate limit: Maximum 5 challenges per 10 minutes
  SELECT COUNT(*) INTO v_recent_count
  FROM public.cctv_recovery_email_otps
  WHERE user_id = v_caller_id
    AND created_at > (pg_catalog.now() - INTERVAL '10 minutes');

  IF v_recent_count >= 5 THEN
    RAISE EXCEPTION 'Rate limit exceeded: Please wait before requesting another recovery email verification code.';
  END IF;

  -- Invalidate prior pending challenges
  UPDATE public.cctv_recovery_email_otps
  SET expires_at = pg_catalog.now()
  WHERE user_id = v_caller_id AND expires_at > pg_catalog.now();

  -- Insert challenge
  INSERT INTO public.cctv_recovery_email_otps (challenge_id, user_id, new_recovery_email, otp_hash, expires_at)
  VALUES (v_cid, v_caller_id, p_new_email, p_otp_hash, p_expires_at);

  RETURN pg_catalog.jsonb_build_object('success', true, 'challenge_id', v_cid);
END;
$$;

REVOKE ALL ON FUNCTION public.create_recovery_email_challenge(TEXT, TEXT, TIMESTAMPTZ, UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_recovery_email_challenge(TEXT, TEXT, TIMESTAMPTZ, UUID, UUID) TO authenticated, service_role;

-- 4. Secure RPC: verify_recovery_email_challenge
CREATE OR REPLACE FUNCTION public.verify_recovery_email_challenge(
  p_otp_hash TEXT,
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
  v_rec RECORD;
BEGIN
  v_caller_id := COALESCE(p_user_id, auth.uid());
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT id, challenge_id, new_recovery_email, otp_hash, attempts, max_attempts INTO v_rec
  FROM public.cctv_recovery_email_otps
  WHERE user_id = v_caller_id
    AND (p_challenge_id IS NULL OR challenge_id = p_challenge_id)
    AND expires_at > pg_catalog.now()
    AND verified = FALSE
  ORDER BY created_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No active verification challenge found or code has expired.';
  END IF;

  IF v_rec.attempts >= v_rec.max_attempts THEN
    UPDATE public.cctv_recovery_email_otps SET expires_at = pg_catalog.now() WHERE id = v_rec.id;
    RAISE EXCEPTION 'Maximum verification attempts exceeded. Please request a new code.';
  END IF;

  IF v_rec.otp_hash = p_otp_hash THEN
    UPDATE public.cctv_recovery_email_otps
    SET verified = TRUE, expires_at = pg_catalog.now()
    WHERE id = v_rec.id;

    -- Update verified recovery email in dedicated cctv_recovery_contacts table
    INSERT INTO public.cctv_recovery_contacts (user_id, recovery_email, recovery_email_verified, updated_at)
    VALUES (v_caller_id, v_rec.new_recovery_email, TRUE, pg_catalog.now())
    ON CONFLICT (user_id) DO UPDATE
    SET recovery_email = v_rec.new_recovery_email,
        recovery_email_verified = TRUE,
        updated_at = pg_catalog.now();

    RETURN pg_catalog.jsonb_build_object('verified', true, 'email', v_rec.new_recovery_email);
  ELSE
    UPDATE public.cctv_recovery_email_otps
    SET attempts = attempts + 1
    WHERE id = v_rec.id;
    RAISE EXCEPTION 'Invalid verification code. Please check your email and try again.';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.verify_recovery_email_challenge(TEXT, UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verify_recovery_email_challenge(TEXT, UUID, UUID) TO authenticated, service_role;

-- 5. Secure RPC: get_recovery_contact_status
-- Returns caller's masked recovery email only (e.g. m***@gmail.com). Never leaks full address.
CREATE OR REPLACE FUNCTION public.get_recovery_contact_status()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_caller_id UUID;
  v_rec RECORD;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT recovery_email, recovery_email_verified
  INTO v_rec
  FROM public.cctv_recovery_contacts
  WHERE user_id = v_caller_id;

  IF NOT FOUND THEN
    RETURN pg_catalog.jsonb_build_object(
      'configured', false,
      'masked_email', null
    );
  END IF;

  RETURN pg_catalog.jsonb_build_object(
    'configured', (v_rec.recovery_email_verified = TRUE),
    'masked_email', CASE
      WHEN v_rec.recovery_email_verified = TRUE THEN
        pg_catalog.concat(
          pg_catalog.substr(pg_catalog.split_part(v_rec.recovery_email, '@', 1), 1, 1),
          '***@',
          pg_catalog.split_part(v_rec.recovery_email, '@', 2)
        )
      ELSE NULL
    END
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_recovery_contact_status() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_recovery_contact_status() TO authenticated, service_role;

-- 6. Cleanup: Drop obsolete duplicate cctv_vault_security_state table & functions
DROP TABLE IF EXISTS public.cctv_vault_security_state CASCADE;
DROP FUNCTION IF EXISTS public.record_failed_vault_pin_attempt();
DROP FUNCTION IF EXISTS public.reset_vault_pin_attempts();
DROP FUNCTION IF EXISTS public.get_vault_security_status();
