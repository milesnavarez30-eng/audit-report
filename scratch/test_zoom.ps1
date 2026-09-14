$edgePath = 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
if (-not (Test-Path $edgePath)) {
    $edgePath = 'C:\Program Files\Microsoft\Edge\Application\msedge.exe'
}

$zoomLevels = @(
    @{ name='75'; width=1920; height=1200 },
    @{ name='80'; width=1800; height=1125 },
    @{ name='90'; width=1600; height=1000 },
    @{ name='100'; width=1440; height=900 },
    @{ name='110'; width=1309; height=818 },
    @{ name='125'; width=1152; height=720 },
    @{ name='150'; width=960; height=600 },
    @{ name='175'; width=823; height=514 },
    @{ name='200'; width=720; height=450 }
)

foreach ($z in $zoomLevels) {
    $outPng = "scratch/test_zoom_$($z.name).png"
    $argList = @(
        '--headless',
        '--disable-gpu',
        '--no-sandbox',
        "--window-size=$($z.width),$($z.height)",
        "--screenshot=$outPng",
        'http://localhost:8080/'
    )
    Start-Process -FilePath $edgePath -ArgumentList $argList -Wait
    $status = Test-Path $outPng
    Write-Host "Zoom $($z.name)% (effective $($z.width)x$($z.height)): $status"
}
