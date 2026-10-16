'use strict';
// DOM: builds the panels once per game, then updates text and button states ~5× per second.
// Labels created in build() are registered with lbl() so a language switch can redraw them.
(() => {
const { L, tx, nm, ds, pl, fmtT, fmtEta, fmtM, fmtPop } = G;
const D = G.DATA;
const $ = s => document.querySelector(s);
const X = () => G.sim;
const S = () => G.S;

const STATUS = {
  unverified: ['NEOVĚŘENO', 'UNVERIFIED'], verifying: ['OVĚŘUJE SE', 'VERIFYING'], confirmed: ['POTVRZENO', 'CONFIRMED'],
  false: ['FALEŠNÝ', 'FALSE'], destroyed: ['ZNIČENO', 'DESTROYED'], impact: ['DOPAD', 'IMPACT'],
};
const KIND = { ICBM: ['ICBM · mezikontinentální', 'ICBM · intercontinental'], SLBM: ['SLBM · z ponorky', 'SLBM · submarine-launched'], BMB: ['Strategický bombardér', 'Strategic bomber'] };
const pct = p => Math.round(p * 100) + (G.lang === 'en' ? '%' : ' %');
const ok = (y, t) => `<span class="${y ? 'y' : 'n'}">${y ? '✓' : '○'} ${t}</span>`;

/* ---------- labels ---------- */
let labels = [];
function lbl(e, v) { labels.push([e, v]); e.textContent = typeof v === 'function' ? v() : tx(v); return e; }
function relabel() { for (const [e, v] of labels) e.textContent = typeof v === 'function' ? v() : tx(v); }

function el(tag, cls, html) { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
function btn(label, onClick, cls = 'btn sm') { const b = el('button', cls); b.type = 'button'; lbl(b, label); b.onclick = () => { onClick(); refresh(); }; return b; }
function setBtn(b, why) { b.disabled = !!why; b.title = why || ''; }
function asset(name) {
  const r = el('div', 'asset'); const n = lbl(el('span', 'nm'), name);
  const st = el('span', 'st'); const act = el('div', 'act'); r.append(n, act, st);
  return { r, nm: n, st, act };
}
function setSt(row, text, cls = '') { row.st.textContent = text; row.st.className = 'st ' + cls; }
function note(text) { return lbl(el('p', 'note'), text); }

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
const R = {};
const rows = new Map();

function build() {
  labels = [];
  logEl.innerHTML = '';
  $('#trkList').querySelectorAll('.trk').forEach(r => r.remove()); rows.clear();
  showTab('kontakt');

  // cities
  const cl = $('#cityList'); cl.innerHTML = ''; R.cities = [];
  for (const [k, s] of Object.entries(D.SITES)) {
    if (s.type !== 'city') continue;
    const r = el('div', 'city');
    const n = el('span', 'nm'); n.textContent = s.n;
    const sub = el('span', 'sub'); const act = el('div', 'act');
    const bA = btn(['Varovat', 'Warn'], () => X().alertCity(k)), bF = btn('FEMA', () => X().fema(k));
    act.append(bA, bF); r.append(n, act, sub); cl.append(r);
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
  for (const k of ['GREELY', 'VAFB', 'ELM', 'LANGLEY']) { const a = asset(() => nm(D.SITES[k])); dl.append(a.r); R.def[k] = a; }

  // ships
  const sl = $('#shipList'); sl.innerHTML = ''; R.ships = [];
  for (const s of S().ships) {
    const a = asset(`${s.name} (${s.id})`); a.r.classList.add('wide');
    const sel = el('select'); sel.id = 'st-' + s.id;
    for (const [k, st] of Object.entries(D.STATIONS)) { const o = el('option'); o.value = k; lbl(o, () => nm(st)); sel.append(o); }
    sel.value = s.st;
    sel.onchange = () => { sel.dataset.user = '1'; refresh(); };
    const b = btn(['Přesunout', 'Move'], () => { X().shipMove(s.id, sel.value); sel.dataset.user = ''; });
    a.act.append(sel, b); sl.append(a.r); R.ships.push({ s, a, sel, b });
  }

  // triad
  const tl = $('#triad'); tl.innerHTML = ''; R.silos = []; R.wings = []; R.ports = [];
  for (const k of D.SILOS) { const a = asset(() => 'Minuteman III · ' + nm(D.SITES[k])); tl.append(a.r); R.silos.push({ k, a }); }
  for (const w of S().wings) { const a = asset([w.name, w.en]); const b = btn(['Vzlétnout', 'Launch'], () => X().wingLaunch(w.id)); a.act.append(b); tl.append(a.r); R.wings.push({ w, a, b }); }
  R.patrol = asset(['Ponorky SSBN na hlídce', 'SSBNs on patrol']); tl.append(R.patrol.r);
  for (const k of Object.keys(S().ssbn.port)) {
    const a = asset([`Ponorky v přístavu ${D.SITES[k].s}`, `Submarines in port, ${D.SITES[k].s}`]);
    const b = btn(['Vyplout', 'Sail'], () => X().sail(k)); a.act.append(b); tl.append(a.r); R.ports.push({ k, a, b });
  }
  R.tacamo = asset('E-6B Mercury (TACAMO)'); R.tacamoB = btn(['Vzlétnout', 'Launch'], () => X().tacamo()); R.tacamo.act.append(R.tacamoB); tl.append(R.tacamo.r);

  // intel
  const il = $('#intelOps'); il.innerHTML = '';
  R.recon = asset(['Satelitní průzkum KH-11', 'KH-11 satellite reconnaissance']); R.reconB = btn(['Spustit', 'Start'], () => X().recon()); R.recon.act.append(R.reconB);
  R.sigint = asset(['Odposlech NSA (SIGINT)', 'NSA intercepts (SIGINT)']); R.sigintB = btn(['Spustit', 'Start'], () => X().sigint()); R.sigint.act.append(R.sigintB);
  R.cyber = asset(['Kybernetická operace', 'Cyber operation']); R.cyberB = btn(['Spustit', 'Start'], () => X().cyber()); R.cyber.act.append(R.cyberB);
  il.append(R.recon.r, R.sigint.r, R.cyber.r,
    note(['Průzkum předpoví další vlnu. Odposlech zkrátí ověřování na 45 s. Kybernetická operace může vlnu zdržet, ale při odhalení zvedne eskalaci.',
      'Reconnaissance forecasts the next wave. Intercepts cut verification to 45 s. A cyber operation can delay a wave, but raises escalation if detected.']));
  const rl = $('#radarList'); rl.innerHTML = ''; R.radars = [];
  for (const k of D.RADARS) { const a = asset(() => nm(D.SITES[k])); rl.append(a.r); R.radars.push({ k, a }); }
  R.radarNote = el('p', 'note'); rl.append(R.radarNote);

  // diplomacy
  const hl = $('#hotList'); hl.innerHTML = ''; R.hot = [];
  const HOT = [
    ['truce', ['Navrhnout okamžité příměří', 'Propose an immediate ceasefire'], ['Při úspěchu eskalace −14 až −22 a krok k příměří. Šance klesá s eskalací.', 'On success, escalation −14 to −22 and a step towards a ceasefire. Odds fall as escalation rises.']],
    ['assure', ['Slíbit zdrženlivost', 'Promise restraint'], ['Vyšší šance, eskalace −8 až −12, ale odstrašení −6. Nepočítá se jako dohoda.', 'Better odds, escalation −8 to −12, but deterrence −6. Does not count as an agreement.']],
    ['warn', ['Pohrozit masivní odvetou', 'Threaten massive retaliation'], ['Při odstrašení ≥ 60 eskalace klesne, jinak vzroste.', 'With deterrence ≥ 60 escalation falls, otherwise it rises.']],
    ['ask', ['Zeptat se na vybraný kontakt', 'Ask about the selected contact'], ['Moskva řekne, zda jde o její raketu. V 25 % případů lže.', 'Moscow says whether it is its missile. It lies 25% of the time.']],
  ];
  for (const [k, t, d] of HOT) {
    const b = el('button', 'btn choice'); b.type = 'button';
    b.append(lbl(el('span'), t), lbl(el('small'), d));
    b.onclick = () => { X().hotline(k); refresh(); };
    hl.append(b); R.hot.push({ k, b });
  }
  const dp = $('#dipList'); dp.innerHTML = '';
  R.nato = asset(['Konzultace NATO', 'NATO consultations']); R.natoB = btn(['Svolat', 'Convene'], () => X().nato()); R.nato.act.append(R.natoB);
  R.allies = asset(['Pohotovost britských a francouzských ponorek', 'British and French submarine alert']); R.alliesB = btn(['Požádat', 'Request'], () => X().allies()); R.allies.act.append(R.alliesB);
  R.china = asset(['Zprostředkování Číny', 'Chinese mediation']); R.chinaB = btn(['Požádat', 'Request'], () => X().china()); R.china.act.append(R.chinaB);
  dp.append(R.nato.r, R.allies.r, R.china.r);

  // civil
  const cg = $('#cogList'); cg.innerHTML = '';
  R.potus = asset(['Prezident', 'President']); R.potusB = btn(['Evakuovat do E-4B', 'Evacuate to E-4B'], () => X().evacPotus()); R.potus.act.append(R.potusB);
  R.vp = asset(['Viceprezident', 'Vice President']); R.vpB = btn(['Do Raven Rock', 'To Raven Rock'], () => X().evacVp()); R.vp.act.append(R.vpB);
  cg.append(R.potus.r, R.vp.r, note(['Pokud Washington zasáhne hlavice, přežije jen ten, kdo je v bezpečí. Bez prezidenta i viceprezidenta hra končí ztrátou velení.',
    'If a warhead hits Washington, only those already safe survive. Losing both the President and the Vice President ends the game.']));
  const cv = $('#civList'); cv.innerHTML = '';
  R.order = asset(['Veřejný pořádek', 'Public order']);
  R.all = asset(['Celostátní poplach EAS', 'Nationwide EAS alert']); R.allB = btn(['Vyhlásit', 'Issue'], () => X().alertAll(), 'btn sm danger'); R.all.act.append(R.allB);
  R.speech = asset(['Projev k národu', 'Address the nation']); R.speechB = btn(['Vysílat', 'Broadcast'], () => X().speech()); R.speech.act.append(R.speechB);
  R.guard = asset(['Národní garda', 'National Guard']); R.guardB = btn(['Nasadit', 'Deploy'], () => X().guard()); R.guard.act.append(R.guardB);
  R.fema = asset(['Záchranné týmy FEMA', 'FEMA rescue teams']);
  cv.append(R.order.r, R.all.r, R.speech.r, R.guard.r, R.fema.r,
    note(['Varování EAS snižuje ztráty tím víc, čím dřív přijde, až o 45 %. Nízký veřejný pořádek jeho účinek oslabuje. FEMA pošlete z řádku zasaženého města vlevo.',
      'The earlier an EAS warning comes, the more it cuts losses, up to 45%. Low public order weakens it. Send FEMA from a stricken city’s row on the left.']));

  // retaliation
  const sets = $('#setList'); sets.innerHTML = ''; R.sets = [];
  for (const [k, s] of Object.entries(D.RU_SETS)) {
    const l = el('label', 'opt'); const i = el('input'); i.type = 'checkbox'; i.id = 'set-' + k; i.value = k;
    i.onchange = () => refresh();
    l.append(i, lbl(el('b'), () => nm(s)), lbl(el('small'), () => `${ds(s)} ${s.missiles} ${L('hlavic', 'warheads')}.`));
    sets.append(l); R.sets.push({ k, i });
  }
  const plt = $('#platList'); plt.innerHTML = ''; R.plats = [];
  for (const [k, p] of Object.entries(D.PLATFORMS)) {
    const l = el('label', 'opt'); const i = el('input'); i.type = 'radio'; i.name = 'plat'; i.id = 'plat-' + k; i.value = k; if (k === 'icbm') i.checked = true;
    i.onchange = () => refresh();
    const sm = el('small');
    l.append(i, lbl(el('b'), () => nm(p)), sm); plt.append(l); R.plats.push({ k, i, l, sm });
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

  document.querySelectorAll('#defcon span').forEach(e => e.classList.toggle('on', +e.dataset.l === s.defcon));
  $('#clock').textContent = fmtT(s.t); $('#zulu').textContent = G.zulu(s.t);
  $('#escVal').textContent = Math.round(s.esc); $('#escBar').style.width = s.esc + '%';
  $('#credVal').textContent = Math.round(s.cred); $('#credBar').style.width = s.cred + '%';
  $('#orderVal').textContent = Math.round(s.order); $('#orderBar').style.width = s.order + '%';
  $('#casVal').textContent = fmtM(s.cas);
  $('#leaderVal').textContent = s.leader === 'potus' ? (s.potus === 'air' ? L('Prezident · E-4B', 'President · E-4B') : L('Prezident', 'President')) : s.leader === 'vp' ? L('Viceprezident', 'Vice President') : L('Ztraceno', 'Lost');
  $('#leaderVal').className = 'v sm' + (s.leader === 'vp' ? ' red' : '');
  $('#bPause').textContent = s.paused ? L('Pokračovat', 'Resume') : L('Pauza', 'Pause');
  $('#bPause').classList.toggle('on', s.paused);
  $('#bSound').textContent = (G.lang === 'en' ? 'Sound: ' : 'Zvuk: ') + (G.audio.on ? L('zap', 'on') : L('vyp', 'off'));
  document.querySelectorAll('.spd').forEach(b => b.classList.toggle('on', +b.dataset.s === s.speed));

  const fc = s.intel.forecast, fEl = $('#forecast');
  if (fc && s.t < fc.at + 20) {
    fEl.hidden = false;
    fEl.textContent = fc.quiet ? L('KH-11: žádné přípravy ke startu', 'KH-11: no launch preparations')
      : L(`KH-11: další vlna za ${fmtEta(fc.at - s.t)} · odhad ${fc.n} ${pl(fc.n, ['raketa', 'rakety', 'raket'], [])}`, `KH-11: next wave in ${fmtEta(fc.at - s.t)} · est. ${fc.n} ${pl(fc.n, [], ['missile', 'missiles'])}`);
  } else fEl.hidden = true;

  tracks(s, x); cities(s, x); contact(s, x); forces(s, x); intel(s, x); diplomacy(s, x); civil(s, x); retaliation(s, x);

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
    r.children[1].textContent = tr.kind === 'BMB' ? L('BOMB.', 'BOMBER') : tr.kind;
    r.children[2].textContent = x.active(tr) ? fmtEta(x.eta(tr)) : '—';
    r.children[3].textContent = '→ ' + nm(D.SITES[tr.target]) + (tr.status === 'unverified' ? '?' : '') + L(' · z ', ' · from ') + x.zoneName(tr);
    r.children[4].textContent = tx(STATUS[st]);
  }
  const n = s.tracks.filter(x.active).length;
  $('#trkCount').textContent = `${n} ${pl(n, ['aktivní', 'aktivní', 'aktivních'], ['active', 'active'])}`;
  $('#verifyCap').textContent = L('Ověřovací kanály', 'Verification channels') + ` ${x.verifying()}/${x.VERIFY_CAP}${s.t < s.intel.sigintUntil ? ' · SIGINT' : ''}`;
  $('#confirmInfo').textContent = s.t < s.radarOutUntil ? L('Radary vyřazeny EMP', 'Radars down (EMP)') : L(`Radar potvrdí ${fmtEta(x.confirmT())} před dopadem`, `Radar confirms ${fmtEta(x.confirmT())} before impact`);
}

function cities(s, x) {
  for (const c of R.cities) {
    const threat = s.tracks.some(t => x.active(t) && t.status === 'confirmed' && t.target === c.k);
    c.r.className = 'city' + (c.s.hits ? ' hit' : '') + (c.s.alertT != null ? ' warned' : '') + (threat && c.s.alertT == null ? ' threat' : '');
    let t;
    if (c.s.hits) t = L(`Zasaženo ${c.s.hits}× · oběti ${fmtM(c.s.pop - c.s.remain)}${c.s.fallout > .01 ? ' · spad' : ''}`, `Hit ${c.s.hits}× · deaths ${fmtM(c.s.pop - c.s.remain)}${c.s.fallout > .01 ? ' · fallout' : ''}`);
    else if (c.s.alertT != null) t = L('Varováno ', 'Warned ') + fmtT(c.s.alertT);
    else t = `${fmtPop(c.s.pop)} ${L('obyvatel', 'people')}`;
    if (threat) t += L(' · OHROŽENO', ' · THREATENED');
    c.sub.textContent = t;
    setBtn(c.bA, c.s.alertT != null ? L('Varováno.', 'Warned.') : null);
    c.bA.textContent = c.s.alertT != null ? L('Varováno', 'Warned') : L('Varovat', 'Warn');
    c.bA.classList.toggle('danger', threat && c.s.alertT == null);
    c.bF.hidden = !c.s.hits;
    setBtn(c.bF, c.s.fema ? L('Týmy už pracují.', 'Teams already on site.') : s.civ.fema < 1 ? L('Žádné volné týmy.', 'No teams left.') : null);
    if (!c.bF.disabled) c.bF.title = L('Vyslat záchranné týmy proti radioaktivnímu spadu', 'Send rescue teams against radioactive fallout');
  }
  $('#femaCount').textContent = `FEMA ${s.civ.fema}`;
}

function contact(s, x) {
  const tr = x.selTrack();
  $('#dId').textContent = tr ? tr.id : '—';
  const chip = $('#dChip'); chip.hidden = !tr;
  if (tr) {
    const st = tr.verifyEnd ? 'verifying' : tr.status; chip.textContent = tx(STATUS[st]);
    chip.style.color = st === 'confirmed' || st === 'impact' ? 'var(--red)' : st === 'destroyed' ? 'var(--ok)' : st === 'false' ? 'var(--dim)' : 'var(--amber)';
  }
  $('#dKind').textContent = tr ? tx(KIND[tr.kind]) : '—';
  $('#dFrom').textContent = tr ? x.zoneName(tr) : '—';
  $('#dTgt').textContent = tr ? nm(D.SITES[tr.target]) + (tr.status === 'unverified' ? L(' (odhad)', ' (estimate)') : '') : '—';
  $('#dEta').textContent = tr && x.active(tr) ? fmtEta(x.eta(tr)) : '—';
  const h = tr && s.hints[tr.id] && tr.status === 'unverified';
  $('#dHint').hidden = !h; if (h) $('#dHint').textContent = tx(s.hints[tr.id]);
  const vWhy = !tr ? L('Není vybrán kontakt.', 'No contact selected.') : tr.status !== 'unverified' ? L('Kontakt už je vyhodnocen.', 'Contact already resolved.') : tr.verifyEnd ? L('Ověřování probíhá.', 'Verification in progress.') : x.verifying() >= x.VERIFY_CAP ? L('Všechny kanály jsou obsazené.', 'All channels busy.') : null;
  setBtn($('#bVerify'), vWhy);
  $('#bVerify').textContent = L('Ověřit', 'Verify') + ` (${x.verifyTime()} s)`;
  let n = L('Vyberte kontakt v seznamu nebo na mapě.', 'Select a contact in the list or on the map.');
  if (tr) {
    if (tr.verifyEnd) n = L(`Korelace dat dokončena za ${fmtEta(tr.verifyEnd - s.t)}.`, `Data correlation done in ${fmtEta(tr.verifyEnd - s.t)}.`);
    else if (tr.status === 'unverified') n = tr.kind === 'BMB' ? L('Bombardér sledovaný radary. Ověřením zjistíte, jestli jde o skutečný útok.', 'A bomber on radar. Verify it to learn whether the attack is real.') : L('Mohlo by jít o falešný poplach. Střelba na neověřený cíl může interceptor promarnit.', 'This could be a false alarm. Firing at an unverified target may waste an interceptor.');
    else if (tr.status === 'confirmed') n = tr.kind === 'BMB' ? L('Potvrzený bombardér. Vyšlete stíhače.', 'Confirmed bomber. Scramble fighters.') : L('Potvrzená hlavice. Zasáhněte, nebo aspoň varujte cíl přes EAS.', 'Confirmed warhead. Engage it, or at least warn the target through EAS.');
    else if (tr.status === 'false') n = L('Falešný kontakt. Žádná akce není potřeba.', 'False contact. No action needed.');
    else if (tr.status === 'destroyed') n = L('Hrozba zničena.', 'Threat destroyed.');
    else if (tr.status === 'impact') n = L('Hlavice dopadla.', 'The warhead has struck.');
    const pend = s.ints.filter(i => i.tr === tr);
    if (pend.length) n += L(' Ve vzduchu: ', ' In flight: ') + pend.map(i => i.type === 'air' ? L('letka F-22', 'F-22 squadron') : `${i.n}× ${i.type === 'gmd' ? 'GBI' : 'SM-3'}`).join(', ') + L(', střet za ', ', intercept in ') + fmtEta(Math.min(...pend.map(i => i.t1)) - s.t) + '.';
  }
  $('#dNote').textContent = n;

  for (const r of R.shooters) {
    const why1 = x.shooterCheck(r.def.key, tr, 1);
    setBtn(r.b1, why1);
    if (r.b2) setBtn(r.b2, x.shooterCheck(r.def.key, tr, 2));
    let ammo;
    if (r.def.type === 'gmd') { const st = D.SITES[r.def.key]; ammo = st.dead ? L('vyřazeno', 'destroyed') : `${st.stock} GBI`; }
    else if (r.def.type === 'ship') { const sh = s.ships.find(q => 'ship:' + q.id === r.def.key); ammo = `${sh.ammo} SM-3 · ${nm(D.STATIONS[sh.moveTo || sh.st])}${sh.moveTo ? L(' (přesun)', ' (moving)') : ''}`; }
    else { const st = D.SITES[r.def.key]; ammo = st.dead ? L('vyřazeno', 'destroyed') : `${st.fighters} ${pl(st.fighters, ['letka', 'letky', 'letek'], ['squadron', 'squadrons'])}`; }
    if (!why1) setSt(r.a, `${ammo} · ${L('zásah', 'kill')} ${pct(x.pk(r.def.key, 1))}${r.b2 ? ` / ×2 ${pct(x.pk(r.def.key, 2))}` : ''}`, 'ok');
    else setSt(r.a, `${ammo} · ${why1}`, tr && x.active(tr) ? 'warn' : '');
  }
}

function forces(s, x) {
  $('#defStat').textContent = 'DEFCON ' + s.defcon;
  const busy = L('Rozkaz se předává.', 'Order being relayed.');
  setBtn($('#bDefUp'), s.defcon === 1 ? L('Nejvyšší stupeň.', 'Highest level.') : s.t < s.defNext ? busy : null);
  setBtn($('#bDefDown'), s.defcon === 5 ? L('Nejnižší stupeň.', 'Lowest level.') : s.t < s.defNext ? busy : null);
  const dead = L('VYŘAZENO', 'DESTROYED');
  for (const k of ['GREELY', 'VAFB']) { const st = D.SITES[k]; setSt(R.def[k], st.dead ? dead : L(`${st.stock} / ${st.stock0} interceptorů GBI`, `${st.stock} / ${st.stock0} GBI interceptors`), st.dead ? 'bad' : ''); }
  for (const k of ['ELM', 'LANGLEY']) { const st = D.SITES[k]; setSt(R.def[k], st.dead ? dead : L(`${st.fighters} / ${st.fighters0} letek F-22 připraveno`, `${st.fighters} / ${st.fighters0} F-22 squadrons ready`), st.dead ? 'bad' : ''); }
  for (const r of R.ships) {
    const sh = r.s;
    setSt(r.a, sh.moveTo ? L(`Přesun: ${nm(D.STATIONS[sh.moveTo])} za ${fmtEta(sh.eta - s.t)} · ${sh.ammo} SM-3`, `Moving: ${nm(D.STATIONS[sh.moveTo])} in ${fmtEta(sh.eta - s.t)} · ${sh.ammo} SM-3`) : `${nm(D.STATIONS[sh.st])} · ${sh.ammo} SM-3`, sh.moveTo ? 'warn' : '');
    if (document.activeElement !== r.sel && r.sel.dataset.user !== '1') r.sel.value = sh.moveTo || sh.st;
    setBtn(r.b, sh.moveTo ? L('Loď je na přesunu.', 'Ship is repositioning.') : r.sel.value === sh.st ? L('Vyberte jiné stanoviště.', 'Pick a different station.') : null);
  }
  for (const r of R.silos) { const st = D.SITES[r.k]; setSt(r.a, st.dead ? L('Zničeno', 'Destroyed') : L(`${st.missiles} raket v silech`, `${st.missiles} missiles in silos`), st.dead ? 'bad' : ''); }
  for (const r of R.wings) {
    const w = r.w, base = D.SITES[w.base].s;
    const m = { ground: [L(`${w.n} letounů na zemi · ${base}`, `${w.n} aircraft on the ground · ${base}`), 'warn'], launching: [L(`Vzlet za ${fmtEta(w.eta - s.t)}`, `Airborne in ${fmtEta(w.eta - s.t)}`), 'warn'], air: [L(`${w.n} letounů ve vzduchu`, `${w.n} aircraft airborne`), 'ok'], lost: [L('Zničeno na zemi', 'Destroyed on the ground'), 'bad'] };
    setSt(r.a, ...m[w.state]);
    setBtn(r.b, w.state !== 'ground' ? L('Už ve vzduchu nebo ztraceno.', 'Already airborne or lost.') : null);
  }
  setSt(R.patrol, L(`${s.ssbn.patrol} ponorky na moři · ${x.capacity('slbm')} hlavic k dispozici`, `${s.ssbn.patrol} submarines at sea · ${x.capacity('slbm')} warheads available`), 'ok');
  for (const r of R.ports) {
    const p = s.ssbn.port[r.k];
    const m = { port: [L(`${p.n} ponorky kotví v přístavu`, `${p.n} submarines tied up in port`), 'warn'], sailing: [L(`Vyplouvají, v bezpečí za ${fmtEta(p.eta - s.t)}`, `Sailing, safe in ${fmtEta(p.eta - s.t)}`), 'warn'], sea: [L(`${p.n} ponorky na moři`, `${p.n} submarines at sea`), 'ok'], lost: [L('Zničeny v přístavu', 'Destroyed in port'), 'bad'] };
    setSt(r.a, ...m[p.state]);
    setBtn(r.b, p.state !== 'port' ? L('Už vypluly nebo jsou ztraceny.', 'Already at sea or lost.') : null);
  }
  const tm = { ground: [L('Na zemi, Tinker AFB. Bez něj nelze vydat rozkaz ponorkám.', 'On the ground at Tinker AFB. Without it, submarines cannot be ordered to fire.'), 'warn'], launching: [L(`Vzlet za ${fmtEta(s.tacamoEta - s.t)}`, `Airborne in ${fmtEta(s.tacamoEta - s.t)}`), 'warn'], air: [L('Ve vzduchu, spojení s ponorkami aktivní', 'Airborne, submarine link active'), 'ok'], lost: [L('Zničeno na zemi', 'Destroyed on the ground'), 'bad'] };
  setSt(R.tacamo, ...tm[s.tacamo]);
  setBtn(R.tacamoB, s.tacamo !== 'ground' ? L('Už ve vzduchu nebo ztraceno.', 'Already airborne or lost.') : null);
}

function intel(s, x) {
  const i = s.intel, na = L('Nedostupné.', 'Unavailable.');
  setSt(R.recon, i.reconBusy ? L(`Snímkování, výsledek za ${fmtEta(i.reconBusy - s.t)}`, `Imaging, results in ${fmtEta(i.reconBusy - s.t)}`) : s.t < i.reconNext ? L(`Satelit znovu k dispozici za ${fmtEta(i.reconNext - s.t)}`, `Satellite available again in ${fmtEta(i.reconNext - s.t)}`) : L('Připraveno · výsledek za 3 min', 'Ready · results in 3 min'), i.reconBusy ? 'warn' : '');
  setBtn(R.reconB, s.t < i.reconNext ? L('Satelit je zaneprázdněn.', 'The satellite is busy.') : null);
  setSt(R.sigint, s.t < i.sigintUntil ? L(`Aktivní ještě ${fmtEta(i.sigintUntil - s.t)}`, `Active for ${fmtEta(i.sigintUntil - s.t)}`) : s.t < i.sigintNext ? L(`Znovu za ${fmtEta(i.sigintNext - s.t)}`, `Again in ${fmtEta(i.sigintNext - s.t)}`) : L('Připraveno · 10 min', 'Ready · 10 min'), s.t < i.sigintUntil ? 'ok' : '');
  setBtn(R.sigintB, s.t < i.sigintNext ? na : null);
  setSt(R.cyber, s.t < i.cyberNext ? L(`Znovu za ${fmtEta(i.cyberNext - s.t)}`, `Again in ${fmtEta(i.cyberNext - s.t)}`) : L('Připraveno · úspěch ~55 %, odhalení ~20 %', 'Ready · ~55% success, ~20% detection'));
  setBtn(R.cyberB, s.t < i.cyberNext ? na : null);
  for (const r of R.radars) {
    const st = D.SITES[r.k], down = st.dead || s.t < s.radarOutUntil;
    setSt(r.a, st.dead ? L('Vyřazen', 'Destroyed') : s.t < s.radarOutUntil ? L('Výpadek (EMP)', 'Outage (EMP)') : L('V provozu', 'Operational'), down ? 'bad' : 'ok');
  }
  R.radarNote.textContent = L(`Funkčních radarů ${x.radarsAlive()} z ${D.RADARS.length}. Hlavice se potvrdí ${fmtEta(x.confirmT())} před dopadem, čím méně radarů, tím později.`,
    `${x.radarsAlive()} of ${D.RADARS.length} radars working. Warheads are confirmed ${fmtEta(x.confirmT())} before impact; fewer radars means later.`);
}

function diplomacy(s, x) {
  const h = s.hot;
  $('#hotStat').textContent = s.ceasefire ? L('Příměří platí', 'Ceasefire in force') : s.t < 480 ? L(`Navazuje se (${fmtEta(480 - s.t)})`, `Connecting (${fmtEta(480 - s.t)})`) : s.t < h.next ? L(`Znovu za ${fmtEta(h.next - s.t)}`, `Again in ${fmtEta(h.next - s.t)}`) : L(`Připravena · dohody ${h.ok}/2`, `Ready · agreements ${h.ok}/2`);
  const why = s.ceasefire ? L('Příměří už platí.', 'Ceasefire already in force.') : s.t < h.next ? L('Linka není dostupná.', 'The line is unavailable.') : null;
  for (const r of R.hot) setBtn(r.b, why || (r.k === 'ask' && (!x.selTrack() || x.selTrack().status !== 'unverified') ? L('Vyberte neověřený kontakt.', 'Select an unverified contact.') : null));
  setSt(R.nato, s.t < s.dip.natoNext ? L(`Znovu za ${fmtEta(s.dip.natoNext - s.t)}`, `Again in ${fmtEta(s.dip.natoNext - s.t)}`) : L('Odstrašení +8, eskalace +2', 'Deterrence +8, escalation +2'));
  setBtn(R.natoB, s.t < s.dip.natoNext ? L('Rada už zasedala.', 'The Council has just met.') : null);
  const used = L('Už využito.', 'Already used.');
  setSt(R.allies, s.dip.alliesUsed ? L('Spojenci v pohotovosti', 'Allies on alert') : L('Odstrašení +12, eskalace +6. Jen jednou.', 'Deterrence +12, escalation +6. Once only.'), s.dip.alliesUsed ? 'ok' : '');
  setBtn(R.alliesB, s.dip.alliesUsed ? used : null);
  setSt(R.china, s.dip.chinaUsed ? L('Využito', 'Used') : s.t < 1200 ? L(`Peking bude k dispozici za ${fmtEta(1200 - s.t)}`, `Beijing available in ${fmtEta(1200 - s.t)}`) : L('Eskalace −12 při úspěchu. Jen jednou.', 'Escalation −12 on success. Once only.'));
  setBtn(R.chinaB, s.dip.chinaUsed ? used : s.t < 1200 ? L('Zatím nedostupné.', 'Not yet available.') : null);
  const req = [[h.ok >= 2, L(`Dvě dohody přes horkou linku (${h.ok}/2)`, `Two hotline agreements (${h.ok}/2)`)], [s.esc < 20, L(`Eskalace pod 20 (nyní ${Math.round(s.esc)})`, `Escalation below 20 (now ${Math.round(s.esc)})`)], [s.cred >= 40, L(`Odstrašení aspoň 40 (nyní ${Math.round(s.cred)})`, `Deterrence at least 40 (now ${Math.round(s.cred)})`)]];
  if (!s.hostile && s.sc.petrov) req.push([s.t >= 2700, L('Vydržet bez provokace do T+45:00', 'Hold out without provocation until T+45:00')]);
  $('#truceReq').innerHTML = req.map(([y, t]) => ok(y, t)).join('') + (s.ceasefire ? ok(true, L('Příměří vyhlášeno', 'Ceasefire declared')) : '');
}

function civil(s, x) {
  const pm = { dc: [L('Bílý dům, Washington', 'White House, Washington'), 'warn'], moving: [L(`Marine One, do E-4B za ${fmtEta(s.potusEta - s.t)}`, `Marine One, aboard E-4B in ${fmtEta(s.potusEta - s.t)}`), 'warn'], air: [L('Na palubě E-4B, v bezpečí', 'Aboard the E-4B, safe'), 'ok'], dead: [L('Nezvěstný', 'Missing'), 'bad'] };
  const done = L('Evakuace už proběhla.', 'Already evacuated.');
  setSt(R.potus, ...pm[s.potus]); setBtn(R.potusB, s.potus !== 'dc' ? done : null);
  const vm = { dc: ['Washington', 'warn'], moving: [L(`Přesun do Raven Rock za ${fmtEta(s.vpEta - s.t)}`, `At Raven Rock in ${fmtEta(s.vpEta - s.t)}`), 'warn'], safe: [L('Raven Rock, v bezpečí', 'Raven Rock, safe'), 'ok'], dead: [L('Nezvěstný', 'Missing'), 'bad'] };
  setSt(R.vp, ...vm[s.vp]); setBtn(R.vpB, s.vp !== 'dc' ? done : null);
  const eff = Math.round((.5 + s.order / 200) * 100);
  setSt(R.order, L(`${Math.round(s.order)} / 100 · účinnost varování ${eff} %`, `${Math.round(s.order)} / 100 · warning effectiveness ${eff}%`), s.order < 40 ? 'bad' : s.order < 65 ? 'warn' : 'ok');
  setSt(R.all, s.civ.nationwide ? L('Vyhlášen', 'Issued') : L('Varuje všechna města najednou. Pořádek −12.', 'Warns every city at once. Order −12.'), s.civ.nationwide ? 'ok' : '');
  setBtn(R.allB, s.civ.nationwide ? L('Už vyhlášen.', 'Already issued.') : null);
  setSt(R.speech, s.t < s.civ.speechNext ? L(`Znovu za ${fmtEta(s.civ.speechNext - s.t)}`, `Again in ${fmtEta(s.civ.speechNext - s.t)}`) : L('Pořádek +15', 'Order +15'));
  setBtn(R.speechB, !s.leader ? L('Není kdo by promluvil.', 'No one is left to speak.') : s.t < s.civ.speechNext ? L('Nedávno vysíláno.', 'Recently broadcast.') : null);
  setSt(R.guard, s.t < s.civ.guardNext ? L(`Znovu za ${fmtEta(s.civ.guardNext - s.t)}`, `Again in ${fmtEta(s.civ.guardNext - s.t)}`) : L('Pořádek +12', 'Order +12'));
  setBtn(R.guardB, s.t < s.civ.guardNext ? L('Jednotky jsou nasazené.', 'Units are deployed.') : null);
  setSt(R.fema, L(`${s.civ.fema} volné týmy · polovina ztrát spadem`, `${s.civ.fema} teams free · halves fallout deaths`));
}

function chosenSets() { return R.sets.filter(r => r.i.checked).map(r => r.k); }
function chosenPlat() { const r = R.plats.find(r => r.i.checked); return r ? r.k : 'icbm'; }
function retaliation(s, x) {
  const code = $('#retCode').value;
  const req = [[s.defcon === 1, 'DEFCON 1'], [!!s.leader, s.leader === 'vp' ? L('Velí viceprezident', 'The Vice President is in command') : L('Prezident dostupný', 'President available')], [code.trim().toUpperCase() === s.code, L('Platný autentizační kód', 'Valid authentication code')]];
  $('#retReq').innerHTML = req.map(([y, t]) => ok(y, t)).join('');
  for (const r of R.plats) {
    const cap = x.capacity(r.k);
    r.sm.textContent = `${ds(D.PLATFORMS[r.k])} ${L('K dispozici', 'Available:')} ${cap} ${L('hlavic', 'warheads')}.`;
    r.l.classList.toggle('off', cap === 0);
  }
  const sets = chosenSets(), p = chosenPlat(), pln = x.plan(sets, p);
  $('#preview').innerHTML = sets.length
    ? `<span>${L('Hlavic', 'Warheads')}</span><span>${pln.missiles} / ${x.capacity(p)}</span><span>${L('Dopad za', 'Impact in')}</span><span>${p === 'bomb' ? '~3 h' : fmtEta(pln.ft)}</span><span>${L('Odhad obětí v Rusku', 'Estimated deaths in Russia')}</span><span>${fmtM(pln.cas)}</span><span>${L('Eskalace', 'Escalation')}</span><span>+${pln.esc}</span><span>${L('Odstrašení', 'Deterrence')}</span><span>+${pln.cred}</span>`
    : `<span>${L('Vyberte cíle', 'Select targets')}</span><span>—</span>`;
  const why = x.strikeBlock(sets, p, code);
  setBtn($('#bStrike'), why);
  $('#strikeNote').textContent = why || L('Rozkaz je připraven. Po autorizaci ho nelze vzít zpět, kromě bombardérů.', 'The order is ready. Once authorised it cannot be undone, except for bombers.');
  const open = s.strikes.filter(g => g.p === 'bomb' && !g.applied && !g.recalled);
  $('#bombStat').textContent = open.length ? L(`${open.length} na cestě`, `${open.length} en route`) : L('Žádné', 'None');
  setBtn($('#bRecall'), open.length ? null : L('Žádné bombardéry nejsou na cestě.', 'No bombers are en route.'));
}

$('#bVerify').onclick = () => { X().verify(); refresh(); };
$('#bPrev').onclick = () => X().cycle(-1);
$('#bNext').onclick = () => X().cycle(1);
$('#bDefUp').onclick = () => { X().setDefcon(-1); refresh(); };
$('#bDefDown').onclick = () => { X().setDefcon(1); refresh(); };
$('#bSas').onclick = () => { $('#sasCode').textContent = S().code; $('#sasCode').hidden = false; $('#bSas').hidden = true; log(L('Obálka SAS rozlomena. Kód ověřují dva důstojníci.', 'SAS envelope broken. Two officers verify the code.'), 'warn'); };
$('#retCode').addEventListener('input', () => refresh());
$('#bStrike').onclick = () => {
  if (X().strike(chosenSets(), chosenPlat(), $('#retCode').value)) { $('#retCode').value = ''; R.sets.forEach(r => r.i.checked = false); }
  refresh();
};
$('#bRecall').onclick = () => { X().recallBombers(); refresh(); };

/* ---------- decision card ---------- */
function renderCard(e) {
  $('#cardTag').textContent = tx(e.tag) + ' · ' + fmtT(S().t);
  $('#cardTitle').textContent = tx(e.title);
  $('#cardText').textContent = typeof e.text === 'function' ? e.text(S()) : tx(e.text);
  const cl = $('#cardChoices'); cl.innerHTML = '';
  e.choices.forEach((c, i) => {
    const b = el('button', 'btn choice'); b.type = 'button'; b.innerHTML = '<span></span><small></small>';
    b.firstChild.textContent = tx(c.label); b.lastChild.textContent = tx(c.hint);
    b.onclick = () => X().choose(i);
    cl.append(b);
  });
}
function showCard(e) { renderCard(e); $('#cardOvl').hidden = false; $('#cardChoices').firstChild.focus(); }
function hideCard() { $('#cardOvl').hidden = true; }

/* ---------- scores ---------- */
const KEY = 'velin-cheyenne-scores';
function loadScores() { try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch (_) { return []; } }
function saveScore(entry) {
  const list = loadScores(); list.push(entry); list.sort((a, b) => b.score - a.score);
  try { localStorage.setItem(KEY, JSON.stringify(list.slice(0, 8))); } catch (_) {}
  return list.slice(0, 8);
}
function verdictName(e) { const v = X().VERDICTS[e.v]; return v ? tx(v[0]) : (e.verdict || ''); }
function scoreTable(list, mine) {
  if (!list.length) return '';
  return `<h3>${L('Nejlepší směny', 'Best shifts')}</h3><table class="scores"><thead><tr><th>${L('Skóre', 'Score')}</th><th>${L('Výsledek', 'Outcome')}</th><th>${L('Scénář', 'Scenario')}</th><th>${L('Obtížnost', 'Difficulty')}</th></tr></thead><tbody>${
    list.map(e => `<tr class="${e.id === mine ? 'me' : ''}"><td>${e.score}</td><td>${verdictName(e)}</td><td>${D.SCEN[e.scen] ? nm(D.SCEN[e.scen]) : ''}</td><td>${D.DIFF[e.diff] ? nm(D.DIFF[e.diff]) : ''}</td></tr>`).join('')}</tbody></table>`;
}

/* ---------- end screen ---------- */
let lastEnd = null;
function showEnd(r) {
  hideCard();
  const id = Date.now(), s = S();
  const list = saveScore({ id, score: r.score, v: r.v, scen: s.scenKey, diff: s.diffKey });
  lastEnd = { r, id, list };
  $('#ovl').hidden = false;
  renderEnd();
  $('#againBtn').focus();
}
function renderEnd() {
  if (!lastEnd) return;
  const { r, id, list } = lastEnd, s = S(), V = X().VERDICTS[r.v];
  const row = (k, v) => `<span>${k}</span><span>${v}</span>`;
  $('#brief').innerHTML = `
    <p class="eyebrow">${L('Hlášení po směně', 'After-action report')} · ${nm(D.SCEN[s.scenKey])} · ${nm(D.DIFF[s.diffKey])} · ${fmtT(s.t)}</p>
    <div class="verdict" style="color:${r.good ? 'var(--ok)' : 'var(--red)'}">${tx(V[0])}</div>
    <p>${tx(V[1])}${r.late ? ' ' + tx(X().LATE) : ''}</p>
    <div class="score">${L('Skóre', 'Score')} ${r.score}</div>
    <canvas class="chart" id="chart"></canvas>
    <div class="chart-key"><span><i style="background:var(--amber)"></i>${L('Eskalace', 'Escalation')}</span><span><i style="background:var(--cyan)"></i>${L('Odstrašení', 'Deterrence')}</span><span><i style="background:var(--ok)"></i>${L('Veřejný pořádek', 'Public order')}</span><span><i style="background:var(--red)"></i>${L('Ztráty USA (pravá osa)', 'US casualties (right axis)')}</span></div>
    <div class="report">
      ${row(L('Oběti v USA (odhad)', 'US deaths (estimate)'), fmtM(s.cas))}
      ${row(L('Oběti v Rusku (odhad)', 'Russian deaths (estimate)'), fmtM(s.enemyCas))}
      ${row(L('Skutečné hrozby / zničené', 'Real threats / destroyed'), `${s.stats.realLaunched} / ${s.stats.kills}`)}
      ${row(L('Dopady na území USA', 'Impacts on US soil'), s.stats.impacts)}
      ${row(L('Odpálené interceptory', 'Interceptors fired'), `${s.stats.fired} (${L('promarněno', 'wasted')} ${s.stats.wasted})`)}
      ${row(L('Odhalené falešné kontakty', 'False contacts exposed'), s.stats.falseSeen)}
      ${row(L('Americké jaderné údery', 'American nuclear strikes'), s.stats.strikes)}
      ${row(L('Dohody přes horkou linku', 'Hotline agreements'), L(`${s.hot.ok} z ${s.hot.tries} hovorů`, `${s.hot.ok} of ${s.hot.tries} calls`))}
      ${row(L('Konečná eskalace / odstrašení', 'Final escalation / deterrence'), `${Math.round(s.esc)} / ${Math.round(s.cred)}`)}
    </div>
    ${scoreTable(list, id)}
    <div class="row"><button class="btn primary" id="againBtn">${L('Nová směna', 'New shift')}</button><button class="btn" id="endLang">${G.lang === 'en' ? 'Čeština' : 'English'}</button></div>`;
  drawChart(s);
  $('#againBtn').onclick = () => { lastEnd = null; G.main.showStart(); };
  $('#endLang').onclick = () => G.main.toggleLang();
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
  const px = t => padL + (W - padL - padR) * t / tMax, Y = v => padT + (Ht - padT - padB) * (1 - v / 100), Yc = v => padT + (Ht - padT - padB) * (1 - v / casMax);
  c.font = '9px "IBM Plex Mono", monospace'; c.fillStyle = col('dim'); c.strokeStyle = col('line'); c.lineWidth = 1;
  for (const v of [0, 50, 100]) { c.beginPath(); c.moveTo(padL, Y(v)); c.lineTo(W - padR, Y(v)); c.stroke(); c.fillText(String(v), 4, Y(v) + 3); }
  c.textAlign = 'right'; c.fillText(fmtM(casMax), W - 2, padT + 8); c.fillText('0', W - 2, Y(0) + 3); c.textAlign = 'left';
  for (let m = 0; m <= tMax / 60; m += 15) c.fillText(m + ' min', px(m * 60) - 8, Ht - 4);
  const line = (key, color, yf) => { c.strokeStyle = color; c.lineWidth = 1.6; c.beginPath(); H.forEach((h, i) => { const xx = px(h.t), y = yf(h[key]); i ? c.lineTo(xx, y) : c.moveTo(xx, y); }); c.stroke(); };
  line('esc', col('amber'), Y); line('cred', col('cyan'), Y); line('order', col('ok'), Y); line('cas', col('red'), Yc);
}

// after a language switch: static labels, open card, end screen
function relang() {
  relabel();
  if (S() && S().modal) renderCard(S().modal);
  if (lastEnd) renderEnd();
  refresh();
}

G.ui = { log, build, refresh, showCard, hideCard, showEnd, showTab, loadScores, scoreTable, relang, endShown: () => !!lastEnd };
})();
