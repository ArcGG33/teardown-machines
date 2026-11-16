// The 25 s film as one paused GSAP timeline over a plain state object. seek(t) is the only way time moves,
// so any frame can be drawn on its own and the film, the live page and the frame capture can never disagree.
import gsap from 'gsap';
import {TAU} from './geo.js';
import {LEAD} from './machine.js';
import {LABELS} from './content.js';

export const DURATION = 25;
export const FPS = 30;
// Beats (s). The render script and README quote these.
export const BEATS = {reveal: 0, explode: 5, labels: 7.7, assemble: 13, run: 21, hero: 24, end: 25};
const RUN_TRAVEL = 90; // mm the table goes out before coming back (inside the rail length; not a product figure)

const rad = (d) => (d * Math.PI) / 180;

// Camera keys per format: [time, {target x/y/z, r = distance, az/el in degrees, fov}, ease into this key]
const CAMERA = {
  landscape: [
    [0, {tx: 40, ty: 34, tz: 0, r: 340, az: 66, el: 9, fov: 26}],
    [5, {tx: -46, ty: 30, tz: 0, r: 840, az: 50, el: 17, fov: 26}, 'power2.inOut'],
    [7.5, {tx: -115, ty: 150, tz: 0, r: 1680, az: 57, el: 24, fov: 26}, 'power3.inOut'],
    [13, {tx: -115, ty: 150, tz: 0, r: 1640, az: 48, el: 24, fov: 26}, 'sine.inOut'],
    [18.3, {tx: -160, ty: 70, tz: 0, r: 1280, az: 42, el: 21, fov: 26}, 'power2.inOut'],
    [20.8, {tx: -30, ty: 38, tz: 0, r: 760, az: 34, el: 20, fov: 26}, 'power2.inOut'],
    [23.2, {tx: -20, ty: 40, tz: 0, r: 720, az: 40, el: 21, fov: 26}, 'sine.inOut'],
    [24, {tx: -46, ty: 78, tz: 0, r: 980, az: 47, el: 10, fov: 26}, 'power3.inOut'],
    [25, {tx: -46, ty: 78, tz: 0, r: 960, az: 48, el: 10, fov: 26}, 'none'],
  ],
  portrait: [
    [0, {tx: 30, ty: 34, tz: 0, r: 520, az: 24, el: 22, fov: 30}],
    [5, {tx: -46, ty: 30, tz: 0, r: 1250, az: 16, el: 36, fov: 30}, 'power2.inOut'],
    [7.5, {tx: -115, ty: 120, tz: 0, r: 2250, az: 14, el: 42, fov: 30}, 'power3.inOut'],
    [13, {tx: -115, ty: 120, tz: 0, r: 2200, az: 19, el: 42, fov: 30}, 'sine.inOut'],
    [18.3, {tx: -160, ty: 60, tz: 0, r: 1950, az: 18, el: 40, fov: 30}, 'power2.inOut'],
    [20.8, {tx: -46, ty: 30, tz: 0, r: 1250, az: 18, el: 36, fov: 30}, 'power2.inOut'],
    [23.2, {tx: -30, ty: 30, tz: 0, r: 1200, az: 23, el: 36, fov: 30}, 'sine.inOut'],
    [24, {tx: -46, ty: -40, tz: 0, r: 1420, az: 26, el: 30, fov: 30}, 'power3.inOut'],
    [25, {tx: -46, ty: -40, tz: 0, r: 1400, az: 27, el: 30, fov: 30}, 'none'],
  ],
};

// Constant speed with a soft start and stop, so the screw never jumps to speed.
function trapezoid(f) {
  const v = 1 / (1 - f);
  return (p) => (p < f ? (0.5 * v * p * p) / f : p > 1 - f ? 1 - (0.5 * v * (1 - p) * (1 - p)) / f : v * (p - f / 2));
}

