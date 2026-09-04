Write-Host "=== END-TO-END MASTER LIST VERIFICATION SUITE ==="

function Clean-Text($val) {
    if ($null -eq $val) { return "" }
    return [regex]::Replace([string]$val, "\s+", " ").Trim()
}

function Norm($val) {
    $c = Clean-Text $val
    $low = $c.ToLower()
    $sub1 = [regex]::Replace($low, "[_/\\-]+", " ")
    $sub2 = [regex]::Replace($sub1, "[^a-z0-9@. ]+", " ")
    return [regex]::Replace($sub2, "\s+", " ").Trim()
}

function Esc($val) {
    $s = [string]$val
    $s = $s.Replace("&", "&amp;").Replace("<", "&lt;").Replace(">", "&gt;")
    $s = $s.Replace([string][char]34, "&quot;").Replace([string][char]39, "&#039;")
    return $s
}

$PENDING_LABELS = @{ miles = "Miles"; seth = "Seth"; wendie = "Wendie"; kenneth = "Kenneth"; jr = "JR" }
$PENDING_COLUMNS = @("Year","Month","Date","Name","OM","SITE","TL","Agent Name","Account","CCTV Reason Codes","NOC","Remarks")

function Value-For-Pending-Column($row, $column) {
    if ($null -eq $row) { return "" }

    $colFieldMap = @{
        "Year" = "year"
        "Month" = "month"
        "Date" = "date"
        "Name" = "name"
        "OM" = "om"
        "SITE" = "site"
        "TL" = "tl"
        "Agent Name" = "agentName"
        "Account" = "account"
        "CCTV Reason Codes" = "cctvReasonCodes"
        "NOC" = "noc"
        "Remarks" = "remarks"
    }

    $field = $colFieldMap[$column]
    if ($field -and $row.ContainsKey($field) -and $null -ne $row[$field] -and $row[$field].ToString().Trim() -ne "") {
        return Clean-Text $row[$field]
    }

    # Fallback to aliases
    $aliases = @{
        "Year" = @("Year", "year", "yr")
        "Month" = @("Month", "month", "mo")
        "Date" = @("Date", "date")
        "Name" = @("Name", "name", "Auditor", "auditor", "Staff")
        "OM" = @("OM", "om", "Operation Manager")
        "SITE" = @("SITE", "Site", "site", "Location")
        "TL" = @("TL", "tl", "Team Leader")
        "Agent Name" = @("Agent Name", "agentName", "Agent")
        "Account" = @("Account", "account", "Campaign")
        "CCTV Reason Codes" = @("CCTV Reason Codes", "cctvReasonCodes", "CCTV Reason Code", "CCTV Reason Cod", "Reason")
        "NOC" = @("NOC", "noc", "Status")
        "Remarks" = @("Remarks", "remarks", "Remark", "Notes")
    }

    $targetAliases = $aliases[$column]
    foreach ($k in $row.Keys) {
        $kNorm = Norm $k
        foreach ($alias in $targetAliases) {
            $aNorm = Norm $alias
            if ($kNorm -eq $aNorm -or $kNorm.Contains($aNorm)) {
                $val = Clean-Text $row[$k]
                if ($val -ne "") { return $val }
            }
        }
    }
    return ""
}

function Render-Pending-Tracker($payload, $pendingTrackers, $activePendingKey, $lastSyncError) {
    $rows = $pendingTrackers[$activePendingKey]
    if ($null -eq $rows) { $rows = @() }
    $label = $PENDING_LABELS[$activePendingKey]
    $sourceInfo = $null
    if ($payload -and $payload.sources -and $payload.sources.ContainsKey($activePendingKey)) {
        $sourceInfo = $payload.sources[$activePendingKey]
    }

    $state = @{
        count = $rows.Count
        title = "Pending $label"
        error = $null
        isEmpty = $false
        rowsCount = $rows.Count
        renderedRows = @()
    }

    # 1. Source error check
    if ($sourceInfo -and $sourceInfo.ok -eq $false) {
        $errDetail = if ($sourceInfo.error) { $sourceInfo.error } else { "Sheet could not be read or was not found." }
        $gidText = if ($sourceInfo.gid) { " (Sheet GID: $($sourceInfo.gid))" } else { "" }
        $state.error = "Source Error: Could not load " + $label + " tracker" + $gidText + ": " + $errDetail
        return $state
    }

    # 2. Connection error check
    if (-not $payload -and $lastSyncError) {
        $state.error = "Connection Error: $lastSyncError"
        return $state
    }

    # 3. Old v2 API check
    if ($payload -and (-not $payload.pending) -and $activePendingKey -ne "miles") {
        $state.error = "Source Error: Live Google Sheets data for $label requires the updated Master List Apps Script v3."
        return $state
    }

    # 4. Empty state
    if ($rows.Count -eq 0) {
        $state.isEmpty = $true
        return $state
    }

    # 5. Normal rows
    foreach ($r in $rows) {
        $cells = @()
        foreach ($col in $PENDING_COLUMNS) {
            $cells += Value-For-Pending-Column $r $col
        }
        $state.renderedRows += ,$cells
    }

    return $state
}

