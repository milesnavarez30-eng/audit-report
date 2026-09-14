$edge = 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
if (-not (Test-Path $edge)) {
    $edge = 'C:\Program Files\Microsoft\Edge\Application\msedge.exe'
}

$tempProfile = Join-Path $PSScriptRoot "edge_saved_ui_test_profile"
if (Test-Path $tempProfile) {
    Remove-Item -Recurse -Force $tempProfile -ErrorAction SilentlyContinue
}

$domFile = Join-Path $PSScriptRoot "test_saved_ui_dom.html"
$url = 'http://localhost:8080/scratch/test_v2_edr_saved_list_ui.html'

Write-Host "Running test suite in Edge..." -ForegroundColor Cyan
$dom = & $edge --headless --disable-gpu --virtual-time-budget=8000 --user-data-dir=$tempProfile --dump-dom $url
$dom | Out-File -FilePath $domFile -Encoding utf8

$results = Get-Content $domFile | Select-String -Pattern 'RESULTS:|\[PASS\]|\[FAIL\]|SUITE ERROR'
$results | ForEach-Object { Write-Output $_.Line }
