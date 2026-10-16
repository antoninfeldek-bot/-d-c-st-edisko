'use strict';
// Game simulation: state, enemy waves, tracks, defence, forces, diplomacy, retaliation, endings.
(() => {
const { L, nm, pl, clamp, rand, pick, toVec, fromVec, along, angDist, fmtT, fmtEta, fmtM } = G;
const D = G.DATA;
const END_T = 90 * 60;
const VERIFY_CAP = 3;
const PETROV_WIN_T = 45 * 60;

let S = null;
const log = (m, l = 'info') => G.ui.log(m, l);
const sfx = n => G.audio[n] && G.audio[n]();
const site = k => D.SITES[k];
const sn = k => nm(site(k));
const at = (t, f) => S.timers.push({ t, f });

const active = tr => tr.status === 'unverified' || tr.status === 'confirmed';
const eta = tr => tr.tLaunch + tr.tFlight - S.t;
const posOf = (tr, t = S.t) => along(tr.a, tr.b, clamp((t - tr.tLaunch) / tr.tFlight, 0, 1));
const selTrack = () => S && S.tracks.find(t => t.id === S.selected);
const fx = (lat, lon, col, dur, r) => S.fx.push({ lat, lon, col, dur, r, t0: performance.now() });
const zoneName = tr => L(tr.zone, tr.zoneEn);
const leaderName = () => S.leader === 'vp' ? L('Viceprezident', 'The Vice President') : L('Prezident', 'The President');

function genCode() {
  const A = 'ABCDEFHJKLMNPRSTVXZ';
  return pick(A) + Math.floor(rand(1, 10)) + pick(A) + Math.floor(rand(1, 10));
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
    ships: D.SHIPS0.map(s => ({ ...s, ammo: 8, moveTo: null, t0: 0, eta: 0 })),
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
      log(L('SBIRS: zachyceny 3 starty balistických raket z území Ruska (K-100 až K-102).', 'SBIRS: 3 ballistic missile launches detected from Russian territory (K-100 to K-102).'), 'crit');
      sfx('alarm'); select(a.id);
    });
    at(25, () => log(L('NMCC svolává konferenci o ohrožení. Prezident je informován.', 'NMCC convenes a threat assessment conference. The President has been informed.')));
    at(70, () => log(L('Doporučení štábu: ověřte kontakty a zvažte DEFCON 2, bez něj nelze odpálit GMD.', 'Staff recommendation: verify the contacts and consider DEFCON 2. GMD cannot fire without it.')));
    at(150, () => log(L('Námořnictvo: ztracen kontakt s ruskou strategickou ponorkou v severním Atlantiku.', 'Navy: contact lost with a Russian ballistic missile submarine in the North Atlantic.'), 'warn'));
    at(210, () => {
      spawnTrack('SLBM', true, D.LAUNCH.SLBM[1], 'KINGS'); S.arsenal--; S.stats.realLaunched++;
      log(L('SBIRS: start z hladiny severního Atlantiku. Raketa z ponorky, let kolem 12 minut. Torpédoborec USS Carney je v dosahu.', 'SBIRS: launch from the North Atlantic. Submarine-launched missile, about 12 minutes of flight. USS Carney is in range.'), 'crit'); sfx('alarm');
    });
  } else if (k === 'subs') {
    at(3, () => {
      const a = spawnTrack('SLBM', true, D.LAUNCH.SLBM[1], 'NORFOLK');
      spawnTrack('SLBM', true, D.LAUNCH.SLBM[1], 'KINGS');
      spawnTrack('SLBM', false, D.LAUNCH.SLBM[1], 'BOS');
      S.arsenal -= 2; S.stats.realLaunched += 2;
      log(L('SBIRS: tři starty z hladiny severního Atlantiku, 800 km od pobřeží!', 'SBIRS: three launches from the North Atlantic, 800 km off the coast!'), 'crit'); sfx('alarm'); select(a.id);
    });
    at(30, () => log(L('Doporučení štábu: varovací doba je extrémně krátká. Okamžitě evakuujte prezidenta a viceprezidenta.', 'Staff recommendation: warning time is extremely short. Evacuate the President and Vice President now.'), 'warn'));
    at(90, () => log(L('Námořnictvo: v Pacifiku zachycen hluk další ruské ponorky.', 'Navy: another Russian submarine detected in the Pacific.'), 'warn'));
    at(300, () => {
      spawnTrack('SLBM', true, D.LAUNCH.SLBM[1], 'DC'); S.arsenal--; S.stats.realLaunched++;
      log(L('SBIRS: nový start z Atlantiku. Dráha míří k oblasti Washingtonu.', 'SBIRS: new launch from the Atlantic. Trajectory heads for the Washington area.'), 'crit'); sfx('alarm');
    });
    at(420, () => {
      spawnTrack('SLBM', true, D.LAUNCH.SLBM[2], 'BANGOR'); S.arsenal--; S.stats.realLaunched++;
      log(L('SBIRS: start ze severního Pacifiku.', 'SBIRS: launch from the North Pacific.'), 'crit'); sfx('alarm');
    });
  } else {
    at(3, () => {
      const a = spawnTrack('ICBM', false, D.LAUNCH.ICBM[3], 'MALM');
      log(L('SBIRS: zachycen start ICBM z oblasti Jasnyj (K-100).', 'SBIRS: ICBM launch detected from the Yasny area (K-100).'), 'crit'); sfx('alarm'); select(a.id);
    });
    at(40, () => log(L('Satelitní snímky oblasti Jasnyj jsou nejasné. Nad základnou je oblačnost a nízké slunce.', 'Satellite imagery of Yasny is unclear. There is cloud cover and a low sun over the base.')));
    at(65, () => {
      for (const tg of ['MINOT', 'WARREN', 'MALM', 'OFFUTT']) spawnTrack('ICBM', false, D.LAUNCH.ICBM[3], tg);
      log(L('SBIRS: další 4 starty ze stejné základny (K-101 až K-104). Systém hlásí vysokou spolehlivost.', 'SBIRS: 4 more launches from the same base (K-101 to K-104). The system reports high confidence.'), 'crit'); sfx('alarm');
    });
    at(130, () => log(L('Pozemní radary zatím nic nezachytily. Útok z jediné základny by byl neobvyklý.', 'Ground radars have seen nothing so far. An attack from a single base would be unusual.')));
  }
  at(480, () => log(L('Spojení horkou linkou Washington–Moskva je navázáno.', 'The Washington–Moscow hotline is connected.'), 'ok'));
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
    id: (kind === 'BMB' ? 'B-' : 'K-') + (S.seq++), kind, real, zone: zone[0], zoneEn: zone[4] || zone[0], target,
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

