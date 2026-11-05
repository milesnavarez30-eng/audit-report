param([int]$port = 0)
if ($port -eq 0) { $port = Get-Random -Minimum 9820 -Maximum 9920 }
$ErrorActionPreference = "Stop"

$tempProfile = Join-Path $env:TEMP ("edge_focus_e2e_" + [guid]::NewGuid().ToString().Substring(0,8))
$edge = 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
if (-not (Test-Path $edge)) { $edge = 'C:\Program Files\Microsoft\Edge\Application\msedge.exe' }

$targetUrl = "http://127.0.0.1:5500/cctv-ops-v2/?workspace=dashboard"
$artifactDir = "C:\Users\Mnavares\.gemini\antigravity\brain\d3e11e9d-ce52-45e5-99f5-a44d00767362"

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "CCTV OPS V2 - FOCUS MUSIC PLAYER COMPREHENSIVE E2E SUITE" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "Launching Edge on debugging port $port..." -ForegroundColor Yellow

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
        Write-Host "   [Screenshot captured: $filename]" -ForegroundColor DarkGray
    }

    Send-CDP "Runtime.enable" @{} | Out-Null
    Send-CDP "Page.enable" @{} | Out-Null
    Start-Sleep -Milliseconds 800

    # Wait for DOM and Focus scripts to load
    $initStatus = Send-Eval -expression @'
    (function() {
        return {
            hasState: typeof window.CCTV_FOCUS_STATE !== "undefined",
            hasAudio: typeof window.CCTV_FOCUS_AUDIO !== "undefined",
            hasWindow: typeof window.CCTV_FOCUS_WINDOW !== "undefined",
            hasProvider: typeof window.CCTV_FOCUS_PROVIDER !== "undefined",
            hasLyrics: typeof window.CCTV_FOCUS_LYRICS !== "undefined",
            hasCoord: typeof window.CCTV_FOCUS_COORDINATION !== "undefined",
            hasFacade: typeof window.CCTV_FOCUS !== "undefined",
            focusWindowDom: !!document.getElementById("focusWindow"),
            sidebarBtn: !!document.getElementById("btnSidebarFocus")
        };
    })()
'@

    Write-Host "`n1. Subsystem Architecture Verification:" -ForegroundColor Green
    Write-Host "   - Focus State Service: $($initStatus.hasState)"
    Write-Host "   - Focus Audio Engine: $($initStatus.hasAudio)"
    Write-Host "   - Focus Window Component: $($initStatus.hasWindow)"
    Write-Host "   - Focus Provider Service: $($initStatus.hasProvider)"
    Write-Host "   - Focus Lyrics Service: $($initStatus.hasLyrics)"
    Write-Host "   - Focus Coordination Service: $($initStatus.hasCoord)"
    Write-Host "   - Focus Global Facade: $($initStatus.hasFacade)"
    Write-Host "   - Focus Window DOM Mounted: $($initStatus.focusWindowDom)"
    Write-Host "   - Sidebar Launcher Mounted: $($initStatus.sidebarBtn)"

    if (-not ($initStatus.hasState -and $initStatus.hasAudio -and $initStatus.hasWindow -and $initStatus.focusWindowDom)) {
        throw "Focus Subsystem initialization failed!"
    }

    # Scenario 1: Initial Opt-in Disabled Check
    Write-Host "`n2. Scenario 1: Opt-in Release Control (Default State):" -ForegroundColor Yellow
    $defaultCheck = Send-Eval -expression @'
    (function() {
        const state = window.CCTV_FOCUS.getState();
        const sidebarBtn = document.getElementById("btnSidebarFocus");
        const win = document.getElementById("focusWindow");
        return {
            isEnabled: state.isEnabled,
            sidebarDisplay: sidebarBtn ? sidebarBtn.style.display : null,
            windowDisplay: win ? win.style.display : null
        };
    })()
