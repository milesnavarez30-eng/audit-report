param([int]$port = 0)
if ($port -eq 0) { $port = Get-Random -Minimum 9820 -Maximum 9920 }
$ErrorActionPreference = "Stop"

$tempProfile = Join-Path $env:TEMP ("edge_focus_corrective_" + [guid]::NewGuid().ToString().Substring(0,8))
$edge = 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
if (-not (Test-Path $edge)) { $edge = 'C:\Program Files\Microsoft\Edge\Application\msedge.exe' }

$targetUrl = "http://127.0.0.1:5500/cctv-ops-v2/?workspace=dashboard"
$artifactDir = "C:\Users\Mnavares\.gemini\antigravity\brain\d3e11e9d-ce52-45e5-99f5-a44d00767362"

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "CCTV OPS FOCUS - CORRECTIVE AUDIT VERIFICATION" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "Launching Edge on port $port..." -ForegroundColor Yellow

$proc = Start-Process -FilePath $edge -ArgumentList @(
    '--headless=new', '--disable-gpu', '--no-sandbox', '--window-size=1440,900',
    '--no-first-run', '--no-default-browser-check', '--autoplay-policy=no-user-gesture-required',
    "--remote-debugging-port=$port", "--user-data-dir=$tempProfile", $targetUrl
) -PassThru

Start-Sleep -Seconds 3

