$edgePath = 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
if (-not (Test-Path $edgePath)) {
    $edgePath = 'C:\Program Files\Microsoft\Edge\Application\msedge.exe'
}

$tempProfile = Join-Path $PSScriptRoot "edge_parity_profile"
if (Test-Path $tempProfile) {
    Remove-Item -Recurse -Force $tempProfile -ErrorAction SilentlyContinue
}

$dom = & $edgePath --headless --disable-gpu --virtual-time-budget=6000 --user-data-dir=$tempProfile --dump-dom 'http://localhost:8080/scratch/test_v2_edr_complete_parity.html'
$dom | Out-File -FilePath (Join-Path $PSScriptRoot "test_parity_output.html") -Encoding utf8

$results = Get-Content (Join-Path $PSScriptRoot "test_parity_output.html") | Select-String -Pattern 'Total Tests|\[PASS\]|\[FAIL\]'
$results | ForEach-Object { Write-Output $_.Line }
