$SUPABASE_URL = 'https://afxgfyuudqujueeooplj.supabase.co'
$SUPABASE_KEY = 'sb_publishable_JGUCURJkbOw-KypucxXNSQ_magKTFPd'
$headers = @{
    'apikey' = $SUPABASE_KEY
    'Authorization' = "Bearer $SUPABASE_KEY"
    'Content-Type' = 'application/json'
}

try {
    $body = @{ p_target = '00000000-0000-0000-0000-000000000000' } | ConvertTo-Json
    $res = Invoke-WebRequest -Uri "$SUPABASE_URL/rest/v1/rpc/admin_remove_user" -Method Post -Headers $headers -Body $body
    Write-Host "Success: $($res.Content)"
} catch {
    Write-Host "Status: $($_.Exception.Response.StatusCode.value__)"
    $stream = $_.Exception.Response.GetResponseStream()
    $reader = New-Object System.IO.StreamReader($stream)
    Write-Host "Body: $($reader.ReadToEnd())"
}
