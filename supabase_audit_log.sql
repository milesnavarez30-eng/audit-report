-- ==============================================================================
-- CCTV OPS — SECURITY AUDIT LOG MIGRATION (HARDENED ADMIN-ONLY WRITE PATH)
-- Table: public.cctv_security_audit_logs
-- Purpose: Centralized, tamper-resistant security & administrative audit log.
-- Access:
--   - SELECT: Approved Admin only (role = 'admin' AND status = 'approved')
--   - INSERT/UPDATE/DELETE: Direct client mutations blocked via RLS & revoked privileges
--   - WRITES: Strictly via SECURITY DEFINER function public.log_cctv_security_event()
--             (requires caller to be an approved Admin in public.profiles)
-- Safe to re-run: Yes (idempotent DDL & policy definitions)
-- ==============================================================================

-- 1. Create the security audit logs table
CREATE TABLE IF NOT EXISTS public.cctv_security_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    actor_username TEXT NOT NULL DEFAULT '',
    actor_role TEXT NOT NULL DEFAULT 'admin',
    action TEXT NOT NULL,
    target_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    target_item TEXT DEFAULT '',
    details JSONB DEFAULT '{}'::jsonb,
    ip_hint TEXT DEFAULT ''
);

-- 2. Create useful indexes for administrative querying and log ordering
CREATE INDEX IF NOT EXISTS idx_cctv_audit_logs_created_at
    ON public.cctv_security_audit_logs (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_cctv_audit_logs_actor_id
    ON public.cctv_security_audit_logs (actor_id);

CREATE INDEX IF NOT EXISTS idx_cctv_audit_logs_action
    ON public.cctv_security_audit_logs (action);

-- 3. Enable Row Level Security (RLS)
ALTER TABLE public.cctv_security_audit_logs ENABLE ROW LEVEL SECURITY;

-- 4. Admin verification function (Hardened)
-- Checks public.profiles using role = 'admin' AND status = 'approved'
CREATE OR REPLACE FUNCTION public.is_cctv_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid()
          AND role = 'admin'
          AND status = 'approved'
    );
$$;

-- 5. Row Level Security Policies
-- Clean up any prior permissive or legacy policies
DROP POLICY IF EXISTS "Users can insert audit log entries" ON public.cctv_security_audit_logs;
DROP POLICY IF EXISTS "Anyone can insert audit log entries" ON public.cctv_security_audit_logs;
DROP POLICY IF EXISTS "Admins can view security audit logs" ON public.cctv_security_audit_logs;
DROP POLICY IF EXISTS "Block direct inserts" ON public.cctv_security_audit_logs;
DROP POLICY IF EXISTS "Block updates" ON public.cctv_security_audit_logs;
DROP POLICY IF EXISTS "Block deletes" ON public.cctv_security_audit_logs;

-- Policy: Only approved Admin accounts can view the audit log
CREATE POLICY "Admins can view security audit logs"
    ON public.cctv_security_audit_logs
    FOR SELECT
    TO authenticated
    USING (public.is_cctv_admin());

-- Note on INSERT / UPDATE / DELETE:
-- By enabling RLS and defining NO INSERT, UPDATE, or DELETE policies, Postgres
-- defaults to DENY for all direct client-side write operations.
-- Direct client-side INSERT/UPDATE/DELETE is impossible for both anon and authenticated.

-- 6. Hardened RPC: Log security & administrative events (Admin Only)
-- Requirements:
--   - SECURITY DEFINER to bypass table write restrictions
--   - search_path pinned to public to prevent search_path poisoning
--   - Rejects unauthenticated calls (auth.uid() IS NULL)
--   - Authoritative caller identity derived strictly from public.profiles
--   - Requires role = 'admin' AND status = 'approved' (raises 'Admin access required')
--   - Never accepts actor identity, role, or credentials from frontend parameters
--   - Strips passwords, tokens, API keys, and secrets from details payload
CREATE OR REPLACE FUNCTION public.log_cctv_security_event(
    p_action TEXT,
    p_target_user_id UUID DEFAULT NULL,
    p_target_item TEXT DEFAULT '',
    p_details JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_actor_id UUID;
    v_actor_username TEXT;
    v_actor_role TEXT;
    v_actor_status TEXT;
    v_sanitized_details JSONB;
    v_log_id UUID;
BEGIN
    -- 1. Reject unauthenticated calls
    v_actor_id := auth.uid();
    IF v_actor_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required to write security audit events.';
    END IF;

    -- 2. Load caller strictly from public.profiles and enforce approved Admin access
    SELECT username, role, status
    INTO v_actor_username, v_actor_role, v_actor_status
    FROM public.profiles
    WHERE id = v_actor_id;

    IF NOT FOUND OR v_actor_role <> 'admin' OR v_actor_status <> 'approved' THEN
        RAISE EXCEPTION 'Admin access required';
    END IF;

    -- 3. Sanitize details: strip passwords, tokens, API keys, or secret fields
    IF p_details IS NOT NULL AND jsonb_typeof(p_details) = 'object' THEN
        v_sanitized_details := p_details
            - 'password'
            - 'pass'
            - 'newPassword'
            - 'temporary_password'
            - 'temp_password'
            - 'token'
            - 'accessToken'
            - 'access_token'
            - 'refreshToken'
            - 'refresh_token'
            - 'secret'
            - 'apiKey'
            - 'apikey'
            - 'api_key'
            - 'service_role'
            - 'service_role_key';
    ELSE
        v_sanitized_details := '{}'::jsonb;
    END IF;

    -- 4. Insert log entry safely
    INSERT INTO public.cctv_security_audit_logs (
        actor_id,
        actor_username,
        actor_role,
        action,
        target_user_id,
        target_item,
        details
    ) VALUES (
        v_actor_id,
        COALESCE(NULLIF(TRIM(v_actor_username), ''), 'admin'),
        'admin',
        COALESCE(NULLIF(TRIM(p_action), ''), 'unspecified_action'),
        p_target_user_id,
        COALESCE(p_target_item, ''),
        v_sanitized_details
    ) RETURNING id INTO v_log_id;

    RETURN v_log_id;
END;
$$;

-- 7. Grant & Revoke Permissions
-- Revoke all table privileges from PUBLIC, anon, and authenticated
REVOKE ALL ON TABLE public.cctv_security_audit_logs FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.is_cctv_admin() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.log_cctv_security_event(TEXT, UUID, TEXT, JSONB) FROM PUBLIC, anon;

-- Grant minimal necessary privileges:
-- - SELECT on table: Permitted to authenticated users, but RLS restricts rows to approved Admins only
-- - EXECUTE on functions: Permitted to authenticated users (RPC enforces approved Admin check internally)
GRANT SELECT ON TABLE public.cctv_security_audit_logs TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_cctv_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_cctv_security_event(TEXT, UUID, TEXT, JSONB) TO authenticated;
