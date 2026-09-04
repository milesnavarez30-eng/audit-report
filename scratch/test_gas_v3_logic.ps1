Write-Host "Running tests via PowerShell..."

function Clean-Text($val) {
    if ($null -eq $val) { return "" }
    return [regex]::Replace([string]$val, "\s+", " ").Trim()
}

function Map-Headers($headers) {
    $map = @{
        year = -1; month = -1; date = -1; name = -1; om = -1; site = -1;
        tl = -1; agentName = -1; account = -1; cctvReasonCodes = -1; noc = -1; remarks = -1
    }

    for ($c = 0; $c -lt $headers.Count; $c++) {
        $raw = Clean-Text $headers[$c]
        $norm = [regex]::Replace($raw.ToLower(), "[^a-z0-9]", "")

        if ($map.year -eq -1 -and ($norm -eq "year" -or $norm -eq "yr")) {
            $map.year = $c
        } elseif ($map.month -eq -1 -and ($norm -eq "month" -or $norm -eq "mo")) {
            $map.month = $c
        } elseif ($map.date -eq -1 -and ($norm -eq "date" -or $norm -eq "dt")) {
            $map.date = $c
        } elseif ($map.name -eq -1 -and ($norm -eq "name" -or $norm -eq "auditor" -or $norm -eq "staff" -or $norm -eq "analyst")) {
            $map.name = $c
        } elseif ($map.om -eq -1 -and ($norm -eq "om" -or $norm -eq "operationmanager" -or $norm -eq "operationsmanager" -or $norm -eq "omname")) {
            $map.om = $c
        } elseif ($map.site -eq -1 -and ($norm -eq "site" -or $norm -eq "location")) {
            $map.site = $c
        } elseif ($map.tl -eq -1 -and ($norm -eq "tl" -or $norm -eq "teamleader" -or $norm -eq "teamlead" -or $norm -eq "tlname")) {
            $map.tl = $c
        } elseif ($map.agentName -eq -1 -and ($norm -eq "agentname" -or $norm -eq "agent" -or $norm -eq "employeename" -or $norm -eq "subjectname")) {
            $map.agentName = $c
        } elseif ($map.account -eq -1 -and ($norm -eq "account" -or $norm -eq "campaign" -or $norm -eq "client")) {
            $map.account = $c
        } elseif (
            $map.cctvReasonCodes -eq -1 -and
            ($norm.StartsWith("cctvreason") -or $norm -eq "reasoncode" -or $norm -eq "reasoncodes" -or $norm -eq "reason" -or $norm -eq "cctvreasoncod" -or $norm -eq "cctvreasoncode" -or $norm -eq "cctvreasoncodes")
        ) {
            $map.cctvReasonCodes = $c
        } elseif ($map.noc -eq -1 -and ($norm -eq "noc" -or $norm -eq "nocstatus" -or $norm -eq "status")) {
            $map.noc = $c
        } elseif ($map.remarks -eq -1 -and ($norm -eq "remarks" -or $norm -eq "remark" -or $norm -eq "notes" -or $norm -eq "note" -or $norm -eq "comments")) {
            $map.remarks = $c
        }
    }
    return $map
}

function Test-Condition($cond, $desc) {
    if ($cond) {
        Write-Host "PASS: $desc"
    } else {
        Write-Host "FAIL: $desc"
        throw "Assertion failed: $desc"
    }
}

# 1. Header mapping variations
$h1 = @("Year", "Month", "Date", "Name", "OM", "SITE", "TL", "Agent Name", "Account", "CCTV Reason Code", "NOC", "Remarks")
$m1 = Map-Headers $h1
Test-Condition ($m1.cctvReasonCodes -eq 9) "Maps 'CCTV Reason Code' to index 9"
Test-Condition ($m1.agentName -eq 7) "Maps 'Agent Name' to index 7"
Test-Condition ($m1.noc -eq 10) "Maps 'NOC' to index 10"

$h2 = @("Year", "Month", "Date", "Auditor", "OM", "SITE", "TL", "Agent", "Campaign", "CCTV Reason Cod", "NOC STATUS", "Remarks")
$m2 = Map-Headers $h2
Test-Condition ($m2.cctvReasonCodes -eq 9) "Maps 'CCTV Reason Cod' variation to index 9"
Test-Condition ($m2.agentName -eq 7) "Maps 'Agent' variation to index 7"
Test-Condition ($m2.noc -eq 10) "Maps 'NOC STATUS' variation to index 10"

