# verify_ops_exact_header_shell.ps1
$ErrorActionPreference = "Stop"

Write-Host "=== VERIFYING EXACT CCTV OPS NAVIGATION SHELL ===" -ForegroundColor Cyan

$htmlPath = "index.html"
$cssPath = "style.css"
$jsPath = "script.js"

$html = [System.IO.File]::ReadAllText((Resolve-Path $htmlPath))
$css = [System.IO.File]::ReadAllText((Resolve-Path $cssPath))

$failures = 0

function Assert-Condition($condition, $successMessage, $failMessage) {
    if ($condition) {
        Write-Host "[PASS] $successMessage" -ForegroundColor Green
    } else {
        Write-Host "[FAIL] $failMessage" -ForegroundColor Red
        $script:failures++
    }
}

# 1. Check UTF-8 BOM
$htmlBytes = [System.IO.File]::ReadAllBytes((Resolve-Path $htmlPath))
$cssBytes = [System.IO.File]::ReadAllBytes((Resolve-Path $cssPath))
$hasBOMHtml = ($htmlBytes.Length -ge 3 -and $htmlBytes[0] -eq 0xEF -and $htmlBytes[1] -eq 0xBB -and $htmlBytes[2] -eq 0xBF)
$hasBOMCss = ($cssBytes.Length -ge 3 -and $cssBytes[0] -eq 0xEF -and $cssBytes[1] -eq 0xBB -and $cssBytes[2] -eq 0xBF)
Assert-Condition (-not $hasBOMHtml -and -not $hasBOMCss) "index.html and style.css are clean UTF-8 without BOM" "BOM detected in files!"

# 2. Check script.js is 100% untouched
$gitDiffJs = git diff --name-only script.js
Assert-Condition ([string]::IsNullOrWhiteSpace($gitDiffJs)) "script.js is 100% untouched in git" "script.js has git diff!"

# 3. Old sidebar retained in DOM with legacy IDs
Assert-Condition ($html -match '<aside class="workspace-tabs admin-sidebar"[^>]*>') "Original <aside class='workspace-tabs admin-sidebar'> present in DOM" "Missing original aside"
Assert-Condition ($html -match 'id="edrTabBtn"') "Legacy #edrTabBtn present in DOM" "Missing #edrTabBtn"
Assert-Condition ($html -match 'id="cctvTabBtn"') "Legacy #cctvTabBtn present in DOM" "Missing #cctvTabBtn"
Assert-Condition ($html -match 'id="maintenanceTabBtn"') "Legacy #maintenanceTabBtn present in DOM" "Missing #maintenanceTabBtn"
Assert-Condition ($html -match 'id="eodTabBtn"') "Legacy #eodTabBtn present in DOM" "Missing #eodTabBtn"
Assert-Condition ($html -match 'id="masterlistTabBtn"') "Legacy #masterlistTabBtn present in DOM" "Missing #masterlistTabBtn"
Assert-Condition ($html -match 'id="followupTabBtn"') "Legacy #followupTabBtn present in DOM" "Missing #followupTabBtn"
Assert-Condition ($html -match 'id="globalHistoryBtn"') "Legacy #globalHistoryBtn present in DOM" "Missing #globalHistoryBtn"
Assert-Condition ($html -match 'id="adminTabBtn"') "Legacy #adminTabBtn present in DOM" "Missing #adminTabBtn"
Assert-Condition ($html -match 'id="authLogoutBtn"') "Legacy #authLogoutBtn present in DOM" "Missing #authLogoutBtn"
Assert-Condition ($html -match 'id="themeToggle"') "Legacy #themeToggle present in DOM" "Missing #themeToggle"

# 4. Old sidebar hidden visually only in CSS
Assert-Condition ($css -match 'aside\.workspace-tabs\.admin-sidebar\s*\{[^}]*position:\s*fixed\s*!important') "Old sidebar position: fixed !important in CSS" "aside position not fixed"
Assert-Condition ($css -match 'aside\.workspace-tabs\.admin-sidebar\s*\{[^}]*opacity:\s*0\s*!important') "Old sidebar opacity: 0 !important in CSS" "aside opacity not 0"
Assert-Condition ($css -match 'aside\.workspace-tabs\.admin-sidebar\s*\{[^}]*visibility:\s*hidden\s*!important') "Old sidebar visibility: hidden !important in CSS" "aside visibility not hidden"

