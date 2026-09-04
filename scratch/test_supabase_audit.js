const https = require('https');

const SUPABASE_URL = "https://afxgfyuudqujueeooplj.supabase.co";
const SUPABASE_KEY = "sb_publishable_JGUCURJkbOw-KypucxXNSQ_magKTFPd";

// Let's test calling log_cctv_security_event without authentication
const url = `${SUPABASE_URL}/rest/v1/rpc/log_cctv_security_event`;

const req = https.request(url, {
    method: 'POST',
    headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json'
    }
}, res => {
    let body = '';
    res.on('data', chunk => body += chunk);
    res.on('end', () => {
        console.log("Status:", res.statusCode);
        console.log("Response:", body);
    });
});

req.on('error', err => console.error("Error:", err));
req.write(JSON.stringify({
    p_action: "test_action",
    p_target_user_id: null,
    p_target_item: "test_item",
    p_details: {}
}));
req.end();