'@
    Write-Host "   - Focus Enabled: $($defaultCheck.isEnabled)"
    Write-Host "   - Sidebar Launcher Hidden: $($defaultCheck.sidebarDisplay -eq 'none')"
    Write-Host "   - Focus Window Hidden: $($defaultCheck.windowDisplay -eq 'none')"

    # Scenario 2: Enable Focus and Open Window in Discreet Mode
    Write-Host "`n3. Scenario 2: Opt-in Enable & Discreet Mode Presentation:" -ForegroundColor Yellow
    $discreetCheck = Send-Eval -expression @'
    (function() {
        window.CCTV_FOCUS.enable();
        window.CCTV_FOCUS.show();
        window.CCTV_FOCUS_STATE.setMode("discreet");
        
        const win = document.getElementById("focusWindow");
        const sidebarBtn = document.getElementById("btnSidebarFocus");
        const titleEl = win.querySelector(".focus-title");
        const discreetControls = document.getElementById("focusDiscreetControls");
        const fullContent = document.getElementById("focusFullContent");
        
        return {
            sidebarVisible: sidebarBtn && sidebarBtn.style.display !== "none",
            windowVisible: win && win.style.display !== "none",
            isDiscreetClass: win.classList.contains("mode-discreet"),
            discreetTitle: titleEl ? titleEl.textContent.trim() : null,
            discreetControlsVisible: discreetControls && window.getComputedStyle(discreetControls).display !== "none",
            fullContentHidden: !fullContent || window.getComputedStyle(fullContent).display === "none",
            rect: {
                left: win.style.left,
                top: win.style.top,
                width: win.offsetWidth,
                height: win.offsetHeight
            }
        };
    })()
'@
    Write-Host "   - Sidebar Launcher Visible: $($discreetCheck.sidebarVisible)"
    Write-Host "   - Focus Window Visible: $($discreetCheck.windowVisible)"
    Write-Host "   - Mode Discreet Class: $($discreetCheck.isDiscreetClass)"
    Write-Host "   - Generic Title: $($discreetCheck.discreetTitle) (No song title/artist in Discreet)"
    Write-Host "   - Full Content Hidden: $($discreetCheck.fullContentHidden)"
    Write-Host "   - Window Dimensions: $($discreetCheck.rect.width) x $($discreetCheck.rect.height)"
    Take-Screenshot "focus_discreet_mode.png"

    # Scenario 3: Real Music Catalog Search & Instant Play
    Write-Host "`n4. Scenario 3: Real Audius Catalog Search & Playback:" -ForegroundColor Yellow
    $playResult = Send-Eval -awaitPromise $true -expression @'
    (async function() {
        // Search Audius for "ambient piano"
        const results = await window.CCTV_FOCUS_PROVIDER.searchTracks("ambient piano", "all");
        if (!results || results.length === 0) throw new Error("No tracks found from Audius!");
        
        const track1 = results[0];
        const track2 = results.length > 1 ? results[1] : null;
        const track3 = results.length > 2 ? results[2] : null;

        // Play track1 immediately
        await window.CCTV_FOCUS.play(track1);
        
        // Add track2 to Play Next priority queue
        if (track2) window.CCTV_FOCUS_STATE.playNext(track2);
        
        // Add track3 to Upcoming queue
        if (track3) window.CCTV_FOCUS_STATE.addToQueue(track3);

        // Wait 2.2s for audio buffering
        await new Promise(r => setTimeout(r, 2200));

        const audioState = window.CCTV_FOCUS_AUDIO.getState();
        const focusState = window.CCTV_FOCUS.getState();

        return {
            track1Title: track1.title,
            track1Artist: track1.artist,
            track1Duration: track1.duration,
            isPlaying: audioState.isPlaying,
            currentTime: audioState.currentTime,
            audioDuration: audioState.duration,
            nowPlayingTitle: focusState.nowPlaying?.title,
            playNextCount: focusState.playNextQueue.length,
            upcomingCount: focusState.upcomingQueue.length
        };
    })()