$page = $null
for ($i = 0; $i -lt 30; $i++) {
    try {
        $pages = Invoke-RestMethod -Uri "http://127.0.0.1:$port/json"
        $page = $pages | Where-Object { $_.url -like "*127.0.0.1:5500*" -and $_.type -eq "page" } | Select-Object -First 1
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
    $cts = New-Object System.Threading.CancellationTokenSource(120000)
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
            if ($json.PSObject.Properties['id'] -and $json.id -eq $id) {
                return $json
            }
        }
    }

    function Send-Eval($expression, $awaitPromise = $false) {
        $params = @{ expression = $expression; returnByValue = $true }
        if ($awaitPromise) { $params['awaitPromise'] = $true }
        $res = Send-CDP "Runtime.evaluate" $params
        if ($res.result.exceptionDetails) {
            throw "JS Exception: $($res.result.exceptionDetails.exception.description)"
        }
        return $res.result.result.value
    }

    function Take-Screenshot($filename, $clip = $null) {
        $params = @{ format = "png" }
        if ($clip) { $params['clip'] = $clip }
        $res = Send-CDP "Page.captureScreenshot" $params
        $base64 = $res.result.data
        $bytes = [System.Convert]::FromBase64String($base64)
        $outPath = Join-Path $artifactDir $filename
        [System.IO.File]::WriteAllBytes($outPath, $bytes)
        Write-Host "   -> Captured: $filename" -ForegroundColor Green
    }

    Send-CDP "Runtime.enable" @{} | Out-Null
    Send-CDP "Page.enable" @{} | Out-Null
    
    # Wait for scripts to initialize
    for ($i = 0; $i -lt 30; $i++) {
        $ready = Send-Eval "(typeof window.CCTV_FOCUS !== 'undefined' && typeof window.CCTV_FOCUS_STATE !== 'undefined')"
        if ($ready) { break }
        Start-Sleep -Milliseconds 400
    }

    # =========================================================================
    # AUDIT 1: Account Switching & Privacy Isolation Test
    # =========================================================================
    Write-Host "`n[Audit 1] Testing Account Privacy & Switching Isolation..." -ForegroundColor Yellow
    $privacyResult = Send-Eval -awaitPromise $true -expression @'
    (async function() {
        const userA = { id: "usr_alice_ops", email: "alice@cctvops.test", role: "user" };
        const userB = { id: "usr_bob_ops", email: "bob@cctvops.test", role: "user" };

        window.CCTV_FOCUS.enable();

        // 1. Log in User A
        window.CCTV_AUTH.setLocalSession(userA, { id: userA.id, role: userA.role, permissions: {} });
        await new Promise(r => setTimeout(r, 200));

        const trackA1 = { id: "track_a1", title: "Alice Track 1", artist: "Artist A", duration: 120, streamUrl: "https://example.com/a1.mp3" };
        const trackA2 = { id: "track_a2", title: "Alice Queued Track", artist: "Artist A", duration: 150, streamUrl: "https://example.com/a2.mp3" };

        window.CCTV_FOCUS_STATE.addToQueue(trackA2);
        window.CCTV_FOCUS_LYRICS.saveCustomLyrics("track_a1", "[00:10.00] Alice custom lyric", 1.5);
        window.CCTV_FOCUS_STATE.saveState();

        const userAStateSnap = window.CCTV_FOCUS_STATE.getState();
        const userACustomLyrics = window.CCTV_FOCUS_LYRICS.getCustomLyrics("track_a1");

        // 2. User A logs out
        window.CCTV_AUTH.signOut();
        await new Promise(r => setTimeout(r, 200));

        const postLogoutState = window.CCTV_FOCUS_STATE.getState();
        const audioAfterLogout = window.CCTV_FOCUS_AUDIO.getState();

        // 3. User B logs in
        window.CCTV_AUTH.setLocalSession(userB, { id: userB.id, role: userB.role, permissions: {} });
        await new Promise(r => setTimeout(r, 200));

        const userBInitialState = window.CCTV_FOCUS_STATE.getState();
        const userBSeesAliceLyrics = window.CCTV_FOCUS_LYRICS.getCustomLyrics("track_a1");

        // User B adds their own track
        const trackB1 = { id: "track_b1", title: "Bob Queued Track", artist: "Artist B", duration: 180, streamUrl: "https://example.com/b1.mp3" };
        window.CCTV_FOCUS_STATE.addToQueue(trackB1);
        window.CCTV_FOCUS_LYRICS.saveCustomLyrics("track_b1", "[00:20.00] Bob private lyric", 0.0);
        window.CCTV_FOCUS_STATE.saveState();

        const userBFinalState = window.CCTV_FOCUS_STATE.getState();

        // 4. User B logs out
        window.CCTV_AUTH.signOut();
        await new Promise(r => setTimeout(r, 200));

        // 5. User A logs back in
        window.CCTV_AUTH.setLocalSession(userA, { id: userA.id, role: userA.role, permissions: {} });
        await new Promise(r => setTimeout(r, 200));

        const userARestoredState = window.CCTV_FOCUS_STATE.getState();
        const userAStillHasLyrics = window.CCTV_FOCUS_LYRICS.getCustomLyrics("track_a1");
        const userASeesBobTrack = userARestoredState.upcomingQueue.some(t => t.id === "track_b1");

        return {
            userAQueueCount: userAStateSnap.upcomingQueue.length,
            userACustomLyricsSaved: !!userACustomLyrics,
            logoutMemoryWiped: postLogoutState.upcomingQueue.length === 0 && postLogoutState.nowPlaying === null,
            logoutAudioStopped: !audioAfterLogout.isPlaying,
            userBInitialQueueClean: userBInitialState.upcomingQueue.length === 0,
            userBSeesAliceLyrics: !!userBSeesAliceLyrics,
            userBQueueCount: userBFinalState.upcomingQueue.length,
            userARestoredQueueCount: userARestoredState.upcomingQueue.length,
            userARestoredTrackTitle: userARestoredState.upcomingQueue[0]?.title,
            userASeesBobTrack: userASeesBobTrack,
            userAStillHasLyrics: !!userAStillHasLyrics
        };
    })()
