$html = Get-Content -Raw "index.html"
$css = Get-Content -Raw "style.css"
$edgeFn = Get-Content -Raw "supabase/functions/delete-cctv-user/index.ts"
$sql = Get-Content -Raw "supabase_delete_user.sql"

Write-Host "=== TEST SUITE: Accounts Card UI & Real Supabase Delete ===" -ForegroundColor Cyan

$tests = @(
    # 1. User Accounts Card-Style UI
    @{ Name = "adminUsersBody is admin-users-grid (table replaced)"; Condition = $html.Contains('id="adminUsersBody" class="admin-users-grid"') },
    @{ Name = "Old auth-admin-table-wrap removed from users section"; Condition = -not ($html -match 'User Accounts</h3>.*<table class="auth-admin-table">') },
    @{ Name = "Card markup generated in renderUsers()"; Condition = $html.Contains('class="admin-user-card"') -and $html.Contains('class="admin-user-avatar"') },
    @{ Name = "Card displays Display Name"; Condition = $html.Contains('class="admin-user-name"') },
    @{ Name = "Card displays @username"; Condition = $html.Contains('class="admin-user-username"') },
    @{ Name = "Card displays Status pill"; Condition = $html.Contains('statusPill(item.status)') },
    @{ Name = "Card displays Role badge"; Condition = $html.Contains('class="admin-badge badge-') },
    @{ Name = "Card displays Permissions"; Condition = $html.Contains('permsText') },
    @{ Name = "Card displays Created date"; Condition = $html.Contains('item.created_at') },
    @{ Name = "Card displays Last Active date"; Condition = $html.Contains('item.last_seen_at') },
    @{ Name = "Card has Access button"; Condition = $html.Contains('auth-access-btn') },
    @{ Name = "Card has Disable button"; Condition = $html.Contains('auth-disable-btn') },
    @{ Name = "Card has Reactivate button"; Condition = $html.Contains('auth-reactivate-btn') },
    @{ Name = "Card has Delete button"; Condition = $html.Contains('auth-remove-user-btn') },
    @{ Name = "Self account protected with 'You' label"; Condition = $html.Contains('auth-self-label') },

    # 2. Password Display Rule
    @{ Name = "Checks getRecentCredentials() for active session password"; Condition = $html.Contains('getRecentCredentials()') -and $html.Contains('recentCred.password') },
    @{ Name = "Active session temporary password masked with Show/Hide toggle"; Condition = $html.Contains('user-card-toggle-pw-btn') },
    @{ Name = "Active session temporary password has Copy button"; Condition = $html.Contains('user-card-copy-pw-btn') },
    @{ Name = "Older accounts show 'Password: Not available'"; Condition = $html.Contains('Password: Not available') },

    # 3. Real Supabase Delete & Edge Function
    @{ Name = "Edge function delete-cctv-user file exists"; Condition = Test-Path "supabase/functions/delete-cctv-user/index.ts" },
    @{ Name = "Edge function validates caller JWT Bearer"; Condition = $edgeFn.Contains('req.headers.get("Authorization")') -and $edgeFn.Contains('auth.getUser()') },
    @{ Name = "Edge function verifies caller profile role=admin and status=approved"; Condition = $edgeFn.Contains("role !== `"admin`"") -and $edgeFn.Contains("status !== `"approved`"") },
    @{ Name = "Edge function blocks self-deletion"; Condition = $edgeFn.Contains('targetUserId === callerUser.id') },
    @{ Name = "Edge function deletes from Supabase auth.users"; Condition = $edgeFn.Contains('adminClient.auth.admin.deleteUser(targetUserId)') },
    @{ Name = "Edge function explicitly deletes from public.profiles"; Condition = $edgeFn -match '\.from\("profiles"\)\s*\.delete\(\)\s*\.eq\("id",\s*targetUserId\)' },
    @{ Name = "Edge function returns CORS headers"; Condition = $edgeFn.Contains('corsHeaders') },

    # 4. Frontend Delete Confirmation & Handling
    @{ Name = "deleteStaffAccountPermanently function defined"; Condition = $html.Contains('async function deleteStaffAccountPermanently(id)') },
    @{ Name = "Custom confirmation title: Delete Account Permanently"; Condition = $html.Contains('title: "Delete Account Permanently"') },
    @{ Name = "Custom confirmation message formatted"; Condition = $html.Contains('This account will be removed from CCTV OPS and will no longer be able to sign in.') },
    @{ Name = "Deletes card from DOM immediately"; Condition = $html.Contains('card.remove()') },
    @{ Name = "Logs account_deleted to security audit log"; Condition = $html.Contains('"account_deleted"') },
    @{ Name = "Refreshes accounts via loadAdmin()"; Condition = $html.Contains('await loadAdmin()') },

    # 5. Disable / Reactivate Flow
    @{ Name = "setStatus updates status in database"; Condition = $html.Contains('admin_set_user_status') },
    @{ Name = "setStatus direct profiles fallback update"; Condition = $html.Contains('.from("profiles").update({ status })') },
    @{ Name = "Disabled accounts rejected in applySession"; Condition = $html.Contains('lockDisabled(u)') },

    # 6. CSS Card Styles & Theme Support
    @{ Name = "CSS .admin-users-grid defined"; Condition = $css.Contains('.admin-users-grid') },
    @{ Name = "CSS .admin-user-card defined"; Condition = $css.Contains('.admin-user-card') },
    @{ Name = "CSS .admin-user-avatar defined"; Condition = $css.Contains('.admin-user-avatar') },
    @{ Name = "CSS .auth-delete-danger defined"; Condition = $css.Contains('.auth-delete-danger') },

    # 7. SQL Migration Companion
    @{ Name = "SQL migration file exists"; Condition = Test-Path "supabase_delete_user.sql" },
    @{ Name = "SQL migration preserves audit logs with ON DELETE SET NULL"; Condition = $sql.Contains('ON DELETE SET NULL') },
    @{ Name = "SQL migration includes admin_delete_cctv_user RPC"; Condition = $sql.Contains('CREATE OR REPLACE FUNCTION public.admin_delete_cctv_user') }
)

$passedCount = 0
$failedCount = 0

foreach ($t in $tests) {
    if ($t.Condition) {
        Write-Host " [PASS] $($t.Name)" -ForegroundColor Green
        $passedCount++
    } else {
        Write-Host " [FAIL] $($t.Name)" -ForegroundColor Red
        $failedCount++
    }
}

$color = if ($failedCount -eq 0) { "Green" } else { "Red" }
Write-Host "`nSummary: $passedCount Passed, $failedCount Failed" -ForegroundColor $color

if ($failedCount -eq 0) {
    Write-Host ">>> ALL TESTS PASSED! <<<" -ForegroundColor Cyan
} else {
    Write-Host ">>> SOME TESTS FAILED! <<<" -ForegroundColor Red
    exit 1
}
