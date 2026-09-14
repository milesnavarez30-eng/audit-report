$port = 8085
$serverJob = Start-Job -ScriptBlock {
    param($root)
    Set-Location $root
    powershell -File "scratch\serve_test_server.ps1"
} -ArgumentList (Get-Location).Path

Start-Sleep -Seconds 2

$reportFile = Join-Path (Get-Location).Path "scratch\test_saved_ui_report.json"
if (Test-Path $reportFile) {
    Remove-Item -Force $reportFile
}

$edgePath = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
if (-not (Test-Path $edgePath)) {
    $edgePath = "C:\Program Files\Microsoft\Edge\Application\msedge.exe"
}

Write-Host "Running Manual Fix Pass 2 Regression in Microsoft Edge..." -ForegroundColor Cyan
& $edgePath --headless=new --disable-gpu --remote-debugging-port=9222 "http://localhost:8085/scratch/test_pass2_regression.html"

$timeout = 25
$elapsed = 0
$passed = $false

while ($elapsed -lt $timeout) {
    Start-Sleep -Seconds 1
    $elapsed++
    if (Test-Path $reportFile) {
        $content = Get-Content $reportFile -Raw
        if ($content -and $content.Trim().Length -gt 0) {
            Write-Host "Regression report received in $elapsed seconds!" -ForegroundColor Green
            Write-Output $content
            $passed = $true
            break
        }
    }
}

Stop-Job $serverJob -ErrorAction SilentlyContinue
Remove-Job $serverJob -ErrorAction SilentlyContinue

if (-not $passed) {
    Write-Error "Test timed out after $timeout seconds."
    exit 1
}
