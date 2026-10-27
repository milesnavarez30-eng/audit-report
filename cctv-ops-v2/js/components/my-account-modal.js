/**
 * CCTV OPS V2 - My Account Component
 * Displays user profile summary and role information.
 */

(function () {
  'use strict';

  function el(id) {
    return document.getElementById(id);
  }

  function openModal() {
    const modal = el("modalMyAccount");
    if (!modal) return;

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
  }

  function closeModal() {
    const modal = el("modalMyAccount");
    if (!modal) return;
    modal.hidden = true;
    modal.classList.remove("is-visible");
  }

  function init() {
    // Bind buttons
    el("btnOpenMyAccount")?.addEventListener("click", openModal);
    el("btnAdminSubnavMyAccount")?.addEventListener("click", openModal);
    el("btnMyAccountClose")?.addEventListener("click", closeModal);
    el("btnMyAccountDone")?.addEventListener("click", closeModal);

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
    close: closeModal
  };

  // Auto-init on DOMContentLoaded
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
