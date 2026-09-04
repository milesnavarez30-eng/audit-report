$html = Get-Content -Raw "index.html"
$startIndex = $html.IndexOf('<script id="masterlistSimpleScript">')
if ($startIndex -lt 0) {
    Write-Error "masterlistSimpleScript not found"
    exit 1
}

$endIndex = $html.IndexOf('</script>', $startIndex)
$script = $html.Substring($startIndex, $endIndex - $startIndex)

# Check balanced brackets
$curly = 0
$paren = 0
$square = 0

for ($i = 0; $i -lt $script.Length; $i++) {
    $c = $script[$i]
    if ($c -eq '{') { $curly++ }
    elseif ($c -eq '}') { $curly-- }
    elseif ($c -eq '(') { $paren++ }
    elseif ($c -eq ')') { $paren-- }
    elseif ($c -eq '[') { $square++ }
    elseif ($c -eq ']') { $square-- }

    if ($curly -lt 0 -or $paren -lt 0 -or $square -lt 0) {
        Write-Host "Unbalanced at index $i (Char: $c): Curly=$curly, Paren=$paren, Square=$square"
        exit 1
    }
}

Write-Host "Master List Script Bracket Count: Curly=$curly, Paren=$paren, Square=$square"
if ($curly -eq 0 -and $paren -eq 0 -and $square -eq 0) {
    Write-Host "JS Syntax & Brackets: PERFECTLY BALANCED!"
} else {
    Write-Host "JS Bracket mismatch: Curly=$curly, Paren=$paren, Square=$square"
    exit 1
}
