$edgePath = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
$dataDir = [System.IO.Path]::Combine([System.IO.Path]::GetTempPath(), "edge-test-profile-" + [System.Guid]::NewGuid().ToString("N"))
$url = "http://localhost:8080/scratch/test_pass2_regression.html"

# Run Edge headless and capture output/exit
$proc = Start-Process -FilePath $edgePath -ArgumentList @(
    "--headless=new",
    "--disable-gpu",
    "--no-first-run",
    "--no-default-browser-check",
    "--user-data-dir=$dataDir",
    "--virtual-time-budget=10000",
    $url
) -PassThru

Write-Host "Started Edge with PID $($proc.Id)... waiting up to 15 seconds"
$waited = 0
while ($waited -lt 15) {
    Start-Sleep -Seconds 1
    $waited++
    if (Test-Path ".\scratch\test_report.txt") {
        Write-Host "test_report.txt created after $waited seconds!"
        break
    }
}

if (-not $proc.HasExited) {
    Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
}

if (Test-Path $dataDir) {
    Remove-Item -Recurse -Force $dataDir -ErrorAction SilentlyContinue
}

if (Test-Path ".\scratch\test_report.txt") {
    $report = Get-Content ".\scratch\test_report.txt" -Raw
    Write-Host "Report length: $($report.Length)"
    Write-Host $report.Substring(0, [Math]::Min(500, $report.Length))
} else {
    Write-Host "No report generated."
}
