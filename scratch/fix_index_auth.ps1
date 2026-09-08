$path = "c:\Users\Mnavares\Documents\CCTV OPS\audit-report\index.html"
$utf8 = New-Object System.Text.UTF8Encoding($false)
$lines = [System.IO.File]::ReadAllLines($path, $utf8)

$startIndex = -1
$endIndex = -1

for ($i = 0; $i -lt $lines.Length; $i++) {
    if ($lines[$i] -match 'const handleUnifiedLoginSubmit =') {
        $startIndex = $i
    }
    if ($startIndex -ge 0 -and $lines[$i] -match '\$\("authSignUpForm"\)\?\.addEventListener') {
        $endIndex = $i
        break
    }
}

if ($startIndex -lt 0 -or $endIndex -lt 0) {
    throw "Could not locate handleUnifiedLoginSubmit block"
}

Write-Host "Found block from line $($startIndex+1) to $($endIndex+1)"

$replacementLines = @(
    '    const handleUnifiedLoginSubmit = async e => {',
    '        if (e) {',
    '            e.preventDefault();',
    '            if (typeof e.stopPropagation === "function") e.stopPropagation();',
    '        }',
    '        message("");',
    '        const btn = $("loginBtn") || $("authSignInBtn");',
    '        busy(btn, true, "CONNECTING...");',
    '        try {',
    '            const usernameInput = ',
    '                $("username") || ',
    '                $("operatorId") || ',
    '                $("loginUser") || ',
    '                $("email") || ',
    '                $("authSignInUsername") ||',
    '                document.querySelector(''input[name="username"]'') ||',
    '                document.querySelector(''input[name="operatorId"]'') ||',
    '                document.querySelector(''input[name="email"]'');',
    '',
    '            const passwordInput = ',
    '                $("password") || ',
    '                $("securityPasscode") || ',
    '                $("loginPass") || ',
    '                $("authSignInPassword") ||',
    '                document.querySelector(''input[name="password"]'') ||',
    '                document.querySelector(''input[name="access_key"]'') ||',
    '                document.querySelector(''input[name="securityPasscode"]'');',
    '',
    '            const loginValue = clean(usernameInput ? usernameInput.value : "");',
    '            if (!loginValue) throw new Error("Enter your username or access key.");',
    '            if (!loginValue.includes("@") && !validUsername(loginValue)) {',
    '                throw new Error("Enter a valid username or access key.");',
    '            }',
    '',
    '            const passwordValue = passwordInput ? passwordInput.value : "";',
    '            await performLogin(loginValue, passwordValue);',
    '        } catch (err) {',
    '            message(err.message === "Invalid login credentials" ? "Incorrect username or access key." : err.message);',
    '        } finally {',
    '            busy(btn, false);',
    '        }',
    '        return false;',
    '    };',
    '',
    '    initPasswordToggles();',
    '',
    '    $("authSignInTab")?.addEventListener("click", () => showForm("signin"));',
    '    $("authSignUpTab")?.addEventListener("click", () => showForm("signup"));',
    '',
    '    $("loginForm")?.addEventListener("submit", handleUnifiedLoginSubmit);',
    '    $("authSignInForm")?.addEventListener("submit", handleUnifiedLoginSubmit);',
    ''
)

$newLines = New-Object System.Collections.Generic.List[string]
for ($i = 0; $i -lt $startIndex; $i++) {
    $newLines.Add($lines[$i])
}
foreach ($rl in $replacementLines) {
    $newLines.Add($rl)
}
for ($i = $endIndex; $i -lt $lines.Length; $i++) {
    $newLines.Add($lines[$i])
}

[System.IO.File]::WriteAllLines($path, $newLines.ToArray(), $utf8)
Write-Host "[SUCCESS] handleUnifiedLoginSubmit block cleanly updated in index.html"
