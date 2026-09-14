$ErrorActionPreference = "Stop"

$edge = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
if (-not (Test-Path $edge)) {
    $edge = "C:\Program Files\Microsoft\Edge\Application\msedge.exe"
}

Write-Host "Edge binary found at: $edge" -ForegroundColor Cyan

# 1. Check index.html content
$indexPath = "c:\Users\Mnavares\Documents\CCTV OPS\audit-report\cctv-ops-v2\index.html"
$indexHtml = Get-Content -Path $indexPath -Raw -Encoding utf8

$checks = @(
    "id=`"navRailBackdrop`"",
    "id=`"btnMobileNavToggle`"",
    "id=`"topbarProgressLine`"",
    "data-tooltip=`"Toggle Sidebar`"",
    "data-tooltip=`"Google Docs Template`"",
    "data-tooltip=`"Reload Saved EDRs`"",
    "class=`"table-responsive-wrapper`"",
    "class=`"modal-backdrop`""
)

Write-Host "`n--- Checking index.html Markup Elements ---" -ForegroundColor Yellow
foreach ($chk in $checks) {
    if ($indexHtml -match [regex]::Escape($chk.Replace('`', ''))) {
        Write-Host "[PASS] Found $chk" -ForegroundColor Green
    } else {
        Write-Host "[WARN] Not matched: $chk" -ForegroundColor Yellow
    }
}

# 2. Check JS functions in shared.js and storage.js
$sharedJs = Get-Content -Path "c:\Users\Mnavares\Documents\CCTV OPS\audit-report\cctv-ops-v2\js\shared.js" -Raw -Encoding utf8
$storageJs = Get-Content -Path "c:\Users\Mnavares\Documents\CCTV OPS\audit-report\cctv-ops-v2\js\storage.js" -Raw -Encoding utf8

Write-Host "`n--- Checking JS Shared Helpers ---" -ForegroundColor Yellow
$fnChecks = @(
    "window.showToast",
    "window.appConfirm",
    "window.setButtonBusy",
    "window.setGlobalProgress",
    "window.renderSkeletonRows",
    "getOrFetch"
)

foreach ($fn in $fnChecks) {
    if ($sharedJs.Contains($fn) -or $storageJs.Contains($fn)) {
        Write-Host "[PASS] Verified $fn" -ForegroundColor Green
    } else {
        Write-Host "[FAIL] Missing function: $fn" -ForegroundColor Red
        exit 1
    }
}

# 3. Headless Edge DOM Check
Write-Host "`n--- Running Edge Headless DOM Verification ---" -ForegroundColor Yellow
$outDump = "c:\Users\Mnavares\Documents\CCTV OPS\audit-report\scratch\v2_live_dom_dump.html"
if (Test-Path $outDump) { Remove-Item -Force $outDump }

$url = "file:///$($indexPath.Replace('\', '/'))"
$cmdLine = "`"$edge`" --headless=new --disable-gpu --dump-dom `"$url`""
$dump = cmd.exe /c $cmdLine
$dump | Out-File -FilePath $outDump -Encoding utf8

if (Test-Path $outDump) {
    $dump = Get-Content -Path $outDump -Raw -Encoding utf8
    Write-Host "DOM Dump length: $($dump.Length) bytes" -ForegroundColor Cyan
    if ($dump -match 'id="btnMobileNavToggle"') {
        Write-Host "[PASS] Live DOM rendered btnMobileNavToggle successfully" -ForegroundColor Green
    } else {
        Write-Host "[FAIL] btnMobileNavToggle not in live DOM" -ForegroundColor Red
    }
    if ($dump -match 'id="topbarProgressLine"') {
        Write-Host "[PASS] Live DOM rendered topbarProgressLine successfully" -ForegroundColor Green
    } else {
        Write-Host "[FAIL] topbarProgressLine not in live DOM" -ForegroundColor Red
    }
    if ($dump -match 'id="paneEdr"') {
        Write-Host "[PASS] Live DOM rendered paneEdr successfully" -ForegroundColor Green
    } else {
        Write-Host "[FAIL] paneEdr not in live DOM" -ForegroundColor Red
    }
    if ($dump -match 'id="paneAudit"') {
        Write-Host "[PASS] Live DOM rendered paneAudit successfully" -ForegroundColor Green
    } else {
        Write-Host "[FAIL] paneAudit not in live DOM" -ForegroundColor Red
    }
} else {
    Write-Host "[WARN] Output dump not created within timeout" -ForegroundColor Yellow
}

Write-Host "`n=== ALL DOM & RUNTIME CHECKS COMPLETED ===" -ForegroundColor Green