const contactsWord = n => pl(n, ['kontakt', 'kontakty', 'kontaktů'], ['contact', 'contacts']);
function spawnWave() {
  if (!S.hostile) {
    const f = Math.random() < .6 ? 1 + Math.floor(Math.random() * 3) : 0;
    if (!f) { log(L('Satelity hlásí klid. Žádné nové starty.', 'Satellites report all quiet. No new launches.')); return; }
    const ids = [];
    for (let i = 0; i < f; i++) ids.push(spawnTrack('ICBM', false, D.LAUNCH.ICBM[3]).id);
    log(L(`SBIRS: ${f} ${pl(f, ['nový start', 'nové starty', 'nových startů'], [])} z oblasti Jasnyj (${ids.join(', ')}).`,
      `SBIRS: ${f} new ${pl(f, [], ['launch', 'launches'])} from the Yasny area (${ids.join(', ')}).`), 'crit');
    sfx('alarm'); return;
  }
  let n = Math.round(expectedWave() * rand(.75, 1.25));
  n = clamp(n, 0, Math.min(7, Math.floor(S.arsenal)));
  const f = Math.random() < S.df.falseP ? (Math.random() < .6 ? 1 : 2) : 0;
  if (n + f === 0) { log(L('Satelity hlásí klid. Žádné nové starty.', 'Satellites report all quiet. No new launches.')); return; }
  S.arsenal -= n; S.esc += 1; S.stats.realLaunched += n;
  const ids = [];
  const pS = S.sc.slbm * S.enemy.slbmMul, pB = S.enemy.bombersOff ? 0 : S.sc.bmb;
  for (let i = 0; i < n; i++) {
    const r = Math.random();
    ids.push(spawnTrack(r < pB ? 'BMB' : r < pB + pS ? 'SLBM' : 'ICBM', true).id);
  }
  for (let i = 0; i < f; i++) ids.push(spawnTrack(pick(['ICBM', 'ICBM', 'SLBM']), false).id);
  ids.sort();
  log(L(`Nová vlna: ${ids.length} ${contactsWord(ids.length)} (${ids.join(', ')}).`, `New wave: ${ids.length} ${contactsWord(ids.length)} (${ids.join(', ')}).`), 'crit');
  sfx('alarm');
  if (!selTrack() || !active(selTrack())) select(ids[0]);
}

