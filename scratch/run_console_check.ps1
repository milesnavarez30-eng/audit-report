$edgePath = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
if (-not (Test-Path $edgePath)) { $edgePath = "C:\Program Files\Microsoft\Edge\Application\msedge.exe" }

$reportPath = Join-Path (Get-Location).Path "scratch\test_report.txt"
if (Test-Path $reportPath) { Remove-Item -Force $reportPath }

Write-Host "Running Console Error Verification across all workspaces..." -ForegroundColor Cyan
& $edgePath --headless=new --disable-gpu "http://localhost:8080/scratch/verify_all_workspaces_console.html"

$timeout = 25
$elapsed = 0
while ($elapsed -lt $timeout) {
    Start-Sleep -Seconds 1
    $elapsed++
    if (Test-Path $reportPath) {
        $c = Get-Content $reportPath -Raw
        if ($c -and $c.Trim().Length -gt 0) {
            Write-Host $c
            exit 0
        }
    }
}
Write-Error "Timeout waiting for report."
exit 1