# 5. Exactly ONE visible header (#opsTopHeader) and contextual nav (#opsContextNav)
Assert-Condition ($html -match 'id="opsTopHeader"\s+class="ops-top-header"') "Exact #opsTopHeader exists" "Missing #opsTopHeader"
Assert-Condition ($html -match 'id="opsContextNav"\s+class="ops-context-nav"\s+hidden') "Exact #opsContextNav exists and starts hidden" "Missing #opsContextNav or not hidden"
Assert-Condition ($html -notmatch 'id="cctvTopHeader"') "Previous #cctvTopHeader completely removed" "#cctvTopHeader still in DOM"
Assert-Condition ($html -notmatch 'id="cctvWorkspaceSubheader"') "Previous #cctvWorkspaceSubheader completely removed" "#cctvWorkspaceSubheader still in DOM"

# 6. Brand element is plain text span, NOT clickable
Assert-Condition ($html -match '<span class="ops-header-brand" aria-label="CCTV OPS">\s*CCTV OPS\s*</span>') "CCTV OPS brand is plain non-clickable text span" "Brand is not plain text span"
Assert-Condition ($css -match '\.ops-header-brand\s*\{[^}]*cursor:\s*default') "Brand cursor: default in CSS" "Brand cursor not default"

# 7. Workspace menu elements
Assert-Condition ($html -match 'id="opsWorkspaceBtn"') "#opsWorkspaceBtn button exists" "Missing #opsWorkspaceBtn"
Assert-Condition ($html -match 'id="opsWorkspaceMenu"') "#opsWorkspaceMenu container exists" "Missing #opsWorkspaceMenu"
Assert-Condition ($html -match 'id="opsOpenMaintenance"') "#opsOpenMaintenance row exists" "Missing #opsOpenMaintenance"
Assert-Condition ($html -match 'id="opsOpenCctvReport"') "#opsOpenCctvReport row exists" "Missing #opsOpenCctvReport"
Assert-Condition ($html -match 'id="opsOpenMasterlist"') "#opsOpenMasterlist row exists" "Missing #opsOpenMasterlist"
Assert-Condition ($html -match 'id="opsMasterlistStatus"') "#opsMasterlistStatus meta exists" "Missing #opsMasterlistStatus"

# 8. Tools menu elements
Assert-Condition ($html -match 'id="opsToolsBtn"') "#opsToolsBtn button exists" "Missing #opsToolsBtn"
Assert-Condition ($html -match 'id="opsToolsMenu"') "#opsToolsMenu container exists" "Missing #opsToolsMenu"
Assert-Condition ($html -match 'id="opsOpenHistory"') "#opsOpenHistory row exists" "Missing #opsOpenHistory"
Assert-Condition ($html -match 'id="opsOpenAccounts"') "#opsOpenAccounts row exists" "Missing #opsOpenAccounts"
Assert-Condition ($html -match 'id="opsHistoryCount"') "#opsHistoryCount meta exists" "Missing #opsHistoryCount"
Assert-Condition ($html -match 'id="opsAccountsCount"') "#opsAccountsCount meta exists" "Missing #opsAccountsCount"
Assert-Condition ($html -match 'id="opsHeaderUserName"') "#opsHeaderUserName exists" "Missing #opsHeaderUserName"
Assert-Condition ($html -match 'id="opsHeaderUserEmail"') "#opsHeaderUserEmail exists" "Missing #opsHeaderUserEmail"
Assert-Condition ($html -match 'id="opsHeaderLogout"') "#opsHeaderLogout row exists" "Missing #opsHeaderLogout"

# 9. Clock elements
Assert-Condition ($html -match 'id="opsHeaderDate"') "#opsHeaderDate exists" "Missing #opsHeaderDate"
Assert-Condition ($html -match 'id="opsHeaderTime"') "#opsHeaderTime exists" "Missing #opsHeaderTime"

# 10. Context nav tabs
Assert-Condition ($html -match 'id="opsContextTitle"') "#opsContextTitle exists" "Missing #opsContextTitle"
Assert-Condition ($html -match 'id="opsMaintenanceTabs"') "#opsMaintenanceTabs container exists" "Missing #opsMaintenanceTabs"
Assert-Condition ($html -match 'id="opsAiSorterTab"') "#opsAiSorterTab exists" "Missing #opsAiSorterTab"
Assert-Condition ($html -match 'id="opsMaintenanceReportTab"') "#opsMaintenanceReportTab exists" "Missing #opsMaintenanceReportTab"
Assert-Condition ($html -match 'id="opsCctvReportTabs"') "#opsCctvReportTabs container exists" "Missing #opsCctvReportTabs"
Assert-Condition ($html -match 'id="opsCctvAuditTab"') "#opsCctvAuditTab exists" "Missing #opsCctvAuditTab"
Assert-Condition ($html -match 'id="opsEdrTab"') "#opsEdrTab exists" "Missing #opsEdrTab"
Assert-Condition ($html -match 'id="opsFollowupTab"') "#opsFollowupTab exists" "Missing #opsFollowupTab"
Assert-Condition ($html -match 'id="opsCctvCount"') "#opsCctvCount exists" "Missing #opsCctvCount"
Assert-Condition ($html -match 'id="opsFollowupCount"') "#opsFollowupCount exists" "Missing #opsFollowupCount"

