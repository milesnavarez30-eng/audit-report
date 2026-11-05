/**
 * CCTV OPS Focus — Non-Production Supabase Test Server
 * 
 * Provides an isolated, non-production test environment simulating:
 * 1. Supabase GoTrue Auth (password sign-in, signup, JWT verification)
 * 2. PostgREST Table API with Row-Level Security (auth.uid() enforcement, revoke on direct mutations)
 * 3. PostgreSQL RPC Functions (save_cctv_user_focus_state, get_cctv_user_focus_state with server limits)
 * 
 * Used strictly for local test execution without touching production Supabase.
 */

const http = require('http');
const crypto = require('crypto');
const url = require('url');

const PORT = 54321;
const JWT_SECRET = 'super-secret-test-jwt-token-key-for-non-prod-cctv-ops-focus-tests';

// In-memory mock database for non-production tests
const database = {
  users: new Map(), // email -> { id: uuid, email, password }
  focus_state: new Map() // user_id -> { queue, playback, preferences, history, custom_lyrics, updated_at }
};

// Seed test users
const USER_ALICE_ID = '11111111-aaaa-bbbb-cccc-111111111111';
const USER_BOB_ID = '22222222-bbbb-cccc-dddd-222222222222';

database.users.set('alice@cctvops.example.com', {
  id: USER_ALICE_ID,
  email: 'alice@cctvops.example.com',
  password: 'Password123!'
});

database.users.set('bob@cctvops.example.com', {
  id: USER_BOB_ID,
  email: 'bob@cctvops.example.com',
  password: 'Password123!'
});

// Helper: base64url encode
function base64url(buf) {
  return buf.toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

// Generate real JWT token
function createJWT(userId, email) {
  const header = base64url(Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })));
  const now = Math.floor(Date.now() / 1000);
  const payload = base64url(Buffer.from(JSON.stringify({
    sub: userId,
    aud: 'authenticated',
    role: 'authenticated',
    email: email,
    exp: now + 3600,
    iat: now
  })));
  const sig = base64url(crypto.createHmac('sha256', JWT_SECRET).update(`${header}.${payload}`).digest());
  return `${header}.${payload}.${sig}`;
}

// Verify real JWT token
function verifyJWT(token) {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [header, payload, sig] = parts;
  const expectedSig = base64url(crypto.createHmac('sha256', JWT_SECRET).update(`${header}.${payload}`).digest());
  if (sig !== expectedSig) return null;
  try {
    const claims = JSON.parse(Buffer.from(payload, 'base64').toString('utf8'));
    if (claims.exp && claims.exp < Math.floor(Date.now() / 1000)) return null;
    return claims;
  } catch (_) {
    return null;
  }
}

// Extract auth.uid() from Authorization header
function getAuthUid(req) {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7).trim();
  const claims = verifyJWT(token);
  return claims?.sub || null;
}