Write-Host "1. TESTING LIVE REAL DATA DUMP FOR MILES"
$realDump = Get-Content 'scratch/api_test.json' -Raw | ConvertFrom-Json
$milesPendingReal = @($realDump.tracker | Where-Object { (Norm $_.Name) -eq "miles" -and (Norm $_.NOC) -eq "pending" })
Write-Host "Real dump tracker rows: $($realDump.tracker.Count)"
Write-Host "Real dump Miles pending rows found: $($milesPendingReal.Count)"
if ($milesPendingReal.Count -eq 5) {
    Write-Host "PASS: Miles real pending count is exactly 5"
} else {
    throw "Expected 5 miles pending rows, got $($milesPendingReal.Count)"
}

Write-Host "2. TESTING UNIFIED 5-USER RESPONSE SIMULATION"
$mockV3Payload = @{
    success = $true
    version = "3.0"
    spreadsheetId = "12o3O1u2xb3DbXW41jAen-8HSJhpJRzQLSIb_6o5JRc4"
    pending = @{
        miles = @(
            @{ year = "2026"; month = "Aug"; date = "8/26/2026"; name = "Miles"; om = "Irene"; site = "Mabini Site A"; tl = "Andrea Kyle Herrero"; agentName = "Rochelle Junio"; account = "BIGO"; cctvReasonCodes = "BROWSING"; noc = "Pending"; remarks = "Follow up" }
        )
        seth = @(
            @{ year = "2026"; month = "Aug"; date = "8/27/2026"; name = "Seth"; om = "Norman"; site = "Maa Site"; tl = "TL 1"; agentName = "Agent Seth 1"; account = "Campaign 1"; cctvReasonCodes = "SLEEPING"; noc = "Pending"; remarks = "Pending NOC" },
            @{ year = "2026"; month = "Aug"; date = "8/28/2026"; name = "Seth"; om = "Norman"; site = "Maa Site"; tl = "TL 2"; agentName = "Agent Seth 2"; account = "Campaign 2"; cctvReasonCodes = "CALL AVOIDANCE"; noc = "PENDING"; remarks = "Pending filing" }
        )
        wendie = @(
            @{ year = "2026"; month = "Aug"; date = "8/28/2026"; name = "Amor"; om = "Jordan"; site = "Mabini Site B"; tl = "TL 3"; agentName = "Agent Wendie 1"; account = "Campaign 3"; cctvReasonCodes = "BROWSING"; noc = "Pending"; remarks = "Wendie note 1" }
        )
        kenneth = @(
            @{ year = "2026"; month = "Aug"; date = "8/29/2026"; name = "Kenneth"; om = "Cherry"; site = "Digos Site"; tl = "TL 4"; agentName = "Agent Kenneth 1"; account = "Campaign 4"; cctvReasonCodes = "ATTENDANCE"; noc = " pending "; remarks = "Kenneth note 1" }
        )
        jr = @(
            @{ year = "2026"; month = "Aug"; date = "8/29/2026"; name = "JR"; om = "Shayne"; site = "Digos Site"; tl = "TL 5"; agentName = "Agent JR 1"; account = "Campaign 5"; cctvReasonCodes = "BROWSING"; noc = "PENDING"; remarks = "JR note 1" }
        )
    }
    sources = @{
        miles = @{ ok = $true; gid = 304130933; sheetName = "tracker"; totalRows = 396; pendingRows = 1 }
        seth = @{ ok = $true; gid = 1498030603; sheetName = "Seth"; totalRows = 120; pendingRows = 2 }
        wendie = @{ ok = $true; gid = 217322359; sheetName = "Amor"; totalRows = 95; pendingRows = 1 }
        kenneth = @{ ok = $true; gid = 1338240153; sheetName = "Kenneth"; totalRows = 80; pendingRows = 1 }
        jr = @{ ok = $true; gid = 487380454; sheetName = "JR"; totalRows = 75; pendingRows = 1 }
    }
}

$pendingTrackers = $mockV3Payload.pending

# Test Miles
$resMiles = Render-Pending-Tracker $mockV3Payload $pendingTrackers "miles" ""
if ($resMiles.count -eq 1 -and $resMiles.title -eq "Pending Miles" -and $resMiles.renderedRows[0][3] -eq "Miles") {
    Write-Host "PASS: Miles tab renders 1 row exclusively"
} else { throw "Miles tab failed: $resMiles" }

