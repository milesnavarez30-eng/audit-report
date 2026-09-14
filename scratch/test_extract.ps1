$lines = Get-Content -Path 'c:\Users\Mnavares\Documents\CCTV OPS\audit-report\index.html'

function Get-ArrayString($line) {
    $start = $line.IndexOf('[')
    $end = $line.LastIndexOf(']')
    return $line.Substring($start, $end - $start + 1)
}

$tlJson = Get-ArrayString $lines[26551]
$omJson = Get-ArrayString $lines[26552]
$accJson = Get-ArrayString $lines[26553]

Write-Output "TL starts: $($tlJson.Substring(0, 30)) ends: $($tlJson.Substring($tlJson.Length - 30))"
Write-Output "OM starts: $($omJson.Substring(0, 30)) ends: $($omJson.Substring($omJson.Length - 30))"
Write-Output "ACC starts: $($accJson.Substring(0, 30)) ends: $($accJson.Substring($accJson.Length - 30))"
