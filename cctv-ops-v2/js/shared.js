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

  // Toast Notification System with Icons, Progress & Actions
  window.showToast = function (message, type = "info", durationOrOpts = 3200) {
    const container = document.getElementById("toastContainer");
    if (!container) {
      console.log(`[Toast ${type}] ${message}`);
      return;
    }

    let duration = 3200;
    let actionText = null;
    let onAction = null;

    if (typeof durationOrOpts === "number") {
      duration = durationOrOpts;
    } else if (typeof durationOrOpts === "object" && durationOrOpts !== null) {
      duration = durationOrOpts.duration || 3200;
      actionText = durationOrOpts.actionText || null;
      onAction = durationOrOpts.onAction || null;
    }

    // Limit active toasts to prevent viewport clutter
    while (container.children.length >= 4) {
      container.removeChild(container.firstChild);
    }

    const toast = document.createElement("div");
    const safeType = ["success", "error", "warning", "info", "danger"].includes(type) ? (type === "danger" ? "error" : type) : "info";
    toast.className = `toast toast-${safeType}`;
    toast.setAttribute("role", "status");
    toast.setAttribute("aria-live", "polite");

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

    toast.innerHTML = `
      <div style="display:flex; align-items:center; gap:8px; width:100%;">
        ${iconSvg}
        <span class="toast-msg" style="flex:1; line-height:1.35;">${escapeHtml(message)}</span>
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
        removeToast();
      });
    }

    // Dismiss button handler
    const closeBtn = toast.querySelector(".toast-close-btn");
    closeBtn?.addEventListener("click", () => removeToast());

    container.appendChild(toast);

    let dismissed = false;
    function removeToast() {
      if (dismissed) return;
      dismissed = true;
      toast.style.opacity = "0";
      toast.style.transform = "translateY(8px)";
      toast.style.transition = "all 160ms ease";
      setTimeout(() => toast.remove(), 180);
    }

    setTimeout(removeToast, duration);
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
