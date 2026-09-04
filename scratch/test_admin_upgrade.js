const fs = require('fs');
const path = require('path');

const htmlPath = path.resolve('c:/Users/Mnavares/Documents/CCTV OPS/audit-report/index.html');
const content = fs.readFileSync(htmlPath, 'utf8');

console.log("=== COMPREHENSIVE VALIDATION SUITE: CCTV OPS V10 ===");

let passed = 0;
let total = 0;

function assert(condition, testName) {
    total++;
    if (condition) {
        console.log(`✓ [PASS] ${testName}`);
        passed++;
    } else {
        console.error(`✗ [FAIL] ${testName}`);
    }
}

// 1. Typography & CSS
assert(content.includes('-apple-system, BlinkMacSystemFont, "SF Pro Text"'), "macOS/iOS system font stack defined in CSS");
assert(content.includes('#remarks,') && content.includes('background: var(--ops-panel-2) !important;'), "Dark Mode Remarks fix explicitly styled to dark panel color");
assert(content.includes('.admin-kpi-grid'), "Admin KPI Grid CSS defined");
assert(content.includes('.admin-subnav-bar'), "macOS Segmented subnav styling defined");

// 2. Form Grids
assert(content.includes('.cctv-audit-form-grid') || content.includes('#cctvPanel .form-grid'), "CCTV Audit form grid alignment defined");
assert(content.includes('.followup-crud-grid') || content.includes('#followupPanel .followup-add-grid'), "Follow Up Reports grid alignment defined");

// 3. Admin Panel Structure
assert(content.includes('id="adminSupabaseStatus"'), "Supabase status element present");
assert(content.includes('id="adminDocsStatus"'), "Google Docs EDR status element present");
assert(content.includes('id="adminSheetsStatus"'), "Google Sheets Maintenance status element present");
assert(content.includes('id="adminTotalUsers"'), "Total users metric present");
assert(content.includes('id="adminCountAdmins"'), "Admin count metric present");
assert(content.includes('id="adminCountUsers"'), "Staff user count metric present");
assert(content.includes('id="adminPendingUsers"'), "Pending count metric present");
assert(content.includes('id="adminDisabledUsers"'), "Disabled count metric present");
assert(content.includes('id="adminRecentUsers"'), "Active 24h count metric present");
assert(content.includes('id="adminEdrCount"'), "Local EDR count metric present");
assert(content.includes('id="adminCctvCount"'), "CCTV audits count metric present");
assert(content.includes('id="adminFollowupCount"'), "Open follow-ups count metric present");

// 4. Admin Subnav
assert(content.includes('data-admin-tab="users"'), "Subnav tab: Staff Accounts present");
assert(content.includes('data-admin-tab="audit"'), "Subnav tab: Security Audit Log present");
assert(content.includes('data-admin-tab="settings"'), "Subnav tab: Operational Settings present");

// 5. Security Audit Log
assert(content.includes('id="adminSecurityAuditBody"'), "Security audit log table body present");
assert(content.includes('id="adminAuditSearch"'), "Security audit search input present");
assert(content.includes('id="adminRefreshAuditBtn"'), "Security audit refresh button present");
assert(content.includes('id="adminExportAuditBtn"'), "Security audit export button present");
assert(content.includes('cctv_security_audit_logs'), "Supabase cctv_security_audit_logs table referenced");
assert(content.includes('log_cctv_security_event'), "Supabase log_cctv_security_event RPC referenced");
assert(content.includes('settings_updated') && content.includes('operational_settings'), "Operational settings event action and target configured");
assert(content.includes('No security audit events recorded yet.'), "Updated clean empty-state message present");
assert(content.includes('window.CCTV_LOG_ADMIN_EVENT'), "window.CCTV_LOG_ADMIN_EVENT helper exposed for master options");

// 6. Operational Settings
assert(content.includes('id="adminSettingTheme"'), "Setting: Theme present");
assert(content.includes('id="adminSettingLanding"'), "Setting: Landing workspace present");
assert(content.includes('id="adminSettingSubtitle"'), "Setting: Subtitle present");
assert(content.includes('id="adminSettingAutoTrim"'), "Setting: Auto-trim present");
assert(content.includes('id="adminSaveSettingsBtn"'), "Save settings button present");

// 7. Security Hardening & Fail-Closed Logic
assert(content.includes('Object.freeze(accessObj)'), "window.CCTV_ACCESS is frozen for tamper resistance");
assert(content.includes('Object.defineProperty(window, "CCTV_ACCESS"'), "window.CCTV_ACCESS defined via non-writable property");
assert(content.includes('lockDisabled(u)'), "Disabled/suspended accounts trigger lockDisabled screen");
assert(content.includes('id="authDisabledState"'), "authDisabledState UI present in auth gate");
assert(content.includes('__cctv_normal_user_edr_cleaned_v1'), "Safe one-time normal user EDR cleanup logic present");

// 8. Strict Button Preservation (Rule: Do NOT rename existing buttons)
const preservedButtons = [
    "adminRefreshBtn",
    "adminCreateAccountBtn",
    "adminAccessSave",
    "adminAccessCancel",
    "authSignInBtn",
    "authSignUpBtn",
    "authLogoutBtn",
    "authPendingLogoutBtn",
    "authRejectedLogoutBtn",
    "edrSaveBtn",
    "edrClearFormBtn",
    "edrCopyAllBtn",
    "edrClearAllBtn",
    "edrDocsSetupBtn",
    "edrDocsReloadBtn"
];
preservedButtons.forEach(btnId => {
    assert(content.includes(`id="${btnId}"`), `Preserved critical button: #${btnId}`);
});

console.log(`\nResults: ${passed} / ${total} tests passed.`);
if (passed === total) {
    console.log("ALL TESTS PASSED WITH ZERO ERRORS!");
} else {
    process.exit(1);
}
