'use strict';
// Simulation: world state, hourly dynamics, country and rival AI, inbox, player actions, effects, endings.
(() => {
const { L, tx, nm, pl, clamp, rand, pick } = G;
const D = G.DATA;
const END_H = 72;

let S = null;
const news = (m, l = 'info') => G.ui.log(m, l);
const sfx = n => G.audio[n] && G.audio[n]();
const C = k => D.COUNTRIES[k];
const keys = () => Object.keys(S.c);
const members = () => keys().filter(k => S.c[k].side === 'c');
const bloc = () => keys().filter(k => S.c[k].side === 'b');

/* ---------- names with Czech cases ---------- */
function cname(k, cs = 'n') { const c = C(k); return G.lang === 'en' ? c.en : (cs === 'n' ? c.n : c[cs]); }
function fill(t, ctx) {
  const s = tx(t), r = S.rival, c = ctx && ctx.c;
  return s.replace(/\{([CR])(\d?)\}/g, (_, who, n) => {
    const k = who === 'R' ? r : c; if (!k) return '';
    return cname(k, { '': 'n', 2: 'g', 3: 'd', 4: 'a', 7: 'i' }[n]);
  });
}

/* ---------- new game ---------- */
function newGame(scenKey, diffKey) {
  const sc = D.SCEN[scenKey], df = D.DIFF[diffKey];
  S = G.S = {
    h: 0, speed: 1, paused: false, running: true, ended: false,
    scenKey, diffKey, sc, df, rival: sc.rival,
    esc: sc.esc, will: sc.will, sup: sc.sup, pres: sc.pres, eco: sc.eco, pk: sc.pk, defcon: sc.defcon,
    talks: 0, pressure: 0, boosts: [], c: {},
    inbox: [], uid: 0, used: new Set(), lastHour: 0,
    nextRival: 3, nextCrisis: 5, lastThreat: -99, summitOpen: false,
    cd: {}, maxEsc: sc.esc, history: [], view: 'overview',
    stats: { offers: 0, alliances: 0, answered: 0, expired: 0, joined: [], left: [] },
  };
  for (const [k, v] of Object.entries(sc.init)) {
    S.c[k] = { rel: v[0], relR: v[1], rel0: v[0], relR0: v[1], side: v[2] || null, trust: 40, known: false, cd: {}, offers: {}, asked: {} };
  }
  record();
  queue(G.SCRIPT.open[scenKey], {});
}

/* ---------- derived ---------- */
function power(list) { return list.reduce((a, k) => a + C(k).pw, 0); }
function coalPower() { return D.US_POWER + power(members()) + S.boosts.reduce((a, b) => a + b.v, 0); }
function blocPower() { return C(S.rival).pw + power(bloc()); }
function deterrence() { return coalPower() / (2 * blocPower()) * (1 + (3 - S.defcon) * .06); }
const cdLeft = (key, obj = S.cd) => Math.max(0, (obj[key] || 0) - S.h);

/* ---------- effects ---------- */
function targets(t, ctx) {
  if (t === 'C') return ctx && ctx.c ? [ctx.c] : [];
  if (t === 'HAWKS') return keys().filter(k => C(k).pers === 'hawk' && S.c[k].side !== 'b');
  if (t === 'DOVES') return keys().filter(k => C(k).pers === 'dove');
  if (t === 'MEMBERS') return members();
  if (t === 'ALL') return keys().filter(k => S.c[k].side !== 'b');
  return S.c[t] ? [t] : [];
}
function relAdd(k, v) { const c = S.c[k]; c.rel = clamp(c.rel + v, -100, 100); }
function relRAdd(k, v) { const c = S.c[k]; c.relR = clamp(c.relR + v, -100, 100); }
function apply(eff, ctx = {}) {
  if (!eff) return;
  for (const [key, v] of Object.entries(eff)) {
    if (key === 'esc') S.esc = clamp(S.esc + v, 0, 100);
    else if (key === 'will') S.will = clamp(S.will + v, 0, 100);
    else if (key === 'sup') S.sup = clamp(S.sup + v, 0, 100);
    else if (key === 'pres') S.pres = clamp(S.pres + v, 0, 100);
    else if (key === 'eco') S.eco = clamp(S.eco + v, 0, 100);
    else if (key === 'pk') S.pk = clamp(S.pk + v, 0, 100);
    else if (key === 'defcon') S.defcon = clamp(S.defcon + v, 1, 5);
    else if (key === 'talks') S.talks = Math.max(0, S.talks + v);
    else if (key === 'deter') S.boosts.push({ v: v === 'C' ? C(ctx.c).pw : v, until: S.h + 12 });
    else if (key === 'nodeter') S.boosts = [];
    else if (key === 'rel') for (const [t, d] of Object.entries(v)) for (const k of targets(t, ctx)) relAdd(k, d);
    else if (key === 'relR') for (const [t, d] of Object.entries(v)) for (const k of targets(t, ctx)) relRAdd(k, d);
    else if (key === 'join') join(ctx.c);
    else if (key === 'summitFail') { S.summitOpen = false; news(L('Konference zkrachovala. Delegace odjely bez dohody.', 'The conference has collapsed. The delegations left without a deal.'), 'crit'); }
    else if (key === 'end') S.pendingEnd = v;
  }
  S.maxEsc = Math.max(S.maxEsc, S.esc);
}
const EFF_LABEL = {
  esc: ['Eskalace', 'Escalation'], will: ['Ochota soupeře', 'Rival’s will'], sup: ['Podpora', 'Support'], pres: ['Prestiž', 'Prestige'],
  eco: ['Ekonomika', 'Economy'], pk: ['Kapitál', 'Capital'], talks: ['Krok k míru', 'Step to peace'],
};
function fmtEff(eff, ctx = {}) {
  if (!eff) return '';
  const out = [], sg = v => (v > 0 ? '+' : '−') + Math.abs(v);
  for (const [key, v] of Object.entries(eff)) {
    if (EFF_LABEL[key]) out.push(`${tx(EFF_LABEL[key])} ${sg(v)}`);
    else if (key === 'defcon') out.push(`DEFCON ${v < 0 ? L('zvýšen', 'raised') : L('snížen', 'lowered')}`);
    else if (key === 'deter') out.push(`${L('Odstrašení', 'Deterrence')} +${v === 'C' ? C(ctx.c).pw : v} (12 h)`);
    else if (key === 'nodeter') out.push(L('Posily odstrašení zrušeny', 'Deterrence boosts withdrawn'));
    else if (key === 'join') out.push(L(`${cname(ctx.c)} vstoupí do koalice`, `${cname(ctx.c)} joins the coalition`));
    else if (key === 'end') out.push(L('Konec krize', 'End of the crisis'));
    else if (key === 'summitFail') continue;
    else if (key === 'rel' || key === 'relR') {
      for (const [t, d] of Object.entries(v)) {
        const who = t === 'C' ? cname(ctx.c) : t === 'HAWKS' ? L('jestřábi', 'hawks') : t === 'DOVES' ? L('holubice', 'doves') : t === 'MEMBERS' ? L('koalice', 'coalition') : t === 'ALL' ? L('všechny státy', 'all countries') : cname(t);
        out.push(key === 'rel' ? `${who} ${sg(d)}` : `${who}${L(' ke soupeři ', ' to rival ')}${sg(d)}`);
      }
    }
  }
  return out.join(' · ');
}
function choiceHint(ch, msg) {
  const ctx = msg.ctx, p = chance(ch, msg);
  const a = fmtEff(ch.eff, ctx) || L('Beze změny', 'No change');
  if (p == null) return a;
  return `${Math.round(p * 100)} ${L('%: ', '%: ')}${a} · ${L('jinak', 'otherwise')}: ${fmtEff(ch.fail, ctx) || L('beze změny', 'no change')}`;
}
function chance(ch, msg) {
  if (ch.p == null) return null;
  return typeof ch.p === 'function' ? ch.p(S, msg.ctx.c, G.sim) : ch.p;
}

/* ---------- coalition & bloc ---------- */
function join(k) {
  const c = S.c[k]; if (!c || c.side === 'c') return;
  c.side = 'c'; S.stats.joined.push(k);
  apply({ esc: 3, will: 4, pres: 3 });
  news(L(`${cname(k)} vstupuje do koalice.`, `${cname(k)} joins the coalition.`), 'ok'); sfx('chime');
}
function leave(k, why) {
  const c = S.c[k]; if (c.side !== 'c') return;
  c.side = null; S.stats.left.push(k);
  apply({ pres: -3, will: -3 });
  news(L(`${cname(k)} opouští koalici. ${why || ''}`, `${cname(k)} leaves the coalition. ${why || ''}`), 'crit');
}
function toBloc(k) {
  const c = S.c[k]; if (c.side === 'b') return;
  c.side = 'b';
  apply({ esc: 2, pres: -2 });
  news(L(`${cname(k)} se přidává k bloku ${cname(S.rival, 'g')}.`, `${cname(k)} joins the bloc of ${cname(S.rival)}.`), 'crit');
}

/* ---------- inbox ---------- */
function queue(tpl, ctx) {
  if (!tpl) return null;
  const m = { uid: ++S.uid, tpl, ctx: ctx || {}, t: S.h, dl: tpl.dl != null ? S.h + tpl.dl : null };
  S.inbox.push(m); S.used.add(tpl.id);
  if (tpl.urgent) { if (G.ui.autoPause() && !S.paused) { S.paused = true; S.autoPaused = true; } S.view = 'msg:' + m.uid; sfx('card'); }
  else sfx('blip');
  return m;
}
const pendingFrom = k => S.inbox.some(m => m.ctx.c === k && m.tpl.kind !== 'rival');
const pendingTpl = id => S.inbox.some(m => m.tpl.id === id);
function choiceBlock(ch, msg) {
  if (ch.cost && S.pk < ch.cost) return L(`Potřebujete ${ch.cost} kapitálu.`, `Requires ${ch.cost} capital.`);
  if (ch.req) { const r = ch.req(S, msg.ctx.c); if (r) return tx(r); }
  return null;
}
function respond(uid, i, auto) {
  const m = S.inbox.find(x => x.uid === uid); if (!m) return;
  const ch = m.tpl.choices[i];
  if (!auto && choiceBlock(ch, m)) return;
  S.inbox = S.inbox.filter(x => x !== m);
  if (ch.cost && !auto) S.pk -= ch.cost;
  const p = chance(ch, m);
  const ok = p == null || Math.random() < p;
  apply(ok ? ch.eff : ch.fail, m.ctx);
  if (ch.fn) ch.fn(S, G.sim, m.ctx);
  const title = fill(m.tpl.title, m.ctx), who = m.ctx.c ? cname(m.ctx.c) + ': ' : '';
  news(`${who}${title} → ${tx(ch.l)}${p != null ? (ok ? L(' (uspělo)', ' (succeeded)') : L(' (nevyšlo)', ' (failed)')) : ''}${auto ? L(' · lhůta vypršela', ' · deadline passed') : ''}`, auto ? 'warn' : ok ? 'own' : 'warn');
  if (auto) S.stats.expired++; else S.stats.answered++;
  if (S.view === 'msg:' + uid) S.view = m.ctx.c ? 'country:' + m.ctx.c : 'overview';
  // resume once the last urgent cable that paused the clock is answered
  if (S.autoPaused && !S.inbox.some(x => x.tpl.urgent)) { S.paused = false; S.autoPaused = false; }
  if (S.pendingEnd) { const e = S.pendingEnd; S.pendingEnd = null; endGame(e); }
  G.ui.refresh(true);
}

/* ---------- AI ---------- */
function countryMessages() {
  for (const k of keys()) {
    const c = S.c[k];
    if (c.side === 'b' || pendingFrom(k)) continue;
    if (Math.random() > .045 * S.df.msg) continue;
    const pool = G.COUNTRY_MSGS.filter(t => (!t.cond || t.cond(S, k)) && t.w(C(k)) > 0);
    if (!pool.length) continue;
    let r = Math.random() * pool.reduce((a, t) => a + t.w(C(k)), 0);
    const t = pool.find(t => (r -= t.w(C(k))) <= 0) || pool[0];
    queue(t, { c: k });
  }
}
function rivalAct() {
  const w = S.will, ag = S.sc.aggr * S.df.aggr;
  const opts = [
    ['mil', 3 * (1 - w / 100) * ag + .4], ['court', 2], ['prop', 1], ['cyber', .8],
    ['msg', 1 + w / 40], ['threat', S.esc >= 50 && S.h - S.lastThreat > 16 ? 1.2 * ag : 0],
  ];
  let r = Math.random() * opts.reduce((a, o) => a + o[1], 0);
  const act = (opts.find(o => (r -= o[1]) <= 0) || opts[0])[0];
  const R = cname(S.rival), R2 = cname(S.rival, 'g');
  if (act === 'mil') {
    const d = Math.round(rand(4, 8) * ag + 1); apply({ esc: d });
    news(L(`${R}: přesuny vojsk a bombardérů k hranicím. Eskalace +${d}.`, `${R}: troops and bombers moving to the border. Escalation +${d}.`), 'crit');
  } else if (act === 'court') {
    const cand = keys().filter(k => S.c[k].side !== 'b' && C(k).pw < 9).sort((a, b) => (S.c[b].relR - S.c[b].rel) - (S.c[a].relR - S.c[a].rel))[0];
    if (!cand) return;
    relRAdd(cand, 10); relAdd(cand, -3);
    news(L(`Diplomaté ${R2} lákají zemi ${cname(cand)} lacinou energií a půjčkami.`, `${R} diplomats are courting ${cname(cand)} with cheap energy and loans.`), 'warn');
  } else if (act === 'prop') {
    if (!pendingTpl('r_prop')) queue(G.RIVAL_MSGS.find(t => t.id === 'r_prop'), {});
    else { apply({ sup: -3 }); news(L(`Propaganda ${R2} pokračuje. Podpora −3.`, `${R} propaganda continues. Support −3.`), 'warn'); }
  } else if (act === 'cyber') {
    apply({ eco: -4 });
    news(L('Kybernetický útok vyřadil platební systémy několika bank. Ekonomika −4.', 'A cyber attack has knocked out several banks’ payment systems. Economy −4.'), 'warn');
  } else if (act === 'msg') {
    const pool = G.RIVAL_MSGS.filter(t => !t.urgent && t.id !== 'r_prop' && !pendingTpl(t.id) && (!t.cond || t.cond(S)));
    if (!pool.length) return;
    const t = pick(pool), ctx = {};
    if (t.target === 'member') ctx.c = members().sort((a, b) => C(b).w.sec - C(a).w.sec)[0];
    queue(t, ctx);
  } else if (act === 'threat') {
    S.lastThreat = S.h; queue(G.RIVAL_MSGS.find(t => t.id === 'r_nuke'), {});
  }
}
function crisis() {
  const pool = G.CRISES.filter(t => (t.repeat || !S.used.has(t.id)) && !pendingTpl(t.id) && (!t.cond || t.cond(S)) && t.id !== 'c_brink');
  if (pool.length) queue(pick(pool), {});
}
function unVote() {
  let yes = 0, no = 0;
  for (const k of keys()) {
    const c = S.c[k];
    if (c.side === 'c' || c.rel >= 25) yes += C(k).pw;
    else if (c.side === 'b' || c.relR > c.rel + 20) no += C(k).pw;
  }
  yes += D.US_POWER; no += C(S.rival).pw;
  if (yes > no) {
    apply({ pres: 10, will: 8, sup: 4 });
    news(L(`OSN: rezoluce přijata (${yes}:${no} podle váhy států). Prestiž +10, ochota soupeře +8.`, `UN: resolution passed (${yes}:${no} by weight). Prestige +10, rival’s will +8.`), 'ok'); sfx('chime');
  } else {
    apply({ pres: -8, will: -3 });
    news(L(`OSN: rezoluce neprošla (${yes}:${no} podle váhy států). Prestiž −8.`, `UN: resolution failed (${yes}:${no} by weight). Prestige −8.`), 'crit');
  }
}

/* ---------- hourly tick ---------- */
function hourly() {
  const H = Math.round(S.h), Dt = deterrence(), ag = S.sc.aggr * S.df.aggr;
  S.boosts = S.boosts.filter(b => b.until > S.h);
  apply({
    esc: ag * .8 + (S.defcon <= 2 ? (3 - S.defcon) * .4 : 0) - clamp((Dt - 1) * 1.2, -.6, 1) + (S.sc.volatile ? rand(-1, 1.8) : 0),
    will: clamp((Dt - 1) * 1.5, -1, 1.5) + S.pressure * .04 - (S.esc > 85 ? 1 : 0),
    sup: (55 - S.sup) * .02 - (S.esc > 70 ? .3 : 0),
    pres: (50 - S.pres) * .01,
    eco: .25 - S.pressure * .03,
    pk: 3 * (.5 + S.sup / 100) * S.df.pk,
  });
  for (const k of keys()) {
    const c = S.c[k];
    c.rel += (c.rel0 - c.rel) * .01; c.relR += (c.relR0 - c.relR) * .01;
    if (C(k).pers === 'dove' && S.esc > 60) relAdd(k, -.6);
    if (c.side === 'c' && c.rel < 15) leave(k, L('Vztahy s Washingtonem se příliš zhoršily.', 'Relations with Washington have soured too far.'));
    else if (c.side == null && c.rel - c.relR < -45 && Math.random() < (C(k).pw >= 9 ? .08 : .25)) toBloc(k);
    else if (c.side === 'b' && c.rel - c.relR > 0) { c.side = null; news(L(`${cname(k)} opouští blok soupeře.`, `${cname(k)} leaves the rival’s bloc.`), 'ok'); }
  }
  countryMessages();
  if (S.h >= S.nextRival) { rivalAct(); S.nextRival = S.h + rand(4, 7) / Math.max(.6, ag); }
  if (S.h >= S.nextCrisis) { crisis(); S.nextCrisis = S.h + rand(5, 9); }
  if (S.esc >= 85 && !pendingTpl('c_brink') && Math.random() < .15) queue(G.CRISES.find(t => t.id === 'c_brink'), {});
  if (H === 18) queue(G.SCRIPT.unAnnounce, {});
  if (H === 24) unVote();
  if (!S.summitOpen && S.will >= 70 && S.esc < 40 && S.talks >= 2) { S.summitOpen = true; queue(G.SCRIPT.summit, {}); }
  record();
}
function record() { S.history.push({ h: S.h, esc: S.esc, will: S.will, sup: S.sup, pres: S.pres, eco: S.eco }); }

function update(dh) {
  S.h += dh;
  while (S.lastHour + 1 <= S.h) { S.lastHour++; hourly(); if (S.ended) return; if (checkEnd()) return; }
  for (const m of [...S.inbox]) if (m.dl != null && S.h >= m.dl) respond(m.uid, m.tpl.dflt, true);
  checkEnd();
}
function checkEnd() {
  if (S.ended) return true;
  if (S.esc >= 100) return endGame('war');
  if (S.sup <= 0) return endGame('impeach');
  if (S.pres <= 0) return endGame('isolation');
  if (S.eco <= 0) return endGame('collapse');
  if (S.h >= END_H) return endGame('timeout');
  return false;
}

/* ---------- player actions ---------- */
const COST = { call: 4, ally: 20, sanctions: 8, mediate: 10, deploy: 8, press: 8, ceasefire: 10, backchannel: 15, ultimatum: 10, concession: 12, rsanctions: 10, speech: 8, congress: 6, pressconf: 5, reserves: 8, fleet: 10, cyber: 8, strike: 20 };
const CD = { call: 4, offer: 3, ally: 8, mediate: 10, deploy: 12, press: 6, hot: 3, speech: 8, congress: 6, pressconf: 6, reserves: 12, fleet: 12, cyber: 10, strike: 24, defcon: 2 };

// returns a reason the action is unavailable, or null
function block(act, k, extra) {
  const cost = act === 'offer' ? D.OFFERS[extra].cost : COST[act];
  const c = k && S.c[k];
  if (S.ended) return L('Krize skončila.', 'The crisis is over.');
  const left = (n, o) => { const l = cdLeft(n, o); return l > 0 ? L(`Znovu za ${Math.ceil(l)} h.`, `Again in ${Math.ceil(l)} h.`) : null; };
  switch (act) {
    case 'call': return left('call', c.cd) || need(cost);
    case 'offer': {
      const o = D.OFFERS[extra];
      if (c.side === 'b') return L('Stát je v bloku soupeře.', 'The country is in the rival’s bloc.');
      if (o.minRel && c.rel < o.minRel) return L(`Vyžaduje vztah aspoň ${o.minRel}.`, `Requires relation ${o.minRel}+.`);
      return left('offer', c.cd) || need(cost);
    }
    case 'ally':
      if (c.side === 'c') return L('Už je v koalici.', 'Already in the coalition.');
      if (c.side === 'b') return L('Stát je v bloku soupeře.', 'The country is in the rival’s bloc.');
      if (c.rel < 35) return L('Vyžaduje vztah aspoň 35.', 'Requires relation 35+.');
      return left('ally', c.cd) || need(cost);
    case 'sanctions':
      if (c.side !== 'c') return L('Jen pro členy koalice.', 'Coalition members only.');
      if (c.asked.sanctions) return L('Už sankce zavedl.', 'Sanctions already imposed.');
      return need(cost);
    case 'mediate':
      if (c.rel < 20 || c.relR < 10) return L('Vyžaduje vztah k USA ≥ 20 a k soupeři ≥ 10.', 'Requires relation ≥ 20 with the US and ≥ 10 with the rival.');
      return left('mediate', c.cd) || need(cost);
    case 'deploy':
      if (c.side !== 'c') return L('Jen pro členy koalice.', 'Coalition members only.');
      return left('deploy', c.cd) || need(cost);
    case 'press': return left('press', c.cd) || need(cost);
    case 'ceasefire': case 'backchannel': case 'ultimatum': case 'concession': case 'rsanctions':
      return left('hot') || need(cost);
    case 'defUp': return S.defcon <= 1 ? L('Nejvyšší stupeň.', 'Highest level.') : left('defcon');
    case 'defDown': return S.defcon >= 5 ? L('Nejnižší stupeň.', 'Lowest level.') : left('defcon');
    default: return left(act) || need(cost);
  }
}
function need(cost) { return S.pk < cost ? L(`Potřebujete ${cost} kapitálu.`, `Requires ${cost} capital.`) : null; }
function spend(act, k, extra) { const cost = act === 'offer' ? D.OFFERS[extra].cost : COST[act] || 0; S.pk -= cost; }

function act(a, k, extra) {
  if (block(a, k, extra)) return;
  spend(a, k, extra);
  const c = k && S.c[k], R = cname(S.rival), R7 = cname(S.rival, 'i');
  const done = (m, l = 'own') => { news(m, l); sfx('blip'); };
  switch (a) {
    case 'call': {
      c.cd.call = S.h + CD.call; c.known = true; c.trust = clamp(c.trust + 3, 0, 100);
      relAdd(k, 3 + c.trust / 30);
      const top = Object.entries(C(k).w).sort((x, y) => y[1] - x[1])[0][0];
      done(L(`Rozhovor: ${cname(k)} nejvíc zajímá ${tx(D.INTERESTS[top]).toLowerCase()}. Vztah se zlepšil.`, `Call: ${cname(k)} cares most about ${tx(D.INTERESTS[top]).toLowerCase()}. Relations improved.`));
      break;
    }
    case 'offer': {
      const o = D.OFFERS[extra];
      c.cd.offer = S.h + CD.offer; S.stats.offers++;
      const val = Object.entries(o.w).reduce((s, [i, w]) => s + w * C(k).w[i], 0);
      const n = c.offers[extra] || 0; c.offers[extra] = n + 1;
      const gain = 22 * val * (1 + c.trust / 200) / (1 + n);
      relAdd(k, gain); relRAdd(k, -gain / 3); c.trust = clamp(c.trust + (o.trust || 2), 0, 100);
      apply(o.eff);
      const q = gain >= 10 ? L('s nadšením', 'enthusiastically') : gain >= 4 ? L('vlídně', 'warmly') : L('bez zájmu', 'without interest');
      done(L(`${tx(o.n)} pro ${cname(k, 'a')}: přijato ${q} (vztah +${Math.round(gain)}).`, `${tx(o.n)} for ${cname(k)}: received ${q} (relation +${Math.round(gain)}).`), gain >= 4 ? 'own' : 'warn');
      break;
    }
    case 'ally': {
      c.cd.ally = S.h + CD.ally;
      const p = allyChance(k);
      if (Math.random() < p) { S.stats.alliances++; join(k); }
      else { relAdd(k, -6); done(L(`${cname(k)} vstup do koalice zatím odmítá.`, `${cname(k)} declines to join the coalition for now.`), 'warn'); }
      break;
    }
    case 'sanctions': {
      c.asked.sanctions = true;
      relAdd(k, -C(k).w.eco * 12); S.pressure += C(k).pw; apply({ will: C(k).pw * .6, esc: 1 });
      done(L(`${cname(k)} zavádí sankce proti ${cname(S.rival, 'd')}. Tlak na soupeře roste.`, `${cname(k)} imposes sanctions on ${R}. Pressure on the rival grows.`));
      break;
    }
    case 'mediate': {
      c.cd.mediate = S.h + CD.mediate;
      const p = clamp((c.rel + c.relR) / 150, .1, .85);
      if (Math.random() < p) { apply({ esc: -8, will: 8 }); done(L(`${cname(k)} úspěšně zprostředkovalo kontakt s ${R7}. Eskalace −8, ochota +8.`, `${cname(k)} successfully mediated with ${R}. Escalation −8, will +8.`), 'ok'); }
      else { relAdd(k, -3); done(L(`Zprostředkování přes ${cname(k, 'a')} nevyšlo.`, `Mediation through ${cname(k)} failed.`), 'warn'); }
      break;
    }
    case 'deploy': {
      c.cd.deploy = S.h + CD.deploy; S.boosts.push({ v: C(k).pw, until: S.h + 12 }); apply({ esc: 2 });
      done(L(`${cname(k)} posílá síly na východní křídlo. Odstrašení +${C(k).pw} na 12 h.`, `${cname(k)} deploys forces to the front line. Deterrence +${C(k).pw} for 12 h.`));
      break;
    }
    case 'press': {
      c.cd.press = S.h + CD.press; apply({ pres: -2 });
      if (c.side === 'b' || c.relR > c.rel) {
        const p = clamp(.15 + C(k).w.eco * .5 + (C(k).pers === 'opp' ? .2 : 0) + (deterrence() > 1 ? .1 : 0), .05, .8);
        if (Math.random() < p) {
          relRAdd(k, -20); relAdd(k, -5);
          if (c.side === 'b') c.side = null;
          done(L(`Nátlak zabral: ${cname(k)} se distancuje od ${cname(S.rival, 'g')}.`, `Pressure worked: ${cname(k)} distances itself from ${R}.`), 'ok');
        } else { relAdd(k, -12); relRAdd(k, 5); done(L(`${cname(k)} se nátlaku nepodvolilo a zatvrdilo se.`, `${cname(k)} refused to bow to pressure and dug in.`), 'warn'); }
      } else { relAdd(k, -12); done(L(`Nátlak na spřátelenou zemi (${cname(k)}) poškodil vztahy.`, `Pressuring a friendly country (${cname(k)}) damaged relations.`), 'warn'); }
      break;
    }
    case 'ceasefire': {
      S.cd.hot = S.h + CD.hot;
      const p = clamp(.15 + S.will / 120 - S.esc / 250, .05, .85);
      if (Math.random() < p) { apply({ esc: -10, will: 6, talks: 1 }); done(L(`Horká linka: ${R} souhlasí s dílčím příměřím. Eskalace −10, krok k míru.`, `Hotline: ${R} agrees to a partial ceasefire. Escalation −10, a step towards peace.`), 'ok'); }
      else { apply({ esc: 2 }); done(L(`Horká linka: ${R} návrh příměří odmítá.`, `Hotline: ${R} rejects the ceasefire proposal.`), 'warn'); }
      break;
    }
    case 'backchannel': {
      S.cd.hot = S.h + CD.hot; apply({ will: 8 });
      if (Math.random() < .2) { apply({ sup: -8, pres: -3 }); done(L('Tajný kanál prozrazen novinářům. Podpora −8, prestiž −3.', 'The back channel leaked to the press. Support −8, prestige −3.'), 'warn'); }
      else done(L(`Tajný kanál s ${R7} funguje. Ochota jednat +8.`, `The back channel to ${R} works. Will to talk +8.`), 'ok');
      break;
    }
    case 'ultimatum': {
      S.cd.hot = S.h + CD.hot;
      if (deterrence() > 1.3 && S.defcon <= 3) { apply({ will: 10, esc: 4 }); done(L(`Ultimátum zabralo. ${R} bere hrozbu vážně. Ochota +10.`, `The ultimatum worked. ${R} takes the threat seriously. Will +10.`), 'ok'); }
      else { apply({ esc: 12, will: -5 }); done(L(`Ultimátum bez krytí: ${R} reaguje vzdorem. Eskalace +12.`, `An ultimatum without backing: ${R} responds with defiance. Escalation +12.`), 'crit'); }
      break;
    }
    case 'concession': {
      S.cd.hot = S.h + CD.hot; apply({ esc: -10, will: 5, sup: -7, rel: { HAWKS: -5 } });
      done(L('Ústupek: stažení části sil z regionu. Eskalace −10, podpora −7, jestřábi nespokojeni.', 'Concession: part of the forces withdrawn from the region. Escalation −10, support −7, hawks unhappy.'), 'warn');
      break;
    }
    case 'rsanctions': {
      S.cd.hot = S.h + CD.hot; S.pressure += 5; apply({ eco: -5, will: 4, esc: 3 });
      done(L(`Nové americké sankce proti ${cname(S.rival, 'd')}. Ekonomika −5, tlak roste.`, `New US sanctions on ${R}. Economy −5, pressure grows.`));
      break;
    }
    case 'speech': S.cd.speech = S.h + CD.speech; apply({ sup: 8 }); done(L('Projev k národu: podpora +8.', 'Address to the nation: support +8.'), 'ok'); break;
    case 'congress': S.cd.congress = S.h + CD.congress; apply({ sup: 4 }); done(L('Briefing Kongresu: podpora +4.', 'Congressional briefing: support +4.'), 'ok'); break;
    case 'pressconf': S.cd.pressconf = S.h + CD.pressconf; apply({ pres: 3, sup: 2 }); done(L('Tisková konference: prestiž +3, podpora +2.', 'Press conference: prestige +3, support +2.'), 'ok'); break;
    case 'reserves': S.cd.reserves = S.h + CD.reserves; apply({ eco: 6 }); done(L('Uvolněny strategické rezervy ropy: ekonomika +6.', 'Strategic oil reserves released: economy +6.'), 'ok'); break;
    case 'defUp': S.cd.defcon = S.h + CD.defcon; apply({ defcon: -1, esc: 5, sup: 2 }); done(L(`Vyhlášen DEFCON ${S.defcon}.`, `DEFCON ${S.defcon} declared.`), 'warn'); break;
    case 'defDown': S.cd.defcon = S.h + CD.defcon; apply({ defcon: 1, esc: -4, sup: -2, rel: { HAWKS: -2 } }); done(L(`Pohotovost snížena na DEFCON ${S.defcon}.`, `Readiness lowered to DEFCON ${S.defcon}.`)); break;
    case 'fleet': {
      S.cd.fleet = S.h + CD.fleet; S.boosts.push({ v: 6, until: S.h + 12 }); apply({ esc: 4 });
      for (const m of members()) if (C(m).w.sec >= .3) relAdd(m, 3);
      done(L('Letadlové lodě vyplouvají do regionu. Odstrašení +6 na 12 h, eskalace +4.', 'Carrier groups sail for the region. Deterrence +6 for 12 h, escalation +4.'), 'warn');
      break;
    }
    case 'cyber': {
      S.cd.cyber = S.h + CD.cyber; const r = Math.random();
      if (r < .5) { apply({ will: 6 }); done(L('Kybernetická operace narušila velení soupeře. Ochota jednat +6.', 'A cyber operation disrupted the rival’s command. Will to talk +6.'), 'ok'); }
      else if (r < .75) done(L('Kybernetická operace bez výsledku.', 'The cyber operation achieved nothing.'), 'info');
      else { apply({ esc: 8 }); done(L('Kybernetická operace odhalena. Eskalace +8.', 'The cyber operation was exposed. Escalation +8.'), 'crit'); }
      break;
    }
    case 'strike': {
      S.cd.strike = S.h + CD.strike; apply({ esc: 20, pres: -5, rel: { DOVES: -10 } });
      if (deterrence() > 1.3) { apply({ will: 10 }); done(L('Omezený konvenční úder zasáhl odpalovací zařízení. Soupeř couvá. Eskalace +20, ochota +10.', 'A limited conventional strike hit launch sites. The rival backs off. Escalation +20, will +10.'), 'crit'); }
      else { apply({ will: -10 }); done(L('Omezený úder bez dostatečného odstrašení: soupeř se zatvrdil. Eskalace +20, ochota −10.', 'A limited strike without enough deterrence: the rival hardens. Escalation +20, will −10.'), 'crit'); }
      break;
    }
  }
  checkEnd();
  G.ui.refresh(true);
}
function allyChance(k) {
  const c = S.c[k];
  return clamp(.25 + (c.rel - 35) / 60 + c.trust / 250 - (c.relR > 40 ? .3 : 0) - (C(k).pers === 'dove' && S.esc > 70 ? .2 : 0), .05, .95);
}
function offerValue(k, o) { return Object.entries(D.OFFERS[o].w).reduce((s, [i, w]) => s + w * C(k).w[i], 0); }

/* ---------- end ---------- */
const VERDICTS = {
  peace_strong: [['Vítězný mír', 'Peace Through Strength'], ['Soupeř přijal vaše podmínky. Koalice vydržela a odstrašení zafungovalo.', 'The rival accepted your terms. The coalition held and deterrence worked.']],
  peace: [['Mír v Ženevě', 'Peace in Geneva'], ['Kompromis ukončil krizi. Nikdo nevyhrál všechno, ale svět si oddechl.', 'A compromise ended the crisis. No one won everything, but the world breathed again.']],
  peace_weak: [['Mír za vysokou cenu', 'Peace at a High Price'], ['Mír platí, ale ústupky doma vnímají jako porážku.', 'Peace holds, but at home the concessions are seen as a defeat.']],
  timeout: [['Zamrzlý konflikt', 'Frozen Conflict'], ['Po 72 hodinách krize nepokračuje, ale ani nekončí. Začíná nová studená válka.', 'After 72 hours the crisis is neither escalating nor over. A new cold war begins.']],
  war: [['Jaderná válka', 'Nuclear War'], ['Eskalace překročila hranici, odkud není návratu.', 'Escalation crossed the point of no return.']],
  impeach: [['Ztráta důvěry', 'Loss of Confidence'], ['Podpora doma se zhroutila a administrativa musela odstoupit.', 'Support at home collapsed and the administration had to resign.']],
  isolation: [['Diplomatická izolace', 'Diplomatic Isolation'], ['Spojené státy ztratily prestiž i spojence.', 'The United States lost both its prestige and its allies.']],
  collapse: [['Hospodářský kolaps', 'Economic Collapse'], ['Ekonomika krizi neunesla.', 'The economy could not bear the crisis.']],
};
const GOOD = ['peace_strong', 'peace', 'peace_weak'];
function endGame(reason) {
  if (S.ended) return true;
  S.ended = true; S.running = false; record();
  const base = { peace_strong: 1000, peace: 800, peace_weak: 500, timeout: 300, war: -600 }[reason] ?? -300;
  const score = Math.max(0, Math.round((base + S.sup * 3 + S.pres * 3 + S.eco * 2 - S.maxEsc * 2 + members().length * 25) * S.df.score));
  G.ui.showEnd({ v: reason, good: GOOD.includes(reason), score });
  sfx(GOOD.includes(reason) ? 'chime' : 'thud');
  return true;
}

G.sim = {
  END_H, COST, VERDICTS, D,
  newGame, update, apply, act, block, respond, choiceBlock, choiceHint, fill, cname, cdLeft,
  deterrence, coalPower, blocPower, members, bloc, keys, allyChance, offerValue, pendingFrom, endGame,
};
})();
