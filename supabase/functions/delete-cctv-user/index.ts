// Supabase Edge Function: delete-cctv-user
// Purpose: Secure, server-side deletion of a CCTV OPS staff account.
// Security:
//   - Requires authenticated caller JWT (Authorization: Bearer <token>)
//   - Validates that caller exists in public.profiles with role = 'admin' AND status = 'approved'
//   - Prevents Admin from deleting their own currently logged-in account
//   - Deletes the target user from Supabase Authentication (auth.users) using Supabase Admin API
//   - Safely cleans up the corresponding public.profiles record
//   - Preserves all operational reports (Google Docs, Google Sheets, CCTV tracker records, Security Audit Logs)

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req: Request) => {
  // Handle CORS preflight request
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

    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(
        JSON.stringify({ error: "Server configuration missing: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 1. Validate Caller Authentication (JWT)
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Unauthorized: Missing or invalid Authorization header." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Initialize caller client with their Bearer token
    const callerClient = createClient(supabaseUrl, anonKey || serviceRoleKey, {
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

    // 2. Initialize Admin client with service_role key
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // 3. Verify Caller is an Approved Admin in public.profiles
    const { data: callerProfile, error: profileErr } = await adminClient
      .from("profiles")
      .select("id, role, status, username")
      .eq("id", callerUser.id)
      .maybeSingle();

    if (profileErr || !callerProfile || callerProfile.role !== "admin" || callerProfile.status !== "approved") {
      return new Response(
        JSON.stringify({ error: "Forbidden: Only approved Admin accounts can delete users." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 4. Parse & Validate Target User ID
    let body: any = {};
    try {
      body = await req.json();
    } catch (_) {
      return new Response(
        JSON.stringify({ error: "Invalid JSON payload." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const targetUserId = String(body?.targetUserId || body?.id || "").trim();
    if (!targetUserId) {
      return new Response(
        JSON.stringify({ error: "Missing required field: targetUserId." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // UUID format verification
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(targetUserId)) {
      return new Response(
        JSON.stringify({ error: "Invalid targetUserId: Must be a valid UUID." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 5. Prevent Admin from deleting their own currently logged-in account
    if (targetUserId === callerUser.id) {
      return new Response(
        JSON.stringify({ error: "Forbidden: You cannot delete your own logged-in account." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 6. Verify target user exists
    const { data: targetProfile } = await adminClient
      .from("profiles")
      .select("id, username, display_name, role")
      .eq("id", targetUserId)
      .maybeSingle();

    const { data: targetUserData, error: targetUserErr } = await adminClient.auth.admin.getUserById(targetUserId);

    if (!targetProfile && (!targetUserData || !targetUserData.user)) {
      return new Response(
        JSON.stringify({ error: "Target user does not exist in Auth or Profiles." }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 7. Delete user from Supabase Authentication (auth.users)
    let authDeleted = false;
    if (targetUserData?.user) {
      const { error: deleteAuthErr } = await adminClient.auth.admin.deleteUser(targetUserId);
      if (deleteAuthErr) {
        return new Response(
          JSON.stringify({ error: `Failed to delete Supabase Auth user: ${deleteAuthErr.message}` }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      authDeleted = true;
    }

    // 8. Explicitly delete user from public.profiles
    // (Guarantees removal even if profiles does not have an ON DELETE CASCADE foreign key)
    let profileDeleted = false;
    const { error: deleteProfileErr } = await adminClient
      .from("profiles")
      .delete()
      .eq("id", targetUserId);

    if (!deleteProfileErr) {
      profileDeleted = true;
    }

    // 9. Return clean success response
    return new Response(
      JSON.stringify({
        success: true,
        message: "Account permanently deleted from CCTV OPS.",
        targetUserId,
        targetUsername: targetProfile?.username || targetUserData?.user?.email?.split("@")[0] || "",
        authDeleted,
        profileDeleted,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("[delete-cctv-user] Error:", err);
    return new Response(
      JSON.stringify({ error: err?.message || "Internal server error." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
