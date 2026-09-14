$temp = "scratch\edge_dim_prof"
if (Test-Path $temp) { Remove-Item -Recurse -Force $temp }
$edge = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
$url = "http://localhost:8080/cctv-ops-v2/?demo=1"

# Create a test script that measures dimensions in browser and logs to console
$html = @"
<!DOCTYPE html>
<html>
<body>
<iframe id="app" src="$url" style="width:1440px; height:900px; border:none;"></iframe>
<script>
window.onload = () => {
  setTimeout(() => {
    const doc = document.getElementById('app').contentDocument;
    const container = doc.getElementById('edrListContainer');
    const firstRow = doc.querySelector('.record-row');
    const splitCol = doc.querySelectorAll('.edr-split-column')[1];
    const data = {
      splitColWidth: splitCol ? splitCol.getBoundingClientRect().width : 0,
      containerClientWidth: container ? container.clientWidth : 0,
      firstRowWidth: firstRow ? firstRow.getBoundingClientRect().width : 0,
      firstRowHeight: firstRow ? firstRow.getBoundingClientRect().height : 0
    };
    fetch('http://localhost:8080/api/test_report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
  }, 1000);
};
</script>
</body>
</html>
"@
Set-Content -Path "scratch\measure_dim.html" -Value $html -Encoding utf8

& $edge --headless --disable-gpu --user-data-dir=$temp --window-size=1600,1000 "http://localhost:8080/scratch/measure_dim.html"
Start-Sleep -Seconds 3
Get-Content -Path "scratch\test_report.txt" -Raw
