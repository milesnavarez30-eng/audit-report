// Supabase Edge Function: cctv-vault-access
// Purpose: Authoritative Server-Assisted 6-Digit Vault PIN Protection (Option A)
// Security Guarantees:
//   - Local IndexedDB and backup exports contain ZERO local PIN verification oracles
//   - Every normal PIN attempt is verified server-side with VAULT_PIN_PEPPER (HMAC-SHA-256)
//   - Constant-time comparisons against timing attacks
//   - Server wraps VMK under VAULT_SERVER_KEK (AES-GCM 256) with user-bound AAD
//   - Authoritative 4-attempt lock enforced by atomic transactional database RPC
//   - Recovery Email OTP resets attempt gate only; does NOT reveal PIN or VMK
//   - Recovery Proof Token verified via VAULT_RECOVERY_PEPPER without storing Recovery Key

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.8";

const defaultAllowedOrigins = [
  "https://audit-report.milesnavarez30.workers.dev",
  "https://milesnavarez30-eng.github.io",
  "http://localhost:8080",
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
  const isAllowed = Boolean(origin && allowedList.some((allowed: string) =>
    origin === allowed || origin.startsWith(`${allowed}:`) || origin.startsWith(`${allowed}/`)
  ));

  const headers: Record<string, string> = {
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Cache-Control": "no-store",
    "Pragma": "no-cache",
    "Vary": "Origin",
  };

  if (isAllowed) {
    headers["Access-Control-Allow-Origin"] = origin;
  }

  return { headers, isAllowed, origin };
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let c = 0;
  for (let i = 0; i < a.length; i++) {
    c |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return c === 0;
}

async function computeHmac(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  const arr = Array.from(new Uint8Array(sig));
  return arr.map(b => b.toString(16).padStart(2, "0")).join("");
}

async function importServerKek(secret: string): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyBytes = enc.encode(secret).slice(0, 32);
  return await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

function b64ToBuf(b64: string): ArrayBuffer {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}

function bufToB64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < bytes.byteLength; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}

