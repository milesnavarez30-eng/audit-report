$files = Get-ChildItem -Path "c:\Users\Mnavares\Documents\CCTV OPS\audit-report\cctv-ops-v2\js" -Recurse -Include *.js

foreach ($f in $files) {
    $lines = Get-Content -Path $f.FullName
    for ($i = 0; $i -lt $lines.Length; $i++) {
        $line = $lines[$i]
        if ($line -match '<path\b[^>]*>') {
            Write-Host "$($f.Name):$($i+1) -> $line"
        }
    }
}
