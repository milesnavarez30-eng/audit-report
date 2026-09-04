# Verification script for Maintenance Dynamic Destinations and PDF Title Fix

$ErrorActionPreference = "Stop"

Write-Host "=================================================="
Write-Host "MAINTENANCE DYNAMIC DESTINATIONS & PDF VERIFICATION"
Write-Host "=================================================="

$receiverFile = "Maintenance_Google_Sheets_Receiver_V8_14.gs"
$scratchReceiverFile = "scratch\Code.gs"
$htmlFile = "index.html"
$cssFile = "style.css"

$passed = 0
$failed = 0

function Assert-Condition($condition, $description) {
    if ($condition) {
        Write-Host "  [PASS] $description" -ForegroundColor Green
        $script:passed++
    } else {
        Write-Host "  [FAIL] $description" -ForegroundColor Red
        $script:failed++
    }
}

# 1. Receiver Tests
Write-Host "`n--- 1. Testing Apps Script Receiver ($receiverFile and $scratchReceiverFile) ---"
$receiverCode = Get-Content -Raw $receiverFile
$scratchCode = Get-Content -Raw $scratchReceiverFile

Assert-Condition ($receiverCode -eq $scratchCode) "Root and scratch receivers are in sync"

Assert-Condition ($receiverCode -notmatch "const SHEET_NAME\s*=") "Hardcoded SHEET_NAME constant is removed"
Assert-Condition ($receiverCode -match "1PBKIr7cACVcElX9YpAqshhTTsjlJz69dji7TiA0IlrE") "Target spreadsheet ID is preserved"

$expectedDestinations = @{
    "maa_4_5" = 0
    "mabini_a" = 484781158
    "gensan" = 219168917
    "maa_6" = 11380648
    "mabini_b" = 1670996421
    "digos" = 1812673001
    "ecoland" = 429979469
    "cdo" = 1535793826
}

foreach ($k in $expectedDestinations.Keys) {
    $expectedGid = $expectedDestinations[$k]
    $hasKey = $receiverCode -match "(?s)$k\s*:\s*\{.*?sheetId\s*:\s*$expectedGid"
    Assert-Condition $hasKey "Destination '$k' has exact sheetId: $expectedGid"
}

Assert-Condition ($receiverCode -match "function getMaintenanceDestinationSheet_\(ss,\s*destinationKey\)") "getMaintenanceDestinationSheet_ helper is implemented"
Assert-Condition ($receiverCode -match "Sheet20" -and $receiverCode -match "MAA SITE 4TH FLR" -and $receiverCode -match "MAA SITE 5TH FLR") "Receiver contains explicit safeguards blocking Sheet20, MAA SITE 4TH FLR, and MAA SITE 5TH FLR"
Assert-Condition ($receiverCode -match "p\.destinationKey") "Receiver doGet health check supports dynamic destinationKey parameter"
Assert-Condition ($receiverCode -match "payload\.destinationKey") "appendMaintenanceReport_ resolves dynamic payload.destinationKey"
Assert-Condition ($receiverCode -match "safelyUnmergeRowArea_") "V8.13 safe unmerge engine preserved"
Assert-Condition ($receiverCode -match "(?s)SpreadsheetApp\s*\.\s*newCellImage") "True in-cell image engine preserved"

# 2. Frontend HTML / JS Tests
Write-Host "`n--- 2. Testing index.html UI and Routing ---"
$html = Get-Content -Raw $htmlFile

Assert-Condition ($html -match 'id="simpleEodDestination"') "Frontend has #simpleEodDestination selector"

foreach ($k in $expectedDestinations.Keys) {
    $hasOption = $html -match "<option[^>]+value=`"$k`""
    Assert-Condition $hasOption "Selector option exists for '$k'"
}

# Ensure excluded sheets are NOT options in the selector
Assert-Condition ($html -notmatch "<option[^>]*Sheet20" -and $html -notmatch "<option[^>]*MAA SITE 4TH FLR" -and $html -notmatch "<option[^>]*MAA SITE 5TH FLR") "Excluded tabs (Sheet20, MAA SITE 4TH/5TH FLR) are NOT in the destination selector"

Assert-Condition ($html -match "destinationKey\s*:\s*destinationKey") "buildMaintenanceSheetsPayload sends destinationKey"
Assert-Condition ($html -match "action:\s*`"health`",\s*destinationKey:\s*destKey") "testMaintenanceSheetsConnection sends destinationKey in health query"
Assert-Condition ($html -match 'simpleEodDestination.*addEventListener.*change') "Destination change listener triggers dynamic update and save"
Assert-Condition ($html -match 'state\.destinationKey') "state persists destinationKey across loadDraft and clearAll"

# 3. PDF Contrast Fix Tests
Write-Host "`n--- 3. Testing PDF Contrast Fix (index.html & style.css) ---"
$css = Get-Content -Raw $cssFile

Assert-Condition ($html -match 'color:\s*#000000\s*!important' -and $html -match 'grouped-pdf-header h1') "index.html has pure black !important rule for grouped-pdf-header h1"
Assert-Condition ($html -match 'font-weight:\s*800\s*!important') "index.html has bold font-weight 800 !important for report title"
Assert-Condition ($html -match 'opacity:\s*1\s*!important') "index.html has opacity: 1 !important for title"
Assert-Condition ($html -match '-webkit-text-fill-color:\s*#000000\s*!important') "index.html forces webkit text fill color for dark mode canvas engines"

Assert-Condition ($css -match '(?s)grouped-pdf-header h1.*?color:\s*#000000\s*!important') "style.css has pure black !important rule for grouped-pdf-header h1"
Assert-Condition ($css -match '(?s)\.grouped-pdf.*?background-color:\s*#ffffff\s*!important') "style.css forces pure white background for grouped-pdf"
Assert-Condition ($css -match '(?s)simple-pdf-table th.*?background-color:\s*#000000\s*!important') "style.css forces dark table headers with white text"

Write-Host "`n=================================================="
Write-Host "TEST SUMMARY: $passed Passed, $failed Failed"
Write-Host "=================================================="

if ($failed -gt 0) {
    exit 1
} else {
    exit 0
}
