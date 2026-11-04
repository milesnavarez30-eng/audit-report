#!/usr/bin/env node
/**
 * Safe Build Script for CCTV OPS V2 - Cloudflare Workers Static Assets
 * 
 * Packages only public web assets into ./dist/
 * Strictly excludes SQL scripts, private dumps, Google Apps Script,
 * backups, scratch files, and development utilities.
 */

const fs = require('fs');
const path = require('path');

const ROOT_DIR = __dirname;
const DIST_DIR = path.join(ROOT_DIR, 'dist');
const CCTV_DIR = path.join(ROOT_DIR, 'cctv-ops-v2');

// Clean and recreate dist directory
if (fs.existsSync(DIST_DIR)) {
  fs.rmSync(DIST_DIR, { recursive: true, force: true });
}
fs.mkdirSync(DIST_DIR, { recursive: true });

// Ensure target directories exist
const targetDirs = [
  path.join(DIST_DIR, 'cctv-ops-v2'),
  path.join(DIST_DIR, 'cctv-ops-v2', 'css'),
  path.join(DIST_DIR, 'cctv-ops-v2', 'js'),
  path.join(DIST_DIR, 'cctv-ops-v2', 'js', 'components'),
  path.join(DIST_DIR, 'cctv-ops-v2', 'js', 'services'),
];
targetDirs.forEach(dir => fs.mkdirSync(dir, { recursive: true }));

// Helper to copy file safely
function copyFile(src, dest) {
  if (!fs.existsSync(src)) {
    throw new Error(`Required source file missing: ${src}`);
  }
  fs.copyFileSync(src, dest);
}

// 1. Root assets
copyFile(path.join(ROOT_DIR, 'index.html'), path.join(DIST_DIR, 'index.html'));
if (fs.existsSync(path.join(ROOT_DIR, 'auth-config.js'))) {
  copyFile(path.join(ROOT_DIR, 'auth-config.js'), path.join(DIST_DIR, 'auth-config.js'));
}
if (fs.existsSync(path.join(ROOT_DIR, 'favicon.ico'))) {
  copyFile(path.join(ROOT_DIR, 'favicon.ico'), path.join(DIST_DIR, 'favicon.ico'));
}

// 2. CCTV OPS V2 Core Files
copyFile(path.join(CCTV_DIR, 'index.html'), path.join(DIST_DIR, 'cctv-ops-v2', 'index.html'));
if (fs.existsSync(path.join(CCTV_DIR, 'auth-config.js'))) {
  copyFile(path.join(CCTV_DIR, 'auth-config.js'), path.join(DIST_DIR, 'cctv-ops-v2', 'auth-config.js'));
}
if (fs.existsSync(path.join(CCTV_DIR, 'auth-config.preview.template.js'))) {
  copyFile(path.join(CCTV_DIR, 'auth-config.preview.template.js'), path.join(DIST_DIR, 'cctv-ops-v2', 'auth-config.preview.template.js'));
}

// 3. CSS Files (only active .css)
const cssSourceDir = path.join(CCTV_DIR, 'css');
fs.readdirSync(cssSourceDir).forEach(file => {
  if (file.endsWith('.css') && !file.includes('.bak')) {
    copyFile(path.join(cssSourceDir, file), path.join(DIST_DIR, 'cctv-ops-v2', 'css', file));
  }
});

// 4. Root JS Modules (app.js, config.js, shared.js, storage.js)
const jsSourceDir = path.join(CCTV_DIR, 'js');
fs.readdirSync(jsSourceDir).forEach(file => {
  const fullPath = path.join(jsSourceDir, file);
  if (fs.statSync(fullPath).isFile() && file.endsWith('.js') && !file.includes('.bak')) {
    copyFile(fullPath, path.join(DIST_DIR, 'cctv-ops-v2', 'js', file));
  }
});

// 5. JS Components
const compSourceDir = path.join(CCTV_DIR, 'js', 'components');
if (fs.existsSync(compSourceDir)) {
  fs.readdirSync(compSourceDir).forEach(file => {
    if (file.endsWith('.js') && !file.includes('.bak')) {
      copyFile(path.join(compSourceDir, file), path.join(DIST_DIR, 'cctv-ops-v2', 'js', 'components', file));
    }
  });
}

