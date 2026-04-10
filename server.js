const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');
const chokidar = require('chokidar');
const open = require('open');

const PORT = process.env.PORT || 4400;

// Parse arguments
const args = process.argv.slice(2);
let designDir = process.env.DESIGN_DIR || process.cwd();
const dirIndex = args.indexOf('--dir');
if (dirIndex > -1 && args.length > dirIndex + 1) {
  designDir = path.resolve(args[dirIndex + 1]);
}

const manifestName = process.env.MANIFEST_NAME || 'manifest.json';
const manifestPath = path.join(designDir, manifestName);

const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml'
};

const server = http.createServer((req, res) => {
  // CORS for convenience
  res.setHeader('Access-Control-Allow-Origin', '*');

  let filePath = '';

  if (req.url === '/') {
    filePath = path.join(__dirname, 'viewer', 'index.html');
  } else if (req.url === '/api/manifest') {
    filePath = manifestPath;
  } else if (req.url.startsWith('/viewer/')) {
    filePath = path.join(__dirname, req.url);
  } else {
    // Serve from design directory for everything else
    filePath = path.join(designDir, req.url.split('?')[0]);
  }

  const extname = String(path.extname(filePath)).toLowerCase();
  const contentType = MIME_TYPES[extname] || 'application/octet-stream';

  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        if (req.url === '/api/manifest') {
          // Send empty layout for wizard state instead of 404
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify([], null, 2), 'utf-8');
        } else {
          res.writeHead(404);
          res.end('File not found: ' + req.url);
        }
      } else {
        res.writeHead(500);
        res.end('Server Error: ' + err.code);
      }
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content, 'utf-8');
    }
  });
});

// WebSocket Server
const wss = new WebSocketServer({ server });
const notifyClients = (message) => {
  const payload = JSON.stringify(message);
  wss.clients.forEach(client => {
    if (client.readyState === 1) {
      client.send(payload);
    }
  });
};

// File Watcher
console.log(`Watching for designs in: ${designDir}`);
console.log(`Watching for manifest at: ${manifestPath}`);

let debounceTimer = null;
const watcher = chokidar.watch(designDir, {
  ignored: /(^|[\/\\])\../, // ignore dotfiles
  persistent: true
});

watcher.on('change', (changedPath) => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    // Determine if it was the manifest or a design file
    if (changedPath === manifestPath) {
      fs.readFile(manifestPath, 'utf-8', (err, data) => {
        if (!err) {
          try {
            const manifest = JSON.parse(data);
            notifyClients({ type: 'MANIFEST_CHANGE', manifest });
          } catch (e) {
            console.error('Invalid manifest JSON:', e.message);
          }
        }
      });
    } else {
      // It's a design file change
      // Send path relative to designDir matching how client requests it
      const relativePath = '/' + path.relative(designDir, changedPath).replace(/\\/g, '/');
      notifyClients({ type: 'FILE_CHANGE', filePath: relativePath });
    }
  }, 500);
});

server.listen(PORT, async () => {
  console.log(`Design-View server running on http://localhost:${PORT}`);
  // Try to open browser
  try {
    await open(`http://localhost:${PORT}`);
  } catch (e) {
    // Ignore if fails
  }
});
