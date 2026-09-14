$edge = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
if (-not (Test-Path $edge)) { $edge = "C:\Program Files\Microsoft\Edge\Application\msedge.exe" }

$root = (Get-Location).Path
$out1 = Join-Path $root "scratch\v2_snap_collapsed_rail.png"
$out2 = Join-Path $root "scratch\v2_snap_expanded_review.png"
$out3 = Join-Path $root "scratch\v2_snap_normal_restored.png"

Write-Host "Capturing collapsed rail..."
Start-Process -FilePath $edge -ArgumentList @("--headless=new", "--disable-gpu", "--window-size=1440,900", "--screenshot=$out1", "http://localhost:8080/cctv-ops-v2/?rail=collapsed") -Wait

Write-Host "Capturing expanded review..."
Start-Process -FilePath $edge -ArgumentList @("--headless=new", "--disable-gpu", "--window-size=1440,900", "--screenshot=$out2", "http://localhost:8080/cctv-ops-v2/?edr=expanded") -Wait

Write-Host "Capturing normal restored..."
Start-Process -FilePath $edge -ArgumentList @("--headless=new", "--disable-gpu", "--window-size=1440,900", "--screenshot=$out3", "http://localhost:8080/cctv-ops-v2/") -Wait

Write-Host "All snaps captured successfully."