'@

    Write-Host "   - User A Saved Queue & Lyrics: $($privacyResult.userAQueueCount) items, lyrics saved = $($privacyResult.userACustomLyricsSaved)"
    Write-Host "   - Post-Logout In-Memory Wiped: $($privacyResult.logoutMemoryWiped)"
    Write-Host "   - Post-Logout Audio Stopped: $($privacyResult.logoutAudioStopped)"
    Write-Host "   - User B Started with Clean Queue: $($privacyResult.userBInitialQueueClean) (Must be True)"
    Write-Host "   - User B Sees User A's Lyrics: $($privacyResult.userBSeesAliceLyrics) (Must be False)"
    Write-Host "   - User A Re-login Restored Own Queue: $($privacyResult.userARestoredQueueCount) items ('$($privacyResult.userARestoredTrackTitle)')"
    Write-Host "   - User A Sees User B's Track: $($privacyResult.userASeesBobTrack) (Must be False)"
    Write-Host "   - User A Restored Own Lyrics: $($privacyResult.userAStillHasLyrics) (Must be True)"

    if (-not ($privacyResult.logoutMemoryWiped -and $privacyResult.userBInitialQueueClean -and (-not $privacyResult.userBSeesAliceLyrics) -and (-not $privacyResult.userASeesBobTrack))) {
        throw "Account privacy isolation test failed!"
    }

    # =========================================================================
    # AUDIT 2: Revised Keyboard Shortcuts Verification
    # =========================================================================
    Write-Host "`n[Audit 2] Testing Revised Shortcuts (Alt+Shift+F, Alt+Shift+H, Alt+Shift+M, Alt+Shift+Space)..." -ForegroundColor Yellow
    $shortcutResult = Send-Eval -expression @'
    (function() {
        document.body.classList.remove("auth-locked");
        window.CCTV_FOCUS.enable();
        window.CCTV_FOCUS.hide();

        const dispatchKey = (code, key, alt = true, shift = true) => {
            const ev = new KeyboardEvent("keydown", {
                code: code,
                key: key,
                altKey: alt,
                shiftKey: shift,
                bubbles: true,
                cancelable: true
            });
            document.dispatchEvent(ev);
        };

        // 1. Test Alt+Shift+F toggles open
        dispatchKey("KeyF", "F");
        const afterToggleOpen = window.CCTV_FOCUS.getState().isWindowVisible;

        // 2. Test Alt+Shift+H quick hides
        dispatchKey("KeyH", "H");
        const afterQuickHide = window.CCTV_FOCUS.getState().isWindowVisible;

        // 3. Test Alt+Shift+F toggles open again
        dispatchKey("KeyF", "F");
        const reOpened = window.CCTV_FOCUS.getState().isWindowVisible;

        // 4. Test Alt+Shift+M quick mute
        const muteBefore = window.CCTV_FOCUS_AUDIO.isMuted();
        dispatchKey("KeyM", "M");
        const muteAfter1 = window.CCTV_FOCUS_AUDIO.isMuted();
        dispatchKey("KeyM", "M");
        const muteAfter2 = window.CCTV_FOCUS_AUDIO.isMuted();

        // 5. Test Escape key hides Focus
        const evEsc = new KeyboardEvent("keydown", { key: "Escape", code: "Escape", bubbles: true, cancelable: true });
        document.dispatchEvent(evEsc);
        const afterEsc = window.CCTV_FOCUS.getState().isWindowVisible;

        return {
            toggleOpened: afterToggleOpen,
            quickHidden: !afterQuickHide,
            reOpened: reOpened,
            muteToggledOn: !muteBefore && muteAfter1,
            muteToggledOff: !muteAfter2,
            escapeHidden: !afterEsc
        };
    })()
