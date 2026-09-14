$edge = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
if (-not (Test-Path $edge)) {
    $edge = "C:\Program Files\Microsoft\Edge\Application\msedge.exe"
}

$reportFile = "c:\Users\Mnavares\Documents\CCTV OPS\audit-report\scratch\test_report.txt"
if (Test-Path $reportFile) {
    Remove-Item -Force $reportFile
}

Write-Output "Running JS Check..."
& $edge --headless=new --disable-gpu "http://localhost:8080/scratch/check_js_errors.html"

Start-Sleep -Seconds 3

if (Test-Path $reportFile) {
    Get-Content $reportFile -Raw
} else {
    Write-Output "No report generated."
}
