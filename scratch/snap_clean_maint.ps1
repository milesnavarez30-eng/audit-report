$edge = 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
if (-not (Test-Path $edge)) {
    $edge = 'C:\Program Files\Microsoft\Edge\Application\msedge.exe'
}

$outMaint = "c:\Users\Mnavares\Documents\CCTV OPS\audit-report\scratch\v2_maint_cleaned.png"
$profileDir = "c:\Users\Mnavares\Documents\CCTV OPS\audit-report\scratch\edge_clean_maint_profile"

& $edge --headless=new --disable-gpu --user-data-dir=$profileDir --window-size=1440,900 "--screenshot=$outMaint" "http://localhost:8080/scratch/snap_maint_clean.html"
Start-Sleep -Seconds 3

if (Test-Path $outMaint) {
    Copy-Item $outMaint "C:\Users\Mnavares\.gemini\antigravity-ide\brain\9a6830ff-044f-4caf-bf7a-57f69e7d4a45\snap_maintenance_block_cleaned.png" -Force
    Write-Host "Snapshot clean maintenance captured: $( (Get-Item $outMaint).Length ) bytes"
} else {
    Write-Host "File not found"
}
