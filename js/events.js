'use strict';
// Decision cards. The game pauses while a card is open; each choice has consequences.
// cond(S, X) decides when a card may appear; forced cards appear as soon as cond holds.
(() => {
const { clamp, rand, pick, fmtEta } = G;
const D = G.DATA;
const log = (m, l) => G.ui.log(m, l);

G.EVENTS = [
  {
    id: 'low', forced: true, tag: 'STRATCOM · naléhavé',
    title: 'Použít, nebo ztratit',
    cond: (S, X) => S.hostile && S.tracks.some(t => X.active(t) && t.real && t.status === 'confirmed'
      && D.SILOS.includes(t.target) && !D.SITES[t.target].dead && X.eta(t) < 600),
    text: S => {
      const t = S.tracks.find(t => G.sim.active(t) && t.status === 'confirmed' && D.SILOS.includes(t.target));
      return `Potvrzené hlavice míří na raketová pole${t ? ` (${D.SITES[t.target].n}, dopad za ${fmtEta(G.sim.eta(t))})` : ''}. Velitel STRATCOM doporučuje odpálit rakety z ohrožených sil, než budou zničeny. Úder by mířil na ruská sila ICBM.`;
    },
    choices: [
      { label: 'Odpálit z ohrožených sil', hint: 'DEFCON 1, protiúder na ruská sila. Eskalace prudce vzroste.',
        fn: (X, S) => {
          if (!S.leader) { log('Rozkaz nelze vydat, chybí národní velitelská autorita.', 'warn'); return; }
          while (S.defcon > 1) { S.defNext = 0; X.setDefcon(-1); }
          if (X.capacity('icbm') < X.plan(['cf'], 'icbm').missiles) { log('V silech nezbývá dost raket.', 'warn'); return; }
          X.strike(['cf'], 'icbm', S.code, true);
        } },
      { label: 'Odmítnout, rakety obětujeme', hint: 'Sila budou zničena. Odstrašení −5.',
        fn: (X, S) => { S.cred = clamp(S.cred - 5, 0, 100); log('Odmítli jste odpálit z ohrožených sil. Sila budou ztracena.', 'own'); } },
    ],
  },
  {
    id: 'sub', tag: 'Námořnictvo',
    title: 'Ponorka bez spojení',
    cond: S => S.t > 300 && S.tacamo === 'ground',
    text: () => 'Strategická ponorka USS Wyoming nepotvrdila příjem posledního rozkazu. Bez spojení může velitel jednat podle starých instrukcí pro případ války.',
    choices: [
      { label: 'Vyslat E-6B TACAMO', hint: 'Obnoví spojení s ponorkami.', fn: X => X.tacamo() },
      { label: 'Nechat být', hint: 'Riziko nečekaného pohybu ponorky.',
        fn: (X, S) => { if (Math.random() < .35) { S.esc += 10; log('Ruské sonary zachytily americkou ponorku v útočné pozici u Kamčatky. Eskalace +10.', 'warn'); } else log('USS Wyoming se po hodině ozvala. Vše v pořádku.', 'ok'); } },
    ],
  },
  {
    id: 'selfdestruct', tag: 'Horká linka',
    title: 'Neautorizovaný start?',
    cond: (S, X) => S.hostile && S.t > 600 && S.tracks.some(t => X.active(t) && t.real),
    text: () => 'Moskva tvrdí, že jeden z posledních startů byl neautorizovaný. Nabízí aktivovat autodestrukci rakety, pokud USA sníží stupeň pohotovosti.',
    choices: [
      { label: 'Přijmout a snížit pohotovost', hint: 'DEFCON +1, eskalace −8. Moskva může lhát.',
        fn: (X, S) => {
          if (S.defcon < 5) { S.defNext = 0; X.setDefcon(1); }
          S.esc = Math.max(0, S.esc - 8);
          const live = S.tracks.filter(t => X.active(t) && t.real);
          if (live.length && Math.random() < .6) {
            const t = pick(live); t.status = 'destroyed'; t.tEnd = S.t;
            log(`${t.id}: kontakt zmizel z radarů. Moskva slib dodržela.`, 'ok');
          } else log('Žádná raketa nezmizela. Moskva zřejmě blufovala.', 'warn');
        } },
      { label: 'Odmítnout', hint: 'Odstrašení +3.', fn: (X, S) => { S.cred = clamp(S.cred + 3, 0, 100); log('Nabídku jste odmítli.', 'own'); } },
    ],
  },
  {
    id: 'panic', tag: 'Ministerstvo vnitra',
    title: 'Panika ve městech',
    cond: S => S.t > 600 && (S.cas > 0 || S.order < 65),
    text: () => 'Média hlásí paniku v New Yorku a Chicagu. Dálnice jsou ucpané, lidé drancují obchody a evakuace do krytů se zastavila.',
    choices: [
      { label: 'Projev k národu', hint: 'Pořádek +15, pokud je k dispozici prezident nebo viceprezident.',
        fn: (X, S) => { S.order = clamp(S.order + (S.leader ? 15 : 5), 0, 100); log('Projev k národu odvysílán. Situace se uklidňuje.', 'ok'); } },
      { label: 'Vyhlásit stanné právo', hint: 'Pořádek +25, ale odstrašení −3 (signál slabosti).',
        fn: (X, S) => { S.order = clamp(S.order + 25, 0, 100); S.cred = clamp(S.cred - 3, 0, 100); log('Vyhlášeno stanné právo. Armáda řídí dopravu.', 'warn'); } },
      { label: 'Nezasahovat', hint: 'Pořádek −10.', fn: (X, S) => { S.order = clamp(S.order - 10, 0, 100); log('Panika se šíří.', 'warn'); } },
    ],
  },
  {
    id: 'trident', tag: 'Spojenci',
    title: 'Britské ponorky Trident',
    cond: S => S.t > 400 && !S.dip.alliesUsed,
    text: () => 'Londýn se ptá, zda má zvednout pohotovost britských ponorek Trident a přidat je k americkým plánům odvety.',
    choices: [
      { label: 'Ano, zvednout pohotovost', hint: 'Odstrašení +10, eskalace +6.',
        fn: (X, S) => { S.dip.alliesUsed = true; S.cred = clamp(S.cred + 10, 0, 100); S.esc += 6; log('Britské ponorky v pohotovosti.', 'warn'); } },
      { label: 'Ne, zůstat zdrženliví', hint: 'Eskalace −3, odstrašení −2.',
        fn: (X, S) => { S.esc = Math.max(0, S.esc - 3); S.cred = clamp(S.cred - 2, 0, 100); log('Londýn zůstává v běžné pohotovosti.', 'own'); } },
    ],
  },
  {
    id: 'china', tag: 'Diplomacie',
    title: 'Peking nabízí prostředníka',
    cond: S => S.t > 900 && !S.dip.chinaUsed && S.hostile,
    text: () => 'Čínský prezident nabízí zprostředkování a přímou linku do Kremlu. Výměnou žádá, aby USA nevyhlásily DEFCON 1.',
    choices: [
      { label: 'Přijmout', hint: 'Eskalace −10, horká linka hned volná.',
        fn: (X, S) => { S.dip.chinaUsed = true; S.esc = Math.max(0, S.esc - 10); S.hot.next = S.t; log('Čína zprostředkovává jednání. Eskalace −10.', 'ok'); } },
      { label: 'Odmítnout', hint: 'Beze změny.', fn: () => log('Nabídku Pekingu jste odmítli.', 'own') },
    ],
  },
  {
    id: 'emp', tag: 'Kosmické síly',
    title: 'Hrozba elektromagnetického impulzu',
    cond: S => S.hostile && S.t > 700,
    text: () => 'Senzory hlásí výškový jaderný výbuch nad Kanadou. Elektromagnetický impulz může vyřadit radary a elektrickou síť.',
    choices: [
      { label: 'Přepnout na záložní napájení', hint: 'Radary chráněny, pořádek −5 (výpadky proudu).',
        fn: (X, S) => { S.order = clamp(S.order - 5, 0, 100); log('Radary přepnuty na chráněné záložní napájení. Ve městech výpadky proudu.', 'own'); } },
      { label: 'Riskovat', hint: '50 % šance na 10minutový výpadek radarů.',
        fn: (X, S) => { if (Math.random() < .5) { S.radarOutUntil = S.t + 600; log('EMP vyřadil pozemní radary na 10 minut. Hlavice potvrdíme až 2 minuty před dopadem.', 'crit'); } else log('Impulz radary nepoškodil.', 'ok'); } },
    ],
  },
  {
    id: 'bear', tag: 'NORAD Aljaška',
    title: 'Ruský letoun u Aljašky',
    cond: S => S.t > 500,
    text: () => 'Stíhači F-22 doprovázejí ruský průzkumný letoun Tu-142, který letí podél hranice vzdušného prostoru Aljašky. Piloti žádají rozkazy.',
    choices: [
      { label: 'Sestřelit', hint: 'Odstrašení +5, eskalace +7.', fn: (X, S) => { S.cred = clamp(S.cred + 5, 0, 100); S.esc += 7; log('Tu-142 sestřelen nad Beringovým mořem.', 'warn'); X.provoke('sestřelení letadla'); } },
      { label: 'Jen doprovázet', hint: 'Beze změny.', fn: () => log('Tu-142 se po hodině otočil k domovu.', 'own') },
    ],
  },
  {
    id: 'tape', tag: 'Technici NORAD',
    title: 'Cvičná páska v počítači?',
    cond: (S, X) => S.tracks.some(t => t.status === 'unverified') && S.t > 120,
    text: () => 'Služební technik upozorňuje, že počítače NORAD mohly omylem načíst cvičnou pásku se simulovaným útokem. Restart systému zabere 2,5 minuty.',
    choices: [
      { label: 'Restartovat a prověřit vše', hint: 'Všechny neověřené kontakty budou vyhodnoceny za 150 s.',
        fn: (X, S) => { for (const t of S.tracks) if (t.status === 'unverified') t.verifyEnd = S.t + 150; log('Systém se restartuje. Všechny neověřené kontakty se prověřují.', 'own'); } },
      { label: 'Pokračovat bez restartu', hint: 'Beze změny.', fn: () => log('Technik vrací pásku do archivu. Systém běží dál.', 'own') },
    ],
  },
];
})();
