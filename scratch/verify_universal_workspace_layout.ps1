# ==========================================================
# VERIFICATION SUITE: UNIVERSAL WORKSPACE LAYOUT & FIXED HEADER CLEARANCE
# ==========================================================

$ErrorActionPreference = "Stop"
$failures = 0

function Assert-Condition($cond, $successMsg, $failMsg) {
    if ($cond) {
        Write-Host "[PASS] $successMsg" -ForegroundColor Green
    } else {
        Write-Host "[FAIL] $failMsg" -ForegroundColor Red
        $script:failures++
    }
}

Write-Host "=== VERIFYING UNIVERSAL WORKSPACE LAYOUT & FIXED HEADER ===" -ForegroundColor Cyan

# 1. Check UTF-8 without BOM
$htmlBytes = [System.IO.File]::ReadAllBytes("index.html")
$cssBytes  = [System.IO.File]::ReadAllBytes("style.css")

$htmlHasBom = ($htmlBytes.Length -ge 3 -and $htmlBytes[0] -eq 0xEF -and $htmlBytes[1] -eq 0xBB -and $htmlBytes[2] -eq 0xBF)
$cssHasBom  = ($cssBytes.Length -ge 3 -and $cssBytes[0] -eq 0xEF -and $cssBytes[1] -eq 0xBB -and $cssBytes[2] -eq 0xBF)

Assert-Condition (-not $htmlHasBom -and -not $cssHasBom) "index.html and style.css are clean UTF-8 without BOM" "BOM detected in index.html or style.css"

# 2. Check script.js is untouched in git
$gitDiffScript = (git diff --stat script.js | Out-String).Trim()
Assert-Condition ($gitDiffScript -eq "") "script.js is 100% untouched in git" "script.js has been modified!"

$html = [System.IO.File]::ReadAllText("index.html", [System.Text.Encoding]::UTF8)
$css  = [System.IO.File]::ReadAllText("style.css", [System.Text.Encoding]::UTF8)

# 3. Check All 8 Workspace Panels exist with .app-tab-panel
$panels = @(
    "cctvPanel",
    "maintenancePanel",
    "eodPanel",
    "pendingPanel",
    "followupPanel",
    "masterlistPanel",
    "adminPanel",
    "edrPanel"
)

foreach ($p in $panels) {
    $exists = $html -match "id=`"$p`"[^>]*class=`"[^`"]*app-tab-panel"
    Assert-Condition $exists "Workspace #$p has .app-tab-panel class" "Workspace #$p missing .app-tab-panel class"
}

# 4. Check CSS Variables for Fixed Header
Assert-Condition ($css -match '--ops-fixed-header-height:\s*44px') "style.css defines --ops-fixed-header-height: 44px" "Missing --ops-fixed-header-height: 44px"
Assert-Condition ($css -match '--ops-workspace-gap:\s*16px') "style.css defines --ops-workspace-gap: 16px" "Missing --ops-workspace-gap: 16px"
Assert-Condition ($css -match '--ops-page-gutter:\s*24px') "style.css defines --ops-page-gutter: 24px" "Missing --ops-page-gutter: 24px"
Assert-Condition ($css -match '--ops-workspace-radius:\s*12px') "style.css defines --ops-workspace-radius: 12px" "Missing --ops-workspace-radius: 12px"

# 5. Check Global Clearance Offset Below Fixed Header
Assert-Condition ($css -match 'body:not\(\.auth-locked\)\s*\{[^}]*padding-top:\s*calc\(var\(--ops-fixed-header-height\)\s*\+\s*var\(--ops-workspace-(top-)?gap\)\)\s*!important') "body:not(.auth-locked) reserves 60px (44px + 16px) clearance" "body padding-top clearance missing"
Assert-Condition ($css -match 'body\.auth-locked\s*\{[^}]*padding-top:\s*0\s*!important') "body.auth-locked removes top padding on login screen" "auth-locked padding-top not 0"
Assert-Condition ($css -match 'body\.auth-locked\s+\.ops-top-header\s*\{[^}]*display:\s*none\s*!important') "body.auth-locked hides ops-top-header" "auth-locked header display not none"

