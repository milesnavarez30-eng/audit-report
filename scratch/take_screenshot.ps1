$edge = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
$out = "c:\Users\Mnavares\Documents\CCTV OPS\audit-report\scratch\v2_fresh_headless_new.png"
$url = "http://localhost:8080/cctv-ops-v2/"

& $edge --headless=new --disable-gpu --window-size=1440,900 "--screenshot=$out" $url
Start-Sleep -Seconds 1
if (Test-Path $out) {
    Write-Output "Screenshot saved successfully to $out ($(Get-Item $out | Select-Object -ExpandProperty Length) bytes)"
} else {
    Write-Output "Screenshot failed"
}
