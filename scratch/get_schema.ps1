$SUPABASE_URL = 'https://afxgfyuudqujueeooplj.supabase.co'
$SUPABASE_KEY = 'sb_publishable_JGUCURJkbOw-KypucxXNSQ_magKTFPd'
$headers = @{
    'apikey' = $SUPABASE_KEY
    'Authorization' = "Bearer $SUPABASE_KEY"
}

$spec = Invoke-RestMethod -Uri "$SUPABASE_URL/rest/v1/" -Method Get -Headers $headers
Write-Host "Paths found in PostgREST:"
$rpcPaths = $spec.paths.PSObject.Properties.Name | Where-Object { $_ -like '/rpc/*' }
foreach ($p in $rpcPaths) {
    Write-Host "RPC: $p"
    $postParams = $spec.paths.$p.post.parameters
    if ($postParams) {
        Write-Host ($postParams | ConvertTo-Json -Depth 3)
    }
}
