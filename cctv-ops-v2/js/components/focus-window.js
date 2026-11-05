/**
 * CCTV OPS V2 - Focus Music Player Window Component
 * 
 * Floating, draggable, resizable utility window with Discreet & Full modes,
 * synchronized lyrics with click-to-seek, music search & discovery,
 * queue management, keyboard shortcuts, and MediaSession integration.
 */

window.CCTV_FOCUS_WINDOW = (function () {
  "use strict";

  let container = null;
  let isDragging = false;
  let isResizing = false;
  let dragOffset = { x: 0, y: 0 };
  let initialSize = { w: 0, h: 0 };
  let initialMouse = { x: 0, y: 0 };

  let currentParsedLyrics = [];
  let userIsScrollingLyrics = false;
  let scrollTimeout = null;
  let searchDebounce = null;
  let searchResults = [];

  function el(id) {
    return document.getElementById(id);
  }

  function formatTime(sec) {
    if (!sec || isNaN(sec) || sec < 0) return "0:00";
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  }

  function buildDOM() {
    if (document.getElementById("focusWindow")) return;

    const wrap = document.createElement("div");
    wrap.id = "focusWindow";
    wrap.className = "focus-window mode-discreet";
    wrap.style.display = "none";
    const initialY = Math.max(12, (window.innerHeight || 768) - 60);
    wrap.style.left = "80px";
    wrap.style.top = `${initialY}px`;

    wrap.innerHTML = `
      <!-- Window Header (Drag Handle) -->
      <div class="focus-header" id="focusHeader">
        <div class="focus-header-left">
          <span class="focus-live-pip" id="focusHeaderPip" style="display:none;"></span>
          <span class="focus-title" id="focusTitle">FOCUS</span>
          <span class="focus-sync-warn" id="focusSyncWarn" style="display:none; font-size:9px; font-weight:600; color:var(--accent-warning, #F59E0B); padding:1px 4px; border-radius:3px; background:rgba(245,158,11,0.15); letter-spacing:0.04em;" title="Cloud save unavailable — running in temporary memory">OFFLINE</span>
        </div>

        <!-- Discreet Mode Controls (Visible only in Discreet Mode) -->
        <div class="focus-discreet-controls" id="focusDiscreetControls">
          <button type="button" class="focus-ctrl-btn btn-play-pause" id="btnFocusDiscreetPlay" title="Play/Pause" aria-label="Play or Pause">
            <svg class="icon icon-sm" id="iconFocusDiscreetPlay" viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
          </button>
          <button type="button" class="focus-ctrl-btn" id="btnFocusDiscreetNext" title="Next Song" aria-label="Next Song">
            <svg class="icon icon-sm" viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><polygon points="5 4 15 12 5 20 5 4"></polygon><line x1="19" y1="5" x2="19" y2="19" stroke="currentColor" stroke-width="2"></line></svg>
          </button>
          <div class="focus-discreet-vol" title="Volume">
            <input type="range" class="focus-mini-slider" id="focusDiscreetVol" min="0" max="1" step="0.05" value="0.8" aria-label="Volume">
          </div>
        </div>

        <!-- Window Actions -->
        <div class="focus-header-actions">
          <button type="button" class="focus-header-btn" id="btnFocusToggleMode" title="Expand to Full Player" aria-label="Toggle Full Mode">
            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 3 21 3 21 9"></polyline><polyline points="9 21 3 21 3 15"></polyline><line x1="21" y1="3" x2="14" y2="10"></line><line x1="3" y1="21" x2="10" y2="14"></line></svg>
          </button>
          <button type="button" class="focus-header-btn" id="btnFocusMinimize" title="Minimize to Sidebar" aria-label="Minimize">
            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><line x1="5" y1="12" x2="19" y2="12"></line></svg>
          </button>
          <button type="button" class="focus-header-btn btn-close" id="btnFocusClose" title="Hide Focus" aria-label="Close">
            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>
      </div>

      <!-- Full Mode Container (Visible only in Full Mode) -->
      <div class="focus-full-container" id="focusFullContainer">
        <!-- Now Playing Track Banner -->
        <div class="focus-track-banner">
          <div class="focus-track-art" id="focusTrackArt">
            <svg class="focus-track-art-fallback" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polygon points="10 8 16 12 10 16 10 8"></polygon></svg>
          </div>
          <div class="focus-track-meta">
            <div class="focus-track-title" id="focusTrackTitle">Ready to play</div>
            <div class="focus-track-artist" id="focusTrackArtist">Select or search music</div>
          </div>
        </div>

        <!-- Scrubbable Progress Bar -->
        <div class="focus-progress-wrap">
          <div class="focus-progress-bar-container" id="focusProgressBar">
            <div class="focus-progress-fill" id="focusProgressFill">
              <span class="focus-progress-thumb"></span>
            </div>
          </div>
          <div class="focus-time-row">
            <span id="focusTimeCurrent">0:00</span>
            <span id="focusTimeTotal">0:00</span>
          </div>
        </div>

        <!-- Transport Controls Row -->
        <div class="focus-transport-row">
          <div class="focus-main-controls">
            <button type="button" class="focus-btn-round" id="btnFocusPrev" title="Previous Song" aria-label="Previous Track">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><polygon points="19 20 9 12 19 4 19 20"></polygon><line x1="5" y1="19" x2="5" y2="5" stroke="currentColor" stroke-width="2"></line></svg>
            </button>
            <button type="button" class="focus-btn-round btn-play-hero" id="btnFocusPlayHero" title="Play or Pause" aria-label="Play or Pause">
              <svg id="iconFocusPlayHero" viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
            </button>
            <button type="button" class="focus-btn-round" id="btnFocusNext" title="Next Song" aria-label="Next Track">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><polygon points="5 4 15 12 5 20 5 4"></polygon><line x1="19" y1="5" x2="19" y2="19" stroke="currentColor" stroke-width="2"></line></svg>
            </button>
          </div>

          <div class="focus-secondary-controls">
            <button type="button" class="focus-autoplay-pill active" id="btnFocusAutoplay" title="Autoplay related tracks when queue ends">Autoplay</button>
            <div class="focus-vol-control">
              <button type="button" class="focus-ctrl-btn" id="btnFocusMute" title="Mute/Unmute" aria-label="Mute or Unmute">
                <svg id="iconFocusVolume" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>
              </button>
              <input type="range" class="focus-vol-slider" id="focusFullVol" min="0" max="1" step="0.05" value="0.8" aria-label="Volume">
            </div>
          </div>
        </div>

        <!-- Navigation Tabs -->
        <nav class="focus-nav-tabs" role="tablist">
          <button type="button" class="focus-nav-tab active" id="tabFocusLyrics" role="tab" aria-selected="true">Lyrics</button>
          <button type="button" class="focus-nav-tab" id="tabFocusSearch" role="tab" aria-selected="false">Search</button>
          <button type="button" class="focus-nav-tab" id="tabFocusQueue" role="tab" aria-selected="false">Queue</button>
        </nav>

        <!-- Tab Content -->
        <div class="focus-tab-content">
          <!-- 1. Lyrics Pane -->
          <div class="focus-tab-pane active" id="paneFocusLyrics" role="tabpanel">
            <div class="focus-lyrics-header">
              <div class="focus-lyrics-controls">
                <button type="button" class="focus-pill-btn" id="btnToggleLyricMode" title="Toggle Full / Compact 3-Line view">Compact View</button>
                <button type="button" class="focus-pill-btn" id="btnEditCustomLyrics" title="Add or edit synchronized lyrics">Custom Lyrics</button>
              </div>
              <span id="focusLyricsStatus" style="font-size:9.5px; color:var(--text-muted);">Synced</span>
            </div>
            <div class="focus-lyrics-scroll-area" id="focusLyricsArea">
              <div class="focus-lyrics-empty">Select a track to view synchronized lyrics.</div>
            </div>
            <button type="button" class="focus-follow-live-btn" id="btnFocusFollowLive" style="display:none;">
              <svg viewBox="0 0 24 24" width="10" height="10" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
              Follow Live
            </button>
          </div>

          <!-- 2. Search Pane -->
          <div class="focus-tab-pane" id="paneFocusSearch" role="tabpanel">
            <div class="focus-search-header">
              <div class="focus-search-input-wrap">
                <svg class="focus-search-icon" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                <input type="text" class="focus-search-input" id="focusSearchInput" placeholder="Search focus music, artists, lofi, ambient..." autocomplete="off">
                <button type="button" class="focus-search-clear" id="btnFocusSearchClear" style="display:none;">&times;</button>
              </div>
              <div class="focus-filter-chips">
                <button type="button" class="focus-chip active" data-genre="all">All</button>
                <button type="button" class="focus-chip" data-genre="Ambient">Ambient</button>
                <button type="button" class="focus-chip" data-genre="Lo-Fi">Lo-Fi</button>
                <button type="button" class="focus-chip" data-genre="Electronic">Electronic</button>
                <button type="button" class="focus-chip" data-genre="Piano">Piano</button>
              </div>
            </div>
            <div class="focus-results-list" id="focusSearchResults">
              <div style="text-align:center; padding:20px; color:var(--text-muted);">Loading recommendations...</div>
            </div>
          </div>

          <!-- 3. Queue Pane -->
          <div class="focus-tab-pane" id="paneFocusQueue" role="tabpanel">
            <div class="focus-queue-header">
              <span class="focus-queue-title">Playing Queue</span>
              <button type="button" class="focus-pill-btn" id="btnFocusClearQueue" title="Clear all upcoming tracks">Clear Queue</button>
            </div>
            <div id="focusQueueNowPlayingContainer"></div>
            <div class="focus-queue-section-label" id="labelPlayNext" style="display:none;">Play Next (Priority)</div>
            <div id="focusQueuePlayNextContainer"></div>
            <div class="focus-queue-section-label" id="labelUpcoming">Upcoming Tracks</div>
            <div id="focusQueueUpcomingContainer"></div>
            <div class="focus-queue-section-label" style="margin-top:14px; display:flex; justify-content:space-between;">
              <span>Listening History</span>
              <button type="button" class="focus-pill-btn" id="btnFocusClearHistory" style="font-size:9px;">Clear History</button>
            </div>
            <div id="focusHistoryContainer"></div>
          </div>
        </div>
      </div>

      <!-- Resizing Grip (Bottom Right) -->
      <div class="focus-resize-handle" id="focusResizeHandle">
        <svg viewBox="0 0 24 24"><path d="M22 22L12 22L22 12Z" fill="currentColor"></path></svg>
      </div>
    `;

    document.body.appendChild(wrap);
    container = wrap;
  }

  function clampToViewport() {
    if (!container) return;
    if (window.innerWidth <= 768) {
      container.style.left = "";
      container.style.top = "";
      return;
    }
    const rect = container.getBoundingClientRect();
    const pad = 12;
    const vw = window.innerWidth || document.documentElement.clientWidth || 1024;
    const vh = window.innerHeight || document.documentElement.clientHeight || 768;

    const isDiscreet = container.classList.contains("mode-discreet");
    const w = rect.width || (isDiscreet ? 230 : 360);
    const h = rect.height || (isDiscreet ? 44 : 500);

    const maxLeft = Math.max(pad, vw - w - pad);
    const maxTop = Math.max(pad, vh - h - pad);

    let curLeft = parseFloat(container.style.left);
    let curTop = parseFloat(container.style.top);

    if (isNaN(curLeft)) curLeft = 80;
    if (isNaN(curTop) || curTop > maxTop) {
      curTop = isDiscreet ? Math.max(pad, vh - 60) : Math.max(pad, Math.min(vh - 520, 80));
    }

    const clampedLeft = Math.max(pad, Math.min(maxLeft, curLeft));
    const clampedTop = Math.max(pad, Math.min(maxTop, curTop));

    container.style.left = `${Math.round(clampedLeft)}px`;
    container.style.top = `${Math.round(clampedTop)}px`;
  }

  // Bind dragging and window resizing
  function bindWindowInteractions() {
    const header = el("focusHeader");
    const resizeHandle = el("focusResizeHandle");

    // Dragging
    header.addEventListener("mousedown", (e) => {
      // Don't drag on mobile viewports (<= 768px anchors as bottom sheet)
      if (window.innerWidth <= 768) return;
      // Don't drag if clicking buttons or sliders
      if (e.target.closest("button, input, a")) return;
      isDragging = true;
      container.classList.add("is-dragging");
      const rect = container.getBoundingClientRect();
      dragOffset.x = e.clientX - rect.left;
      dragOffset.y = e.clientY - rect.top;
      e.preventDefault();
    });

    // Resizing
    resizeHandle.addEventListener("mousedown", (e) => {
      // Don't resize on mobile viewports
      if (window.innerWidth <= 768) return;
      isResizing = true;
      initialMouse.x = e.clientX;
      initialMouse.y = e.clientY;
      const rect = container.getBoundingClientRect();
      initialSize.w = rect.width;
      initialSize.h = rect.height;
      e.preventDefault();
      e.stopPropagation();
    });

    window.addEventListener("mousemove", (e) => {
      if (window.innerWidth <= 768) return;
      if (isDragging) {
        let newX = e.clientX - dragOffset.x;
        let newY = e.clientY - dragOffset.y;

        // Clamp inside visible browser viewport
        const maxW = window.innerWidth - container.offsetWidth;
        const maxH = window.innerHeight - container.offsetHeight;
        newX = Math.max(0, Math.min(maxW, newX));
        newY = Math.max(0, Math.min(maxH, newY));

        container.style.left = `${newX}px`;
        container.style.top = `${newY}px`;
      } else if (isResizing) {
        const deltaX = e.clientX - initialMouse.x;
        const deltaY = e.clientY - initialMouse.y;
        const minW = container.classList.contains("mode-discreet") ? 210 : 320;
        const minH = container.classList.contains("mode-discreet") ? 44 : 380;
        const maxW = Math.min(700, window.innerWidth - 20);
        const maxH = Math.min(850, window.innerHeight - 20);

        const newW = Math.max(minW, Math.min(maxW, initialSize.w + deltaX));
        const newH = Math.max(minH, Math.min(maxH, initialSize.h + deltaY));

        container.style.width = `${newW}px`;
        container.style.height = `${newH}px`;
      }
    });

    window.addEventListener("mouseup", () => {
      if (isDragging || isResizing) {
        isDragging = false;
        isResizing = false;
        container.classList.remove("is-dragging");
        clampToViewport();
        const rect = container.getBoundingClientRect();
        const mode = container.classList.contains("mode-discreet") ? "discreet" : "full";
        window.CCTV_FOCUS_STATE?.updateWindowRect?.(mode, {
          x: Math.round(rect.left),
          y: Math.round(rect.top),
          width: Math.round(rect.width),
          height: Math.round(rect.height)
        });
      }
    });

    // Viewport resize guard: keep window strictly inside visible screen
    window.addEventListener("resize", () => {
      if (!container || container.style.display === "none") return;
      clampToViewport();
    });
  }

  // Bind controls, tabs, and UI events
  function bindUIEvents() {
    // Mode toggle
    el("btnFocusToggleMode")?.addEventListener("click", () => {
      const isDiscreet = container.classList.contains("mode-discreet");
      window.CCTV_FOCUS_STATE?.setMode?.(isDiscreet ? "full" : "discreet");
      setTimeout(clampToViewport, 20);
    });

    // Minimize & Close
    el("btnFocusMinimize")?.addEventListener("click", () => {
      window.CCTV_FOCUS_STATE?.toggleWindow?.(false);
    });

    el("btnFocusClose")?.addEventListener("click", () => {
      window.CCTV_FOCUS_STATE?.toggleWindow?.(false);
    });

    // Sidebar launcher click
    const handleLauncherClick = (e) => {
      e?.preventDefault?.();
      e?.stopPropagation?.();
      window.CCTV_FOCUS_STATE?.toggleWindow?.();
      setTimeout(clampToViewport, 10);
    };

    el("btnSidebarFocus")?.addEventListener("click", handleLauncherClick);

    // Play/Pause Hero & Discreet
    const togglePlayback = () => window.CCTV_FOCUS_AUDIO?.togglePlay?.();
    el("btnFocusDiscreetPlay")?.addEventListener("click", togglePlayback);
    el("btnFocusPlayHero")?.addEventListener("click", togglePlayback);

    // Next / Prev
    el("btnFocusDiscreetNext")?.addEventListener("click", () => window.CCTV_FOCUS_STATE?.skipNext?.());
    el("btnFocusNext")?.addEventListener("click", () => window.CCTV_FOCUS_STATE?.skipNext?.());
    el("btnFocusPrev")?.addEventListener("click", () => window.CCTV_FOCUS_STATE?.skipPrevious?.());

    // Volume sliders
    const handleVolChange = (v) => {
      const vol = parseFloat(v);
      window.CCTV_FOCUS_AUDIO?.setVolume?.(vol);
      if (el("focusDiscreetVol")) el("focusDiscreetVol").value = vol;
      if (el("focusFullVol")) el("focusFullVol").value = vol;
    };
    el("focusDiscreetVol")?.addEventListener("input", (e) => handleVolChange(e.target.value));
    el("focusFullVol")?.addEventListener("input", (e) => handleVolChange(e.target.value));

    // Mute toggle
    el("btnFocusMute")?.addEventListener("click", () => {
      window.CCTV_FOCUS_AUDIO?.toggleMute?.();
    });

    // Autoplay toggle pill
    el("btnFocusAutoplay")?.addEventListener("click", () => {
      const state = window.CCTV_FOCUS_STATE?.getState?.();
      window.CCTV_FOCUS_STATE?.setAutoplayEnabled?.(!state?.autoplayEnabled);
    });

    // Scrubbable Progress Bar
    const progressBar = el("focusProgressBar");
    progressBar?.addEventListener("click", (e) => {
      const rect = progressBar.getBoundingClientRect();
      const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      const dur = window.CCTV_FOCUS_AUDIO?.getDuration?.() || 0;
      if (dur > 0) {
        window.CCTV_FOCUS_AUDIO?.seek?.(dur * pos);
      }
    });

    // Nav tabs
    ["lyrics", "search", "queue"].forEach(tab => {
      const cap = tab.charAt(0).toUpperCase() + tab.slice(1);
      el(`tabFocus${cap}`)?.addEventListener("click", () => {
        window.CCTV_FOCUS_STATE?.setActiveTab?.(tab);
      });
    });

    // Lyric mode toggle (Full scrolling vs Compact)
    el("btnToggleLyricMode")?.addEventListener("click", () => {
      const state = window.CCTV_FOCUS_STATE?.getState?.();
      const nextMode = state?.lyricsMode === "compact" ? "full" : "compact";
      window.CCTV_FOCUS_STATE?.setLyricsMode?.(nextMode);
    });

    // Follow Live Lyrics button
    el("btnFocusFollowLive")?.addEventListener("click", () => {
      userIsScrollingLyrics = false;
      el("btnFocusFollowLive").style.display = "none";
      scrollLyricsToActive();
    });

    // Detect user manual scroll in lyrics area
    const lyricsArea = el("focusLyricsArea");
    lyricsArea?.addEventListener("scroll", () => {
      userIsScrollingLyrics = true;
      if (el("btnFocusFollowLive")) el("btnFocusFollowLive").style.display = "flex";
      // Follow Live button remains discoverable and active until user explicitly clicks it or a new track starts
    });

    // Custom Lyrics Editor
    el("btnEditCustomLyrics")?.addEventListener("click", () => {
      openCustomLyricsModal();
    });

    // Search Input with debounce
    const searchInput = el("focusSearchInput");
    const searchClear = el("btnFocusSearchClear");
    searchInput?.addEventListener("input", (e) => {
      const val = e.target.value.trim();
      searchClear.style.display = val ? "block" : "none";
      if (searchDebounce) clearTimeout(searchDebounce);
      searchDebounce = setTimeout(() => {
        performSearch(val);
      }, 350);
    });

    searchClear?.addEventListener("click", () => {
      searchInput.value = "";
      searchClear.style.display = "none";
      performSearch("");
    });

    // Search genre chips
    document.querySelectorAll(".focus-chip").forEach(chip => {
      chip.addEventListener("click", () => {
        document.querySelectorAll(".focus-chip").forEach(c => c.classList.remove("active"));
        chip.classList.add("active");
        const genre = chip.getAttribute("data-genre");
        performSearch(searchInput?.value.trim() || "", genre);
      });
    });

    // Queue buttons
    el("btnFocusClearQueue")?.addEventListener("click", () => {
      if (confirm("Clear all upcoming tracks from the queue?")) {
        window.CCTV_FOCUS_STATE?.clearQueue?.();
      }
    });

    el("btnFocusClearHistory")?.addEventListener("click", () => {
      if (confirm("Clear your listening history?")) {
        window.CCTV_FOCUS_STATE?.clearHistory?.();
      }
    });
  }

  // Keyboard shortcut listener with active input guard
  function bindKeyboardShortcuts() {
    window.addEventListener("keydown", (e) => {
      // CRITICAL GUARD: Never intercept shortcuts while user is typing in forms, textareas, EDR, or search fields
      const target = e.target;
      const activeEl = document.activeElement;
      const isInput = (el) => el && (
        (typeof el.matches === "function" && el.matches('input, textarea, [contenteditable="true"], select')) ||
        el.tagName === "INPUT" ||
        el.tagName === "TEXTAREA" ||
        el.tagName === "SELECT" ||
        el.isContentEditable ||
        (typeof el.closest === "function" && el.closest(".search-input, .form-input, .edr-input, .jp-input"))
      );
      if (isInput(target) || isInput(activeEl)) {
        return;
      }

      // Alt + Shift + F: Toggle Focus Window (Shift avoids Edge/Chrome Alt+F main menu conflict)
      if (e.altKey && e.shiftKey && e.code === "KeyF") {
        e.preventDefault();
        const state = window.CCTV_FOCUS_STATE?.getState?.();
        if (state?.isEnabled) {
          window.CCTV_FOCUS_STATE?.toggleWindow?.();
        }
        return;
      }

      // Alt + Shift + H: Quick Hide (Shift avoids Edge Alt+H History menu conflict)
      if (e.altKey && e.shiftKey && e.code === "KeyH") {
        e.preventDefault();
        window.CCTV_FOCUS_STATE?.toggleWindow?.(false);
        return;
      }

      // Alt + Shift + M: Quick Mute
      if (e.altKey && e.shiftKey && e.code === "KeyM") {
        e.preventDefault();
        window.CCTV_FOCUS_AUDIO?.toggleMute?.();
        return;
      }

      // Alt + Shift + Space OR Alt + Shift + P: Play / Pause (Shift avoids Windows Alt+Space system window menu)
      if (e.altKey && e.shiftKey && (e.code === "Space" || e.code === "KeyP")) {
        e.preventDefault();
        window.CCTV_FOCUS_AUDIO?.togglePlay?.();
        return;
      }

      // Alt + Shift + ArrowRight OR Alt + Shift + N: Next Track (Shift avoids browser Alt+Right history forward)
      if (e.altKey && e.shiftKey && (e.code === "ArrowRight" || e.code === "KeyN")) {
        e.preventDefault();
        window.CCTV_FOCUS_STATE?.skipNext?.();
        return;
      }

      // Alt + Shift + ArrowLeft OR Alt + Shift + B: Prev Track (Shift avoids browser Alt+Left history back)
      if (e.altKey && e.shiftKey && (e.code === "ArrowLeft" || e.code === "KeyB")) {
        e.preventDefault();
        window.CCTV_FOCUS_STATE?.skipPrevious?.();
        return;
      }

      // Escape: Hide Focus ONLY IF Focus is currently open, and NO other modal is open
      if (e.key === "Escape") {
        const lm = document.getElementById("loginModal");
        const loginModalOpen = lm && !lm.hidden && lm.style.display !== "none" && document.body.classList.contains("auth-locked");
        const anyOtherModalOpen = document.querySelector(".modal-backdrop.active, .modal.active:not(#focusWindow)");

        if (!loginModalOpen && !anyOtherModalOpen && container && container.style.display !== "none") {
          e.preventDefault();
          window.CCTV_FOCUS_STATE?.toggleWindow?.(false);
        }
      }
    });
  }

  // Synchronize Audio State to UI
  function bindAudioSync() {
    window.CCTV_FOCUS_AUDIO?.addListener((state) => {
      const isPlaying = state.isPlaying;

      // Update Play/Pause Icons
      const playSvg = `<polygon points="5 3 19 12 5 21 5 3"></polygon>`;
      const pauseSvg = `<rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect>`;

      if (el("iconFocusDiscreetPlay")) el("iconFocusDiscreetPlay").innerHTML = isPlaying ? pauseSvg : playSvg;
      if (el("iconFocusPlayHero")) el("iconFocusPlayHero").innerHTML = isPlaying ? pauseSvg : playSvg;

      // Live Pip indicator
      const pip = el("focusHeaderPip");
      if (pip) pip.style.display = isPlaying ? "inline-block" : "none";
      const sidePip = el("focusSidebarPip");
      if (sidePip) sidePip.style.display = (isPlaying || state.track) ? "inline-block" : "none";

      // Progress bar & Time
      const cur = state.currentTime || 0;
      const dur = state.duration || 0;
      if (dur > 0) {
        const pct = Math.max(0, Math.min(100, (cur / dur) * 100));
        if (el("focusProgressFill")) el("focusProgressFill").style.width = `${pct}%`;
      }
      if (el("focusTimeCurrent")) el("focusTimeCurrent").textContent = formatTime(cur);
      if (el("focusTimeTotal")) el("focusTimeTotal").textContent = formatTime(dur);

      // Volume sync
      if (el("focusDiscreetVol")) el("focusDiscreetVol").value = state.volume;
      if (el("focusFullVol")) el("focusFullVol").value = state.volume;
      if (el("iconFocusVolume")) {
        el("iconFocusVolume").style.opacity = state.isMuted ? "0.4" : "1";
      }

      // Synchronize lyrics line highlighting
      syncActiveLyricLine(cur);

      // MediaSession Sync
      updateMediaSession(state.track, isPlaying);
    });
  }

  function updateMediaSession(track, isPlaying) {
    if (!("mediaSession" in navigator)) return;
    if (track) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: track.title || "Focus",
        artist: track.artist || "Independent",
        album: "CCTV OPS Focus",
        artwork: track.artwork ? [{ src: track.artwork, sizes: "480x480", type: "image/jpeg" }] : []
      });
      navigator.mediaSession.playbackState = isPlaying ? "playing" : "paused";
    }

    try {
      navigator.mediaSession.setActionHandler("play", () => window.CCTV_FOCUS_AUDIO?.play?.());
      navigator.mediaSession.setActionHandler("pause", () => window.CCTV_FOCUS_AUDIO?.pause?.());
      navigator.mediaSession.setActionHandler("nexttrack", () => window.CCTV_FOCUS_STATE?.skipNext?.());
      navigator.mediaSession.setActionHandler("previoustrack", () => window.CCTV_FOCUS_STATE?.skipPrevious?.());
    } catch (_) {}
  }

  // Update track banner and reload lyrics when track changes
  async function renderTrackInfo(track) {
    if (!track) {
      if (el("focusTrackTitle")) el("focusTrackTitle").textContent = "Ready to play";
      if (el("focusTrackArtist")) el("focusTrackArtist").textContent = "Select or search music";
      if (el("focusTrackArt")) el("focusTrackArt").innerHTML = `<svg class="focus-track-art-fallback" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polygon points="10 8 16 12 10 16 10 8"></polygon></svg>`;
      if (el("focusLyricsArea")) el("focusLyricsArea").innerHTML = `<div class="focus-lyrics-empty">Select a track to view synchronized lyrics.</div>`;
      return;
    }

    if (el("focusTrackTitle")) el("focusTrackTitle").textContent = track.title;
    if (el("focusTrackArtist")) el("focusTrackArtist").textContent = track.artist;
    if (el("focusTrackArt")) {
      if (track.artwork) {
        el("focusTrackArt").innerHTML = `<img src="${track.artwork}" alt="Art" onerror="this.style.display='none'">`;
      } else {
        el("focusTrackArt").innerHTML = `<svg class="focus-track-art-fallback" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polygon points="10 8 16 12 10 16 10 8"></polygon></svg>`;
      }
    }

    // Load Lyrics
    await loadLyricsForTrack(track);
  }

  async function loadLyricsForTrack(track) {
    userIsScrollingLyrics = false;
    if (el("btnFocusFollowLive")) el("btnFocusFollowLive").style.display = "none";
    const area = el("focusLyricsArea");
    if (!area) return;
    area.innerHTML = `<div style="text-align:center; padding:20px; color:var(--text-muted);">Finding lyrics...</div>`;

    const lyricsData = await window.CCTV_FOCUS_LYRICS?.getLyrics?.(track);
    currentParsedLyrics = lyricsData?.lines || [];

    if (el("focusLyricsStatus")) {
      el("focusLyricsStatus").textContent = lyricsData?.isSynced ? (lyricsData.isCustom ? "Custom Synced" : "Synced") : "Plain Text";
    }

    if (!currentParsedLyrics || currentParsedLyrics.length === 0) {
      area.innerHTML = `
        <div class="focus-lyrics-empty">
          <span>No lyrics available for this recording.</span>
          <button type="button" class="focus-pill-btn" onclick="window.CCTV_FOCUS_WINDOW.openCustomLyricsModal()">+ Add Lyrics</button>
        </div>
      `;
      return;
    }

    // Render lyrics lines
    area.innerHTML = "";
    currentParsedLyrics.forEach((line, idx) => {
      const lineEl = document.createElement("div");
      lineEl.className = "focus-lyric-line";
      lineEl.setAttribute("data-index", idx);
      lineEl.setAttribute("data-time", line.time);
      lineEl.textContent = line.text || "♪";

      // Click-to-seek
      if (line.time >= 0) {
        lineEl.title = `Seek to ${formatTime(line.time)}`;
        lineEl.addEventListener("click", () => {
          window.CCTV_FOCUS_AUDIO?.seek?.(line.time);
          userIsScrollingLyrics = false;
        });
      }

      area.appendChild(lineEl);
    });
  }

  function syncActiveLyricLine(currentTime) {
    if (!currentParsedLyrics || currentParsedLyrics.length === 0) return;

    const activeIdx = window.CCTV_FOCUS_LYRICS?.getActiveIndex?.(currentParsedLyrics, currentTime);
    const area = el("focusLyricsArea");
    if (!area) return;

    const lines = area.querySelectorAll(".focus-lyric-line");
    lines.forEach((l, i) => {
      if (i === activeIdx) {
        l.classList.add("active");
      } else {
        l.classList.remove("active");
      }
    });

    if (!userIsScrollingLyrics && activeIdx >= 0) {
      scrollLyricsToActive();
    }
  }

  function scrollLyricsToActive() {
    const area = el("focusLyricsArea");
    if (!area) return;
    const activeEl = area.querySelector(".focus-lyric-line.active");
    if (activeEl) {
      const targetScroll = activeEl.offsetTop - (area.offsetHeight / 2) + (activeEl.offsetHeight / 2);
      area.scrollTo({ top: Math.max(0, targetScroll), behavior: "smooth" });
    }
  }

  // Search Results Rendering
  async function performSearch(query, genre = "all") {
    const list = el("focusSearchResults");
    if (!list) return;

    list.innerHTML = `<div style="text-align:center; padding:20px; color:var(--text-muted);">Searching...</div>`;
    try {
      const results = await window.CCTV_FOCUS_PROVIDER?.searchTracks?.(query, genre);
      searchResults = results || [];

      if (searchResults.length === 0) {
        list.innerHTML = `<div style="text-align:center; padding:20px; color:var(--text-muted);">No tracks found. Try searching for ambient, piano, or lofi.</div>`;
        return;
      }

      list.innerHTML = "";
      searchResults.forEach(track => {
        const item = document.createElement("div");
        item.className = "focus-track-item";
        item.innerHTML = `
          <div class="focus-item-main">
            <span class="focus-item-title">${track.title}</span>
            <span class="focus-item-artist">${track.artist} · <span style="color:var(--text-muted);">${track.genre}</span></span>
          </div>
          <div class="focus-item-meta">
            <span class="focus-item-duration">${track.durationFormatted}</span>
            <button type="button" class="focus-item-menu-btn" title="Add to Queue / Play Next">&#8942;</button>
          </div>
        `;

        // Click item body to play immediately
        item.addEventListener("click", (e) => {
          if (e.target.closest(".focus-item-menu-btn")) return;
          window.CCTV_FOCUS_STATE?.playTrack?.(track);
        });

        // 3-dot dropdown menu
        const menuBtn = item.querySelector(".focus-item-menu-btn");
        menuBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          showTrackContextMenu(track, e.clientX, e.clientY);
        });

        list.appendChild(item);
      });
    } catch (err) {
      list.innerHTML = `<div style="text-align:center; padding:20px; color:var(--text-muted);">Search unavailable. Please try again.</div>`;
    }
  }

  function showTrackContextMenu(track, x, y) {
    const existing = document.getElementById("focusTrackContextMenu");
    if (existing) existing.remove();

    const menu = document.createElement("div");
    menu.id = "focusTrackContextMenu";
    menu.style.position = "fixed";
    menu.style.left = `${Math.min(window.innerWidth - 140, x)}px`;
    menu.style.top = `${Math.min(window.innerHeight - 90, y)}px`;
    menu.style.zIndex = "1100";
    menu.style.background = "var(--bg-surface-elevated)";
    menu.style.border = "1px solid var(--border-default)";
    menu.style.borderRadius = "6px";
    menu.style.boxShadow = "0 8px 24px rgba(0,0,0,0.6)";
    menu.style.padding = "4px";
    menu.style.display = "flex";
    menu.style.flexDirection = "column";
    menu.style.gap = "2px";
    menu.style.minWidth = "120px";

    menu.innerHTML = `
      <button type="button" class="focus-pill-btn" id="btnMenuPlayNext" style="text-align:left; padding:6px 8px; border:none; background:transparent;">Play Next</button>
      <button type="button" class="focus-pill-btn" id="btnMenuAddQueue" style="text-align:left; padding:6px 8px; border:none; background:transparent;">Add to Queue</button>
    `;

    document.body.appendChild(menu);

    menu.querySelector("#btnMenuPlayNext").addEventListener("click", () => {
      window.CCTV_FOCUS_STATE?.playNext?.(track);
      menu.remove();
    });

    menu.querySelector("#btnMenuAddQueue").addEventListener("click", () => {
      window.CCTV_FOCUS_STATE?.addToQueue?.(track);
      menu.remove();
    });

    const closeMenu = (e) => {
      if (!menu.contains(e.target)) {
        menu.remove();
        window.removeEventListener("click", closeMenu);
      }
    };
    setTimeout(() => window.addEventListener("click", closeMenu), 50);
  }

  // Queue and History Rendering
  function renderQueue(state) {
    const nowContainer = el("focusQueueNowPlayingContainer");
    const playNextContainer = el("focusQueuePlayNextContainer");
    const upcomingContainer = el("focusQueueUpcomingContainer");
    const historyContainer = el("focusHistoryContainer");
    const labelPlayNext = el("labelPlayNext");

    // 1. Now Playing
    if (nowContainer) {
      if (state.nowPlaying) {
        nowContainer.innerHTML = `
          <div class="focus-queue-item is-now-playing">
            <div class="focus-item-main">
              <span class="focus-item-title">${state.nowPlaying.title}</span>
              <span class="focus-item-artist">${state.nowPlaying.artist}</span>
            </div>
            <span class="focus-item-duration">${state.nowPlaying.durationFormatted}</span>
          </div>
        `;
      } else {
        nowContainer.innerHTML = `<div style="font-size:10px; color:var(--text-muted); padding:4px 0;">No active track</div>`;
      }
    }

    // 2. Play Next
    if (playNextContainer && labelPlayNext) {
      if (state.playNextQueue && state.playNextQueue.length > 0) {
        labelPlayNext.style.display = "block";
        playNextContainer.innerHTML = "";
        state.playNextQueue.forEach((t, i) => {
          const item = document.createElement("div");
          item.className = "focus-queue-item";
          item.innerHTML = `
            <div class="focus-item-main" style="cursor:pointer;">
              <span class="focus-item-title">${t.title}</span>
              <span class="focus-item-artist">${t.artist}</span>
            </div>
            <div style="display:flex; align-items:center; gap:6px;">
              <span class="focus-item-duration">${t.durationFormatted}</span>
              <button type="button" class="focus-ctrl-btn btn-remove" title="Remove">&times;</button>
            </div>
          `;
          item.querySelector(".focus-item-main").addEventListener("click", () => window.CCTV_FOCUS_STATE?.playTrack?.(t));
          item.querySelector(".btn-remove").addEventListener("click", () => window.CCTV_FOCUS_STATE?.removeFromQueue?.(i, "playNext"));
          playNextContainer.appendChild(item);
        });
      } else {
        labelPlayNext.style.display = "none";
        playNextContainer.innerHTML = "";
      }
    }

    // 3. Upcoming
    if (upcomingContainer) {
      if (state.upcomingQueue && state.upcomingQueue.length > 0) {
        upcomingContainer.innerHTML = "";
        state.upcomingQueue.forEach((t, i) => {
          const item = document.createElement("div");
          item.className = "focus-queue-item";
          item.innerHTML = `
            <div class="focus-item-main" style="cursor:pointer;">
              <span class="focus-item-title">${t.title}</span>
              <span class="focus-item-artist">${t.artist}</span>
            </div>
            <div style="display:flex; align-items:center; gap:6px;">
              <span class="focus-item-duration">${t.durationFormatted}</span>
              <button type="button" class="focus-ctrl-btn btn-remove" title="Remove">&times;</button>
            </div>
          `;
          item.querySelector(".focus-item-main").addEventListener("click", () => window.CCTV_FOCUS_STATE?.playTrack?.(t));
          item.querySelector(".btn-remove").addEventListener("click", () => window.CCTV_FOCUS_STATE?.removeFromQueue?.(i, "upcoming"));
          upcomingContainer.appendChild(item);
        });
      } else {
        upcomingContainer.innerHTML = `<div style="font-size:10px; color:var(--text-muted); padding:4px 0;">Queue is empty. Search for songs to add or enable Autoplay.</div>`;
      }
    }

    // 4. History
    if (historyContainer) {
      if (state.history && state.history.length > 0) {
        historyContainer.innerHTML = "";
        state.history.forEach((t) => {
          const item = document.createElement("div");
          item.className = "focus-queue-item";
          item.style.opacity = "0.75";
          item.innerHTML = `
            <div class="focus-item-main" style="cursor:pointer;">
              <span class="focus-item-title">${t.title}</span>
              <span class="focus-item-artist">${t.artist}</span>
            </div>
            <span class="focus-item-duration">${t.durationFormatted}</span>
          `;
          item.addEventListener("click", () => window.CCTV_FOCUS_STATE?.playTrack?.(t));
          historyContainer.appendChild(item);
        });
      } else {
        historyContainer.innerHTML = `<div style="font-size:10px; color:var(--text-muted); padding:4px 0;">No recently played tracks</div>`;
      }
    }
  }

  // Custom Lyrics Editor Modal
  function openCustomLyricsModal() {
    const curTrack = window.CCTV_FOCUS_STATE?.getState?.()?.nowPlaying;
    if (!curTrack) {
      alert("Please select a song first before adding custom lyrics.");
      return;
    }

    const existing = document.getElementById("focusCustomLyricsModal");
    if (existing) existing.remove();

    const existingCustom = window.CCTV_FOCUS_LYRICS?.getCustomLyrics?.(curTrack.id);
    const initialText = existingCustom ? existingCustom.text : "";
    const initialOffset = existingCustom ? existingCustom.timeOffset : 0;

    const modal = document.createElement("div");
    modal.id = "focusCustomLyricsModal";
    modal.style.position = "fixed";
    modal.style.inset = "0";
    modal.style.background = "rgba(0,0,0,0.75)";
    modal.style.zIndex = "1200";
    modal.style.display = "flex";
    modal.style.alignItems = "center";
    modal.style.justifyContent = "center";
    modal.style.backdropFilter = "blur(3px)";

    modal.innerHTML = `
      <div style="background:var(--bg-surface); border:1px solid var(--border-default); border-radius:8px; width:460px; max-width:90%; padding:16px; display:flex; flex-direction:column; gap:12px; font-family:var(--font-mono); box-shadow:0 12px 36px rgba(0,0,0,0.8);">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <strong style="color:var(--text-primary); font-size:12px;">Custom Lyrics: ${curTrack.title}</strong>
          <button type="button" class="focus-ctrl-btn" id="btnLyricsModalClose" style="font-size:16px;">&times;</button>
        </div>
        <p style="font-size:10px; color:var(--text-secondary); margin:0;">
          Paste LRC formatted synchronized lyrics or plain text. You can also calibrate the timing offset below.
        </p>
        <textarea id="focusCustomLyricsText" style="width:100%; height:160px; background:var(--bg-surface-elevated); border:1px solid var(--border-default); border-radius:4px; padding:8px; color:var(--text-primary); font-family:inherit; font-size:11px; outline:none; resize:vertical;" placeholder="[00:12.50] Line 1&#10;[00:15.00] Line 2...">${initialText}</textarea>
        <div style="display:flex; justify-content:space-between; align-items:center; font-size:10px; color:var(--text-secondary);">
          <span>Timing Offset: <span id="labelOffset">${initialOffset}s</span></span>
          <input type="range" id="focusOffsetSlider" min="-2.0" max="2.0" step="0.1" value="${initialOffset}" style="width:140px;">
        </div>
        <div style="display:flex; justify-content:flex-end; gap:8px;">
          <button type="button" class="focus-pill-btn" id="btnLyricsModalCancel" style="padding:6px 12px;">Cancel</button>
          <button type="button" class="focus-pill-btn" id="btnLyricsModalSave" style="padding:6px 14px; background:var(--accent-primary); color:#FFFFFF; border-color:var(--accent-primary);">Save Lyrics</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    modal.querySelector("#btnLyricsModalClose").addEventListener("click", () => modal.remove());
    modal.querySelector("#btnLyricsModalCancel").addEventListener("click", () => modal.remove());

    const offsetSlider = modal.querySelector("#focusOffsetSlider");
    const offsetLabel = modal.querySelector("#labelOffset");
    offsetSlider.addEventListener("input", (e) => {
      offsetLabel.textContent = `${e.target.value}s`;
    });

    modal.querySelector("#btnLyricsModalSave").addEventListener("click", () => {
      const text = modal.querySelector("#focusCustomLyricsText").value;
      const offset = parseFloat(offsetSlider.value);
      window.CCTV_FOCUS_LYRICS?.saveCustomLyrics?.(curTrack.id, text, offset);
      modal.remove();
      loadLyricsForTrack(curTrack);
    });
  }

  // Bind State Sync
  function bindStateSync() {
    window.CCTV_FOCUS_STATE?.addListener((state) => {
      if (!container) return;

      // Visibility
      const shouldShow = !!(state.isEnabled && state.isWindowVisible);
      container.style.display = shouldShow ? "flex" : "none";

      // Sync status indicator
      const syncWarn = el("focusSyncWarn");
      if (syncWarn) {
        syncWarn.style.display = (state.syncStatus === "offline" || state.syncStatus === "error") ? "inline-block" : "none";
      }

      // Mode styling & rect restoration
      const isDiscreet = state.mode === "discreet";
      container.classList.toggle("mode-discreet", isDiscreet);

      const rect = isDiscreet ? state.windowRectDiscreet : state.windowRectFull;
      if (rect) {
        if (rect.width) container.style.width = `${rect.width}px`;
        if (rect.height && !isDiscreet) container.style.height = `${rect.height}px`;
        if (typeof rect.x === "number") container.style.left = `${rect.x}px`;
        if (typeof rect.y === "number") container.style.top = `${rect.y}px`;
      }

      if (shouldShow) {
        clampToViewport();
      }

      // Autoplay pill
      const autoPill = el("btnFocusAutoplay");
      if (autoPill) autoPill.classList.toggle("active", state.autoplayEnabled);

      // Tab switcher in Full Mode
      ["lyrics", "search", "queue"].forEach(t => {
        const cap = t.charAt(0).toUpperCase() + t.slice(1);
        const tabEl = el(`tabFocus${cap}`);
        const paneEl = el(`paneFocus${cap}`);
        const isActive = t === state.activeTab;
        if (tabEl) {
          tabEl.classList.toggle("active", isActive);
          tabEl.setAttribute("aria-selected", isActive ? "true" : "false");
        }
        if (paneEl) {
          paneEl.classList.toggle("active", isActive);
        }
      });

      // Lyrics Mode
      const lyricsArea = el("focusLyricsArea");
      if (lyricsArea) {
        lyricsArea.classList.toggle("mode-compact", state.lyricsMode === "compact");
      }
      if (el("btnToggleLyricMode")) {
        el("btnToggleLyricMode").textContent = state.lyricsMode === "compact" ? "Full View" : "Compact View";
      }

      // Track banner & Lyrics
      renderTrackInfo(state.nowPlaying);

      // Queue & History
      renderQueue(state);

      // Sidebar launcher visibility
      const btnSidebarFocus = el("btnSidebarFocus");
      if (btnSidebarFocus) {
        btnSidebarFocus.style.display = state.isEnabled ? "" : "none";
        btnSidebarFocus.classList.toggle("is-active-listening", !!state.nowPlaying);
      }
    });
  }

  // Initialize Focus Window
  function init() {
    buildDOM();
    bindWindowInteractions();
    bindUIEvents();
    bindKeyboardShortcuts();
    bindAudioSync();
    bindStateSync();

    // Trigger initial search / discovery list
    setTimeout(() => {
      performSearch("", "all");
    }, 400);
  }

  // Run on DOM ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  return {
    openCustomLyricsModal,
    show() {
      window.CCTV_FOCUS_STATE?.toggleWindow?.(true);
    },
    hide() {
      window.CCTV_FOCUS_STATE?.toggleWindow?.(false);
    }
  };
})();

// Global Facade for convenient API and headless testing
window.CCTV_FOCUS = {
  enable: () => window.CCTV_FOCUS_STATE?.setEnabled?.(true),
  disable: () => window.CCTV_FOCUS_STATE?.setEnabled?.(false),
  toggle: () => window.CCTV_FOCUS_STATE?.toggleWindow?.(),
  show: () => window.CCTV_FOCUS_STATE?.toggleWindow?.(true),
  hide: () => window.CCTV_FOCUS_STATE?.toggleWindow?.(false),
  getState: () => window.CCTV_FOCUS_STATE?.getState?.(),
  play: (track) => window.CCTV_FOCUS_STATE?.playTrack?.(track)
};
