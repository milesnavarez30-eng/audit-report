$lines = Get-Content 'index.html'
for ($i = 0; $i -lt $lines.Length; $i++) {
    if ($lines[$i] -match 'masterlist|masterPending|masterHr') {
        if ($i -gt 13000) {
            Write-Host "$($i + 1): $($lines[$i].Trim())"
        }
    }
}