# 11. CSS always black header
Assert-Condition ($css -match 'body\.light-mode\s+\.ops-top-header,[^}]*background:\s*#000000\s*!important') "Header forced black in light mode and dark mode" "Header not forced black"

# 12. Requirements 31-41: Context nav floating & plain text tabs
Assert-Condition ($css -match '\.ops-context-nav\s*\{[^}]*background:\s*transparent\s*!important') "Context nav background is transparent !important" "Context nav background is not transparent"
Assert-Condition ($css -match '\.ops-context-nav\s*\{[^}]*border:\s*none\s*!important') "Context nav border is none !important" "Context nav has border"
Assert-Condition ($css -match '\.ops-context-nav\s*\{[^}]*box-shadow:\s*none\s*!important') "Context nav box-shadow is none !important" "Context nav has box-shadow"
Assert-Condition ($css -match '#opsContextTitle[^{]*\{[^}]*display:\s*none\s*!important') "#opsContextTitle is visually hidden via display: none !important" "#opsContextTitle not hidden"
Assert-Condition ($css -match '\.ops-context-tab\s*\{[^}]*background:\s*transparent\s*!important') "Context tabs background is transparent !important" "Context tabs background not transparent"
Assert-Condition ($css -match '\.ops-context-tab\s*\{[^}]*border:\s*none\s*!important') "Context tabs border is none !important" "Context tabs have border"
Assert-Condition ($css -match '\.ops-context-tab\s*\{[^}]*border-radius:\s*0\s*!important') "Context tabs border-radius is 0 !important" "Context tabs have border-radius"
Assert-Condition ($css -match '\.ops-context-tab\s*\{[^}]*padding:\s*8px\s*2px\s*!important') "Context tabs padding is 8px 2px !important" "Context tabs wrong padding"
Assert-Condition ($css -match '\.ops-context-tab\s*\{[^}]*font-size:\s*11px\s*!important') "Context tabs font-size is 11px !important" "Context tabs wrong font size"
Assert-Condition ($css -match '\.ops-context-tab\.active::after\s*\{[^}]*height:\s*1px\s*!important') "Active tab has 1px bottom underline indicator" "Active tab missing 1px underline"
Assert-Condition ($css -match '\.ops-context-tab:hover[^{]*\{[^}]*transform:\s*scale\(1\.04\)\s*!important') "Hover tab scales slightly by 1.04 without background cell" "Hover tab scale missing"
Assert-Condition ($css -match '--ops-context-height:\s*32px') "Context row height is compact 32px" "Context row height is not 32px"

# 13. Requirement 40: Global button exclusions
Assert-Condition ($css -match ':not\(\.ops-header-text-btn\):not\(\.ops-context-tab\):not\(\.ops-menu-row\)') "style.css excludes ops navigation controls from global button styles" "style.css global button rule missing exclusions"
Assert-Condition ($html -match ':not\(\.ops-header-text-btn\):not\(\.ops-context-tab\):not\(\.ops-menu-row\)') "index.html excludes ops navigation controls from global button styles" "index.html global button rule missing exclusions"

# 14. Javascript controller
Assert-Condition ($html -match 'id="opsHeaderShellController"') "opsHeaderShellController script added to index.html" "Missing opsHeaderShellController"
Assert-Condition ($html -match 'triggerLegacy\(legacy\.maintenanceReportBtn\)') "triggerLegacy properly wires to existing buttons" "triggerLegacy wiring missing"
Assert-Condition ($html -match 'new MutationObserver') "MutationObserver monitors legacy badge and user updates" "MutationObserver missing"

Write-Host "=================================================" -ForegroundColor Cyan
if ($failures -eq 0) {
    Write-Host "ALL VERIFICATION CHECKS PASSED!" -ForegroundColor Green
    exit 0
} else {
    Write-Host "$failures CHECKS FAILED!" -ForegroundColor Red
    exit 1
}
