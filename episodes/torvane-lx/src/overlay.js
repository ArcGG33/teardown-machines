// Text over the picture: the Demo tag, the part labels with their leaders, the end title.
// Nothing here animates by itself: update(S) writes every style from the timeline state, so a captured frame is exact.
import {BRAND, TAGLINE, DEMO_TAG, END_TAG, LABELS} from './content.js';

export const SIZE = {landscape: [1920, 1080], portrait: [1080, 1920]};
const LAYOUT = {
  landscape: {pad: 72, top: 200, bottom: 900},
  portrait: {pad: 48, top: 400, bottom: 1480},
};
const NS = 'http://www.w3.org/2000/svg';
const clamp = (x) => Math.max(0, Math.min(1, x));

export function createOverlay(ui, format) {
  const [W, H] = SIZE[format], L = LAYOUT[format];
  ui.className = format;
  ui.style.width = W + 'px';
  ui.style.height = H + 'px';
  const [b1, b2] = BRAND.split(' ');
  ui.innerHTML = `<div class="vignette"></div><svg class="leaders" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"></svg>
    <div class="tag">${DEMO_TAG}</div>
    <div class="title"><div class="brand">${b1} <span>${b2}</span></div><div class="rule"></div><div class="tagline">${TAGLINE}</div><div class="endtag">${END_TAG}</div></div>`;
  const svg = ui.querySelector('.leaders');
  const brand = ui.querySelector('.brand'), rule = ui.querySelector('.rule'), tagline = ui.querySelector('.tagline'), endtag = ui.querySelector('.endtag');

  const items = LABELS.map((d) => {
    const el = document.createElement('div');
    el.className = 'label';
    el.innerHTML = `<div class="en">${d.en}</div><div class="zh">${d.zh}</div><div class="fn">${d.fn}</div>`;
    ui.appendChild(el);
    const path = document.createElementNS(NS, 'path'); path.setAttribute('pathLength', '1');
    const ring = document.createElementNS(NS, 'circle'); ring.setAttribute('class', 'ring'); ring.setAttribute('r', '11');
    const dot = document.createElementNS(NS, 'circle'); dot.setAttribute('class', 'dot'); dot.setAttribute('r', '5');
    svg.append(path, ring, dot);
    return {id: d.id, el, path, ring, dot, right: false, sx: 0, sy: 0};
  });

  // Decide once, from the camera pose the labels are read at: the five leftmost anchors go to the left column,
  // each column is ordered top to bottom like its anchors, so leaders do not cross.
  function layout(project) {
    const pts = items.map((it) => ({it, p: project(it.id)})).sort((a, b) => a.p[0] - b.p[0]);
    const half = Math.ceil(pts.length / 2);
    [pts.slice(0, half), pts.slice(half)].forEach((col, side) => {
      col.sort((a, b) => a.p[1] - b.p[1]);
      col.forEach(({it}, i) => {
        const y = L.top + ((L.bottom - L.top) * (col.length > 1 ? i / (col.length - 1) : 0.5));
        it.right = side === 1;
        it.el.classList.toggle('r', it.right);
        it.el.style.left = it.right ? '' : L.pad + 'px';
        it.el.style.right = it.right ? L.pad + 'px' : '';
        it.el.style.top = y - it.el.offsetHeight / 2 + 'px';
        const zh = it.el.querySelector('.zh');
        it.sy = it.el.offsetTop + zh.offsetTop + zh.offsetHeight / 2;
        const w = Math.max(zh.scrollWidth, 0), range = document.createRange();
        range.selectNodeContents(zh);
        const tw = range.getBoundingClientRect().width / (ui.getBoundingClientRect().width / W) || w;
        it.sx = it.right ? W - L.pad - tw - 18 : L.pad + tw + 18;
      });
    });
  }

  function update(S, project) {
    items.forEach((it, i) => {
      const p = S.labels[i].p, vis = p > 0.002;
      it.el.style.visibility = it.path.style.visibility = it.ring.style.visibility = it.dot.style.visibility = vis ? 'visible' : 'hidden';
      if (!vis) return;
      it.el.style.opacity = p;
      it.el.style.transform = `translateX(${(1 - p) * (it.right ? 18 : -18)}px)`;
      const [ax, ay] = project(it.id);
      const ex = it.sx + (it.right ? -34 : 34);
      it.path.setAttribute('d', `M${it.sx.toFixed(1)} ${it.sy.toFixed(1)}H${ex.toFixed(1)}L${ax.toFixed(1)} ${ay.toFixed(1)}`);
      it.path.style.strokeDashoffset = 1 - clamp((p - 0.1) / 0.9);
      it.path.style.opacity = p;
      for (const c of [it.ring, it.dot]) { c.setAttribute('cx', ax.toFixed(1)); c.setAttribute('cy', ay.toFixed(1)); c.style.opacity = clamp((p - 0.6) / 0.4); }
    });
    const t = S.title.p, s = S.title.sub;
    brand.style.opacity = t;
    brand.style.transform = `translateY(${(1 - t) * 28}px)`;
    brand.style.letterSpacing = `${(0.1 * (1 - t) - 0.01).toFixed(4)}em`;
    rule.style.transform = `scaleX(${t})`;
    rule.style.opacity = t;
    for (const el of [tagline, endtag]) { el.style.opacity = s; el.style.transform = `translateY(${(1 - s) * 14}px)`; }
  }

  return {layout, update};
}