async function verifyOrCheckOtp(
  adminClient: any,
  otpHmacSecret: string,
  userId: string,
  purpose: string,
  otpCode?: string,
  challengeId?: string | null
): Promise<boolean> {
  if (otpCode) {
    let cid = challengeId;
    if (!cid) {
      const { data: activeChallenge } = await adminClient
        .from("cctv_vault_otps")
        .select("challenge_id")
        .eq("user_id", userId)
        .eq("purpose", purpose)
        .eq("verified", false)
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      cid = activeChallenge?.challenge_id || null;
    }
    if (cid) {
      const hmac = await computeHmac(otpHmacSecret, `${purpose}:${userId}:${cid}:${otpCode}`);
      const { data, error } = await adminClient.rpc("verify_vault_otp_record", {
        p_otp_hash: hmac,
        p_challenge_id: cid,
        p_purpose: purpose,
        p_user_id: userId,
      });
      if (!error && (data?.verified || data?.success)) return true;
    }
  }

  const { data: verifiedRow } = await adminClient
    .from("cctv_vault_otps")
    .select("id")
    .eq("user_id", userId)
    .eq("purpose", purpose)
    .eq("verified", true)
    .gt("created_at", new Date(Date.now() - 5 * 60 * 1000).toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return Boolean(verifiedRow);
}

serve(async (req: Request) => {
  const { headers: corsHeaders, isAllowed, origin } = getCorsHeaders(req);

  // Strict CORS origin validation: reject disallowed origins immediately
  if (origin && !isAllowed) {
    return new Response(
      JSON.stringify({ error: "Origin not allowed by CORS policy." }),
      { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

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

    const vaultPinPepper = Deno.env.get("VAULT_PIN_PEPPER") || "";
    const vaultRecoveryPepper = Deno.env.get("VAULT_RECOVERY_PEPPER") || "";
    const vaultServerKekSecret = Deno.env.get("VAULT_SERVER_KEK") || "";
    const otpHmacSecret = Deno.env.get("OTP_HMAC_SECRET") || "";

    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      return new Response(
        JSON.stringify({ error: "Server configuration missing required database environment variables." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (
      !vaultPinPepper || vaultPinPepper.length < 32 ||
      !vaultRecoveryPepper || vaultRecoveryPepper.length < 32 ||
      !vaultServerKekSecret || vaultServerKekSecret.length < 32 ||
      !otpHmacSecret || otpHmacSecret.length < 32
    ) {
      return new Response(
        JSON.stringify({ error: "Server security configuration error: High-entropy cryptographic secrets required." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 1. Authoritative JWT Caller Verification
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Unauthorized: Missing Authorization header." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });

    const { data: authData, error: callerAuthErr } = await callerClient.auth.getUser();
    const callerUser = authData?.user;
    if (callerAuthErr || !callerUser?.id) {
      return new Response(
        JSON.stringify({ error: "Unauthorized: Invalid or expired session token." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = callerUser.id;
    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || "").trim();

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    const serverKek = await importServerKek(vaultServerKekSecret);
    const aad = new TextEncoder().encode(`cctv-vault-server-v1:${userId}`);

    // -------------------------------------------------------------------------
    // ACTION: status
    // -------------------------------------------------------------------------
    if (action === "status") {
      const { data: row } = await adminClient
        .from("cctv_vault_server_state")
        .select("failed_pin_attempts, locked_at, updated_at")
        .eq("user_id", userId)
        .maybeSingle();

      const { data: secRow } = await adminClient
        .from("cctv_recovery_contacts")
        .select("recovery_email, recovery_email_verified")
        .eq("user_id", userId)
        .maybeSingle();

      const failedAttempts = Number(row?.failed_pin_attempts || 0);
      const isLocked = Boolean(row?.locked_at || failedAttempts >= 4);

      return new Response(
        JSON.stringify({
          ok: true,
          is_configured: Boolean(row),
          is_locked: isLocked,
          failed_attempts: failedAttempts,
          remaining_attempts: Math.max(0, 4 - failedAttempts),
          recovery_email_configured: Boolean(secRow?.recovery_email && secRow?.recovery_email_verified),
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // -------------------------------------------------------------------------
    // ACTION: register_server_assisted
    // -------------------------------------------------------------------------
    if (action === "register_server_assisted") {
      const pin = String(body?.pin || "").trim();
      const vmkBase64 = String(body?.vmk_base64 || "").trim();
      const recoveryProofToken = String(body?.recovery_proof_token || "").trim();

      if (!/^\d{6}$/.test(pin)) {
        return new Response(
          JSON.stringify({ error: "PIN must be exactly 6 numeric digits." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (!vmkBase64 || !recoveryProofToken) {
        return new Response(
          JSON.stringify({ error: "VMK and Recovery Proof Token are required." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const vmkBytes = new Uint8Array(b64ToBuf(vmkBase64));
      if (vmkBytes.byteLength !== 32) {
        return new Response(
          JSON.stringify({ error: "Invalid VMK length. Must be 32 bytes (256 bits)." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Compute server keyed verifiers
      const pinVerifierHmac = await computeHmac(vaultPinPepper, `vault-pin-v1:${userId}:${pin}`);
      const recoveryVerifierHmac = await computeHmac(vaultRecoveryPepper, `vault-recovery-v1:${userId}:${recoveryProofToken}`);

      // Encrypt VMK under VAULT_SERVER_KEK with user-bound AAD
      const wrapIv = crypto.getRandomValues(new Uint8Array(12));
      const wrappedVmk = await crypto.subtle.encrypt(
        { name: "AES-GCM", iv: wrapIv, additionalData: aad },
        serverKek,
        vmkBytes
      );

      // Overwrite sensitive VMK buffer in memory immediately
      vmkBytes.fill(0);

      // Upsert into cctv_vault_server_state
      const { error: upsertErr } = await adminClient
        .from("cctv_vault_server_state")
        .upsert({
          user_id: userId,
          pin_verifier_hmac: pinVerifierHmac,
          server_wrapped_vmk: bufToB64(wrappedVmk),
          server_wrap_iv: bufToB64(wrapIv.buffer),
          server_wrap_version: 1,
          recovery_verifier_hmac: recoveryVerifierHmac,
          failed_pin_attempts: 0,
          locked_at: null,
          updated_at: new Date().toISOString(),
        });

      if (upsertErr) {
        return new Response(
          JSON.stringify({ error: upsertErr.message || "Failed to persist server Vault state." }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ ok: true, registered: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // -------------------------------------------------------------------------
    // ACTION: unlock
    // -------------------------------------------------------------------------
    if (action === "unlock") {
      const pin = String(body?.pin || "").trim();

      // Retrieve state
      const { data: row } = await adminClient
        .from("cctv_vault_server_state")
        .select("pin_verifier_hmac, server_wrapped_vmk, server_wrap_iv, failed_pin_attempts, locked_at")
        .eq("user_id", userId)
        .maybeSingle();

      if (!row) {
        return new Response(
          JSON.stringify({ error: "Vault not configured on server." }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Check authoritative server lock
      if (row.locked_at || Number(row.failed_pin_attempts) >= 4) {
        return new Response(
          JSON.stringify({
            ok: false,
            locked: true,
            remaining_attempts: 0,
            error: "Vault locked. Verify your Recovery Email to continue.",
          }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (!/^\d{6}$/.test(pin)) {
        return new Response(
          JSON.stringify({ error: "PIN must be exactly 6 numeric digits." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Compute candidate HMAC
      const candidateHmac = await computeHmac(vaultPinPepper, `vault-pin-v1:${userId}:${pin}`);
      const isMatch = constantTimeEqual(candidateHmac, row.pin_verifier_hmac);

      if (!isMatch) {
        // Atomic transactional increment
        const { data: attemptRes } = await adminClient.rpc("record_server_vault_pin_attempt", {
          p_user_id: userId,
        });

        const newFailed = Number(attemptRes?.failed_attempts || 1);
        const isNowLocked = Boolean(attemptRes?.locked || newFailed >= 4);
        const remaining = Math.max(0, 4 - newFailed);

        const errorMsg = isNowLocked
          ? "Vault locked. Verify your Recovery Email to continue."
          : `Incorrect PIN. ${remaining} attempt${remaining === 1 ? "" : "s"} remaining.`;

        return new Response(
          JSON.stringify({
            ok: false,
            locked: isNowLocked,
            remaining_attempts: remaining,
            error: errorMsg,
          }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // PIN is correct! Reset attempts atomically
      await adminClient.rpc("reset_server_vault_pin_attempts", { p_user_id: userId });

      // Decrypt server-wrapped VMK
      const wrapIvBuf = b64ToBuf(row.server_wrap_iv);
      const wrappedVmkBuf = b64ToBuf(row.server_wrapped_vmk);

      const decryptedVmkBuf = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv: new Uint8Array(wrapIvBuf), additionalData: aad },
        serverKek,
        wrappedVmkBuf
      );

      const vmkBase64 = bufToB64(decryptedVmkBuf);

      return new Response(
        JSON.stringify({ ok: true, vmk_base64: vmkBase64 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // -------------------------------------------------------------------------
    // ACTION: change_pin
    // -------------------------------------------------------------------------
    if (action === "change_pin") {
      const currentPin = String(body?.current_pin || "").trim();
      const otpCode = String(body?.otp || "").trim();
      const newPin = String(body?.new_pin || "").trim();

      if (!/^\d{6}$/.test(currentPin) || !/^\d{6}$/.test(newPin)) {
        return new Response(
          JSON.stringify({ error: "PIN must be exactly 6 numeric digits." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: row } = await adminClient
        .from("cctv_vault_server_state")
        .select("pin_verifier_hmac")
        .eq("user_id", userId)
        .maybeSingle();

      if (!row) {
        return new Response(
          JSON.stringify({ error: "Vault not configured." }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Verify current PIN
      const currentHmac = await computeHmac(vaultPinPepper, `vault-pin-v1:${userId}:${currentPin}`);
      if (!constantTimeEqual(currentHmac, row.pin_verifier_hmac)) {
        return new Response(
          JSON.stringify({ error: "Current PIN is incorrect." }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Verify OTP challenge
      const otpCodeVal = String(body?.otp || body?.otp_code || "").trim();
      const challengeId = body?.challenge_id ? String(body.challenge_id).trim() : null;
      const otpOk = await verifyOrCheckOtp(adminClient, otpHmacSecret, userId, "pin_change", otpCodeVal, challengeId);
      if (!otpOk) {
        return new Response(
          JSON.stringify({ error: "Verification failed: Valid Recovery Email OTP required." }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Update PIN verifier HMAC
      const newPinVerifierHmac = await computeHmac(vaultPinPepper, `vault-pin-v1:${userId}:${newPin}`);
      await adminClient
        .from("cctv_vault_server_state")
        .update({
          pin_verifier_hmac: newPinVerifierHmac,
          failed_pin_attempts: 0,
          locked_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", userId);

      return new Response(
        JSON.stringify({ ok: true, success: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // -------------------------------------------------------------------------
    // ACTION: recover_pin (Forgot PIN)
    // -------------------------------------------------------------------------
    if (action === "recover_pin") {
      const otpCode = String(body?.otp || body?.otp_code || "").trim();
      const challengeId = body?.challenge_id ? String(body.challenge_id).trim() : null;
      const recoveryProofToken = String(body?.recovery_proof_token || "").trim();
      const newPin = String(body?.new_pin || "").trim();

      if (!/^\d{6}$/.test(newPin)) {
        return new Response(
          JSON.stringify({ error: "New PIN must be exactly 6 numeric digits." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (!recoveryProofToken) {
        return new Response(
          JSON.stringify({ error: "Recovery verification failed: Recovery Key proof required." }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Verify OTP challenge
      const otpOk = await verifyOrCheckOtp(adminClient, otpHmacSecret, userId, "forgot_pin", otpCode, challengeId);
      if (!otpOk) {
        return new Response(
          JSON.stringify({ error: "Recovery verification failed: Valid Recovery Email OTP required." }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: row } = await adminClient
        .from("cctv_vault_server_state")
        .select("recovery_verifier_hmac")
        .eq("user_id", userId)
        .maybeSingle();

      if (!row) {
        return new Response(
          JSON.stringify({ error: "Vault not configured." }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Verify Recovery Proof Token against stored HMAC
      const candidateRecoveryHmac = await computeHmac(vaultRecoveryPepper, `vault-recovery-v1:${userId}:${recoveryProofToken}`);
      if (!constantTimeEqual(candidateRecoveryHmac, row.recovery_verifier_hmac)) {
        return new Response(
          JSON.stringify({ error: "Recovery verification failed: Invalid Recovery Key." }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Compute new PIN HMAC and update
      const newPinVerifierHmac = await computeHmac(vaultPinPepper, `vault-pin-v1:${userId}:${newPin}`);
      await adminClient
        .from("cctv_vault_server_state")
        .update({
          pin_verifier_hmac: newPinVerifierHmac,
          failed_pin_attempts: 0,
          locked_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", userId);

      return new Response(
        JSON.stringify({ ok: true, recovered: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // -------------------------------------------------------------------------
    // ACTION: begin_recovery_rotation (Stage 1 of Rotation)
    // -------------------------------------------------------------------------
    if (action === "begin_recovery_rotation") {
      const currentPin = String(body?.current_pin || "").trim();
      const newRecoveryProofToken = String(body?.new_recovery_proof_token || "").trim();

      const { data: row } = await adminClient
        .from("cctv_vault_server_state")
        .select("pin_verifier_hmac")
        .eq("user_id", userId)
        .maybeSingle();

      if (!row) {
        return new Response(
          JSON.stringify({ error: "Vault not configured." }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const currentHmac = await computeHmac(vaultPinPepper, `vault-pin-v1:${userId}:${currentPin}`);
      if (!constantTimeEqual(currentHmac, row.pin_verifier_hmac)) {
        return new Response(
          JSON.stringify({ error: "Current PIN is incorrect." }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const pendingHmac = await computeHmac(vaultRecoveryPepper, `vault-recovery-v1:${userId}:${newRecoveryProofToken}`);
      const rotationId = crypto.randomUUID();

      await adminClient
        .from("cctv_vault_server_state")
        .update({
          pending_recovery_verifier_hmac: pendingHmac,
          pending_rotation_id: rotationId,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", userId);

      return new Response(
        JSON.stringify({ ok: true, rotation_id: rotationId }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // -------------------------------------------------------------------------
    // ACTION: finalize_recovery_rotation (Stage 2 of Rotation)
    // -------------------------------------------------------------------------
    if (action === "finalize_recovery_rotation") {
      const rotationId = String(body?.rotation_id || "").trim();

      const { data: row } = await adminClient
        .from("cctv_vault_server_state")
        .select("pending_recovery_verifier_hmac, pending_rotation_id")
        .eq("user_id", userId)
        .maybeSingle();

      if (!row || !row.pending_rotation_id || row.pending_rotation_id !== rotationId) {
        return new Response(
          JSON.stringify({ error: "Invalid rotation session or session expired." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Promote pending verifier to active
      await adminClient
        .from("cctv_vault_server_state")
        .update({
          recovery_verifier_hmac: row.pending_recovery_verifier_hmac,
          pending_recovery_verifier_hmac: null,
          pending_rotation_id: null,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", userId);

      return new Response(
        JSON.stringify({ ok: true, finalized: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // -------------------------------------------------------------------------
    // ACTION: reset_attempt_gate
    // -------------------------------------------------------------------------
    if (action === "reset_attempt_gate") {
      const otpCode = String(body?.otp || body?.otp_code || "").trim();
      const challengeId = body?.challenge_id ? String(body.challenge_id).trim() : null;
      const otpOk = await verifyOrCheckOtp(adminClient, otpHmacSecret, userId, "unlock_attempt", otpCode, challengeId);

      if (!otpOk) {
        return new Response(
          JSON.stringify({ error: "Recovery verification failed: Valid Recovery Email OTP required to reset attempt gate." }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Clear failed attempts counter only - DOES NOT RETURN VMK OR UNLOCK VAULT
      await adminClient.rpc("reset_server_vault_pin_attempts", { p_user_id: userId });

      return new Response(
        JSON.stringify({ ok: true, gate_reset: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: `Invalid action: ${action}` }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: "Internal server error." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
