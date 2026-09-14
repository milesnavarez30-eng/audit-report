$edge = 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
if (-not (Test-Path $edge)) {
    $edge = 'C:\Program Files\Microsoft\Edge\Application\msedge.exe'
}

$url = "http://localhost:8080/scratch/test_ai_sorter_e2e.html"
$localImage = "c:\Users\Mnavares\Documents\CCTV OPS\audit-report\scratch\v2_ai_sorter_restoration_verified.png"
$artifactImage = "C:\Users\Mnavares\.gemini\antigravity-ide\brain\9a6830ff-044f-4caf-bf7a-57f69e7d4a45\snap_ai_sorter_restoration_verified.png"

Remove-Item -Force $localImage -ErrorAction SilentlyContinue

& $edge --headless=new --disable-gpu --virtual-time-budget=12000 --window-size=1280,1000 "--screenshot=$localImage" $url

Start-Sleep -Seconds 2
if (Test-Path $localImage) {
    Copy-Item -Force $localImage $artifactImage
    Write-Host "Screenshot captured at $localImage and copied to $artifactImage" -ForegroundColor Green
} else {
    Write-Host "Screenshot failed" -ForegroundColor Red
}
