$edge = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
if (-not (Test-Path $edge)) {
    $edge = "C:\Program Files\Microsoft\Edge\Application\msedge.exe"
}
$url = "http://localhost:8080/scratch/test_edr_dom.html"
$report = "c:\Users\Mnavares\Documents\CCTV OPS\audit-report\scratch\test_report.txt"
if (Test-Path $report) {
    Remove-Item -Force $report
}

Write-Output "Starting Edge to run tests..."
$p = Start-Process -FilePath $edge -ArgumentList @("--headless=new", "--disable-gpu", $url) -PassThru

$timeout = 15
while ($timeout -gt 0 -and (-not (Test-Path $report))) {
    Start-Sleep -Seconds 1
    $timeout--
}

Stop-Process -Id $p.Id -Force -ErrorAction SilentlyContinue

if (Test-Path $report) {
    Write-Output "=== Test Report Received ==="
    Get-Content $report
} else {
    Write-Output "Timeout waiting for report."
}
