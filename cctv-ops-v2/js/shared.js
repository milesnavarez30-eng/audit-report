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

  // Toast Notification System
  window.showToast = function (message, type = "info", duration = 3200) {
    const container = document.getElementById("toastContainer");
    if (!container) {
      console.log(`[Toast ${type}] ${message}`);
      return;
    }
    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.transform = "translateY(10px)";
      toast.style.transition = "all 200ms ease";
      setTimeout(() => toast.remove(), 220);
    }, duration);
  };

  // Global App Confirmation Dialog (Promise-based)
  let confirmResolve = null;
  window.appConfirm = function ({ title = "Confirm Action", message = "Are you sure?", confirmText = "Confirm", cancelText = "Cancel", tone = "primary" }) {
    return new Promise((resolve) => {
      confirmResolve = resolve;
      const modal = document.getElementById("modalAppConfirm");
      if (!modal) {
        // Fallback to native confirm if modal element not found
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
