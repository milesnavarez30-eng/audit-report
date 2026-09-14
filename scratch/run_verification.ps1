$edgePath = 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
if (-not (Test-Path $edgePath)) {
    $edgePath = 'C:\Program Files\Microsoft\Edge\Application\msedge.exe'
}

$screenshotBaseline = 'C:\Users\Mnavares\.gemini\antigravity-ide\brain\9a6830ff-044f-4caf-bf7a-57f69e7d4a45\snap_compact_1440x900_baseline.png'

# Capture 1440x900 100% baseline
Start-Process -FilePath $edgePath -ArgumentList @(
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    '--window-size=1440,900',
    "--screenshot=$screenshotBaseline",
    'http://localhost:8080/'
) -Wait

Write-Host "Baseline 1440x900 captured: $(Test-Path $screenshotBaseline)"

# Capture responsive zoom levels
$zoomLevels = @(
    @{ name='75'; width=1920; height=1200 },
    @{ name='90'; width=1600; height=1000 },
    @{ name='100'; width=1440; height=900 },
    @{ name='110'; width=1309; height=818 },
    @{ name='125'; width=1152; height=720 },
    @{ name='150'; width=960; height=600 },
    @{ name='175'; width=823; height=514 },
    @{ name='200'; width=720; height=450 }
)

foreach ($z in $zoomLevels) {
    $zoomSnap = "C:\Users\Mnavares\.gemini\antigravity-ide\brain\9a6830ff-044f-4caf-bf7a-57f69e7d4a45\snap_zoom_$($z.name).png"
    Start-Process -FilePath $edgePath -ArgumentList @(
        '--headless=new',
        '--disable-gpu',
        '--no-sandbox',
        "--window-size=$($z.width),$($z.height)",
        "--screenshot=$zoomSnap",
        'http://localhost:8080/'
    ) -Wait
    Write-Host "Zoom $($z.name)% (effective $($z.width)x$($z.height)): $(Test-Path $zoomSnap)"
}
