'use strict';
// Polar azimuthal map: coastlines, sites, tracks, interceptors, own forces, effects. Pan and zoom.
(() => {
const { DEG, clamp, along, fromVec, toVec } = G;
const D = G.DATA;
const cv = document.getElementById('map'), ctx = cv.getContext('2d'), wrap = document.getElementById('mapWrap');
const V = { w: 0, h: 0, zoom: 1, px: 0, py: 0, k: 1, cx: 0, cy: 0 };
const C = {};
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const MONO = '"IBM Plex Mono", monospace';

function readColors() {
  const cs = getComputedStyle(document.documentElement);
  for (const k of ['bg', 'ocean', 'land', 'coast', 'line', 'fg', 'dim', 'amber', 'red', 'cyan', 'ok']) C[k] = cs.getPropertyValue('--' + k).trim();
}
function resize() {
  const r = wrap.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
  V.w = r.width; V.h = r.height;
  cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
const OFF = 13; // degrees the pole sits above centre, so Russia and the US both fit
function view() {
  const base = Math.min(V.h / 104, V.w / 100);
  V.k = base * V.zoom; V.cx = V.w / 2 + V.px; V.cy = V.h / 2 - OFF * V.k + V.py;
}
function proj(lat, lon) { const r = (90 - lat) * V.k, a = (lon + 100) * DEG; return [V.cx + r * Math.sin(a), V.cy + r * Math.cos(a)]; }
function poly(pts) { ctx.beginPath(); pts.forEach((p, i) => { const [x, y] = proj(p[0], p[1]); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); ctx.closePath(); }
function alpha(col, a) { ctx.globalAlpha = a; return col; }
function trail(a, b, f, col, al, dash, lw = 1.4, f0 = 0) {
  ctx.setLineDash(dash); ctx.strokeStyle = alpha(col, al); ctx.lineWidth = lw;
  ctx.beginPath(); const n = 28;
  for (let i = 0; i <= n; i++) { const [x, y] = proj(...along(a, b, f0 + (f - f0) * i / n)); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
  ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1;
}
function label(text, x, y, col, a = .62, left = false, weight = 400) {
  ctx.font = `${weight} 9px ${MONO}`; ctx.fillStyle = alpha(col, a);
  ctx.textAlign = left ? 'right' : 'left'; ctx.fillText(text, x, y); ctx.textAlign = 'left'; ctx.globalAlpha = 1;
}

function draw(now) {
  view();
  const S = G.S, X = G.sim;
  ctx.globalAlpha = 1;
  ctx.fillStyle = C.bg; ctx.fillRect(0, 0, V.w, V.h);
  ctx.save();
  ctx.beginPath(); ctx.arc(V.cx, V.cy, 95 * V.k, 0, Math.PI * 2); ctx.fillStyle = C.ocean; ctx.fill(); ctx.clip();

  ctx.strokeStyle = C.line; ctx.lineWidth = 1; ctx.setLineDash([2, 4]);
  for (let lat = 0; lat < 90; lat += 15) { ctx.beginPath(); ctx.arc(V.cx, V.cy, (90 - lat) * V.k, 0, Math.PI * 2); ctx.stroke(); }
  for (let lon = -180; lon < 180; lon += 30) { const [x, y] = proj(-5, lon); ctx.beginPath(); ctx.moveTo(V.cx, V.cy); ctx.lineTo(x, y); ctx.stroke(); }
  ctx.setLineDash([]);

  for (const p of D.LAND) { poly(p); ctx.fillStyle = C.land; ctx.fill(); ctx.strokeStyle = C.coast; ctx.stroke(); }
  for (const p of D.WATER) { poly(p); ctx.fillStyle = C.ocean; ctx.fill(); ctx.strokeStyle = C.coast; ctx.stroke(); }

  if (!reduced && ctx.createConicGradient) {
    const ang = (now / 5200) % (Math.PI * 2), g = ctx.createConicGradient(ang, V.cx, V.cy);
    g.addColorStop(0, 'rgba(98,210,227,0.10)'); g.addColorStop(0.07, 'rgba(98,210,227,0)'); g.addColorStop(1, 'rgba(98,210,227,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(V.cx, V.cy, 95 * V.k, 0, Math.PI * 2); ctx.fill();
  }
  for (const lat of [30, 45, 60, 75]) { const [x, y] = proj(lat, 170); label(lat + '°N', x + 3, y - 3, C.dim, .7); }

  if (S) {
    const showMil = V.k > 6.5;
    const sel = X.selTrack();
    // sites
    for (const s of Object.values(D.SITES)) {
      const [x, y] = proj(s.lat, s.lon);
      const hit = s.hits > 0;
      const col = s.type === 'city' ? (hit ? C.red : C.fg) : (s.dead ? C.red : C.cyan);
      ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = 1.2;
      if (s.type === 'city') { ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2); s.alertT != null ? ctx.fill() : ctx.stroke(); }
      else if (s.type === 'hq') { ctx.beginPath(); ctx.moveTo(x, y - 5); ctx.lineTo(x + 5, y + 4); ctx.lineTo(x - 5, y + 4); ctx.closePath(); ctx.stroke(); }
      else if (s.type === 'radar') { ctx.beginPath(); ctx.arc(x, y + 2, 5, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke(); ctx.beginPath(); ctx.arc(x, y, 1.5, 0, Math.PI * 2); ctx.fill(); }
      else { ctx.strokeRect(x - 2.5, y - 2.5, 5, 5); }
      if (s.dead || hit) { ctx.strokeStyle = C.red; ctx.beginPath(); ctx.moveTo(x - 5, y - 5); ctx.lineTo(x + 5, y + 5); ctx.moveTo(x + 5, y - 5); ctx.lineTo(x - 5, y + 5); ctx.stroke(); }
      if (sel && D.SITES[sel.target] === s) continue;
      if ((s.type === 'city' && V.k > 4.2) || (s.type !== 'city' && showMil) || s.type === 'hq') {
        label(s.s, x + (s.up ? -4 : s.left ? -7 : 7), y + (s.up ? -7 : 3), s.type === 'city' ? C.fg : C.cyan, .62, s.left && !s.up);
      }
    }

    // ships and their reach when a track is selected
    for (const sh of S.ships) {
      const p = X.shipPos(sh), [x, y] = proj(p[0], p[1]);
      if (sh.moveTo) { const to = D.STATIONS[sh.moveTo]; const [tx, ty] = proj(to.lat, to.lon); ctx.setLineDash([2, 3]); ctx.strokeStyle = alpha(C.cyan, .5); ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(tx, ty); ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1; }
      if (sel && X.active(sel) && sel.kind !== 'BMB') {
        ctx.strokeStyle = alpha(C.cyan, X.shooterCheck('ship:' + sh.id, sel) ? .12 : .4);
        ctx.setLineDash([3, 4]); ctx.beginPath(); ctx.arc(x, y, 20 * V.k, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1;
      }
      ctx.fillStyle = C.cyan; ctx.beginPath(); ctx.moveTo(x, y - 5); ctx.lineTo(x + 4, y); ctx.lineTo(x, y + 5); ctx.lineTo(x - 4, y); ctx.closePath(); ctx.fill();
      label(sh.id, x + 7, y + 3, C.cyan, .8);
    }
    // own aircraft orbits
    const orbit = (lat, lon, ph, r) => { const a = now / 2400 + ph; return proj(lat + Math.cos(a) * r, lon + Math.sin(a) * r * 1.6); };
    S.wings.forEach((w, i) => {
      if (w.state !== 'air') return;
      const b = D.SITES[w.base], [x, y] = orbit(b.lat + 1.5, b.lon, i * 2, 1.2);
      ctx.fillStyle = C.cyan; ctx.fillRect(x - 2.5, y - 2.5, 5, 5);
      if (showMil) label(w.id === 'b2' ? 'B-2' : 'B-52', x + 6, y + 3, C.cyan, .8);
    });
    if (S.tacamo === 'air') { const t = D.SITES.TINKER, [x, y] = orbit(t.lat + 1, t.lon, 1, 1); ctx.fillStyle = C.cyan; ctx.beginPath(); ctx.arc(x, y, 2.5, 0, Math.PI * 2); ctx.fill(); if (showMil) label('E-6B', x + 6, y + 3, C.cyan, .8); }
    if (S.potus === 'air') { const [x, y] = orbit(41, -96, 0, 1.5); ctx.strokeStyle = C.ok; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(x, y, 3.5, 0, Math.PI * 2); ctx.stroke(); label('E-4B', x + 6, y + 3, C.ok, .9); }

    // outgoing US strikes
    for (const o of S.out) {
      const f = (S.t - o.t0) / o.ft; if (f < 0) continue;
      const done = f >= 1;
      if (done && S.t - (o.t0 + o.ft) > 300) continue;
      trail(o.a, o.b, Math.min(f, 1), C.cyan, done ? .25 : .8, o.g.p === 'bomb' ? [4, 3] : []);
      if (!done) { const [x, y] = proj(...along(o.a, o.b, f)); ctx.fillStyle = C.cyan; ctx.beginPath(); ctx.arc(x, y, 2.2, 0, Math.PI * 2); ctx.fill(); }
      else if (!o.flashed) { o.flashed = true; const p = fromVec(o.b); S.fx.push({ lat: p[0], lon: p[1], t0: now, col: 'cyan', dur: 3000, r: 30 }); }
    }

    // interceptors
    for (const it of S.ints) {
      const f = clamp((S.t - it.t0) / (it.t1 - it.t0), 0, 1);
      trail(it.a, it.b, f, C.cyan, .9, [3, 3]);
      const [x, y] = proj(...along(it.a, it.b, f));
      ctx.fillStyle = C.cyan; ctx.beginPath(); ctx.arc(x, y, 2.5, 0, Math.PI * 2); ctx.fill();
      const [bx, by] = proj(...fromVec(it.b)); ctx.strokeStyle = alpha(C.cyan, .5); ctx.beginPath(); ctx.arc(bx, by, 6, 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = 1;
    }

    // hostile tracks
    for (const tr of S.tracks) {
      const f = clamp((S.t - tr.tLaunch) / tr.tFlight, 0, 1);
      const isSel = tr === sel;
      if (!X.active(tr)) {
        if (S.t - tr.tEnd > 120) continue;
        trail(tr.a, tr.b, f, tr.status === 'impact' ? C.red : C.dim, .35, []);
        continue;
      }
      const col = tr.status === 'confirmed' ? C.red : C.amber;
      const dash = tr.status === 'confirmed' ? [] : [5, 4];
      ctx.setLineDash([1, 5]); ctx.strokeStyle = alpha(col, isSel ? .65 : .22); ctx.lineWidth = 1;
      ctx.beginPath(); for (let i = 0; i <= 24; i++) { const [x, y] = proj(...along(tr.a, tr.b, f + (1 - f) * i / 24)); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.stroke();
      ctx.setLineDash([]); ctx.globalAlpha = 1;
      trail(tr.a, tr.b, f, col, .95, dash, isSel ? 2 : 1.4);
      const [x, y] = proj(...along(tr.a, tr.b, f));
      const blink = tr.verifyEnd && Math.floor(now / 300) % 2;
      ctx.fillStyle = col; ctx.beginPath();
      if (tr.kind === 'BMB') ctx.rect(x - 3, y - 3, 6, 6); else ctx.arc(x, y, 3.5, 0, Math.PI * 2);
      if (!blink) ctx.fill();
      if (isSel) { ctx.strokeStyle = col; ctx.lineWidth = 1; ctx.strokeRect(x - 9, y - 9, 18, 18); }
      ctx.font = `${isSel ? 600 : 500} 10px ${MONO}`; ctx.fillStyle = col; ctx.fillText(tr.id, x + 8, y - 6);
      if (isSel) {
        const t = D.SITES[tr.target], [tx, ty] = proj(t.lat, t.lon);
        ctx.strokeStyle = col; ctx.beginPath(); ctx.arc(tx, ty, 9, 0, Math.PI * 2); ctx.stroke();
        label(t.s + (tr.status === 'unverified' ? '?' : ''), tx + 12, ty + 3, col, 1, false, 600);
      }
    }

    S.fx = S.fx.filter(e => now - e.t0 < e.dur);
    for (const e of S.fx) {
      const f = clamp((now - e.t0) / e.dur, 0, 1), [x, y] = proj(e.lat, e.lon);
      ctx.strokeStyle = alpha(C[e.col], 1 - f); ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(x, y, 3 + e.r * f, 0, Math.PI * 2); ctx.stroke();
      if (e.col === 'red') { ctx.beginPath(); ctx.arc(x, y, 2 + e.r * .55 * Math.min(1, f * 2), 0, Math.PI * 2); ctx.stroke(); ctx.fillStyle = alpha(C.red, (1 - f) * .35); ctx.fill(); }
      ctx.globalAlpha = 1;
    }
  }
  ctx.restore();
  ctx.strokeStyle = C.line; ctx.beginPath(); ctx.arc(V.cx, V.cy, 95 * V.k, 0, Math.PI * 2); ctx.stroke();
}

/* input */
let drag = null;
cv.addEventListener('pointerdown', e => { drag = { x: e.clientX, y: e.clientY, px: V.px, py: V.py, moved: false }; cv.setPointerCapture(e.pointerId); });
cv.addEventListener('pointermove', e => {
  if (!drag) return;
  const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
  if (Math.abs(dx) + Math.abs(dy) > 4) drag.moved = true;
  if (drag.moved) { V.px = drag.px + dx; V.py = drag.py + dy; }
});
cv.addEventListener('pointerup', e => {
  const S = G.S;
  if (drag && !drag.moved && S) {
    const r = cv.getBoundingClientRect(), mx = e.clientX - r.left, my = e.clientY - r.top;
    let best = null, bd = 16;
    for (const tr of S.tracks) {
      if (!G.sim.active(tr)) continue;
      const [x, y] = proj(...G.sim.posOf(tr)), d = Math.hypot(x - mx, y - my);
      if (d < bd) { bd = d; best = tr; }
    }
    if (best) G.sim.select(best.id);
  }
  drag = null;
});
function zoomAt(f, mx = V.w / 2, my = V.h / 2) {
  view();
  const z2 = clamp(V.zoom * f, .7, 6), k2 = V.k / V.zoom * z2;
  const dx = (mx - V.cx) / V.k, dy = (my - V.cy) / V.k;
  V.zoom = z2; V.px = mx - dx * k2 - V.w / 2; V.py = my - dy * k2 - V.h / 2 + OFF * k2;
}
cv.addEventListener('wheel', e => { e.preventDefault(); const r = cv.getBoundingClientRect(); zoomAt(e.deltaY < 0 ? 1.15 : 1 / 1.15, e.clientX - r.left, e.clientY - r.top); }, { passive: false });
// zoom to the continental US, where most of the defence happens
function focusUS() { V.zoom = 1; V.px = 0; V.py = 0; view(); const [x, y] = proj(40, -97); zoomAt(2.4, x, y); view(); const [x2, y2] = proj(40, -97); V.px += V.w / 2 - x2; V.py += V.h / 2 - y2; }

G.map = { draw, resize, readColors, zoomAt, reset: () => { V.zoom = 1; V.px = 0; V.py = 0; }, focusUS };
readColors();
new ResizeObserver(resize).observe(wrap);
resize();
})();
