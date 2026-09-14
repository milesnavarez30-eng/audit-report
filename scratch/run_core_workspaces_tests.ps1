$edge = 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
if (-not (Test-Path $edge)) {
    $edge = 'C:\Program Files\Microsoft\Edge\Application\msedge.exe'
}

Remove-Item -Force .\scratch\test_report.txt -ErrorAction SilentlyContinue

& $edge --headless=new --disable-gpu "http://localhost:8080/scratch/test_v2_core_workspaces.html"

Start-Sleep -Seconds 4

if (Test-Path .\scratch\test_report.txt) {
    Get-Content .\scratch\test_report.txt
} else {
    Write-Output "No report file generated"
}
