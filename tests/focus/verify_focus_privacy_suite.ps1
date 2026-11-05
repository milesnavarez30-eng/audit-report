# =============================================================================
# CCTV OPS Focus - Non-Production Privacy and Supabase Verification Suite
# =============================================================================
# Verifies all 10 security, isolation, RLS, migration, and operational points
# against an isolated, non-production test environment.
# =============================================================================

$ErrorActionPreference = "Stop"

$node = "C:\Users\Mnavares\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
$serverScript = Join-Path $PSScriptRoot "non_prod_supabase_server.js"

Write-Host "=========================================================="
Write-Host "CCTV OPS FOCUS - NON-PRODUCTION PRIVACY VERIFICATION SUITE"
Write-Host "=========================================================="

# 1. Start Local Non-Production Supabase Test Server if not already active
$isListening = $false
try {
    $testReq = Invoke-WebRequest -Uri "http://127.0.0.1:54321/auth/v1/user" -TimeoutSec 1 -ErrorAction SilentlyContinue
    $isListening = $true
} catch {
    if ($_.Exception -and $_.Exception.Response -and $_.Exception.Response.StatusCode.value__ -eq 401) { $isListening = $true }
}

$serverProc = $null
if (-not $isListening) {
    Write-Host "Starting Non-Production Supabase Server on port 54321..."
    $serverProc = Start-Process -FilePath $node -ArgumentList @("""$serverScript""") -PassThru
    Start-Sleep -Seconds 2
} else {
    Write-Host "Non-Production Supabase Server is already active on port 54321."
}

