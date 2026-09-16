// Supabase Edge Function: cctv-admin-create-user
// Purpose: Authoritative server-side staff account provisioning for CCTV OPS.
// Security Hardening:
//   - Requires authenticated caller JWT (Authorization: Bearer <token>)
//   - Uses SUPABASE_ANON_KEY strictly for callerClient verification (never service_role)
//   - Authoritatively validates caller role and permissions from public.profiles
//   - Super Admin may create Admin or User
//   - Admin with manage_users may create User only
//   - Super Admin creation is performed through the separate promotion flow
//   - Uses auth.admin.createUser() with service_role strictly on the server
//   - Sets email_confirm: true so new accounts are immediately active
//   - Never replaces or mutates the caller's active browser session
//   - Exposes zero service_role credentials to the client
//   - Audit creation is a mandatory provisioning step; failure triggers compensating cleanup
//   - Never leaks internal database/Auth error messages or stack traces to client
//   - CORS restricted to CCTV OPS production origins and local development hosts
//   - Duplicate checks fail closed on query errors
//   - Separates manage_users authority from manage_permissions authority

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.8";

// Configured allowed origins for CCTV OPS
// Note: In production environments, set ALLOWED_ORIGINS env var or restrict to authoritative domains.
const defaultAllowedOrigins = [
  "https://milesnavarez30-eng.github.io",
  "http://localhost",
  "http://127.0.0.1",
];

