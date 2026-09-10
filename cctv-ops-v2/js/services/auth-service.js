/**
 * CCTV OPS V2 - Authentication & Account Service
 * Clean Supabase client integration with role-based access & multi-tenant data activation
 */

window.CCTV_AUTH = (function () {
  "use strict";

  const cfg = window.CCTV_V2_CONFIG || {};
  let client = null;
  let currentUser = null;
  let currentProfile = null;
  let authListeners = [];

  function initClient() {
    if (client) return client;
    if (window.supabase && typeof window.supabase.createClient === "function") {
      try {
        client = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_PUBLIC_KEY);
      } catch (e) {
        console.error("Supabase client init error:", e);
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
      console.warn("Could not fetch user profile:", e);
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
      return currentProfile?.role === "admin" || (currentProfile?.username || "").toLowerCase() === "miles";
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
        await client.auth.signOut();
      }
      if (window.CCTV_DATA_SCOPE) {
        window.CCTV_DATA_SCOPE.deactivate();
      }
      currentUser = null;
      currentProfile = null;
      await notifyAuthChange(null, null);
    },

    async updatePassword(newPassword) {
      if (!client) throw new Error("Supabase client not initialized.");
      const { data, error } = await client.auth.updateUser({
        password: newPassword
      });
      if (error) throw error;
      return data;
    },

    async fetchAllUsers() {
      if (!client || !this.isAdmin()) return [];
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

    async updateUserRole(userId, newRole) {
      if (!client || !this.isAdmin()) return false;
      try {
        const { error } = await client
          .from("profiles")
          .update({ role: newRole })
          .eq("id", userId);
        return !error;
      } catch (e) {
        console.error("Update role error:", e);
        return false;
      }
    }
  };
})();
