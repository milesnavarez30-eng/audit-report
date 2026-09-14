$edgePath = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
if (-not (Test-Path $edgePath)) { $edgePath = "C:\Program Files\Microsoft\Edge\Application\msedge.exe" }

$root = (Get-Location).Path
$outCollapsed = Join-Path $root "scratch\snap_view_collapsed_rail.png"
$outExpanded  = Join-Path $root "scratch\snap_view_expanded_review.png"
$outRestored  = Join-Path $root "scratch\snap_view_restored_layout.png"

Write-Host "Taking collapsed rail snap..."
& $edgePath --headless=new --disable-gpu --window-size=1440,900 --virtual-time-budget=3000 "--screenshot=$outCollapsed" "http://localhost:8080/scratch/snap_helper.html?mode=collapsed_rail"

Write-Host "Taking expanded review snap..."
& $edgePath --headless=new --disable-gpu --window-size=1440,900 --virtual-time-budget=3000 "--screenshot=$outExpanded" "http://localhost:8080/scratch/snap_helper.html?mode=expanded_review"

Write-Host "Taking restored layout snap..."
& $edgePath --headless=new --disable-gpu --window-size=1440,900 --virtual-time-budget=3500 "--screenshot=$outRestored" "http://localhost:8080/scratch/snap_helper.html?mode=restored_collapse"

Write-Host "Done."