# 6. Check Universal Outer Workspace Shell Geometry (.app-tab-panel)
Assert-Condition ($css -match '\.app-tab-panel\s*\{[^}]*width:\s*calc\(100%\s*-\s*48px\)\s*!important') ".app-tab-panel has width: calc(100% - 48px) !important" "app-tab-panel width missing"
Assert-Condition ($css -match '\.app-tab-panel\s*\{[^}]*margin-left:\s*24px\s*!important') ".app-tab-panel has margin-left: 24px !important" "app-tab-panel margin-left missing"
Assert-Condition ($css -match '\.app-tab-panel\s*\{[^}]*margin-right:\s*24px\s*!important') ".app-tab-panel has margin-right: 24px !important" "app-tab-panel margin-right missing"
Assert-Condition ($css -match '\.app-tab-panel\s*\{[^}]*margin-bottom:\s*24px\s*!important') ".app-tab-panel has margin-bottom: 24px !important" "app-tab-panel margin-bottom missing"
Assert-Condition ($css -match '\.app-tab-panel\s*\{[^}]*padding:\s*20px\s*!important') ".app-tab-panel has padding: 20px !important" "app-tab-panel padding missing"
Assert-Condition ($css -match '\.app-tab-panel\s*\{[^}]*border-radius:\s*12px\s*!important') ".app-tab-panel has border-radius: 12px !important" "app-tab-panel border-radius missing"

# 7. Check Inactive and Hidden Panels Guard
Assert-Condition ($css -match '\.app-tab-panel:not\(\.active\),\s*\.app-tab-panel\[hidden\]\s*\{[^}]*display:\s*none\s*!important') "Inactive / hidden panels have display: none !important" "Inactive panel hide rule missing"
Assert-Condition ($css -match '\.app-tab-panel\.active\s*\{[^}]*display:\s*block\s*!important') "Active panel has display: block !important" "Active panel display: block missing"

# 8. Check Dark Mode Surface (#182231 and border)
Assert-Condition ($css -match 'body\.dark-mode\s+\.app-tab-panel[^}]*background:\s*#182231\s*!important') "Dark mode .app-tab-panel uses #182231 background" "Dark mode background missing"
Assert-Condition ($css -match 'body\.dark-mode\s+\.app-tab-panel[^}]*border:\s*1px\s+solid\s+rgba\(255,\s*255,\s*255,\s*0?\.07\)\s*!important') "Dark mode .app-tab-panel uses rgba(255,255,255,.07) border" "Dark mode border missing"

# 9. Check Light Mode Surface (#c7c9d5 and border)
Assert-Condition ($css -match 'body\.light-mode\s+\.app-tab-panel[^}]*background:\s*#c7c9d5\s*!important') "Light mode .app-tab-panel uses #c7c9d5 background" "Light mode background missing"
Assert-Condition ($css -match 'body\.light-mode\s+\.app-tab-panel[^}]*border:\s*1px\s+solid\s+rgba\(20,\s*22,\s*30,\s*0?\.08\)\s*!important') "Light mode .app-tab-panel uses rgba(20,22,30,.08) border" "Light mode border missing"

# 10. Check Redundant Inner Outer Wrappers Neutralized (No Double Shells)
Assert-Condition ($css -match '\.app-tab-panel\s*>\s*\.container[^}]*background:\s*transparent\s*!important') "Redundant inner wrappers neutralized to transparent" "Inner wrappers not transparent"
Assert-Condition ($css -match '\.app-tab-panel\s*>\s*\.container[^}]*border:\s*none\s*!important') "Redundant inner wrappers neutralized to border none" "Inner wrappers border not none"
Assert-Condition ($css -match '\.app-tab-panel\s*>\s*\.container[^}]*padding:\s*0\s*!important') "Redundant inner wrappers neutralized to padding 0" "Inner wrappers padding not 0"

