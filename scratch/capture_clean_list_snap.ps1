$edge = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
if (-not (Test-Path $edge)) {
    $edge = "C:\Program Files\Microsoft\Edge\Application\msedge.exe"
}
$url = "http://localhost:8080/cctv-ops-v2/"
$snap = "c:\Users\Mnavares\Documents\CCTV OPS\audit-report\scratch\v2_cleaned_saved_edr_list.png"

# Launch Edge headless to take screenshot
& $edge --headless=new --disable-gpu --window-size=1440,900 --screenshot=$snap $url
Start-Sleep -Seconds 3

# Copy to brain artifact directory if needed
$artDir = "C:\Users\Mnavares\.gemini\antigravity-ide\brain\3c22d3e9-1a73-4877-b2d4-b5385952e93d"
if (Test-Path $artDir) {
    Copy-Item $snap (Join-Path $artDir "v2_cleaned_saved_edr_list.png") -Force
}
Write-Output "Screenshot captured to $snap"
