/**
 * CCTV OPS V2 - Microsoft Authentication Service (MSAL)
 * Shared Microsoft Identity Platform authentication for Outlook and Teams.
 * - Single Sign-On session shared between Outlook and Teams
 * - Delegated permissions only
 * - MSAL PublicClientApplication (OAuth 2.0 Authorization Code with PKCE)
 * - Zero secrets, zero token logging, zero raw token local storage
 */

window.CCTV_MS_AUTH = (function () {
  'use strict';

  // Storage keys for Entra configuration
  const STORAGE_KEYS = {
    CLIENT_ID: 'cctv_ms_client_id_v1',
    TENANT_ID: 'cctv_ms_tenant_id_v1',
    ACCOUNT_HINT: 'cctv_ms_account_hint_v1'
  };

  // Standard Scopes
  const SCOPES = {
    BASIC: ['User.Read'],
    OUTLOOK: ['User.Read', 'Mail.Read', 'Mail.Send'],
    TEAMS: [
      'User.Read',
      'Chat.Read',
      'ChatMessage.Send',
      'Team.ReadBasic.All',
      'Channel.ReadBasic.All',
      'ChannelMessage.Send',
      'ChannelMessage.Read.All'
    ]
  };

  let msalInstance = null;
  let activeAccount = null;
  let initPromise = null;
  let lastError = null;
  const authStateListeners = [];

  /**
   * Derive safe running Redirect URI from current browser environment
   * (e.g. http://127.0.0.1:5500/cctv-ops-v2/)
   */
  function getRedirectUri() {
    try {
      const origin = window.location.origin || `${window.location.protocol}//${window.location.host}`;
      let pathname = window.location.pathname || '/';
      return `${origin}${pathname}`;
    } catch (_) {
      return window.location.href.split('?')[0].split('#')[0];
    }
  }

  /**
   * Get current Entra App Registration Settings
   */
  function getConfig() {
    const defaultClientId = (window.CCTV_V2_CONFIG && window.CCTV_V2_CONFIG.MS_ENTRA && window.CCTV_V2_CONFIG.MS_ENTRA.CLIENT_ID) || '';
    const defaultTenantId = (window.CCTV_V2_CONFIG && window.CCTV_V2_CONFIG.MS_ENTRA && window.CCTV_V2_CONFIG.MS_ENTRA.TENANT_ID) || 'common';

    const clientId = localStorage.getItem(STORAGE_KEYS.CLIENT_ID) || defaultClientId;
    const tenantId = localStorage.getItem(STORAGE_KEYS.TENANT_ID) || defaultTenantId;
    const redirectUri = getRedirectUri();

    return {
      clientId: (clientId || '').trim(),
      tenantId: (tenantId || 'common').trim(),
      redirectUri: redirectUri,
      isConfigured: Boolean(clientId && clientId.trim().length >= 16)
    };
  }

  /**
   * Save updated Entra configuration
   */
  function saveConfig(clientId, tenantId) {
    if (clientId && clientId.trim()) {
      localStorage.setItem(STORAGE_KEYS.CLIENT_ID, clientId.trim());
    } else {
      localStorage.removeItem(STORAGE_KEYS.CLIENT_ID);
    }

    if (tenantId && tenantId.trim()) {
      localStorage.setItem(STORAGE_KEYS.TENANT_ID, tenantId.trim());
    } else {
      localStorage.removeItem(STORAGE_KEYS.TENANT_ID);
    }

    lastError = null;
    msalInstance = null;
    initPromise = null;
    initialize().catch(() => {});
    notifyAuthState();
  }

  /**
   * Initialize MSAL instance safely without throwing
   */
  async function initialize() {
    if (initPromise) return initPromise;

    initPromise = (async () => {
      const config = getConfig();

      if (!window.msal) {
        lastError = 'MSAL browser library not loaded. Check internet connection or CSP directives.';
        notifyAuthState();
        return false;
      }

      if (!config.isConfigured) {
        // Not an unexpected error; simply unconfigured
        lastError = null;
        notifyAuthState();
        return false;
      }

      const authority = config.tenantId && config.tenantId !== 'common'
        ? `https://login.microsoftonline.com/${config.tenantId}`
        : 'https://login.microsoftonline.com/common';

      const msalConfig = {
        auth: {
          clientId: config.clientId,
          authority: authority,
          redirectUri: config.redirectUri,
          navigateToLoginRequestUrl: true
        },
        cache: {
          cacheLocation: 'sessionStorage',
          storeAuthStateInCookie: false
        },
        system: {
          loggerOptions: {
            loggerCallback: (level, message, containsPii) => {
              if (containsPii) return;
            },
            piiLoggingEnabled: false,
            logLevel: window.msal.LogLevel ? window.msal.LogLevel.Warning : 1
          }
        }
      };

      try {
        msalInstance = new window.msal.PublicClientApplication(msalConfig);

        if (typeof msalInstance.handleRedirectPromise === 'function') {
          const redirectResponse = await msalInstance.handleRedirectPromise();
          if (redirectResponse && redirectResponse.account) {
            activeAccount = redirectResponse.account;
            msalInstance.setActiveAccount(activeAccount);
          }
        }

        if (!activeAccount) {
          const accounts = msalInstance.getAllAccounts();
          if (accounts && accounts.length > 0) {
            const savedHint = localStorage.getItem(STORAGE_KEYS.ACCOUNT_HINT);
            activeAccount = (savedHint && accounts.find(a => a.username === savedHint)) || accounts[0];
            msalInstance.setActiveAccount(activeAccount);
          }
        }

        lastError = null;
        notifyAuthState();
        return true;
      } catch (err) {
        console.error('[MS-Auth] Initialization error:', err);
        lastError = err.message || 'MSAL client initialization failed';
        notifyAuthState();
        return false;
      }
    })();

    return initPromise;
  }

  /**
   * Interactive Sign-In (Shared for Outlook & Teams)
   */
  async function signIn(requestedScopes = SCOPES.OUTLOOK) {
    const config = getConfig();
    if (!config.isConfigured) {
      if (window.CCTV_MS_CONFIG_DIALOG) {
        window.CCTV_MS_CONFIG_DIALOG.open();
      }
      throw new Error('Configure Microsoft Entra App Registration first.');
    }

    await initialize();

    if (!msalInstance) {
      throw new Error(lastError || 'Microsoft identity client could not be initialized.');
    }

    const loginRequest = {
      scopes: requestedScopes,
      prompt: 'select_account'
    };

    try {
      lastError = null;
      let authResult = null;
      try {
        authResult = await msalInstance.loginPopup(loginRequest);
      } catch (popupErr) {
        if (popupErr.name === 'BrowserAuthError' && (popupErr.errorCode === 'popup_window_error' || popupErr.message?.includes('popup'))) {
          console.warn('[MS-Auth] Popup blocked or failed, falling back to redirect...');
          await msalInstance.loginRedirect(loginRequest);
          return null;
        }
        throw popupErr;
      }

      if (authResult && authResult.account) {
        activeAccount = authResult.account;
        msalInstance.setActiveAccount(activeAccount);
        localStorage.setItem(STORAGE_KEYS.ACCOUNT_HINT, activeAccount.username);
        lastError = null;
        notifyAuthState();
        return formatAccount(activeAccount);
      }
      return null;
    } catch (err) {
      console.error('[MS-Auth] Sign-in failed:', err);
      // Clean safe error message without secrets
      const safeMsg = (err.errorCode || err.message || 'Sign in failed')
        .replace(/[A-Za-z0-9_-]{20,}/g, '[REDACTED]');
      lastError = safeMsg;
      notifyAuthState();
      throw new Error(safeMsg);
    }
  }

  /**
   * Sign Out
   */
  async function signOut() {
    if (!msalInstance) return;

    const account = activeAccount || msalInstance.getActiveAccount();
    activeAccount = null;
    localStorage.removeItem(STORAGE_KEYS.ACCOUNT_HINT);
    lastError = null;
    notifyAuthState();

    if (account) {
      try {
        await msalInstance.logoutPopup({
          account: account,
          mainWindowRedirectUri: getRedirectUri()
        });
      } catch (err) {
        console.warn('[MS-Auth] Logout popup error, clearing cache:', err);
      }
    }
  }

  /**
   * Acquire Access Token for Microsoft Graph
   */
  async function acquireToken(scopes = SCOPES.BASIC) {
    await initialize();

    if (!msalInstance) {
      throw new Error(lastError || 'Microsoft identity client not initialized');
    }

    const account = activeAccount || msalInstance.getActiveAccount();
    if (!account) {
      throw new Error('No active Microsoft account signed in. Please sign in.');
    }

    const tokenRequest = {
      scopes: scopes,
      account: account
    };

    try {
      const silentResponse = await msalInstance.acquireTokenSilent(tokenRequest);
      return silentResponse.accessToken;
    } catch (silentErr) {
      console.warn('[MS-Auth] Silent token acquisition failed, requesting consent popup:', silentErr.errorCode || silentErr.message);

      try {
        const interactiveResponse = await msalInstance.acquireTokenPopup(tokenRequest);
        return interactiveResponse.accessToken;
      } catch (interactiveErr) {
        const safeMsg = (interactiveErr.errorCode || interactiveErr.message || 'Token acquisition failed')
          .replace(/[A-Za-z0-9_-]{20,}/g, '[REDACTED]');
        lastError = safeMsg;
        notifyAuthState();
        throw new Error(safeMsg);
      }
    }
  }

  /**
   * Formatted Active Account
   */
  function getAccount() {
    if (activeAccount) return formatAccount(activeAccount);
    if (msalInstance) {
      const current = msalInstance.getActiveAccount();
      if (current) {
        activeAccount = current;
        return formatAccount(current);
      }
    }
    return null;
  }

  function formatAccount(acc) {
    const isPersonal = acc.idTokenClaims && acc.idTokenClaims.tid === '9188040d-6c67-4c5b-b112-36a304b66dad';
    return {
      username: acc.username || '',
      name: acc.name || acc.username || 'Microsoft User',
      tenantId: (acc.idTokenClaims && acc.idTokenClaims.tid) || '',
      isPersonal: Boolean(isPersonal),
      isWorkSchool: !isPersonal,
      initials: (acc.name || acc.username || 'M').split(' ').map(s => s[0]).join('').substring(0, 2).toUpperCase()
    };
  }

  /**
   * Comprehensive Status for Workspace UI Rendering
   * Returns 'UNCONFIGURED' | 'READY_TO_SIGN_IN' | 'CONNECTED' | 'ERROR'
   */
  function getAuthStatus() {
    const config = getConfig();
    const account = getAccount();

    let status = 'UNCONFIGURED';
    if (lastError) {
      status = 'ERROR';
    } else if (account) {
      status = 'CONNECTED';
    } else if (config.isConfigured) {
      status = 'READY_TO_SIGN_IN';
    } else {
      status = 'UNCONFIGURED';
    }

    return {
      status: status,
      config: config,
      account: account,
      error: lastError,
      redirectUri: config.redirectUri
    };
  }

  function clearError() {
    lastError = null;
    notifyAuthState();
  }

  function setError(err) {
    lastError = (err?.message || String(err)).replace(/[A-Za-z0-9_-]{20,}/g, '[REDACTED]');
    notifyAuthState();
  }

  /**
   * Subscription to Auth state changes
   */
  function onAuthStateChanged(callback) {
    if (typeof callback === 'function') {
      authStateListeners.push(callback);
      try { callback(getAccount(), getAuthStatus()); } catch (_) {}
    }
  }

  function notifyAuthState() {
    const acc = getAccount();
    const status = getAuthStatus();
    authStateListeners.forEach(cb => {
      try { cb(acc, status); } catch (_) {}
    });
  }

  return {
    SCOPES,
    getConfig,
    saveConfig,
    getRedirectUri,
    initialize,
    signIn,
    signOut,
    acquireToken,
    getAccount,
    getAuthStatus,
    setError,
    clearError,
    onAuthStateChanged
  };
})();
