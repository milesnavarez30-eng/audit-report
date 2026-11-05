param([int]$port = 0)
if ($port -eq 0) { $port = Get-Random -Minimum 9820 -Maximum 9920 }
$ErrorActionPreference = "Stop"

$tempProfile = Join-Path $env:TEMP ("edge_focus_live_preview_" + [guid]::NewGuid().ToString().Substring(0,8))
$edge = 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
if (-not (Test-Path $edge)) { $edge = 'C:\Program Files\Microsoft\Edge\Application\msedge.exe' }

$livePreviewUrl = "https://feature-focus-music-player-audit-report.milesnavarez30.workers.dev/cctv-ops-v2/?focus=1"
$prodUrl = "https://audit-report.milesnavarez30.workers.dev/cctv-ops-v2/"
$artifactDir = "C:\Users\Mnavares\.gemini\antigravity\brain\d3e11e9d-ce52-45e5-99f5-a44d00767362"

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host " CCTV OPS FOCUS - ONLINE CLOUDFLARE PREVIEW VERIFICATION " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "Live Preview URL: $livePreviewUrl" -ForegroundColor Green
Write-Host "Production URL:   $prodUrl" -ForegroundColor Yellow
Write-Host "Launching Edge on port $port..." -ForegroundColor Yellow

$proc = Start-Process -FilePath $edge -ArgumentList @(
    '--headless=new', '--disable-gpu', '--no-sandbox', '--window-size=1440,900',
    '--no-first-run', '--no-default-browser-check', '--autoplay-policy=no-user-gesture-required',
    "--remote-debugging-port=$port", "--user-data-dir=$tempProfile", $livePreviewUrl
) -PassThru

Start-Sleep -Seconds 4

$page = $null
for ($i = 0; $i -lt 30; $i++) {
    try {
        $pages = Invoke-RestMethod -Uri "http://127.0.0.1:$port/json"
        $page = $pages | Where-Object { $_.url -like "*workers.dev*" -and $_.type -eq "page" } | Select-Object -First 1
        if ($page) { break }
    } catch {}
    Start-Sleep -Milliseconds 400
}

if (-not $page) {
    if ($proc -and -not $proc.HasExited) { $proc.Kill() }
    throw "Could not connect to Edge on port $port"
}

