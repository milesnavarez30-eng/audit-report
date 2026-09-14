$ErrorActionPreference = "Continue"

$edge = 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
if (-not (Test-Path $edge)) {
    $edge = 'C:\Program Files\Microsoft\Edge\Application\msedge.exe'
}

$url = "http://localhost:8080/scratch/test_v2_sorter_parity.html"
$outImage = "c:\Users\Mnavares\Documents\CCTV OPS\audit-report\scratch\v2_sorter_parity_screenshot.png"

Write-Host "Running AI Sorter Parity Tests via Edge Headless..." -ForegroundColor Cyan

& $edge --headless=new --disable-gpu --virtual-time-budget=4000 --window-size=1280,800 "--screenshot=$outImage" $url

Start-Sleep -Seconds 2

if (Test-Path $outImage) {
    Write-Host "Screenshot captured successfully at $outImage" -ForegroundColor Green
} else {
    Write-Host "Screenshot failed to generate." -ForegroundColor Red
}