// Petrov scenario: a provocation turns a false alarm into a real war.
function provoke(why) {
  if (!S.sc.petrov || S.hostile) return;
  S.hostile = true; S.esc += 25; S.nextWave = Math.min(S.nextWave, S.t + 120);
  log(L(`Moskva vyhodnotila ${why[0]} jako přípravu k útoku. Ruské strategické síly přecházejí do odvety.`,
    `Moscow read ${why[1]} as preparation for an attack. Russian strategic forces are moving to retaliate.`), 'crit');
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
  if (verifying() >= VERIFY_CAP) { log(L('Všechny ověřovací kanály jsou obsazené.', 'All verification channels are busy.'), 'warn'); return; }
  tr.verifyEnd = S.t + verifyTime(); sfx('blip');
  log(L(`${tr.id}: zahájena korelace dat SBIRS a radarů včasné výstrahy.`, `${tr.id}: correlating SBIRS and early-warning radar data.`), 'own');
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
  if (!tr || !active(tr)) return L('Vyberte aktivní kontakt.', 'Select an active contact.');
  const type = shooterType(key);
  if (type === 'gmd') {
    const s = site(key);
    if (s.dead) return L('Základna je vyřazena.', 'Base destroyed.');
    if (tr.kind !== 'ICBM') return L('GMD zasahuje jen ICBM.', 'GMD engages ICBMs only.');
    if (S.defcon > 2) return L('Vyžaduje DEFCON 2.', 'Requires DEFCON 2.');
    if (s.stock < n) return L('Nedostatek interceptorů.', 'Not enough interceptors.');
    if (eta(tr) < 300) return L('Příliš pozdě.', 'Too late.');
    return null;
  }
  if (type === 'ship') {
    const sh = shipOf(key);
    if (sh.moveTo) return L('Loď je na přesunu.', 'Ship is repositioning.');
    if (tr.kind === 'BMB') return L('SM-3 nezasahuje letadla.', 'SM-3 cannot engage aircraft.');
    if (sh.ammo < n) return L('Došly střely SM-3.', 'Out of SM-3 missiles.');
    if (eta(tr) < 180) return L('Příliš pozdě.', 'Too late.');
    const d = angDist(posOf(tr, S.t + FLIGHT.ship), shipPos(sh));
    if (d > 20) return L(`Mimo dosah (${Math.round(d * 111)} km).`, `Out of range (${Math.round(d * 111)} km).`);
    return null;
  }
  const s = site(key);
  if (tr.kind !== 'BMB') return L('Jen proti bombardérům.', 'Bombers only.');
  if (s.dead) return L('Základna je vyřazena.', 'Base destroyed.');
  if (s.fighters < 1) return L('Všechny letky jsou ve vzduchu.', 'All squadrons are airborne.');
  if (eta(tr) < 700) return L('Bombardér je příliš blízko cíle.', 'The bomber is too close to its target.');
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
  if (type === 'gmd') { const s = site(key); s.stock -= n; from = [s.lat, s.lon]; label = L(`${s.s}: odpáleno ${n}× GBI`, `${s.s}: ${n}× GBI launched`); }
  else if (type === 'ship') { const sh = shipOf(key); sh.ammo -= n; from = shipPos(sh); label = L(`${sh.name}: odpáleno ${n}× SM-3`, `${sh.name}: ${n}× SM-3 launched`); }
  else { const s = site(key); s.fighters--; from = [s.lat, s.lon]; label = L(`${s.s}: letka F-22 vyslána`, `${s.s}: F-22 squadron scrambled`); }
  if (type !== 'air') S.stats.fired += n;
  S.ints.push({ tr, n, key, type, t0: S.t, t1, p: pk(key, n), a: toVec(...from), b: toVec(...posOf(tr, t1)) });
  log(L(`${label} proti ${tr.id}. Střet za ${fmtEta(t1 - S.t)}.`, `${label} against ${tr.id}. Intercept in ${fmtEta(t1 - S.t)}.`), 'own'); sfx('blip');
}
function resolveInt(it) {
  const tr = it.tr, back = () => { if (it.type === 'air') site(it.key).fighters++; };
  if (!active(tr)) {
    S.stats.wasted += it.type === 'air' ? 0 : it.n;
    log(L(`Střet s ${tr.id} zrušen, kontakt už neexistuje.`, `Intercept of ${tr.id} cancelled, the contact no longer exists.`)); back(); return;
  }
  if (!tr.real) {
    tr.status = 'false'; tr.tEnd = S.t; S.stats.falseSeen++;
    if (it.type !== 'air') S.stats.wasted += it.n;
    log(L(`${tr.id}: v prostoru střetu nic není. Kontakt byl falešný${it.type === 'air' ? ', letka se vrací' : ', střela promarněna'}.`,
      `${tr.id}: nothing at the intercept point. The contact was false${it.type === 'air' ? ', squadron returning' : ', interceptor wasted'}.`), 'warn');
    back(); return;
  }
  const pos = posOf(tr);
  if (Math.random() < it.p) {
    tr.status = 'destroyed'; tr.tEnd = S.t; S.stats.kills++; S.cred = clamp(S.cred + 2, 0, 100);
    fx(pos[0], pos[1], 'cyan', 1600, 18);
    log(L(`${tr.id}: ZÁSAH. Hrozba zničena.`, `${tr.id}: KILL. Threat destroyed.`), 'ok'); sfx('hit');
    if (Math.random() < .9) back();
  } else {
    fx(pos[0], pos[1], 'dim', 1200, 12);
    log(L(`${tr.id}: MINUTÍ. Hrozba pokračuje, dopad za ${fmtEta(eta(tr))}.`, `${tr.id}: MISS. Threat continues, impact in ${fmtEta(eta(tr))}.`), 'warn');
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
    const warned = red > .05;
    log(L(`DOPAD: ${s.n}. Odhad obětí ${fmtM(kk)}${warned ? `, varování EAS ztráty snížilo o ${Math.round(red * 100)} %` : ', obyvatelé nebyli varováni'}. Hrozí radioaktivní spad.`,
      `IMPACT: ${s.n}. Estimated deaths ${fmtM(kk)}${warned ? `, EAS warning cut losses by ${Math.round(red * 100)}%` : ', the population was not warned'}. Radioactive fallout expected.`), 'crit');
    if (k === 'DC') dcHit();
  } else if (s.type === 'hq') {
    S.cred -= 2;
    log(L('DOPAD u Cheyenne Mountain. Velín v hoře odolal, spojení běží po záložních linkách.', 'IMPACT at Cheyenne Mountain. The command centre inside the mountain held; comms running on backup lines.'), 'crit');
  } else {
    const was = s.dead; s.dead = true; S.cred -= 3;
    S.cas += s.type === 'radar' ? .01 : s.type === 'silo' ? .02 : .12;
    const extra = [];
    if (s.stock && !was) { extra.push(L(`Ztraceno ${s.stock} interceptorů.`, `${s.stock} interceptors lost.`)); s.stock = 0; }
    if (s.fighters0 && !was) { if (s.fighters) extra.push(L('Letky na zemi zničeny.', 'Squadrons destroyed on the ground.')); s.fighters = 0; }
    if (s.missiles0 && !was) { if (s.missiles) extra.push(L(`Zničeno ${s.missiles} raket Minuteman III v silech.`, `${s.missiles} Minuteman III missiles destroyed in their silos.`)); s.missiles = 0; }
    if (s.type === 'radar') extra.push(L('Potvrzování cílů bude pomalejší.', 'Target confirmation will be slower.'));
    for (const w of S.wings) if (w.base === k && (w.state === 'ground' || w.state === 'launching')) {
      extra.push(L(`${w.name}: ${w.n} letounů zničeno na zemi.`, `${w.en}: ${w.n} aircraft destroyed on the ground.`)); w.state = 'lost'; w.n = 0;
    }
    const p = S.ssbn.port[k];
    if (p && p.state !== 'sea' && p.n > 0) { extra.push(L(`${p.n} ponorky zničeny v přístavu.`, `${p.n} submarines destroyed in port.`)); p.n = 0; p.state = 'lost'; }
    if (k === 'TINKER' && S.tacamo !== 'air' && S.tacamo !== 'lost') { extra.push(L('Letouny E-6B TACAMO zničeny na zemi.', 'E-6B TACAMO aircraft destroyed on the ground.')); S.tacamo = 'lost'; }
    log(L(`DOPAD: ${sn(k)}. `, `IMPACT: ${sn(k)}. `) + extra.join(' '), 'crit');
  }
  S.cred = clamp(S.cred, 0, 100); S.order = clamp(S.order, 0, 100);
}
function dcHit() {
  const surv = st => st === 'air' || st === 'safe' ? true : st === 'moving' ? Math.random() < .4 : false;
  if (S.potus !== 'dead' && !surv(S.potus)) { S.potus = 'dead'; log(L('Spojení s prezidentem přerušeno.', 'Contact with the President lost.'), 'crit'); }
  if (S.vp !== 'dead' && !surv(S.vp)) { S.vp = 'dead'; log(L('Spojení s viceprezidentem přerušeno.', 'Contact with the Vice President lost.'), 'crit'); }
  updateLeader();
}
function updateLeader() {
  const prev = S.leader;
  S.leader = S.potus !== 'dead' ? 'potus' : S.vp !== 'dead' ? 'vp' : null;
  if (prev === 'potus' && S.leader === 'vp') {
    S.cred = clamp(S.cred - 10, 0, 100); S.order = clamp(S.order - 10, 0, 100);
    log(L('Viceprezident přebírá pravomoci vrchního velitele z Raven Rock. Řetězec velení zachován.', 'The Vice President assumes command from Raven Rock. The chain of command holds.'), 'warn');
  }
  if (prev && !S.leader) {
    log(L('Národní velitelská autorita je ztracena.', 'National Command Authority has been lost.'), 'crit');
    at(S.t + 8, () => endGame('decap'));
  }
}

