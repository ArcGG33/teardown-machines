// Frame-by-frame render. For every frame: seek the timeline to i / 30 s, draw, screenshot to PNG. Then ffmpeg builds the MP4.
// Nothing is recorded in real time, so a slow machine gives the same film as a fast one, only later.
//
//   node scripts/render.mjs --format both            both films into out/
//   node scripts/render.mjs --format landscape       1920x1080 only
//   node scripts/render.mjs --stills 0,5,10,22       single frames into out/stills/ (quick check before a full run)
//
// Options: --dpr 2 (supersampling, 1 = fastest)  --from 0 --to 25 (seconds)  --resume (keep frames already on disk)
//          --keep (do not delete the PNG frames after encoding)  --crf 14  --software (force CPU rendering)
// Environment: FFMPEG = path to ffmpeg, CHROME_PATH = use this browser instead of the one puppeteer downloaded.
import puppeteer from 'puppeteer';
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {startServer} from './serve.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'out');
const FFMPEG = process.env.FFMPEG || 'ffmpeg';
const SIZES = {landscape: [1920, 1080], portrait: [1080, 1920]};

const args = process.argv.slice(2);
const opt = (name, def) => { const i = args.indexOf('--' + name); return i < 0 ? def : args[i + 1]; };
const flag = (name) => args.includes('--' + name);
const formats = (() => { const f = opt('format', 'landscape'); return f === 'both' ? ['landscape', 'portrait'] : [f]; })();
const stills = opt('stills', null);
const dpr = +opt('dpr', stills ? 1 : 2);
const crf = opt('crf', '14');

for (const f of formats) if (!SIZES[f]) { console.error(`Unknown format "${f}". Use landscape, portrait or both.`); process.exit(1); }
if (!stills && spawnSync(FFMPEG, ['-version']).status !== 0) {
  console.error('ffmpeg was not found. Install it (https://ffmpeg.org/download.html) or set FFMPEG to its full path.');
  process.exit(1);
}

const server = await startServer();
const browser = await puppeteer.launch({
  headless: true,
  executablePath: process.env.CHROME_PATH || undefined,
  args: [
    '--hide-scrollbars', '--force-color-profile=srgb', '--disable-background-timer-throttling', '--disable-renderer-backgrounding',
    '--disable-backgrounding-occluded-windows', '--enable-webgl', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader',
    ...(flag('software') ? ['--use-angle=swiftshader'] : ['--enable-gpu', '--force_high_performance_gpu', ...(process.platform === 'win32' ? ['--use-angle=d3d11'] : [])]),
    ...(process.platform === 'linux' ? ['--no-sandbox'] : []),
  ],
});

async function open(format) {
  const [w, h] = SIZES[format];
  const page = await browser.newPage();
  page.on('pageerror', (e) => { console.error('PAGE ERROR:', e.message); process.exitCode = 1; });
  page.on('console', (m) => { if (m.type() === 'error') console.error('console:', m.text()); });
  await page.setViewport({width: w, height: h, deviceScaleFactor: dpr});
  await page.goto(`${server.url}/?capture&format=${format}`, {waitUntil: 'load'});
  await page.waitForFunction('window.__film', {timeout: 120000});
  await page.evaluate(() => window.__film.ready);
  const info = await page.evaluate(() => ({gpu: window.__film.gpu, fps: window.__film.fps, duration: window.__film.duration}));
  console.log(`[${format}] ${w}x${h} @ dpr ${dpr} | GPU: ${info.gpu}`);
  if (/swiftshader|llvmpipe|software/i.test(info.gpu)) console.log(`[${format}] note: software rendering. The picture is the same, it just takes longer.`);
  return {page, info, w, h};
}
const shot = async (page, t, file) => {
  await page.evaluate((t) => window.__film.seek(t), t);
  await page.screenshot({path: file, type: 'png', optimizeForSpeed: true});
};

try {
  for (const format of formats) {
    const {page, info, w, h} = await open(format);
    if (stills) {
      const dir = path.join(OUT, 'stills');
      fs.mkdirSync(dir, {recursive: true});
      for (const s of stills.split(',')) {
        const t = +s, file = path.join(dir, `${format}-${t.toFixed(2).padStart(5, '0')}.png`);
        await shot(page, t, file);
        console.log('  ' + path.relative(ROOT, file));
      }
      await page.close();
      continue;
    }

    const dir = path.join(OUT, `frames-${format}`);
    if (!flag('resume')) fs.rmSync(dir, {recursive: true, force: true});
    fs.mkdirSync(dir, {recursive: true});
    const total = Math.round(info.duration * info.fps);
    const i0 = Math.round(+opt('from', 0) * info.fps), i1 = Math.min(total, Math.round(+opt('to', info.duration) * info.fps));
    const t0 = Date.now();
    for (let i = i0; i < i1; i++) {
      const file = path.join(dir, String(i - i0).padStart(5, '0') + '.png');
      if (!(flag('resume') && fs.existsSync(file) && fs.statSync(file).size > 0)) await shot(page, i / info.fps, file);
      if ((i - i0) % 30 === 29 || i === i1 - 1) {
        const done = i - i0 + 1, el = (Date.now() - t0) / 1000;
        console.log(`[${format}] frame ${done}/${i1 - i0}  ${el.toFixed(0)}s elapsed, ~${((el / done) * (i1 - i0 - done)).toFixed(0)}s left`);
      }
    }
    await page.close();

    const mp4 = path.join(OUT, `torvane-lx-${w}x${h}.mp4`);
    const ff = spawnSync(FFMPEG, [
      '-y', '-hide_banner', '-loglevel', 'error', '-framerate', String(info.fps), '-i', path.join(dir, '%05d.png'),
      '-vf', `scale=${w}:${h}:flags=lanczos:out_color_matrix=bt709:out_range=tv,format=yuv420p`,
      '-c:v', 'libx264', '-preset', 'slow', '-crf', crf, '-profile:v', 'high', '-pix_fmt', 'yuv420p', '-r', String(info.fps),
      '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709', '-color_range', 'tv', '-movflags', '+faststart', mp4,
    ], {stdio: 'inherit'});
    if (ff.status !== 0) throw new Error('ffmpeg failed for ' + format);
    if (!flag('keep')) fs.rmSync(dir, {recursive: true, force: true});
    console.log(`[${format}] done → ${path.relative(ROOT, mp4)} (${(fs.statSync(mp4).size / 1e6).toFixed(1)} MB, ${i1 - i0} frames, ${info.fps} fps, H.264 yuv420p)`);
  }
} finally {
  await browser.close();
  server.close();
}
