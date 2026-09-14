$edge = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
if (-not (Test-Path $edge)) {
    $edge = "C:\Program Files\Microsoft\Edge\Application\msedge.exe"
}

$testHtml = "c:\Users\Mnavares\Documents\CCTV OPS\audit-report\scratch\test_responsive_ux.html"
$dumpOut = "c:\Users\Mnavares\Documents\CCTV OPS\audit-report\scratch\responsive_test_out.html"
if (Test-Path $dumpOut) { Remove-Item -Force $dumpOut }

Write-Host "Running headless Edge test on test_responsive_ux.html..."
$argList = @(
    "--headless=new",
    "--disable-gpu",
    "--dump-dom",
    "file:///$($testHtml.Replace('\', '/'))"
)

$dom = & $edge $argList
$dom | Out-File -FilePath $dumpOut -Encoding utf8

if ($dom -match '<pre id="testOutput">([\s\S]*?)</pre>') {
    $json = $matches[1]
    Write-Host "=== TEST RESULTS ===" -ForegroundColor Cyan
    Write-Host $json
    if ($json -match '"pass": false') {
        Write-Host "SOME TESTS FAILED!" -ForegroundColor Red
        exit 1
    } else {
        Write-Host "ALL RESPONSIVE & UX VERIFICATION TESTS PASSED!" -ForegroundColor Green
    }
} else {
    Write-Host "Warning: Could not extract test output pre tag from DOM. First 200 chars:"
    Write-Host ($dom | Select-Object -First 10)
}
