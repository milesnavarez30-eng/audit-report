$edge = 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
if (-not (Test-Path $edge)) {
    $edge = 'C:\Program Files\Microsoft\Edge\Application\msedge.exe'
}
& $edge --headless=new --disable-gpu --virtual-time-budget=6000 --dump-dom 'http://localhost:8080/scratch/test_v2_maintenance_parity.html' | Out-File -FilePath .\scratch\maintenance_parity_dom.html -Encoding utf8
(Get-Content .\scratch\maintenance_parity_dom.html | Select-String 'class="test-fail"')
