$code = Get-Content -Raw "Maintenance_Google_Sheets_Receiver_V8_14.gs"

$curly = 0
$paren = 0
$square = 0

for ($i = 0; $i -lt $code.Length; $i++) {
    $c = $code[$i]
    if ($c -eq '{') { $curly++ }
    elseif ($c -eq '}') { $curly-- }
    elseif ($c -eq '(') { $paren++ }
    elseif ($c -eq ')') { $paren-- }
    elseif ($c -eq '[') { $square++ }
    elseif ($c -eq ']') { $square-- }

    if ($curly -lt 0) {
        Write-Host "Unbalanced curly at character $i" -ForegroundColor Red
        exit 1
    }
}

$dogetStart = $code.IndexOf("function doGet(")
$dogetEnd = $code.IndexOf("function doPost(", $dogetStart)
$doget = $code.Substring($dogetStart, $dogetEnd - $dogetStart)

$dCurly = 0
for ($i = 0; $i -lt $doget.Length; $i++) {
    $c = $doget[$i]
    if ($c -eq '{') { $dCurly++ }
    elseif ($c -eq '}') { $dCurly-- }
}

Write-Host "doGet Function Curly Balance: $dCurly"
if ($dCurly -eq 0 -and $curly -eq 0) {
    Write-Host "doGet and Entire File Curly Brackets: PERFECTLY BALANCED (0)!" -ForegroundColor Green
} else {
    Write-Host "Mismatch! doGet: $dCurly, File: $curly" -ForegroundColor Red
    exit 1
}
