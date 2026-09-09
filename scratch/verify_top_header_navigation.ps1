# verify_top_header_navigation.ps1
$ErrorActionPreference = "Stop"

Write-Host "=== VERIFYING TOP HEADER NAVIGATION ARCHITECTURE ===" -ForegroundColor Cyan

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
$hasBOM = ($htmlBytes.Length -ge 3 -and $htmlBytes[0] -eq 0xEF -and $htmlBytes[1] -eq 0xBB -and $htmlBytes[2] -eq 0xBF)
Assert-Condition (-not $hasBOM) "index.html does not contain UTF-8 BOM" "index.html contains UTF-8 BOM!"

# 2. Check script.js is 100% untouched
$gitDiffJs = git diff --name-only script.js
Assert-Condition ([string]::IsNullOrWhiteSpace($gitDiffJs)) "script.js is 100% untouched in git" "script.js has git diff!"

# 3. Permanent Left Sidebar removed from layout
Assert-Condition ($html -notmatch '<aside class="workspace-tabs admin-sidebar">') "Old visible permanent sidebar markup removed" "Old visible permanent sidebar markup still exists!"
Assert-Condition ($css -match '--admin-sidebar:\s*0px\s*!important') "--admin-sidebar set to 0px !important in CSS" "Missing --admin-sidebar: 0px !important"
Assert-Condition ($css -match 'body\.ops-redesign-v3[^{]*\{[^}]*padding:\s*0') "body.ops-redesign-v3 has zero padding in CSS" "body padding not zeroed"

# 4. Top Header Structure
Assert-Condition ($html -match 'id="cctvTopHeader"\s+class="cctv-top-header"') "Top header #cctvTopHeader exists" "Missing #cctvTopHeader"
Assert-Condition ($html -match 'class="cctv-header-left"[^>]*>[\s\S]*?id="themeToggle"') "#themeToggle positioned in .cctv-header-left" "#themeToggle not in header left"
Assert-Condition ($html -match 'class="cctv-header-center"') ".cctv-header-center exists" "Missing .cctv-header-center"
Assert-Condition ($html -match 'id="cctvBrandBtn"') "#cctvBrandBtn brand text exists" "Missing #cctvBrandBtn"

# 5. Workspace Menu
Assert-Condition ($html -match 'id="headerWorkspaceBtn"') "#headerWorkspaceBtn exists" "Missing #headerWorkspaceBtn"
Assert-Condition ($html -match 'id="cctvWorkspaceMenu"') "#cctvWorkspaceMenu container exists" "Missing #cctvWorkspaceMenu"
Assert-Condition ($html -match 'id="menuItemMaintenance"') "#menuItemMaintenance exists" "Missing #menuItemMaintenance"
Assert-Condition ($html -match 'id="menuItemCctvReport"') "#menuItemCctvReport exists" "Missing #menuItemCctvReport"
Assert-Condition ($html -match 'id="menuItemMasterlist"') "#menuItemMasterlist exists" "Missing #menuItemMasterlist"

# 6. Tools Menu
Assert-Condition ($html -match 'id="headerToolsBtn"') "#headerToolsBtn exists" "Missing #headerToolsBtn"
Assert-Condition ($html -match 'id="cctvToolsMenu"') "#cctvToolsMenu container exists" "Missing #cctvToolsMenu"
Assert-Condition ($html -match 'id="globalHistoryBtn"') "#globalHistoryBtn exists in tools menu" "Missing #globalHistoryBtn"
Assert-Condition ($html -match 'id="globalHistoryCount"') "#globalHistoryCount count badge exists" "Missing #globalHistoryCount"
Assert-Condition ($html -match 'id="adminTabBtn"') "#adminTabBtn exists in tools menu" "Missing #adminTabBtn"
Assert-Condition ($html -match 'id="adminPendingCount"') "#adminPendingCount badge exists" "Missing #adminPendingCount"
Assert-Condition ($html -match 'id="authSidebarAccount"') "#authSidebarAccount exists in tools menu" "Missing #authSidebarAccount"
Assert-Condition ($html -match 'id="authLogoutBtn"') "#authLogoutBtn exists in tools menu" "Missing #authLogoutBtn"

# 7. Live Clock in Header
Assert-Condition ($html -match 'class="cctv-header-clock"\s+id="sidebarLiveClock"') "#sidebarLiveClock in top header" "Missing #sidebarLiveClock in top header"
Assert-Condition ($html -match 'id="Manila_z42c"') "#Manila_z42c live clock container in header" "Missing #Manila_z42c in header"

