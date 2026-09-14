$ErrorActionPreference = "Continue"

$edge = 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
if (-not (Test-Path $edge)) {
    $edge = 'C:\Program Files\Microsoft\Edge\Application\msedge.exe'
}

$url = "http://localhost:8080/scratch/test_targeted_regressions.html"
$reportPath = "c:\Users\Mnavares\Documents\CCTV OPS\audit-report\scratch\test_report.txt"

Remove-Item -Force $reportPath -ErrorAction SilentlyContinue

Write-Host "Running Targeted Regressions Verification Suite in Edge..." -ForegroundColor Cyan

$dataDir = [System.IO.Path]::Combine([System.IO.Path]::GetTempPath(), "edge-targeted-regress-" + [System.Guid]::NewGuid().ToString("N"))

$proc = Start-Process -FilePath $edge -ArgumentList @(
    "--headless=new",
    "--disable-gpu",
    "--remote-debugging-port=9227",
    "--no-first-run",
    "--no-default-browser-check",
    "--window-size=1920,1080",
    "--user-data-dir=$dataDir",
    $url
) -PassThru

$waited = 0
$timeout = 25
while ($waited -lt $timeout) {
    Start-Sleep -Seconds 1
    $waited++
    if (Test-Path $reportPath) {
        $raw = Get-Content $reportPath -Raw
        if ($raw -and $raw.Contains("TEST RESULTS")) {
            Write-Host "Test completed in $waited seconds!" -ForegroundColor Green
            break
        }
    }
}

if (-not $proc.HasExited) {
    Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
}

if (Test-Path $dataDir) {
    Remove-Item -Recurse -Force $dataDir -ErrorAction SilentlyContinue
}

if (Test-Path $reportPath) {
    $report = Get-Content $reportPath -Raw
    Write-Host "`n================ TEST REPORT ================" -ForegroundColor Cyan
    Write-Host $report
    Write-Host "=============================================" -ForegroundColor Cyan
} else {
    Write-Host "No test_report.txt generated within timeout." -ForegroundColor Red
}
