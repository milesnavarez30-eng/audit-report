/**
 * CCTV OPS V2 - Focus Lyrics Service
 * 
 * Synchronized LRC parser, LRCLIB API integration,
 * active line timing, and private per-account custom lyrics storage.
 */

window.CCTV_FOCUS_LYRICS = (function () {
  "use strict";

  const LRCLIB_BASE = "https://lrclib.net/api";
  const memoryCache = new Map();

  function getUserId() {
    try {
      const user = window.CCTV_AUTH?.getUser?.();
      return user?.id || "guest";
    } catch (_) {
      return "guest";
    }
  }

  function getStorageKey(trackId) {
    return `cctv_focus_lyrics_${getUserId()}_${trackId}`;
  }

  // Parse LRC formatted string into sorted array of timestamped lines
  function parseLRC(lrcText, timeOffsetSeconds = 0) {
    if (!lrcText || typeof lrcText !== "string") return [];

    const lines = lrcText.split(/\r?\n/);
    const parsed = [];
    const timeRegex = /\[(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?\]/g;

    for (const rawLine of lines) {
      const text = rawLine.replace(timeRegex, "").trim();
      let match;
      timeRegex.lastIndex = 0;

      while ((match = timeRegex.exec(rawLine)) !== null) {
        const min = parseInt(match[1], 10);
        const sec = parseInt(match[2], 10);
        const frac = match[3] ? parseFloat(`0.${match[3]}`) : 0;
        let totalSeconds = min * 60 + sec + frac + timeOffsetSeconds;
        totalSeconds = Math.max(0, totalSeconds);

        parsed.push({
          time: totalSeconds,
          text: text
        });
      }
    }

    parsed.sort((a, b) => a.time - b.time);
    return parsed;
  }

  // Format plain lines into default non-synced entries
  function parsePlain(plainText) {
    if (!plainText || typeof plainText !== "string") return [];
    return plainText.split(/\r?\n/)
      .map(line => line.trim())
      .filter(Boolean)
      .map((text, i) => ({ time: -1, text: text, index: i }));
  }

  return {
    parseLRC,
    parsePlain,

    /**
     * Find index of active line for current playback time
     */
    getActiveIndex(parsedLines, currentTime) {
      if (!parsedLines || parsedLines.length === 0) return -1;
      
      // If lines have no timestamps (plain)
      if (parsedLines[0].time === -1) return -1;

      let activeIndex = -1;
      for (let i = 0; i < parsedLines.length; i++) {
        if (currentTime >= parsedLines[i].time) {
          activeIndex = i;
        } else {
          break;
        }
      }
      return activeIndex;
    },

    /**
     * Fetch synchronized lyrics for a track from cache, custom storage, or LRCLIB
     */
    async getLyrics(track) {
      if (!track || !track.title) return null;

      // 1. Check user custom lyrics first
      const custom = this.getCustomLyrics(track.id);
      if (custom && custom.text) {
        const isLrc = /\[\d{1,2}:\d{2}/.test(custom.text);
        return {
          isCustom: true,
          isSynced: isLrc,
          timeOffset: custom.timeOffset || 0,
          raw: custom.text,
          lines: isLrc ? parseLRC(custom.text, custom.timeOffset || 0) : parsePlain(custom.text)
        };
      }

      // 2. Check memory cache
      if (memoryCache.has(track.id)) {
        return memoryCache.get(track.id);
      }

      // 3. Query LRCLIB
      try {
        // Clean track title (strip "(feat. ...)", "[Lofi Beat]", etc. for higher match rate)
        const cleanTitle = track.title
          .replace(/\s*[\(\[][^\)\]]*(?:feat|ft|mix|remix|edit|lofi|beat)[^\)\]]*[\)\]]/gi, "")
          .trim();

        const cleanArtist = track.artist
          .replace(/@/g, "")
          .trim();

        const params = new URLSearchParams({
          track_name: cleanTitle || track.title,
          artist_name: cleanArtist || track.artist
        });

        if (track.duration > 0) {
          params.set("duration", String(Math.round(track.duration)));
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 4000);

        const res = await fetch(`${LRCLIB_BASE}/get?${params.toString()}`, {
          headers: { "User-Agent": "CCTV_OPS_Focus/2.0 (Internal Ops)" },
          signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (res.ok) {
          const data = await res.json();
          const hasSynced = !!(data.syncedLyrics && data.syncedLyrics.trim());
          const hasPlain = !!(data.plainLyrics && data.plainLyrics.trim());

          if (hasSynced || hasPlain) {
            const result = {
              isCustom: false,
              isSynced: hasSynced,
              timeOffset: 0,
              raw: hasSynced ? data.syncedLyrics : data.plainLyrics,
              lines: hasSynced ? parseLRC(data.syncedLyrics) : parsePlain(data.plainLyrics)
            };
            memoryCache.set(track.id, result);
            return result;
          }
        }
      } catch (err) {
        // Quietly handle network / not found
      }

      const empty = { isCustom: false, isSynced: false, timeOffset: 0, raw: "", lines: [] };
      memoryCache.set(track.id, empty);
      return empty;
    },

    /**
     * Get user custom saved lyrics for a track
     */
    getCustomLyrics(trackId) {
      if (!trackId) return null;
      // 1. Check in-memory/backend user state first
      const mem = window.CCTV_FOCUS_STATE?.getCustomLyricsForTrack?.(trackId);
      if (mem) return mem;

      // 2. Check legacy local storage only if exact user key exists
      try {
        const raw = localStorage.getItem(getStorageKey(trackId));
        return raw ? JSON.parse(raw) : null;
      } catch (_) {
        return null;
      }
    },

    /**
     * Save user custom lyrics privately per account
     */
    saveCustomLyrics(trackId, text, timeOffset = 0) {
      if (!trackId) return;
      const payload = {
        text: text ? text.trim() : "",
        timeOffset: Number(timeOffset) || 0,
        updatedAt: Date.now()
      };

      // Delegate to Focus State Service for secure Supabase RLS persistence
      if (window.CCTV_FOCUS_STATE?.setCustomLyricsForTrack) {
        window.CCTV_FOCUS_STATE.setCustomLyricsForTrack(trackId, payload);
      }

      // Clear memory cache so next retrieval uses custom lyrics
      memoryCache.delete(trackId);
    },

    /**
     * Clear custom lyrics for a track
     */
    deleteCustomLyrics(trackId) {
      if (!trackId) return;
      if (window.CCTV_FOCUS_STATE?.setCustomLyricsForTrack) {
        window.CCTV_FOCUS_STATE.setCustomLyricsForTrack(trackId, null);
      }
      try {
        localStorage.removeItem(getStorageKey(trackId));
      } catch (_) {}
      memoryCache.delete(trackId);
    }
  };
})();

