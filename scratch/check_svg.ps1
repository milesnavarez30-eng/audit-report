$files = Get-ChildItem -Path "c:\Users\Mnavares\Documents\CCTV OPS\audit-report\cctv-ops-v2" -Recurse -Include *.html,*.js

foreach ($f in $files) {
    $content = Get-Content $f.FullName -Raw
    $matches = [regex]::Matches($content, '<path[^>]*d=["'']([^"'']+)["'']')
    foreach ($m in $matches) {
        $d = $m.Groups[1].Value
        Write-Output "[$($f.Name)] $d"
    }
}
