const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');
const chokidar = require('chokidar');

const PORT = process.env.PORT || 4400;
const args = process.argv.slice(2);

let designDir = process.env.DESIGN_DIR || process.cwd();
const dirIndex = args.indexOf('--dir');
if (dirIndex > -1 && args.length > dirIndex + 1) {
  designDir = path.resolve(args[dirIndex + 1]);
}

const manifestName = process.env.MANIFEST_NAME || 'manifest.json';
const manifestPath = path.join(designDir, manifestName);

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8'
};

const resolveInside = (baseDir, requestPath) => {
  const base = path.resolve(baseDir);
  const normalized = String(requestPath || '').replace(/^\/+/, '');
  const resolved = path.resolve(base, normalized);
  if (resolved === base || resolved.startsWith(base + path.sep)) {
    return resolved;
  }
  return null;
};

const sendFile = (res, filePath) => {
  const extname = String(path.extname(filePath)).toLowerCase();
  const contentType = MIME_TYPES[extname] || 'application/octet-stream';
  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end(`File not found: ${filePath}`);
        return;
      }
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end(`Server Error: ${err.code}`);
      return;
    }
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(content);
  });
};

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store');

  let pathname = '/';
  try {
    const parsed = new URL(req.url, `http://${req.headers.host}`);
    pathname = decodeURIComponent(parsed.pathname);
  } catch (e) {
    res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Invalid request URL');
    return;
  }

  if (pathname === '/') {
    const indexPath = path.join(__dirname, 'viewer', 'index.html');
    sendFile(res, indexPath);
    return;
  }

  if (pathname === '/api/manifest') {
    fs.readFile(manifestPath, (err, content) => {
      if (err) {
        if (err.code === 'ENOENT') {
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end('[]');
          return;
        }
        res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end(`Server Error: ${err.code}`);
        return;
      }
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(content);
    });
    return;
  }

  let filePath = null;
  if (pathname.startsWith('/viewer/')) {
    filePath = resolveInside(__dirname, pathname.slice(1));
  } else {
    filePath = resolveInside(designDir, pathname);
  }

  if (!filePath) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Forbidden');
    return;
  }

  sendFile(res, filePath);
});

const wss = new WebSocketServer({ server });

const notifyClients = (message) => {
  const payload = JSON.stringify(message);
  wss.clients.forEach((client) => {
    if (client.readyState === 1) {
      client.send(payload);
    }
  });
};

console.log(`Watching for designs in: ${designDir}`);
console.log(`Watching for manifest at: ${manifestPath}`);

let debounceTimer = null;

const scheduleBroadcast = (eventType, changedPath) => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    const resolvedChanged = path.resolve(changedPath);
    const resolvedManifest = path.resolve(manifestPath);

    if (resolvedChanged === resolvedManifest) {
      notifyClients({ type: 'MANIFEST_CHANGE' });
      return;
    }

    const relativePath = path.relative(designDir, resolvedChanged).replace(/\\/g, '/');
    if (!relativePath || relativePath.startsWith('..')) {
      return;
    }

    notifyClients({
      type: 'FILE_CHANGE',
      filePath: `/${relativePath}`,
      event: eventType
    });
  }, 500);
};

const watcher = chokidar.watch(designDir, {
  ignored: /(^|[\/\\])\../,
  persistent: true,
  ignoreInitial: true
});

watcher.on('add', (changedPath) => scheduleBroadcast('add', changedPath));
watcher.on('change', (changedPath) => scheduleBroadcast('change', changedPath));
watcher.on('unlink', (changedPath) => scheduleBroadcast('unlink', changedPath));

const openInBrowser = async (url) => {
  try {
    const mod = await import('open');
    await mod.default(url);
  } catch (e) {
  }
};

server.listen(PORT, () => {
  const url = `http://localhost:${PORT}`;
  console.log(`Design-View server running on ${url}`);
  openInBrowser(url);
});
