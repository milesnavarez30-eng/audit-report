$edge = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
if (-not (Test-Path $edge)) {
    $edge = "C:\Program Files\Microsoft\Edge\Application\msedge.exe"
}

$reportFile = "c:\Users\Mnavares\Documents\CCTV OPS\audit-report\scratch\test_report.txt"
if (Test-Path $reportFile) {
    Remove-Item -Force $reportFile
}

$url = "http://localhost:8080/scratch/test_v2_audit_parity.html"

Write-Output "Starting Edge to run CCTV Audit Parity tests..."
$p = Start-Process -FilePath $edge -ArgumentList @("--headless=new", "--disable-gpu", $url) -PassThru

$timeout = 25
while ($timeout -gt 0 -and (-not (Test-Path $reportFile))) {
    Start-Sleep -Seconds 1
    $timeout--
}

Stop-Process -Id $p.Id -Force -ErrorAction SilentlyContinue

if (Test-Path $reportFile) {
    Write-Output "=== Test Report Received ==="
    Get-Content $reportFile
} else {
    Write-Output "Timeout waiting for report."
}
