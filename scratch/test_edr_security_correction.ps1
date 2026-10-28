# test_edr_security_correction.ps1
# Focused verification test for CCTV OPS V2 EDR Security Correction

$ErrorActionPreference = "Stop"

Write-Host "=== TEST 1: Public Recovery Seed Removal & Code Integrity ===" -ForegroundColor Cyan

# 1.1 Check seed file removed from disk
$seedPath = "cctv-ops-v2/js/services/edr-recovery-seed.js"
if (Test-Path $seedPath) {
    Write-Error "FAIL: edr-recovery-seed.js still exists in cctv-ops-v2/!"
} else {
    Write-Host "PASS: edr-recovery-seed.js removed from public assets." -ForegroundColor Green
}

# 1.2 Check index.html does not include seed script
$indexHtml = [System.IO.File]::ReadAllText("cctv-ops-v2/index.html")
if ($indexHtml.Contains("edr-recovery-seed.js")) {
    Write-Error "FAIL: index.html still references edr-recovery-seed.js!"
} else {
    Write-Host "PASS: index.html has no reference to edr-recovery-seed.js." -ForegroundColor Green
}

# 1.3 Check storage.js does not expose global EDR keys
$storageJs = [System.IO.File]::ReadAllText("cctv-ops-v2/js/storage.js")
if ($storageJs.Contains("cctv_edr_authoritative_backup_v1") -or $storageJs.Contains("cctv_edr_reports_backup_v1")) {
    Write-Error "FAIL: storage.js still exposes EDR backup keys in GLOBAL_APP_KEYS!"
} else {
    Write-Host "PASS: storage.js preserves strict tenant isolation (no global EDR keys)." -ForegroundColor Green
}

# 1.4 Check edr-service.js does not leak seed or cross-namespace scanners
$edrJs = [System.IO.File]::ReadAllText("cctv-ops-v2/js/services/edr-service.js")
if ($edrJs.Contains("CCTV_EDR_RECOVERED_SEED")) {
    Write-Error "FAIL: edr-service.js references CCTV_EDR_RECOVERED_SEED!"
}
if ($edrJs.Contains("readRawWorkspaceDb") -or $edrJs.Contains("readRawStoreKey")) {
    Write-Error "FAIL: edr-service.js still contains raw cross-namespace DB readers!"
}
Write-Host "PASS: edr-service.js contains no public seed or cross-namespace scanners." -ForegroundColor Green

Write-Host "`n=== TEST 2: Private Recovery Backup Verification ===" -ForegroundColor Cyan
$backupFile = "scratch/recovered_edrs.json"
if (-not (Test-Path $backupFile)) {
    Write-Error "FAIL: Private backup $backupFile missing!"
}
$backupData = Get-Content $backupFile -Raw | ConvertFrom-Json
if ($backupData.Count -ne 3) {
    Write-Error "FAIL: Expected 3 recovered records, found $($backupData.Count)!"
}

$expectedIds = @("edr_mvkcgco6_q3m2lr", "edr_mvolf6ti_9i1q5c", "edr_mvolse9s_s2bsws")
$expectedDates = @("2026-10-23", "2026-10-24", "2026-10-26")

for ($i = 0; $i -lt 3; $i++) {
    $rec = $backupData[$i]
    if ($rec.id -ne $expectedIds[$i]) {
        Write-Error "FAIL: Record $i ID mismatch ($($rec.id) vs $($expectedIds[$i]))!"
    }
    if ($rec.date -ne $expectedDates[$i]) {
        Write-Error "FAIL: Record $i Date mismatch ($($rec.date) vs $($expectedDates[$i]))!"
    }
}
Write-Host "PASS: All 3 original records intact in private backup (IDs: $($expectedIds -join ', '))." -ForegroundColor Green

Write-Host "`n=== TEST 3: Browser Runtime Isolation & Restoration Suite ===" -ForegroundColor Cyan

$edgePath = 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
if (-not (Test-Path $edgePath)) { $edgePath = 'C:\Program Files\Microsoft\Edge\Application\msedge.exe' }

$tempDir = Join-Path $env:TEMP ("test_edr_sec_" + (Get-Date -Format "yyyyMMdd_HHmmss"))
$port = 9360
$appUrl = "http://127.0.0.1:5500/cctv-ops-v2/?workspace=edr"

$proc = Start-Process -FilePath $edgePath -ArgumentList @(
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    '--no-first-run',
    '--no-default-browser-check',
    "--remote-debugging-port=$port",
    "--user-data-dir=$tempDir",
    $appUrl
) -PassThru

Start-Sleep -Seconds 4

