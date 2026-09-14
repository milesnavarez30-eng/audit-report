$edge = 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
if (-not (Test-Path $edge)) {
    $edge = 'C:\Program Files\Microsoft\Edge\Application\msedge.exe'
}

$profileDir = "c:\Users\Mnavares\Documents\CCTV OPS\audit-report\scratch\edge_regress_snap_profile"
Remove-Item -Recurse -Force $profileDir -ErrorAction SilentlyContinue

# 1. Teams Dispatch at 100% Zoom (1440x900)
$helperEdr = @"
<!DOCTYPE html>
<html>
<body style="margin:0; background:#0b0f17;">
<iframe id="f" src="http://localhost:8080/cctv-ops-v2/index.html?workspace=edr" style="width:1440px; height:900px; border:none;"></iframe>
</body>
</html>
"@
Set-Content -Path "scratch\snap_edr100.html" -Value $helperEdr -Encoding utf8
$outEdr100 = "c:\Users\Mnavares\Documents\CCTV OPS\audit-report\scratch\v2_teams_dispatch_100.png"
& $edge --headless=new --disable-gpu --user-data-dir=$profileDir --window-size=1440,900 "--screenshot=$outEdr100" "http://localhost:8080/scratch/snap_edr100.html"
Start-Sleep -Seconds 2
Copy-Item $outEdr100 "C:\Users\Mnavares\.gemini\antigravity-ide\brain\9a6830ff-044f-4caf-bf7a-57f69e7d4a45\snap_teams_dispatch_100.png" -Force

# 2. Teams Dispatch at 150% Zoom equivalent (960x700)
$helperEdr150 = @"
<!DOCTYPE html>
<html>
<body style="margin:0; background:#0b0f17;">
<iframe id="f" src="http://localhost:8080/cctv-ops-v2/index.html?workspace=edr" style="width:960px; height:750px; border:none;"></iframe>
</body>
</html>
"@
Set-Content -Path "scratch\snap_edr150.html" -Value $helperEdr150 -Encoding utf8
$outEdr150 = "c:\Users\Mnavares\Documents\CCTV OPS\audit-report\scratch\v2_teams_dispatch_150.png"
& $edge --headless=new --disable-gpu --user-data-dir=$profileDir --window-size=960,750 "--screenshot=$outEdr150" "http://localhost:8080/scratch/snap_edr150.html"
Start-Sleep -Seconds 2
Copy-Item $outEdr150 "C:\Users\Mnavares\.gemini\antigravity-ide\brain\9a6830ff-044f-4caf-bf7a-57f69e7d4a45\snap_teams_dispatch_150.png" -Force

# 3. Cleaned Maintenance Block Layout
$helperMaint = @"
<!DOCTYPE html>
<html>
<body style="margin:0; background:#0b0f17;">
<iframe id="f" src="http://localhost:8080/cctv-ops-v2/index.html?workspace=maintenance" style="width:1440px; height:900px; border:none;"></iframe>
<script>
window.onload = async () => {
  const frame = document.getElementById('f');
  await new Promise(r => frame.onload = r);
  await new Promise(r => setTimeout(r, 1200));
  const doc = frame.contentDocument;
  const chips = doc.querySelectorAll('.maint-preset-chip');
  if (chips.length > 0) chips[0].click();
};
</script>
</body>
</html>
"@
Set-Content -Path "scratch\snap_maint_clean.html" -Value $helperMaint -Encoding utf8
$outMaint = "c:\Users\Mnavares\Documents\CCTV OPS\audit-report\scratch\v2_maint_cleaned.png"
& $edge --headless=new --disable-gpu --user-data-dir=$profileDir --window-size=1440,900 "--screenshot=$outMaint" "http://localhost:8080/scratch/snap_maint_clean.html"
Start-Sleep -Seconds 2
Copy-Item $outMaint "C:\Users\Mnavares\.gemini\antigravity-ide\brain\9a6830ff-044f-4caf-bf7a-57f69e7d4a45\snap_maintenance_block_cleaned.png" -Force

Write-Host "All regression visual evidence captured successfully."
