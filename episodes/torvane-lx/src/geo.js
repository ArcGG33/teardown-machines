// Reusable geometry builders (mm). No scene, no materials: shapes in, BufferGeometry out.
import * as THREE from 'three';
import {mergeGeometries, toCreasedNormals} from 'three/addons/utils/BufferGeometryUtils.js';

export const TAU = Math.PI * 2;
const CREASE = 0.5; // rad: faces meeting flatter than this are smoothed, sharper stay crisp

export function poly(pts) {
  const s = new THREE.Shape();
  pts.forEach(([x, y], i) => (i ? s.lineTo(x, y) : s.moveTo(x, y)));
  s.closePath();
  return s;
}
export function hole(r, cx = 0, cy = 0) {
  const p = new THREE.Path();
  p.absarc(cx, cy, r, 0, TAU, false);
  return p;
}
export function disc(r, cx = 0, cy = 0) {
  const s = new THREE.Shape();
  s.absarc(cx, cy, r, 0, TAU, false);
  return s;
}
export function roundRect(w, h, r, cx = 0, cy = 0) {
  const x0 = cx - w / 2, x1 = cx + w / 2, y0 = cy - h / 2, y1 = cy + h / 2;
  const s = new THREE.Shape();
  s.moveTo(x0 + r, y0);
  s.lineTo(x1 - r, y0); s.absarc(x1 - r, y0 + r, r, -Math.PI / 2, 0, false);
  s.lineTo(x1, y1 - r); s.absarc(x1 - r, y1 - r, r, 0, Math.PI / 2, false);
  s.lineTo(x0 + r, y1); s.absarc(x0 + r, y1 - r, r, Math.PI / 2, Math.PI, false);
  s.lineTo(x0, y0 + r); s.absarc(x0 + r, y0 + r, r, Math.PI, Math.PI * 1.5, false);
  return s;
}
export function chamferRect(w, h, c, cx = 0, cy = 0) {
  const x0 = cx - w / 2, x1 = cx + w / 2, y0 = cy - h / 2, y1 = cy + h / 2;
  return poly([[x0 + c, y0], [x1 - c, y0], [x1, y0 + c], [x1, y1 - c], [x1 - c, y1], [x0 + c, y1], [x0, y1 - c], [x0, y0 + c]]);
}

// Extrusion spanning local z 0..len with a chamfer of `bevel` that keeps the outline exactly the shape's size.
function extrude(shape, len, bevel, curveSegments) {
  const b = Math.max(0, Math.min(bevel, len / 2 - 0.01));
  let g = new THREE.ExtrudeGeometry(shape, {
    depth: len - 2 * b, bevelEnabled: b > 0, bevelThickness: b, bevelSize: b, bevelOffset: -b, bevelSegments: 1, curveSegments,
  });
  g.translate(0, 0, b);
  g.deleteAttribute('uv');
  g = toCreasedNormals(g, CREASE);
  return g;
}
// Profile drawn as (u = -Z, v = Y), extruded along +X from x0.
export function extrudeX(shape, x0, len, bevel = 0.5, cs = 24) {
  const g = extrude(shape, len, bevel, cs);
  g.rotateY(Math.PI / 2);
  g.translate(x0, 0, 0);
  return g;
}
// Profile drawn as (u = X, v = -Z), extruded along +Y from y0.
export function extrudeY(shape, y0, len, bevel = 0.5, cs = 24) {
  const g = extrude(shape, len, bevel, cs);
  g.rotateX(-Math.PI / 2);
  g.translate(0, y0, 0);
  return g;
}

