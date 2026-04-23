# HyperFrames Composition Project

## Skills + registry (bundled offline at `.hyperframes-skills/`)

The full upstream Hyperframes knowledge bundle ships inside this image. No
network access required — read these files directly when authoring or editing
compositions.

```
.hyperframes-skills/
├── hyperframes/            # composition authoring, captions, TTS, audio-reactive,
│                           # palettes, motion principles, anti-patterns
├── gsap/                   # GSAP timelines, easing, performance patterns
├── hyperframes-cli/        # CLI reference (init, lint, preview, render, ...)
├── hyperframes-registry/   # how to use the registry
├── website-to-hyperframes/ # convert a web page into a composition
├── registry/               # 50 production-quality assets — START HERE for any look:
│   ├── registry.json       #   manifest of all items
│   ├── examples/           #   8 polished full compositions (warm-grain, kinetic-type,
│   │                       #   swiss-grid, vignelli, nyt-graph, product-promo, ...)
│   ├── blocks/             #   39 reusable scene blocks (transitions, social cards,
│   │                       #   charts, lower-thirds, light leaks, glitch, ...)
│   └── components/         #   3 reusable visual components (grain-overlay,
│                           #   shimmer-sweep, grid-pixelate-wipe)
├── schema/                 # JSON schemas: hyperframes.json, registry-item.json
└── reference/              # html-schema.mdx — formal HTML composition schema
```

**Workflow rule of thumb:**

1. **Check `registry/` first** for any visual look the user asks for. The
   examples and blocks are the upstream's curated production-quality patterns
   — copying or adapting one beats inventing from scratch every time.
2. Each skill has a `SKILL.md` (entry point) plus `references/` and often
   `palettes/` or `examples/`. Consult the relevant `SKILL.md` before
   authoring — it encodes `window.__timelines` registration, `data-*`
   semantics, color palettes, and motion rules that are not in generic web
   docs.
3. Use `schema/` and `reference/` when validating structure or debugging
   "why isn't my composition rendering correctly".

Skipping the registry produces visually weak compositions even when the
technical structure is correct.

## Commands

```bash
npx hyperframes preview      # preview in browser (studio editor)
npx hyperframes render       # render to MP4
npx hyperframes lint         # validate compositions (errors + warnings)
npx hyperframes lint --json  # machine-readable output for CI
npx hyperframes docs <topic> # reference docs in terminal
```

## Project Structure

- `index.html` — main composition (root timeline)
- `compositions/` — sub-compositions referenced via `data-composition-src`
- `assets/` — media files (video, audio, images)
- `meta.json` — project metadata (id, name)
- `transcript.json` — whisper word-level transcript (if generated)

## Linting — Always Run After Changes

After creating or editing any `.html` composition, run the linter before considering the task complete:

```bash
npx hyperframes lint
```

Fix all errors before presenting the result.

## Key Rules

1. Every timed element needs `data-start`, `data-duration`, and `data-track-index`
2. Visible timed elements **must** have `class="clip"` — the framework uses this for visibility control
3. GSAP timelines must be paused and registered on `window.__timelines`:
   ```js
   window.__timelines = window.__timelines || {};
   window.__timelines["composition-id"] = gsap.timeline({ paused: true });
   ```
4. Videos use `muted` with a separate `<audio>` element for the audio track
5. Sub-compositions use `data-composition-src="compositions/file.html"` — the
   Hyperframes preview runtime (loaded in `index.html` `<head>`) handles fetching
6. Only deterministic logic — no `Date.now()`, no `Math.random()`, no network fetches

## Critical Patterns (sandbox-specific)

These rules are tuned to the SuperAGI coder sandbox + iframe preview. Violating
them produces silent bugs (invisible elements, hung iframe, no animation).

### A. GSAP `fromTo` not `from`

```js
// ❌ BAD — if CSS has #title { opacity: 0 }, this animates 0 → 0 (invisible).
tl.from('#title', { opacity: 0, duration: 0.5 });

// ✅ GOOD — explicit start AND end states.
tl.fromTo('#title', { opacity: 0 }, { opacity: 1, duration: 0.5 });
```

**Always prefer `fromTo`.** It removes the "from-tween-to-current-value" footgun.

### B. z-index convention

```
z-index: 1   → bg-layer (gradient, glow, grain, sweeps)
z-index: 10  → scenes (actual content)
z-index: 50  → persistent overlays (wordmark, version label, section index)
z-index: 80  → modals/popups
```

