$edge = 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
if (-not (Test-Path $edge)) { $edge = 'C:\Program Files\Microsoft\Edge\Application\msedge.exe' }

$out = "c:\Users\Mnavares\Documents\CCTV OPS\audit-report\scratch\v2_snap_100_verified.png"
$profileDir = "c:\Users\Mnavares\Documents\CCTV OPS\audit-report\scratch\edge_snap_100_profile"

& $edge --headless=new --disable-gpu --user-data-dir=$profileDir --window-size=1440,900 "--screenshot=$out" "http://localhost:8080/cctv-ops-v2/"
Start-Sleep -Seconds 3

if (Test-Path $out) {
    Copy-Item $out "C:\Users\Mnavares\.gemini\antigravity-ide\brain\9a6830ff-044f-4caf-bf7a-57f69e7d4a45\snap_edr_100_baseline.png" -Force
    Write-Host "Snapshot 100% baseline captured: $( (Get-Item $out).Length ) bytes"
} else {
    Write-Host "File not found"
}
