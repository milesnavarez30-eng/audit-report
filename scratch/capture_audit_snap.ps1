$edge = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
if (-not (Test-Path $edge)) {
    $edge = "C:\Program Files\Microsoft\Edge\Application\msedge.exe"
}

$destSnap = "c:\Users\Mnavares\Documents\CCTV OPS\audit-report\scratch\v2_audit_workspace_snap.png"
if (Test-Path $destSnap) { Remove-Item -Force $destSnap }

$url = "http://localhost:8080/cctv-ops-v2/#audit"

Write-Output "Capturing audit workspace screenshot..."
& $edge --headless=new --disable-gpu --window-size=1440,920 "--screenshot=$destSnap" $url
Start-Sleep -Seconds 4

if (Test-Path $destSnap) {
    Write-Output "SUCCESS: Screenshot saved successfully to $destSnap ($(Get-Item $destSnap | Select-Object -ExpandProperty Length) bytes)"
} else {
    Write-Output "Failed to create screenshot."
}
