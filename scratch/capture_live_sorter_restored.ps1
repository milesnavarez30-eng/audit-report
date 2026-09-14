$ErrorActionPreference = "Continue"

$edge = 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
if (-not (Test-Path $edge)) {
    $edge = 'C:\Program Files\Microsoft\Edge\Application\msedge.exe'
}

$localImage = "c:\Users\Mnavares\Documents\CCTV OPS\audit-report\scratch\v2_live_sorter_restored.png"
$artifactImage = "C:\Users\Mnavares\.gemini\antigravity-ide\brain\9a6830ff-044f-4caf-bf7a-57f69e7d4a45\snap_live_sorter_restored.png"
$dataDir = [System.IO.Path]::Combine([System.IO.Path]::GetTempPath(), "edge-sorter-snap-" + [System.Guid]::NewGuid().ToString("N"))

# Pre-populate draft in the temp profile's localStorage before launch so it restores on initial load!
# First launch to set up profile, populate draft, and take screenshot on second load.
$setupHtml = @"
<!DOCTYPE html>
<html>
<head><script src="/cctv-ops-v2/js/config.js"></script><script src="/cctv-ops-v2/js/storage.js"></script><script src="/cctv-ops-v2/js/services/sorter-service.js"></script></head>
<body>
<script>
async function init() {
  const sample = "TIMESTAMP\tDATE\tTL\tACCOUNT\tSITE\tSTATION NO.\tSTATION ISSUE\n09/10/2026 10:00\t09/10/2026\tAllan Albert Sadili\tMapua\tMabini Site A\t1A-01\tMonitor not turning on\n09/10/2026 11:00\t09/10/2026\tCris Arandilla\tHerb Joy\tMabini Site A\t2B-10\tMouse optical sensor defect\n09/10/2026 12:00\t09/10/2026\tJohn Unknown\tUnknown Campaign\tMabini Site A\tGF-05\tHeadset static noise";
  const rows = window.sorterService.parseReport(sample);
  const assigns = window.sorterService.buildAssignments(rows);
  const assigned = window.sorterService.assignRows(rows, assigns);
  assigned[0].issue = "Restored user edit verified";
  await window.sorterService.saveDraft({
    rawText: sample,
    assignedRows: assigned,
    parsedRows: rows,
    assignments: Array.from(assigns.entries()),
    selectedRows: [0]
  });
  window.location.href = "/cctv-ops-v2/?workspace=sorter";
}
init();
</script>
</body>
</html>
"@

$setupPath = "c:\Users\Mnavares\Documents\CCTV OPS\audit-report\scratch\seed_sorter_and_snap.html"
[System.IO.File]::WriteAllText($setupPath, $setupHtml, [System.Text.Encoding]::UTF8)

Write-Host "Launching Edge to seed draft, load restored sorter workspace, and screenshot..." -ForegroundColor Cyan

& $edge --headless=new --disable-gpu --virtual-time-budget=6000 --window-size=1280,950 "--screenshot=$localImage" "http://localhost:8080/scratch/seed_sorter_and_snap.html"

Start-Sleep -Seconds 2
if (Test-Path $localImage) {
    Copy-Item -Force $localImage $artifactImage
    Write-Host "Restored workspace screenshot saved to $artifactImage!" -ForegroundColor Green
} else {
    Write-Host "Failed to capture screenshot." -ForegroundColor Red
}
