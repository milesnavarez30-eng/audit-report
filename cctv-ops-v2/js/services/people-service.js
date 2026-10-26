/**
 * CCTV OPS V2 - Role-Aware People Registry Service
 * Unified, role-aware model for Employees/Agents and Supervisors (TLs/OMs)
 * Supports role overlap, search, custom add/delete, and UI-only role prefix stripping.
 */
window.CCTV_PEOPLE = (function () {
  "use strict";

  const cfg = window.CCTV_V2_CONFIG || {};
  const CUSTOM_KEY = cfg.KEYS?.EDR_CUSTOM_OPTIONS || "cctv_master_edr_custom_options_v1";

  /**
   * Strip any UI-only role prefixes ("TL — ", "TL ", "OM — ", "Agent — ", etc.)
   * Canonical stored value is ALWAYS the clean name.
   */
  function stripRolePrefix(name) {
    if (!name) return "";
    return String(name)
      .replace(/^(?:TL|OM|Agent)\b\s*[\u2014\u2013\-:]?\s*/i, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function clean(val) {
    return String(val == null ? "" : val).replace(/\s+/g, " ").trim();
  }

  function norm(str) {
    return clean(str).toLowerCase();
  }

  function escHtml(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function getBuiltinDefaultTls() {
    const list = (window.CCTV_AUDIT_MASTER_TLS && window.CCTV_AUDIT_MASTER_TLS.length)
      ? window.CCTV_AUDIT_MASTER_TLS
      : ((cfg.DEFAULTS && cfg.DEFAULTS.TLS) || []);
    return list.map(stripRolePrefix).filter(Boolean);
  }

  function getBuiltinDefaultOms() {
    const list = (window.CCTV_AUDIT_MASTER_OMS && window.CCTV_AUDIT_MASTER_OMS.length)
      ? window.CCTV_AUDIT_MASTER_OMS
      : ((cfg.DEFAULTS && cfg.DEFAULTS.OMS) || []);
    return list.map(stripRolePrefix).filter(Boolean);
  }

  function loadLocalCustomOptions() {
    try {
      const raw = localStorage.getItem(CUSTOM_KEY);
      const parsed = raw ? JSON.parse(raw) : {};
      return {
        tls: Array.isArray(parsed?.tls) ? parsed.tls : [],
        oms: Array.isArray(parsed?.oms) ? parsed.oms : [],
        agents: Array.isArray(parsed?.agents) ? parsed.agents : []
      };
    } catch (_) {
      return { tls: [], oms: [], agents: [] };
    }
  }

  function saveLocalCustomOptions(data) {
    try {
      localStorage.setItem(CUSTOM_KEY, JSON.stringify(data));
    } catch (_) {}
  }

  /**
   * Check if a clean name is part of default/protected authoritative lists.
   */
  function isProtectedDefault(name) {
    const target = norm(stripRolePrefix(name));
    if (!target) return false;
    const defaultTls = getBuiltinDefaultTls();
    const defaultOms = getBuiltinDefaultOms();
    return defaultTls.some(t => norm(t) === target) || defaultOms.some(o => norm(o) === target);
  }

  /**
   * Build the normalized people registry array:
   * [ { id, name, roles: ["Agent"|"TL"|"OM"], isProtected: boolean, isCustom: boolean } ]
   */
  function getRegistry() {
    const personMap = new Map(); // key -> person object

    function ensurePerson(rawName, role, isProtected = false, isCustom = false) {
      const cleanName = stripRolePrefix(rawName);
      if (!cleanName) return;
      const k = norm(cleanName);

      if (!personMap.has(k)) {
        personMap.set(k, {
          id: "p_" + k.replace(/[^a-z0-9]/g, "_"),
          name: cleanName,
          roles: new Set(),
          isProtected,
          isCustom
        });
      }

      const p = personMap.get(k);
      if (role) p.roles.add(role);
      if (isProtected) p.isProtected = true;
      if (isCustom && !p.isProtected) p.isCustom = true;
    }

    // 1. Authoritative default TLs
    getBuiltinDefaultTls().forEach(t => ensurePerson(t, "TL", true, false));

    // 2. Authoritative default OMs
    getBuiltinDefaultOms().forEach(o => ensurePerson(o, "OM", true, false));

    // 3. Masterlist active options & custom additions
    const ms = window.masterlistService;
    if (ms) {
      const activeTls = typeof ms.getTeamLeaders === "function" ? ms.getTeamLeaders() : [];
      activeTls.forEach(t => ensurePerson(t, "TL", isProtectedDefault(t), !isProtectedDefault(t)));

      const activeOms = typeof ms.getOms === "function" ? ms.getOms() : [];
      activeOms.forEach(o => ensurePerson(o, "OM", isProtectedDefault(o), !isProtectedDefault(o)));

      const customAddedTls = ms.masterOptions?.added?.tls || [];
      customAddedTls.forEach(t => ensurePerson(t, "TL", false, true));

      const customAddedOms = ms.masterOptions?.added?.oms || [];
      customAddedOms.forEach(o => ensurePerson(o, "OM", false, true));

      const customAddedAgents = ms.masterOptions?.added?.agents || [];
      customAddedAgents.forEach(a => ensurePerson(a, "Agent", false, true));
    }

    // 4. Local fallback custom options
    const local = loadLocalCustomOptions();
    local.tls.forEach(t => ensurePerson(t, "TL", isProtectedDefault(t), !isProtectedDefault(t)));
    local.oms.forEach(o => ensurePerson(o, "OM", isProtectedDefault(o), !isProtectedDefault(o)));
    local.agents.forEach(a => ensurePerson(a, "Agent", false, true));

    // 5. Historical EDR records are preserved independently and do not
    // recreate deleted custom registry options for future selection.

    // Convert to sorted list
    return Array.from(personMap.values())
      .map(p => ({
        id: p.id,
        name: p.name,
        roles: Array.from(p.roles).sort(),
        isProtected: p.isProtected,
        isCustom: p.isCustom
      }))
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base", numeric: true }));
  }

  /**
   * Options for EMPLOYEE / AGENT selector:
   * Sourced from: Agents + Team Leaders + custom people
   */
  function getEmployeeOptions() {
    const registry = getRegistry();
    return registry.map(p => {
      const roleLabel = p.roles.includes("TL") ? "TL" : (p.roles.includes("OM") ? "OM" : "Agent");
      return {
        id: p.id,
        name: p.name,
        roles: p.roles,
        roleLabel,
        displayLabel: `${roleLabel} \u2014 ${p.name}`,
        isCustom: p.isCustom
      };
    });
  }

  /**
   * Options for TL / SUPERVISOR selector:
   * Sourced from: Team Leaders + OMs + custom people
   */
  function getSupervisorOptions() {
    const registry = getRegistry();
    return registry
      .filter(p => p.roles.includes("TL") || p.roles.includes("OM") || p.isCustom)
      .map(p => {
        let roleLabel = "TL";
        if (p.roles.includes("OM") && p.roles.includes("TL")) {
          roleLabel = "TL/OM";
        } else if (p.roles.includes("OM")) {
          roleLabel = "OM";
        }
        return {
          id: p.id,
          name: p.name,
          roles: p.roles,
          roleLabel,
          displayLabel: `${roleLabel} \u2014 ${p.name}`,
          isCustom: p.isCustom
        };
      });
  }

  /**
   * Add a custom person to registry.
   * @param {string} rawName
   * @param {"Agent"|"TL"|"OM"} role
   * @param {object} meta
   */
  function addCustomPerson(rawName, role = "Agent", meta = {}) {
    const cleanName = stripRolePrefix(rawName);
    if (!cleanName) return { added: false, error: "Name is required." };

    const ms = window.masterlistService;
    let added = false;
    let canonical = cleanName;

    if (ms) {
      if (role === "OM") {
        const res = ms.addDedicatedOm(cleanName, meta);
        added = res.added;
        canonical = res.canonical || cleanName;
      } else if (role === "TL" || role === "Team Leader") {
        const res = ms.addRespondent(cleanName, "Team Leader", meta);
        added = res.added;
        canonical = res.canonical || cleanName;
      } else {
        // Agent role: persist in masterlist masterOptions.added.agents
        if (typeof ms.addAgent === "function") {
          const res = ms.addAgent(cleanName, meta);
          added = res.added;
          canonical = res.canonical || cleanName;
        } else {
          if (!ms.masterOptions.added.agents) ms.masterOptions.added.agents = [];
          const k = norm(cleanName);
          const already = ms.masterOptions.added.agents.some(x => norm(x) === k);
          if (!already) {
            ms.masterOptions.added.agents.push(cleanName);
            ms._saveMasterOptions?.();
            ms._derive?.();
            ms._notify?.();
            added = true;
          }
        }
      }
    }

    // Also update local custom fallback
    const local = loadLocalCustomOptions();
    const cat = role === "OM" ? "oms" : ((role === "TL" || role === "Team Leader") ? "tls" : "agents");
    const k = norm(cleanName);
    if (!local[cat].some(x => norm(x) === k)) {
      local[cat].push(cleanName);
      saveLocalCustomOptions(local);
      added = true;
    }

    return { added, canonical: stripRolePrefix(canonical) };
  }

  /**
   * Delete a custom person from registry.
   * Protected authoritative names cannot be deleted.
   * Existing historical EDR records referencing the person remain untouched.
   */
  function removeCustomPerson(rawName, role = null) {
    const cleanName = stripRolePrefix(rawName);
    if (!cleanName) return { success: false, removed: false, error: "Name is required." };

    if (isProtectedDefault(cleanName)) {
      return {
        success: false,
        removed: false,
        error: `"${cleanName}" is a default authoritative person and cannot be deleted.`
      };
    }

    const ms = window.masterlistService;
    if (ms) {
      if (role === "OM") {
        ms.removeDedicatedOm(cleanName);
      } else if (role === "TL" || role === "Team Leader") {
        ms.removeRespondent(cleanName, "Team Leader");
      } else if (role === "Agent") {
        if (typeof ms.removeAgent === "function") ms.removeAgent(cleanName);
      } else {
        if (typeof ms.removeDedicatedOm === "function") ms.removeDedicatedOm(cleanName);
        if (typeof ms.removeRespondent === "function") ms.removeRespondent(cleanName, "Team Leader");
        if (typeof ms.removeAgent === "function") ms.removeAgent(cleanName);
      }
    }

    // Update local fallback
    const local = loadLocalCustomOptions();
    const k = norm(cleanName);
    if (role === "OM") {
      local.oms = local.oms.filter(x => norm(x) !== k);
    } else if (role === "TL" || role === "Team Leader") {
      local.tls = local.tls.filter(x => norm(x) !== k);
    } else if (role === "Agent") {
      local.agents = local.agents.filter(x => norm(x) !== k);
    } else {
      local.oms = local.oms.filter(x => norm(x) !== k);
      local.tls = local.tls.filter(x => norm(x) !== k);
      local.agents = local.agents.filter(x => norm(x) !== k);
    }
    saveLocalCustomOptions(local);

    return { success: true, removed: true, cleanName };
  }

  return {
    stripRolePrefix,
    isProtectedDefault,
    getRegistry,
    getEmployeeOptions,
    getSupervisorOptions,
    addCustomPerson,
    removeCustomPerson,
    escHtml
  };
})();