try {
    $pages = Invoke-RestMethod -Uri "http://localhost:$port/json" -ErrorAction Stop
    $page = $pages | Where-Object { $_.url -like "*5500*" } | Select-Object -First 1
    if (-not $page) { $page = $pages[0] }
    $wsUrl = $page.webSocketDebuggerUrl

    $ws = New-Object System.Net.WebSockets.ClientWebSocket
    $cts = New-Object System.Threading.CancellationTokenSource
    $ws.ConnectAsync([Uri]$wsUrl, $cts.Token).Wait()

    function Send-CDP($method, $params) {
        $msgId = [guid]::NewGuid().GetHashCode()
        if ($msgId -lt 0) { $msgId = -$msgId }
        $payload = @{ id = $msgId; method = $method; params = $params } | ConvertTo-Json -Compress
        $bytes = [System.Text.Encoding]::UTF8.GetBytes($payload)
        $segment = New-Object ArraySegment[byte] @(,$bytes)
        $ws.SendAsync($segment, [System.Net.WebSockets.WebSocketMessageType]::Text, $true, $cts.Token).Wait()

        while ($true) {
            $ms = New-Object System.IO.MemoryStream
            $buffer = New-Object byte[] 65536
            do {
                $recvSegment = New-Object ArraySegment[byte] @(,$buffer)
                $result = $ws.ReceiveAsync($recvSegment, $cts.Token).Result
                $ms.Write($buffer, 0, $result.Count)
            } while (-not $result.EndOfMessage)
            $response = [System.Text.Encoding]::UTF8.GetString($ms.ToArray()) | ConvertFrom-Json
            if ($response.id -eq $msgId) { return $response }
        }
    }

    Send-CDP "Page.enable" @{} | Out-Null
    Send-CDP "Runtime.enable" @{} | Out-Null
    Start-Sleep -Seconds 2

    # Step 3.1: Guest account isolation check
    Write-Host "Checking Guest Account Isolation..." -ForegroundColor Yellow
    $evalGuest = Send-CDP "Runtime.evaluate" @{
        expression = @"
        (() => {
            const scopeInfo = window.CCTV_DATA_SCOPE ? window.CCTV_DATA_SCOPE.info() : null;
            const reports = window.CCTV_EDR ? window.CCTV_EDR.getReports() : [];
            const hasPublicSeed = typeof window.CCTV_EDR_RECOVERED_SEED !== 'undefined';
            const cards = document.querySelectorAll('#edrListContainer .record-row');
            return {
                prefix: scopeInfo ? scopeInfo.prefix : null,
                reportCount: reports.length,
                domCardCount: cards.length,
                hasPublicSeed: hasPublicSeed
            };
        })()
"@
        returnByValue = $true
    }

    $guestRes = $evalGuest.result.result.value
    Write-Host "Guest state: prefix=$($guestRes.prefix), reportCount=$($guestRes.reportCount), cards=$($guestRes.domCardCount), hasPublicSeed=$($guestRes.hasPublicSeed)"

    if ($guestRes.prefix -ne "__cctv_guest__::") {
        Write-Error "FAIL: Guest prefix was expected to be '__cctv_guest__::', got '$($guestRes.prefix)'"
    }
    if ($guestRes.reportCount -ne 0) {
        Write-Error "FAIL: Guest account sees $($guestRes.reportCount) reports! Should be 0."
    }
    if ($guestRes.hasPublicSeed) {
        Write-Error "FAIL: window.CCTV_EDR_RECOVERED_SEED exists on window object!"
    }
    Write-Host "PASS: Guest account correctly isolated with 0 reports and no public seed." -ForegroundColor Green

    # Step 3.2: Unrelated user tenant isolation check
    Write-Host "`nChecking Unrelated User Tenant Isolation..." -ForegroundColor Yellow
    $evalUnrelated = Send-CDP "Runtime.evaluate" @{
        expression = @"
        (async () => {
            // Activate unrelated user tenant scope
            const otherUserId = "user-unrelated-tenant-999";
            window.CCTV_DATA_SCOPE.activate(otherUserId, false, { role: "user" });
            const scopeInfo = window.CCTV_DATA_SCOPE.info();
            const reps = await window.CCTV_EDR.loadReports();
            return {
                prefix: scopeInfo.prefix,
                reportCount: reps.length,
                isLegacyOwner: scopeInfo.isLegacyOwner
            };
        })()
"@
        awaitPromise = $true
        returnByValue = $true
    }
    $unrelatedRes = $evalUnrelated.result.result.value
    Write-Host "Unrelated user state: prefix=$($unrelatedRes.prefix), reportCount=$($unrelatedRes.reportCount), isLegacyOwner=$($unrelatedRes.isLegacyOwner)"

    if ($unrelatedRes.prefix -ne "__cctv_user_user-unrelated-tenant-999__::") {
        Write-Error "FAIL: Unrelated user prefix incorrect!"
    }
    if ($unrelatedRes.reportCount -ne 0) {
        Write-Error "FAIL: Unrelated user loaded reports from another tenant!"
    }
    Write-Host "PASS: Unrelated user isolated from other tenants (0 reports)." -ForegroundColor Green

    # Step 3.3: Authorized scope restoration procedure
    Write-Host "`nChecking Authorized Scope Restoration Procedure..." -ForegroundColor Yellow
    $rawBackup = Get-Content $backupFile -Raw
    $escapedBackup = $rawBackup.Replace("\", "\\").Replace("`"", "\`"").Replace("`r", "").Replace("`n", "\n")

    $evalRestore = Send-CDP "Runtime.evaluate" @{
        expression = @"
        (async () => {
            // Activate authorized owner scope
            const authorizedId = "8b06326d-8790-4223-918f-772f45d71be4";
            window.CCTV_DATA_SCOPE.activate(authorizedId, true, { role: "super_admin" });
            const scopeInfo = window.CCTV_DATA_SCOPE.info();

            const records = JSON.parse("$escapedBackup");
            const restoreResult = await window.CCTV_EDR.restoreAuthorizedRecords(records);
            const currentReps = window.CCTV_EDR.getReports();

            // Re-render UI list to verify DOM synchronization
            if (typeof renderEdrList === "function") {
                renderEdrList(currentReps);
            }

            const cards = document.querySelectorAll('#edrListContainer .record-row');
            return {
                prefix: scopeInfo.prefix,
                isLegacyOwner: scopeInfo.isLegacyOwner,
                restoreResult: restoreResult,
                reportCount: currentReps.length,
                domCardCount: cards.length,
                ids: currentReps.map(r => r.id),
                dates: currentReps.map(r => r.date)
            };
        })()
"@
        awaitPromise = $true
        returnByValue = $true
    }

    $restoreRes = $evalRestore.result.result.value
    Write-Host "Authorized restore state: prefix='$($restoreRes.prefix)', isLegacyOwner=$($restoreRes.isLegacyOwner), restored=$($restoreRes.restoreResult.restored), total=$($restoreRes.reportCount), cards=$($restoreRes.domCardCount)"

    if ($restoreRes.prefix -ne "") {
        Write-Error "FAIL: Authorized owner prefix expected to be empty string '', got '$($restoreRes.prefix)'"
    }
    if ($restoreRes.reportCount -ne 3) {
        Write-Error "FAIL: Expected 3 restored records in authorized scope, got $($restoreRes.reportCount)"
    }
    Write-Host "PASS: 3 records restored into authorized scope (IDs: $($restoreRes.ids -join ', '))." -ForegroundColor Green

    # Step 3.4: Overwrite protection test (trigger empty draft save)
    Write-Host "`nChecking Overwrite Guard..." -ForegroundColor Yellow
    $evalOverwrite = Send-CDP "Runtime.evaluate" @{
        expression = @"
        (async () => {
            // Simulate saving an empty draft form
            await window.CCTV_EDR.saveDraftForm({ omName: "Test OM", site: "Mabini Site A" });
            
            // Reload reports from IndexedDB
            const reloaded = await window.CCTV_EDR.loadReports();
            return {
                reportCountAfterDraft: reloaded.length,
                ids: reloaded.map(r => r.id)
            };
        })()
"@
        awaitPromise = $true
        returnByValue = $true
    }
    $overwriteRes = $evalOverwrite.result.result.value
    Write-Host "After draft save: count=$($overwriteRes.reportCountAfterDraft), IDs=$($overwriteRes.ids -join ', ')"

    if ($overwriteRes.reportCountAfterDraft -ne 3) {
        Write-Error "FAIL: Overwrite guard failed! Records count changed to $($overwriteRes.reportCountAfterDraft)"
    }
    Write-Host "PASS: Overwrite guard successfully prevented erasing existing records." -ForegroundColor Green

    # Step 3.5: Non-destructive merge test (re-restoring does not duplicate or overwrite)
    Write-Host "`nChecking Non-Destructive Idempotency..." -ForegroundColor Yellow
    $evalIdempotent = Send-CDP "Runtime.evaluate" @{
        expression = @"
        (async () => {
            const records = JSON.parse("$escapedBackup");
            const secondRestore = await window.CCTV_EDR.restoreAuthorizedRecords(records);
            const currentReps = window.CCTV_EDR.getReports();
            return {
                secondRestore: secondRestore,
                finalCount: currentReps.length
            };
        })()
"@
        awaitPromise = $true
        returnByValue = $true
    }
    $idempRes = $evalIdempotent.result.result.value
    Write-Host "Second restore: added=$($idempRes.secondRestore.restored), finalCount=$($idempRes.finalCount)"
    if ($idempRes.secondRestore.restored -ne 0 -or $idempRes.finalCount -ne 3) {
        Write-Error "FAIL: Idempotency failed! Re-restore added duplicate records: count=$($idempRes.finalCount)"
    }
    Write-Host "PASS: Non-destructive restoration is idempotent (no duplicates added)." -ForegroundColor Green

    # Step 3.6: Verify Guest STILL isolated after authorized restoration
    Write-Host "`nVerifying Guest Isolation Post-Restoration..." -ForegroundColor Yellow
    $evalPostGuest = Send-CDP "Runtime.evaluate" @{
        expression = @"
        (async () => {
            window.CCTV_DATA_SCOPE.deactivate();
            const scopeInfo = window.CCTV_DATA_SCOPE.info();
            const guestReps = await window.CCTV_EDR.loadReports();
            return {
                prefix: scopeInfo.prefix,
                guestCount: guestReps.length
            };
        })()
"@
        awaitPromise = $true
        returnByValue = $true
    }
    $postGuestRes = $evalPostGuest.result.result.value
    Write-Host "Post-deactivate guest state: prefix=$($postGuestRes.prefix), count=$($postGuestRes.guestCount)"

    if ($postGuestRes.prefix -ne "__cctv_guest__::") {
        Write-Error "FAIL: Scope prefix after deactivate expected '__cctv_guest__::', got '$($postGuestRes.prefix)'"
    }
    if ($postGuestRes.guestCount -ne 0) {
        Write-Error "FAIL: Guest account can access authorized records after restoration! Count: $($postGuestRes.guestCount)"
    }
    Write-Host "PASS: Guest account strictly isolated (0 records) even after authorized data restoration." -ForegroundColor Green

    # Step 3.7: Persistence across page refresh in authorized scope
    Write-Host "`nChecking Persistence Across Page Reload in Authorized Scope..." -ForegroundColor Yellow
    # First re-activate authorized user session and set local storage auth key
    Send-CDP "Runtime.evaluate" @{
        expression = @"
        (() => {
            if (window.CCTV_AUTH && typeof window.CCTV_AUTH.setLocalSession === "function") {
                window.CCTV_AUTH.setLocalSession(
                    { id: "8b06326d-8790-4223-918f-772f45d71be4", email: "milesnavarez30@gmail.com" },
                    { id: "8b06326d-8790-4223-918f-772f45d71be4", email: "milesnavarez30@gmail.com", role: "super_admin", status: "approved" }
                );
            }
        })()
"@
    } | Out-Null

    # Navigate / reload page
    Send-CDP "Page.navigate" @{ url = $appUrl } | Out-Null
    Start-Sleep -Seconds 4

    $evalReload = Send-CDP "Runtime.evaluate" @{
        expression = @"
        (async () => {
            if (window.CCTV_AUTH && typeof window.CCTV_AUTH.init === "function") {
                await window.CCTV_AUTH.init();
            }
            const scope = window.CCTV_DATA_SCOPE ? window.CCTV_DATA_SCOPE.info() : null;
            const reps = window.CCTV_EDR ? await window.CCTV_EDR.loadReports() : [];
            const cards = document.querySelectorAll('#edrListContainer .record-row');
            return {
                prefix: scope ? scope.prefix : null,
                userId: scope ? scope.userId : null,
                reportCount: reps.length,
                domCardCount: cards.length,
                ids: reps.map(r => r.id),
                dates: reps.map(r => r.date)
            };
        })()
"@
        awaitPromise = $true
        returnByValue = $true
    }
    $reloadRes = $evalReload.result.result.value
    Write-Host "Reload state: prefix='$($reloadRes.prefix)', userId=$($reloadRes.userId), count=$($reloadRes.reportCount), cards=$($reloadRes.domCardCount)"

    if ($reloadRes.reportCount -ne 3) {
        Write-Error "FAIL: Reports failed to persist after page reload! Count: $($reloadRes.reportCount)"
    }
    Write-Host "PASS: Reports persist across refresh in authorized scope." -ForegroundColor Green

    $ws.CloseAsync([System.Net.WebSockets.WebSocketCloseStatus]::NormalClosure, "Done", $cts.Token).Wait()
} finally {
    if ($proc -and -not $proc.HasExited) {
        Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
    }
    if (Test-Path $tempDir) {
        Remove-Item -Path $tempDir -Recurse -Force -ErrorAction SilentlyContinue
    }
}

Write-Host "`n==========================================" -ForegroundColor Green
Write-Host "ALL RECOVERY & SECURITY TESTS PASSED (7/7)" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Green