/* ---------- forces & command ---------- */
function evacPotus() {
  if (S.potus !== 'dc') return;
  S.potus = 'moving'; S.potusEta = S.t + 600;
  log(L('Prezident opouští Bílý dům. Marine One míří k letounu E-4B, odhad 10 minut.', 'The President is leaving the White House. Marine One heading for the E-4B, about 10 minutes.'), 'own');
}
function evacVp() {
  if (S.vp !== 'dc') return;
  S.vp = 'moving'; S.vpEta = S.t + 480;
  log(L('Viceprezident se přesouvá do podzemního komplexu Raven Rock, odhad 8 minut.', 'The Vice President is moving to the Raven Rock bunker, about 8 minutes.'), 'own');
}
function setDefcon(d) {
  if (S.t < S.defNext) return;
  const nd = clamp(S.defcon + d, 1, 5); if (nd === S.defcon) return;
  S.defcon = nd; S.defNext = S.t + 60;
  if (d < 0) {
    S.cred = clamp(S.cred + 5, 0, 100); S.esc += 4;
    log(L(`Vyhlášen DEFCON ${nd}.`, `DEFCON ${nd} declared.`), nd === 1 ? 'crit' : 'warn');
    if (nd === 1) provoke(['vyhlášení DEFCON 1', 'DEFCON 1']);
  } else {
    S.cred = clamp(S.cred - 4, 0, 100); S.esc = Math.max(0, S.esc - 3);
    log(L(`Pohotovost snížena na DEFCON ${nd}. Signál deeskalace.`, `Readiness lowered to DEFCON ${nd}. A de-escalation signal.`), 'own');
  }
}
function wingLaunch(id) {
  const w = S.wings.find(x => x.id === id);
  if (!w || w.state !== 'ground') return;
  w.state = 'launching'; w.eta = S.t + 300;
  log(L(`${w.name}: poplachový vzlet, posádky běží k letounům. Ve vzduchu za 5 minut.`, `${w.en}: alert launch, crews running to their aircraft. Airborne in 5 minutes.`), 'own');
}
function sail(k) {
  const p = S.ssbn.port[k];
  if (!p || p.state !== 'port') return;
  p.state = 'sailing'; p.eta = S.t + 1200;
  log(L(`${site(k).s}: ${p.n} ponorky vyplouvají. Do bezpečí hlubokého moře za 20 minut.`, `${site(k).s}: ${p.n} submarines putting to sea. Safe in deep water in 20 minutes.`), 'own');
}
function tacamo() {
  if (S.tacamo !== 'ground') return;
  S.tacamo = 'launching'; S.tacamoEta = S.t + 180;
  log(L('Tinker AFB: E-6B Mercury (TACAMO) startuje. Spojení s ponorkami za 3 minuty.', 'Tinker AFB: E-6B Mercury (TACAMO) taking off. Submarine link in 3 minutes.'), 'own');
}
function shipMove(id, st) {
  const sh = S.ships.find(s => s.id === id);
  if (!sh || sh.moveTo || sh.st === st || !D.STATIONS[st]) return;
  sh.moveTo = st; sh.t0 = S.t; sh.eta = S.t + 900;
  log(L(`${sh.name}: přesun na stanoviště ${nm(D.STATIONS[st])}, odhad 15 minut.`, `${sh.name}: repositioning to ${nm(D.STATIONS[st])}, about 15 minutes.`), 'own');
}
const seaPorts = () => Object.values(S.ssbn.port).filter(p => p.state === 'sea').reduce((a, p) => a + p.n, 0);

