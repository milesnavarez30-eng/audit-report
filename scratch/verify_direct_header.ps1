# scratch/verify_direct_header.ps1
$ErrorActionPreference = "Stop"

Write-Host "=== VERIFYING CCTV OPS DIRECT HEADER NAVIGATION ===" -ForegroundColor Cyan

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

# 3. Check legacy sidebar retained in DOM
$legacyIds = @(
    "edrTabBtn", "cctvTabBtn", "maintenanceTabBtn", "eodTabBtn",
    "masterlistTabBtn", "followupTabBtn", "globalHistoryBtn", "adminTabBtn",
    "cctvEdrSentCount", "masterlistSidebarBadge", "followupSidebarBadge",
    "globalHistoryCount", "adminPendingCount",
    "authSidebarName", "authSidebarEmail", "authLogoutBtn", "themeToggle"
)

foreach ($id in $legacyIds) {
    Assert-Condition ($html -match "id=""$id""") "Legacy element #$id present in DOM" "Missing legacy element #$id"
}

# 4. Check new direct header elements
$directIds = @(
    "opsTopHeader", "opsThemeSlot", "opsDirectHeaderNav",
    "opsDirectEdr", "opsDirectCctv", "opsDirectCctvCount",
    "opsDirectAiSorter", "opsDirectMaintenance",
    "opsDirectMasterlist", "opsDirectMasterlistStatus",
    "opsDirectFollowup", "opsDirectFollowupCount",
    "opsDirectHistory", "opsDirectHistoryCount",
    "opsDirectAccounts", "opsDirectAccountsCount",
    "opsDirectDate", "opsDirectTime",
    "opsDirectUserName", "opsDirectUserEmail", "opsDirectLogout"
)

foreach ($id in $directIds) {
    Assert-Condition ($html -match "id=""$id""") "Direct header element #$id present in DOM" "Missing direct header element #$id"
}

# 5. Check brand is plain text and not clickable
Assert-Condition ($html -match '<span class="ops-direct-brand">CCTV OPS</span>') "Brand is non-clickable plain text span" "Brand is not plain text span"
Assert-Condition ($css -match '\.ops-direct-brand\s*\{[^}]*cursor:\s*default') "Brand cursor: default in CSS" "Brand cursor not default in CSS"

# 6. Check old grouping menus are completely gone
Assert-Condition ($html -notmatch 'id="opsWorkspaceBtn"') "opsWorkspaceBtn completely removed" "opsWorkspaceBtn still in DOM"
Assert-Condition ($html -notmatch 'id="opsWorkspaceMenu"') "opsWorkspaceMenu completely removed" "opsWorkspaceMenu still in DOM"
Assert-Condition ($html -notmatch 'id="opsToolsBtn"') "opsToolsBtn completely removed" "opsToolsBtn still in DOM"
Assert-Condition ($html -notmatch 'id="opsToolsMenu"') "opsToolsMenu completely removed" "opsToolsMenu still in DOM"
Assert-Condition ($html -notmatch 'id="opsContextNav"') "opsContextNav completely removed" "opsContextNav still in DOM"

# 7. Check CSS classes
Assert-Condition ($css -match '\.ops-direct-header-nav\s*\{[^}]*justify-content:\s*center') "Direct header navigation is centered across full viewport" "Header nav not centered"
Assert-Condition ($css -match '\.ops-top-header \.ops-direct-nav-btn\.active::after\s*\{[^}]*height:\s*1px') "Active tab has 1px bottom underline indicator" "Active tab missing 1px underline"
Assert-Condition ($css -match 'body\.auth-locked \.ops-top-header\s*\{[^}]*display:\s*none\s*!important') "Auth-locked hides ops-top-header" "Auth-locked rule missing"

# 8. Check JS controller
Assert-Condition ($html -match 'id="opsHeaderShellController"') "opsHeaderShellController script present" "opsHeaderShellController missing"
Assert-Condition ($html -match 'clickOriginal\(original\.edr\)') "edr proxies to original.edr" "edr proxy missing"
Assert-Condition ($html -match 'clickOriginal\(original\.cctv\)') "cctv proxies to original.cctv" "cctv proxy missing"
Assert-Condition ($html -match 'clickOriginal\(original\.aiSorter\)') "aiSorter proxies to original.aiSorter" "aiSorter proxy missing"
Assert-Condition ($html -match 'clickOriginal\(original\.maintenance\)') "maintenance proxies to original.maintenance" "maintenance proxy missing"
Assert-Condition ($html -match 'clickOriginal\(original\.masterlist\)') "masterlist proxies to original.masterlist" "masterlist proxy missing"
Assert-Condition ($html -match 'clickOriginal\(original\.followup\)') "followup proxies to original.followup" "followup proxy missing"
Assert-Condition ($html -match 'clickOriginal\(original\.history\)') "history proxies to original.history" "history proxy missing"
Assert-Condition ($html -match 'clickOriginal\(original\.accounts\)') "accounts proxies to original.accounts" "accounts proxy missing"
Assert-Condition ($html -match 'syncBadges\(\)') "syncBadges dynamically updates counts" "syncBadges missing"
Assert-Condition ($html -match 'syncPermissions\(\)') "syncPermissions dynamically updates permissions" "syncPermissions missing"

Write-Host "=================================================" -ForegroundColor Cyan
if ($failures -eq 0) {
    Write-Host "ALL VERIFICATION CHECKS PASSED!" -ForegroundColor Green
    exit 0
} else {
    Write-Host "$failures CHECKS FAILED!" -ForegroundColor Red
    exit 1
}
