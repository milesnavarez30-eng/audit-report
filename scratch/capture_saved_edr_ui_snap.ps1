$edge = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
if (-not (Test-Path $edge)) {
    $edge = "C:\Program Files\Microsoft\Edge\Application\msedge.exe"
}

$url = "http://localhost:8080/scratch/test_edr_dom.html"
$out = "c:\Users\Mnavares\Documents\CCTV OPS\audit-report\scratch\v2_saved_edr_ui_verified.png"

Write-Output "Capturing screenshot of Saved EDR list UI..."
& $edge --headless=new --disable-gpu --virtual-time-budget=5000 --window-size=1440,900 "--screenshot=$out" $url

Start-Sleep -Seconds 2

if (Test-Path $out) {
    Write-Output "Screenshot saved successfully: $out ($(Get-Item $out | Select-Object -ExpandProperty Length) bytes)"
} else {
    Write-Output "Screenshot failed"
}
