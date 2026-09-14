$edge = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
if (-not (Test-Path $edge)) {
    $edge = "C:\Program Files\Microsoft\Edge\Application\msedge.exe"
}

# 1. Run test suite
$outTest = "c:\Users\Mnavares\Documents\CCTV OPS\audit-report\scratch\v2_saved_ui_test_results.png"
$urlTest = "http://localhost:8080/scratch/test_v2_edr_saved_list_ui.html"

Write-Host "Running test suite against $urlTest..." -ForegroundColor Cyan
& $edge --headless=new --disable-gpu --virtual-time-budget=6000 --window-size=1440,900 "--screenshot=$outTest" $urlTest
Start-Sleep -Seconds 2

if (Test-Path $outTest) {
    Write-Host "Test screenshot saved: $outTest ($(Get-Item $outTest | Select-Object -ExpandProperty Length) bytes)" -ForegroundColor Green
}

# 2. Check test report
if (Test-Path "scratch\test_report.txt") {
    $report = Get-Content "scratch\test_report.txt" -Raw
    Write-Host "`nTest Report Contents:" -ForegroundColor Yellow
    Write-Host $report
}
