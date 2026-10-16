'use strict';
// DOM: builds the panels once per game, then updates text and button states ~5× per second.
(() => {
const { clamp, fmtT, fmtEta, fmtM, plural } = G;
const D = G.DATA;
const $ = s => document.querySelector(s);
const X = () => G.sim;
const S = () => G.S;

const STATUS = { unverified: 'NEOVĚŘENO', verifying: 'OVĚŘUJE SE', confirmed: 'POTVRZENO', false: 'FALEŠNÝ', destroyed: 'ZNIČENO', impact: 'DOPAD' };
const KIND = { ICBM: 'ICBM · mezikontinentální', SLBM: 'SLBM · z ponorky', BMB: 'Strategický bombardér' };
const pct = p => Math.round(p * 100) + ' %';

function el(tag, cls, html) { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
function btn(label, onClick, cls = 'btn sm') { const b = el('button', cls); b.type = 'button'; b.textContent = label; b.onclick = () => { onClick(); refresh(); }; return b; }
function setBtn(b, why) { b.disabled = !!why; b.title = why || ''; }
// asset row: name, status line, action area
function asset(name) {
  const r = el('div', 'asset'); const nm = el('span', 'nm'); nm.textContent = name;
  const st = el('span', 'st'); const act = el('div', 'act'); r.append(nm, act, st);
  return { r, nm, st, act };
}
function setSt(row, text, cls = '') { row.st.textContent = text; row.st.className = 'st ' + cls; }

/* ---------- log ---------- */
const logEl = $('#log');
function log(msg, lvl = 'info') {
  const li = el('li', lvl);
  const tm = el('time'); tm.textContent = fmtT(S() ? S().t : 0);
  const sp = el('span'); sp.textContent = msg;
  li.append(tm, sp); logEl.prepend(li);
  while (logEl.children.length > 150) logEl.lastChild.remove();
}

/* ---------- tabs ---------- */
document.querySelectorAll('.tab').forEach(t => t.onclick = () => showTab(t.dataset.tab));
function showTab(name) {
  document.querySelectorAll('.tab').forEach(t => { t.classList.toggle('on', t.dataset.tab === name); t.setAttribute('aria-selected', t.dataset.tab === name); });
  document.querySelectorAll('.pane').forEach(p => p.hidden = p.dataset.pane !== name);
}

/* ---------- static build per game ---------- */
const R = {}; // row references
const rows = new Map();

function build() {
  logEl.innerHTML = '';
  $('#trkList').querySelectorAll('.trk').forEach(r => r.remove()); rows.clear();
  showTab('kontakt');

  // cities
  const cl = $('#cityList'); cl.innerHTML = ''; R.cities = [];
  for (const [k, s] of Object.entries(D.SITES)) {
    if (s.type !== 'city') continue;
    const r = el('div', 'city');
    const nm = el('span', 'nm'); nm.textContent = s.n;
    const sub = el('span', 'sub'); const act = el('div', 'act');
    const bA = btn('Varovat', () => X().alertCity(k)), bF = btn('FEMA', () => X().fema(k));
    bF.title = 'Vyslat záchranné týmy proti radioaktivnímu spadu';
    act.append(bA, bF); r.append(nm, act, sub); cl.append(r);
    R.cities.push({ k, s, r, sub, bA, bF });
  }

  // shooters
  const sh = $('#shooters'); sh.innerHTML = ''; R.shooters = [];
  for (const def of X().SHOOTERS) {
    const a = asset(def.name);
    const b1 = btn('×1', () => X().engage(def.key, 1));
    a.act.append(b1);
    let b2 = null;
    if (def.type !== 'air') { b2 = btn('×2', () => X().engage(def.key, 2)); a.act.append(b2); }
    sh.append(a.r); R.shooters.push({ def, a, b1, b2 });
  }

  // defence summary
  const dl = $('#defList'); dl.innerHTML = ''; R.def = {};
  for (const k of ['GREELY', 'VAFB', 'ELM', 'LANGLEY']) { const a = asset(D.SITES[k].n); dl.append(a.r); R.def[k] = a; }

  // ships
  const sl = $('#shipList'); sl.innerHTML = ''; R.ships = [];
  for (const s of S().ships) {
    const a = asset(`${s.name} (${s.id})`);
    a.r.classList.add('wide');
    const sel = el('select'); sel.id = 'st-' + s.id; sel.setAttribute('aria-label', 'Stanoviště pro ' + s.name);
    for (const [k, st] of Object.entries(D.STATIONS)) { const o = el('option'); o.value = k; o.textContent = st.n; sel.append(o); }
    sel.value = s.st;
    const b = btn('Přesunout', () => X().shipMove(s.id, sel.value));
    a.act.append(sel, b); sl.append(a.r); R.ships.push({ s, a, sel, b });
  }

  // triad
  const tl = $('#triad'); tl.innerHTML = ''; R.silos = []; R.wings = []; R.ports = [];
  for (const k of D.SILOS) { const a = asset('Minuteman III · ' + D.SITES[k].n); tl.append(a.r); R.silos.push({ k, a }); }
  for (const w of S().wings) { const a = asset(w.name); const b = btn('Vzlétnout', () => X().wingLaunch(w.id)); a.act.append(b); tl.append(a.r); R.wings.push({ w, a, b }); }
  R.patrol = asset('Ponorky SSBN na hlídce'); tl.append(R.patrol.r);
  for (const k of Object.keys(S().ssbn.port)) { const a = asset('Ponorky v přístavu ' + D.SITES[k].s); const b = btn('Vyplout', () => X().sail(k)); a.act.append(b); tl.append(a.r); R.ports.push({ k, a, b }); }
  R.tacamo = asset('E-6B Mercury (TACAMO)'); R.tacamoB = btn('Vzlétnout', () => X().tacamo()); R.tacamo.act.append(R.tacamoB); tl.append(R.tacamo.r);

  // intel
  const il = $('#intelOps'); il.innerHTML = '';
  R.recon = asset('Satelitní průzkum KH-11'); R.reconB = btn('Spustit', () => X().recon()); R.recon.act.append(R.reconB);
  R.sigint = asset('Odposlech NSA (SIGINT)'); R.sigintB = btn('Spustit', () => X().sigint()); R.sigint.act.append(R.sigintB);
  R.cyber = asset('Kybernetická operace'); R.cyberB = btn('Spustit', () => X().cyber()); R.cyber.act.append(R.cyberB);
  il.append(R.recon.r, R.sigint.r, R.cyber.r);
  il.append(el('p', 'note', 'Průzkum předpoví další vlnu. Odposlech zkrátí ověřování na 45 s. Kybernetická operace může vlnu zdržet, ale při odhalení zvedne eskalaci.'));
  const rl = $('#radarList'); rl.innerHTML = ''; R.radars = [];
  for (const k of D.RADARS) { const a = asset(D.SITES[k].n); rl.append(a.r); R.radars.push({ k, a }); }
  R.radarNote = el('p', 'note'); rl.append(R.radarNote);

  // diplomacy
  const hl = $('#hotList'); hl.innerHTML = ''; R.hot = [];
  const HOT = [
    ['truce', 'Navrhnout okamžité příměří', 'Při úspěchu eskalace −14 až −22 a krok k příměří. Šance klesá s eskalací.'],
    ['assure', 'Slíbit zdrženlivost', 'Vyšší šance, eskalace −8 až −12, ale odstrašení −6. Nepočítá se jako dohoda.'],
    ['warn', 'Pohrozit masivní odvetou', 'Při odstrašení ≥ 60 eskalace klesne, jinak vzroste.'],
    ['ask', 'Zeptat se na vybraný kontakt', 'Moskva řekne, zda jde o její raketu. V 25 % případů lže.'],
  ];
  for (const [k, t, d] of HOT) {
    const b = el('button', 'btn choice'); b.type = 'button'; b.innerHTML = `<span></span><small></small>`;
    b.firstChild.textContent = t; b.lastChild.textContent = d;
    b.onclick = () => { X().hotline(k); refresh(); };
    hl.append(b); R.hot.push({ k, b });
  }
  const dp = $('#dipList'); dp.innerHTML = '';
  R.nato = asset('Konzultace NATO'); R.natoB = btn('Svolat', () => X().nato()); R.nato.act.append(R.natoB);
  R.allies = asset('Pohotovost britských a francouzských ponorek'); R.alliesB = btn('Požádat', () => X().allies()); R.allies.act.append(R.alliesB);
  R.china = asset('Zprostředkování Číny'); R.chinaB = btn('Požádat', () => X().china()); R.china.act.append(R.chinaB);
  dp.append(R.nato.r, R.allies.r, R.china.r);

  // civil
  const cg = $('#cogList'); cg.innerHTML = '';
  R.potus = asset('Prezident'); R.potusB = btn('Evakuovat do E-4B', () => X().evacPotus()); R.potus.act.append(R.potusB);
  R.vp = asset('Viceprezident'); R.vpB = btn('Do Raven Rock', () => X().evacVp()); R.vp.act.append(R.vpB);
  cg.append(R.potus.r, R.vp.r, el('p', 'note', 'Pokud Washington zasáhne hlavice, přežije jen ten, kdo je v bezpečí. Bez prezidenta i viceprezidenta hra končí ztrátou velení.'));
  const cv = $('#civList'); cv.innerHTML = '';
  R.order = asset('Veřejný pořádek');
  R.all = asset('Celostátní poplach EAS'); R.allB = btn('Vyhlásit', () => X().alertAll(), 'btn sm danger'); R.all.act.append(R.allB);
  R.speech = asset('Projev k národu'); R.speechB = btn('Vysílat', () => X().speech()); R.speech.act.append(R.speechB);
  R.guard = asset('Národní garda'); R.guardB = btn('Nasadit', () => X().guard()); R.guard.act.append(R.guardB);
  R.fema = asset('Záchranné týmy FEMA');
  cv.append(R.order.r, R.all.r, R.speech.r, R.guard.r, R.fema.r,
    el('p', 'note', 'Varování EAS snižuje ztráty tím víc, čím dřív přijde, až o 45 %. Nízký veřejný pořádek jeho účinek oslabuje. FEMA pošlete z řádku zasaženého města vlevo.'));

  // retaliation
  const sets = $('#setList'); sets.innerHTML = ''; R.sets = [];
  for (const [k, s] of Object.entries(D.RU_SETS)) {
    const l = el('label', 'opt'); const i = el('input'); i.type = 'checkbox'; i.id = 'set-' + k; i.value = k;
    const b = el('b'); b.textContent = s.n; const sm = el('small'); sm.textContent = `${s.d} ${s.missiles} hlavic.`;
    i.onchange = refresh; l.append(i, b, sm); sets.append(l); R.sets.push({ k, i });
  }
  const pl = $('#platList'); pl.innerHTML = ''; R.plats = [];
  for (const [k, p] of Object.entries(D.PLATFORMS)) {
    const l = el('label', 'opt'); const i = el('input'); i.type = 'radio'; i.name = 'plat'; i.id = 'plat-' + k; i.value = k; if (k === 'icbm') i.checked = true;
    const b = el('b'); b.textContent = p.n; const sm = el('small');
    i.onchange = refresh; l.append(i, b, sm); pl.append(l); R.plats.push({ k, i, l, sm });
  }
  $('#sasCode').hidden = true; $('#bSas').hidden = false; $('#retCode').value = '';
}

/* ---------- per-frame refresh ---------- */
let last = 0;
function refresh(force = true) {
  const s = S(); if (!s) return;
  const now = performance.now();
  if (!force && now - last < 180) return; last = now;
  const x = X();

  // header
  document.querySelectorAll('#defcon span').forEach(e => e.classList.toggle('on', +e.dataset.l === s.defcon));
  $('#clock').textContent = fmtT(s.t); $('#zulu').textContent = G.zulu(s.t);
  $('#escVal').textContent = Math.round(s.esc); $('#escBar').style.width = s.esc + '%';
  $('#credVal').textContent = Math.round(s.cred); $('#credBar').style.width = s.cred + '%';
  $('#orderVal').textContent = Math.round(s.order); $('#orderBar').style.width = s.order + '%';
  $('#casVal').textContent = fmtM(s.cas);
  $('#leaderVal').textContent = s.leader === 'potus' ? (s.potus === 'air' ? 'Prezident · E-4B' : 'Prezident') : s.leader === 'vp' ? 'Viceprezident' : 'Ztraceno';
  $('#leaderVal').className = 'v sm' + (s.leader === 'vp' ? ' red' : '');
  $('#bPause').textContent = s.paused ? 'Pokračovat' : 'Pauza';
  $('#bPause').classList.toggle('on', s.paused);
  document.querySelectorAll('.spd').forEach(b => b.classList.toggle('on', +b.dataset.s === s.speed));

  // forecast
  const fc = s.intel.forecast, fEl = $('#forecast');
  if (fc && s.t < fc.at + 20) {
    fEl.hidden = false;
    fEl.textContent = fc.quiet ? 'KH-11: žádné přípravy ke startu' : `KH-11: další vlna za ${fmtEta(fc.at - s.t)} · odhad ${fc.n} ${plural(fc.n, 'raketa', 'rakety', 'raket')}`;
  } else fEl.hidden = true;

  tracks(s, x); cities(s, x); contact(s, x); forces(s, x); intel(s, x); diplomacy(s, x); civil(s, x); retaliation(s, x);

  // tab attention dots
  const threatened = k => s.tracks.some(t => x.active(t) && t.status === 'confirmed' && t.target === k);
  const civAlert = (threatened('DC') && (s.potus === 'dc' || s.vp === 'dc')) || R.cities.some(c => threatened(c.k) && c.s.alertT == null);
  const silyAlert = s.wings.some(w => w.state === 'ground' && threatened(w.base)) || Object.entries(s.ssbn.port).some(([k, p]) => p.state === 'port' && threatened(k)) || (s.tacamo === 'ground' && threatened('TINKER'));
  document.querySelector('.tab[data-tab="civil"]').classList.toggle('alert', civAlert);
  document.querySelector('.tab[data-tab="sily"]').classList.toggle('alert', silyAlert);
}

function tracks(s, x) {
  const vis = s.tracks.filter(t => x.active(t) || s.t - t.tEnd < 240)
    .sort((a, b) => (x.active(b) - x.active(a)) || (x.active(a) ? x.eta(a) - x.eta(b) : b.tEnd - a.tEnd));
  const ids = new Set(vis.map(t => t.id));
  for (const [id, r] of rows) if (!ids.has(id)) { r.remove(); rows.delete(id); }
  let prev = $('#trkEmpty');
  prev.hidden = vis.length > 0;
  for (const tr of vis) {
    let r = rows.get(tr.id);
    if (!r) {
      r = el('button', 'trk'); r.type = 'button';
      r.innerHTML = '<span class="id"></span><span class="kd"></span><span class="eta"></span><span class="tg"></span><span class="chip"></span>';
      r.onclick = () => x.select(tr.id);
      rows.set(tr.id, r);
    }
    if (prev.nextSibling !== r) prev.after(r);
    prev = r;
    const st = tr.verifyEnd ? 'verifying' : tr.status;
    r.className = `trk st-${st}${tr.id === s.selected ? ' sel' : ''}`;
    r.children[0].textContent = tr.id;
    r.children[1].textContent = tr.kind === 'BMB' ? 'BOMB.' : tr.kind;
    r.children[2].textContent = x.active(tr) ? fmtEta(x.eta(tr)) : '—';
    r.children[3].textContent = '→ ' + D.SITES[tr.target].n + (tr.status === 'unverified' ? '?' : '') + ' · z ' + tr.zone;
    r.children[4].textContent = STATUS[st];
  }
  const n = s.tracks.filter(x.active).length;
  $('#trkCount').textContent = `${n} ${plural(n, 'aktivní', 'aktivní', 'aktivních')}`;
  $('#verifyCap').textContent = `Ověřovací kanály ${x.verifying()}/${x.VERIFY_CAP}${s.t < s.intel.sigintUntil ? ' · SIGINT' : ''}`;
  $('#confirmInfo').textContent = s.t < s.radarOutUntil ? 'Radary vyřazeny EMP' : `Radar potvrdí ${fmtEta(x.confirmT())} před dopadem`;
}

function cities(s, x) {
  for (const c of R.cities) {
    const threat = s.tracks.some(t => x.active(t) && t.status === 'confirmed' && t.target === c.k);
    c.r.className = 'city' + (c.s.hits ? ' hit' : '') + (c.s.alertT != null ? ' warned' : '') + (threat && c.s.alertT == null ? ' threat' : '');
    let txt;
    if (c.s.hits) txt = `Zasaženo ${c.s.hits}× · oběti ${fmtM(c.s.pop - c.s.remain)}${c.s.fallout > .01 ? ' · spad' : ''}`;
    else if (c.s.alertT != null) txt = `Varováno ${fmtT(c.s.alertT)}`;
    else txt = `${String(c.s.pop).replace('.', ',')} mil. obyvatel`;
    if (threat) txt += ' · OHROŽENO';
    c.sub.textContent = txt;
    setBtn(c.bA, c.s.alertT != null ? 'Varováno.' : null);
    c.bA.textContent = c.s.alertT != null ? 'Varováno' : 'Varovat';
    c.bA.classList.toggle('danger', threat && c.s.alertT == null);
    c.bF.hidden = !c.s.hits;
    setBtn(c.bF, c.s.fema ? 'Týmy už pracují.' : s.civ.fema < 1 ? 'Žádné volné týmy.' : null);
  }
  $('#femaCount').textContent = `FEMA ${s.civ.fema}`;
}

function contact(s, x) {
  const tr = x.selTrack();
  $('#dId').textContent = tr ? tr.id : '—';
  const chip = $('#dChip'); chip.hidden = !tr;
  if (tr) {
    const st = tr.verifyEnd ? 'verifying' : tr.status; chip.textContent = STATUS[st];
    chip.style.color = st === 'confirmed' || st === 'impact' ? 'var(--red)' : st === 'destroyed' ? 'var(--ok)' : st === 'false' ? 'var(--dim)' : 'var(--amber)';
  }
  $('#dKind').textContent = tr ? KIND[tr.kind] : '—';
  $('#dFrom').textContent = tr ? tr.zone : '—';
  $('#dTgt').textContent = tr ? D.SITES[tr.target].n + (tr.status === 'unverified' ? ' (odhad)' : '') : '—';
  $('#dEta').textContent = tr && x.active(tr) ? fmtEta(x.eta(tr)) : '—';
  const h = tr && s.hints[tr.id] && tr.status === 'unverified';
  $('#dHint').hidden = !h; if (h) $('#dHint').textContent = s.hints[tr.id];
  const vWhy = !tr ? 'Není vybrán kontakt.' : tr.status !== 'unverified' ? 'Kontakt už je vyhodnocen.' : tr.verifyEnd ? 'Ověřování probíhá.' : x.verifying() >= x.VERIFY_CAP ? 'Všechny kanály jsou obsazené.' : null;
  setBtn($('#bVerify'), vWhy);
  $('#bVerify').textContent = `Ověřit (${x.verifyTime()} s)`;
  let note = 'Vyberte kontakt v seznamu nebo na mapě.';
  if (tr) {
    if (tr.verifyEnd) note = `Korelace dat dokončena za ${fmtEta(tr.verifyEnd - s.t)}.`;
    else if (tr.status === 'unverified') note = tr.kind === 'BMB' ? 'Bombardér sledovaný radary. Ověřením zjistíte, jestli jde o skutečný útok.' : 'Mohlo by jít o falešný poplach. Střelba na neověřený cíl může interceptor promarnit.';
    else if (tr.status === 'confirmed') note = tr.kind === 'BMB' ? 'Potvrzený bombardér. Vyšlete stíhače.' : 'Potvrzená hlavice. Zasáhněte, nebo aspoň varujte cíl přes EAS.';
    else if (tr.status === 'false') note = 'Falešný kontakt. Žádná akce není potřeba.';
    else if (tr.status === 'destroyed') note = 'Hrozba zničena.';
    else if (tr.status === 'impact') note = 'Hlavice dopadla.';
    const pend = s.ints.filter(i => i.tr === tr);
    if (pend.length) note += ` Ve vzduchu: ${pend.map(i => i.type === 'air' ? 'letka F-22' : `${i.n}× ${i.type === 'gmd' ? 'GBI' : 'SM-3'}`).join(', ')}, střet za ${fmtEta(Math.min(...pend.map(i => i.t1)) - s.t)}.`;
  }
  $('#dNote').textContent = note;

  for (const r of R.shooters) {
    const why1 = x.shooterCheck(r.def.key, tr, 1);
    setBtn(r.b1, why1);
    if (r.b2) setBtn(r.b2, x.shooterCheck(r.def.key, tr, 2));
    let ammo;
    if (r.def.type === 'gmd') { const st = D.SITES[r.def.key]; ammo = st.dead ? 'vyřazeno' : `${st.stock} GBI`; }
    else if (r.def.type === 'ship') { const sh = s.ships.find(q => 'ship:' + q.id === r.def.key); ammo = `${sh.ammo} SM-3 · ${D.STATIONS[sh.moveTo || sh.st].n}${sh.moveTo ? ' (přesun)' : ''}`; }
    else { const st = D.SITES[r.def.key]; ammo = st.dead ? 'vyřazeno' : `${st.fighters} ${plural(st.fighters, 'letka', 'letky', 'letek')}`; }
    if (!why1) setSt(r.a, `${ammo} · zásah ${pct(x.pk(r.def.key, 1))}${r.b2 ? ` / ×2 ${pct(x.pk(r.def.key, 2))}` : ''}`, 'ok');
    else setSt(r.a, `${ammo} · ${why1}`, tr && x.active(tr) ? 'warn' : '');
  }
}

function forces(s, x) {
  $('#defStat').textContent = 'DEFCON ' + s.defcon;
  setBtn($('#bDefUp'), s.defcon === 1 ? 'Nejvyšší stupeň.' : s.t < s.defNext ? 'Rozkaz se předává.' : null);
  setBtn($('#bDefDown'), s.defcon === 5 ? 'Nejnižší stupeň.' : s.t < s.defNext ? 'Rozkaz se předává.' : null);
  for (const k of ['GREELY', 'VAFB']) { const st = D.SITES[k]; setSt(R.def[k], st.dead ? 'VYŘAZENO' : `${st.stock} / ${st.stock0} interceptorů GBI`, st.dead ? 'bad' : ''); }
  for (const k of ['ELM', 'LANGLEY']) { const st = D.SITES[k]; setSt(R.def[k], st.dead ? 'VYŘAZENO' : `${st.fighters} / ${st.fighters0} letek F-22 připraveno`, st.dead ? 'bad' : ''); }
  for (const r of R.ships) {
    const sh = r.s;
    setSt(r.a, sh.moveTo ? `Přesun: ${D.STATIONS[sh.moveTo].n} za ${fmtEta(sh.eta - s.t)} · ${sh.ammo} SM-3` : `${D.STATIONS[sh.st].n} · ${sh.ammo} SM-3`, sh.moveTo ? 'warn' : '');
    if (document.activeElement !== r.sel && !sh.moveTo && r.sel.dataset.user !== '1') r.sel.value = sh.st;
    r.sel.onchange = () => { r.sel.dataset.user = '1'; };
    setBtn(r.b, sh.moveTo ? 'Loď je na přesunu.' : r.sel.value === sh.st ? 'Loď už na stanovišti je.' : null);
    if (sh.moveTo) r.sel.dataset.user = '';
  }
  for (const r of R.silos) { const st = D.SITES[r.k]; setSt(r.a, st.dead ? 'Zničeno' : `${st.missiles} raket v silech`, st.dead ? 'bad' : ''); }
  for (const r of R.wings) {
    const w = r.w, base = D.SITES[w.base].s;
    const map = { ground: [`${w.n} letounů na zemi · ${base}`, 'warn'], launching: [`Vzlet za ${fmtEta(w.eta - s.t)}`, 'warn'], air: [`${w.n} letounů ve vzduchu`, 'ok'], lost: ['Zničeno na zemi', 'bad'] };
    setSt(r.a, ...map[w.state]);
    setBtn(r.b, w.state !== 'ground' ? 'Už ve vzduchu nebo ztraceno.' : null);
  }
  setSt(R.patrol, `${s.ssbn.patrol} ponorky na moři · ${Math.max(0, x.capacity('slbm'))} hlavic k dispozici`, 'ok');
  for (const r of R.ports) {
    const p = s.ssbn.port[r.k];
    const map = { port: [`${p.n} ponorky kotví v přístavu`, 'warn'], sailing: [`Vyplouvají, v bezpečí za ${fmtEta(p.eta - s.t)}`, 'warn'], sea: [`${p.n} ponorky na moři`, 'ok'], lost: ['Zničeny v přístavu', 'bad'] };
    setSt(r.a, ...map[p.state]);
    setBtn(r.b, p.state !== 'port' ? 'Už vypluly nebo jsou ztraceny.' : null);
  }
  const tm = { ground: ['Na zemi, Tinker AFB. Bez něj nelze vydat rozkaz ponorkám.', 'warn'], launching: [`Vzlet za ${fmtEta(s.tacamoEta - s.t)}`, 'warn'], air: ['Ve vzduchu, spojení s ponorkami aktivní', 'ok'], lost: ['Zničeno na zemi', 'bad'] };
  setSt(R.tacamo, ...tm[s.tacamo]);
  setBtn(R.tacamoB, s.tacamo !== 'ground' ? 'Už ve vzduchu nebo ztraceno.' : null);
}

function intel(s, x) {
  const i = s.intel;
  setSt(R.recon, i.reconBusy ? `Snímkování, výsledek za ${fmtEta(i.reconBusy - s.t)}` : s.t < i.reconNext ? `Satelit znovu k dispozici za ${fmtEta(i.reconNext - s.t)}` : 'Připraveno · výsledek za 3 min', i.reconBusy ? 'warn' : '');
  setBtn(R.reconB, s.t < i.reconNext ? 'Satelit je zaneprázdněn.' : null);
  setSt(R.sigint, s.t < i.sigintUntil ? `Aktivní ještě ${fmtEta(i.sigintUntil - s.t)}` : s.t < i.sigintNext ? `Znovu za ${fmtEta(i.sigintNext - s.t)}` : 'Připraveno · 10 min', s.t < i.sigintUntil ? 'ok' : '');
  setBtn(R.sigintB, s.t < i.sigintNext ? 'Nedostupné.' : null);
  setSt(R.cyber, s.t < i.cyberNext ? `Znovu za ${fmtEta(i.cyberNext - s.t)}` : 'Připraveno · úspěch ~55 %, odhalení ~20 %');
  setBtn(R.cyberB, s.t < i.cyberNext ? 'Nedostupné.' : null);
  for (const r of R.radars) { const st = D.SITES[r.k]; setSt(r.a, st.dead ? 'Vyřazen' : s.t < s.radarOutUntil ? 'Výpadek (EMP)' : 'V provozu', st.dead || s.t < s.radarOutUntil ? 'bad' : 'ok'); }
  R.radarNote.textContent = `Funkčních radarů ${x.radarsAlive()} z ${D.RADARS.length}. Hlavice se potvrdí ${fmtEta(x.confirmT())} před dopadem, čím méně radarů, tím později.`;
}

function diplomacy(s, x) {
  const h = s.hot;
  $('#hotStat').textContent = s.ceasefire ? 'Příměří platí' : s.t < 480 ? `Navazuje se (${fmtEta(480 - s.t)})` : s.t < h.next ? `Znovu za ${fmtEta(h.next - s.t)}` : `Připravena · dohody ${h.ok}/2`;
  const why = s.ceasefire ? 'Příměří už platí.' : s.t < h.next ? 'Linka není dostupná.' : null;
  for (const r of R.hot) setBtn(r.b, why || (r.k === 'ask' && (!x.selTrack() || x.selTrack().status !== 'unverified') ? 'Vyberte neověřený kontakt.' : null));
  setSt(R.nato, s.t < s.dip.natoNext ? `Znovu za ${fmtEta(s.dip.natoNext - s.t)}` : 'Odstrašení +8, eskalace +2');
  setBtn(R.natoB, s.t < s.dip.natoNext ? 'Rada už zasedala.' : null);
  setSt(R.allies, s.dip.alliesUsed ? 'Spojenci v pohotovosti' : 'Odstrašení +12, eskalace +6. Jen jednou.', s.dip.alliesUsed ? 'ok' : '');
  setBtn(R.alliesB, s.dip.alliesUsed ? 'Už využito.' : null);
  setSt(R.china, s.dip.chinaUsed ? 'Využito' : s.t < 1200 ? `Peking bude k dispozici za ${fmtEta(1200 - s.t)}` : 'Eskalace −12 při úspěchu. Jen jednou.');
  setBtn(R.chinaB, s.dip.chinaUsed ? 'Už využito.' : s.t < 1200 ? 'Zatím nedostupné.' : null);
  const req = [[h.ok >= 2, `Dvě dohody přes horkou linku (${h.ok}/2)`], [s.esc < 20, `Eskalace pod 20 (nyní ${Math.round(s.esc)})`], [s.cred >= 40, `Odstrašení aspoň 40 (nyní ${Math.round(s.cred)})`]];
  if (!s.hostile && s.sc.petrov) req.push([s.t >= 2700, 'Vydržet bez provokace do T+45:00']);
  $('#truceReq').innerHTML = req.map(([ok, t]) => `<span class="${ok ? 'y' : 'n'}">${ok ? '✓' : '○'} ${t}</span>`).join('') + (s.ceasefire ? '<span class="y">✓ Příměří vyhlášeno</span>' : '');
}

function civil(s, x) {
  const pm = { dc: ['Bílý dům, Washington', 'warn'], moving: [`Marine One, do E-4B za ${fmtEta(s.potusEta - s.t)}`, 'warn'], air: ['Na palubě E-4B, v bezpečí', 'ok'], dead: ['Nezvěstný', 'bad'] };
  setSt(R.potus, ...pm[s.potus]); setBtn(R.potusB, s.potus !== 'dc' ? 'Evakuace už proběhla.' : null);
  const vm = { dc: ['Washington', 'warn'], moving: [`Přesun do Raven Rock za ${fmtEta(s.vpEta - s.t)}`, 'warn'], safe: ['Raven Rock, v bezpečí', 'ok'], dead: ['Nezvěstný', 'bad'] };
  setSt(R.vp, ...vm[s.vp]); setBtn(R.vpB, s.vp !== 'dc' ? 'Evakuace už proběhla.' : null);
  setSt(R.order, `${Math.round(s.order)} / 100 · účinnost varování ${Math.round((.5 + s.order / 200) * 100)} %`, s.order < 40 ? 'bad' : s.order < 65 ? 'warn' : 'ok');
  setSt(R.all, s.civ.nationwide ? 'Vyhlášen' : 'Varuje všechna města najednou. Pořádek −12.', s.civ.nationwide ? 'ok' : '');
  setBtn(R.allB, s.civ.nationwide ? 'Už vyhlášen.' : null);
  setSt(R.speech, s.t < s.civ.speechNext ? `Znovu za ${fmtEta(s.civ.speechNext - s.t)}` : 'Pořádek +15');
  setBtn(R.speechB, !s.leader ? 'Není kdo by promluvil.' : s.t < s.civ.speechNext ? 'Nedávno vysíláno.' : null);
  setSt(R.guard, s.t < s.civ.guardNext ? `Znovu za ${fmtEta(s.civ.guardNext - s.t)}` : 'Pořádek +12');
  setBtn(R.guardB, s.t < s.civ.guardNext ? 'Jednotky jsou nasazené.' : null);
  setSt(R.fema, `${s.civ.fema} volné týmy · polovina ztrát spadem`);
}

function chosenSets() { return R.sets.filter(r => r.i.checked).map(r => r.k); }
function chosenPlat() { const r = R.plats.find(r => r.i.checked); return r ? r.k : 'icbm'; }
function retaliation(s, x) {
  const code = $('#retCode').value;
  const req = [[s.defcon === 1, 'DEFCON 1'], [!!s.leader, s.leader === 'vp' ? 'Velí viceprezident' : 'Prezident dostupný'], [code.trim().toUpperCase() === s.code, 'Platný autentizační kód']];
  $('#retReq').innerHTML = req.map(([ok, t]) => `<span class="${ok ? 'y' : 'n'}">${ok ? '✓' : '○'} ${t}</span>`).join('');
  for (const r of R.plats) {
    const cap = x.capacity(r.k);
    r.sm.textContent = `${D.PLATFORMS[r.k].d} K dispozici ${cap} hlavic.`;
    r.l.classList.toggle('off', cap === 0);
  }
  const sets = chosenSets(), p = chosenPlat(), pl = x.plan(sets, p);
  $('#preview').innerHTML = sets.length
    ? `<span>Hlavic</span><span>${pl.missiles} / ${x.capacity(p)}</span><span>Dopad za</span><span>${p === 'bomb' ? '~3 h' : fmtEta(pl.ft)}</span><span>Odhad obětí v Rusku</span><span>${fmtM(pl.cas)}</span><span>Eskalace</span><span>+${pl.esc}</span><span>Odstrašení</span><span>+${pl.cred}</span>`
    : '<span>Vyberte cíle</span><span>—</span>';
  const why = x.strikeBlock(sets, p, code);
  setBtn($('#bStrike'), why);
  $('#strikeNote').textContent = why || 'Rozkaz je připraven. Po autorizaci ho nelze vzít zpět, kromě bombardérů.';
  const open = s.strikes.filter(g => g.p === 'bomb' && !g.applied && !g.recalled);
  $('#bombStat').textContent = open.length ? `${open.length} na cestě` : 'Žádné';
  setBtn($('#bRecall'), open.length ? null : 'Žádné bombardéry nejsou na cestě.');
}

$('#bVerify').onclick = () => { X().verify(); refresh(); };
$('#bPrev').onclick = () => X().cycle(-1);
$('#bNext').onclick = () => X().cycle(1);
$('#bDefUp').onclick = () => { X().setDefcon(-1); refresh(); };
$('#bDefDown').onclick = () => { X().setDefcon(1); refresh(); };
$('#bSas').onclick = () => { $('#sasCode').textContent = S().code; $('#sasCode').hidden = false; $('#bSas').hidden = true; log('Obálka SAS rozlomena. Kód ověřují dva důstojníci.', 'warn'); };
$('#retCode').addEventListener('input', () => refresh());
$('#bStrike').onclick = () => {
  if (X().strike(chosenSets(), chosenPlat(), $('#retCode').value)) { $('#retCode').value = ''; R.sets.forEach(r => r.i.checked = false); }
  refresh();
};
$('#bRecall').onclick = () => { X().recallBombers(); refresh(); };

/* ---------- decision card ---------- */
function showCard(e) {
  $('#cardTag').textContent = e.tag + ' · ' + fmtT(S().t);
  $('#cardTitle').textContent = e.title;
  $('#cardText').textContent = typeof e.text === 'function' ? e.text(S()) : e.text;
  const cl = $('#cardChoices'); cl.innerHTML = '';
  e.choices.forEach((c, i) => {
    const b = el('button', 'btn choice'); b.type = 'button'; b.innerHTML = '<span></span><small></small>';
    b.firstChild.textContent = c.label; b.lastChild.textContent = c.hint;
    b.onclick = () => X().choose(i);
    cl.append(b);
  });
  $('#cardOvl').hidden = false;
  cl.firstChild.focus();
}
function hideCard() { $('#cardOvl').hidden = true; }

/* ---------- scores ---------- */
const KEY = 'velin-cheyenne-scores';
function loadScores() { try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch (_) { return []; } }
function saveScore(entry) {
  const list = loadScores(); list.push(entry); list.sort((a, b) => b.score - a.score);
  try { localStorage.setItem(KEY, JSON.stringify(list.slice(0, 8))); } catch (_) {}
  return list.slice(0, 8);
}
function scoreTable(list, mine) {
  if (!list.length) return '';
  return `<h3>Nejlepší směny</h3><table class="scores"><thead><tr><th>Skóre</th><th>Výsledek</th><th>Scénář</th><th>Obtížnost</th></tr></thead><tbody>${
    list.map(e => `<tr class="${e.id === mine ? 'me' : ''}"><td>${e.score}</td><td>${e.verdict}</td><td>${D.SCEN[e.scen] ? D.SCEN[e.scen].n : ''}</td><td>${D.DIFF[e.diff] ? D.DIFF[e.diff].n : ''}</td></tr>`).join('')}</tbody></table>`;
}

/* ---------- end screen ---------- */
function showEnd(r) {
  const s = S();
  hideCard();
  const id = Date.now();
  const list = saveScore({ id, score: r.score, verdict: r.verdict, scen: s.scenKey, diff: s.diffKey });
  const row = (k, v) => `<span>${k}</span><span>${v}</span>`;
  $('#brief').innerHTML = `
    <p class="eyebrow">Hlášení po směně · ${D.SCEN[s.scenKey].n} · ${D.DIFF[s.diffKey].n} · ${fmtT(s.t)}</p>
    <div class="verdict" style="color:${r.good ? 'var(--ok)' : 'var(--red)'}">${r.verdict}</div>
    <p>${r.text}</p>
    <div class="score">Skóre ${r.score}</div>
    <canvas class="chart" id="chart"></canvas>
    <div class="chart-key"><span><i style="background:var(--amber)"></i>Eskalace</span><span><i style="background:var(--cyan)"></i>Odstrašení</span><span><i style="background:var(--ok)"></i>Veřejný pořádek</span><span><i style="background:var(--red)"></i>Ztráty USA (pravá osa)</span></div>
    <div class="report">
      ${row('Oběti v USA (odhad)', fmtM(s.cas))}
      ${row('Oběti v Rusku (odhad)', fmtM(s.enemyCas))}
      ${row('Skutečné hrozby / zničené', `${s.stats.realLaunched} / ${s.stats.kills}`)}
      ${row('Dopady na území USA', s.stats.impacts)}
      ${row('Odpálené interceptory', `${s.stats.fired} (promarněno ${s.stats.wasted})`)}
      ${row('Odhalené falešné kontakty', s.stats.falseSeen)}
      ${row('Americké jaderné údery', s.stats.strikes)}
      ${row('Dohody přes horkou linku', `${s.hot.ok} z ${s.hot.tries} hovorů`)}
      ${row('Konečná eskalace / odstrašení', `${Math.round(s.esc)} / ${Math.round(s.cred)}`)}
    </div>
    ${scoreTable(list, id)}
    <button class="btn primary" id="againBtn">Nová směna</button>`;
  $('#ovl').hidden = false;
  drawChart(s);
  $('#againBtn').onclick = () => G.main.showStart();
  $('#againBtn').focus();
}
function drawChart(s) {
  const cv = $('#chart'); if (!cv) return;
  const r = cv.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
  cv.width = r.width * dpr; cv.height = r.height * dpr;
  const c = cv.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0);
  const cs = getComputedStyle(document.documentElement), col = k => cs.getPropertyValue('--' + k).trim();
  const H = s.history; if (H.length < 2) return;
  const W = r.width, Ht = r.height, padL = 28, padR = 44, padT = 8, padB = 18;
  const tMax = H[H.length - 1].t, casMax = Math.max(1, ...H.map(h => h.cas));
  const X = t => padL + (W - padL - padR) * t / tMax, Y = v => padT + (Ht - padT - padB) * (1 - v / 100), Yc = v => padT + (Ht - padT - padB) * (1 - v / casMax);
  c.font = '9px "IBM Plex Mono", monospace'; c.fillStyle = col('dim'); c.strokeStyle = col('line'); c.lineWidth = 1;
  for (const v of [0, 50, 100]) { c.beginPath(); c.moveTo(padL, Y(v)); c.lineTo(W - padR, Y(v)); c.stroke(); c.fillText(String(v), 4, Y(v) + 3); }
  c.textAlign = 'right'; c.fillText(fmtM(casMax), W - 2, padT + 8); c.fillText('0', W - 2, Y(0) + 3); c.textAlign = 'left';
  for (let m = 0; m <= tMax / 60; m += 15) { const x = X(m * 60); c.fillText(m + ' min', x - 8, Ht - 4); }
  const line = (key, color, yf) => { c.strokeStyle = color; c.lineWidth = 1.6; c.beginPath(); H.forEach((h, i) => { const x = X(h.t), y = yf(h[key]); i ? c.lineTo(x, y) : c.moveTo(x, y); }); c.stroke(); };
  line('esc', col('amber'), Y); line('cred', col('cyan'), Y); line('order', col('ok'), Y); line('cas', col('red'), Yc);
}

G.ui = { log, build, refresh, showCard, hideCard, showEnd, showTab, loadScores, scoreTable };
})();
