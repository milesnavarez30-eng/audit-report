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
  let currentFacebookText = "";
  let currentFormDraft = null;
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

  // Exact V1 Site & Auditor Normalization
  function normalizeTrackerSite(raw) {
    if (typeof window.normalizeTrackerSite === "function" && window.normalizeTrackerSite !== normalizeTrackerSite) {
      return window.normalizeTrackerSite(raw);
    }
    const text = String(raw || "").trim().toLowerCase();
    if (
      text.includes("mabini site b") || 
      text.includes("site b") || 
      text === "mabini_b" ||
      (text.includes("mabini") && (text.includes("3rd") || text.includes("4th")))
    ) {
      return "Mabini Site B";
    }
    if (
      text.includes("mabini site a") || 
      text.includes("site a") || 
      text === "mabini_a" ||
      text.includes("mabini a") ||
      (text.includes("mabini") && (text.includes("1st") || text.includes("2nd") || text.includes("1f") || text.includes("2f")))
    ) {
      return "Mabini Site A";
    }
    if (text.includes("maa") || text.startsWith("maa_")) return "Maa";
    if (text.includes("gensan")) return "Gensan";
    if (text.includes("ecoland")) return "Ecoland";
    if (text.includes("digos")) return "Digos";
    if (text.includes("cdo")) return "CDO";
    return raw ? raw.trim() : "Mabini Site A";
  }
  if (!window.normalizeTrackerSite) window.normalizeTrackerSite = normalizeTrackerSite;

  function normalizeAuditorName(raw) {
    if (typeof window.normalizeAuditorName === "function" && window.normalizeAuditorName !== normalizeAuditorName) {
      return window.normalizeAuditorName(raw);
    }
    if (raw && typeof raw === "object") {
      raw = raw.name || raw.display_name || raw.username || raw.full_name || "";
    }
    const text = String(raw || "").trim().toLowerCase();
    if (text.includes("miles") || text.includes("mico")) return "Miles";
    if (text.includes("wendie") || text.includes("amor")) return "Wendie";
    if (text.includes("seth")) return "Seth";
    if (text.includes("john ric") || text === "jr" || text.includes("john")) return "John Ric";
    if (text.includes("kenneth")) return "Kenneth";
    return raw ? String(raw).trim().split(/\s+/)[0] : "Miles";
  }
  if (!window.normalizeAuditorName) window.normalizeAuditorName = normalizeAuditorName;

  // Exact V1 Field Mappers for CCTV Audit
  function auditSiteFromEdr(site) {
    const value = String(site || "").trim();
    return normalizeTrackerSite(value);
  }

  function auditReasonFromEdr(report) {
    const text = [
      report?.incident,
      report?.action
    ].filter(Boolean).join(" ").toUpperCase();

    const rules = [
      [/SLEEP|SLEEPING/, "SLEEPING"],
      [/DRESS\s*CODE|UNIFORM|ATTIRE/, "DRESS CODE"],
      [/BROWS|BROWSER|WEBSITE/, "BROWSING"],
      [/WASTING\s*TIME|IDLE|LOITER/, "WASTING TIME"],
      [/NON[-\s]*WOF|NON\s*WOF/, "BRINGING NON-WOF"],
      [/EAT|FOOD|MEAL/, "EATING"],
      [/HOUSE\s*KEEP|HOUSEKEEP|CLEANLINESS/, "IMPROPER HOUSE KEEPING"],
      [/TAMPER|EQUIPMENT/, "EQUIPMENT TAMPERING"],
      [/\bPDA\b|PUBLIC DISPLAY/, "PDA"],
      [/DISORDER|DISRUPT/, "DISORDERLY CONDUCT"],
      [/SMART\s*PHONE|SMARTPHONE|CELLPHONE|MOBILE\s*PHONE|PHONE/, "USING SMARTPHONE"],
      [/THEFT|STEAL/, "THEFT"],
      [/SELL|VEND/, "SELLING"]
    ];

    for (const [pattern, reason] of rules) {
      if (pattern.test(text)) return reason;
    }

    return "OTHER / EDR";
  }

  function ensureAuditDropdownValue(selectId, value) {
    const text = String(value || "").trim();
    if (!text || text === "N/A") return;
    const storageKey = `cctv_dropdown_${selectId}`;
    let list = storage.getItem(storageKey, []);
    if (!Array.isArray(list)) list = [];
    if (!list.includes(text)) {
      list.push(text);
      list.sort((a, b) => a.localeCompare(b));
      storage.setItem(storageKey, list);
    }
  }

  function auditSharedFieldsFromEdr(report) {
    const supervisorRole =
      report?.supervisorRole === "OM"
        ? "OM"
        : "Team Leader";

    const subjectType =
      report?.subjectType === "Team Leader"
        ? "Team Leader"
        : "Agent/s";

    const tlName =
      subjectType === "Team Leader"
        ? (report?.subjectName || "N/A")
        : (
          supervisorRole === "Team Leader"
            ? (report?.supervisorName || "N/A")
            : "N/A"
        );

    const agentName =
      subjectType === "Agent/s"
        ? (report?.subjectName || "N/A")
        : "N/A";

    const omName =
      String(report?.omName || "").trim() ||
      (supervisorRole === "OM" ? (report?.supervisorName || "N/A") : "N/A");

    const rawDate = report?.date || new Date().toISOString().slice(0, 10);
    const dateObj = new Date(`${rawDate}T00:00:00`);
    const months = [
      "Jan", "Feb", "Mar", "Apr", "May", "Jun",
      "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
    ];

    const currentAuditor = window.normalizeAuditorName ? window.normalizeAuditorName(
      window.CCTV_ACCOUNT_CONTEXT?.profile?.display_name ||
      window.CCTV_ACCOUNT_CONTEXT?.profile?.username ||
      window.CCTV_AUTH?.getProfile?.()?.display_name ||
      window.CCTV_AUTH?.getProfile?.()?.username ||
      "Miles"
    ) : "Miles";

    return {
      rawDate,
      year: dateObj.getFullYear(),
      month: months[dateObj.getMonth()],
      formattedDate: `${dateObj.getMonth() + 1}/${dateObj.getDate()}/${dateObj.getFullYear()}`,
      auditorName: currentAuditor,
      name: currentAuditor,
      omName,
      site: auditSiteFromEdr(report?.site),
      tlName,
      agentName,
      cleanAccount: report?.account || "N/A",
      reasonCode: auditReasonFromEdr(report)
    };
  }

  // Global CCTV Audit Bridge (Reused from V1)
  window.cctvAuditBridge = {
    findByEdrId(edrId) {
      const entryList = storage.getItem(cfg.KEYS.ENTRY_LIST, []);
      return (Array.isArray(entryList) && entryList.find(entry => entry.sourceEdrId === edrId)) || null;
    },

    hasEdr(edrId) {
      const entryList = storage.getItem(cfg.KEYS.ENTRY_LIST, []);
      return Array.isArray(entryList) && entryList.some(entry => entry.sourceEdrId === edrId);
    },

    countSentFromEdr() {
      const entryList = storage.getItem(cfg.KEYS.ENTRY_LIST, []);
      return Array.isArray(entryList) ? entryList.filter(entry => !!entry.sourceEdrId).length : 0;
    },

    sendFromEdr(report) {
      if (!report?.id) {
        throw new Error("EDR record is missing an ID.");
      }

      const shared = auditSharedFieldsFromEdr(report);

      ensureAuditDropdownValue("site", shared.site);
      ensureAuditDropdownValue("omName", shared.omName);
      ensureAuditDropdownValue("account", shared.cleanAccount);
      ensureAuditDropdownValue("reasonCode", shared.reasonCode);

      let entryList = storage.getItem(cfg.KEYS.ENTRY_LIST, []);
      if (!Array.isArray(entryList)) entryList = [];

      const existingIndex = entryList.findIndex(
        entry => entry.sourceEdrId === report.id
      );

      if (existingIndex === -1) {
        const entry = {
          ...shared,
          noc: "Pending",
          remarks: String(report.action || report.incident || "N/A").trim() || "N/A",
          sourceEdrId: report.id,
          sourceEdrUpdatedAt: report.updatedAt || "",
          sourceEdrReasonAuto: true
        };

        entryList.push(entry);
        entryList.sort((a, b) => new Date(a.rawDate || a.date) - new Date(b.rawDate || b.date));
        storage.setItem(cfg.KEYS.ENTRY_LIST, entryList);

        return { action: "created", entry };
      }

      const previous = entryList[existingIndex];

      entryList[existingIndex] = {
        ...previous,
        ...shared,
        noc: previous.noc || "Pending",
        remarks: previous.remarks || "N/A",
        reasonCode:
          previous.sourceEdrReasonAuto === false
            ? previous.reasonCode
            : shared.reasonCode,
        sourceEdrId: report.id,
        sourceEdrUpdatedAt: report.updatedAt || "",
        sourceEdrReasonAuto: previous.sourceEdrReasonAuto !== false
      };

      entryList.sort((a, b) => new Date(a.rawDate || a.date) - new Date(b.rawDate || b.date));
      storage.setItem(cfg.KEYS.ENTRY_LIST, entryList);

      return {
        action: "updated",
        entry: entryList[existingIndex]
      };
    }
  };

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
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
      lines.push(`CCTV Clip: ${report.clipLink}`);
    }

    return lines.join("\n");
  }

  function reportTeamsHtml(report) {
    const topLine = [report.site, "CCTV", report.account].filter(Boolean).join(" | ");
    const clipUrl = safeUrl(report.clipLink);
    const clip = clipUrl
      ? `<div>CCTV Clip: <a href="${escapeHtml(clipUrl)}">Click here!</a></div>`
      : "";

    return `
      <div>${escapeHtml(topLine)}</div>
      <div>Date: ${escapeHtml(formatDate(report.date))}</div>
      <div>Time Observed: ${escapeHtml(report.timeObserved || report.timeStart || "")}</div>
      <div>${escapeHtml(supervisorOutputLabel(report))}: ${escapeHtml(report.supervisorName || "")}</div>
      <div>${escapeHtml(subjectOutputLabel(report))}: ${escapeHtml(report.subjectName || "")}</div>
      <div>Account/Campaign: ${escapeHtml(report.account || "")}</div>
      <div>Incident: ${escapeHtml(report.incident || "")}</div>
      <div>Action Taken/Remarks: ${escapeHtml(report.action || "")}</div>
      ${clip}
    `.trim();
  }

  function buildTeamsHtml(facebookText = "") {
    const activeSelected = edrReports.filter(r => r.selected && !r.done);
    if (!activeSelected.length) return "";

    const dividerHtml = '<div><br>────────────────────────────────────────<br><br></div>';
    const edrBodyHtml = activeSelected.map(r => reportTeamsHtml(r)).join(dividerHtml);

    let fbHtml = "";
    const fb = String(facebookText || "").trim();
    if (fb) {
      const fbDate = formatFacebookDate(todayLocal());
      const fbLines = fb.split(/\n+/).map(l => clean(l)).filter(Boolean).map(line => {
        const u = safeUrl(line);
        return u
          ? `<div><a href="${escapeHtml(u)}">${escapeHtml(line)}</a></div>`
          : `<div>${escapeHtml(line)}</div>`;
      }).join("");

      fbHtml = `<div><br><strong>Facebook shared post ${escapeHtml(fbDate)}</strong></div>${fbLines}`;
    }

    return `
      <div style="font-family:Arial,sans-serif;font-size:10pt;color:#111;line-height:1.4;">
        ${edrBodyHtml}
        ${fbHtml}
      </div>
    `.trim();
  }

  async function dataUrlToPngBlob(dataUrl) {
    if (!dataUrl || typeof dataUrl !== "string" || !dataUrl.startsWith("data:image/")) {
      return null;
    }
    try {
      const res = await fetch(dataUrl);
      const blob = await res.blob();
      if (blob.type === "image/png") {
        return blob;
      }
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
      console.warn("dataUrlToPngBlob error:", err);
      return null;
    }
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
        // 1. Primary V1 authoritative workspace: cctv_edr_workspace_v2 (store: 'state', key: 'current')
        const workspace = await this.readWorkspaceDb();
        if (workspace && Array.isArray(workspace.reports)) {
          edrReports = workspace.reports;
          if (typeof workspace.facebookText === "string") {
            currentFacebookText = workspace.facebookText;
          }
          if (workspace.form && typeof workspace.form === "object") {
            currentFormDraft = workspace.form;
          }
        } else {
          // 2. Fallback check: cctv_pending_reports_v1
          let saved = await storage.idbGet(DB_NAME, STORE_NAME, STATE_KEY, 1, (db) => {
            if (!db.objectStoreNames.contains(STORE_NAME)) {
              db.createObjectStore(STORE_NAME);
            }
          });
          edrReports = Array.isArray(saved) ? saved : [];
        }
      } catch (err) {
        console.warn("Could not load EDRs from IndexedDB, fallback to empty list:", err);
        edrReports = [];
      }
      notify();
      return edrReports;
    },

    async openWorkspaceDb() {
      const dbName = cfg.DATABASES.EDR || "cctv_edr_workspace_v2";
      return new Promise((resolve, reject) => {
        const req = indexedDB.open(dbName, 1);
        req.onupgradeneeded = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains("state")) {
            db.createObjectStore("state", { keyPath: "key" });
          }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    },

    async readWorkspaceDb() {
      try {
        const db = await this.openWorkspaceDb();
        return new Promise((resolve) => {
          const tx = db.transaction("state", "readonly");
          const req = tx.objectStore("state").get("current");
          req.onsuccess = () => {
            const val = req.result ? req.result.value : null;
            resolve(val);
          };
          req.onerror = () => resolve(null);
          tx.oncomplete = () => db.close();
        });
      } catch (err) {
        console.warn("readWorkspaceDb error:", err);
        return null;
      }
    },

    async writeWorkspaceDb(stateObj) {
      try {
        const db = await this.openWorkspaceDb();
        return new Promise((resolve, reject) => {
          const tx = db.transaction("state", "readwrite");
          tx.objectStore("state").put({ key: "current", value: stateObj });
          tx.oncomplete = () => {
            db.close();
            resolve(true);
          };
          tx.onerror = () => {
            db.close();
            reject(tx.error);
          };
        });
      } catch (err) {
        console.error("writeWorkspaceDb error:", err);
      }
    },

    async saveReports() {
      try {
        // 1. Authoritative write to cctv_edr_workspace_v2
        const workspaceState = {
          reports: edrReports,
          facebookText: currentFacebookText,
          form: currentFormDraft,
          tlOptions: this.getTeamLeaderNames(),
          omOptions: this.getOmNames(),
          accountOptions: this.getAccountNames(),
          savedAt: new Date().toISOString()
        };
        await this.writeWorkspaceDb(workspaceState);

        // 2. Dual-save to cctv_pending_reports_v1 for backward compatibility
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

    // Draft Management
    getDraftForm() {
      return currentFormDraft ? { ...currentFormDraft } : null;
    },

    async saveDraftForm(formData) {
      currentFormDraft = { ...formData };
      await this.saveReports();
    },

    async clearDraftForm() {
      currentFormDraft = null;
      await this.saveReports();
    },

    getFacebookText() {
      return currentFacebookText || "";
    },

    async saveFacebookText(text) {
      currentFacebookText = String(text || "");
      await this.saveReports();
    },

    async createOrUpdate(data) {
      let saved = null;
      if (editingId) {
        const idx = edrReports.findIndex(r => r.id === editingId);
        if (idx !== -1) {
          edrReports[idx] = {
            ...edrReports[idx],
            ...data,
            screenshotChanged: data.screenshotData !== edrReports[idx].screenshotData,
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
          cloudSynced: false,
          screenshotChanged: !!data.screenshotData,
          screenshotFileId: "",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          ...data
        };
        edrReports.unshift(saved);
      }

      await this.saveReports();

      // Auto sync with Google Docs if connected
      if (saved && this.isValidDocsUrl(this.getDocsUrl())) {
        this.syncReportToGoogleDocs(saved).catch(err => console.warn("Google Docs auto-sync failed:", err));
      }

      return saved;
    },

    async deleteReport(id) {
      edrReports = edrReports.filter(r => r.id !== id);
      if (editingId === id) editingId = null;
      await this.saveReports();

      // Delete from Google Docs if connected
      if (this.isValidDocsUrl(this.getDocsUrl())) {
        this.deleteReportFromGoogleDocs(id).catch(err => console.warn("Google Docs delete failed:", err));
      }
    },

    async toggleSelect(id, selected) {
      const rep = edrReports.find(r => r.id === id);
      if (rep && !rep.done) {
        rep.selected = typeof selected === "boolean" ? selected : !rep.selected;
        if (rep.selected && !rep.screenshotData && rep.screenshotFileId) {
          await this.ensureRemoteScreenshot(rep);
        }
        await this.saveReports();
      }
    },

    async selectAll(select = true) {
      for (const r of edrReports) {
        if (!r.done) {
          r.selected = select;
          if (select && !r.screenshotData && r.screenshotFileId) {
            await this.ensureRemoteScreenshot(r);
          }
        }
      }
      await this.saveReports();
    },

    async toggleDone(id) {
      const rep = edrReports.find(r => r.id === id);
      if (rep) {
        rep.done = !rep.done;
        rep.doneAt = rep.done ? new Date().toISOString() : "";
        if (rep.done) rep.selected = false;
        await this.saveReports();
        if (this.isValidDocsUrl(this.getDocsUrl())) {
          this.syncReportToGoogleDocs(rep).catch(() => {});
        }
      }
    },

    // Saved Report Screenshot Modifiers
    async attachScreenshotToReport(id, dataUrl) {
      const rep = edrReports.find(r => r.id === id);
      if (!rep) throw new Error("Report not found.");
      rep.screenshotData = dataUrl || "";
      rep.screenshotChanged = true;
      rep.updatedAt = new Date().toISOString();
      await this.saveReports();
      if (this.isValidDocsUrl(this.getDocsUrl())) {
        await this.syncReportToGoogleDocs(rep);
      }
      return rep;
    },

    async removeScreenshotFromReport(id) {
      const rep = edrReports.find(r => r.id === id);
      if (!rep) throw new Error("Report not found.");
      rep.screenshotData = "";
      rep.screenshotFileId = "";
      rep.screenshotChanged = true;
      rep.updatedAt = new Date().toISOString();
      await this.saveReports();
      if (this.isValidDocsUrl(this.getDocsUrl())) {
        await this.syncReportToGoogleDocs(rep);
      }
      return rep;
    },

    buildTeamsOutput(facebookText = "") {
      const activeSelected = edrReports.filter(r => r.selected && !r.done);
      const divider = "────────────────────────────────────────";

      const body = activeSelected.map(r => `${reportPlainText(r)}\n\n${divider}`).join("\n\n");
      let result = body;

      const fb = String(facebookText || currentFacebookText || "").trim();
      if (fb) {
        if (result) result += "\n\n";
        const fbDate = formatFacebookDate(todayLocal());
        result += `Facebook shared post ${fbDate}\n${fb}`;
      }

      return result.trim();
    },

    buildTeamsHtml(facebookText = "") {
      return buildTeamsHtml(facebookText || currentFacebookText);
    },

    buildPreviewHtml(facebookText = "") {
      const activeSelected = edrReports.filter(r => r.selected && !r.done);
      const fb = String(facebookText || currentFacebookText || "").trim();
      if (!activeSelected.length && !fb) {
        return '<div style="color:var(--text-muted); font-size:12px; padding:12px; text-align:center;">Create or select active EDRs above to generate the Teams-ready output.</div>';
      }

      let html = activeSelected.map(r => reportHtml(r, true)).join("");
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
     * Multi-MIME with text/plain, minimal text/html (hyperlinks), and native image/png Blob.
     * Never puts Base64 into HTML.
     */
    async copyAllToTeams(facebookText = "") {
      const activeSelected = edrReports.filter(r => r.selected && !r.done);
      if (!activeSelected.length) {
        throw new Error("No active selected EDRs to copy.");
      }

      // Ensure remote screenshots are loaded
      for (const report of activeSelected) {
        if (!report.screenshotData && report.screenshotFileId) {
          await this.ensureRemoteScreenshot(report);
        }
      }

      const fb = facebookText || currentFacebookText;
      const plainText = this.buildTeamsOutput(fb);
      const safePlainText = plainText.replace(/data:image\/[a-zA-Z0-9.+-]+;base64,[A-Za-z0-9+/=]+/g, "").trim();
      const minimalHtml = buildTeamsHtml(fb);

      // Check if any selected report has a screenshot
      let screenshotBlob = null;
      const firstWithShot = activeSelected.find(r => r.screenshotData);
      if (firstWithShot && firstWithShot.screenshotData) {
        screenshotBlob = await dataUrlToPngBlob(firstWithShot.screenshotData);
      }

      let wroteSuccessfully = false;
      let wroteWithImage = false;

      // Preferred multi-MIME ClipboardItem write
      if (window.ClipboardItem && navigator.clipboard && navigator.clipboard.write) {
        try {
          const clipboardData = {
            "text/plain": new Blob([safePlainText], { type: "text/plain" }),
            "text/html": new Blob([minimalHtml], { type: "text/html" })
          };
          if (screenshotBlob) {
            clipboardData["image/png"] = screenshotBlob;
          }
          await navigator.clipboard.write([
            new ClipboardItem(clipboardData)
          ]);
          wroteSuccessfully = true;
          wroteWithImage = !!screenshotBlob;
        } catch (err) {
          console.warn("ClipboardItem multi-MIME with image failed, attempting text/html + text/plain fallback:", err);
          try {
            await navigator.clipboard.write([
              new ClipboardItem({
                "text/plain": new Blob([safePlainText], { type: "text/plain" }),
                "text/html": new Blob([minimalHtml], { type: "text/html" })
              })
            ]);
            wroteSuccessfully = true;
          } catch (err2) {
            console.warn("ClipboardItem text fallback failed:", err2);
          }
        }
      }

      if (!wroteSuccessfully) {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(safePlainText);
          wroteSuccessfully = true;
        } else {
          const ta = document.createElement("textarea");
          ta.value = safePlainText;
          ta.style.position = "fixed";
          ta.style.left = "-9999px";
          document.body.appendChild(ta);
          ta.select();
          document.execCommand("copy");
          ta.remove();
          wroteSuccessfully = true;
        }
      }

      // Mark copied reports as Done
      const now = new Date().toISOString();
      activeSelected.forEach(r => {
        r.done = true;
        r.doneAt = now;
        r.selected = false;
      });

      await this.saveReports();

      // Cloud sync if connected
      if (this.isValidDocsUrl(this.getDocsUrl())) {
        activeSelected.forEach(r => this.syncReportToGoogleDocs(r).catch(() => {}));
      }

      return {
        count: activeSelected.length,
        hasScreenshot: !!screenshotBlob,
        wroteWithImage: wroteWithImage
      };
    },

    async copyScreenshot(reportOrDataUrl) {
      let dataUrl = "";
      if (typeof reportOrDataUrl === "string") {
        dataUrl = reportOrDataUrl;
      } else if (reportOrDataUrl && reportOrDataUrl.screenshotData) {
        dataUrl = reportOrDataUrl.screenshotData;
      } else if (reportOrDataUrl && reportOrDataUrl.screenshotFileId) {
        await this.ensureRemoteScreenshot(reportOrDataUrl);
        dataUrl = reportOrDataUrl.screenshotData;
      } else {
        const sel = edrReports.find(r => r.selected && !r.done && (r.screenshotData || r.screenshotFileId));
        if (sel) {
          if (!sel.screenshotData && sel.screenshotFileId) {
            await this.ensureRemoteScreenshot(sel);
          }
          dataUrl = sel.screenshotData;
        }
      }

      if (!dataUrl) {
        throw new Error("No screenshot found to copy.");
      }

      const pngBlob = await dataUrlToPngBlob(dataUrl);
      if (!pngBlob) {
        throw new Error("Failed to process screenshot as PNG image.");
      }

      if (!window.ClipboardItem || !navigator.clipboard || !navigator.clipboard.write) {
        throw new Error("Browser clipboard does not support native image copying.");
      }

      await navigator.clipboard.write([
        new ClipboardItem({
          "image/png": pngBlob
        })
      ]);

      return true;
    },

    dataUrlToBlob(dataUrl) {
      return dataUrlToPngBlob(dataUrl);
    },

    getTeamLeaderNames() {
      return window.getTeamLeaderNames ? window.getTeamLeaderNames() : (cfg.DEFAULTS.TLS || []);
    },

    getOmNames() {
      return window.getOmNames ? window.getOmNames() : (cfg.DEFAULTS.OMS || []);
    },

    getAccountNames() {
      return window.getAccountNames ? window.getAccountNames() : (cfg.DEFAULTS.ACCOUNTS || []);
    },

    // Option Management
    addSupervisorOption(role, name) {
      if (window.addCustomOption) {
        return window.addCustomOption(role === "OM" ? "oms" : "tls", name);
      }
      return false;
    },

    removeSupervisorOption(role, name) {
      if (window.removeCustomOption) {
        return window.removeCustomOption(role === "OM" ? "oms" : "tls", name);
      }
      return false;
    },

    addAccountOption(name) {
      if (window.addCustomOption) {
        return window.addCustomOption("accounts", name);
      }
      return false;
    },

    removeAccountOption(name) {
      if (window.removeCustomOption) {
        return window.removeCustomOption("accounts", name);
      }
      return false;
    },

    // Google Docs Receiver Web App Integration (V1 JSONP & POST Parity)
    getDocsUrl() {
      return String(localStorage.getItem(cfg.KEYS.EDR_DOCS_URL) || "").trim();
    },

    setDocsUrl(url) {
      const cleanUrl = String(url || "").trim();
      localStorage.setItem(cfg.KEYS.EDR_DOCS_URL, cleanUrl);
      return cleanUrl;
    },

    clearDocsUrl() {
      localStorage.removeItem(cfg.KEYS.EDR_DOCS_URL);
    },

    isValidDocsUrl(value) {
      return /^https:\/\/script\.google\.com\/macros\/s\/[^/]+\/exec(?:\?.*)?$/i.test(
        String(value || "").trim()
      );
    },

    edrDocsJsonp(params = {}, overrideUrl = "") {
      const url = String(overrideUrl || this.getDocsUrl()).trim();

      if (!this.isValidDocsUrl(url)) {
        return Promise.reject(new Error("Google Docs Web App URL is not configured."));
      }

      return new Promise((resolve, reject) => {
        const callbackName =
          "__edrDocsCb_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 7);

        const query = new URLSearchParams({
          ...params,
          callback: callbackName,
          _: String(Date.now())
        });

        const script = document.createElement("script");
        let timeoutId = null;

        function cleanup() {
          clearTimeout(timeoutId);
          script.remove();
          try { delete window[callbackName]; } catch (_) { window[callbackName] = undefined; }
        }

        window[callbackName] = payload => {
          cleanup();

          if (!payload || payload.ok === false) {
            reject(new Error(payload?.error || "Google Docs sync request failed."));
            return;
          }

          resolve(payload);
        };

        script.onerror = () => {
          cleanup();
          reject(new Error("Could not reach the Google Docs Apps Script Web App."));
        };

        timeoutId = setTimeout(() => {
          cleanup();
          reject(new Error("Google Docs sync timed out."));
        }, 20000);

        script.src = url + (url.includes("?") ? "&" : "?") + query.toString();
        document.head.appendChild(script);
      });
    },

    async testDocsConnection(urlOverride = "") {
      const typedUrl = String(urlOverride || this.getDocsUrl()).trim();

      if (!this.isValidDocsUrl(typedUrl)) {
        throw new Error("Web App URL must end in /exec.");
      }

      const payload = await this.edrDocsJsonp({ action: "ping" }, typedUrl);
      return payload;
    },

    cloudRecordPayload(report) {
      return {
        id: report.id,
        site: report.site || "",
        date: report.date || "",
        timeObserved: report.timeObserved || report.timeStart || "",
        timeStart: report.timeObserved || report.timeStart || "",
        timeEnd: "",
        supervisorRole: report.supervisorRole || "Team Leader",
        supervisorName: report.supervisorName || "",
        omName: report.omName || "",
        subjectType: report.subjectType || "Agent/s",
        subjectName: report.subjectName || "",
        account: report.account || "",
        incident: report.incident || "",
        action: report.action || "",
        clipLink: report.clipLink || "",
        screenshotData: report.screenshotData || "",
        screenshotChanged: !!report.screenshotChanged,
        screenshotFileId: report.screenshotFileId || "",
        done: !!report.done,
        doneAt: report.doneAt || "",
        createdAt: report.createdAt || "",
        updatedAt: new Date().toISOString()
      };
    },

    normalizeCloudRecord(record) {
      return {
        id: record.id || uid(),
        selected: false,
        done: !!record.done,
        doneAt: record.doneAt || "",
        expanded: false,
        cloudSynced: true,
        screenshotData: record.screenshotData || "",
        screenshotFileId: record.screenshotFileId || "",
        screenshotChanged: false,
        site: record.site || "Mabini Site A - 1st Floor",
        date: record.date || "",
        timeObserved: record.timeObserved || record.timeStart || "",
        timeStart: record.timeObserved || record.timeStart || "",
        timeEnd: record.timeEnd || "",
        supervisorRole: record.supervisorRole || "Team Leader",
        supervisorName: record.supervisorName || "",
        omName: record.omName || "",
        subjectType: record.subjectType || "Agent/s",
        subjectName: record.subjectName || "",
        account: record.account || "",
        incident: record.incident || "",
        action: record.action || "",
        clipLink: record.clipLink || "",
        createdAt: record.createdAt || "",
        updatedAt: record.updatedAt || ""
      };
    },

    async loadSavedEdrsFromDocs() {
      const url = this.getDocsUrl();
      if (!this.isValidDocsUrl(url)) {
        throw new Error("Google Docs Web App URL is not configured or invalid.");
      }

      const payload = await this.edrDocsJsonp({
        action: "list",
        limit: "250"
      });

      const remote = Array.isArray(payload.records)
        ? payload.records.map(r => this.normalizeCloudRecord(r))
        : [];

      const localMap = new Map(edrReports.map(item => [item.id, item]));
      const merged = [];

      remote.forEach(remoteItem => {
        const local = localMap.get(remoteItem.id);
        if (local) {
          merged.push({
            ...remoteItem,
            ...local,
            screenshotFileId: local.screenshotFileId || remoteItem.screenshotFileId || "",
            cloudSynced: true
          });
          localMap.delete(remoteItem.id);
        } else {
          merged.push(remoteItem);
        }
      });

      // Keep unsynced local entries
      localMap.forEach(local => merged.push(local));

      edrReports = merged;
      await this.saveReports();
      return { count: remote.length, total: edrReports.length };
    },

    async fetchFullCloudRecord(id) {
      const payload = await this.edrDocsJsonp({
        action: "get",
        id
      });

      if (!payload.record) {
        throw new Error("Saved EDR was not found in Google Docs.");
      }

      return this.normalizeCloudRecord(payload.record);
    },

    async ensureRemoteScreenshot(report) {
      if (!report || report.screenshotData || !report.screenshotFileId) {
        return report;
      }

      if (!this.isValidDocsUrl(this.getDocsUrl())) {
        return report;
      }

      try {
        const full = await this.fetchFullCloudRecord(report.id);
        if (full.screenshotData) {
          report.screenshotData = full.screenshotData;
          await this.saveReports();
        }
        return report;
      } catch (err) {
        console.warn("ensureRemoteScreenshot failed:", err);
        return report;
      }
    },

    async syncReportToGoogleDocs(report) {
      const url = this.getDocsUrl();
      if (!this.isValidDocsUrl(url)) {
        return { success: false, reason: "Google Docs Web App URL is not configured." };
      }

      try {
        const payload = {
          action: "upsertEdr",
          record: this.cloudRecordPayload(report)
        };

        await fetch(url, {
          method: "POST",
          mode: "no-cors",
          headers: { "Content-Type": "text/plain;charset=utf-8" },
          body: JSON.stringify(payload)
        });

        report.screenshotChanged = false;
        report.cloudSynced = true;
        await this.saveReports();
        return { success: true };
      } catch (err) {
        console.warn("Google Docs upsert failed:", err);
        report.cloudSynced = false;
        return { success: false, error: err };
      }
    },

    async deleteReportFromGoogleDocs(id) {
      const url = this.getDocsUrl();
      if (!this.isValidDocsUrl(url)) return false;

      try {
        await fetch(url, {
          method: "POST",
          mode: "no-cors",
          headers: { "Content-Type": "text/plain;charset=utf-8" },
          body: JSON.stringify({
            action: "deleteEdr",
            id
          })
        });
        return true;
      } catch (err) {
        console.warn("Google Docs delete failed:", err);
        return false;
      }
    },

    // Single-report CCTV Audit Export
    sendReportToAudit(report) {
      if (!report) throw new Error("No report specified.");
      if (!window.cctvAuditBridge?.sendFromEdr) {
        throw new Error("CCTV Audit bridge is not ready.");
      }
      const result = window.cctvAuditBridge.sendFromEdr(report);
      notify();
      return result;
    },

    isReportInAudit(reportId) {
      return !!window.cctvAuditBridge?.hasEdr(reportId);
    }
  };
})();
