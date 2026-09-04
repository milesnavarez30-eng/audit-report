const https = require('https');

const SUPABASE_URL = "https://afxgfyuudqujueeooplj.supabase.co";
const SUPABASE_KEY = "sb_publishable_JGUCURJkbOw-KypucxXNSQ_magKTFPd";

// Check profiles
const url = `${SUPABASE_URL}/rest/v1/profiles?select=*`;

const req = https.request(url, {
    method: 'GET',
    headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`
    }
}, res => {
    let body = '';
    res.on('data', chunk => body += chunk);
    res.on('end', () => {
        console.log("Profiles Status:", res.statusCode);
        try {
            const data = JSON.parse(body);
            console.log("Profiles count:", Array.isArray(data) ? data.length : data);
            if (Array.isArray(data)) {
                console.log("Users:", data.map(u => ({ username: u.username, role: u.role, status: u.status })));
            }
        } catch (e) {
            console.log("Body:", body);
        }
    });
});

req.on('error', err => console.error("Error:", err));
req.end();
