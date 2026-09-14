$edge = 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
if (-not (Test-Path $edge)) {
    $edge = 'C:\Program Files\Microsoft\Edge\Application\msedge.exe'
}

& $edge --headless=new --disable-gpu --virtual-time-budget=12000 --dump-dom "http://localhost:8080/scratch/test_v2_followup_parity.html" | Out-File -FilePath .\scratch\followup_parity_dom.html -Encoding utf8
Get-Content .\scratch\followup_parity_dom.html | Select-String -Pattern 'summary|PASS|FAIL'
