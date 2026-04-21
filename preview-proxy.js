/**
 * preview-proxy.js
 *
 * Front-door for the video-gen sandbox. Listens on :5173 and serves:
 *
 *   GET  /                  → index.html with an auto-play wrapper script
 *                             injected, so the GSAP timeline plays on load
 *                             and loops. The source file stays paused
 *                             (required for deterministic rendering).
 *   GET  /<path>            → static files from the project root
 *                             (compositions/, assets/, etc.)
 *
 *   POST /__render          → body: { renderId }. Validates the composition
 *                             against render.config.json caps, runs
 *                             `hyperframes render`, streams progress as
 *                             newline-delimited JSON.
 *   GET    /__artifacts/:id → streams the rendered MP4.
 *   DELETE /__artifacts/:id → deletes it (call after S3 upload).
 *   GET    /__health        → { status, diskFreeMb, memoryUsageMb }.
 *
 * Started by the coder service via the template's `devCommand`.
 */

import http from 'node:http';
import { spawn, execSync } from 'node:child_process';
import { promises as fsp, createReadStream, statSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import url from 'node:url';

const ROOT = process.cwd();
const PORT = parseInt(process.env.PORT || '5173', 10);
const RENDERS_DIR = path.join(ROOT, 'renders');
const CONFIG_PATH = path.join(ROOT, 'render.config.json');

mkdirSync(RENDERS_DIR, { recursive: true });

const config = JSON.parse(await fsp.readFile(CONFIG_PATH, 'utf8'));

// ---------- preview augmentations (injected before </body> when serving index.html) ----------
//
// Three responsibilities, all preview-only (never baked into the source file
// — render captures index.html as-authored at native 1280×720):
//
//   1. Scale-to-fit the 1280×720 canvas so it fills any iframe size while
//      preserving 16:9 aspect ratio. Uses a CSS variable + JS that updates on
//      resize. Logical canvas stays 1280×720 (so MP4 renders identically),
//      visual scale changes only.
//
//   2. Auto-play the GSAP timeline registered as window.__timelines["main"]
//      and loop it forever. Render mode keeps the timeline paused.
//
//   3. Send `SUPERAGI_CODER_APP_READY` postMessage to the parent so the
//      SuperAGI iframe component reveals the preview (otherwise it shows an
//      error overlay after ~15s).
const AUTOPLAY_SCRIPT = `
<style data-hf-preview-only>
  /* Defaults the composition CAN override (no !important).
     Composition's @media rules can resize #root to match iframe aspect. */
  html, body {
    width: 100vw;
    height: 100vh;
    margin: 0;
    overflow: hidden;
    background: #000;
    display: flex;
    align-items: center;
    justify-content: center;
  }
</style>
<script>
(function () {
  // Scale-to-fit reads the composition's ACTUAL rendered size (not a hardcoded
  // 1280×720) so responsive compositions whose @media rules resize #root work
  // correctly at any iframe aspect ratio. Skip scaling entirely when the
  // composition already fits the viewport (avoids unnecessary downscaling).
  function fit() {
    var root = document.getElementById('root') ||
               document.querySelector('[data-composition-id="main"]') ||
               document.body && document.body.firstElementChild;
    if (!root) return;
    // Clear prior transform before measuring (transform affects offsetWidth)
    root.style.transform = '';
    var w = root.offsetWidth;
    var h = root.offsetHeight;
    if (!w || !h) return;
    var s = Math.min(window.innerWidth / w, window.innerHeight / h);
    if (s < 1) {
      root.style.transformOrigin = 'center center';
      root.style.transform = 'scale(' + s + ')';
    }
  }
  function fitWhenReady() {
    fit();
    // Refit after fonts + images settle (layout may shift)
    setTimeout(fit, 100);
    setTimeout(fit, 500);
  }
  if (document.readyState === 'complete') fitWhenReady();
  else window.addEventListener('load', fitWhenReady);
  window.addEventListener('resize', fit);

  function start() {
    var tl = window.__timelines && window.__timelines["main"];
    if (!tl) { setTimeout(start, 100); return; }
    tl.eventCallback("onComplete", function () {
      setTimeout(function () { tl.restart(); }, 600);
    });
    tl.play(0);
    try {
      window.parent.postMessage({ type: 'SUPERAGI_CODER_APP_READY' }, '*');
    } catch (_) { /* not in an iframe — fine */ }
  }
  if (document.readyState === "complete") start();
  else window.addEventListener("load", start);
})();
</script>
`;

// ---------- static serving ----------

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
};

