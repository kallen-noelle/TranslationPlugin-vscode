/**
 * Minimal static file server for the VS Code webview bundle.
 * Serves `out/webview-assets/` so the 4 React pages can be previewed in a browser.
 *
 * Usage:  node scripts/preview-webview.mjs          # default port 5173
 *         node scripts/preview-webview.mjs 8080      # custom port
 *
 *   npm run watch:webview    ← rebuild bundle on change (run in another terminal)
 *   npm run preview:webview  ← this server
 *
 * Open:   http://localhost:5173/WordBook.html
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', 'out', 'webview-assets');
const PORT = Number(process.argv[2] ?? 5173);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.mjs':  'application/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg':  'image/svg+xml',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif':  'image/gif',
  '.ico':  'image/x-icon',
  '.woff': 'font/woff',
  '.woff2':'font/woff2',
  '.ttf':  'font/ttf',
  '.map':  'application/json; charset=utf-8',
};

const server = http.createServer((req, res) => {
  let urlPath = decodeURIComponent(req.url.split('?')[0]);
  if (urlPath === '/') urlPath = '/WordBook.html';

  const filePath = path.join(ROOT, urlPath);
  // Prevent path traversal outside ROOT
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403); res.end('Forbidden'); return;
  }

  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) {
      // Check if it's one of our known page names without .html extension
      const guessHtml = path.join(ROOT, urlPath + '.html');
      return fs.stat(guessHtml, (err2, stat2) => {
        if (err2 || !stat2.isFile()) {
          res.writeHead(404); res.end('Not found: ' + urlPath); return;
        }
        serve(guessHtml, stat2);
      });
    }
    serve(filePath, stat);
  });

  function serve(p, stat) {
    const ext = path.extname(p).toLowerCase();
    res.writeHead(200, {
      'Content-Type': MIME[ext] ?? 'application/octet-stream',
      'Content-Length': stat.size,
      'Cache-Control': 'no-cache',
    });
    fs.createReadStream(p).pipe(res);
  }
});

server.listen(PORT, () => {
  console.log(`Preview server running at http://localhost:${PORT}/`);
  console.log(`Serving from: ${ROOT}`);
  console.log();
  console.log('Pages:');
  for (const name of ['WordBook', 'TranslationDialog', 'WordDetails', 'WordOfDay']) {
    console.log(`  http://localhost:${PORT}/webview-ui/${name}.html`);
  }
  console.log();
  console.log('Tip: run "npm run watch:webview" in another terminal to auto-rebuild on save.');
});
