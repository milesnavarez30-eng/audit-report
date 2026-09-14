$edgePath = 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
if (-not (Test-Path $edgePath)) {
    $edgePath = 'C:\Program Files\Microsoft\Edge\Application\msedge.exe'
}

$tempProfile = Join-Path $PSScriptRoot "edge_saved_ui_profile"
if (Test-Path $tempProfile) {
    Remove-Item -Recurse -Force $tempProfile -ErrorAction SilentlyContinue
}

# 1. Run Automated Functional Test
Write-Host "Running Automated Saved EDR UI Tests in Edge..." -ForegroundColor Cyan
$dom = & $edgePath --headless=new --disable-gpu --virtual-time-budget=8000 --user-data-dir=$tempProfile --dump-dom 'http://localhost:8080/scratch/test_v2_edr_saved_list_ui.html'
$dom | Out-File -FilePath (Join-Path $PSScriptRoot "test_saved_ui_output.html") -Encoding utf8

$results = Get-Content (Join-Path $PSScriptRoot "test_saved_ui_output.html") | Select-String -Pattern 'Test Summary|\[PASS\]|\[FAIL\]|\[ERROR\]'
$results | ForEach-Object { Write-Output $_.Line }

# 2. Capture Screenshot of V2 with Saved EDRs
Write-Host "`nCapturing Screenshot of V2 with Saved EDRs..." -ForegroundColor Cyan
$snapProfile = Join-Path $PSScriptRoot "edge_snap_profile"
if (Test-Path $snapProfile) {
    Remove-Item -Recurse -Force $snapProfile -ErrorAction SilentlyContinue
}

$screenshotOut = Join-Path $PSScriptRoot "v2_saved_edr_ui_screenshot.png"
& $edgePath --headless=new --disable-gpu --window-size=1440,900 --user-data-dir=$snapProfile "--screenshot=$screenshotOut" 'http://localhost:8080/cctv-ops-v2/'

Start-Sleep -Seconds 1
if (Test-Path $screenshotOut) {
    Write-Host "Screenshot captured successfully: $screenshotOut ($(Get-Item $screenshotOut | Select-Object -ExpandProperty Length) bytes)" -ForegroundColor Green
} else {
    Write-Host "Screenshot failed" -ForegroundColor Red
}
