/**
 * CCTV OPS V2 - Global Workspace History Service
 * Comprehensive undo, redo, snapshot capture, and targeted restore across all workspaces
 */

(function () {
  'use strict';

  const DB_NAME = "cctv_global_workspace_history_v1";
  const STORE = "history";
  const STATE_KEY = "timeline";
  const MAX_HISTORY = 20;

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
    return JSON.stringify(val);
  }

  function historyValue(v) {
    return String(v == null ? "" : v).trim() || "—";
  }

  function historyItemIdentity(item) {
    if (item && typeof item === "object") {
      if (item.id) return "id:" + item.id;
      if (item.sourceEdrId) return "edr:" + item.sourceEdrId;
    }
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
        apply(target, items) { target.entries = items; }
      };
    }
    if (ws === "maintenance") {
      return {
        items: Array.isArray(snapshot?.blocks) ? snapshot.blocks : [],
        apply(target, items) { target.blocks = items; }
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
        apply(target, items) { target.reports = items; }
      };
    }
    if (ws === "sorter") {
      return {
        items: Array.isArray(snapshot?.rows) ? snapshot.rows : [],
        apply(target, items) { target.rows = items; }
      };
    }
    if (ws === "masterlist") {
      return {
        items: Array.isArray(snapshot?.hrLocal) ? snapshot.hrLocal : [],
        apply(target, items) { target.hrLocal = items; }
      };
    }
    return null;
  }

  function mergeDeletedItems(beforeItems, afterItems, currentItems) {
    const afterIds = new Set(afterItems.map(historyItemIdentity));
    const currentIds = new Set(currentItems.map(historyItemIdentity));
    const deleted = beforeItems.filter(item => !afterIds.has(historyItemIdentity(item)));

    if (!deleted.length) {
      return { changed: false, items: currentItems, count: 0 };
    }

    const merged = currentItems.slice();
    deleted.forEach(item => {
      const id = historyItemIdentity(item);
      if (!currentIds.has(id)) {
        merged.push(clone(item));
        currentIds.add(id);
      }
    });

    return {
      changed: merged.length !== currentItems.length,
      items: merged,
      count: deleted.length
    };
  }

  function restoreNestedRemovedContent(workspace, before, after, current) {
    let restored = 0;
    const ws = canonicalWorkspace(workspace);
    if (ws === "maintenance") {
      const beforeBlocks = Array.isArray(before?.blocks) ? before.blocks : [];
      const afterBlocks = Array.isArray(after?.blocks) ? after.blocks : [];
      const currentBlocks = Array.isArray(current?.blocks) ? current.blocks : [];

      beforeBlocks.forEach(beforeBlock => {
        const afterBlock = afterBlocks.find(b => b.id === beforeBlock.id);
        const currentBlock = currentBlocks.find(b => b.id === beforeBlock.id);
        if (!afterBlock || !currentBlock) return;

        const beforeShots = Array.isArray(beforeBlock.screenshots) ? beforeBlock.screenshots : [];
        const afterShots = Array.isArray(afterBlock.screenshots) ? afterBlock.screenshots : [];
        const currentShots = Array.isArray(currentBlock.screenshots) ? currentBlock.screenshots : [];

        const afterIds = new Set(afterShots.map(historyItemIdentity));
        const currentIds = new Set(currentShots.map(historyItemIdentity));

        beforeShots.forEach(shot => {
          const id = historyItemIdentity(shot);
          if (!afterIds.has(id) && !currentIds.has(id)) {
            currentShots.push(clone(shot));
            currentIds.add(id);
            restored++;
          }
        });
        currentBlock.screenshots = currentShots;
      });
    }

    if (ws === "edr") {
      const beforeReports = Array.isArray(before?.reports) ? before.reports : [];
      const afterReports = Array.isArray(after?.reports) ? after.reports : [];
      const currentReports = Array.isArray(current?.reports) ? current.reports : [];

      beforeReports.forEach(beforeReport => {
        const afterReport = afterReports.find(r => r.id === beforeReport.id);
        const currentReport = currentReports.find(r => r.id === beforeReport.id);
        if (!afterReport || !currentReport) return;

        if (beforeReport.screenshotData && !afterReport.screenshotData && !currentReport.screenshotData) {
          currentReport.screenshotData = beforeReport.screenshotData;
          currentReport.screenshotFileId = beforeReport.screenshotFileId || "";
          restored++;
        }
      });
    }

    return restored;
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
            if (Array.isArray(snap?.entries) && audit.saveEntries) {
              await audit.saveEntries(snap.entries);
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
            if (Array.isArray(snap?.reports) && edr.saveReports) {
              await edr.saveReports(snap.reports);
            }
          }
        };
      }

      if (!ad.aiSorter && window.sorterService) {
        ad.aiSorter = {
          label: "AI Sorter",
          snapshot: async () => ({ rows: clone(window.sorterService.getSortedRows?.() || []) }),
          restore: async (snap) => {
            if (Array.isArray(snap?.rows) && window.sorterService.setSortedRows) {
              window.sorterService.setSortedRows(snap.rows);
            }
          }
        };
      }

      if (!ad.maintenanceReport && window.maintenanceService) {
        ad.maintenanceReport = {
          label: "Maintenance Report",
          snapshot: async () => ({ blocks: clone(window.maintenanceService.getBlocks?.() || []) }),
          restore: async (snap) => {
            if (Array.isArray(snap?.blocks) && window.maintenanceService.saveBlocks) {
              await window.maintenanceService.saveBlocks(snap.blocks);
            }
          }
        };
      }

      if (!ad.pendingReports && window.pendingService) {
        ad.pendingReports = {
          label: "Pending Reports",
          snapshot: async () => clone(window.pendingService.getReports?.() || []),
          restore: async (snap) => {
            if (Array.isArray(snap) && window.pendingService.saveReports) {
              await window.pendingService.saveReports(snap);
            }
          }
        };
      }

      if (!ad.followupReports && window.followupService) {
        ad.followupReports = {
          label: "Follow Up Reports",
          snapshot: async () => clone(window.followupService.getReports?.() || []),
          restore: async (snap) => {
            if (Array.isArray(snap) && window.followupService.saveReports) {
              await window.followupService.saveReports(snap);
            }
          }
        };
      }

      if (!ad.masterlist && window.masterlistService) {
        ad.masterlist = {
          label: "Master List",
          snapshot: () => ({
            activeKey: window.masterlistService.getActiveTrackerKey(),
            note: window.masterlistService.getNotepad(window.masterlistService.getActiveTrackerKey()),
            hrLocal: clone(window.masterlistService.localHrChanges || [])
          }),
          restore: async (snap) => {
            const key = snap?.activeKey || window.masterlistService.getActiveTrackerKey();
            if (snap?.note !== undefined) {
              window.masterlistService.saveNotepad(key, snap.note);
            }
            if (Array.isArray(snap?.hrLocal)) {
              window.masterlistService.localHrChanges = clone(snap.hrLocal);
              window.masterlistService._saveLocalHrChanges?.();
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
        ad.cctvReport = ad.report;
      }

      if (!ad.unreported && window.unreportedService) {
        ad.unreported = {
          label: "Unreported Items",
          snapshot: async () => {
            const items = window.unreportedService.getItems?.() || [];
            return clone(items);
          },
          restore: async (snap) => {
            if (Array.isArray(snap) && window.unreportedService.saveItems) {
              await window.unreportedService.saveItems(clone(snap));
              window.unreportedService.renderWorkspace?.();
            }
          }
        };
        ad.unreportedItems = ad.unreported;
      }

      if (ad.cctv && !ad.audit) ad.audit = ad.cctv;
      if (ad.aiSorter && !ad.sorter) ad.sorter = ad.aiSorter;
      if (ad.maintenanceReport && !ad.maintenance) ad.maintenance = ad.maintenanceReport;
      if (ad.pendingReports && !ad.pending) ad.pending = ad.pendingReports;
      if (ad.followupReports && !ad.followup) ad.followup = ad.followupReports;

      return ad;
    }

    async _openDb() {
      return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, 1);
        req.onupgradeneeded = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains(STORE)) {
            db.createObjectStore(STORE);
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

    async _loadTimeline() {
      try {
        const db = await this._openDb();
        const saved = await new Promise((resolve, reject) => {
          const tx = db.transaction(STORE, "readonly");
          const req = tx.objectStore(STORE).get(STATE_KEY);
          req.onsuccess = () => resolve(req.result || null);
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
          this.workspaceHistory = saved.workspaceHistory;
        } else {
          // Reconstruct workspaceHistory from loaded entries if missing
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
          this.lastSnapshots[canonicalWorkspace(ws)] = snap;
        }
      }
    }

    async captureIfChanged(workspace, action) {
      if (this.suppress || !workspace) return;
      const canonical = canonicalWorkspace(workspace);

      const after = await this.takeSnapshot(canonical);
      if (after == null) return;

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

      // 1. Maintain global entries list for Activity History tab
      if (this.cursor < this.entries.length - 1) {
        this.entries = this.entries.slice(0, this.cursor + 1);
      }
      this.entries.push(entry);
      if (this.entries.length > MAX_HISTORY) {
        this.entries = this.entries.slice(this.entries.length - MAX_HISTORY);
      }
      this.cursor = this.entries.length - 1;

      // 2. Maintain SCOPED workspace history stack
      if (!this.workspaceHistory[canonical]) {
        this.workspaceHistory[canonical] = { entries: [], cursor: -1 };
      }
      const wsHist = this.workspaceHistory[canonical];
      if (wsHist.cursor < wsHist.entries.length - 1) {
        wsHist.entries = wsHist.entries.slice(0, wsHist.cursor + 1);
      }
      wsHist.entries.push(entry);
      if (wsHist.entries.length > MAX_HISTORY) {
        wsHist.entries = wsHist.entries.slice(wsHist.entries.length - MAX_HISTORY);
      }
      wsHist.cursor = wsHist.entries.length - 1;

      this.lastSnapshots[canonical] = clone(after);

      await this._saveTimeline();
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
        const snapshot = direction === "undo" ? entry.before : entry.after;
        await adapter.restore(clone(snapshot));
        this.lastSnapshots[canonical] = clone(snapshot);
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

      // STRICT SCOPED UNDO FOR TARGET WORKSPACE
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

      // STRICT SCOPED REDO FOR TARGET WORKSPACE
      const wsHist = this.workspaceHistory[canonical];
      if (!wsHist || wsHist.cursor >= wsHist.entries.length - 1 || !wsHist.entries[wsHist.cursor + 1]) {
        return false;
      }

      const entry = wsHist.entries[wsHist.cursor + 1];
      await this.restoreEntry(entry, "redo");
      wsHist.cursor++;

      await this._saveTimeline();
      this._notify();
      return true;
    }

    canUndo(targetWorkspace) {
      const activeWs = targetWorkspace || (typeof window.getCurrentWorkspace === "function" ? window.getCurrentWorkspace() : "");
      const canonical = canonicalWorkspace(activeWs);
      if (canonical === "trackers") {
        return !!window.CCTV_LIVE_TRACKER?.canUndo?.();
      }
      if (canonical === "history" || !canonical) {
        return this.cursor >= 0;
      }
      const wsHist = this.workspaceHistory[canonical];
      return !!(wsHist && wsHist.cursor >= 0);
    }

    canRedo(targetWorkspace) {
      const activeWs = targetWorkspace || (typeof window.getCurrentWorkspace === "function" ? window.getCurrentWorkspace() : "");
      const canonical = canonicalWorkspace(activeWs);
      if (canonical === "trackers") {
        return false;
      }
      if (canonical === "history" || !canonical) {
        return this.cursor < this.entries.length - 1;
      }
      const wsHist = this.workspaceHistory[canonical];
      return !!(wsHist && wsHist.cursor < wsHist.entries.length - 1);
    }

    async restoreSelectedEntry(id = this.selectedHistoryId) {
      const entry = this.entries.find(item => item.id === id);
      if (!entry) return false;

      const adapter = this._adapters()[entry.workspace];
      if (!adapter?.restore) return false;

      const currentBefore = await this.takeSnapshot(entry.workspace);
      if (currentBefore == null) return false;

      let next = clone(currentBefore);
      let restoredCount = 0;

      const beforeDesc = collectionDescriptor(entry.workspace, entry.before);
      const afterDesc = collectionDescriptor(entry.workspace, entry.after);
      const currentDesc = collectionDescriptor(entry.workspace, currentBefore);

      if (beforeDesc && afterDesc && currentDesc) {
        const merged = mergeDeletedItems(beforeDesc.items, afterDesc.items, currentDesc.items);
        if (merged.changed) {
          if (entry.workspace === "pendingReports" || entry.workspace === "followupReports") {
            next = merged.items;
          } else {
            beforeDesc.apply(next, merged.items);
          }
          restoredCount += merged.count;
        }
      }

      restoredCount += restoreNestedRemovedContent(
        entry.workspace,
        entry.before,
        entry.after,
        next
      );

      if (!restoredCount) {
        next = clone(entry.before);
      }

      this.suppress = true;
      try {
        await adapter.restore(clone(next));
      } finally {
        this.suppress = false;
      }

      this.lastSnapshots[entry.workspace] = clone(currentBefore);
      await this.captureIfChanged(
        entry.workspace,
        restoredCount
          ? `Restored removed item · ${entry.action}`
          : `Restored selected change · ${entry.action}`
      );

      this.selectedHistoryId = null;
      this._notify();
      return true;
    }

    async clearHistory() {
      this.entries = [];
      this.cursor = -1;
      this.workspaceHistory = {};
      this.selectedHistoryId = null;

      try {
        const db = await this._openDb();
        await new Promise((resolve, reject) => {
          const tx = db.transaction(STORE, "readwrite");
          tx.objectStore(STORE).delete(STATE_KEY);
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
      if (!item) return "Unknown item";
      if (workspace === "cctv") {
        return [item.formattedDate || item.rawDate, item.tlName, item.agentName, item.cleanAccount || item.account, item.noc]
          .filter(Boolean).join(" · ");
      }
      if (workspace === "edr") {
        return [item.date, item.site, item.supervisorName, item.subjectName, item.account]
          .filter(Boolean).join(" · ");
      }
      if (workspace === "followupReports" || workspace === "pendingReports") {
        return [item.date, item.om, item.label || item.tl || item.agent, item.status]
          .filter(Boolean).join(" · ");
      }
      if (workspace === "maintenanceReport") {
        return [item.title || item.site || item.id, `${(item.rows || item.data || []).length || 0} rows`, `${(item.screenshots || []).length} screenshots`]
          .filter(Boolean).join(" · ");
      }
      if (workspace === "aiSorter") {
        if (Array.isArray(item)) return item.slice(0, 7).map(historyValue).join(" · ");
        return Object.values(item).slice(0, 7).map(historyValue).join(" · ");
      }
      if (workspace === "masterlist") {
        return [item.site, item.omTeam, item.hr].filter(Boolean).join(" · ");
      }
      return JSON.stringify(item).slice(0, 220);
    }

    historyEntrySummary(entry) {
      if (!entry) return "";
      const beforeDesc = collectionDescriptor(entry.workspace, entry.before);
      const afterDesc = collectionDescriptor(entry.workspace, entry.after);
      if (beforeDesc && afterDesc) {
        const beforeMap = new Map(beforeDesc.items.map(item => [historyItemIdentity(item), item]));
        const afterMap = new Map(afterDesc.items.map(item => [historyItemIdentity(item), item]));
        for (const [id, item] of afterMap) {
          if (!beforeMap.has(id)) return `Added: ${this.historyItemLabel(entry.workspace, item)}`;
          if (stable(beforeMap.get(id)) !== stable(item)) return `Updated: ${this.historyItemLabel(entry.workspace, item)}`;
        }
        for (const [id, item] of beforeMap) {
          if (!afterMap.has(id)) return `Removed: ${this.historyItemLabel(entry.workspace, item)}`;
        }
      }
      if (entry.workspace === "cctv" || entry.workspace === "edr") {
        const a = entry.after?.form || {};
        const label = this.historyItemLabel(entry.workspace, a);
        if (label && label !== "Unknown item") return `Form: ${label}`;
      }
      if (entry.workspace === "masterlist" && (entry.before?.note || "") !== (entry.after?.note || "")) {
        return "Pending tracker notepad changed";
      }
      return "";
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
        setTimeout(() => this.captureIfChanged(ws, action).catch(console.error), 1200);
      }, true);

      // Note: Keydown undo/redo (Ctrl+Z, Ctrl+Y, Ctrl+Shift+Z) is centralized in app.js
      // to eliminate duplicate handlers and enforce strict workspace and text-input scoping.
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
