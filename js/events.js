'use strict';
// Decision cards. The game pauses while a card is open; each choice has consequences.
// cond(S, X) decides when a card may appear; forced cards appear as soon as cond holds.
// Texts are [czech, english] pairs, or functions returning a string in the current language.
(() => {
const { L, nm, clamp, pick, fmtEta } = G;
const D = G.DATA;
const log = (m, l) => G.ui.log(m, l);

G.EVENTS = [
  {
    id: 'low', forced: true, tag: ['STRATCOM · naléhavé', 'STRATCOM · urgent'],
    title: ['Použít, nebo ztratit', 'Use Them or Lose Them'],
    cond: (S, X) => S.hostile && S.tracks.some(t => X.active(t) && t.real && t.status === 'confirmed'
      && D.SILOS.includes(t.target) && !D.SITES[t.target].dead && X.eta(t) < 600),
    text: S => {
      const t = S.tracks.find(t => G.sim.active(t) && t.status === 'confirmed' && D.SILOS.includes(t.target));
      const w = t ? ` (${nm(D.SITES[t.target])}, ${L('dopad za', 'impact in')} ${fmtEta(G.sim.eta(t))})` : '';
      return L(`Potvrzené hlavice míří na raketová pole${w}. Velitel STRATCOM doporučuje odpálit rakety z ohrožených sil, než budou zničeny. Úder by mířil na ruská sila ICBM.`,
        `Confirmed warheads are heading for the missile fields${w}. The STRATCOM commander recommends launching from the threatened silos before they are destroyed. The strike would target Russian ICBM silos.`);
    },
    choices: [
      { label: ['Odpálit z ohrožených sil', 'Launch from the threatened silos'], hint: ['DEFCON 1, protiúder na ruská sila. Eskalace prudce vzroste.', 'DEFCON 1, counterstrike on Russian silos. Escalation will jump.'],
        fn: (X, S) => {
          if (!S.leader) { log(L('Rozkaz nelze vydat, chybí národní velitelská autorita.', 'The order cannot be given: no National Command Authority.'), 'warn'); return; }
          while (S.defcon > 1) { S.defNext = 0; X.setDefcon(-1); }
          if (X.capacity('icbm') < X.plan(['cf'], 'icbm').missiles) { log(L('V silech nezbývá dost raket.', 'Not enough missiles left in the silos.'), 'warn'); return; }
          X.strike(['cf'], 'icbm', S.code, true);
        } },
      { label: ['Odmítnout, rakety obětujeme', 'Refuse and sacrifice the missiles'], hint: ['Sila budou zničena. Odstrašení −5.', 'The silos will be lost. Deterrence −5.'],
        fn: (X, S) => { S.cred = clamp(S.cred - 5, 0, 100); log(L('Odmítli jste odpálit z ohrožených sil. Sila budou ztracena.', 'You refused to launch from the threatened silos. They will be lost.'), 'own'); } },
    ],
  },
  {
    id: 'sub', tag: ['Námořnictvo', 'Navy'],
    title: ['Ponorka bez spojení', 'Submarine Out of Contact'],
    cond: S => S.t > 300 && S.tacamo === 'ground',
    text: () => L('Strategická ponorka USS Wyoming nepotvrdila příjem posledního rozkazu. Bez spojení může velitel jednat podle starých instrukcí pro případ války.',
      'The ballistic missile submarine USS Wyoming has not acknowledged its last order. Without contact, its captain may act on old wartime instructions.'),
    choices: [
      { label: ['Vyslat E-6B TACAMO', 'Launch the E-6B TACAMO'], hint: ['Obnoví spojení s ponorkami.', 'Restores the submarine link.'], fn: X => X.tacamo() },
      { label: ['Nechat být', 'Leave it'], hint: ['Riziko nečekaného pohybu ponorky.', 'Risk of an unexpected submarine move.'],
        fn: (X, S) => {
          if (Math.random() < .35) { S.esc += 10; log(L('Ruské sonary zachytily americkou ponorku v útočné pozici u Kamčatky. Eskalace +10.', 'Russian sonar caught an American submarine in an attack position off Kamchatka. Escalation +10.'), 'warn'); }
          else log(L('USS Wyoming se po hodině ozvala. Vše v pořádku.', 'USS Wyoming checked in an hour later. All is well.'), 'ok');
        } },
    ],
  },
  {
    id: 'selfdestruct', tag: ['Horká linka', 'Hotline'],
    title: ['Neautorizovaný start?', 'Unauthorised Launch?'],
    cond: (S, X) => S.hostile && S.t > 600 && S.tracks.some(t => X.active(t) && t.real),
    text: () => L('Moskva tvrdí, že jeden z posledních startů byl neautorizovaný. Nabízí aktivovat autodestrukci rakety, pokud USA sníží stupeň pohotovosti.',
      'Moscow claims one of the latest launches was unauthorised. It offers to trigger the missile’s self-destruct if the US lowers its readiness.'),
    choices: [
      { label: ['Přijmout a snížit pohotovost', 'Accept and lower readiness'], hint: ['DEFCON +1, eskalace −8. Moskva může lhát.', 'DEFCON +1, escalation −8. Moscow may be lying.'],
        fn: (X, S) => {
          if (S.defcon < 5) { S.defNext = 0; X.setDefcon(1); }
          S.esc = Math.max(0, S.esc - 8);
          const live = S.tracks.filter(t => X.active(t) && t.real);
          if (live.length && Math.random() < .6) {
            const t = pick(live); t.status = 'destroyed'; t.tEnd = S.t;
            log(L(`${t.id}: kontakt zmizel z radarů. Moskva slib dodržela.`, `${t.id}: the contact vanished from radar. Moscow kept its word.`), 'ok');
          } else log(L('Žádná raketa nezmizela. Moskva zřejmě blufovala.', 'No missile disappeared. Moscow was apparently bluffing.'), 'warn');
        } },
      { label: ['Odmítnout', 'Refuse'], hint: ['Odstrašení +3.', 'Deterrence +3.'], fn: (X, S) => { S.cred = clamp(S.cred + 3, 0, 100); log(L('Nabídku jste odmítli.', 'You refused the offer.'), 'own'); } },
    ],
  },
  {
    id: 'panic', tag: ['Ministerstvo vnitra', 'Homeland Security'],
    title: ['Panika ve městech', 'Panic in the Cities'],
    cond: S => S.t > 600 && (S.cas > 0 || S.order < 65),
    text: () => L('Média hlásí paniku v New Yorku a Chicagu. Dálnice jsou ucpané, lidé drancují obchody a evakuace do krytů se zastavila.',
      'Media report panic in New York and Chicago. Highways are jammed, stores are being looted and the move to shelters has stalled.'),
    choices: [
      { label: ['Projev k národu', 'Address the nation'], hint: ['Pořádek +15, pokud je k dispozici prezident nebo viceprezident.', 'Order +15 if the President or Vice President is available.'],
        fn: (X, S) => { S.order = clamp(S.order + (S.leader ? 15 : 5), 0, 100); log(L('Projev k národu odvysílán. Situace se uklidňuje.', 'The address has aired. Things are calming down.'), 'ok'); } },
      { label: ['Vyhlásit stanné právo', 'Declare martial law'], hint: ['Pořádek +25, ale odstrašení −3 (signál slabosti).', 'Order +25, but deterrence −3 (a sign of weakness).'],
        fn: (X, S) => { S.order = clamp(S.order + 25, 0, 100); S.cred = clamp(S.cred - 3, 0, 100); log(L('Vyhlášeno stanné právo. Armáda řídí dopravu.', 'Martial law declared. The army is directing traffic.'), 'warn'); } },
      { label: ['Nezasahovat', 'Do nothing'], hint: ['Pořádek −10.', 'Order −10.'], fn: (X, S) => { S.order = clamp(S.order - 10, 0, 100); log(L('Panika se šíří.', 'The panic is spreading.'), 'warn'); } },
    ],
  },
  {
    id: 'trident', tag: ['Spojenci', 'Allies'],
    title: ['Britské ponorky Trident', 'British Trident Submarines'],
    cond: S => S.t > 400 && !S.dip.alliesUsed,
    text: () => L('Londýn se ptá, zda má zvednout pohotovost britských ponorek Trident a přidat je k americkým plánům odvety.',
      'London asks whether to raise the readiness of the British Trident submarines and add them to American retaliation plans.'),
    choices: [
      { label: ['Ano, zvednout pohotovost', 'Yes, raise readiness'], hint: ['Odstrašení +10, eskalace +6.', 'Deterrence +10, escalation +6.'],
        fn: (X, S) => { S.dip.alliesUsed = true; S.cred = clamp(S.cred + 10, 0, 100); S.esc += 6; log(L('Britské ponorky v pohotovosti.', 'British submarines on alert.'), 'warn'); } },
      { label: ['Ne, zůstat zdrženliví', 'No, show restraint'], hint: ['Eskalace −3, odstrašení −2.', 'Escalation −3, deterrence −2.'],
        fn: (X, S) => { S.esc = Math.max(0, S.esc - 3); S.cred = clamp(S.cred - 2, 0, 100); log(L('Londýn zůstává v běžné pohotovosti.', 'London stays at normal readiness.'), 'own'); } },
    ],
  },
  {
    id: 'china', tag: ['Diplomacie', 'Diplomacy'],
    title: ['Peking nabízí prostředníka', 'Beijing Offers to Mediate'],
    cond: S => S.t > 900 && !S.dip.chinaUsed && S.hostile,
    text: () => L('Čínský prezident nabízí zprostředkování a přímou linku do Kremlu. Výměnou žádá, aby USA nevyhlásily DEFCON 1.',
      'The Chinese president offers mediation and a direct line to the Kremlin. In return, he asks that the US not go to DEFCON 1.'),
    choices: [
      { label: ['Přijmout', 'Accept'], hint: ['Eskalace −10, horká linka hned volná.', 'Escalation −10, hotline available now.'],
        fn: (X, S) => { S.dip.chinaUsed = true; S.esc = Math.max(0, S.esc - 10); S.hot.next = S.t; log(L('Čína zprostředkovává jednání. Eskalace −10.', 'China is mediating. Escalation −10.'), 'ok'); } },
      { label: ['Odmítnout', 'Decline'], hint: ['Beze změny.', 'No change.'], fn: () => log(L('Nabídku Pekingu jste odmítli.', 'You declined Beijing’s offer.'), 'own') },
    ],
  },
  {
    id: 'emp', tag: ['Kosmické síly', 'Space Force'],
    title: ['Hrozba elektromagnetického impulzu', 'EMP Threat'],
    cond: S => S.hostile && S.t > 700,
    text: () => L('Senzory hlásí výškový jaderný výbuch nad Kanadou. Elektromagnetický impulz může vyřadit radary a elektrickou síť.',
      'Sensors report a high-altitude nuclear burst over Canada. The electromagnetic pulse may knock out radars and the power grid.'),
    choices: [
      { label: ['Přepnout na záložní napájení', 'Switch to backup power'], hint: ['Radary chráněny, pořádek −5 (výpadky proudu).', 'Radars protected, order −5 (blackouts).'],
        fn: (X, S) => { S.order = clamp(S.order - 5, 0, 100); log(L('Radary přepnuty na chráněné záložní napájení. Ve městech výpadky proudu.', 'Radars switched to hardened backup power. Blackouts in the cities.'), 'own'); } },
      { label: ['Riskovat', 'Take the risk'], hint: ['50 % šance na 10minutový výpadek radarů.', '50% chance of a 10-minute radar outage.'],
        fn: (X, S) => {
          if (Math.random() < .5) { S.radarOutUntil = S.t + 600; log(L('EMP vyřadil pozemní radary na 10 minut. Hlavice potvrdíme až 2 minuty před dopadem.', 'The EMP knocked out ground radars for 10 minutes. Warheads will only be confirmed 2 minutes before impact.'), 'crit'); }
          else log(L('Impulz radary nepoškodil.', 'The pulse did not damage the radars.'), 'ok');
        } },
    ],
  },
  {
    id: 'bear', tag: ['NORAD Aljaška', 'Alaskan NORAD'],
    title: ['Ruský letoun u Aljašky', 'Russian Aircraft Near Alaska'],
    cond: S => S.t > 500,
    text: () => L('Stíhači F-22 doprovázejí ruský průzkumný letoun Tu-142, který letí podél hranice vzdušného prostoru Aljašky. Piloti žádají rozkazy.',
      'F-22s are shadowing a Russian Tu-142 reconnaissance aircraft flying along the edge of Alaskan airspace. The pilots request orders.'),
    choices: [
      { label: ['Sestřelit', 'Shoot it down'], hint: ['Odstrašení +5, eskalace +7.', 'Deterrence +5, escalation +7.'],
        fn: (X, S) => { S.cred = clamp(S.cred + 5, 0, 100); S.esc += 7; log(L('Tu-142 sestřelen nad Beringovým mořem.', 'Tu-142 shot down over the Bering Sea.'), 'warn'); X.provoke(['sestřelení letadla', 'the shootdown']); } },
      { label: ['Jen doprovázet', 'Escort only'], hint: ['Beze změny.', 'No change.'], fn: () => log(L('Tu-142 se po hodině otočil k domovu.', 'The Tu-142 turned for home an hour later.'), 'own') },
    ],
  },
  {
    id: 'tape', tag: ['Technici NORAD', 'NORAD technicians'],
    title: ['Cvičná páska v počítači?', 'A Training Tape in the System?'],
    cond: S => S.tracks.some(t => t.status === 'unverified') && S.t > 120,
    text: () => L('Služební technik upozorňuje, že počítače NORAD mohly omylem načíst cvičnou pásku se simulovaným útokem. Restart systému zabere 2,5 minuty.',
      'The duty technician warns that the NORAD computers may have loaded a training tape with a simulated attack by mistake. A system restart takes 2.5 minutes.'),
    choices: [
      { label: ['Restartovat a prověřit vše', 'Restart and check everything'], hint: ['Všechny neověřené kontakty budou vyhodnoceny za 150 s.', 'All unverified contacts will be resolved in 150 s.'],
        fn: (X, S) => { for (const t of S.tracks) if (t.status === 'unverified') t.verifyEnd = S.t + 150; log(L('Systém se restartuje. Všechny neověřené kontakty se prověřují.', 'System restarting. All unverified contacts are being checked.'), 'own'); } },
      { label: ['Pokračovat bez restartu', 'Carry on without a restart'], hint: ['Beze změny.', 'No change.'], fn: () => log(L('Technik vrací pásku do archivu. Systém běží dál.', 'The technician files the tape away. The system keeps running.'), 'own') },
    ],
  },
];
})();
