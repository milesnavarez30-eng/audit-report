$edgePath = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
if (-not (Test-Path $edgePath)) { $edgePath = "C:\Program Files\Microsoft\Edge\Application\msedge.exe" }

$root = (Get-Location).Path
$out1 = Join-Path $root "scratch\snap_collapsed_rail_1440.png"
$out2 = Join-Path $root "scratch\snap_edr_expanded_review.png"
$out3 = Join-Path $root "scratch\snap_edr_collapsed_restored.png"

# Script 1: Collapsed sidebar in Desktop 1440
$url1 = "http://localhost:8080/scratch/snap_collapsed_rail.html"
# HTML for snap 1:
$html1 = @"
<!DOCTYPE html>
<html><body style='margin:0; background:#0D1117;'>
<iframe id='f' src='http://localhost:8080/cctv-ops-v2/' style='width:1440px; height:900px; border:none;'></iframe>
<script>
window.onload = async () => {
  await new Promise(r => setTimeout(r, 1200));
  const doc = document.getElementById('f').contentDocument;
  const btn = doc.getElementById('btnToggleRail');
  btn.click(); // Collapse rail
  window.__READY__ = true;
};
</script>
</body></html>
"@
[System.IO.File]::WriteAllText((Join-Path $root "scratch\snap_collapsed_rail.html"), $html1, [System.Text.Encoding]::UTF8)

# HTML for snap 2: Expanded review
$html2 = @"
<!DOCTYPE html>
<html><body style='margin:0; background:#0D1117;'>
<iframe id='f' src='http://localhost:8080/cctv-ops-v2/' style='width:1440px; height:900px; border:none;'></iframe>
<script>
window.onload = async () => {
  await new Promise(r => setTimeout(r, 1200));
  const doc = document.getElementById('f').contentDocument;
  const btn = doc.getElementById('btnToggleDispatchExpand');
  btn.click(); // Expand review
  window.__READY__ = true;
};
</script>
</body></html>
"@
[System.IO.File]::WriteAllText((Join-Path $root "scratch\snap_expanded_review.html"), $html2, [System.Text.Encoding]::UTF8)

# HTML for snap 3: Expand then Collapse Review (Restored)
$html3 = @"
<!DOCTYPE html>
<html><body style='margin:0; background:#0D1117;'>
<iframe id='f' src='http://localhost:8080/cctv-ops-v2/' style='width:1440px; height:900px; border:none;'></iframe>
<script>
window.onload = async () => {
  await new Promise(r => setTimeout(r, 1200));
  const doc = document.getElementById('f').contentDocument;
  const btn = doc.getElementById('btnToggleDispatchExpand');
  btn.click(); // Expand
  await new Promise(r => setTimeout(r, 300));
  btn.click(); // Collapse back to normal
  window.__READY__ = true;
};
</script>
</body></html>
"@
[System.IO.File]::WriteAllText((Join-Path $root "scratch\snap_collapsed_restored.html"), $html3, [System.Text.Encoding]::UTF8)

Write-Host "Capturing screenshots..."
& $edgePath --headless=new --disable-gpu --window-size=1440,900 --screenshot=$out1 "http://localhost:8080/scratch/snap_collapsed_rail.html"
Start-Sleep -Seconds 1
& $edgePath --headless=new --disable-gpu --window-size=1440,900 --screenshot=$out2 "http://localhost:8080/scratch/snap_expanded_review.html"
Start-Sleep -Seconds 1
& $edgePath --headless=new --disable-gpu --window-size=1440,900 --screenshot=$out3 "http://localhost:8080/scratch/snap_collapsed_restored.html"

Write-Host "Screenshots captured."
