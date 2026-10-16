'use strict';
// DOM rendering. Panels are rebuilt as HTML strings and swapped only when they change;
// clicks are handled by one delegated listener (data-act, data-view, data-resp).
(() => {
const { L, tx, nm, ds, pl } = G;
const D = G.DATA;
const $ = s => document.querySelector(s);
const X = () => G.sim;
const S = () => G.S;
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const r0 = v => Math.round(v);
const pct = p => Math.round(p * 100) + (G.lang === 'en' ? '%' : ' %');
let autoPause = true;

/* ---------- time ---------- */
const START_HOUR = 3;
function clock(h) { const t = START_HOUR + h, d = Math.floor(t / 24) + 1, hh = Math.floor(t % 24), mm = Math.floor((t % 1) * 60); return { d, hm: `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}` }; }
const stamp = h => { const c = clock(h); return `${L('D', 'D')}${c.d} ${c.hm}`; };
function left(hrs) { if (hrs <= 0) return '0 min'; const h = Math.floor(hrs), m = Math.floor((hrs - h) * 60); return h ? `${h} h ${m} min` : `${m} min`; }

/* ---------- log ---------- */
const logEl = $('#log');
function log(msg, lvl = 'info') {
  const li = document.createElement('li'); li.className = lvl;
  const tm = document.createElement('time'); tm.textContent = S() ? stamp(S().h) : '';
  const sp = document.createElement('span'); sp.textContent = msg;
  li.append(tm, sp); logEl.prepend(li);
  while (logEl.children.length > 200) logEl.lastChild.remove();
}

/* ---------- helpers ---------- */
function stance(k) {
  const c = S().c[k];
  if (c.side === 'c') return ['c-coal', L('Koalice', 'Coalition')];
  if (c.side === 'b') return ['c-bloc', L('Blok soupeře', 'Rival bloc')];
  const a = c.rel - c.relR;
  if (a > 30) return ['c-lean', L('Nakloněný USA', 'Leans US')];
  if (a < -30) return ['c-leanr', L('Kloní se k soupeři', 'Leans rival')];
  return ['c-neut', L('Neutrální', 'Neutral')];
}
function rbar(v) { const w = Math.min(50, Math.abs(v) / 2); return `<div class="rbar"><i class="${v >= 0 ? 'p' : 'n'}" style="width:${w}%"></i></div>`; }
function kv(label, val, bar) { return `<div class="kv"><span>${esc(label)} <b>${esc(val)}</b></span>${bar || ''}</div>`; }
function meterBar(v, col, mark) { return `<div class="bar"><i style="width:${Math.max(0, Math.min(100, v))}%;background:${col}"></i>${mark != null ? `<span class="mk" style="left:${mark}%"></span>` : ''}</div>`; }
function actBtn(a, k, x, label, hint, cost, cls = '') {
  const why = X().block(a, k, x);
  return `<button class="act ${cls}" data-act="${a}"${k ? ` data-k="${k}"` : ''}${x ? ` data-x="${x}"` : ''}${why ? ' disabled' : ''}>`
    + `<b>${esc(label)}</b><span class="cost">${cost ? cost + ' ' + L('kap.', 'cap.') : ''}</span><small>${esc(hint)}</small>${why ? `<small class="why">${esc(why)}</small>` : ''}</button>`;
}
const KIND = { demand: ['Požadavek', 'Demand'], offer: ['Nabídka', 'Offer'], rival: ['Soupeř', 'Rival'], crisis: ['Krize', 'Crisis'], script: ['Událost', 'Event'] };
function fromLabel(m) {
  if (m.ctx.c) return [D.COUNTRIES[m.ctx.c].code, X().cname(m.ctx.c)];
  if (m.tpl.kind === 'rival') return [D.COUNTRIES[S().rival].code, X().cname(S().rival)];
  if (m.tpl.kind === 'script') return ['USA', L('Bílý dům', 'White House')];
  return ['INTL', L('Svět', 'World')];
}

/* ---------- header ---------- */
function header(s) {
  const c = clock(s.h);
  $('#dayLbl').textContent = `${L('Den', 'Day')} ${c.d}`;
  $('#clock').textContent = c.hm;
  $('#hLeft').textContent = L(`zbývá ${Math.max(0, Math.ceil(X().END_H - s.h))} h`, `${Math.max(0, Math.ceil(X().END_H - s.h))} h left`);
  document.querySelectorAll('#defcon span').forEach(e => e.classList.toggle('on', +e.dataset.l === s.defcon));
  $('#pkVal').textContent = r0(s.pk);
  const M = [
    [L('Eskalace', 'Escalation'), s.esc, s.esc >= 70 ? 'var(--red)' : 'var(--amber)', 40],
    [L('Ochota soupeře', 'Rival’s will'), s.will, 'var(--violet)', 70],
    [L('Podpora doma', 'Support'), s.sup, 'var(--ok)'],
    [L('Prestiž', 'Prestige'), s.pres, 'var(--cyan)'],
    [L('Ekonomika', 'Economy'), s.eco, 'var(--fg)'],
  ];
  set('#meters', M.map(([l, v, col, mk]) => `<div class="meter"><label>${esc(l)} <b>${r0(v)}</b></label>${meterBar(v, col, mk)}</div>`).join(''));
  $('#bPause').textContent = s.paused ? L('Pokračovat', 'Resume') : L('Pauza', 'Pause');
  $('#bPause').classList.toggle('on', s.paused);
  $('#bAuto').textContent = L('Auto-pauza', 'Auto-pause') + ': ' + (autoPause ? L('zap', 'on') : L('vyp', 'off'));
  $('#bAuto').classList.toggle('on', autoPause);
  $('#bSound').textContent = (G.lang === 'en' ? 'Sound: ' : 'Zvuk: ') + (G.audio.on ? L('zap', 'on') : L('vyp', 'off'));
  document.querySelectorAll('.spd').forEach(b => b.classList.toggle('on', +b.dataset.s === s.speed));
}

const cache = {};
function set(sel, html) { if (cache[sel] === html) return false; cache[sel] = html; $(sel).innerHTML = html; return true; }

/* ---------- inbox ---------- */
function inbox(s) {
  const list = [...s.inbox].sort((a, b) => (b.tpl.urgent ? 1 : 0) - (a.tpl.urgent ? 1 : 0) || (a.dl ?? 1e9) - (b.dl ?? 1e9));
  $('#inboxCount').textContent = list.length ? String(list.length) : '';
  set('#inbox', list.length ? list.map(m => {
    const [code, from] = fromLabel(m);
    return `<button class="msg k-${m.tpl.kind}${s.view === 'msg:' + m.uid ? ' sel' : ''}" data-view="msg:${m.uid}">`
      + `<span class="from">${esc(code)}</span><span class="tt">${esc(X().fill(m.tpl.title, m.ctx))}</span><span class="dl"${m.dl != null ? ` data-dl="${m.dl}"` : ''}>${m.dl == null ? '—' : ''}</span>`
      + `<span class="kd">${esc(tx(KIND[m.tpl.kind]))} · ${esc(from)}</span></button>`;
  }).join('') : `<div class="empty">${esc(L('Žádné nevyřízené depeše. Další přijdou samy.', 'No pending cables. More will arrive on their own.'))}</div>`);
}

/* ---------- world list ---------- */
function world(s) {
  const x = X(), R = s.rival;
  const row = k => {
    const c = s.c[k], v = r0(c.rel), [cls, st] = stance(k);
    return `<button class="cty${s.view === 'country:' + k ? ' sel' : ''}" data-view="country:${k}"><span class="cd">${D.COUNTRIES[k].code}</span>`
      + `<span class="nm">${esc(x.cname(k))}${x.pendingFrom(k) ? '<span class="dot" title="' + esc(L('Čeká depeše', 'Cable waiting')) + '"></span>' : ''}</span>`
      + `<span class="rv ${cls}">${v > 0 ? '+' : ''}${v}</span>${rbar(c.rel)}</button>`;
  };
  const groups = [
    [L('Koalice', 'Coalition'), x.keys().filter(k => s.c[k].side === 'c'), x.coalPower()],
    [L('Ostatní', 'Others'), x.keys().filter(k => s.c[k].side == null), null],
    [L('Blok soupeře', 'Rival bloc'), x.keys().filter(k => s.c[k].side === 'b'), x.blocPower()],
  ];
  const sortRel = arr => arr.sort((a, b) => s.c[b].rel - s.c[a].rel);
  let html = `<div class="grp"><span>${esc(L('Soupeř', 'Rival'))}</span></div>`
    + `<button class="cty rival${s.view === 'country:' + R ? ' sel' : ''}" data-view="country:${R}"><span class="cd">${D.COUNTRIES[R].code}</span><span class="nm">${esc(x.cname(R))}</span>`
    + `<span class="rv">${esc(L('ochota', 'will'))} ${r0(s.will)}</span>${meterBar(s.will, 'var(--violet)', 70).replace('class="bar"', 'class="bar" style="grid-column:1/-1;height:4px"')}</button>`;
  for (const [title, ks, pw] of groups) {
    if (!ks.length) continue;
    html += `<div class="grp"><span>${esc(title)}</span>${pw != null ? `<span>${esc(L('síla', 'power'))} ${r0(pw)}</span>` : ''}</div>` + sortRel(ks).map(row).join('');
  }
  set('#world', html);
}

/* ---------- center ---------- */
function center(s) {
  const v = s.view || 'overview';
  let html;
  if (v.startsWith('msg:')) html = msgView(s, +v.slice(4));
  else if (v.startsWith('country:')) html = v.slice(8) === s.rival ? rivalView(s) : countryView(s, v.slice(8));
  if (!html) { s.view = 'overview'; html = overview(s); }
  if (set('#center', html) && cache.view !== v) { cache.view = v; $('#center').scrollTop = 0; }
}

function overview(s) {
  const x = X(), cp = x.coalPower(), bp = x.blocPower();
  const neutral = x.keys().filter(k => s.c[k].side == null).reduce((a, k) => a + D.COUNTRIES[k].pw, 0);
  const tot = cp + bp + neutral, dt = x.deterrence();
  const dLabel = dt >= 1.3 ? L('silné', 'strong') : dt >= 1 ? L('vyrovnané', 'balanced') : L('slabé', 'weak');
  const req = (y, t) => `<span class="${y ? 'y' : 'n'}">${y ? '✓' : '○'} ${esc(t)}</span>`;
  const R = x.cname(s.rival), R2 = x.cname(s.rival, 'g');
  return `<div class="view">
    <p class="eyebrow">${esc(L('Situační přehled', 'Situation overview'))} · ${esc(nm(s.sc))}</p>
    <h1>${esc(L('Svět na hraně', 'A world on the brink'))}</h1>
    <p class="lead">${esc(ds(s.sc))}</p>
    <div class="sec"><h3>${esc(L('Rovnováha sil', 'Balance of power'))}</h3>
      <div class="balance"><div class="b1" style="flex:${cp}">${esc(L('Koalice', 'Coalition'))} ${r0(cp)}</div><div class="b2" style="flex:${neutral}">${esc(L('Neutrální', 'Neutral'))} ${neutral}</div><div class="b3" style="flex:${bp}">${esc(L('Blok', 'Bloc'))} ${bp}</div></div>
      <p class="note">${esc(L(`Odstrašení je ${dLabel} (${dt.toFixed(2).replace('.', ',')}). Nad 1,3 tlačí na soupeře k jednání a umožní tvrdé podmínky na konferenci. Pod 1 eskalace sama roste.`, `Deterrence is ${dLabel} (${dt.toFixed(2)}). Above 1.3 it pushes the rival to talk and allows hard terms at a conference. Below 1 escalation rises on its own.`))}</p>
    </div>
    <div class="sec"><h3>${esc(L('Cesta k míru', 'Road to peace'))}</h3>
      <div class="req">${req(s.will >= 70, L(`Ochota ${R2} jednat aspoň 70 (nyní ${r0(s.will)})`, `${R}’s will to talk at least 70 (now ${r0(s.will)})`))}${req(s.esc < 40, L(`Eskalace pod 40 (nyní ${r0(s.esc)})`, `Escalation below 40 (now ${r0(s.esc)})`))}${req(s.talks >= 2, L(`Dva kroky k míru (${s.talks}/2)`, `Two steps towards peace (${s.talks}/2)`))}</div>
      <p class="note">${esc(L('Kroky k míru získáte přes horkou linku (příměří), tajný kanál soupeře nebo jeho návrhy výměny.', 'Steps towards peace come from the hotline (ceasefire), the rival’s back channel or its trade-off proposals.'))}</p>
    </div>
    <div class="sec"><h3>${esc(L('Domácí scéna', 'Home front'))}</h3><div class="acts">
      ${actBtn('speech', null, null, L('Projev k národu', 'Address the nation'), L('Podpora +8', 'Support +8'), x.COST.speech)}
      ${actBtn('congress', null, null, L('Briefing Kongresu', 'Brief Congress'), L('Podpora +4', 'Support +4'), x.COST.congress)}
      ${actBtn('pressconf', null, null, L('Tisková konference', 'Press conference'), L('Prestiž +3 · Podpora +2', 'Prestige +3 · Support +2'), x.COST.pressconf)}
      ${actBtn('reserves', null, null, L('Uvolnit ropné rezervy', 'Release oil reserves'), L('Ekonomika +6', 'Economy +6'), x.COST.reserves)}
    </div></div>
    <div class="sec"><h3>${esc(L('Vojenská opatření', 'Military measures'))}</h3><div class="acts">
      ${actBtn('defUp', null, null, L('Zvýšit DEFCON', 'Raise DEFCON'), L('Odstrašení, eskalace +5, podpora +2', 'Deterrence, escalation +5, support +2'), 0)}
      ${actBtn('defDown', null, null, L('Snížit DEFCON', 'Lower DEFCON'), L('Eskalace −4, podpora −2, jestřábi nespokojeni', 'Escalation −4, support −2, hawks unhappy'), 0)}
      ${actBtn('fleet', null, null, L('Vyslat letadlové lodě', 'Send the carriers'), L('Odstrašení +6 na 12 h · Eskalace +4', 'Deterrence +6 for 12 h · Escalation +4'), x.COST.fleet)}
      ${actBtn('cyber', null, null, L('Kybernetická operace', 'Cyber operation'), L('50 %: ochota +6 · 25 %: odhalení, eskalace +8', '50%: will +6 · 25%: exposed, escalation +8'), x.COST.cyber)}
      ${actBtn('strike', null, null, L('Omezený konvenční úder', 'Limited conventional strike'), L('Eskalace +20 · při silném odstrašení ochota +10, jinak −10', 'Escalation +20 · with strong deterrence will +10, otherwise −10'), x.COST.strike, 'danger')}
    </div></div>
  </div>`;
}

function countryView(s, k) {
  const x = X(), c = s.c[k], cd = D.COUNTRIES[k]; if (!c) return null;
  const [cls, st] = stance(k), pers = D.PERS[cd.pers];
  const pending = s.inbox.find(m => m.ctx.c === k && m.tpl.kind !== 'rival');
  const R = x.cname(s.rival);
  const interests = c.known
    ? `<div class="interests">${Object.entries(cd.w).sort((a, b) => b[1] - a[1]).map(([i, w]) => `<span>${esc(tx(D.INTERESTS[i]))}</span>${meterBar(w * 100 / .7, 'var(--cyan)')}<span>${w >= .4 ? '●●●' : w >= .2 ? '●●' : w > 0 ? '●' : '–'}</span>`).join('')}</div>`
    : `<p class="note">${esc(L('Zájmy neznáte. Zavolejte, abyste zjistili, co tento stát chce.', 'You don’t know its interests. Call to find out what this country wants.'))}</p>`;
  const offers = Object.entries(D.OFFERS).map(([o, of]) => {
    const val = x.offerValue(k, o), n = c.offers[o] || 0;
    const eff = c.known ? (val >= .45 ? L('účinnost vysoká', 'high impact') : val >= .2 ? L('účinnost střední', 'medium impact') : L('účinnost nízká', 'low impact')) : L('účinnost neznámá', 'impact unknown');
    const extra = [eff]; const fe = x.choiceHint({ eff: of.eff }, { ctx: { c: k } }); if (of.eff) extra.push(fe);
    if (n) extra.push(L(`opakování slábne (${n}×)`, `diminishing (${n}×)`));
    return actBtn('offer', k, o, tx(of.n), extra.join(' · '), of.cost);
  }).join('');
  return `<div class="view">
    <p class="eyebrow">${esc(cd.code)} · ${esc(L('Dosiér', 'Dossier'))}</p>
    <h1>${esc(x.cname(k))}</h1>
    <div class="chips"><span class="chip ${cls}">${esc(st)}</span><span class="chip c-neut">${esc(L('síla', 'power'))} ${cd.pw}</span>${cd.nuke ? `<span class="chip c-leanr">${esc(L('jaderná mocnost', 'nuclear power'))}</span>` : ''}<span class="chip c-neut">${esc(tx(pers[0]))}</span></div>
    <p class="note">${esc(tx(pers[1]))}</p>
    ${pending ? `<button class="act" data-view="msg:${pending.uid}"><b>${esc(L('Čeká depeše', 'Cable waiting'))}: ${esc(x.fill(pending.tpl.title, pending.ctx))}</b><span class="cost"></span><small>${esc(L('Otevřít a odpovědět', 'Open and reply'))}</small></button>` : ''}
    <div class="kvs">${kv(L('Vztah k USA', 'Relation to US'), r0(c.rel), rbar(c.rel))}${kv(L('Vztah k soupeři', 'Relation to rival') + ` (${R})`, r0(c.relR), rbar(c.relR))}${kv(L('Důvěra', 'Trust'), r0(c.trust), meterBar(c.trust, 'var(--cyan)'))}</div>
    <div class="sec"><h3>${esc(L('Zájmy', 'Interests'))}</h3>${interests}</div>
    <div class="sec"><h3>${esc(L('Diplomacie', 'Diplomacy'))}</h3><div class="acts">
      ${actBtn('call', k, null, L('Rozhovor', 'Phone call'), L('Odhalí zájmy · vztah +3 a víc', 'Reveals interests · relation +3 or more'), x.COST.call)}
      ${actBtn('ally', k, null, L('Navrhnout alianci', 'Propose an alliance'), L(`Šance ${pct(x.allyChance(k))} · při úspěchu eskalace +3, ochota +4`, `Chance ${pct(x.allyChance(k))} · on success escalation +3, will +4`), x.COST.ally)}
      ${actBtn('press', k, null, L('Nátlak', 'Apply pressure'), c.side === 'b' || c.relR > c.rel ? L('Může odtrhnout od soupeře · prestiž −2', 'May pull it away from the rival · prestige −2') : L('Na spřáteleném státu poškodí vztahy', 'Damages relations with a friendly country'), x.COST.press)}
    </div></div>
    <div class="sec"><h3>${esc(L('Nabídky', 'Offers'))}</h3><div class="acts">${offers}</div></div>
    <div class="sec"><h3>${esc(L('Požádat', 'Ask'))}</h3><div class="acts">
      ${actBtn('sanctions', k, null, L('Sankce proti soupeři', 'Sanctions on the rival'), L(`Tlak na soupeře, ochota +${(cd.pw * .6).toFixed(1).replace('.', G.lang === 'en' ? '.' : ',')} · vztah −${r0(cd.w.eco * 12)}`, `Pressure on the rival, will +${(cd.pw * .6).toFixed(1)} · relation −${r0(cd.w.eco * 12)}`), x.COST.sanctions)}
      ${actBtn('mediate', k, null, L('Zprostředkovat jednání', 'Mediate talks'), L(`Šance ${pct(Math.max(.1, Math.min(.85, (c.rel + c.relR) / 150)))} · eskalace −8, ochota +8`, `Chance ${pct(Math.max(.1, Math.min(.85, (c.rel + c.relR) / 150)))} · escalation −8, will +8`), x.COST.mediate)}
      ${actBtn('deploy', k, null, L('Nasadit síly', 'Deploy forces'), L(`Odstrašení +${cd.pw} na 12 h · eskalace +2`, `Deterrence +${cd.pw} for 12 h · escalation +2`), x.COST.deploy)}
    </div></div>
  </div>`;
}

function rivalView(s) {
  const x = X(), R = s.rival, cd = D.COUNTRIES[R];
  const pCease = Math.max(.05, Math.min(.85, .15 + s.will / 120 - s.esc / 250));
  const blocList = x.bloc().map(k => x.cname(k)).join(', ') || L('nikdo', 'none');
  return `<div class="view">
    <p class="eyebrow">${esc(cd.code)} · ${esc(L('Soupeř', 'Rival'))}</p>
    <h1>${esc(x.cname(R))}</h1>
    <div class="chips"><span class="chip c-bloc">${esc(L('Soupeř', 'Rival'))}</span><span class="chip c-neut">${esc(L('síla', 'power'))} ${cd.pw}</span><span class="chip c-leanr">${esc(L('jaderná mocnost', 'nuclear power'))}</span></div>
    <div class="kvs">${kv(L('Ochota jednat', 'Will to talk'), r0(s.will), meterBar(s.will, 'var(--violet)', 70))}${kv(L('Eskalace', 'Escalation'), r0(s.esc), meterBar(s.esc, 'var(--red)', 40))}${kv(L('Kroky k míru', 'Steps to peace'), `${s.talks}/2`, meterBar(Math.min(100, s.talks * 50), 'var(--ok)'))}${kv(L('Tlak sankcí', 'Sanctions pressure'), r0(s.pressure))}</div>
    <p class="note">${esc(L(`Blok soupeře: ${blocList}.`, `Rival bloc: ${blocList}.`))}</p>
    <div class="sec"><h3>${esc(L('Horká linka', 'Hotline'))}</h3><div class="acts">
      ${actBtn('ceasefire', null, null, L('Navrhnout příměří', 'Propose a ceasefire'), L(`Šance ${pct(pCease)} · eskalace −10, ochota +6, krok k míru`, `Chance ${pct(pCease)} · escalation −10, will +6, a step to peace`), x.COST.ceasefire)}
      ${actBtn('backchannel', null, null, L('Tajný kanál', 'Back channel'), L('Ochota +8 · 20 %: únik do tisku', 'Will +8 · 20%: leak to the press'), x.COST.backchannel)}
      ${actBtn('ultimatum', null, null, L('Ultimátum', 'Ultimatum'), L('Se silným odstrašením ochota +10, jinak eskalace +12', 'With strong deterrence will +10, otherwise escalation +12'), x.COST.ultimatum, 'danger')}
      ${actBtn('concession', null, null, L('Ústupek', 'Concession'), L('Eskalace −10, ochota +5 · podpora −7, jestřábi −5', 'Escalation −10, will +5 · support −7, hawks −5'), x.COST.concession)}
      ${actBtn('rsanctions', null, null, L('Americké sankce', 'US sanctions'), L('Tlak +5, ochota +4 · ekonomika −5, eskalace +3', 'Pressure +5, will +4 · economy −5, escalation +3'), x.COST.rsanctions)}
    </div><p class="note">${esc(L('Horká linka je dostupná jednou za 3 hodiny.', 'The hotline can be used once every 3 hours.'))}</p></div>
  </div>`;
}

function msgView(s, uid) {
  const x = X(), m = s.inbox.find(q => q.uid === uid); if (!m) return null;
  const [code, from] = fromLabel(m);
  const choices = m.tpl.choices.map((ch, i) => {
    const why = x.choiceBlock(ch, m);
    return `<button class="act" data-resp="${m.uid}:${i}"${why ? ' disabled' : ''}><b>${esc(tx(ch.l))}</b><span class="cost">${ch.cost ? ch.cost + ' ' + L('kap.', 'cap.') : ''}</span><small>${esc(x.choiceHint(ch, m))}</small>${why ? `<small class="why">${esc(why)}</small>` : ''}${i === m.tpl.dflt && m.dl != null ? `<small>${esc(L('Výchozí volba po vypršení lhůty', 'Default when the deadline passes'))}</small>` : ''}</button>`;
  }).join('');
  return `<div class="view">
    <p class="eyebrow">${esc(tx(KIND[m.tpl.kind]))} · ${esc(code)} · ${esc(from)} · ${esc(stamp(m.t))}${m.dl != null ? ` · ${esc(L('lhůta', 'deadline'))} <span data-dl="${m.dl}"></span>` : ''}</p>
    <h1>${esc(x.fill(m.tpl.title, m.ctx))}</h1>
    <p class="lead">${esc(x.fill(m.tpl.text, m.ctx))}</p>
    <div class="choices">${choices}</div>
    ${m.ctx.c ? `<button class="linkbtn" data-view="country:${m.ctx.c}">${esc(L('Otevřít dosiér', 'Open dossier'))}: ${esc(x.cname(m.ctx.c))}</button>` : ''}
  </div>`;
}

/* ---------- refresh ---------- */
let lastAt = 0;
function refresh(force = true) {
  const s = S(); if (!s) return;
  const now = performance.now();
  if (!force && now - lastAt < 200) return; lastAt = now;
  header(s); inbox(s); world(s); center(s); timers(s);
}
function timers(s) {
  document.querySelectorAll('[data-dl]').forEach(e => {
    const r = +e.dataset.dl - s.h; e.textContent = left(r);
    const p = e.closest('.msg'); if (p) p.classList.toggle('hot', r < 2);
  });
}

document.addEventListener('click', e => {
  const t = e.target.closest('[data-act],[data-view],[data-resp]');
  if (!t || t.disabled || !S()) return;
  if (t.dataset.view) { S().view = t.dataset.view; refresh(true); }
  else if (t.dataset.resp) { const [u, i] = t.dataset.resp.split(':').map(Number); X().respond(u, i); }
  else if (t.dataset.act) X().act(t.dataset.act, t.dataset.k, t.dataset.x);
});

/* ---------- scores & end ---------- */
const KEY = 'krizovy-stab-scores';
function loadScores() { try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch (_) { return []; } }
function saveScore(entry) {
  const list = loadScores(); list.push(entry); list.sort((a, b) => b.score - a.score);
  try { localStorage.setItem(KEY, JSON.stringify(list.slice(0, 8))); } catch (_) {}
  return list.slice(0, 8);
}
function scoreTable(list, mine) {
  if (!list.length) return '';
  const V = X().VERDICTS;
  return `<h3>${esc(L('Nejlepší výsledky', 'Best results'))}</h3><table class="scores"><thead><tr><th>${esc(L('Skóre', 'Score'))}</th><th>${esc(L('Výsledek', 'Outcome'))}</th><th>${esc(L('Scénář', 'Scenario'))}</th><th>${esc(L('Obtížnost', 'Difficulty'))}</th></tr></thead><tbody>${
    list.map(e => `<tr class="${e.id === mine ? 'me' : ''}"><td>${e.score}</td><td>${esc(V[e.v] ? tx(V[e.v][0]) : '')}</td><td>${esc(D.SCEN[e.scen] ? nm(D.SCEN[e.scen]) : '')}</td><td>${esc(D.DIFF[e.diff] ? nm(D.DIFF[e.diff]) : '')}</td></tr>`).join('')}</tbody></table>`;
}
let lastEnd = null;
function showEnd(r) {
  const s = S(), id = Date.now();
  lastEnd = { r, id, list: saveScore({ id, score: r.score, v: r.v, scen: s.scenKey, diff: s.diffKey }) };
  $('#ovl').hidden = false;
  renderEnd();
  $('#againBtn').focus();
}
function renderEnd() {
  if (!lastEnd) return;
  const { r, id, list } = lastEnd, s = S(), x = X(), V = x.VERDICTS[r.v];
  const row = (k, v) => `<span>${esc(k)}</span><span>${esc(v)}</span>`;
  const names = arr => arr.length ? [...new Set(arr)].map(k => x.cname(k)).join(', ') : '—';
  $('#brief').innerHTML = `
    <p class="eyebrow">${esc(L('Závěrečná zpráva', 'Final report'))} · ${esc(nm(s.sc))} · ${esc(nm(s.df))} · ${esc(stamp(s.h))}</p>
    <div class="verdict" style="color:${r.good ? 'var(--ok)' : 'var(--red)'}">${esc(tx(V[0]))}</div>
    <p>${esc(tx(V[1]))}</p>
    <div class="score">${esc(L('Skóre', 'Score'))} ${r.score}</div>
    <canvas class="chart" id="chart"></canvas>
    <div class="chart-key"><span><i style="background:var(--amber)"></i>${esc(L('Eskalace', 'Escalation'))}</span><span><i style="background:var(--violet)"></i>${esc(L('Ochota soupeře', 'Rival’s will'))}</span><span><i style="background:var(--ok)"></i>${esc(L('Podpora doma', 'Support'))}</span><span><i style="background:var(--cyan)"></i>${esc(L('Prestiž', 'Prestige'))}</span></div>
    <div class="report">
      ${row(L('Délka krize', 'Crisis length'), `${r0(s.h)} h`)}
      ${row(L('Členové koalice na konci', 'Coalition at the end'), names(x.members()))}
      ${row(L('Přistoupili', 'Joined'), names(s.stats.joined))}
      ${row(L('Odešli', 'Left'), names(s.stats.left))}
      ${row(L('Blok soupeře', 'Rival bloc'), names(x.bloc()))}
      ${row(L('Nejvyšší eskalace', 'Peak escalation'), r0(s.maxEsc))}
      ${row(L('Podpora / prestiž / ekonomika', 'Support / prestige / economy'), `${r0(s.sup)} / ${r0(s.pres)} / ${r0(s.eco)}`)}
      ${row(L('Vyřízené / propadlé depeše', 'Cables answered / expired'), `${s.stats.answered} / ${s.stats.expired}`)}
      ${row(L('Nabídky / úspěšné aliance', 'Offers / alliances won'), `${s.stats.offers} / ${s.stats.alliances}`)}
    </div>
    ${scoreTable(list, id)}
    <div class="row"><button class="btn primary" id="againBtn">${esc(L('Nová krize', 'New crisis'))}</button><button class="btn" id="endLang">${G.lang === 'en' ? 'Čeština' : 'English'}</button></div>`;
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
  const W = r.width, Ht = r.height, padL = 28, padR = 10, padT = 8, padB = 18, hMax = Math.max(1, H[H.length - 1].h);
  const px = h => padL + (W - padL - padR) * h / hMax, py = v => padT + (Ht - padT - padB) * (1 - v / 100);
  c.font = '9px "IBM Plex Mono", monospace'; c.fillStyle = col('dim'); c.strokeStyle = col('line'); c.lineWidth = 1;
  for (const v of [0, 50, 100]) { c.beginPath(); c.moveTo(padL, py(v)); c.lineTo(W - padR, py(v)); c.stroke(); c.fillText(String(v), 4, py(v) + 3); }
  for (let h = 0; h <= hMax; h += 12) c.fillText(h + ' h', px(h) - 8, Ht - 4);
  const line = (key, color) => { c.strokeStyle = color; c.lineWidth = 1.6; c.beginPath(); H.forEach((p, i) => { const xx = px(p.h), y = py(p[key]); i ? c.lineTo(xx, y) : c.moveTo(xx, y); }); c.stroke(); };
  line('esc', col('amber')); line('will', col('violet')); line('sup', col('ok')); line('pres', col('cyan'));
}

function reset() { for (const k of Object.keys(cache)) delete cache[k]; logEl.innerHTML = ''; }
function relang() { for (const k of Object.keys(cache)) delete cache[k]; if (lastEnd) renderEnd(); refresh(true); }

G.ui = { log, refresh, showEnd, relang, reset, loadScores, scoreTable, autoPause: () => autoPause, toggleAuto: () => { autoPause = !autoPause; refresh(true); } };
})();