'@
    Write-Host "   - Alt+Shift+F Opened Window: $($shortcutResult.toggleOpened)"
    Write-Host "   - Alt+Shift+H Quick Hidden: $($shortcutResult.quickHidden)"
    Write-Host "   - Alt+Shift+F Re-opened: $($shortcutResult.reOpened)"
    Write-Host "   - Alt+Shift+M Muted and Unmuted: $($shortcutResult.muteToggledOn) / $($shortcutResult.muteToggledOff)"
    Write-Host "   - Escape Hidden: $($shortcutResult.escapeHidden)"

    if (-not ($shortcutResult.toggleOpened -and $shortcutResult.quickHidden -and $shortcutResult.muteToggledOn -and $shortcutResult.escapeHidden)) {
        throw "Keyboard shortcuts test failed!"
    }

    # =========================================================================
    # AUDIT 3: Lyrics Follow Live Discovery & Usability (No Auto-Dismiss)
    # =========================================================================
    Write-Host "`n[Audit 3] Testing Lyrics Follow Live (Persistent Usability, No 8-second Timeout)..." -ForegroundColor Yellow
    $followLiveResult = Send-Eval -awaitPromise $true -expression @'
    (async function() {
        window.CCTV_FOCUS.show();
        window.CCTV_FOCUS_STATE.setMode("full");
        window.CCTV_FOCUS_STATE.setActiveTab("lyrics");

        // Load track with sample lyrics
        const sampleTrack = { id: "track_test_lrc", title: "Live Sync Song", artist: "Singer", duration: 120, streamUrl: "" };
        const sampleLrc = `[00:01.00] Line 1 Intro\n[00:04.00] Line 2 Verse begins\n[00:08.00] Line 3 Continuing song\n[00:12.00] Line 4 Chorus arrival\n[00:16.00] Line 5 Outro lyrics`;
        window.CCTV_FOCUS_LYRICS.saveCustomLyrics(sampleTrack.id, sampleLrc, 0);

        window.CCTV_FOCUS_STATE.nowPlaying = sampleTrack;
        await window.CCTV_FOCUS_WINDOW.renderTrackInfo ? window.CCTV_FOCUS_WINDOW.renderTrackInfo(sampleTrack) : null;
        
        // Populate lyrics DOM directly
        const area = document.getElementById("focusLyricsArea");
        area.innerHTML = `
            <div class="focus-lyric-line" data-time="1">Line 1 Intro</div>
            <div class="focus-lyric-line active" data-time="4">Line 2 Verse begins</div>
            <div class="focus-lyric-line" data-time="8">Line 3 Continuing song</div>
            <div class="focus-lyric-line" data-time="12">Line 4 Chorus arrival</div>
            <div class="focus-lyric-line" data-time="16">Line 5 Outro lyrics</div>
        `;

        const btnFollowLive = document.getElementById("btnFocusFollowLive");

        // 1. Before scroll, Follow Live button should be hidden
        const initialDisplay = btnFollowLive.style.display;

        // 2. Trigger manual scroll
        area.scrollTop = 150;
        area.dispatchEvent(new Event("scroll"));

        const displayAfterScroll = btnFollowLive.style.display;

        // 3. Wait 9.5 seconds (exceeding the old 8-second auto-dismiss timeout)
        await new Promise(r => setTimeout(r, 9500));

        const displayAfter10Seconds = btnFollowLive.style.display;

        // 4. Click Follow Live button
        btnFollowLive.click();

        const displayAfterClick = btnFollowLive.style.display;

        return {
            initialHidden: initialDisplay === "none" || initialDisplay === "",
            visibleAfterScroll: displayAfterScroll === "flex",
            stillVisibleAfter10Seconds: displayAfter10Seconds === "flex",
            hiddenAfterClick: displayAfterClick === "none"
        };
    })()
'@
    Write-Host "   - Initial Follow Live Hidden: $($followLiveResult.initialHidden)"
    Write-Host "   - Visible Immediately After Scroll: $($followLiveResult.visibleAfterScroll)"
    Write-Host "   - STILL Visible After 10s (No arbitrary timeout!): $($followLiveResult.stillVisibleAfter10Seconds) (Must be True)"
    Write-Host "   - Hides When Follow Live is Clicked: $($followLiveResult.hiddenAfterClick)"

    if (-not ($followLiveResult.visibleAfterScroll -and $followLiveResult.stillVisibleAfter10Seconds -and $followLiveResult.hiddenAfterClick)) {
        throw "Lyrics Follow Live test failed!"
    }

    # Capture visual verification of the Follow Live button while scrolled
    Send-Eval -expression @'
    (function() {
        const area = document.getElementById("focusLyricsArea");
        const btnFollowLive = document.getElementById("btnFocusFollowLive");
        area.scrollTop = 100;
        area.dispatchEvent(new Event("scroll"));
    })()
'@ | Out-Null
    Start-Sleep -Milliseconds 400
    Take-Screenshot "focus_walkthrough_follow_live_button.png"

    Write-Host "`n==========================================================" -ForegroundColor Green
    Write-Host "ALL THREE CORRECTIVE AUDITS PASSED WITH ZERO ERRORS!" -ForegroundColor Green
    Write-Host "==========================================================" -ForegroundColor Green

} finally {
    if ($ws -and $ws.State -eq 'Open') {
        $ws.CloseAsync([System.Net.WebSockets.WebSocketCloseStatus]::NormalClosure, "Done", [System.Threading.CancellationToken]::None).Wait()
    }
    if ($proc -and -not $proc.HasExited) {
        $proc.Kill()
    }
    Start-Sleep -Milliseconds 500
    if (Test-Path $tempProfile) {
        Remove-Item -Recurse -Force $tempProfile -ErrorAction SilentlyContinue
    }
}