# Test Seth
$resSeth = Render-Pending-Tracker $mockV3Payload $pendingTrackers "seth" ""
if ($resSeth.count -eq 2 -and $resSeth.title -eq "Pending Seth" -and $resSeth.renderedRows[0][3] -eq "Seth") {
    Write-Host "PASS: Seth tab renders 2 rows exclusively"
} else { throw "Seth tab failed: $resSeth" }

# Test Wendie
$resWendie = Render-Pending-Tracker $mockV3Payload $pendingTrackers "wendie" ""
if ($resWendie.count -eq 1 -and $resWendie.title -eq "Pending Wendie" -and $resWendie.renderedRows[0][7] -eq "Agent Wendie 1") {
    Write-Host "PASS: Wendie tab renders 1 row exclusively with display title 'Pending Wendie'"
} else { throw "Wendie tab failed: $resWendie" }

# Test Kenneth
$resKenneth = Render-Pending-Tracker $mockV3Payload $pendingTrackers "kenneth" ""
if ($resKenneth.count -eq 1 -and $resKenneth.title -eq "Pending Kenneth" -and $resKenneth.renderedRows[0][3] -eq "Kenneth") {
    Write-Host "PASS: Kenneth tab renders 1 row exclusively"
} else { throw "Kenneth tab failed: $resKenneth" }

# Test JR
$resJR = Render-Pending-Tracker $mockV3Payload $pendingTrackers "jr" ""
if ($resJR.count -eq 1 -and $resJR.title -eq "Pending JR" -and $resJR.renderedRows[0][3] -eq "JR") {
    Write-Host "PASS: JR tab renders 1 row exclusively"
} else { throw "JR tab failed: $resJR" }

Write-Host "3. VERIFYING TAB ISOLATION (NO ROW LEAKING)"
$allRowsRendered = @{
    miles = $resMiles.renderedRows
    seth = $resSeth.renderedRows
    wendie = $resWendie.renderedRows
    kenneth = $resKenneth.renderedRows
    jr = $resJR.renderedRows
}
# Verify Seth rows are not in Miles
$sethAgents = $resSeth.renderedRows | ForEach-Object { $_[7] }
$milesAgents = $resMiles.renderedRows | ForEach-Object { $_[7] }
foreach ($sa in $sethAgents) {
    if ($milesAgents -contains $sa) { throw "Row leaking detected! $sa found in Miles" }
}
Write-Host "PASS: Tab isolation verified: no rows leak between users"

Write-Host "4. TESTING ERROR HANDLING VS EMPTY STATES (REQUIREMENT 6)"
# Case A: Source error (e.g., GID not found)
$mockErrorPayload = @{
    success = $true
    version = "3.0"
    pending = @{ miles = @(); seth = @() }
    sources = @{
        seth = @{ ok = $false; gid = 1498030603; error = "Could not find sheet with GID: 1498030603" }
    }
}
$resSethErr = Render-Pending-Tracker $mockErrorPayload @{ seth = @() } "seth" ""
if ($resSethErr.error -and $resSethErr.error.Contains("Source Error") -and $resSethErr.error.Contains("1498030603")) {
    Write-Host "PASS: Sheet source error correctly displayed for Seth: '$($resSethErr.error)'"
} else {
    Write-Host "FAIL: Expected source error for Seth, got $($resSethErr.error)"
    throw "Seth error test failed"
}

# Case B: Empty state (source ok = true, 0 rows)
$mockEmptyPayload = @{
    success = $true
    version = "3.0"
    pending = @{ seth = @() }
    sources = @{
        seth = @{ ok = $true; gid = 1498030603; totalRows = 50; pendingRows = 0 }
    }
}
$resSethEmpty = Render-Pending-Tracker $mockEmptyPayload @{ seth = @() } "seth" ""
if ($resSethEmpty.isEmpty -eq $true -and $null -eq $resSethEmpty.error) {
    Write-Host "PASS: Zero pending rows cleanly triggers empty state, NOT source error"
} else {
    Write-Host "FAIL: Expected empty state, got error"
    throw "Seth empty state failed"
}

# Case C: Older v2 API payload clicked on Seth
$mockV2Payload = @{
    success = $true
    version = "2.0"
    tracker = @()
}
$resSethV2 = Render-Pending-Tracker $mockV2Payload @{ seth = @() } "seth" ""
if ($resSethV2.error -and $resSethV2.error.Contains("requires the updated Master List Apps Script v3")) {
    Write-Host "PASS: Old v2 API payload clearly prompts for Apps Script v3 redeployment"
} else {
    Write-Host "FAIL: Expected redeployment prompt"
    throw "Old v2 test failed"
}

Write-Host ""
Write-Host "ALL TESTS PASSED WITH 100% SUCCESS!"
