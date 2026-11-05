/**
 * CCTV OPS V2 - Focus Cross-Tab Coordination Service
 * 
 * Ensures only a single browser tab actively plays audio at any time.
 * Uses BroadcastChannel with fallback to localStorage storage events.
 */

window.CCTV_FOCUS_COORDINATION = (function () {
  "use strict";

  const CHANNEL_NAME = "cctv_focus_playback_coordination";
  const tabId = "tab_" + Math.random().toString(36).slice(2, 9) + "_" + Date.now();
  let channel = null;
  let onRemotePlaybackClaimed = null;

  function init() {
    if (typeof BroadcastChannel !== "undefined") {
      try {
        channel = new BroadcastChannel(CHANNEL_NAME);
        channel.onmessage = (event) => handleMessage(event.data);
      } catch (_) {
        channel = null;
      }
    }

    // Fallback: storage event listener for cross-tab communication
    window.addEventListener("storage", (e) => {
      if (e.key === CHANNEL_NAME && e.newValue) {
        try {
          const data = JSON.parse(e.newValue);
          handleMessage(data);
        } catch (_) {}
      }
    });
  }

  function handleMessage(msg) {
    if (!msg || msg.senderTabId === tabId) return;

    if (msg.action === "CLAIM_PLAYBACK") {
      // Another tab started playback: pause this tab's playback
      if (typeof onRemotePlaybackClaimed === "function") {
        onRemotePlaybackClaimed(msg);
      }
    }
  }

  function broadcast(action, payload = {}) {
    const msg = {
      action: action,
      senderTabId: tabId,
      timestamp: Date.now(),
      ...payload
    };

    if (channel) {
      try {
        channel.postMessage(msg);
      } catch (_) {}
    }

    try {
      localStorage.setItem(CHANNEL_NAME, JSON.stringify(msg));
    } catch (_) {}
  }

  init();

  return {
    getTabId() {
      return tabId;
    },

    setPlaybackClaimedHandler(fn) {
      onRemotePlaybackClaimed = fn;
    },

    /**
     * Notify other tabs that this tab is starting audio playback
     */
    claimPlayback(track) {
      broadcast("CLAIM_PLAYBACK", { trackId: track ? track.id : null });
    },

    notifyPause() {
      broadcast("PAUSE");
    }
  };
})();