function safeJoin(root, requested) {
  const target = path.normalize(path.join(root, requested));
  if (!target.startsWith(root)) return null;
  return target;
}

async function serveStatic(req, res, pathname) {
  const requested = pathname === '/' ? '/index.html' : pathname;
  const file = safeJoin(ROOT, requested);
  if (!file) return notFound(res);

  let stat;
  try { stat = statSync(file); } catch { return notFound(res); }
  if (stat.isDirectory()) return notFound(res);

  const ext = path.extname(file).toLowerCase();
  const ctype = MIME[ext] || 'application/octet-stream';

  // Inject the auto-play wrapper for the root composition only.
  if (requested === '/index.html') {
    let html = await fsp.readFile(file, 'utf8');
    if (html.includes('</body>')) html = html.replace('</body>', AUTOPLAY_SCRIPT + '</body>');
    else html += AUTOPLAY_SCRIPT;
    res.writeHead(200, { 'content-type': ctype, 'cache-control': 'no-store' });
    return res.end(html);
  }

  res.writeHead(200, {
    'content-type': ctype,
    'content-length': stat.size,
    'cache-control': 'no-store',
  });
  createReadStream(file).pipe(res);
}

function notFound(res) {
  res.writeHead(404, { 'content-type': 'text/plain' });
  res.end('not found');
}

// ---------- helpers ----------

function diskFreeMb(p) {
  try {
    const out = execSync(`df -Pm ${p} | tail -1 | awk '{print $4}'`).toString().trim();
    return parseInt(out, 10);
  } catch { return -1; }
}

function memoryUsageMb() {
  return Math.round(process.memoryUsage().rss / (1024 * 1024));
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let buf = '';
    req.on('data', (c) => (buf += c));
    req.on('end', () => {
      if (!buf) return resolve({});
      try { resolve(JSON.parse(buf)); } catch (e) { reject(e); }
    });
    req.on('error', reject);
  });
}

// CORS headers needed for the parent SuperAGI iframe to read responses
// (especially the /health-coder probe). Modal's edge proxy does not add
// these for us. Allow any origin since the preview URL itself is signed.
const CORS_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, DELETE, OPTIONS',
  'access-control-allow-headers': 'content-type, x-daytona-disable-cors',
};

function jsonRes(res, code, obj) {
  res.writeHead(code, { 'content-type': 'application/json', ...CORS_HEADERS });
  res.end(JSON.stringify(obj));
}

function ndjson(res, obj) {
  res.write(JSON.stringify(obj) + '\n');
}