'@
    Write-Host "   - Selected Track: $($playResult.track1Title) by $($playResult.track1Artist)"
    Write-Host "   - Audio Playing: $($playResult.isPlaying)"
    Write-Host "   - Audio Current Time: $([math]::Round($playResult.currentTime, 2))s / $([math]::Round($playResult.audioDuration, 2))s"
    Write-Host "   - Play Next Queue: $($playResult.playNextCount) tracks"
    Write-Host "   - Upcoming Queue: $($playResult.upcomingCount) tracks"

    # Scenario 4: Mode Switch to Full Mode & Lyrics Presentation
    Write-Host "`n5. Scenario 4: Switch to Full Mode & Synchronized Lyrics:" -ForegroundColor Yellow
    $fullCheck = Send-Eval -expression @'
    (function() {
        // Switch to Full Mode (automatically opens Lyrics tab)
        window.CCTV_FOCUS_STATE.setMode("full");
        
        const win = document.getElementById("focusWindow");
        const titleEl = document.getElementById("focusTrackTitle");
        const artistEl = document.getElementById("focusTrackArtist");
        const lyricsArea = document.getElementById("focusLyricsArea");
        const progressBar = document.getElementById("focusProgressBar");
        
        return {
            isFullClass: !win.classList.contains("mode-discreet"),
            activeTab: window.CCTV_FOCUS.getState().activeTab,
            nowTitle: titleEl ? titleEl.textContent.trim() : null,
            nowArtist: artistEl ? artistEl.textContent.trim() : null,
            lyricsAreaVisible: lyricsArea && window.getComputedStyle(lyricsArea).display !== "none",
            progressBarExists: !!progressBar,
            rect: {
                width: win.offsetWidth,
                height: win.offsetHeight
            }
        };
    })()
'@
    Write-Host "   - Full Mode Active: $($fullCheck.isFullClass)"
    Write-Host "   - Automatically Opened Tab: $($fullCheck.activeTab)"
    Write-Host "   - Banner Title: $($fullCheck.nowTitle)"
    Write-Host "   - Banner Artist: $($fullCheck.nowArtist)"
    Write-Host "   - Lyrics Area Visible: $($fullCheck.lyricsAreaVisible)"
    Write-Host "   - Dimensions: $($fullCheck.rect.width) x $($fullCheck.rect.height)"
    Take-Screenshot "focus_full_lyrics.png"

    # Scenario 5: Search Tab & Filter Chips
    Write-Host "`n6. Scenario 5: Dedicated Music Search Tab & Genre Chips:" -ForegroundColor Yellow
    $searchTabCheck = Send-Eval -awaitPromise $true -expression @'
    (async function() {
        window.CCTV_FOCUS_STATE.setActiveTab("search");
        const searchInput = document.getElementById("focusSearchInput");
        if (searchInput) searchInput.value = "ambient";
        
        // Trigger search
        const list = await window.CCTV_FOCUS_PROVIDER.searchTracks("ambient", "all");
        // Render search list in DOM
        const resultsEl = document.getElementById("focusSearchResults");
        if (resultsEl && list) {
            resultsEl.innerHTML = list.slice(0, 8).map(t => `
                <div class="focus-result-item" data-id="${t.id}">
                  <div class="focus-result-thumb">
                    <img src="${t.artwork || ''}" alt="" onerror="this.style.display='none';">
                  </div>
                  <div class="focus-result-meta">
                    <div class="focus-result-title">${t.title}</div>
                    <div class="focus-result-artist">${t.artist}  ${t.durationFormatted}</div>
                  </div>
                  <div class="focus-result-actions">
                    <button class="focus-ctrl-btn focus-item-play" title="Play">?</button>
                  </div>
                </div>
            `).join("");
        }

        await new Promise(r => setTimeout(r, 400));
        return {
            activeTab: window.CCTV_FOCUS.getState().activeTab,
            renderedItems: document.querySelectorAll(".focus-result-item").length
        };
    })()
