$edge = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
if (-not (Test-Path $edge)) {
  $edge = "C:\Program Files\Microsoft\Edge\Application\msedge.exe"
}
$temp = "scratch\edge_zoom_prof"
if (Test-Path $temp) { Remove-Item -Recurse -Force $temp }

$testHtml = @"
<!DOCTYPE html>
<html>
<head><title>Zoom Audit</title></head>
<body>
<iframe id="testFrame" src="http://localhost:8080/cctv-ops-v2/?demo=1" style="width:1440px; height:900px; border:none;"></iframe>
<script>
async function runAudit() {
  const iframe = document.getElementById('testFrame');
  await new Promise(r => iframe.onload = r);
  await new Promise(r => setTimeout(r, 1200));

  const win = iframe.contentWindow;
  const doc = iframe.contentDocument;
  const zoomLevels = [0.75, 0.80, 0.90, 1.0, 1.10, 1.25, 1.50, 1.75, 2.0];
  const results = [];

  for (const z of zoomLevels) {
    // Apply zoom on documentElement/body or simulate zoom via viewport
    doc.body.style.zoom = z;
    await new Promise(r => setTimeout(r, 150));

    const issues = [];
    const vpWidth = win.innerWidth;
    const vpHeight = win.innerHeight;

    // Check topbar controls clipping
    const topbar = doc.querySelector('.top-appbar');
    if (topbar) {
      const tbRect = topbar.getBoundingClientRect();
      const rightBtns = doc.querySelector('.appbar-right');
      if (rightBtns) {
        const rRect = rightBtns.getBoundingClientRect();
        if (rRect.right > (tbRect.right + 2)) {
          issues.push({ type: 'topbar_clipped', z, rRight: rRect.right, tbRight: tbRect.right });
        }
      }
    }

    // Check modals
    const modals = doc.querySelectorAll('.modal-dialog');
    modals.forEach(m => {
      const mBack = m.closest('.modal-backdrop');
      if (mBack) {
        // temporarly unhide to check max-height overflow
        const wasHidden = mBack.hidden;
        mBack.hidden = false;
        const rect = m.getBoundingClientRect();
        const footer = m.querySelector('.modal-footer');
        const fRect = footer ? footer.getBoundingClientRect() : null;
        if (fRect && (fRect.bottom > vpHeight + 5)) {
          // If modal footer goes below viewport and backdrop is not scrollable:
          const backOverflow = win.getComputedStyle(mBack).overflowY;
          if (backOverflow !== 'auto' && backOverflow !== 'scroll') {
            issues.push({ type: 'modal_footer_inaccessible', id: mBack.id, z });
          }
        }
        mBack.hidden = wasHidden;
      }
    });

    // Check horizontal page scroll
    const docWidth = doc.documentElement.scrollWidth;
    const clientWidth = doc.documentElement.clientWidth;
    // We expect app-root to not cause horizontal overflow on the root document
    if (docWidth > clientWidth + 1) {
      issues.push({ type: 'doc_horizontal_overflow', z, docWidth, clientWidth });
    }

    results.push({ zoom: z, issuesCount: issues.length, issues });
  }

  // Restore 1.0 zoom
  doc.body.style.zoom = 1.0;

  await fetch('http://localhost:8080/api/test_report', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(results)
  });
}
window.onload = runAudit;
</script>
</body>
</html>
"@

Set-Content -Path "scratch\test_zoom_audit.html" -Value $testHtml -Encoding utf8
& $edge --headless --disable-gpu --user-data-dir=$temp --window-size=1600,1000 "http://localhost:8080/scratch/test_zoom_audit.html"
Start-Sleep -Seconds 3
if (Test-Path "scratch\test_report.txt") {
  Get-Content -Path "scratch\test_report.txt" -Raw
}
