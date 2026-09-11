/**
 * CCTV OPS V2 - Pending Reports Service
 * 1:1 Authoritative Functional Parity with V1 Pending Reports
 * Manages pending escalations, age calculations, 1-day follow-up alerts,
 * 4-day email reminders, IndexedDB persistence, and browser notifications.
 */
(function (root) {
  "use strict";

  const DB_NAME = "cctv_pending_reports_v1";
  const STORE_NAME = "state";
  const STATE_KEY = "reports";
  const DAY_MS = 24 * 60 * 60 * 1000;

  const listeners = [];

  function emitChange(reports) {
    listeners.forEach(fn => {
      try { fn(reports); } catch (e) { console.error("Pending change listener error:", e); }
    });
  }

  function uid() {
    return "pending_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8);
  }

  function clone(val) {
    try {
      return structuredClone(val);
    } catch (_) {
      return JSON.parse(JSON.stringify(val));
    }
  }

  function todayLocal() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function safeUrl(value) {
    const text = String(value || "").trim();
    if (!text) return "";
    try {
      const url = new URL(text);
      return /^https?:$/i.test(url.protocol) ? url.href : "";
    } catch (_) {
      return "";
    }
  }

  function reportDateStart(report) {
    const source = report.reportDate || report.createdAt || todayLocal();
    if (/^\d{4}-\d{2}-\d{2}$/.test(source)) {
      return new Date(`${source}T00:00:00`);
    }
    return new Date(source);
  }

  function reportAgeMs(report) {
    const start = reportDateStart(report);
    if (Number.isNaN(start.getTime())) return 0;
    return Math.max(0, Date.now() - start.getTime());
  }

  function isFollowupDue(report) {
    return reportAgeMs(report) >= DAY_MS;
  }

  function isEmailDue(report) {
    return reportAgeMs(report) >= (4 * DAY_MS);
  }

  function ageText(ms) {
    const hours = Math.floor(ms / (60 * 60 * 1000));
    if (hours < 24) {
      return `${hours}h`;
    }
    const days = Math.floor(hours / 24);
    return `${days}d`;
  }

  function openDb() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);

      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };

      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async function loadReports() {
    try {
      const db = await openDb();
      try {
        const saved = await new Promise((resolve, reject) => {
          const tx = db.transaction(STORE_NAME, "readonly");
          const req = tx.objectStore(STORE_NAME).get(STATE_KEY);
          req.onsuccess = () => resolve(req.result || []);
          req.onerror = () => reject(req.error);
        });
        return Array.isArray(saved) ? saved : [];
      } finally {
        db.close();
      }
    } catch (e) {
      console.warn("Could not load pending reports from IndexedDB:", e);
      return [];
    }
  }

  async function saveReports(reports) {
    const db = await openDb();
    try {
      await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readwrite");
        tx.objectStore(STORE_NAME).put(clone(reports), STATE_KEY);
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
      });
      emitChange(reports);
    } finally {
      db.close();
    }
  }

  function compressImage(file, maxWidth = 1200, quality = 0.78) {
    return new Promise((resolve, reject) => {
      if (!file || !file.type?.startsWith("image/")) {
        reject(new Error("Please choose an image file."));
        return;
      }

      const reader = new FileReader();
      reader.onerror = () => reject(new Error("Could not read screenshot file."));
      reader.onload = () => {
        const img = new Image();
        img.onerror = () => reject(new Error("Could not process screenshot image."));
        img.onload = () => {
          const scale = Math.min(1, maxWidth / Math.max(1, img.naturalWidth || img.width));
          const canvas = document.createElement("canvas");
          canvas.width = Math.max(1, Math.round((img.naturalWidth || img.width) * scale));
          canvas.height = Math.max(1, Math.round((img.naturalHeight || img.height) * scale));

          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL("image/jpeg", quality));
        };
        img.src = String(reader.result || "");
      };
      reader.readAsDataURL(file);
    });
  }

  async function compressBase64(raw, maxWidth = 1200, maxHeight = 1000, quality = 0.78) {
    if (!raw || typeof raw !== "string" || !raw.startsWith("data:image/")) {
      return raw;
    }
    try {
      const img = await new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error("Could not prepare image"));
        image.src = raw;
      });

      const scale = Math.min(1, maxWidth / img.naturalWidth, maxHeight / img.naturalHeight);
      const width = Math.max(1, Math.round(img.naturalWidth * scale));
      const height = Math.max(1, Math.round(img.naturalHeight * scale));

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d", { alpha: false });
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);

      return canvas.toDataURL("image/jpeg", quality);
    } catch (e) {
      console.warn("Base64 compression fallback", e);
      return raw;
    }
  }

  async function checkDueNotifications(reports, silentIfNoPermission = true) {
    const canNotify = "Notification" in window && Notification.permission === "granted";
    let changed = false;

    for (const report of reports) {
      const label = report.label || report.om || "Pending report";

      if (isEmailDue(report) && !report.emailNotifiedAt) {
        if (canNotify) {
          try {
            new Notification("Pending Report: Send Email", {
              body: `${label} has been pending for 4 days. Send an email follow-up.`
            });
          } catch (_) {}
        }
        if (canNotify || !silentIfNoPermission) {
          report.emailNotifiedAt = new Date().toISOString();
          changed = true;
        }
      }

      if (isFollowupDue(report) && !report.followupNotifiedAt) {
        if (canNotify) {
          try {
            new Notification("Pending Report: Need Follow-up", {
              body: `${label} has had no reply for 1 day. Follow up in Teams.`
            });
          } catch (_) {}
        }
        if (canNotify || !silentIfNoPermission) {
          report.followupNotifiedAt = new Date().toISOString();
          changed = true;
        }
      }
    }

    if (changed) {
      await saveReports(reports);
    }
    return changed;
  }

  const pendingService = {
    DB_NAME,
    STORE_NAME,
    STATE_KEY,
    DAY_MS,
    uid,
    clone,
    todayLocal,
    safeUrl,
    reportDateStart,
    reportAgeMs,
    isFollowupDue,
    isEmailDue,
    ageText,
    loadReports,
    saveReports,
    compressImage,
    compressBase64,
    checkDueNotifications,
    onChange(fn) {
      if (typeof fn === "function") listeners.push(fn);
    }
  };

  root.pendingService = pendingService;
})(window);