If `bg-layer` has `z-index: 1` and your scenes have no z-index, the bg layer
covers all scenes (silent visibility bug). **Always set `z-index: 10` on
`.scene` containers** when you have a z-indexed background.

### C. Track-index convention

```
data-track-index="0" → audio
data-track-index="1" → background layer (full-bleed visuals)
data-track-index="2" → hero content (headlines, hero stats, CTAs)
data-track-index="3" → supporting content (subtitles, pills, secondary text)
data-track-index="4" → foreground accents (particles, cursors, decorative SVG)
data-track-index="5" → persistent overlays (wordmark, section index)
```

Lint flags two clips overlapping on the same track. Use different track
indices for layered elements.

### D. No external image assets

Sandbox network policy can't reliably fetch external `<img src="https://...">`
sources. Use **CSS gradients, inline SVG, CSS-shaped divs, and styled text**
only. For "logos" use monospace text labels as placeholders.

### E. Layout philosophy — fill the canvas

Don't center one element with empty space around it. Distribute content across
the 1280×720 frame:

- Persistent wordmark **top-left** (z:50)
- Persistent version label or "section index" **bottom-right** (z:50)
- Hero content **center or split-pane** (z:10)
- Decorative accents in **corners** (z:10)
- Background gradient **full-bleed** (z:1)

Reference `.hyperframes-skills/registry/examples/swiss-grid` and
`/vignelli` for layout discipline.

### E2. Responsive layout (MUST)

Every composition renders at three aspects: **landscape 1280×720**, **portrait
720×1280**, **square 1024×1024**. The user toggles these in the editor preview
header AND picks one at export time. The boilerplate `index.html` ships with
top-level `@media` rules that resize `html, body, #root` for portrait + square
— **leave those rules in place**. For every scene/element you author, also add
matching `@media` overrides that reflow the layout (not just shrink it):

```css
/* landscape default — side-by-side hero + tagline */
.hero-row { display: flex; flex-direction: row; gap: 48px; align-items: center; }
#hero { font-size: 140px; }
#tag  { font-size: 22px; }

/* portrait 9:16 — stack vertically, smaller fonts */
@media (max-aspect-ratio: 1/1) {
  .hero-row { flex-direction: column; gap: 24px; }
  #hero { font-size: 96px; }
  #tag  { font-size: 18px; }
}

/* square 1:1 — balanced, slight shrink */
@media (aspect-ratio: 1/1) {
  #hero { font-size: 120px; }
  #tag  { font-size: 20px; }
}
```

Mental check before finishing: walk through each aspect — content should fill
the frame edge-to-edge, no black bars, no overflow, no overlap.

### F. Use the registry first

`.hyperframes-skills/registry/` ships **39 production-quality blocks** + **3
visual components** + **8 polished example reels**. Browse before authoring:

```bash
ls .hyperframes-skills/registry/components/   # grain-overlay, shimmer-sweep, grid-pixelate-wipe
ls .hyperframes-skills/registry/blocks/       # 39 blocks (light-leak, glitch, data-chart, ...)
ls .hyperframes-skills/registry/examples/     # 8 polished reels
```

To use a block: `cat .hyperframes-skills/registry/blocks/<name>/<name>.html`
and either inline directly OR copy to `compositions/<name>.html` and reference
via `data-composition-src`.

### G. Use `lib/` helpers for orchestration

`lib/` ships small JS helpers the registry doesn't cover:

| Helper | Purpose |
| --- | --- |
| `lib/scene-fader.js` | Auto-crossfade scene containers (`HFScenes.fade`) |
| `lib/count-up.js` | Animate a number with locale formatting (`HFCount`) |
| `lib/particles.js` | Floating dots drift upward (`HFParticles`) |
| `lib/marquee.js` | Infinite-scroll text/logo strip (`HFMarquee`) |
| `lib/cursor.js` | Animated cursor that glides + clicks (`HFCursor`) |

Load only what you need: `<script src="lib/count-up.js"></script>`.

### H. Composition timing fits root window

If `#root` has `data-duration="5"`, every child clip's `data-start +
data-duration` must be ≤ 5. Lint flags overflow.

### I. Don't edit infrastructure files

Never modify these — they're sandbox plumbing:

- `preview-proxy.js` (HTTP server + autoplay wrapper)
- `render.config.json` (render caps)
- `meta.json` (project metadata)
- `package.json` (deps)
- `lib/*.js` (utility helpers)

## Documentation

Full docs: https://hyperframes.heygen.com/introduction

Machine-readable index for AI tools: https://hyperframes.heygen.com/llms.txt
