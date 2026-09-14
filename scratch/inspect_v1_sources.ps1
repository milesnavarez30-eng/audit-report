$lines = Get-Content -Path 'c:\Users\Mnavares\Documents\CCTV OPS\audit-report\index.html'
$tl = $lines[26551] # 0-indexed line 26552
$om = $lines[26552] # 0-indexed line 26553
$acc = $lines[26553] # 0-indexed line 26554

Write-Output "TL: $($tl.Substring(0, 50))... length $($tl.Length)"
Write-Output "OM: $om"
Write-Output "ACC: $($acc.Substring(0, 50))... length $($acc.Length)"
