Add-Type -AssemblyName System.Net.Http

$client = New-Object System.Net.Http.HttpClient
$client.DefaultRequestHeaders.Add("apikey", "sb_publishable_JGUCURJkbOw-KypucxXNSQ_magKTFPd")
$client.DefaultRequestHeaders.Add("Authorization", "Bearer sb_publishable_JGUCURJkbOw-KypucxXNSQ_magKTFPd")

$content = New-Object System.Net.Http.StringContent('{"p_target":"00000000-0000-0000-0000-000000000000"}', [System.Text.Encoding]::UTF8, 'application/json')
$resp = $client.PostAsync("https://afxgfyuudqujueeooplj.supabase.co/rest/v1/rpc/admin_remove_user", $content).Result

Write-Host "Status code:" $resp.StatusCode.value__
$respBody = $resp.Content.ReadAsStringAsync().Result
Write-Host "Response body:" $respBody

$content2 = New-Object System.Net.Http.StringContent('{}', [System.Text.Encoding]::UTF8, 'application/json')
$resp2 = $client.PostAsync("https://afxgfyuudqujueeooplj.supabase.co/rest/v1/rpc/admin_remove_user", $content2).Result
Write-Host "Empty status code:" $resp2.StatusCode.value__
Write-Host "Empty response body:" $resp2.Content.ReadAsStringAsync().Result
