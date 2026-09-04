# Simulates getMaintenanceDestinationSheet_ helper in Apps Script

$destinations = @{
    "maa_4_5" = @{ label = "MAA 4th & 5th Floor"; sheetId = 0 }
    "mabini_a" = @{ label = "Mabini Site A - 1st & 2nd Floor"; sheetId = 484781158 }
    "gensan" = @{ label = "Gensan Site"; sheetId = 219168917 }
    "maa_6" = @{ label = "MAA 6th Floor"; sheetId = 11380648 }
    "mabini_b" = @{ label = "Mabini Site B - 2nd, 3rd & 4th Floor"; sheetId = 1670996421 }
    "digos" = @{ label = "Digos Site"; sheetId = 1812673001 }
    "ecoland" = @{ label = "Ecoland Site"; sheetId = 429979469 }
    "cdo" = @{ label = "CDO Site"; sheetId = 1535793826 }
}

$excludedTabs = @("Sheet20", "MAA SITE 4TH FLR", "MAA SITE 5TH FLR")

# Mock Spreadsheet Sheets
$mockSheets = @(
    @{ name = "MAA 4F|5F"; sheetId = 0 },
    @{ name = "MABINI SITE A - 1F|2F"; sheetId = 484781158 },
    @{ name = "GENSAN SITE"; sheetId = 219168917 },
    @{ name = "MAA SITE 6TH FLR"; sheetId = 11380648 },
    @{ name = "MABINI SITE B - 2F|3F|4F"; sheetId = 1670996421 },
    @{ name = "DIGOS SITE"; sheetId = 1812673001 },
    @{ name = "ECOLAND SITE"; sheetId = 429979469 },
    @{ name = "CDO SITE"; sheetId = 1535793826 },
    @{ name = "Sheet20"; sheetId = 999999 },
    @{ name = "MAA SITE 4TH FLR"; sheetId = 888888 },
    @{ name = "MAA SITE 5TH FLR"; sheetId = 777777 }
)

function Get-MaintenanceDestinationSheet($destKey, $sheets) {
    if (-not $destinations.ContainsKey($destKey)) {
        throw "Invalid Maintenance destination: $destKey"
    }

    $dest = $destinations[$destKey]
    $found = $null

    foreach ($s in $sheets) {
        if ([long]$s.sheetId -eq [long]$dest.sheetId) {
            $found = $s
            break
        }
    }

    if (-not $found) {
        throw "Configured Maintenance tracker was not found for $($dest.label) (GID $($dest.sheetId))."
    }

    $upperName = $found.name.ToUpper().Trim()
    foreach ($ex in $excludedTabs) {
        if ($upperName -eq $ex.ToUpper().Trim()) {
            throw "Routing to excluded tab `"$($found.name)`" is strictly blocked."
        }
    }

    return @{
        sheet = $found
        destination = $dest
    }
}

Write-Host "--- Testing All 8 Destinations ---"
foreach ($k in $destinations.Keys) {
    $res = Get-MaintenanceDestinationSheet $k $mockSheets
    Write-Host "  [OK] Key: $k -> Tab: $($res.sheet.name), GID: $($res.sheet.sheetId)"
}

Write-Host "`n--- Testing Invalid Key Rejection ---"
try {
    Get-MaintenanceDestinationSheet "invalid_key" $mockSheets
    Write-Host "  [FAIL] Failed to reject invalid key" -ForegroundColor Red
    exit 1
} catch {
    Write-Host "  [PASS] Successfully caught invalid key: $($_.Exception.Message)" -ForegroundColor Green
}

Write-Host "`n--- Testing Direct Tab Name Attack (Sheet20) ---"
try {
    Get-MaintenanceDestinationSheet "Sheet20" $mockSheets
    Write-Host "  [FAIL] Failed to block Sheet20" -ForegroundColor Red
    exit 1
} catch {
    Write-Host "  [PASS] Successfully blocked Sheet20: $($_.Exception.Message)" -ForegroundColor Green
}

Write-Host "`n--- Testing Excluded Sheet Safeguard ---"
$tamperedSheets = @(
    @{ name = "Sheet20"; sheetId = 484781158 }
)
try {
    Get-MaintenanceDestinationSheet "mabini_a" $tamperedSheets
    Write-Host "  [FAIL] Failed to block tampered Sheet20" -ForegroundColor Red
    exit 1
} catch {
    Write-Host "  [PASS] Successfully blocked tampered excluded sheet: $($_.Exception.Message)" -ForegroundColor Green
}

Write-Host "`nALL SIMULATION CHECKS PASSED!"
