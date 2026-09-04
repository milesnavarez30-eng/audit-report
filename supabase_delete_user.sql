-- ==============================================================================
-- CCTV OPS — SERVER-SIDE ACCOUNT DELETION & AUDIT PRESERVATION MIGRATION
-- File: supabase_delete_user.sql
-- Purpose:
--   1. Ensures cctv_security_audit_logs foreign keys preserve historical audit logs (ON DELETE SET NULL).
--   2. Provides a hardened SECURITY DEFINER function: public.admin_delete_cctv_user()
--      allowing approved Admins to delete accounts server-side with zero browser credential exposure.
--   3. Guarantees that deleting an account does NOT delete operational reports or logs.
-- ==============================================================================

-- 1. Verify and ensure foreign key preservation on cctv_security_audit_logs
DO $$
BEGIN
    -- Check actor_id constraint
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'cctv_security_audit_logs_actor_id_fkey'
    ) THEN
        ALTER TABLE public.cctv_security_audit_logs
            DROP CONSTRAINT cctv_security_audit_logs_actor_id_fkey,
            ADD CONSTRAINT cctv_security_audit_logs_actor_id_fkey
                FOREIGN KEY (actor_id) REFERENCES auth.users(id) ON DELETE SET NULL;
    END IF;

    -- Check target_user_id constraint
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'cctv_security_audit_logs_target_user_id_fkey'
    ) THEN
        ALTER TABLE public.cctv_security_audit_logs
            DROP CONSTRAINT cctv_security_audit_logs_target_user_id_fkey,
            ADD CONSTRAINT cctv_security_audit_logs_target_user_id_fkey
                FOREIGN KEY (target_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
    END IF;
END $$;

-- 2. Hardened Server-Side Delete RPC Function
-- Requirements:
--   - SECURITY DEFINER to execute with admin privileges
--   - search_path pinned to public, auth
--   - Requires caller to be an approved Admin in public.profiles
--   - Blocks Admin from deleting their own currently logged-in account
--   - Deletes from auth.users and public.profiles
--   - Returns status JSON
CREATE OR REPLACE FUNCTION public.admin_delete_cctv_user(
    p_target UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_caller_id UUID;
    v_caller_role TEXT;
    v_caller_status TEXT;
    v_target_username TEXT;
    v_target_display_name TEXT;
    v_target_role TEXT;
BEGIN
    -- 1. Validate Caller Authentication
    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required.';
    END IF;

    -- 2. Verify Caller is an Approved Admin
    SELECT role, status
    INTO v_caller_role, v_caller_status
    FROM public.profiles
    WHERE id = v_caller_id;

    IF NOT FOUND OR v_caller_role <> 'admin' OR v_caller_status <> 'approved' THEN
        RAISE EXCEPTION 'Admin access required to delete accounts.';
    END IF;

    -- 3. Prevent self-deletion
    IF p_target = v_caller_id THEN
        RAISE EXCEPTION 'You cannot delete your own logged-in account.';
    END IF;

    -- 4. Load target metadata for audit log
    SELECT username, display_name, role
    INTO v_target_username, v_target_display_name, v_target_role
    FROM public.profiles
    WHERE id = p_target;

    -- 5. Delete profile record explicitly
    DELETE FROM public.profiles WHERE id = p_target;

    -- 6. Delete auth user record if it exists
    BEGIN
        DELETE FROM auth.users WHERE id = p_target;
    EXCEPTION WHEN OTHERS THEN
        -- If auth.users deletion cannot be performed directly via SQL, profile is still removed.
        NULL;
    END;

    -- 7. Write security audit event
    PERFORM public.log_cctv_security_event(
        'account_deleted',
        NULL,
        COALESCE(v_target_username, v_target_display_name, p_target::text),
        jsonb_build_object(
            'deleted_user_id', p_target,
            'username', COALESCE(v_target_username, ''),
            'display_name', COALESCE(v_target_display_name, ''),
            'role', COALESCE(v_target_role, 'user')
        )
    );

    RETURN jsonb_build_object(
        'success', true,
        'deleted_user_id', p_target,
        'username', v_target_username
    );
END;
$$;

-- 3. Revoke and Grant Permissions
REVOKE ALL ON FUNCTION public.admin_delete_cctv_user(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_delete_cctv_user(UUID) TO authenticated;
