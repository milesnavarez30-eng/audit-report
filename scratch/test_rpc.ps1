$SUPABASE_URL = 'https://afxgfyuudqujueeooplj.supabase.co'
$SUPABASE_KEY = 'sb_publishable_JGUCURJkbOw-KypucxXNSQ_magKTFPd'
$headers = @{
    'apikey' = $SUPABASE_KEY
    'Authorization' = "Bearer $SUPABASE_KEY"
    'Content-Type' = 'application/json'
}

Write-Host "--- Testing rpc/log_cctv_security_event ---"
try {
    $body = @{ p_action = 'test'; p_target_user_id = $null; p_target_item = 'test'; p_details = @{} } | ConvertTo-Json
    $res = Invoke-RestMethod -Uri "$SUPABASE_URL/rest/v1/rpc/log_cctv_security_event" -Method Post -Headers $headers -Body $body
    Write-Host "Success: $res"
} catch {
    Write-Host "Status: $($_.Exception.Response.StatusCode.value__)"
    $stream = $_.Exception.Response.GetResponseStream()
    $reader = New-Object System.IO.StreamReader($stream)
    Write-Host "Body: $($reader.ReadToEnd())"
}

Write-Host "--- Testing rpc/admin_delete_cctv_user ---"
try {
    $body = @{ p_target = '00000000-0000-0000-0000-000000000000' } | ConvertTo-Json
    $res = Invoke-RestMethod -Uri "$SUPABASE_URL/rest/v1/rpc/admin_delete_cctv_user" -Method Post -Headers $headers -Body $body
    Write-Host "Success: $res"
} catch {
    Write-Host "Status: $($_.Exception.Response.StatusCode.value__)"
    $stream = $_.Exception.Response.GetResponseStream()
    $reader = New-Object System.IO.StreamReader($stream)
    Write-Host "Body: $($reader.ReadToEnd())"
}

Write-Host "--- Testing rpc/delete_cctv_user ---"
try {
    $body = @{ p_target = '00000000-0000-0000-0000-000000000000' } | ConvertTo-Json
    $res = Invoke-RestMethod -Uri "$SUPABASE_URL/rest/v1/rpc/delete_cctv_user" -Method Post -Headers $headers -Body $body
    Write-Host "Success: $res"
} catch {
    Write-Host "Status: $($_.Exception.Response.StatusCode.value__)"
    $stream = $_.Exception.Response.GetResponseStream()
    $reader = New-Object System.IO.StreamReader($stream)
    Write-Host "Body: $($reader.ReadToEnd())"
}

Write-Host "--- Testing table cctv_security_audit_logs ---"
try {
    $res = Invoke-RestMethod -Uri "$SUPABASE_URL/rest/v1/cctv_security_audit_logs?limit=1" -Method Get -Headers $headers
    Write-Host "Success: $($res | ConvertTo-Json)"
} catch {
    Write-Host "Status: $($_.Exception.Response.StatusCode.value__)"
    $stream = $_.Exception.Response.GetResponseStream()
    $reader = New-Object System.IO.StreamReader($stream)
    Write-Host "Body: $($reader.ReadToEnd())"
}
