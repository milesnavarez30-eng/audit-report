/**
 * CCTV OPS V2 - CCTV Audit & Smart Audit Guard Service
 * 100% Functional Parity with Authoritative V1 Audit Engine
 */

window.CCTV_AUDIT = (function () {
  "use strict";

  const cfg = window.CCTV_V2_CONFIG;
  const storage = window.CCTV_STORAGE;
  const STORAGE_KEY = cfg.KEYS.ENTRY_LIST || "cctv_entry_list";

  // Smart Audit Guard Constants
  const GUARD_DB_NAME = "cctv_tracker_guard_v1";
  const GUARD_DB_STORE = "snapshots";
  const GUARD_DB_KEY = "current";
  const ALLOWED_NOC = new Set(["yes", "no", "pending", "disputed"]);
  const TRACKER_FIELDS = ["year", "month", "date", "auditor", "om", "site", "tl", "agent", "account", "reason", "noc", "remarks"];
  const CORE_FIELDS = ["date", "om", "site", "tl", "agent", "account", "reason", "noc"];

  let entryList = [];
  let editingIndex = -1;
  let listeners = [];

  // Smart Audit Guard state
  let trackerSnapshot = null;
  let trackerRows = [];
  let trackerAnalysis = { duplicateGroups: [], issues: [] };
  let guardListeners = [];

  function cleanText(val) {
    return String(val == null ? "" : val).replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
  }

  function norm(val) {
    return cleanText(val)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/&/g, " and ")
      .replace(/[^a-z0-9]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function dateOnlyToday() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  function excelSerialToIso(serial) {
    const n = Number(serial);
    if (!Number.isFinite(n) || n < 20000 || n > 90000) return "";
    const ms = Date.UTC(1899, 11, 30) + Math.round(n * 86400000);
    const d = new Date(ms);
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
  }

  function parseDateToIso(value) {
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
      return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
    }
    const raw = cleanText(value);
    if (!raw) return "";

    if (/^\d+(?:\.\d+)?$/.test(raw)) {
      const serial = excelSerialToIso(raw);
      if (serial) return serial;
    }

    let m = raw.match(/^(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})$/);
    if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;

    m = raw.match(/^(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{2,4})$/);
    if (m) {
      let year = Number(m[3]);
      if (year < 100) year += 2000;
      return `${year}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}`;
    }

    const parsed = new Date(raw);
    if (!Number.isNaN(parsed.getTime())) {
      return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, "0")}-${String(parsed.getDate()).padStart(2, "0")}`;
    }
    return "";
  }

  function prettyIsoDate(iso) {
    const m = String(iso || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return cleanText(iso) || "—";
    return `${Number(m[2])}/${Number(m[3])}/${m[1]}`;
  }

  function levenshtein(a, b) {
    a = norm(a); b = norm(b);
    if (a === b) return 0;
    if (!a) return b.length;
    if (!b) return a.length;
    if (Math.abs(a.length - b.length) > 4) return Math.abs(a.length - b.length) + 4;
    const prev = new Array(b.length + 1);
    const cur = new Array(b.length + 1);
    for (let j = 0; j <= b.length; j++) prev[j] = j;
    for (let i = 1; i <= a.length; i++) {
      cur[0] = i;
      for (let j = 1; j <= b.length; j++) {
        cur[j] = Math.min(
          cur[j - 1] + 1,
          prev[j] + 1,
          prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
        );
      }
      for (let j = 0; j <= b.length; j++) prev[j] = cur[j];
    }
    return prev[b.length];
  }

  function similarity(a, b) {
    const na = norm(a), nb = norm(b);
    if (!na || !nb) return 0;
    if (na === nb) return 1;
    const maxLen = Math.max(na.length, nb.length);
    return maxLen ? 1 - levenshtein(na, nb) / maxLen : 0;
  }

  const HEADER_ALIASES = {
    year: ["year"],
    month: ["month"],
    date: ["date", "date audit", "audit date"],
    auditor: ["name", "auditor", "auditor name"],
    om: ["om", "om name", "operations manager"],
    site: ["site", "location"],
    tl: ["tl", "tl name", "team leader", "team leader name"],
    agent: ["agent", "agent name", "respondent", "respondent name"],
    account: ["account", "account campaign", "campaign", "account name"],
    reason: ["cctv reason codes", "cctv reason code", "cctv reason", "reason code", "reason"],
    noc: ["noc", "noc status", "status"],
    remarks: ["remarks", "remark", "comments", "comment"]
  };

  function headerNorm(val) {
    return norm(val).replace(/\bof\b/g, " ").replace(/\s+/g, " ").trim();
  }

  function mapHeaders(row) {
    const normalized = row.map(headerNorm);
    const mapping = {};
    Object.entries(HEADER_ALIASES).forEach(([field, aliases]) => {
      const idx = normalized.findIndex(h => aliases.includes(h));
      if (idx >= 0) mapping[field] = idx;
    });
    return mapping;
  }

  function headerScore(row) {
    return Object.keys(mapHeaders(row)).length;
  }

  function rowFromArray(values, mapping, sourceRow) {
    const rawGet = (field, fallbackIndex) => {
      const idx = mapping && Number.isInteger(mapping[field]) ? mapping[field] : fallbackIndex;
      return values[idx] == null ? "" : String(values[idx]);
    };
    const get = (field, fallbackIndex) => cleanText(rawGet(field, fallbackIndex));

    const row = {
      year: get("year", 0),
      month: get("month", 1),
      date: parseDateToIso(get("date", 2)),
      auditor: window.normalizeAuditorName ? window.normalizeAuditorName(get("auditor", 3)) : get("auditor", 3),
      om: get("om", 4),
      site: window.normalizeTrackerSite ? window.normalizeTrackerSite(get("site", 5)) : get("site", 5),
      tl: get("tl", 6),
      agent: get("agent", 7),
      account: get("account", 8),
      reason: get("reason", 9),
      noc: get("noc", 10),
      remarks: get("remarks", 11),
      sourceRow: sourceRow || 0,
      raw: {
        year: rawGet("year", 0),
        month: rawGet("month", 1),
        date: rawGet("date", 2),
        auditor: rawGet("auditor", 3),
        om: rawGet("om", 4),
        site: rawGet("site", 5),
        tl: rawGet("tl", 6),
        agent: rawGet("agent", 7),
        account: rawGet("account", 8),
        reason: rawGet("reason", 9),
        noc: rawGet("noc", 10),
        remarks: rawGet("remarks", 11)
      }
    };

    if (!row.year && row.date) row.year = row.date.slice(0, 4);
    if (!row.month && row.date) {
      const mi = Number(row.date.slice(5, 7)) - 1;
      row.month = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][mi] || "";
    }
    return row;
  }

  function isDataRow(row) {
    const populated = [row.date, row.om, row.site, row.tl, row.agent, row.account, row.reason, row.noc]
      .filter(v => cleanText(v)).length;
    return populated >= 3;
  }

  function splitPastedText(text) {
    const lines = String(text || "").replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n").filter(line => line.trim() !== "");
    return lines.map(line => {
      if (line.includes("\t")) return line.split("\t");
      const out = [];
      let cur = "", quoted = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
          if (quoted && line[i + 1] === '"') { cur += '"'; i++; }
          else quoted = !quoted;
        } else if (ch === "," && !quoted) {
          out.push(cur); cur = "";
        } else cur += ch;
      }
      out.push(cur);
      return out;
    });
  }

  function parseMatrix(matrix, sourceLabel) {
    const rows = Array.isArray(matrix) ? matrix : [];
    if (!rows.length) return { rows: [], headerRow: -1 };

    let headerRow = -1;
    let mapping = null;
    const maxScan = Math.min(rows.length, 12);
    for (let i = 0; i < maxScan; i++) {
      const score = headerScore(rows[i] || []);
      if (score >= 7) {
        headerRow = i;
        mapping = mapHeaders(rows[i] || []);
        break;
      }
    }

    const start = headerRow >= 0 ? headerRow + 1 : 0;
    const parsed = [];
    for (let i = start; i < rows.length; i++) {
      const arr = Array.isArray(rows[i]) ? rows[i] : [];
      if (!arr.some(v => cleanText(v))) continue;
      const row = rowFromArray(arr, mapping, i + 1);
      if (isDataRow(row)) parsed.push(row);
    }
    return { rows: parsed, headerRow, sourceLabel };
  }

  function coreKey(row) {
    return [row.date, row.site, row.tl, row.agent, row.account, row.reason].map(norm).join("|");
  }

  function sortEntries() {
    entryList.sort((a, b) => new Date(a.rawDate || a.date) - new Date(b.rawDate || b.date));
  }

  function saveEntries() {
    try {
      storage.setItem(STORAGE_KEY, entryList);
    } catch (e) {
      console.error("Save audit entryList failed:", e);
    }
    notify();
  }

  function notify() {
    listeners.forEach(fn => {
      try { fn(entryList, editingIndex); } catch (e) { console.error(e); }
    });
  }

  function notifyGuard() {
    guardListeners.forEach(fn => {
      try { fn(trackerSnapshot, trackerRows, trackerAnalysis); } catch (e) { console.error(e); }
    });
  }

  // Smart Audit Guard IndexedDB Persistence
  function trackerDbOpen() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(GUARD_DB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(GUARD_DB_STORE)) db.createObjectStore(GUARD_DB_STORE);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async function trackerDbGet() {
    try {
      const db = await trackerDbOpen();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(GUARD_DB_STORE, "readonly");
        const req = tx.objectStore(GUARD_DB_STORE).get(GUARD_DB_KEY);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error);
        tx.oncomplete = () => db.close();
      });
    } catch (e) {
      console.warn("trackerDbGet error:", e);
      return null;
    }
  }

  async function trackerDbSet(value) {
    try {
      const db = await trackerDbOpen();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(GUARD_DB_STORE, "readwrite");
        tx.objectStore(GUARD_DB_STORE).put(value, GUARD_DB_KEY);
        tx.oncomplete = () => { db.close(); resolve(true); };
        tx.onerror = () => { db.close(); reject(tx.error); };
      });
    } catch (e) {
      console.warn("trackerDbSet error:", e);
      return false;
    }
  }

  async function trackerDbClear() {
    try {
      const db = await trackerDbOpen();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(GUARD_DB_STORE, "readwrite");
        tx.objectStore(GUARD_DB_STORE).delete(GUARD_DB_KEY);
        tx.oncomplete = () => { db.close(); resolve(true); };
        tx.onerror = () => { db.close(); reject(tx.error); };
      });
    } catch (e) {
      console.warn("trackerDbClear error:", e);
      return false;
    }
  }

  return {
    async init() {
      // 1. Load entryList from localStorage
      try {
        const saved = storage.getItem(STORAGE_KEY, []);
        entryList = Array.isArray(saved) ? saved : [];
        sortEntries();
      } catch (e) {
        console.warn("Could not load audit entryList:", e);
        entryList = [];
      }

      // 2. Load Smart Audit Guard snapshot
      try {
        const snap = await trackerDbGet();
        if (snap && Array.isArray(snap.rows)) {
          trackerSnapshot = snap;
          trackerRows = snap.rows;
          trackerAnalysis = this.analyzeRows(trackerRows);
        }
      } catch (e) {
        console.warn("Could not load tracker snapshot:", e);
      }

      notify();
      notifyGuard();
      return entryList;
    },

    onChange(fn) {
      if (typeof fn === "function") {
        listeners.push(fn);
        fn(entryList, editingIndex);
      }
    },

    onGuardChange(fn) {
      if (typeof fn === "function") {
        guardListeners.push(fn);
        fn(trackerSnapshot, trackerRows, trackerAnalysis);
      }
    },

    getEntries() {
      return [...entryList];
    },

    getEditingIndex() {
      return editingIndex;
    },

    setEditingIndex(idx) {
      editingIndex = idx;
      notify();
    },

    addEntry(entryData) {
      const rawUser = window.CCTV_AUTH?.getProfile?.() || null;
      const auditor = window.normalizeAuditorName
        ? window.normalizeAuditorName(rawUser?.display_name || rawUser?.username || "Miles")
        : "Miles";

      const dateObj = new Date(entryData.rawDate || entryData.date);
      const year = dateObj.getFullYear();
      const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      const month = months[dateObj.getMonth()];
      const formattedDate = `${dateObj.getMonth() + 1}/${dateObj.getDate()}/${year}`;

      const site = window.normalizeTrackerSite ? window.normalizeTrackerSite(entryData.site) : (entryData.site || "Mabini Site A");

      const entry = {
        id: entryData.id || ("audit_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 7)),
        rawDate: entryData.rawDate || entryData.date,
        year,
        month,
        formattedDate,
        auditorName: auditor,
        name: auditor,
        omName: entryData.omName || "",
        site,
        tlName: entryData.tlName || "N/A",
        agentName: entryData.agentName || "N/A",
        cleanAccount: entryData.cleanAccount || entryData.account || "",
        reasonCode: entryData.reasonCode || "SLEEPING",
        noc: entryData.noc || "YES",
        remarks: entryData.remarks || "N/A",
        sourceEdrId: entryData.sourceEdrId || "",
        sourceEdrUpdatedAt: entryData.sourceEdrUpdatedAt || "",
        sourceEdrReasonAuto: entryData.sourceEdrReasonAuto !== false
      };

      if (editingIndex >= 0 && editingIndex < entryList.length) {
        // Preserve source EDR metadata if updating
        const prev = entryList[editingIndex];
        if (prev.id) entry.id = prev.id;
        if (prev.sourceEdrId) {
          entry.sourceEdrId = prev.sourceEdrId;
          entry.sourceEdrUpdatedAt = prev.sourceEdrUpdatedAt || "";
          entry.sourceEdrReasonAuto = prev.sourceEdrReasonAuto !== false && entry.reasonCode === prev.reasonCode;
        }
        entryList[editingIndex] = entry;
        editingIndex = -1;
      } else {
        entryList.push(entry);
      }

      sortEntries();
      saveEntries();
      return entry;
    },

    deleteEntry(indexOrId) {
      let index = -1;
      if (typeof indexOrId === "number") {
        index = indexOrId;
      } else if (typeof indexOrId === "string") {
        index = entryList.findIndex(e => e.id === indexOrId || e.sourceEdrId === indexOrId);
      }
      if (index >= 0 && index < entryList.length) {
        entryList.splice(index, 1);
        if (editingIndex === index) editingIndex = -1;
        else if (editingIndex > index) editingIndex--;
        saveEntries();
      }
    },

    clearAllEntries() {
      entryList = [];
      editingIndex = -1;
      saveEntries();
    },

    // Bridge for EDR Workspace
    sendFromEdr(report) {
      if (!report || !report.id) {
        throw new Error("Invalid EDR report.");
      }

      const dateStr = report.date || todayIso();
      const dateObj = new Date(`${dateStr}T00:00:00`);
      const year = dateObj.getFullYear();
      const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      const month = months[dateObj.getMonth()];
      const formattedDate = `${dateObj.getMonth() + 1}/${dateObj.getDate()}/${year}`;

      const rawUser = window.CCTV_AUTH?.getProfile?.() || null;
      const auditor = window.normalizeAuditorName
        ? window.normalizeAuditorName(rawUser?.display_name || rawUser?.username || "Miles")
        : "Miles";

      const supervisorRole = report.supervisorRole || "Team Leader";
      const tlName = supervisorRole === "Team Leader"
        ? (report.supervisorName || "N/A")
        : (report.subjectType === "Team Leader" ? (report.subjectName || "N/A") : "N/A");

      const agentName = report.subjectType === "Agent/s"
        ? (report.subjectName || "N/A")
        : "N/A";

      const omName = report.omName || (supervisorRole === "OM" ? (report.supervisorName || "N/A") : "N/A");
      const site = window.normalizeTrackerSite ? window.normalizeTrackerSite(report.site) : (report.site || "Mabini Site A");

      // Auto-detect CCTV reason from incident using authoritative V1 rules
      const textToTest = [
        report.incident,
        report.action
      ].filter(Boolean).join(" ").toUpperCase();

      const reasonRules = [
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

      let reasonCode = "WASTING TIME";
      for (const [pattern, reason] of reasonRules) {
        if (pattern.test(textToTest)) {
          reasonCode = reason;
          break;
        }
      }

      const shared = {
        rawDate: dateStr,
        year,
        month,
        formattedDate,
        auditorName: auditor,
        name: auditor,
        omName,
        site,
        tlName,
        agentName,
        cleanAccount: report.account || "General",
        reasonCode
      };

      const existingIndex = entryList.findIndex(e => e.sourceEdrId === report.id);
      if (existingIndex === -1) {
        const newEntry = {
          ...shared,
          noc: "Pending",
          remarks: String(report.action || report.incident || "N/A").trim() || "N/A",
          sourceEdrId: report.id,
          sourceEdrUpdatedAt: report.updatedAt || "",
          sourceEdrReasonAuto: true
        };
        entryList.push(newEntry);
        sortEntries();
        saveEntries();
        return { action: "created", entry: newEntry };
      }

      const prev = entryList[existingIndex];
      entryList[existingIndex] = {
        ...prev,
        ...shared,
        reasonCode: prev.sourceEdrReasonAuto === false ? prev.reasonCode : reasonCode,
        sourceEdrUpdatedAt: report.updatedAt || ""
      };
      sortEntries();
      saveEntries();
      return { action: "updated", entry: entryList[existingIndex] };
    },

    hasEdr(edrId) {
      return entryList.some(e => e.sourceEdrId === edrId);
    },

    findByEdrId(edrId) {
      return entryList.find(e => e.sourceEdrId === edrId) || null;
    },

    buildTrackerHtml(entries = null) {
      const list = Array.isArray(entries) ? entries : entryList;
      let tableRowsHTML = "";
      list.forEach(entry => {
        const auditor = window.normalizeAuditorName ? window.normalizeAuditorName(entry.name || entry.auditorName || "Miles") : (entry.name || "Miles");
        const esc = window.escapeHtml || (s => s);
        const san = window.sanitize || (s => s);

        tableRowsHTML += `<tr>` +
          `<td style="border: none; text-align: center; background-color: transparent !important; color: #000000 !important; font-family: Arial, sans-serif; font-size: 10pt; line-height: normal;">${esc(san(entry.year))}</td>` +
          `<td style="border: none; text-align: center; background-color: transparent !important; color: #000000 !important; font-family: Arial, sans-serif; font-size: 10pt; line-height: normal;">${esc(san(entry.month))}</td>` +
          `<td style="border: none; text-align: center; background-color: transparent !important; color: #000000 !important; font-family: Arial, sans-serif; font-size: 10pt; line-height: normal;">${esc(san(entry.formattedDate))}</td>` +
          `<td style="border: none; text-align: center; background-color: transparent !important; color: #000000 !important; font-family: Arial, sans-serif; font-size: 10pt; line-height: normal;">${esc(san(auditor))}</td>` +
          `<td style="border: none; text-align: center; background-color: transparent !important; color: #000000 !important; font-family: Arial, sans-serif; font-size: 10pt; line-height: normal;">${esc(san(entry.omName))}</td>` +
          `<td style="border: none; text-align: center; background-color: transparent !important; color: #000000 !important; font-family: Arial, sans-serif; font-size: 10pt; line-height: normal;">${esc(san(entry.site))}</td>` +
          `<td style="border: none; text-align: center; background-color: transparent !important; color: #000000 !important; font-family: Arial, sans-serif; font-size: 10pt; line-height: normal;">${esc(san(entry.tlName))}</td>` +
          `<td style="border: none; text-align: center; background-color: transparent !important; color: #000000 !important; font-family: Arial, sans-serif; font-size: 10pt; line-height: normal;">${esc(san(entry.agentName))}</td>` +
          `<td style="border: none; text-align: center; background-color: transparent !important; color: #000000 !important; font-family: Arial, sans-serif; font-size: 10pt; line-height: normal;">${esc(san(entry.cleanAccount))}</td>` +
          `<td style="border: none; text-align: center; background-color: transparent !important; color: #000000 !important; font-family: Arial, sans-serif; font-size: 10pt; line-height: normal;">${esc(san(entry.reasonCode))}</td>` +
          `<td style="border: none; text-align: center; background-color: transparent !important; color: #000000 !important; font-family: Arial, sans-serif; font-size: 10pt; line-height: normal;">${esc(san(entry.noc))}</td>` +
          `<td style="border: none; text-align: left; background-color: transparent !important; color: #000000 !important; font-family: Arial, sans-serif; font-size: 10pt; line-height: normal; white-space: pre-wrap;">${esc(san(entry.remarks)).replace(/\n/g, "<br>")}</td>` +
          `</tr>`;
      });
      return `<div style="font-family: Arial, sans-serif; font-size: 10pt; line-height: normal; white-space: pre-wrap;"><table style="border-collapse: collapse; border: none; background-color: transparent !important; color: #000000 !important; font-family: Arial, sans-serif; font-size: 10pt; line-height: normal;"><tbody>${tableRowsHTML}</tbody></table></div>`;
    },

    formatForTracker(entries = null) {
      return this.buildTrackerHtml(entries);
    },

    // Copy for External Google Sheets Tracker (Arial 10pt formatted HTML table + TSV fallback)
    async copyAuditForTracker() {
      if (!entryList.length) {
        throw new Error("No entries to copy in Data Output Grid.");
      }

      // Plain Text: TSV
      const textRows = entryList.map(entry => {
        const auditor = window.normalizeAuditorName ? window.normalizeAuditorName(entry.name || entry.auditorName || "Miles") : (entry.name || "Miles");
        return [
          entry.year,
          entry.month,
          entry.formattedDate,
          auditor,
          entry.omName,
          entry.site,
          entry.tlName,
          entry.agentName,
          entry.cleanAccount,
          entry.reasonCode,
          entry.noc,
          entry.remarks
        ].map(v => window.sanitize ? window.sanitize(v) : String(v || "").replace(/[\t\r\n]+/g, " ").trim()).join("\t");
      });
      const safeText = textRows.join("\n").trim();

      // HTML: Exact Arial 10pt Table Format matching V1
      let tableRowsHTML = "";
      entryList.forEach(entry => {
        const auditor = window.normalizeAuditorName ? window.normalizeAuditorName(entry.name || entry.auditorName || "Miles") : (entry.name || "Miles");
        const esc = window.escapeHtml || (s => s);
        const san = window.sanitize || (s => s);

        tableRowsHTML += `<tr>` +
          `<td style="border: none; text-align: center; background-color: transparent !important; color: #000000 !important; font-family: Arial, sans-serif; font-size: 10pt; line-height: normal;">${esc(san(entry.year))}</td>` +
          `<td style="border: none; text-align: center; background-color: transparent !important; color: #000000 !important; font-family: Arial, sans-serif; font-size: 10pt; line-height: normal;">${esc(san(entry.month))}</td>` +
          `<td style="border: none; text-align: center; background-color: transparent !important; color: #000000 !important; font-family: Arial, sans-serif; font-size: 10pt; line-height: normal;">${esc(san(entry.formattedDate))}</td>` +
          `<td style="border: none; text-align: center; background-color: transparent !important; color: #000000 !important; font-family: Arial, sans-serif; font-size: 10pt; line-height: normal;">${esc(san(auditor))}</td>` +
          `<td style="border: none; text-align: center; background-color: transparent !important; color: #000000 !important; font-family: Arial, sans-serif; font-size: 10pt; line-height: normal;">${esc(san(entry.omName))}</td>` +
          `<td style="border: none; text-align: center; background-color: transparent !important; color: #000000 !important; font-family: Arial, sans-serif; font-size: 10pt; line-height: normal;">${esc(san(entry.site))}</td>` +
          `<td style="border: none; text-align: center; background-color: transparent !important; color: #000000 !important; font-family: Arial, sans-serif; font-size: 10pt; line-height: normal;">${esc(san(entry.tlName))}</td>` +
          `<td style="border: none; text-align: center; background-color: transparent !important; color: #000000 !important; font-family: Arial, sans-serif; font-size: 10pt; line-height: normal;">${esc(san(entry.agentName))}</td>` +
          `<td style="border: none; text-align: center; background-color: transparent !important; color: #000000 !important; font-family: Arial, sans-serif; font-size: 10pt; line-height: normal;">${esc(san(entry.cleanAccount))}</td>` +
          `<td style="border: none; text-align: center; background-color: transparent !important; color: #000000 !important; font-family: Arial, sans-serif; font-size: 10pt; line-height: normal;">${esc(san(entry.reasonCode))}</td>` +
          `<td style="border: none; text-align: center; background-color: transparent !important; color: #000000 !important; font-family: Arial, sans-serif; font-size: 10pt; line-height: normal;">${esc(san(entry.noc))}</td>` +
          `<td style="border: none; text-align: left; background-color: transparent !important; color: #000000 !important; font-family: Arial, sans-serif; font-size: 10pt; line-height: normal; white-space: pre-wrap;">${esc(san(entry.remarks)).replace(/\n/g, "<br>")}</td>` +
          `</tr>`;
      });

      const safeHtml = `<div style="font-family: Arial, sans-serif; font-size: 10pt; line-height: normal; white-space: pre-wrap;"><table style="border-collapse: collapse; border: none; background-color: transparent !important; color: #000000 !important; font-family: Arial, sans-serif; font-size: 10pt; line-height: normal;"><tbody>${tableRowsHTML}</tbody></table></div>`;

      await window.copyToClipboardHtmlAndText(safeText, safeHtml);
      return { count: entryList.length };
    },

    // SMART AUDIT GUARD METHODS
    async importTrackerFile(file) {
      if (!file) throw new Error("No file selected.");
      const buffer = await file.arrayBuffer();
      if (!window.XLSX) {
        throw new Error("SheetJS library is not loaded.");
      }
      const workbook = window.XLSX.read(buffer, { type: "array", cellDates: true });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const matrix = window.XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });

      const parsed = parseMatrix(matrix, file.name);
      return this.saveSnapshot(parsed.rows, file.name);
    },

    async importPastedText(text) {
      if (!text || !text.trim()) throw new Error("No text pasted.");
      const matrix = splitPastedText(text);
      const parsed = parseMatrix(matrix, "Pasted Rows");
      return this.saveSnapshot(parsed.rows, "Pasted Rows");
    },

    async mergePastedText(text) {
      if (!text || !text.trim()) throw new Error("No text pasted.");
      const matrix = splitPastedText(text);
      const parsed = parseMatrix(matrix, "Pasted Merge");

      const existingMap = new Map(trackerRows.map(r => [coreKey(r), r]));
      parsed.rows.forEach(r => {
        existingMap.set(coreKey(r), r);
      });
      const merged = Array.from(existingMap.values());
      return this.saveSnapshot(merged, `${trackerSnapshot?.sourceLabel || "Snapshot"} + Merge`);
    },

    async saveSnapshot(rows, sourceLabel = "Import") {
      trackerRows = rows;
      trackerSnapshot = {
        rows,
        sourceLabel,
        recordCount: rows.length,
        syncedAt: new Date().toISOString()
      };
      trackerAnalysis = this.analyzeRows(rows);
      await trackerDbSet(trackerSnapshot);
      notifyGuard();
      return {
        snapshot: trackerSnapshot,
        rowsCount: rows.length,
        issuesCount: trackerAnalysis.issues.length
      };
    },

    async pasteTrackerRows(text, merge = false) {
      if (merge) return this.mergePastedText(text);
      return this.importPastedText(text);
    },

    async importTrackerWorkbook(workbook) {
      if (!workbook || !workbook.SheetNames || !workbook.SheetNames.length) {
        throw new Error("Invalid workbook object.");
      }
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const matrix = window.XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
      const parsed = parseMatrix(matrix, "Imported Tracker");
      return this.saveSnapshot(parsed.rows, "Imported Tracker");
    },

    async clearSnapshot() {
      trackerSnapshot = null;
      trackerRows = [];
      trackerAnalysis = { duplicateGroups: [], issues: [] };
      await trackerDbClear();
      notifyGuard();
      return { rowsCount: 0, issuesCount: 0 };
    },

    async clearTrackerSnapshot() {
      return this.clearSnapshot();
    },

    updateEntry(index, entryData) {
      editingIndex = index;
      return this.addEntry(entryData);
    },

    analyzeRows(rows) {
      const duplicateMap = new Map();
      const issues = [];
      const today = dateOnlyToday();
      const masters = {
        tls: window.getTeamLeaderNames ? window.getTeamLeaderNames() : (cfg.DEFAULTS.TLS || []),
        oms: window.getOmNames ? window.getOmNames() : (cfg.DEFAULTS.OMS || []),
        accounts: window.getAccountNames ? window.getAccountNames() : (cfg.DEFAULTS.ACCOUNTS || [])
      };

      // Also check against existing CCTV Audit grid rows for "already sent" detection
      const gridKeys = new Set(entryList.map(e => coreKey(e)));

      rows.forEach((row, idx) => {
        const sourceRow = row.sourceRow || idx + 2;
        const key = coreKey(row);

        if (key && !key.split("|").every(v => !v)) {
          if (!duplicateMap.has(key)) duplicateMap.set(key, []);
          duplicateMap.get(key).push(row);
        }

        const missing = CORE_FIELDS.filter(field => !cleanText(row[field]));
        if (missing.length) {
          issues.push({
            type: "missing",
            level: "warning",
            title: `Missing required field${missing.length > 1 ? "s" : ""}: ${missing.join(", ")}`,
            detail: `Row ${sourceRow} · ${cleanText(row.agent) || cleanText(row.tl) || "Entry"}`,
            row
          });
        }

        const noc = norm(row.noc);
        if (noc && !ALLOWED_NOC.has(noc)) {
          issues.push({
            type: "noc",
            level: "danger",
            title: `Unusual NOC value: “${row.noc}”`,
            detail: `Row ${sourceRow} · ${cleanText(row.agent) || "Entry"}`,
            row
          });
        }

        if (row.date && row.date > today) {
          issues.push({
            type: "future-date",
            level: "warning",
            title: `Future audit date: ${prettyIsoDate(row.date)}`,
            detail: `Row ${sourceRow} · ${cleanText(row.agent) || "Entry"}`,
            row
          });
        }

        const tlValue = cleanText(row.tl);
        if (tlValue && masters.tls.length) {
          const exact = masters.tls.find(t => norm(t) === norm(tlValue));
          if (!exact) {
            let best = null;
            masters.tls.forEach(candidate => {
              const score = similarity(tlValue, candidate);
              if (score >= 0.90 && (!best || score > best.score)) {
                best = { value: candidate, score: Math.round(score * 100) };
              }
            });
            if (best) {
              issues.push({
                type: "spelling",
                level: "danger",
                title: "Possible TL Name misspelling",
                detail: `Row ${sourceRow} · Current: “${tlValue}”`,
                suggestion: `Possible correct TL: “${best.value}” (${best.score}% match)`,
                row
              });
            }
          }
        }
      });

      const duplicateGroups = [];
      duplicateMap.forEach(group => {
        if (group.length <= 1) return;
        duplicateGroups.push(group);
        const refs = group.map(r => r.sourceRow || "?").join(", ");
        issues.push({
          type: "duplicate",
          level: "danger",
          title: `Duplicate audit rows: ${refs}`,
          detail: group.map(r => `${r.sourceRow || "?"}: ${r.agent || r.tl || "No name"}`).join(" · "),
          row: group[0],
          groupRows: group
        });
      });

      return { duplicateGroups, issues };
    },

    getTrackerSnapshot() {
      return trackerSnapshot;
    },

    getTrackerRows() {
      return [...trackerRows];
    },

    getTrackerAnalysis() {
      return { ...trackerAnalysis };
    }
  };
})();

// Bridge global assignment
window.cctvAuditBridge = {
  findByEdrId(edrId) {
    return window.CCTV_AUDIT.findByEdrId(edrId);
  },
  hasEdr(edrId) {
    return window.CCTV_AUDIT.hasEdr(edrId);
  },
  sendFromEdr(report) {
    return window.CCTV_AUDIT.sendFromEdr(report);
  }
};
