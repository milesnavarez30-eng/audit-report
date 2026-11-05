-- =============================================================================
-- CCTV OPS V2 - Focus Music Player Privacy & State Isolation Migration
-- =============================================================================
-- Architecture: Standalone User State Table with Strict Row-Level Security (RLS)
-- Safe & Non-Destructive: Does not modify any existing operational tables or profiles.
-- Author: CCTV OPS Engineering
-- Date: November 2026
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. Table Definition
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.cctv_user_focus_state (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    queue JSONB NOT NULL DEFAULT '[]'::jsonb,
    playback JSONB NOT NULL DEFAULT '{}'::jsonb,
    preferences JSONB NOT NULL DEFAULT '{"isEnabled": false, "mode": "discreet", "lyricsMode": "compact", "volume": 0.8}'::jsonb,
    history JSONB NOT NULL DEFAULT '[]'::jsonb,
    custom_lyrics JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now()
);

-- -----------------------------------------------------------------------------
-- 2. Row-Level Security (RLS) Configuration
-- -----------------------------------------------------------------------------
ALTER TABLE public.cctv_user_focus_state ENABLE ROW LEVEL SECURITY;

-- Deny all privileges by default from public / anonymous roles
REVOKE ALL ON public.cctv_user_focus_state FROM anon, PUBLIC;

-- Revoke direct modification privileges from authenticated client role
-- Direct writes must go through the validated RPC function
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.cctv_user_focus_state FROM authenticated;

-- Allow authenticated users to perform direct SELECT on their own row only
GRANT SELECT ON public.cctv_user_focus_state TO authenticated;

-- Policy 1: Authenticated users can only read their own record (SECURITY INVOKER)
DROP POLICY IF EXISTS "cctv_user_focus_state_select_own" ON public.cctv_user_focus_state;
CREATE POLICY "cctv_user_focus_state_select_own"
ON public.cctv_user_focus_state
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Policy 2 & 3: Defensive RLS policies for INSERT and UPDATE (SECURITY INVOKER)
-- Even if direct table permissions were ever granted in the future,
-- RLS guarantees that only the authenticated user's row can be modified.
DROP POLICY IF EXISTS "cctv_user_focus_state_insert_own" ON public.cctv_user_focus_state;
CREATE POLICY "cctv_user_focus_state_insert_own"
ON public.cctv_user_focus_state
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "cctv_user_focus_state_update_own" ON public.cctv_user_focus_state;
CREATE POLICY "cctv_user_focus_state_update_own"
ON public.cctv_user_focus_state
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- -----------------------------------------------------------------------------
-- 3. Secure Retrieval RPC (SECURITY INVOKER with fixed search_path)
-- -----------------------------------------------------------------------------
-- In compliance with current Supabase security guidance, this function runs
-- with the caller's privileges (SECURITY INVOKER) because authenticated users
-- already possess direct SELECT grants governed by the RLS policy.
CREATE OR REPLACE FUNCTION public.get_cctv_user_focus_state()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_user_id UUID;
  v_record RECORD;
