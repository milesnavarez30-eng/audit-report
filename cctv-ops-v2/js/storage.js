/**
 * CCTV OPS V2 - Storage Management & Multi-Tenant Data Scope
 * 100% Backward Compatible with Legacy Production Records
 */

(function () {
  "use strict";

  const native = {
    getItem: Storage.prototype.getItem,
    setItem: Storage.prototype.setItem,
    removeItem: Storage.prototype.removeItem,
    key: Storage.prototype.key,
    clear: Storage.prototype.clear,
    idbOpen: indexedDB.open.bind(indexedDB),
    idbDelete: indexedDB.deleteDatabase.bind(indexedDB)
  };

  const LEGACY_OWNER_KEY = "__cctv_scope_legacy_owner_v1";
  const ACTIVE_USER_KEY = "__cctv_scope_active_user_v1";

  // Connection/config values and shared master options are shared across operators
  const GLOBAL_APP_KEYS = new Set([
    "cctv_theme",
    "cctv_dropdown_site",
    "cctv_dropdown_omName",
    "cctv_dropdown_account",
    "cctv_dropdown_reasonCode",
    "cctv_master_hr_local_crud_v1",
    "cctv_master_edr_custom_options_v1",
    "maintenance_google_sheets_web_app_url_v1",
    "edr_google_docs_web_app_url_v1",
    "edr_google_docs_receiver_font_fix_v1"
  ]);

  const rawGet = key => native.getItem.call(window.localStorage, key);
  const rawSet = (key, value) => native.setItem.call(window.localStorage, key, String(value));
  const rawRemove = key => native.removeItem.call(window.localStorage, key);

  function detectSupabaseAuth() {
    try {
      for (let i = 0; i < window.localStorage.length; i++) {
        const key = native.key.call(window.localStorage, i);
        if (!key || !/^sb-.*-auth-token$/i.test(key)) continue;

        const parsed = JSON.parse(native.getItem.call(window.localStorage, key) || "null");
        const userObj = parsed?.user || parsed?.currentSession?.user || parsed?.session?.user;
        const id = userObj?.id || null;
        const username = userObj?.user_metadata?.username || userObj?.raw_user_meta_data?.username || "";
        const email = userObj?.email || "";

        if (id) {
          return {
            id: String(id),
            username: String(username).toLowerCase(),
            email: String(email).toLowerCase()
          };
        }
      }
    } catch (error) {
      console.warn("Could not detect Supabase user for local data scope.", error);
    }
    return null;
  }

  const detectedAuth = detectSupabaseAuth();
  let legacyOwner = rawGet(LEGACY_OWNER_KEY) || "";
  let currentUserId = detectedAuth?.id || rawGet(ACTIVE_USER_KEY) || "";

  if (!legacyOwner && detectedAuth && (detectedAuth.username === "miles" || detectedAuth.email.startsWith("miles@"))) {
    legacyOwner = detectedAuth.id;
    rawSet(LEGACY_OWNER_KEY, detectedAuth.id);
  }

  function prefixFor(userId) {
    if (!userId) return "__cctv_guest__::";
    if (legacyOwner && legacyOwner === userId) return "";
    return `__cctv_user_${userId}__::`;
  }

  let currentPrefix = prefixFor(currentUserId);

  function isGlobalStorageKey(key) {
    const text = String(key || "");
    return (
      /^sb-/i.test(text) ||
      text === LEGACY_OWNER_KEY ||
      text === ACTIVE_USER_KEY ||
      GLOBAL_APP_KEYS.has(text)
    );
  }

  function scopedStorageKey(key) {
    const text = String(key || "");
    if (isGlobalStorageKey(text)) return text;
    return currentPrefix + text;
  }

  Storage.prototype.getItem = function(key) {
    if (this === window.localStorage) {
      return native.getItem.call(this, scopedStorageKey(key));
    }
    return native.getItem.call(this, key);
  };

  Storage.prototype.setItem = function(key, value) {
    if (this === window.localStorage) {
      return native.setItem.call(this, scopedStorageKey(key), value);
    }
    return native.setItem.call(this, key, value);
  };

  Storage.prototype.removeItem = function(key) {
    if (this === window.localStorage) {
      return native.removeItem.call(this, scopedStorageKey(key));
    }
    return native.removeItem.call(this, key);
  };

  function scopedDbName(name) {
    const text = String(name || "");
    if (/^__cctv_/i.test(text)) return text;
    if (!/^(cctv_|maintenance_)/i.test(text)) return text;
    return currentPrefix + text;
  }

  indexedDB.open = function(name, version) {
    const scoped = scopedDbName(name);
    return version === undefined
      ? native.idbOpen(scoped)
      : native.idbOpen(scoped, version);
  };

  indexedDB.deleteDatabase = function(name) {
    return native.idbDelete(scopedDbName(name));
  };

  window.CCTV_DATA_SCOPE = {
    activate(userId, isAdmin, userProfile = null) {
      const id = String(userId || "");
      if (!id) return false;

      let claimedLegacy = false;
      const isMiles =
        userProfile?.username?.toLowerCase?.() === "miles" ||
        userProfile?.email?.toLowerCase?.()?.startsWith?.("miles@") ||
        detectedAuth?.username === "miles" ||
        detectedAuth?.email?.startsWith?.("miles@");

      if ((isAdmin && !legacyOwner) || (isMiles && (!legacyOwner || legacyOwner !== id))) {
        legacyOwner = id;
        rawSet(LEGACY_OWNER_KEY, id);
        claimedLegacy = true;
      }

      const desiredPrefix = prefixFor(id);
      const changed =
        currentUserId !== id ||
        currentPrefix !== desiredPrefix ||
        claimedLegacy;

      currentUserId = id;
      currentPrefix = desiredPrefix;
      rawSet(ACTIVE_USER_KEY, id);
      return changed;
    },

    deactivate() {
      const hadUser = !!currentUserId;
      currentUserId = "";
      currentPrefix = prefixFor("");
      rawRemove(ACTIVE_USER_KEY);
      return hadUser;
    },

    info() {
      return {
        userId: currentUserId,
        isLegacyOwner: !!currentUserId && legacyOwner === currentUserId,
        prefix: currentPrefix
      };
    }
  };

  // Promise-based IndexedDB & LocalStorage Helpers for Services
  window.CCTV_STORAGE = {
    getItem(key, defaultVal = null) {
      try {
        const val = localStorage.getItem(key);
        if (val === null) return defaultVal;
        return JSON.parse(val);
      } catch (_) {
        return localStorage.getItem(key) || defaultVal;
      }
    },

    setItem(key, val) {
      try {
        if (typeof val === "object" && val !== null) {
          localStorage.setItem(key, JSON.stringify(val));
        } else {
          localStorage.setItem(key, String(val));
        }
      } catch (e) {
        console.error("Storage setItem error:", e);
      }
    },

    removeItem(key) {
      try {
        localStorage.removeItem(key);
      } catch (e) {
        console.error("Storage removeItem error:", e);
      }
    },

    openDb(dbName, version = 1, onUpgrade = null) {
      return new Promise((resolve, reject) => {
        const req = indexedDB.open(dbName, version);
        req.onupgradeneeded = (e) => {
          if (typeof onUpgrade === "function") {
            onUpgrade(req.result, e);
          }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    },

    async idbGet(dbName, storeName, key, version = 1, onUpgrade = null) {
      const db = await this.openDb(dbName, version, onUpgrade);
      return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, "readonly");
        const req = tx.objectStore(storeName).get(key);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error);
        tx.oncomplete = () => db.close();
      });
    },

    async idbGetAll(dbName, storeName, version = 1, onUpgrade = null) {
      const db = await this.openDb(dbName, version, onUpgrade);
      return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, "readonly");
        const req = tx.objectStore(storeName).getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
        tx.oncomplete = () => db.close();
      });
    },

    async idbSet(dbName, storeName, value, key = null, version = 1, onUpgrade = null) {
      const db = await this.openDb(dbName, version, onUpgrade);
      return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, "readwrite");
        const store = tx.objectStore(storeName);
        const req = key !== null ? store.put(value, key) : store.put(value);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
        tx.oncomplete = () => db.close();
      });
    },

    async idbDelete(dbName, storeName, key, version = 1, onUpgrade = null) {
      const db = await this.openDb(dbName, version, onUpgrade);
      return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, "readwrite");
        const req = tx.objectStore(storeName).delete(key);
        req.onsuccess = () => resolve(true);
        req.onerror = () => reject(req.error);
        tx.oncomplete = () => db.close();
      });
    }
  };
})();