/* ---------- intelligence ---------- */
function recon() {
  if (S.t < S.intel.reconNext) return;
  S.intel.reconBusy = S.t + 180; S.intel.reconNext = S.t + 660;
  log(L('KH-11: satelit přenastaven na snímkování ruských odpalovacích základen. Výsledky za 3 minuty.', 'KH-11: satellite retasked to image Russian launch sites. Results in 3 minutes.'), 'own');
  at(S.t + 180, () => {
    S.intel.reconBusy = 0;
    if (!S.hostile) {
      S.intel.forecast = { at: S.t + 600, n: 0, quiet: true };
      log(L('KH-11: na odpalovacích základnách včetně Jasného není žádná aktivita. Žádné stopy po startech.', 'KH-11: no activity at any launch site, Yasny included. No trace of launches.'), 'ok'); return;
    }
    if (S.ceasefire) {
      S.intel.forecast = { at: S.t + 600, n: 0, quiet: true };
      log(L('KH-11: ruské síly se stahují. Žádné přípravy ke startu.', 'KH-11: Russian forces are standing down. No launch preparations.'), 'ok'); return;
    }
    const n = expectedWave(), at2 = Math.max(S.nextWave, S.enemy.coordUntil);
    S.intel.forecast = { at: at2, n };
    log(L(`KH-11: další vlna očekávána za ${fmtEta(at2 - S.t)}, odhad ${n} ${pl(n, ['raketa', 'rakety', 'raket'], [])}. Ruský arzenál ~${Math.round(S.arsenal)} hlavic.`,
      `KH-11: next wave expected in ${fmtEta(at2 - S.t)}, estimated ${n} ${pl(n, [], ['missile', 'missiles'])}. Russian arsenal ~${Math.round(S.arsenal)} warheads.`), 'ok');
  });
}
function sigint() {
  if (S.t < S.intel.sigintNext) return;
  S.intel.sigintUntil = S.t + 600; S.intel.sigintNext = S.t + 1500;
  log(L('NSA: odposlech ruské vojenské komunikace aktivní. Ověřování kontaktů zrychleno na 45 s po dobu 10 minut.', 'NSA: intercepting Russian military communications. Contact verification cut to 45 s for 10 minutes.'), 'own');
}
function cyber() {
  if (S.t < S.intel.cyberNext) return;
  S.intel.cyberNext = S.t + 900;
  const r = Math.random();
  if (r < .55) {
    S.nextWave += 300;
    log(L('USCYBERCOM: útok na ruskou síť velení uspěl. Další vlna se zdrží asi o 5 minut.', 'USCYBERCOM: attack on the Russian command network succeeded. The next wave is delayed by about 5 minutes.'), 'ok');
  } else if (r < .8) {
    log(L('USCYBERCOM: operace bez účinku, cílové systémy jsou izolované.', 'USCYBERCOM: no effect, the target systems are air-gapped.'), 'info');
  } else {
    S.esc += 8;
    log(L('USCYBERCOM: operace odhalena. Moskva ji označila za přípravu k prvnímu úderu.', 'USCYBERCOM: operation detected. Moscow calls it preparation for a first strike.'), 'warn');
    provoke(['kybernetický útok', 'the cyber attack']);
  }
}

/* ---------- diplomacy ---------- */
function hotline(kind) {
  if (S.t < S.hot.next || S.ceasefire) return;
  S.hot.next = S.t + 300; S.hot.tries++;
  const HL = L('Horká linka: ', 'Hotline: ');
  if (S.t < S.hot.blockUntil) { log(HL + L('Moskva neodpovídá. Ruská velitelská centra jsou zřejmě vyřazena.', 'Moscow does not answer. Russian command centres appear to be destroyed.'), 'warn'); return; }
  if (!S.hostile) {
    if (kind === 'warn') { S.esc += 10; log(HL + L('Moskva výhrůžku odmítá a tvrdí, že žádné rakety neodpálila.', 'Moscow rejects the threat and insists it has launched nothing.'), 'warn'); return; }
    S.esc = Math.max(0, S.esc - 8); S.hot.ok++;
    log(HL + L('Moskva důrazně popírá jakékoli starty a navrhuje společné ověření dat.', 'Moscow firmly denies any launches and proposes a joint check of the data.'), 'ok');
    if (kind === 'ask') hint([`Moskva tvrdí, že žádnou raketu neodpálila.`, `Moscow says it has launched no missiles.`]);
    return;
  }
  const recent = S.t - S.lastStrike < 900;
  if (kind === 'truce') {
    const p = clamp(.8 - S.esc / 120 - (recent ? .35 : 0) - (S.cred < 40 ? .15 : 0), .05, .9);
    if (Math.random() < p) {
      const d = Math.round(rand(14, 22)); S.esc = Math.max(0, S.esc - d); S.hot.ok++;
      log(HL + L(`Moskva přijala návrh na zastavení dalších startů. Eskalace −${d}.`, `Moscow accepted the proposal to halt further launches. Escalation −${d}.`), 'ok');
    } else {
      S.esc += 3;
      log(HL + (recent ? L('po americkém úderu Moskva jednání odmítá.', 'after the American strike Moscow refuses to talk.') : L('druhá strana návrh odmítla.', 'the other side rejected the proposal.')), 'warn');
    }
  } else if (kind === 'assure') {
    const p = clamp(.85 - S.esc / 150 - (recent ? .5 : 0), .05, .9);
    if (Math.random() < p) {
      const d = Math.round(rand(8, 12)); S.esc = Math.max(0, S.esc - d); S.cred = clamp(S.cred - 6, 0, 100);
      log(HL + L(`ujistili jste Moskvu, že USA neodpoví, pokud útoky ustanou. Eskalace −${d}, odstrašení −6.`, `you assured Moscow the US will not respond if the attacks stop. Escalation −${d}, deterrence −6.`), 'ok');
    } else log(HL + L('Moskva ujištění nevěří.', 'Moscow does not believe the assurance.'), 'warn');
  } else if (kind === 'warn') {
    if (S.cred >= 60) { S.esc = Math.max(0, S.esc - 6); S.cred = clamp(S.cred + 6, 0, 100); log(HL + L('varování zabralo. Moskva zvažuje další kroky. Eskalace −6.', 'the warning worked. Moscow is reconsidering. Escalation −6.'), 'ok'); }
    else { S.esc += 6; S.cred = clamp(S.cred + 4, 0, 100); log(HL + L('Moskva výhrůžku nebere vážně a reaguje ostře. Eskalace +6.', 'Moscow does not take the threat seriously and reacts sharply. Escalation +6.'), 'warn'); }
  } else if (kind === 'ask') {
    const tr = selTrack();
    S.esc = Math.max(0, S.esc - 2);
    if (!tr || tr.status !== 'unverified') { log(HL + L('Moskva odmítá komentovat jednotlivé starty.', 'Moscow refuses to comment on individual launches.')); return; }
    const truth = Math.random() < .75, says = truth ? tr.real : !tr.real;
    hint(says ? [`Moskva potvrzuje start ${tr.id}.`, `Moscow confirms launch ${tr.id}.`] : [`Moskva tvrdí, že ${tr.id} není její raketa.`, `Moscow says ${tr.id} is not its missile.`], tr);
  }
}
function hint(text, tr) {
  const list = tr ? [tr] : S.tracks.filter(t => t.status === 'unverified');
  for (const t of list) S.hints[t.id] = text;
  log(L('Horká linka: ' + text[0] + ' (Nemusí to být pravda.)', 'Hotline: ' + text[1] + ' (It may not be true.)'), 'info');
}
function nato() {
  if (S.t < S.dip.natoNext) return;
  S.dip.natoNext = S.t + 900; S.cred = clamp(S.cred + 8, 0, 100); S.esc += 2;
  log(L('NATO: Severoatlantická rada vyjádřila plnou podporu USA. Odstrašení +8.', 'NATO: the North Atlantic Council expresses full support for the US. Deterrence +8.'), 'ok');
}
function allies() {
  if (S.dip.alliesUsed) return;
  S.dip.alliesUsed = true; S.cred = clamp(S.cred + 12, 0, 100); S.esc += 6;
  log(L('Velká Británie a Francie zvedly pohotovost jaderných ponorek. Odstrašení +12, eskalace +6.', 'Britain and France raised the readiness of their nuclear submarines. Deterrence +12, escalation +6.'), 'warn');
}
function china() {
  if (S.dip.chinaUsed || S.t < 1200) return;
  S.dip.chinaUsed = true;
  const p = clamp(.75 - S.esc / 150, .1, .8);
  if (Math.random() < p) {
    S.esc = Math.max(0, S.esc - 12); S.hot.next = S.t;
    log(L('Peking: čínské zprostředkování přimělo Moskvu k jednání. Eskalace −12, horká linka je hned k dispozici.', 'Beijing: Chinese mediation brought Moscow to the table. Escalation −12, the hotline is available now.'), 'ok');
  } else log(L('Peking: Moskva čínské zprostředkování odmítla.', 'Beijing: Moscow rejected Chinese mediation.'), 'warn');
}

