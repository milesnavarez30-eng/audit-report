$edgePath = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
if (-not (Test-Path $edgePath)) {
    $edgePath = "C:\Program Files\Microsoft\Edge\Application\msedge.exe"
}

$reportPath = Join-Path (Get-Location).Path "scratch\test_report.txt"
if (Test-Path $reportPath) {
    Remove-Item -Force $reportPath
}

Write-Host "Running Manual Fix Pass Verification in Headless Edge..." -ForegroundColor Cyan
& $edgePath --headless=new --disable-gpu "http://localhost:8080/scratch/test_manual_fix_pass.html"

$timeout = 25
$elapsed = 0
while ($elapsed -lt $timeout) {
    Start-Sleep -Seconds 1
    $elapsed++
    if (Test-Path $reportPath) {
        $content = Get-Content $reportPath -Raw
        if ($content -and $content.Trim().Length -gt 0) {
            Write-Host "Verification Report received after $elapsed seconds!" -ForegroundColor Green
            Write-Output $content
            exit 0
        }
    }
}

Write-Error "No verification report generated within $timeout seconds."
exit 1