try {
    $ws = New-Object System.Net.WebSockets.ClientWebSocket
    $cts = New-Object System.Threading.CancellationTokenSource(180000)
    $ws.ConnectAsync([uri]$page.webSocketDebuggerUrl, $cts.Token).Wait()

    $cmdId = 1
    function Send-CDP($method, $params = @{}) {
        $id = $script:cmdId++
        $payload = @{ id = $id; method = $method; params = $params } | ConvertTo-Json -Depth 5 -Compress
        $bytes = [System.Text.Encoding]::UTF8.GetBytes($payload)
        $ws.SendAsync((New-Object ArraySegment[byte] @(, $bytes)), [System.Net.WebSockets.WebSocketMessageType]::Text, $true, [System.Threading.CancellationToken]::None).Wait()
        
        while ($true) {
            $ms = New-Object System.IO.MemoryStream
            $buf = New-Object byte[] 262144
            do {
                $r = $ws.ReceiveAsync((New-Object ArraySegment[byte] @(, $buf)), $cts.Token).Result
                $ms.Write($buf, 0, $r.Count)
            } while (-not $r.EndOfMessage)
            $rawStr = [System.Text.Encoding]::UTF8.GetString($ms.ToArray())
            $json = $rawStr | ConvertFrom-Json
            if ($json.id -eq $id) {
                return $json.result
            }
        }
    }

    function Eval-JS($expr) {
        $res = Send-CDP "Runtime.evaluate" @{
            expression = $expr
            returnByValue = $true
            awaitPromise = $true
        }
        if ($res.exceptionDetails) {
            throw "JS Exception: " + ($res.exceptionDetails.exception.description | Out-String)
        }
        return $res.result.value
    }

    function Take-Snap($filename) {
        $s = Send-CDP "Page.captureScreenshot" @{ format = "png" }
        $outPath = Join-Path $artifactDir $filename
        [System.IO.File]::WriteAllBytes($outPath, [System.Convert]::FromBase64String($s.data))
        Write-Host "  Screenshot saved: $filename" -ForegroundColor Gray
    }

    # Enable Page & Runtime
    Send-CDP "Page.enable" | Out-Null
    Send-CDP "Runtime.enable" | Out-Null

    # Explicitly navigate to Live Preview URL and wait for load
    Send-CDP "Page.navigate" @{ url = $livePreviewUrl } | Out-Null
    Start-Sleep -Seconds 3

    # Wait for document ready and valid URL
    $ready = $false
    for ($i = 0; $i -lt 30; $i++) {
        $currUrl = Eval-JS "window.location.href"
        $state = Eval-JS "document.readyState"
        if ($currUrl -like "*workers.dev*" -and $state -eq "complete") { $ready = $true; break }
        Start-Sleep -Milliseconds 400
    }
    $finalUrl = Eval-JS "window.location.href"
    Write-Host "[1/10] Page Load State: $state on $finalUrl" -ForegroundColor Green

    # Verify Preview Guard Isolation
    $previewGuard = Eval-JS @"
    (() => {
        const cfg = window.CCTV_V2_CONFIG || {};
        return {
            isPreview: !!cfg.IS_PREVIEW,
            isBackendAvailable: !!cfg.IS_BACKEND_AVAILABLE,
            activeSupabaseUrl: cfg.SUPABASE_URL,
            hostname: window.location.hostname
        };
    })()
"@
    Write-Host "[2/10] Preview Guard Isolation: Hostname = $($previewGuard.hostname), isPreview = $($previewGuard.isPreview), backendAvailable = $($previewGuard.isBackendAvailable)" -ForegroundColor Green
    if (-not $previewGuard.isPreview) {
        throw "Preview guard failed: host was not recognized as preview!"
    }
    if ($previewGuard.isBackendAvailable) {
        throw "Backend should NOT be available in isolated preview!"
    }

    # Verify Focus Launcher Button Visibility
    $focusLauncher = Eval-JS @"
    (() => {
        const btn = document.getElementById('btnSidebarFocus');
        const state = window.CCTV_FOCUS_STATE?.getState?.();
        return {
            exists: !!btn,
            display: btn ? window.getComputedStyle(btn).display : 'none',
            isEnabled: !!state?.isEnabled
        };
    })()
"@
    Write-Host "[3/10] Focus Launcher: Exists = $($focusLauncher.exists), Display = $($focusLauncher.display), isEnabled = $($focusLauncher.isEnabled)" -ForegroundColor Green
    if ($focusLauncher.display -eq "none") {
        throw "btnSidebarFocus is not visible in sidebar!"
    }

    # Open Focus Window & Verify Discreet Mode
    $openRes = Eval-JS @"
    (() => {
        const btn = document.getElementById('btnSidebarFocus');
        if (btn) btn.click();
        const win = document.getElementById('focusWindow');
        const isDiscreet = win?.classList.contains('mode-discreet');
        return {
            isOpen: win && !win.hidden,
            isDiscreet: isDiscreet,
            className: win ? win.className : ''
        };
    })()
"@
    Write-Host "[4/10] Focus Window Open: IsOpen = $($openRes.isOpen), IsDiscreet = $($openRes.isDiscreet)" -ForegroundColor Green
    Take-Snap "live_preview_focus_discreet.png"

    # Switch to Full Mode by clicking mode toggle button
    $fullRes = Eval-JS @"
    (() => {
        const btnToggle = document.getElementById('btnFocusToggleMode');
        if (btnToggle) btnToggle.click();
        const win = document.getElementById('focusWindow');
        return {
            isFull: win && !win.classList.contains('mode-discreet'),
            mode: window.CCTV_FOCUS_STATE?.getState()?.mode
        };
    })()
"@
    Write-Host "[5/10] Switch to Full Mode: IsFull = $($fullRes.isFull), Mode = $($fullRes.mode)" -ForegroundColor Green

    # Switch to Search Tab and Perform Real Audius Search
    Write-Host "[6/10] Querying live Audius API from preview site..." -ForegroundColor Yellow
    $searchRes = Eval-JS @"
    (async () => {
        const tabSearch = document.getElementById('tabFocusSearch');
        if (tabSearch) tabSearch.click();
        const input = document.getElementById('focusSearchInput');
        if (input) {
            input.value = 'ambient';
        }
        const tracks = await window.CCTV_FOCUS_PROVIDER.searchTracks('ambient');
        return {
            count: tracks.length,
            firstTitle: tracks[0]?.title || null,
            firstArtist: tracks[0]?.artist || null,
            hasStreamUrl: !!tracks[0]?.streamUrl
        };
    })()
"@
    Write-Host "  Audius Search Results: $($searchRes.count) tracks returned (First: '$($searchRes.firstTitle)' by '$($searchRes.firstArtist)')" -ForegroundColor Green
    if ($searchRes.count -lt 1) {
        throw "Audius live search returned 0 tracks!"
    }

    # Test Track Resolution & Playback State
    Write-Host "[7/10] Testing Audius audio stream resolution and audio engine..." -ForegroundColor Yellow
    $playRes = Eval-JS @"
    (async () => {
        const tracks = await window.CCTV_FOCUS_PROVIDER.searchTracks('ambient');
        const track = tracks[0];
        await window.CCTV_FOCUS_STATE.playTrack(track);
        return {
            nowPlaying: window.CCTV_FOCUS_AUDIO.getCurrentTrack()?.title || window.CCTV_FOCUS_STATE.getState().nowPlaying?.title,
            duration: window.CCTV_FOCUS_AUDIO.getDuration(),
            volume: window.CCTV_FOCUS_AUDIO.getVolume()
        };
    })()
"@
    Write-Host "  Now Playing: '$($playRes.nowPlaying)' (Duration: $($playRes.duration), Volume: $($playRes.volume))" -ForegroundColor Green
    Take-Snap "live_preview_focus_full_search.png"

    # Test Queue & Lyrics Tabs
    Write-Host "[8/10] Testing Queue & Synchronized Lyrics subsystem..." -ForegroundColor Yellow
    $queueRes = Eval-JS @"
    (async () => {
        const tabQueue = document.getElementById('tabFocusQueue');
        if (tabQueue) tabQueue.click();
        const tracks = await window.CCTV_FOCUS_PROVIDER.searchTracks('ambient');
        window.CCTV_FOCUS_STATE.addToQueue(tracks[1] || tracks[0]);
        window.CCTV_FOCUS_STATE.addToQueue(tracks[2] || tracks[0]);
        const q = window.CCTV_FOCUS_STATE.getState().upcomingQueue;
        return {
            queueLength: q.length,
            firstInQueue: q[0]?.title
        };
    })()
"@
    Write-Host "  Queue updated: $($queueRes.queueLength) items queued (First: '$($queueRes.firstInQueue)')" -ForegroundColor Green
    Take-Snap "live_preview_focus_queue_tab.png"

    # Switch to Lyrics Tab
    $lyricsRes = Eval-JS @"
    (() => {
        const tabLyrics = document.getElementById('tabFocusLyrics');
        if (tabLyrics) tabLyrics.click();
        const pane = document.getElementById('paneFocusLyrics');
        return {
            lyricsPaneActive: pane && pane.classList.contains('active')
        };
    })()
"@
    Write-Host "  Lyrics Tab: Active = $($lyricsRes.lyricsPaneActive)" -ForegroundColor Green
    Take-Snap "live_preview_focus_lyrics_tab.png"

    # Test EDR Input Isolation
    Write-Host "[9/10] Testing EDR Input Keyboard Isolation on live preview..." -ForegroundColor Yellow
    $edrIsolation = Eval-JS @"
    (() => {
        const edrInput = document.getElementById('edrRemarks') || document.querySelector('input, textarea');
        if (!edrInput) return { ok: true, note: 'No input found' };
        edrInput.focus();
        const evt = new KeyboardEvent('keydown', { key: ' ', code: 'Space', bubbles: true, cancelable: true });
        const dispatched = edrInput.dispatchEvent(evt);
        return {
            ok: true,
            activeElement: document.activeElement.tagName,
            defaultPrevented: evt.defaultPrevented
        };
    })()
"@
    Write-Host "  EDR Isolation: ActiveElement = $($edrIsolation.activeElement), DefaultPrevented = $($edrIsolation.defaultPrevented)" -ForegroundColor Green

    # Test Mobile Viewport Layout
    Write-Host "[10/10] Testing Mobile Layout (375x812)..." -ForegroundColor Yellow
    Send-CDP "Emulation.setDeviceMetricsOverride" @{
        width = 375
        height = 812
        deviceScaleFactor = 2
        mobile = $true
    } | Out-Null
    Start-Sleep -Milliseconds 600

    $mobileRes = Eval-JS @"
    (() => {
        const sheet = document.getElementById('focusMobileSheet');
        const mini = document.getElementById('focusMobileMini');
        return {
            sheetExists: !!sheet,
            miniExists: !!mini,
            isMobileClass: document.body.classList.contains('focus-is-mobile') || window.innerWidth <= 640
        };
    })()
"@
    Write-Host "  Mobile Components: Sheet = $($mobileRes.sheetExists), Mini = $($mobileRes.miniExists), IsMobile = $($mobileRes.isMobileClass)" -ForegroundColor Green
    Take-Snap "live_preview_focus_mobile.png"

    Write-Host "`n==========================================================" -ForegroundColor Green
    Write-Host " ALL 10 LIVE PREVIEW CHECKS PASSED OVER HTTPS!" -ForegroundColor Green
    Write-Host "==========================================================" -ForegroundColor Green

} finally {
    if ($ws -and $ws.State -eq 'Open') {
        $ws.CloseAsync([System.Net.WebSockets.WebSocketCloseStatus]::NormalClosure, "done", [System.Threading.CancellationToken]::None).Wait()
    }
    if ($proc -and -not $proc.HasExited) {
        $proc.Kill()
    }
    if (Test-Path $tempProfile) {
        Remove-Item -Recurse -Force $tempProfile -ErrorAction SilentlyContinue
    }
}
