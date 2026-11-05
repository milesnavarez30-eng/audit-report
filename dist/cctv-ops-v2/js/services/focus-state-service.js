/**
 * CCTV OPS V2 - Focus State & Queue Service
 * 
 * Manages player queues, 100-track listening history, user persistence,
 * account isolation, and related-song autoplay.
 */

window.CCTV_FOCUS_STATE = (function () {
  "use strict";

  const HISTORY_MAX = 100;

  // In-memory state
  let nowPlaying = null;
  let playNextQueue = [];
  let upcomingQueue = [];
  let history = [];
  let listeners = [];

  let isEnabled = false;
  let isWindowVisible = false;
  let mode = "discreet"; // 'discreet' | 'full'
  let activeTab = "lyrics"; // 'lyrics' | 'search' | 'queue'
  let lyricsMode = "full"; // 'full' | 'compact'
  let autoplayEnabled = true;

  let windowRectDiscreet = { width: 230, height: 46, x: 80, y: 740 };
  let windowRectFull = { width: 360, height: 500, x: 80, y: 340 };

  function getUserId() {
    try {
      const user = window.CCTV_AUTH?.getUser?.();
      return user?.id || "guest";
    } catch (_) {
      return "guest";
    }
  }

  function getStorageKey() {
    return `cctv_focus_user_${getUserId()}`;
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

  function saveState() {
    try {
      const userId = getUserId();
      const payload = {
        nowPlaying: nowPlaying,
        playNextQueue: playNextQueue,
        upcomingQueue: upcomingQueue,
        history: history.slice(0, HISTORY_MAX),
        mode: mode,
        activeTab: activeTab,
        lyricsMode: lyricsMode,
        autoplayEnabled: autoplayEnabled,
        windowRectDiscreet: windowRectDiscreet,
        windowRectFull: windowRectFull,
        volume: window.CCTV_FOCUS_AUDIO?.getVolume?.() || 0.8,
        isMuted: window.CCTV_FOCUS_AUDIO?.isMuted?.() || false,
        updatedAt: Date.now()
      };
      localStorage.setItem(getStorageKey(), JSON.stringify(payload));
    } catch (err) {
      console.warn("Failed to persist Focus state:", err);
    }
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(getStorageKey());
      if (raw) {
        const data = JSON.parse(raw);
        nowPlaying = data.nowPlaying || null;
        playNextQueue = Array.isArray(data.playNextQueue) ? data.playNextQueue : [];
        upcomingQueue = Array.isArray(data.upcomingQueue) ? data.upcomingQueue : [];
        history = Array.isArray(data.history) ? data.history.slice(0, HISTORY_MAX) : [];
        mode = data.mode === "full" ? "full" : "discreet";
        activeTab = data.activeTab || "lyrics";
        lyricsMode = data.lyricsMode || "full";
        autoplayEnabled = typeof data.autoplayEnabled === "boolean" ? data.autoplayEnabled : true;
        if (data.windowRectDiscreet) windowRectDiscreet = data.windowRectDiscreet;
        if (data.windowRectFull) windowRectFull = data.windowRectFull;

        if (typeof data.volume === "number") {
          window.CCTV_FOCUS_AUDIO?.setVolume?.(data.volume);
        }
        if (typeof data.isMuted === "boolean") {
          window.CCTV_FOCUS_AUDIO?.setMuted?.(data.isMuted);
        }
      }
    } catch (err) {
      console.warn("Failed to load Focus state:", err);
    }

    // Check global opt-in flag
    try {
      const opt = localStorage.getItem("cctv_focus_enabled");
      const urlParams = new URLSearchParams(window.location.search);
      isEnabled = opt === "true" || urlParams.get("focus") === "1";
    } catch (_) {
      isEnabled = false;
    }
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
          notify();
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
      saveState();
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
    saveState();
    return success;
  }

  function resetOnLogout() {
    window.CCTV_FOCUS_AUDIO?.destroy?.();
    nowPlaying = null;
    playNextQueue = [];
    upcomingQueue = [];
    history = [];
    isWindowVisible = false;
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
      isEnabled = !!enabled;
      try {
        localStorage.setItem("cctv_focus_enabled", String(isEnabled));
      } catch (_) {}
      if (!isEnabled) {
        window.CCTV_FOCUS_AUDIO?.pause?.();
        isWindowVisible = false;
      }
      notify();
    },

    toggleWindow(visible) {
      isWindowVisible = typeof visible === "boolean" ? visible : !isWindowVisible;
      notify();
    },

    setMode(newMode) {
      if (newMode === "full" || newMode === "discreet") {
        const wasDiscreet = mode === "discreet";
        mode = newMode;
        // Switching deliberately from Discreet to Full opens the Lyrics tab
        if (wasDiscreet && newMode === "full") {
          activeTab = "lyrics";
        }
        notify();
        saveState();
      }
    },

    setActiveTab(tab) {
      if (["lyrics", "search", "queue"].includes(tab)) {
        activeTab = tab;
        notify();
        saveState();
      }
    },

    setLyricsMode(m) {
      lyricsMode = m === "compact" ? "compact" : "full";
      notify();
      saveState();
    },

    setAutoplayEnabled(enabled) {
      autoplayEnabled = !!enabled;
      notify();
      saveState();
    },

    updateWindowRect(m, rect) {
      if (m === "discreet") {
        windowRectDiscreet = { ...windowRectDiscreet, ...rect };
      } else {
        windowRectFull = { ...windowRectFull, ...rect };
      }
      saveState();
    },

    playTrack,

    playNext(track) {
      if (!track) return;
      playNextQueue.unshift(track);
      notify();
      saveState();
    },

    addToQueue(track) {
      if (!track) return;
      upcomingQueue.push(track);
      notify();
      saveState();
    },

    removeFromQueue(index, queueType = "upcoming") {
      if (queueType === "playNext") {
        playNextQueue.splice(index, 1);
      } else {
        upcomingQueue.splice(index, 1);
      }
      notify();
      saveState();
    },

    reorderQueue(fromIndex, toIndex, queueType = "upcoming") {
      const arr = queueType === "playNext" ? playNextQueue : upcomingQueue;
      if (fromIndex < 0 || fromIndex >= arr.length || toIndex < 0 || toIndex >= arr.length) return;
      const [item] = arr.splice(fromIndex, 1);
      arr.splice(toIndex, 0, item);
      notify();
      saveState();
    },

    clearQueue() {
      playNextQueue = [];
      upcomingQueue = [];
      notify();
      saveState();
    },

    clearHistory() {
      history = [];
      notify();
      saveState();
    },

    skipNext() {
      return advanceNextTrack();
    },

    async skipPrevious() {
      const ct = window.CCTV_FOCUS_AUDIO?.getCurrentTime?.() || 0;
      // If song played > 3 seconds, restart current track
      if (ct > 3.0) {
        window.CCTV_FOCUS_AUDIO?.seek?.(0);
        return;
      }

      // If we have history, play previous song
      if (history.length > 1) {
        // history[0] is current, history[1] is previous
        const prev = history[1];
        history.splice(0, 1); // remove current from top
        await playTrack(prev);
      } else {
        window.CCTV_FOCUS_AUDIO?.seek?.(0);
      }
    },

    resetOnLogout,
    saveState,
    loadState
  };
})();

