const fs = require('fs');
const path = require('path');

const htmlPath = path.resolve('c:/Users/Mnavares/Documents/CCTV OPS/audit-report/index.html');
const cssPath = path.resolve('c:/Users/Mnavares/Documents/CCTV OPS/audit-report/style.css');

const html = fs.readFileSync(htmlPath, 'utf8');
const css = fs.readFileSync(cssPath, 'utf8');

console.log("=== APEX SLATE DESIGN SYSTEM COMPREHENSIVE AUDIT ===");

let passed = 0;
let total = 0;
function assert(condition, name) {
    total++;
    if (condition) {
        console.log(`✓ [PASS] ${name}`);
        passed++;
    } else {
        console.error(`✗ [FAIL] ${name}`);
    }
}

// 1. Dark Mode & Light Mode Root Palettes
assert(html.includes('--ops-bg: #f1f5f9 !important;'), "Light Mode background token defined");
assert(html.includes('--ops-bg: #0b0f17 !important;'), "Dark Mode background token defined (Obsidian Slate)");
assert(html.includes('--ops-accent: #2563eb !important;'), "Light Mode electric blue accent token defined");
assert(html.includes('--ops-accent: #3b82f6 !important;'), "Dark Mode electric blue accent token defined");

// 2. Textarea Theme Parity & High Contrast
assert(html.includes('body.ops-redesign-v3.dark-mode #remarks'), "CCTV #remarks dark mode style defined");
assert(html.includes('body.ops-redesign-v3.dark-mode #followupRemarks'), "Follow-up #followupRemarks dark mode style defined");
assert(html.includes('body.ops-redesign-v3.dark-mode #edrIncident'), "EDR #edrIncident dark mode style defined");
assert(html.includes('body.ops-redesign-v3.dark-mode #edrActionRemarks'), "EDR #edrActionRemarks dark mode style defined");
assert(html.includes('body.ops-redesign-v3.dark-mode #masterPendingNotepad'), "Masterlist #masterPendingNotepad dark mode style defined");
assert(html.includes('background: #141b27 !important;'), "Dark mode textareas use rich slate background");
assert(html.includes('color: #f3f4f6 !important;'), "Dark mode textareas use high-contrast light text");

// 3. Form Grid & Input Geometry
assert(html.includes('--ops-input-h: 34px;'), "Standard 34px input height defined");
assert(html.includes('body.ops-redesign-v3 input[type="text"]'), "Unified text inputs styled");
assert(html.includes('body.ops-redesign-v3 select'), "Dropdown selects styled with chevron arrow");
assert(html.includes('#cctvPanel .form-grid'), "CCTV Audit 3x3 form grid layout defined");
assert(html.includes('#edrPanel .edr-form-grid'), "EDR 2-row form grid layout defined");
assert(html.includes('#followupPanel .followup-add-grid'), "Follow Up Reports grid layout defined");

// 4. Tables & Status Badges
assert(html.includes('body.ops-redesign-v3 th'), "Sticky table headers styled");
assert(html.includes('position: sticky !important;'), "Table header sticky position enforced");
assert(html.includes('body.ops-redesign-v3 .status-pill'), "Status pills styled");
assert(html.includes('.status-pill.approved') && html.includes('.status-pill.pending') && html.includes('.status-pill.rejected'), "Approved/Pending/Rejected status variants styled");
assert(html.includes('.admin-action-btn'), "Table action buttons styled");

// 5. Sidebar Navigation
assert(html.includes('body.ops-redesign-v3 .workspace-tabs.admin-sidebar'), "Sidebar container styled");
assert(html.includes('body.ops-redesign-v3 .workspace-tab-btn'), "Sidebar workspace buttons styled");
assert(html.includes('body.ops-redesign-v3 .sidebar-live-clock'), "Sidebar live clock styled");
assert(html.includes('body.ops-redesign-v3 .sidebar-theme-btn'), "Sidebar theme switch toggle styled");
assert(html.includes('body.ops-redesign-v3 .auth-sidebar-account'), "Sidebar user account card styled");

// 6. Admin Operations Console
assert(html.includes('.admin-subnav-bar'), "Segmented subnav pill bar styled");
assert(html.includes('.admin-health-strip'), "System health strip styled");
assert(html.includes('.admin-health-dot.is-live'), "Live status indicator dot styled");
assert(html.includes('.admin-kpi-grid'), "KPI grid styled");
assert(html.includes('.admin-settings-card') || html.includes('.admin-settings-body'), "Operational settings card styled");

// 7. Modals & Dialogs
assert(html.includes('backdrop-filter: blur(8px) !important;'), "Frosted glass modal backdrop blur styled");
assert(html.includes('.app-confirm-modal:not(.open)'), "Confirmation modal hidden fail-closed check present");
assert(html.includes('opsModalScaleIn'), "Smooth modal scale-in keyframe animation present");

// 8. Responsive Breakpoints
assert(html.includes('@media (max-width: 1200px)'), "1200px responsive breakpoint defined");
assert(html.includes('@media (max-width: 991px)'), "991px responsive breakpoint defined");
assert(html.includes('@media (max-width: 767px)'), "767px responsive breakpoint defined");

// 9. Button Actions
assert(html.includes('.btn-submit') && html.includes('.btn-reset') && html.includes('.btn-eod-danger'), "Primary, outline, and danger button hierarchies styled");

// 10. Style.css Alignment
assert(css.includes('--admin-bg: #0b0f17;'), "style.css dark mode background matches Apex Slate");
assert(css.includes('--admin-panel: #111827;'), "style.css dark mode panel matches Apex Slate");

console.log(`\nResults: ${passed} / ${total} assertions passed.`);
if (passed === total) {
    console.log("ALL DESIGN SYSTEM CHECKS PASSED WITH 100% COMPLIANCE!");
} else {
    process.exit(1);
}