# 8. Workspace Subheader and Internal Tabs
Assert-Condition ($html -match 'id="cctvWorkspaceSubheader"') "#cctvWorkspaceSubheader exists" "Missing #cctvWorkspaceSubheader"
Assert-Condition ($html -match 'id="cctvCurrentWorkspaceTitle"') "#cctvCurrentWorkspaceTitle heading exists" "Missing #cctvCurrentWorkspaceTitle"
Assert-Condition ($html -match 'id="tabsMaintenance"') "#tabsMaintenance tablist exists" "Missing #tabsMaintenance"
Assert-Condition ($html -match 'id="tabBtnAiSorter"') "#tabBtnAiSorter exists" "Missing #tabBtnAiSorter"
Assert-Condition ($html -match 'id="tabBtnMaintenanceReport"') "#tabBtnMaintenanceReport exists" "Missing #tabBtnMaintenanceReport"
Assert-Condition ($html -match 'id="tabsCctvReport"') "#tabsCctvReport tablist exists" "Missing #tabsCctvReport"
Assert-Condition ($html -match 'id="tabBtnCctvAudit"') "#tabBtnCctvAudit exists" "Missing #tabBtnCctvAudit"
Assert-Condition ($html -match 'id="tabBtnEdr"') "#tabBtnEdr exists" "Missing #tabBtnEdr"
Assert-Condition ($html -match 'id="tabBtnFollowup"') "#tabBtnFollowup exists" "Missing #tabBtnFollowup"

# 9. Legacy Controls Preservation
Assert-Condition ($html -match 'id="legacySidebarControls"') "#legacySidebarControls backward-compatibility container exists" "Missing #legacySidebarControls"
Assert-Condition ($html -match 'id="sidebarToggle"') "#sidebarToggle preserved for backward compatibility" "Missing #sidebarToggle"
Assert-Condition ($html -match 'id="cctvTabBtn"') "#cctvTabBtn preserved" "Missing #cctvTabBtn"
Assert-Condition ($html -match 'id="edrTabBtn"') "#edrTabBtn preserved" "Missing #edrTabBtn"
Assert-Condition ($html -match 'id="maintenanceTabBtn"') "#maintenanceTabBtn preserved" "Missing #maintenanceTabBtn"
Assert-Condition ($html -match 'id="eodTabBtn"') "#eodTabBtn preserved" "Missing #eodTabBtn"
Assert-Condition ($html -match 'id="masterlistTabBtn"') "#masterlistTabBtn preserved" "Missing #masterlistTabBtn"
Assert-Condition ($html -match 'id="followupTabBtn"') "#followupTabBtn preserved" "Missing #followupTabBtn"

# 10. No Navigation Icons in Header / Subheader / Tabs
$headerSection = ""
if ($html -match '(?s)(<header id="cctvTopHeader".*?</header>)') {
    $headerSection = $matches[1]
}
$hasSvgInHeaderNav = ($headerSection -match '<svg')
Assert-Condition (-not $hasSvgInHeaderNav) "Zero SVG / icons in top header navigation" "Found SVG/icon in top header navigation!"

$subheaderSection = ""
if ($html -match '(?s)(<div id="cctvWorkspaceSubheader".*?</div>\s*</div>\s*</div>)') {
    $subheaderSection = $matches[1]
}
$hasSvgInSubheader = ($subheaderSection -match '<svg')
Assert-Condition (-not $hasSvgInSubheader) "Zero SVG / icons in subheader / internal tabs" "Found SVG/icon in subheader / internal tabs!"

# 11. Navigation Isolation Script
Assert-Condition ($html -match 'syncHeaderNavigation\(activePanelId\)') "syncHeaderNavigation function integrated in isolation guard" "syncHeaderNavigation missing"
Assert-Condition ($html -match 'initTopHeaderNavigation\(\)') "initTopHeaderNavigation function integrated" "initTopHeaderNavigation missing"

Write-Host "=================================================" -ForegroundColor Cyan
if ($failures -eq 0) {
    Write-Host "ALL VERIFICATION CHECKS PASSED!" -ForegroundColor Green
    exit 0
} else {
    Write-Host "$failures CHECKS FAILED!" -ForegroundColor Red
    exit 1
}
