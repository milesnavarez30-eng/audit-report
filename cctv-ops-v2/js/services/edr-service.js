/**
 * CCTV OPS V2 - EDR Service
 * Full manual EDR workflow, IndexedDB persistence, Google Docs sync, and Teams plain-text copy
 */

window.CCTV_EDR = (function () {
  "use strict";

  const cfg = window.CCTV_V2_CONFIG;
  const storage = window.CCTV_STORAGE;
  const DB_NAME = cfg.DATABASES.PENDING_REPORTS;
  const STORE_NAME = "state";
  const STATE_KEY = "reports";

  let edrReports = [];
  let currentScreenshotData = "";
  let editingId = null;
  let listeners = [];

  function uid() {
    return "edr_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8);
  }

  function clean(val) {
    return String(val == null ? "" : val).replace(/\s+/g, " ").trim();
  }

  function todayLocal() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function formatDate(dateStr) {
    if (!dateStr) return "";
    try {
      const parts = dateStr.split("-");
      if (parts.length === 3) {
        const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
        return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
      }
    } catch (_) {}
    return dateStr;
  }

  function formatFacebookDate(dateStr) {
    try {
      const d = new Date(dateStr + "T00:00:00");
      return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
    } catch (_) {
      return dateStr;
    }
  }

  function safeUrl(value) {
    const raw = clean(value);
    if (!raw) return "";
    try {
      const parsed = new URL(raw);
      if (!/^https?:$/.test(parsed.protocol)) return "";
      return parsed.href;
    } catch (_) {
      return "";
    }
  }

  function supervisorOutputLabel(report) {
    return report.supervisorRole === "OM" ? "OM" : "Team Leader";
  }

  function subjectOutputLabel(report) {
    return report.subjectType === "Team Leader" ? "Team Leader" : "Agent/s";
  }

  function reportPlainText(report) {
    const topLine = [report.site, "CCTV", report.account].filter(Boolean).join(" | ");
    const lines = [
      topLine,
      `Date: ${formatDate(report.date)}`,
      `Time Observed: ${report.timeObserved || report.timeStart || ""}`,
      `${supervisorOutputLabel(report)}: ${report.supervisorName || ""}`,
      `${subjectOutputLabel(report)}: ${report.subjectName || ""}`,
      `Account/Campaign: ${report.account || ""}`,
      `Incident: ${report.incident || ""}`,
      `Action Taken/Remarks: ${report.action || ""}`
    ];

    if (report.clipLink) {
      lines.push(`CCTV Clip: Click here! (${report.clipLink})`);
    }

    return lines.join("\n");
  }

  function reportHtml(report, includeImage = true) {
    const topLine = [report.site, "CCTV", report.account].filter(Boolean).join(" | ");
    const clipUrl = safeUrl(report.clipLink);
    const screenshot = includeImage && report.screenshotData
      ? `<div class="edr-preview-shot"><img src="${report.screenshotData}" alt="CCTV Screenshot" style="max-width:100%; border-radius:4px; margin-top:6px; border:1px solid var(--border-default);"></div>`
      : "";

    const clip = clipUrl
      ? `<div class="edr-preview-line"><strong>CCTV Clip:</strong> <a href="${clipUrl}" target="_blank" rel="noopener noreferrer">Click here!</a></div>`
      : "";

    return `
      <div class="edr-preview-card" style="padding:10px; border-bottom:1px solid var(--border-subtle); font-size:12px; line-height:1.4;">
        <div style="font-weight:700; color:var(--accent-primary); margin-bottom:4px;">${topLine}</div>
        <div class="edr-preview-line"><strong>Date:</strong> ${formatDate(report.date)}</div>
        <div class="edr-preview-line"><strong>Time Observed:</strong> ${report.timeObserved || report.timeStart || ""}</div>
        <div class="edr-preview-line"><strong>${supervisorOutputLabel(report)}:</strong> ${report.supervisorName || ""}</div>
        <div class="edr-preview-line"><strong>${subjectOutputLabel(report)}:</strong> ${report.subjectName || ""}</div>
        <div class="edr-preview-line"><strong>Account/Campaign:</strong> ${report.account || ""}</div>
        <div class="edr-preview-line"><strong>Incident:</strong> ${report.incident || ""}</div>
        <div class="edr-preview-line"><strong>Action Taken/Remarks:</strong> ${report.action || ""}</div>
        ${screenshot}
        ${clip}
      </div>
    `;
  }

  function notify() {
    listeners.forEach(fn => {
      try { fn(edrReports); } catch (e) { console.error(e); }
    });
  }

  return {
    async init() {
      await this.loadReports();
      return edrReports;
    },

    onChange(fn) {
      if (typeof fn === "function") {
        listeners.push(fn);
        fn(edrReports);
      }
    },

    getReports() {
      return edrReports;
    },

    getEditingReport() {
      return editingId ? edrReports.find(r => r.id === editingId) : null;
    },

    setEditingId(id) {
      editingId = id;
    },

    async loadReports() {
      try {
        // 1. Try reading from cctv_pending_reports_v1
        let saved = await storage.idbGet(DB_NAME, STORE_NAME, STATE_KEY, 1, (db) => {
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            db.createObjectStore(STORE_NAME);
          }
        });

        // 2. Fallback check: cctv_edr_workspace_v2 (snapshot key "current")
        if (!saved || (Array.isArray(saved) && !saved.length)) {
          try {
            const legacySnapshot = await storage.idbGet(cfg.DATABASES.EDR, "state", "current", 1);
            if (legacySnapshot) {
              const reports = legacySnapshot.value?.edrReports || legacySnapshot.edrReports || legacySnapshot.value;
              if (Array.isArray(reports) && reports.length) {
                saved = reports;
              }
            }
          } catch (_) {}
        }

        edrReports = Array.isArray(saved) ? saved : [];
      } catch (err) {
        console.warn("Could not load EDRs from IndexedDB, fallback to empty list:", err);
        edrReports = [];
      }
      notify();
      return edrReports;
    },

    async saveReports() {
      try {
        await storage.idbSet(DB_NAME, STORE_NAME, edrReports, STATE_KEY, 1, (db) => {
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            db.createObjectStore(STORE_NAME);
          }
        });
      } catch (err) {
        console.error("Could not persist EDRs to IndexedDB:", err);
      }
      notify();
    },

    async createOrUpdate(data) {
      let saved = null;
      if (editingId) {
        const idx = edrReports.findIndex(r => r.id === editingId);
        if (idx !== -1) {
          edrReports[idx] = {
            ...edrReports[idx],
            ...data,
            updatedAt: new Date().toISOString()
          };
          saved = edrReports[idx];
        }
        editingId = null;
      } else {
        saved = {
          id: uid(),
          selected: true,
          done: false,
          doneAt: "",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          ...data
        };
        edrReports.unshift(saved);
      }

      await this.saveReports();
      return saved;
    },

    async deleteReport(id) {
      edrReports = edrReports.filter(r => r.id !== id);
      if (editingId === id) editingId = null;
      await this.saveReports();
    },

    async toggleSelect(id, selected) {
      const rep = edrReports.find(r => r.id === id);
      if (rep && !rep.done) {
        rep.selected = typeof selected === "boolean" ? selected : !rep.selected;
        await this.saveReports();
      }
    },

    async selectAll(select = true) {
      edrReports.forEach(r => {
        if (!r.done) r.selected = select;
      });
      await this.saveReports();
    },

    async toggleDone(id) {
      const rep = edrReports.find(r => r.id === id);
      if (rep) {
        rep.done = !rep.done;
        rep.doneAt = rep.done ? new Date().toISOString() : "";
        if (rep.done) rep.selected = false;
        await this.saveReports();
      }
    },

    buildTeamsOutput(facebookText = "") {
      const activeSelected = edrReports.filter(r => r.selected && !r.done);
      const divider = "────────────────────────────────────────";

      const body = activeSelected.map(r => `${reportPlainText(r)}\n\n${divider}`).join("\n\n");
      let result = body;

      const fb = String(facebookText || "").trim();
      if (fb) {
        if (result) result += "\n\n";
        const fbDate = formatFacebookDate(todayLocal());
        result += `Facebook shared post ${fbDate}\n${fb}`;
      }

      return result.trim();
    },

    buildPreviewHtml(facebookText = "") {
      const activeSelected = edrReports.filter(r => r.selected && !r.done);
      if (!activeSelected.length && !facebookText.trim()) {
        return '<div style="color:var(--text-muted); font-size:12px; padding:12px; text-align:center;">Create or select active EDRs above to generate the Teams-ready output.</div>';
      }

      let html = activeSelected.map(r => reportHtml(r, true)).join("");
      const fb = String(facebookText || "").trim();
      if (fb) {
        const fbDate = formatFacebookDate(todayLocal());
        const links = fb.split(/\n+/).filter(Boolean).map(line => {
          const u = safeUrl(line);
          return u
            ? `<div><a href="${u}" target="_blank" rel="noopener noreferrer">${line}</a></div>`
            : `<div>${line}</div>`;
        }).join("");

        html += `
          <div style="padding:10px; font-size:12px; border-top:1px solid var(--border-subtle); margin-top:8px;">
            <div style="font-weight:700; color:var(--accent-primary); margin-bottom:4px;">Facebook shared post ${fbDate}</div>
            ${links}
          </div>
        `;
      }
      return html;
    },

    /**
     * Copy All to Microsoft Teams Clipboard
     * Strictly writes PLAIN TEXT ONLY. Never rich HTML or base64 screenshots.
     * Marks copied items as Done.
     */
    async copyAllToTeams(facebookText = "") {
      const activeSelected = edrReports.filter(r => r.selected && !r.done);
      const plainText = this.buildTeamsOutput(facebookText);

      // Strip any accidental data URL screenshot strings
      const safeText = plainText.replace(/data:image\/[a-zA-Z0-9.+-]+;base64,[A-Za-z0-9+/=]+/g, "").trim();

      if (!safeText) {
        throw new Error("No active selected EDRs or Facebook links to copy.");
      }

      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(safeText);
      } else {
        const ta = document.createElement("textarea");
        ta.value = safeText;
        ta.style.position = "fixed";
        ta.style.left = "-9999px";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        ta.remove();
      }

      // Mark copied reports as Done
      const now = new Date().toISOString();
      activeSelected.forEach(r => {
        r.done = true;
        r.doneAt = now;
        r.selected = false;
      });

      await this.saveReports();
      return activeSelected.length;
    },

    // Google Docs Receiver Web App Integration
    getDocsUrl() {
      return storage.getItem(cfg.KEYS.EDR_DOCS_URL, "") || "";
    },

    setDocsUrl(url) {
      storage.setItem(cfg.KEYS.EDR_DOCS_URL, String(url || "").trim());
    },

    async syncToGoogleDocs(report) {
      const url = this.getDocsUrl();
      if (!url || !/^https:\/\/script\.google\.com\/macros\/s\/.+\/exec$/i.test(url)) {
        return { success: false, reason: "No valid Google Apps Script Web App URL configured." };
      }

      try {
        const payload = {
          action: "save_edr",
          report: {
            ...report,
            formattedDate: formatDate(report.date)
          }
        };

        const res = await fetch(url, {
          method: "POST",
          mode: "no-cors",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });

        report.cloudSynced = true;
        await this.saveReports();
        return { success: true };
      } catch (err) {
        console.warn("EDR Google Docs sync failed:", err);
        return { success: false, error: err };
      }
    }
  };
})();
