// Supabase Edge Function: cctv-vault-otp
// Purpose: Authoritative server-side email OTP generation and verification for CCTV OPS Vault.
// Security Hardening:
//   - Requires authenticated caller JWT (Authorization: Bearer <token>)
//   - Hashes OTP with keyed HMAC-SHA-256 using server-only OTP_HMAC_SECRET (>= 256 random bits)
//   - Binds purpose, userId, challengeId, and OTP in HMAC computation
//   - Zero unkeyed SHA-256 verifiers in database
//   - Sends email strictly through server-side authenticated mail provider / Resend
//   - Enforces 10-minute expiry and max attempts
//   - Exposes zero API secrets to the client

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

async function computeOtpHmac(
  secret: string,
  purpose: string,
  userId: string,
  challengeId: string,
  otp: string
): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const data = enc.encode(`${purpose}:${userId}:${challengeId}:${otp}`);
  const sig = await crypto.subtle.sign("HMAC", key, data);
  const arr = Array.from(new Uint8Array(sig));
  return arr.map(b => b.toString(16).padStart(2, "0")).join("");
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
    const otpHmacSecret = Deno.env.get("OTP_HMAC_SECRET") || "";

    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      return new Response(
        JSON.stringify({ error: "Server configuration missing required database environment variables." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!otpHmacSecret || otpHmacSecret.length < 32) {
      return new Response(
        JSON.stringify({ error: "Server security configuration error: OTP_HMAC_SECRET must be at least 32 characters (256 bits)." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 1. Validate Caller Authentication (JWT)
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

    const { data: { user: callerUser }, error: callerAuthErr } = await callerClient.auth.getUser();
    if (callerAuthErr || !callerUser?.id || !callerUser.email) {
      return new Response(
        JSON.stringify({ error: "Unauthorized: Invalid or expired session token." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || "").trim();

    // Initialize Admin Client for OTP record persistence
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    // 2. Action: send_otp
    if (action === "send_otp") {
      const purpose = String(body?.purpose || "pin_change").trim();

      // Check if user has a verified recovery email configured
      let targetEmail = callerUser.email;
      const { data: recContact } = await adminClient
        .from("cctv_recovery_contacts")
        .select("recovery_email, recovery_email_verified")
        .eq("user_id", callerUser.id)
        .maybeSingle();

      if (recContact?.recovery_email && recContact.recovery_email_verified) {
        targetEmail = recContact.recovery_email;
      } else if (purpose === "unlock_attempt" || purpose === "forgot_pin") {
        return new Response(
          JSON.stringify({ error: "RECOVERY_EMAIL_REQUIRED: No verified recovery email found. Please configure a recovery email in account settings." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Generate 6-digit numeric OTP
      const randomValues = new Uint32Array(1);
      crypto.getRandomValues(randomValues);
      const otpCode = String(100000 + (randomValues[0] % 900000));
      const challengeId = crypto.randomUUID();
      const otpHmac = await computeOtpHmac(otpHmacSecret, purpose, callerUser.id, challengeId, otpCode);
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 minutes

      // Call secure database function
      const { data: createRes, error: dbErr } = await adminClient.rpc("create_vault_otp_record", {
        p_email: targetEmail,
        p_otp_hash: otpHmac,
        p_expires_at: expiresAt,
        p_purpose: purpose,
        p_challenge_id: challengeId,
        p_user_id: callerUser.id,
      });

      if (dbErr) {
        return new Response(
          JSON.stringify({ error: dbErr.message || "Failed to record verification code." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Send Email through configured provider
      const resendApiKey = Deno.env.get("RESEND_API_KEY");
      if (resendApiKey) {
        try {
          const subjectTitles: Record<string, string> = {
            pin_change: "PIN Change Verification Code",
            unlock_attempt: "Vault Unlock Verification Code",
            forgot_pin: "Vault Reset Verification Code",
            rotate_recovery_key: "Recovery Key Rotation Code"
          };
          const title = subjectTitles[purpose] || "Verification Code";

          await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${resendApiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              from: "CCTV OPS Security <security@cctvops.com>",
              to: targetEmail,
              subject: `CCTV OPS Secure Vault — ${title}`,
              html: `
                <div style="font-family:sans-serif; max-width:480px; margin:0 auto; padding:20px; border:1px solid #e2e8f0; border-radius:8px;">
                  <h2 style="color:#0f172a; margin-top:0;">Secure Vault Verification</h2>
                  <p style="color:#475569; font-size:14px;">Your verification code for <strong>${title}</strong>:</p>
                  <div style="margin:20px 0; padding:16px; background:#f1f5f9; border-radius:6px; text-align:center;">
                    <span style="font-size:28px; font-weight:700; letter-spacing:6px; color:#0f172a;">${otpCode}</span>
                  </div>
                  <p style="color:#64748b; font-size:12px;">This code expires in 10 minutes. If you did not request this, please verify your CCTV OPS credentials immediately.</p>
                </div>
              `,
            }),
          });
        } catch (mailErr) {
          console.warn("[cctv-vault-otp] Mail send error:", mailErr);
        }
      }

      return new Response(
        JSON.stringify({ ok: true, success: true, challenge_id: challengeId, message: "Verification code sent." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. Action: verify_otp
    if (action === "verify_otp") {
      const submittedOtp = String(body?.otp || "").trim();
      const purpose = String(body?.purpose || "pin_change").trim();
      const challengeId = body?.challenge_id ? String(body.challenge_id).trim() : null;

      if (!submittedOtp) {
        return new Response(
          JSON.stringify({ error: "Verification code required." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // If challenge_id is not supplied, look up the active unverified record for this user and purpose
      let resolvedChallengeId = challengeId;
      if (!resolvedChallengeId) {
        const { data: activeChallenge } = await adminClient
          .from("cctv_vault_otps")
          .select("challenge_id")
          .eq("user_id", callerUser.id)
          .eq("purpose", purpose)
          .eq("verified", false)
          .gt("expires_at", new Date().toISOString())
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        resolvedChallengeId = activeChallenge?.challenge_id || null;
      }

      if (!resolvedChallengeId) {
        return new Response(
          JSON.stringify({ error: "No active verification challenge found or code has expired." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const otpHmac = await computeOtpHmac(otpHmacSecret, purpose, callerUser.id, resolvedChallengeId, submittedOtp);
      const { data: verifyRes, error: verifyErr } = await adminClient.rpc("verify_vault_otp_record", {
        p_otp_hash: otpHmac,
        p_challenge_id: resolvedChallengeId,
        p_purpose: purpose,
        p_user_id: callerUser.id,
      });

      if (verifyErr) {
        return new Response(
          JSON.stringify({ error: verifyErr.message || "Invalid or expired verification code." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // If purpose was unlock_attempt, reset failed attempt count in authoritative server state
      if (purpose === "unlock_attempt") {
        await adminClient.rpc("reset_server_vault_pin_attempts", { p_user_id: callerUser.id });
      }

      return new Response(
        JSON.stringify({ ok: true, verified: true, challenge_id: resolvedChallengeId }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Invalid action. Allowed actions: send_otp, verify_otp." }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: "Internal server error." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
