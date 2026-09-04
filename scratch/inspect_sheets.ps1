$text = Get-Content "scratch/api_test.json" -Raw
$json = ConvertFrom-Json $text

foreach ($key in $json.sheets.PSObject.Properties.Name) {
    $sheet = $json.sheets.$key
    Write-Host "`n=== Sheet Key: $key ==="
    if ($sheet.rows -and $sheet.rows.Count -gt 0) {
        Write-Host "Row count: $($sheet.rows.Count)"
        Write-Host "Headers: $($sheet.rows[0].PSObject.Properties.Name -join ', ')"
        Write-Host "First row sample:"
        $sheet.rows[0] | ConvertTo-Json -Compress
    } else {
        Write-Host "No rows or empty"
    }
}
