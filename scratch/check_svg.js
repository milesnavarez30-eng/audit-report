const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(fullPath));
    } else if (file.endsWith('.js') || file.endsWith('.html')) {
      results.push(fullPath);
    }
  });
  return results;
}

const files = walk('c:/Users/Mnavares/Documents/CCTV OPS/audit-report/cctv-ops-v2');
const pathRegex = /<path[^>]*d=["']([^"']+)["']/g;

files.forEach(f => {
  const content = fs.readFileSync(f, 'utf8');
  let match;
  while ((match = pathRegex.exec(content)) !== null) {
    const d = match[1];
    // Check against standard SVG path command regex
    // Valid commands: M, m, L, l, H, h, V, v, C, c, S, s, Q, q, T, t, A, a, Z, z
    // Check if there are patterns like "l18 18" without space after l, or numbers with bad decimal points, etc.
    // Also test parsing with DOMParser if in browser
    console.log(`[PATH in ${path.basename(f)}] ${d}`);
  }
});
