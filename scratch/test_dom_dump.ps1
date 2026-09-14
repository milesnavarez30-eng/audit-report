$edge = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
if (-not (Test-Path $edge)) {
    $edge = "C:\Program Files\Microsoft\Edge\Application\msedge.exe"
}

$tempProfile = "c:\Users\Mnavares\Documents\CCTV OPS\audit-report\scratch\edge_temp_dom_profile"
if (Test-Path $tempProfile) {
    Remove-Item -Recurse -Force $tempProfile -ErrorAction SilentlyContinue
}

$domOut = "c:\Users\Mnavares\Documents\CCTV OPS\audit-report\scratch\test_saved_list_dom.html"
$url = "http://localhost:8080/scratch/test_v2_edr_saved_list_ui.html"

Write-Host "Dumping DOM of $url..." -ForegroundColor Cyan
$output = & $edge --headless=new --disable-gpu --virtual-time-budget=8000 --user-data-dir=$tempProfile --dump-dom $url
$output | Out-File -FilePath $domOut -Encoding utf8

$results = Get-Content $domOut | Select-String -Pattern 'RESULTS:|\[PASS\]|\[FAIL\]|SUITE ERROR'
$results | ForEach-Object { Write-Output $_.Line }
