$edge = 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
$url = "http://localhost:8080/scratch/test_ai_sorter_persistence.html"

$out = & cmd /c "`"$edge`" --headless=new --disable-gpu --virtual-time-budget=18000 --dump-dom $url"

$m = [regex]::Match($out, '<div id="log">(.*?)</div>', [System.Text.RegularExpressions.RegexOptions]::Singleline)
if ($m.Success) {
    $lines = ($m.Groups[1].Value -replace '</div>', "`n") -replace '<[^>]+>', ''
    Write-Host $lines
} else {
    Write-Host "Log element not found."
    Write-Host $out.Substring([Math]::Max(0, $out.Length - 1000))
}
