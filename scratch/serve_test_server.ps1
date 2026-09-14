$port = 8085
$prefix = "http://localhost:$port/"
$root = (Get-Location).Path

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add($prefix)

try {
    $listener.Start()
    Write-Host "Test Server running on $prefix" -ForegroundColor Green

    while ($listener.IsListening) {
        $context = $listener.GetContext()
        $request = $context.Request
        $response = $context.Response

        $localPath = $request.Url.LocalPath.TrimStart('/')

        if ($request.HttpMethod -eq "POST" -and $localPath -eq "api/test_report") {
            $reader = New-Object System.IO.StreamReader($request.InputStream, $request.ContentEncoding)
            $postBody = $reader.ReadToEnd()
            $reader.Close()

            $reportOutPath = Join-Path $root "scratch\test_saved_ui_report.json"
            [System.IO.File]::WriteAllText($reportOutPath, $postBody, [System.Text.Encoding]::UTF8)

            $respBytes = [System.Text.Encoding]::UTF8.GetBytes("OK")
            $response.ContentType = "text/plain"
            $response.ContentLength64 = $respBytes.Length
            $response.OutputStream.Write($respBytes, 0, $respBytes.Length)
            $response.OutputStream.Close()
            continue
        }

        if ([string]::IsNullOrWhiteSpace($localPath) -or $localPath.EndsWith('/')) {
            if ($localPath -like "cctv-ops-v2*") {
                $filePath = Join-Path $root "cctv-ops-v2\index.html"
            } else {
                $filePath = Join-Path $root "index.html"
            }
        } else {
            $filePath = Join-Path $root ($localPath -replace '/', '\')
        }

        if (Test-Path $filePath -PathType Leaf) {
            $ext = [System.IO.Path]::GetExtension($filePath).ToLower()
            $mime = switch ($ext) {
                ".html" { "text/html; charset=utf-8" }
                ".css"  { "text/css; charset=utf-8" }
                ".js"   { "application/javascript; charset=utf-8" }
                ".json" { "application/json; charset=utf-8" }
                ".ico"  { "image/x-icon" }
                ".png"  { "image/png" }
                ".jpg"  { "image/jpeg" }
                ".svg"  { "image/svg+xml" }
                default { "application/octet-stream" }
            }

            $response.ContentType = $mime
            $response.AddHeader("Access-Control-Allow-Origin", "*")
            $response.AddHeader("Cache-Control", "no-cache, no-store, must-revalidate")
            
            $bytes = [System.IO.File]::ReadAllBytes($filePath)
            $response.ContentLength64 = $bytes.Length
            $response.OutputStream.Write($bytes, 0, $bytes.Length)
        } else {
            $response.StatusCode = 404
            $errBytes = [System.Text.Encoding]::UTF8.GetBytes("404 - Not Found: $localPath")
            $response.OutputStream.Write($errBytes, 0, $errBytes.Length)
        }
        $response.OutputStream.Close()
    }
} catch {
    Write-Host "Test Server error: $_" -ForegroundColor Red
} finally {
    if ($listener.IsListening) {
        $listener.Stop()
    }
    $listener.Close()
}
