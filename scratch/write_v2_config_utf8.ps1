$lines = Get-Content -Path 'c:\Users\Mnavares\Documents\CCTV OPS\audit-report\index.html' -Encoding UTF8

function Get-ArrayString($line) {
    $start = $line.IndexOf('[')
    $end = $line.LastIndexOf(']')
    return $line.Substring($start, $end - $start + 1)
}

$tlJson = Get-ArrayString $lines[26551]
$omJson = Get-ArrayString $lines[26552]
$accJson = Get-ArrayString $lines[26553]

$configContent = @"
/**
 * CCTV OPS V2 - Global Configuration & Constants
 */

window.CCTV_V2_CONFIG = {
  // Public Supabase Configuration
  SUPABASE_URL: (window.CCTV_AUTH_CONFIG && window.CCTV_AUTH_CONFIG.SUPABASE_URL) || "https://afxgfyuudqujueeooplj.supabase.co",
  SUPABASE_PUBLIC_KEY: (window.CCTV_AUTH_CONFIG && window.CCTV_AUTH_CONFIG.SUPABASE_PUBLIC_KEY) || "sb_publishable_JGUCURJkbOw-KypucxXNSQ_magKTFPd",

  // Storage & Receiver Keys
  KEYS: {
    EDR_DOCS_URL: "edr_google_docs_web_app_url_v1",
    MAINTENANCE_SHEETS_URL: "maintenance_google_sheets_web_app_url_v1",
    ENTRY_LIST: "cctv_entry_list",
    THEME: "cctv_theme",
    DROPDOWN_SITE: "cctv_dropdown_site",
    DROPDOWN_OM: "cctv_dropdown_omName",
    DROPDOWN_ACCOUNT: "cctv_dropdown_account",
    DROPDOWN_REASON: "cctv_dropdown_reasonCode",
    MASTER_HR: "cctv_master_hr_local_crud_v1",
    EDR_CUSTOM_OPTIONS: "cctv_master_edr_custom_options_v1"
  },

  // IndexedDB Databases
  DATABASES: {
    EDR: "cctv_edr_workspace_v2",
    PENDING_REPORTS: "cctv_pending_reports_v1",
    AUDIT_TRACKER: "cctv_tracker_guard_v1",
    MAINTENANCE: "maintenance_report_db",
    FOLLOWUP: "cctv_followup_reports_v1",
    HISTORY: "cctv_global_workspace_history_v1"
  },

  // Default Dropdown Collections (Exact Authoritative V1 Data)
  DEFAULTS: {
    SITES: [
      "Mabini Site A",
      "Mabini Site B1 - 2nd Floor",
      "Mabini Site B2 - 3rd Floor",
      "Mabini Site B2 - 4th Floor",
      "Ecoland Site",
      "MAA 4th Floor",
      "MAA 5th Floor",
      "MAA 6th Floor",
      "Gensan Site",
      "CDO Site",
      "Digos Site"
    ],
    REASON_CODES: [
      "SLEEPING",
      "DRESS CODE",
      "BROWSING",
      "WASTING TIME",
      "BRINGING NON-WOF",
      "EATING",
      "IMPROPER HOUSE KEEPING",
      "EQUIPMENT TAMPERING",
      "PDA",
      "DISORDERLY CONDUCT",
      "USING SMARTPHONE",
      "THEFT",
      "SELLING"
    ],
    OMS: $omJson,
    TLS: $tlJson,
    ACCOUNTS: $accJson
  }
};

// V1 Options Load / Helpers
function loadCustomEdrOptions() {
  try {
    const parsed = JSON.parse(localStorage.getItem(window.CCTV_V2_CONFIG.KEYS.EDR_CUSTOM_OPTIONS) || "{}");
    return {
      tls: Array.isArray(parsed?.tls) ? parsed.tls : [],
      oms: Array.isArray(parsed?.oms) ? parsed.oms : [],
      accounts: Array.isArray(parsed?.accounts) ? parsed.accounts : []
    };
  } catch (_) {
    return { tls: [], oms: [], accounts: [] };
  }
}

window.getTeamLeaderNames = function() {
  const custom = loadCustomEdrOptions().tls;
  const base = (window.CCTV_AUDIT_MASTER_TLS && window.CCTV_AUDIT_MASTER_TLS.length)
    ? window.CCTV_AUDIT_MASTER_TLS
    : (window.CCTV_V2_CONFIG.DEFAULTS.TLS || []);
  const merged = Array.from(new Set([...base, ...custom])).filter(Boolean);
  return merged.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base", numeric: true }));
};

window.getOmNames = function() {
  const custom = loadCustomEdrOptions().oms;
  const base = (window.CCTV_AUDIT_MASTER_OMS && window.CCTV_AUDIT_MASTER_OMS.length)
    ? window.CCTV_AUDIT_MASTER_OMS
    : (window.CCTV_V2_CONFIG.DEFAULTS.OMS || []);
  const merged = Array.from(new Set([...base, ...custom])).filter(Boolean);
  return merged.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base", numeric: true }));
};

window.getAccountNames = function() {
  const custom = loadCustomEdrOptions().accounts;
  const base = (window.CCTV_AUDIT_MASTER_ACCOUNTS && window.CCTV_AUDIT_MASTER_ACCOUNTS.length)
    ? window.CCTV_AUDIT_MASTER_ACCOUNTS
    : (window.CCTV_V2_CONFIG.DEFAULTS.ACCOUNTS || []);
  const merged = Array.from(new Set([...base, ...custom])).filter(Boolean);
  return merged.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base", numeric: true }));
};

// Global Site Normalizer
window.normalizeTrackerSite = function(raw) {
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
};

// Global Auditor Normalizer
window.normalizeAuditorName = function(raw) {
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
};
"@

[System.IO.File]::WriteAllText('c:\Users\Mnavares\Documents\CCTV OPS\audit-report\cctv-ops-v2\js\config.js', $configContent, [System.Text.Encoding]::UTF8)
Write-Output "Wrote config.js with UTF-8"
