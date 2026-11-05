/**
 * CCTV OPS V2 - Focus Music Provider Service
 * 
 * Legitimate audio discovery and streaming adapter using the Audius REST API.
 * Free, authorized, browser-compatible audio-only catalog.
 * No user credentials or API keys required.
 */

window.CCTV_FOCUS_PROVIDER = (function () {
  "use strict";

  const APP_NAME = "CCTV_OPS_FOCUS";
  const PRIMARY_HOST = "https://api.audius.co";
  
  // Backup discovery nodes for high resilience (all matching *.audius.co CSP)
  const FALLBACK_HOSTS = [
    "https://discoveryprovider.audius.co",
    "https://discoveryprovider2.audius.co",
    "https://discoveryprovider3.audius.co"
  ];

  let currentHost = PRIMARY_HOST;

  // Format seconds to mm:ss
  function formatDuration(sec) {
    if (!sec || isNaN(sec) || sec < 0) return "0:00";
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  }

  // Normalize track object to standard Focus schema
  function normalizeTrack(raw) {
    if (!raw) return null;
    const id = raw.id || raw.track_id;
    if (!id) return null;

    const artist = (raw.user && (raw.user.name || raw.user.handle)) ? raw.user.name : "Independent Artist";
    const title = raw.title || "Untitled Track";
    const duration = typeof raw.duration === "number" ? raw.duration : 0;
    const genre = raw.genre || "Ambient";
    const tags = raw.tags ? String(raw.tags).toLowerCase().split(",").map(s => s.trim()).filter(Boolean) : [];

    // Artwork resolution fallback
    let artwork = null;
    if (raw.artwork) {
      artwork = raw.artwork["480x480"] || raw.artwork["150x150"] || raw.artwork["1000x1000"] || null;
    }

    return {
      id: String(id),
      trackId: raw.track_id || id,
      title: title,
      artist: artist,
      duration: duration,
      durationFormatted: formatDuration(duration),
      genre: genre,
      tags: tags,
      artwork: artwork,
      permalink: raw.permalink ? `https://audius.co${raw.permalink}` : null,
      streamUrl: `${currentHost}/v1/tracks/${encodeURIComponent(id)}/stream?app_name=${APP_NAME}`,
      isStreamable: raw.is_streamable !== false && (!raw.user || !raw.user.is_deactivated)
    };
  }

  // Fetch with fallback host failover
  async function apiFetch(endpoint) {
    const hosts = [currentHost, ...FALLBACK_HOSTS.filter(h => h !== currentHost)];
    let lastError = null;

    for (const host of hosts) {
      try {
        const sep = endpoint.includes("?") ? "&" : "?";
        const url = `${host}${endpoint}${sep}app_name=${APP_NAME}`;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 7000);

        const res = await fetch(url, { signal: controller.signal });
        clearTimeout(timeoutId);

        if (res.ok) {
          currentHost = host; // remember working host
          return await res.json();
        }
      } catch (err) {
        lastError = err;
      }
    }

    throw lastError || new Error("All discovery endpoints failed.");
  }

  return {
    capabilities: Object.freeze({
      canSearch: true,
      canStream: true,
      canSeek: true,
      canAutoplayRelated: true,
      providerName: "Audius Open Catalog"
    }),

    /**
     * Search tracks by title, artist or keyword
     */
    async searchTracks(query, genreFilter = "all") {
      if (!query || !query.trim()) {
        return this.getTrendingTracks(genreFilter);
      }

      let q = query.trim();
      if (genreFilter && genreFilter !== "all") {
        q += ` ${genreFilter}`;
      }

      const json = await apiFetch(`/v1/tracks/search?query=${encodeURIComponent(q)}`);
      const data = json.data || [];
      return data
        .map(normalizeTrack)
        .filter(t => t && t.isStreamable);
    },

    /**
     * Get curated trending focus & ambient tracks
     */
    async getTrendingTracks(genre = "all", limit = 25) {
      let endpoint = `/v1/tracks/trending?limit=${limit}`;
      if (genre && genre !== "all") {
        endpoint += `&genre=${encodeURIComponent(genre)}`;
      }

      try {
        const json = await apiFetch(endpoint);
        const data = json.data || [];
        return data
          .map(normalizeTrack)
          .filter(t => t && t.isStreamable);
      } catch (err) {
        // Fallback search if trending endpoint is busy
        return this.searchTracks(genre === "all" ? "lofi focus" : genre);
      }
    },

    /**
     * Get stream URL for track ID
     */
    getStreamUrl(trackId) {
      return `${currentHost}/v1/tracks/${encodeURIComponent(trackId)}/stream?app_name=${APP_NAME}`;
    },

    /**
     * Discover related tracks for autoplay
     */
    async getRelatedTracks(currentTrack, limit = 10) {
      if (!currentTrack) return [];
      
      // Try searching by genre or tag
      const searchTerm = (currentTrack.tags && currentTrack.tags.length > 0)
        ? currentTrack.tags[0]
        : (currentTrack.genre || "ambient");

      const tracks = await this.searchTracks(searchTerm);
      // Filter out the current track itself
      return tracks.filter(t => t.id !== currentTrack.id).slice(0, limit);
    },

    formatDuration
  };
})();

