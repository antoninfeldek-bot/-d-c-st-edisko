'use strict';
// Start screen, language switch, main loop, keyboard.
(() => {
const { L, nm, ds } = G;
const D = G.DATA;
const $ = s => document.querySelector(s);
const GAME_PER_SEC = 10; // game seconds per real second at 1×

let choice = { scen: 'standard', diff: 'velitel' };
try { Object.assign(choice, JSON.parse(localStorage.getItem('velin-choice')) || {}); } catch (_) {}
if (!D.SCEN[choice.scen]) choice.scen = 'standard';
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
      b.onclick = () => { choice[key] = k; try { localStorage.setItem('velin-choice', JSON.stringify(choice)); } catch (_) {} showStart(); };
      el.append(b);
    }
  };
  opts('#scenOpts', D.SCEN, 'scen');
  opts('#diffOpts', D.DIFF, 'diff');
  document.querySelectorAll('#langOpts [data-lang]').forEach(b => {
    b.classList.toggle('on', b.dataset.lang === G.lang);
    b.setAttribute('aria-pressed', b.dataset.lang === G.lang);
    b.onclick = () => { setLang(b.dataset.lang); };
  });
  $('#scoresStart').innerHTML = G.ui.scoreTable(G.ui.loadScores());
  $('#startBtn').onclick = start;
  $('#ovl').hidden = false;
}

function scenLabel() {
  return G.S ? `${L('Scénář', 'Scenario')}: ${nm(D.SCEN[G.S.scenKey])} · ${nm(D.DIFF[G.S.diffKey])}` : 'NORAD · USNORTHCOM · STRATCOM';
}
function setLang(l) {
  G.i18n.setLang(l);
  $('#scenName').textContent = scenLabel();
  if (onStart) showStart();
  else G.ui.relang();
}
const toggleLang = () => setLang(G.lang === 'en' ? 'cs' : 'en');

function start() {
  onStart = false;
  G.audio.init();
  G.sim.newGame(choice.scen, choice.diff);
  G.ui.build();
  $('#scenName').textContent = scenLabel();
  G.sim.log(L('Převzali jste velení směny. Systémy včasné výstrahy v provozu.', 'You have taken command of the shift. Early-warning systems online.'), 'own');
  $('#ovl').hidden = true;
  G.ui.refresh();
}

$('#bPause').onclick = () => { const S = G.S; if (S && S.running) { S.paused = !S.paused; G.ui.refresh(); } };
document.querySelectorAll('.spd').forEach(b => b.onclick = () => { if (G.S) { G.S.speed = +b.dataset.s; G.ui.refresh(); } });
$('#bSound').onclick = () => { G.audio.on = !G.audio.on; G.ui.refresh(); };
$('#bLang').onclick = toggleLang;
$('#zIn').onclick = () => G.map.zoomAt(1.3);
$('#zOut').onclick = () => G.map.zoomAt(1 / 1.3);
$('#zReset').onclick = () => G.map.reset();
$('#zUS').onclick = () => G.map.focusUS();

document.addEventListener('keydown', e => {
  const S = G.S;
  if (!S || !S.running || S.modal || e.ctrlKey || e.metaKey || e.altKey) return;
  if (['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName)) return;
  const k = e.key.toLowerCase(), X = G.sim;
  if (k === ' ') { e.preventDefault(); S.paused = !S.paused; }
  else if (k === '1') S.speed = 1; else if (k === '2') S.speed = 3; else if (k === '3') S.speed = 6;
  else if (k === 'v') X.verify();
  else if (k === 'j') X.cycle(1); else if (k === 'k') X.cycle(-1);
  else if (k === 'g') {
    const tr = X.selTrack();
    const best = X.SHOOTERS.filter(s => !X.shooterCheck(s.key, tr, 1)).sort((a, b) => X.pk(b.key, 1) - X.pk(a.key, 1))[0];
    if (best) X.engage(best.key, 1);
  }
  else return;
  G.ui.refresh();
});

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000); last = now;
  const S = G.S;
  if (S && S.running && !S.paused && !S.ended && !S.modal) G.sim.update(dt * GAME_PER_SEC * S.speed);
  G.map.draw(now);
  if (S) G.ui.refresh(false);
  requestAnimationFrame(frame);
}

G.main = { showStart, start, setLang, toggleLang };
G.i18n.apply();
showStart();
requestAnimationFrame(frame);
})();
