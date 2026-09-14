$edge = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
if (-not (Test-Path $edge)) {
    $edge = "C:\Program Files\Microsoft\Edge\Application\msedge.exe"
}
$out = "c:\Users\Mnavares\Documents\CCTV OPS\audit-report\scratch\test_suite_snap.png"
$url = "http://localhost:8080/scratch/test_edr_dom.html"

$reportFile = "c:\Users\Mnavares\Documents\CCTV OPS\audit-report\scratch\test_report.txt"
if (Test-Path $reportFile) {
    Remove-Item -Force $reportFile
}

Write-Output "Running test suite in Edge headless..."
& $edge --headless=new --disable-gpu --window-size=1280,900 "--screenshot=$out" $url

Start-Sleep -Seconds 4

if (Test-Path $reportFile) {
    $report = Get-Content $reportFile -Raw
    Write-Output "=== Test Report Received ==="
    Write-Output $report
} else {
    Write-Output "No test report file created."
}
