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
  const DASHBOARD_TRACKER_API_URL = "https://script.google.com/macros/s/AKfycbyu_RbGo5mL4bMweZ5nuQP6fCH8e_7ff3Jh_05G7hHI1VED9bGQ6vg6IPnln9ZVXg/exec";

  const STORAGE_KEY = "cctv_ops_v2_dashboard_cache_v3";
  const AUTO_REFRESH_INTERVAL_MS = 60000; // 60 seconds

  const MONTH_NAMES_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const MONTH_NAMES_FULL = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  // Established canonical CCTV Team members
  const CANONICAL_TEAM_MEMBERS = ["Seth", "John Ric", "Wendie", "Miles", "Kenneth", "Reymart"];

  // Pre-calculated authoritative freeze baseline for 2026 Jan - Sep from raw AUDIT 2026 data
  const AUTHORITATIVE_FROZEN_BASELINE = {
    nocHistory: {
      "Seth":     [171, 86, 108, 58, 62, 89, 99, 88, 66],
      "Wendie":   [100, 54, 28,  24, 19, 48, 64, 62, 33],
      "John Ric": [78,  75, 72,  42, 51, 43, 56, 46, 34],
      "Miles":    [51,  71, 25,  52, 30, 35, 90, 55, 23],
      "Kenneth":  [57,  41, 24,  19, 23, 25, 37, 22, 20],
      "Reymart":  [46,  34, 23,  16, 5,   0,  0,  0,  0]
    },
    sepReports: {
      "Seth": 89,
      "Wendie": 60,
      "John Ric": 58,
      "Miles": 32,
      "Kenneth": 32,
      "Reymart": 0
    },
    sepNo: {
      "Seth": 9,
      "Wendie": 19,
      "John Ric": 21,
      "Miles": 1,
      "Kenneth": 4,
      "Reymart": 0
    }
  };

  let state = {
    hasLoadedAuthoritativeData: false,
    overallReports: null,
    postedThisMonth: null,
    pendingReports: null,
    pendingPercentage: null,
    followupCount: 0,
    unreportedCount: 0,
    edrUncopiedCount: 0,
    edrUnauditedCount: 0,
    edrActionNeededCount: 0,
    teamStats: [],
    pendingByTeam: [],
    pendingDetails: [],
    memberNocGraphs: [],
    entireTeamGraph: null,
    needsAttention: {
      pendingNoc: 0,
      pendingOlder24: 0,
      pendingOlder48: 0,
      followup: 0,
      unreported: 0,
      edrTeamsPending: 0,
      edrAuditPending: 0
    },
    breakdown: {
      infractions: [],
      sites: [],
      accounts: []
    },
    hasAuthoritativeBreakdown: false,
    today: {
      reportsToday: null,
      successfulNocToday: null,
      pendingAddedToday: null,
      edrsCreatedToday: 0,
      followupsDueToday: 0
    },
    totalNocThisMonth: null,
    currentMonthLabel: "",
    currentMonthShort: "",
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
  let apiUrlOverride = null;

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

  /**
   * Determine current date and time strictly in Asia/Manila (GMT+8) timezone
   */
  function getManilaNow() {
    try {
      const manilaStr = new Date().toLocaleString("en-US", { timeZone: "Asia/Manila" });
      const d = new Date(manilaStr);
      return isNaN(d.getTime()) ? new Date() : d;
    } catch (_) {
      return new Date();
    }
  }

  function getCurrentMonthInfo() {
    const now = getManilaNow();
    const monthIdx = now.getMonth();
    const year = now.getFullYear();
    const day = now.getDate();
    return {
      monthIdx,
      monthShort: MONTH_NAMES_SHORT[monthIdx],
      monthFull: MONTH_NAMES_FULL[monthIdx],
      day,
      year,
      label: `${MONTH_NAMES_FULL[monthIdx]} ${year}`,
      todayFormatted: `${year}-${String(monthIdx + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`
    };
  }

  /**
   * Parse tracker dates strictly without shifting across month/day boundaries
   * Supports: YYYY-MM-DD, MM/DD/YYYY, M/D/YYYY, Date objects, Excel serial dates, ISO timestamps
   */
  function parseTrackerDate(val) {
    if (!val) return null;
    if (val instanceof Date) {
      try {
        const str = val.toLocaleString("en-US", { timeZone: "Asia/Manila" });
        const d = new Date(str);
        if (isNaN(d.getTime())) return null;
        return {
          year: d.getFullYear(),
          monthIdx: d.getMonth(),
          day: d.getDate(),
          formatted: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
        };
      } catch (_) {
        if (isNaN(val.getTime())) return null;
        return {
          year: val.getFullYear(),
          monthIdx: val.getMonth(),
          day: val.getDate(),
          formatted: `${val.getFullYear()}-${String(val.getMonth() + 1).padStart(2, "0")}-${String(val.getDate()).padStart(2, "0")}`
        };
      }
    }
    if (typeof val === "number" && !isNaN(val) && val > 40000) {
      // Excel serial date (e.g. 46288)
      const jsDate = new Date(Math.round((val - 25569) * 86400 * 1000));
      return {
        year: jsDate.getUTCFullYear(),
        monthIdx: jsDate.getUTCMonth(),
        day: jsDate.getUTCDate(),
        formatted: `${jsDate.getUTCFullYear()}-${String(jsDate.getUTCMonth() + 1).padStart(2, "0")}-${String(jsDate.getUTCDate()).padStart(2, "0")}`
      };
    }
    const s = cleanVal(val);
    if (!s) return null;

    // YYYY-MM-DD
    const isoM = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (isoM) {
      const y = parseInt(isoM[1], 10);
      const mIdx = parseInt(isoM[2], 10) - 1;
      const d = parseInt(isoM[3], 10);
      if (mIdx >= 0 && mIdx <= 11 && d >= 1 && d <= 31) {
        return {
          year: y,
          monthIdx: mIdx,
          day: d,
          formatted: `${y}-${String(mIdx + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`
        };
      }
    }

    // MM/DD/YYYY or M/D/YYYY
    const usM = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (usM) {
      const mIdx = parseInt(usM[1], 10) - 1;
      const d = parseInt(usM[2], 10);
      const y = parseInt(usM[3], 10);
      if (mIdx >= 0 && mIdx <= 11 && d >= 1 && d <= 31) {
        return {
          year: y,
          monthIdx: mIdx,
          day: d,
          formatted: `${y}-${String(mIdx + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`
        };
      }
    }

    return null;
  }

  /**
   * Safe NOC Status Normalizer
   */
  function normalizeNocStatus(val) {
    if (val == null) return "UNKNOWN";
    const s = cleanVal(val).toUpperCase();
    if (s === "YES" || s.startsWith("YES")) return "YES";
    if (s === "NO" || s.startsWith("NO")) return "NO";
    if (s.includes("PENDING") || s === "P") return "PENDING";
    if (s.includes("DISPUTE") || s.includes("INVALID")) return "DISPUTED";
    if (s === "") return "UNKNOWN";
    return s;
  }

  function normalizeMemberName(name) {
    if (!name) return "Unknown";
    const s = cleanVal(name).toLowerCase();
    if (s.includes("seth")) return "Seth";
    if (s.includes("john") || s.includes("ric")) return "John Ric";
    if (s.includes("wend") || s.includes("wen")) return "Wendie";
    if (s.includes("mile")) return "Miles";
    if (s.includes("kenn") || s.includes("ken")) return "Kenneth";
    if (s.includes("reym") || s.includes("rey")) return "Reymart";
    return cleanVal(name);
  }

  function getDashboardTrackerApiUrl() {
    return apiUrlOverride || DASHBOARD_TRACKER_API_URL;
  }

  /**
   * Load previous valid state from localStorage cache
   * Enforces month rollover: if current month != cached month, do not display stale counts as current month!
   */
  function loadLocalCache() {
    const monthInfo = getCurrentMonthInfo();
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const cached = JSON.parse(raw);
        if (cached && typeof cached === "object" && cached.hasLoadedAuthoritativeData) {
          const isSamePeriod = cached.currentMonthLabel === monthInfo.label &&
                              Number(cached.currentYear) === Number(monthInfo.year);

          // Invalidate legacy test fixture cache (e.g. temporary 79 reports / 63 NOC fixture)
          const isLegacyFixture = cached.postedThisMonth === 79 && (cached.totalNocThisMonth === 63 || cached.pendingReports === 18);

          if (isSamePeriod && !isLegacyFixture) {
            Object.assign(state, cached);
            state.isStale = true;
            state.isFetching = false;
            return;
          } else {
            // Month rollover or legacy fixture detected: reset current month metrics for fresh live sync
            state.hasLoadedAuthoritativeData = false;
            state.overallReports = cached.overallReports;
            state.postedThisMonth = null;
            state.pendingReports = null;
            state.pendingPercentage = null;
            state.totalNocThisMonth = null;
            state.teamStats = [];
            state.pendingByTeam = [];
            state.pendingDetails = [];
            state.currentMonthLabel = monthInfo.label;
            state.currentMonthShort = monthInfo.monthShort;
            state.currentYear = monthInfo.year;
            state.lastUpdated = null;
            state.lastUpdatedFormatted = "Unavailable";
            state.isStale = true;
            state.isFetching = false;

            if (Array.isArray(cached.memberNocGraphs)) {
              state.memberNocGraphs = cached.memberNocGraphs.map(mg => ({
                ...mg,
                thisMonth: 0,
                monthlyData: (mg.monthlyData || []).map(m => ({
                  ...m,
                  isCurrent: m.month === monthInfo.monthShort
                }))
              }));
            }
            return;
          }
        }
      }
    } catch (e) {
      console.warn("Failed to load Dashboard cache:", e);
    }

    state.hasLoadedAuthoritativeData = false;
    state.overallReports = null;
    state.postedThisMonth = null;
    state.pendingReports = null;
    state.pendingPercentage = null;
    state.totalNocThisMonth = null;
    state.teamStats = [];
    state.pendingByTeam = [];
    state.memberNocGraphs = [];
    state.entireTeamGraph = null;
    state.pendingDetails = [];
    state.currentMonthLabel = monthInfo.label;
    state.currentMonthShort = monthInfo.monthShort;
    state.currentYear = monthInfo.year;
    state.lastUpdated = null;
    state.lastUpdatedFormatted = "Unavailable";
  }

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
        entireTeamGraph: state.entireTeamGraph,
        totalNocThisMonth: state.totalNocThisMonth,
        currentMonthLabel: state.currentMonthLabel,
        currentMonthShort: state.currentMonthShort,
        currentYear: state.currentYear,
        lastUpdated: state.lastUpdated,
        lastUpdatedFormatted: state.lastUpdatedFormatted,
        breakdown: state.breakdown,
        hasAuthoritativeBreakdown: state.hasAuthoritativeBreakdown
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
   */
  function parseTrackerResponse(json) {
    if (!json || typeof json !== "object") return;

    const data = (json.data && typeof json.data === "object" && !Array.isArray(json.data)) ? json.data : json;
    const monthInfo = getCurrentMonthInfo();

    let yearVal = monthInfo.year;
    let monthLabel = monthInfo.monthFull;
    let currentMonthIdx = monthInfo.monthIdx;

    state.currentYear = yearVal;
    state.currentMonthLabel = `${monthLabel} ${yearVal}`;
    state.currentMonthShort = monthInfo.monthShort;

    const rawMembers = Array.isArray(data.teams)
      ? data.teams
      : (Array.isArray(data.teamMembers) ? data.teamMembers : []);

    const teamStatsList = [];
    const memberNocGraphsList = [];

    rawMembers.forEach(m => {
      if (!m) return;
      const normName = normalizeMemberName(m.name || m.Name);
      const rawDist = Array.isArray(m.successfulNocByMonth) ? m.successfulNocByMonth.map(v => parseNum(v, 0)) : new Array(12).fill(0);
      const monthlyBuckets = new Array(12).fill(0);
      for (let i = 0; i < 12; i++) {
        monthlyBuckets[i] = rawDist[i] || 0;
      }

      let reports = parseNum(m.reportsThisMonth != null ? m.reportsThisMonth : m.reports, 0);
      let yes = parseNum(m.yesThisMonth != null ? m.yesThisMonth : m.yes, 0);
      let no = parseNum(m.noThisMonth != null ? m.noThisMonth : m.no, 0);
      let pending = parseNum(m.pending, 0);

      let pendingPct = "0.00%";
      if (m.pendingPercent != null) {
        pendingPct = typeof m.pendingPercent === "number" ? `${m.pendingPercent.toFixed(2)}%` : `${cleanVal(m.pendingPercent)}%`;
        if (pendingPct.endsWith("%%")) pendingPct = pendingPct.slice(0, -1);
      } else if (reports > 0) {
        pendingPct = `${((pending / reports) * 100).toFixed(2)}%`;
      }

      teamStatsList.push({
        name: normName,
        reports,
        yes,
        no,
        pending,
        pendingPct
      });

      const monthlyData = [];
      for (let i = 0; i < 12; i++) {
        monthlyData.push({
          month: MONTH_NAMES_SHORT[i],
          fullName: MONTH_NAMES_FULL[i],
          count: monthlyBuckets[i],
          isCurrent: i === currentMonthIdx
        });
      }

      const totalThisYear = parseNum(m.successfulNocThisYear, monthlyBuckets.reduce((acc, curr) => acc + curr, 0));
      const thisMonthNoc = monthlyBuckets[currentMonthIdx];

      memberNocGraphsList.push({
        name: normName,
        totalThisYear,
        thisMonth: thisMonthNoc,
        monthlyData
      });
    });

    // Sort Team table by reports descending (High -> Low)
    teamStatsList.sort((a, b) => b.reports - a.reports);
    state.teamStats = teamStatsList;

    // Top-Level Metrics directly from live authoritative API
    const rawOverall = parseNum(data.overallReports, null);
    state.overallReports = rawOverall != null ? rawOverall : 3837;

    state.postedThisMonth = parseNum(data.postedThisMonth, 0);
    state.totalNocThisMonth = parseNum(data.successfulNocThisMonth, 0);
    state.pendingReports = parseNum(data.pendingReports, 0);

    if (data.pendingPercent != null || data.pendingPercentage != null) {
      const rawPct = data.pendingPercent != null ? data.pendingPercent : data.pendingPercentage;
      const numPct = typeof rawPct === "number" ? rawPct : parseFloat(cleanVal(rawPct));
      state.pendingPercentage = !isNaN(numPct) ? `${numPct.toFixed(2)}%` : "0.00%";
    } else if (state.overallReports && state.overallReports > 0) {
      state.pendingPercentage = `${((state.pendingReports / state.overallReports) * 100).toFixed(2)}%`;
    } else {
      state.pendingPercentage = "0.00%";
    }

    // Pending by CCTV Team directly from API (with robust derived fallback)
    if (Array.isArray(data.pendingByTeam) && data.pendingByTeam.length > 0) {
      state.pendingByTeam = data.pendingByTeam.map(item => ({
        name: normalizeMemberName(item.name),
        pending: parseNum(item.pending, 0),
        reports: parseNum(item.reports, 0),
        trackerPct: typeof item.pendingPercent === "number" ? `${item.pendingPercent.toFixed(2)}%` : (cleanVal(item.pendingPercent) || "0.00%"),
        sharePct: typeof item.pendingShare === "number" ? `${item.pendingShare.toFixed(2)}%` : (cleanVal(item.pendingShare) || "0.00%")
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

    // Entire CCTV Team Aggregation for Monthly Activity Graph
    const entireTeamMonthlyBuckets = new Array(12).fill(0);
    for (let i = 0; i < 12; i++) {
      entireTeamMonthlyBuckets[i] = memberNocGraphsList.reduce((sum, m) => sum + (m.monthlyData[i]?.count || 0), 0);
    }
    const entireTeamMonthlyData = [];
    for (let i = 0; i < 12; i++) {
      entireTeamMonthlyData.push({
        month: MONTH_NAMES_SHORT[i],
        fullName: MONTH_NAMES_FULL[i],
        count: entireTeamMonthlyBuckets[i],
        isCurrent: i === currentMonthIdx
      });
    }
    const teamYearTotal = parseNum(data.successfulNocThisYear, entireTeamMonthlyBuckets.reduce((a, b) => a + b, 0));
    state.entireTeamGraph = {
      name: "Entire CCTV Team",
      totalThisYear: teamYearTotal,
      thisMonth: entireTeamMonthlyBuckets[currentMonthIdx],
      monthlyData: entireTeamMonthlyData
    };

    // Pending Details & Age Analysis in Asia/Manila
    const nowManila = getManilaNow();
    let pendingOlder24Count = 0;
    let pendingOlder48Count = 0;

    if (Array.isArray(data.pendingDetails) && data.pendingDetails.length > 0) {
      state.pendingDetails = data.pendingDetails.map(item => {
        const rawDate = cleanVal(item.date || item.Date);
        const parsed = parseTrackerDate(rawDate);
        let ageHours = null;
        let ageCategory = "<24h";

        if (parsed) {
          const recTime = new Date(parsed.year, parsed.monthIdx, parsed.day).getTime();
          const diffMs = nowManila.getTime() - recTime;
          ageHours = Math.max(0, Math.floor(diffMs / (1000 * 3600)));
          if (ageHours >= 48) {
            ageCategory = ">48h";
            pendingOlder48Count++;
            pendingOlder24Count++;
          } else if (ageHours >= 24) {
            ageCategory = "24–48h";
            pendingOlder24Count++;
          } else {
            ageCategory = "<24h";
          }
        }

        return {
          date: rawDate || "—",
          parsedDate: parsed,
          ageHours,
          ageCategory,
          team: normalizeMemberName(item.team || item.name || item.Name),
          site: cleanVal(item.site || item.SITE) || "—",
          status: cleanVal(item.status || item.noc || item.NOC) || "Pending",
          pendingReason: cleanVal(item.pendingReason || item.reason || "N/A"),
          remarks: cleanVal(item.remarks || item.Remarks),
          source: "Tracker"
        };
      });
    } else {
      state.pendingDetails = [];
    }

    // Month Breakdown (Infractions, Sites, Accounts)
    if (data.breakdown && typeof data.breakdown === "object") {
      state.breakdown = {
        infractions: Array.isArray(data.breakdown.infractions) ? data.breakdown.infractions : [],
        sites: Array.isArray(data.breakdown.sites) ? data.breakdown.sites : [],
        accounts: Array.isArray(data.breakdown.accounts) ? data.breakdown.accounts : []
      };
      state.hasAuthoritativeBreakdown = (state.breakdown.infractions.length + state.breakdown.sites.length + state.breakdown.accounts.length) > 0;
    } else {
      state.breakdown = { infractions: [], sites: [], accounts: [] };
      state.hasAuthoritativeBreakdown = false;
    }

    // Today metrics from Tracker API (if supplied)
    if (data.today && typeof data.today === "object") {
      state.today.reportsToday = typeof data.today.reportsToday === "number" ? data.today.reportsToday : null;
      state.today.successfulNocToday = typeof data.today.successfulNocToday === "number" ? data.today.successfulNocToday : null;
      state.today.pendingAddedToday = typeof data.today.pendingToday === "number" ? data.today.pendingToday : null;
    } else {
      state.today.reportsToday = null;
      state.today.successfulNocToday = null;
      state.today.pendingAddedToday = null;
    }

    // Update Needs Attention counts
    state.needsAttention.pendingNoc = state.pendingReports || 0;
    state.needsAttention.pendingOlder24 = pendingOlder24Count;
    state.needsAttention.pendingOlder48 = pendingOlder48Count;

    state.hasLoadedAuthoritativeData = true;
    state.isStale = false;
    state.fetchError = null;

    saveLocalCache();
  }

  /**
   * Synchronize active counts from local Follow Up, Unreported, and EDR workspaces
   * Preserved completely separate from Tracker API status
   */
  async function syncLocalWorkspaces() {
    const monthInfo = getCurrentMonthInfo();
    const todayFormatted = monthInfo.todayFormatted;

    // 1. Follow Up Workspace Count (Live local IndexedDB/Storage)
    try {
      const fuService = window.CCTV_FOLLOWUP || window.followupService;
      if (fuService && typeof fuService.loadReports === "function") {
        const fuReports = await fuService.loadReports();
        if (Array.isArray(fuReports)) {
          state.followupCount = fuReports.length;
          // Follow Ups active / due today
          state.today.followupsDueToday = fuReports.filter(r => {
            const d = parseTrackerDate(r.dueDate || r.date || r.createdAt);
            return d && d.formatted === todayFormatted;
          }).length;
        }
      }
    } catch (e) {
      console.warn("Could not sync Follow Up count for Dashboard:", e);
    }

    // 2. Unreported Workspace Count (Live local IndexedDB / fallback storage)
    try {
      const unrepService = window.CCTV_UNREPORTED || window.unreportedService;
      let unrepList = [];
      if (unrepService) {
        if (typeof unrepService.loadItems === "function") {
          unrepList = await unrepService.loadItems();
        } else if (typeof unrepService.getItems === "function") {
          unrepList = unrepService.getItems();
        }
      }
      if (!Array.isArray(unrepList) || unrepList.length === 0) {
        const rawFallback = localStorage.getItem("cctv_unreported_fallback_v1");
        if (rawFallback) {
          try { unrepList = JSON.parse(rawFallback); } catch (_) {}
        }
      }
      state.unreportedCount = Array.isArray(unrepList) ? unrepList.length : 0;
    } catch (e) {
      console.warn("Could not sync Unreported count for Dashboard:", e);
    }

    // 3. EDR Workspace Action Needed Count (Live local IndexedDB/Storage)
    try {
      const edrService = window.CCTV_EDR || window.edrService;
      if (edrService) {
        let edrList = [];
        if (typeof edrService.loadReports === "function") {
          edrList = await edrService.loadReports();
        } else if (typeof edrService.getReports === "function") {
          edrList = edrService.getReports();
        }
        if (Array.isArray(edrList)) {
          const activeList = edrList.filter(r => !r.done);
          const uncopied = activeList.filter(r => !r.teamsCopied).length;
          const unaudited = activeList.filter(r => !r.audited).length;
          const actionNeeded = activeList.filter(r => !r.teamsCopied || !r.audited).length;

          state.edrUncopiedCount = uncopied;
          state.edrUnauditedCount = unaudited;
          state.edrActionNeededCount = actionNeeded;

          // EDRs created today
          state.today.edrsCreatedToday = edrList.filter(r => {
            const d = parseTrackerDate(r.createdAt || r.date);
            return d && d.formatted === todayFormatted;
          }).length;
        }
      }
    } catch (e) {
      console.warn("Could not sync EDR action count for Dashboard:", e);
    }

    // Update Needs Attention summary
    state.needsAttention.followup = state.followupCount || 0;
    state.needsAttention.unreported = state.unreportedCount || 0;
    state.needsAttention.edrTeamsPending = state.edrUncopiedCount || 0;
    state.needsAttention.edrAuditPending = state.edrUnauditedCount || 0;

    emitChange();
  }

  /**
   * Fetch authoritative data from the dedicated Google Apps Script Web App
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
      state.currentMonthShort = monthInfo.monthShort;
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
    state.currentMonthShort = monthInfo.monthShort;
    state.currentYear = monthInfo.year;

    // Immediately synchronize local workspaces (Follow Up, Unreported, EDR)
    syncLocalWorkspaces().catch(console.warn);

    // Follow Up change listener
    const fuService = window.CCTV_FOLLOWUP || window.followupService;
    if (fuService && typeof fuService.onChange === "function") {
      fuService.onChange(() => {
        syncLocalWorkspaces().catch(console.warn);
      });
    }

    // Unreported change listener
    const unrepService = window.CCTV_UNREPORTED || window.unreportedService;
    if (unrepService && typeof unrepService.onChange === "function") {
      unrepService.onChange(() => {
        syncLocalWorkspaces().catch(console.warn);
      });
    }

    // EDR change listeners
    const edrService = window.CCTV_EDR || window.edrService;
    if (edrService) {
      const handleEdrReports = () => {
        syncLocalWorkspaces().catch(console.warn);
      };
      if (typeof edrService.onChange === "function") edrService.onChange(handleEdrReports);
      if (typeof edrService.subscribe === "function") edrService.subscribe(handleEdrReports);
    }

    // Initial fetch from authoritative Google Sheets endpoint
    fetchTrackerData().catch(console.warn);
    startAutoRefresh();

    return state;
  }

  /**
   * Deterministic record aggregator for testing & tracker record ingestion
   */
  function aggregateTrackerRecords(records, options = {}) {
    const currentInfo = getCurrentMonthInfo();
    const targetMonthIdx = options.monthIdx != null ? options.monthIdx : currentInfo.monthIdx;
    const targetYear = options.year != null ? options.year : currentInfo.year;

    const result = {
      postedThisMonth: 0,
      successfulNocThisMonth: 0,
      pendingReports: 0,
      teams: {}
    };

    CANONICAL_TEAM_MEMBERS.forEach(name => {
      result.teams[name] = {
        name,
        reportsThisMonth: 0,
        yesThisMonth: 0,
        noThisMonth: 0,
        pending: 0,
        pendingPercent: "0.00%",
        successfulNocThisMonth: 0,
        successfulNocThisYear: 0,
        successfulNocByMonth: new Array(12).fill(0)
      };
    });

    if (Array.isArray(records)) {
      records.forEach(rec => {
        const rawDate = rec.Date || rec.date;
        const parsed = parseTrackerDate(rawDate);
        if (!parsed || parsed.year !== targetYear) return;

        const name = normalizeMemberName(rec.Name || rec.name || rec.auditor || rec.team);
        if (!result.teams[name]) return;

        const mIdx = parsed.monthIdx;
        const status = normalizeNocStatus(rec.NOC || rec.noc || rec.status);

        if (status === "YES") {
          result.teams[name].successfulNocByMonth[mIdx]++;
          result.teams[name].successfulNocThisYear++;
        }

        if (mIdx === targetMonthIdx) {
          result.postedThisMonth++;
          result.teams[name].reportsThisMonth++;

          if (status === "YES") {
            result.successfulNocThisMonth++;
            result.teams[name].yesThisMonth++;
            result.teams[name].successfulNocThisMonth++;
          } else if (status === "NO") {
            result.teams[name].noThisMonth++;
          } else if (status === "PENDING") {
            result.pendingReports++;
            result.teams[name].pending++;
          }
        }
      });
    }

    CANONICAL_TEAM_MEMBERS.forEach(name => {
      const t = result.teams[name];
      t.pendingPercent = t.reportsThisMonth > 0
        ? `${((t.pending / t.reportsThisMonth) * 100).toFixed(2)}%`
        : "0.00%";
    });

    return result;
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
    parseTrackerDate,
    normalizeNocStatus,
    getCurrentMonthInfo,
    aggregateTrackerRecords,
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
