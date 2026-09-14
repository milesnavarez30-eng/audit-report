$edge = 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
if (-not (Test-Path $edge)) {
    $edge = 'C:\Program Files\Microsoft\Edge\Application\msedge.exe'
}

$url = "http://localhost:8080/cctv-ops-v2/?workspace=maintenance"
$outImage = "c:\Users\Mnavares\Documents\CCTV OPS\audit-report\scratch\v2_maintenance_workspace_snap.png"
$profileDir = "c:\Users\Mnavares\Documents\CCTV OPS\audit-report\scratch\edge_maint_profile"

Write-Host "Capturing Maintenance Workspace Showcase via Edge Headless..." -ForegroundColor Cyan

& $edge --headless=new --disable-gpu --user-data-dir=$profileDir --window-size=1440,920 "--screenshot=$outImage" $url

Start-Sleep -Seconds 2

if (Test-Path $outImage) {
    Write-Host "Screenshot captured successfully at $outImage" -ForegroundColor Green
} else {
    Write-Host "Screenshot failed to generate." -ForegroundColor Red
}
