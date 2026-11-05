/**
 * CCTV OPS V2 - Focus State & Queue Service
 * 
 * Manages player queues, 100-track listening history, user persistence,
 * Supabase RLS backend synchronization, account isolation, and related-song autoplay.
 */

window.CCTV_FOCUS_STATE = (function () {
  "use strict";

  const HISTORY_MAX = 100;
  const QUEUE_MAX = 50;
  const UI_LAYOUT_KEY = "cctv_focus_ui_layout";

  // In-memory state
  let nowPlaying = null;
  let playNextQueue = [];
  let upcomingQueue = [];
  let history = [];
  let customLyricsMap = {};
  let listeners = [];

  let isEnabled = false;
  let isWindowVisible = false;
  let mode = "discreet"; // 'discreet' | 'full'
  let activeTab = "lyrics"; // 'lyrics' | 'search' | 'queue'
  let lyricsMode = "full"; // 'full' | 'compact'
  let autoplayEnabled = true;

  // Cloud sync tracking
  let syncStatus = "synced"; // 'synced' | 'saving' | 'offline' | 'error'
  let saveDebounceTimer = null;
  let isInitialLoadDone = false;

  let windowRectDiscreet = { width: 230, height: 46, x: 80, y: 740 };
  let windowRectFull = { width: 360, height: 500, x: 80, y: 340 };

  // Load non-sensitive UI layout from local storage
  try {
    const rawLayout = localStorage.getItem(UI_LAYOUT_KEY);
    if (rawLayout) {
      const parsedLayout = JSON.parse(rawLayout);
      if (parsedLayout.windowRectDiscreet) windowRectDiscreet = parsedLayout.windowRectDiscreet;
      if (parsedLayout.windowRectFull) windowRectFull = parsedLayout.windowRectFull;
      if (parsedLayout.activeTab) activeTab = parsedLayout.activeTab;
    }
  } catch (_) {}

  function getSupabaseClient() {
    return window.CCTV_AUTH?.getClient?.() || window._sharedSupabaseClient || null;
  }

  function getAuthenticatedUser() {
    try {
      const u = window.CCTV_AUTH?.getUser?.();
      // Ensure real user with id
      return (u && u.id && u.id !== "guest") ? u : null;
    } catch (_) {
      return null;
    }
  }

  function getUserId() {
    const u = getAuthenticatedUser();
    return u ? u.id : "guest";
  }

  function isProductionMode() {
    const cfg = window.CCTV_V2_CONFIG || {};
    return !cfg.IS_PREVIEW;
  }

  function isMockEnvironment() {
    const cfg = window.CCTV_V2_CONFIG || {};
    if (cfg.IS_PREVIEW) return true;
    if (window.CCTV_PREVIEW_MODE === true) return true;
    // On localhost / 127.0.0.1 without Supabase client, this is an offline mock sandbox
    if ((window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") && !getSupabaseClient()) {
      return true;
    }
    return false;
  }

  function isFocusAllowedByAdmin() {
    // 1. Check global config
    const cfg = window.CCTV_V2_CONFIG || {};
    if (cfg.ALLOW_FOCUS_PLAYER === false) return false;

    // 2. Check operational settings if loaded
    try {
      const opSettings = window.CCTV_ACCOUNTS?.getOperationalSettings?.();
      if (opSettings && opSettings.allow_focus_player === false) return false;
    } catch (_) {}

    return true;
  }

  function notify() {
    const snap = getState();
    listeners.forEach(fn => {
      try {
        fn(snap);
      } catch (err) {
        console.error("Focus state listener error:", err);
      }
    });
  }

  function saveNonSensitiveUILayout() {
    try {
      localStorage.setItem(UI_LAYOUT_KEY, JSON.stringify({
        windowRectDiscreet,
        windowRectFull,
        activeTab
      }));
    } catch (_) {}
  }

  /**
   * Secure Persistence Engine
   * Persists user private state to Supabase RLS backend.
   * If save fails in production: retains in-memory state ONLY and flags sync status.
   * NEVER silently writes private user state into persistent localStorage.
   */
  async function performBackendSave() {
    const user = getAuthenticatedUser();
    const client = getSupabaseClient();

    const payload = {
      queue: playNextQueue.concat(upcomingQueue).slice(0, QUEUE_MAX),
      playback: {
        nowPlaying,
        mode,
        lyricsMode,
        autoplayEnabled,
        volume: window.CCTV_FOCUS_AUDIO?.getVolume?.() || 0.8,
        isMuted: window.CCTV_FOCUS_AUDIO?.isMuted?.() || false
      },
      preferences: {
        isEnabled,
        mode,
        lyricsMode,
        autoplayEnabled
      },
      history: history.slice(0, HISTORY_MAX),
      custom_lyrics: customLyricsMap
    };

    // Save non-sensitive UI positions locally
    saveNonSensitiveUILayout();

    // If authenticated user with Supabase client: save to backend via secure RPC
    if (user && client) {
      try {
        syncStatus = "saving";
        notify();

        const { data, error } = await client.rpc("save_cctv_user_focus_state", {
          p_payload: payload
        });

        if (error) {
          console.warn("[Focus State] Supabase save error:", error.message);
          syncStatus = "offline";
          notify();
          return false;
        }

        if (data && data.success) {
          syncStatus = "synced";
          // Once confirmed saved to backend, remove any legacy local key for this exact user
          try {
            localStorage.removeItem(`cctv_focus_user_${user.id}`);
          } catch (_) {}
          notify();
          return true;
        }
      } catch (err) {
        console.warn("[Focus State] Save failed over network:", err);
        syncStatus = "offline";
        notify();
        return false;
      }
    } else if (isMockEnvironment() && user) {
      // Mock / Offline Development Sandbox: explicitly isolated mock storage
      try {
        localStorage.setItem(`cctv_focus_mock_${user.id}`, JSON.stringify(payload));
        syncStatus = "synced";
      } catch (_) {}
      notify();
      return true;
    } else {
      // Production without backend or offline: FAIL SAFELY in-memory only!
      syncStatus = user ? "offline" : "synced";
      notify();
      return true;
    }
  }

  function scheduleSave() {
    clearTimeout(saveDebounceTimer);
    saveDebounceTimer = setTimeout(() => {
      performBackendSave();
    }, 1500);
  }

  /**
   * One-time Safe Migration of Legacy Local State for Current User
   * Strict validation: Only migrates if key exactly matches currentUser.id.
   * Never touches "guest" or other user keys.
   */
  async function migrateLegacyLocalStateIfPresent(userId) {
    if (!userId || userId === "guest") return null;
    const legacyKey = `cctv_focus_user_${userId}`;
    try {
      const raw = localStorage.getItem(legacyKey);
      if (!raw) return null;

      const legacy = JSON.parse(raw);
      if (!legacy || typeof legacy !== "object") return null;

      console.info("[Focus State] Discovered unmigrated local state for user, validating...", userId);

      // Sanitize and structure payload
      const migrated = {
        queue: Array.isArray(legacy.upcomingQueue) ? legacy.upcomingQueue.slice(0, QUEUE_MAX) : [],
        playback: {
          nowPlaying: legacy.nowPlaying || null,
          mode: legacy.mode === "full" ? "full" : "discreet",
          lyricsMode: legacy.lyricsMode === "compact" ? "compact" : "full",
          autoplayEnabled: typeof legacy.autoplayEnabled === "boolean" ? legacy.autoplayEnabled : true,
          volume: typeof legacy.volume === "number" ? legacy.volume : 0.8,
          isMuted: typeof legacy.isMuted === "boolean" ? legacy.isMuted : false
        },
        preferences: {
          isEnabled: isEnabled,
          mode: legacy.mode === "full" ? "full" : "discreet",
          lyricsMode: legacy.lyricsMode === "compact" ? "compact" : "full",
          autoplayEnabled: typeof legacy.autoplayEnabled === "boolean" ? legacy.autoplayEnabled : true
        },
        history: Array.isArray(legacy.history) ? legacy.history.slice(0, HISTORY_MAX) : [],
        custom_lyrics: customLyricsMap
      };

      const client = getSupabaseClient();
      if (client) {
        const { data, error } = await client.rpc("save_cctv_user_focus_state", {
          p_payload: migrated
        });

        if (!error && data?.success) {
          console.info("[Focus State] Successfully migrated local state to Supabase RLS backend. Clearing legacy local key.");
          localStorage.removeItem(legacyKey);
          return migrated;
        }
      }
    } catch (err) {
      console.warn("[Focus State] Legacy migration check error:", err);
    }
    return null;
  }

  /**
   * Secure State Loader
   * Hydrates state from authoritative Supabase backend.
   */
  async function loadState() {
    const user = getAuthenticatedUser();
    const client = getSupabaseClient();

    // 1. Resolve Admin Policy and User Opt-In
    const adminAllowed = isFocusAllowedByAdmin();
    if (!adminAllowed) {
      isEnabled = false;
      if (window.CCTV_FOCUS_AUDIO?.isPlaying?.()) {
        window.CCTV_FOCUS_AUDIO.pause();
      }
      isWindowVisible = false;
      notify();
      return;
    }

    // Resolve User Opt-In preference (User-specific)
    if (user) {
      try {
        const userOpt = localStorage.getItem(`cctv_focus_enabled_${user.id}`);
        isEnabled = userOpt === "true";
      } catch (_) {
        isEnabled = false;
      }
    } else {
      // In preview mode only: allow URL parameter
      if (!isProductionMode()) {
        const urlParams = new URLSearchParams(window.location.search);
        isEnabled = urlParams.get("focus") === "1" || urlParams.get("focus") === "true";
      } else {
        isEnabled = false;
      }
    }

    // 2. Fetch Authoritative Remote State
    if (user && client) {
      try {
        syncStatus = "saving";
        const { data, error } = await client.rpc("get_cctv_user_focus_state");

        if (!error && data) {
          // Hydrate from backend
          if (Array.isArray(data.queue)) {
            upcomingQueue = data.queue.slice(0, QUEUE_MAX);
            playNextQueue = [];
          }
          if (data.playback && typeof data.playback === "object") {
            nowPlaying = data.playback.nowPlaying || null;
            mode = data.playback.mode === "full" ? "full" : "discreet";
            lyricsMode = data.playback.lyricsMode === "compact" ? "compact" : "full";
            autoplayEnabled = typeof data.playback.autoplayEnabled === "boolean" ? data.playback.autoplayEnabled : true;
            if (typeof data.playback.volume === "number") {
              window.CCTV_FOCUS_AUDIO?.setVolume?.(data.playback.volume);
            }
            if (typeof data.playback.isMuted === "boolean") {
              window.CCTV_FOCUS_AUDIO?.setMuted?.(data.playback.isMuted);
            }
          }
          if (data.preferences && typeof data.preferences === "object") {
            if (typeof data.preferences.isEnabled === "boolean") {
              isEnabled = data.preferences.isEnabled;
              try {
                localStorage.setItem(`cctv_focus_enabled_${user.id}`, String(isEnabled));
              } catch (_) {}
            }
          }
          if (Array.isArray(data.history)) {
            history = data.history.slice(0, HISTORY_MAX);
          }
          if (data.custom_lyrics && typeof data.custom_lyrics === "object") {
            customLyricsMap = data.custom_lyrics;
          }

          syncStatus = "synced";
          isInitialLoadDone = true;
          notify();

          // Clean legacy local storage if present
          try {
            localStorage.removeItem(`cctv_focus_user_${user.id}`);
          } catch (_) {}
          return;
        } else if (!data) {
          // No remote state on Supabase yet: check for one-time safe migration
          const migrated = await migrateLegacyLocalStateIfPresent(user.id);
          if (migrated) {
            upcomingQueue = migrated.queue;
            nowPlaying = migrated.playback.nowPlaying;
            history = migrated.history;
            mode = migrated.playback.mode;
            lyricsMode = migrated.playback.lyricsMode;
            autoplayEnabled = migrated.playback.autoplayEnabled;
            syncStatus = "synced";
            isInitialLoadDone = true;
            notify();
            return;
          }
        }
      } catch (err) {
        console.warn("[Focus State] Could not load state from Supabase:", err);
        syncStatus = "offline";
      }
    } else if (isMockEnvironment() && user) {
      // Mock / Offline Development Sandbox: load from explicitly isolated mock storage
      try {
        const raw = localStorage.getItem(`cctv_focus_mock_${user.id}`);
        if (raw) {
          const data = JSON.parse(raw);
          if (Array.isArray(data.queue)) upcomingQueue = data.queue.slice(0, QUEUE_MAX);
          if (data.playback) {
            nowPlaying = data.playback.nowPlaying || null;
            mode = data.playback.mode || "discreet";
            lyricsMode = data.playback.lyricsMode || "full";
          }
          if (Array.isArray(data.history)) history = data.history.slice(0, HISTORY_MAX);
          if (data.custom_lyrics) customLyricsMap = data.custom_lyrics;
        }
      } catch (_) {}
      syncStatus = "synced";
      isInitialLoadDone = true;
      notify();
      return;
    }

    // Default clean state if no remote state
    syncStatus = "synced";
    isInitialLoadDone = true;
    notify();
  }

  function getState() {
    return {
      isEnabled,
      isWindowVisible,
      nowPlaying,
      playNextQueue: [...playNextQueue],
      upcomingQueue: [...upcomingQueue],
      history: [...history],
      mode,
      activeTab,
      lyricsMode,
      autoplayEnabled,
      syncStatus,
      windowRectDiscreet: { ...windowRectDiscreet },
      windowRectFull: { ...windowRectFull }
    };
  }

  // Audio Engine Event Hook: advance queue when track finishes
  function bindAudioEvents() {
    window.CCTV_FOCUS_AUDIO?.addListener(async (state) => {
      if (state.type === "ended") {
        await advanceNextTrack();
      } else if (state.type === "error" && state.error && nowPlaying) {
        // Quietly advance on unplayable stream
        console.warn("Focus track failed, advancing to next:", nowPlaying.title);
        setTimeout(() => advanceNextTrack(), 500);
      }
    });

    // Cross-tab: pause local audio when another tab claims playback
    window.CCTV_FOCUS_COORDINATION?.setPlaybackClaimedHandler(() => {
      window.CCTV_FOCUS_AUDIO?.pause?.();
      notify();
    });

    // Auth: cleanup on logout and reload on user switch
    if (window.CCTV_AUTH && typeof window.CCTV_AUTH.onAuthChange === "function") {
      window.CCTV_AUTH.onAuthChange((authInfo) => {
        const u = authInfo?.user;
        if (!u) {
          resetOnLogout();
        } else {
          loadState();
        }
      });
    }

    // Direct sidebar logout button binding
    document.getElementById("btnSidebarLogout")?.addEventListener("click", () => {
      resetOnLogout();
    });
  }

  async function advanceNextTrack() {
    let nextTrack = null;

    if (playNextQueue.length > 0) {
      nextTrack = playNextQueue.shift();
    } else if (upcomingQueue.length > 0) {
      nextTrack = upcomingQueue.shift();
    } else if (autoplayEnabled && nowPlaying && window.CCTV_FOCUS_PROVIDER) {
      try {
        const related = await window.CCTV_FOCUS_PROVIDER.getRelatedTracks(nowPlaying, 5);
        if (related && related.length > 0) {
          nextTrack = related[0];
          // Queue remaining related tracks into upcoming
          if (related.length > 1) {
            upcomingQueue.push(...related.slice(1));
          }
        }
      } catch (err) {
        console.warn("Autoplay fetch failed:", err);
      }
    }

    if (nextTrack) {
      await playTrack(nextTrack);
    } else {
      window.CCTV_FOCUS_AUDIO?.stop?.();
      nowPlaying = null;
      notify();
      scheduleSave();
    }
  }

  async function playTrack(track) {
    if (!track) return false;

    // Push to history (prevent consecutive duplicates)
    if (history.length === 0 || history[0].id !== track.id) {
      history.unshift({ ...track, playedAt: Date.now() });
      if (history.length > HISTORY_MAX) {
        history.length = HISTORY_MAX; // strict 100-track cap
      }
    }

    nowPlaying = track;
    window.CCTV_FOCUS_COORDINATION?.claimPlayback?.(track);
    const success = await window.CCTV_FOCUS_AUDIO?.loadTrack?.(track, true);
    notify();
    scheduleSave();
    return success;
  }

  function resetOnLogout() {
    window.CCTV_FOCUS_AUDIO?.destroy?.();
    nowPlaying = null;
    playNextQueue = [];
    upcomingQueue = [];
    history = [];
    customLyricsMap = {};
    isWindowVisible = false;
    isEnabled = false;
    syncStatus = "synced";
    notify();
  }

  // Initialize on load
  loadState();
  setTimeout(bindAudioEvents, 100);

  return {
    addListener(fn) {
      if (typeof fn === "function" && !listeners.includes(fn)) {
        listeners.push(fn);
      }
    },

    removeListener(fn) {
      listeners = listeners.filter(l => l !== fn);
    },

    getState,

    setEnabled(enabled) {
      if (!isFocusAllowedByAdmin()) {
        console.warn("[Focus State] Focus is disabled by administrative policy.");
        isEnabled = false;
        notify();
        return;
      }

      isEnabled = !!enabled;
      const user = getAuthenticatedUser();
      if (user) {
        try {
          localStorage.setItem(`cctv_focus_enabled_${user.id}`, String(isEnabled));
        } catch (_) {}
      }

      if (!isEnabled) {
        window.CCTV_FOCUS_AUDIO?.pause?.();
        isWindowVisible = false;
      }
      notify();
      scheduleSave();
    },

    toggleWindow(visible) {
      isWindowVisible = typeof visible === "boolean" ? visible : !isWindowVisible;
      notify();
    },

    setMode(newMode) {
      if (newMode === "full" || newMode === "discreet") {
        const wasDiscreet = mode === "discreet";
        mode = newMode;
        if (wasDiscreet && newMode === "full") {
          activeTab = "lyrics";
        }
        notify();
        scheduleSave();
      }
    },

    setActiveTab(tab) {
      if (["lyrics", "search", "queue"].includes(tab)) {
        activeTab = tab;
        saveNonSensitiveUILayout();
        notify();
      }
    },

    setLyricsMode(m) {
      lyricsMode = m === "compact" ? "compact" : "full";
      notify();
      scheduleSave();
    },

    setAutoplayEnabled(enabled) {
      autoplayEnabled = !!enabled;
      notify();
      scheduleSave();
    },

    updateWindowRect(m, rect) {
      if (m === "discreet") {
        windowRectDiscreet = { ...windowRectDiscreet, ...rect };
      } else {
        windowRectFull = { ...windowRectFull, ...rect };
      }
      saveNonSensitiveUILayout();
    },

    playTrack,

    playNext(track) {
      if (!track) return;
      playNextQueue.unshift(track);
      notify();
      scheduleSave();
    },

    addToQueue(track) {
      if (!track) return;
      upcomingQueue.push(track);
      notify();
      scheduleSave();
    },

    removeFromQueue(index, queueType = "upcoming") {
      if (queueType === "playNext") {
        playNextQueue.splice(index, 1);
      } else {
        upcomingQueue.splice(index, 1);
      }
      notify();
      scheduleSave();
    },

    reorderQueue(fromIndex, toIndex, queueType = "upcoming") {
      const arr = queueType === "playNext" ? playNextQueue : upcomingQueue;
      if (fromIndex < 0 || fromIndex >= arr.length || toIndex < 0 || toIndex >= arr.length) return;
      const [item] = arr.splice(fromIndex, 1);
      arr.splice(toIndex, 0, item);
      notify();
      scheduleSave();
    },

    clearQueue() {
      playNextQueue = [];
      upcomingQueue = [];
      notify();
      scheduleSave();
    },

    clearHistory() {
      history = [];
      notify();
      scheduleSave();
    },

    skipNext() {
      return advanceNextTrack();
    },

    async skipPrevious() {
      const ct = window.CCTV_FOCUS_AUDIO?.getCurrentTime?.() || 0;
      if (ct > 3.0) {
        window.CCTV_FOCUS_AUDIO?.seek?.(0);
        return;
      }

      if (history.length > 1) {
        const prev = history[1];
        history.splice(0, 1);
        await playTrack(prev);
      } else {
        window.CCTV_FOCUS_AUDIO?.seek?.(0);
      }
    },

    // Custom Lyrics interface for focus-lyrics-service
    getCustomLyricsForTrack(trackId) {
      return customLyricsMap[trackId] || null;
    },

    setCustomLyricsForTrack(trackId, payload) {
      if (!trackId) return;
      if (payload) {
        customLyricsMap[trackId] = {
          text: payload.text || "",
          timeOffset: Number(payload.timeOffset) || 0,
          updatedAt: Date.now()
        };
      } else {
        delete customLyricsMap[trackId];
      }
      scheduleSave();
    },

    resetOnLogout,
    saveState: performBackendSave,
    loadState
  };
})();
