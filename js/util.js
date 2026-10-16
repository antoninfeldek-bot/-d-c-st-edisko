'use strict';
// Shared helpers: math on the sphere, formatting, Czech plurals.
window.G = window.G || {};
(() => {
  const DEG = Math.PI / 180;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = a => a[Math.floor(Math.random() * a.length)];

  function toVec(lat, lon) {
    const a = lat * DEG, o = lon * DEG;
    return [Math.cos(a) * Math.cos(o), Math.cos(a) * Math.sin(o), Math.sin(a)];
  }
  function fromVec(v) {
    return [Math.asin(clamp(v[2], -1, 1)) / DEG, Math.atan2(v[1], v[0]) / DEG];
  }
  function slerp(a, b, t) {
    const d = clamp(a[0] * b[0] + a[1] * b[1] + a[2] * b[2], -1, 1), w = Math.acos(d);
    if (w < 1e-6) return a;
    const s = Math.sin(w), k1 = Math.sin((1 - t) * w) / s, k2 = Math.sin(t * w) / s;
    return [a[0] * k1 + b[0] * k2, a[1] * k1 + b[1] * k2, a[2] * k1 + b[2] * k2];
  }
  const along = (a, b, t) => fromVec(slerp(a, b, t));
  // great-circle distance in degrees between two [lat, lon] points
  function angDist(p, q) {
    const a = toVec(p[0], p[1]), b = toVec(q[0], q[1]);
    return Math.acos(clamp(a[0] * b[0] + a[1] * b[1] + a[2] * b[2], -1, 1)) / DEG;
  }

  const pad = n => String(Math.floor(n)).padStart(2, '0');
  const fmtT = t => `T+${pad(t / 3600)}:${pad(t / 60 % 60)}:${pad(t % 60)}`;
  const fmtEta = s => s <= 0 ? '00:00' : `${pad(s / 60)}:${pad(s % 60)}`;
  const fmtM = m => m < 0.05 ? '0' : `${m.toFixed(1).replace('.', ',')} mil.`;
  const zulu = t => { const z = (3 * 3600 + 12 * 60 + t) % 86400; return `${pad(z / 3600)}:${pad(z / 60 % 60)}Z`; };
  const plural = (n, one, few, many) => n === 1 ? one : (n >= 2 && n <= 4) ? few : many;

  Object.assign(G, { DEG, clamp, rand, pick, toVec, fromVec, slerp, along, angDist, pad, fmtT, fmtEta, fmtM, zulu, plural });
})();
