/**
 * CCTV OPS V2 - Focus Audio Engine
 * 
 * Manages audio streaming, seeking, volume ramps, track transitions,
 * and playback state broadcasting.
 */

window.CCTV_FOCUS_AUDIO = (function () {
  "use strict";

  let audio = null;
  let currentTrack = null;
  let listeners = [];
  let userVolume = 0.8;
  let isMuted = false;
  let fadeInterval = null;
  let isTransitioning = false;

  function initAudio() {
    if (audio) return audio;
    audio = new Audio();
    audio.preload = "auto";

    audio.addEventListener("loadstart", () => notify("loading"));
    audio.addEventListener("loadedmetadata", () => notify("loadedmetadata"));
    audio.addEventListener("canplay", () => notify("canplay"));
    audio.addEventListener("playing", () => notify("playing"));
    audio.addEventListener("pause", () => {
      if (!isTransitioning) notify("paused");
    });
    audio.addEventListener("timeupdate", () => notify("timeupdate"));
    audio.addEventListener("ended", () => notify("ended"));
    audio.addEventListener("error", (e) => {
      console.warn("Focus audio error:", audio.error);
      notify("error", { error: audio.error ? (audio.error.message || "Failed to load stream") : "Audio error" });
    });

    return audio;
  }

  function notify(eventType, extra = {}) {
    const state = {
      type: eventType,
      track: currentTrack,
      currentTime: audio ? audio.currentTime : 0,
      duration: (audio && !isNaN(audio.duration)) ? audio.duration : (currentTrack ? currentTrack.duration : 0),
      volume: userVolume,
      isMuted: isMuted,
      isPlaying: audio ? (!audio.paused && !audio.ended && audio.readyState > 2) : false,
      readyState: audio ? audio.readyState : 0,
      ...extra
    };

    listeners.forEach(fn => {
      try {
        fn(state);
      } catch (err) {
        console.error("Focus audio listener error:", err);
      }
    });
  }

  // Smooth volume fading (avoids pop/click artifacts)
  function fadeVolume(targetVol, durationMs = 180) {
    return new Promise(resolve => {
      if (!audio) return resolve();
      if (fadeInterval) clearInterval(fadeInterval);

      const startVol = audio.volume;
      const diff = targetVol - startVol;
      if (Math.abs(diff) < 0.02) {
        audio.volume = targetVol;
        return resolve();
      }

      const steps = 10;
      const stepTime = durationMs / steps;
      let currentStep = 0;

      fadeInterval = setInterval(() => {
        currentStep++;
        const progress = currentStep / steps;
        audio.volume = Math.max(0, Math.min(1, startVol + diff * progress));
        if (currentStep >= steps) {
          clearInterval(fadeInterval);
          fadeInterval = null;
          audio.volume = targetVol;
          resolve();
        }
      }, stepTime);
    });
  }

  return {
    addListener(fn) {
      if (typeof fn === "function" && !listeners.includes(fn)) {
        listeners.push(fn);
      }
    },

    removeListener(fn) {
      listeners = listeners.filter(l => l !== fn);
    },

    getCurrentTrack() {
      return currentTrack;
    },

    getCurrentTime() {
      return audio ? audio.currentTime : 0;
    },

    getDuration() {
      return (audio && !isNaN(audio.duration) && audio.duration > 0)
        ? audio.duration
        : (currentTrack ? currentTrack.duration : 0);
    },

    isPlaying() {
      return !!(audio && !audio.paused && !audio.ended && audio.currentTime > 0);
    },

    getVolume() {
      return userVolume;
    },

    isMuted() {
      return isMuted;
    },

    getState() {
      return {
        track: currentTrack,
        currentTime: this.getCurrentTime(),
        duration: this.getDuration(),
        isPlaying: this.isPlaying(),
        volume: userVolume,
        isMuted: isMuted
      };
    },

    /**
     * Load a new track and optionally start playing with a smooth fade in
     */
    async loadTrack(track, autoPlay = true, startPosition = 0) {
      if (!track || !track.streamUrl) {
        console.warn("Invalid track passed to loadTrack", track);
        return false;
      }

      const el = initAudio();
      isTransitioning = true;

      // If already playing another song, fade it out first
      if (!el.paused && el.currentTime > 0) {
        await fadeVolume(0, 150);
      }

      currentTrack = track;
      el.src = track.streamUrl;
      el.volume = isMuted ? 0 : userVolume;

      if (startPosition > 0) {
        try {
          el.currentTime = startPosition;
        } catch (_) {}
      }

      notify("trackchange", { track });

      if (autoPlay) {
        try {
          el.volume = 0;
          await el.play();
          isTransitioning = false;
          await fadeVolume(isMuted ? 0 : userVolume, 180);
          return true;
        } catch (err) {
          isTransitioning = false;
          console.warn("Autoplay was prevented or stream failed:", err);
          notify("error", { error: "Playback prevented: click play to start." });
          return false;
        }
      } else {
        isTransitioning = false;
        el.volume = isMuted ? 0 : userVolume;
        return true;
      }
    },

    async play() {
      const el = initAudio();
      if (!currentTrack) return false;

      try {
        el.volume = 0;
        await el.play();
        await fadeVolume(isMuted ? 0 : userVolume, 180);
        return true;
      } catch (err) {
        console.warn("Play error:", err);
        notify("error", { error: "Click play to listen." });
        return false;
      }
    },

    async pause() {
      if (!audio || audio.paused) return;
      await fadeVolume(0, 150);
      audio.pause();
      audio.volume = isMuted ? 0 : userVolume;
      notify("paused");
    },

    async togglePlay() {
      if (this.isPlaying()) {
        await this.pause();
      } else {
        await this.play();
      }
    },

    seek(seconds) {
      if (!audio) return;
      const dur = this.getDuration();
      const clamped = Math.max(0, Math.min(dur || 999999, seconds));
      try {
        audio.currentTime = clamped;
        notify("timeupdate");
      } catch (err) {
        console.warn("Seek error:", err);
      }
    },

    setVolume(vol) {
      userVolume = Math.max(0, Math.min(1, vol));
      if (audio && !isMuted) {
        audio.volume = userVolume;
      }
      notify("volumechange", { volume: userVolume, isMuted });
    },

    setMuted(muted) {
      isMuted = !!muted;
      if (audio) {
        audio.volume = isMuted ? 0 : userVolume;
      }
      notify("volumechange", { volume: userVolume, isMuted });
    },

    toggleMute() {
      this.setMuted(!isMuted);
    },

    stop() {
      if (audio) {
        audio.pause();
        audio.currentTime = 0;
        audio.src = "";
      }
      currentTrack = null;
      notify("idle");
    },

    destroy() {
      this.stop();
      listeners = [];
      audio = null;
    }
  };
})();