const server = http.createServer(async (req, res) => {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, apikey, x-client-info');
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    return res.end();
  }

  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;

  // Collect request body
  let body = '';
  for await (const chunk of req) {
    body += chunk;
  }
  let jsonBody = {};
  if (body) {
    try {
      jsonBody = JSON.parse(body);
    } catch (_) {}
  }

  // 0. Test Harness Reset
  if (pathname === '/test/reset') {
    database.focus_state.clear();
    res.writeHead(200);
    return res.end(JSON.stringify({ ok: true, message: 'Database reset' }));
  }

  // 1. GoTrue Auth: Sign In
  if (pathname === '/auth/v1/token' && parsedUrl.query.grant_type === 'password') {
    const { email, password } = jsonBody;
    const user = database.users.get(email?.toLowerCase());
    if (!user || user.password !== password) {
      res.writeHead(400);
      return res.end(JSON.stringify({ error: 'invalid_grant', error_description: 'Invalid login credentials' }));
    }
    const token = createJWT(user.id, user.email);
    res.writeHead(200);
    return res.end(JSON.stringify({
      access_token: token,
      token_type: 'bearer',
      expires_in: 3600,
      refresh_token: 'test-refresh-token',
      user: {
        id: user.id,
        email: user.email,
        aud: 'authenticated',
        role: 'authenticated'
      }
    }));
  }

  // 2. GoTrue Auth: Get User
  if (pathname === '/auth/v1/user') {
    const uid = getAuthUid(req);
    if (!uid) {
      res.writeHead(401);
      return res.end(JSON.stringify({ message: 'Missing or invalid authorization token' }));
    }
    let foundUser = null;
    for (const u of database.users.values()) {
      if (u.id === uid) { foundUser = u; break; }
    }
    if (!foundUser) {
      res.writeHead(404);
      return res.end(JSON.stringify({ message: 'User not found' }));
    }
    res.writeHead(200);
    return res.end(JSON.stringify({
      id: foundUser.id,
      email: foundUser.email,
      role: 'authenticated'
    }));
  }

  // 3. PostgREST: Table queries on public.cctv_user_focus_state
  if (pathname === '/rest/v1/cctv_user_focus_state') {
    const uid = getAuthUid(req);
    // Deny anonymous requests
    if (!uid) {
      res.writeHead(401);
      return res.end(JSON.stringify({ message: 'JWSError: JWTExpired or missing token', code: '401' }));
    }

    if (req.method === 'GET') {
      // Evaluate RLS: USING (auth.uid() = user_id)
      const requestedUserId = parsedUrl.query.user_id ? String(parsedUrl.query.user_id).replace(/^eq\./, '') : null;
      if (requestedUserId && requestedUserId !== uid) {
        // Cross-user query: RLS filters out rows
        res.writeHead(200);
        return res.end(JSON.stringify([]));
      }
      const record = database.focus_state.get(uid);
      res.writeHead(200);
      return res.end(JSON.stringify(record ? [record] : []));
    }

    // Direct table INSERT, UPDATE, DELETE are REVOKED in migration
    if (['POST', 'PATCH', 'PUT', 'DELETE'].includes(req.method)) {
      res.writeHead(403);
      return res.end(JSON.stringify({
        code: '42501',
        message: 'permission denied for table cctv_user_focus_state. Mutations must use save_cctv_user_focus_state RPC.'
      }));
    }
  }

  // 4. RPC: get_cctv_user_focus_state
  if (pathname === '/rest/v1/rpc/get_cctv_user_focus_state') {
    const uid = getAuthUid(req);
    if (!uid) {
      res.writeHead(401);
      return res.end(JSON.stringify({ code: '28000', message: 'Not authenticated' }));
    }
    const record = database.focus_state.get(uid);
    res.writeHead(200);
    return res.end(JSON.stringify(record || null));
  }

  // 5. RPC: save_cctv_user_focus_state
  if (pathname === '/rest/v1/rpc/save_cctv_user_focus_state') {
    const uid = getAuthUid(req);
    if (!uid) {
      res.writeHead(401);
      return res.end(JSON.stringify({ code: '28000', message: 'Not authenticated' }));
    }

    // Simulation hook: allow test to simulate server 500 error for Check 8
    if (req.headers['x-simulate-error'] === 'true') {
      res.writeHead(500);
      return res.end(JSON.stringify({ message: 'Simulated database backend failure' }));
    }

    // Payload validation
    const payload = jsonBody.p_payload;
    if (!payload || typeof payload !== 'object') {
      res.writeHead(400);
      return res.end(JSON.stringify({ code: '22023', message: 'Invalid payload format: expected JSON object' }));
    }

    // Size limit check (250 KB)
    if (Buffer.byteLength(JSON.stringify(payload)) > 250000) {
      res.writeHead(400);
      return res.end(JSON.stringify({ code: '22000', message: 'Payload exceeds maximum allowed size (250KB)' }));
    }

    // Enforce history cap (max 100)
    let history = Array.isArray(payload.history) ? payload.history.slice(0, 100) : [];

    // Enforce queue cap (max 50)
    let queue = Array.isArray(payload.queue) ? payload.queue.slice(0, 50) : [];

    // Save strictly under auth.uid() (ignores any user_id passed in payload)
    const stored = {
      user_id: uid,
      queue: queue,
      playback: payload.playback || {},
      preferences: payload.preferences || {},
      history: history,
      custom_lyrics: payload.custom_lyrics || {},
      updated_at: new Date().toISOString()
    };
    database.focus_state.set(uid, stored);

    res.writeHead(200);
    return res.end(JSON.stringify({ success: true, updated_at: stored.updated_at }));
  }

  // 6. Profiles mock for CCTV OPS app startup
  if (pathname === '/rest/v1/profiles') {
    const uid = getAuthUid(req);
    res.writeHead(200);
    return res.end(JSON.stringify([{
      id: uid || USER_ALICE_ID,
      email: 'alice@cctvops.example.com',
      username: 'alice',
      display_name: 'Alice Operator',
      role: 'user',
      status: 'approved',
      permissions: { report: true, edr: true, audit: true, trackers: true, conduct: true }
    }]));
  }

  // Fallback
  res.writeHead(404);
  res.end(JSON.stringify({ message: 'Route not found in test server' }));
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[Non-Prod Supabase Test Server] Running at http://127.0.0.1:${PORT}`);
});
