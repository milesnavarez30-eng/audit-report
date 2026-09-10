/**
 * CCTV OPS V2 - Accounts & Admin Operations Console Service
 * Full parity with Authoritative V1 Admin Operations Console:
 * - Supabase Auth & Profile Synchronization + Multi-tenant Local Fallback
 * - Staff Account Creation with instant approval & temporary credentials
 * - User Access Editor (Roles, Status, Workspace-level Permissions)
 * - Security & Administrative Audit Logging (Persistent & Filterable)
 * - Operations KPI Metrics (9 live cards) & System Health Strip
 * - Operational Settings (Theme, Landing workspace, Subtitle, CCTV auto-trim)
 */

(function () {
  'use strict';

  const cfg = window.CCTV_V2_CONFIG || {};
  const LOCAL_ACCOUNTS_KEY = "cctv_accounts_local_v1";
  const LOCAL_AUDIT_KEY = "__cctv_local_audit_events_v1";
  const OPERATIONAL_SETTINGS_KEY = "cctv_admin_settings_v1";
  const RECENT_CREDS_STORAGE_KEY = "cctv_admin_recent_creds_v1";

  const DEFAULT_USER_PERMISSIONS = {
    edr: true,
    cctv: true,
    aiSorter: true,
    maintenance: true,
    pending: true,
    masterlist: true,
    followup: true,
    history: true,
    manageOptions: false
  };

  const FULL_ADMIN_PERMISSIONS = {
    edr: true,
    cctv: true,
    aiSorter: true,
    maintenance: true,
    pending: true,
    masterlist: true,
    followup: true,
    history: true,
    manageOptions: true
  };

  let client = null;
  let accountsCache = [];
  let auditLogsCache = [];

  function initClient() {
    if (client) return client;
    if (window.supabase && typeof window.supabase.createClient === "function" && cfg.SUPABASE_URL && cfg.SUPABASE_PUBLIC_KEY) {
      try {
        client = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_PUBLIC_KEY, {
          auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
        });
      } catch (e) {
        console.warn("[Accounts Service] Could not create Supabase client:", e);
      }
    }
    return client;
  }

  function clean(val) {
    return String(val == null ? "" : val).trim();
  }

  function cleanUsername(val) {
    return clean(val).replace(/^@+/, "");
  }

  function resolveLoginEmail(usernameOrEmail) {
    const raw = clean(usernameOrEmail);
    if (!raw) return "";
    if (raw.includes("@")) return raw.toLowerCase();
    const cleanUser = cleanUsername(raw).toLowerCase().replace(/[^a-z0-9._-]/g, "");
    return `${cleanUser}@cctvops.example.com`;
  }

  function loadLocalAccounts() {
    try {
      const raw = localStorage.getItem(LOCAL_ACCOUNTS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (_) {}

    // Seed default accounts if empty
    const seed = [
      {
        id: "usr_miles_admin",
        username: "miles",
        email: "miles@cctvops.example.com",
        display_name: "Miles Navarez",
        role: "admin",
        status: "approved",
        permissions: { ...FULL_ADMIN_PERMISSIONS },
        created_at: new Date(Date.now() - 30 * 86400000).toISOString(),
        last_seen_at: new Date().toISOString()
      },
      {
        id: "usr_seth_op",
        username: "seth",
        email: "seth@cctvops.example.com",
        display_name: "Seth Dajao",
        role: "user",
        status: "approved",
        permissions: { ...DEFAULT_USER_PERMISSIONS },
        created_at: new Date(Date.now() - 14 * 86400000).toISOString(),
        last_seen_at: new Date(Date.now() - 3600000).toISOString()
      }
    ];
    saveLocalAccounts(seed);
    return seed;
  }

  function saveLocalAccounts(list) {
    try {
      localStorage.setItem(LOCAL_ACCOUNTS_KEY, JSON.stringify(list || []));
    } catch (_) {}
  }

  function getInitials(name) {
    const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return "U";
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  const CCTV_ACCOUNTS = {
    DEFAULT_USER_PERMISSIONS,
    FULL_ADMIN_PERMISSIONS,

    init() {
      initClient();
      accountsCache = loadLocalAccounts();
      return this;
    },

    getInitials,

    // -------------------------------------------------------------------------
    // System Integration Health Checks
    // -------------------------------------------------------------------------
    getSystemStatus() {
      initClient();
      const docsUrl = String(localStorage.getItem("edr_google_docs_web_app_url_v1") || "").trim();
      const sheetsUrl = String(localStorage.getItem("maintenance_google_sheets_web_app_url_v1") || "").trim();

      const isDocsReady = /^https:\/\/script\.google\.com\/macros\/s\/[^/]+\/exec/i.test(docsUrl);
      const isSheetsReady = /^https:\/\/script\.google\.com\/macros\/s\/[^/]+\/exec/i.test(sheetsUrl);
      const isSupabaseReady = !!(client && cfg.SUPABASE_URL && cfg.SUPABASE_PUBLIC_KEY);

      return {
        supabase: {
          label: isSupabaseReady ? "Connected" : "Standalone Local",
          isOnline: isSupabaseReady
        },
        docs: {
          label: isDocsReady ? "Connected" : "Not Configured",
          isOnline: isDocsReady
        },
        sheets: {
          label: isSheetsReady ? "Configured" : "Not Configured",
          isOnline: isSheetsReady
        }
      };
    },

    // -------------------------------------------------------------------------
    // Operations KPI Metrics
    // -------------------------------------------------------------------------
    async getMetrics() {
      const users = accountsCache.length > 0 ? accountsCache : loadLocalAccounts();
      const total = users.length;
      const admins = users.filter(x => x.role === "admin").length;
      const staffUsers = users.filter(x => x.role !== "admin").length;
      const pending = users.filter(x => x.status === "pending").length;
      const disabled = users.filter(x => x.status === "disabled" || x.status === "suspended").length;
      const cutoff = Date.now() - 86400000;
      const recent = users.filter(x => x.last_seen_at && new Date(x.last_seen_at).getTime() >= cutoff).length;

      // Count local records
      let edrCount = 0;
      if (window.CCTV_EDR && typeof window.CCTV_EDR.getAll === "function") {
        edrCount = window.CCTV_EDR.getAll().length;
      } else if (Array.isArray(window.edrReports)) {
        edrCount = window.edrReports.length;
      }

      let cctvCount = 0;
      if (window.CCTV_AUDIT && typeof window.CCTV_AUDIT.getRows === "function") {
        cctvCount = window.CCTV_AUDIT.getRows().length;
      } else {
        const rows = document.querySelectorAll("#outputTable tbody tr:not(.empty-row)");
        cctvCount = rows.length;
      }

      let followupCount = 0;
      if (window.CCTV_FOLLOWUP && typeof window.CCTV_FOLLOWUP.getMetrics === "function") {
        followupCount = window.CCTV_FOLLOWUP.getMetrics().open;
      }

      return {
        totalUsers: total,
        countAdmins: admins,
        countUsers: staffUsers,
        pendingUsers: pending,
        disabledUsers: disabled,
        recentUsers: recent,
        edrCount,
        cctvCount,
        followupCount
      };
    },

    // -------------------------------------------------------------------------
    // User Accounts Management
    // -------------------------------------------------------------------------
    async fetchUsers(forceRemote = false) {
      initClient();
      if (client && forceRemote) {
        try {
          const { data, error } = await client
            .from("profiles")
            .select("id,email,username,display_name,status,role,permissions,created_at,last_seen_at")
            .order("created_at", { ascending: false });

          if (!error && Array.isArray(data) && data.length > 0) {
            accountsCache = data;
            saveLocalAccounts(data);
            return accountsCache;
          }
        } catch (err) {
          console.warn("[Accounts Service] Remote fetch failed, using local cache:", err);
        }
      }

      accountsCache = loadLocalAccounts();
      return accountsCache;
    },

    getCachedUsers() {
      if (!accountsCache || accountsCache.length === 0) {
        accountsCache = loadLocalAccounts();
      }
      return accountsCache;
    },

    async createAccount({ name, username, password, role = "user" }) {
      const cleanN = clean(name);
      const cleanU = cleanUsername(username);
      const cleanP = String(password || "");
      const cleanR = role === "admin" ? "admin" : "user";

      if (!cleanN) throw new Error("Enter the staff member's name.");
      if (!cleanU || cleanU.length < 2) throw new Error("Enter a valid username.");
      if (cleanP.length < 6) throw new Error("Temporary password must contain at least 6 characters.");

      initClient();

      // Check conflict locally first
      const currentList = this.getCachedUsers();
      if (currentList.some(x => cleanUsername(x.username).toLowerCase() === cleanU.toLowerCase())) {
        throw new Error(`Username "${cleanU}" is already in use.`);
      }

      let createdUserId = "usr_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 7);
      const email = resolveLoginEmail(cleanU);
      const defaultPerms = cleanR === "admin" ? { ...FULL_ADMIN_PERMISSIONS } : { ...DEFAULT_USER_PERMISSIONS };

      // Attempt Supabase Signup if online
      if (client && cfg.SUPABASE_URL && cfg.SUPABASE_PUBLIC_KEY) {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 10000);

          const signupResponse = await fetch(
            `${String(cfg.SUPABASE_URL).replace(/\/+$/, "")}/auth/v1/signup`,
            {
              method: "POST",
              signal: controller.signal,
              headers: {
                "Content-Type": "application/json",
                "apikey": cfg.SUPABASE_PUBLIC_KEY,
                "Authorization": `Bearer ${cfg.SUPABASE_PUBLIC_KEY}`
              },
              body: JSON.stringify({
                email,
                password: cleanP,
                data: { display_name: cleanN, username: cleanU }
              })
            }
          );
          clearTimeout(timeoutId);

          if (signupResponse.ok) {
            const signupData = await signupResponse.json();
            if (signupData?.user?.id || signupData?.id) {
              createdUserId = signupData.user?.id || signupData.id;
            }
          }
        } catch (netErr) {
          console.warn("[Accounts Service] Supabase signup fetch warning:", netErr);
        }

        // Attempt profiles upsert & RPC
        try {
          await client.from("profiles").upsert({
            id: createdUserId,
            email,
            username: cleanU,
            display_name: cleanN,
            role: cleanR,
            status: "approved",
            permissions: defaultPerms
          });
        } catch (_) {}

        try {
          await client.rpc("admin_set_user_status", { p_target: createdUserId, p_status: "approved" });
          await client.rpc("admin_set_user_access", { p_target: createdUserId, p_role: cleanR, p_permissions: defaultPerms });
        } catch (_) {}
      }

      const newAccount = {
        id: createdUserId,
        email,
        username: cleanU,
        display_name: cleanN,
        role: cleanR,
        status: "approved",
        permissions: defaultPerms,
        created_at: new Date().toISOString(),
        last_seen_at: null
      };

      currentList.unshift(newAccount);
      saveLocalAccounts(currentList);
      accountsCache = currentList;

      // Add to session Recent Credentials
      this.addRecentCredential({
        id: createdUserId,
        name: cleanN,
        username: cleanU,
        password: cleanP,
        role: cleanR === "admin" ? "Admin" : "User",
        createdAt: new Date().toISOString()
      });

      // Log Security Audit Event
      await this.logSecurityEvent(
        "account_created",
        cleanU,
        { name: cleanN, role: cleanR, username: cleanU },
        createdUserId
      );

      return newAccount;
    },

    async setStatus(id, newStatus) {
      initClient();
      const currentList = this.getCachedUsers();
      const target = currentList.find(x => x.id === id);
      if (!target) throw new Error("Account not found.");

      const prevStatus = target.status;
      target.status = newStatus;
      saveLocalAccounts(currentList);

      if (client) {
        try {
          await client.rpc("admin_set_user_status", { p_target: id, p_status: newStatus });
        } catch (_) {
          try {
            await client.from("profiles").update({ status: newStatus }).eq("id", id);
          } catch (_) {}
        }
      }

      let actionName = `account_${newStatus}`;
      if (newStatus === "approved") {
        actionName = (prevStatus === "disabled" || prevStatus === "suspended") ? "account_reactivated" : "account_approved";
      } else if (newStatus === "rejected") {
        actionName = "account_rejected";
      } else if (newStatus === "disabled") {
        actionName = "account_disabled";
      }

      await this.logSecurityEvent(
        actionName,
        target.username || target.display_name || id,
        { previous_status: prevStatus || "unknown", new_status: newStatus },
        id
      );

      return target;
    },

    async saveUserAccess(id, { role, status, displayName, permissions }) {
      initClient();
      const currentList = this.getCachedUsers();
      const target = currentList.find(x => x.id === id);
      if (!target) throw new Error("Account not found.");

      const prevRole = target.role;
      const prevPerms = target.permissions || {};

      target.role = role === "admin" ? "admin" : "user";
      if (status) target.status = status;
      if (displayName) target.display_name = clean(displayName);

      // Normal user can never have manageOptions
      const sanitizedPerms = { ...(permissions || {}) };
      if (target.role !== "admin") {
        sanitizedPerms.manageOptions = false;
      } else {
        Object.keys(FULL_ADMIN_PERMISSIONS).forEach(k => {
          sanitizedPerms[k] = true;
        });
      }
      target.permissions = sanitizedPerms;

      saveLocalAccounts(currentList);

      if (client) {
        try {
          await client.rpc("admin_set_user_access", {
            p_target: id,
            p_role: target.role,
            p_permissions: sanitizedPerms
          });
        } catch (_) {}

        try {
          await client.from("profiles").update({
            role: target.role,
            status: target.status,
            display_name: target.display_name,
            permissions: sanitizedPerms
          }).eq("id", id);
        } catch (_) {}
      }

      if (prevRole !== target.role) {
        await this.logSecurityEvent("role_updated", target.username || id, {
          previous_role: prevRole,
          new_role: target.role
        }, id);
      }

      await this.logSecurityEvent("permissions_updated", target.username || id, {
        role: target.role,
        status: target.status,
        permissions: sanitizedPerms
      }, id);

      return target;
    },

    async deleteAccount(id) {
      initClient();
      const currentList = this.getCachedUsers();
      const target = currentList.find(x => x.id === id);
      if (!target) throw new Error("Account not found.");

      const activeUser = window.CCTV_AUTH?.getUser?.();
      if (activeUser && activeUser.id === id) {
        throw new Error("You cannot delete your own logged-in administrator account.");
      }

      // Remove from local cache
      const updatedList = currentList.filter(x => x.id !== id);
      saveLocalAccounts(updatedList);
      accountsCache = updatedList;

      // Remove from recent credentials if present
      this.removeRecentCredential(id);

      // Attempt Supabase deletion
      if (client) {
        try {
          await client.rpc("admin_delete_cctv_user", { p_target: id });
        } catch (_) {
          try {
            await client.from("profiles").delete().eq("id", id);
          } catch (_) {}
        }
      }

      // Log Security Audit Event
      await this.logSecurityEvent(
        "account_deleted",
        target.username || target.display_name || id,
        {
          deleted_user_id: id,
          username: target.username,
          display_name: target.display_name,
          role: target.role
        },
        id
      );

      return true;
    },

    // -------------------------------------------------------------------------
    // Recent Credentials
    // -------------------------------------------------------------------------
    getRecentCredentials() {
      try {
        const raw = sessionStorage.getItem(RECENT_CREDS_STORAGE_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
      } catch (_) {
        return [];
      }
    },

    saveRecentCredentials(list) {
      try {
        sessionStorage.setItem(RECENT_CREDS_STORAGE_KEY, JSON.stringify(list || []));
      } catch (_) {}
    },

    addRecentCredential(cred) {
      const list = this.getRecentCredentials().filter(x => cleanUsername(x.username) !== cleanUsername(cred.username));
      list.unshift({
        id: cred.id || "cred_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7),
        name: cred.name,
        username: cleanUsername(cred.username),
        password: cred.password,
        role: cred.role || "User",
        createdAt: cred.createdAt || new Date().toISOString()
      });
      if (list.length > 50) list.length = 50;
      this.saveRecentCredentials(list);
      return list;
    },

    removeRecentCredential(id) {
      const list = this.getRecentCredentials().filter(x => x.id !== id && x.username !== id);
      this.saveRecentCredentials(list);
      return list;
    },

    clearRecentCredentials() {
      try {
        sessionStorage.removeItem(RECENT_CREDS_STORAGE_KEY);
      } catch (_) {}
    },

    formatAllCredentialsText(item) {
      return [
        `Name: ${item.name}`,
        `Username: ${cleanUsername(item.username)}`,
        `Temporary Password: ${item.password}`,
        `Role: ${item.role}`
      ].join("\n");
    },

    // -------------------------------------------------------------------------
    // Security & Administrative Audit Logging
    // -------------------------------------------------------------------------
    async logSecurityEvent(action, targetItem = "", details = {}, targetUserId = null) {
      const safeAction = String(action || "").trim();
      const safeTargetItem = String(targetItem || "").trim();
      const safeDetails = (details && typeof details === "object") ? { ...details } : {};

      // Sanitize credential keys
      [
        "password", "temp_password", "temporary_password", "newPassword",
        "token", "accessToken", "access_token", "refreshToken", "refresh_token",
        "secret", "apiKey", "apikey", "service_role", "supabase_key"
      ].forEach(k => delete safeDetails[k]);

      const activeProfile = window.CCTV_AUTH?.getProfile?.();
      const actorUsername = activeProfile?.username || "admin";
      const actorRole = activeProfile?.role || "admin";

      const localId = (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function")
        ? crypto.randomUUID()
        : "evt_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 9);

      const record = {
        id: localId,
        created_at: new Date().toISOString(),
        actor_username: actorUsername,
        actor_role: actorRole,
        action: safeAction,
        target_user_id: targetUserId || null,
        target_item: safeTargetItem,
        details: safeDetails
      };

      try {
        const raw = JSON.parse(localStorage.getItem(LOCAL_AUDIT_KEY) || "[]");
        raw.unshift(record);
        localStorage.setItem(LOCAL_AUDIT_KEY, JSON.stringify(raw.slice(0, 200)));
      } catch (_) {}

      initClient();
      if (client) {
        try {
          await client.rpc("log_cctv_security_event", {
            p_action: safeAction,
            p_target_user_id: targetUserId || null,
            p_target_item: safeTargetItem,
            p_details: safeDetails
          });
        } catch (_) {
          try {
            await client.from("cctv_security_audit_logs").insert({
              actor_username: actorUsername,
              actor_role: actorRole,
              action: safeAction,
              target_item: safeTargetItem,
              target_user_id: targetUserId,
              details: safeDetails
            });
          } catch (_) {}
        }
      }

      return record;
    },

    async fetchAuditLogs(forceRemote = false) {
      initClient();
      if (client && forceRemote) {
        try {
          const { data, error } = await client
            .from("cctv_security_audit_logs")
            .select("id,created_at,actor_username,actor_role,action,target_item,details")
            .order("created_at", { ascending: false })
            .limit(100);

          if (!error && Array.isArray(data) && data.length > 0) {
            auditLogsCache = data;
            return data;
          }
        } catch (_) {}
      }

      try {
        const local = JSON.parse(localStorage.getItem(LOCAL_AUDIT_KEY) || "[]");
        auditLogsCache = local;
        return local;
      } catch (_) {
        return [];
      }
    },

    getCachedAuditLogs() {
      return auditLogsCache;
    },

    exportAuditLogs() {
      const logs = auditLogsCache.length > 0 ? auditLogsCache : JSON.parse(localStorage.getItem(LOCAL_AUDIT_KEY) || "[]");
      const json = JSON.stringify(logs, null, 2);
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `cctv_security_audit_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    },

    // -------------------------------------------------------------------------
    // Operational Settings
    // -------------------------------------------------------------------------
    getOperationalSettings() {
      try {
        const raw = JSON.parse(localStorage.getItem(OPERATIONAL_SETTINGS_KEY) || "{}");
        return {
          theme: raw.theme || "dark",
          landing: raw.landing || "cctv",
          subtitle: raw.subtitle || "Secure operations workspace",
          autoTrim: raw.autoTrim !== false
        };
      } catch (_) {
        return {
          theme: "dark",
          landing: "cctv",
          subtitle: "Secure operations workspace",
          autoTrim: true
        };
      }
    },

    async saveOperationalSettings(settings) {
      const prev = this.getOperationalSettings();
      const updated = {
        theme: settings.theme || "dark",
        landing: settings.landing || "cctv",
        subtitle: clean(settings.subtitle) || "Secure operations workspace",
        autoTrim: settings.autoTrim !== false
      };

      localStorage.setItem(OPERATIONAL_SETTINGS_KEY, JSON.stringify(updated));

      // Apply subtitle to document if available
      document.querySelectorAll(".workspace-subtitle, .auth-brand span").forEach(el => {
        el.textContent = updated.subtitle;
      });

      // Audit log
      const changed = {};
      if (prev.theme !== updated.theme) changed.theme = { from: prev.theme, to: updated.theme };
      if (prev.landing !== updated.landing) changed.landing = { from: prev.landing, to: updated.landing };
      if (prev.subtitle !== updated.subtitle) changed.subtitle = { from: prev.subtitle, to: updated.subtitle };
      if (prev.autoTrim !== updated.autoTrim) changed.autoTrim = { from: prev.autoTrim, to: updated.autoTrim };

      await this.logSecurityEvent("settings_updated", "operational_settings", Object.keys(changed).length > 0 ? changed : { saved: "ok" });

      return updated;
    }
  };

  window.CCTV_ACCOUNTS = CCTV_ACCOUNTS;
})();
