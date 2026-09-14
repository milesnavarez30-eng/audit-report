Add-Type -AssemblyName System.Net.Http

$client = New-Object System.Net.Http.HttpClient
$client.DefaultRequestHeaders.Add("apikey", "sb_publishable_JGUCURJkbOw-KypucxXNSQ_magKTFPd")
$client.DefaultRequestHeaders.Add("Authorization", "Bearer sb_publishable_JGUCURJkbOw-KypucxXNSQ_magKTFPd")

$endpoints = @(
    "log_cctv_security_event",
    "cctv_security_event",
    "tv_security_event"
)

foreach ($ep in $endpoints) {
    $content = New-Object System.Net.Http.StringContent('{"p_action":"test"}', [System.Text.Encoding]::UTF8, 'application/json')
    $resp = $client.PostAsync("https://afxgfyuudqujueeooplj.supabase.co/rest/v1/rpc/$ep", $content).Result
    $b = $resp.Content.ReadAsStringAsync().Result
    Write-Host "RPC $ep -> $($resp.StatusCode.value__) : $b"
}
