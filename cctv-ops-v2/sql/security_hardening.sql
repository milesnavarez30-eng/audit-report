-- =============================================================================
-- CCTV OPS V2 - Production Supabase Security Hardening & Authorization Migration
-- =============================================================================
-- Architecture: Super Admin + Granular Administrative Permissions + Standard User
-- Authoritative schema definitions, deny-by-default Row Level Security (RLS),
-- role escalation prevention, Last Super Admin protection, search_path isolation,
-- clean auth.users deletion, and tamper-proof security audit log tracking.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. Schema Validation & Role Constraint Hardening
-- -----------------------------------------------------------------------------

-- Ensure profiles table has Row Level Security enabled
ALTER TABLE IF EXISTS public.profiles ENABLE ROW LEVEL SECURITY;

-- Update / Add role check constraint safely preserving existing rows (NO exception swallowing)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'profiles_role_check' AND conrelid = 'public.profiles'::regclass
  ) THEN
    ALTER TABLE public.profiles DROP CONSTRAINT profiles_role_check;
  END IF;

  ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check 
    CHECK (role IN ('super_admin', 'admin', 'user'));
END $$;

-- Ensure approved_by foreign key uses ON DELETE SET NULL (NO exception swallowing)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'profiles_approved_by_fkey' AND conrelid = 'public.profiles'::regclass
  ) THEN
    ALTER TABLE public.profiles DROP CONSTRAINT profiles_approved_by_fkey;
  END IF;

  ALTER TABLE public.profiles ADD CONSTRAINT profiles_approved_by_fkey 
    FOREIGN KEY (approved_by) REFERENCES auth.users(id) ON DELETE SET NULL;
END $$;

-- -----------------------------------------------------------------------------
-- Clean up all obsolete/legacy policies and functions
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "profiles_read_self_or_admin" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Authorized users can view profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own display info" ON public.profiles;
DROP POLICY IF EXISTS "Super admins full management on profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins manage profiles with permissions" ON public.profiles;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.profiles;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.profiles;
DROP POLICY IF EXISTS "Enable update for users based on email" ON public.profiles;
DROP POLICY IF EXISTS "Public profiles are viewable by everyone." ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile." ON public.profiles;
DROP POLICY IF EXISTS "Admins have full access." ON public.profiles;

DROP POLICY IF EXISTS "Admins can view security audit logs" ON public.cctv_security_audit_logs;
DROP POLICY IF EXISTS "Authorized admins can view audit logs" ON public.cctv_security_audit_logs;
DROP POLICY IF EXISTS "Only admins can view audit logs" ON public.cctv_security_audit_logs;
DROP POLICY IF EXISTS "Users can insert audit log entries" ON public.cctv_security_audit_logs;
DROP POLICY IF EXISTS "Anyone can insert audit log entries" ON public.cctv_security_audit_logs;
DROP POLICY IF EXISTS "Authenticated users can record audit logs" ON public.cctv_security_audit_logs;
DROP POLICY IF EXISTS "Block direct inserts" ON public.cctv_security_audit_logs;
DROP POLICY IF EXISTS "Block updates" ON public.cctv_security_audit_logs;
DROP POLICY IF EXISTS "Block deletes" ON public.cctv_security_audit_logs;

-- Drop legacy policy on access_logs before dropping public.is_admin() to prevent dependency errors
DROP POLICY IF EXISTS "access_logs_admin_read" ON public.access_logs;

-- Remove obsolete public helper functions once dependent policies are dropped
DROP FUNCTION IF EXISTS public.is_admin();
DROP FUNCTION IF EXISTS public.is_cctv_admin();
DROP FUNCTION IF EXISTS public.is_cctv_super_admin();
DROP FUNCTION IF EXISTS public.cctv_has_permission(TEXT);

-- Revoke direct modification table privileges from authenticated & anon
REVOKE TRUNCATE, TRIGGER, REFERENCES, INSERT, UPDATE, DELETE ON public.profiles FROM anon;
REVOKE TRUNCATE, TRIGGER, REFERENCES, INSERT, UPDATE, DELETE ON public.profiles FROM authenticated;
GRANT SELECT ON public.profiles TO authenticated;

-- Strictly scope direct profile updates to display_name only at database privilege level
GRANT UPDATE (display_name) ON public.profiles TO authenticated;

-- Automatic profile provisioner on auth.users insertion
CREATE OR REPLACE FUNCTION public.handle_new_cctv_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (
    id,
    email,
    username,
    display_name,
    role,
    status,
    permissions
  ) VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'username', pg_catalog.split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'name', pg_catalog.split_part(NEW.email, '@', 1)),
    'user',
    'pending',
    pg_catalog.jsonb_build_object(
      'report', false,
      'conduct', false,
      'edr', false,
      'audit', false,
      'trackers', false,
      'hris', false,
      'sorter', false,
      'maintenance', false,
      'pending', false,
      'followup', false,
      'masterlist', false,
      'history', false,
      'manageOptions', false,
      'accounts', false,
      'manage_users', false,
      'manage_roles', false,
      'manage_permissions', false,
      'view_security_logs', false
    )
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.handle_new_cctv_user() FROM PUBLIC;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_cctv_user();


-- -----------------------------------------------------------------------------
-- 2. Dedicated Private Authorization Schema & Internal Helper Functions
-- -----------------------------------------------------------------------------
-- Internal functions are kept in private schema so PostgREST does NOT expose
-- them as public RPC endpoints.
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA private TO authenticated, postgres;

