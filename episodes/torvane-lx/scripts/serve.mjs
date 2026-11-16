// Tiny static server for the project folder. `node scripts/serve.mjs` opens the live page on http://localhost:5173
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.woff2': 'font/woff2', '.png': 'image/png', '.mp4': 'video/mp4',
};

export function startServer(port = 0, root = ROOT) {
  const server = http.createServer((req, res) => {
    let rel = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (rel.endsWith('/')) rel += 'index.html';
    const file = path.join(root, rel);
    if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end('not found'); return; }
    res.writeHead(200, {'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store'});
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((resolve) => server.listen(port, '127.0.0.1', () => resolve({url: `http://127.0.0.1:${server.address().port}`, close: () => server.close()})));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const s = await startServer(+(process.env.PORT || 5173));
  console.log(`Torvane LX live page: ${s.url}/   (portrait: ${s.url}/?format=portrait)`);
}
