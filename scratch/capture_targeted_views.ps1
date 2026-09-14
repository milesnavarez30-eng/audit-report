$edge = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
if (-not (Test-Path $edge)) {
    $edge = "C:\Program Files\Microsoft\Edge\Application\msedge.exe"
}

$targets = @(
    @{ Name = "collapsed_rail"; Width = 1440; Height = 900; Url = "http://localhost:8080/cctv-ops-v2/?rail=collapsed"; Out = "c:\Users\Mnavares\Documents\CCTV OPS\audit-report\scratch\v2_snap_collapsed_rail.png" },
    @{ Name = "expanded_review"; Width = 1440; Height = 900; Url = "http://localhost:8080/cctv-ops-v2/?edr=expanded"; Out = "c:\Users\Mnavares\Documents\CCTV OPS\audit-report\scratch\v2_snap_expanded_review.png" },
    @{ Name = "normal_restored"; Width = 1440; Height = 900; Url = "http://localhost:8080/cctv-ops-v2/"; Out = "c:\Users\Mnavares\Documents\CCTV OPS\audit-report\scratch\v2_snap_normal_restored.png" }
)

foreach ($t in $targets) {
    if (Test-Path $t.Out) { Remove-Item -Force $t.Out }
    Write-Host "Capturing $($t.Name)..."
    $w = $t.Width
    $h = $t.Height
    $outPath = $t.Out
    $targetUrl = $t.Url
    $cmd = "`"$edge`" --headless=new --disable-gpu --window-size=$w,$h --screenshot=`"$outPath`" `"$targetUrl`""
    cmd.exe /c $cmd
    Start-Sleep -Milliseconds 700
    if (Test-Path $t.Out) {
        Write-Host "[OK] $($t.Name) captured: $( (Get-Item $t.Out).Length ) bytes" -ForegroundColor Green
    } else {
        Write-Host "[FAIL] $($t.Name) capture failed" -ForegroundColor Red
    }
}