/* ---------- civil ---------- */
function alertCity(k) {
  const s = site(k);
  if (!s || s.alertT != null) return;
  s.alertT = S.t; S.order = clamp(S.order - 2, 0, 100);
  log(L(`EAS: vyhlášeno varování pro ${s.n}. Obyvatelé míří do krytů.`, `EAS: warning issued for ${s.n}. People are heading for shelters.`), 'own'); sfx('blip');
}
function alertAll() {
  if (S.civ.nationwide) return;
  S.civ.nationwide = true;
  let n = 0;
  for (const s of Object.values(D.SITES)) if (s.type === 'city' && s.alertT == null) { s.alertT = S.t; n++; }
  S.order = clamp(S.order - 12, 0, 100);
  log(L(`EAS: celostátní poplach vyhlášen pro ${n} ${pl(n, ['město', 'města', 'měst'], [])}. Veřejný pořádek −12.`,
    `EAS: nationwide alert issued for ${n} ${pl(n, [], ['city', 'cities'])}. Public order −12.`), 'warn'); sfx('blip');
}
function speech() {
  if (S.t < S.civ.speechNext || !S.leader) return;
  S.civ.speechNext = S.t + 900; S.order = clamp(S.order + 15, 0, 100);
  log(L(`${leaderName()} promluvil k národu. Veřejný pořádek +15.`, `${leaderName()} addressed the nation. Public order +15.`), 'ok');
}
function guard() {
  if (S.t < S.civ.guardNext) return;
  S.civ.guardNext = S.t + 1200; S.order = clamp(S.order + 12, 0, 100);
  log(L('Národní garda nasazena v zasažených oblastech. Veřejný pořádek +12.', 'National Guard deployed to affected areas. Public order +12.'), 'own');
}
function fema(k) {
  const s = site(k);
  if (!s || !s.hits || s.fema || S.civ.fema < 1) return;
  s.fema = true; S.civ.fema--; s.fallout *= .5; s.falloutRate = s.fallout / 900;
  log(L(`FEMA: záchranné týmy vyslány do ${s.n}. Ztráty spadem sníženy na polovinu.`, `FEMA: rescue teams sent to ${s.n}. Fallout deaths cut by half.`), 'own');
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
  if (!sets.length) return L('Vyberte aspoň jednu sadu cílů.', 'Select at least one target set.');
  if (S.defcon !== 1) return L('Vyžaduje DEFCON 1.', 'Requires DEFCON 1.');
  if (!S.leader) return L('Chybí národní velitelská autorita.', 'No National Command Authority.');
  if (p === 'slbm' && S.tacamo !== 'air') return L('Ponorky vyžadují spojení přes E-6B TACAMO.', 'Submarines need the E-6B TACAMO link.');
  if (p === 'bomb' && !S.wings.some(w => w.state === 'air')) return L('Žádné bombardéry ve vzduchu.', 'No bombers airborne.');
  const need = plan(sets, p).missiles, cap = capacity(p);
  if (cap < need) return L(`Nedostatek nosičů (${cap} z ${need}).`, `Not enough delivery systems (${cap} of ${need}).`);
  if ((code || '').trim().toUpperCase() !== S.code) return L('Zadejte platný autentizační kód.', 'Enter a valid authentication code.');
  return null;
}
function strike(sets, p, code, force) {
  if (!force) {
    const why = strikeBlock(sets, p, code);
    if (why) {
      // everything but the code is in order: tell the player the code is wrong
      if (code && code.trim() && !strikeBlock(sets, p, S.code))
        log(L('Autentizační kód nesouhlasí. Rozkaz neplatný.', 'Authentication code does not match. Order invalid.'), 'warn');
      return false;
    }
  }
  const pln = plan(sets, p);
  if (p === 'icbm') {
    let need = pln.missiles;
    for (const k of D.SILOS) { const s = site(k); if (s.dead) continue; const take = Math.min(need, s.missiles); s.missiles -= take; need -= take; }
  } else if (p === 'slbm') S.slbmUsed += pln.missiles; else S.alcmUsed += pln.missiles;
  const g = { id: ++S.strikeSeq, sets: [...sets], p, t0: S.t, arrive: S.t + pln.ft, pl: pln, applied: false, recalled: false };
  let origins;
  if (p === 'icbm') origins = D.SILOS.filter(k => !site(k).dead).map(k => [site(k).lat, site(k).lon]);
  else if (p === 'slbm') origins = D.SSBN_PATROL;
  else origins = S.wings.filter(w => w.state === 'air').map(w => [site(w.base).lat, site(w.base).lon]);
  if (!origins.length) origins = D.SSBN_PATROL;
  for (const k of sets) for (const t of D.RU_SETS[k].targets) {
    const o = pick(origins);
    S.out.push({ g, a: toVec(o[0], o[1]), b: toVec(t[0], t[1]), t0: S.t + rand(0, 40), ft: pln.ft });
  }
  S.strikes.push(g);
  S.esc += pln.esc; S.cred = clamp(S.cred + pln.cred, 0, 100); S.lastStrike = S.t; S.stats.strikes++;
  const names = sets.map(k => nm(D.RU_SETS[k]).toLowerCase()).join(', ');
  if (p === 'bomb') {
    log(L(`${leaderName()} autorizoval úder bombardérů na cíle: ${names}. Dopad za ~3 hodiny, do té doby je lze odvolat.`,
      `${leaderName()} authorised a bomber strike on: ${names}. Impact in ~3 hours; they can be recalled until then.`), 'crit');
  } else {
    log(L(`${leaderName()} autorizoval jaderný úder (${D.PLATFORMS[p].s}, ${pln.missiles} hlavic) na cíle: ${names}. Dopad za ${fmtEta(pln.ft)}.`,
      `${leaderName()} authorised a nuclear strike (${D.PLATFORMS[p].s}, ${pln.missiles} warheads) on: ${names}. Impact in ${fmtEta(pln.ft)}.`), 'crit');
    at(S.t + pln.ft + 40, () => applyStrike(g));
    S.nextWave = Math.min(S.nextWave, S.t + 90);
    log(L('Ruské radary úder zachytí. Očekávejte odpověď.', 'Russian radars will detect the strike. Expect a response.'), 'warn');
  }
  provoke(['americký jaderný úder', 'the American nuclear strike']);
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
  if (!quiet) log(L(`Hlášení: americké hlavice dopadly na cíle v Rusku. Odhad obětí ${fmtM(g.pl.cas)}.`, `Report: American warheads have hit targets in Russia. Estimated deaths ${fmtM(g.pl.cas)}.`), 'crit');
}
function recallBombers() {
  const open = S.strikes.filter(g => g.p === 'bomb' && !g.applied && !g.recalled);
  if (!open.length) return;
  for (const g of open) g.recalled = true;
  S.out = S.out.filter(o => !o.g.recalled);
  S.esc = Math.max(0, S.esc - 10); S.cred = clamp(S.cred - 5, 0, 100);
  log(L('Bombardéry odvolány a vracejí se. Moskva to registruje jako signál deeskalace. Eskalace −10.', 'Bombers recalled and turning back. Moscow reads it as a de-escalation signal. Escalation −10.'), 'ok');
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

  if (S.sc.petrov && !S.hostile && S.esc > 70) provoke(['rostoucí americkou pohotovost', 'rising American readiness']);

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
      if (tr.real) { tr.status = 'confirmed'; log(L(`${tr.id}: POTVRZENO. Skutečná hrozba, cíl ${sn(tr.target)}.`, `${tr.id}: CONFIRMED. Real threat, target ${sn(tr.target)}.`), 'crit'); }
      else { tr.status = 'false'; tr.tEnd = S.t; S.stats.falseSeen++; log(L(`${tr.id}: falešný kontakt. Vyřazen ze sledování.`, `${tr.id}: false contact. Dropped from tracking.`), 'ok'); }
      continue;
    }
    if (tr.status === 'unverified' && e < cT && tr.kind !== 'BMB') {
      tr.verifyEnd = null;
      if (tr.real) { tr.status = 'confirmed'; log(L(`${tr.id}: pozemní radar potvrdil hlavici. Cíl ${sn(tr.target)}, dopad za ${fmtEta(e)}.`, `${tr.id}: ground radar confirms a warhead. Target ${sn(tr.target)}, impact in ${fmtEta(e)}.`), 'crit'); }
      else { tr.status = 'false'; tr.tEnd = S.t; S.stats.falseSeen++; log(L(`${tr.id}: radary nic nezachytily. Šlo o falešný kontakt.`, `${tr.id}: radars see nothing. It was a false contact.`), 'ok'); }
      continue;
    }
    if (e <= 0) { if (tr.real) impact(tr); else { tr.status = 'false'; tr.tEnd = S.t; } }
    if (S.ended) return;
  }

  for (const it of S.ints) if (!it.done && S.t >= it.t1) { it.done = true; resolveInt(it); }
  S.ints = S.ints.filter(it => !it.done);

  if (S.potus === 'moving' && S.t >= S.potusEta) { S.potus = 'air'; log(L('Prezident je na palubě E-4B. Řetězec velení zajištěn.', 'The President is aboard the E-4B. The chain of command is secure.'), 'ok'); }
  if (S.vp === 'moving' && S.t >= S.vpEta) { S.vp = 'safe'; log(L('Viceprezident je v Raven Rock. Kontinuita vlády zajištěna.', 'The Vice President is at Raven Rock. Continuity of government secured.'), 'ok'); }
  if (S.tacamo === 'launching' && S.t >= S.tacamoEta) { S.tacamo = 'air'; log(L('E-6B TACAMO ve vzduchu. Spojení s ponorkami navázáno.', 'E-6B TACAMO airborne. Submarine link established.'), 'ok'); }
  for (const w of S.wings) if (w.state === 'launching' && S.t >= w.eta) {
    w.state = 'air'; S.cred = clamp(S.cred + 5, 0, 100); S.esc += S.hostile ? 3 : 5;
    log(L(`${w.name}: ${w.n} letounů ve vzduchu. Odstrašení +5.`, `${w.en}: ${w.n} aircraft airborne. Deterrence +5.`), 'ok');
  }
  for (const [k, p] of Object.entries(S.ssbn.port)) if (p.state === 'sailing' && S.t >= p.eta) {
    p.state = 'sea'; log(L(`${site(k).s}: ponorky dosáhly hlubokého moře. Jsou v bezpečí.`, `${site(k).s}: the submarines have reached deep water. They are safe.`), 'ok');
  }
  for (const sh of S.ships) if (sh.moveTo && S.t >= sh.eta) {
    sh.st = sh.moveTo; sh.moveTo = null; log(L(`${sh.name}: na stanovišti ${nm(D.STATIONS[sh.st])}.`, `${sh.name}: on station, ${nm(D.STATIONS[sh.st])}.`), 'ok');
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
    log(L('MOSKVA SOUHLASÍ S PŘÍMĚŘÍM. Nové starty nejsou očekávány. Rakety ve vzduchu ale odvolat nelze.', 'MOSCOW AGREES TO A CEASEFIRE. No new launches are expected, but missiles in flight cannot be recalled.'), 'ok');
    sfx('chime');
  }
  const pendingOut = S.strikes.some(g => g.p !== 'bomb' && !g.applied);
  if (S.ceasefire && !S.tracks.some(t => active(t) && t.real) && !pendingOut) return endGame('ceasefire');
  if (S.sc.petrov && !S.hostile && S.t >= PETROV_WIN_T) return endGame('petrov');
  if (S.t >= END_T) return endGame('timeout');
}

