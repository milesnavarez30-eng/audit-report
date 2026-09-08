$ErrorActionPreference = "Stop"

Write-Host "--- Verifying Compact Toggle, Glitch Login Autofill Fix, and Screenshot Dropzone ---"

# 1. Verify script.js is completely untouched
$scriptDiff = git diff script.js
if ($scriptDiff -and $scriptDiff.Trim().Length -gt 0) {
    Write-Error "[FAIL] script.js was modified! Expected zero diff."
} else {
    Write-Host "[PASS] script.js is strictly untouched"
}

# 2. Read files
$indexContent = [System.IO.File]::ReadAllText("index.html", [System.Text.Encoding]::UTF8)
$styleContent = [System.IO.File]::ReadAllText("style.css", [System.Text.Encoding]::UTF8)

# 3. Check downscaled toggle dimensions (~35% reduction)
$toggleChecks = @(
    "width: 60px",
    "height: 26px",
    "border: 2.5px solid #000000",
    "width: 26px",
    "height: 32px",
    "font-size: 14px",
    "transform: translate(34px, -50%)"
)
foreach ($check in $toggleChecks) {
    if (-not $indexContent.Contains($check) -or -not $styleContent.Contains($check)) {
        Write-Error "FAIL: Missing downscaled toggle rule '$check'"
    }
}
if ($indexContent -notmatch '<input type="checkbox" id="themeToggle"') {
    Write-Error "FAIL: #themeToggle checkbox missing"
}
Write-Host "[PASS] Compact Neo-Brutalist Theme Toggle (~35% downscaled) verified"

# 4. Check glitch login autofill and floating label isolation
$loginChecks = @(
    "-webkit-box-shadow: 0 0 0 1000px #0d0d0d inset",
    "-webkit-text-fill-color: #00f2ea",
    "top: 14px",
    "top: -12px",
    'data-text="USERNAME OR EMAIL"',
    'data-text="PASSWORD"',
    'for="authSignInUsername"',
    'for="authSignInPassword"'
)
foreach ($check in $loginChecks) {
    if (-not $indexContent.Contains($check) -and -not $styleContent.Contains($check)) {
        Write-Error "FAIL: Missing login fix rule/attribute '$check'"
    }
}
Write-Host "[PASS] Glitch Login Form Autofill & Label Text Collision Fix verified"

# 5. Check Maintenance Compact Screenshot Dropzone
$dropzoneChecks = @(
    "min-height: 48px",
    "max-height: 56px",
    "border: 1px dashed rgba(255, 255, 255, 0.2)",
    "max-height: 38px"
)
foreach ($check in $dropzoneChecks) {
    if (-not $indexContent.Contains($check) -or -not $styleContent.Contains($check)) {
        Write-Error "FAIL: Missing compact dropzone rule '$check'"
    }
}
Write-Host "[PASS] Maintenance Compact Screenshot Dropzone verified"

# 6. Verify BOM check
$bytesIndex = [System.IO.File]::ReadAllBytes("index.html")
if ($bytesIndex.Length -ge 3 -and $bytesIndex[0] -eq 0xEF -and $bytesIndex[1] -eq 0xBB -and $bytesIndex[2] -eq 0xBF) {
    Write-Error "FAIL: index.html contains UTF-8 BOM"
} else {
    Write-Host "[PASS] index.html is UTF-8 without BOM"
}

$bytesStyle = [System.IO.File]::ReadAllBytes("style.css")
if ($bytesStyle.Length -ge 3 -and $bytesStyle[0] -eq 0xEF -and $bytesStyle[1] -eq 0xBB -and $bytesStyle[2] -eq 0xBF) {
    Write-Error "FAIL: style.css contains UTF-8 BOM"
} else {
    Write-Host "[PASS] style.css is UTF-8 without BOM"
}

Write-Host "--- ALL TOGGLE, LOGIN, AND DROPZONE CHECKS PASSED SUCCESSFULLY ---"
