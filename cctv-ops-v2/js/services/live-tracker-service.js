/**
 * CCTV OPS V2 - Live Tracker Spreadsheet Service
 * Local-First, High-Performance Interactive Spreadsheet Engine
 * Connected to Authoritative Google Sheets with Conflict Detection & Concurrency Safety
 */

window.CCTV_LIVE_TRACKER = (function () {
  "use strict";

  const STORAGE_KEY = "cctv_live_tracker_rows_v3";
  const SETTINGS_KEY = "cctv_live_tracker_settings_v2";
  const DB_NAME = "cctv_tracker_guard_v1";
  const DB_STORE = "live_tracker_state";

  // Standard Columns in exact source Google Sheet order:
  // Year, Month, Date, Name, OM, Site, TL, Agent Name, Account, CCTV Reason Codes, NOC, Remarks
  const COLUMNS = [
    { key: "year", label: "Year", width: 68, type: "text" },
    { key: "month", label: "Month", width: 72, type: "text" },
    { key: "date", label: "Date", width: 100, type: "text" },
    { key: "auditor", label: "Name", width: 120, type: "text" },
    { key: "om", label: "OM", width: 95, type: "text" },
    { key: "site", label: "Site", width: 135, type: "text" },
    { key: "tl", label: "TL", width: 140, type: "text" },
    { key: "agent", label: "Agent Name", width: 140, type: "text" },
    { key: "account", label: "Account", width: 125, type: "text" },
    { key: "reason", label: "CCTV Reason Codes", width: 170, type: "text" },
    { key: "noc", label: "NOC", width: 85, type: "select", options: ["", "YES", "NO", "Pending", "Disputed"] },
    { key: "remarks", label: "Remarks", width: 260, type: "text" }
  ];

  const DEFAULT_WEB_APP_URL = "https://script.google.com/macros/s/AKfycbw2-7ERz3psAaUfsceoFHV6leNmqFf5HxgasRYORMHU8bbnte7DLbDIfX_YzjRrzMZh/exec";

  let rows = [];
  let undoStack = [];
  let redoStack = [];
  const MAX_HISTORY = 50;

  let listeners = [];
  let syncListeners = [];

  let dataState = {
    source: "local",
    sheetName: "AUDIT 2026",
    totalRows: 0,
    lastFetchTime: null,
    auditorFilter: "all"
  };

  let isSyncing = false;
  let syncStatus = { state: "idle", unsavedCount: 0, lastSyncTime: null, error: null };
  let debounceTimer = null;
  const DEBOUNCE_DELAY_MS = 1500;

  function generateUid() {
    return "row_" + Date.now().toString(36) + "_" + Math.random().toString(36).substring(2, 7);
  }

  function cleanVal(v) {
    return String(v == null ? "" : v).trim();
  }

  // Compute a content fingerprint for row-identity and conflict verification
  function computeFingerprint(row) {
    return COLUMNS.map(c => cleanVal(row[c.key])).join("||");
  }

  function deriveYearMonth(dateStr) {
    if (!dateStr) return { year: "", month: "" };
    const raw = cleanVal(dateStr);
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    let m = raw.match(/^(\d{4})[-\/.](\d{1,2})/);
    if (m) {
      const idx = parseInt(m[2], 10) - 1;
      return { year: m[1], month: months[idx] || "" };
    }
    m = raw.match(/^(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{2,4})/);
    if (m) {
      let y = Number(m[3]);
      if (y < 100) y += 2000;
      const idx = parseInt(m[1], 10) - 1;
      return { year: String(y), month: months[idx] || "" };
    }
    const d = new Date(raw);
    if (!Number.isNaN(d.getTime())) {
      return { year: String(d.getFullYear()), month: months[d.getMonth()] || "" };
    }
    return { year: "", month: "" };
  }

  function parseDateToIso(dateStr) {
    const raw = cleanVal(dateStr);
    if (!raw) return "";
    let m = raw.match(/^(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})$/);
    if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
    m = raw.match(/^(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{2,4})$/);
    if (m) {
      let y = Number(m[3]);
      if (y < 100) y += 2000;
      return `${y}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}`;
    }
    const d = new Date(raw);
    if (!Number.isNaN(d.getTime())) {
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    }
    return raw;
  }

  function createEmptyRow(overrides = {}) {
    const r = {
      _uid: generateUid(),
      _status: "clean",
      _isNew: false,
      _dirtyFields: {},
      _originalFingerprint: "",
      _updatedAt: Date.now()
    };
    COLUMNS.forEach(col => {
      r[col.key] = "";
    });
    Object.assign(r, overrides);
    if ((!r.year || !r.month) && r.date) {
      const ym = deriveYearMonth(r.date);
      if (!r.year) r.year = ym.year;
      if (!r.month) r.month = ym.month;
    }
    r._originalFingerprint = computeFingerprint(r);
    return r;
  }

  // Local storage caching
  function persistLocalDraft() {
    try {
      const serializable = rows.map(r => {
        const item = { _uid: r._uid, _status: r._status, _dirtyFields: r._dirtyFields || {}, _originalFingerprint: r._originalFingerprint };
        COLUMNS.forEach(col => { item[col.key] = r[col.key] || ""; });
        return item;
      });
      localStorage.setItem(STORAGE_KEY, JSON.stringify(serializable));
    } catch (e) {
      console.warn("Failed to save Live Tracker draft to localStorage:", e);
    }
  }

  function loadLocalDraft() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.map(p => {
        const r = createEmptyRow(p);
        r._uid = p._uid || generateUid();
        r._status = p._status || "clean";
        r._dirtyFields = p._dirtyFields || {};
        r._originalFingerprint = p._originalFingerprint || computeFingerprint(r);
        return r;
      });
    } catch (_) {
      return [];
    }
  }

  function getSettings() {
    try {
      return JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}");
    } catch (_) {
      return {};
    }
  }

  function saveSettings(settings) {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch (_) {}
  }

  function notifyChange(action, meta = {}) {
    updateSyncStatus();
    persistLocalDraft();
    listeners.forEach(fn => {
      try { fn(action, meta); } catch (e) { console.error("Live Tracker listener error:", e); }
    });
  }

  function updateSyncStatus() {
    const unsavedCount = rows.filter(r => r._status === "unsaved").length;
    syncStatus.unsavedCount = unsavedCount;
    if (unsavedCount > 0 && syncStatus.state === "idle") {
      syncStatus.state = "unsaved";
    } else if (unsavedCount === 0 && syncStatus.state === "unsaved") {
      syncStatus.state = "idle";
    }
    syncListeners.forEach(fn => {
      try { fn({ ...syncStatus }); } catch (e) { console.error("Sync listener error:", e); }
    });
  }

  // History & Undo / Redo Manager
  function pushHistory(command) {
    undoStack.push(command);
    if (undoStack.length > MAX_HISTORY) undoStack.shift();
    redoStack = [];
  }

  function checkRowClean(row) {
    if (row._originalFingerprint && computeFingerprint(row) === row._originalFingerprint) {
      row._status = "clean";
      row._dirtyFields = {};
      return true;
    }
    return false;
  }

  function executeCommand(command, isUndo = false) {
    switch (command.type) {
      case "CELL_EDIT": {
        const row = rows.find(r => r._uid === command.rowUid);
        if (row) {
          row[command.colKey] = isUndo ? command.oldValue : command.newValue;
          if (!checkRowClean(row)) {
            markRowDirty(row, command.colKey);
          }
        }
        break;
      }
      case "BATCH_EDIT": {
        command.changes.forEach(c => {
          const row = rows.find(r => r._uid === c.rowUid);
          if (row) {
            row[c.colKey] = isUndo ? c.oldValue : c.newValue;
            if (!checkRowClean(row)) {
              markRowDirty(row, c.colKey);
            }
          }
        });
        break;
      }
      case "INSERT_ROW": {
        if (isUndo) {
          const idx = rows.findIndex(r => r._uid === command.row._uid);
          if (idx >= 0) rows.splice(idx, 1);
        } else {
          rows.splice(command.index, 0, command.row);
          markRowDirty(command.row);
        }
        break;
      }
      case "DELETE_ROW": {
        if (isUndo) {
          rows.splice(command.index, 0, command.row);
        } else {
          const idx = rows.findIndex(r => r._uid === command.row._uid);
          if (idx >= 0) rows.splice(idx, 1);
        }
        break;
      }
      case "MOVE_ROW": {
        const from = isUndo ? command.toIndex : command.fromIndex;
        const to = isUndo ? command.fromIndex : command.toIndex;
        const [moved] = rows.splice(from, 1);
        if (moved) rows.splice(to, 0, moved);
        break;
      }
    }
  }

  function markRowDirty(row, colKey = null) {
    row._status = "unsaved";
    row._updatedAt = Date.now();
    row._dirtyFields = row._dirtyFields || {};
    if (colKey) row._dirtyFields[colKey] = true;
    scheduleDebouncedSync();
  }

  function scheduleDebouncedSync() {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      autoSyncPending();
    }, DEBOUNCE_DELAY_MS);
  }

  // Date-Aware Insertion
  function findInsertionIndexForDate(targetDateStr) {
    const targetIso = parseDateToIso(targetDateStr);
    if (!targetIso || !rows.length) return rows.length;

    // Search for chronological slot in existing records
    for (let i = 0; i < rows.length; i++) {
      const rowIso = parseDateToIso(rows[i].date);
      if (rowIso && rowIso > targetIso) {
        return i; // Insert right before the first date that is strictly greater
      }
    }
    return rows.length;
  }

  const WRITES_ENABLED = false; // Google Sheet writes disabled / read-only for now

  // Google Sheets Apps Script Sync Engine (Read-Only Mode)
  async function autoSyncPending() {
    if (!WRITES_ENABLED) {
      // Google Sheet writes disabled/read-only for now
      return;
    }
    const settings = getSettings();
    const webAppUrl = settings.webAppUrl || (window.CCTV_V2_CONFIG && window.CCTV_V2_CONFIG.MASTERLIST_API_URL) || DEFAULT_WEB_APP_URL;
    if (!webAppUrl || isSyncing) return;

    const dirtyRows = rows.filter(r => r._status === "unsaved");
    if (!dirtyRows.length) return;

    isSyncing = true;
    syncStatus.state = "saving";
    updateSyncStatus();

    try {
      const payload = {
        action: "batch_sync_tracker",
        sheetName: "AUDIT 2026",
        clientTimestamp: Date.now(),
        updates: dirtyRows.map(r => ({
          uid: r._uid,
          index: rows.indexOf(r),
          isNew: !!r._isNew,
          fingerprint: r._originalFingerprint,
          values: COLUMNS.reduce((acc, c) => { acc[c.key] = r[c.key]; return acc; }, {})
        }))
      };

      const resp = await fetch(webAppUrl, {
        method: "POST",
        mode: "cors",
        credentials: "omit",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(payload)
      });

      if (resp.ok) {
        const resData = await resp.json().catch(() => ({ success: true }));
        if (resData.conflicts && resData.conflicts.length > 0) {
          resData.conflicts.forEach(c => {
            const row = rows.find(r => r._uid === c.uid);
            if (row) {
              row._status = "conflict";
              row._serverValues = c.serverValues;
            }
          });
          syncStatus.state = "conflict";
          syncStatus.error = `${resData.conflicts.length} conflict(s) detected. Coworker edits preserved.`;
        } else {
          dirtyRows.forEach(r => {
            r._status = "clean";
            r._isNew = false;
            r._dirtyFields = {};
            r._originalFingerprint = computeFingerprint(r);
          });
          syncStatus.state = "saved";
          syncStatus.lastSyncTime = new Date();
          syncStatus.error = null;
          dataState.source = "live";
          dataState.lastFetchTime = new Date();
        }
      } else {
        throw new Error(`HTTP ${resp.status}`);
      }
    } catch (err) {
      console.warn("Live Tracker sync error:", err);
      syncStatus.state = "unsaved";
      syncStatus.error = "Sync failed. Local edits safely preserved.";
    } finally {
      isSyncing = false;
      updateSyncStatus();
    }
  }

  async function triggerImmediateSync() {
    if (!WRITES_ENABLED) {
      if (window.showToast) window.showToast("Google Sheet write synchronization is currently in read-only mode.", "info");
      return { success: true, readOnly: true };
    }
    if (debounceTimer) clearTimeout(debounceTimer);
    return autoSyncPending();
  }

  let runtimeTrace = {
    savedWebAppUrl: "",
    actualGetUrl: "",
    httpStatus: 0,
    parsedSuccess: false,
    dataHeadersLength: 0,
    dataRowsLength: 0,
    firstReturnedRow: null,
    lastReturnedRow: null,
    normalizedTrackerRowCount: 0,
    finalTrackerStateRowCount: 0,
    renderedGridRowCount: 0
  };

  // Fetch Authoritative Shared AUDIT 2026 Dataset from Google Sheets
  async function fetchSharedSheetData(force = false) {
    const settings = getSettings();
    let webAppUrl = settings.webAppUrl 
      || localStorage.getItem("trackerSheetWebAppUrl") 
      || localStorage.getItem("cctv_masterlist_api_url")
      || (window.CCTV_V2_CONFIG && window.CCTV_V2_CONFIG.MASTERLIST_API_URL) 
      || DEFAULT_WEB_APP_URL;

    if (!webAppUrl) {
      const errStr = "No Google Sheets URL configured";
      syncStatus.error = errStr;
      dataState.source = "error";
      dataState.lastError = errStr;
      updateSyncStatus();
      return { success: false, error: errStr };
    }

    runtimeTrace.savedWebAppUrl = webAppUrl;

    isSyncing = true;
    syncStatus.state = "saving";
    dataState.source = "connecting";
    updateSyncStatus();

    async function executeFetch(url) {
      const sep = url.includes("?") ? "&" : "?";
      const targetUrl = `${url}${sep}sheet=AUDIT+2026&action=get_tracker`;
      runtimeTrace.actualGetUrl = targetUrl;
      try {
        const r = await fetch(targetUrl, { method: "GET", mode: "cors", credentials: "omit" });
        runtimeTrace.httpStatus = r.status;
        if (r.ok) {
          const json = await r.json();
          return { data: json, url: targetUrl, status: r.status };
        }
      } catch (e1) {
        console.warn("Fetch with query params failed, trying direct URL:", e1);
      }

      runtimeTrace.actualGetUrl = url;
      const r2 = await fetch(url, { method: "GET", mode: "cors", credentials: "omit" });
      runtimeTrace.httpStatus = r2.status;
      if (!r2.ok) throw new Error(`HTTP ${r2.status}`);
      const json2 = await r2.json();
      return { data: json2, url: url, status: r2.status };
    }

    try {
      let fetchResult;
      try {
        fetchResult = await executeFetch(webAppUrl);
      } catch (fetchErr) {
        if (webAppUrl !== DEFAULT_WEB_APP_URL) {
          console.warn("Custom Web App URL failed, falling back to default authoritative endpoint:", fetchErr);
          webAppUrl = DEFAULT_WEB_APP_URL;
          runtimeTrace.savedWebAppUrl = DEFAULT_WEB_APP_URL;
          fetchResult = await executeFetch(DEFAULT_WEB_APP_URL);
        } else {
          throw fetchErr;
        }
      }

      const data = fetchResult.data;
      runtimeTrace.parsedSuccess = !!(data && (data.success !== false && data.status !== "error"));

      let rawRows = [];
      let headersList = [];
      let detectedSheet = "AUDIT 2026";

      // Case 1: Standard API format: { success: true, data: { headers: [...], rows: [...] } }
      if (data && data.data && typeof data.data === "object" && !Array.isArray(data.data)) {
        if (Array.isArray(data.data.rows)) rawRows = data.data.rows;
        if (Array.isArray(data.data.headers)) headersList = data.data.headers;
        if (data.data.sheetName) detectedSheet = data.data.sheetName;
      }

      // Case 2: Top-level rows: { success: true, rows: [...], headers: [...] }
      if (!rawRows.length && data && Array.isArray(data.rows)) {
        rawRows = data.rows;
        if (Array.isArray(data.headers)) headersList = data.headers;
        if (data.sheetName) detectedSheet = data.sheetName;
      }

      // Case 3: Sheets tracker object: { success: true, sheets: { tracker: { rows: [...] } } }
      if (!rawRows.length && data && data.sheets && data.sheets.tracker) {
        if (Array.isArray(data.sheets.tracker.rows)) rawRows = data.sheets.tracker.rows;
        else if (Array.isArray(data.sheets.tracker)) rawRows = data.sheets.tracker;
        detectedSheet = "AUDIT 2026 (Tracker)";
      }

      // Case 4: Tracker array: { success: true, tracker: [...] }
      if (!rawRows.length && data && Array.isArray(data.tracker)) {
        rawRows = data.tracker;
        detectedSheet = "AUDIT 2026 (Tracker)";
      }

      // Case 5: data.data is an array of row objects
      if (!rawRows.length && data && Array.isArray(data.data)) {
        rawRows = data.data;
      }

      // Case 6: data itself is an array of row objects
      if (!rawRows.length && Array.isArray(data)) {
        rawRows = data;
      }

      if (!rawRows.length) {
        throw new Error("No rows returned from Google Sheet");
      }

      runtimeTrace.dataHeadersLength = headersList.length > 0 
        ? headersList.length 
        : (data && data.headers && Array.isArray(data.headers) ? data.headers.length : 12);
      runtimeTrace.dataRowsLength = rawRows.length;
      runtimeTrace.firstReturnedRow = rawRows[0];
      runtimeTrace.lastReturnedRow = rawRows[rawRows.length - 1];

      const parsed = [];

      rawRows.forEach((rowItem, rIdx) => {
        if (!rowItem) return;

        let vals = null;
        let sheetRow = null;

        if (Array.isArray(rowItem)) {
          // Matrix format: rowItem is an array of cell values
          vals = rowItem;
        } else if (typeof rowItem === "object") {
          if (rowItem.sheetRow != null) {
            sheetRow = rowItem.sheetRow;
          }
          if (Array.isArray(rowItem.values)) {
            // Apps Script response format: { sheetRow: 2, values: [ "2026", "Jan", "1/1/2026", ... ] }
            vals = rowItem.values;
          }
        }

        if (vals && Array.isArray(vals)) {
          // If first row contains literal headers, capture headers and skip data mapping
          if (rIdx === 0) {
            const h0 = cleanVal(vals[0]).toLowerCase();
            const h1 = cleanVal(vals[1]).toLowerCase();
            const h2 = cleanVal(vals[2]).toLowerCase();
            if (h1 === "month" || h2 === "date" || h0 === "year") {
              if (!headersList || !headersList.length) headersList = vals.map(c => cleanVal(c));
              return;
            }
          }

          // Exact positional mapping as required:
          // row.values[0]  → Year
          // row.values[1]  → Month
          // row.values[2]  → Date
          // row.values[3]  → Name
          // row.values[4]  → OM
          // row.values[5]  → Site
          // row.values[6]  → TL
          // row.values[7]  → Agent Name
          // row.values[8]  → Account
          // row.values[9]  → CCTV Reason Codes
          // row.values[10] → NOC
          // row.values[11] → Remarks
          const rawDate = cleanVal(vals[2]);
          const ym = deriveYearMonth(rawDate);

          const newRow = createEmptyRow({
            year: cleanVal(vals[0]) || ym.year,
            month: cleanVal(vals[1]) || ym.month,
            date: rawDate,
            auditor: cleanVal(vals[3]),
            om: cleanVal(vals[4]),
            site: cleanVal(vals[5]),
            tl: cleanVal(vals[6]),
            agent: cleanVal(vals[7]),
            account: cleanVal(vals[8]),
            reason: cleanVal(vals[9]),
            noc: cleanVal(vals[10]),
            remarks: cleanVal(vals[11])
          });

          // Preserve sheetRow as metadata only (NOT in visible 12-column data array)
          if (sheetRow != null) {
            newRow.sheetRow = sheetRow;
            newRow._sheetRow = sheetRow;
          }

          parsed.push(newRow);
          return;
        }

        // Flat object fallback: { Column_1: "2026", Month: "Jan", ... }
        // Exclude sheetRow so it is NEVER used as Year!
        const obj = rowItem;
        const filteredKeys = Object.keys(obj).filter(k => k !== "sheetRow" && k !== "_sheetRow" && k !== "_uid" && k !== "values");
        if (!filteredKeys.length) return;

        let rawYear = "";
        if (headersList.length > 0 && obj[headersList[0]] != null && String(obj[headersList[0]]).trim()) {
          rawYear = cleanVal(obj[headersList[0]]);
        } else if (obj.Column_1 != null && String(obj.Column_1).trim()) {
          rawYear = cleanVal(obj.Column_1);
        } else if (obj[""] != null && String(obj[""]).trim()) {
          rawYear = cleanVal(obj[""]);
        } else if (obj[" "] != null && String(obj[" "]).trim()) {
          rawYear = cleanVal(obj[" "]);
        } else if (obj.Year != null && String(obj.Year).trim()) {
          rawYear = cleanVal(obj.Year);
        } else if (obj.year != null && String(obj.year).trim()) {
          rawYear = cleanVal(obj.year);
        } else if (filteredKeys.length > 0 && obj[filteredKeys[0]] != null && String(obj[filteredKeys[0]]).trim()) {
          rawYear = cleanVal(obj[filteredKeys[0]]);
        }

        const rawMonth = cleanVal(
          headersList[1] != null ? obj[headersList[1]] : (
            obj.Month != null ? obj.Month : (
              obj.month != null ? obj.month : (
                obj.Column_2 != null ? obj.Column_2 : (filteredKeys[1] ? obj[filteredKeys[1]] : "")
              )
            )
          )
        );

        const rawDate = cleanVal(
          headersList[2] != null ? obj[headersList[2]] : (
            obj.Date != null ? obj.Date : (
              obj.date != null ? obj.date : (
                obj.Column_3 != null ? obj.Column_3 : (filteredKeys[2] ? obj[filteredKeys[2]] : "")
              )
            )
          )
        );

        const ym = deriveYearMonth(rawDate);

        const rawAuditor = cleanVal(
          headersList[3] != null ? obj[headersList[3]] : (
            obj.Name != null ? obj.Name : (
              obj.name != null ? obj.name : (
                obj.Auditor != null ? obj.Auditor : (
                  obj.auditor != null ? obj.auditor : (
                    obj.Column_4 != null ? obj.Column_4 : (filteredKeys[3] ? obj[filteredKeys[3]] : "")
                  )
                )
              )
            )
          )
        );

        const rawOm = cleanVal(
          headersList[4] != null ? obj[headersList[4]] : (
            obj.OM != null ? obj.OM : (
              obj.om != null ? obj.om : (
                obj.Column_5 != null ? obj.Column_5 : (filteredKeys[4] ? obj[filteredKeys[4]] : "")
              )
            )
          )
        );

        const rawSite = cleanVal(
          headersList[5] != null ? obj[headersList[5]] : (
            obj.Site != null ? obj.Site : (
              obj.site != null ? obj.site : (
                obj.SITE != null ? obj.SITE : (
                  obj.Column_6 != null ? obj.Column_6 : (filteredKeys[5] ? obj[filteredKeys[5]] : "")
                )
              )
            )
          )
        );

        const rawTl = cleanVal(
          headersList[6] != null ? obj[headersList[6]] : (
            obj.TL != null ? obj.TL : (
              obj.tl != null ? obj.tl : (
                obj.Column_7 != null ? obj.Column_7 : (filteredKeys[6] ? obj[filteredKeys[6]] : "")
              )
            )
          )
        );

        const rawAgent = cleanVal(
          headersList[7] != null ? obj[headersList[7]] : (
            obj["Agent Name"] != null ? obj["Agent Name"] : (
              obj.Agent != null ? obj.Agent : (
                obj.agent != null ? obj.agent : (
                  obj.Column_8 != null ? obj.Column_8 : (filteredKeys[7] ? obj[filteredKeys[7]] : "")
                )
              )
            )
          )
        );

        const rawAccount = cleanVal(
          headersList[8] != null ? obj[headersList[8]] : (
            obj.Account != null ? obj.Account : (
              obj.account != null ? obj.account : (
                obj.Column_9 != null ? obj.Column_9 : (filteredKeys[8] ? obj[filteredKeys[8]] : "")
              )
            )
          )
        );

        const rawReason = cleanVal(
          headersList[9] != null ? obj[headersList[9]] : (
            obj["CCTV Reason Codes"] != null ? obj["CCTV Reason Codes"] : (
              obj.Reason != null ? obj.Reason : (
                obj.reason != null ? obj.reason : (
                  obj.Column_10 != null ? obj.Column_10 : (filteredKeys[9] ? obj[filteredKeys[9]] : "")
                )
              )
            )
          )
        );

        const rawNoc = cleanVal(
          headersList[10] != null ? obj[headersList[10]] : (
            obj.NOC != null ? obj.NOC : (
              obj.noc != null ? obj.noc : (
                obj.Column_11 != null ? obj.Column_11 : (filteredKeys[10] ? obj[filteredKeys[10]] : "")
              )
            )
          )
        );

        const rawRemarks = cleanVal(
          headersList[11] != null ? obj[headersList[11]] : (
            obj.Remarks != null ? obj.Remarks : (
              obj.remarks != null ? obj.remarks : (
                obj.Column_12 != null ? obj.Column_12 : (filteredKeys[11] ? obj[filteredKeys[11]] : "")
              )
            )
          )
        );

        const flatRow = createEmptyRow({
          year: rawYear || ym.year,
          month: rawMonth || ym.month,
          date: rawDate,
          auditor: rawAuditor,
          om: rawOm,
          site: rawSite,
          tl: rawTl,
          agent: rawAgent,
          account: rawAccount,
          reason: rawReason,
          noc: rawNoc,
          remarks: rawRemarks
        });

        if (obj.sheetRow != null) {
          flatRow.sheetRow = obj.sheetRow;
          flatRow._sheetRow = obj.sheetRow;
        }

        parsed.push(flatRow);
      });

      if (parsed.length > 0) {
        // Authoritative dataset assignment: replaces old local draft
        rows = parsed;
        dataState.source = "live";
        dataState.sheetName = detectedSheet;
        dataState.totalRows = rows.length;
        dataState.lastFetchTime = new Date();
        dataState.lastError = null;

        runtimeTrace.normalizedTrackerRowCount = parsed.length;
        runtimeTrace.finalTrackerStateRowCount = rows.length;

        syncStatus.state = "idle";
        syncStatus.lastSyncTime = new Date();
        syncStatus.error = null;

        persistLocalDraft();
        notifyChange("data_loaded", { source: "live", count: rows.length });

        // Update rendered count in trace
        setTimeout(() => {
          const renderedRows = document.querySelectorAll("#liveTrackerSpreadsheetContainer tbody.sheet-body tr.sheet-row");
          runtimeTrace.renderedGridRowCount = renderedRows.length || rows.length;
        }, 50);

        return { success: true, count: rows.length, source: "live" };
      } else {
        throw new Error("Parsed 0 valid rows from sheet response");
      }
    } catch (err) {
      console.warn("fetchSharedSheetData error:", err);
      const errMsg = err.message || "Failed to connect to Google Sheets";
      dataState.lastError = errMsg;
      syncStatus.state = "idle";
      syncStatus.error = errMsg;

      if (rows.length > 0) {
        dataState.source = "cached";
      } else {
        dataState.source = "error";
      }

      notifyChange("fetch_error", { error: errMsg });
      return { success: false, error: errMsg };
    } finally {
      isSyncing = false;
      updateSyncStatus();
    }
  }

  function setAuditorFilter(filter) {
    dataState.auditorFilter = filter || "all";
    notifyChange("filter_changed", { filter: dataState.auditorFilter });
  }

  function getAuditorFilter() {
    return dataState.auditorFilter || "all";
  }

  function getFilteredRows() {
    const filter = (dataState.auditorFilter || "all").toLowerCase();
    if (filter === "all") return rows;
    if (filter === "my") {
      const myName = (window.CCTV_AUTH?.getProfile?.()?.display_name || window.CCTV_AUTH?.getUser?.()?.email || "").toLowerCase();
      if (!myName) return rows;
      return rows.filter(r => (r.auditor || "").toLowerCase().includes(myName) || myName.includes((r.auditor || "").toLowerCase()));
    }
    return rows.filter(r => (r.auditor || "").toLowerCase() === filter);
  }

  function getUniqueAuditors() {
    const names = new Set();
    rows.forEach(r => {
      const a = cleanVal(r.auditor);
      if (a) names.add(a);
    });
    return Array.from(names).sort();
  }

  function findMatches(query, options = {}) {
    if (!query || typeof query !== "string") return [];
    const text = options.caseSensitive ? query.trim() : query.trim().toLowerCase();
    if (!text) return [];

    const activeRows = getFilteredRows();
    const matches = [];

    activeRows.forEach((row, rIdx) => {
      COLUMNS.forEach((col, cIdx) => {
        if (options.columnKey && options.columnKey !== col.key) return;
        const rawVal = String(row[col.key] == null ? "" : row[col.key]);
        const compVal = options.caseSensitive ? rawVal : rawVal.toLowerCase();
        const foundIdx = compVal.indexOf(text);
        if (foundIdx >= 0) {
          matches.push({
            rowIdx: rIdx,
            colIdx: cIdx,
            colKey: col.key,
            colLabel: col.label,
            val: rawVal,
            rowUid: row._uid,
            startIdx: foundIdx,
            length: text.length
          });
        }
      });
    });

    return matches;
  }

  return {
    COLUMNS,

    init() {
      const local = loadLocalDraft();
      if (local && local.length) {
        rows = local;
        dataState.source = "cached";
        dataState.totalRows = rows.length;
      } else {
        rows = [];
        dataState.source = "connecting";
      }
      updateSyncStatus();

      // Fetch shared AUDIT 2026 dataset immediately
      fetchSharedSheetData().catch(console.warn);
    },

    getRuntimeTrace() {
      const renderedRows = document.querySelectorAll("#liveTrackerSpreadsheetContainer tbody.sheet-body tr.sheet-row");
      if (renderedRows && renderedRows.length) {
        runtimeTrace.renderedGridRowCount = renderedRows.length;
      }
      return { ...runtimeTrace };
    },

    fetchSharedSheetData,
    setAuditorFilter,
    getAuditorFilter,
    getFilteredRows,
    getUniqueAuditors,
    findMatches,
    getDataState() {
      return {
        ...dataState,
        totalRows: rows.length,
        filteredCount: getFilteredRows().length,
        unsavedCount: rows.filter(r => r._status === "unsaved").length,
        uniqueAuditors: getUniqueAuditors(),
        isSyncing
      };
    },

    getRows() {
      return getFilteredRows();
    },

    getAllRows() {
      return rows;
    },

    getRowCount() {
      return getFilteredRows().length;
    },

    getTotalRowCount() {
      return rows.length;
    },

    getColumns() {
      return COLUMNS;
    },

    getSyncStatus() {
      return { ...syncStatus };
    },

    getSettings,
    saveSettings,

    setCellValue(rowIdx, colKey, newValue) {
      const activeRows = getFilteredRows();
      if (rowIdx < 0 || rowIdx >= activeRows.length) return false;
      const row = activeRows[rowIdx];
      const oldValue = row[colKey];
      if (oldValue === newValue) return false;

      pushHistory({
        type: "CELL_EDIT",
        rowUid: row._uid,
        colKey,
        oldValue,
        newValue
      });

      row[colKey] = newValue;
      markRowDirty(row, colKey);
      notifyChange("cell_edit", { rowIdx, colKey, oldValue, newValue });
      return true;
    },

    setCellBatch(changes) {
      if (!changes || !changes.length) return false;
      const activeRows = getFilteredRows();
      const validChanges = [];
      changes.forEach(c => {
        const row = activeRows[c.rowIdx];
        if (row && row[c.colKey] !== c.newValue) {
          validChanges.push({
            rowUid: row._uid,
            rowIdx: c.rowIdx,
            colKey: c.colKey,
            oldValue: row[c.colKey],
            newValue: c.newValue
          });
          row[c.colKey] = c.newValue;
          markRowDirty(row, c.colKey);
        }
      });

      if (validChanges.length) {
        pushHistory({
          type: "BATCH_EDIT",
          changes: validChanges
        });
        notifyChange("batch_edit", { changes: validChanges });
        return true;
      }
      return false;
    },

    insertRow(index, rowData = {}, pushToHistory = true) {
      const idx = typeof index === "number" && index >= 0 ? Math.min(index, rows.length) : rows.length;
      const newRow = createEmptyRow(rowData);
      newRow._isNew = true;
      markRowDirty(newRow);

      rows.splice(idx, 0, newRow);
      if (pushToHistory) {
        pushHistory({
          type: "INSERT_ROW",
          index: idx,
          row: newRow
        });
      }
      notifyChange("insert_row", { index: idx, row: newRow });
      return { index: idx, row: newRow };
    },

    insertRowByDate(rowData = {}, pushToHistory = true) {
      const targetDate = rowData.date || new Date().toISOString().split("T")[0];
      const idx = findInsertionIndexForDate(targetDate);
      return this.insertRow(idx, { ...rowData, date: targetDate }, pushToHistory);
    },

    repositionRowByDate(rowIdx, pushToHistory = true) {
      const activeRows = getFilteredRows();
      if (rowIdx < 0 || rowIdx >= activeRows.length) return false;
      const targetRow = activeRows[rowIdx];
      const realIndex = rows.indexOf(targetRow);
      if (realIndex < 0) return false;
      const targetDate = targetRow.date;
      if (!targetDate) return false;

      // Extract row temporarily to find chronological slot among other rows
      rows.splice(realIndex, 1);
      const newIdx = findInsertionIndexForDate(targetDate);
      rows.splice(newIdx, 0, targetRow);

      if (realIndex !== newIdx) {
        if (pushToHistory) {
          pushHistory({
            type: "MOVE_ROW",
            fromIndex: realIndex,
            toIndex: newIdx
          });
        }
        markRowDirty(targetRow);
        notifyChange("reposition_row", { fromIndex: realIndex, toIndex: newIdx, row: targetRow });
      }
      return newIdx;
    },

    deleteRow(index, pushToHistory = true) {
      const activeRows = getFilteredRows();
      if (index < 0 || index >= activeRows.length) return null;
      const targetRow = activeRows[index];
      const realIndex = rows.indexOf(targetRow);
      if (realIndex < 0) return null;

      const [removed] = rows.splice(realIndex, 1);
      if (removed) {
        if (pushToHistory) {
          pushHistory({
            type: "DELETE_ROW",
            index: realIndex,
            row: removed
          });
        }
        scheduleDebouncedSync();
        notifyChange("delete_row", { index: realIndex, row: removed });
      }
      return removed;
    },

    duplicateRow(index) {
      const activeRows = getFilteredRows();
      if (index < 0 || index >= activeRows.length) return null;
      const source = activeRows[index];
      const realIndex = rows.indexOf(source);
      if (realIndex < 0) return null;

      const copyData = {};
      COLUMNS.forEach(c => { copyData[c.key] = source[c.key]; });
      return this.insertRow(realIndex + 1, copyData, true);
    },

    undo() {
      if (!undoStack.length) return false;
      const cmd = undoStack.pop();
      executeCommand(cmd, true);
      redoStack.push(cmd);
      notifyChange("undo", { command: cmd });
      return true;
    },

    redo() {
      if (!redoStack.length) return false;
      const cmd = redoStack.pop();
      executeCommand(cmd, false);
      undoStack.push(cmd);
      notifyChange("redo", { command: cmd });
      return true;
    },

    canUndo() {
      return undoStack.length > 0;
    },

    canRedo() {
      return redoStack.length > 0;
    },

    clearAllRows() {
      if (!rows.length) return;
      rows = [];
      undoStack = [];
      redoStack = [];
      persistLocalDraft();
      updateSyncStatus();
      notifyChange("clear_all");
    },

    // Import external tabular rows (from Google Sheets or Excel paste)
    importTabularRows(rawText, mode = "replace") {
      const lines = rawText.split(/\r?\n/).filter(l => l.trim().length > 0);
      if (!lines.length) return 0;

      const imported = [];
      lines.forEach(line => {
        const parts = line.split("\t");
        if (parts.length === 1 && line.includes(",")) {
          // CSV fallback
          parts.splice(0, parts.length, ...line.split(","));
        }
        const rowData = {};
        COLUMNS.forEach((col, idx) => {
          rowData[col.key] = parts[idx] != null ? cleanVal(parts[idx]) : "";
        });
        if (rowData.date) rowData.date = parseDateToIso(rowData.date);
        imported.push(createEmptyRow(rowData));
      });

      if (mode === "replace") {
        rows = imported;
      } else {
        rows.push(...imported);
      }
      rows.forEach(r => markRowDirty(r));
      notifyChange("import", { count: imported.length });
      return imported.length;
    },

    subscribe(fn) {
      if (typeof fn === "function") listeners.push(fn);
      return () => { listeners = listeners.filter(l => l !== fn); };
    },

    subscribeSync(fn) {
      if (typeof fn === "function") syncListeners.push(fn);
      return () => { syncListeners = syncListeners.filter(l => l !== fn); };
    },

    triggerImmediateSync() {
      return autoSyncPending();
    }
  };
})();
