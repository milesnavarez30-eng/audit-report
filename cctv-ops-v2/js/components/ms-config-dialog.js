/**
 * CCTV OPS V2 - Microsoft Entra Configuration & Account Dialog
 * Guides operator on Entra App Registration settings and displays active Microsoft session.
 */

window.CCTV_MS_CONFIG_DIALOG = (function () {
  'use strict';

  function init() {
    // Close buttons
    document.getElementById('btnMsConfigClose')?.addEventListener('click', close);
    document.getElementById('btnMsConfigCancel')?.addEventListener('click', close);

    // Save configuration
    document.getElementById('btnMsConfigSave')?.addEventListener('click', handleSaveConfig);

    // Interactive Sign-in from dialog
    document.getElementById('btnMsConfigSignIn')?.addEventListener('click', handleSignIn);

    // Sign-out from dialog
    document.getElementById('btnMsConfigSignOut')?.addEventListener('click', handleSignOut);

    // Copy redirect URI button
    document.getElementById('btnCopyRedirectUri')?.addEventListener('click', handleCopyRedirectUri);

    // Listen for auth state changes
    if (window.CCTV_MS_AUTH) {
      window.CCTV_MS_AUTH.onAuthStateChanged(() => {
        populate();
      });
    }
  }

  function open() {
    const modal = document.getElementById('modalMsEntraConfig');
    if (!modal) return;
    modal.hidden = false;
    modal.classList.add('is-visible');
    populate();
  }

  function close() {
    const modal = document.getElementById('modalMsEntraConfig');
    if (modal) {
      modal.hidden = true;
      modal.classList.remove('is-visible');
    }
  }

  function populate() {
    if (!window.CCTV_MS_AUTH) return;
    const config = window.CCTV_MS_AUTH.getConfig();
    const account = window.CCTV_MS_AUTH.getAccount();

    const clientIdInput = document.getElementById('inputMsClientId');
    const tenantIdInput = document.getElementById('inputMsTenantId');
    const redirectUriInput = document.getElementById('inputMsRedirectUri');

    if (clientIdInput) clientIdInput.value = config.clientId || '';
    if (tenantIdInput) tenantIdInput.value = config.tenantId || 'common';
    if (redirectUriInput) redirectUriInput.value = config.redirectUri || (window.location.origin + window.location.pathname);

    // Account & configuration status block
    const statusWrap = document.getElementById('msConfigAccountStatus');
    const signInBtn = document.getElementById('btnMsConfigSignIn');
    const signOutBtn = document.getElementById('btnMsConfigSignOut');

    if (statusWrap) {
      if (account) {
        statusWrap.innerHTML = `
          <div style="display:flex; align-items:center; gap:10px; background:rgba(52, 211, 153, 0.1); border:1px solid rgba(52, 211, 153, 0.3); border-radius:6px; padding:10px 12px;">
            <div style="width:32px; height:32px; border-radius:50%; background:#34d399; color:#0f172a; display:flex; align-items:center; justify-content:center; font-weight:700; font-size:13px;">${account.initials}</div>
            <div style="flex:1; min-width:0;">
              <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:2px;">
                <span style="font-weight:600; color:var(--text-primary); font-size:12.5px;">${escapeHtml(account.name)}</span>
                <span class="ms-status-chip status-connected">Status: Connected</span>
              </div>
              <div style="font-size:11px; color:var(--text-secondary);">Account: <strong>${escapeHtml(account.username)}</strong></div>
              <div style="font-size:10.5px; color:#34d399; margin-top:2px;">● Type: ${account.isWorkSchool ? 'Work or School (Entra ID)' : 'Personal Microsoft Account'}</div>
            </div>
          </div>
        `;
        if (signInBtn) signInBtn.style.display = 'none';
        if (signOutBtn) signOutBtn.style.display = 'inline-flex';
      } else if (config.isConfigured) {
        statusWrap.innerHTML = `
          <div style="display:flex; align-items:center; gap:10px; background:rgba(56, 189, 248, 0.08); border:1px solid rgba(56, 189, 248, 0.3); border-radius:6px; padding:10px 12px;">
            <div style="width:32px; height:32px; border-radius:50%; background:var(--bg-surface-elevated); color:#38bdf8; display:flex; align-items:center; justify-content:center; font-size:14px;">🔑</div>
            <div style="flex:1;">
              <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:2px;">
                <span style="font-weight:600; color:var(--text-primary); font-size:12px;">Microsoft 365</span>
                <span class="ms-status-chip status-ready">Status: Ready to Sign In</span>
              </div>
              <div style="font-size:11px; color:var(--text-secondary);">Application ID configured. Click below to sign in with your Microsoft account.</div>
            </div>
          </div>
        `;
        if (signInBtn) {
          signInBtn.style.display = 'inline-flex';
          signInBtn.disabled = false;
          signInBtn.textContent = 'Sign In with Microsoft';
          signInBtn.title = '';
        }
        if (signOutBtn) signOutBtn.style.display = 'none';
      } else {
        statusWrap.innerHTML = `
          <div style="display:flex; align-items:center; gap:10px; background:rgba(245, 158, 11, 0.08); border:1px solid rgba(245, 158, 11, 0.3); border-radius:6px; padding:10px 12px;">
            <div style="width:32px; height:32px; border-radius:50%; background:var(--bg-surface-elevated); color:#fbbf24; display:flex; align-items:center; justify-content:center; font-size:14px;">⚠️</div>
            <div style="flex:1;">
              <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:2px;">
                <span style="font-weight:600; color:var(--text-primary); font-size:12px;">Microsoft 365</span>
                <span class="ms-status-chip status-unconfigured">Status: Not Configured</span>
              </div>
              <div style="font-size:11px; color:var(--text-muted); line-height:1.4;">
                Client ID: <strong style="color:#fbbf24;">Missing</strong> | Tenant: <strong style="color:#fbbf24;">Missing</strong><br>
                Please provide your Entra Application (Client) ID and save settings first.
              </div>
            </div>
          </div>
        `;
        if (signInBtn) {
          signInBtn.style.display = 'inline-flex';
          signInBtn.disabled = true;
          signInBtn.textContent = 'Configure Entra First';
          signInBtn.title = 'Configure Microsoft Entra first.';
        }
        if (signOutBtn) signOutBtn.style.display = 'none';
      }
    }
  }

  function handleSaveConfig() {
    const clientId = document.getElementById('inputMsClientId')?.value || '';
    const tenantId = document.getElementById('inputMsTenantId')?.value || 'common';

    if (window.CCTV_MS_AUTH) {
      window.CCTV_MS_AUTH.saveConfig(clientId, tenantId);
      if (window.showToast) {
        window.showToast('Microsoft Entra configuration saved', 'success');
      }
      populate();
    }
  }

  async function handleSignIn() {
    if (!window.CCTV_MS_AUTH) return;
    const signInBtn = document.getElementById('btnMsConfigSignIn');
    if (signInBtn) {
      signInBtn.disabled = true;
      signInBtn.textContent = 'Connecting...';
    }

    try {
      await window.CCTV_MS_AUTH.signIn();
      if (window.showToast) {
        window.showToast('Successfully signed in to Microsoft account!', 'success');
      }
      populate();
    } catch (err) {
      console.error('[MS-Config] Sign in error:', err);
      if (window.showToast) {
        window.showToast(`Sign in error: ${err.message}`, 'error');
      }
    } finally {
      if (signInBtn) {
        signInBtn.disabled = false;
        signInBtn.textContent = 'Sign In to Microsoft';
      }
    }
  }

  async function handleSignOut() {
    if (!window.CCTV_MS_AUTH) return;
    try {
      await window.CCTV_MS_AUTH.signOut();
      if (window.showToast) {
        window.showToast('Signed out of Microsoft account', 'info');
      }
      populate();
    } catch (err) {
      console.error('[MS-Config] Sign out error:', err);
    }
  }

  function handleCopyRedirectUri() {
    const uriInput = document.getElementById('inputMsRedirectUri');
    if (uriInput) {
      navigator.clipboard.writeText(uriInput.value).then(() => {
        if (window.showToast) window.showToast('Redirect URI copied to clipboard', 'info');
      }).catch(() => {
        uriInput.select();
        document.execCommand('copy');
      });
    }
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  return {
    init,
    open,
    close
  };
})();