BEGIN
  -- Strict authentication check: reject anonymous callers
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
  END IF;

  SELECT queue, playback, preferences, history, custom_lyrics, updated_at
  INTO v_record
  FROM public.cctv_user_focus_state
  WHERE user_id = v_user_id;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  RETURN pg_catalog.jsonb_build_object(
    'queue', v_record.queue,
    'playback', v_record.playback,
    'preferences', v_record.preferences,
    'history', v_record.history,
    'custom_lyrics', v_record.custom_lyrics,
    'updated_at', v_record.updated_at
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_cctv_user_focus_state() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_cctv_user_focus_state() TO authenticated;

-- -----------------------------------------------------------------------------
-- 4. Secure Persistence RPC (SECURITY DEFINER with fixed search_path & validation)
-- -----------------------------------------------------------------------------
-- Justification for SECURITY DEFINER:
-- 1. Table-level direct INSERT and UPDATE are revoked from the authenticated role
--    to prevent client-side schema pollution or unvalidated direct writes.
-- 2. The function enforces that the row's user_id is ALWAYS set to auth.uid().
--    It never trusts or accepts a client-supplied user ID parameter.
-- 3. It enforces server-side array bounds (max 100 history tracks, max 50 queue tracks)
--    and payload size limits (max 250 KB) inside the database transaction.
CREATE OR REPLACE FUNCTION public.save_cctv_user_focus_state(
  p_payload JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id UUID;
  v_queue JSONB;
  v_playback JSONB;
  v_preferences JSONB;
  v_history JSONB;
  v_custom_lyrics JSONB;
  v_result JSONB;
BEGIN
  -- 1. Strict authentication check: reject anonymous callers
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
  END IF;

  -- 2. Payload validation: must be a non-null JSON object
  IF p_payload IS NULL OR pg_catalog.jsonb_typeof(p_payload) <> 'object' THEN
    RAISE EXCEPTION 'Invalid payload format: expected JSON object' USING ERRCODE = '22023';
  END IF;

  -- 3. Payload size check: reject oversized payloads (> 250 KB)
  IF pg_catalog.octet_length(p_payload::text) > 250000 THEN
    RAISE EXCEPTION 'Payload exceeds maximum allowed size (250KB)' USING ERRCODE = '22000';
  END IF;

  -- 4. Sanitize and bound Queue (max 50 tracks)
  v_queue := COALESCE(p_payload->'queue', '[]'::jsonb);
  IF pg_catalog.jsonb_typeof(v_queue) <> 'array' THEN
    v_queue := '[]'::jsonb;
  ELSE
    SELECT COALESCE(pg_catalog.jsonb_agg(elem), '[]'::jsonb)
    INTO v_queue
    FROM (
      SELECT elem FROM pg_catalog.jsonb_array_elements(v_queue) WITH ORDINALITY AS t(elem, ord)
      ORDER BY ord ASC
      LIMIT 50
    ) q;
  END IF;

  -- 5. Sanitize Playback State
  v_playback := COALESCE(p_payload->'playback', '{}'::jsonb);
  IF pg_catalog.jsonb_typeof(v_playback) <> 'object' THEN
    v_playback := '{}'::jsonb;
  END IF;

  -- 6. Sanitize Preferences
  v_preferences := COALESCE(p_payload->'preferences', '{}'::jsonb);
  IF pg_catalog.jsonb_typeof(v_preferences) <> 'object' THEN
    v_preferences := '{}'::jsonb;
  END IF;

  -- 7. Sanitize and bound Listening History (STRICT SERVER LIMIT: max 100 tracks)
  v_history := COALESCE(p_payload->'history', '[]'::jsonb);
  IF pg_catalog.jsonb_typeof(v_history) <> 'array' THEN
    v_history := '[]'::jsonb;
  ELSE
    SELECT COALESCE(pg_catalog.jsonb_agg(elem), '[]'::jsonb)
    INTO v_history
    FROM (
      SELECT elem FROM pg_catalog.jsonb_array_elements(v_history) WITH ORDINALITY AS t(elem, ord)
      ORDER BY ord ASC
      LIMIT 100
    ) h;
  END IF;

  -- 8. Sanitize Custom Lyrics
  v_custom_lyrics := COALESCE(p_payload->'custom_lyrics', '{}'::jsonb);
  IF pg_catalog.jsonb_typeof(v_custom_lyrics) <> 'object' THEN
    v_custom_lyrics := '{}'::jsonb;
  END IF;

  -- 9. Upsert record strictly for auth.uid() (Zero possibility of cross-user overwrite)
  INSERT INTO public.cctv_user_focus_state (
    user_id, queue, playback, preferences, history, custom_lyrics, updated_at
  ) VALUES (
    v_user_id, v_queue, v_playback, v_preferences, v_history, v_custom_lyrics, pg_catalog.now()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    queue = EXCLUDED.queue,
    playback = EXCLUDED.playback,
    preferences = EXCLUDED.preferences,
    history = EXCLUDED.history,
    custom_lyrics = EXCLUDED.custom_lyrics,
    updated_at = EXCLUDED.updated_at
  RETURNING pg_catalog.jsonb_build_object(
    'success', true,
    'updated_at', updated_at
  ) INTO v_result;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.save_cctv_user_focus_state(JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_cctv_user_focus_state(JSONB) TO authenticated;

COMMIT;

-- =============================================================================
-- SAFE ROLLBACK PROCEDURE (Preserves User Data by Default)
-- =============================================================================
-- To safely disable the Focus privacy backend without deleting existing user data:
--
-- REVOKE EXECUTE ON FUNCTION public.get_cctv_user_focus_state() FROM authenticated;
-- REVOKE EXECUTE ON FUNCTION public.save_cctv_user_focus_state(JSONB) FROM authenticated;
--
-- DESTRUCTIVE ROLLBACK (Requires Explicit Approval):
-- ONLY if explicitly authorized to permanently destroy all stored user Focus state:
--
-- DROP TABLE IF EXISTS public.cctv_user_focus_state CASCADE;
-- DROP FUNCTION IF EXISTS public.get_cctv_user_focus_state();
-- DROP FUNCTION IF EXISTS public.save_cctv_user_focus_state(JSONB);
-- =============================================================================

