$edge = 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
if (-not (Test-Path $edge)) {
    $edge = 'C:\Program Files\Microsoft\Edge\Application\msedge.exe'
}

$reportFile = "c:\Users\Mnavares\Documents\CCTV OPS\audit-report\scratch\test_report.txt"
if (Test-Path $reportFile) {
    Remove-Item -Force $reportFile
}

$tempProfile = "c:\Users\Mnavares\Documents\CCTV OPS\audit-report\scratch\edge_fixes_test_profile"
if (Test-Path $tempProfile) {
    Remove-Item -Recurse -Force $tempProfile -ErrorAction SilentlyContinue
}

Write-Host "Running V2 Remaining Fixes Test Suite in Edge Headless..." -ForegroundColor Cyan

# Budget 18000ms to allow the real Google Apps Script endpoint to respond
& $edge --headless=new --disable-gpu --virtual-time-budget=20000 --user-data-dir=$tempProfile 'http://localhost:8080/scratch/test_v2_remaining_fixes.html'

Start-Sleep -Seconds 2

if (Test-Path $reportFile) {
    $content = Get-Content $reportFile -Raw
    Write-Host "`nTest Report Output:" -ForegroundColor Green
    Write-Output $content
} else {
    Write-Host "No report file was generated." -ForegroundColor Red
}
