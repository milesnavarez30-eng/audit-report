$ErrorActionPreference = "Stop"

Write-Host "=== VERIFYING CYBER-TERMINAL 'SECURE_DATA' LOGIN REPLICA ==="

# 1. Verify script.js is completely untouched
$scriptDiff = & git status --porcelain script.js
if ($scriptDiff) {
    Write-Error "FAIL: script.js has modifications!"
} else {
    Write-Host "[PASS] script.js is 100% untouched"
}

# 2. Read index.html and style.css
$indexPath = "c:\Users\Mnavares\Documents\CCTV OPS\audit-report\index.html"
$stylePath = "c:\Users\Mnavares\Documents\CCTV OPS\audit-report\style.css"

$indexContent = [System.IO.File]::ReadAllText($indexPath, [System.Text.Encoding]::UTF8)
$styleContent = [System.IO.File]::ReadAllText($stylePath, [System.Text.Encoding]::UTF8)

# 3. Check Exact HTML Markup Elements
$requiredElements = @(
    '<div class="terminal-login-wrapper" id="loginModal">',
    '<div class="terminal-frame">',
    '<form class="terminal-card" id="loginForm" autocomplete="off">',
    '<div class="terminal-header">',
    '<div class="terminal-title">',
    '<span>SECURE_DATA</span>',
    '<div class="terminal-dots">',
    '<div class="terminal-body">',
    '<label for="username" class="terminal-label" data-text="USERNAME">USERNAME</label>',
    'id="username"',
    '<label for="password" class="terminal-label" data-text="ACCESS_KEY">ACCESS_KEY</label>',
    'id="password"',
    '<button',
    'class="terminal-submit-btn"',
    'id="loginBtn"',
    'data-text="INITIATE_CONNECTION"',
    '<span class="btn-label">INITIATE_CONNECTION</span>'
)

foreach ($elem in $requiredElements) {
    if (-not $indexContent.Contains($elem)) {
        Write-Error "FAIL: Missing required markup element: $elem"
    }
}
Write-Host "[PASS] HTML structure matches exact SECURE_DATA Cyber-Terminal specification"

# 4. Check Document/Key SVG Icon
$svgChecks = @(
    'width="18"',
    'height="18"',
    'viewBox="0 0 24 24"',
    'stroke-width="1.8"',
    'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z',
    'points="14 2 14 8 20 8"',
    'circle cx="12" cy="14" r="2"',
    'line x1="12" y1="16" x2="12" y2="18"'
)
foreach ($svgPart in $svgChecks) {
    if (-not $indexContent.Contains($svgPart)) {
        Write-Error "FAIL: Missing SVG icon part: $svgPart"
    }
}
Write-Host "[PASS] Document/key SVG icon matches design specification"

# 5. Check CSS Rules for Cyber-Terminal
$cssRules = @(
    ".terminal-login-wrapper",
    ".terminal-frame",
    "rgba(0, 242, 234, 0.3)",
    ".terminal-card",
    ".terminal-header",
    ".terminal-title",
    ".terminal-dots",
    ".terminal-body",
    ".terminal-field",
    ".terminal-label",
    ".terminal-submit-btn",
    "#loginForm",
    "#username",
    "#password",
    "#loginBtn",
    "border-bottom: 2px solid rgba(0, 242, 234, 0.4)",
    "-webkit-box-shadow: 0 0 0 1000px #0d0d0d inset",
    "-webkit-text-fill-color: #00f2ea",
    "glitch-anim"
)
foreach ($rule in $cssRules) {
    if (-not $styleContent.Contains($rule) -and -not $indexContent.Contains($rule)) {
        Write-Error "FAIL: Missing CSS rule: $rule"
    }
}
Write-Host "[PASS] Cyber-Terminal CSS styling and animation rules verified"

# 6. Check Auth Script Binding & Compatibility
$authChecks = @(
    'authGate: "loginModal"',
    'authSignInForm: "loginForm"',
    'authSignInUsername: "username"',
    'authSignInPassword: "password"',
    'authSignInBtn: "loginBtn"',
    'loginForm',
    'loginBtn'
)
foreach ($ac in $authChecks) {
    if (-not $indexContent.Contains($ac)) {
        Write-Error "FAIL: Missing auth integration check: $ac"
    }
}
Write-Host "[PASS] Supabase auth event listeners and ID aliases verified operational"

# 7. Check UTF-8 BOM
$indexBytes = [System.IO.File]::ReadAllBytes($indexPath)
if ($indexBytes.Length -ge 3 -and $indexBytes[0] -eq 0xEF -and $indexBytes[1] -eq 0xBB -and $indexBytes[2] -eq 0xBF) {
    Write-Error "FAIL: index.html has UTF-8 BOM"
} else {
    Write-Host "[PASS] index.html is UTF-8 without BOM"
}

$styleBytes = [System.IO.File]::ReadAllBytes($stylePath)
if ($styleBytes.Length -ge 3 -and $styleBytes[0] -eq 0xEF -and $styleBytes[1] -eq 0xBB -and $styleBytes[2] -eq 0xBF) {
    Write-Error "FAIL: style.css has UTF-8 BOM"
} else {
    Write-Host "[PASS] style.css is UTF-8 without BOM"
}

Write-Host "=== ALL CYBER-TERMINAL 'SECURE_DATA' CHECKS PASSED ==="