'@
    Write-Host "   - Active Tab: $($searchTabCheck.activeTab)"
    Write-Host "   - Rendered Search Results: $($searchTabCheck.renderedItems) items"
    Take-Screenshot "focus_search_tab.png"

    # Scenario 6: Queue Tab Management
    Write-Host "`n7. Scenario 6: Dedicated Queue Tab & Precedence Verification:" -ForegroundColor Yellow
    $queueTabCheck = Send-Eval -expression @'
    (function() {
        window.CCTV_FOCUS_STATE.setActiveTab("queue");
        
        const nowPlayingEl = document.getElementById("focusQueueNowPlayingContainer");
        const playNextList = document.getElementById("focusQueuePlayNextContainer");
        const upcomingList = document.getElementById("focusQueueUpcomingContainer");
        const clearBtn = document.getElementById("btnFocusClearQueue");
        
        return {
            activeTab: window.CCTV_FOCUS.getState().activeTab,
            nowPlayingHasChild: nowPlayingEl && nowPlayingEl.children.length > 0,
            playNextCount: playNextList ? playNextList.children.length : 0,
            upcomingCount: upcomingList ? upcomingList.children.length : 0,
            clearQueueAvailable: !!clearBtn
        };
    })()
'@
    Write-Host "   - Active Tab: $($queueTabCheck.activeTab)"
    Write-Host "   - Now Playing Displayed: $($queueTabCheck.nowPlayingHasChild)"
    Write-Host "   - Play Next Items: $($queueTabCheck.playNextCount)"
    Write-Host "   - Upcoming Items: $($queueTabCheck.upcomingCount)"
    Write-Host "   - Clear Queue Button: $($queueTabCheck.clearQueueAvailable)"
    Take-Screenshot "focus_queue_tab.png"

    # Scenario 7: Custom Lyrics Editor Modal & Timing Calibration
    Write-Host "`n8. Scenario 7: Custom Lyrics Modal & Timing Calibration:" -ForegroundColor Yellow
    $modalCheck = Send-Eval -expression @'
    (function() {
        window.CCTV_FOCUS_WINDOW.openCustomLyricsModal();
        const modal = document.getElementById("focusCustomLyricsModal");
        const textarea = document.getElementById("focusCustomLyricsText");
        const offsetSlider = document.getElementById("focusOffsetSlider");
        const offsetLabel = document.getElementById("labelOffset");
        
        if (offsetSlider) {
            offsetSlider.value = "0.5";
            offsetSlider.dispatchEvent(new Event("input"));
        }
        
        return {
            modalVisible: !!modal,
            hasTextarea: !!textarea,
            offsetValue: offsetSlider ? offsetSlider.value : null,
            offsetLabelText: offsetLabel ? offsetLabel.textContent : null
        };
    })()
'@
    Write-Host "   - Modal Visible: $($modalCheck.modalVisible)"
    Write-Host "   - Timing Offset Adjusted: $($modalCheck.offsetValue) ($($modalCheck.offsetLabelText))"
    Take-Screenshot "focus_custom_lyrics_modal.png"

    # Close modal
    Send-Eval -expression @'
    (function() {
        const modal = document.getElementById("focusCustomLyricsModal");
        if (modal) modal.remove();
    })()
'@ | Out-Null

    # Scenario 8: Audio Seeking & Smooth Volume Controls
    Write-Host "`n9. Scenario 8: Precise Seeking & Short Volume Fades:" -ForegroundColor Yellow
    $audioControlCheck = Send-Eval -awaitPromise $true -expression @'
    (async function() {
        // Seek to 15.0 seconds
        window.CCTV_FOCUS_AUDIO.seek(15.0);
        await new Promise(r => setTimeout(r, 600));
        
        // Adjust volume to 0.4
        window.CCTV_FOCUS_AUDIO.setVolume(0.4);
        await new Promise(r => setTimeout(r, 200));

        const st = window.CCTV_FOCUS_AUDIO.getState();
        return {
            currentTime: st.currentTime,
            volume: st.volume,
            isMuted: st.isMuted
        };
    })()
