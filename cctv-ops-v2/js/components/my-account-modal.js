/**
 * CCTV OPS V2 - My Account & Recovery Email Component
 * Handles user self-service Recovery Email registration and 6-digit OTP verification.
 *
 * Privacy & Security Guarantees:
 * - Current CCTV OPS password re-verification required before challenge creation
 * - Keyed HMAC OTP verification on backend
 * - Real email address never logged or retained in client state
 * - Displays masked recovery email only (e.g., m***@gmail.com)
 */

(function () {
  'use strict';

  let activeChallengeId = null;

  function el(id) {
    return document.getElementById(id);
  }

  function maskEmail(email) {
    if (!email || typeof email !== "string" || !email.includes("@")) return "—";
    const [name, domain] = email.split("@");
    return `${name.charAt(0)}***@${domain || ""}`;
  }

  async function callRecoveryEmailFunction(action, params = {}) {
    const authClient = (window.CCTV_AUTH && typeof window.CCTV_AUTH.getClient === "function")
      ? window.CCTV_AUTH.getClient()
      : (window._sharedSupabaseClient || window.supabase);

    if (!authClient || !authClient.functions) {
      throw new Error("Supabase client not initialized.");
    }

    const { data, error } = await authClient.functions.invoke("cctv-recovery-email", {
      body: { action, ...params }
    });

    if (error) {
      let serverMsg = error.message || "Failed to reach recovery email service.";
      try {
        if (error.context && typeof error.context.json === "function") {
          const errBody = await error.context.json();
          if (errBody && errBody.error) serverMsg = errBody.error;
        }
      } catch (_) {}
      throw new Error(serverMsg);
    }

    return data;
  }

  function showStatus(msg, type = "info") {
    const statusEl = el("myAccountStatusMsg");
    if (!statusEl) return;
    statusEl.style.display = "block";
    statusEl.style.color = type === "error" ? "#ef4444" : (type === "success" ? "#10b981" : "var(--accent-primary, #f59e0b)");
    statusEl.style.fontWeight = "500";
    statusEl.textContent = msg;
  }

  function hideStatus() {
    const statusEl = el("myAccountStatusMsg");
    if (statusEl) {
      statusEl.style.display = "none";
      statusEl.textContent = "";
    }
  }

  async function refreshRecoveryStatus() {
    const badge = el("myAccountRecStatusBadge");
    const card = el("myAccountCurrentEmailCard");
    const val = el("myAccountMaskedEmailVal");

    if (badge) {
      badge.textContent = "Checking...";
      badge.style.color = "#94a3b8";
      badge.style.background = "rgba(148,163,184,0.1)";
      badge.style.borderColor = "rgba(148,163,184,0.2)";
    }

    try {
      const res = await callRecoveryEmailFunction("get_status");
      if (res && res.configured && res.masked_email) {
        if (badge) {
          badge.textContent = "Verified ✓";
          badge.style.color = "#10b981";
          badge.style.background = "rgba(16,185,129,0.12)";
          badge.style.borderColor = "rgba(16,185,129,0.3)";
        }
        if (card) card.style.display = "block";
        if (val) val.textContent = res.masked_email;
      } else {
        if (badge) {
          badge.textContent = "Not Configured";
          badge.style.color = "#f59e0b";
          badge.style.background = "rgba(245,158,11,0.12)";
          badge.style.borderColor = "rgba(245,158,11,0.3)";
        }
        if (card) card.style.display = "none";
      }
    } catch (err) {
      console.warn("[MyAccount] Could not fetch recovery status:", err.message);
      if (badge) {
        badge.textContent = "Unverified";
        badge.style.color = "#94a3b8";
      }
    }
  }

  async function openModal() {
    const modal = el("modalMyAccount");
    if (!modal) return;

    hideStatus();
    activeChallengeId = null;

    // Reset forms
    const pwdInput = el("myAccountCurrentPassword");
    const emailInput = el("myAccountRecoveryEmailInput");
    const otpInput = el("myAccountOtpInput");

    if (pwdInput) pwdInput.value = "";
    if (emailInput) emailInput.value = "";
    if (otpInput) otpInput.value = "";

    const emailForm = el("myAccountEmailForm");
    const otpForm = el("myAccountOtpForm");
    if (emailForm) emailForm.style.display = "flex";
    if (otpForm) otpForm.style.display = "none";

    // Populate user profile info
    const profile = window.CCTV_AUTH?.getProfile?.() || {};
    const user = window.CCTV_AUTH?.getUser?.() || {};
    const nameEl = el("myAccountDisplayName");
    const userEl = el("myAccountUsername");
    const roleBadge = el("myAccountRoleBadge");

    if (nameEl) nameEl.textContent = profile.display_name || user.email || "Operator";
    if (userEl) userEl.textContent = profile.username ? `@${profile.username}` : (user.email || "");
    if (roleBadge) {
      const role = profile.role || "user";
      roleBadge.textContent = role === "super_admin" ? "⚡ Super Admin" : (role === "admin" ? "Administrator" : "Staff User");
      roleBadge.className = `admin-badge badge-${role}`;
    }

    modal.hidden = false;
    modal.classList.add("is-visible");

    await refreshRecoveryStatus();
  }

  function closeModal() {
    const modal = el("modalMyAccount");
    if (!modal) return;
    modal.hidden = true;
    modal.classList.remove("is-visible");
    hideStatus();

    // Clear sensitive password inputs
    const pwdInput = el("myAccountCurrentPassword");
    const otpInput = el("myAccountOtpInput");
    if (pwdInput) pwdInput.value = "";
    if (otpInput) otpInput.value = "";
  }

  async function handleSendOtp() {
    hideStatus();
    const pwdInput = el("myAccountCurrentPassword");
    const emailInput = el("myAccountRecoveryEmailInput");
    const sendBtn = el("btnMyAccountSendOtp");

    const password = String(pwdInput?.value || "").trim();
    const recoveryEmail = String(emailInput?.value || "").trim().toLowerCase();

    if (!password) {
      showStatus("Please enter your current CCTV OPS password to continue.", "error");
      pwdInput?.focus();
      return;
    }

    if (!recoveryEmail || !recoveryEmail.includes("@") || !recoveryEmail.includes(".")) {
      showStatus("Please enter a valid recovery email address.", "error");
      emailInput?.focus();
      return;
    }

    if (sendBtn) {
      sendBtn.disabled = true;
      sendBtn.textContent = "Dispatching code via Resend...";
    }

    try {
      const res = await callRecoveryEmailFunction("send_challenge", {
        password: password,
        recovery_email: recoveryEmail
      });

      if (!res || !res.ok) {
        throw new Error(res?.error || "Failed to dispatch verification code.");
      }

      activeChallengeId = res.challenge_id;

      // Switch to Step 2: OTP input
      const emailForm = el("myAccountEmailForm");
      const otpForm = el("myAccountOtpForm");
      if (emailForm) emailForm.style.display = "none";
      if (otpForm) otpForm.style.display = "flex";

      const maskedNotice = res.masked_email || maskEmail(recoveryEmail);
      showStatus(`Verification code dispatched to ${maskedNotice}. Please check your inbox.`, "info");

      const otpInput = el("myAccountOtpInput");
      if (otpInput) {
        otpInput.value = "";
        otpInput.focus();
      }
    } catch (err) {
      console.error("[MyAccount] Send OTP failed:", err);
      showStatus(err.message || "Failed to send verification code.", "error");
    } finally {
      if (sendBtn) {
        sendBtn.disabled = false;
        sendBtn.textContent = "Send Verification Code";
      }
    }
  }

  async function handleVerifyOtp() {
    hideStatus();
    const otpInput = el("myAccountOtpInput");
    const verifyBtn = el("btnMyAccountVerifyOtp");
    const submittedOtp = String(otpInput?.value || "").trim();

    if (!submittedOtp || submittedOtp.length !== 6 || !/^\d{6}$/.test(submittedOtp)) {
      showStatus("Please enter a valid 6-digit numeric verification code.", "error");
      otpInput?.focus();
      return;
    }

    if (verifyBtn) {
      verifyBtn.disabled = true;
      verifyBtn.textContent = "Verifying HMAC...";
    }

    try {
      const res = await callRecoveryEmailFunction("verify_challenge", {
        challenge_id: activeChallengeId,
        otp: submittedOtp
      });

      if (!res || !res.ok) {
        throw new Error(res?.error || "Invalid verification code.");
      }

      // Verification succeeded!
      showStatus("Recovery email successfully verified and registered!", "success");

      // Clear sensitive fields
      if (otpInput) otpInput.value = "";
      const pwdInput = el("myAccountCurrentPassword");
      if (pwdInput) pwdInput.value = "";

      // Hide OTP form, show email form reset
      const otpForm = el("myAccountOtpForm");
      const emailForm = el("myAccountEmailForm");
      if (otpForm) otpForm.style.display = "none";
      if (emailForm) emailForm.style.display = "flex";

      const emailInput = el("myAccountRecoveryEmailInput");
      if (emailInput) emailInput.value = "";

      await refreshRecoveryStatus();

      if (typeof window.showToast === "function") {
        window.showToast("Recovery email verified successfully.", "success");
      }
    } catch (err) {
      console.error("[MyAccount] Verify OTP failed:", err);
      showStatus(err.message || "Verification code failed.", "error");
      otpInput?.focus();
    } finally {
      if (verifyBtn) {
        verifyBtn.disabled = false;
        verifyBtn.textContent = "Verify Code";
      }
    }
  }

  function handleCancelOtp() {
    const emailForm = el("myAccountEmailForm");
    const otpForm = el("myAccountOtpForm");
    if (emailForm) emailForm.style.display = "flex";
    if (otpForm) otpForm.style.display = "none";
    hideStatus();
  }

  function init() {
    // Bind buttons
    el("btnOpenMyAccount")?.addEventListener("click", openModal);
    el("btnAdminSubnavMyAccount")?.addEventListener("click", openModal);
    el("btnMyAccountClose")?.addEventListener("click", closeModal);
    el("btnMyAccountDone")?.addEventListener("click", closeModal);
    el("btnMyAccountSendOtp")?.addEventListener("click", handleSendOtp);
    el("btnMyAccountVerifyOtp")?.addEventListener("click", handleVerifyOtp);
    el("btnMyAccountCancelOtp")?.addEventListener("click", handleCancelOtp);

    // Support Enter key on inputs
    el("myAccountCurrentPassword")?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") handleSendOtp();
    });
    el("myAccountRecoveryEmailInput")?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") handleSendOtp();
    });
    el("myAccountOtpInput")?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") handleVerifyOtp();
    });

    // Close on backdrop click
    el("modalMyAccount")?.addEventListener("click", (e) => {
      if (e.target === el("modalMyAccount")) {
        closeModal();
      }
    });
  }

  // Export globally
  window.CCTV_MY_ACCOUNT = {
    init,
    open: openModal,
    close: closeModal,
    refreshStatus: refreshRecoveryStatus
  };

  // Auto-init on DOMContentLoaded
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
