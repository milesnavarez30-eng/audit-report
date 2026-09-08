# Verification script for Theme Layout Unification (Light Mode & Dark Mode consistency)
$ErrorActionPreference = "Stop"

Write-Host "--- Verifying Workspace Layout Unification (Light & Dark Mode) ---"

$indexPath = "c:\Users\Mnavares\Documents\CCTV OPS\audit-report\index.html"
$stylePath = "c:\Users\Mnavares\Documents\CCTV OPS\audit-report\style.css"
$scriptPath = "c:\Users\Mnavares\Documents\CCTV OPS\audit-report\script.js"

$indexContent = [System.IO.File]::ReadAllText($indexPath, [System.Text.Encoding]::UTF8)
$styleContent = [System.IO.File]::ReadAllText($stylePath, [System.Text.Encoding]::UTF8)

# 1. Verify script.js is completely untouched
$gitDiffScript = & git status --porcelain script.js
if ($gitDiffScript) {
    Write-Error "FAIL: script.js has uncommitted or modified changes!"
} else {
    Write-Host "[PASS] script.js is strictly untouched"
}

# 2. Verify all required CSS patterns are in both style.css and index.html
$patterns = @(
    "UNIFY WORKSPACE LAYOUT IN BOTH LIGHT & DARK MODES",
    "body > div:first-child",
    "#authGate[hidden]",
    "[data-theme=`"light`"] .main-content",
    "[data-theme=`"dark`"] .main-content",
    "padding: 24px 32px !important",
    "margin: 0 !important",
    "#maintenancePanel > .card",
    "#maintenancePanel > .panel",
    "body.light-mode #maintenancePanel > .card",
    "[data-theme=`"light`"] #maintenancePanel > .card",
    "background-color: #090d16 !important",
    "background-color: #f1f3f7 !important"
)

foreach ($pat in $patterns) {
    if (-not $styleContent.Contains($pat)) {
        Write-Error "FAIL: style.css is missing expected pattern: $pat"
    }
    if (-not $indexContent.Contains($pat)) {
        Write-Error "FAIL: index.html is missing expected pattern: $pat"
    }
}
Write-Host "[PASS] All unified layout CSS rules verified in style.css and index.html"

# 3. Verify UTF-8 No BOM
$styleBytes = [System.IO.File]::ReadAllBytes($stylePath)
if ($styleBytes[0] -eq 0xEF -and $styleBytes[1] -eq 0xBB -and $styleBytes[2] -eq 0xBF) {
    Write-Error "FAIL: style.css has UTF-8 BOM"
} else {
    Write-Host "[PASS] style.css is UTF-8 without BOM"
}

$indexBytes = [System.IO.File]::ReadAllBytes($indexPath)
if ($indexBytes[0] -eq 0xEF -and $indexBytes[1] -eq 0xBB -and $indexBytes[2] -eq 0xBF) {
    Write-Error "FAIL: index.html has UTF-8 BOM"
} else {
    Write-Host "[PASS] index.html is UTF-8 without BOM"
}

# 4. Verify 41 Critical DOM IDs preserved in index.html
$requiredIds = @(
    "maintenancePanel",
    "maintenanceInput",
    "maintenanceSortBtn",
    "maintenanceCopyBtn",
    "maintenanceClearBtn",
    "maintenanceResetAssignmentsBtn",
    "maintenanceMessage",
    "maintenanceStats",
    "overallRowCount",
    "sortedReportSection",
    "maintenanceOutputTable",
    "miniSheetFindTlInput",
    "miniSheetFindTlBtn",
    "miniSheetFindNextBtn",
    "miniSheetRowCount",
    "miniSheetSelectedCount",
    "miniSheetSelectSameTlBtn",
    "miniSheetCopyRowsBtn",
    "miniSheetCutRowsBtn",
    "miniSheetToReportBtn",
    "miniSheetClearSelectionBtn",
    "miniSheetRemoveRowBtn",
    "miniSheetClearAllBtn",
    "maintenanceMiniSheet",
    "maintenanceEmpty",
    "eodPanel",
    "simpleEodDestination",
    "simpleEodDate",
    "simpleEodSite",
    "simpleEodSaveBtn",
    "simpleEodDraftsBtn",
    "simpleEodCopySheetsBtn",
    "simpleEodSendSheetsBtn",
    "simpleEodSheetSetupBtn",
    "maintenanceSheetConnectionState",
    "simpleEodPreviewBtn",
    "simpleEodPdfBtn",
    "simpleEodClearBtn",
    "simpleEodAutosaveStatus",
    "simpleEodBlocks",
    "simpleEodAddBtn"
)

foreach ($id in $requiredIds) {
    if ($indexContent -notmatch "id=['`"]$id['`"]") {
        Write-Error "FAIL: Missing ID $id"
    }
}
Write-Host "[PASS] All 41 critical IDs confirmed present in index.html"

Write-Host "--- ALL WORKSPACE LAYOUT UNIFICATION CHECKS PASSED ---"
