/**
 * CCTV OPS V2 - Multi-Subject EDR Module
 * Prototype implementation: Multi-subject per incident EDR
 *
 * Architecture:
 *  - Each EDR record may now contain a `subjects` array
 *  - Legacy single-subject records (subjectName/subjectType) are read-compat at runtime
 *  - One EDR = ONE saved record, ONE Teams message, N Audit rows (fan-out)
 *  - Audit fan-out is idempotent: keyed on sourceEdrId + sourceSubjectId
 */
window.EDR_MULTI_SUBJECT = (function () {
  "use strict";

  // ── Utilities ─────────────────────────────────────────────────────────────

  function uid() {
    return "s_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8);
  }

  function clean(val) {
    return String(val == null ? "" : val).replace(/\s+/g, " ").trim();
  }

  function escHtml(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  // ── Subject Normalization (backward compat) ───────────────────────────────

  /**
   * Given an EDR report, always return a normalized subjects array.
   * If the record already has subjects[], return as-is.
   * If the record only has legacy subjectName/subjectType, wrap it.
   */
  function normalizeSubjects(report) {
    if (!report) return [];

    // Already has multi-subject array
    if (Array.isArray(report.subjects) && report.subjects.length > 0) {
      return report.subjects.map(s => ({
        id: s.id || uid(),
        type: s.type || "Agent",
        name: clean(s.name),
        supervisorName: clean(s.supervisorName),
        account: clean(s.account),
        infraction: clean(s.infraction)
      })).filter(s => s.name);
    }

    // Legacy single-subject
    const legacyName = clean(report.subjectName || report.agentName);
    if (legacyName) {
      const isTl = report.subjectType === "Team Leader";
      const sup = clean(report.supervisorName);
      return [{
        id: "legacy_0",
        type: isTl ? "Team Leader" : "Agent",
        name: legacyName,
        supervisorName: (isTl && sup.toLowerCase() === legacyName.toLowerCase()) ? "" : sup,
        account: clean(report.account),
        infraction: clean(report.infraction)
      }];
    }

    return [];
  }

  // ── Parse Pasted Names ────────────────────────────────────────────────────

  /**
   * Parse comma- or newline-separated names into an array of clean names.
   * Returns unique, non-empty names only.
   */
  function parseNamesPaste(text) {
    if (!text) return [];
    const sep = /,|\n|\r\n|\r/;
    const names = String(text).split(sep)
      .map(n => clean(n))
      .filter(n => n.length > 0);

    // De-duplicate (case-insensitive)
    const seen = new Set();
    return names.filter(n => {
      const k = n.toLowerCase();
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  }

  // ── Check Duplicate Within EDR ────────────────────────────────────────────

  function isDuplicateName(existingSubjects, candidateName) {
    const k = clean(candidateName).toLowerCase();
    return existingSubjects.some(s => s.name.toLowerCase() === k);
  }

  // ── Teams Output Generator ────────────────────────────────────────────────

  /**
   * Build a smart multi-subject Teams plain-text block for ONE EDR.
   * - If all subjects share same TL, Account, Infraction → compact grouped format
   * - Otherwise → per-subject list format
   */
  function buildMultiSubjectTeamsText(report) {
    const subjects = normalizeSubjects(report);
    if (!subjects.length) return null; // Fall back to legacy renderer

    const lines = [];
    const topLine = [report.site, "CCTV", report.account || subjects[0]?.account].filter(Boolean).join(" | ");
    lines.push(topLine);
    lines.push(`Date: ${_formatDate(report.date)}`);
    lines.push(`Time Observed: ${report.timeObserved || report.timeStart || ""}`);

    // Check if all subjects share same TL, account, infraction
    const allSameTl = subjects.every(s => s.supervisorName === subjects[0].supervisorName);
    const allSameAccount = subjects.every(s => s.account === subjects[0].account);
    const allSameInfraction = subjects.every(s => s.infraction === subjects[0].infraction);

    const isAllTl = subjects.every(s => s.type === "Team Leader");

    if (allSameTl && allSameAccount && allSameInfraction) {
      // Compact grouped format
      const agentNames = subjects.map(s => s.name).join(", ");
      const subjectLabel = isAllTl ? "Team Leaders" : "Agents";
      if (!isAllTl && subjects[0].supervisorName) {
        lines.push(`Team Leader: ${subjects[0].supervisorName || ""}`);
      } else if (isAllTl && subjects[0].supervisorName && subjects[0].supervisorName.toLowerCase() !== subjects[0].name.toLowerCase()) {
        lines.push(`Supervisor: ${subjects[0].supervisorName}`);
      }
      lines.push(`${subjectLabel}: ${agentNames}`);
      lines.push(`Account/Campaign: ${subjects[0].account || ""}`);
      if (subjects[0].infraction) lines.push(`Infraction: ${subjects[0].infraction}`);
    } else {
      // Per-subject list format
      const isAllAgent = subjects.every(s => s.type !== "Team Leader");
      const listHeader = isAllTl ? "Team Leaders:" : (isAllAgent ? "Agents:" : "Subjects:");
      lines.push(listHeader);
      subjects.forEach((s) => {
        const parts = [s.name];
        if (s.supervisorName && (s.type !== "Team Leader" || s.supervisorName.toLowerCase() !== s.name.toLowerCase())) {
          parts.push(s.supervisorName);
        }
        if (s.account) parts.push(s.account);
        if (s.infraction) parts.push(s.infraction);
        lines.push(parts.join(" — "));
      });
    }

    lines.push(`Incident: ${report.incident || ""}`);
    lines.push(`Action Taken/Remarks: ${report.action || ""}`);

    // Clip links
    const links = Array.isArray(report.clipLinks) && report.clipLinks.length
      ? report.clipLinks
      : (report.clipLink ? [report.clipLink] : []);
    links.forEach((link, idx) => {
      const label = links.length > 1 ? `CCTV Clip ${idx + 1}` : "CCTV Clip";
      lines.push(`${label}: Click here! (${link})`);
    });

    return lines.join("\n");
  }

  /**
   * Build multi-subject Teams HTML block for ONE EDR.
   */
  function buildMultiSubjectTeamsHtml(report) {
    const subjects = normalizeSubjects(report);
    if (!subjects.length) return null;

    const topLine = [report.site, "CCTV", report.account || subjects[0]?.account].filter(Boolean).join(" | ");
    const allSameTl = subjects.every(s => s.supervisorName === subjects[0].supervisorName);
    const allSameAccount = subjects.every(s => s.account === subjects[0].account);
    const allSameInfraction = subjects.every(s => s.infraction === subjects[0].infraction);

    const lines = [
      `<div>${escHtml(topLine)}</div>`,
      `<div>Date: ${escHtml(_formatDate(report.date))}</div>`,
      `<div>Time Observed: ${escHtml(report.timeObserved || report.timeStart || "")}</div>`
    ];

    const isAllTl = subjects.every(s => s.type === "Team Leader");

    if (allSameTl && allSameAccount && allSameInfraction) {
      const agentNames = subjects.map(s => escHtml(s.name)).join(", ");
      const subjectLabel = isAllTl ? "Team Leaders" : "Agents";
      if (!isAllTl && subjects[0].supervisorName) {
        lines.push(`<div>Team Leader: ${escHtml(subjects[0].supervisorName || "")}</div>`);
      } else if (isAllTl && subjects[0].supervisorName && subjects[0].supervisorName.toLowerCase() !== subjects[0].name.toLowerCase()) {
        lines.push(`<div>Supervisor: ${escHtml(subjects[0].supervisorName)}</div>`);
      }
      lines.push(`<div>${escHtml(subjectLabel)}: ${agentNames}</div>`);
      lines.push(`<div>Account/Campaign: ${escHtml(subjects[0].account || "")}</div>`);
      if (subjects[0].infraction) lines.push(`<div>Infraction: ${escHtml(subjects[0].infraction)}</div>`);
    } else {
      const isAllAgent = subjects.every(s => s.type !== "Team Leader");
      const listHeader = isAllTl ? "Team Leaders:" : (isAllAgent ? "Agents:" : "Subjects:");
      lines.push(`<div>${listHeader}</div>`);
      subjects.forEach((s) => {
        const parts = [escHtml(s.name)];
        if (s.supervisorName && (s.type !== "Team Leader" || s.supervisorName.toLowerCase() !== s.name.toLowerCase())) {
          parts.push(escHtml(s.supervisorName));
        }
        if (s.account) parts.push(escHtml(s.account));
        if (s.infraction) parts.push(escHtml(s.infraction));
        lines.push(`<div>${parts.join(" &mdash; ")}</div>`);
      });
    }

    lines.push(`<div>Incident: ${escHtml(report.incident || "")}</div>`);
    lines.push(`<div>Action Taken/Remarks: ${escHtml(report.action || "")}</div>`);

    const links = Array.isArray(report.clipLinks) && report.clipLinks.length
      ? report.clipLinks
      : (report.clipLink ? [report.clipLink] : []);
    links.forEach((link, idx) => {
      const label = links.length > 1 ? `CCTV Clip ${idx + 1}` : "CCTV Clip";
      const safeLink = _safeUrl(link);
      if (safeLink) {
        lines.push(`<div>${escHtml(label)}: <a href="${escHtml(safeLink)}">Click here!</a></div>`);
      }
    });

    return lines.join("");
  }

  function _safeUrl(raw) {
    let u = String(raw || "").trim();
    if (!u) return "";
    if (!/^https?:\/\//i.test(u)) u = "https://" + u;
    try {
      const p = new URL(u);
      if (!/^https?:$/i.test(p.protocol)) return "";
      return p.href;
    } catch (_) { return ""; }
  }

  function _formatDate(dateStr) {
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

  // ── Audit Fan-Out ─────────────────────────────────────────────────────────

  /**
   * Fan out a multi-subject EDR to CCTV Audit.
   * Creates ONE audit row per subject.
   * Idempotent: keyed on sourceEdrId + sourceSubjectId.
   * Returns { created, skipped, total }
   */
  function fanOutToAudit(report) {
    if (!report || !report.id) throw new Error("EDR record missing ID.");
    if (!window.CCTV_STORAGE) throw new Error("CCTV_STORAGE not available.");
    if (!window.CCTV_V2_CONFIG) throw new Error("CCTV_V2_CONFIG not available.");

    const cfg = window.CCTV_V2_CONFIG;
    const storage = window.CCTV_STORAGE;
    const subjects = normalizeSubjects(report);

    if (!subjects.length) {
      // Fallback: single-subject legacy fan-out
      if (window.cctvAuditBridge && window.cctvAuditBridge.sendFromEdr) {
        return window.cctvAuditBridge.sendFromEdr(report);
      }
      return { created: 0, skipped: 0, total: 0 };
    }

    let entryList = storage.getItem(cfg.KEYS.ENTRY_LIST, []);
    if (!Array.isArray(entryList)) entryList = [];

    // Build shared fields from report
    const rawDate = report.date || new Date().toISOString().slice(0, 10);
    const dateObj = new Date(`${rawDate}T00:00:00`);
    const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    const formattedDate = `${dateObj.getMonth() + 1}/${dateObj.getDate()}/${dateObj.getFullYear()}`;
    const month = months[dateObj.getMonth()];
    const year = dateObj.getFullYear();

    const currentAuditor = window.normalizeAuditorName
      ? window.normalizeAuditorName(
          window.CCTV_ACCOUNT_CONTEXT?.profile?.display_name ||
          window.CCTV_AUTH?.getProfile?.()?.display_name || "Miles"
        )
      : "Miles";

    const site = _normalizeSite(report.site);
    const omName = String(report.omName || "").trim() || "N/A";
    const sharedRemarks = String(report.action || report.incident || "N/A").trim() || "N/A";

    let created = 0;
    let skipped = 0;

    subjects.forEach(subject => {
      const subjectId = subject.id || uid();
      const compositeKey = `${report.id}::${subjectId}`;

      // Idempotency: skip if this exact subject was already sent
      const existingIdx = entryList.findIndex(entry =>
        entry.sourceEdrId === report.id &&
        (entry.sourceSubjectId === subjectId ||
         // Also check composite key for older format
         entry._compositeKey === compositeKey)
      );

      const isTl = subject.type === "Team Leader";
      const agentName = isTl ? "N/A" : (subject.name || "N/A");
      const tlName = isTl ? (subject.name || "N/A") : (subject.supervisorName || "N/A");

      const subjectEntry = {
        rawDate,
        year: String(year),
        month,
        formattedDate,
        auditorName: currentAuditor,
        name: currentAuditor,
        omName,
        site,
        tlName,
        agentName,
        account: subject.account || report.account || "N/A",
        cleanAccount: subject.account || report.account || "General",
        reasonCode: subject.infraction || _auditReasonFromText(report.incident + " " + report.action),
        noc: "Pending",
        remarks: sharedRemarks,
        sourceEdrId: report.id,
        sourceSubjectId: subjectId,
        _compositeKey: compositeKey,
        sourceEdrUpdatedAt: report.updatedAt || "",
        sourceEdrReasonAuto: !subject.infraction
      };

      if (existingIdx === -1) {
        // New entry
        entryList.push(subjectEntry);
        created++;
      } else {
        // Existing: update shared metadata, preserve NOC and Remarks
        const prev = entryList[existingIdx];
        entryList[existingIdx] = {
          ...prev,
          ...subjectEntry,
          noc: prev.noc || "Pending",
          remarks: prev.remarks || sharedRemarks,
          reasonCode: prev.sourceEdrReasonAuto !== false
            ? subjectEntry.reasonCode
            : prev.reasonCode
        };
        skipped++;
      }
    });

    // Sort by date
    entryList.sort((a, b) => new Date(a.rawDate || a.date) - new Date(b.rawDate || b.date));
    storage.setItem(cfg.KEYS.ENTRY_LIST, entryList);
    if (window.CCTV_AUDIT && typeof window.CCTV_AUDIT.reloadEntries === "function") {
      window.CCTV_AUDIT.reloadEntries();
    }

    // Ensure audit dropdown values are registered
    subjects.forEach(subject => {
      _ensureAuditDropdown("site", site);
      _ensureAuditDropdown("account", subject.account || report.account);
      if (subject.infraction) _ensureAuditDropdown("reasonCode", subject.infraction);
    });

    return { created, skipped, total: subjects.length };
  }

  function _normalizeSite(raw) {
    if (window.normalizeTrackerSite) return window.normalizeTrackerSite(raw);
    return String(raw || "").trim() || "Mabini Site A";
  }

  function _auditReasonFromText(text) {
    const t = String(text || "").toUpperCase();
    if (/SLEEP/.test(t)) return "SLEEPING";
    if (/DRESS|UNIFORM/.test(t)) return "DRESS CODE";
    if (/BROWS|BROWSER/.test(t)) return "BROWSING";
    if (/WASTING|IDLE/.test(t)) return "WASTING TIME";
    if (/NON.*WOF|NON.*WORK/.test(t)) return "BRINGING NON-WORK ITEM";
    if (/EAT|FOOD/.test(t)) return "EATING";
    if (/HOUSE.*KEEP|CLEANLINESS/.test(t)) return "IMPROPER HOUSE KEEPING";
    if (/TAMPER|EQUIPMENT/.test(t)) return "EQUIPMENT TAMPERING";
    if (/\bPDA\b/.test(t)) return "PDA";
    if (/DISORDER/.test(t)) return "DISORDERLY CONDUCT";
    if (/SMART.*PHONE|SMARTPHONE|PHONE/.test(t)) return "USING SMARTPHONE";
    if (/THEFT|STEAL/.test(t)) return "THEFT";
    if (/SELL|VEND/.test(t)) return "SELLING";
    return "OTHER / EDR";
  }

  function _ensureAuditDropdown(id, value) {
    const text = String(value || "").trim();
    if (!text || text === "N/A") return;
    if (window.masterlistService) {
      if (id === "site") window.masterlistService.addSite(text);
      else if (id === "account") window.masterlistService.addAccount(text);
      else if (id === "reasonCode") window.masterlistService.addReason(text);
    }
  }

  // ── Subject Count Summary for Saved EDR Card ─────────────────────────────

  /**
   * Returns a compact summary line for the saved EDR card.
   * e.g. "5 AGENTS · John Cruz, Maria Santos +3"
   */
  function subjectSummaryLine(report, maxNames = 2) {
    const subjects = normalizeSubjects(report);
    if (!subjects.length) {
      // Legacy: just show subjectName if present
      const name = clean(report.subjectName);
      return name ? `1 SUBJECT · ${name}` : "";
    }

    const agentCount = subjects.filter(s => s.type !== "Team Leader").length;
    const tlCount = subjects.filter(s => s.type === "Team Leader").length;

    let label = "";
    if (agentCount > 0 && tlCount > 0) {
      label = `${subjects.length} SUBJECTS`;
    } else if (tlCount > 0) {
      label = `${tlCount} TEAM LEADER${tlCount > 1 ? "S" : ""}`;
    } else {
      label = `${agentCount} AGENT${agentCount > 1 ? "S" : ""}`;
    }

    const displayNames = subjects.slice(0, maxNames).map(s => s.name).join(", ");
    const remainder = subjects.length - maxNames;
    const nameStr = remainder > 0 ? `${displayNames} +${remainder}` : displayNames;

    return `${label} · ${nameStr}`;
  }

  /**
   * Returns expanded HTML for the subject detail section in a saved EDR card.
   */
  function subjectExpandedHtml(report) {
    const subjects = normalizeSubjects(report);
    if (!subjects.length) return "";

    const rows = subjects.map(s => {
      const meta = [s.supervisorName, s.account, s.infraction].filter(Boolean).join(" · ");
      return `<div class="edr-subject-detail-row">
        <span class="edr-subj-name">${escHtml(s.name)}</span>
        ${meta ? `<span class="edr-subj-meta">${escHtml(meta)}</span>` : ""}
      </div>`;
    }).join("");

    return `<div class="edr-subjects-expanded">${rows}</div>`;
  }

  // ── Infraction Registry (via masterlistService) ───────────────────────────

  function getInfractions() {
    if (window.masterlistService && typeof window.masterlistService.getInfractions === "function") {
      return window.masterlistService.getInfractions();
    }
    // Fallback defaults
    return window.CCTV_V2_CONFIG?.DEFAULTS?.INFRACTIONS || [];
  }

  function addInfraction(name) {
    if (window.masterlistService && typeof window.masterlistService.addInfraction === "function") {
      return window.masterlistService.addInfraction(name);
    }
    return { added: false };
  }

  function removeInfraction(name) {
    if (window.masterlistService && typeof window.masterlistService.removeInfraction === "function") {
      return window.masterlistService.removeInfraction(name);
    }
    return false;
  }

  // ── Derive Legacy Fields from Subjects ───────────────────────────────────

  /**
   * After saving subjects, update the legacy top-level fields for Teams/Docs compat.
   * This mutates the report object in-place.
   */
  function syncLegacyFields(report) {
    const subjects = normalizeSubjects(report);
    if (!subjects.length) return report;

    const first = subjects[0];
    report.subjectName = subjects.map(s => s.name).join(", ");
    report.subjectType = first.type === "Team Leader" ? "Team Leader" : "Agent/s";
    // Keep supervisorName as the first subject's TL for legacy Teams compat
    if (!report.supervisorName && first.supervisorName) {
      report.supervisorName = first.supervisorName;
    }
    if (!report.account && first.account) {
      report.account = first.account;
    }

    return report;
  }

  // ── Public API ────────────────────────────────────────────────────────────

  return {
    uid,
    clean,
    escHtml,
    normalizeSubjects,
    parseNamesPaste,
    isDuplicateName,
    buildMultiSubjectTeamsText,
    buildMultiSubjectTeamsHtml,
    fanOutToAudit,
    subjectSummaryLine,
    subjectExpandedHtml,
    getInfractions,
    addInfraction,
    removeInfraction,
    syncLegacyFields
  };
})();
