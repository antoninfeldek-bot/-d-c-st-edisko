'use strict';
// Small synthesized sound effects. Audio starts only after the player clicks "Převzít velení".
(() => {
  let AC = null;
  const A = G.audio = { on: true };
  A.init = () => {
    try { AC = AC || new (window.AudioContext || window.webkitAudioContext)(); AC.resume(); } catch (_) { AC = null; }
  };
  function tone(f, d, type = 'square', v = 0.04, delay = 0) {
    if (!AC || !A.on) return;
    const t = AC.currentTime + delay, o = AC.createOscillator(), g = AC.createGain();
    o.type = type; o.frequency.value = f;
    g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(g).connect(AC.destination); o.start(t); o.stop(t + d + 0.03);
  }
  A.alarm = () => { tone(880, .14); tone(660, .14, 'square', .04, .17); tone(880, .14, 'square', .04, .34); };
  A.thud = () => { tone(70, .9, 'sine', .18); tone(45, 1.2, 'triangle', .12); };
  A.blip = () => tone(1320, .06, 'sine', .05);
  A.hit = () => { tone(990, .1, 'sine', .06); tone(1480, .18, 'sine', .05, .1); };
  A.chime = () => { tone(523, .25, 'sine', .06); tone(659, .25, 'sine', .06, .25); tone(784, .4, 'sine', .06, .5); };
  A.card = () => { tone(440, .12, 'triangle', .06); tone(554, .2, 'triangle', .06, .14); };
})();
