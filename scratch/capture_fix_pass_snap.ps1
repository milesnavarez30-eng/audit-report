$edge = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
if (-not (Test-Path $edge)) {
    $edge = "C:\Program Files\Microsoft\Edge\Application\msedge.exe"
}
$url = "http://localhost:8080/scratch/test_manual_fix_pass.html"
$snap = "c:\Users\Mnavares\Documents\CCTV OPS\audit-report\scratch\v2_manual_fix_matrix.png"

# Launch Edge headless to take screenshot
& $edge --headless=new --disable-gpu --virtual-time-budget=6000 --window-size=1440,1600 --screenshot=$snap $url
Start-Sleep -Seconds 2

# Copy to brain artifact directory
$artDir = "C:\Users\Mnavares\.gemini\antigravity-ide\brain\3c22d3e9-1a73-4877-b2d4-b5385952e93d"
if (Test-Path $artDir) {
    Copy-Item $snap (Join-Path $artDir "v2_manual_fix_matrix.png") -Force
}
if (Test-Path $snap) {
    Write-Output "Screenshot captured: $(Get-Item $snap | Select-Object -ExpandProperty Length) bytes"
} else {
    Write-Output "Screenshot failed"
}
