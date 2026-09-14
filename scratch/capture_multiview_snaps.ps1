$edge = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
if (-not (Test-Path $edge)) {
    $edge = "C:\Program Files\Microsoft\Edge\Application\msedge.exe"
}

$indexPath = "c:\Users\Mnavares\Documents\CCTV OPS\audit-report\cctv-ops-v2\index.html"
$url = "file:///$($indexPath.Replace('\', '/'))"

$targets = @(
    @{ Name = "desktop_1440"; Width = 1440; Height = 900; Out = "c:\Users\Mnavares\Documents\CCTV OPS\audit-report\scratch\snap_desktop_1440.png" },
    @{ Name = "tablet_768"; Width = 768; Height = 1024; Out = "c:\Users\Mnavares\Documents\CCTV OPS\audit-report\scratch\snap_tablet_768.png" },
    @{ Name = "mobile_375"; Width = 375; Height = 812; Out = "c:\Users\Mnavares\Documents\CCTV OPS\audit-report\scratch\snap_mobile_375.png" }
)

foreach ($t in $targets) {
    if (Test-Path $t.Out) { Remove-Item -Force $t.Out }
    Write-Host "Capturing $($t.Name) ($($t.Width)x$($t.Height))..."
    $w = $t.Width
    $h = $t.Height
    $outPath = $t.Out
    $cmd = "`"$edge`" --headless=new --disable-gpu --window-size=$w,$h --screenshot=`"$outPath`" `"$url`""
    cmd.exe /c $cmd
    Start-Sleep -Milliseconds 600
    if (Test-Path $t.Out) {
        Write-Host "[OK] $($t.Name) captured: $( (Get-Item $t.Out).Length ) bytes" -ForegroundColor Green
    } else {
        Write-Host "[FAIL] $($t.Name) capture failed" -ForegroundColor Red
    }
}
