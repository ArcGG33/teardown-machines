// Torvane LX: a ball-screw linear stage on two profile rails. All dimensions in mm, X = travel axis, Y = up.
// One input poses the whole drive train: the motor angle theta. The screw, coupling and motor shaft turn by theta,
// the carriage moves by -LEAD * theta / TAU, which is exactly where the thread groove built in geo.js goes.
import * as THREE from 'three';
import {TAU, poly, hole, disc, roundRect, chamferRect, extrudeX, extrudeY, latheX, tubeX, threadX, merge, boltGeo, bearingGeo, sector} from './geo.js';

export const AX = 33;      // screw axis height
export const LEAD = 10;    // screw lead (geometry only; never shown on screen)
const TOP = 24;            // base shoulder height (rails and bearing supports sit here)
const RZ = 45;             // rail centre line, +/- Z
const TIER = 95;           // exploded height of everything on the screw axis

export const travel = (theta) => (-LEAD * theta) / TAU;

function materials() {
  const std = (color, metalness, roughness, extra = {}) => new THREE.MeshStandardMaterial({color, metalness, roughness, ...extra});
  return {
    aluGraphite: std(0x3b3e44, 0.9, 0.44),
    aluSilver: std(0xc6c9ce, 1, 0.34),
    steel: std(0xd6d8dc, 1, 0.2),
    steelSatin: std(0xa4a7ad, 1, 0.3),
    blockSteel: std(0x555960, 1, 0.36),
    blackOxide: std(0x1b1c20, 1, 0.4),
    plastic: std(0x0f1012, 0, 0.55),
    stack: std(0x0c0c0d, 0.4, 0.5),
    castAlu: std(0x8e9197, 1, 0.48),
    spider: std(0x1d3a55, 0, 0.5),
    bore: std(0x040405, 0, 0.9),
    led: new THREE.MeshStandardMaterial({color: 0x0a1218, emissive: 0x8fd4ff, emissiveIntensity: 0, roughness: 0.3}),
  };
}