// 6. JS Services (active services only, exclude .bak or scratch)
const servSourceDir = path.join(CCTV_DIR, 'js', 'services');
if (fs.existsSync(servSourceDir)) {
  fs.readdirSync(servSourceDir).forEach(file => {
    if (file.endsWith('.js') && !file.includes('.bak') && !file.startsWith('.') && file !== 'cloud-media-service.js') {
      copyFile(path.join(servSourceDir, file), path.join(DIST_DIR, 'cctv-ops-v2', 'js', 'services', file));
    }
  });
}

// 7. Security Headers & Redirects
const headersContent = `# Cloudflare Security & Cache Headers for CCTV OPS V2

/*
  X-Content-Type-Options: nosniff
  X-Frame-Options: SAMEORIGIN
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=()

/cctv-ops-v2/css/*
  Cache-Control: public, max-age=86400, stale-while-revalidate=604800

/cctv-ops-v2/js/*
  Cache-Control: public, max-age=86400, stale-while-revalidate=604800
`;
fs.writeFileSync(path.join(DIST_DIR, '_headers'), headersContent, 'utf8');

const redirectsContent = `# Cloudflare Redirects for CCTV OPS V2
/                  /cctv-ops-v2/  302
/cctv-ops-v2       /cctv-ops-v2/  301
/cctv-ops-v2/*     /cctv-ops-v2/index.html  200
`;
fs.writeFileSync(path.join(DIST_DIR, '_redirects'), redirectsContent, 'utf8');

fs.writeFileSync(path.join(DIST_DIR, 'cctv-ops-v2', '_headers'), headersContent, 'utf8');
fs.writeFileSync(path.join(DIST_DIR, 'cctv-ops-v2', '_redirects'), redirectsContent, 'utf8');

// 8. Strict Security & Manifest Verification
const forbiddenExtensions = ['.sql', '.gs', '.bak', '.zip', '.tmp', '.patch', '.log', '.ps1', '.tar', '.gz'];

function getAllFiles(dir, fileList = []) {
  const items = fs.readdirSync(dir);
  for (const item of items) {
    const itemPath = path.join(dir, item);
    if (fs.statSync(itemPath).isDirectory()) {
      getAllFiles(itemPath, fileList);
    } else {
      fileList.push(itemPath);
    }
  }
  return fileList;
}

const allBuiltFiles = getAllFiles(DIST_DIR);
let totalBytes = 0;
const manifest = [];

for (const filePath of allBuiltFiles) {
  const relPath = path.relative(DIST_DIR, filePath).replace(/\\/g, '/');
  const stat = fs.statSync(filePath);
  totalBytes += stat.size;

  // Check forbidden extensions
  for (const forbidden of forbiddenExtensions) {
    if (filePath.toLowerCase().endsWith(forbidden)) {
      throw new Error(`SECURITY ALERT: Forbidden file detected in dist: ${relPath}`);
    }
  }

  // Check forbidden keywords
  if (relPath.includes('scratch') || relPath.includes('supabase') || relPath.includes('recovered_edrs') || relPath.includes('.env')) {
    throw new Error(`SECURITY ALERT: Forbidden directory or private file in dist: ${relPath}`);
  }

  manifest.push({ path: relPath, size: stat.size });
}

// Ensure required critical files exist
const criticalFiles = [
  'index.html',
  'auth-config.js',
  'cctv-ops-v2/index.html',
  'cctv-ops-v2/js/app.js',
  'cctv-ops-v2/css/ui-refinement.css'
];
for (const critical of criticalFiles) {
  const found = manifest.find(m => m.path === critical);
  if (!found || found.size === 0) {
    throw new Error(`CRITICAL BUILD ERROR: Missing or empty file: ${critical}`);
  }
}

console.log('----------------------------------------------------');
console.log('CCTV OPS V2 - Cloudflare Static Assets Build Manifest');
console.log('----------------------------------------------------');
manifest.sort((a, b) => a.path.localeCompare(b.path)).forEach(m => {
  const kb = (m.size / 1024).toFixed(1).padStart(7);
  console.log(`  ${kb} KB  ${m.path}`);
});
console.log('----------------------------------------------------');
console.log(`Total files: ${manifest.length}`);
console.log(`Total size:  ${(totalBytes / 1024).toFixed(1)} KB (${(totalBytes / (1024 * 1024)).toFixed(2)} MB)`);
console.log('Build verification: PASSED (Zero sensitive files detected)');
console.log('----------------------------------------------------');

