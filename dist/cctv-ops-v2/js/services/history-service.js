/**
 * CCTV OPS V2 - Global Workspace History Service
 * Comprehensive undo, redo, snapshot capture, persistent media store,
 * human-readable deletion tracking, and targeted deleted-data recovery.
 */

(function () {
  'use strict';

  const DB_NAME = "cctv_global_workspace_history_v1";
  const DB_VERSION = 2;
  const STORE = "history";
  const MEDIA_STORE = "media";
  const STATE_KEY = "timeline";
  const MAX_HISTORY = 50;

  const WORKSPACE_MAP = {
    paneCctvReport: "report",
    paneEdr: "edr",
    paneAudit: "audit",
    paneSorter: "sorter",
    paneMaintenance: "maintenance",
    panePending: "pending",
    paneFollowup: "followup",
    paneUnreported: "unreported",
    paneMasterlist: "masterlist",
    paneTrackers: "trackers"
  };

  const WORKSPACE_NAMES = {
    report: "CCTV Report",
    cctvReport: "CCTV Report",
    edr: "EDR Workspace",
    audit: "CCTV Audit",
    cctv: "CCTV Audit",
    sorter: "AI Sorter",
    aiSorter: "AI Sorter",
    maintenance: "Maintenance",
    maintenanceReport: "Maintenance",
    pending: "Pending Reports",
    pendingReports: "Pending Reports",
    followup: "Follow Up Reports",
    followupReports: "Follow Up Reports",
    unreported: "Unreported",
    unreportedItems: "Unreported",
    masterlist: "Master List",
    trackers: "Trackers"
  };

  function canonicalWorkspace(ws) {
    if (!ws) return "";
    const key = String(ws).trim();
    const map = {
      report: "report",
      cctvReport: "report",
      paneCctvReport: "report",

      edr: "edr",
      paneEdr: "edr",

      audit: "audit",
      cctv: "audit",
      paneAudit: "audit",

      sorter: "sorter",
      aiSorter: "sorter",
      paneSorter: "sorter",

      maintenance: "maintenance",
      maintenanceReport: "maintenance",
      paneMaintenance: "maintenance",

      pending: "pending",
      pendingReports: "pending",
      panePending: "pending",

      followup: "followup",
      followupReports: "followup",
      paneFollowup: "followup",

      unreported: "unreported",
      unreportedItems: "unreported",
      paneUnreported: "unreported",

      masterlist: "masterlist",
      paneMasterlist: "masterlist",

      trackers: "trackers",
      paneTrackers: "trackers"
    };
    return map[key] || key;
  }

  function clone(val) {
    try {
      return structuredClone(val);
    } catch (_) {
      return JSON.parse(JSON.stringify(val));
    }
  }

  function stable(val) {
    try {
      return JSON.stringify(val);
    } catch (_) {
      return String(val);
    }
  }

  function truncate(str, maxLen = 80) {
    if (str == null) return "";
    const s = String(str).replace(/[\r\n\t]+/g, " ").trim();
    if (!s) return "";
    return s.length > maxLen ? s.slice(0, maxLen) + "…" : s;
  }

  function formatDateTime(iso) {
    if (!iso) return "";
    try {
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) return String(iso);
      return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) +
        " " + d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
    } catch (_) {
      return String(iso);
    }
  }

  // =========================================================================
  // PERSISTENT, DEDUPLICATED MEDIA STORE
  // Upgrades history IndexedDB to v2 with a separate "media" object store.
  // Stores each unique screenshot data URL exactly once keyed by hash.
  // In-memory bounded cache retains active media. On restore after reload,
  // ensureMediaLoaded() restores assets into RAM from IndexedDB.
  // =========================================================================
  const MAX_CACHED_MEDIA = 120;
  const historyMediaCache = new Map();

  function fastHash(str) {
    let hash = 0;
    const len = Math.min(str.length, 2048);
    for (let i = 0; i < len; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash).toString(36);
  }

  async function persistMediaToStore(key, dataUrl) {
    if (!key || !dataUrl || typeof indexedDB === "undefined") return;
    try {
      const db = await (window.historyService ? window.historyService._openDb() : null);
      if (!db) return;
      await new Promise((resolve, reject) => {
        const tx = db.transaction(MEDIA_STORE, "readwrite");
        tx.objectStore(MEDIA_STORE).put(dataUrl, key);
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
      });
      db.close();
    } catch (_) {}
  }

  async function loadMediaFromStore(key) {
    if (!key || typeof indexedDB === "undefined") return null;
    try {
      const db = await (window.historyService ? window.historyService._openDb() : null);
      if (!db) return null;
      const res = await new Promise((resolve, reject) => {
        const tx = db.transaction(MEDIA_STORE, "readonly");
        const req = tx.objectStore(MEDIA_STORE).get(key);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error);
      });
      db.close();
      return res;
    } catch (_) {
      return null;
    }
  }

  function findImgRefs(val, out = new Set()) {
    if (!val) return out;
    if (typeof val === "string") {
      if (val.startsWith("@@IMG_REF:") && val.endsWith("@@")) {
        out.add(val.slice(10, -2));
      }
      return out;
    }
    if (Array.isArray(val)) {
      for (const item of val) findImgRefs(item, out);
      return out;
    }
    if (typeof val === "object") {
      for (const v of Object.values(val)) findImgRefs(v, out);
      return out;
    }
    return out;
  }

  async function ensureMediaLoaded(snapshot) {
    const refs = Array.from(findImgRefs(snapshot));
    const missing = refs.filter(r => !historyMediaCache.has(r));
    if (!missing.length) return;
    for (const key of missing) {
      const data = await loadMediaFromStore(key);
      if (data) {
        historyMediaCache.set(key, data);
      }
    }
  }

  function compressMedia(val) {
    if (!val || typeof val !== "object") {
      if (typeof val === "string" && val.startsWith("data:image/") && val.length > 256) {
        const key = `img_${val.length}_${fastHash(val)}`;
        if (!historyMediaCache.has(key)) {
          if (historyMediaCache.size >= MAX_CACHED_MEDIA) {
            const firstKey = historyMediaCache.keys().next().value;
            historyMediaCache.delete(firstKey);
          }
          historyMediaCache.set(key, val);
          persistMediaToStore(key, val);
        }
        return `@@IMG_REF:${key}@@`;
      }
      return val;
    }

    if (Array.isArray(val)) {
      return val.map(compressMedia);
    }

    const out = {};
    for (const [k, v] of Object.entries(val)) {
      out[k] = compressMedia(v);
    }
    return out;
  }

  function decompressMedia(val) {
    if (!val || typeof val !== "object") {
      if (typeof val === "string" && val.startsWith("@@IMG_REF:") && val.endsWith("@@")) {
        const key = val.slice(10, -2);
        return historyMediaCache.get(key) || val;
      }
      return val;
    }

    if (Array.isArray(val)) {
      return val.map(decompressMedia);
    }

    const out = {};
    for (const [k, v] of Object.entries(val)) {
      out[k] = decompressMedia(v);
    }
    return out;
  }

  function historyValue(v) {
    return String(v == null ? "" : v).trim() || "—";
  }

  function historyItemIdentity(item) {
    if (item && typeof item === "object") {
      if (item.id) return "id:" + String(item.id);
      if (item.sourceEdrId) return "edr:" + String(item.sourceEdrId);
      if (item.site && item.omTeam) return "hr:" + String(item.site).trim().toLowerCase() + "|" + String(item.omTeam).trim().toLowerCase();
      if (item.caption || item.dataUrl) return "shot:" + String(item.caption || "") + "_" + (item.dataUrl ? fastHash(item.dataUrl) : "");
    }
    if (typeof item === "string") return "str:" + item;
    return "json:" + stable(item);
  }

  function collectionDescriptor(workspace, snapshot) {
    const ws = canonicalWorkspace(workspace);
    if (ws === "report") {
      return {
        items: Array.isArray(snapshot?.screenshots) ? snapshot.screenshots : [],
        apply(target, items) { if (target) target.screenshots = items; }
      };
    }
    if (ws === "unreported") {
      return {
        items: Array.isArray(snapshot) ? snapshot : [],
        apply(target, items) { return items; }
      };
    }
    if (ws === "audit") {
      return {
        items: Array.isArray(snapshot?.entries) ? snapshot.entries : [],
        apply(target, items) { if (target) target.entries = items; }
      };
    }
    if (ws === "maintenance") {
      return {
        items: Array.isArray(snapshot?.blocks) ? snapshot.blocks : [],
        apply(target, items) { if (target) target.blocks = items; }
      };
    }
    if (ws === "pending" || ws === "followup") {
      return {
        items: Array.isArray(snapshot) ? snapshot : [],
        apply(target, items) { return items; }
      };
    }
    if (ws === "edr") {
      return {
        items: Array.isArray(snapshot?.reports) ? snapshot.reports : [],
        apply(target, items) { if (target) target.reports = items; }
      };
    }
    if (ws === "sorter") {
      return {
        items: Array.isArray(snapshot?.rows) ? snapshot.rows : [],
        apply(target, items) { if (target) target.rows = items; }
      };
    }
    if (ws === "masterlist") {
      return {
        items: Array.isArray(snapshot?.hrLocal) ? snapshot.hrLocal : [],
        apply(target, items) { if (target) target.hrLocal = items; }
      };
    }
    return null;
  }

  function findDeletedSorterRows(beforeRows, afterRows) {
    if (!Array.isArray(beforeRows) || !Array.isArray(afterRows)) return [];
    if (afterRows.length >= beforeRows.length) return [];
    const afterSignatures = afterRows.map(r => stable(r));
    const deleted = [];
    const remaining = afterSignatures.slice();
    for (const bRow of beforeRows) {
      const sig = stable(bRow);
      const idx = remaining.indexOf(sig);
      if (idx >= 0) {
        remaining.splice(idx, 1);
      } else {
        deleted.push(bRow);
      }
    }
    return deleted;
  }

  class HistoryService {
    constructor() {
      this.entries = [];
      this.cursor = -1;
      this.workspaceHistory = {};
      this.lastSnapshots = {};
      this.timers = {};
      this.suppress = false;
      this.selectedHistoryId = null;
      this.listeners = [];
      this.initialized = false;
      this._adapters();
    }

    _adapters() {
      window.__workspaceHistoryAdapters = window.__workspaceHistoryAdapters || {};
      const ad = window.__workspaceHistoryAdapters;

      const audit = window.CCTV_AUDIT || window.auditService;
      if (!ad.cctv && audit) {
        ad.cctv = {
          label: "CCTV Audit",
          snapshot: async () => ({ entries: clone(audit.getEntries?.() || []) }),
          restore: async (snap) => {
            const list = Array.isArray(snap?.entries) ? snap.entries : (Array.isArray(snap) ? snap : null);
            if (Array.isArray(list)) {
              if (typeof audit.restoreEntries === "function") {
                audit.restoreEntries(list);
              } else if (typeof audit.saveEntries === "function") {
                await audit.saveEntries(list);
              }
              if (typeof window.renderAuditTable === "function") {
                window.renderAuditTable();
              }
              if (typeof window.renderGuardStatus === "function") {
                window.renderGuardStatus();
              }
            }
          }
        };
      }

      const edr = window.CCTV_EDR || window.edrService;
      if (!ad.edr && edr) {
        ad.edr = {
          label: "EDR",
          snapshot: async () => ({ reports: clone(edr.getReports?.() || []) }),
          restore: async (snap) => {
            const list = Array.isArray(snap?.reports) ? snap.reports : (Array.isArray(snap) ? snap : null);
            if (Array.isArray(list)) {
              if (typeof edr.restoreReports === "function") {
                await edr.restoreReports(list);
              } else if (typeof edr.saveReports === "function") {
                await edr.saveReports(list);
              }
              if (typeof window.renderEdrList === "function") {
                window.renderEdrList(edr.getReports?.() || list);
              }
            }
          }
        };
      }

      if (!ad.aiSorter && window.sorterService) {
        ad.aiSorter = {
          label: "AI Sorter",
          snapshot: async () => ({ rows: clone(window.sorterService.getSortedRows?.() || []) }),
          restore: async (snap) => {
            const list = Array.isArray(snap?.rows) ? snap.rows : (Array.isArray(snap) ? snap : null);
            if (Array.isArray(list) && window.sorterService.setSortedRows) {
              window.sorterService.setSortedRows(list);
              if (typeof window.renderSorterTable === "function") {
                window.renderSorterTable();
              }
            }
          }
        };
      }

      if (!ad.maintenanceReport && window.maintenanceService) {
        ad.maintenanceReport = {
          label: "Maintenance Report",
          snapshot: async () => ({ blocks: clone(window.maintenanceService.getBlocks?.() || (window.maintenanceState?.blocks ? clone(window.maintenanceState.blocks) : [])) }),
          restore: async (snap) => {
            const blocks = Array.isArray(snap?.blocks) ? snap.blocks : (Array.isArray(snap) ? snap : null);
            if (Array.isArray(blocks)) {
              if (window.maintenanceService.saveBlocks) {
                await window.maintenanceService.saveBlocks(blocks);
              }
              if (typeof window.loadMaintenanceDraftInitial === "function") {
                await window.loadMaintenanceDraftInitial();
              } else if (typeof window.renderMaintenanceBlocks === "function") {
                window.renderMaintenanceBlocks();
              }
            }
          }
        };
      }

      if (!ad.pendingReports && window.pendingService) {
        ad.pendingReports = {
          label: "Pending Reports",
          snapshot: async () => {
            if (typeof window.pendingService.loadReports === "function") {
              return clone(await window.pendingService.loadReports());
            }
            if (typeof window.pendingService.getReports === "function") {
              return clone(window.pendingService.getReports());
            }
            return [];
          },
          restore: async (snap) => {
            const list = Array.isArray(snap) ? snap : (Array.isArray(snap?.reports) ? snap.reports : null);
            if (Array.isArray(list) && window.pendingService.saveReports) {
              await window.pendingService.saveReports(list);
              if (typeof window.loadPendingReportsInitial === "function") {
                await window.loadPendingReportsInitial();
              } else if (typeof window.renderPendingList === "function") {
                window.renderPendingList();
              }
            }
          }
        };
      }

      if (!ad.followupReports && window.followupService) {
        ad.followupReports = {
          label: "Follow Up Reports",
          snapshot: async () => {
            if (typeof window.followupService.loadReports === "function") {
              return clone(await window.followupService.loadReports());
            }
            if (typeof window.followupService.getReports === "function") {
              return clone(window.followupService.getReports());
            }
            return [];
          },
          restore: async (snap) => {
            const list = Array.isArray(snap) ? snap : (Array.isArray(snap?.reports) ? snap.reports : null);
            if (Array.isArray(list) && window.followupService.saveReports) {
              await window.followupService.saveReports(list);
              if (typeof window.loadFollowupReportsInitial === "function") {
                await window.loadFollowupReportsInitial();
              } else if (typeof window.renderFollowupList === "function") {
                window.renderFollowupList();
              }
            }
          }
        };
      }

      if (!ad.masterlist && window.masterlistService) {
        ad.masterlist = {
          label: "Master List",
          snapshot: () => ({
            activeKey: window.masterlistService.getActiveTrackerKey?.(),
            note: window.masterlistService.getNotepad?.(window.masterlistService.getActiveTrackerKey?.()),
            hrLocal: clone(window.masterlistService.localHrChanges || []),
            options: clone(window.masterlistService.masterOptions || {})
          }),
          restore: async (snap) => {
            const key = snap?.activeKey || window.masterlistService.getActiveTrackerKey?.();
            if (snap?.note !== undefined) {
              window.masterlistService.saveNotepad?.(key, snap.note);
            }
            if (Array.isArray(snap?.hrLocal)) {
              window.masterlistService.localHrChanges = clone(snap.hrLocal);
              window.masterlistService._saveLocalHrChanges?.();
            }
            if (snap?.options && typeof snap.options === "object") {
              window.masterlistService.masterOptions = clone(snap.options);
              window.masterlistService._saveMasterOptions?.();
            }
            window.masterlistService._derive?.();
            window.masterlistService._notify?.();
          }
        };
      }

      if (!ad.report) {
        ad.report = {
          label: "CCTV Report",
          snapshot: async () => {
            const draft = window.getCctvReportDraft?.() || window.CCTV_REPORT_SERVICE?.getDraft?.();
            return draft ? clone(draft) : null;
          },
          restore: async (snap) => {
            if (!snap) return;
            if (typeof window.setCctvReportDraft === "function") {
              window.setCctvReportDraft(clone(snap));
            }
            if (window.CCTV_REPORT_SERVICE?.saveDraft) {
              window.CCTV_REPORT_SERVICE.saveDraft(clone(snap));
            }
            window.syncCctvReportFormFromDraft?.();
            window.renderCctvReportScreenshots?.();
            window.updateCctvReportPreview?.();
          }
        };
      }

      if (!ad.unreported && window.unreportedService) {
        ad.unreported = {
          label: "Unreported Items",
          snapshot: async () => {
            const items = window.unreportedService.getItems?.() || [];
            return clone(items);
          },
          restore: async (snap) => {
            const list = Array.isArray(snap) ? snap : (Array.isArray(snap?.items) ? snap.items : null);
            if (Array.isArray(list) && window.unreportedService.saveItems) {
              await window.unreportedService.saveItems(clone(list));
              window.unreportedService.renderWorkspace?.();
            }
          }
        };
      }

      ad.audit = ad.cctv;
      ad.sorter = ad.aiSorter;
      ad.maintenance = ad.maintenanceReport;
      ad.pending = ad.pendingReports;
      ad.followup = ad.followupReports;
      ad.unreportedItems = ad.unreported;
      ad.cctvReport = ad.report;

      return ad;
    }

    async _openDb() {
      return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains(STORE)) {
            db.createObjectStore(STORE);
          }
          if (!db.objectStoreNames.contains(MEDIA_STORE)) {
            db.createObjectStore(MEDIA_STORE);
          }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    }

    async _saveTimeline() {
      try {
        const db = await this._openDb();
        await new Promise((resolve, reject) => {
          const tx = db.transaction(STORE, "readwrite");
          tx.objectStore(STORE).put({
            entries: this.entries,
            cursor: this.cursor,
            workspaceHistory: this.workspaceHistory
          }, STATE_KEY);
          tx.oncomplete = resolve;
          tx.onerror = () => reject(tx.error);
        });
        db.close();
      } catch (err) {
        console.warn("Global history save failed:", err);
      }
    }

    _scheduleSaveTimeline() {
      clearTimeout(this._saveTimelineTimer);
      this._saveTimelineTimer = setTimeout(() => {
        this._saveTimeline().catch(console.error);
      }, 350);
    }

    async _loadTimeline() {
      try {
        const db = await this._openDb();
        const saved = await new Promise((resolve, reject) => {
          const tx = db.transaction(STORE, "readonly");
          const req = tx.objectStore(STORE).get(STATE_KEY);
          req.onsuccess = () => resolve(req.result);
          req.onerror = () => reject(req.error);
        });
        db.close();

        if (saved && Array.isArray(saved.entries)) {
          this.entries = saved.entries.slice(-MAX_HISTORY);
          this.cursor = Math.min(
            Number.isInteger(saved.cursor) ? saved.cursor : this.entries.length - 1,
            this.entries.length - 1
          );
        }
        if (saved && saved.workspaceHistory && typeof saved.workspaceHistory === "object") {
          for (const ws of Object.keys(saved.workspaceHistory)) {
            if (Array.isArray(saved.workspaceHistory[ws]?.entries)) {
              saved.workspaceHistory[ws].entries = saved.workspaceHistory[ws].entries.slice(-MAX_HISTORY);
              saved.workspaceHistory[ws].cursor = saved.workspaceHistory[ws].entries.length - 1;
            }
          }
          this.workspaceHistory = saved.workspaceHistory;
        } else {
          this.workspaceHistory = {};
          if (Array.isArray(this.entries)) {
            this.entries.forEach(ent => {
              const ws = canonicalWorkspace(ent.workspace);
              if (!this.workspaceHistory[ws]) {
                this.workspaceHistory[ws] = { entries: [], cursor: -1 };
              }
              this.workspaceHistory[ws].entries.push(ent);
              this.workspaceHistory[ws].cursor = this.workspaceHistory[ws].entries.length - 1;
            });
          }
        }
      } catch (err) {
        console.warn("Global history load failed:", err);
      }
    }

    async init() {
      if (this.initialized) return;
      this.initialized = true;

      await this._loadTimeline();
      await this.initializeBaselines();
      this._bindGlobalDomListeners();
      this._notify();
    }

    async reload() {
      await this._loadTimeline();
      await this.initializeBaselines();
      this._notify();
    }

    async takeSnapshot(workspace) {
      const canonical = canonicalWorkspace(workspace);
      const adapter = this._adapters()[canonical] || this._adapters()[workspace];
      if (!adapter?.snapshot) return null;
      try {
        return clone(await adapter.snapshot());
      } catch (err) {
        console.warn(`Snapshot failed for ${workspace}:`, err);
        return null;
      }
    }

    async initializeBaselines() {
      for (const ws of Object.keys(WORKSPACE_NAMES)) {
        const snap = await this.takeSnapshot(ws);
        if (snap != null) {
          this.lastSnapshots[canonicalWorkspace(ws)] = compressMedia(snap);
        }
      }
    }

    async captureIfChanged(workspace, action) {
      if (this.suppress || !workspace) return;
      const canonical = canonicalWorkspace(workspace);

      const rawAfter = await this.takeSnapshot(canonical);
      if (rawAfter == null) return;
      const after = compressMedia(rawAfter);

      const before = this.lastSnapshots[canonical];
      if (before == null) {
        this.lastSnapshots[canonical] = after;
        return;
      }

      if (stable(before) === stable(after)) return;

      const entry = {
        id: Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 7),
        workspace: canonical,
        action: action || `Updated ${WORKSPACE_NAMES[canonical] || canonical}`,
        at: new Date().toISOString(),
        before: clone(before),
        after: clone(after)
      };

      if (!this.workspaceHistory[canonical]) {
        this.workspaceHistory[canonical] = { entries: [], cursor: -1 };
      }
      const wsHist = this.workspaceHistory[canonical];

      const lastRecorded = (wsHist && wsHist.entries.length) ? wsHist.entries[wsHist.entries.length - 1] : null;
      if (lastRecorded && stable(lastRecorded.after) === stable(after)) {
        this.lastSnapshots[canonical] = clone(after);
        return;
      }

      if (this.cursor < this.entries.length - 1) {
        this.entries = this.entries.slice(0, this.cursor + 1);
      }
      this.entries.push(entry);
      if (this.entries.length > MAX_HISTORY) {
        this.entries = this.entries.slice(this.entries.length - MAX_HISTORY);
      }
      this.cursor = this.entries.length - 1;

      if (wsHist.cursor < wsHist.entries.length - 1) {
        wsHist.entries = wsHist.entries.slice(0, wsHist.cursor + 1);
      }
      wsHist.entries.push(entry);
      if (wsHist.entries.length > MAX_HISTORY) {
        wsHist.entries = wsHist.entries.slice(wsHist.entries.length - MAX_HISTORY);
      }
      wsHist.cursor = wsHist.entries.length - 1;

      this.lastSnapshots[canonical] = clone(after);

      this._scheduleSaveTimeline();
      this._notify();
    }

    scheduleCapture(workspace, action, delay = 650) {
      if (!workspace || this.suppress) return;
      const canonical = canonicalWorkspace(workspace);
      clearTimeout(this.timers[canonical]);
      this.timers[canonical] = setTimeout(() => {
        this.captureIfChanged(canonical, action).catch(console.error);
      }, delay);
    }

    async restoreEntry(entry, direction) {
      if (!entry) return;
      const canonical = canonicalWorkspace(entry.workspace);
      const adapter = this._adapters()[canonical] || this._adapters()[entry.workspace];
      if (!adapter?.restore) return;

      this.suppress = true;
      try {
        const rawSnapshot = direction === "undo" ? entry.before : entry.after;
        await ensureMediaLoaded(rawSnapshot);
        const snapshot = decompressMedia(clone(rawSnapshot));
        await adapter.restore(snapshot);
        this.lastSnapshots[canonical] = compressMedia(clone(rawSnapshot));
      } finally {
        this.suppress = false;
      }
    }

    async undo(targetWorkspace) {
      const activeWs = targetWorkspace || (typeof window.getCurrentWorkspace === "function" ? window.getCurrentWorkspace() : "");
      const canonical = canonicalWorkspace(activeWs);

      if (canonical === "trackers") {
        if (window.CCTV_LIVE_TRACKER && typeof window.CCTV_LIVE_TRACKER.undo === "function") {
          return window.CCTV_LIVE_TRACKER.undo();
        }
        return false;
      }

      if (canonical === "history" || !canonical) {
        if (this.cursor < 0 || !this.entries[this.cursor]) return false;
        const entry = this.entries[this.cursor];
        await this.restoreEntry(entry, "undo");
        this.cursor--;
        const wsKey = canonicalWorkspace(entry.workspace);
        if (this.workspaceHistory[wsKey] && this.workspaceHistory[wsKey].cursor >= 0) {
          this.workspaceHistory[wsKey].cursor--;
        }
        await this._saveTimeline();
        this._notify();
        return true;
      }

      const wsHist = this.workspaceHistory[canonical];
      if (!wsHist || wsHist.cursor < 0 || !wsHist.entries[wsHist.cursor]) {
        return false;
      }

      const entry = wsHist.entries[wsHist.cursor];
      await this.restoreEntry(entry, "undo");
      wsHist.cursor--;

      await this._saveTimeline();
      this._notify();
      return true;
    }

    async redo(targetWorkspace) {
      const activeWs = targetWorkspace || (typeof window.getCurrentWorkspace === "function" ? window.getCurrentWorkspace() : "");
      const canonical = canonicalWorkspace(activeWs);

      if (canonical === "trackers") {
        if (window.CCTV_LIVE_TRACKER && typeof window.CCTV_LIVE_TRACKER.redo === "function") {
          return window.CCTV_LIVE_TRACKER.redo();
        }
        return false;
      }

      if (canonical === "history" || !canonical) {
        if (this.cursor >= this.entries.length - 1) return false;
        const entry = this.entries[this.cursor + 1];
        await this.restoreEntry(entry, "redo");
        this.cursor++;
        const wsKey = canonicalWorkspace(entry.workspace);
        if (this.workspaceHistory[wsKey] && this.workspaceHistory[wsKey].cursor < this.workspaceHistory[wsKey].entries.length - 1) {
          this.workspaceHistory[wsKey].cursor++;
        }
        await this._saveTimeline();
        this._notify();
        return true;
      }

      const wsHist = this.workspaceHistory[canonical];
      if (!wsHist || wsHist.cursor >= wsHist.entries.length - 1) {
        return false;
      }

      const entry = wsHist.entries[wsHist.cursor + 1];
      await this.restoreEntry(entry, "redo");
      wsHist.cursor++;

      await this._saveTimeline();
      this._notify();
      return true;
    }

    // =========================================================================
    // HUMAN-READABLE DELETED DATA DETAILS
    // Returns structured array of { type, title, fields: [[label, value], ...] }
    // No raw JSON, no code, no base64 payloads, no @@IMG_REF strings.
    // =========================================================================
    getDeletedDetails(entry) {
      if (!entry || !entry.before) return [];
      const ws = canonicalWorkspace(entry.workspace);
      const before = entry.before;
      const after = entry.after || {};
      const details = [];

      if (ws === "audit") {
        const beforeList = Array.isArray(before.entries) ? before.entries : [];
        const afterList = Array.isArray(after.entries) ? after.entries : [];
        const afterIds = new Set(afterList.map(historyItemIdentity));
        const deleted = beforeList.filter(e => !afterIds.has(historyItemIdentity(e)));

        deleted.forEach(item => {
          details.push({
            type: "CCTV Audit Entry",
            title: item.agentName || item.agent || item.tlName || "Audit Entry",
            fields: [
              ["Date", item.formattedDate || item.rawDate || item.date || "—"],
              ["TL", item.tlName || item.tl || "—"],
              ["Agent", item.agentName || item.agent || "—"],
              ["Account", item.cleanAccount || item.account || "—"],
              ["Site", item.site || "—"],
              ["Reason", item.reasonCode || item.reason || "—"],
              ["NOC", item.noc || "—"],
              ["Remarks", truncate(item.remarks || item.notes || "—", 75)]
            ]
          });
        });
      } else if (ws === "edr") {
        const beforeReports = Array.isArray(before.reports) ? before.reports : [];
        const afterReports = Array.isArray(after.reports) ? after.reports : [];
        const afterIds = new Set(afterReports.map(historyItemIdentity));
        const deleted = beforeReports.filter(r => !afterIds.has(historyItemIdentity(r)));

        deleted.forEach(item => {
          const shotCount = Array.isArray(item.screenshots) ? item.screenshots.length : (item.screenshotData ? 1 : 0);
          const linkCount = Array.isArray(item.cctvLinks) ? item.cctvLinks.length : 0;
          details.push({
            type: "EDR Report",
            title: item.subjectName || item.agent || item.supervisorName || "EDR Record",
            fields: [
              ["Date", item.date || "—"],
              ["Site", item.site || "—"],
              ["TL / Supervisor", item.supervisorName || item.tl || "—"],
              ["Agent / Subject", item.subjectName || item.agent || "—"],
              ["Account", item.account || "—"],
              ["Incident / Action", truncate(item.incident || item.actionTaken || item.remarks || "—", 75)],
              ["Screenshots", String(shotCount)],
              ["CCTV Links", String(linkCount)]
            ]
          });
        });

        // Nested deletions in persisting reports
        beforeReports.forEach(beforeReport => {
          const afterReport = afterReports.find(r => r.id === beforeReport.id);
          if (!afterReport) return;

          // Multi-screenshots
          const beforeShots = Array.isArray(beforeReport.screenshots) ? beforeReport.screenshots : [];
          const afterShots = Array.isArray(afterReport.screenshots) ? afterReport.screenshots : [];
          if (beforeShots.length > afterShots.length) {
            const diff = beforeShots.length - afterShots.length;
            details.push({
              type: "EDR Screenshot",
              title: beforeReport.subjectName || "EDR Evidence",
              fields: [
                ["Report Date", beforeReport.date || "—"],
                ["Subject", beforeReport.subjectName || "—"],
                ["Evidence", `${diff} deleted attached screenshot${diff === 1 ? "" : "s"}`]
              ]
            });
          }

          // Legacy single screenshotData
          if (beforeReport.screenshotData && !afterReport.screenshotData) {
            details.push({
              type: "EDR Screenshot",
              title: beforeReport.subjectName || "EDR Evidence",
              fields: [
                ["Report Date", beforeReport.date || "—"],
                ["Subject", beforeReport.subjectName || "—"],
                ["Evidence", "Deleted primary screenshot"]
              ]
            });
          }

          // Clip links
          const beforeLinks = Array.isArray(beforeReport.cctvLinks) ? beforeReport.cctvLinks : [];
          const afterLinks = Array.isArray(afterReport.cctvLinks) ? afterReport.cctvLinks : [];
          if (beforeLinks.length > afterLinks.length) {
            const diff = beforeLinks.length - afterLinks.length;
            details.push({
              type: "EDR CCTV Link",
              title: beforeReport.subjectName || "CCTV Link",
              fields: [
                ["Report Date", beforeReport.date || "—"],
                ["Evidence", `${diff} deleted CCTV clip link${diff === 1 ? "" : "s"}`]
              ]
            });
          }
        });
      } else if (ws === "sorter") {
        // Special case: Only classify row deletion when row count decreased!
        const beforeRows = Array.isArray(before.rows) ? before.rows : [];
        const afterRows = Array.isArray(after.rows) ? after.rows : [];
        if (afterRows.length < beforeRows.length) {
          const deleted = findDeletedSorterRows(beforeRows, afterRows);
          deleted.forEach(row => {
            const rowValues = Array.isArray(row)
              ? row.slice(0, 6).map(historyValue).join(" · ")
              : Object.values(row).slice(0, 6).map(historyValue).join(" · ");
            details.push({
              type: "AI Sorter Row",
              title: (Array.isArray(row) ? row[0] : Object.values(row)[0]) || "Sorter Row",
              fields: [
                ["Row Values", truncate(rowValues, 90)]
              ]
            });
          });
        }
      } else if (ws === "maintenance") {
        const beforeBlocks = Array.isArray(before.blocks) ? before.blocks : [];
        const afterBlocks = Array.isArray(after.blocks) ? after.blocks : [];
        const afterIds = new Set(afterBlocks.map(historyItemIdentity));
        const deletedBlocks = beforeBlocks.filter(b => !afterIds.has(historyItemIdentity(b)));

        deletedBlocks.forEach(b => {
          details.push({
            type: "Maintenance Block",
            title: b.title || b.site || ("Block " + (b.id || "")),
            fields: [
              ["Block / Site", b.title || b.site || "—"],
              ["Rows Count", String((b.rows || b.data || []).length)],
              ["Screenshots", String((b.screenshots || []).length)]
            ]
          });
        });

        // Nested deletions in persisting blocks
        beforeBlocks.forEach(beforeBlock => {
          const afterBlock = afterBlocks.find(b => b.id === beforeBlock.id);
          if (!afterBlock) return;

          const beforeShots = Array.isArray(beforeBlock.screenshots) ? beforeBlock.screenshots : [];
          const afterShots = Array.isArray(afterBlock.screenshots) ? afterBlock.screenshots : [];
          if (beforeShots.length > afterShots.length) {
            const diff = beforeShots.length - afterShots.length;
            details.push({
              type: "Maintenance Screenshot",
              title: beforeBlock.title || beforeBlock.site || "Maintenance Block",
              fields: [
                ["Block", beforeBlock.title || beforeBlock.site || "—"],
                ["Evidence", `${diff} deleted screenshot${diff === 1 ? "" : "s"}`]
              ]
            });
          }

          const beforeRows = Array.isArray(beforeBlock.rows || beforeBlock.data) ? (beforeBlock.rows || beforeBlock.data) : [];
          const afterRows = Array.isArray(afterBlock.rows || afterBlock.data) ? (afterBlock.rows || afterBlock.data) : [];
          if (beforeRows.length > afterRows.length) {
            const diff = beforeRows.length - afterRows.length;
            details.push({
              type: "Maintenance Row",
              title: beforeBlock.title || beforeBlock.site || "Maintenance Block",
              fields: [
                ["Block", beforeBlock.title || beforeBlock.site || "—"],
                ["Rows", `${diff} deleted data row${diff === 1 ? "" : "s"}`]
              ]
            });
          }
        });
      } else if (ws === "pending" || ws === "followup") {
        const beforeList = Array.isArray(before) ? before : (Array.isArray(before.reports) ? before.reports : []);
        const afterList = Array.isArray(after) ? after : (Array.isArray(after.reports) ? after.reports : []);
        const afterIds = new Set(afterList.map(historyItemIdentity));
        const deleted = beforeList.filter(item => !afterIds.has(historyItemIdentity(item)));

        const typeName = ws === "pending" ? "Pending Report" : "Follow Up Report";
        deleted.forEach(item => {
          details.push({
            type: typeName,
            title: item.label || item.tl || item.om || typeName,
            fields: [
              ["Date", item.date || "—"],
              ["OM", item.om || "—"],
              ["Label / Subject", item.label || item.tl || item.agent || "—"],
              ["Status", item.status || "—"],
              ["Remarks", truncate(item.remarks || item.notes || "—", 75)]
            ]
          });
        });
      } else if (ws === "unreported") {
        const beforeList = Array.isArray(before) ? before : [];
        const afterList = Array.isArray(after) ? after : [];
        const afterIds = new Set(afterList.map(historyItemIdentity));
        const deleted = beforeList.filter(item => !afterIds.has(historyItemIdentity(item)));

        deleted.forEach(item => {
          details.push({
            type: "Unreported Item",
            title: truncate(item.remarks || "Unreported Card", 35),
            fields: [
              ["Created At", formatDateTime(item.createdAt) || "—"],
              ["Remarks", truncate(item.remarks || "—", 75)],
              ["Screenshots", String((item.screenshots || []).length)],
              ["Blue Iris URL", (item.blueIrisUrl || item.cctvUrl) ? "Configured" : "None"]
            ]
          });
        });

        // Nested screenshot in existing unreported item
        beforeList.forEach(beforeItem => {
          const afterItem = afterList.find(i => i.id === beforeItem.id);
          if (!afterItem) return;
          const beforeShots = Array.isArray(beforeItem.screenshots) ? beforeItem.screenshots : [];
          const afterShots = Array.isArray(afterItem.screenshots) ? afterItem.screenshots : [];
          if (beforeShots.length > afterShots.length) {
            const diff = beforeShots.length - afterShots.length;
            details.push({
              type: "Unreported Screenshot",
              title: truncate(beforeItem.remarks || "Unreported Card", 35),
              fields: [
                ["Card", truncate(beforeItem.remarks || "—", 50)],
                ["Evidence", `${diff} deleted screenshot${diff === 1 ? "" : "s"}`]
              ]
            });
          }
        });
      } else if (ws === "report") {
        const beforeShots = Array.isArray(before.screenshots) ? before.screenshots : [];
        const afterShots = Array.isArray(after.screenshots) ? after.screenshots : [];
        const afterIds = new Set(afterShots.map(historyItemIdentity));
        const deleted = beforeShots.filter(s => !afterIds.has(historyItemIdentity(s)));

        deleted.forEach(shot => {
          details.push({
            type: "CCTV Report Screenshot",
            title: shot.caption || "Screenshot Evidence",
            fields: [
              ["Caption", shot.caption || "Untitled Screenshot"],
              ["Camera / Time", [shot.camera, shot.timestamp].filter(Boolean).join(" · ") || "—"],
              ["Notes", truncate(shot.notes || shot.remarks || "—", 75)]
            ]
          });
        });
      } else if (ws === "masterlist") {
        const beforeHr = Array.isArray(before.hrLocal) ? before.hrLocal : [];
        const afterHr = Array.isArray(after.hrLocal) ? after.hrLocal : [];

        // Deleted HR assignments: in before as active, but tombstoned or removed in after
        afterHr.forEach(afterItem => {
          if (afterItem.deleted) {
            const beforeItem = beforeHr.find(b =>
              b.site === afterItem.site && b.omTeam === afterItem.omTeam && !b.deleted
            );
            if (beforeItem || entry.action?.toLowerCase().includes("delete")) {
              details.push({
                type: "Master List Assignment",
                title: afterItem.hr || afterItem.name || "HR Assignment",
                fields: [
                  ["Site", afterItem.site || "—"],
                  ["OM Team", afterItem.omTeam || "—"],
                  ["HR", afterItem.hr || afterItem.name || "—"]
                ]
              });
            }
          }
        });

        // Deleted options
        const beforeOpts = before.options && typeof before.options === "object" ? before.options : {};
        const afterOpts = after.options && typeof after.options === "object" ? after.options : {};
        for (const [category, values] of Object.entries(beforeOpts)) {
          if (Array.isArray(values)) {
            const afterValues = Array.isArray(afterOpts[category]) ? afterOpts[category] : [];
            values.forEach(val => {
              if (!afterValues.includes(val)) {
                details.push({
                  type: "Master List Option",
                  title: String(val),
                  fields: [
                    ["Category", category],
                    ["Value", String(val)]
                  ]
                });
              }
            });
          }
        }
      }

      return details;
    }

    // =========================================================================
    // RESTORE SELECTED ENTRY: DELETED-DATA RECOVERY ONLY
    // Merges missing deleted records into the current workspace state.
    // Preserves all newer unrelated work. Never falls back to full snapshot rollback.
    // Idempotent: 2nd click does not duplicate, reports already restored.
    // =========================================================================
    async restoreSelectedEntry(selectedId) {
      const id = selectedId || this.selectedHistoryId;
      if (!id) return { success: false, restoredCount: 0, reason: "no-selection" };

      const entry = this.entries.find(e => e.id === id);
      if (!entry) return { success: false, restoredCount: 0, reason: "not-found" };

      const canonical = canonicalWorkspace(entry.workspace);
      const adapter = this._adapters()[canonical] || this._adapters()[entry.workspace];
      if (!adapter?.restore) return { success: false, restoredCount: 0, reason: "no-adapter" };

      // 1. Guard against non-deletion entries
      const deletedDetails = this.getDeletedDetails(entry);
      if (!deletedDetails.length) {
        return { success: false, restoredCount: 0, reason: "nothing-to-restore" };
      }

      // 2. Ensure all media references in before/after are preloaded into memory cache
      await ensureMediaLoaded(entry.before);
      await ensureMediaLoaded(entry.after);

      // 3. Take live snapshot of current workspace
      const currentRaw = await this.takeSnapshot(canonical);
      await ensureMediaLoaded(currentRaw);
      let current = decompressMedia(clone(currentRaw));
      const before = decompressMedia(clone(entry.before));
      const after = decompressMedia(clone(entry.after));

      let restoredCount = 0;
      let alreadyRestored = false;
      let desc = "";

      // 4. Targeted merge by workspace
      if (canonical === "audit") {
        const currentEntries = Array.isArray(current?.entries) ? current.entries : (Array.isArray(current) ? current : []);
        const currentIds = new Set(currentEntries.map(historyItemIdentity));
        const afterList = Array.isArray(after?.entries) ? after.entries : (Array.isArray(after) ? after : []);
        const afterIds = new Set(afterList.map(historyItemIdentity));
        const beforeList = Array.isArray(before?.entries) ? before.entries : (Array.isArray(before) ? before : []);
        const deleted = beforeList.filter(e => !afterIds.has(historyItemIdentity(e)));

        const missing = deleted.filter(e => !currentIds.has(historyItemIdentity(e)));
        if (deleted.length > 0 && missing.length === 0) {
          alreadyRestored = true;
        } else if (missing.length > 0) {
          missing.forEach(e => {
            currentEntries.push(clone(e));
            currentIds.add(historyItemIdentity(e));
          });
          current = typeof current === "object" && current !== null && !Array.isArray(current)
            ? { ...current, entries: currentEntries }
            : { entries: currentEntries };
          restoredCount += missing.length;
          desc = `${restoredCount} CCTV Audit ${restoredCount === 1 ? "entry" : "entries"}`;
        }
      } else if (canonical === "edr") {
        const currentReports = Array.isArray(current?.reports) ? current.reports : (Array.isArray(current) ? current : []);
        const currentIds = new Set(currentReports.map(historyItemIdentity));
        const afterList = Array.isArray(after?.reports) ? after.reports : (Array.isArray(after) ? after : []);
        const afterIds = new Set(afterList.map(historyItemIdentity));
        const beforeList = Array.isArray(before?.reports) ? before.reports : (Array.isArray(before) ? before : []);
        const deleted = beforeList.filter(r => !afterIds.has(historyItemIdentity(r)));

        const missing = deleted.filter(r => !currentIds.has(historyItemIdentity(r)));
        if (deleted.length > 0 && missing.length === 0) {
          alreadyRestored = true;
        } else if (missing.length > 0) {
          missing.forEach(r => {
            currentReports.push(clone(r));
            currentIds.add(historyItemIdentity(r));
          });
          current = typeof current === "object" && current !== null && !Array.isArray(current)
            ? { ...current, reports: currentReports }
            : { reports: currentReports };
          restoredCount += missing.length;
          desc = `${restoredCount} EDR ${restoredCount === 1 ? "report" : "reports"}`;
        }

        // Nested screenshot / clip link restoration in persisting EDR reports
        const beforeReports = Array.isArray(before?.reports) ? before.reports : [];
        const afterReports = Array.isArray(after?.reports) ? after.reports : [];
        beforeReports.forEach(beforeReport => {
          const afterReport = afterReports.find(r => r.id === beforeReport.id);
          const currentReport = currentReports.find(r => r.id === beforeReport.id);
          if (!afterReport || !currentReport) return;

          // Attached screenshots array
          const beforeShots = Array.isArray(beforeReport.screenshots) ? beforeReport.screenshots : [];
          const afterShots = Array.isArray(afterReport.screenshots) ? afterReport.screenshots : [];
          const currentShots = Array.isArray(currentReport.screenshots) ? currentReport.screenshots : [];
          const afterShotSigs = new Set(afterShots.map(s => stable(s)));
          const currentShotSigs = new Set(currentShots.map(s => stable(s)));

          beforeShots.forEach(shot => {
            const sig = stable(shot);
            if (!afterShotSigs.has(sig)) {
              if (!currentShotSigs.has(sig)) {
                currentShots.push(clone(shot));
                currentShotSigs.add(sig);
                restoredCount++;
                desc = desc || "deleted screenshot";
              } else {
                alreadyRestored = true;
              }
            }
          });
          currentReport.screenshots = currentShots;

          // Legacy screenshotData
          if (beforeReport.screenshotData && !afterReport.screenshotData) {
            if (!currentReport.screenshotData) {
              currentReport.screenshotData = beforeReport.screenshotData;
              currentReport.screenshotFileId = beforeReport.screenshotFileId || "";
              restoredCount++;
              desc = desc || "deleted screenshot";
            } else {
              alreadyRestored = true;
            }
          }

          // Clip links
          const beforeLinks = Array.isArray(beforeReport.cctvLinks) ? beforeReport.cctvLinks : [];
          const afterLinks = Array.isArray(afterReport.cctvLinks) ? afterReport.cctvLinks : [];
          const currentLinks = Array.isArray(currentReport.cctvLinks) ? currentReport.cctvLinks : [];
          beforeLinks.forEach(link => {
            if (!afterLinks.includes(link)) {
              if (!currentLinks.includes(link)) {
                currentLinks.push(link);
                restoredCount++;
                desc = desc || "deleted CCTV link";
              } else {
                alreadyRestored = true;
              }
            }
          });
          currentReport.cctvLinks = currentLinks;
        });
      } else if (canonical === "sorter") {
        const beforeRows = Array.isArray(before?.rows) ? before.rows : [];
        const afterRows = Array.isArray(after?.rows) ? after.rows : [];
        if (afterRows.length < beforeRows.length) {
          const deleted = findDeletedSorterRows(beforeRows, afterRows);
          const currentRows = Array.isArray(current?.rows) ? current.rows : [];
          const currentSigs = new Set(currentRows.map(r => stable(r)));

          const missing = deleted.filter(r => !currentSigs.has(stable(r)));
          if (deleted.length > 0 && missing.length === 0) {
            alreadyRestored = true;
          } else if (missing.length > 0) {
            missing.forEach(r => {
              currentRows.push(clone(r));
              currentSigs.add(stable(r));
            });
            current.rows = currentRows;
            restoredCount += missing.length;
            desc = `${restoredCount} AI Sorter ${restoredCount === 1 ? "row" : "rows"}`;
          }
        }
      } else if (canonical === "maintenance") {
        const currentBlocks = Array.isArray(current?.blocks) ? current.blocks : [];
        const currentIds = new Set(currentBlocks.map(historyItemIdentity));
        const afterIds = new Set((after?.blocks || []).map(historyItemIdentity));
        const deleted = (before?.blocks || []).filter(b => !afterIds.has(historyItemIdentity(b)));

        const missing = deleted.filter(b => !currentIds.has(historyItemIdentity(b)));
        if (deleted.length > 0 && missing.length === 0) {
          alreadyRestored = true;
        } else if (missing.length > 0) {
          missing.forEach(b => {
            currentBlocks.push(clone(b));
            currentIds.add(historyItemIdentity(b));
          });
          current.blocks = currentBlocks;
          restoredCount += missing.length;
          desc = `${restoredCount} Maintenance ${restoredCount === 1 ? "block" : "blocks"}`;
        }

        // Nested screenshots or rows inside persisting blocks
        const beforeBlocks = Array.isArray(before?.blocks) ? before.blocks : [];
        const afterBlocks = Array.isArray(after?.blocks) ? after.blocks : [];
        beforeBlocks.forEach(beforeBlock => {
          const afterBlock = afterBlocks.find(b => b.id === beforeBlock.id);
          const currentBlock = currentBlocks.find(b => b.id === beforeBlock.id);
          if (!afterBlock || !currentBlock) return;

          // Screenshots
          const beforeShots = Array.isArray(beforeBlock.screenshots) ? beforeBlock.screenshots : [];
          const afterShots = Array.isArray(afterBlock.screenshots) ? afterBlock.screenshots : [];
          const currentShots = Array.isArray(currentBlock.screenshots) ? currentBlock.screenshots : [];
          const afterShotSigs = new Set(afterShots.map(s => stable(s)));
          const currentShotSigs = new Set(currentShots.map(s => stable(s)));

          beforeShots.forEach(shot => {
            const sig = stable(shot);
            if (!afterShotSigs.has(sig)) {
              if (!currentShotSigs.has(sig)) {
                currentShots.push(clone(shot));
                currentShotSigs.add(sig);
                restoredCount++;
                desc = desc || "deleted screenshot";
              } else {
                alreadyRestored = true;
              }
            }
          });
          currentBlock.screenshots = currentShots;

          // Rows
          const beforeRows = Array.isArray(beforeBlock.rows || beforeBlock.data) ? (beforeBlock.rows || beforeBlock.data) : [];
          const afterRows = Array.isArray(afterBlock.rows || afterBlock.data) ? (afterBlock.rows || afterBlock.data) : [];
          const currentRows = Array.isArray(currentBlock.rows || currentBlock.data) ? (currentBlock.rows || currentBlock.data) : [];
          const afterRowSigs = new Set(afterRows.map(r => stable(r)));
          const currentRowSigs = new Set(currentRows.map(r => stable(r)));

          beforeRows.forEach(row => {
            const sig = stable(row);
            if (!afterRowSigs.has(sig)) {
              if (!currentRowSigs.has(sig)) {
                currentRows.push(clone(row));
                currentRowSigs.add(sig);
                restoredCount++;
                desc = desc || "deleted maintenance row";
              } else {
                alreadyRestored = true;
              }
            }
          });
          if (Array.isArray(currentBlock.rows)) currentBlock.rows = currentRows;
          if (Array.isArray(currentBlock.data)) currentBlock.data = currentRows;
        });
      } else if (canonical === "pending" || canonical === "followup") {
        const currentList = Array.isArray(current) ? current : (Array.isArray(current?.reports) ? current.reports : []);
        const currentIds = new Set(currentList.map(historyItemIdentity));
        const afterList = Array.isArray(after) ? after : (Array.isArray(after?.reports) ? after.reports : []);
        const afterIds = new Set(afterList.map(historyItemIdentity));
        const beforeList = Array.isArray(before) ? before : (Array.isArray(before?.reports) ? before.reports : []);
        const deleted = beforeList.filter(item => !afterIds.has(historyItemIdentity(item)));

        const missing = deleted.filter(item => !currentIds.has(historyItemIdentity(item)));
        if (deleted.length > 0 && missing.length === 0) {
          alreadyRestored = true;
        } else if (missing.length > 0) {
          missing.forEach(item => {
            currentList.push(clone(item));
            currentIds.add(historyItemIdentity(item));
          });
          current = currentList;
          restoredCount += missing.length;
          const label = canonical === "pending" ? "Pending" : "Follow Up";
          desc = `${restoredCount} ${label} ${restoredCount === 1 ? "report" : "reports"}`;
        }
      } else if (canonical === "unreported") {
        const currentList = Array.isArray(current) ? current : [];
        const currentIds = new Set(currentList.map(historyItemIdentity));
        const afterList = Array.isArray(after) ? after : [];
        const afterIds = new Set(afterList.map(historyItemIdentity));
        const beforeList = Array.isArray(before) ? before : [];
        const deleted = beforeList.filter(item => !afterIds.has(historyItemIdentity(item)));

        const missing = deleted.filter(item => !currentIds.has(historyItemIdentity(item)));
        if (deleted.length > 0 && missing.length === 0) {
          alreadyRestored = true;
        } else if (missing.length > 0) {
          missing.forEach(item => {
            currentList.push(clone(item));
            currentIds.add(historyItemIdentity(item));
          });
          current = currentList;
          restoredCount += missing.length;
          desc = `${restoredCount} Unreported ${restoredCount === 1 ? "item" : "items"}`;
        }

        // Nested screenshot in existing unreported card
        beforeList.forEach(beforeItem => {
          const afterItem = afterList.find(i => i.id === beforeItem.id);
          const currentItem = currentList.find(i => i.id === beforeItem.id);
          if (!afterItem || !currentItem) return;

          const beforeShots = Array.isArray(beforeItem.screenshots) ? beforeItem.screenshots : [];
          const afterShots = Array.isArray(afterItem.screenshots) ? afterItem.screenshots : [];
          const currentShots = Array.isArray(currentItem.screenshots) ? currentItem.screenshots : [];
          const afterShotSigs = new Set(afterShots.map(s => stable(s)));
          const currentShotSigs = new Set(currentShots.map(s => stable(s)));

          beforeShots.forEach(shot => {
            const sig = stable(shot);
            if (!afterShotSigs.has(sig)) {
              if (!currentShotSigs.has(sig)) {
                currentShots.push(clone(shot));
                currentShotSigs.add(sig);
                restoredCount++;
                desc = desc || "deleted screenshot";
              } else {
                alreadyRestored = true;
              }
            }
          });
          currentItem.screenshots = currentShots;
        });
      } else if (canonical === "report") {
        const currentShots = Array.isArray(current?.screenshots) ? current.screenshots : [];
        const currentIds = new Set(currentShots.map(historyItemIdentity));
        const afterShots = Array.isArray(after?.screenshots) ? after.screenshots : [];
        const afterIds = new Set(afterShots.map(historyItemIdentity));
        const beforeShots = Array.isArray(before?.screenshots) ? before.screenshots : [];
        const deleted = beforeShots.filter(s => !afterIds.has(historyItemIdentity(s)));

        const missing = deleted.filter(s => !currentIds.has(historyItemIdentity(s)));
        if (deleted.length > 0 && missing.length === 0) {
          alreadyRestored = true;
        } else if (missing.length > 0) {
          missing.forEach(s => {
            currentShots.push(clone(s));
            currentIds.add(historyItemIdentity(s));
          });
          current.screenshots = currentShots;
          restoredCount += missing.length;
          desc = `${restoredCount} CCTV Report ${restoredCount === 1 ? "screenshot" : "screenshots"}`;
        }
      } else if (canonical === "masterlist") {
        const currentHr = Array.isArray(current?.hrLocal) ? current.hrLocal : [];
        const afterHr = Array.isArray(after?.hrLocal) ? after.hrLocal : [];

        // Restore tombstoned HR assignment
        afterHr.forEach(afterItem => {
          if (afterItem.deleted) {
            const groupKey = `${String(afterItem.site).trim().toLowerCase()}|${String(afterItem.omTeam).trim().toLowerCase()}`;
            const tombstoneIdx = currentHr.findIndex(c =>
              c.deleted && `${String(c.site).trim().toLowerCase()}|${String(c.omTeam).trim().toLowerCase()}` === groupKey
            );
            if (tombstoneIdx >= 0) {
              currentHr.splice(tombstoneIdx, 1);
              restoredCount++;
              desc = "Master List HR assignment";
            } else {
              alreadyRestored = true;
            }
          }
        });
        current.hrLocal = currentHr;

        // Restore options
        const beforeOpts = before?.options && typeof before.options === "object" ? before.options : {};
        const afterOpts = after?.options && typeof after.options === "object" ? after.options : {};
        current.options = current.options || {};
        for (const [category, values] of Object.entries(beforeOpts)) {
          if (Array.isArray(values)) {
            const afterValues = Array.isArray(afterOpts[category]) ? afterOpts[category] : [];
            current.options[category] = Array.isArray(current.options[category]) ? current.options[category] : [];
            values.forEach(val => {
              if (!afterValues.includes(val)) {
                if (!current.options[category].includes(val)) {
                  current.options[category].push(val);
                  restoredCount++;
                  desc = desc || "Master List option";
                } else {
                  alreadyRestored = true;
                }
              }
            });
          }
        }
      }

      // 5. Final check: if no missing data was found
      if (!restoredCount) {
        if (alreadyRestored) {
          return { success: false, restoredCount: 0, reason: "already-restored" };
        }
        return { success: false, restoredCount: 0, reason: "nothing-to-restore" };
      }

      // Record pre-restore state in lastSnapshots so captureIfChanged detects the change
      this.lastSnapshots[canonical] = compressMedia(clone(currentRaw));

      // 6. Mutate workspace through adapter
      this.suppress = true;
      try {
        await adapter.restore(decompressMedia(clone(current)));
      } catch (err) {
        console.error("Workspace adapter restore failed:", err);
        return { success: false, restoredCount: 0, reason: "adapter-error", error: err.message };
      } finally {
        this.suppress = false;
      }

      await this.captureIfChanged(
        canonical,
        `Restored ${desc || "deleted data"} · ${entry.action}`
      );

      this.selectedHistoryId = null;
      this._notify();
      return { success: true, restoredCount, description: desc };
    }

    async clearHistory() {
      this.entries = [];
      this.cursor = -1;
      this.workspaceHistory = {};
      this.selectedHistoryId = null;

      try {
        const db = await this._openDb();
        await new Promise((resolve, reject) => {
          const tx = db.transaction([STORE, MEDIA_STORE], "readwrite");
          tx.objectStore(STORE).delete(STATE_KEY);
          tx.objectStore(MEDIA_STORE).clear();
          tx.oncomplete = resolve;
          tx.onerror = () => reject(tx.error);
        });
        db.close();
      } catch (err) {
        console.warn("Clear history failed:", err);
      }

      await this.initializeBaselines();
      this._notify();
      return true;
    }

    getTimeline() {
      return {
        entries: [...this.entries],
        cursor: this.cursor,
        selectedId: this.selectedHistoryId,
        canUndo: this.cursor >= 0,
        canRedo: this.cursor < this.entries.length - 1,
        total: this.entries.length,
        max: MAX_HISTORY
      };
    }

    setSelectedId(id) {
      this.selectedHistoryId = id;
      this._notify();
    }

    historyItemLabel(workspace, item) {
      if (!item) return "Workspace data changed";
      const ws = canonicalWorkspace(workspace);

      if (ws === "audit") {
        return [
          item.formattedDate || item.rawDate || item.date,
          item.tlName || item.tl,
          item.agentName || item.agent,
          item.cleanAccount || item.account,
          item.reasonCode || item.reason,
          item.noc ? `NOC: ${item.noc}` : ""
        ].filter(Boolean).join(" · ");
      }
      if (ws === "edr") {
        return [
          item.date,
          item.site,
          item.supervisorName || item.tl,
          item.subjectName || item.agent,
          item.account
        ].filter(Boolean).join(" · ");
      }
      if (ws === "pending" || ws === "followup") {
        return [
          item.date,
          item.om,
          item.label || item.tl || item.agent,
          item.status
        ].filter(Boolean).join(" · ");
      }
      if (ws === "maintenance") {
        return [
          item.title || item.site || ("Block " + (item.id || "")),
          (item.rows || item.data || []).length ? `${(item.rows || item.data).length} rows` : "",
          (item.screenshots || []).length ? `${item.screenshots.length} screenshot(s)` : ""
        ].filter(Boolean).join(" · ");
      }
      if (ws === "sorter") {
        if (Array.isArray(item)) return item.slice(0, 7).map(historyValue).join(" · ");
        return Object.values(item).slice(0, 7).map(historyValue).join(" · ");
      }
      if (ws === "unreported") {
        return [
          item.createdAt ? formatDateTime(item.createdAt) : "",
          item.remarks ? truncate(item.remarks, 45) : "Unreported card",
          (item.screenshots || []).length ? `${item.screenshots.length} screenshot(s)` : ""
        ].filter(Boolean).join(" · ");
      }
      if (ws === "report") {
        return item.caption ? `Evidence: ${item.caption}` : "Screenshot evidence";
      }
      if (ws === "masterlist") {
        return [item.site, item.omTeam, item.hr || item.name].filter(Boolean).join(" · ");
      }
      return "Workspace data changed";
    }

    historyEntrySummary(entry) {
      if (!entry) return "";
      const ws = canonicalWorkspace(entry.workspace);
      const details = this.getDeletedDetails(entry);
      if (details.length === 1) {
        return `Deleted ${details[0].type} — ${details[0].title}`;
      }
      if (details.length > 1) {
        return `Deleted ${details.length} ${WORKSPACE_NAMES[ws] || ws} items`;
      }

      const beforeDesc = collectionDescriptor(ws, entry.before);
      const afterDesc = collectionDescriptor(ws, entry.after);
      if (beforeDesc && afterDesc) {
        const beforeMap = new Map(beforeDesc.items.map(item => [historyItemIdentity(item), item]));
        const afterMap = new Map(afterDesc.items.map(item => [historyItemIdentity(item), item]));
        for (const [id, item] of afterMap) {
          if (!beforeMap.has(id)) return `Added: ${this.historyItemLabel(ws, item)}`;
          if (stable(beforeMap.get(id)) !== stable(item)) return `Updated: ${this.historyItemLabel(ws, item)}`;
        }
        for (const [id, item] of beforeMap) {
          if (!afterMap.has(id)) return `Removed: ${this.historyItemLabel(ws, item)}`;
        }
      }

      if (ws === "masterlist" && (entry.before?.note || "") !== (entry.after?.note || "")) {
        return "Pending tracker notepad changed";
      }

      return entry.action || `Updated ${WORKSPACE_NAMES[ws] || ws}`;
    }

    _workspaceForElement(target) {
      const pane = target?.closest?.(".workspace-pane");
      return pane ? canonicalWorkspace(WORKSPACE_MAP[pane.id]) : null;
    }

    _activeWorkspace() {
      if (typeof window.getCurrentWorkspace === "function") {
        return canonicalWorkspace(window.getCurrentWorkspace());
      }
      const pane = document.querySelector(".workspace-pane.active:not([hidden])") ||
        document.querySelector(".workspace-pane:not([hidden])");
      return pane ? canonicalWorkspace(WORKSPACE_MAP[pane.id]) : null;
    }

    _actionFromTarget(target, workspace) {
      const control = target?.closest?.("button, label, a");
      const raw = control?.getAttribute?.("title") ||
        control?.getAttribute?.("aria-label") ||
        control?.textContent || "";
      const text = String(raw).replace(/\s+/g, " ").trim();
      const wsName = WORKSPACE_NAMES[workspace] || workspace;
      return text ? `${text} · ${wsName}` : `Updated ${wsName}`;
    }

    _bindGlobalDomListeners() {
      document.addEventListener("input", event => {
        const ws = this._workspaceForElement(event.target);
        if (!ws) return;
        this.scheduleCapture(ws, `Edited ${WORKSPACE_NAMES[ws] || ws}`, 700);
      }, true);

      document.addEventListener("change", event => {
        const ws = this._workspaceForElement(event.target);
        if (!ws) return;
        this.scheduleCapture(ws, `Changed ${WORKSPACE_NAMES[ws] || ws}`, 500);
      }, true);

      document.addEventListener("drop", event => {
        const ws = this._workspaceForElement(event.target) || this._activeWorkspace();
        if (!ws) return;
        this.scheduleCapture(ws, `Added file to ${WORKSPACE_NAMES[ws] || ws}`, 1100);
      }, true);

      document.addEventListener("click", event => {
        const control = event.target.closest?.("button, label, a");
        if (!control) return;

        if (
          control.closest("#modalGlobalHistory") ||
          control.closest("#paneHistory") ||
          control.id === "btnGlobalHistory" ||
          control.id === "tabHistory" ||
          control.classList.contains("nav-item")
        ) {
          return;
        }

        const ws = this._workspaceForElement(control) || this._activeWorkspace();
        if (!ws) return;

        const action = this._actionFromTarget(control, ws);
        this.scheduleCapture(ws, action, 400);
      }, true);
    }

    subscribe(fn) {
      this.listeners.push(fn);
      return () => {
        this.listeners = this.listeners.filter(l => l !== fn);
      };
    }

    _notify() {
      this.listeners.forEach(fn => {
        try { fn(); } catch (e) { console.error("History listener error:", e); }
      });
    }
  }

  // Singleton instance
  window.historyService = new HistoryService();
})();
