'use strict';
// Game simulation: state, enemy waves, tracks, defence, forces, diplomacy, retaliation, endings.
(() => {
const { clamp, rand, pick, toVec, fromVec, along, angDist, fmtT, fmtEta, fmtM, plural } = G;
const D = G.DATA;
const END_T = 90 * 60;
const VERIFY_CAP = 3;
const PETROV_WIN_T = 45 * 60;

let S = null;
const log = (m, l = 'info') => G.ui.log(m, l);
const sfx = n => G.audio[n] && G.audio[n]();
const site = k => D.SITES[k];
const at = (t, f) => S.timers.push({ t, f });

const active = tr => tr.status === 'unverified' || tr.status === 'confirmed';
const eta = tr => tr.tLaunch + tr.tFlight - S.t;
const posOf = (tr, t = S.t) => along(tr.a, tr.b, clamp((t - tr.tLaunch) / tr.tFlight, 0, 1));
const selTrack = () => S && S.tracks.find(t => t.id === S.selected);
const fx = (lat, lon, col, dur, r) => S.fx.push({ lat, lon, col, dur, r, t0: performance.now() });

function genCode() {
  const L = 'ABCDEFHJKLMNPRSTVXZ';
  return pick(L) + Math.floor(rand(1, 10)) + pick(L) + Math.floor(rand(1, 10));
}

/* ---------- new game ---------- */
function newGame(scenKey, diffKey) {
  const sc = D.SCEN[scenKey], df = D.DIFF[diffKey];
  S = G.S = {
    t: 0, speed: 1, paused: false, running: true, ended: false, modal: null,
    scenKey, diffKey, sc, df,
    defcon: 3, defNext: 0,
    esc: sc.esc, cred: sc.cred, order: 75, arsenal: sc.arsenal, hostile: !sc.petrov,
    enemy: { slbmMul: 1, coordUntil: 0, bombersOff: false },
    cas: 0, enemyCas: 0,
    potus: 'dc', potusEta: 0, vp: 'dc', vpEta: 0, leader: 'potus',
    tracks: [], ints: [], out: [], fx: [], timers: [],
    nextWave: sc.firstWave, nextEvent: 400, usedEvents: new Set(), ceasefire: false,
    hot: { next: 480, ok: 0, tries: 0, blockUntil: 0 },
    dip: { natoNext: 0, alliesUsed: false, chinaUsed: false },
    intel: { reconBusy: 0, reconNext: 0, forecast: null, sigintUntil: 0, sigintNext: 0, cyberNext: 0 },
    civ: { speechNext: 0, guardNext: 0, fema: 4, nationwide: false },
    radarOutUntil: 0,
    tacamo: 'ground', tacamoEta: 0,
    wings: D.WINGS0.map(w => ({ ...w, state: 'ground', eta: 0 })),
    ssbn: { patrol: 4, port: { KINGS: { n: 2, state: 'port', eta: 0 }, BANGOR: { n: 2, state: 'port', eta: 0 } } },
    slbmUsed: 0, alcmUsed: 0, strikeSeq: 0, strikes: [], lastStrike: -1e9,
    ships: D.SHIPS0.map(s => ({ ...s, ammo: 8, moveTo: null, from: null, t0: 0, eta: 0 })),
    code: genCode(), seq: 100, selected: null, hints: {},
    stats: { fired: 0, kills: 0, impacts: 0, falseSeen: 0, wasted: 0, realLaunched: 0, strikes: 0 },
    history: [], histNext: 0,
  };
  for (const s of Object.values(D.SITES)) {
    s.dead = false; s.hits = 0; s.alertT = null;
    if (s.type === 'city') { s.remain = s.pop; s.fallout = 0; s.falloutRate = 0; s.fema = false; }
    if (s.stock0 != null) s.stock = s.stock0;
    if (s.missiles0 != null) s.missiles = s.missiles0;
    if (s.fighters0 != null) s.fighters = s.fighters0;
  }
  script(scenKey);
}

function script(k) {
  if (k === 'standard') {
    at(3, () => {
      const a = spawnTrack('ICBM', true, D.LAUNCH.ICBM[0], 'MALM');
      spawnTrack('ICBM', true, D.LAUNCH.ICBM[1], 'MINOT');
      spawnTrack('ICBM', false, D.LAUNCH.ICBM[3], 'WARREN');
      S.arsenal -= 2; S.stats.realLaunched += 2;
      log('SBIRS: zachyceny 3 starty balistických raket z území Ruska (K-100 až K-102).', 'crit');
      sfx('alarm'); select(a.id);
    });
    at(25, () => log('NMCC svolává konferenci o ohrožení. Prezident je informován.'));
    at(70, () => log('Doporučení štábu: ověřte kontakty a zvažte DEFCON 2, bez něj nelze odpálit GMD.'));
    at(150, () => log('Námořnictvo: ztracen kontakt s ruskou strategickou ponorkou v severním Atlantiku.', 'warn'));
    at(210, () => {
      spawnTrack('SLBM', true, D.LAUNCH.SLBM[1], 'KINGS'); S.arsenal--; S.stats.realLaunched++;
      log('SBIRS: start z hladiny severního Atlantiku. Raketa z ponorky, let kolem 12 minut. Torpédoborec USS Carney je v dosahu.', 'crit'); sfx('alarm');
    });
  } else if (k === 'subs') {
    at(3, () => {
      const a = spawnTrack('SLBM', true, D.LAUNCH.SLBM[1], 'NORFOLK');
      spawnTrack('SLBM', true, D.LAUNCH.SLBM[1], 'KINGS');
      spawnTrack('SLBM', false, D.LAUNCH.SLBM[1], 'BOS');
      S.arsenal -= 2; S.stats.realLaunched += 2;
      log('SBIRS: tři starty z hladiny severního Atlantiku, 800 km od pobřeží!', 'crit'); sfx('alarm'); select(a.id);
    });
    at(30, () => log('Doporučení štábu: varovací doba je extrémně krátká. Okamžitě evakuujte prezidenta a viceprezidenta.', 'warn'));
    at(90, () => log('Námořnictvo: v Pacifiku zachycen hluk další ruské ponorky.', 'warn'));
    at(300, () => {
      spawnTrack('SLBM', true, D.LAUNCH.SLBM[1], 'DC'); S.arsenal--; S.stats.realLaunched++;
      log('SBIRS: nový start z Atlantiku. Dráha míří k oblasti Washingtonu.', 'crit'); sfx('alarm');
    });
    at(420, () => {
      spawnTrack('SLBM', true, D.LAUNCH.SLBM[2], 'BANGOR'); S.arsenal--; S.stats.realLaunched++;
      log('SBIRS: start ze severního Pacifiku.', 'crit'); sfx('alarm');
    });
  } else {
    at(3, () => {
      const a = spawnTrack('ICBM', false, D.LAUNCH.ICBM[3], 'MALM');
      log('SBIRS: zachycen start ICBM z oblasti Jasnyj (K-100).', 'crit'); sfx('alarm'); select(a.id);
    });
    at(40, () => log('Satelitní snímky oblasti Jasnyj jsou nejasné. Nad základnou je oblačnost a nízké slunce.', 'info'));
    at(65, () => {
      for (const tg of ['MINOT', 'WARREN', 'MALM', 'OFFUTT']) spawnTrack('ICBM', false, D.LAUNCH.ICBM[3], tg);
      log('SBIRS: další 4 starty ze stejné základny (K-101 až K-104). Systém hlásí vysokou spolehlivost.', 'crit'); sfx('alarm');
    });
    at(130, () => log('Pozemní radary zatím nic nezachytily. Útok z jediné základny by byl neobvyklý.', 'info'));
  }
  at(480, () => log('Spojení horkou linkou Washington–Moskva je navázáno.', 'ok'));
}

/* ---------- enemy ---------- */
function weighted(pool) {
  const entries = Object.entries(pool).map(([k, w]) => {
    const s = site(k);
    if (s.type !== 'city' && s.type !== 'hq' && s.dead) w = 0;
    if (s.type === 'city') w = w / (1 + 2 * s.hits);
    if (k === 'DC' && S.t < 700 && S.scenKey !== 'subs') w = 0;
    return [k, w];
  }).filter(e => e[1] > 0);
  let r = Math.random() * entries.reduce((a, e) => a + e[1], 0);
  for (const [k, w] of entries) { if ((r -= w) <= 0) return k; }
  return entries.length ? entries[0][0] : 'CHI';
}

function spawnTrack(kind, real, zone, target) {
  if (!zone) zone = pick(D.LAUNCH[kind]);
  if (!target) {
    const pool = kind === 'SLBM' ? (zone[3] === 'arc' ? { ...D.POOL.atl, ...D.POOL.pac } : D.POOL[zone[3]]) : D.POOL[kind];
    target = weighted(pool);
  }
  const ft = kind === 'ICBM' ? rand(1500, 1800) : kind === 'SLBM' ? rand(600, 840) : rand(3600, 4200);
  const s = site(target);
  const tr = {
    id: (kind === 'BMB' ? 'B-' : 'K-') + (S.seq++), kind, real, zone: zone[0], target,
    a: toVec(zone[1], zone[2]), b: toVec(s.lat, s.lon), tLaunch: S.t, tFlight: ft,
    status: 'unverified', verifyEnd: null, tEnd: null,
  };
  S.tracks.push(tr);
  return tr;
}

function expectedWave() {
  if (!S.hostile) return 0;
  const n = Math.round((S.esc / 14) * (1.4 - S.cred / 100) * S.df.wave);
  return clamp(n, 0, Math.min(7, Math.floor(S.arsenal)));
}

function spawnWave() {
  if (!S.hostile) {
    const f = Math.random() < .6 ? 1 + Math.floor(Math.random() * 3) : 0;
    if (!f) { log('Satelity hlásí klid. Žádné nové starty.'); return; }
    const ids = [];
    for (let i = 0; i < f; i++) ids.push(spawnTrack('ICBM', false, D.LAUNCH.ICBM[3]).id);
    log(`SBIRS: ${f} ${plural(f, 'nový start', 'nové starty', 'nových startů')} z oblasti Jasnyj (${ids.join(', ')}).`, 'crit');
    sfx('alarm'); return;
  }
  let n = Math.round(expectedWave() * rand(.75, 1.25));
  n = clamp(n, 0, Math.min(7, Math.floor(S.arsenal)));
  const f = Math.random() < S.df.falseP ? (Math.random() < .6 ? 1 : 2) : 0;
  if (n + f === 0) { log('Satelity hlásí klid. Žádné nové starty.'); return; }
  S.arsenal -= n; S.esc += 1; S.stats.realLaunched += n;
  const ids = [];
  const pS = S.sc.slbm * S.enemy.slbmMul, pB = S.enemy.bombersOff ? 0 : S.sc.bmb;
  for (let i = 0; i < n; i++) {
    const r = Math.random();
    ids.push(spawnTrack(r < pB ? 'BMB' : r < pB + pS ? 'SLBM' : 'ICBM', true).id);
  }
  for (let i = 0; i < f; i++) ids.push(spawnTrack(pick(['ICBM', 'ICBM', 'SLBM']), false).id);
  ids.sort();
  log(`Nová vlna: ${ids.length} ${plural(ids.length, 'kontakt', 'kontakty', 'kontaktů')} (${ids.join(', ')}).`, 'crit');
  sfx('alarm');
  if (!selTrack() || !active(selTrack())) select(ids[0]);
}

// Petrov scenario: a provocation turns a false alarm into a real war.
function provoke(why) {
  if (!S.sc.petrov || S.hostile) return;
  S.hostile = true; S.esc += 25; S.nextWave = Math.min(S.nextWave, S.t + 120);
  log(`Moskva vyhodnotila ${why} jako přípravu k útoku. Ruské strategické síly přecházejí do odvety.`, 'crit');
  sfx('alarm');
}

/* ---------- verification ---------- */
const verifying = () => S.tracks.filter(t => t.verifyEnd && active(t)).length;
const verifyTime = () => S.t < S.intel.sigintUntil ? 45 : 90;
function radarsAlive() { return D.RADARS.filter(k => !site(k).dead).length; }
function confirmT() {
  if (S.t < S.radarOutUntil) return 120;
  return 180 + 300 * radarsAlive() / D.RADARS.length;
}
function verify(tr = selTrack()) {
  if (!tr || tr.status !== 'unverified' || tr.verifyEnd) return;
  if (verifying() >= VERIFY_CAP) { log('Všechny ověřovací kanály jsou obsazené.', 'warn'); return; }
  tr.verifyEnd = S.t + verifyTime(); sfx('blip');
  log(`${tr.id}: zahájena korelace dat SBIRS a radarů včasné výstrahy.`, 'own');
}
function select(id) { S.selected = id; G.ui.refresh(); }
function cycle(d) {
  const list = S.tracks.filter(active).sort((a, b) => eta(a) - eta(b));
  if (!list.length) return;
  const i = list.findIndex(t => t.id === S.selected);
  select(list[(i + d + list.length) % list.length].id);
}

/* ---------- defence ---------- */
const SHOOTERS = [
  { key: 'GREELY', type: 'gmd', name: 'GMD Fort Greely' },
  { key: 'VAFB', type: 'gmd', name: 'GMD Vandenberg' },
  ...D.SHIPS0.map(s => ({ key: 'ship:' + s.id, type: 'ship', name: `${s.name} · SM-3` })),
  { key: 'ELM', type: 'air', name: 'F-22 Elmendorf' },
  { key: 'LANGLEY', type: 'air', name: 'F-22 Langley' },
];
const FLIGHT = { gmd: 240, ship: 150, air: 600 };
const shipOf = key => S.ships.find(s => 'ship:' + s.id === key);
function shipPos(sh) {
  const to = D.STATIONS[sh.moveTo || sh.st];
  if (!sh.moveTo) return [to.lat, to.lon];
  const fr = D.STATIONS[sh.st], f = clamp((S.t - sh.t0) / (sh.eta - sh.t0), 0, 1);
  return along(toVec(fr.lat, fr.lon), toVec(to.lat, to.lon), f);
}
function shooterType(key) { return SHOOTERS.find(s => s.key === key).type; }
function shooterCheck(key, tr, n = 1) {
  if (!tr || !active(tr)) return 'Vyberte aktivní kontakt.';
  const type = shooterType(key);
  if (type === 'gmd') {
    const s = site(key);
    if (s.dead) return 'Základna je vyřazena.';
    if (tr.kind !== 'ICBM') return 'GMD zasahuje jen ICBM.';
    if (S.defcon > 2) return 'Vyžaduje DEFCON 2.';
    if (s.stock < n) return 'Nedostatek interceptorů.';
    if (eta(tr) < 300) return 'Příliš pozdě.';
    return null;
  }
  if (type === 'ship') {
    const sh = shipOf(key);
    if (sh.moveTo) return 'Loď je na přesunu.';
    if (tr.kind === 'BMB') return 'SM-3 nezasahuje letadla.';
    if (sh.ammo < n) return 'Došly střely SM-3.';
    if (eta(tr) < 180) return 'Příliš pozdě.';
    const d = angDist(posOf(tr, S.t + FLIGHT.ship), shipPos(sh));
    if (d > 20) return `Mimo dosah (${Math.round(d * 111)} km).`;
    return null;
  }
  const s = site(key);
  if (tr.kind !== 'BMB') return 'Jen proti bombardérům.';
  if (s.dead) return 'Základna je vyřazena.';
  if (s.fighters < 1) return 'Všechny letky jsou ve vzduchu.';
  if (eta(tr) < 700) return 'Bombardér je příliš blízko cíle.';
  return null;
}
function pk(key, n = 1) {
  const type = shooterType(key);
  if (type === 'gmd') return 1 - Math.pow(1 - .55 * S.df.pk, n);
  if (type === 'ship') return 1 - Math.pow(1 - .5 * S.df.pk, n);
  return .8;
}
function engage(key, n = 1) {
  const tr = selTrack();
  if (shooterCheck(key, tr, n)) return;
  const type = shooterType(key), t1 = S.t + FLIGHT[type];
  let from, label;
  if (type === 'gmd') { const s = site(key); s.stock -= n; from = [s.lat, s.lon]; label = `${s.s}: odpáleno ${n}× GBI`; }
  else if (type === 'ship') { const sh = shipOf(key); sh.ammo -= n; from = shipPos(sh); label = `${sh.name}: odpáleno ${n}× SM-3`; }
  else { const s = site(key); s.fighters--; from = [s.lat, s.lon]; label = `${s.s}: letka F-22 vyslána`; }
  if (type !== 'air') S.stats.fired += n;
  S.ints.push({ tr, n, key, type, t0: S.t, t1, p: pk(key, n), a: toVec(...from), b: toVec(...posOf(tr, t1)) });
  log(`${label} proti ${tr.id}. Střet za ${fmtEta(t1 - S.t)}.`, 'own'); sfx('blip');
}
function resolveInt(it) {
  const tr = it.tr, back = () => { if (it.type === 'air') site(it.key).fighters++; };
  if (!active(tr)) {
    S.stats.wasted += it.type === 'air' ? 0 : it.n;
    log(`Střet s ${tr.id} zrušen, kontakt už neexistuje.`); back(); return;
  }
  if (!tr.real) {
    tr.status = 'false'; tr.tEnd = S.t; S.stats.falseSeen++;
    if (it.type !== 'air') S.stats.wasted += it.n;
    log(`${tr.id}: v prostoru střetu nic není. Kontakt byl falešný${it.type === 'air' ? ', letka se vrací' : ', střela promarněna'}.`, 'warn');
    back(); return;
  }
  const pos = posOf(tr);
  if (Math.random() < it.p) {
    tr.status = 'destroyed'; tr.tEnd = S.t; S.stats.kills++; S.cred = clamp(S.cred + 2, 0, 100);
    fx(pos[0], pos[1], 'cyan', 1600, 18);
    log(`${tr.id}: ZÁSAH. Hrozba zničena.`, 'ok'); sfx('hit');
    if (Math.random() < .9) back();
  } else {
    fx(pos[0], pos[1], 'dim', 1200, 12);
    log(`${tr.id}: MINUTÍ. Hrozba pokračuje, dopad za ${fmtEta(eta(tr))}.`, 'warn');
    if (Math.random() < .6) back();
  }
}

/* ---------- impacts ---------- */
function impact(tr) {
  const k = tr.target, s = site(k);
  tr.status = 'impact'; tr.tEnd = S.t; S.stats.impacts++; s.hits++;
  fx(s.lat, s.lon, 'red', 4500, 46); sfx('thud');
  if (s.type === 'city') {
    const lead = s.alertT == null ? 0 : S.t - s.alertT;
    const red = clamp(lead / 1200, 0, 1) * .45 * (.5 + S.order / 200);
    const kk = s.remain * .3 * (1 - red);
    s.remain -= kk; S.cas += kk;
    s.fallout += kk * .35; s.falloutRate = s.fallout / 1200;
    S.cred -= 6; S.order -= 10;
    log(`DOPAD: ${s.n}. Odhad obětí ${fmtM(kk)}${red > .05 ? `, varování EAS ztráty snížilo o ${Math.round(red * 100)} %` : ', obyvatelé nebyli varováni'}. Hrozí radioaktivní spad.`, 'crit');
    if (k === 'DC') dcHit();
  } else if (s.type === 'hq') {
    S.cred -= 2;
    log('DOPAD u Cheyenne Mountain. Velín v hoře odolal, spojení běží po záložních linkách.', 'crit');
  } else {
    const was = s.dead; s.dead = true; S.cred -= 3;
    S.cas += s.type === 'radar' ? .01 : s.type === 'silo' ? .02 : .12;
    const extra = [];
    if (s.stock && !was) { extra.push(`Ztraceno ${s.stock} interceptorů.`); s.stock = 0; }
    if (s.fighters0 && !was) { if (s.fighters) extra.push('Letky na zemi zničeny.'); s.fighters = 0; }
    if (s.missiles0 && !was) { if (s.missiles) extra.push(`Zničeno ${s.missiles} raket Minuteman III v silech.`); s.missiles = 0; }
    if (s.type === 'radar') extra.push('Potvrzování cílů bude pomalejší.');
    for (const w of S.wings) if (w.base === k && (w.state === 'ground' || w.state === 'launching')) {
      extra.push(`${w.name}: ${w.n} letounů zničeno na zemi.`); w.state = 'lost'; w.n = 0;
    }
    const p = S.ssbn.port[k];
    if (p && p.state !== 'sea' && p.n > 0) { extra.push(`${p.n} ponorky zničeny v přístavu.`); p.n = 0; p.state = 'lost'; }
    if (k === 'TINKER' && S.tacamo !== 'air' && S.tacamo !== 'lost') { extra.push('Letouny E-6B TACAMO zničeny na zemi.'); S.tacamo = 'lost'; }
    log(`DOPAD: ${s.n}. ${extra.join(' ')}`, 'crit');
  }
  S.cred = clamp(S.cred, 0, 100); S.order = clamp(S.order, 0, 100);
}
function dcHit() {
  const surv = st => st === 'air' || st === 'safe' ? true : st === 'moving' ? Math.random() < .4 : false;
  if (S.potus !== 'dead' && !surv(S.potus)) { S.potus = 'dead'; log('Spojení s prezidentem přerušeno.', 'crit'); }
  if (S.vp !== 'dead' && !surv(S.vp)) { S.vp = 'dead'; log('Spojení s viceprezidentem přerušeno.', 'crit'); }
  updateLeader();
}
function updateLeader() {
  const prev = S.leader;
  S.leader = S.potus !== 'dead' ? 'potus' : S.vp !== 'dead' ? 'vp' : null;
  if (prev === 'potus' && S.leader === 'vp') {
    S.cred = clamp(S.cred - 10, 0, 100); S.order = clamp(S.order - 10, 0, 100);
    log('Viceprezident přebírá pravomoci vrchního velitele z Raven Rock. Řetězec velení zachován.', 'warn');
  }
  if (prev && !S.leader) {
    log('Národní velitelská autorita je ztracena.', 'crit');
    at(S.t + 8, () => endGame('decap'));
  }
}

/* ---------- forces & command ---------- */
function evacPotus() {
  if (S.potus !== 'dc') return;
  S.potus = 'moving'; S.potusEta = S.t + 600;
  log('Prezident opouští Bílý dům. Marine One míří k letounu E-4B, odhad 10 minut.', 'own');
}
function evacVp() {
  if (S.vp !== 'dc') return;
  S.vp = 'moving'; S.vpEta = S.t + 480;
  log('Viceprezident se přesouvá do podzemního komplexu Raven Rock, odhad 8 minut.', 'own');
}
function setDefcon(d) {
  if (S.t < S.defNext) return;
  const nd = clamp(S.defcon + d, 1, 5); if (nd === S.defcon) return;
  S.defcon = nd; S.defNext = S.t + 60;
  if (d < 0) {
    S.cred = clamp(S.cred + 5, 0, 100); S.esc += 4;
    log(`Vyhlášen DEFCON ${nd}.`, nd === 1 ? 'crit' : 'warn');
    if (nd === 1) provoke('vyhlášení DEFCON 1');
  } else {
    S.cred = clamp(S.cred - 4, 0, 100); S.esc = Math.max(0, S.esc - 3);
    log(`Pohotovost snížena na DEFCON ${nd}. Signál deeskalace.`, 'own');
  }
}
function wingLaunch(id) {
  const w = S.wings.find(x => x.id === id);
  if (!w || w.state !== 'ground') return;
  w.state = 'launching'; w.eta = S.t + 300;
  log(`${w.name}: poplachový vzlet, posádky běží k letounům. Ve vzduchu za 5 minut.`, 'own');
}
function sail(k) {
  const p = S.ssbn.port[k];
  if (!p || p.state !== 'port') return;
  p.state = 'sailing'; p.eta = S.t + 1200;
  log(`${site(k).s}: ${p.n} ponorky vyplouvají. Do bezpečí hlubokého moře za 20 minut.`, 'own');
}
function tacamo() {
  if (S.tacamo !== 'ground') return;
  S.tacamo = 'launching'; S.tacamoEta = S.t + 180;
  log('Tinker AFB: E-6B Mercury (TACAMO) startuje. Spojení s ponorkami za 3 minuty.', 'own');
}
function shipMove(id, st) {
  const sh = S.ships.find(s => s.id === id);
  if (!sh || sh.moveTo || sh.st === st || !D.STATIONS[st]) return;
  sh.moveTo = st; sh.t0 = S.t; sh.eta = S.t + 900;
  log(`${sh.name}: přesun na stanoviště ${D.STATIONS[st].n}, odhad 15 minut.`, 'own');
}
const seaPorts = () => Object.values(S.ssbn.port).filter(p => p.state === 'sea').reduce((a, p) => a + p.n, 0);

/* ---------- intelligence ---------- */
function recon() {
  if (S.t < S.intel.reconNext) return;
  S.intel.reconBusy = S.t + 180; S.intel.reconNext = S.t + 660;
  log('KH-11: satelit přenastaven na snímkování ruských odpalovacích základen. Výsledky za 3 minuty.', 'own');
  at(S.t + 180, () => {
    S.intel.reconBusy = 0;
    if (!S.hostile) {
      S.intel.forecast = { at: S.t + 600, n: 0, quiet: true };
      log('KH-11: na odpalovacích základnách včetně Jasného není žádná aktivita. Žádné stopy po startech.', 'ok'); return;
    }
    if (S.ceasefire) { S.intel.forecast = { at: S.t + 600, n: 0, quiet: true }; log('KH-11: ruské síly se stahují. Žádné přípravy ke startu.', 'ok'); return; }
    const n = expectedWave(), at2 = Math.max(S.nextWave, S.enemy.coordUntil);
    S.intel.forecast = { at: at2, n };
    log(`KH-11: další vlna očekávána za ${fmtEta(at2 - S.t)}, odhad ${n} ${plural(n, 'raketa', 'rakety', 'raket')}. Ruský arzenál ~${Math.round(S.arsenal)} hlavic.`, 'ok');
  });
}
function sigint() {
  if (S.t < S.intel.sigintNext) return;
  S.intel.sigintUntil = S.t + 600; S.intel.sigintNext = S.t + 1500;
  log('NSA: odposlech ruské vojenské komunikace aktivní. Ověřování kontaktů zrychleno na 45 s po dobu 10 minut.', 'own');
}
function cyber() {
  if (S.t < S.intel.cyberNext) return;
  S.intel.cyberNext = S.t + 900;
  const r = Math.random();
  if (r < .55) {
    S.nextWave += 300;
    log('USCYBERCOM: útok na ruskou síť velení uspěl. Další vlna se zdrží asi o 5 minut.', 'ok');
  } else if (r < .8) {
    log('USCYBERCOM: operace bez účinku, cílové systémy jsou izolované.', 'info');
  } else {
    S.esc += 8;
    log('USCYBERCOM: operace odhalena. Moskva ji označila za přípravu k prvnímu úderu.', 'warn');
    provoke('kybernetický útok');
  }
}

/* ---------- diplomacy ---------- */
function hotline(kind) {
  if (S.t < S.hot.next || S.ceasefire) return;
  S.hot.next = S.t + 300; S.hot.tries++;
  if (S.t < S.hot.blockUntil) { log('Horká linka: Moskva neodpovídá. Ruská velitelská centra jsou zřejmě vyřazena.', 'warn'); return; }
  if (!S.hostile) {
    if (kind === 'warn') { S.esc += 10; log('Horká linka: Moskva výhrůžku odmítá a tvrdí, že žádné rakety neodpálila.', 'warn'); return; }
    S.esc = Math.max(0, S.esc - 8); S.hot.ok++;
    log('Horká linka: Moskva důrazně popírá jakékoli starty a navrhuje společné ověření dat.', 'ok');
    if (kind === 'ask') hint('false', 'Moskva tvrdí, že žádnou raketu neodpálila.');
    return;
  }
  const recent = S.t - S.lastStrike < 900;
  if (kind === 'truce') {
    const p = clamp(.8 - S.esc / 120 - (recent ? .35 : 0) - (S.cred < 40 ? .15 : 0), .05, .9);
    if (Math.random() < p) {
      const d = Math.round(rand(14, 22)); S.esc = Math.max(0, S.esc - d); S.hot.ok++;
      log(`Horká linka: Moskva přijala návrh na zastavení dalších startů. Eskalace −${d}.`, 'ok');
    } else { S.esc += 3; log(recent ? 'Horká linka: po americkém úderu Moskva jednání odmítá.' : 'Horká linka: druhá strana návrh odmítla.', 'warn'); }
  } else if (kind === 'assure') {
    const p = clamp(.85 - S.esc / 150 - (recent ? .5 : 0), .05, .9);
    if (Math.random() < p) {
      const d = Math.round(rand(8, 12)); S.esc = Math.max(0, S.esc - d); S.cred = clamp(S.cred - 6, 0, 100);
      log(`Horká linka: ujistili jste Moskvu, že USA neodpoví, pokud útoky ustanou. Eskalace −${d}, odstrašení −6.`, 'ok');
    } else log('Horká linka: Moskva ujištění nevěří.', 'warn');
  } else if (kind === 'warn') {
    if (S.cred >= 60) { S.esc = Math.max(0, S.esc - 6); S.cred = clamp(S.cred + 6, 0, 100); log('Horká linka: varování zabralo. Moskva zvažuje další kroky. Eskalace −6.', 'ok'); }
    else { S.esc += 6; S.cred = clamp(S.cred + 4, 0, 100); log('Horká linka: Moskva výhrůžku nebere vážně a reaguje ostře. Eskalace +6.', 'warn'); }
  } else if (kind === 'ask') {
    const tr = selTrack();
    S.esc = Math.max(0, S.esc - 2);
    if (!tr || tr.status !== 'unverified') { log('Horká linka: Moskva odmítá komentovat jednotlivé starty.'); return; }
    const truth = Math.random() < .75, says = truth ? tr.real : !tr.real;
    hint(says ? 'real' : 'false', says ? `Moskva potvrzuje start ${tr.id}.` : `Moskva tvrdí, že ${tr.id} není její raketa.`, tr);
  }
}
function hint(kind, text, tr) {
  const list = tr ? [tr] : S.tracks.filter(t => t.status === 'unverified');
  for (const t of list) S.hints[t.id] = text;
  log('Horká linka: ' + text + ' (Nemusí to být pravda.)', 'info');
}
function nato() {
  if (S.t < S.dip.natoNext) return;
  S.dip.natoNext = S.t + 900; S.cred = clamp(S.cred + 8, 0, 100); S.esc += 2;
  log('NATO: Severoatlantická rada vyjádřila plnou podporu USA. Odstrašení +8.', 'ok');
}
function allies() {
  if (S.dip.alliesUsed) return;
  S.dip.alliesUsed = true; S.cred = clamp(S.cred + 12, 0, 100); S.esc += 6;
  log('Velká Británie a Francie zvedly pohotovost jaderných ponorek. Odstrašení +12, eskalace +6.', 'warn');
}
function china() {
  if (S.dip.chinaUsed || S.t < 1200) return;
  S.dip.chinaUsed = true;
  const p = clamp(.75 - S.esc / 150, .1, .8);
  if (Math.random() < p) { S.esc = Math.max(0, S.esc - 12); S.hot.next = S.t; log('Peking: čínské zprostředkování přimělo Moskvu k jednání. Eskalace −12, horká linka je hned k dispozici.', 'ok'); }
  else log('Peking: Moskva čínské zprostředkování odmítla.', 'warn');
}

/* ---------- civil ---------- */
function alertCity(k) {
  const s = site(k);
  if (!s || s.alertT != null) return;
  s.alertT = S.t; S.order = clamp(S.order - 2, 0, 100);
  log(`EAS: vyhlášeno varování pro ${s.n}. Obyvatelé míří do krytů.`, 'own'); sfx('blip');
}
function alertAll() {
  if (S.civ.nationwide) return;
  S.civ.nationwide = true;
  let n = 0;
  for (const s of Object.values(D.SITES)) if (s.type === 'city' && s.alertT == null) { s.alertT = S.t; n++; }
  S.order = clamp(S.order - 12, 0, 100);
  log(`EAS: celostátní poplach vyhlášen pro ${n} ${plural(n, 'město', 'města', 'měst')}. Veřejný pořádek −12.`, 'warn'); sfx('blip');
}
function speech() {
  if (S.t < S.civ.speechNext || !S.leader) return;
  S.civ.speechNext = S.t + 900; S.order = clamp(S.order + 15, 0, 100);
  log(`${S.leader === 'potus' ? 'Prezident' : 'Viceprezident'} promluvil k národu. Veřejný pořádek +15.`, 'ok');
}
function guard() {
  if (S.t < S.civ.guardNext) return;
  S.civ.guardNext = S.t + 1200; S.order = clamp(S.order + 12, 0, 100);
  log('Národní garda nasazena v zasažených oblastech. Veřejný pořádek +12.', 'own');
}
function fema(k) {
  const s = site(k);
  if (!s || !s.hits || s.fema || S.civ.fema < 1) return;
  s.fema = true; S.civ.fema--; s.fallout *= .5; s.falloutRate = s.fallout / 900;
  log(`FEMA: záchranné týmy vyslány do ${s.n}. Ztráty spadem sníženy na polovinu.`, 'own');
}

/* ---------- retaliation ---------- */
function capacity(p) {
  if (p === 'icbm') return D.SILOS.reduce((a, k) => a + (site(k).dead ? 0 : site(k).missiles), 0);
  if (p === 'slbm') return Math.max(0, (S.ssbn.patrol + seaPorts()) * 20 - S.slbmUsed);
  return Math.max(0, S.wings.filter(w => w.state === 'air').reduce((a, w) => a + w.n * 4, 0) - S.alcmUsed);
}
function plan(sets, p) {
  let missiles = 0, esc = 0, cred = 0, cas = 0;
  for (const k of sets) { const r = D.RU_SETS[k]; missiles += r.missiles; esc += r.esc; cred += r.cred; cas += r.cas; }
  if (p === 'bomb') esc *= .5;
  return { missiles, esc: Math.round(esc), cred: Math.min(50, cred), cas, ft: D.PLATFORMS[p].ft };
}
function strikeBlock(sets, p, code) {
  if (!sets.length) return 'Vyberte aspoň jednu sadu cílů.';
  if (S.defcon !== 1) return 'Vyžaduje DEFCON 1.';
  if (!S.leader) return 'Chybí národní velitelská autorita.';
  if (p === 'slbm' && S.tacamo !== 'air') return 'Ponorky vyžadují spojení přes E-6B TACAMO.';
  if (p === 'bomb' && !S.wings.some(w => w.state === 'air')) return 'Žádné bombardéry ve vzduchu.';
  const need = plan(sets, p).missiles, cap = capacity(p);
  if (cap < need) return `Nedostatek nosičů (${cap} z ${need}).`;
  if ((code || '').trim().toUpperCase() !== S.code) return 'Zadejte platný autentizační kód.';
  return null;
}
function strike(sets, p, code, force) {
  if (!force) {
    const why = strikeBlock(sets, p, code);
    if (why) { if (code && why.startsWith('Zadejte')) log('Autentizační kód nesouhlasí. Rozkaz neplatný.', 'warn'); return false; }
  }
  const pl = plan(sets, p);
  if (p === 'icbm') {
    let need = pl.missiles;
    for (const k of D.SILOS) { const s = site(k); if (s.dead) continue; const take = Math.min(need, s.missiles); s.missiles -= take; need -= take; }
  } else if (p === 'slbm') S.slbmUsed += pl.missiles; else S.alcmUsed += pl.missiles;
  const g = { id: ++S.strikeSeq, sets: [...sets], p, t0: S.t, arrive: S.t + pl.ft, pl, applied: false, recalled: false };
  let origins;
  if (p === 'icbm') origins = D.SILOS.filter(k => !site(k).dead).map(k => [site(k).lat, site(k).lon]);
  else if (p === 'slbm') origins = D.SSBN_PATROL;
  else origins = S.wings.filter(w => w.state === 'air').map(w => [site(w.base).lat, site(w.base).lon]);
  if (!origins.length) origins = D.SSBN_PATROL;
  for (const k of sets) for (const t of D.RU_SETS[k].targets) {
    const o = pick(origins);
    S.out.push({ g, a: toVec(o[0], o[1]), b: toVec(t[0], t[1]), t0: S.t + rand(0, 40), ft: pl.ft });
  }
  S.strikes.push(g);
  S.esc += pl.esc; S.cred = clamp(S.cred + pl.cred, 0, 100); S.lastStrike = S.t; S.stats.strikes++;
  const names = sets.map(k => D.RU_SETS[k].n.toLowerCase()).join(', ');
  if (p === 'bomb') {
    log(`${S.leader === 'vp' ? 'Viceprezident' : 'Prezident'} autorizoval úder bombardérů na cíle: ${names}. Dopad za ~3 hodiny, do té doby je lze odvolat.`, 'crit');
  } else {
    log(`${S.leader === 'vp' ? 'Viceprezident' : 'Prezident'} autorizoval jaderný úder (${D.PLATFORMS[p].s}, ${pl.missiles} hlavic) na cíle: ${names}. Dopad za ${fmtEta(pl.ft)}.`, 'crit');
    at(S.t + pl.ft + 40, () => applyStrike(g));
    S.nextWave = Math.min(S.nextWave, S.t + 90);
    log('Ruské radary úder zachytí. Očekávejte odpověď.', 'warn');
  }
  provoke('americký jaderný úder');
  sfx('alarm');
  return true;
}
function applyStrike(g, quiet) {
  if (g.applied || g.recalled) return;
  g.applied = true;
  for (const k of g.sets) {
    const r = D.RU_SETS[k];
    S.enemyCas += r.cas;
    if (k === 'cf') S.arsenal *= .6;
    if (k === 'nav') { S.arsenal *= .85; S.enemy.slbmMul *= .5; S.enemy.bombersOff = true; }
    if (k === 'c2') { S.enemy.coordUntil = S.t + 1200; S.hot.blockUntil = S.t + 1500; }
    if (k === 'cv') S.arsenal *= .95;
  }
  if (!quiet) log(`Hlášení: americké hlavice dopadly na cíle v Rusku. Odhad obětí ${fmtM(g.pl.cas)}.`, 'crit');
}
function recallBombers() {
  const open = S.strikes.filter(g => g.p === 'bomb' && !g.applied && !g.recalled);
  if (!open.length) return;
  for (const g of open) g.recalled = true;
  S.out = S.out.filter(o => !o.g.recalled);
  S.esc = Math.max(0, S.esc - 10); S.cred = clamp(S.cred - 5, 0, 100);
  log('Bombardéry odvolány a vracejí se. Moskva to registruje jako signál deeskalace. Eskalace −10.', 'ok');
}

/* ---------- decision cards ---------- */
function openCard(e) {
  S.usedEvents.add(e.id); S.modal = e;
  G.ui.showCard(e); sfx('card');
}
function choose(i) {
  const e = S.modal; if (!e) return;
  S.modal = null; G.ui.hideCard();
  e.choices[i].fn(G.sim, S);
  G.ui.refresh();
}

/* ---------- main update ---------- */
function update(dt) {
  S.t += dt;
  S.esc = clamp(S.esc + dt / 60 * (S.hostile ? .5 : .2), 0, 100);
  S.order = clamp(S.order + dt / 60 * .2, 0, 100);
  if (S.t >= S.histNext) { S.history.push({ t: S.t, esc: S.esc, cred: S.cred, cas: S.cas, order: S.order }); S.histNext = S.t + 30; }

  S.timers.sort((a, b) => a.t - b.t);
  while (S.timers.length && S.timers[0].t <= S.t) { S.timers.shift().f(); if (S.ended) return; }

  if (S.sc.petrov && !S.hostile && S.esc > 70) provoke('rostoucí americkou pohotovost');

  if (!S.ceasefire && S.t >= S.nextWave) {
    if (S.t < S.enemy.coordUntil) S.nextWave = S.enemy.coordUntil;
    else { spawnWave(); S.nextWave = S.t + rand(200, 320); }
  }

  const cT = confirmT();
  for (const tr of S.tracks) {
    if (!active(tr)) continue;
    const e = eta(tr);
    if (tr.verifyEnd && S.t >= tr.verifyEnd) {
      tr.verifyEnd = null;
      if (tr.real) { tr.status = 'confirmed'; log(`${tr.id}: POTVRZENO. Skutečná hrozba, cíl ${site(tr.target).n}.`, 'crit'); }
      else { tr.status = 'false'; tr.tEnd = S.t; S.stats.falseSeen++; log(`${tr.id}: falešný kontakt. Vyřazen ze sledování.`, 'ok'); }
      continue;
    }
    if (tr.status === 'unverified' && e < cT && tr.kind !== 'BMB') {
      tr.verifyEnd = null;
      if (tr.real) { tr.status = 'confirmed'; log(`${tr.id}: pozemní radar potvrdil hlavici. Cíl ${site(tr.target).n}, dopad za ${fmtEta(e)}.`, 'crit'); }
      else { tr.status = 'false'; tr.tEnd = S.t; S.stats.falseSeen++; log(`${tr.id}: radary nic nezachytily. Šlo o falešný kontakt.`, 'ok'); }
      continue;
    }
    if (e <= 0) { if (tr.real) impact(tr); else { tr.status = 'false'; tr.tEnd = S.t; } }
    if (S.ended) return;
  }

  for (const it of S.ints) if (!it.done && S.t >= it.t1) { it.done = true; resolveInt(it); }
  S.ints = S.ints.filter(it => !it.done);

  if (S.potus === 'moving' && S.t >= S.potusEta) { S.potus = 'air'; log('Prezident je na palubě E-4B. Řetězec velení zajištěn.', 'ok'); }
  if (S.vp === 'moving' && S.t >= S.vpEta) { S.vp = 'safe'; log('Viceprezident je v Raven Rock. Kontinuita vlády zajištěna.', 'ok'); }
  if (S.tacamo === 'launching' && S.t >= S.tacamoEta) { S.tacamo = 'air'; log('E-6B TACAMO ve vzduchu. Spojení s ponorkami navázáno.', 'ok'); }
  for (const w of S.wings) if (w.state === 'launching' && S.t >= w.eta) {
    w.state = 'air'; S.cred = clamp(S.cred + 5, 0, 100); S.esc += S.hostile ? 3 : 5;
    log(`${w.name}: ${w.n} letounů ve vzduchu. Odstrašení +5.`, 'ok');
  }
  for (const [k, p] of Object.entries(S.ssbn.port)) if (p.state === 'sailing' && S.t >= p.eta) {
    p.state = 'sea'; log(`${site(k).s}: ponorky dosáhly hlubokého moře. Jsou v bezpečí.`, 'ok');
  }
  for (const sh of S.ships) if (sh.moveTo && S.t >= sh.eta) {
    sh.st = sh.moveTo; sh.moveTo = null; log(`${sh.name}: na stanovišti ${D.STATIONS[sh.st].n}.`, 'ok');
  }
  for (const s of Object.values(D.SITES)) if (s.type === 'city' && s.fallout > 0) {
    const d = Math.min(s.fallout, s.falloutRate * dt); s.fallout -= d; s.remain -= d; S.cas += d;
  }

  if (!S.modal) {
    const forced = G.EVENTS.find(e => e.forced && !S.usedEvents.has(e.id) && e.cond(S, G.sim));
    if (forced) openCard(forced);
    else if (S.t >= S.nextEvent) {
      const pool = G.EVENTS.filter(e => !e.forced && !S.usedEvents.has(e.id) && e.cond(S, G.sim));
      if (pool.length) openCard(pick(pool));
      S.nextEvent = S.t + rand(420, 660);
    }
  }

  if (S.hostile && !S.ceasefire && S.hot.ok >= 2 && S.esc < 20 && S.cred >= 40) {
    S.ceasefire = true;
    log('MOSKVA SOUHLASÍ S PŘÍMĚŘÍM. Nové starty nejsou očekávány. Rakety ve vzduchu ale odvolat nelze.', 'ok');
    sfx('chime');
  }
  const pendingOut = S.strikes.some(g => g.p !== 'bomb' && !g.applied);
  if (S.ceasefire && !S.tracks.some(t => active(t) && t.real) && !pendingOut) return endGame('ceasefire');
  if (S.sc.petrov && !S.hostile && S.t >= PETROV_WIN_T) return endGame('petrov');
  if (S.t >= END_T) return endGame('timeout');
}

/* ---------- end ---------- */
function endGame(reason) {
  if (S.ended) return;
  S.ended = true; S.running = false; S.modal = null;
  const late = S.strikes.filter(g => g.p === 'bomb' && !g.applied && !g.recalled);
  for (const g of late) applyStrike(g, true);
  S.history.push({ t: S.t, esc: S.esc, cred: S.cred, cas: S.cas, order: S.order });
  const total = S.cas + S.enemyCas;
  let verdict, text, good = false;
  if (reason === 'decap') { verdict = 'Ztráta velení'; text = 'Washington byl zasažen dřív, než se prezident i viceprezident dostali do bezpečí. Řetězec velení se rozpadl.'; }
  else if (reason === 'petrov') { verdict = 'Falešný poplach odhalen'; text = 'Útok nikdy neexistoval. Šlo o chybu satelitního systému a vy jste odolali tlaku na odvetu. Svět se o tom dozví až za mnoho let.'; good = true; }
  else if (total >= 60) { verdict = 'Totální jaderná válka'; text = 'Výměna úderů se vymkla kontrole. Obě země utrpěly ztráty, ze kterých se budou vzpamatovávat desítky let.'; }
  else if (reason === 'ceasefire' && total < 3) { verdict = 'Krize zvládnuta'; text = 'Konflikt se podařilo zastavit s minimálními ztrátami. Diplomacie a obrana zabraly.'; good = true; }
  else if (reason === 'ceasefire' && total < 20) { verdict = 'Příměří'; text = 'Zbraně utichly, ale cena byla vysoká.'; good = true; }
  else if (reason === 'ceasefire') { verdict = 'Pyrrhovo příměří'; text = 'Příměří platí, ale miliony lidí zemřely.'; }
  else { verdict = 'Konflikt pokračuje'; text = 'Uplynulo 90 minut a příměří se nepodařilo vyjednat. Vaše směna končí.'; }
  if (late.length) text += ' Bombardéry, které jste neodvolali, dorazí k cílům po skončení směny.';
  const bonus = { ceasefire: 250, petrov: 400, decap: -400 }[reason] || 0;
  const score = Math.max(0, Math.round((1000 - S.cas * 25 - S.enemyCas * 8 + S.stats.kills * 15 - S.stats.wasted * 5 + bonus) * S.df.score));
  G.ui.showEnd({ reason, verdict, text, good, score, total });
}

G.sim = {
  END_T, VERIFY_CAP, SHOOTERS,
  newGame, update, select, cycle, verify, verifying, verifyTime, confirmT, radarsAlive,
  active, eta, posOf, selTrack, shipPos, shooterCheck, pk, engage,
  evacPotus, evacVp, setDefcon, wingLaunch, sail, tacamo, shipMove, seaPorts,
  recon, sigint, cyber, expectedWave,
  hotline, nato, allies, china,
  alertCity, alertAll, speech, guard, fema,
  capacity, plan, strikeBlock, strike, recallBombers,
  choose, provoke, spawnTrack, endGame, log,
};
})();