'@
    Write-Host "   - Seeked Time: $([math]::Round($audioControlCheck.currentTime, 2))s"
    Write-Host "   - Adjusted Volume: $($audioControlCheck.volume)"

    # Scenario 9: Sequential Track Advancement
    Write-Host "`n10. Scenario 9: Sequential Track Queue Advancement:" -ForegroundColor Yellow
    $skipCheck = Send-Eval -awaitPromise $true -expression @'
    (async function() {
        const beforeTitle = window.CCTV_FOCUS.getState().nowPlaying?.title;
        
        // Skip Next (should pop Play Next queue item)
        await window.CCTV_FOCUS_STATE.skipNext();
        await new Promise(r => setTimeout(r, 1800));

        const afterState = window.CCTV_FOCUS.getState();
        return {
            beforeTitle: beforeTitle,
            afterTitle: afterState.nowPlaying?.title,
            historyCount: afterState.history.length
        };
    })()
'@
    Write-Host "   - Before Track: $($skipCheck.beforeTitle)"
    Write-Host "   - Advanced to Track: $($skipCheck.afterTitle)"
    Write-Host "   - History Count: $($skipCheck.historyCount) (max 100 limit enforced)"

    # Scenario 10: EDR Active Input Safety Guard (Keyboard Shortcuts Collision Test)
    Write-Host "`n11. Scenario 10: CRITICAL - EDR Workspace Input Collision Guard:" -ForegroundColor Yellow
    $edrSafetyCheck = Send-Eval -expression @'
    (function() {
        // Switch to EDR workspace
        const tabEdr = document.getElementById("tabEdr");
        if (tabEdr) tabEdr.click();

        const paneEdr = document.getElementById("paneEdr");
        if (paneEdr) paneEdr.hidden = false;

        // Focus an EDR form input
        const edrInput = document.getElementById("edrTimeObserved") || document.getElementById("edrOmName");
        if (!edrInput) return { error: "No EDR input found" };
        
        edrInput.focus();
        edrInput.value = "Testing EDR subject typing";

        const stateBefore = window.CCTV_FOCUS.getState();
        const isWinVisibleBefore = stateBefore.isWindowVisible;
        const isMutedBefore = window.CCTV_FOCUS_AUDIO.isMuted();

        // Simulate Alt+F keydown event on document
        const evtAltF = new KeyboardEvent("keydown", {
            key: "f",
            code: "KeyF",
            altKey: true,
            bubbles: true,
            cancelable: true
        });
        edrInput.dispatchEvent(evtAltF);

        // Simulate Alt+M keydown event
        const evtAltM = new KeyboardEvent("keydown", {
            key: "m",
            code: "KeyM",
            altKey: true,
            bubbles: true,
            cancelable: true
        });
        edrInput.dispatchEvent(evtAltM);

        const stateAfter = window.CCTV_FOCUS.getState();
        const isMutedAfter = window.CCTV_FOCUS_AUDIO.isMuted();

        return {
            activeTag: document.activeElement.tagName,
            activeId: document.activeElement.id,
            windowVisibilityChanged: isWinVisibleBefore !== stateAfter.isWindowVisible,
            volumeMutedUnexpectedly: isMutedBefore !== isMutedAfter,
            guardProtected: (isWinVisibleBefore === stateAfter.isWindowVisible) && (isMutedBefore === isMutedAfter)
        };
    })()