/* ---------- end ---------- */
// verdict texts are looked up when shown, so a language switch on the end screen works
const VERDICTS = {
  decap: [['Ztráta velení', 'Loss of Command'], ['Washington byl zasažen dřív, než se prezident i viceprezident dostali do bezpečí. Řetězec velení se rozpadl.', 'Washington was hit before the President and Vice President reached safety. The chain of command collapsed.']],
  petrov: [['Falešný poplach odhalen', 'False Alarm Exposed'], ['Útok nikdy neexistoval. Šlo o chybu satelitního systému a vy jste odolali tlaku na odvetu. Svět se o tom dozví až za mnoho let.', 'The attack never existed. It was a satellite system fault, and you resisted the pressure to retaliate. The world will only learn of it many years from now.']],
  total: [['Totální jaderná válka', 'All-Out Nuclear War'], ['Výměna úderů se vymkla kontrole. Obě země utrpěly ztráty, ze kterých se budou vzpamatovávat desítky let.', 'The exchange spun out of control. Both nations suffered losses that will take decades to recover from.']],
  managed: [['Krize zvládnuta', 'Crisis Contained'], ['Konflikt se podařilo zastavit s minimálními ztrátami. Diplomacie a obrana zabraly.', 'The conflict was stopped with minimal losses. Diplomacy and defence both worked.']],
  ceasefire: [['Příměří', 'Ceasefire'], ['Zbraně utichly, ale cena byla vysoká.', 'The weapons have fallen silent, but the price was high.']],
  pyrrhic: [['Pyrrhovo příměří', 'Pyrrhic Ceasefire'], ['Příměří platí, ale miliony lidí zemřely.', 'The ceasefire holds, but millions are dead.']],
  timeout: [['Konflikt pokračuje', 'The Conflict Goes On'], ['Uplynulo 90 minut a příměří se nepodařilo vyjednat. Vaše směna končí.', 'Ninety minutes have passed without a ceasefire. Your shift is over.']],
};
const LATE = ['Bombardéry, které jste neodvolali, dorazí k cílům po skončení směny.', 'The bombers you did not recall will reach their targets after your shift.'];
function endGame(reason) {
  if (S.ended) return;
  S.ended = true; S.running = false; S.modal = null;
  const late = S.strikes.filter(g => g.p === 'bomb' && !g.applied && !g.recalled);
  for (const g of late) applyStrike(g, true);
  S.history.push({ t: S.t, esc: S.esc, cred: S.cred, cas: S.cas, order: S.order });
  const total = S.cas + S.enemyCas;
  let v;
  if (reason === 'decap') v = 'decap';
  else if (reason === 'petrov') v = 'petrov';
  else if (total >= 60) v = 'total';
  else if (reason === 'ceasefire') v = total < 3 ? 'managed' : total < 20 ? 'ceasefire' : 'pyrrhic';
  else v = 'timeout';
  const good = ['petrov', 'managed', 'ceasefire'].includes(v);
  const bonus = { ceasefire: 250, petrov: 400, decap: -400 }[reason] || 0;
  const score = Math.max(0, Math.round((1000 - S.cas * 25 - S.enemyCas * 8 + S.stats.kills * 15 - S.stats.wasted * 5 + bonus) * S.df.score));
  G.ui.showEnd({ reason, v, late: late.length > 0, good, score, total });
}

G.sim = {
  END_T, VERIFY_CAP, SHOOTERS, VERDICTS, LATE,
  newGame, update, select, cycle, verify, verifying, verifyTime, confirmT, radarsAlive,
  active, eta, posOf, selTrack, shipPos, shooterCheck, pk, engage, zoneName,
  evacPotus, evacVp, setDefcon, wingLaunch, sail, tacamo, shipMove, seaPorts,
  recon, sigint, cyber, expectedWave,
  hotline, nato, allies, china,
  alertCity, alertAll, speech, guard, fema,
  capacity, plan, strikeBlock, strike, recallBombers,
  choose, provoke, spawnTrack, endGame, log,
};
})();
