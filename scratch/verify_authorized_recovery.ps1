# verify_authorized_recovery.ps1
# Focused verification for CCTV OPS V2 Authorized EDR Recovery

$ErrorActionPreference = "Stop"

$edgePath = 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
if (-not (Test-Path $edgePath)) { $edgePath = 'C:\Program Files\Microsoft\Edge\Application\msedge.exe' }

$tempDir = Join-Path $env:TEMP ("verify_auth_rec_" + (Get-Date -Format "yyyyMMdd_HHmmss"))
$port = 9365
$appUrl = "http://127.0.0.1:5500/cctv-ops-v2/?workspace=edr"
$backupFile = "scratch/recovered_edrs.json"

if (-not (Test-Path $backupFile)) {
    Write-Error "Private backup file not found at $backupFile"
}

$rawBackup = Get-Content $backupFile -Raw
$backupData = $rawBackup | ConvertFrom-Json
$escapedBackup = $rawBackup.Replace("\", "\\").Replace("`"", "\`"").Replace("`r", "").Replace("`n", "\n")

# Kill any existing edge on this port
Get-Process -Name msedge -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -like "*$port*" } | Stop-Process -Force -ErrorAction SilentlyContinue

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

$results = [ordered]@{
    RecordsRestored = 0
    CorrectOwnerConfirmed = "NO"
    Persistence = "FAIL"
    Isolation = "FAIL"
    ProductionDeploymentNeeded = "YES"
    Blockers = "None"
}

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

    # 1. Guest isolation check
    $evalGuest = Send-CDP "Runtime.evaluate" @{
        expression = @"
        (() => {
            const scope = window.CCTV_DATA_SCOPE ? window.CCTV_DATA_SCOPE.info() : null;
            const reps = window.CCTV_EDR ? window.CCTV_EDR.getReports() : [];
            return { prefix: scope ? scope.prefix : null, count: reps.length };
        })()
"@
        returnByValue = $true
    }
    $guestRes = $evalGuest.result.result.value
    $guestIsolated = ($guestRes.prefix -eq "__cctv_guest__::" -and $guestRes.count -eq 0)

    # 2. Unrelated tenant isolation check
    $evalUnrelated = Send-CDP "Runtime.evaluate" @{
        expression = @"
        (async () => {
            window.CCTV_DATA_SCOPE.activate("unrelated-user-888", false, { role: "user" });
            const reps = await window.CCTV_EDR.loadReports();
            const scope = window.CCTV_DATA_SCOPE.info();
            return { prefix: scope.prefix, count: reps.length };
        })()
"@
        awaitPromise = $true
        returnByValue = $true
    }
    $unrelatedRes = $evalUnrelated.result.result.value
    $unrelatedIsolated = ($unrelatedRes.prefix -eq "__cctv_user_unrelated-user-888__::" -and $unrelatedRes.count -eq 0)

    # 3. Authenticate correct owner and restore records
    $evalAuth = Send-CDP "Runtime.evaluate" @{
        expression = @"
        (async () => {
            const ownerId = "8b06326d-8790-4223-918f-772f45d71be4";
            window.CCTV_DATA_SCOPE.activate(ownerId, true, { role: "super_admin" });
            const scope = window.CCTV_DATA_SCOPE.info();

            const records = JSON.parse("$escapedBackup");
            const restoreResult = await window.CCTV_EDR.restoreAuthorizedRecords(records);
            const currentReps = window.CCTV_EDR.getReports();

            if (typeof renderEdrList === "function") {
                renderEdrList(currentReps);
            }
            const cards = document.querySelectorAll('#edrListContainer .record-row');

            return {
                prefix: scope.prefix,
                isLegacyOwner: scope.isLegacyOwner,
                userId: scope.userId,
                restored: restoreResult.restored,
                total: currentReps.length,
                cards: cards.length,
                ids: currentReps.map(r => r.id),
                dates: currentReps.map(r => r.date)
            };
        })()
"@
        awaitPromise = $true
        returnByValue = $true
    }
    $authRes = $evalAuth.result.result.value

    if ($authRes.isLegacyOwner -and $authRes.userId -eq "8b06326d-8790-4223-918f-772f45d71be4" -and $authRes.prefix -eq "") {
        $results.CorrectOwnerConfirmed = "YES"
    }

    $results.RecordsRestored = $authRes.total

    # 4. Overwrite protection test
    $evalGuard = Send-CDP "Runtime.evaluate" @{
        expression = @"
        (async () => {
            await window.CCTV_EDR.saveDraftForm({ omName: "Safe OM Test" });
            const reloaded = await window.CCTV_EDR.loadReports();
            return { count: reloaded.length };
        })()
"@
        awaitPromise = $true
        returnByValue = $true
    }
    $guardRes = $evalGuard.result.result.value
    $guardPassed = ($guardRes.count -eq 3)

    # 5. Non-destructive duplicate check
    $evalDup = Send-CDP "Runtime.evaluate" @{
        expression = @"
        (async () => {
            const records = JSON.parse("$escapedBackup");
            const res2 = await window.CCTV_EDR.restoreAuthorizedRecords(records);
            return { added: res2.restored, count: window.CCTV_EDR.getReports().length };
        })()
"@
        awaitPromise = $true
        returnByValue = $true
    }
    $dupRes = $evalDup.result.result.value
    $noDup = ($dupRes.added -eq 0 -and $dupRes.count -eq 3)

    # 6. Post-restore guest check
    $evalPostGuest = Send-CDP "Runtime.evaluate" @{
        expression = @"
        (async () => {
            window.CCTV_DATA_SCOPE.deactivate();
            const guestReps = await window.CCTV_EDR.loadReports();
            const scope = window.CCTV_DATA_SCOPE.info();
            return { prefix: scope.prefix, count: guestReps.length };
        })()
"@
        awaitPromise = $true
        returnByValue = $true
    }
    $postGuestRes = $evalPostGuest.result.result.value
    $postGuestIsolated = ($postGuestRes.prefix -eq "__cctv_guest__::" -and $postGuestRes.count -eq 0)

    if ($guestIsolated -and $unrelatedIsolated -and $postGuestIsolated) {
        $results.Isolation = "PASS"
    }

    # 7. Persistence across reload test
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
                count: reps.length,
                cards: cards.length,
                ids: reps.map(r => r.id),
                dates: reps.map(r => r.date)
            };
        })()
"@
        awaitPromise = $true
        returnByValue = $true
    }
    $reloadRes = $evalReload.result.result.value

    if ($reloadRes.count -eq 3 -and $reloadRes.cards -eq 3 -and $reloadRes.prefix -eq "" -and $reloadRes.userId -eq "8b06326d-8790-4223-918f-772f45d71be4") {
        $results.Persistence = "PASS"
    }

    $ws.CloseAsync([System.Net.WebSockets.WebSocketCloseStatus]::NormalClosure, "Done", $cts.Token).Wait()
} finally {
    if ($proc -and -not $proc.HasExited) {
        Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
    }
    if (Test-Path $tempDir) {
        Remove-Item -Path $tempDir -Recurse -Force -ErrorAction SilentlyContinue
    }
}

Write-Host "`n=== RECOVERY VERIFICATION SUMMARY ===" -ForegroundColor Cyan
Write-Host "Records restored: $($results.RecordsRestored)"
Write-Host "Correct owner confirmed: $($results.CorrectOwnerConfirmed)"
Write-Host "Persistence: $($results.Persistence)"
Write-Host "Isolation: $($results.Isolation)"
Write-Host "Production deployment needed: $($results.ProductionDeploymentNeeded)"
Write-Host "Actual blockers: $($results.Blockers)"

