/**
 * CCTV OPS V2 - Authentication & Account Service
 * Supabase Client, Role & Permission Management, Audit Logging & Admin Controls
 */

window.CCTV_AUTH = (function () {
  "use strict";

  const cfg = window.CCTV_V2_CONFIG || {};
  let client = null;
  let currentUser = null;
  let currentProfile = null;
  let authListeners = [];

  const STORAGE_KEYS = Object.freeze({
    CACHED_PROFILE: "cctv_auth_cached_profile_v2",
    LOCAL_SESSION: "cctv_auth_local_session_v2",
    ACTIVE_WORKSPACE: "cctv_active_workspace"
  });

  function saveCachedProfile(userId, profile) {
    if (!userId || !profile) return;
    try {
      localStorage.setItem(`${STORAGE_KEYS.CACHED_PROFILE}_${userId}`, JSON.stringify(profile));
    } catch (_) {}
  }

  function readCachedProfile(userId) {
    if (!userId) return null;
    try {
      const raw = localStorage.getItem(`${STORAGE_KEYS.CACHED_PROFILE}_${userId}`);
      return raw ? JSON.parse(raw) : null;
    } catch (_) {
      return null;
    }
  }

  function saveLocalSession(user, profile) {
    try {
      if (user && profile) {
        const payload = JSON.stringify({ user, profile });
        sessionStorage.setItem(STORAGE_KEYS.LOCAL_SESSION, payload);
        localStorage.setItem(STORAGE_KEYS.LOCAL_SESSION, payload);
        saveCachedProfile(user.id, profile);
      } else {
        clearLocalAuth();
      }
    } catch (_) {}
  }

  function readLocalSession() {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEYS.LOCAL_SESSION) || localStorage.getItem(STORAGE_KEYS.LOCAL_SESSION);
      return raw ? JSON.parse(raw) : null;
    } catch (_) {
      return null;
    }
  }

  function clearLocalAuth() {
    try {
      sessionStorage.removeItem(STORAGE_KEYS.LOCAL_SESSION);
      localStorage.removeItem(STORAGE_KEYS.LOCAL_SESSION);
      if (currentUser && currentUser.id) {
        localStorage.removeItem(`${STORAGE_KEYS.CACHED_PROFILE}_${currentUser.id}`);
      }
    } catch (_) {}
  }

  const DEFAULT_USER_PERMISSIONS = Object.freeze({
    dashboard: true,
    report: true,
    conduct: true,
    edr: true,
    audit: true,
    trackers: true,
    hris: false,
    sorter: true,
    maintenance: true,
    pending: true,
    followup: true,
    unreported: true,
    masterlist: true,
    history: true,
    accounts: false,
    manage_users: false,
    manage_roles: false,
    manage_permissions: false,
    view_security_logs: false
  });

  const FULL_ADMIN_PERMISSIONS = Object.freeze({
    dashboard: true,
    report: true,
    conduct: true,
    edr: true,
    audit: true,
    trackers: true,
    hris: false,
    sorter: true,
    maintenance: true,
    pending: true,
    followup: true,
    unreported: true,
    masterlist: true,
    history: true,
    accounts: true,
    manage_users: true,
    manage_roles: false,
    manage_permissions: false,
    view_security_logs: false
  });

  function normalizePermissions(perms) {
    if (!perms || typeof perms !== "object") return { ...DEFAULT_USER_PERMISSIONS };
    return {
      dashboard: perms.dashboard !== undefined ? !!perms.dashboard : true,
      report: perms.report !== undefined ? !!perms.report : (perms.cctv !== undefined ? !!perms.cctv : true),
      conduct: perms.conduct !== undefined ? !!perms.conduct : true,
      edr: perms.edr !== undefined ? !!perms.edr : true,
      audit: perms.audit !== undefined ? !!perms.audit : (perms.cctv !== undefined ? !!perms.cctv : true),
      trackers: perms.trackers !== undefined ? !!perms.trackers : true,
      hris: perms.hris !== undefined ? !!perms.hris : false,
      sorter: perms.sorter !== undefined ? !!perms.sorter : (perms.aiSorter !== undefined ? !!perms.aiSorter : true),
      maintenance: perms.maintenance !== undefined ? !!perms.maintenance : true,
      pending: perms.pending !== undefined ? !!perms.pending : true,
      followup: perms.followup !== undefined ? !!perms.followup : true,
      unreported: perms.unreported !== undefined ? !!perms.unreported : true,
      masterlist: perms.masterlist !== undefined ? !!perms.masterlist : true,
      history: perms.history !== undefined ? !!perms.history : true,
      accounts: !!perms.accounts,
      manage_users: perms.manage_users !== undefined ? !!perms.manage_users : (perms.manageOptions !== undefined ? !!perms.manageOptions : false),
      manage_roles: !!perms.manage_roles,
      manage_permissions: !!perms.manage_permissions,
      view_security_logs: !!perms.view_security_logs
    };
  }

  function initClient() {
    if (client) return client;
    if (window._sharedSupabaseClient) {
      client = window._sharedSupabaseClient;
      return client;
    }
    if (window.supabase && typeof window.supabase.createClient === "function") {
      try {
        client = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_PUBLIC_KEY);
        window._sharedSupabaseClient = client;
      } catch (e) {
        console.error("Supabase client initialization error:", e);
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

  async function fetchProfile(userId) {
    if (!client || !userId) return null;
    try {
      const { data, error } = await client
        .from("profiles")
        .select("id, email, username, display_name, status, role, permissions, created_at, last_seen_at")
        .eq("id", userId)
        .maybeSingle();

      if (!error && data) return data;
    } catch (e) {
      console.warn("Could not fetch user profile from Supabase:", e);
    }
    return null;
  }

  let currentRole = "guest";

  async function notifyAuthChange(user, profile) {
    currentUser = user ? Object.freeze({ ...user }) : null;
    currentProfile = profile ? Object.freeze({ ...profile }) : null;
    if (!profile) {
      currentRole = "guest";
    } else if (profile.role === "super_admin") {
      currentRole = "super_admin";
    } else if (profile.role === "admin") {
      currentRole = "admin";
    } else {
      currentRole = "user";
    }

    if (user && profile) {
      saveCachedProfile(user.id, profile);
    }

    const isSuperAdmin = currentRole === "super_admin";
    const isAdmin = isSuperAdmin || currentRole === "admin";
    if (user && window.CCTV_DATA_SCOPE) {
      window.CCTV_DATA_SCOPE.activate(user.id, isAdmin, currentProfile);
    }

    authListeners.forEach(listener => {
      try {
        listener({ user: currentUser, profile: currentProfile, isAdmin, isSuperAdmin });
      } catch (err) {
        console.error("Auth listener error:", err);
      }
    });
  }

  return {
    async init() {
      initClient();

      // 1. Check for persisted local session first (e.g. standalone mode / tests / refresh)
      const localSess = readLocalSession();
      if (localSess && localSess.user && localSess.profile) {
        currentUser = Object.freeze({ ...localSess.user });
        currentProfile = Object.freeze({ ...localSess.profile });
        await notifyAuthChange(currentUser, currentProfile);
      }

      if (!client) {
        console.warn("Supabase not available, running in standalone local mode.");
        return { user: currentUser, profile: currentProfile };
      }

      try {
        const { data: { session } } = await client.auth.getSession();
        if (session && session.user) {
          currentUser = Object.freeze({ ...session.user });

          // Fast path: load cached profile immediately to prevent UI lockout / modal flicker on refresh
          const cachedProfile = readCachedProfile(session.user.id);
          if (cachedProfile) {
            currentProfile = Object.freeze({ ...cachedProfile });
            await notifyAuthChange(currentUser, currentProfile);
          }

          // Authoritative fetch from Supabase
          const remoteProfile = await fetchProfile(session.user.id);
          if (remoteProfile) {
            currentProfile = Object.freeze({ ...remoteProfile });
            saveCachedProfile(session.user.id, remoteProfile);
            await notifyAuthChange(currentUser, currentProfile);
          } else if (!cachedProfile) {
            // Fallback safe active profile if database query fails or record is pending creation
            currentProfile = Object.freeze({
              id: session.user.id,
              email: session.user.email,
              username: session.user.email ? session.user.email.split("@")[0] : "operator",
              role: "user",
              status: "approved",
              permissions: { ...DEFAULT_USER_PERMISSIONS }
            });
            await notifyAuthChange(currentUser, currentProfile);
          }
        } else if (!localSess && !currentUser) {
          currentUser = null;
          currentProfile = null;
          currentRole = "guest";
          await notifyAuthChange(null, null);
        }

        client.auth.onAuthStateChange(async (event, session) => {
          if (session && session.user) {
            currentUser = Object.freeze({ ...session.user });
            const remoteProfile = await fetchProfile(session.user.id);
            if (remoteProfile) {
              currentProfile = Object.freeze({ ...remoteProfile });
              saveCachedProfile(session.user.id, remoteProfile);
            } else {
              const cached = readCachedProfile(session.user.id);
              if (cached) currentProfile = Object.freeze({ ...cached });
            }
            await notifyAuthChange(currentUser, currentProfile);
          } else if (event === "SIGNED_OUT" || !session || !session.user) {
            clearLocalAuth();
            currentUser = null;
            currentProfile = null;
            currentRole = "guest";
            if (window.CCTV_DATA_SCOPE) {
              window.CCTV_DATA_SCOPE.deactivate();
            }
            await notifyAuthChange(null, null);
          }
        });
      } catch (e) {
        console.error("Auth session check failed:", e);
      }

      return { user: currentUser, profile: currentProfile };
    },

    onAuthChange(callback) {
      if (typeof callback === "function") {
        authListeners.push(callback);
        if (currentUser) {
          const isSuperAdmin = currentRole === "super_admin";
          const isAdmin = isSuperAdmin || currentRole === "admin";
          callback({ user: currentUser, profile: currentProfile, isAdmin, isSuperAdmin });
        }
      }
    },

    getUser() {
      return currentUser ? Object.freeze({ ...currentUser }) : null;
    },

    getProfile() {
      return currentProfile ? Object.freeze({ ...currentProfile }) : null;
    },

    getRole() {
      return currentRole;
    },

    setLocalSession(user, profile) {
      if (user && profile) {
        saveLocalSession(user, profile);
      } else {
        clearLocalAuth();
      }
      return notifyAuthChange(user, profile);
    },

    isSuperAdmin() {
      if (!currentUser || !currentProfile) return false;
      return currentRole === "super_admin";
    },

    isAdmin() {
      if (!currentUser || !currentProfile) return false;
      return currentRole === "super_admin" || currentRole === "admin";
    },

    getPermissions() {
      if (this.isSuperAdmin()) {
        return {
          ...FULL_ADMIN_PERMISSIONS,
          dashboard: true,
          accounts: true,
          hris: true,
          manage_users: true,
          manage_roles: true,
          manage_permissions: true,
          view_security_logs: true
        };
      }
      return {
        ...DEFAULT_USER_PERMISSIONS,
        ...(currentProfile?.permissions || {})
      };
    },

    hasPermission(permKey) {
      if (!currentUser || !currentProfile) return false;
      if (this.isSuperAdmin()) return true;
      if (this.isAdmin()) {
        const perms = currentProfile?.permissions || {};
        if (perms[permKey] === true) return true;
        // Legacy aliases
        if (permKey === "manage_users" && (perms.manage_users === true || perms.manageOptions === true)) return true;
        if (permKey === "manage_options" && perms.manageOptions === true) return true;
        return false;
      }
      return false;
    },

    canManageOptions() {
      return this.hasPermission("manage_users") || this.hasPermission("manageOptions") || this.hasPermission("manage_options");
    },

    canAccessWorkspace(wsKey) {
      if (!currentUser || !currentProfile) {
        // In local standalone mode without active remote profile: allow operational workspaces, protect accounts & hris
        return wsKey !== "accounts" && wsKey !== "hris";
      }
      // Super Admin has universal workspace access
      if (this.isSuperAdmin()) return true;

      const perms = currentProfile?.permissions || {};

      // Accounts workspace requires explicit grant or Super Admin
      if (wsKey === "accounts") {
        return this.isAdmin() && perms.accounts === true;
      }

      // HRIS workspace requires explicit grant or Super Admin
      if (wsKey === "hris") {
        return perms.hris === true;
      }

      // Workspaces with legacy aliases
      if (wsKey === "report") return perms.report !== false && perms.cctv !== false;
      if (wsKey === "audit") return perms.audit !== false && perms.cctv !== false;
      if (wsKey === "sorter") return perms.sorter !== false && perms.aiSorter !== false;

      // Regular operational workspaces
      return perms[wsKey] !== false;
    },

    hasWorkspaceAccess(wsKey) {
      return this.canAccessWorkspace(wsKey);
    },

    getClient() {
      return initClient();
    },

    async signIn(usernameOrEmail, password) {
      initClient();
      if (!client) throw new Error("Supabase client not initialized.");

      const email = resolveLoginEmail(usernameOrEmail);
      const { data, error } = await client.auth.signInWithPassword({
        email,
        password
      });

      if (error) throw error;

      currentUser = data.user;
      currentProfile = await fetchProfile(data.user.id);

      // Check account status
      if (currentProfile) {
        if (currentProfile.status === "disabled") {
          await client.auth.signOut();
          throw new Error("This account is currently disabled. Please contact an administrator.");
        }
        if (currentProfile.status === "rejected") {
          await client.auth.signOut();
          throw new Error("This account registration was rejected.");
        }
      } else {
        // Fallback default profile if not yet created in public.profiles
        currentProfile = {
          id: data.user.id,
          email: data.user.email || email,
          username: cleanUsername(usernameOrEmail).toLowerCase(),
          display_name: data.user.user_metadata?.display_name || cleanUsername(usernameOrEmail),
          status: "approved",
          role: "user",
          permissions: { ...DEFAULT_USER_PERMISSIONS }
        };
      }

      saveCachedProfile(data.user.id, currentProfile);
      await notifyAuthChange(currentUser, currentProfile);
      return { user: currentUser, profile: currentProfile };
    },

    async signUp(username, password, displayName = "") {
      initClient();
      if (!client) throw new Error("Supabase client not initialized.");

      const cleanU = cleanUsername(username);
      const email = resolveLoginEmail(cleanU);

      const { data, error } = await client.auth.signUp({
        email,
        password,
        options: {
          data: {
            username: cleanU,
            display_name: displayName || cleanU
          }
        }
      });

      if (error) throw error;
      return data;
    },

    async signOut() {
      clearLocalAuth();
      if (client) {
        try {
          await client.auth.signOut();
        } catch (_) {}
      }
      if (window.CCTV_DATA_SCOPE) {
        window.CCTV_DATA_SCOPE.deactivate();
      }
      currentUser = null;
      currentProfile = null;
      currentRole = "guest";
      await notifyAuthChange(null, null);
    },

    async updatePassword(newPassword) {
      initClient();
      if (!client) throw new Error("Supabase client not initialized.");
      const { data, error } = await client.auth.updateUser({
        password: newPassword
      });
      if (error) throw error;
      return data;
    },

    // Admin Operations
    async fetchAllUsers() {
      initClient();
      if (!client) return [];
      try {
        const { data, error } = await client
          .from("profiles")
          .select("*")
          .order("created_at", { ascending: false });

        if (!error && Array.isArray(data)) return data;
      } catch (e) {
        console.error("Fetch all users error:", e);
      }
      return [];
    },

    async approveUser(userId) {
      initClient();
      if (!client) return false;
      try {
        const { error } = await client.rpc("admin_set_user_status", {
          p_target: userId,
          p_status: "approved"
        });
        if (!error) {
          await this.logSecurityEvent("approve_user", `user:${userId}`);
          return true;
        }
      } catch (e) {
        console.error("Approve user error:", e);
      }
      return false;
    },

    async rejectUser(userId) {
      initClient();
      if (!client) return false;
      try {
        const { error } = await client.rpc("admin_set_user_status", {
          p_target: userId,
          p_status: "rejected"
        });
        if (!error) {
          await this.logSecurityEvent("reject_user", `user:${userId}`);
          return true;
        }
      } catch (e) {
        console.error("Reject user error:", e);
      }
      return false;
    },

    async disableUser(userId) {
      initClient();
      if (!client) return false;
      try {
        const { error } = await client.rpc("admin_set_user_status", {
          p_target: userId,
          p_status: "disabled"
        });
        if (!error) {
          await this.logSecurityEvent("disable_user", `user:${userId}`);
          return true;
        }
      } catch (e) {
        console.error("Disable user error:", e);
      }
      return false;
    },

    async updateDisplayName(userId, displayName) {
      initClient();
      if (!client) return false;
      const cleanName = String(displayName || "").trim();

      try {
        const { error: rpcErr } = await client.rpc("update_own_display_name", {
          p_display_name: cleanName
        });
        if (!rpcErr) {
          if (currentUser && currentUser.id === userId && currentProfile) {
            currentProfile = Object.freeze({ ...currentProfile, display_name: cleanName });
            saveCachedProfile(userId, currentProfile);
          }
          return true;
        }
      } catch (_) {}

      try {
        const { error } = await client
          .from("profiles")
          .update({ display_name: cleanName })
          .eq("id", userId);
        if (!error) {
          if (currentUser && currentUser.id === userId && currentProfile) {
            currentProfile = Object.freeze({ ...currentProfile, display_name: cleanName });
            saveCachedProfile(userId, currentProfile);
          }
          return true;
        }
        return false;
      } catch (e) {
        console.error("Update display name error:", e);
        return false;
      }
    },

    async updateUserRole(userId, newRole) {
      initClient();
      if (!client) return false;
      try {
        const profile = await fetchProfile(userId);
        const currentRole = profile?.role || "user";

        // Dedicated Super Admin promotion/demotion flow
        if (newRole === "super_admin" || currentRole === "super_admin") {
          try {
            const { error: superErr } = await client.rpc("admin_set_super_admin", {
              p_target: userId,
              p_role: newRole
            });
            if (!superErr) {
              await this.logSecurityEvent("change_role", `user:${userId}`, { newRole, previousRole: currentRole });
              return true;
            }
          } catch (_) {}
        }

        const { error } = await client.rpc("admin_set_user_access", {
          p_target: userId,
          p_role: newRole,
          p_permissions: profile?.permissions || {}
        });
        if (!error) {
          await this.logSecurityEvent("change_role", `user:${userId}`, { newRole, previousRole: currentRole });
          return true;
        }
      } catch (e) {
        console.error("Update role error:", e);
      }
      return false;
    },

    async updateUserPermissions(userId, permissions) {
      initClient();
      if (!client) return false;
      try {
        const profile = await fetchProfile(userId);
        const { error } = await client.rpc("admin_set_user_access", {
          p_target: userId,
          p_role: profile?.role || "user",
          p_permissions: permissions
        });
        return !error;
      } catch (e) {
        console.error("Update permissions error:", e);
        return false;
      }
    },

    getClient() {
      initClient();
      return client;
    },

    async deleteUser(userId) {
      initClient();
      if (!client) return false;
      if (currentUser && currentUser.id === userId) {
        throw new Error("You cannot delete your own active administrator account.");
      }

      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(userId || "").trim());

      if (isUuid) {
        try {
          const { data, error } = await client.rpc("admin_delete_cctv_user", {
            p_target: userId
          });
          if (!error && (data?.ok || data === true)) {
            await this.logSecurityEvent("delete_user", `user:${userId}`, { target_user_id: userId }, userId);
            return true;
          }
        } catch (_) {}

        try {
          const { data, error } = await client.rpc("admin_remove_user", {
            p_target: userId
          });
          if (!error && (data?.ok || data === true || data === undefined)) {
            await this.logSecurityEvent("delete_user", `user:${userId}`, { target_user_id: userId }, userId);
            return true;
          }
        } catch (_) {}
      }

      return false;
    },

    async logSecurityEvent(action, targetItem = "", details = {}, targetUserId = null) {
      initClient();
      if (!client) return;
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(targetUserId || "").trim());
      const safeTargetUserId = isUuid ? targetUserId : null;
      const safeDetails = details && typeof details === "object" ? { ...details } : {};
      if (targetUserId && !isUuid) {
        safeDetails.target_user_id = targetUserId;
      }

      // Invoke server-side security event RPC for authoritative audit trail
      if (client && currentUser) {
        try {
          await client.rpc("log_cctv_security_event", {
            p_action: action,
            p_target_user_id: safeTargetUserId,
            p_target_item: String(targetItem || ""),
            p_details: safeDetails
          });
        } catch (err) {
          console.warn("[Auth Service] Security event log RPC error:", err);
        }
      }
    },

    async fetchAuditLogs(limit = 100) {
      initClient();
      if (!client) return [];
      try {
        const { data, error } = await client
          .from("cctv_security_audit_logs")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(limit);
        if (!error && Array.isArray(data)) return data;
      } catch (_) {}
      return [];
    }
  };
})();
