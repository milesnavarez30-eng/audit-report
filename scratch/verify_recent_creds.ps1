$html = Get-Content -Raw "index.html"
$css = Get-Content -Raw "style.css"

Write-Host "=== TEST SUITE: Admin Create Account Password Visibility + Recent Credentials ==="

$checks = @(
    # A. Temporary Password Field
    @{ Name = "TEMPORARY PASSWORD Label exists"; Condition = $html.Contains('<span>Temporary Password</span>') },
    @{ Name = "TEMPORARY PASSWORD has auth-password-wrap"; Condition = $html -match '<span>Temporary Password</span>\s*<div class="auth-password-wrap">' },
    @{ Name = "TEMPORARY PASSWORD input exists with minlength 6"; Condition = $html.Contains('id="adminCreatePassword"') -and $html.Contains('minlength="6"') },
    @{ Name = "Eye button exists with type='button'"; Condition = $html.Contains('button type="button" class="auth-password-toggle" data-target="adminCreatePassword"') },
    @{ Name = "Eye button has SVG icons (open & closed)"; Condition = $html.Contains('auth-eye-open') -and $html.Contains('auth-eye-closed') },
    @{ Name = "Eye click prevents default & form submission"; Condition = $html.Contains('event.preventDefault();') -and $html.Contains('event.stopPropagation();') },
    @{ Name = "Form has onsubmit='return false;'"; Condition = $html.Contains('id="adminCreateAccountForm"') -and $html.Contains('onsubmit="return false;"') },

    # B. Light & Dark Mode CSS
    @{ Name = "CSS auth-password-toggle uses var(--ops-muted)"; Condition = $css.Contains('color:var(--ops-muted, #94a3b8);') },
    @{ Name = "CSS auth-password-toggle hover uses var(--ops-panel-3) and var(--ops-text)"; Condition = $css.Contains('background:var(--ops-panel-3, rgba(148,163,184,.15));') },
    @{ Name = "CSS dark-mode auth-password-toggle rules"; Condition = $css.Contains('body.dark-mode .auth-password-toggle') },
    @{ Name = "CSS padding-right on input in auth-create-account-grid"; Condition = $css.Contains('.auth-create-account-grid .auth-password-wrap input') },

    # C. Recently Created Credentials Section & Controls
    @{ Name = "Recently Created Credentials section exists"; Condition = $html.Contains('id="adminRecentCredsSection"') },
    @{ Name = "Recently Created Credentials list exists"; Condition = $html.Contains('id="adminRecentCredsList"') },
    @{ Name = "Clear All button exists"; Condition = $html.Contains('id="adminClearAllCredsBtn"') },
    @{ Name = "Copy Username button in card"; Condition = $html.Contains('cred-copy-user-btn') },
    @{ Name = "Copy Password button in card"; Condition = $html.Contains('cred-copy-pw-btn') },
    @{ Name = "Show/Hide Password button in card"; Condition = $html.Contains('cred-toggle-pw-btn') },
    @{ Name = "Copy All Credentials button in card"; Condition = $html.Contains('cred-copy-all-btn') },
    @{ Name = "Remove credential button in card"; Condition = $html.Contains('cred-remove-btn') },

    # D. Copy All Format
    @{ Name = "Copy All format matches Name / Username / Temporary Password / Role"; Condition = 
        $html.Contains('`Name: ${item.name}`') -and 
        $html.Contains('`Username: ${cleanUsername(item.username)}`') -and 
        $html.Contains('`Temporary Password: ${item.password}`') -and 
        $html.Contains('`Role: ${item.role}`')
    },

    # E. Session Scoping & Lifecycle
    @{ Name = "SessionStorage key used"; Condition = $html.Contains('cctv_admin_recent_creds_v1') },
    @{ Name = "Credentials cleared on signedOut()"; Condition = $html.Contains('clearRecentCredentials();') },
    @{ Name = "Credentials added on createStaffAccount()"; Condition = $html.Contains('addRecentCredential({') },
    @{ Name = "Password field reset on createStaffAccount()"; Condition = $html.Contains('pwInput.type = "password";') },
    @{ Name = "User accounts table permanently displays name + @username"; Condition = $html.Contains('usernameLabel(item.username)') }
)

$allPassed = $true
foreach ($chk in $checks) {
    if ($chk.Condition) {
        Write-Host "[PASS] $($chk.Name)" -ForegroundColor Green
    } else {
        Write-Host "[FAIL] $($chk.Name)" -ForegroundColor Red
        $allPassed = $false
    }
}

if ($allPassed) {
    Write-Host "`n>>> ALL 22 TESTS PASSED SUCCESSFULLY! <<<" -ForegroundColor Cyan
} else {
    Write-Host "`n>>> SOME TESTS FAILED! <<<" -ForegroundColor Red
    exit 1
}
