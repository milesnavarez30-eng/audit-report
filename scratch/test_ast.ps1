$errs = $null
$tokens = $null
[System.Management.Automation.Language.Parser]::ParseFile((Resolve-Path 'scratch/verify_all_masterlist_features.ps1'), [ref]$tokens, [ref]$errs)
foreach ($e in $errs) {
    Write-Host "Error at line $($e.Extent.StartLineNumber) col $($e.Extent.StartColumnNumber): $($e.Message)"
}
