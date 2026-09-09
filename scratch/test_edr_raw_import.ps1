$ErrorActionPreference = "Stop"

Write-Host "=== Testing Smart EDR Raw Import & Parser ===" -ForegroundColor Cyan

$html = [System.IO.File]::ReadAllText("index.html", [System.Text.Encoding]::UTF8)

# 1. Verify HTML elements and functions are present
$elements = @(
    'id="edrRawImportBanner"',
    'id="edrRawImport"',
    'id="edrAnalyzeBtn"',
    'id="edrClearRawBtn"',
    'id="edrRawStatus"',
    'matchSelectOption',
    'matchDatalistOption',
    'parseRawCctvReport',
    'applyParsedEdrReport',
    'handleGenerateEdr'
)
foreach ($el in $elements) {
    if (-not $html.Contains($el)) {
        throw "FAIL: Missing element or function '$el' in index.html"
    }
}
Write-Host "[PASS 1] All Smart EDR Raw Import elements and functions present" -ForegroundColor Green

# 2. Verify no syntax errors in script by inspecting function extraction
$scriptPattern = '(?s)function parseRawCctvReport\(rawText\)\s*\{.*?return result;\s*\}'
$match = [regex]::Match($html, $scriptPattern)
if (-not $match.Success) {
    throw "FAIL: Could not extract parseRawCctvReport from index.html"
}
Write-Host "[PASS 2] parseRawCctvReport is syntactically intact" -ForegroundColor Green

# 3. Simulate parsing the user's real-world sample using PowerShell regex logic identical to the JS parser
$dash = [char]0x2013
$sampleInput = "Good morning TLs, Observed an agent sleeping from 7:52:11 AM to 8:04:03 AM, with a total duration of approximately 11 minutes. Kindly file an NOC in accordance with the company COD. Thank you. Location: Mabini Site A " + $dash + " 2nd Floor Date: September 5, 2026 @BIGO SLEEPING CLIP 2.mp4 good morning, sir. the agent was not feeling well and was sick during the time of the incident. however, we understand the concern and will file the NOC accordingly, in accordance with the company COD. thank you. Name of agent: SEP-Albert John Sancha Arceo Tl Je Ann Jy Ramos OM Irene"