function getCorsHeaders(req: Request) {
  const customOrigins = (Deno.env.get("ALLOWED_ORIGINS") || "")
    .split(",")
    .map((s: string) => s.trim())
    .filter(Boolean);
  const allowedList = customOrigins.length > 0 ? customOrigins : defaultAllowedOrigins;

  const origin = req.headers.get("Origin") || "";
  const isAllowed = allowedList.some((allowed: string) =>
    origin === allowed || origin.startsWith(`${allowed}:`) || origin.startsWith(`${allowed}/`)
  );

  return {
    "Access-Control-Allow-Origin": isAllowed ? origin : (allowedList[0] || "*"),
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

serve(async (req: Request) => {
  const corsHeaders = getCorsHeaders(req);

  // 1. Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed. Only POST is accepted." }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      console.error("[cctv-admin-create-user] Missing required server environment configuration: SUPABASE_URL, SUPABASE_ANON_KEY, or SUPABASE_SERVICE_ROLE_KEY.");
      return new Response(
        JSON.stringify({ error: "Server configuration error." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Validate Caller Authentication (JWT)
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Unauthorized: Missing or invalid Authorization header." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Initialize caller client with their Bearer token and ANON key strictly
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });

    const { data: { user: callerUser }, error: callerAuthErr } = await callerClient.auth.getUser();
    if (callerAuthErr || !callerUser?.id) {
      return new Response(
        JSON.stringify({ error: "Unauthorized: Invalid or expired session token." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. Initialize Server Admin Client with service_role key
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // 4. Fetch caller profile to authoritatively verify role & permissions
    const { data: callerProfile, error: profileErr } = await adminClient
      .from("profiles")
      .select("id, username, display_name, role, status, permissions")
      .eq("id", callerUser.id)
      .maybeSingle();

    if (profileErr || !callerProfile) {
      return new Response(
        JSON.stringify({ error: "Forbidden: Caller profile not found." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (callerProfile.status !== "approved") {
      return new Response(
        JSON.stringify({ error: "Forbidden: Your administrative account is not active or approved." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const isCallerSuper = callerProfile.role === "super_admin";
    const isCallerAdmin = callerProfile.role === "admin";
    const callerPerms = callerProfile.permissions || {};
    const callerHasManageUsers = isCallerSuper || (isCallerAdmin && callerPerms.manage_users === true);
    const callerHasManagePermissions = isCallerSuper || (isCallerAdmin && callerPerms.manage_permissions === true);

    if (!callerHasManageUsers) {
      return new Response(
        JSON.stringify({ error: "Forbidden: You do not possess manage_users permission." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 5. Parse and Validate Request Payload
    let body: any = {};
    try {
      body = await req.json();
    } catch (_) {
      return new Response(
        JSON.stringify({ error: "Invalid JSON payload." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const rawName = String(body?.name || body?.display_name || "").trim();
    const rawUsername = String(body?.username || "").trim().replace(/^@+/, "").toLowerCase();
    const password = String(body?.password || "");
    const requestedRole = String(body?.role || "user").trim().toLowerCase();

    if (!rawName) {
      return new Response(
        JSON.stringify({ error: "Staff member's name is required." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!rawUsername || rawUsername.length < 2 || !/^[a-z0-9._-]+$/.test(rawUsername)) {
      return new Response(
        JSON.stringify({ error: "Username must be at least 2 characters and contain only lowercase letters, numbers, dots, hyphens, or underscores." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!password || password.length < 6) {
      return new Response(
        JSON.stringify({ error: "Temporary password must contain at least 6 characters." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!["admin", "user"].includes(requestedRole)) {
      return new Response(
        JSON.stringify({ error: "Invalid role specified. Only 'admin' or 'user' accounts may be created." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 6. Enforce Role Creation Boundaries
    // Only Super Admin can create Admin accounts; normal Admin with manage_users can create User accounts only
    if (requestedRole === "admin" && !isCallerSuper) {
      return new Response(
        JSON.stringify({ error: "Access Denied: Only a Super Administrator can provision an Administrator account." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 7. Check for Existing Username or Email Conflict using safe separate equality queries (Fail Closed)
    const email = body?.email && String(body.email).includes("@")
      ? String(body.email).trim().toLowerCase()
      : `${rawUsername}@cctvops.example.com`;

    const { data: userByUsername, error: usernameLookupError } = await adminClient
      .from("profiles")
      .select("id")
      .eq("username", rawUsername)
      .maybeSingle();

    if (usernameLookupError) {
      console.error("[cctv-admin-create-user] Username duplicate preflight check failed:", usernameLookupError);
      return new Response(
        JSON.stringify({ error: "Internal server error." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (userByUsername) {
      return new Response(
        JSON.stringify({ error: `An account with username "${rawUsername}" already exists.` }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: userByEmail, error: emailLookupError } = await adminClient
      .from("profiles")
      .select("id")
      .eq("email", email)
      .maybeSingle();

    if (emailLookupError) {
      console.error("[cctv-admin-create-user] Email duplicate preflight check failed:", emailLookupError);
      return new Response(
        JSON.stringify({ error: "Internal server error." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (userByEmail) {
      return new Response(
        JSON.stringify({ error: "An account with this email address already exists." }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 8. Validate and Sanitize Permissions (New Admin = Least Privilege; Separate manage_users from manage_permissions)
    const rawPerms = (body?.permissions && typeof body.permissions === "object" && !Array.isArray(body.permissions))
      ? body.permissions
      : {};

    let defaultPermissions: Record<string, boolean>;

    if (requestedRole === "admin") {
      // New Admin = LEAST PRIVILEGE:
      // A newly created Admin does NOT automatically receive operational workspace access.
      // All workspace and administrative capability flags default to false unless explicitly granted by Super Admin.
      const allowedAdminFlags = [
        "report", "conduct", "edr", "audit", "trackers", "hris", "sorter",
        "maintenance", "pending", "followup", "masterlist", "history",
        "manageOptions", "accounts", "manage_users", "manage_permissions", "view_security_logs"
      ];

      defaultPermissions = {};
      for (const flag of allowedAdminFlags) {
        defaultPermissions[flag] = isCallerSuper && rawPerms[flag] === true;
      }

      // Always force impossible-for-Admin flags false
      defaultPermissions.super_admin = false;
      defaultPermissions.all = false;
      defaultPermissions.manage_roles = false;
    } else {
      // role = 'user':
      // TRUE EXPLICIT WORKSPACE GRANTS:
      // - Super Admin or Admin with manage_permissions may explicitly provide workspace permissions.
      // - Missing permission keys default FALSE.
      // - Admin with manage_users but WITHOUT manage_permissions creates account with all workspace permissions FALSE.
      // - They cannot use creation as an indirect way to grant access.
      const userWorkspaces = [
        "report", "conduct", "edr", "audit", "trackers", "hris", "sorter",
        "maintenance", "pending", "followup", "masterlist", "history", "manageOptions"
      ];

      defaultPermissions = {};

      for (const ws of userWorkspaces) {
        defaultPermissions[ws] = callerHasManagePermissions && rawPerms[ws] === true;
      }

      // Always force ALL administrative flags false for standard User
      defaultPermissions.accounts = false;
      defaultPermissions.manage_users = false;
      defaultPermissions.manage_roles = false;
      defaultPermissions.manage_permissions = false;
      defaultPermissions.view_security_logs = false;
      defaultPermissions.super_admin = false;
      defaultPermissions.all = false;
    }

    // 9. Authoritatively Create User in Supabase Auth (auth.users)
    const { data: createdAuth, error: createAuthErr } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        display_name: rawName,
        username: rawUsername,
        created_by: callerUser.id,
      },
    });

    if (createAuthErr || !createdAuth?.user?.id) {
      console.error("[cctv-admin-create-user] Supabase Auth account creation failed:", createAuthErr);
      return new Response(
        JSON.stringify({ error: "Account creation failed." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const newUserId = createdAuth.user.id;

    // 10. Provision public.profiles row and record trusted server-side audit log
    // Compensating Cleanup Guard: If auth.admin.createUser() succeeds but any subsequent
    // required provisioning step fails, delete the newly created Auth user so no orphaned
    // auth.users account remains.
    const nowIso = new Date().toISOString();
    try {
      const { error: profileUpsertErr } = await adminClient
        .from("profiles")
        .upsert({
          id: newUserId,
          email,
          username: rawUsername,
          display_name: rawName,
          role: requestedRole,
          status: "approved",
          permissions: defaultPermissions,
          approved_by: callerUser.id,
          approved_at: nowIso,
          created_at: nowIso,
        });

      if (profileUpsertErr) {
        throw new Error(`Profile configuration failed: ${profileUpsertErr.message}`);
      }

      // 11. Record Mandatory Security Audit Log
      // Audit Architecture Consistency:
      // RPC-only for browser clients; trusted server-side Edge Functions may write authoritative audit records.
      // Actor identity is derived strictly from verified server-side caller token & profile (never from request body).
      const { error: auditError } = await adminClient
        .from("cctv_security_audit_logs")
        .insert({
          actor_id: callerUser.id,
          actor_username: callerProfile.username || callerUser.id,
          actor_role: callerProfile.role,
          action: "admin_create_user",
          target_user_id: newUserId,
          target_item: rawUsername,
          details: {
            display_name: rawName,
            email,
            role: requestedRole,
            permissions: defaultPermissions,
            provisioned_via: "cctv-admin-create-user-edge-function",
          },
        });

      if (auditError) {
        throw new Error(`Security audit log creation failed: ${auditError.message}`);
      }

      // 12. Return Clean Success
      return new Response(
        JSON.stringify({
          success: true,
          message: `Account @${rawUsername} (${rawName}) successfully created.`,
          user: {
            id: newUserId,
            email,
            username: rawUsername,
            display_name: rawName,
            role: requestedRole,
            status: "approved",
            permissions: defaultPermissions,
            created_at: nowIso,
          },
        }),
        { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } catch (provisioningErr: any) {
      // COMPENSATING CLEANUP:
      // auth.admin.createUser() succeeded with valid newUserId, but subsequent profile/permission setup or audit logging failed.
      // Explicitly check deleteUser error and differentiate the client response.
      console.error(`[cctv-admin-create-user] Provisioning failed for new user ${newUserId}. Executing compensating Auth cleanup...`, provisioningErr);

      let cleanupSucceeded = false;
      try {
        const { error: cleanupError } = await adminClient.auth.admin.deleteUser(newUserId);
        if (cleanupError) {
          throw cleanupError;
        }
        cleanupSucceeded = true;
        console.info(`[cctv-admin-create-user] Compensating cleanup successful: deleted orphaned user ${newUserId}.`);
      } catch (cleanupErr: any) {
        // Log newUserId + full cleanup error server-side for manual DBA remediation
        console.error(`[cctv-admin-create-user] Critical: Failed to delete orphaned Auth user ${newUserId} during compensating cleanup:`, cleanupErr);
      }

      if (cleanupSucceeded) {
        return new Response(
          JSON.stringify({
            error: "Account provisioning failed. Partially created auth records were removed.",
          }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // If compensating cleanup failed, report a generic failure without exposing service-role or internal errors
      return new Response(
        JSON.stringify({
          error: "Account provisioning failed. Please contact the system administrator.",
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  } catch (err: any) {
    console.error("[cctv-admin-create-user] Uncaught server error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