export function buildTimeline(machine, format) {
  const S = {
    theta: 0,
    cam: {...CAMERA[format][0][1]},
    light: {env: 0.02, sweep: -1.5, key: 0, rim: 0.3, blue: 0, led: 0},
    labels: LABELS.map(() => ({p: 0})),
    title: {p: 0, sub: 0},
    parts: {},
  };
  for (const id in machine.parts) S.parts[id] = {a: 0, v: 0, b: 0};

  const tl = gsap.timeline({paused: true});
  // One property, one explicit from → to. Nothing is read back from the object, so seeking is order-independent.
  const key = (obj, prop, t0, dur, from, to, ease = 'power3.inOut') =>
    tl.fromTo(obj, {[prop]: from}, {[prop]: to, duration: dur, ease, immediateRender: false}, t0);
  const move = (ids, ch, t0, dur, from, to, stagger = 0, ease) =>
    ids.forEach((id, i) => key(S.parts[id], ch, t0 + i * stagger, dur, from, to, ease));
  const {sets} = machine;

  // Camera
  const cams = CAMERA[format];
  for (let i = 1; i < cams.length; i++) {
    const [t0, a] = cams[i - 1], [t1, b, ease] = cams[i];
    for (const k in b) if (a[k] !== b[k]) key(S.cam, k, t0, t1 - t0, a[k], b[k], ease);
  }

  // 0–5 s: the machine comes out of the dark. Rim first, then the strip light sweeps its length, then the key.
  key(S.light, 'rim', 0, 1.4, 0.3, 1, 'power2.out');
  key(S.light, 'env', 0.8, 3.0, 0.02, 1, 'power2.inOut');
  key(S.light, 'sweep', 0.6, 4.0, -1.5, 0, 'power2.inOut');
  key(S.light, 'key', 2.4, 2.4, 0, 1, 'power2.inOut');

  // 5–7.5 s: take it apart. Bolts back out first, each layer lifts clear, then the screw axis spreads along its length.
  move(sets.tableBolts, 'b', 5.0, 0.45, 0, 1, 0.012);
  move(['table'], 'v', 5.25, 1.0, 0, 1);
  move(sets.housingBolts, 'b', 5.3, 0.4, 0, 1, 0.02);
  move(sets.axis, 'v', 5.55, 1.0, 0, 1);
  move(['blocks'], 'v', 5.75, 0.95, 0, 1);
  move(sets.railBolts, 'b', 5.9, 0.4, 0, 1, 0.02);
  move(['rails'], 'v', 6.05, 0.9, 0, 1);
  move([...sets.coreBolts, ...sets.motorBolts], 'b', 6.1, 0.4, 0, 1, 0.015);
  move(sets.axis, 'a', 6.35, 1.1, 0, 1);

  // 7.7–12.9 s: name each part and say what it does
  S.labels.forEach((l, i) => {
    key(l, 'p', BEATS.labels + i * 0.34, 0.6, 0, 1, 'power3.out');
    key(l, 'p', 12.45 + i * 0.02, 0.35, 1, 0, 'power2.in');
  });

  // 13–20.4 s: put it back in the order it is really built
  move(['rails'], 'v', 13.0, 1.1, 1, 0);
  move(sets.railBolts, 'b', 13.9, 0.45, 1, 0, 0.035);
  move(['blocks'], 'v', 14.1, 1.1, 1, 0);
  move(sets.core, 'a', 14.7, 1.2, 1, 0);          // bearings into housings, nut bracket onto the nut
  move(sets.coreBolts, 'b', 15.8, 0.4, 1, 0, 0.02);
  move(sets.axis, 'v', 16.2, 1.1, 1, 0);          // screw assembly down onto the base
  move(sets.housingBolts, 'b', 17.2, 0.4, 1, 0, 0.03);
  move(['table'], 'v', 17.4, 1.1, 1, 0);
  move(sets.tableBolts, 'b', 18.4, 0.45, 1, 0, 0.02);
  move(['motorBracket'], 'a', 18.5, 0.9, 1, 0);   // drive end closes up along the axis
  move(['hubA'], 'a', 18.7, 0.9, 1, 0);
  move(['spider'], 'a', 18.85, 0.9, 1, 0);
  move(['hubB'], 'a', 19.0, 0.9, 1, 0);
  move(['motor'], 'a', 19.1, 1.0, 1, 0);
  move(sets.motorBolts, 'b', 20.0, 0.35, 1, 0, 0.02);

  // 21–24 s: the motor turns the screw, the table goes out and back. theta is the only thing animated here.
  const turns = (RUN_TRAVEL / LEAD) * TAU;
  key(S.light, 'led', 20.6, 0.3, 0, 1, 'power2.out');
  key(S.light, 'blue', 20.5, 0.7, 0, 1, 'power2.inOut');
  key(S, 'theta', 21.0, 1.5, 0, -turns, trapezoid(0.25));
  key(S, 'theta', 22.5, 1.5, -turns, 0, trapezoid(0.25));
  key(S.light, 'blue', 23.6, 0.6, 1, 0.35, 'power2.inOut');

  // 24–25 s: hero shot and the name
  key(S.title, 'p', 24.0, 0.5, 0, 1, 'power3.out');
  key(S.title, 'sub', 24.15, 0.5, 0, 1, 'power3.out');

  tl.set({}, {}, DURATION);
  tl.progress(1).progress(0); // initialise every tween once, in order

  return {
    S, tl,
    seek(t) { tl.seek(Math.max(0, Math.min(DURATION, t)), false); return S; },
  };
}

export const camPos = (c, out) => {
  const az = rad(c.az), el = rad(c.el);
  return out.set(c.tx + c.r * Math.cos(el) * Math.cos(az), c.ty + c.r * Math.sin(el), c.tz + c.r * Math.cos(el) * Math.sin(az));
};
