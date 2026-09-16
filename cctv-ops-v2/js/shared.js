/**
 * CCTV OPS V2 - Shared Runtime Utilities
 * Toasts, Confirmations, Clipboard, Manila Clock & Media Handlers
 */

(function () {
  "use strict";

  // HTML Entity Escaping
  window.escapeHtml = function (value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  };

  // Plain Text Sanitizer (Tabs/Newlines for TSV)
  window.sanitize = function (value) {
    return String(value == null ? "" : value).replace(/[\t\r\n]+/g, " ").trim();
  };

  // Strict Safe URL Validator (Blocks javascript:, data:, vbscript:, file:, and invalid schemes)
  window.safeUrl = function (value) {
    const raw = String(value == null ? "" : value).trim();
    if (!raw) return "";
    // If input specifies any scheme (anything preceding a colon)
    if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(raw)) {
      try {
        const parsed = new URL(raw);
        if (/^https?:$/i.test(parsed.protocol)) return parsed.href;
      } catch (_) {}
      return "";
    }
    // If no scheme was provided, only allow if it resembles a valid web host/domain
    try {
      const parsed = new URL("https://" + raw);
      if (/^https?:$/i.test(parsed.protocol) && parsed.hostname.includes(".")) {
        return parsed.href;
      }
    } catch (_) {}
    return "";
  };

  // Safe Error Formatter (Prevents leaking SQL / Stack traces / Internals)
  window.safeErrorMessage = function (err, fallback = "Operation could not be completed.") {
    if (!err) return fallback;
    const msg = String(typeof err === "string" ? err : (err.message || fallback));
    if (/relation ".*" does not exist/i.test(msg) || /syntax error at or near/i.test(msg) || /JWT/i.test(msg) || /apikey/i.test(msg)) {
      return "A server configuration or database error occurred. Please contact an administrator.";
    }
    if (/fetch failed/i.test(msg) || /network error/i.test(msg)) {
      return "Network connection failed. Please check your connectivity.";
    }
    return window.escapeHtml(msg.slice(0, 160));
  };

  // ISO Date Helper (YYYY-MM-DD in Asia/Manila / local time)
  window.todayIso = function () {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  // Formatted Display Date (e.g. "Sep 10, 2026")
  window.formatDisplayDate = function (dateStr) {
    if (!dateStr) return "No Date";
    const str = String(dateStr).trim();
    const m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(str);
    if (m) {
      const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      const monthIdx = parseInt(m[2], 10) - 1;
      const month = months[monthIdx] || m[2];
      const day = parseInt(m[3], 10);
      return `${month} ${day}, ${m[1]}`;
    }
    return str;
  };

  // =========================================================================
  // SINGLE GLOBAL TOAST / NOTIFICATION MANAGER (SINGLE INSTANCE ONLY)
  // =========================================================================
  let activeToastEl = null;
  let activeToastTimer = null;
  let activeToastDismissTimer = null;
  let activeToastMsg = "";
  let activeToastType = "";

  const TOAST_PRIORITIES = {
    error: 3,
    danger: 3,
    warning: 2,
    success: 1,
    info: 1
  };

  const TOAST_DEFAULT_DURATIONS = {
    error: 5000,
    danger: 5000,
    warning: 4000,
    success: 2800,
    info: 2800
  };

  function dismissActiveToast(immediate = false) {
    if (activeToastTimer) {
      clearTimeout(activeToastTimer);
      activeToastTimer = null;
    }
    if (activeToastDismissTimer) {
      clearTimeout(activeToastDismissTimer);
      activeToastDismissTimer = null;
    }
    if (!activeToastEl) {
      const container = document.getElementById("toastContainer");
      if (container && immediate) container.innerHTML = "";
      return;
    }

    const elToDismiss = activeToastEl;
    activeToastEl = null;
    activeToastMsg = "";
    activeToastType = "";

    if (immediate) {
      elToDismiss.remove();
      const container = document.getElementById("toastContainer");
      if (container) container.innerHTML = "";
      return;
    }

    elToDismiss.style.opacity = "0";
    elToDismiss.style.transform = "translateY(8px)";
    elToDismiss.style.transition = "all 160ms ease";
    activeToastDismissTimer = setTimeout(() => {
      elToDismiss.remove();
      const container = document.getElementById("toastContainer");
      if (container) container.innerHTML = "";
      activeToastDismissTimer = null;
    }, 180);
  }

  window.dismissToast = dismissActiveToast;

  window.showToast = function (message, type = "info", durationOrOpts) {
    const container = document.getElementById("toastContainer");
    if (!container) {
      console.log(`[Toast ${type}] ${message}`);
      return;
    }

    const safeType = ["success", "error", "warning", "info", "danger"].includes(type)
      ? (type === "danger" ? "error" : type)
      : "info";

    const cleanMsg = String(message == null ? "" : message).trim();
    if (!cleanMsg) return;

    let duration = TOAST_DEFAULT_DURATIONS[safeType] || 2800;
    let actionText = null;
    let onAction = null;

    if (typeof durationOrOpts === "number") {
      duration = durationOrOpts;
    } else if (typeof durationOrOpts === "object" && durationOrOpts !== null) {
      duration = durationOrOpts.duration || duration;
      actionText = durationOrOpts.actionText || null;
      onAction = durationOrOpts.onAction || null;
    }

    // Cancel existing timers
    if (activeToastTimer) {
      clearTimeout(activeToastTimer);
      activeToastTimer = null;
    }
    if (activeToastDismissTimer) {
      clearTimeout(activeToastDismissTimer);
      activeToastDismissTimer = null;
    }

    // Icons calibrated for dark terminal
    let iconSvg = "";
    if (safeType === "success") {
      iconSvg = `<svg class="toast-icon" viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" fill="none" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
    } else if (safeType === "error") {
      iconSvg = `<svg class="toast-icon" viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" fill="none" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>`;
    } else if (safeType === "warning") {
      iconSvg = `<svg class="toast-icon" viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" fill="none" stroke-width="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>`;
    } else {
      iconSvg = `<svg class="toast-icon" viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" fill="none" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>`;
    }

    let actionBtnHtml = "";
    if (actionText && typeof onAction === "function") {
      actionBtnHtml = `<button type="button" class="btn btn-xs btn-outline toast-action-btn" style="margin-left:auto; font-size:10.5px; padding:2px 8px;">${escapeHtml(actionText)}</button>`;
    }

    // Reuse existing toast DOM element if present in container, otherwise create one
    let toast = activeToastEl && container.contains(activeToastEl) ? activeToastEl : null;

    if (!toast) {
      while (container.firstChild) {
        container.removeChild(container.firstChild);
      }
      toast = document.createElement("div");
      container.appendChild(toast);
    } else {
      // Purge any extra children just in case
      while (container.firstChild && container.firstChild !== toast) {
        container.removeChild(container.firstChild);
      }
      while (container.lastChild && container.lastChild !== toast) {
        container.removeChild(container.lastChild);
      }
    }

    toast.className = `toast toast-${safeType}`;
    toast.style.opacity = "1";
    toast.style.transform = "none";
    toast.style.transition = "";
    toast.setAttribute("role", safeType === "error" ? "alert" : "status");
    toast.setAttribute("aria-live", safeType === "error" ? "assertive" : "polite");

    toast.innerHTML = `
      <div style="display:flex; align-items:center; gap:8px; width:100%;">
        ${iconSvg}
        <span class="toast-msg" style="flex:1; line-height:1.35;">${escapeHtml(cleanMsg)}</span>
        ${actionBtnHtml}
        <button type="button" class="toast-close-btn" aria-label="Dismiss" style="background:none; border:none; color:var(--text-muted); cursor:pointer; padding:0 2px; font-size:12px; margin-left:4px;">✕</button>
      </div>
      <div class="toast-progress-bar" style="position:absolute; bottom:0; left:0; height:2px; width:100%; background:currentColor; opacity:0.35; transform-origin:left; animation:toast-shrink ${duration}ms linear forwards;"></div>
    `;

    // Action button handler
    if (actionText && typeof onAction === "function") {
      const actBtn = toast.querySelector(".toast-action-btn");
      actBtn?.addEventListener("click", (e) => {
        e.stopPropagation();
        try { onAction(); } catch (err) { console.error(err); }
        dismissActiveToast(true);
      });
    }

    // Dismiss button handler
    const closeBtn = toast.querySelector(".toast-close-btn");
    closeBtn?.addEventListener("click", (e) => {
      e.stopPropagation();
      dismissActiveToast(true);
    });

    activeToastEl = toast;
    activeToastMsg = cleanMsg;
    activeToastType = safeType;

    activeToastTimer = setTimeout(() => {
      dismissActiveToast(false);
    }, duration);
  };

  // Global App Confirmation Dialog (Promise-based with Keyboard Traps & Accessibility)
  let confirmResolve = null;
  let prevActiveEl = null;

  window.appConfirm = function ({ title = "Confirm Action", message = "Are you sure?", confirmText = "Confirm", cancelText = "Cancel", tone = "primary" }) {
    return new Promise((resolve) => {
      confirmResolve = resolve;
      prevActiveEl = document.activeElement;
      const modal = document.getElementById("modalAppConfirm");
      if (!modal) {
        resolve(window.confirm(`${title}\n\n${message}`));
        return;
      }
      document.getElementById("confirmDialogTitle").textContent = title;
      document.getElementById("confirmDialogMessage").textContent = message;
      
      const acceptBtn = document.getElementById("btnConfirmDialogAccept");
      acceptBtn.textContent = confirmText;
      acceptBtn.className = `btn btn-${tone === "danger" ? "danger" : "primary"} btn-sm`;

      const cancelBtn = document.getElementById("btnConfirmDialogCancel");
      cancelBtn.textContent = cancelText;

      modal.hidden = false;

      // Safe keyboard focus: if danger action, focus cancel to prevent accidental enter confirmation
      setTimeout(() => {
        if (tone === "danger") {
          cancelBtn.focus();
        } else {
          acceptBtn.focus();
        }
      }, 50);
    });
  };

  window.handleConfirmDialog = function (agreed) {
    const modal = document.getElementById("modalAppConfirm");
    if (modal) modal.hidden = true;
    if (typeof confirmResolve === "function") {
      const res = confirmResolve;
      confirmResolve = null;
      res(agreed);
    }
    if (prevActiveEl && typeof prevActiveEl.focus === "function") {
      try { prevActiveEl.focus(); } catch (_) {}
      prevActiveEl = null;
    }
  };

  // Global Keyboard listener for confirmation dialog
  document.addEventListener("keydown", (e) => {
    const modal = document.getElementById("modalAppConfirm");
    if (modal && !modal.hidden) {
      if (e.key === "Escape") {
        e.preventDefault();
        window.handleConfirmDialog(false);
      } else if (e.key === "Enter" && document.activeElement?.id === "btnConfirmDialogAccept") {
        e.preventDefault();
        window.handleConfirmDialog(true);
      }
    }
  });

  // Shared Button Busy State Helper
  window.setButtonBusy = function (btn, isBusy, busyText = "Processing...") {
    if (!btn) return;
    if (isBusy) {
      btn.dataset.prevHtml = btn.innerHTML;
      btn.dataset.prevDisabled = btn.disabled;
      btn.disabled = true;
      btn.classList.add("is-busy");
      btn.innerHTML = `<span class="btn-spinner"></span><span>${window.escapeHtml(busyText)}</span>`;
    } else {
      btn.disabled = btn.dataset.prevDisabled === "true";
      btn.classList.remove("is-busy");
      if (btn.dataset.prevHtml) {
        btn.innerHTML = btn.dataset.prevHtml;
        delete btn.dataset.prevHtml;
        delete btn.dataset.prevDisabled;
      }
    }
  };

  // Topbar Background Progress Indicator Helper
  window.setGlobalProgress = function (isActive) {
    const line = document.getElementById("topbarProgressLine");
    if (!line) return;
    line.classList.toggle("is-active", !!isActive);
  };

  // Shimmer Skeleton Generator Helper
  window.renderSkeletonRows = function (containerEl, colCount = 4, rowCount = 3) {
    if (!containerEl) return;
    let html = "";
    for (let i = 0; i < rowCount; i++) {
      html += `<tr>`;
      for (let c = 0; c < colCount; c++) {
        html += `<td><div class="skeleton-shimmer skeleton-row" style="width:${65 + ((c * 19) % 30)}%;"></div></td>`;
      }
      html += `</tr>`;
    }
    containerEl.innerHTML = html;
  };

  // Manila Live Operational Clock (Asia/Manila PHT)
  window.initManilaClock = function () {
    function updateClock() {
      try {
        const now = new Date();
        const options = {
          timeZone: "Asia/Manila",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: true
        };
        const parts = new Intl.DateTimeFormat("en-US", options).format(now);
        const clockEl = document.getElementById("manilaClockText");
        if (clockEl) clockEl.textContent = `${parts} PHT`;
      } catch (_) {}
    }
    updateClock();
    setInterval(updateClock, 1000);
  };

  // DataURL to PNG Blob Converter
  window.dataUrlToPngBlob = async function (dataUrl) {
    if (!dataUrl || typeof dataUrl !== "string" || !dataUrl.startsWith("data:image/")) {
      return null;
    }
    try {
      const res = await fetch(dataUrl);
      const blob = await res.blob();
      if (blob.type === "image/png") return blob;

      return await new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => {
          const canvas = document.createElement("canvas");
          canvas.width = img.naturalWidth || img.width;
          canvas.height = img.naturalHeight || img.height;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0);
          canvas.toBlob(b => resolve(b), "image/png");
        };
        img.onerror = () => resolve(null);
        img.src = dataUrl;
      });
    } catch (err) {
      console.warn("dataUrlToPngBlob conversion error:", err);
      return null;
    }
  };

  // Native Image Blob / ClipboardItem Copy
  window.copyBlobImageToClipboard = async function (blobOrDataUrl) {
    let blob = blobOrDataUrl;
    if (typeof blobOrDataUrl === "string") {
      blob = await window.dataUrlToPngBlob(blobOrDataUrl);
    }
    if (!blob) {
      throw new Error("No valid image data to copy.");
    }
    if (!navigator.clipboard || !window.ClipboardItem || !navigator.clipboard.write) {
      throw new Error("Your browser does not support copying images directly to clipboard.");
    }
    const item = new ClipboardItem({ "image/png": blob });
    await navigator.clipboard.write([item]);
    return true;
  };

  // Safe Multi-Format Clipboard Write (HTML + Text fallback)
  window.copyToClipboardHtmlAndText = async function (plainText, htmlText) {
    if (!plainText && !htmlText) {
      throw new Error("No content to copy.");
    }
    const safeText = plainText || "";
    const safeHtml = htmlText || `<div>${window.escapeHtml(safeText).replace(/\n/g, "<br>")}</div>`;

    if (navigator.clipboard && window.ClipboardItem && navigator.clipboard.write) {
      try {
        const clipboardItem = new ClipboardItem({
          "text/plain": new Blob([safeText], { type: "text/plain" }),
          "text/html": new Blob([safeHtml], { type: "text/html" })
        });
        await navigator.clipboard.write([clipboardItem]);
        return true;
      } catch (err) {
        console.warn("ClipboardItem write failed, using fallback:", err);
      }
    }

    // Fallback using textarea for plain text
    const textarea = document.createElement("textarea");
    textarea.value = safeText;
    textarea.style.position = "fixed";
    textarea.style.left = "-9999px";
    textarea.style.top = "0";
    document.body.appendChild(textarea);
    textarea.select();
    const success = document.execCommand("copy");
    textarea.remove();
    if (!success) {
      throw new Error("Clipboard copy command failed.");
    }
    return true;
  };

  // Modal Screenshot Viewer Helper
  window.openFullScreenshotViewer = function (dataUrl, title, meta) {
    if (!dataUrl) {
      window.showToast("No screenshot available.", "info");
      return;
    }
    const modal = document.getElementById("modalScreenshotViewer");
    const img = document.getElementById("screenshotViewerImg");
    const titleEl = document.getElementById("screenshotViewerTitle");
    const metaEl = document.getElementById("screenshotViewerMeta");
    if (!modal || !img) return;

    img.src = dataUrl;
    if (titleEl) titleEl.textContent = title || "CCTV Incident Evidence";
    if (metaEl) metaEl.textContent = meta || "Full Resolution Screenshot";
    modal.hidden = false;
  };

  window.closeFullScreenshotViewer = function () {
    const modal = document.getElementById("modalScreenshotViewer");
    const img = document.getElementById("screenshotViewerImg");
    if (modal) modal.hidden = true;
    if (img) img.src = "";
  };

})();
