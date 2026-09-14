$edge = 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
$url = "http://localhost:8080/scratch/test_sorter_persistence_unit.html"

$out = & cmd /c "`"$edge`" --headless=new --disable-gpu --virtual-time-budget=16000 --dump-dom $url"

$m = [regex]::Match($out, '<div id="log">([\s\S]*?)</div>\s*<script>')
if ($m.Success) {
    $lines = ($m.Groups[1].Value -replace '</div>', "`n") -replace '<[^>]+>', ''
    Write-Host $lines
} else {
    Write-Host "Log element not found."
}

$statusMatch = [regex]::Match($out, '<div id="status"[^>]*>(.*?)</div>')
if ($statusMatch.Success) {
    Write-Host "`nStatus: $($statusMatch.Groups[1].Value)" -ForegroundColor Cyan
}
