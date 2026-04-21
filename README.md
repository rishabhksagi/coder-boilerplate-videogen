# coder-sandbox-hyperframes

Sandbox image for the SuperAGI coder service's `video-gen` template.

Wraps [Hyperframes](https://github.com/heygen-com/hyperframes) — a deterministic
HTML-to-video framework — with a thin preview/render proxy so the coder service
can drive composition editing and MP4 export over HTTP.

## What's in here

| File | Purpose |
| --- | --- |
| `Dockerfile` | Image build (Node 22, Chromium + chrome-headless-shell, FFmpeg, fonts) |
| `index.html` | Starter composition: 1280×720, 5s, GSAP timeline with a "Hello, world." title |
| `meta.json` | Project metadata `{ id, name }` |
| `compositions/` | Sub-compositions (referenced via `data-composition-src`) |
| `assets/` | Media files (video, audio, images) |
| `preview-proxy.js` | Static file server on :5173 + `/__render`, `/__artifacts/:id`, `/__health` |
| `render.config.json` | Render defaults + caps (Modal-tuned: 30s, 1280×720, 1 worker) |
| `package.json` | Pins `hyperframes@0.4.4` |
| `AGENTS.md` | Hyperframes conventions for any agent inspecting the project |

## Build

```bash
docker build -t coder-sandbox-hyperframes:dev .
```

## Run locally

```bash
docker run --rm -p 5173:5173 --memory=1g --cpus=1 \
  --name hf-test coder-sandbox-hyperframes:dev \
  node preview-proxy.js
```

(`CMD` defaults to `sleep infinity` to match the other `coder-sandbox-*` images;
the coder service starts `node preview-proxy.js` via the template's
`devCommand`. The override above is for local testing.)

Open `http://localhost:5173` — composition plays on loop.

## HTTP API (consumed by the coder service)

| Endpoint | Method | Purpose |
| --- | --- | --- |
| `/` and any static path | GET | Serves the project files; `index.html` is augmented with an auto-play wrapper so the timeline plays on load |
| `/__health` | GET | `{ status, diskFreeMb, memoryUsageMb }` — backend preflight |
| `/__render` | POST | Body `{ renderId }`. Validates against `render.config.json`, runs `hyperframes render`, streams NDJSON progress, ends with `{ type: "done", artifactPath, sizeBytes }` |
| `/__artifacts/:renderId` | GET | Streams the rendered MP4 |
| `/__artifacts/:renderId` | DELETE | Frees disk after the backend uploads to S3 |

## Render budget (Modal-tuned)

Modal sandbox cap is 1 CPU / ~1Gi RAM. Defaults in `render.config.json`:

- 1280×720 max viewport
- 30s max composition duration
- 30 fps, `standard` quality (CRF ~28)
- 1 worker, streaming encoder (frames piped to FFmpeg, no per-frame disk write)
- 1024 MB minimum free disk before render

Lift these caps when the OpenSandbox migration lands (2 Gi / 10 Gi).