-- Helper 2.1: Check if caller is an active approved Super Administrator
CREATE OR REPLACE FUNCTION private.is_cctv_super_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND role = 'super_admin'
      AND status = 'approved'
  );
$$;

REVOKE ALL ON FUNCTION private.is_cctv_super_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.is_cctv_super_admin() TO authenticated, postgres;


-- Helper 2.2: Check if caller is an active approved Administrator (super_admin or admin)
CREATE OR REPLACE FUNCTION private.is_cctv_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND role IN ('super_admin', 'admin')
      AND status = 'approved'
  );
$$;

REVOKE ALL ON FUNCTION private.is_cctv_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.is_cctv_admin() TO authenticated, postgres;


-- Helper 2.3: Check if caller possesses a specific granular permission
CREATE OR REPLACE FUNCTION private.cctv_has_permission(p_permission TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
STABLE
AS $$
DECLARE
  v_role TEXT;
  v_status TEXT;
  v_perms JSONB;
BEGIN
  SELECT role, status, permissions INTO v_role, v_status, v_perms
  FROM public.profiles
  WHERE id = auth.uid();

  IF v_status IS DISTINCT FROM 'approved' THEN
    RETURN FALSE;
  END IF;

  -- Super Admin has universal access
  IF v_role = 'super_admin' THEN
    RETURN TRUE;
  END IF;

  -- Normal Admin checks granted permission
  IF v_role = 'admin' THEN
    IF v_perms IS NULL THEN
      RETURN FALSE;
    END IF;

    IF (v_perms->>p_permission)::boolean IS TRUE THEN
      RETURN TRUE;
    END IF;
  END IF;

  RETURN FALSE;
END;
$$;

REVOKE ALL ON FUNCTION private.cctv_has_permission(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.cctv_has_permission(TEXT) TO authenticated, postgres;


-- -----------------------------------------------------------------------------
-- 3. Normalize ALL Existing Permissions JSON (Including NULL rows)
-- -----------------------------------------------------------------------------
-- Runs BEFORE trigger activation.
-- Upgrades legacy JSON keys ('cctv', 'aiSorter') into authoritative flags.
-- Coalesces NULL permissions to an empty object '{}'::jsonb so all rows are normalized.
-- manageOptions is preserved separately for custom options management.
-- New administrative capabilities (manage_users, manage_roles, manage_permissions, view_security_logs)
-- default strictly to false for existing accounts unless the role is super_admin.
UPDATE public.profiles
SET permissions = pg_catalog.jsonb_build_object(
  'report', COALESCE((COALESCE(permissions, '{}'::jsonb)->>'report')::boolean, (COALESCE(permissions, '{}'::jsonb)->>'cctv')::boolean, false),
  'conduct', COALESCE((COALESCE(permissions, '{}'::jsonb)->>'conduct')::boolean, false),
  'edr', COALESCE((COALESCE(permissions, '{}'::jsonb)->>'edr')::boolean, false),
  'audit', COALESCE((COALESCE(permissions, '{}'::jsonb)->>'audit')::boolean, (COALESCE(permissions, '{}'::jsonb)->>'cctv')::boolean, false),
  'trackers', COALESCE((COALESCE(permissions, '{}'::jsonb)->>'trackers')::boolean, false),
  'hris', COALESCE((COALESCE(permissions, '{}'::jsonb)->>'hris')::boolean, false),
  'sorter', COALESCE((COALESCE(permissions, '{}'::jsonb)->>'sorter')::boolean, (COALESCE(permissions, '{}'::jsonb)->>'aiSorter')::boolean, false),
  'maintenance', COALESCE((COALESCE(permissions, '{}'::jsonb)->>'maintenance')::boolean, false),
  'pending', COALESCE((COALESCE(permissions, '{}'::jsonb)->>'pending')::boolean, false),
  'followup', COALESCE((COALESCE(permissions, '{}'::jsonb)->>'followup')::boolean, false),
  'masterlist', COALESCE((COALESCE(permissions, '{}'::jsonb)->>'masterlist')::boolean, false),
  'history', COALESCE((COALESCE(permissions, '{}'::jsonb)->>'history')::boolean, false),
  'manageOptions', COALESCE((COALESCE(permissions, '{}'::jsonb)->>'manageOptions')::boolean, false),
  'accounts', CASE WHEN role = 'super_admin' THEN true ELSE COALESCE((COALESCE(permissions, '{}'::jsonb)->>'accounts')::boolean, false) END,
  'manage_users', CASE WHEN role = 'super_admin' THEN true ELSE false END,
  'manage_roles', CASE WHEN role = 'super_admin' THEN true ELSE false END,
  'manage_permissions', CASE WHEN role = 'super_admin' THEN true ELSE false END,
  'view_security_logs', CASE WHEN role = 'super_admin' THEN true ELSE false END
);


-- -----------------------------------------------------------------------------
-- 4. Initial Super Admin Bootstrap (Executed BEFORE Trigger Activation)
-- -----------------------------------------------------------------------------
-- Promoting the designated initial Super Admin account before attaching
-- trg_prevent_role_tampering guarantees that the one-time DBA bootstrap
-- succeeds cleanly without being blocked by anti-tampering triggers.
-- Exactly the specified existing user UUID becomes super_admin; no other account is promoted.
-- Note: The UUID is NOT hardcoded into authorization logic, triggers, or RLS policies.
DO $$
DECLARE
  -- Specify the exact UUID of the existing user account in auth.users/public.profiles to bootstrap:
  v_bootstrap_id_text TEXT := '8b06326d-8790-4223-918f-772f45d71be4';
  v_bootstrap_id UUID;
  v_rows_affected INT := 0;
  v_super_count INT := 0;
BEGIN
  IF v_bootstrap_id_text IS NULL 
     OR v_bootstrap_id_text = '' 
     OR v_bootstrap_id_text = '<DESIGNATED_EXISTING_USER_UUID>'
  THEN
    RAISE EXCEPTION 'Bootstrap Aborted: You must replace "<DESIGNATED_EXISTING_USER_UUID>" with the exact UUID of an existing user before executing this migration.';
  END IF;

  BEGIN
    v_bootstrap_id := v_bootstrap_id_text::UUID;
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'Bootstrap Aborted: Invalid UUID format "%".', v_bootstrap_id_text;
  END;

  UPDATE public.profiles
  SET 
    role = 'super_admin',
    status = 'approved',
    permissions = pg_catalog.jsonb_build_object(
      'all', true,
      'super_admin', true,
      'accounts', true,
      'manage_users', true,
      'manage_roles', true,
      'manage_permissions', true,
      'view_security_logs', true
    )
  WHERE id = v_bootstrap_id;

  GET DIAGNOSTICS v_rows_affected = ROW_COUNT;

  -- The migration/bootstrap process must abort if zero or multiple intended bootstrap rows are affected.
  IF v_rows_affected <> 1 THEN
    RAISE EXCEPTION 'Bootstrap Aborted: Expected exactly 1 row to be updated for UUID %, but % rows were affected. Verify that the target UUID exists in public.profiles.', v_bootstrap_id, v_rows_affected;
  END IF;

  -- Before activating the anti-tampering trigger, verify exactly one approved profile has role = 'super_admin'
  SELECT pg_catalog.count(*) INTO v_super_count
  FROM public.profiles
  WHERE role = 'super_admin' AND status = 'approved';

  IF v_super_count <> 1 THEN
    RAISE EXCEPTION 'Bootstrap Aborted: Verification failed. Expected exactly 1 approved Super Admin in public.profiles, found %.', v_super_count;
  END IF;

  RAISE NOTICE 'CCTV OPS Bootstrap: Successfully designated profile UUID % as initial Super Admin.', v_bootstrap_id;
END $$;


-- -----------------------------------------------------------------------------
-- 5. Row-Level Security Policies for Profiles
-- -----------------------------------------------------------------------------

-- Policy 5.1: Granular Profile Viewing:
-- Super Admin: may read all profiles
-- Normal Admin: may read all profiles only when granted administrative account/user management capability
-- Ordinary User: own profile only
CREATE POLICY "Authorized users can view profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  -- Ordinary User: own profile only
  auth.uid() = id
  -- Super Admin: may read all profiles
  OR private.is_cctv_super_admin()
  -- Normal Admin: may read all profiles ONLY when granted administrative account management capability
  OR (
    private.is_cctv_admin() AND (
      private.cctv_has_permission('accounts')
      OR private.cctv_has_permission('manage_users')
      OR private.cctv_has_permission('manage_permissions')
    )
  )
);

-- Policy 5.2: Users can update their own display name only
-- Database privilege level limits column to display_name.
-- Trigger trg_prevent_role_tampering guarantees role/status/permissions are untouched.
-- All other modifications MUST go through authoritative RPCs or server-side Edge Functions.
CREATE POLICY "Users can update own display info"
ON public.profiles
FOR UPDATE
TO authenticated
USING (
  auth.uid() = id
)
WITH CHECK (
  auth.uid() = id
);


-- -----------------------------------------------------------------------------
-- 6. Database Trigger: Tamper-Proof Role & Privilege Escalation Protection
-- -----------------------------------------------------------------------------
-- Activated AFTER Section 4 bootstrap is complete.
CREATE OR REPLACE FUNCTION public.prevent_role_tampering()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_caller_role TEXT;
  v_caller_status TEXT;
  v_super_count INT;
BEGIN
  -- 0. Trusted Service Role Bypass:
  -- Allow a trusted service_role request to bypass ONLY this anti-tampering trigger.
  -- The service_role key is kept secret on the serverless runtime and used strictly by
  -- cctv-admin-create-user to provision new accounts. Browser clients (anon/authenticated)
  -- can never obtain or present service_role.
  IF auth.role() = 'service_role' 
     OR COALESCE(NULLIF(pg_catalog.current_setting('request.jwt.claim.role', true), ''), '') = 'service_role' 
  THEN
    RETURN NEW;
  END IF;

  SELECT role, status INTO v_caller_role, v_caller_status
  FROM public.profiles
  WHERE id = auth.uid();

  -- 1. Non-administrators cannot modify role, status, or permissions
  IF v_caller_role IS NULL OR v_caller_status IS DISTINCT FROM 'approved' OR v_caller_role NOT IN ('super_admin', 'admin') THEN
    IF NEW.role IS DISTINCT FROM OLD.role THEN
      RAISE EXCEPTION 'Access Denied: Non-administrators cannot modify user roles.';
    END IF;
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      RAISE EXCEPTION 'Access Denied: Non-administrators cannot modify account status.';
    END IF;
    IF NEW.permissions IS DISTINCT FROM OLD.permissions THEN
      RAISE EXCEPTION 'Access Denied: Non-administrators cannot modify workspace permissions.';
    END IF;
  END IF;

  -- 2. Only Super Admin can modify or demote a Super Admin
  IF OLD.role = 'super_admin' THEN
    IF NOT private.is_cctv_super_admin() THEN
      RAISE EXCEPTION 'Access Denied: Only an approved Super Administrator can modify a Super Admin profile.';
    END IF;

    -- LAST SUPER ADMIN LOCKOUT GUARD:
    IF (NEW.role IS DISTINCT FROM 'super_admin' OR NEW.status IS DISTINCT FROM 'approved') THEN
      SELECT pg_catalog.count(*) INTO v_super_count
      FROM public.profiles
      WHERE role = 'super_admin'
        AND status = 'approved'
        AND id <> OLD.id;

      IF v_super_count = 0 THEN
        RAISE EXCEPTION 'Operation Denied: Cannot demote or deactivate the final remaining Super Administrator.';
      END IF;
    END IF;
  END IF;

  -- 3. Only Super Admin can create or promote to Super Admin
  IF NEW.role = 'super_admin' AND NOT private.is_cctv_super_admin() THEN
    RAISE EXCEPTION 'Access Denied: Only an approved Super Administrator can grant the Super Admin role.';
  END IF;

  -- 4. Only Super Admin can create, promote, or alter an Admin
  IF (NEW.role = 'admin' OR OLD.role = 'admin') AND NOT private.is_cctv_super_admin() THEN
    IF NEW.role IS DISTINCT FROM OLD.role THEN
      RAISE EXCEPTION 'Access Denied: Only an approved Super Administrator can grant, modify, or revoke the Admin role.';
    END IF;
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      RAISE EXCEPTION 'Access Denied: Only an approved Super Administrator can alter the status of an Administrator.';
    END IF;
  END IF;

  -- 5. Normal Admin modifying a standard user
  IF v_caller_role = 'admin' AND v_caller_status = 'approved' THEN
    IF NEW.role IS DISTINCT FROM OLD.role THEN
      RAISE EXCEPTION 'Access Denied: Normal Administrators cannot modify user roles.';
    END IF;
    IF NEW.status IS DISTINCT FROM OLD.status AND NOT private.cctv_has_permission('manage_users') THEN
      RAISE EXCEPTION 'Access Denied: manage_users permission required.';
    END IF;
    IF NEW.permissions IS DISTINCT FROM OLD.permissions AND NOT private.cctv_has_permission('manage_permissions') THEN
      RAISE EXCEPTION 'Access Denied: manage_permissions permission required.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.prevent_role_tampering() FROM PUBLIC;

DROP TRIGGER IF EXISTS trg_prevent_role_tampering ON public.profiles;
CREATE TRIGGER trg_prevent_role_tampering
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.prevent_role_tampering();


-- -----------------------------------------------------------------------------
-- 7. Append-Only Tamper-Proof Security Audit Logs
-- -----------------------------------------------------------------------------
-- Audit Architecture Consistency:
-- RPC-only for browser clients; trusted server-side Edge Functions may write authoritative audit records.
-- Browser clients have direct INSERT, UPDATE, DELETE, and TRUNCATE completely revoked.
-- Browser audit events MUST go through public.log_cctv_security_event() RPC.
-- Trusted server-side Edge Functions run with service_role and derive actor identity server-side.

CREATE TABLE IF NOT EXISTS public.cctv_security_audit_logs (
  id UUID PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now(),
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_username TEXT NOT NULL,
  actor_role TEXT NOT NULL DEFAULT 'user',
  action TEXT NOT NULL,
  target_user_id UUID,
  target_item TEXT,
  details JSONB DEFAULT '{}'::jsonb
);

ALTER TABLE public.cctv_security_audit_logs ENABLE ROW LEVEL SECURITY;

-- Strictly REVOKE all direct modification privileges from client roles
-- (RPC-only for browser clients; trusted server-side Edge Functions may write authoritative audit records)
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.cctv_security_audit_logs FROM authenticated, anon;
GRANT SELECT ON public.cctv_security_audit_logs TO authenticated;

-- Policy 7.1: Only Super Admins and Admins with view_security_logs can view audit trail
CREATE POLICY "Authorized admins can view audit logs"
ON public.cctv_security_audit_logs
FOR SELECT
TO authenticated
USING (
  private.is_cctv_super_admin() OR private.cctv_has_permission('view_security_logs')
);

-- Policy 7.2: Recreate access_logs SELECT authorization using the new model
-- Super Admin: allowed; Admin: allowed only with view_security_logs=true; User: denied
CREATE POLICY "access_logs_authorized_read"
ON public.access_logs
FOR SELECT
TO authenticated
USING (
  private.is_cctv_super_admin()
  OR private.cctv_has_permission('view_security_logs')
);


-- -----------------------------------------------------------------------------
-- 8. Authoritative Administrative & User RPC Functions (Exposed to PostgREST)
-- -----------------------------------------------------------------------------
-- Explicitly drop legacy RPC signatures whose return types differ in the new model
-- (PostgreSQL CREATE OR REPLACE FUNCTION cannot change return types of existing functions)
DROP FUNCTION IF EXISTS public.admin_set_user_status(UUID, TEXT);
DROP FUNCTION IF EXISTS public.admin_set_user_access(UUID, TEXT, JSONB);
DROP FUNCTION IF EXISTS public.log_cctv_security_event(TEXT, UUID, TEXT, JSONB);

-- RPC 8.1: Admin Set User Status (with Target Validation & Approved Caller Guard)
CREATE OR REPLACE FUNCTION public.admin_set_user_status(
  p_target UUID,
  p_status TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_target_role TEXT;
  v_target_username TEXT;
  v_super_count INT;
  v_rows INT;
BEGIN
  -- 1. Caller MUST be an active approved administrator
  IF NOT private.is_cctv_admin() THEN
    RAISE EXCEPTION 'Access Denied: Active approved administrator status required.';
  END IF;

  -- 2. Target validation: verify target exists in public.profiles
  SELECT role, username INTO v_target_role, v_target_username 
  FROM public.profiles 
  WHERE id = p_target;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Operation Failed: Target account does not exist.';
  END IF;

  -- 3. Status value validation (CCTV OPS status values remain approved, pending, rejected)
  IF p_status NOT IN ('approved', 'pending', 'rejected') THEN
    RAISE EXCEPTION 'Operation Failed: Invalid status value "%". Allowed values: approved, pending, rejected.', p_status;
  END IF;

  -- 4. Authority Check:
  -- Only approved Super Admin can change status of Admin or Super Admin
  IF v_target_role IN ('super_admin', 'admin') THEN
    IF NOT private.is_cctv_super_admin() THEN
      RAISE EXCEPTION 'Access Denied: Only an approved Super Administrator can change the status of an Administrator.';
    END IF;

    -- Last Super Admin Protection
    IF v_target_role = 'super_admin' AND p_status <> 'approved' THEN
      SELECT pg_catalog.count(*) INTO v_super_count
      FROM public.profiles
      WHERE role = 'super_admin' AND status = 'approved' AND id <> p_target;

      IF v_super_count = 0 THEN
        RAISE EXCEPTION 'Operation Denied: Cannot deactivate or reject the final remaining Super Administrator.';
      END IF;
    END IF;
  ELSE
    -- Target is standard user: caller must be Super Admin or Admin with manage_users
    IF NOT (private.is_cctv_super_admin() OR private.cctv_has_permission('manage_users')) THEN
      RAISE EXCEPTION 'Access Denied: manage_users permission required.';
    END IF;
  END IF;

  -- Update status without mutating last_seen_at (preserves true user activity timestamp)
  UPDATE public.profiles
  SET status = p_status
  WHERE id = p_target;

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows = 0 THEN
    RAISE EXCEPTION 'Operation Failed: Target account was not updated.';
  END IF;

  -- Server-side audit log entry
  INSERT INTO public.cctv_security_audit_logs (
    actor_id,
    actor_username,
    actor_role,
    action,
    target_user_id,
    target_item,
    details
  )
  SELECT
    auth.uid(),
    p.username,
    p.role,
    'admin_status_change',
    p_target,
    COALESCE(v_target_username, p_status),
    pg_catalog.jsonb_build_object('new_status', p_status, 'target_role', v_target_role)
  FROM public.profiles p
  WHERE p.id = auth.uid();
END;
$$;

REVOKE ALL ON FUNCTION public.admin_set_user_status(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_set_user_status(UUID, TEXT) TO authenticated;


-- RPC 8.2: Admin Set User Access (with Strict Role Validation & Server-Side Permission Whitelisting)
CREATE OR REPLACE FUNCTION public.admin_set_user_access(
  p_target UUID,
  p_role TEXT,
  p_permissions JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_target_role TEXT;
  v_target_username TEXT;
  v_sanitized_perms JSONB;
  v_rows INT;
BEGIN
  -- 1. Caller MUST be an active approved administrator
  IF NOT private.is_cctv_admin() THEN
    RAISE EXCEPTION 'Access Denied: Active approved administrator status required.';
  END IF;

  -- 2. Target validation: verify target exists in public.profiles
  SELECT role, username INTO v_target_role, v_target_username 
  FROM public.profiles 
  WHERE id = p_target;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Operation Failed: Target account does not exist.';
  END IF;

  IF v_target_role = 'super_admin' THEN
    RAISE EXCEPTION 'Operation Denied: Super Administrator access must be changed through the dedicated Super Admin role-management flow.';
  END IF;

  -- 3. Role value validation: generic access function accepts only 'admin' or 'user'
  -- Super Admin promotion/demotion must remain a separate explicit Super-Admin-only flow.
  IF p_role NOT IN ('admin', 'user') THEN
    RAISE EXCEPTION 'Operation Failed: Invalid role value "%". Only "admin" or "user" may be assigned through this function.', p_role;
  END IF;

  -- 4. Permissions object validation
  IF p_permissions IS NULL OR pg_catalog.jsonb_typeof(p_permissions) <> 'object' THEN
    RAISE EXCEPTION 'Operation Failed: Permissions must be a valid JSON object.';
  END IF;

  -- 5. Authority Check:
  -- ONLY approved Super Admin can grant, modify, or demote an Admin
  IF (p_role = 'admin' OR v_target_role = 'admin') THEN
    IF NOT private.is_cctv_super_admin() THEN
      RAISE EXCEPTION 'Access Denied: Only an approved Super Administrator can grant, modify, or revoke Administrator roles.';
    END IF;
  ELSE
    -- Target is standard user and remaining user: normal admin requires manage_permissions
    IF NOT (private.is_cctv_super_admin() OR private.cctv_has_permission('manage_permissions')) THEN
      RAISE EXCEPTION 'Access Denied: manage_permissions permission required.';
    END IF;
  END IF;

  -- 6. Server-side permission whitelisting & sanitization:
  IF p_role = 'admin' THEN
    -- Admin role: Whitelist known Admin permission keys
    -- Never allow manage_roles, super_admin, or all for a normal Admin (force false)
    -- Grantable Admin capabilities (accounts, manage_users, manage_permissions, view_security_logs)
    -- and operational workspaces are honored only when explicitly granted
    v_sanitized_perms := pg_catalog.jsonb_build_object(
      'report', COALESCE(p_permissions->'report' = 'true'::jsonb OR (p_permissions->>'report') = 'true', false),
      'conduct', COALESCE(p_permissions->'conduct' = 'true'::jsonb OR (p_permissions->>'conduct') = 'true', false),
      'edr', COALESCE(p_permissions->'edr' = 'true'::jsonb OR (p_permissions->>'edr') = 'true', false),
      'audit', COALESCE(p_permissions->'audit' = 'true'::jsonb OR (p_permissions->>'audit') = 'true', false),
      'trackers', COALESCE(p_permissions->'trackers' = 'true'::jsonb OR (p_permissions->>'trackers') = 'true', false),
      'hris', COALESCE(p_permissions->'hris' = 'true'::jsonb OR (p_permissions->>'hris') = 'true', false),
      'sorter', COALESCE(p_permissions->'sorter' = 'true'::jsonb OR (p_permissions->>'sorter') = 'true', false),
      'maintenance', COALESCE(p_permissions->'maintenance' = 'true'::jsonb OR (p_permissions->>'maintenance') = 'true', false),
      'pending', COALESCE(p_permissions->'pending' = 'true'::jsonb OR (p_permissions->>'pending') = 'true', false),
      'followup', COALESCE(p_permissions->'followup' = 'true'::jsonb OR (p_permissions->>'followup') = 'true', false),
      'masterlist', COALESCE(p_permissions->'masterlist' = 'true'::jsonb OR (p_permissions->>'masterlist') = 'true', false),
      'history', COALESCE(p_permissions->'history' = 'true'::jsonb OR (p_permissions->>'history') = 'true', false),
      'manageOptions', COALESCE(p_permissions->'manageOptions' = 'true'::jsonb OR (p_permissions->>'manageOptions') = 'true', false),
      'accounts', COALESCE(p_permissions->'accounts' = 'true'::jsonb OR (p_permissions->>'accounts') = 'true', false),
      'manage_users', COALESCE(p_permissions->'manage_users' = 'true'::jsonb OR (p_permissions->>'manage_users') = 'true', false),
      'manage_permissions', COALESCE(p_permissions->'manage_permissions' = 'true'::jsonb OR (p_permissions->>'manage_permissions') = 'true', false),
      'view_security_logs', COALESCE(p_permissions->'view_security_logs' = 'true'::jsonb OR (p_permissions->>'view_security_logs') = 'true', false),
      'manage_roles', false,
      'super_admin', false,
      'all', false
    );
  ELSE
    -- User role: Whitelist operational workspace keys only
    -- Force all administrative capability and privileged flags false
    v_sanitized_perms := pg_catalog.jsonb_build_object(
      'report', COALESCE(p_permissions->'report' = 'true'::jsonb OR (p_permissions->>'report') = 'true', false),
      'conduct', COALESCE(p_permissions->'conduct' = 'true'::jsonb OR (p_permissions->>'conduct') = 'true', false),
      'edr', COALESCE(p_permissions->'edr' = 'true'::jsonb OR (p_permissions->>'edr') = 'true', false),
      'audit', COALESCE(p_permissions->'audit' = 'true'::jsonb OR (p_permissions->>'audit') = 'true', false),
      'trackers', COALESCE(p_permissions->'trackers' = 'true'::jsonb OR (p_permissions->>'trackers') = 'true', false),
      'hris', COALESCE(p_permissions->'hris' = 'true'::jsonb OR (p_permissions->>'hris') = 'true', false),
      'sorter', COALESCE(p_permissions->'sorter' = 'true'::jsonb OR (p_permissions->>'sorter') = 'true', false),
      'maintenance', COALESCE(p_permissions->'maintenance' = 'true'::jsonb OR (p_permissions->>'maintenance') = 'true', false),
      'pending', COALESCE(p_permissions->'pending' = 'true'::jsonb OR (p_permissions->>'pending') = 'true', false),
      'followup', COALESCE(p_permissions->'followup' = 'true'::jsonb OR (p_permissions->>'followup') = 'true', false),
      'masterlist', COALESCE(p_permissions->'masterlist' = 'true'::jsonb OR (p_permissions->>'masterlist') = 'true', false),
      'history', COALESCE(p_permissions->'history' = 'true'::jsonb OR (p_permissions->>'history') = 'true', false),
      'manageOptions', COALESCE(p_permissions->'manageOptions' = 'true'::jsonb OR (p_permissions->>'manageOptions') = 'true', false),
      'accounts', false,
      'manage_users', false,
      'manage_roles', false,
      'manage_permissions', false,
      'view_security_logs', false,
      'super_admin', false,
      'all', false
    );
  END IF;

  -- 7. Update role and permissions without mutating last_seen_at (preserves true user activity timestamp)
  UPDATE public.profiles
  SET role = p_role,
      permissions = v_sanitized_perms
  WHERE id = p_target;

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows = 0 THEN
    RAISE EXCEPTION 'Operation Failed: Target account was not updated.';
  END IF;

  -- 8. Server-side audit log entry
  INSERT INTO public.cctv_security_audit_logs (
    actor_id,
    actor_username,
    actor_role,
    action,
    target_user_id,
    target_item,
    details
  )
  SELECT
    auth.uid(),
    p.username,
    p.role,
    'admin_access_change',
    p_target,
    COALESCE(v_target_username, p_role),
    pg_catalog.jsonb_build_object('new_role', p_role, 'permissions', v_sanitized_perms)
  FROM public.profiles p
  WHERE p.id = auth.uid();
END;
$$;

REVOKE ALL ON FUNCTION public.admin_set_user_access(UUID, TEXT, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_set_user_access(UUID, TEXT, JSONB) TO authenticated;


-- RPC 8.3: Dedicated Super Admin Role Management (Promotion / Demotion with Last Super Admin Protection)
CREATE OR REPLACE FUNCTION public.super_admin_set_role(
  p_target UUID,
  p_role TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_target_role TEXT;
  v_target_username TEXT;
  v_target_status TEXT;
  v_super_count INT;
  v_new_perms JSONB;
  v_rows INT;
  v_action TEXT;
BEGIN
  -- 1. Caller MUST be an active approved Super Administrator
  IF NOT private.is_cctv_super_admin() THEN
    RAISE EXCEPTION 'Access Denied: Only an active approved Super Administrator can execute this role-management flow.';
  END IF;

  -- 2. Target validation: verify target exists in public.profiles
  SELECT role, username, status
  INTO v_target_role, v_target_username, v_target_status
  FROM public.profiles
  WHERE id = p_target;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Operation Failed: Target account does not exist.';
  END IF;

  -- 3. Role value validation: accepts only 'super_admin', 'admin', or 'user'
  IF p_role NOT IN ('super_admin', 'admin', 'user') THEN
    RAISE EXCEPTION 'Operation Failed: Invalid role value "%". Allowed values: super_admin, admin, user.', p_role;
  END IF;

  -- Disallow setting the same role
  IF p_role = v_target_role THEN
    RAISE EXCEPTION 'Operation Failed: Target account is already assigned the "%" role.', p_role;
  END IF;

  -- 4. Scope enforcement: this dedicated flow handles ONLY super_admin promotion or demotion
  IF NOT (p_role = 'super_admin' OR v_target_role = 'super_admin') THEN
    RAISE EXCEPTION 'Operation Denied: Role changes between standard user and admin must be performed through admin_set_user_access.';
  END IF;

  -- 5. Execution: Promotion vs Demotion
  IF p_role = 'super_admin' THEN
    -- Promotion to Super Admin: target must be approved
    IF v_target_status IS DISTINCT FROM 'approved' THEN
      RAISE EXCEPTION 'Operation Denied: Only approved accounts can be promoted to Super Administrator.';
    END IF;

    -- Normalize Super Admin permission flags
    v_new_perms := pg_catalog.jsonb_build_object(
      'report', true,
      'conduct', true,
      'edr', true,
      'audit', true,
      'trackers', true,
      'hris', true,
      'sorter', true,
      'maintenance', true,
      'pending', true,
      'followup', true,
      'masterlist', true,
      'history', true,
      'manageOptions', true,
      'accounts', true,
      'manage_users', true,
      'manage_roles', true,
      'manage_permissions', true,
      'view_security_logs', true,
      'super_admin', true,
      'all', true
    );
    v_action := 'super_admin_promote';
  ELSE
    -- Demotion from Super Admin: enforce Last Approved Super Admin Protection
    SELECT pg_catalog.count(*) INTO v_super_count
    FROM public.profiles
    WHERE role = 'super_admin'
      AND status = 'approved'
      AND id <> p_target;

    IF v_super_count = 0 THEN
      RAISE EXCEPTION 'Operation Denied: Cannot demote the final remaining approved Super Administrator.';
    END IF;

    IF p_role = 'admin' THEN
      -- Demoted to Admin: least-privilege admin defaults
      -- Never leave super_admin=true, all=true, or manage_roles=true
      -- All workspace and administrative capability flags default to false
      v_new_perms := pg_catalog.jsonb_build_object(
        'report', false,
        'conduct', false,
        'edr', false,
        'audit', false,
        'trackers', false,
        'hris', false,
        'sorter', false,
        'maintenance', false,
        'pending', false,
        'followup', false,
        'masterlist', false,
        'history', false,
        'manageOptions', false,
        'accounts', false,
        'manage_users', false,
        'manage_permissions', false,
        'view_security_logs', false,
        'manage_roles', false,
        'super_admin', false,
        'all', false
      );
    ELSE
      -- Demoted to User: least-privilege user defaults
      -- Force all administrative capability and privileged flags false
      -- All workspace flags default to false
      v_new_perms := pg_catalog.jsonb_build_object(
        'report', false,
        'conduct', false,
        'edr', false,
        'audit', false,
        'trackers', false,
        'hris', false,
        'sorter', false,
        'maintenance', false,
        'pending', false,
        'followup', false,
        'masterlist', false,
        'history', false,
        'manageOptions', false,
        'accounts', false,
        'manage_users', false,
        'manage_roles', false,
        'manage_permissions', false,
        'view_security_logs', false,
        'super_admin', false,
        'all', false
      );
    END IF;
    v_action := 'super_admin_demote';
  END IF;

  -- 6. Update role and permissions without mutating last_seen_at (preserves true user activity timestamp)
  UPDATE public.profiles
  SET role = p_role,
      permissions = v_new_perms
  WHERE id = p_target;

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows = 0 THEN
    RAISE EXCEPTION 'Operation Failed: Target account was not updated.';
  END IF;

  -- 7. Authoritative server-side audit log entry with reserved super_admin_* action
  INSERT INTO public.cctv_security_audit_logs (
    actor_id,
    actor_username,
    actor_role,
    action,
    target_user_id,
    target_item,
    details
  )
  SELECT
    auth.uid(),
    p.username,
    p.role,
    v_action,
    p_target,
    COALESCE(v_target_username, p_target::text),
    pg_catalog.jsonb_build_object(
      'previous_role', v_target_role,
      'new_role', p_role,
      'permissions', v_new_perms
    )
  FROM public.profiles p
  WHERE p.id = auth.uid();
END;
$$;

REVOKE ALL ON FUNCTION public.super_admin_set_role(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.super_admin_set_role(UUID, TEXT) TO authenticated;


-- RPC 8.4: Admin Delete CCTV User (with Self-Delete Protection, Target Validation & Approved Caller Guard)
CREATE OR REPLACE FUNCTION public.admin_delete_cctv_user(
  p_target UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_target_role TEXT;
  v_target_username TEXT;
  v_super_count INT;
  v_profile_rows INT;
BEGIN
  -- 1. Caller MUST be an active approved administrator
  IF NOT private.is_cctv_admin() THEN
    RAISE EXCEPTION 'Access Denied: Active approved administrator status required.';
  END IF;

  -- 2. Self-delete safety: Administrator cannot delete their own active account
  IF p_target = auth.uid() THEN
    RAISE EXCEPTION 'Operation Denied: You cannot delete your own active administrator account.';
  END IF;

  -- 3. Target validation: verify target exists in public.profiles
  SELECT role, username INTO v_target_role, v_target_username 
  FROM public.profiles 
  WHERE id = p_target;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Operation Failed: Target account does not exist in public.profiles.';
  END IF;

  -- 4. Authority Check:
  IF v_target_role = 'super_admin' THEN
    IF NOT private.is_cctv_super_admin() THEN
      RAISE EXCEPTION 'Access Denied: Only an approved Super Administrator can delete a Super Admin account.';
    END IF;

    -- Last Super Admin Deletion Guard
    SELECT pg_catalog.count(*) INTO v_super_count
    FROM public.profiles
    WHERE role = 'super_admin' AND status = 'approved' AND id <> p_target;

    IF v_super_count = 0 THEN
      RAISE EXCEPTION 'Operation Denied: Cannot delete the final remaining Super Administrator.';
    END IF;
  ELSIF v_target_role = 'admin' THEN
    -- Admin Target Protection: only approved Super Admin can delete an Admin
    IF NOT private.is_cctv_super_admin() THEN
      RAISE EXCEPTION 'Access Denied: Only an approved Super Administrator can delete an Administrator account.';
    END IF;
  ELSE
    -- Standard user: caller must be Super Admin or have manage_users
    IF NOT (private.is_cctv_super_admin() OR private.cctv_has_permission('manage_users')) THEN
      RAISE EXCEPTION 'Access Denied: manage_users permission required.';
    END IF;
  END IF;

  -- 5. Delete profile record
  DELETE FROM public.profiles WHERE id = p_target;
  GET DIAGNOSTICS v_profile_rows = ROW_COUNT;
  IF v_profile_rows = 0 THEN
    RAISE EXCEPTION 'Operation Failed: Target profile could not be deleted.';
  END IF;

  -- 6. Authoritatively delete auth.users record (SECURITY DEFINER runs as database owner)
  DELETE FROM auth.users WHERE id = p_target;

  -- 7. Audit log entry
  INSERT INTO public.cctv_security_audit_logs (
    actor_id,
    actor_username,
    actor_role,
    action,
    target_user_id,
    target_item,
    details
  )
  SELECT
    auth.uid(),
    p.username,
    p.role,
    'admin_delete_user',
    p_target,
    COALESCE(v_target_username, p_target::text),
    pg_catalog.jsonb_build_object('deleted_role', v_target_role)
  FROM public.profiles p
  WHERE p.id = auth.uid();

  RETURN pg_catalog.jsonb_build_object('ok', true, 'deleted_id', p_target);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_delete_cctv_user(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_delete_cctv_user(UUID) TO authenticated;


-- RPC 8.5: Hardened Security Audit Logging (Approved Caller Guard & Reserved Action Name Protection)
CREATE OR REPLACE FUNCTION public.log_cctv_security_event(
  p_action TEXT,
  p_target_user_id UUID DEFAULT NULL,
  p_target_item TEXT DEFAULT NULL,
  p_details JSONB DEFAULT '{}'::jsonb
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_username TEXT;
  v_role TEXT;
  v_status TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- 1. Derive actor identity strictly from verified server state
  SELECT username, role, status INTO v_username, v_role, v_status
  FROM public.profiles
  WHERE id = auth.uid();

  -- Require the caller to have a valid approved profile
  IF v_status IS DISTINCT FROM 'approved' THEN
    RAISE EXCEPTION 'Access Denied: Active approved profile required to record security events.';
  END IF;

  -- 2. Prevent generic clients from fabricating reserved administrative event names
  IF p_action ILIKE 'admin_%' OR p_action ILIKE 'super_admin_%' THEN
    RAISE EXCEPTION 'Access Denied: Reserved administrative audit event name.';
  END IF;

  INSERT INTO public.cctv_security_audit_logs (
    actor_id,
    actor_username,
    actor_role,
    action,
    target_user_id,
    target_item,
    details
  ) VALUES (
    auth.uid(),
    COALESCE(v_username, 'authenticated'),
    COALESCE(v_role, 'user'),
    p_action,
    p_target_user_id,
    p_target_item,
    p_details
  );
END;
$$;

REVOKE ALL ON FUNCTION public.log_cctv_security_event(TEXT, UUID, TEXT, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_cctv_security_event(TEXT, UUID, TEXT, JSONB) TO authenticated;


-- RPC 8.6: Strictly Scoped Self-Profile Display Name Update
CREATE OR REPLACE FUNCTION public.update_own_display_name(
  p_display_name TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  UPDATE public.profiles
  SET display_name = pg_catalog.btrim(p_display_name)
  WHERE id = auth.uid();
END;
$$;

REVOKE ALL ON FUNCTION public.update_own_display_name(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_own_display_name(TEXT) TO authenticated;

COMMIT;
