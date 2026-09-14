$edge = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
$html = @"
<!DOCTYPE html>
<html>
<head><style>body { margin:0; padding:0; }</style></head>
<body>
<iframe id="frame" src="http://localhost:8080/cctv-ops-v2/?demo=1" style="width:1440px; height:900px; border:none;"></iframe>
<script>
window.onload = () => {
  setTimeout(() => {
    const doc = document.getElementById('frame').contentDocument;
    const splitCol2 = doc.querySelectorAll('.edr-split-column')[1];
    const list = doc.getElementById('edrListContainer');
    const firstRow = doc.querySelector('.record-row');
    const res = {
      windowWidth: 1440,
      col2Width: splitCol2 ? splitCol2.getBoundingClientRect().width : null,
      listWidth: list ? list.getBoundingClientRect().width : null,
      listScrollWidth: list ? list.scrollWidth : null,
      firstRowWidth: firstRow ? firstRow.getBoundingClientRect().width : null,
      firstRowHeight: firstRow ? firstRow.getBoundingClientRect().height : null
    };
    fetch('http://localhost:8080/api/test_report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(res)
    });
  }, 1200);
};
</script>
</body>
</html>
"@
Set-Content -Path "scratch\test_width.html" -Value $html -Encoding utf8

$tempDir = "scratch\edge_width_temp"
if (Test-Path $tempDir) { Remove-Item -Recurse -Force $tempDir }
& $edge --headless --disable-gpu --user-data-dir=$tempDir --window-size=1600,1000 "http://localhost:8080/scratch/test_width.html"
Start-Sleep -Seconds 2
Get-Content -Path "scratch\test_report.txt" -Raw
