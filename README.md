# Teardown-Machines

Offline 3D "teardown" videos: a real machine is assembled, taken apart part by part with labels,
then runs — and every frame is rendered deterministically to MP4. No screen recording, no real-time
capture, and no network access needed at render time (three.js and GSAP are vendored in the repo).

## Episodes

| Folder | Machine | Status |
| --- | --- | --- |
| `episodes/torvane-lx/` | Torvane LX — ball-screw linear stage, 25 s | page + timeline + render script working; stills checked in landscape only |
| `episodes/T01-tourbillon/` | tourbillon movement | not started |
| `episodes/T02-planetary-gearbox/` | planetary gearbox | not started |

## Render an episode

```
cd episodes/torvane-lx
npm install          # puppeteer + three + gsap (dev only, nothing is bundled into the page)
npm run stills       # 9 check frames → out/stills/
npm run render       # landscape 1920x1080 and portrait 1080x1920 → out/
```

Requirements: Node 18+, `ffmpeg` on PATH (or set `FFMPEG` to its full path), and a Chromium that
puppeteer can launch (or set `CHROME_PATH` to an existing Chrome/Edge binary).

### What makes the output identical on any machine

Each frame is rendered by seeking the timeline to `frame / fps`, drawing once, and screenshotting.
There is no real-time playback, so a slow GPU only costs wall-clock time, never picture quality.
Bit-for-bit stability of the encoder comes from fixed H.264 settings (`-crf`, `preset slow`, BT.709,
`yuv420p`, `+faststart`).

### Render options (`scripts/render.mjs`)

| Flag | Meaning |
| --- | --- |
| `--format landscape \| portrait \| both` | output size (default `landscape`) |
| `--dpr 2` | supersampling factor; `2` is the default for full renders, stills default to `1` |
| `--stills 0,5,10,22` | single frames instead of a film, written to `out/stills/` |
| `--from 0 --to 25` | render a time range in seconds |
| `--resume` | keep PNGs already on disk and continue |
| `--keep` | do not delete the frame PNGs after encoding |
| `--crf 14` | H.264 quality |
| `--software` | force SwiftShader/CPU rendering |

Frame PNGs go to `out/frames-<format>/` and are deleted after encoding unless `--keep` is passed.
Only `out/stills/` is committed; frame folders and MP4s are git-ignored.

## Interactive version

```
npm run serve        # http://127.0.0.1:5173/
```

Drag the timeline, orbit the camera, and switch between assembled / exploded / running.
URL switches:

- `?format=portrait` — 9:16 framing
- `?capture` — freeze the timeline; rendering drives it through `window.__film.seek(t)`
- `?capture&format=portrait&shadow=4096` — the combination the render script uses

`window.__film` exposes `ready`, `seek(t)`, `duration`, `fps` and the detected `gpu` string.

## Layout of an episode

```
index.html            page shell + import map
styles.css            page chrome
src/machine.js        the 3D machine: parts, materials, explode offsets
src/timeline.js       25 s timeline: explode, assemble, run, labels, brand card
src/geo.js            geometry helpers
src/stage.js          renderer, camera, lights, floor, environment
src/overlay.js        HTML part labels and the "示範 Demo" watermark
src/content.js        copy, part names, timings
scripts/render.mjs    frame-by-frame renderer + ffmpeg encode
scripts/serve.mjs     static server
scripts/fonts.mjs     one-off font fetch (fonts/ is committed, no network needed)
vendor/               three.js + GSAP, pinned, served locally
fonts/                Inter + Noto Sans TC subsets
```

## Known open items (torvane-lx)

- The floor was dimmed after the checked stills were produced, so the three PNGs in `out/stills/`
  predate the current lighting and show a copper-toned floor instead of a dark studio floor.
- Portrait framing and the opening / end-card frames have not been visually reviewed yet.
- One request for a missing file appears on page load (most likely `/favicon.ico`); it does not
  affect rendering.

## Notes

- Torvane LX is a fictional brand used for a demo reel. No real product or logo is depicted.
- Copy rules for this channel live in `CLAUDE.md` at the repo root.
