$text = Get-Content "scratch/api_test.json" -Raw
$json = ConvertFrom-Json $text
Write-Host "spreadsheetId: $($json.spreadsheetId)"
Write-Host "version: $($json.version)"
Write-Host "updatedAt: $($json.updatedAt)"
Write-Host "Sheets keys: $($json.sheets.PSObject.Properties.Name -join ', ')"

foreach ($k in $json.sheets.PSObject.Properties.Name) {
    Write-Host "Sheet '$k' row count: $($json.sheets.$k.rows.Count)"
}