export function buildMachine() {
  const root = new THREE.Group();
  const M = materials();
  const parts = {}, sets = {};

  function part(id, o = {}) {
    const g = new THREE.Group();
    g.name = id;
    root.add(g);
    const parent = o.parent ? parts[o.parent] : null;
    const p = {
      id, g, base: new THREE.Vector3(...(o.base || [0, 0, 0])), dx: o.dx || 0, dy: o.dy || 0, bolt: o.bolt || null,
      parent, carriage: !!(o.carriage || (parent && parent.carriage)), spin: !!o.spin,
    };
    parts[id] = p;
    return p;
  }
  function mesh(p, geo, mat, shadow = true) {
    const m = new THREE.Mesh(geo, mat);
    m.castShadow = shadow; m.receiveShadow = true;
    p.g.add(m);
    return m;
  }
  const boltCache = {};
  // dir: 'down' (head up, driven toward -Y), 'px' (driven toward +X), 'nx' (driven toward -X)
  function boltG(d, len, dir) {
    const k = `${d}_${len}_${dir}`;
    if (!boltCache[k]) {
      const g = boltGeo(d, len);
      if (dir === 'px') g.rotateZ(Math.PI / 2);
      if (dir === 'nx') g.rotateZ(-Math.PI / 2);
      boltCache[k] = g;
    }
    return boltCache[k];
  }
  function bolts(set, parent, d, len, dir, positions, out) {
    sets[set] = sets[set] || [];
    positions.forEach((pos) => {
      const id = `${set}${sets[set].length}`;
      const p = part(id, {base: pos, parent, bolt: out});
      mesh(p, boltG(d, len, dir), M.blackOxide);
      sets[set].push(id);
    });
  }

  // ── Base: one aluminium extrusion with a centre channel for the screw and a slot down each side ──
  const baseShape = poly([[-65, 0], [65, 0], [65, 8], [61, 8], [61, 14], [65, 14], [65, 22.5], [63.5, 24], [27, 24], [27, 12], [-27, 12], [-27, 24],
    [-63.5, 24], [-65, 22.5], [-65, 14], [-61, 14], [-61, 8], [-65, 8]]);
  mesh(part('base'), extrudeX(baseShape, -190, 400, 0.7), M.aluGraphite);

  // ── Two profile rails with ball raceways down both flanks ──
  const railShape = poly([[-7.5, 0], [7.5, 0], [7.5, 6.4], [6.2, 7.9], [7.5, 9.4], [7.5, 12.3], [6.8, 13], [-6.8, 13], [-7.5, 12.3], [-7.5, 9.4], [-6.2, 7.9], [-7.5, 6.4]]);
  const rails = part('rails', {dy: 35});
  const railBoltPos = [], bores = [];
  for (const z of [RZ, -RZ]) {
    const g = extrudeX(railShape, -155, 325, 0.35);
    g.translate(0, TOP, z);
    mesh(rails, g, M.steel);
    for (let k = 0; k < 6; k++) {
      const x = -142.5 + 60 * k;
      railBoltPos.push([x, TOP + 13.05, z]);
      const c = new THREE.CircleGeometry(4.3, 24);
      c.rotateX(-Math.PI / 2); c.translate(x, TOP + 13.02, z);
      bores.push(c);
    }
  }
  mesh(rails, merge(bores), M.bore, false);
  railBoltPos.sort((a, b) => a[0] - b[0]);
  bolts('railBolts', 'rails', 4, 12, 'down', railBoltPos, [0, 30, 0]);

  // ── Four carriage blocks, two per rail ──
  const blockShape = poly([[-17, 27], [-8.3, 27], [-8.3, 38.3], [8.3, 38.3], [8.3, 27], [17, 27], [17, 46.6], [15.6, 48], [-15.6, 48], [-17, 46.6]]);
  const blocks = part('blocks', {dy: 150, carriage: true});
  const bodies = [], caps = [];
  for (const z of [RZ, -RZ]) for (const cx of [-32, 32]) {
    const b = extrudeX(blockShape, cx - 15, 30, 0.5); b.translate(0, 0, z); bodies.push(b);
    for (const x0 of [cx - 21, cx + 15]) { const c = extrudeX(blockShape, x0, 6, 0.9); c.translate(0, 0, z); caps.push(c); }
  }
  mesh(blocks, merge(bodies), M.blockSteel);
  mesh(blocks, merge(caps), M.plastic);

  // ── Slide table: real through holes for every bolt, plus tapped holes for the workpiece ──
  const tShape = roundRect(120, 134, 3);
  const tableBoltPos = [], bracketBoltPos = [];
  for (const cx of [-32, 32]) for (const z of [RZ, -RZ]) for (const ox of [-10, 10]) for (const oz of [-13, 13]) {
    tShape.holes.push(hole(4.5, cx + ox, -(z + oz)));
    tableBoltPos.push([cx + ox, 59, z + oz]);
  }
  for (const x of [-6, 6]) for (const z of [-14, 14]) { tShape.holes.push(hole(4.5, x, -z)); bracketBoltPos.push([x, 59, z]); }
  for (const [x, z] of [[0, 40], [0, -40], [52, 45], [52, -45], [-52, 45], [-52, -45], [32, 0], [-32, 0]]) tShape.holes.push(hole(2.6, x, -z));
  mesh(part('table', {dy: 210, carriage: true}), extrudeY(tShape, 48, 12, 0.8, 20), M.aluSilver);
  tableBoltPos.sort((a, b) => a[0] - b[0] || a[2] - b[2]);
  bolts('tableBolts', 'table', 5, 14, 'down', tableBoltPos, [0, 42, 0]);
  bolts('tableBolts', 'table', 5, 18, 'down', bracketBoltPos, [0, 42, 0]);

  // ── Ball nut and the bracket that ties it to the table ──
  const nbShape = chamferRect(46, 30, 1.2, 0, AX);
  nbShape.holes.push(hole(14.15, 0, AX));
  mesh(part('nutBracket', {dy: TIER, dx: 52, carriage: true}), extrudeX(nbShape, -12, 24, 0.7, 40), M.aluSilver);

  const fa = Math.asin(14 / 23);
  const flange = new THREE.Shape();
  flange.moveTo(23 * Math.cos(-fa), 23 * Math.sin(-fa));
  flange.absarc(0, 0, 23, -fa, fa, false);
  flange.lineTo(23 * Math.cos(Math.PI - fa), 23 * Math.sin(Math.PI - fa));
  flange.absarc(0, 0, 23, Math.PI - fa, Math.PI + fa, false);
  flange.closePath();
  flange.holes.push(hole(8.3));
  mesh(part('nut', {base: [0, AX, 0], dy: TIER, carriage: true}), merge([extrudeX(flange, -20, 8, 0.5, 40), tubeX(-12, 28, 8.3, 14, 0.6)]), M.steelSatin);
  bolts('nutBolts', 'nut', 4, 12, 'px', [[-24, AX + 7.8, 16.8], [-24, AX - 7.8, 16.8], [-24, AX + 7.8, -16.8], [-24, AX - 7.8, -16.8]], [-16, 0, 0]);

  // ── Ball screw: journals turned at both ends, helical groove between ──
  mesh(part('screw', {base: [0, AX, 0], dy: TIER, spin: true}), merge([
    latheX([[-214, 0], [-214, 3.6], [-213.6, 4], [-198, 4], [-198, 5], [-190, 5], [-190, 6], [-152, 6], [-150.5, 6.2], [-150.5, 8], [-148, 8]]),
    threadX(-148, 168, 8, LEAD, 1.5),
    latheX([[168, 8], [169.6, 8], [170, 7.6], [170, 5], [196, 5], [196, 4.5], [197, 4.5], [197, 5], [198.6, 5], [199, 4.6], [199, 0]]),
  ]), M.steel);

  // ── Fixed-side bearing support (motor end): housing, bearing pair, retainer cover, lock nut ──
  const housing = (bore) => {
    const s = poly([[-25, 13], [25, 13], [25, 24], [50, 24], [50, 36], [25, 36], [25, 54], [-25, 54], [-25, 36], [-50, 36], [-50, 24], [-25, 24]]);
    s.holes.push(hole(bore, 0, AX));
    return s;
  };
  mesh(part('housingF', {dy: TIER, dx: -80}), extrudeX(housing(14), -190, 30, 0.8, 40), M.aluGraphite);
  bolts('housingBolts', 'housingF', 5, 14, 'down', [[-183, 41, 40], [-183, 41, -40], [-167, 41, 40], [-167, 41, -40]], [0, 28, 0]);
  const brgF = bearingGeo(28, 12, 8, 9);
  mesh(part('bearingA', {base: [-181, AX, 0], dy: TIER, dx: -46}), brgF, M.steel);
  mesh(part('bearingB', {base: [-173, AX, 0], dy: TIER, dx: -40}), brgF, M.steel);
  const coverShape = roundRect(46, 38, 4);
  coverShape.holes.push(hole(8.5));
  mesh(part('cover', {base: [0, AX, 0], dy: TIER, dx: -14}), extrudeX(coverShape, -160, 5, 0.5, 32), M.aluSilver);
  bolts('axialBolts', 'cover', 3, 8, 'nx', [[-152, AX + 13, 17], [-152, AX - 13, 17], [-152, AX + 13, -17], [-152, AX - 13, -17]], [12, 0, 0]);
  const ln = [];
  for (let i = 0; i < 72; i++) {
    const a = (i / 72) * TAU, k = ((a / (Math.PI / 2)) % 1 + 1) % 1, near = Math.min(k, 1 - k) * 90;
    const r = near < 8 ? 9.2 : 11;
    ln.push([r * Math.cos(a), r * Math.sin(a)]);
  }
  const lnShape = poly(ln);
  lnShape.holes.push(hole(5));
  mesh(part('lockNut', {base: [0, AX, 0], dy: TIER, dx: -104, spin: true}), extrudeX(lnShape, -197, 7, 0.4), M.blackOxide);

  // ── Floating-side support: housing, single bearing, snap ring, end cap ──
  mesh(part('housingFl', {dy: TIER, dx: 62}), extrudeX(housing(13), 175, 20, 0.8, 40), M.aluGraphite);
  bolts('housingBolts', 'housingFl', 5, 14, 'down', [[185, 41, 40], [185, 41, -40]], [0, 28, 0]);
  mesh(part('bearingFl', {base: [190, AX, 0], dy: TIER, dx: 32}), bearingGeo(26, 10, 8, 8), M.steel);
  mesh(part('snapRing', {base: [0, AX, 0], dy: TIER, dx: 85, spin: true}), tubeX(196.05, 196.95, 4.55, 7, 0.15), M.blackOxide);
  const capRing = roundRect(50, 40, 4);
  capRing.holes.push(hole(12));
  mesh(part('endCap', {base: [0, AX, 0], dy: TIER, dx: 105}), merge([extrudeX(capRing, 195, 4, 0.4, 32), extrudeX(roundRect(50, 40, 4), 199, 3.5, 0.6)]), M.aluSilver);
  bolts('axialBolts', 'endCap', 3, 10, 'nx', [[205.5, AX + 14, 19], [205.5, AX - 14, 19], [205.5, AX + 14, -19], [205.5, AX - 14, -19]], [14, 0, 0]);

  // ── Jaw coupling: two hubs with three lugs each and an elastomer spider between ──
  function hub(id, x0, x1, jawAngles, dx) {
    const p = part(id, {base: [0, AX, 0], dy: TIER, dx, spin: true});
    mesh(p, merge([tubeX(x0, x1, 4, 12.5, 0.6), ...jawAngles.map((c) => extrudeX(sector(5.5, 12.5, c, 40), -225, 8, 0.4))]), M.aluSilver);
    const xm = (x0 + x1) / 2;
    const slit = new THREE.BoxGeometry(x1 - x0 + 0.2, 0.5, 8.8); slit.translate(xm, 0, -8.3);
    const grub = new THREE.CylinderGeometry(1.9, 1.9, 0.5, 6); grub.translate(xm, 12.45, 0);
    mesh(p, merge([slit, grub]), M.bore, false);
  }
  hub('hubA', -217, -206, [0, 120, 240], -118);
  const sp = [];
  for (let k = 0; k < 6; k++) {
    const c = 30 + 60 * k;
    for (const [r, o] of [[5.2, -14], [11.8, -8.5], [11.8, 0], [11.8, 8.5], [5.2, 14]]) {
      const a = ((c + o) * Math.PI) / 180;
      sp.push([r * Math.cos(a), r * Math.sin(a)]);
    }
  }
  mesh(part('spider', {base: [0, AX, 0], dy: TIER, dx: -132, spin: true}), extrudeX(poly(sp), -224.5, 7, 0.5), M.spider);
  hub('hubB', -236, -225, [60, 180, 300], -146);

  // ── Motor bracket (open on top so the coupling stays visible) and the stepper motor ──
  const uShape = poly([[-30, 3], [30, 3], [30, 63], [20, 63], [20, 11], [-20, 11], [-20, 63], [-30, 63]]);
  mesh(part('motorBracket', {dy: TIER, dx: -200}), extrudeX(uShape, -246, 56, 0.8), M.aluGraphite);

  const motor = part('motor', {base: [0, AX, 0], dy: TIER, dx: -236});
  mesh(motor, merge([
    extrudeX(roundRect(57, 57, 4), -251, 5, 0.5),
    extrudeX(chamferRect(56.4, 56.4, 16), -262, 11, 0.5),
    extrudeX(chamferRect(56.4, 56.4, 16), -302, 11, 0.8),
    latheX([[-246, 19], [-244.6, 19], [-244.6, 4.3]]),
    latheX([[-304.5, 0], [-304.5, 10.5], [-304, 11], [-302, 11]]),
  ]), M.castAlu);
  mesh(motor, extrudeX(chamferRect(55.6, 55.6, 15.6), -291, 29, 0.2), M.stack);
  const conn = new THREE.BoxGeometry(16, 8, 20); conn.translate(-293, 28.2 + 4, 0);
  mesh(motor, conn, M.plastic);
  const led = new THREE.CylinderGeometry(1.5, 1.5, 0.6, 16); led.translate(-293, 28.2 + 8.2, 6);
  mesh(motor, led, M.led, false);
  mesh(part('rotor', {base: [0, AX, 0], parent: 'motor', spin: true}), latheX([[-247, 4], [-226.5, 4], [-226, 3.5], [-226, 0]]), M.steel);
  const mb = 23.57;
  bolts('motorBolts', 'motor', 5, 12, 'px', [[-256, AX + mb, mb], [-256, AX - mb, mb], [-256, AX + mb, -mb], [-256, AX - mb, -mb]], [-16, 0, 0]);

  // Everything that rides at the screw-axis tier when exploded, split by when it closes up on reassembly.
  sets.core = ['nutBracket', 'housingF', 'bearingA', 'bearingB', 'cover', 'lockNut', 'housingFl', 'bearingFl', 'snapRing', 'endCap'];
  sets.drive = ['motorBracket', 'hubA', 'spider', 'hubB', 'motor'];
  sets.axis = ['screw', 'nut', ...sets.core, ...sets.drive];
  sets.coreBolts = [...sets.axialBolts, ...sets.nutBolts];

  // Label anchors: [part, point on it in assembled world coordinates]. Spin is ignored so a leader never wobbles.
  const anchors = {
    motor: ['motor', [-278, AX + 26, 22]], coupling: ['spider', [-221, AX + 10, 8]], support: ['housingF', [-175, 54, 18]],
    screw: ['screw', [95, AX + 8, 0]], nut: ['nut', [8, AX + 12, 8]], table: ['table', [34, 60, 44]], blocks: ['blocks', [40, 42, 62]],
    rails: ['rails', [150, TOP + 13, RZ]], base: ['base', [130, 16, 65]], endcap: ['endCap', [201, AX + 12, 22]],
  };
  const v = new THREE.Vector3();
  function anchor(id, out = v) {
    const [pid, o] = anchors[id];
    const p = parts[pid];
    return out.set(p.g.position.x - p.base.x + o[0], p.g.position.y - p.base.y + o[1], p.g.position.z - p.base.z + o[2]);
  }

  // state: {theta, parts: {id: {a, v, b}}}. a = axial explode 0..1, v = vertical, b = this bolt backed out along its axis.
  function apply(state) {
    const s = travel(state.theta);
    for (const id in parts) {
      const p = parts[id], src = p.parent || p, ps = state.parts[src.id], st = state.parts[id];
      const b = p.bolt ? st.b : 0;
      p.g.position.set(
        p.base.x + src.dx * ps.a + (p.carriage ? s : 0) + (p.bolt ? p.bolt[0] * b : 0),
        p.base.y + src.dy * ps.v + (p.bolt ? p.bolt[1] * b : 0),
        p.base.z + (p.bolt ? p.bolt[2] * b : 0));
      if (p.spin) p.g.rotation.x = state.theta;
    }
  }

  return {root, parts, sets, materials: M, apply, anchor};
}
