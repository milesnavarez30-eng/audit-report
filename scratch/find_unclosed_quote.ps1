$lines = Get-Content 'scratch/verify_all_masterlist_features.ps1'
$inDouble = $false
$inSingle = $false

for ($i = 0; $i -lt $lines.Count; $i++) {
    $line = $lines[$i]
    $dCount = ($line.ToCharArray() | Where-Object { $_ -eq '"' }).Count
    if ($dCount % 2 -ne 0) {
        Write-Host "Line $($i + 1) has odd double quotes ($dCount): $line"
    }
    $sCount = ($line.ToCharArray() | Where-Object { $_ -eq "'" }).Count
    if ($sCount % 2 -ne 0) {
        Write-Host "Line $($i + 1) has odd single quotes ($sCount): $line"
    }
}
