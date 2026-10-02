/**
 * CCTV OPS V2 - Masterlist Service
 * Functional parity with Authoritative V1 Master List & Google Sheets Sync
 */

(function () {
  'use strict';

  const DEFAULT_API_URL = 'https://script.google.com/macros/s/AKfycbw2-7ERz3psAaUfsceoFHV6leNmqFf5HxgasRYORMHU8bbnte7DLbDIfX_YzjRrzMZh/exec';
  const REFRESH_MS = 5 * 60 * 1000;
  const CACHE_DB = "cctv_masterlist_simple_v1";
  const CACHE_STORE = "state";
  const CACHE_KEY = "latest";
  const NOTEPAD_KEY_PREFIX = "cctv_master_pending_notes_v2_";
  const HR_LOCAL_KEY = "cctv_master_hr_local_crud_v1";
  const ACTIVE_PENDING_KEY = "cctv_master_active_pending_v2";
  const OPTIONS_LOCAL_KEY = "cctv_master_options_v2";
  const EDR_LEGACY_CUSTOM_KEY = "cctv_master_edr_custom_options_v1";

  const PENDING_LABELS = {
    miles: "Miles",
    seth: "Seth",
    wendie: "Wendie",
    kenneth: "Kenneth",
    jr: "JR"
  };

  const PENDING_COLUMNS = [
    "Year", "Month", "Date", "Name", "OM", "SITE",
    "TL", "Agent Name", "Account", "CCTV Reason Codes", "NOC", "Remarks"
  ];

  const BUILT_IN_HR_ASSIGNMENTS = [
    { id: "seed_hr_1", site: 'Mabini Site', omTeam: 'Team Mirah', hr: 'Marianne Perez', source: "seed" },
    { id: "seed_hr_2", site: 'Mabini Site', omTeam: 'Team Irene', hr: 'Angelika Felasol', source: "seed" },
    { id: "seed_hr_3", site: 'Mabini Site', omTeam: 'Irene BIGO', hr: 'Rhea Picot', source: "seed" },
    { id: "seed_hr_4", site: 'Mabini Site', omTeam: 'Team Mogan', hr: 'Allen Valdez', source: "seed" },
    { id: "seed_hr_5", site: 'Mabini Site', omTeam: 'Team Joneza (FBB)', hr: 'Angelika Felasol', source: "seed" },
    { id: "seed_hr_6", site: 'Mabini Site', omTeam: 'Team Renato', hr: 'Geselle Merencillo', source: "seed" },
    { id: "seed_hr_7", site: 'Mabini Site', omTeam: 'Team Jordan', hr: 'Marie Peralta / Shyra Rendon', source: "seed" },
    { id: "seed_hr_8", site: 'Mabini Site', omTeam: 'Team Crystal', hr: 'Geselle Merencillo', source: "seed" },
    { id: "seed_hr_9", site: 'Digos Site', omTeam: 'OM Jordan & OM Cherry', hr: 'Alliah Alisoso', source: "seed" },
    { id: "seed_hr_10", site: 'Digos Site', omTeam: 'OM Shayne', hr: 'Joven Jay Bauden', source: "seed" },
    { id: "seed_hr_11", site: 'Digos Site', omTeam: 'OM Mirah & OM Freda', hr: 'Gleecille Goles', source: "seed" },
    { id: "seed_hr_12", site: 'Ecoland Site', omTeam: 'OM Rhelford - DLPC Norderco', hr: 'Reena Coralde', source: "seed" },
    { id: "seed_hr_13", site: 'Ecoland Site', omTeam: 'OM Rhelford - UMG', hr: 'Angel Jomolo', source: "seed" },
    { id: "seed_hr_14", site: 'Ecoland Site', omTeam: 'OM Rhelford - Special Hires', hr: 'Angel Jomolo', source: "seed" },
    { id: "seed_hr_15", site: 'Ecoland Site', omTeam: 'OM Thirdie - BIGO Ecoland', hr: 'Kimberly Sueta', source: "seed" },
    { id: "seed_hr_16", site: 'Gensan Site', omTeam: 'Team Abby', hr: 'Phoebe Bularon', source: "seed" },
    { id: "seed_hr_17", site: 'Gensan Site', omTeam: 'Team Mirah', hr: 'Marian Malinao', source: "seed" },
    { id: "seed_hr_18", site: 'Gensan Site', omTeam: 'Team Willy', hr: 'Marian Malinao', source: "seed" },
    { id: "seed_hr_19", site: 'Gensan Site', omTeam: 'Team Irene', hr: 'Marian Malinao', source: "seed" },
    { id: "seed_hr_20", site: 'Gensan Site', omTeam: 'Team Michelle', hr: 'Marian Malinao', source: "seed" },
    { id: "seed_hr_21", site: 'Maa Site', omTeam: 'Team MJ Shopee', hr: 'Gerald Calfoforo', source: "seed" },
    { id: "seed_hr_22", site: 'Maa Site', omTeam: 'Team Mark Shopee', hr: 'Judelaine Mae Bacus', source: "seed" },
    { id: "seed_hr_23", site: 'Maa Site', omTeam: 'Team James Shopee', hr: 'Khristine Cate Lumayag', source: "seed" },
    { id: "seed_hr_24", site: 'Maa Site', omTeam: 'TD MAA', hr: 'Shania Angelika Punzalan', source: "seed" },
    { id: "seed_hr_25", site: 'Maa Site', omTeam: 'OM Willy', hr: 'Jodels Pantonial', source: "seed" },
    { id: "seed_hr_26", site: 'Maa Site', omTeam: 'OM Norman', hr: 'Elsy Mae Villarino', source: "seed" },
    { id: "seed_hr_27", site: 'Maa Site', omTeam: 'OM Derline', hr: 'John Albert Golosino', source: "seed" },
    { id: "seed_hr_28", site: 'Maa Site', omTeam: 'OM Michelle & OM Elezalde', hr: 'Annie Mae Tomanggong', source: "seed" },
    { id: "seed_hr_29", site: 'Maa Site', omTeam: 'OM Cherry', hr: 'Keycee Selerio', source: "seed" },
    { id: "seed_hr_30", site: 'Maa Site', omTeam: 'OM Shiela', hr: 'Cherry Ann Ordeniza', source: "seed" },
    { id: "seed_hr_31", site: 'Maa Site', omTeam: 'OM Beth', hr: 'Cherry Ann Ordeniza', source: "seed" },
    { id: "seed_hr_32", site: 'Maa Site', omTeam: 'OM Frederick', hr: 'Anne Kimberly Briones', source: "seed" },
    { id: "seed_hr_33", site: 'CDO Site', omTeam: 'Team Shey', hr: 'Johairah Sanggacala', source: "seed" },
    { id: "seed_hr_34", site: 'CDO Site', omTeam: 'Team Mirah', hr: 'Queen Dibbie Barros', source: "seed" },
    { id: "seed_hr_35", site: 'CDO Site', omTeam: 'Team Norman', hr: 'Queen Dibbie Barros', source: "seed" },
    { id: "seed_hr_36", site: 'CDO Site', omTeam: 'Team Daniel', hr: 'Queen Dibbie Barros', source: "seed" },
    { id: "seed_hr_37", site: 'CDO Site', omTeam: 'Support Group', hr: 'Queen Dibbie Barros', source: "seed" }
  ];

  function clean(value) {
    return String(value == null ? "" : value).replace(/\s+/g, " ").trim();
  }

  function optionIdentityKey(value) {
    if (value == null) return "";
    return clean(value).toLowerCase();
  }

  function norm(value) {
    return clean(value)
      .toLowerCase()
      .replace(/[_\/\\-]+/g, " ")
      .replace(/[^a-z0-9@. ]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function hrGroupKey(item) {
    return [norm(item?.site), norm(item?.omTeam)].join("|");
  }

  function rowVal(row, aliases) {
    if (!row || typeof row !== "object") return "";
    const key = Object.keys(row).find(rawKey => {
      const k = norm(rawKey);
      return aliases.some(alias => k === alias || k.includes(alias));
    });
    return key ? clean(row[key]) : "";
  }

  function trackerNoc(row) {
    return rowVal(row, ["noc"]);
  }

  function trackerName(row) {
    return rowVal(row, ["name"]);
  }

  function pendingOnly(rows) {
    const source = Array.isArray(rows) ? rows : [];
    const hasNoc = source.some(row => clean(trackerNoc(row)));
    return hasNoc ? source.filter(row => norm(trackerNoc(row)) === "pending") : source;
  }

  function findRowKey(row, wanted) {
    const keys = Object.keys(row || {});
    return keys.find(key => norm(key) === norm(wanted)) ||
      keys.find(key => norm(key).includes(norm(wanted))) || "";
  }

  class MasterlistService {
    constructor() {
      this.apiUrl = (window.CCTV_V2_CONFIG && window.CCTV_V2_CONFIG.MASTERLIST_API_URL) || DEFAULT_API_URL;
      this.payload = null;
      this.pendingTrackers = { miles: [], seth: [], wendie: [], kenneth: [], jr: [] };
      this.activePendingKey = localStorage.getItem(ACTIVE_PENDING_KEY) || "miles";
      this.hrAssignments = [];
      this.localHrChanges = this._loadLocalHrChanges();
      this.masterOptions = this._loadMasterOptions();
      this.activeOms = [];
      this.activeTls = [];
      this.activeAccounts = [];
      this.lastSyncError = "";
      this.lastUpdated = null;
      this.syncState = { kind: "syncing", title: "Connecting...", detail: "Initializing Master List data" };
      this.listeners = [];
      this.autoRefreshTimer = null;
      this.initialized = false;
      this._derive();
    }

    _loadLocalHrChanges() {
      try {
        const val = JSON.parse(localStorage.getItem(HR_LOCAL_KEY) || "[]");
        return Array.isArray(val) ? val : [];
      } catch (_) {
        return [];
      }
    }

    _saveLocalHrChanges() {
      try {
        localStorage.setItem(HR_LOCAL_KEY, JSON.stringify(this.localHrChanges));
      } catch (err) {
        console.warn("Failed to persist local HR changes:", err);
      }
    }

    _loadMasterOptions() {
      try {
        const raw = localStorage.getItem(OPTIONS_LOCAL_KEY);
        let parsed = raw ? JSON.parse(raw) : null;
        if (!parsed) {
          const legacy = JSON.parse(localStorage.getItem(EDR_LEGACY_CUSTOM_KEY) || "{}");
          parsed = {
            added: {
              oms: Array.isArray(legacy?.oms) ? legacy.oms : [],
              tls: Array.isArray(legacy?.tls) ? legacy.tls : [],
              accounts: Array.isArray(legacy?.accounts) ? legacy.accounts : [],
              sites: [],
              reasons: []
            },
            deactivated: {
              oms: [],
              tls: [],
              accounts: [],
              sites: [],
              reasons: []
            }
          };
          localStorage.setItem(OPTIONS_LOCAL_KEY, JSON.stringify(parsed));
        }
        // Ensure all categories exist (backward compat with old saves lacking sites/reasons/infractions)
        if (!parsed.added) parsed.added = {};
        if (!parsed.deactivated) parsed.deactivated = {};
        if (!parsed.displayOverrides) parsed.displayOverrides = {};
        for (const cat of ["oms", "tls", "accounts", "sites", "reasons", "infractions"]) {
          if (!Array.isArray(parsed.added[cat])) parsed.added[cat] = [];
          if (!Array.isArray(parsed.deactivated[cat])) parsed.deactivated[cat] = [];
          if (!parsed.displayOverrides[cat] || typeof parsed.displayOverrides[cat] !== "object") {
            parsed.displayOverrides[cat] = {};
          }
        }
        // Also migrate any cctv_dropdown_* values that aren't yet in masterOptions
        this._migrateLegacyDropdownKeys(parsed);
        return parsed;
      } catch (_) {
        return {
          added: { oms: [], tls: [], accounts: [], sites: [], reasons: [], infractions: [] },
          deactivated: { oms: [], tls: [], accounts: [], sites: [], reasons: [], infractions: [] },
          displayOverrides: { oms: {}, tls: {}, accounts: {}, sites: {}, reasons: {}, infractions: {} }
        };
      }
    }

    _migrateLegacyDropdownKeys(parsed) {
      // One-time migration: pull any custom entries from flat cctv_dropdown_* arrays
      // into masterOptions so there is a single source of truth going forward.
      const legacyMap = {
        sites: "cctv_dropdown_site",
        accounts: "cctv_dropdown_account",
        reasons: "cctv_dropdown_reasonCode"
      };
      let changed = false;
      const defaultSites = (window.CCTV_V2_CONFIG && window.CCTV_V2_CONFIG.DEFAULTS && window.CCTV_V2_CONFIG.DEFAULTS.SITES) || [];
      const defaultAccs = (window.CCTV_V2_CONFIG && window.CCTV_V2_CONFIG.DEFAULTS && window.CCTV_V2_CONFIG.DEFAULTS.ACCOUNTS) || [];
      const defaultReasons = (window.CCTV_V2_CONFIG && window.CCTV_V2_CONFIG.DEFAULTS && window.CCTV_V2_CONFIG.DEFAULTS.REASON_CODES) || [];
      const defaultsMap = { sites: defaultSites, accounts: defaultAccs, reasons: defaultReasons };

      for (const [cat, storageKey] of Object.entries(legacyMap)) {
        try {
          const raw = localStorage.getItem(storageKey);
          if (!raw) continue;
          const arr = JSON.parse(raw);
          if (!Array.isArray(arr)) continue;
          const defaults = defaultsMap[cat] || [];
          for (const item of arr) {
            const c = clean(item);
            const k = optionIdentityKey(c);
            if (!k) continue;
            // Only migrate entries that are NOT in the defaults list
            const isDefault = defaults.some(d => optionIdentityKey(d) === k);
            if (isDefault) continue;
            const alreadyAdded = parsed.added[cat].some(x => optionIdentityKey(x) === k);
            const isDeactivated = parsed.deactivated[cat].some(x => optionIdentityKey(x) === k);
            if (!alreadyAdded && !isDeactivated) {
              parsed.added[cat].push(c);
              changed = true;
            }
          }
          if (changed) {
            parsed.added[cat].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base', numeric: true }));
          }
        } catch (_) {/* ignore bad legacy data */}
      }
      return changed;
    }

    _saveMasterOptions() {
      try {
        localStorage.setItem(OPTIONS_LOCAL_KEY, JSON.stringify(this.masterOptions));
      } catch (err) {
        console.warn("Failed to persist master options:", err);
      }
    }

    async _openCacheDb() {
      return new Promise((resolve, reject) => {
        const req = indexedDB.open(CACHE_DB, 1);
        req.onupgradeneeded = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains(CACHE_STORE)) {
            db.createObjectStore(CACHE_STORE);
          }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    }

    async _saveCache(data) {
      try {
        const db = await this._openCacheDb();
        await new Promise((resolve, reject) => {
          const tx = db.transaction(CACHE_STORE, "readwrite");
          tx.objectStore(CACHE_STORE).put(data, CACHE_KEY);
          tx.oncomplete = resolve;
          tx.onerror = () => reject(tx.error);
        });
        db.close();
      } catch (err) {
        console.warn("Masterlist cache save failed:", err);
      }
    }

    async _loadCache() {
      try {
        const db = await this._openCacheDb();
        const saved = await new Promise((resolve, reject) => {
          const tx = db.transaction(CACHE_STORE, "readonly");
          const req = tx.objectStore(CACHE_STORE).get(CACHE_KEY);
          req.onsuccess = () => resolve(req.result || null);
          req.onerror = () => reject(req.error);
        });
        db.close();
        return saved;
      } catch (_) {
        return null;
      }
    }

    async init() {
      if (this.initialized) return;
      this.initialized = true;

      // Load cached payload immediately if available for fast offline startup
      const cached = await this._loadCache();
      if (cached) {
        this.payload = cached;
        this.lastUpdated = cached.updatedAt ? new Date(cached.updatedAt) : new Date();
        this._derive();
        this.syncState = {
          kind: "live",
          title: "Showing saved data while syncing",
          detail: `${this._totalPendingCount()} pending rows · ${this.hrAssignments.length} HR assignments loaded.`
        };
        this._notify();
      } else {
        this._derive();
        this._notify();
      }

      // Initial live sync
      await this.loadMasterList(false);

      // Setup 5-minute auto-refresh interval
      if (this.autoRefreshTimer) clearInterval(this.autoRefreshTimer);
      this.autoRefreshTimer = setInterval(() => {
        this.loadMasterList(false);
      }, REFRESH_MS);

      // Register History Adapter
      this._registerHistoryAdapter();
    }

    _totalPendingCount() {
      return Object.values(this.pendingTrackers).reduce((sum, arr) => sum + (Array.isArray(arr) ? arr.length : 0), 0);
    }

    _rowsFrom(name) {
      const direct = this.payload?.[name];
      if (Array.isArray(direct)) return direct;
      const nested = this.payload?.sheets?.[name]?.rows;
      return Array.isArray(nested) ? nested : [];
    }

    _gridFrom(name) {
      const nested = this.payload?.sheets?.[name]?.grid;
      return Array.isArray(nested) ? nested : [];
    }

    _webHrRows() {
      const direct = this.payload?.webHrAssignments;
      if (Array.isArray(direct)) return direct;
      const nested = this.payload?.sheets?.webHrAssignments?.rows;
      return Array.isArray(nested) ? nested : [];
    }

    _parseWebHrRows() {
      return this._webHrRows()
        .map((row, index) => ({
          id: rowVal(row, ["id"]) || `web_${index}`,
          site: rowVal(row, ["site"]),
          omTeam: rowVal(row, ["om / team", "om team", "om", "team"]),
          hr: rowVal(row, ["hr assignee", "assigned hr", "hr"]),
          source: "web"
        }))
        .filter(item => item.site && item.omTeam && item.hr);
    }

    _extractHrTableFromGrid(grid, source) {
      if (!Array.isArray(grid) || !grid.length) return [];
      const results = [];

      for (let r = 0; r < grid.length; r++) {
        const header = (grid[r] || []).map(cell => norm(cell));
        const siteIdx = header.findIndex(v => v === "site" || v.includes("hr site"));
        const omIdx = header.findIndex(v =>
          v === "om / team" || v === "om team" || v === "om" || v === "team" || v.includes("om / team")
        );
        const hrIdx = header.findIndex(v =>
          v === "hr assignee" || v === "assigned hr" || v === "hr assigned" || v === "hr"
        );
        if (siteIdx < 0 || omIdx < 0 || hrIdx < 0) continue;

        let blankRows = 0;
        for (let rr = r + 1; rr < grid.length; rr++) {
          const row = grid[rr] || [];
          const site = clean(row[siteIdx]);
          const omTeam = clean(row[omIdx]);
          const hr = clean(row[hrIdx]);

          if (!site && !omTeam && !hr) {
            blankRows++;
            if (blankRows >= 2) break;
            continue;
          }
          blankRows = 0;

          if (site && omTeam && hr) {
            results.push({
              id: `${source}_${r}_${rr}`,
              site,
              omTeam,
              hr,
              source
            });
          }
        }
      }
      return results;
    }

    _derive() {
      if (this.payload?.pending) {
        this.pendingTrackers = {
          miles: Array.isArray(this.payload.pending.miles) ? this.payload.pending.miles : [],
          seth: Array.isArray(this.payload.pending.seth) ? this.payload.pending.seth : [],
          wendie: Array.isArray(this.payload.pending.wendie) ? this.payload.pending.wendie : [],
          kenneth: Array.isArray(this.payload.pending.kenneth) ? this.payload.pending.kenneth : [],
          jr: Array.isArray(this.payload.pending.jr) ? this.payload.pending.jr : []
        };
      } else {
        const tracker = this._rowsFrom("tracker");
        const pendingMiles = tracker.filter(row =>
          norm(trackerName(row)) === "miles" && norm(trackerNoc(row)) === "pending"
        );
        this.pendingTrackers = {
          miles: pendingMiles,
          seth: pendingOnly(this._rowsFrom("pendingSeth")),
          wendie: pendingOnly(this._rowsFrom("pendingWendie")),
          kenneth: pendingOnly(this._rowsFrom("pendingKenneth")),
          jr: pendingOnly(this._rowsFrom("pendingJr"))
        };
      }

      // Base assignments from seed + sheet tables + web endpoint
      const candidates = [
        ...BUILT_IN_HR_ASSIGNMENTS,
        ...this._extractHrTableFromGrid(this._gridFrom("masterList"), "masterList"),
        ...this._extractHrTableFromGrid(this._gridFrom("data"), "data"),
        ...this._parseWebHrRows()
      ];

      const map = new Map();
      candidates.forEach(item => {
        const key = hrGroupKey(item);
        if (!key || key === "|") return;
        map.set(key, { ...item });
      });

      // Apply local CRUD overrides / deletions
      this.localHrChanges.forEach(item => {
        const key = hrGroupKey(item);
        if (!key || key === "|") return;
        if (item.deleted) {
          map.delete(key);
        } else {
          map.set(key, { ...item, source: item.source || "local" });
        }
      });

      this.hrAssignments = [...map.values()].sort((a, b) =>
        clean(a.site).localeCompare(clean(b.site)) ||
        clean(a.omTeam).localeCompare(clean(b.omTeam))
      );

      // Derive Active Authoritative Options
      const deactOms = new Set((this.masterOptions.deactivated.oms || []).map(v => optionIdentityKey(v)));
      const deactTls = new Set((this.masterOptions.deactivated.tls || []).map(v => optionIdentityKey(v)));
      const deactAccs = new Set((this.masterOptions.deactivated.accounts || []).map(v => optionIdentityKey(v)));
      const deactSites = new Set((this.masterOptions.deactivated.sites || []).map(v => optionIdentityKey(v)));
      const deactReasons = new Set((this.masterOptions.deactivated.reasons || []).map(v => optionIdentityKey(v)));
      const deactInfractions = new Set((this.masterOptions.deactivated.infractions || []).map(v => optionIdentityKey(v)));

      const defaultOms = (window.CCTV_V2_CONFIG && window.CCTV_V2_CONFIG.DEFAULTS && window.CCTV_V2_CONFIG.DEFAULTS.OMS) || [];
      const defaultTls = (window.CCTV_V2_CONFIG && window.CCTV_V2_CONFIG.DEFAULTS && window.CCTV_V2_CONFIG.DEFAULTS.TLS) || [];
      const defaultAccs = (window.CCTV_V2_CONFIG && window.CCTV_V2_CONFIG.DEFAULTS && window.CCTV_V2_CONFIG.DEFAULTS.ACCOUNTS) || [];
      const defaultSites = (window.CCTV_V2_CONFIG && window.CCTV_V2_CONFIG.DEFAULTS && window.CCTV_V2_CONFIG.DEFAULTS.SITES) || [];
      const defaultReasons = (window.CCTV_V2_CONFIG && window.CCTV_V2_CONFIG.DEFAULTS && window.CCTV_V2_CONFIG.DEFAULTS.REASON_CODES) || [];
      const defaultInfractions = (window.CCTV_V2_CONFIG && window.CCTV_V2_CONFIG.DEFAULTS && window.CCTV_V2_CONFIG.DEFAULTS.INFRACTIONS) || [];

      const sheetTls = new Set();
      const sheetOms = new Set();
      const sheetAccs = new Set();

      Object.values(this.pendingTrackers).forEach(arr => {
        if (!Array.isArray(arr)) return;
        arr.forEach(row => {
          const om = this.valueForPendingColumn(row, "OM");
          const tl = this.valueForPendingColumn(row, "TL");
          const acc = this.valueForPendingColumn(row, "Account");
          if (om) sheetOms.add(om);
          if (tl) sheetTls.add(tl);
          if (acc) sheetAccs.add(acc);
        });
      });

      this.hrAssignments.forEach(h => {
        if (h.deleted) return;
        const name = clean(h.omTeam);
        if (!name) return;
        if (/^OM\s+/i.test(name)) {
          sheetOms.add(name.replace(/^OM\s+/i, "").trim());
        } else if (/^Team\s+/i.test(name)) {
          sheetTls.add(name);
        }
      });

      // OMs: defaults + sheets first, then user additions & displayOverrides OVERWRITE display label
      const omMap = new Map();
      [...defaultOms, ...sheetOms].forEach(raw => {
        const c = clean(raw);
        const k = optionIdentityKey(c);
        if (!k || deactOms.has(k)) return;
        if (!omMap.has(k)) omMap.set(k, c);
      });
      (this.masterOptions.added.oms || []).forEach(raw => {
        const c = clean(raw);
        const k = optionIdentityKey(c);
        if (!k || deactOms.has(k)) return;
        omMap.set(k, c);
      });
      if (this.masterOptions.displayOverrides?.oms) {
        Object.entries(this.masterOptions.displayOverrides.oms).forEach(([k, displayVal]) => {
          if (displayVal && !deactOms.has(k)) omMap.set(k, clean(displayVal));
        });
      }
      this.activeOms = [...omMap.values()].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base", numeric: true }));

      // TLs: defaults + sheets first, then user additions & displayOverrides OVERWRITE display label
      const tlMap = new Map();
      [...defaultTls, ...sheetTls].forEach(raw => {
        const c = clean(raw);
        const k = optionIdentityKey(c);
        if (!k || deactTls.has(k)) return;
        if (!tlMap.has(k)) tlMap.set(k, c);
      });
      (this.masterOptions.added.tls || []).forEach(raw => {
        const c = clean(raw);
        const k = optionIdentityKey(c);
        if (!k || deactTls.has(k)) return;
        tlMap.set(k, c);
      });
      if (this.masterOptions.displayOverrides?.tls) {
        Object.entries(this.masterOptions.displayOverrides.tls).forEach(([k, displayVal]) => {
          if (displayVal && !deactTls.has(k)) tlMap.set(k, clean(displayVal));
        });
      }
      this.activeTls = [...tlMap.values()].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base", numeric: true }));

      // Accounts: defaults + sheets first, then user additions & displayOverrides OVERWRITE display label
      const accMap = new Map();
      [...defaultAccs, ...sheetAccs].forEach(raw => {
        const c = clean(raw);
        const k = optionIdentityKey(c);
        if (!k || deactAccs.has(k)) return;
        if (!accMap.has(k)) accMap.set(k, c);
      });
      (this.masterOptions.added.accounts || []).forEach(raw => {
        const c = clean(raw);
        const k = optionIdentityKey(c);
        if (!k || deactAccs.has(k)) return;
        accMap.set(k, c);
      });
      if (this.masterOptions.displayOverrides?.accounts) {
        Object.entries(this.masterOptions.displayOverrides.accounts).forEach(([k, displayVal]) => {
          if (displayVal && !deactAccs.has(k)) accMap.set(k, clean(displayVal));
        });
      }
      this.activeAccounts = [...accMap.values()].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base", numeric: true }));

      // Sites: defaults first, then user additions & displayOverrides OVERWRITE display label
      const siteMap = new Map();
      defaultSites.forEach(raw => {
        const c = clean(raw);
        const k = optionIdentityKey(c);
        if (!k || deactSites.has(k)) return;
        if (!siteMap.has(k)) siteMap.set(k, c);
      });
      (this.masterOptions.added.sites || []).forEach(raw => {
        const c = clean(raw);
        const k = optionIdentityKey(c);
        if (!k || deactSites.has(k)) return;
        siteMap.set(k, c);
      });
      if (this.masterOptions.displayOverrides?.sites) {
        Object.entries(this.masterOptions.displayOverrides.sites).forEach(([k, displayVal]) => {
          if (displayVal && !deactSites.has(k)) siteMap.set(k, clean(displayVal));
        });
      }
      const defaultSiteKeys = new Set(defaultSites.map(s => optionIdentityKey(s)));
      this.activeSites = [
        ...defaultSites.filter(s => !deactSites.has(optionIdentityKey(s))).map(s => siteMap.get(optionIdentityKey(s)) || s),
        ...(this.masterOptions.added.sites || []).filter(s => {
          const k = optionIdentityKey(s);
          return k && !deactSites.has(k) && !defaultSiteKeys.has(k);
        }).map(s => siteMap.get(optionIdentityKey(s)) || s).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base", numeric: true }))
      ];

      // Reason codes: defaults first, then user additions & displayOverrides OVERWRITE display label
      const reasonMap = new Map();
      defaultReasons.forEach(raw => {
        const c = clean(raw);
        const k = optionIdentityKey(c);
        if (!k || deactReasons.has(k)) return;
        if (!reasonMap.has(k)) reasonMap.set(k, c);
      });
      (this.masterOptions.added.reasons || []).forEach(raw => {
        const c = clean(raw);
        const k = optionIdentityKey(c);
        if (!k || deactReasons.has(k)) return;
        reasonMap.set(k, c);
      });
      if (this.masterOptions.displayOverrides?.reasons) {
        Object.entries(this.masterOptions.displayOverrides.reasons).forEach(([k, displayVal]) => {
          if (displayVal && !deactReasons.has(k)) reasonMap.set(k, clean(displayVal));
        });
      }
      const defaultReasonKeys = new Set(defaultReasons.map(r => optionIdentityKey(r)));
      this.activeReasons = [
        ...defaultReasons.filter(r => !deactReasons.has(optionIdentityKey(r))).map(r => reasonMap.get(optionIdentityKey(r)) || r),
        ...(this.masterOptions.added.reasons || []).filter(r => {
          const k = optionIdentityKey(r);
          return k && !deactReasons.has(k) && !defaultReasonKeys.has(k);
        }).map(r => reasonMap.get(optionIdentityKey(r)) || r).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base", numeric: true }))
      ];

      // Infractions: defaults first, then user additions & displayOverrides
      const infraMap = new Map();
      defaultInfractions.forEach(raw => {
        const c = clean(raw);
        const k = optionIdentityKey(c);
        if (!k || deactInfractions.has(k)) return;
        if (!infraMap.has(k)) infraMap.set(k, c);
      });
      (this.masterOptions.added.infractions || []).forEach(raw => {
        const c = clean(raw);
        const k = optionIdentityKey(c);
        if (!k || deactInfractions.has(k)) return;
        infraMap.set(k, c);
      });
      if (this.masterOptions.displayOverrides && this.masterOptions.displayOverrides.infractions) {
        Object.entries(this.masterOptions.displayOverrides.infractions).forEach(([k, displayVal]) => {
          if (displayVal && !deactInfractions.has(k)) infraMap.set(k, clean(displayVal));
        });
      }
      const defaultInfractionKeys = new Set(defaultInfractions.map(r => optionIdentityKey(r)));
      this.activeInfractions = [
        ...defaultInfractions.filter(r => !deactInfractions.has(optionIdentityKey(r))).map(r => infraMap.get(optionIdentityKey(r)) || r),
        ...(this.masterOptions.added.infractions || []).filter(r => {
          const k = optionIdentityKey(r);
          return k && !deactInfractions.has(k) && !defaultInfractionKeys.has(k);
        }).map(r => infraMap.get(optionIdentityKey(r)) || r).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base", numeric: true }))
      ];
    }

    async loadMasterList(forceFresh = false) {
      this.syncState = {
        kind: "syncing",
        title: "Syncing Google Sheets...",
        detail: "Checking Pending Trackers (Miles, Seth, Wendie, Kenneth, JR) and Assigned HR per OM."
      };
      this._notify();

      try {
        const separator = this.apiUrl.includes("?") ? "&" : "?";
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 25000);
        const response = await fetch(`${this.apiUrl}${separator}_=${Date.now()}`, {
          method: "GET",
          mode: "cors",
          credentials: "omit",
          cache: "no-store",
          signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`Google Sheets API returned ${response.status}.`);
        }

        const data = await response.json();
        if (data?.success === false) {
          throw new Error(data.error || "Google Sheets API returned an error.");
        }

        this.payload = data;
        this.lastSyncError = "";
        this.lastUpdated = data.updatedAt ? new Date(data.updatedAt) : new Date();
        this._derive();
        await this._saveCache(data);

        this.syncState = {
          kind: "live",
          title: "Google Sheets connected",
          detail: `${this._totalPendingCount()} pending rows · ${this.hrAssignments.length} HR assignments loaded.`
        };
        this._notify();
        return { success: true };
      } catch (error) {
        console.warn("Masterlist sync failed:", error);
        this.lastSyncError = error.message || "Could not connect to Google Sheets";

        const cached = await this._loadCache();
        if (cached) {
          this.payload = cached;
          this._derive();
          this.syncState = {
            kind: "error",
            title: "Live sync unavailable",
            detail: "Showing the last saved data. Click Refresh to try again."
          };
          this._notify();
          return { success: false, cached: true, error: this.lastSyncError };
        }

        this._derive();
        this.syncState = {
          kind: "error",
          title: "Could not connect to Google Sheets",
          detail: error.message || "Check the Apps Script deployment."
        };
        this._notify();
        return { success: false, cached: false, error: this.lastSyncError };
      }
    }

    getSyncState() {
      return {
        ...this.syncState,
        lastUpdated: this.lastUpdated,
        formattedTime: this.lastUpdated ? this._formatSyncTime(this.lastUpdated) : "Not synced yet"
      };
    }

    _formatSyncTime(date) {
      if (!date || Number.isNaN(date.getTime())) return "Updated just now";
      return "Updated " + date.toLocaleString([], {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      });
    }

    getTrackers() {
      return Object.entries(PENDING_LABELS).map(([key, label]) => ({
        key,
        label,
        count: Array.isArray(this.pendingTrackers[key]) ? this.pendingTrackers[key].length : 0,
        active: key === this.activePendingKey,
        sourceInfo: this.payload?.sources?.[key] || null
      }));
    }

    getActiveTrackerKey() {
      return this.activePendingKey;
    }

    setActiveTrackerKey(key) {
      if (!PENDING_LABELS[key]) return;
      this.activePendingKey = key;
      try {
        localStorage.setItem(ACTIVE_PENDING_KEY, key);
      } catch (_) {}
      this._notify();
    }

    getColumns() {
      return [...PENDING_COLUMNS];
    }

    getPendingRows(key = this.activePendingKey) {
      return this.pendingTrackers[key] || [];
    }

    valueForPendingColumn(row, column) {
      if (!row || typeof row !== "object") return "";

      const colFieldMap = {
        "Year": "year",
        "Month": "month",
        "Date": "date",
        "Name": "name",
        "OM": "om",
        "SITE": "site",
        "TL": "tl",
        "Agent Name": "agentName",
        "Account": "account",
        "CCTV Reason Codes": "cctvReasonCodes",
        "NOC": "noc",
        "Remarks": "remarks"
      };

      const field = colFieldMap[column];
      if (field && row[field] !== undefined && row[field] !== null && String(row[field]).trim() !== "") {
        return clean(row[field]);
      }

      const aliases = {
        "Year": ["Year", "year", "yr"],
        "Month": ["Month", "month", "mo"],
        "Date": ["Date", "date"],
        "Name": ["Name", "name", "Auditor", "auditor", "Staff", "staff"],
        "OM": ["OM", "om", "Operation Manager", "Operations Manager"],
        "SITE": ["SITE", "Site", "site", "Location"],
        "TL": ["TL", "tl", "Team Leader", "Team Lead"],
        "Agent Name": ["Agent Name", "agentName", "Agent", "agent"],
        "Account": ["Account", "account", "Campaign", "campaign"],
        "CCTV Reason Codes": ["CCTV Reason Codes", "cctvReasonCodes", "CCTV Reason Code", "CCTV Reason Cod", "Reason Code", "Reason"],
        "NOC": ["NOC", "noc", "Status", "status"],
        "Remarks": ["Remarks", "remarks", "Remark", "Notes", "notes"]
      };

      for (const alias of aliases[column] || [column]) {
        const key = findRowKey(row, alias);
        if (key) return clean(row[key]);
      }
      return "";
    }

    // Notepad
    getNotepad(key = this.activePendingKey) {
      try {
        return localStorage.getItem(NOTEPAD_KEY_PREFIX + key) || "";
      } catch (_) {
        return "";
      }
    }

    saveNotepad(key = this.activePendingKey, text = "") {
      try {
        localStorage.setItem(NOTEPAD_KEY_PREFIX + key, text);
        return true;
      } catch (err) {
        console.warn("Notepad save failed:", err);
        return false;
      }
    }

    clearNotepad(key = this.activePendingKey) {
      try {
        localStorage.removeItem(NOTEPAD_KEY_PREFIX + key);
        return true;
      } catch (err) {
        return false;
      }
    }

    // HR Assignment CRUD
    getHrAssignments(searchQuery = "") {
      const q = norm(searchQuery);
      if (!q) return [...this.hrAssignments];
      return this.hrAssignments.filter(item => {
        const text = norm(`${item.site} ${item.omTeam} ${item.hr}`);
        return text.includes(q);
      });
    }

    async saveHrAssignment({ id, site, omTeam, hr }) {
      site = clean(site);
      omTeam = clean(omTeam);
      hr = clean(hr);

      if (!site || !omTeam || !hr) {
        throw new Error("Site, Team / OM / Campaign, and HR are required.");
      }

      const assignedId = (id && !id.startsWith("seed_"))
        ? id
        : "web_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 7);

      const record = {
        id: assignedId,
        site,
        omTeam,
        hr,
        deleted: false,
        source: "local"
      };

      // Handle key changes
      const oldItem = this.hrAssignments.find(entry => entry.id === id);
      if (oldItem && hrGroupKey(oldItem) !== hrGroupKey(record)) {
        this.localHrChanges = this.localHrChanges.filter(change =>
          hrGroupKey(change) !== hrGroupKey(oldItem)
        );
        this.localHrChanges.push({
          id: oldItem.id || ("deleted_" + Date.now().toString(36)),
          site: oldItem.site,
          omTeam: oldItem.omTeam,
          hr: oldItem.hr,
          deleted: true,
          source: "local"
        });
      }

      this.localHrChanges = this.localHrChanges.filter(change =>
        hrGroupKey(change) !== hrGroupKey(record)
      );
      this.localHrChanges.push(record);
      this._saveLocalHrChanges();

      // Log admin event
      if (typeof window.CCTV_LOG_ADMIN_EVENT === "function") {
        window.CCTV_LOG_ADMIN_EVENT("master_hr_assignment_updated", `${site} - ${omTeam}`, { site, omTeam, hr });
      }

      // Re-derive immediately
      this._derive();
      this._notify();

      // Remote sync in background
      const sent = await this._postHrAction({
        action: "upsertHrAssignment",
        record: {
          id: assignedId,
          site,
          omTeam,
          hr,
          remarks: ""
        }
      });

      return { record, sent };
    }

    async deleteHrAssignment(id) {
      const item = this.hrAssignments.find(entry => entry.id === id);
      if (!item) {
        throw new Error("HR assignment not found.");
      }

      const tombstone = {
        id: item.id || ("deleted_" + Date.now().toString(36)),
        site: item.site,
        omTeam: item.omTeam,
        hr: item.hr,
        deleted: true,
        source: "local"
      };

      this.localHrChanges = this.localHrChanges.filter(change =>
        hrGroupKey(change) !== hrGroupKey(item)
      );
      this.localHrChanges.push(tombstone);
      this._saveLocalHrChanges();

      if (typeof window.CCTV_LOG_ADMIN_EVENT === "function") {
        window.CCTV_LOG_ADMIN_EVENT("master_hr_assignment_deleted", `${item.site} - ${item.omTeam}`, item);
      }

      this._derive();
      this._notify();

      if (item.source === "web" && item.id) {
        await this._postHrAction({
          action: "deleteHrAssignment",
          id: item.id
        });
      }

      return true;
    }

    // Authoritative Option Management
    getOms() {
      return [...(this.activeOms || [])];
    }

    getTeamLeaders() {
      return [...(this.activeTls || [])];
    }

    getTeams() {
      return [...(this.activeTls || [])];
    }

    getAccounts() {
      return [...(this.activeAccounts || [])];
    }

    getSites() {
      return [...(this.activeSites || [])];
    }

    getReasons() {
      return [...(this.activeReasons || [])];
    }

    getInfractions() {
      return [...(this.activeInfractions || [])];
    }

    addInfraction(name, _meta = {}) {
      const cleanName = clean(name);
      if (!cleanName) return { added: false, canonical: "" };

      if (this._isDeactivated("infractions", cleanName)) {
        this._reactivateOption("infractions", cleanName);
        this._addOptionToRegistry("infractions", cleanName);
        this._derive();
        this._notify();
        return { added: true, canonical: cleanName, reactivated: true };
      }

      const canonical = this.findCanonical("infractions", cleanName);
      if (canonical) {
        if (canonical !== cleanName) {
          this._addOptionToRegistry("infractions", cleanName);
          this._derive();
          this._notify();
          return { added: true, canonical: cleanName, updated: true };
        }
        return { added: false, canonical, exists: true };
      }

      this._addOptionToRegistry("infractions", cleanName);
      this._derive();
      this._notify();
      return { added: true, canonical: cleanName };
    }

    removeInfraction(name) {
      const cleanName = clean(name);
      if (!cleanName) return false;
      const canonical = this.findCanonical("infractions", cleanName) || cleanName;
      this._deactivateOption("infractions", canonical);
      this._derive();
      this._notify();
      return true;
    }

    getRespondents(role = "Team Leader") {
      return role === "OM" ? this.getOms() : this.getTeamLeaders();
    }

    findCanonical(type, candidate) {
      const v = clean(candidate);
      if (!v) return null;
      const target = optionIdentityKey(v);
      let list;
      if (type === "oms") list = this.activeOms;
      else if (type === "accounts") list = this.activeAccounts;
      else if (type === "sites") list = this.activeSites;
      else if (type === "reasons") list = this.activeReasons;
      else if (type === "infractions") list = this.activeInfractions;
      else list = this.activeTls;
      list = list || [];
      for (const item of list) {
        const itemKey = optionIdentityKey(item);
        if (itemKey === target) return item;
        if (type === "oms") {
          const strippedTarget = target.replace(/^om\s+/i, "");
          const strippedItem = itemKey.replace(/^om\s+/i, "");
          if (strippedItem === strippedTarget) return item;
        }
      }
      return null;
    }

    isCustomOption(type, name) {
      const cleanName = clean(name);
      if (!cleanName || !this.masterOptions?.added?.[type]) return false;
      const target = optionIdentityKey(cleanName);
      return this.masterOptions.added[type].some(item => optionIdentityKey(item) === target);
    }

    _isDeactivated(type, name) {
      const target = optionIdentityKey(name);
      const list = this.masterOptions.deactivated[type] || [];
      return list.some(item => optionIdentityKey(item) === target);
    }

    _reactivateOption(type, name) {
      const target = optionIdentityKey(name);
      if (this.masterOptions.deactivated[type]) {
        this.masterOptions.deactivated[type] = this.masterOptions.deactivated[type].filter(item => optionIdentityKey(item) !== target);
      }
      this._saveMasterOptions();
    }

    _addOptionToRegistry(type, name) {
      const cleanName = clean(name);
      if (!cleanName) return;
      if (!this.masterOptions.added[type]) this.masterOptions.added[type] = [];
      if (!this.masterOptions.deactivated[type]) this.masterOptions.deactivated[type] = [];
      if (!this.masterOptions.displayOverrides) this.masterOptions.displayOverrides = {};
      if (!this.masterOptions.displayOverrides[type]) this.masterOptions.displayOverrides[type] = {};

      const target = optionIdentityKey(cleanName);
      this.masterOptions.deactivated[type] = this.masterOptions.deactivated[type].filter(item => optionIdentityKey(item) !== target);
      this.masterOptions.displayOverrides[type][target] = cleanName;

      const existingIdx = this.masterOptions.added[type].findIndex(item => optionIdentityKey(item) === target);
      if (existingIdx >= 0) {
        this.masterOptions.added[type][existingIdx] = cleanName;
      } else {
        this.masterOptions.added[type].push(cleanName);
      }
      this.masterOptions.added[type].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base", numeric: true }));

      this._saveMasterOptions();
    }

    _deactivateOption(type, name) {
      const cleanName = clean(name);
      if (!cleanName) return;
      if (!this.masterOptions.added[type]) this.masterOptions.added[type] = [];
      if (!this.masterOptions.deactivated[type]) this.masterOptions.deactivated[type] = [];
      if (!this.masterOptions.displayOverrides) this.masterOptions.displayOverrides = {};
      if (!this.masterOptions.displayOverrides[type]) this.masterOptions.displayOverrides[type] = {};

      const target = optionIdentityKey(cleanName);
      this.masterOptions.added[type] = this.masterOptions.added[type].filter(item => optionIdentityKey(item) !== target);
      delete this.masterOptions.displayOverrides[type][target];

      const inDeact = this.masterOptions.deactivated[type].some(item => optionIdentityKey(item) === target);
      if (!inDeact) {
        this.masterOptions.deactivated[type].push(cleanName);
      }
      this._saveMasterOptions();
    }

    findHrForOmTeam(omTeam, site) {
      const normName = norm(omTeam);
      const normSite = norm(site);
      if (!normName) return "";

      const match = this.hrAssignments.find(h =>
        !h.deleted && (norm(h.omTeam) === normName || norm(h.omTeam).includes(normName)) &&
        (!normSite || norm(h.site) === normSite || norm(h.site).includes(normSite)) &&
        clean(h.hr)
      );
      if (match) return clean(match.hr);

      const anySiteMatch = this.hrAssignments.find(h =>
        !h.deleted && (norm(h.omTeam) === normName || norm(h.omTeam).includes(normName)) &&
        clean(h.hr)
      );
      return anySiteMatch ? clean(anySiteMatch.hr) : "";
    }

    addTeam(name, _meta = {}) {
      const cleanName = clean(name);
      if (!cleanName) return { added: false, canonical: "" };

      if (this._isDeactivated("tls", cleanName)) {
        this._reactivateOption("tls", cleanName);
        this._addOptionToRegistry("tls", cleanName);
        this._derive();
        this._notify();
        return { added: true, canonical: cleanName, reactivated: true };
      }

      const canonical = this.findCanonical("tls", cleanName);
      if (canonical) {
        if (canonical !== cleanName) {
          this._addOptionToRegistry("tls", cleanName);
          this._derive();
          this._notify();
          return { added: true, canonical: cleanName, updated: true };
        }
        return { added: false, canonical, exists: true };
      }

      this._addOptionToRegistry("tls", cleanName);
      this._derive();
      this._notify();
      return { added: true, canonical: cleanName };
    }

    removeTeam(name) {
      const cleanName = clean(name);
      if (!cleanName) return false;
      const canonical = this.findCanonical("tls", cleanName) || cleanName;
      this._deactivateOption("tls", canonical);
      this._derive();
      this._notify();
      return true;
    }

    addDedicatedOm(name, _meta = {}) {
      let cleanName = clean(name);
      if (!cleanName) return { added: false, canonical: "" };
      cleanName = cleanName.replace(/^om\s+/i, "").trim();

      if (this._isDeactivated("oms", cleanName)) {
        this._reactivateOption("oms", cleanName);
        this._addOptionToRegistry("oms", cleanName);
        this._derive();
        this._notify();
        return { added: true, canonical: cleanName, reactivated: true };
      }

      const canonical = this.findCanonical("oms", cleanName);
      if (canonical) {
        if (canonical !== cleanName) {
          this._addOptionToRegistry("oms", cleanName);
          this._derive();
          this._notify();
          return { added: true, canonical: cleanName, updated: true };
        }
        return { added: false, canonical, exists: true };
      }

      this._addOptionToRegistry("oms", cleanName);
      this._derive();
      this._notify();
      return { added: true, canonical: cleanName };
    }

    removeDedicatedOm(name) {
      let cleanName = clean(name);
      if (!cleanName) return false;
      cleanName = cleanName.replace(/^om\s+/i, "").trim();
      const canonical = this.findCanonical("oms", cleanName) || cleanName;
      this._deactivateOption("oms", canonical);
      this._derive();
      this._notify();
      return true;
    }

    addAccount(name, _meta = {}) {
      const cleanName = clean(name);
      if (!cleanName) return { added: false, canonical: "" };

      if (this._isDeactivated("accounts", cleanName)) {
        this._reactivateOption("accounts", cleanName);
        this._addOptionToRegistry("accounts", cleanName);
        this._derive();
        this._notify();
        return { added: true, canonical: cleanName, reactivated: true };
      }

      const canonical = this.findCanonical("accounts", cleanName);
      if (canonical) {
        if (canonical !== cleanName) {
          this._addOptionToRegistry("accounts", cleanName);
          this._derive();
          this._notify();
          return { added: true, canonical: cleanName, updated: true };
        }
        return { added: false, canonical, exists: true };
      }

      this._addOptionToRegistry("accounts", cleanName);
      this._derive();
      this._notify();
      return { added: true, canonical: cleanName };
    }

    removeAccount(name) {
      const cleanName = clean(name);
      if (!cleanName) return false;
      const canonical = this.findCanonical("accounts", cleanName) || cleanName;
      this._deactivateOption("accounts", canonical);
      this._derive();
      this._notify();
      return true;
    }

    addSite(name, _meta = {}) {
      const cleanName = clean(name);
      if (!cleanName) return { added: false, canonical: "" };

      if (this._isDeactivated("sites", cleanName)) {
        this._reactivateOption("sites", cleanName);
        this._addOptionToRegistry("sites", cleanName);
        this._derive();
        this._notify();
        return { added: true, canonical: cleanName, reactivated: true };
      }

      const canonical = this.findCanonical("sites", cleanName);
      if (canonical) {
        if (canonical !== cleanName) {
          this._addOptionToRegistry("sites", cleanName);
          this._derive();
          this._notify();
          return { added: true, canonical: cleanName, updated: true };
        }
        return { added: false, canonical, exists: true };
      }

      this._addOptionToRegistry("sites", cleanName);
      this._derive();
      this._notify();
      return { added: true, canonical: cleanName };
    }

    removeSite(name) {
      const cleanName = clean(name);
      if (!cleanName) return false;
      const canonical = this.findCanonical("sites", cleanName) || cleanName;
      this._deactivateOption("sites", canonical);
      this._derive();
      this._notify();
      return true;
    }

    addReason(name, _meta = {}) {
      const cleanName = clean(name);
      if (!cleanName) return { added: false, canonical: "" };

      if (this._isDeactivated("reasons", cleanName)) {
        this._reactivateOption("reasons", cleanName);
        this._addOptionToRegistry("reasons", cleanName);
        this._derive();
        this._notify();
        return { added: true, canonical: cleanName, reactivated: true };
      }

      const canonical = this.findCanonical("reasons", cleanName);
      if (canonical) {
        if (canonical !== cleanName) {
          this._addOptionToRegistry("reasons", cleanName);
          this._derive();
          this._notify();
          return { added: true, canonical: cleanName, updated: true };
        }
        return { added: false, canonical, exists: true };
      }

      this._addOptionToRegistry("reasons", cleanName);
      this._derive();
      this._notify();
      return { added: true, canonical: cleanName };
    }

    removeReason(name) {
      const cleanName = clean(name);
      if (!cleanName) return false;
      const canonical = this.findCanonical("reasons", cleanName) || cleanName;
      this._deactivateOption("reasons", canonical);
      this._derive();
      this._notify();
      return true;
    }

    addRespondent(name, role = "Team Leader", meta = {}) {
      if (role === "OM") {
        return this.addDedicatedOm(name, meta);
      }
      return this.addTeam(name, meta);
    }

    removeRespondent(name, role = "Team Leader") {
      if (role === "OM") {
        return this.removeDedicatedOm(name);
      }
      return this.removeTeam(name);
    }

    async _postHrAction(body) {
      try {
        await fetch(this.apiUrl, {
          method: "POST",
          mode: "no-cors",
          headers: { "Content-Type": "text/plain;charset=utf-8" },
          body: JSON.stringify(body)
        });
        return true;
      } catch (err) {
        console.warn("HR Google Sheets write failed:", err);
        return false;
      }
    }

    _registerHistoryAdapter() {
      window.__workspaceHistoryAdapters = window.__workspaceHistoryAdapters || {};
      window.__workspaceHistoryAdapters.masterlist = {
        label: "Master List",
        snapshot: () => ({
          activeKey: this.activePendingKey,
          note: this.getNotepad(this.activePendingKey),
          hrLocal: JSON.parse(JSON.stringify(this.localHrChanges || [])),
          options: JSON.parse(JSON.stringify(this.masterOptions || {}))
        }),
        restore: async (snap) => {
          const key = snap?.activeKey || this.activePendingKey;
          if (snap?.note !== undefined) {
            this.saveNotepad(key, snap.note);
          }
          if (Array.isArray(snap?.hrLocal)) {
            this.localHrChanges = JSON.parse(JSON.stringify(snap.hrLocal));
            this._saveLocalHrChanges();
          }
          if (snap?.options && typeof snap.options === "object") {
            this.masterOptions = JSON.parse(JSON.stringify(snap.options));
            this._saveMasterOptions();
          }
          this._derive();
          this._notify();
        }
      };
    }

    subscribe(fn) {
      this.listeners.push(fn);
      return () => {
        this.listeners = this.listeners.filter(l => l !== fn);
      };
    }

    _notify() {
      this.listeners.forEach(fn => {
        try { fn(); } catch (e) { console.error("Masterlist listener error:", e); }
      });
    }
  }

  // Singleton instance
  window.masterlistService = new MasterlistService();
})();