async function validateComposition() {
  const html = await fsp.readFile(path.join(ROOT, 'index.html'), 'utf8');
  const root = html.match(/id=["']root["'][^>]*>/);
  if (!root) return { ok: false, error: 'index.html missing #root composition' };
  const dur = root[0].match(/data-duration=["'](\d+(?:\.\d+)?)["']/);
  if (!dur) return { ok: false, error: 'root composition missing data-duration' };
  const seconds = parseFloat(dur[1]);
  if (seconds > config.maxDurationSeconds) {
    return { ok: false, error: `composition duration ${seconds}s exceeds cap ${config.maxDurationSeconds}s` };
  }
  const w = root[0].match(/data-width=["'](\d+)["']/);
  const h = root[0].match(/data-height=["'](\d+)["']/);
  if (w && h) {
    const width = parseInt(w[1], 10);
    const height = parseInt(h[1], 10);
    const max = config.maxResolution;
    if (width > max.width || height > max.height) {
      return { ok: false, error: `viewport ${width}x${height} exceeds cap ${max.width}x${max.height}` };
    }
  }
  return { ok: true, durationSeconds: seconds };
}

// ---------- handlers ----------

async function handleHealth(_req, res) {
  jsonRes(res, 200, {
    status: 'ok',
    diskFreeMb: diskFreeMb(ROOT),
    memoryUsageMb: memoryUsageMb(),
  });
}

// Allowed export formats. The first entry is the default if the caller omits format.
const ALLOWED_FORMATS = ['mp4', 'webm', 'mov'];

async function handleRender(req, res) {
  let body;
  try { body = await readJsonBody(req); } catch (e) {
    return jsonRes(res, 400, { error: 'invalid json: ' + e.message });
  }
  const renderId = (body.renderId || '').toString().replace(/[^a-zA-Z0-9_-]/g, '');
  if (!renderId) return jsonRes(res, 400, { error: 'renderId required (alphanumeric/_/-)' });

  // Optional overrides from the SuperAGI export-video dropdown. Defaults come
  // from render.config.json so old callers still work unchanged.
  const requestedFormat = (body.format || '').toString().toLowerCase();
  const format = requestedFormat
    ? (ALLOWED_FORMATS.includes(requestedFormat) ? requestedFormat : null)
    : config.format;
  if (!format) {
    return jsonRes(res, 422, { error: `format must be one of ${ALLOWED_FORMATS.join(', ')}` });
  }

  const cap = config.maxResolution;
  const requestedWidth = parseInt(body.width, 10) || 0;
  const requestedHeight = parseInt(body.height, 10) || 0;
  if ((requestedWidth || requestedHeight) && (
      requestedWidth < 256 || requestedHeight < 256 ||
      requestedWidth > Math.max(cap.width, cap.height) ||
      requestedHeight > Math.max(cap.width, cap.height))) {
    return jsonRes(res, 422, {
      error: `width/height must be 256–${Math.max(cap.width, cap.height)} (got ${requestedWidth}x${requestedHeight})`,
    });
  }

  const free = diskFreeMb(ROOT);
  if (free >= 0 && free < config.minFreeDiskMb) {
    return jsonRes(res, 507, { error: `insufficient disk: ${free}MB free, need ${config.minFreeDiskMb}MB` });
  }

  const validation = await validateComposition();
  if (!validation.ok) return jsonRes(res, 422, { error: validation.error });

  const outPath = path.join(RENDERS_DIR, `${renderId}.${format}`);
  res.writeHead(200, { 'content-type': 'application/x-ndjson' });
  ndjson(res, {
    type: 'queued',
    renderId,
    durationSeconds: validation.durationSeconds,
    format,
    width: requestedWidth || null,
    height: requestedHeight || null,
  });

  const renderArgs = [
    'hyperframes', 'render',
    '--workers', String(config.workers),
    '--fps', String(config.fps),
    '--quality', config.quality,
    '--format', format,
    '--output', outPath,
  ];
  // Pass viewport overrides only when the caller specified them. Hyperframes
  // falls back to the composition's data-width/data-height otherwise, so the
  // composition's @media reflow still works for the default case.
  if (requestedWidth) renderArgs.push('--width', String(requestedWidth));
  if (requestedHeight) renderArgs.push('--height', String(requestedHeight));
  ndjson(res, { type: 'started', cmd: 'npx ' + renderArgs.join(' ') });

  const child = spawn('npx', renderArgs, { cwd: ROOT, env: process.env });
  let totalFrames = Math.round(validation.durationSeconds * config.fps);
  let lastFramesDone = -1;

  function parseLine(line) {
    if (!line) return;
    const m = line.match(/(\d+)\s*\/\s*(\d+)\s*frames?/i);
    if (m) {
      const done = parseInt(m[1], 10);
      const total = parseInt(m[2], 10);
      totalFrames = total;
      if (done !== lastFramesDone) {
        lastFramesDone = done;
        ndjson(res, { type: 'progress', framesDone: done, framesTotal: total });
      }
    } else {
      ndjson(res, { type: 'log', line });
    }
  }

  let stdoutBuf = '', stderrBuf = '';
  child.stdout.on('data', (chunk) => {
    stdoutBuf += chunk.toString();
    let i;
    while ((i = stdoutBuf.indexOf('\n')) !== -1) {
      parseLine(stdoutBuf.slice(0, i).trim());
      stdoutBuf = stdoutBuf.slice(i + 1);
    }
  });
  child.stderr.on('data', (chunk) => {
    stderrBuf += chunk.toString();
    let i;
    while ((i = stderrBuf.indexOf('\n')) !== -1) {
      parseLine(stderrBuf.slice(0, i).trim());
      stderrBuf = stderrBuf.slice(i + 1);
    }
  });

  child.on('exit', (code) => {
    if (code !== 0) {
      ndjson(res, { type: 'error', message: `render exited with code ${code}` });
      return res.end();
    }
    try {
      const st = statSync(outPath);
      ndjson(res, {
        type: 'done',
        artifactPath: `/__artifacts/${renderId}`,
        sizeBytes: st.size,
        durationSeconds: validation.durationSeconds,
        framesTotal: totalFrames,
      });
    } catch (e) {
      ndjson(res, { type: 'error', message: 'render finished but output missing: ' + e.message });
    }
    res.end();
  });

  req.on('close', () => { if (!child.killed) child.kill('SIGTERM'); });
}

// findArtifact locates the rendered file for a renderId across all allowed
// formats, returning { path, ext, contentType } or null. Each render writes
// exactly one file, but the caller-chosen format may differ from config.format.
function findArtifact(renderId) {
  const safe = renderId.replace(/[^a-zA-Z0-9_-]/g, '');
  for (const ext of [config.format, ...ALLOWED_FORMATS]) {
    const file = path.join(RENDERS_DIR, `${safe}.${ext}`);
    try {
      statSync(file);
      const ctype = MIME['.' + ext] || 'application/octet-stream';
      return { path: file, ext, contentType: ctype };
    } catch { /* try next */ }
  }
  return null;
}

async function handleArtifactGet(_req, res, renderId) {
  const found = findArtifact(renderId);
  if (!found) return jsonRes(res, 404, { error: 'artifact not found' });
  const st = statSync(found.path);
  res.writeHead(200, { 'content-type': found.contentType, 'content-length': st.size });
  createReadStream(found.path).pipe(res);
}

async function handleArtifactDelete(_req, res, renderId) {
  const found = findArtifact(renderId);
  if (!found) return jsonRes(res, 404, { error: 'artifact not found' });
  try { await fsp.unlink(found.path); jsonRes(res, 200, { deleted: true }); }
  catch (e) { jsonRes(res, 500, { error: e.message }); }
}

// Loads the rendered MP4 in a centered, looping <video> tag. Used by the
// frontend to swap the iframe src after a render completes so the user can
// review the actual export (with controls) before downloading. The MP4 is
// served from /__artifacts/:renderId on the same origin.
function handlePlayer(_req, res, renderId) {
  const safe = renderId.replace(/[^a-zA-Z0-9_-]/g, '');
  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Render ${safe}</title>
  <style>
    html, body { margin: 0; height: 100%; background: #000; }
    body { display: flex; align-items: center; justify-content: center; }
    video { max-width: 100%; max-height: 100%; display: block; }
  </style>
</head>
<body>
  <video controls autoplay loop playsinline src="/__artifacts/${safe}"></video>
</body>
</html>`;
  res.writeHead(200, {
    'content-type': 'text/html; charset=utf-8',
    'cache-control': 'no-store',
  });
  res.end(html);
}

// ---------- server ----------

const server = http.createServer(async (req, res) => {
  const u = url.parse(req.url, true);

  // CORS preflight — answer all OPTIONS requests with the allow headers.
  if (req.method === 'OPTIONS') {
    res.writeHead(204, CORS_HEADERS);
    return res.end();
  }

  // /health-coder — required by the SuperAGI PreviewFrame component to verify
  // the dev server is alive before mounting the iframe. Returns CORS headers.
  if (u.pathname === '/health-coder' && req.method === 'GET') {
    return jsonRes(res, 200, { ok: true, service: 'video-gen' });
  }

  // /__formats — quick capability probe for clients.
  if (u.pathname === '/__formats' && req.method === 'GET') {
    return jsonRes(res, 200, { formats: ALLOWED_FORMATS, defaultFormat: config.format });
  }

  if (u.pathname === '/__health' && req.method === 'GET') return handleHealth(req, res);
  if (u.pathname === '/__render' && req.method === 'POST') return handleRender(req, res);

  const m = u.pathname.match(/^\/__artifacts\/([^\/]+)$/);
  if (m) {
    if (req.method === 'GET') return handleArtifactGet(req, res, m[1]);
    if (req.method === 'DELETE') return handleArtifactDelete(req, res, m[1]);
  }

  const playerMatch = u.pathname.match(/^\/__player\/([^\/]+)$/);
  if (playerMatch && req.method === 'GET') {
    return handlePlayer(req, res, playerMatch[1]);
  }

  if (req.method === 'GET' || req.method === 'HEAD') return serveStatic(req, res, u.pathname);
  return notFound(res);
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[preview] serving ${ROOT} on :${PORT}`);
});

function shutdown(sig) {
  console.log(`[preview] received ${sig}, shutting down`);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 5000).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