# 11. Check Standardized Workspace Titles & Lead Text
Assert-Condition ($css -match '\.app-tab-panel\s+h2:first-of-type[^}]*font-size:\s*20px\s*!important') "Workspace titles normalized to font-size: 20px" "Title font-size not 20px"
Assert-Condition ($css -match '\.app-tab-panel\s+h2:first-of-type[^}]*font-weight:\s*700\s*!important') "Workspace titles normalized to font-weight: 700" "Title font-weight not 700"
Assert-Condition ($css -match '\.app-tab-panel\s+h2:first-of-type[^}]*margin:\s*0\s+0\s+4px\s*!important') "Workspace titles normalized to margin: 0 0 4px" "Title margin not 0 0 4px"
Assert-Condition ($css -match '\.app-tab-panel\s+\.page-lead[^}]*margin:\s*0\s+0\s+18px\s*!important') "Workspace description normalized to margin: 0 0 18px" "Lead margin not 0 0 18px"

# 12. Check Maintenance Report Full-Width Alignment
Assert-Condition ($css -match '#eodPanel\s*\.simple-eod-top[^}]*width:\s*100%\s*!important') "Maintenance top tracker has width: 100% !important" "Tracker width not 100%"
Assert-Condition ($css -match '#eodPanel\s*\.simple-eod-top[^}]*margin-left:\s*0\s*!important') "Maintenance top tracker margin-left: 0 !important" "Tracker margin-left not 0"
Assert-Condition ($css -match '#eodPanel\s*\.simple-eod-top[^}]*margin-right:\s*0\s*!important') "Maintenance top tracker margin-right: 0 !important" "Tracker margin-right not 0"
Assert-Condition ($css -match '#eodPanel\s*\.simple-eod-actions[^}]*width:\s*100%\s*!important') "Maintenance actions toolbar has width: 100% !important" "Actions toolbar width not 100%"
Assert-Condition ($css -match '#eodPanel\s*\.simple-eod-actions[^}]*flex-wrap:\s*wrap\s*!important') "Maintenance actions toolbar has flex-wrap: wrap !important" "Toolbar wrapping not enabled"
Assert-Condition ($css -match '#eodPanel\s*\.eod-block[^}]*width:\s*100%\s*!important') "Maintenance report block has width: 100% !important" "Report block width not 100%"
Assert-Condition ($css -match '#eodPanel\s*\.eod-block[^}]*margin-left:\s*0\s*!important') "Maintenance report block has margin-left: 0 !important" "Report block margin-left not 0"
Assert-Condition ($css -match '#eodPanel\s*\.eod-block[^}]*margin-right:\s*0\s*!important') "Maintenance report block has margin-right: 0 !important" "Report block margin-right not 0"
Assert-Condition ($css -match '#eodPanel\s*\.eod-block-content[^}]*width:\s*100%\s*!important') "Maintenance block content has width: 100% !important" "Block content width not 100%"
Assert-Condition ($css -match '#eodPanel\s*\.eod-block-data[^}]*width:\s*100%\s*!important') "Maintenance paste lanes has width: 100% !important" "Paste lanes width not 100%"
Assert-Condition ($css -match '#eodPanel\s*\.eod-proof-zone[^}]*width:\s*100%\s*!important') "Maintenance screenshot dropzone has width: 100% !important" "Proof zone width not 100%"
Assert-Condition ($css -match '#eodPanel\s*\.remarks-section[^}]*width:\s*100%\s*!important') "Maintenance remarks section has width: 100% !important" "Remarks section width not 100%"
Assert-Condition ($css -match '#eodPanel\s*\.eod-add-next[^}]*width:\s*100%\s*!important') "Maintenance add-next button has width: 100% !important" "Add-next button width not 100%"

# 13. Check HTML synchronized rules
Assert-Condition ($html -match '\.app-tab-panel\s*\{[^}]*width:\s*calc\(100%\s*-\s*48px\)\s*!important') "index.html has synchronized .app-tab-panel width rule" "index.html app-tab-panel rule missing"
Assert-Condition ($html -match 'body:not\(\.auth-locked\)\s*\{[^}]*padding-top:\s*calc\(var\(--ops-fixed-header-height\)\s*\+\s*var\(--ops-workspace-(top-)?gap\)\)\s*!important') "index.html has synchronized clearance offset rule" "index.html clearance offset rule missing"

Write-Host "=================================================" -ForegroundColor Cyan
if ($failures -eq 0) {
    Write-Host "ALL UNIVERSAL WORKSPACE VERIFICATION CHECKS PASSED!" -ForegroundColor Green
    exit 0
} else {
    Write-Host "$failures CHECKS FAILED!" -ForegroundColor Red
    exit 1
}
