# ==========================================================
# VERIFICATION SUITE: THEME GEOMETRY INVARIANCE (DARK <-> LIGHT)
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

Write-Host "=== VERIFYING THEME GEOMETRY INVARIANCE ===" -ForegroundColor Cyan

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

# 3. Check shared root variables in both style.css and index.html
Assert-Condition ($css -match '--ops-fixed-header-height:\s*44px') "style.css has --ops-fixed-header-height: 44px" "style.css missing fixed header height"
Assert-Condition ($css -match '--ops-workspace-top-gap:\s*16px') "style.css has --ops-workspace-top-gap: 16px" "style.css missing workspace top gap"
Assert-Condition ($html -match '--ops-fixed-header-height:\s*44px') "index.html has --ops-fixed-header-height: 44px" "index.html missing fixed header height"
Assert-Condition ($html -match '--ops-workspace-top-gap:\s*16px') "index.html has --ops-workspace-top-gap: 16px" "index.html missing workspace top gap"

# 4. Check shared content offset below fixed header
Assert-Condition ($css -match 'body:not\(\.auth-locked\)\s*\{[^}]*padding-top:\s*calc\(var\(--ops-fixed-header-height\)\s*\+\s*var\(--ops-workspace-top-gap\)\)\s*!important') "style.css has unified clearance offset on body" "style.css clearance offset missing"
Assert-Condition ($html -match 'body:not\(\.auth-locked\)\s*\{[^}]*padding-top:\s*calc\(var\(--ops-fixed-header-height\)\s*\+\s*var\(--ops-workspace-top-gap\)\)\s*!important') "index.html has unified clearance offset on body" "index.html clearance offset missing"

# 5. Check that NO theme-specific padding-top or margin-top overrides exist on body
$bodyThemePadding = ($css -match 'body\.(?:light-mode|dark-mode)[^{]*\{[^}]*padding-top:') -or ($html -match 'body\.(?:light-mode|dark-mode)[^{]*\{[^}]*padding-top:')
Assert-Condition (-not $bodyThemePadding) "Zero theme-specific padding-top on body in both files" "body theme padding-top found!"

# 6. Check that NO rules strip padding or margin from #eodPanel.app-tab-panel in Light Mode
$eodLightStrip = ($html -match '(?:body\.light-mode|\[data-theme="light"\])[^{]*#eodPanel\.app-tab-panel[^{]*\{[^}]*(padding:\s*0|margin:\s*0)') -or
                 ($css -match '(?:body\.light-mode|\[data-theme="light"\])[^{]*#eodPanel\.app-tab-panel[^{]*\{[^}]*(padding:\s*0|margin:\s*0)')
Assert-Condition (-not $eodLightStrip) "Zero rules stripping padding or margin from #eodPanel in Light Mode" "Light mode stripping rule detected!"

# 7. Check panel geometry guard across all panels and themes
Assert-Condition ($css -match 'body\.light-mode\s+\.app-tab-panel,[^}]*width:\s*calc\(100%\s*-\s*48px\)\s*!important') "style.css locks .app-tab-panel width across themes" "app-tab-panel width guard missing"
Assert-Condition ($css -match 'body\.light-mode\s+\.app-tab-panel,[^}]*padding:\s*20px\s*!important') "style.css locks .app-tab-panel padding: 20px across themes" "app-tab-panel padding guard missing"
Assert-Condition ($css -match 'body\.light-mode\s+\.app-tab-panel,[^}]*margin-left:\s*24px\s*!important') "style.css locks .app-tab-panel margin-left: 24px across themes" "app-tab-panel margin guard missing"

Assert-Condition ($html -match 'body\.light-mode\s+\.app-tab-panel,[^}]*width:\s*calc\(100%\s*-\s*48px\)\s*!important') "index.html locks .app-tab-panel width across themes" "index.html app-tab-panel width guard missing"
Assert-Condition ($html -match 'body\.light-mode\s+\.app-tab-panel,[^}]*padding:\s*20px\s*!important') "index.html locks .app-tab-panel padding: 20px across themes" "index.html app-tab-panel padding guard missing"
Assert-Condition ($html -match 'body\.light-mode\s+\.app-tab-panel,[^}]*margin-left:\s*24px\s*!important') "index.html locks .app-tab-panel margin-left: 24px across themes" "index.html app-tab-panel margin guard missing"

# 8. Check Dark Mode Surface (#182231 and border)
Assert-Condition ($css -match 'body\.dark-mode\s+\.app-tab-panel[^}]*background:\s*#182231\s*!important') "Dark mode .app-tab-panel has background: #182231" "Dark mode background missing"
Assert-Condition ($css -match 'body\.dark-mode\s+\.app-tab-panel[^}]*border:\s*1px\s+solid\s+rgba\(255,\s*255,\s*255,\s*0?\.07\)\s*!important') "Dark mode .app-tab-panel has rgba(255,255,255,.07) border" "Dark mode border missing"

# 9. Check Light Mode Surface (#c7c9d5 and border)
Assert-Condition ($css -match 'body\.light-mode\s+\.app-tab-panel[^}]*background:\s*#c7c9d5\s*!important') "Light mode .app-tab-panel has background: #c7c9d5" "Light mode background missing"
Assert-Condition ($css -match 'body\.light-mode\s+\.app-tab-panel[^}]*border:\s*1px\s+solid\s+rgba\(20,\s*22,\s*30,\s*0?\.08\)\s*!important') "Light mode .app-tab-panel has rgba(20,22,30,.08) border" "Light mode border missing"

# 10. Check Maintenance Report symmetrical alignment preserved
Assert-Condition ($css -match '#eodPanel\s*\.simple-eod-top[^}]*width:\s*100%\s*!important') "Maintenance top tracker has width: 100% !important" "Tracker width not 100%"
Assert-Condition ($css -match '#eodPanel\s*\.simple-eod-top[^}]*display:\s*grid\s*!important') "Maintenance top tracker has display: grid !important" "Tracker grid missing"
Assert-Condition ($css -match '#eodPanel\s*\.simple-eod-top[^}]*grid-template-columns:\s*1fr\s+220px\s*!important') "Maintenance top tracker has 1fr 220px columns" "Tracker columns missing"
Assert-Condition ($css -match '#eodPanel\s*\.simple-eod-actions[^}]*width:\s*100%\s*!important') "Maintenance actions toolbar has width: 100% !important" "Actions toolbar width not 100%"
Assert-Condition ($css -match '#eodPanel\s*\.eod-block[^}]*width:\s*100%\s*!important') "Maintenance report block has width: 100% !important" "Report block width not 100%"

Write-Host "=================================================" -ForegroundColor Cyan
if ($failures -eq 0) {
    Write-Host "ALL THEME GEOMETRY INVARIANCE CHECKS PASSED!" -ForegroundColor Green
    exit 0
} else {
    Write-Host "$failures CHECKS FAILED!" -ForegroundColor Red
    exit 1
}