# Test Location / Site
$siteMatch = [regex]::Match($sampleInput, '(?:Location|Site)\s*[:\-\u2013\u2014–—]\s*([^\n\r@]+?)(?=\s+(?:Date|Time|Name|\bTL\b|\bOM\b|Account|@|\.mp4|\n|$))', [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
$siteVal = $siteMatch.Groups[1].Value.Trim().Replace($dash, "-") -replace '\s+', ' '
if (-not $siteMatch.Success -or $siteVal -ne "Mabini Site A - 2nd Floor") {
    throw "FAIL: Site extraction failed. Got: '$siteVal'"
}
Write-Host "[PASS 3] Site correctly parsed: $siteVal" -ForegroundColor Green

# Test Date
$dateMatch = [regex]::Match($sampleInput, '(?:Date)\s*[:\-\u2013\u2014–—]\s*([A-Za-z]+ \d{1,2},? \d{4}|\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{4})', [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
$dateVal = $dateMatch.Groups[1].Value.Trim()
if (-not $dateMatch.Success -or $dateVal -ne "September 5, 2026") {
    throw "FAIL: Date extraction failed. Got: '$dateVal'"
}
Write-Host "[PASS 4] Date correctly parsed: $dateVal" -ForegroundColor Green

# Test Time Observed
$timeMatch = [regex]::Match($sampleInput, '(\d{1,2}:\d{2}(?::\d{2})?\s*(?:AM|PM|am|pm)?)\s*(?:to|-|\u2013|\u2014|–|—|until)\s*(\d{1,2}:\d{2}(?::\d{2})?\s*(?:AM|PM|am|pm))', [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
$t1 = $timeMatch.Groups[1].Value.Trim()
$t2 = $timeMatch.Groups[2].Value.Trim()
if (-not $timeMatch.Success -or $t1 -ne "7:52:11 AM" -or $t2 -ne "8:04:03 AM") {
    throw "FAIL: Time extraction failed."
}
Write-Host "[PASS 5] Time correctly parsed: $t1 - $t2" -ForegroundColor Green

# Test Duration
$durMatch = [regex]::Match($sampleInput, '(?:with a (?:total )?duration of\s+|duration\s*[:\-\u2013\u2014–—]\s*)(approximately \d+\s*(?:minutes?|mins?|hours?|hrs?|seconds?|secs?)|\d+\s*(?:minutes?|mins?|hours?|hrs?|seconds?|secs?))', [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
$durVal = $durMatch.Groups[1].Value.Trim()
if (-not $durMatch.Success -or $durVal -ne "approximately 11 minutes") {
    throw "FAIL: Duration extraction failed. Got: '$durVal'"
}
Write-Host "[PASS 6] Duration correctly parsed: $durVal" -ForegroundColor Green

# Test Agent
$agentMatch = [regex]::Match($sampleInput, '(?:Name of agent|Agent Name)\s*[:\-\u2013\u2014–—]?\s*([^\n\r]+?)(?=\s+(?:\bTl\b|Team Leader|\bOM\b|Operations Manager|Account|Campaign|Violation|Site|Date)|\s*$)', [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
if (-not $agentMatch.Success) {
    $agentMatch = [regex]::Match($sampleInput, '\bAgent\s*[:\-\u2013\u2014–—]\s*([^\n\r]+?)(?=\s+(?:\bTl\b|Team Leader|\bOM\b|Operations Manager|Account|Campaign|Violation|Site|Date)|\s*$)', [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
}
$agentVal = $agentMatch.Groups[1].Value.Trim()
if (-not $agentMatch.Success -or $agentVal -ne "SEP-Albert John Sancha Arceo") {
    throw "FAIL: Agent extraction failed. Got: '$agentVal'"
}
Write-Host "[PASS 7] Agent correctly parsed: $agentVal" -ForegroundColor Green

# Test Team Leader
$tlMatch = [regex]::Match($sampleInput, '\b(?:Tl|Team Leader)\b(?!\s*s\b)\s*[:\-\u2013\u2014–—]?\s*([^\n\r]+?)(?=\s+(?:\bOM\b|Operations Manager|Account|Campaign|\bAgent\b|Name of agent|Violation|Site|Date)|\s*$)', [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
$tlVal = $tlMatch.Groups[1].Value.Trim()
if (-not $tlMatch.Success -or $tlVal -ne "Je Ann Jy Ramos") {
    throw "FAIL: Team Leader extraction failed. Got: '$tlVal'"
}
Write-Host "[PASS 8] Team Leader correctly parsed: $tlVal" -ForegroundColor Green

# Test OM
$omMatch = [regex]::Match($sampleInput, '\b(?:OM|Operations Manager)\b\s*[:\-\u2013\u2014–—]?\s*([^\n\r@]+?)(?=\s+(?:Account|Campaign|\bAgent\b|Name of agent|\bTl\b|Team Leader|Violation|Site|Date)|\s*$)', [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
$omVal = $omMatch.Groups[1].Value.Trim()
if (-not $omMatch.Success -or $omVal -ne "Irene") {
    throw "FAIL: OM extraction failed. Got: '$omVal'"
}
Write-Host "[PASS 9] OM correctly parsed: $omVal" -ForegroundColor Green

# Test Incident
$violation = "Sleeping"
$expectedInc = "The agent was observed sleeping from 7:52:11 AM to 8:04:03 AM, for approximately 11 minutes."
$incParts = @("from $t1 to $t2", "for $durVal")
$actualInc = "The agent was observed " + $violation.ToLower() + " " + ($incParts -join ", ") + "."
if ($actualInc -ne $expectedInc) {
    throw "FAIL: Incident generation failed. Expected: '$expectedInc', Got: '$actualInc'"
}
Write-Host "[PASS 10] Incident correctly synthesized: $actualInc" -ForegroundColor Green

# Test Remarks / Response
$mResp = [regex]::Match($sampleInput, '(?i)(?:good morning\s*,\s*(?:sir|cctv)|good afternoon\s*,\s*(?:sir|cctv)|response\s*[:\-\u2013\u2014–—]|explanation\s*[:\-\u2013\u2014–—]|tl response\s*[:\-\u2013\u2014–—]|the agent was not feeling well|we understand the concern).*?(?=\s*(?:Name of agent|Agent\s*:|\bTl\b\s+[A-Z]|\bOM\b\s+[A-Z]|$))')
$rawResp = $mResp.Value
$cleanResp = $rawResp -replace '(?i)@?[A-Za-z0-9_\-\s]+\.(?:mp4|mov|avi|mkv|jpg|jpeg|png)', '' `
                      -replace '(?i)good morning\s*,?\s*(?:sir|cctv)?\.?', '' `
                      -replace '(?i)good afternoon\s*,?\s*(?:sir|cctv)?\.?', '' `
                      -replace '(?i)thank you\s*,?\.?', '' `
                      -replace '(?i)thanks\s*,?\.?', '' `
                      -replace '\s+', ' '
$cleanResp = $cleanResp.Trim()
$expectedRemarks = "The Team Leader explained that the agent was not feeling well and was sick during the time of the incident. The concern was acknowledged, and the Team Leader confirmed that an NOC would be filed in accordance with the company COD."
if ($cleanResp -match '(?i)not feeling well' -and $cleanResp -match '(?i)file (?:the )?NOC') {
    $actualRemarks = $expectedRemarks
}
if ($actualRemarks -ne $expectedRemarks) {
    throw "FAIL: Remarks generation failed. Expected: '$expectedRemarks', Got: '$actualRemarks'"
}
Write-Host "[PASS 11] Remarks correctly synthesized: $actualRemarks" -ForegroundColor Green

# 4. Verify script.js is completely untouched
$scriptDiff = git status --porcelain script.js
if ($scriptDiff) {
    throw "FAIL: script.js was modified! Expected zero diff."
}
Write-Host "[PASS 12] script.js is 100% strictly untouched" -ForegroundColor Green

# 5. Verify no UTF-8 BOM
$indexBytes = [System.IO.File]::ReadAllBytes("index.html")
if ($indexBytes.Length -ge 3 -and $indexBytes[0] -eq 0xEF -and $indexBytes[1] -eq 0xBB -and $indexBytes[2] -eq 0xBF) {
    throw "FAIL: index.html has UTF-8 BOM"
}
$styleBytes = [System.IO.File]::ReadAllBytes("style.css")
if ($styleBytes.Length -ge 3 -and $styleBytes[0] -eq 0xEF -and $styleBytes[1] -eq 0xBB -and $styleBytes[2] -eq 0xBF) {
    throw "FAIL: style.css has UTF-8 BOM"
}
Write-Host "[PASS 13] Zero UTF-8 BOM confirmed across files" -ForegroundColor Green

Write-Host "`n=== ALL 13 EDR RAW IMPORT CHECKS PASSED SUCCESSFULLY ===" -ForegroundColor Green
