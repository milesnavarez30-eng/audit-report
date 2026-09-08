$ErrorActionPreference = "Stop"

$indexPath = "c:\Users\Mnavares\Documents\CCTV OPS\audit-report\index.html"
$stylePath = "c:\Users\Mnavares\Documents\CCTV OPS\audit-report\style.css"

$utf8NoBom = New-Object System.Text.UTF8Encoding($false)

$indexContent = [System.IO.File]::ReadAllText($indexPath, $utf8NoBom)
$styleContent = [System.IO.File]::ReadAllText($stylePath, $utf8NoBom)

# 1. Update line 10228 in index.html (body.ops-redesign-v3 #eodPanel .simple-eod-actions)
$oldOpsRedesign = @"
body.ops-redesign-v3 #eodPanel .simple-eod-actions {
    position: static !important;
    top: auto !important;
    z-index: 10 !important;

    display: flex !important;
    align-items: center !important;
    gap: 10px !important;
    flex-wrap: nowrap !important;

    margin: 14px 0 22px 0 !important;
    padding: 0 !important;

    border: none !important;
    outline: none !important;
    border-radius: 0 !important;

    background: transparent !important;
    background-color: transparent !important;
    box-shadow: none !important;
    backdrop-filter: none !important;
    -webkit-backdrop-filter: none !important;
}
"@

$newOpsRedesign = @"
body.ops-redesign-v3 #eodPanel .simple-eod-actions {
    position: static !important;
    top: auto !important;
    z-index: 10 !important;

    display: flex !important;
    align-items: center !important;
    gap: 6px 8px !important;
    flex-wrap: wrap !important;

    margin: 12px 0 18px 0 !important;
    padding: 0 0 10px 0 !important;

    border: none !important;
    outline: none !important;
    border-radius: 0 !important;

    background: transparent !important;
    background-color: transparent !important;
    box-shadow: none !important;
    backdrop-filter: none !important;
    -webkit-backdrop-filter: none !important;
    overflow: visible !important;
    overflow-x: visible !important;
    overflow-y: visible !important;
}
"@

# Normalize CRLF for replacement
$oldOpsRedesignCRLF = $oldOpsRedesign.Replace("`r`n", "`n").Replace("`n", "`r`n")
$newOpsRedesignCRLF = $newOpsRedesign.Replace("`r`n", "`n").Replace("`n", "`r`n")

if ($indexContent.Contains($oldOpsRedesignCRLF)) {
    $indexContent = $indexContent.Replace($oldOpsRedesignCRLF, $newOpsRedesignCRLF)
    Write-Host "[OK] Replaced ops-redesign toolbar rule in index.html"
} else {
    Write-Warning "Could not find exact old ops-redesign rule block in index.html"
}

# 2. Extract new toolbar section from style.css
$styleStartToken = "/* ==========================================================================`r`n   REMOVE SCROLLBAR & FIT MAINTENANCE BUTTON TOOLBAR"
$styleEndToken = "#maintenancePanel button:active:not(:disabled),"

$styleStartIndex = $styleContent.IndexOf($styleStartToken)
if ($styleStartIndex -lt 0) {
    # Try LF
    $styleStartToken = "/* ==========================================================================`n   REMOVE SCROLLBAR & FIT MAINTENANCE BUTTON TOOLBAR"
    $styleStartIndex = $styleContent.IndexOf($styleStartToken)
}

$styleEndIndex = $styleContent.IndexOf($styleEndToken, $styleStartIndex)
if ($styleStartIndex -lt 0 -or $styleEndIndex -lt 0) {
    throw "Failed to find style block in style.css"
}

$newStyleBlock = $styleContent.Substring($styleStartIndex, $styleEndIndex - $styleStartIndex)

# 3. Find old toolbar section in index.html and replace it
$indexStartToken = "/* =========================================================================="
$indexStartPattern = "REMOVE MAINTENANCE BUTTONS CONTAINER BOX"

$searchPos = 0
$indexStartIndex = -1
while (($p = $indexContent.IndexOf($indexStartToken, $searchPos)) -ge 0) {
    $chunk = $indexContent.Substring($p, [Math]::Min(200, $indexContent.Length - $p))
    if ($chunk.Contains($indexStartPattern)) {
        $indexStartIndex = $p
        break
    }
    $searchPos = $p + $indexStartToken.Length
}

if ($indexStartIndex -lt 0) {
    throw "Failed to locate start of toolbar section in index.html"
}

$indexEndToken = "#maintenancePanel button:active:not(:disabled),"
$indexEndIndex = $indexContent.IndexOf($indexEndToken, $indexStartIndex)

if ($indexEndIndex -lt 0) {
    throw "Failed to locate end token in index.html"
}

$indexContent = $indexContent.Substring(0, $indexStartIndex) + $newStyleBlock + $indexContent.Substring($indexEndIndex)
[System.IO.File]::WriteAllText($indexPath, $indexContent, $utf8NoBom)
Write-Host "[OK] Successfully synced complete toolbar overhaul into index.html"