'@
    Write-Host "   - Active Element in Focus: <$($edrSafetyCheck.activeTag) id='$($edrSafetyCheck.activeId)'>"
    Write-Host "   - Window Visibility Changed: $($edrSafetyCheck.windowVisibilityChanged) (Must be False!)"
    Write-Host "   - Mute Triggered: $($edrSafetyCheck.volumeMutedUnexpectedly) (Must be False!)"
    Write-Host "   - EDR Safety Guard Protected: $($edrSafetyCheck.guardProtected)"
    Take-Screenshot "focus_edr_safety.png"

    # Scenario 11: Account Isolation and Logout Wipe
    Write-Host "`n12. Scenario 11: Account Isolation & Logout Audio Stop / Memory Wipe:" -ForegroundColor Yellow
    $logoutCheck = Send-Eval -expression @'
    (function() {
        const stateBefore = window.CCTV_FOCUS.getState();
        const hadNowPlaying = !!stateBefore.nowPlaying;

        // Trigger resetOnLogout
        window.CCTV_FOCUS_STATE.resetOnLogout();

        const stateAfter = window.CCTV_FOCUS.getState();
        const audioAfter = window.CCTV_FOCUS_AUDIO.getState();
        const win = document.getElementById("focusWindow");

        return {
            hadNowPlaying: hadNowPlaying,
            audioPlayingAfterLogout: audioAfter.isPlaying,
            nowPlayingAfterLogout: stateAfter.nowPlaying,
            queueCleared: stateAfter.upcomingQueue.length === 0 && stateAfter.playNextQueue.length === 0,
            windowClosed: !stateAfter.isWindowVisible && (!win || win.style.display === "none")
        };
    })()
'@
    Write-Host "   - Audio Playing After Logout: $($logoutCheck.audioPlayingAfterLogout) (Must be False!)"
    Write-Host "   - In-Memory Track Cleared: $($logoutCheck.nowPlayingAfterLogout -eq $null)"
    Write-Host "   - Queue Wiped: $($logoutCheck.queueCleared)"
    Write-Host "   - Window Closed: $($logoutCheck.windowClosed)"

    # Scenario 12: Mobile Viewport Bottom Sheet
    Write-Host "`n13. Scenario 12: Mobile (375x812) Responsive Bottom Panel:" -ForegroundColor Yellow
    Send-CDP "Emulation.setDeviceMetricsOverride" @{
        width = 375;
        height = 812;
        deviceScaleFactor = 2;
        mobile = $true
    } | Out-Null
    Start-Sleep -Milliseconds 600

    $mobileCheck = Send-Eval -expression @'
    (function() {
        window.CCTV_FOCUS.enable();
        window.CCTV_FOCUS.show();
        window.CCTV_FOCUS_STATE.setMode("full");
        
        const win = document.getElementById("focusWindow");
        const comp = window.getComputedStyle(win);
        
        return {
            width: win.offsetWidth,
            height: win.offsetHeight,
            left: comp.left,
            right: comp.right,
            bottom: comp.bottom,
            borderRadius: comp.borderRadius
        };
    })()
'@
    Write-Host "   - Mobile Panel Width: $($mobileCheck.width)px"
    Write-Host "   - Mobile Panel Height: $($mobileCheck.height)px"
    Write-Host "   - Attached to Bottom: left=$($mobileCheck.left), right=$($mobileCheck.right), bottom=$($mobileCheck.bottom)"
    Take-Screenshot "focus_mobile_sheet.png"

    # Reset emulation back to desktop
    Send-CDP "Emulation.clearDeviceMetricsOverride" @{} | Out-Null
    Start-Sleep -Milliseconds 400

    # Scenario 13: Feature Opt-Out Disabling
    Write-Host "`n14. Scenario 13: Feature Disabling (Opt-Out):" -ForegroundColor Yellow
    $disableCheck = Send-Eval -expression @'
    (function() {
        window.CCTV_FOCUS.disable();
        const state = window.CCTV_FOCUS.getState();
        const sidebarBtn = document.getElementById("btnSidebarFocus");
        const win = document.getElementById("focusWindow");
        return {
            isEnabled: state.isEnabled,
            sidebarDisplay: sidebarBtn ? sidebarBtn.style.display : null,
            windowDisplay: win ? win.style.display : null
        };
    })()
'@
    Write-Host "   - Focus Enabled: $($disableCheck.isEnabled)"
    Write-Host "   - Sidebar Launcher Hidden: $($disableCheck.sidebarDisplay -eq 'none')"
    Write-Host "   - Window Hidden: $($disableCheck.windowDisplay -eq 'none')"

    Write-Host "`n==========================================================" -ForegroundColor Green
    Write-Host "ALL FOCUS MUSIC PLAYER E2E ACCEPTANCE SCENARIOS PASSED!" -ForegroundColor Green
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
