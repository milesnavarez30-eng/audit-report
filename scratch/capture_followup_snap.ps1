$edge = 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
if (-not (Test-Path $edge)) {
    $edge = 'C:\Program Files\Microsoft\Edge\Application\msedge.exe'
}

$userDir = Join-Path (Get-Location).Path "scratch\edge_followup_profile"

& $edge --headless=new --disable-gpu --window-size=1440,920 "--user-data-dir=$userDir" "--screenshot=c:\Users\Mnavares\Documents\CCTV OPS\audit-report\scratch\v2_followup_workspace_snap.png" "http://localhost:8080/cctv-ops-v2/index.html?workspace=followup&demo=1"

Start-Sleep -Seconds 2

if (Test-Path ".\scratch\v2_followup_workspace_snap.png") {
    $size = (Get-Item ".\scratch\v2_followup_workspace_snap.png").Length
    Write-Output "Screenshot captured: $size bytes"
} else {
    Write-Output "Screenshot file missing"
}