// Turned part about the X axis. pts = [[x, r], ...] walked so the material is on the right:
// start at the left end, go up, along +x, back down. Every segment is its own band, so chamfers stay crisp.
export function latheX(pts, seg = 48) {
  const pos = [], nor = [], idx = [];
  let base = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const [a0, r0] = pts[i], [a1, r1] = pts[i + 1];
    const da = a1 - a0, dr = r1 - r0, L = Math.hypot(da, dr);
    if (L < 1e-9) continue;
    const na = -dr / L, nr = da / L;
    for (let j = 0; j <= seg; j++) {
      const f = (j / seg) * TAU, c = Math.cos(f), s = Math.sin(f);
      pos.push(a0, r0 * c, r0 * s, a1, r1 * c, r1 * s);
      nor.push(na, nr * c, nr * s, na, nr * c, nr * s);
    }
    for (let j = 0; j < seg; j++) {
      const A = base + 2 * j, B = A + 1, D = A + 2, C = A + 3;
      idx.push(A, C, B, A, D, C);
    }
    base += 2 * (seg + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setIndex(idx);
  return g;
}
// Closed tube x0..x1 between rIn and rOut with a chamfer c on the outer edges.
export function tubeX(x0, x1, rIn, rOut, c = 0.3, seg = 48) {
  return latheX([[x0, rIn], [x0, rOut - c], [x0 + c, rOut], [x1 - c, rOut], [x1, rOut - c], [x1, rIn], [x0, rIn]], seg);
}

// Ball-screw thread about the X axis: a real helical groove of the given lead, fading out at both ends (thread runout).
// A point of the groove sits at x/lead - phi/TAU = const, so turning the screw by +theta carries the groove toward -X
// by lead * theta / TAU. The nut uses the same relation.
export function threadX(x0, x1, R, lead, depth, widthFrac = 0.44, radial = 56, perLead = 22) {
  const n = Math.ceil(((x1 - x0) / lead) * perLead);
  const pos = [], idx = [];
  for (let i = 0; i <= n; i++) {
    const x = x0 + ((x1 - x0) * i) / n;
    const e = Math.min(1, Math.min(x - x0, x1 - x) / (lead * 0.9));
    const fade = e * e * (3 - 2 * e);
    for (let j = 0; j <= radial; j++) {
      const f = (j / radial) * TAU;
      let u = x / lead - j / radial;
      u -= Math.floor(u);
      const d = Math.abs(u - 0.5) / (widthFrac / 2);
      const gr = d < 1 ? Math.sqrt(1 - d * d) : 0;
      const r = R - depth * fade * gr;
      pos.push(x, r * Math.cos(f), r * Math.sin(f));
    }
  }
  const w = radial + 1;
  for (let i = 0; i < n; i++) for (let j = 0; j < radial; j++) {
    const A = i * w + j, B = A + w, C = B + 1, D = A + 1;
    idx.push(A, C, B, A, D, C);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  const nrm = g.attributes.normal; // weld the seam so no line runs along the screw
  for (let i = 0; i <= n; i++) {
    const a = i * w, b = a + radial;
    const x = nrm.getX(a) + nrm.getX(b), y = nrm.getY(a) + nrm.getY(b), z = nrm.getZ(a) + nrm.getZ(b);
    const l = Math.hypot(x, y, z) || 1;
    nrm.setXYZ(a, x / l, y / l, z / l); nrm.setXYZ(b, x / l, y / l, z / l);
  }
  return g;
}

export function merge(list) {
  const out = list.map((g) => {
    const h = g.index ? g.toNonIndexed() : g;
    for (const k of Object.keys(h.attributes)) if (k !== 'position' && k !== 'normal') h.deleteAttribute(k);
    return h;
  });
  return mergeGeometries(out, false);
}

// Socket head cap screw. Head top at y = 0 facing +Y, shank toward -Y. d = thread diameter.
export function boltGeo(d, len) {
  const hr = d * 0.8, hh = d, hexR = (d * 0.42) / Math.cos(Math.PI / 6);
  const s = disc(hr);
  const hex = new THREE.Path();
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * TAU;
    k ? hex.lineTo(hexR * Math.cos(a), hexR * Math.sin(a)) : hex.moveTo(hexR * Math.cos(a), hexR * Math.sin(a));
  }
  hex.closePath();
  s.holes.push(hex);
  const head = extrudeY(s, -hh, hh, d * 0.09, 20);
  const floor = new THREE.CircleGeometry(hexR * 1.02, 6);
  floor.rotateX(-Math.PI / 2);
  floor.translate(0, -hh * 0.5, 0);
  const shank = new THREE.CylinderGeometry(d / 2, d / 2, len, 16);
  shank.translate(0, -hh - len / 2, 0);
  return merge([head, floor, shank]);
}

// Ball bearing about the X axis, centred on x = 0.
export function bearingGeo(od, id, w, balls = 9) {
  const ro = od / 2, ri = id / 2, t = (ro - ri) * 0.3, pitch = (ro + ri) / 2, br = (ro - ri) * 0.27;
  const parts = [tubeX(-w / 2, w / 2, ro - t, ro, 0.4), tubeX(-w / 2, w / 2, ri, ri + t, 0.4), tubeX(-w * 0.22, w * 0.22, pitch - 0.45, pitch + 0.45, 0.1, 40)];
  for (let k = 0; k < balls; k++) {
    const a = (k / balls) * TAU;
    const b = new THREE.SphereGeometry(br, 14, 10);
    b.translate(0, pitch * Math.cos(a), pitch * Math.sin(a));
    parts.push(b);
  }
  return merge(parts);
}

// Pie slice from rIn to rOut, centred on angle c (deg), `width` deg wide. For jaw-coupling lugs.
export function sector(rIn, rOut, c, width, steps = 6) {
  const a0 = ((c - width / 2) * Math.PI) / 180, a1 = ((c + width / 2) * Math.PI) / 180;
  const pts = [];
  for (let i = 0; i <= steps; i++) { const a = a0 + ((a1 - a0) * i) / steps; pts.push([rOut * Math.cos(a), rOut * Math.sin(a)]); }
  for (let i = steps; i >= 0; i--) { const a = a0 + ((a1 - a0) * i) / steps; pts.push([rIn * Math.cos(a), rIn * Math.sin(a)]); }
  return poly(pts);
}
