$file = 'c:\Users\Mnavares\Documents\CCTV OPS\audit-report\index.html'
$matches = Select-String -Path $file -Pattern 'id="edr'
Write-Output "Total matches for id='edr': $($matches.Count)"
$matches | Select-Object -First 30 | ForEach-Object {
    "$($_.LineNumber): $($_.Line.Trim())"
}
