/**
 * CCTV OPS V2 - Follow Up Reports Service
 * 1:1 Authoritative Functional Parity with V1 Follow Up Reports
 * Database: cctv_followup_reports_v1 | Store: workspace | Key: reports
 */
(function (root) {
  "use strict";

  const DB_NAME = "cctv_followup_reports_v1";
  const STORE_NAME = "workspace";
  const STATE_KEY = "reports";
  const CLOSED = new Set(["Resolved"]);
  const STATUSES = [
    "Waiting for TL",
    "TL Replied",
    "TL Disputed",
    "Need OM Verification",
    "Verified by OM",
    "Resolved"
  ];

  const listeners = [];

  function emitChange(reports) {
    listeners.forEach(fn => {
      try { fn(reports); } catch (e) { console.error("Followup change listener error:", e); }
    });
  }

  function uid() {
    return "fu_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 7);
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

  function formatDate(value) {
    if (!value) return "No date";
    const d = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(value + "T00:00:00") : new Date(value);
    if (Number.isNaN(d.getTime())) return value;
    return d.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
  }

  function safeWebUrl(value) {
    const raw = String(value || "").trim();
    if (!raw) return "";
    try {
      const url = new URL(raw);
      return /^https?:$/i.test(url.protocol) ? url.href : "";
    } catch (_) {
      return "";
    }
  }

  function statusClass(status) {
    const key = String(status || "").toLowerCase();
    if (key === "resolved") return "resolved";
    if (key.includes("disputed")) return "disputed";
    if (key.includes("verification")) return "verify";
    if (key.includes("verified")) return "verified";
    if (key.includes("replied")) return "replied";
    return "waiting";
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
    } catch (error) {
      console.warn("Follow Up Reports load failed:", error);
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
      return true;
    } finally {
      db.close();
    }
  }

  function compressImage(file) {
    return new Promise((resolve, reject) => {
      if (!file || !String(file.type || "").startsWith("image/")) {
        reject(new Error("Please choose an image file."));
        return;
      }
      const reader = new FileReader();
      reader.onerror = () => reject(reader.error || new Error("Could not read image."));
      reader.onload = () => {
        const img = new Image();
        img.onerror = () => reject(new Error("Could not decode image."));
        img.onload = () => {
          const maxW = 1800;
          const scale = Math.min(1, maxW / img.naturalWidth);
          const canvas = document.createElement("canvas");
          canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
          canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL("image/jpeg", 0.84));
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  function sortReports(reports) {
    return (reports || []).slice().sort((a, b) => {
      const aClosed = CLOSED.has(a.status) ? 1 : 0;
      const bClosed = CLOSED.has(b.status) ? 1 : 0;
      if (aClosed !== bClosed) return aClosed - bClosed;
      return String(b.date || "").localeCompare(String(a.date || "")) ||
             String(b.createdAt || "").localeCompare(String(a.createdAt || ""));
    });
  }

  function getOpenCount(reports) {
    return (reports || []).filter(r => !CLOSED.has(r.status)).length;
  }

  const followupService = {
    DB_NAME,
    STORE_NAME,
    STATE_KEY,
    CLOSED,
    STATUSES,

    todayLocal,
    formatDate,
    safeWebUrl,
    statusClass,
    sortReports,
    getOpenCount,
    compressImage,
    openDb,
    loadReports,
    saveReports,

    onChange(fn) {
      if (typeof fn === "function") listeners.push(fn);
      return () => {
        const idx = listeners.indexOf(fn);
        if (idx !== -1) listeners.splice(idx, 1);
      };
    },

    createReport({ date, om, label, cctvLink, status, remarks, screenshotData }) {
      return {
        id: uid(),
        date: date || todayLocal(),
        om: String(om || "").trim(),
        label: String(label || "").trim(),
        cctvLink: String(cctvLink || "").trim(),
        status: status || "Waiting for TL",
        remarks: String(remarks || "").trim(),
        screenshotData: screenshotData || "",
        createdAt: new Date().toISOString()
      };
    }
  };

  // Register history adapter
  root.__workspaceHistoryAdapters = root.__workspaceHistoryAdapters || {};
  root.__workspaceHistoryAdapters.followupReports = {
    label: "Follow Up Reports",
    async snapshot() {
      return await loadReports();
    },
    async restore(snapshot) {
      const restored = Array.isArray(snapshot) ? clone(snapshot) : [];
      await saveReports(restored);
      return restored;
    }
  };

  root.followupService = followupService;
  root.CCTV_FOLLOWUP = followupService;
})(window);
