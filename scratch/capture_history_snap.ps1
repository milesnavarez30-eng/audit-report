$edge = 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
if (-not (Test-Path $edge)) {
    $edge = 'C:\Program Files\Microsoft\Edge\Application\msedge.exe'
}

$userDir = Join-Path (Get-Location).Path "scratch\edge_history_profile"
$snapPath = "c:\Users\Mnavares\Documents\CCTV OPS\audit-report\scratch\v2_history_workspace_snap.png"
Remove-Item -Force $snapPath -ErrorAction SilentlyContinue

& $edge --headless=new --disable-gpu --window-size=1440,920 "--user-data-dir=$userDir" "--screenshot=$snapPath" "http://localhost:8080/cctv-ops-v2/index.html?workspace=history"

Start-Sleep -Seconds 2

if (Test-Path $snapPath) {
    $size = (Get-Item $snapPath).Length
    Write-Output "Screenshot captured: $size bytes"
} else {
    Write-Output "Screenshot file missing"
}
