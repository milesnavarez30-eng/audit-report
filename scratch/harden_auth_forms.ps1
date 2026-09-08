$path = "c:\Users\Mnavares\Documents\CCTV OPS\audit-report\index.html"
$content = [System.IO.File]::ReadAllText($path, [System.Text.Encoding]::UTF8)

$oldTarget = '<form id="authSignInForm" class="auth-form glitch-card" hidden>'
$newTarget = '<form id="authSignInForm" class="auth-form glitch-card" onsubmit="event.preventDefault(); return false;" hidden>'

if ($content.Contains($oldTarget)) {
    $content = $content.Replace($oldTarget, $newTarget)
    Write-Host "Updated authSignInForm"
} else {
    Write-Host "authSignInForm already updated or not found"
}

$oldTarget2 = '<form id="authSignUpForm" class="auth-form" hidden>'
$newTarget2 = '<form id="authSignUpForm" class="auth-form" onsubmit="event.preventDefault(); return false;" hidden>'

if ($content.Contains($oldTarget2)) {
    $content = $content.Replace($oldTarget2, $newTarget2)
    Write-Host "Updated authSignUpForm"
} else {
    Write-Host "authSignUpForm already updated or not found"
}

$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($path, $content, $utf8NoBom)
Write-Host "Saved index.html cleanly."
