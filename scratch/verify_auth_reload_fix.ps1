# Automated Verification Script for Authentication GET Submission Fix
# Verifies Objectives 1, 2, and 3

$ErrorActionPreference = "Stop"
$failures = @()

Write-Host "====================================================" -ForegroundColor Cyan
Write-Host " Running Authentication GET Submission Fix Verification" -ForegroundColor Cyan
Write-Host "====================================================" -ForegroundColor Cyan

# 1. Inspect index.html
$indexPath = "c:\Users\Mnavares\Documents\CCTV OPS\audit-report\index.html"
$indexContent = [System.IO.File]::ReadAllText($indexPath, [System.Text.Encoding]::UTF8)

# Objective 1: Check onsubmit on loginForm
if ($indexContent -match '<form class="terminal-card" id="loginForm" onsubmit="event\.preventDefault\(\);\s*return false;"') {
    Write-Host "[PASS] loginForm has inline onsubmit='event.preventDefault(); return false;'" -ForegroundColor Green
} else {
    $failures += "loginForm does not have required onsubmit attribute in index.html"
    Write-Host "[FAIL] loginForm missing onsubmit in index.html" -ForegroundColor Red
}

# Check autocomplete on username & password
if ($indexContent -match 'id="username"[^>]*autocomplete="username"') {
    Write-Host "[PASS] username field has autocomplete='username'" -ForegroundColor Green
} else {
    $failures += "username field missing autocomplete='username'"
    Write-Host "[FAIL] username field missing autocomplete in index.html" -ForegroundColor Red
}

if ($indexContent -match 'id="password"[^>]*autocomplete="current-password"') {
    Write-Host "[PASS] password field has autocomplete='current-password'" -ForegroundColor Green
} else {
    $failures += "password field missing autocomplete='current-password'"
    Write-Host "[FAIL] password field missing autocomplete in index.html" -ForegroundColor Red
}

# Check window.cctvAuthenticate in index.html
if ($indexContent -match 'window\.cctvAuthenticate\s*=\s*performLogin;') {
    Write-Host "[PASS] window.cctvAuthenticate is bound in index.html" -ForegroundColor Green
} else {
    $failures += "window.cctvAuthenticate not found in index.html"
    Write-Host "[FAIL] window.cctvAuthenticate missing in index.html" -ForegroundColor Red
}

# 2. Inspect script.js
$scriptPath = "c:\Users\Mnavares\Documents\CCTV OPS\audit-report\script.js"
$scriptContent = [System.IO.File]::ReadAllText($scriptPath, [System.Text.Encoding]::UTF8)

# Objective 2: Support modern and legacy input IDs
$requiredIds = @("username", "operatorId", "loginUser", "email", "password", "securityPasscode", "loginPass")
foreach ($id in $requiredIds) {
    if ($scriptContent -match "`"$id`"") {
        Write-Host "[PASS] script.js supports ID: $id" -ForegroundColor Green
    } else {
        $failures += "script.js does not support ID: $id"
        Write-Host "[FAIL] script.js missing ID: $id" -ForegroundColor Red
    }
}

# Check event.preventDefault in script.js handler
if ($scriptContent -match 'event\.preventDefault\(\)') {
    Write-Host "[PASS] script.js calls event.preventDefault()" -ForegroundColor Green
} else {
    $failures += "script.js missing event.preventDefault()"
    Write-Host "[FAIL] script.js missing event.preventDefault()" -ForegroundColor Red
}

# Check onsubmit programmatic setting on form
if ($scriptContent -match 'form\.setAttribute\("onsubmit",\s*"event\.preventDefault\(\);\s*return false;"\)') {
    Write-Host "[PASS] script.js sets form onsubmit attribute dynamically" -ForegroundColor Green
} else {
    $failures += "script.js missing form.setAttribute('onsubmit', ...)"
    Write-Host "[FAIL] script.js missing dynamic onsubmit hardening" -ForegroundColor Red
}

# Objective 3: Ensure hideLoginModal cleanly hides #loginModal and reveals workspace
if ($scriptContent -match 'loginModal\.hidden\s*=\s*true' -and
    $scriptContent -match 'loginModal\.style\.display\s*=\s*"none"' -and
    $scriptContent -match 'loginModal\.classList\.add\("hidden"\)' -and
    $scriptContent -match 'document\.body\.classList\.remove\("auth-locked"\)' -and
    $scriptContent -match 'document\.body\.classList\.add\("auth-unlocked"\)') {
    Write-Host "[PASS] hideLoginModal() cleanly hides modal and unlocks body" -ForegroundColor Green
} else {
    $failures += "hideLoginModal does not perform all cleanup actions"
    Write-Host "[FAIL] hideLoginModal missing clean hide operations" -ForegroundColor Red
}

# 3. Check bracket balance in script.js
$curly = 0; $paren = 0; $square = 0
for ($i = 0; $i -lt $scriptContent.Length; $i++) {
    $c = $scriptContent[$i]
    if ($c -eq '{') { $curly++ }
    elseif ($c -eq '}') { $curly-- }
    elseif ($c -eq '(') { $paren++ }
    elseif ($c -eq ')') { $paren-- }
    elseif ($c -eq '[') { $square++ }
    elseif ($c -eq ']') { $square-- }
    if ($curly -lt 0 -or $paren -lt 0 -or $square -lt 0) {
        $failures += "script.js bracket underflow at index ${i}, char '$c'"
        break
    }
}
if ($curly -eq 0 -and $paren -eq 0 -and $square -eq 0) {
    Write-Host "[PASS] script.js brackets are perfectly balanced (Curly=0, Paren=0, Square=0)" -ForegroundColor Green
} else {
    $failures += "script.js bracket mismatch: Curly=$curly, Paren=$paren, Square=$square"
    Write-Host "[FAIL] script.js bracket mismatch: Curly=$curly, Paren=$paren, Square=$square" -ForegroundColor Red
}

# 4. Check UTF-8 BOM absence
$indexBytes = [System.IO.File]::ReadAllBytes($indexPath)
$hasBomIndex = ($indexBytes.Length -ge 3 -and $indexBytes[0] -eq 0xEF -and $indexBytes[1] -eq 0xBB -and $indexBytes[2] -eq 0xBF)
if (-not $hasBomIndex) {
    Write-Host "[PASS] index.html is UTF-8 without BOM" -ForegroundColor Green
} else {
    $failures += "index.html has UTF-8 BOM"
    Write-Host "[FAIL] index.html has UTF-8 BOM" -ForegroundColor Red
}

$scriptBytes = [System.IO.File]::ReadAllBytes($scriptPath)
$hasBomScript = ($scriptBytes.Length -ge 3 -and $scriptBytes[0] -eq 0xEF -and $scriptBytes[1] -eq 0xBB -and $scriptBytes[2] -eq 0xBF)
if (-not $hasBomScript) {
    Write-Host "[PASS] script.js is UTF-8 without BOM" -ForegroundColor Green
} else {
    $failures += "script.js has UTF-8 BOM"
    Write-Host "[FAIL] script.js has UTF-8 BOM" -ForegroundColor Red
}

Write-Host "----------------------------------------------------" -ForegroundColor Cyan
if ($failures.Count -eq 0) {
    Write-Host "ALL VERIFICATION TESTS PASSED SUCCESSFULLY! (0 failures)" -ForegroundColor Green
    exit 0
} else {
    Write-Host "VERIFICATION FAILED with $($failures.Count) error(s):" -ForegroundColor Red
    foreach ($f in $failures) {
        Write-Host "  - $f" -ForegroundColor Red
    }
    exit 1
}
