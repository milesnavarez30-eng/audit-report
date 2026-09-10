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

  function initClient() {
    if (client) return client;
    if (window.supabase && typeof window.supabase.createClient === "function") {
      try {
        client = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_PUBLIC_KEY);
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

  async function notifyAuthChange(user, profile) {
    currentUser = user;
    currentProfile = profile;

    const isAdmin = profile?.role === "admin" || (profile?.username || "").toLowerCase() === "miles";
    if (user && window.CCTV_DATA_SCOPE) {
      window.CCTV_DATA_SCOPE.activate(user.id, isAdmin, profile);
    }

    authListeners.forEach(listener => {
      try {
        listener({ user, profile, isAdmin });
      } catch (err) {
        console.error("Auth listener error:", err);
      }
    });
  }

  return {
    async init() {
      initClient();
      if (!client) {
        console.warn("Supabase not available, running in standalone local mode.");
        return null;
      }

      try {
        const { data: { session } } = await client.auth.getSession();
        if (session && session.user) {
          currentUser = session.user;
          currentProfile = await fetchProfile(session.user.id);
          await notifyAuthChange(currentUser, currentProfile);
        }

        client.auth.onAuthStateChange(async (event, session) => {
          if (session && session.user) {
            currentUser = session.user;
            currentProfile = await fetchProfile(session.user.id);
            await notifyAuthChange(currentUser, currentProfile);
          } else {
            currentUser = null;
            currentProfile = null;
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
          const isAdmin = currentProfile?.role === "admin" || (currentProfile?.username || "").toLowerCase() === "miles";
          callback({ user: currentUser, profile: currentProfile, isAdmin });
        }
      }
    },

    getUser() {
      return currentUser;
    },

    getProfile() {
      return currentProfile;
    },

    isAdmin() {
      if (!currentProfile) {
        // Fallback for local testing / guest operator
        return true;
      }
      return currentProfile.role === "admin" || (currentProfile.username || "").toLowerCase() === "miles";
    },

    getPermissions() {
      if (this.isAdmin()) return { ...FULL_ADMIN_PERMISSIONS };
      return {
        ...DEFAULT_USER_PERMISSIONS,
        ...(currentProfile?.permissions || {})
      };
    },

    canManageOptions() {
      return this.isAdmin();
    },

    canAccessWorkspace(wsKey) {
      if (this.isAdmin()) return true;
      const perms = this.getPermissions();
      if (wsKey === "accounts") return false;
      return perms[wsKey] !== false;
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
      }

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
        const { error } = await client
          .from("profiles")
          .update({ status: "approved" })
          .eq("id", userId);
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
        const { error } = await client
          .from("profiles")
          .update({ status: "rejected" })
          .eq("id", userId);
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
        const { error } = await client
          .from("profiles")
          .update({ status: "disabled" })
          .eq("id", userId);
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
      try {
        const { error } = await client
          .from("profiles")
          .update({ display_name: displayName })
          .eq("id", userId);
        return !error;
      } catch (e) {
        console.error("Update display name error:", e);
        return false;
      }
    },

    async updateUserRole(userId, newRole) {
      initClient();
      if (!client) return false;
      try {
        const { error } = await client
          .from("profiles")
          .update({ role: newRole })
          .eq("id", userId);
        if (!error) {
          await this.logSecurityEvent("change_role", `user:${userId}`, { newRole });
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
        const { error } = await client
          .from("profiles")
          .update({ permissions })
          .eq("id", userId);
        return !error;
      } catch (e) {
        console.error("Update permissions error:", e);
        return false;
      }
    },

    async deleteUser(userId) {
      initClient();
      if (!client) return false;
      if (currentUser && currentUser.id === userId) {
        throw new Error("You cannot delete your own active administrator account.");
      }

      // Try server-side RPC admin_delete_cctv_user
      try {
        const { data, error } = await client.rpc("admin_delete_cctv_user", {
          p_target: userId
        });
        if (!error && data && data.ok) {
          await this.logSecurityEvent("delete_user", `user:${userId}`);
          return true;
        }
      } catch (rpcErr) {
        console.warn("RPC admin_delete_cctv_user failed, trying profile delete:", rpcErr);
      }

      // Fallback: delete profile record directly
      try {
        const { error } = await client
          .from("profiles")
          .delete()
          .eq("id", userId);
        if (!error) {
          await this.logSecurityEvent("delete_user_profile", `user:${userId}`);
          return true;
        }
      } catch (e) {
        console.error("Delete user error:", e);
      }
      return false;
    },

    async logSecurityEvent(action, targetItem = "", details = {}, targetUserId = null) {
      initClient();
      if (!client) return;
      try {
        await client.from("cctv_security_audit_logs").insert({
          actor_id: currentUser?.id || null,
          actor_username: currentProfile?.username || "system",
          actor_role: currentProfile?.role || "admin",
          action: action,
          target_item: targetItem,
          target_user_id: targetUserId,
          details: details
        });
      } catch (_) {}
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
