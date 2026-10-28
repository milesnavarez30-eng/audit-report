# restore_authorized_records.ps1
# Safe, explicit restoration procedure for CCTV OPS V2 EDR records
# Non-destructive: Restores records into the authorized scope without replacing or deleting existing records.

param(
    [string]$TargetUrl = "http://127.0.0.1:5500/cctv-ops-v2/?workspace=edr",
    [int]$CdpPort = 9355,
    [string]$BackupFile = "scratch/recovered_edrs.json"
)

if (-not (Test-Path $BackupFile)) {
    Write-Error "Backup file not found at: $BackupFile"
    exit 1
}

$rawJson = Get-Content $BackupFile -Raw
$records = $rawJson | ConvertFrom-Json
Write-Host "Loaded $($records.Count) records from private recovery backup: $BackupFile" -ForegroundColor Cyan

# Find running browser CDP instance or instruct usage
try {
    $pages = Invoke-RestMethod -Uri "http://localhost:$CdpPort/json" -ErrorAction Stop
    $targetPage = $pages | Where-Object { $_.url -like "*cctv-ops-v2*" } | Select-Object -First 1
    if (-not $targetPage) { $targetPage = $pages[0] }

    $wsUrl = $targetPage.webSocketDebuggerUrl
    Write-Host "Connecting to browser via CDP: $wsUrl" -ForegroundColor Green

    $ws = New-Object System.Net.WebSockets.ClientWebSocket
    $cts = New-Object System.Threading.CancellationTokenSource
    $ws.ConnectAsync([Uri]$wsUrl, $cts.Token).Wait()

    function Invoke-CDP($method, $params) {
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

    Invoke-CDP "Runtime.enable" @{} | Out-Null

    # Escape JSON safely for JS injection
    $escapedJson = $rawJson.Replace("\", "\\").Replace("`"", "\`"").Replace("`r", "").Replace("`n", "\n")

    $eval = Invoke-CDP "Runtime.evaluate" @{
        expression = @"
        (async () => {
            if (!window.CCTV_EDR || typeof window.CCTV_EDR.restoreAuthorizedRecords !== 'function') {
                return { success: false, error: 'CCTV_EDR.restoreAuthorizedRecords not available on page' };
            }
            const data = JSON.parse("$escapedJson");
            const result = await window.CCTV_EDR.restoreAuthorizedRecords(data);
            return { success: true, result: result };
        })()
"@
        awaitPromise = $true
        returnByValue = $true
    }

    $res = $eval.result.result.value
    Write-Host "Restoration Result: $($res | ConvertTo-Json -Compress)" -ForegroundColor Green

    $ws.CloseAsync([System.Net.WebSockets.WebSocketCloseStatus]::NormalClosure, "Done", $cts.Token).Wait()
} catch {
    Write-Host "CDP instance not reachable on port $CdpPort: $_" -ForegroundColor Yellow
    Write-Host "`nAlternative Manual Console Procedure:" -ForegroundColor Cyan
    Write-Host "1. Sign in to CCTV OPS V2 with authorized credentials."
    Write-Host "2. Open Developer Tools (F12) -> Console."
    Write-Host "3. Execute:"
    Write-Host "   const records = await (await fetch('/scratch/recovered_edrs.json')).json();"
    Write-Host "   await window.CCTV_EDR.restoreAuthorizedRecords(records);"
}

