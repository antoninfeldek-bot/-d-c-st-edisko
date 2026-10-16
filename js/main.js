'use strict';
// Start screen, language switch, main loop, keyboard.
(() => {
const { L, nm, ds } = G;
const D = G.DATA;
const $ = s => document.querySelector(s);
const HOURS_PER_SEC = 1 / 5; // one crisis hour every 5 seconds at 1×

let choice = { scen: 'baltic', diff: 'velitel' };
try { Object.assign(choice, JSON.parse(localStorage.getItem('krizovy-stab-choice')) || {}); } catch (_) {}
if (!D.SCEN[choice.scen]) choice.scen = 'baltic';
if (!D.DIFF[choice.diff]) choice.diff = 'velitel';

const startHTML = $('#brief').innerHTML;
let onStart = true;

function showStart() {
  onStart = true;
  $('#brief').innerHTML = startHTML;
  G.i18n.apply();
  const opts = (box, data, key) => {
    const el = $(box); el.innerHTML = '';
    for (const [k, v] of Object.entries(data)) {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'btn optcard' + (choice[key] === k ? ' on' : '');
      b.setAttribute('aria-pressed', choice[key] === k);
      b.innerHTML = '<b></b><small></small>'; b.firstChild.textContent = nm(v); b.lastChild.textContent = ds(v);
      b.onclick = () => { choice[key] = k; try { localStorage.setItem('krizovy-stab-choice', JSON.stringify(choice)); } catch (_) {} showStart(); };
      el.append(b);
    }
  };
  opts('#scenOpts', D.SCEN, 'scen');
  opts('#diffOpts', D.DIFF, 'diff');
  document.querySelectorAll('#langOpts [data-lang]').forEach(b => {
    b.classList.toggle('on', b.dataset.lang === G.lang);
    b.setAttribute('aria-pressed', b.dataset.lang === G.lang);
    b.onclick = () => setLang(b.dataset.lang);
  });
  $('#scoresStart').innerHTML = G.ui.scoreTable(G.ui.loadScores());
  $('#startBtn').onclick = start;
  $('#ovl').hidden = false;
}

function scenLabel() { return G.S ? `${nm(G.S.sc)} · ${nm(G.S.df)}` : 'Situation Room · Washington'; }
function setLang(l) {
  G.i18n.setLang(l);
  $('#scenName').textContent = scenLabel();
  if (onStart) showStart(); else G.ui.relang();
}
const toggleLang = () => setLang(G.lang === 'en' ? 'cs' : 'en');

function start() {
  onStart = false;
  G.audio.init();
  G.ui.reset();
  G.sim.newGame(choice.scen, choice.diff);
  $('#scenName').textContent = scenLabel();
  G.ui.log(L('Krizový štáb zasedá. Prezident vám svěřil řízení krize.', 'The Situation Room is in session. The President has put you in charge of the crisis.'), 'own');
  $('#ovl').hidden = true;
  G.ui.refresh(true);
}

$('#bPause').onclick = () => { const S = G.S; if (S && S.running) { S.paused = !S.paused; S.autoPaused = false; G.ui.refresh(true); } };
document.querySelectorAll('.spd').forEach(b => b.onclick = () => { if (G.S) { G.S.speed = +b.dataset.s; G.ui.refresh(true); } });
$('#bAuto').onclick = () => G.ui.toggleAuto();
$('#bSound').onclick = () => { G.audio.on = !G.audio.on; G.ui.refresh(true); };
$('#bLang').onclick = toggleLang;

document.addEventListener('keydown', e => {
  const S = G.S;
  if (!S || !S.running || onStart || e.ctrlKey || e.metaKey || e.altKey) return;
  if (['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName)) return;
  const k = e.key;
  if (k === ' ') { e.preventDefault(); S.paused = !S.paused; S.autoPaused = false; }
  else if (k === '1') S.speed = 1; else if (k === '2') S.speed = 2; else if (k === '3') S.speed = 4;
  else if (k === 'Escape') S.view = 'overview';
  else return;
  G.ui.refresh(true);
});

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.25, (now - last) / 1000); last = now;
  const S = G.S;
  if (S && S.running && !S.paused && !S.ended) G.sim.update(dt * HOURS_PER_SEC * S.speed);
  if (S) G.ui.refresh(false);
  requestAnimationFrame(frame);
}

G.main = { showStart, start, setLang, toggleLang };
G.i18n.apply();
showStart();
requestAnimationFrame(frame);
})();