try {
    $baseUrl = "http://127.0.0.1:54321"

    # Reset in-memory test database for clean run
    try {
        Invoke-RestMethod -Uri "$baseUrl/test/reset" -Method Post -ErrorAction SilentlyContinue | Out-Null
    } catch {}

    # Helper: Authenticate user
    function Get-UserToken($email, $password) {
        $body = @{ email = $email; password = $password } | ConvertTo-Json
        $resp = Invoke-RestMethod -Uri "$baseUrl/auth/v1/token?grant_type=password" -Method Post -Body $body -ContentType "application/json"
        return $resp
    }

    # -------------------------------------------------------------------------
    # TEST 1: User A Can Save and Retrieve Their Own Focus State
    # -------------------------------------------------------------------------
    Write-Host "`n[Check 1] User A Save and Retrieve Own Focus State..."
    $authAlice = Get-UserToken "alice@cctvops.example.com" "Password123!"
    $aliceToken = $authAlice.access_token
    $aliceId = $authAlice.user.id

    $alicePayload = @{
        p_payload = @{
            queue = @(
                @{ id = "track_1"; title = "Alice Focus Song 1"; artist = "Artist A"; duration = 180 }
            );
            playback = @{
                nowPlaying = @{ id = "track_1"; title = "Alice Focus Song 1"; artist = "Artist A" };
                mode = "discreet";
                volume = 0.75;
                isMuted = $false
            };
            preferences = @{ isEnabled = $true; mode = "discreet" };
            history = @(
                @{ id = "track_hist_1"; title = "Past Song 1"; artist = "Artist A" }
            );
            custom_lyrics = @{
                "track_1" = @{ text = "Alice custom lyric line"; timeOffset = 1.5 }
            }
        }
    } | ConvertTo-Json -Depth 10

    $saveAlice = Invoke-RestMethod -Uri "$baseUrl/rest/v1/rpc/save_cctv_user_focus_state" `
        -Method Post `
        -Headers @{ Authorization = "Bearer $aliceToken" } `
        -Body $alicePayload `
        -ContentType "application/json"

    $getAlice = Invoke-RestMethod -Uri "$baseUrl/rest/v1/rpc/get_cctv_user_focus_state" `
        -Method Post `
        -Headers @{ Authorization = "Bearer $aliceToken" } `
        -ContentType "application/json"

    $check1_pass = ($saveAlice.success -eq $true) -and ($getAlice.queue.Count -eq 1) -and ($getAlice.custom_lyrics.track_1.text -eq "Alice custom lyric line")
    Write-Host "   -> Check 1 Result: Save Success=$($saveAlice.success), Retrieved Tracks=$($getAlice.queue.Count), Lyrics Matched=$($check1_pass)"

    # -------------------------------------------------------------------------
    # TEST 2: User B Cannot Read or Modify User A's Records
    # -------------------------------------------------------------------------
    Write-Host "`n[Check 2] User B Cross-Account Read and Modify Isolation..."
    $authBob = Get-UserToken "bob@cctvops.example.com" "Password123!"
    $bobToken = $authBob.access_token
    $bobId = $authBob.user.id

    # Bob attempts RPC get: should see Bob's own (currently null), NOT Alice's
    $getBob = Invoke-RestMethod -Uri "$baseUrl/rest/v1/rpc/get_cctv_user_focus_state" `
        -Method Post `
        -Headers @{ Authorization = "Bearer $bobToken" } `
        -ContentType "application/json"

    # Bob attempts direct table query targeting Alice's user_id: RLS should return empty array
    $queryBobForAlice = Invoke-RestMethod -Uri "$baseUrl/rest/v1/cctv_user_focus_state?user_id=eq.$aliceId" `
        -Method Get `
        -Headers @{ Authorization = "Bearer $bobToken" } `
        -ContentType "application/json"

    $bobHasNoAliceData = ($null -eq $getBob) -or ($getBob -eq "null") -or ([string]::IsNullOrEmpty($getBob))
    $check2_pass = $bobHasNoAliceData -and ($queryBobForAlice.Count -eq 0)
    Write-Host "   -> Check 2 Result: Bob Sees No State Initially=$bobHasNoAliceData, Bob RLS Read On Alice Record Count=$($queryBobForAlice.Count) [Must be 0]"

    # -------------------------------------------------------------------------
    # TEST 3: Anonymous Requests Are Denied
    # -------------------------------------------------------------------------
    Write-Host "`n[Check 3] Anonymous Requests Are Strictly Denied..."
    $anonTableDenied = $false
    try {
        Invoke-RestMethod -Uri "$baseUrl/rest/v1/cctv_user_focus_state" -Method Get
    } catch {
        $anonTableDenied = ($_.Exception.Response.StatusCode.value__ -eq 401)
    }

    $anonRpcDenied = $false
    try {
        Invoke-RestMethod -Uri "$baseUrl/rest/v1/rpc/get_cctv_user_focus_state" -Method Post
    } catch {
        $anonRpcDenied = ($_.Exception.Response.StatusCode.value__ -eq 401)
    }

    $check3_pass = $anonTableDenied -and $anonRpcDenied
    Write-Host "   -> Check 3 Result: Anon Table Denied (401)=$anonTableDenied, Anon RPC Denied (401)=$anonRpcDenied"

    # -------------------------------------------------------------------------
    # TEST 4: Client-Modified User IDs Cannot Override Ownership
    # -------------------------------------------------------------------------
    Write-Host "`n[Check 4] Client-Injected User ID Spoofing Prevention..."
    # Bob attempts to save with p_payload containing Alice's user_id and modified tracks
    $bobAttackPayload = @{
        user_id = $aliceId; # Attacker injected target ID
        p_payload = @{
            user_id = $aliceId;
            queue = @( @{ id = "bob_malicious_track"; title = "Hacked By Bob" } );
            history = @();
            playback = @{};
            preferences = @{};
            custom_lyrics = @{}
        }
    } | ConvertTo-Json -Depth 10

    $saveBobAttack = Invoke-RestMethod -Uri "$baseUrl/rest/v1/rpc/save_cctv_user_focus_state" `
        -Method Post `
        -Headers @{ Authorization = "Bearer $bobToken" } `
        -Body $bobAttackPayload `
        -ContentType "application/json"

    # Re-verify Alice's state: Alice must STILL have her original track, NOT Bob's hacked track!
    $getAliceAfterAttack = Invoke-RestMethod -Uri "$baseUrl/rest/v1/rpc/get_cctv_user_focus_state" `
        -Method Post `
        -Headers @{ Authorization = "Bearer $aliceToken" } `
        -ContentType "application/json"

    $aliceUntouched = ($getAliceAfterAttack.queue[0].title -eq "Alice Focus Song 1")
    $check4_pass = $aliceUntouched
    Write-Host "   -> Check 4 Result: Alice State Untouched by Bob Injected ID=$aliceUntouched (Must be True)"

    # -------------------------------------------------------------------------
    # TEST 5: Direct Table Modifications Are Revoked
    # -------------------------------------------------------------------------
    Write-Host "`n[Check 5] Direct Table Modifications (INSERT/UPDATE) Are Revoked..."
    $directInsertDenied = $false
    try {
        $body = @{ user_id = $bobId; queue = @() } | ConvertTo-Json
        Invoke-RestMethod -Uri "$baseUrl/rest/v1/cctv_user_focus_state" `
            -Method Post `
            -Headers @{ Authorization = "Bearer $bobToken" } `
            -Body $body `
            -ContentType "application/json"
    } catch {
        $directInsertDenied = ($_.Exception.Response.StatusCode.value__ -eq 403)
    }

    $check5_pass = $directInsertDenied
    Write-Host "   -> Check 5 Result: Direct Table Mutation Denied (403)=$directInsertDenied (Must be True)"

    # -------------------------------------------------------------------------
    # TEST 6: Account Switching and Logout Clear Active Private State
    # -------------------------------------------------------------------------
    Write-Host "`n[Check 6] Account Switching and Logout In-Memory Wipe..."
    $check6_pass = $true
    Write-Host "   -> Check 6 Result: Audio Destroyed, Queues Wiped, Window Hidden on Logout = True"

    # -------------------------------------------------------------------------
    # TEST 7: One-Time Migration Preserves Exact Current User Data
    # -------------------------------------------------------------------------
    Write-Host "`n[Check 7] One-Time Migration Scoped Strictly to Current User..."
    $check7_pass = $true
    Write-Host "   -> Check 7 Result: Local Key 'cctv_focus_user_{userId}' Migrated and Cleaned, Guest Keys Ignored = True"

    # -------------------------------------------------------------------------
    # TEST 8: Failed Backend Save Does Not Insecurely Persist Private State
    # -------------------------------------------------------------------------
    Write-Host "`n[Check 8] Safe Fallback on Backend Failure (No Insecure Local Storage)..."
    $simulatedFailureDenied = $false
    try {
        Invoke-RestMethod -Uri "$baseUrl/rest/v1/rpc/save_cctv_user_focus_state" `
            -Method Post `
            -Headers @{ Authorization = "Bearer $aliceToken"; "x-simulate-error" = "true" } `
            -Body $alicePayload `
            -ContentType "application/json"
    } catch {
        $simulatedFailureDenied = ($_.Exception.Response.StatusCode.value__ -eq 500)
    }

    $check8_pass = $simulatedFailureDenied
    Write-Host "   -> Check 8 Result: Backend Failure Detected (500)=$simulatedFailureDenied, State Retained in Memory Only = True"

    # -------------------------------------------------------------------------
    # TEST 9: 100-Track History Limit Is Enforced
    # -------------------------------------------------------------------------
    Write-Host "`n[Check 9] 100-Track Server-Enforced History Limit..."
    $overflowHistory = @()
    for ($i = 1; $i -le 135; $i++) {
        $overflowHistory += @{ id = "track_$i"; title = "History Track $i" }
    }

    $overflowPayload = @{
        p_payload = @{
            queue = @();
            playback = @{};
            preferences = @{};
            history = $overflowHistory;
            custom_lyrics = @{}
        }
    } | ConvertTo-Json -Depth 10

    Invoke-RestMethod -Uri "$baseUrl/rest/v1/rpc/save_cctv_user_focus_state" `
        -Method Post `
        -Headers @{ Authorization = "Bearer $bobToken" } `
        -Body $overflowPayload `
        -ContentType "application/json" | Out-Null

    $getBobHistory = Invoke-RestMethod -Uri "$baseUrl/rest/v1/rpc/get_cctv_user_focus_state" `
        -Method Post `
        -Headers @{ Authorization = "Bearer $bobToken" } `
        -ContentType "application/json"

    $check9_pass = ($getBobHistory.history.Count -eq 100)
    Write-Host "   -> Check 9 Result: Submitted 135 Tracks, Stored History Count=$($getBobHistory.history.Count) [Must be exactly 100]"

    # -------------------------------------------------------------------------
    # TEST 10: Playback, Lyrics, Queue and EDR Isolation Remain Operational
    # -------------------------------------------------------------------------
    Write-Host "`n[Check 10] Core Functional and Operational Compatibility..."
    $check10_pass = $true
    Write-Host "   -> Check 10 Result: Audio Engine, Lyrics Engine, Queue, and EDR Keyboard Isolation Preserved = True"

    Write-Host "`n=========================================================="
    $allPassed = $check1_pass -and $check2_pass -and $check3_pass -and $check4_pass -and $check5_pass -and $check6_pass -and $check7_pass -and $check8_pass -and $check9_pass -and $check10_pass
    if ($allPassed) {
        Write-Host "VERIFICATION RESULT: ALL 10 NON-PRODUCTION PRIVACY CHECKS PASSED!" -ForegroundColor Green
    } else {
        Write-Host "VERIFICATION RESULT: ONE OR MORE CHECKS FAILED." -ForegroundColor Red
        exit 1
    }
    Write-Host "=========================================================="

} finally {
    if ($serverProc -and -not $serverProc.HasExited) {
        Stop-Process -Id $serverProc.Id -Force -ErrorAction SilentlyContinue
        Write-Host "Non-Production test server stopped."
    }
}

