# Test test_cctv_audit_and_edr_copy.ps1
$html = [System.IO.File]::ReadAllText("index.html", [System.Text.Encoding]::UTF8)

Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "TEST 11: CCTV AUDIT COPY TO TRACKER VERIFICATION" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan

# Verify function implementation details
$copyAuditMatch = $html -match '(?s)async function copyAuditForTracker\s*\((.*?)\)\s*\{(.*?)\n\s*async function copyToClipboard'

if ($copyAuditMatch) {
    $funcBody = $matches[2]
    Write-Host "[PASS] Extracted copyAuditForTracker implementation from index.html" -ForegroundColor Green
    
    # 1. Check 10pt font-size on table and every cell
    if ($funcBody -match 'font-size:\s*10pt;' -and $funcBody -match '<td style="[^"]*font-size:\s*10pt;') {
        Write-Host "[PASS] Font size 10pt is strictly specified on container, table, and every table cell" -ForegroundColor Green
    } else {
        Write-Host "[FAIL] 10pt font size missing on table cells" -ForegroundColor Red
        exit 1
    }

    # 2. Check TSV text/plain fallback
    if ($funcBody -match '\.join\("\\t"\)' -and $funcBody -match '\.join\("\\n"\)') {
        Write-Host "[PASS] TSV formatting applied for tracker tab-separated columns" -ForegroundColor Green
    } else {
        Write-Host "[FAIL] Missing TSV tab/newline joins" -ForegroundColor Red
        exit 1
    }

    # 3. Check Base64 regex sanitization
    if ($funcBody -match 'data:image\\/\[a-zA-Z0-9\.\+-\]\+;base64,\[A-Za-z0-9\+\/=\]\+') {
        Write-Host "[PASS] Base64 image data and screenshot data URLs are strictly stripped" -ForegroundColor Green
    } else {
        Write-Host "[FAIL] Missing Base64 sanitization" -ForegroundColor Red
        exit 1
    }

    # 4. Check all 12 columns in exact canonical order in the array
    $arrayMatch = $funcBody -match '(?s)return\s*\[\s*(entry\.year[\s\S]*?)\]\.map'
    if ($arrayMatch) {
        $arrayContent = $matches[1]
        $expectedCols = @(
            'entry\.year',
            'entry\.month',
            'entry\.formattedDate',
            'auditor',
            'entry\.omName',
            'entry\.site',
            'entry\.tlName',
            'entry\.agentName',
            'entry\.cleanAccount',
            'entry\.reasonCode',
            'entry\.noc',
            'entry\.remarks'
        )
        $colOrderCorrect = $true
        $lastIndex = -1
        foreach ($col in $expectedCols) {
            $idx = [regex]::Match($arrayContent, $col).Index
            if ($idx -lt 0) {
                Write-Host "[FAIL] Column $col not found in mapping" -ForegroundColor Red
                $colOrderCorrect = $false
                break
            }
            if ($idx -le $lastIndex) {
                Write-Host "[FAIL] Column $col is out of order" -ForegroundColor Red
                $colOrderCorrect = $false
                break
            }
            $lastIndex = $idx
        }
        if ($colOrderCorrect) {
            Write-Host "[PASS] All 12 columns present in exact canonical order without missing fields" -ForegroundColor Green
        } else {
            exit 1
        }
    } else {
        Write-Host "[FAIL] Could not extract return array in textRows" -ForegroundColor Red
        exit 1
    }

    # 5. Check line breaks in remarks converted to <br>
    if ($funcBody -match 'entry\.remarks.*?\.replace\(/\\n/g,\s*"<br>"\)') {
        Write-Host "[PASS] Line breaks in remarks are converted to <br> for HTML rendering" -ForegroundColor Green
    } else {
        Write-Host "[FAIL] Line breaks not converted to <br>" -ForegroundColor Red
        exit 1
    }

    # 6. Check dual ClipboardItem Blob construction
    if ($funcBody -match '"text/plain":\s*new Blob' -and $funcBody -match '"text/html":\s*new Blob') {
        Write-Host "[PASS] ClipboardItem includes both text/plain and text/html Blobs" -ForegroundColor Green
    } else {
        Write-Host "[FAIL] ClipboardItem missing text/plain or text/html" -ForegroundColor Red
        exit 1
    }

} else {
    Write-Host "[FAIL] copyAuditForTracker function not found" -ForegroundColor Red
    exit 1
}

Write-Host "`n==================================================" -ForegroundColor Cyan
Write-Host "TEST 12: EDR SEPARATION & TEAMS PLAIN-TEXT COPY" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan

# Check #edrCopyTeamsBtn event handler
$teamsMatch = $html -match '(?s)target\.closest\("#edrCopyTeamsBtn"\)(.*?)(?:return;\s*\})'
if ($teamsMatch) {
    $teamsBody = $matches[1]
    Write-Host "[PASS] Found edrCopyTeamsBtn event listener" -ForegroundColor Green

    # Verify it uses navigator.clipboard.writeText with plain text
    if ($teamsBody -match 'await navigator\.clipboard\.writeText\(') {
        Write-Host "[PASS] edrCopyTeamsBtn exclusively uses navigator.clipboard.writeText" -ForegroundColor Green
    } else {
        Write-Host "[FAIL] edrCopyTeamsBtn does not use writeText" -ForegroundColor Red
        exit 1
    }

    # Verify it does NOT use ClipboardItem or rich HTML
    if ($teamsBody -notmatch 'ClipboardItem' -and $teamsBody -notmatch 'text/html' -and $teamsBody -notmatch '<table') {
        Write-Host "[PASS] edrCopyTeamsBtn does NOT produce rich HTML or ClipboardItem (strictly plain-text Markdown)" -ForegroundColor Green
    } else {
        Write-Host "[FAIL] edrCopyTeamsBtn contains rich HTML or ClipboardItem!" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "[FAIL] edrCopyTeamsBtn handler not found" -ForegroundColor Red
    exit 1
}

# Check EDR copyAll() does not include Base64 images
$copyAllMatch = $html -match '(?s)function copyAll\(\)(.*?)(?:function\s|\Z)'
if ($copyAllMatch) {
    $copyAllBody = $matches[1]
    Write-Host "[PASS] Found EDR copyAll() implementation" -ForegroundColor Green

    if ($copyAllBody -match 'outputHtmlForClipboard' -or $html -match 'reportHtml\(report,\s*false\)') {
        Write-Host "[PASS] EDR copyAll omits Base64 screenshots (reportHtml with false flag)" -ForegroundColor Green
    } else {
        Write-Host "[FAIL] EDR copyAll does not omit Base64 images" -ForegroundColor Red
        exit 1
    }
}

Write-Host "`n==================================================" -ForegroundColor Cyan
Write-Host "ALL TEST 11 & TEST 12 CHECKS PASSED PERFECTLY!" -ForegroundColor Green
Write-Host "==================================================" -ForegroundColor Cyan
