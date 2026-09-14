$files = Get-ChildItem -Path "c:\Users\Mnavares\Documents\CCTV OPS\audit-report\cctv-ops-v2" -Recurse -Include *.html,*.js

foreach ($f in $files) {
    $content = Get-Content -Path $f.FullName -Raw -Encoding utf8
    $regex = [regex]'<path[^>]*\sd=["'']([^"'']*)["'']'
    $matches = $regex.Matches($content)
    foreach ($m in $matches) {
        $d = $m.Groups[1].Value
        # An SVG path d attribute should only contain valid path commands: M, m, L, l, H, h, V, v, C, c, S, s, Q, q, T, t, A, a, Z, z, numbers, whitespace, commas, periods, minus signs
        # If it has anything else, or if commands are malformed like "d=...", flag it
        if ($d -match '[^0-9\s,.\-MmLlHhVvCcSsQqTtAaZz]' -or $d -match '[A-Za-z]{2,}' -or $d -eq "") {
            Write-Host "$($f.Name): Malformed SVG path -> $d" -ForegroundColor Red
        }
        # Check if expected number after command (e.g., M followed by non-number)
        if ($d -match '[MmLlHhVvCcSsQqTtAa]\s*[,]?\s*[A-Za-z]') {
            Write-Host "$($f.Name): Missing number after command -> $d" -ForegroundColor Yellow
        }
    }
}
Write-Host "SVG scan complete." -ForegroundColor Green
