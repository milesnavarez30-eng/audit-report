/**
 * CCTV OPS V2 - Dashboard Service
 * Authoritative Read-Only Operational Metrics & Analytics Engine
 * Dedicated API Connection for CCTV Audit Tracker
 * Bound directly to Authoritative Spreadsheet: 1dhQKpRxZUFjQc-00a5SQXRRsIOMCjT_d-b-o36bYWzs (GID: 312942343)
 */

window.CCTV_DASHBOARD = (function () {
  "use strict";

  // =========================================================================
  // AUTHORITATIVE DASHBOARD TRACKER API URL CONFIGURATION
  // Spreadsheet: https://docs.google.com/spreadsheets/d/1dhQKpRxZUFjQc-00a5SQXRRsIOMCjT_d-b-o36bYWzs/edit?gid=312942343#gid=312942343
  // Spreadsheet ID: 1dhQKpRxZUFjQc-00a5SQXRRsIOMCjT_d-b-o36bYWzs
  // Dedicated Google Apps Script Web App (READ-ONLY analytics API)
  // =========================================================================
  const DASHBOARD_TRACKER_API_URL = "https://script.google.com/macros/s/AKfycbyzMrhzV1pRrTbJab65icaPP5xX9MPPgA2d1XzlcNHkXsgN7GfYwWbQGBKbd8IFeLU2/exec";

  const STORAGE_KEY = "cctv_ops_v2_dashboard_cache_v3";
  const AUTO_REFRESH_INTERVAL_MS = 60000; // 60 seconds

  const MONTH_NAMES_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const MONTH_NAMES_FULL = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  // Established canonical CCTV Team members
  const CANONICAL_TEAM_MEMBERS = ["Seth", "John Ric", "Wendie", "Miles", "Kenneth", "Reymart"];

  let state = {
    hasLoadedAuthoritativeData: false,
    overallReports: null,
    postedThisMonth: null,
    pendingReports: null,
    pendingPercentage: null,
    followupCount: 0,
    edrUncopiedCount: 0,
    teamStats: [],
    pendingByTeam: [],
    pendingDetails: [],
    memberNocGraphs: [],
    totalNocThisMonth: null,
    currentMonthLabel: "",
    currentYear: new Date().getFullYear(),
    lastUpdated: null,
    lastUpdatedFormatted: "Unavailable",
    isFetching: false,
    fetchError: null,
    isStale: false
  };

  let listeners = [];
  let autoRefreshTimer = null;
  let activeFetchPromise = null;

  function cleanVal(v) {
    return String(v == null ? "" : v).trim();
  }

  function parseNum(v, fallback = null) {
    if (typeof v === "number" && !isNaN(v)) return v;
    if (v == null || v === "") return fallback;
    const clean = cleanVal(v).replace(/[^0-9.-]+/g, "");
    const parsed = parseFloat(clean);
    return isNaN(parsed) ? fallback : parsed;
  }

  function formatTime(date) {
    if (!date) return "Unavailable";
    const d = (date instanceof Date) ? date : new Date(date);
    if (isNaN(d.getTime())) return "Unavailable";
    return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit", hour12: true });
  }

  function getCurrentMonthInfo() {
    const now = new Date();
    const monthIdx = now.getMonth();
    const year = now.getFullYear();
    return {
      monthIdx,
      monthShort: MONTH_NAMES_SHORT[monthIdx],
      monthFull: MONTH_NAMES_FULL[monthIdx],
      year,
      label: `${MONTH_NAMES_FULL[monthIdx]} ${year}`
    };
  }

  function normalizeMemberName(raw) {
    if (!raw) return "Unknown";
    if (typeof window.normalizeAuditorName === "function") {
      const n = window.normalizeAuditorName(raw);
      if (n && (n !== "Miles" || String(raw).toLowerCase().includes("miles"))) {
        return n;
      }
    }
    const t = String(raw).trim().toLowerCase();
    if (t.includes("seth")) return "Seth";
    if (t.includes("john ric") || t === "jr" || t.includes("john")) return "John Ric";
    if (t.includes("wendie") || t.includes("amor")) return "Wendie";
    if (t.includes("miles") || t.includes("mico")) return "Miles";
    if (t.includes("kenneth")) return "Kenneth";
    if (t.includes("reymart") || t.includes("rey mart")) return "Reymart";
    return cleanVal(raw);
  }

  let apiUrlOverride = null;

  /**
   * Resolve authoritative Dashboard Tracker API URL.
   */
  function getDashboardTrackerApiUrl() {
    return apiUrlOverride || DASHBOARD_TRACKER_API_URL;
  }

  /**
   * Load previous valid state from localStorage cache
   * Preserves previous valid data while marking as stale if offline
   */
  function loadLocalCache() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const cached = JSON.parse(raw);
        if (cached && typeof cached === "object" && cached.hasLoadedAuthoritativeData) {
          Object.assign(state, cached);
          state.isStale = true;
          state.isFetching = false;
          return;
        }
      }
    } catch (e) {
      console.warn("Failed to load Dashboard cache:", e);
    }

    // When no previous valid cache exists, ensure state has NO fake data.
    // UI displays "-- / Unavailable", never fake zeroes or fabricated baselines.
    const monthInfo = getCurrentMonthInfo();
    state.hasLoadedAuthoritativeData = false;
    state.overallReports = null;
    state.postedThisMonth = null;
    state.pendingReports = null;
    state.pendingPercentage = null;
    state.totalNocThisMonth = null;
    state.teamStats = [];
    state.pendingByTeam = [];
    state.memberNocGraphs = [];
    state.pendingDetails = [];
    state.currentMonthLabel = monthInfo.label;
    state.currentYear = monthInfo.year;
    state.lastUpdated = null;
    state.lastUpdatedFormatted = "Unavailable";
  }

  /**
   * Save authoritative state to localStorage cache
   */
  function saveLocalCache() {
    try {
      if (!state.hasLoadedAuthoritativeData) return;
      const serializable = {
        hasLoadedAuthoritativeData: state.hasLoadedAuthoritativeData,
        overallReports: state.overallReports,
        postedThisMonth: state.postedThisMonth,
        pendingReports: state.pendingReports,
        pendingPercentage: state.pendingPercentage,
        teamStats: state.teamStats,
        pendingByTeam: state.pendingByTeam,
        pendingDetails: state.pendingDetails,
        memberNocGraphs: state.memberNocGraphs,
        totalNocThisMonth: state.totalNocThisMonth,
        currentMonthLabel: state.currentMonthLabel,
        currentYear: state.currentYear,
        lastUpdated: state.lastUpdated,
        lastUpdatedFormatted: state.lastUpdatedFormatted
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(serializable));
    } catch (e) {
      console.warn("Failed to save Dashboard cache:", e);
    }
  }

  function emitChange() {
    listeners.forEach(fn => {
      try { fn({ ...state }); } catch (err) { console.error("Dashboard listener error:", err); }
    });
  }

  /**
   * Generic schema validation for Authoritative Tracker API response
   * Validates response integrity without imposing artificial bounds:
   * - response.ok must be true
   * - overallReports must be a valid non-negative number
   * - postedThisMonth must be a valid non-negative number
   * - pendingReports must be a valid non-negative number
   * - pendingPercent must be valid
   * - teams must be an array
   * - each team's successfulNocByMonth must contain 12 values
   */
  function isValidTrackerPayload(json) {
    if (!json || typeof json !== "object") return false;
    if (json.ok !== true && json.success !== true) return false;

    const data = (json.data && typeof json.data === "object" && !Array.isArray(json.data)) ? json.data : json;

    const overallReports = parseNum(data.overallReports, null);
    if (overallReports === null || overallReports < 0) return false;

    const postedThisMonth = parseNum(data.postedThisMonth, null);
    if (postedThisMonth === null || postedThisMonth < 0) return false;

    const pendingReports = parseNum(data.pendingReports, null);
    if (pendingReports === null || pendingReports < 0) return false;

    if (data.pendingPercent == null && data.pendingPercentage == null) return false;

    const teams = Array.isArray(data.teams)
      ? data.teams
      : (Array.isArray(data.teamMembers) ? data.teamMembers : null);
    if (!teams || teams.length === 0) return false;

    for (let i = 0; i < teams.length; i++) {
      const tm = teams[i];
      if (!tm || !Array.isArray(tm.successfulNocByMonth) || tm.successfulNocByMonth.length !== 12) {
        return false;
      }
    }

    return true;
  }

  /**
   * Parse Authoritative Tracker response into Dashboard state
   * Directly supports the dedicated Google Apps Script Web App schema:
   * - ok
   * - generatedAt
   * - period: { year, monthNumber, monthShort, monthName }
   * - overallReports
   * - postedThisMonth
   * - pendingReports
   * - pendingPercent
   * - successfulNocThisMonth
   * - teams[]: [ { name, reportsThisMonth, yesThisMonth, noThisMonth, disputedThisMonth, pending, pendingPercent, successfulNocThisMonth, successfulNocThisYear, successfulNocByMonth[12] } ]
   */
  function parseTrackerResponse(json) {
    if (!json || typeof json !== "object") return;

    const data = (json.data && typeof json.data === "object" && !Array.isArray(json.data)) ? json.data : json;
    const monthInfo = getCurrentMonthInfo();

    // 1. Resolve Year & Month (from period object or direct properties)
    let yearVal = monthInfo.year;
    let monthLabel = monthInfo.monthFull;
    let currentMonthIdx = monthInfo.monthIdx;

    if (data.period && typeof data.period === "object") {
      if (data.period.year) yearVal = parseNum(data.period.year, monthInfo.year);
      if (data.period.monthName) monthLabel = data.period.monthName;
      if (data.period.monthNumber != null) currentMonthIdx = Math.max(0, Math.min(11, parseNum(data.period.monthNumber, 9) - 1));
    } else {
      if (data.year) yearVal = parseNum(data.year, monthInfo.year);
      if (data.month) {
        monthLabel = typeof data.month === "number" && data.month >= 1 && data.month <= 12
          ? MONTH_NAMES_FULL[data.month - 1]
          : data.month;
      }
      if (typeof monthLabel === "string") {
        const mLower = monthLabel.trim().toLowerCase();
        const fIdx = MONTH_NAMES_FULL.findIndex(m => m.toLowerCase() === mLower);
        if (fIdx !== -1) currentMonthIdx = fIdx;
        else {
          const sIdx = MONTH_NAMES_SHORT.findIndex(m => m.toLowerCase() === mLower);
          if (sIdx !== -1) currentMonthIdx = sIdx;
        }
      }
    }

    state.currentYear = yearVal;
    state.currentMonthLabel = `${monthLabel} ${yearVal}`;

    // 2. Authoritative Top-Level Metrics (Direct from API)
    state.overallReports = parseNum(data.overallReports, null);
    state.postedThisMonth = parseNum(data.postedThisMonth, null);
    state.pendingReports = parseNum(data.pendingReports, null);

    const rawPct = data.pendingPercent != null ? data.pendingPercent : data.pendingPercentage;
    if (typeof rawPct === "number") {
      state.pendingPercentage = `${rawPct}%`;
    } else if (rawPct) {
      const cleaned = cleanVal(rawPct);
      state.pendingPercentage = cleaned ? (cleaned.endsWith("%") ? cleaned : `${cleaned}%`) : null;
    } else {
      state.pendingPercentage = null;
    }

    const nocThisMonthVal = data.successfulNocThisMonth != null ? data.successfulNocThisMonth : data.totalNocThisMonth;
    state.totalNocThisMonth = parseNum(nocThisMonthVal, null);

    // 3. Teams Breakdown (Direct from API)
    const rawMembers = Array.isArray(data.teams)
      ? data.teams
      : (Array.isArray(data.teamMembers) ? data.teamMembers : []);

    const teamStatsList = [];
    const memberNocGraphsList = [];

    rawMembers.forEach(m => {
      if (!m) return;
      const normName = normalizeMemberName(m.name || m.Name);
      const reports = parseNum(m.reportsThisMonth != null ? m.reportsThisMonth : m.reports, 0);
      const yes = parseNum(m.yesThisMonth != null ? m.yesThisMonth : m.yes, 0);
      const no = parseNum(m.noThisMonth != null ? m.noThisMonth : m.no, 0);
      const pending = parseNum(m.pending, 0);

      let pendingPct = "0.00%";
      if (m.pendingPercent != null || m.pendingPct != null) {
        const pVal = m.pendingPercent != null ? m.pendingPercent : m.pendingPct;
        if (typeof pVal === "number") {
          pendingPct = `${pVal}%`;
        } else {
          const rawP = cleanVal(pVal);
          pendingPct = rawP ? (rawP.endsWith("%") ? rawP : `${rawP}%`) : "0.00%";
        }
      } else if (reports > 0) {
        pendingPct = `${((pending / reports) * 100).toFixed(2)}%`;
      }

      // CCTV Team Current Month Table entry
      teamStatsList.push({
        name: normName,
        reports,
        yes,
        no,
        pending,
        pendingPct
      });

      // Successful NOC per Month (Jan - Dec)
      // successfulNocByMonth[0] = Jan, [1] = Feb, ..., [11] = Dec
      const nocByMonth = Array.isArray(m.successfulNocByMonth) ? m.successfulNocByMonth : [];
      const monthlyData = [];

      for (let i = 0; i < 12; i++) {
        const count = (nocByMonth[i] != null) ? parseNum(nocByMonth[i], 0) : 0;
        monthlyData.push({
          month: MONTH_NAMES_SHORT[i],
          fullName: MONTH_NAMES_FULL[i],
          count,
          isCurrent: i === currentMonthIdx
        });
      }

      const totalThisYear = m.successfulNocThisYear != null
        ? parseNum(m.successfulNocThisYear, 0)
        : (nocByMonth.reduce((acc, curr) => acc + (Number(curr) || 0), 0) || yes);

      const thisMonth = m.successfulNocThisMonth != null
        ? parseNum(m.successfulNocThisMonth, 0)
        : (monthlyData[currentMonthIdx] ? monthlyData[currentMonthIdx].count : 0);

      memberNocGraphsList.push({
        name: normName,
        totalThisYear,
        thisMonth,
        monthlyData
      });
    });

    // Sort Team table by reports descending (High -> Low)
    teamStatsList.sort((a, b) => b.reports - a.reports);
    state.teamStats = teamStatsList;

    // 4. Pending by CCTV Team: use API pendingByTeam if provided, or derive from teams sorted by pending descending
    if (Array.isArray(data.pendingByTeam) && data.pendingByTeam.length > 0) {
      state.pendingByTeam = data.pendingByTeam.map(item => ({
        name: normalizeMemberName(item.name),
        pending: parseNum(item.pending, 0),
        trackerPct: typeof item.pendingPercent === "number" ? `${item.pendingPercent}%` : (cleanVal(item.pendingPercent) || "0.00%"),
        sharePct: typeof item.pendingShare === "number" ? `${item.pendingShare}%` : (cleanVal(item.pendingShare) || "0.00%")
      }));
    } else {
      const totalPending = (state.pendingReports != null && state.pendingReports > 0) ? state.pendingReports : 1;
      const derivedPendingList = teamStatsList.map(t => ({
        name: t.name,
        pending: t.pending,
        reports: t.reports,
        trackerPct: t.pendingPct,
        sharePct: `${((t.pending / totalPending) * 100).toFixed(2)}%`
      }));
      derivedPendingList.sort((a, b) => {
        if (b.pending !== a.pending) return b.pending - a.pending;
        return b.reports - a.reports;
      });
      state.pendingByTeam = derivedPendingList;
    }

    // Sort member NOC graphs in canonical member order
    memberNocGraphsList.sort((a, b) => {
      const idxA = CANONICAL_TEAM_MEMBERS.indexOf(a.name);
      const idxB = CANONICAL_TEAM_MEMBERS.indexOf(b.name);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      return a.name.localeCompare(b.name);
    });
    state.memberNocGraphs = memberNocGraphsList;

    // 5. Pending Details (if provided by API)
    if (Array.isArray(data.pendingDetails) && data.pendingDetails.length > 0) {
      state.pendingDetails = data.pendingDetails.map(item => ({
        date: cleanVal(item.date || item.Date),
        team: normalizeMemberName(item.team || item.name || item.Name),
        site: cleanVal(item.site || item.SITE),
        status: cleanVal(item.status || item.noc || item.NOC) || "Pending",
        pendingReason: cleanVal(item.pendingReason || item.reason || "N/A"),
        remarks: cleanVal(item.remarks || item.Remarks),
        source: "Tracker"
      }));
    } else {
      state.pendingDetails = [];
    }

    state.hasLoadedAuthoritativeData = true;
    state.isStale = false;
    state.fetchError = null;

    saveLocalCache();
  }

  /**
   * Synchronize active counts from local Follow Up & EDR workspaces
   * Preserved completely separate from Tracker API status
   */
  async function syncLocalWorkspaces() {
    // 1. Follow Up Workspace Count (Live local IndexedDB/Storage)
    try {
      const fuService = window.CCTV_FOLLOWUP || window.followupService;
      if (fuService && typeof fuService.loadReports === "function") {
        const fuReports = await fuService.loadReports();
        state.followupCount = Array.isArray(fuReports) ? fuReports.length : 0;
      }
    } catch (e) {
      console.warn("Could not sync Follow Up count for Dashboard:", e);
    }

    // 2. EDR Not Copied to Teams Count (Live local IndexedDB/Storage)
    try {
      const edrService = window.CCTV_EDR || window.edrService;
      if (edrService) {
        if (typeof edrService.getUncopiedTeamsCount === "function") {
          state.edrUncopiedCount = edrService.getUncopiedTeamsCount();
        } else {
          let edrList = [];
          if (typeof edrService.loadReports === "function") {
            edrList = await edrService.loadReports();
          } else if (typeof edrService.getReports === "function") {
            edrList = edrService.getReports();
          }
          if (Array.isArray(edrList)) {
            state.edrUncopiedCount = edrList.filter(r => !r.teamsCopied && !r.done).length;
          }
        }
      }
    } catch (e) {
      console.warn("Could not sync EDR uncopied count for Dashboard:", e);
    }

    emitChange();
  }

  /**
   * Fetch authoritative data from the dedicated Google Apps Script Web App
   * Uses single in-flight Promise deduplication & 45s timeout
   */
  function fetchTrackerData(force = false) {
    if (activeFetchPromise) {
      return activeFetchPromise;
    }

    state.isFetching = true;
    emitChange();

    activeFetchPromise = (async () => {
      const apiUrl = getDashboardTrackerApiUrl();
      const monthInfo = getCurrentMonthInfo();
      state.currentMonthLabel = monthInfo.label;
      state.currentYear = monthInfo.year;

      if (!apiUrl || typeof apiUrl !== "string" || !apiUrl.trim()) {
        state.isFetching = false;
        state.fetchError = "Tracker API URL not configured (awaiting dedicated Web App deployment)";
        state.isStale = true;
        if (!state.hasLoadedAuthoritativeData) {
          loadLocalCache();
        }
        await syncLocalWorkspaces();
        emitChange();
        return state;
      }

      // 45-second timeout for Google Apps Script execution
      const controller = new AbortController();
      let timedOut = false;
      const timeoutId = setTimeout(() => {
        timedOut = true;
        try { controller.abort(); } catch (_) {}
      }, 45000);

      try {
        const resp = await fetch(apiUrl.trim(), {
          method: "GET",
          mode: "cors",
          credentials: "omit",
          signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (!resp.ok) {
          throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);
        }

        const json = await resp.json();
        if (isValidTrackerPayload(json)) {
          parseTrackerResponse(json);
          state.hasLoadedAuthoritativeData = true;
          state.lastUpdated = json.generatedAt || new Date().toISOString();
          state.lastUpdatedFormatted = formatTime(state.lastUpdated);
          state.isStale = false;
          state.fetchError = null;
          saveLocalCache();
        } else {
          throw new Error((json && json.error) || "Tracker API returned invalid or malformed data");
        }
      } catch (err) {
        clearTimeout(timeoutId);
        console.warn("Dashboard fetchTrackerData error:", err);
        const errMsg = timedOut || (err && err.name === "AbortError")
          ? "Connection timed out after 45 seconds"
          : (err.message || "Failed to connect to Tracker API");
        state.fetchError = errMsg;
        state.isStale = true;
        // Preserve previous valid metrics if cached
        if (!state.hasLoadedAuthoritativeData) {
          loadLocalCache();
        }
      } finally {
        clearTimeout(timeoutId);
        state.isFetching = false;
        activeFetchPromise = null;
        await syncLocalWorkspaces();
        emitChange();
      }

      return state;
    })();

    return activeFetchPromise;
  }

  function startAutoRefresh(intervalMs = AUTO_REFRESH_INTERVAL_MS) {
    if (autoRefreshTimer) clearInterval(autoRefreshTimer);
    autoRefreshTimer = setInterval(() => {
      if (!activeFetchPromise && typeof document !== "undefined" && !document.hidden) {
        fetchTrackerData().catch(console.warn);
      }
    }, intervalMs);
  }

  function stopAutoRefresh() {
    if (autoRefreshTimer) {
      clearInterval(autoRefreshTimer);
      autoRefreshTimer = null;
    }
  }

  function init() {
    loadLocalCache();
    const monthInfo = getCurrentMonthInfo();
    state.currentMonthLabel = monthInfo.label;
    state.currentYear = monthInfo.year;

    // Immediately synchronize local workspaces (Follow Up & EDR)
    syncLocalWorkspaces().catch(console.warn);

    // Hook Follow Up change listener for real-time reactivity
    const fuService = window.CCTV_FOLLOWUP || window.followupService;
    if (fuService && typeof fuService.onChange === "function") {
      fuService.onChange(reports => {
        state.followupCount = Array.isArray(reports) ? reports.length : 0;
        emitChange();
      });
    }

    // Hook EDR change listeners for real-time reactivity
    const edrService = window.CCTV_EDR || window.edrService;
    if (edrService) {
      const handleEdrReports = (reports) => {
        if (typeof edrService.getUncopiedTeamsCount === "function") {
          state.edrUncopiedCount = edrService.getUncopiedTeamsCount();
        } else if (Array.isArray(reports)) {
          state.edrUncopiedCount = reports.filter(r => !r.teamsCopied && !r.done).length;
        }
        emitChange();
      };
      if (typeof edrService.onChange === "function") edrService.onChange(handleEdrReports);
      if (typeof edrService.subscribe === "function") edrService.subscribe(handleEdrReports);
    }

    // Initial fetch from authoritative Google Sheets endpoint
    fetchTrackerData().catch(console.warn);
    startAutoRefresh();

    return state;
  }

  return {
    init,
    fetchTrackerData,
    refresh: () => (activeFetchPromise ? activeFetchPromise : fetchTrackerData(true)),
    syncLocalWorkspaces,
    startAutoRefresh,
    stopAutoRefresh,
    getState: () => ({ ...state }),
    getApiUrl: () => getDashboardTrackerApiUrl(),
    setApiUrl: (url) => {
      apiUrlOverride = (typeof url === "string" && url.trim()) ? url.trim() : null;
    },
    parseTrackerResponse,
    subscribe(fn) {
      if (typeof fn === "function") {
        listeners.push(fn);
        fn({ ...state });
      }
      return () => {
        listeners = listeners.filter(l => l !== fn);
      };
    }
  };
})();
