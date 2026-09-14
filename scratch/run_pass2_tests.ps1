$edge = 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
if (-not (Test-Path $edge)) {
    $edge = 'C:\Program Files\Microsoft\Edge\Application\msedge.exe'
}

$reportFile = "c:\Users\Mnavares\Documents\CCTV OPS\audit-report\scratch\test_report.txt"
if (Test-Path $reportFile) {
    Remove-Item -Force $reportFile
}

$tempProfile = [System.IO.Path]::Combine([System.IO.Path]::GetTempPath(), "edge_pass2_" + [System.Guid]::NewGuid().ToString("N"))
Write-Host "Running Pass 2 Regression Suite in Edge Headless with unique profile: $tempProfile" -ForegroundColor Cyan

$proc = Start-Process -FilePath $edge -ArgumentList @(
    "--headless=new",
    "--disable-gpu",
    "--remote-debugging-port=9222",
    "--user-data-dir=$tempProfile",
    "http://localhost:8080/scratch/test_pass2_regression.html"
) -PassThru

$waited = 0
while ($waited -lt 30) {
    Start-Sleep -Seconds 1
    $waited++
    if (Test-Path $reportFile) {
        $content = Get-Content $reportFile -Raw
        if ($content -match "TEST RESULTS") {
            Write-Host "Full test suite completed after $waited seconds!" -ForegroundColor Green
            break
        }
    }
}

if (-not $proc.HasExited) {
    Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
}

if (Test-Path $reportFile) {
    $content = Get-Content $reportFile -Raw
    Write-Host "`nTest Report Output:" -ForegroundColor Green
    Write-Output $content
} else {
    Write-Host "No report file was generated." -ForegroundColor Red
}
