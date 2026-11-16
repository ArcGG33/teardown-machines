// One page, three uses:
//   index.html                      live: the film plays, and you can scrub, orbit, explode and run it yourself
//   index.html?format=portrait      same, 9:16
//   index.html?capture&format=…     frame capture: nothing moves until window.__film.seek(t) is called
import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {buildMachine} from './machine.js';
import {buildTimeline, DURATION, FPS, BEATS} from './timeline.js';
import {createStage} from './stage.js';
import {createOverlay, SIZE} from './overlay.js';
import {UI} from './content.js';

const q = new URLSearchParams(location.search);
const capture = q.has('capture');
const format = q.get('format') || (innerWidth < innerHeight * 0.8 ? 'portrait' : 'landscape');
const [W, H] = SIZE[format];
const $ = (id) => document.getElementById(id);
const frame = $('frame'), canvas = $('gl'), ui = $('ui'), controls = $('controls');

const fx = capture ? !q.has('nofx') : q.has('fx');
const stage = createStage(canvas, {format, capture, bloom: fx, shadowSize: +(q.get('shadow') || (capture ? 4096 : 2048))});
const machine = buildMachine();
stage.add(machine);
const film = buildTimeline(machine, format);
const overlay = createOverlay(ui, format);

const v = new THREE.Vector3();
const project = (id) => {
  machine.anchor(id, v).project(stage.camera);
  return [(v.x * 0.5 + 0.5) * W, (0.5 - v.y * 0.5) * H];
};

function fit() {
  const bar = capture ? 0 : 64;
  const k = capture ? 1 : Math.min(innerWidth / W, (innerHeight - bar) / H);
  frame.style.width = W * k + 'px';
  frame.style.height = H * k + 'px';
  ui.style.transform = `scale(${k})`;
  stage.resize(W * k, H * k, capture ? devicePixelRatio : Math.min(devicePixelRatio, 1.5));
}

function renderAt(t) {
  const S = film.seek(t);
  machine.apply(S);
  stage.pose(S);
  overlay.update(S, project);
  stage.draw();
}

fit();
const ready = (async () => {
  await document.fonts.ready;
  await Promise.all([...document.fonts].map((f) => f.load().catch(() => {})));
  const S = film.seek(10.4); // the pose the labels are read at
  machine.apply(S); stage.pose(S);
  overlay.layout(project);
  await stage.renderer.compileAsync(stage.scene, stage.camera);
  renderAt(0);
})();

const raf2 = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
const gl = stage.renderer.getContext(), dbg = gl.getExtension('WEBGL_debug_renderer_info');
window.__film = {
  ready, duration: DURATION, fps: FPS, beats: BEATS, format, size: [W, H],
  gpu: dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : 'unknown',
  async seek(t) { renderAt(t); await raf2(); },
};

if (!capture) live();

function live() {
  document.body.classList.add('live');
  controls.hidden = false;
  let t = 0, playing = true, loopRun = false, last = performance.now();
  const orbit = new OrbitControls(stage.camera, canvas);
  orbit.enabled = false; orbit.enableDamping = true; orbit.minDistance = 250; orbit.maxDistance = 3200; orbit.maxPolarAngle = Math.PI * 0.495;

  const btn = (id, text, fn) => { const b = $(id); b.textContent = text; b.onclick = fn; return b; };
  const play = btn('play', UI.pause, () => setPlaying(!playing));
  const free = btn('free', UI.free, () => setFree(!stage.free));
  const run = btn('run', UI.run, () => { loopRun = true; t = BEATS.run; setPlaying(true); setFree(true); sync(); });
  btn('assembled', UI.assembled, () => hold(BEATS.explode - 0.01));
  btn('exploded', UI.exploded, () => hold(10.5));
  btn('format', format === 'portrait' ? UI.landscape : UI.portrait, () => {
    q.set('format', format === 'portrait' ? 'landscape' : 'portrait');
    location.search = q.toString();
  });
  const scrub = $('scrub'), time = $('time');
  scrub.oninput = () => { t = +scrub.value; loopRun = false; setPlaying(false); };

  function setPlaying(p) { playing = p; play.textContent = p ? UI.pause : UI.play; play.classList.toggle('primary', !p); sync(); }
  function setFree(f) {
    if (f && !stage.free) orbit.target.set(film.S.cam.tx, film.S.cam.ty, film.S.cam.tz);
    stage.free = orbit.enabled = f;
    canvas.style.cursor = f ? 'grab' : '';
    free.textContent = f ? UI.film : UI.free;
    free.title = UI.hint;
    sync();
  }
  function hold(at) { loopRun = false; t = at; setPlaying(false); setFree(true); }
  function sync() { free.classList.toggle('on', stage.free); run.classList.toggle('on', loopRun); }

  addEventListener('resize', fit);
  addEventListener('keydown', (e) => { if (e.code === 'Space') { e.preventDefault(); setPlaying(!playing); } });
  ready.then(() => {
    setPlaying(true);
    requestAnimationFrame(function tick(now) {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      if (playing) {
        t += dt;
        if (loopRun) { if (t >= BEATS.hero) t = BEATS.run + (t - BEATS.hero); }
        else if (t >= DURATION + 2) t = 0; // hold the hero shot for two seconds, then start again
      }
      const tt = Math.min(t, DURATION);
      if (stage.free) orbit.update();
      renderAt(tt);
      scrub.value = tt; time.textContent = tt.toFixed(1).padStart(4, '0');
      requestAnimationFrame(tick);
    });
  });
}
