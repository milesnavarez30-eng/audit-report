$edge = 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
if (-not (Test-Path $edge)) {
    $edge = 'C:\Program Files\Microsoft\Edge\Application\msedge.exe'
}

$url = "http://localhost:8080/scratch/snap_helper.html"
$outImage = "c:\Users\Mnavares\Documents\CCTV OPS\audit-report\scratch\v2_maintenance_zoom150_snap.png"
$profileDir = "c:\Users\Mnavares\Documents\CCTV OPS\audit-report\scratch\edge_maint_z150_profile"

$helperHtml = @"
<!DOCTYPE html>
<html>
<body style="margin:0; background:#0b0f17;">
<iframe id="f" src="http://localhost:8080/cctv-ops-v2/index.html?workspace=maintenance" style="width:960px; height:800px; border:none;"></iframe>
<script>
window.onload = async () => {
  const frame = document.getElementById('f');
  await new Promise(r => frame.onload = r);
  await new Promise(r => setTimeout(r, 1500));
  const doc = frame.contentDocument;
  const chips = doc.querySelectorAll('.maint-preset-chip');
  if (chips.length > 0) chips[0].click();
};
</script>
</body>
</html>
"@

Set-Content -Path "scratch\snap_helper.html" -Value $helperHtml -Encoding utf8

& $edge --headless=new --disable-gpu --user-data-dir=$profileDir --window-size=1000,850 "--screenshot=$outImage" $url

Start-Sleep -Seconds 3

Copy-Item $outImage "C:\Users\Mnavares\.gemini\antigravity-ide\brain\9a6830ff-044f-4caf-bf7a-57f69e7d4a45\snap_maintenance_zoom150.png" -Force
Write-Host "Snapshot 150% captured."
