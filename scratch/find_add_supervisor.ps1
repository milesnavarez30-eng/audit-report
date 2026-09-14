$file = 'c:\Users\Mnavares\Documents\CCTV OPS\audit-report\index.html'
$lines = Get-Content -Path $file -Encoding UTF8
for ($i = 0; $i -lt $lines.Length; $i++) {
    if ($lines[$i] -like '*edrAddSupervisorOption*') {
        Write-Output "Line $($i+1): $($lines[$i])"
        for ($j = [Math]::Max(0, $i - 10); $j -le [Math]::Min($lines.Length - 1, $i + 40); $j++) {
            Write-Output "$($j+1): $($lines[$j])"
        }
    }
}