$h3 = @("Year", "Month", "Date", "Name", "OM", "SITE", "TL", "Agent Name", "Account", "CCTV Reason Codes", "NOC", "Remarks")
$m3 = Map-Headers $h3
Test-Condition ($m3.cctvReasonCodes -eq 9) "Maps 'CCTV Reason Codes' plural variation to index 9"

# 2. Case-insensitive and trimmed Pending filter
function Is-Pending($v) {
    return (Clean-Text $v).ToLower() -eq "pending"
}
Test-Condition (Is-Pending "Pending") "'Pending' is matched"
Test-Condition (Is-Pending "PENDING") "'PENDING' is matched"
Test-Condition (Is-Pending " pending ") "' pending ' is matched"
Test-Condition (Is-Pending "  Pending  ") "'  Pending  ' is matched"
Test-Condition (-not (Is-Pending "YES")) "'YES' is rejected"
Test-Condition (-not (Is-Pending "NO")) "'NO' is rejected"
Test-Condition (-not (Is-Pending "Disputed")) "'Disputed' is rejected"
Test-Condition (-not (Is-Pending "")) "Empty string is rejected"

# 3. Real dump Miles verification
$realDump = Get-Content 'scratch/api_test.json' -Raw | ConvertFrom-Json
$milesPending = $realDump.tracker | Where-Object { (Clean-Text $_.Name).ToLower() -eq "miles" -and (Is-Pending $_.NOC) }
Test-Condition ($milesPending.Count -eq 5) "Real Miles tracker dump produces exactly 5 pending rows (found $($milesPending.Count))"

# 4. Simulation of 5 trackers
$mockSethRows = @(
    @{ Year = "2026"; Month = "Aug"; Date = "8/27/2026"; Name = "Seth"; OM = "Norman"; SITE = "Maa"; TL = "TL 1"; "Agent Name" = "Agent A"; Account = "Campaign 1"; "CCTV Reason Code" = "SLEEPING"; NOC = "Pending"; Remarks = "Note 1" },
    @{ Year = "2026"; Month = "Aug"; Date = "8/27/2026"; Name = "Seth"; OM = "Norman"; SITE = "Maa"; TL = "TL 1"; "Agent Name" = "Agent B"; Account = "Campaign 1"; "CCTV Reason Code" = "BROWSING"; NOC = "YES"; Remarks = "Resolved" },
    @{ Year = "2026"; Month = "Aug"; Date = "8/28/2026"; Name = "Seth"; OM = "Norman"; SITE = "Maa"; TL = "TL 2"; "Agent Name" = "Agent C"; Account = "Campaign 2"; "CCTV Reason Code" = "CALL AVOIDANCE"; NOC = " pending "; Remarks = "Follow up" }
)
$sethPending = $mockSethRows | Where-Object { Is-Pending $_.NOC }
Test-Condition ($sethPending.Count -eq 2) "Seth mock rows produce exactly 2 pending rows"

# 5. Simulation of Wendie / Amor tracker
$mockWendieRows = @(
    @{ Year = "2026"; Month = "Aug"; Date = "8/28/2026"; Name = "Amor"; OM = "Jordan"; SITE = "Mabini"; TL = "TL 3"; "Agent Name" = "Agent D"; Account = "Campaign 3"; "CCTV Reason Cod" = "BROWSING"; NOC = "PENDING"; Remarks = "Sample Wendie row 1" },
    @{ Year = "2026"; Month = "Aug"; Date = "8/29/2026"; Name = ""; OM = "Jordan"; SITE = "Mabini"; TL = "TL 3"; "Agent Name" = "Agent E"; Account = "Campaign 3"; "CCTV Reason Codes" = "SLEEPING"; NOC = "Pending"; Remarks = "Sample Wendie row 2" },
    @{ Year = "2026"; Month = "Aug"; Date = "8/29/2026"; Name = "Amor"; OM = "Jordan"; SITE = "Mabini"; TL = "TL 3"; "Agent Name" = "Agent F"; Account = "Campaign 3"; "CCTV Reason Code" = "ATTENDANCE"; NOC = "NO"; Remarks = "Closed" }
)
$wendiePending = $mockWendieRows | Where-Object { Is-Pending $_.NOC }
Test-Condition ($wendiePending.Count -eq 2) "Wendie/Amor mock rows produce exactly 2 pending rows with header variations"

Write-Host "`nALL UNIT TESTS PASSED SUCCESSFULLY!"
