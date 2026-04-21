# `lib/` — small JavaScript helpers

These are **utility helpers** for things the upstream Hyperframes registry doesn't ship as drop-in components. Use them when you need orchestration helpers (timeline crossfade, number count-up, marquee scroll) inside a single composition.

## Available helpers

| File | Purpose | When to use |
| --- | --- | --- |
| `scene-fader.js` | `HFScenes.fade(tl, [{id, start, end}])` — auto-crossfade scene containers | Multi-scene flat compositions; pass an array of scene IDs + timing |
| `count-up.js` | `HFCount(tl, '#stat', 32000, time, opts)` — animate a number with locale formatting | Stat reveals, milestone counters |
| `particles.js` | `HFParticles('#field', { count, color })` — floating dots drifting upward | Atmosphere for celebration / proof scenes |
| `marquee.js` | `HFMarquee('.row', { speed, direction })` — infinite-scroll text strip | Customer logo strips, scrolling tickers |
| `cursor.js` | `HFCursor(tl, '#button', arriveAt, clickAt)` — animated cursor that glides + clicks | CTA scenes, "click here" emphasis |

## Loading

```html
<script src="lib/scene-fader.js"></script>
<script src="lib/count-up.js"></script>
<!-- ...as needed -->
```

## Use the registry FIRST for richer effects

The bundled `.hyperframes-skills/registry/` directory has 39 production-quality composition blocks and 3 visual components — DO NOT reinvent these in lib/.

Browse before writing:

```bash
ls .hyperframes-skills/registry/components/   # grain-overlay, shimmer-sweep, grid-pixelate-wipe
ls .hyperframes-skills/registry/blocks/       # 39 blocks: light-leak, glitch, data-chart,
                                              # logo-outro, transitions-*, social cards, etc.
ls .hyperframes-skills/registry/examples/     # 8 polished full reels
```

To use a registry block: `cat .hyperframes-skills/registry/blocks/<name>/<name>.html` and either inline the snippet directly into your composition, OR copy it to `compositions/<name>.html` and reference via `data-composition-src`.

| If you need... | Use the registry block |
| --- | --- |
| Light leak / sweep | `blocks/light-leak/light-leak.html` |
| Film grain | `components/grain-overlay/grain-overlay.html` |
| Shimmer / highlight pass | `components/shimmer-sweep/shimmer-sweep.html` |
| Glitch effect | `blocks/glitch/glitch.html` |
| Bar / line chart | `blocks/data-chart/data-chart.html` |
| Logo reveal / outro | `blocks/logo-outro/logo-outro.html` |
| Social card mock | `blocks/spotify-card/`, `instagram-follow/`, `tiktok-follow/`, `x-post/`, `reddit-post/` |
| YouTube lower-third | `blocks/yt-lower-third/yt-lower-third.html` |
| macOS notification | `blocks/macos-notification/macos-notification.html` |
| Cinematic zoom | `blocks/cinematic-zoom/cinematic-zoom.html` |
| Scene transitions | `blocks/transitions-*` (16 variants: blur, dissolve, push, scale, radial, 3d, etc.) |
| Flowchart / decision tree | `blocks/flowchart/`, `examples/decision-tree/` |

When in doubt: registry first, lib/ second, hand-write last.
