$text = Get-Content "scratch/api_test.json" -Raw
$json = ConvertFrom-Json $text

$names = $json.tracker | Select-Object -ExpandProperty Name -Unique
Write-Host "Unique names in tracker: $($names -join ', ')"

$nocs = $json.tracker | Select-Object -ExpandProperty NOC -Unique
Write-Host "Unique NOCs in tracker: $($nocs -join ', ')"

Write-Host "Tracker rows count: $($json.tracker.Count)"
$milesPending = $json.tracker | Where-Object { $_.Name -match "Miles" -and $_.NOC -match "Pending" }
Write-Host "Miles Pending count: $($milesPending.Count)"
