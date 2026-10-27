// Local dev server that serves the site the way GitHub Pages does, without a build:
// pages under pages/ are served at their `permalink` (front matter stripped),
// clean URLs map /about → about.html, unknown paths get 404.html with a 404.
// Usage: node scripts/serve.cjs [port]   (default 8765)
const http = require('http');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const port = Number(process.argv[2]) || 8765;
const FRONT_MATTER_RE = /^---\n([\s\S]*?)\n---\n/;
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.xml': 'application/xml', '.txt': 'text/plain; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
  '.gif': 'image/gif', '.ico': 'image/x-icon', '.mp4': 'video/mp4'
};

// Not published: page sources (only their permalinks are), dotfiles, and _config.yml's exclude list.
const config = fs.readFileSync(path.join(root, '_config.yml'), 'utf8');
const hidden = ['pages', '_config.yml', ...[...config.matchAll(/^\s+-\s+(\S+)/gm)].map(m => m[1])];

function published(file) {
  const top = path.relative(root, file).split(path.sep)[0];
  return !top.startsWith('.') && !hidden.includes(top);
}

// Re-read on every request so new or moved pages show up without a restart.
function permalinks() {
  const map = {};
  (function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const file = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(file);
      else if (entry.name.endsWith('.html')) {
        const fm = fs.readFileSync(file, 'utf8').match(FRONT_MATTER_RE);
        const link = fm && fm[1].match(/^permalink:\s*(\S+)/m);
        if (link) map[link[1]] = file;
      }
    }
  })(path.join(root, 'pages'));
  return map;
}

function resolve(urlPath) {
  const links = permalinks();
  const candidates = urlPath === '/' ? ['/index.html'] : [urlPath, urlPath + '.html'];
  for (const c of candidates) {
    if (links[c]) return links[c];
    const file = path.join(root, c);
    if (file.startsWith(root + path.sep) && published(file) && fs.existsSync(file) && fs.statSync(file).isFile()) return file;
  }
  return null;
}

function send(req, res, file, status) {
  const type = TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream';
  if (file.endsWith('.html')) {
    const html = fs.readFileSync(file, 'utf8').replace(FRONT_MATTER_RE, '');
    res.writeHead(status, { 'Content-Type': type });
    return res.end(html);
  }
  const size = fs.statSync(file).size;
  const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || '');
  if (range) {  // Safari will not play video without range requests
    const start = range[1] ? Number(range[1]) : size - Number(range[2]);
    const end = range[1] && range[2] ? Number(range[2]) : size - 1;
    res.writeHead(206, { 'Content-Type': type, 'Accept-Ranges': 'bytes',
      'Content-Range': `bytes ${start}-${end}/${size}`, 'Content-Length': end - start + 1 });
    return fs.createReadStream(file, { start, end }).pipe(res);
  }
  res.writeHead(status, { 'Content-Type': type, 'Content-Length': size, 'Accept-Ranges': 'bytes' });
  fs.createReadStream(file).pipe(res);
}

http.createServer((req, res) => {
  const urlPath = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  const file = resolve(urlPath);
  if (file) send(req, res, file, 200);
  else send(req, res, path.join(root, '404.html'), 404);
}).listen(port, () => console.log(`Happy Booth on http://localhost:${port}`));
