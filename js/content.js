'use strict';
// Messages that land in the inbox. Each template:
//   kind: demand | offer | rival | crisis | script ;  urgent: pauses the clock and opens immediately
//   dl: hours to answer (null = no deadline) ;  dflt: choice applied when the deadline passes
//   title/text: [cs, en] with placeholders {C} {C2} {C3} {C4} {C7} (country cases) and {R} … (rival)
//   choices: { l, cost (political capital), eff, p (chance, number or fn), fail (eff on failure), fn, req }
// Effects (eff): esc will sup pres eco pk defcon deter talks, rel/relR: { C | HAWKS | DOVES | MEMBERS | key : delta }, join, leave
(() => {
const { clamp } = G;

// demands and offers sent by ordinary countries; w = how likely this country is to send it
G.COUNTRY_MSGS = [
  { id: 'd_trade', kind: 'demand', dl: 6, dflt: 2, w: c => c.w.eco, cond: (S, k) => S.c[k].rel > -20,
    title: ['Obchodní požadavek', 'Trade demand'],
    text: ['{C} podmiňuje svou podporu zrušením amerických cel na svůj export. Bez toho prý nebude hlasovat s USA.', '{C} makes its support conditional on lifting US tariffs on its exports. Otherwise, it says, it will not vote with the US.'],
    choices: [
      { l: ['Vyhovět', 'Agree'], eff: { eco: -4, rel: { C: 12 } } },
      { l: ['Vyjednat kompromis', 'Negotiate a compromise'], cost: 5, p: .55, eff: { eco: -2, rel: { C: 7 } }, fail: { rel: { C: -4 } } },
      { l: ['Odmítnout', 'Refuse'], eff: { rel: { C: -10 } } },
    ] },
  { id: 'd_arms', kind: 'demand', dl: 6, dflt: 1, w: c => c.w.sec, cond: (S, k) => S.c[k].rel > 10,
    title: ['Žádost o zbraně', 'Request for arms'],
    text: ['{C} žádá okamžité dodávky protivzdušné obrany. Bez nich prý nemůže čelit hrozbě ze strany {R2}.', '{C} requests immediate air defence deliveries. Without them, it says, it cannot face the threat from {R}.'],
    choices: [
      { l: ['Dodat systémy', 'Deliver the systems'], cost: 6, eff: { esc: 3, rel: { C: 12 }, will: -2 } },
      { l: ['Odmítnout', 'Refuse'], eff: { rel: { C: -10 } } },
    ] },
  { id: 'd_energy', kind: 'demand', dl: 6, dflt: 1, w: c => c.w.energy * 1.5,
    title: ['Energetická krize', 'Energy crunch'],
    text: ['{C} varuje před nedostatkem plynu. Pokud USA nepomohou, bude muset nakupovat od {R2}.', '{C} warns of a gas shortage. If the US does not help, it will have to buy from {R}.'],
    choices: [
      { l: ['Dodat LNG', 'Ship LNG'], eff: { eco: -3, rel: { C: 10 }, relR: { C: -5 } } },
      { l: ['Odmítnout', 'Refuse'], eff: { rel: { C: -8 }, relR: { C: 8 } } },
    ] },
  { id: 'd_restraint', kind: 'demand', dl: 5, dflt: 2, w: c => c.pers === 'dove' ? 1 : 0, cond: S => S.esc > 45,
    title: ['Výzva ke zdrženlivosti', 'Call for restraint'],
    text: ['{C} vyzývá Washington ke zdrženlivosti a žádá snížení stupně pohotovosti, aby se krize nevymkla kontrole.', '{C} urges Washington to show restraint and lower its readiness before the crisis spins out of control.'],
    choices: [
      { l: ['Snížit DEFCON', 'Lower DEFCON'], req: S => S.defcon >= 5 ? ['Už je DEFCON 5.', 'Already at DEFCON 5.'] : null, eff: { defcon: 1, esc: -4, rel: { C: 10, HAWKS: -3 } } },
      { l: ['Diplomaticky ujistit', 'Reassure diplomatically'], cost: 4, eff: { rel: { C: 4 } } },
      { l: ['Odmítnout', 'Refuse'], eff: { rel: { C: -8 } } },
    ] },
  { id: 'd_guarantee', kind: 'demand', dl: 6, dflt: 1, w: c => c.w.sec, cond: (S, k) => S.c[k].rel > 25,
    title: ['Žádost o záruky', 'Request for guarantees'],
    text: ['{C} žádá veřejné bezpečnostní záruky pro případ, že by se konflikt rozšířil.', '{C} asks for public security guarantees in case the conflict spreads.'],
    choices: [
      { l: ['Poskytnout záruky', 'Give guarantees'], cost: 8, eff: { esc: 3, pres: 2, rel: { C: 14 } } },
      { l: ['Odmítnout', 'Refuse'], eff: { rel: { C: -10 } } },
    ] },
  { id: 'd_seat', kind: 'demand', dl: 6, dflt: 1, w: c => c.w.prest,
    title: ['Místo u stolu', 'A seat at the table'],
    text: ['{C} chce hrát roli ve vyjednávání a žádá místo u jednacího stolu s {R7}.', '{C} wants a role in the talks and asks for a seat at the table with {R}.'],
    choices: [
      { l: ['Přizvat k jednání', 'Invite to the talks'], cost: 5, eff: { rel: { C: 10 }, will: 2 } },
      { l: ['Odmítnout', 'Refuse'], eff: { rel: { C: -6 } } },
    ] },
  { id: 'd_hawk', kind: 'demand', dl: 5, dflt: 2, w: c => c.pers === 'hawk' ? 1 : 0, cond: (S, k) => S.c[k].side === 'c' && S.esc > 35 && S.defcon > 2,
    title: ['Tlak na tvrdost', 'Pressure to get tough'],
    text: ['{C} žádá tvrdší postup vůči {R3} a zvýšení americké pohotovosti. Jinak prý USA ztratí důvěryhodnost.', '{C} demands a tougher line on {R} and higher US readiness. Otherwise, it says, the US will lose credibility.'],
    choices: [
      { l: ['Zvýšit DEFCON', 'Raise DEFCON'], eff: { defcon: -1, esc: 5, rel: { C: 8 } } },
      { l: ['Uklidnit spojence', 'Calm the ally'], cost: 4, eff: { rel: { C: 2 } } },
      { l: ['Odmítnout', 'Refuse'], eff: { rel: { C: -8 } } },
    ] },
  { id: 'o_mediate', kind: 'offer', dl: 6, dflt: 1, w: c => c.pers === 'prag' || c.pers === 'dove' ? 1 : .4, cond: (S, k) => S.c[k].rel >= 10 && S.c[k].relR >= 10 && S.c[k].side !== 'b',
    title: ['Nabídka zprostředkování', 'Offer to mediate'],
    text: ['{C} nabízí zprostředkování mezi Washingtonem a {R7}. Má dobré vztahy s oběma stranami.', '{C} offers to mediate between Washington and {R}. It is on good terms with both sides.'],
    choices: [
      { l: ['Přijmout', 'Accept'], eff: { esc: -6, will: 6, rel: { C: 4 } } },
      { l: ['Odmítnout', 'Decline'], eff: { rel: { C: -3 } } },
    ] },
  { id: 'o_deploy', kind: 'offer', dl: 6, dflt: 1, w: c => c.w.sec, cond: (S, k) => S.c[k].side === 'c',
    title: ['Nabídka sil', 'Forces offered'],
    text: ['{C} nabízí vyslat své námořní a letecké síly k posílení společného odstrašení.', '{C} offers to send naval and air forces to strengthen joint deterrence.'],
    choices: [
      { l: ['Přijmout', 'Accept'], eff: { deter: 'C', esc: 3, rel: { C: 3 } } },
      { l: ['Zdvořile odmítnout', 'Politely decline'], eff: { esc: -1 } },
    ] },
  { id: 'o_join', kind: 'offer', dl: 8, dflt: 1, w: () => 1, cond: (S, k) => S.c[k].side == null && S.c[k].rel >= 35 && S.c[k].rel - S.c[k].relR >= 20,
    title: ['Zájem o koalici', 'Interest in the coalition'],
    text: ['{C} zvažuje vstup do koalice. Výměnou chce výhodnější obchodní podmínky.', '{C} is considering joining the coalition. In return, it wants better trade terms.'],
    choices: [
      { l: ['Přijmout do koalice', 'Welcome into the coalition'], cost: 8, eff: { eco: -3, join: 'C' } },
      { l: ['Odmítnout', 'Decline'], eff: { rel: { C: -4 } } },
    ] },
  { id: 'o_intel', kind: 'offer', dl: 5, dflt: 1, w: () => .6, cond: (S, k) => S.c[k].rel >= 20,
    title: ['Zpravodajské informace', 'Intelligence offered'],
    text: ['{C} nabízí zpravodajské informace o plánech {R2}.', '{C} offers intelligence on the plans of {R}.'],
    choices: [
      { l: ['Přijmout', 'Accept'], cost: 3, eff: { esc: -2, will: 3, rel: { C: 3 } } },
      { l: ['Nechat být', 'Pass'], eff: {} },
    ] },
  { id: 'o_oil', kind: 'offer', dl: 6, dflt: 1, w: c => c.pers === 'opp' ? 1 : 0, cond: (S, k) => k === 'SA' && S.c[k].side !== 'b',
    title: ['Ropa za záruky', 'Oil for guarantees'],
    text: ['Výměnou za bezpečnostní záruky nabízí {C} navýšení těžby ropy, což uklidní trhy.', 'In exchange for security guarantees, {C} offers to raise oil output, which would calm the markets.'],
    choices: [
      { l: ['Přijmout', 'Accept'], cost: 6, eff: { eco: 8, esc: 1, rel: { C: 8 } } },
      { l: ['Odmítnout', 'Decline'], eff: { rel: { C: -5 } } },
    ] },
  { id: 'o_swing', kind: 'offer', dl: 6, dflt: 1, w: c => c.pw >= 9 ? 3 : 0, cond: (S, k) => S.c[k].side == null && S.c[k].relR > 10,
    title: ['Cena neutrality', 'The price of neutrality'],
    text: ['{C} nabízí, že zůstane neutrální a nebude podporovat {R4}, pokud USA zmírní sankce vůči jejím firmám.', '{C} offers to stay neutral and not back {R} if the US eases sanctions on its companies.'],
    choices: [
      { l: ['Přijmout', 'Accept'], eff: { eco: -2, relR: { C: -15 }, rel: { C: 8, HAWKS: -2 } } },
      { l: ['Odmítnout', 'Refuse'], eff: { relR: { C: 8 }, rel: { C: -6 } } },
    ] },
  { id: 'd_drift', kind: 'demand', dl: 6, dflt: 2, w: () => 2, cond: (S, k) => S.c[k].side == null && S.c[k].rel - S.c[k].relR < -20,
    title: ['Hrozí přeběhnutí', 'About to switch sides'],
    text: ['{C} zvažuje připojení k bloku {R2}. Diplomaté naznačují, že by to mohla změnit velkorysá nabídka.', '{C} is considering joining the bloc of {R}. Diplomats hint that a generous offer could change that.'],
    choices: [
      { l: ['Hospodářský balíček', 'Economic package'], cost: 10, eff: { eco: -4, rel: { C: 15 }, relR: { C: -12 } } },
      { l: ['Pohrozit sankcemi', 'Threaten sanctions'], p: (S, k) => clamp(.1 + G.DATA.COUNTRIES[k].w.eco * .8, .1, .7), eff: { relR: { C: -15 }, rel: { C: -5 }, pres: -1 }, fail: { rel: { C: -10 }, relR: { C: 8 } } },
      { l: ['Nechat být', 'Let it go'], eff: { relR: { C: 6 } } },
    ] },
];

// messages from the rival
G.RIVAL_MSGS = [
  { id: 'r_swap', kind: 'rival', dl: 8, dflt: 2, cond: S => S.will >= 25,
    title: ['Návrh výměny', 'A trade-off proposed'],
    text: ['{R} navrhuje: stáhne jednotky od hranic, pokud USA stáhnou letadlové lodě z regionu.', '{R} proposes to pull its troops back from the border if the US withdraws its carriers from the region.'],
    choices: [
      { l: ['Přijmout', 'Accept'], eff: { esc: -10, will: 5, talks: 1, nodeter: 1, rel: { HAWKS: -4 } } },
      { l: ['Protinávrh', 'Counter-proposal'], cost: 6, p: .5, eff: { esc: -6, will: 6, talks: 1 }, fail: { esc: 3 } },
      { l: ['Odmítnout', 'Refuse'], eff: { esc: 4 } },
    ] },
  { id: 'r_ultimatum', kind: 'rival', dl: 6, dflt: 1, target: 'member', cond: S => Object.values(S.c).some(c => c.side === 'c'),
    title: ['Ultimátum', 'Ultimatum'],
    text: ['{R} dává ultimátum: USA musí do 6 hodin zastavit vojenskou pomoc pro {C4}. Jinak hrozí „vojensko-technickými opatřeními“.', '{R} issues an ultimatum: the US must halt military aid to {C} within 6 hours or face “military-technical measures”.'],
    choices: [
      { l: ['Ustoupit', 'Back down'], eff: { esc: -8, sup: -8, rel: { C: -15, HAWKS: -3 } } },
      { l: ['Odmítnout', 'Reject'], eff: { esc: 8, pres: 3, rel: { C: 5 } } },
    ] },
  { id: 'r_nuke', kind: 'rival', urgent: true, dl: 3, dflt: 0, cond: S => S.esc >= 50,
    title: ['Jaderná hrozba', 'Nuclear threat'],
    text: ['{R} oznamuje přesun taktických jaderných zbraní k hranicím a uvádí strategické síly do nejvyšší pohotovosti.', '{R} announces it is moving tactical nuclear weapons to the border and putting strategic forces on highest alert.'],
    choices: [
      { l: ['Zvýšit DEFCON', 'Raise DEFCON'], eff: { defcon: -1, esc: 6 }, fn: (S, X) => { if (X.deterrence() > 1.2) X.apply({ will: 5 }); } },
      { l: ['Horká linka', 'Use the hotline'], cost: 10, p: .6, eff: { esc: -8, will: 3 }, fail: { esc: 4 } },
      { l: ['Svolat spojence', 'Rally the allies'], cost: 12, eff: { deter: 6, esc: 3, rel: { MEMBERS: 3 } } },
    ] },
  { id: 'r_prop', kind: 'rival', dl: 4, dflt: 1,
    title: ['Propagandistická ofenziva', 'Propaganda offensive'],
    text: ['Státní média {R2} tvrdí, že USA chystají první úder. Zprávu přebírají sítě po celém světě.', 'State media in {R} claim the US is preparing a first strike. Outlets around the world are picking it up.'],
    choices: [
      { l: ['Reagovat projevem', 'Respond with a speech'], cost: 6, eff: { sup: 5, pres: 2 } },
      { l: ['Ignorovat', 'Ignore'], eff: { sup: -3, pres: -2 } },
    ] },
  { id: 'r_secret', kind: 'rival', dl: 6, dflt: 1, cond: S => S.will >= 45,
    title: ['Tajný kanál', 'Back channel'],
    text: ['{R} nabízí přes tajný kanál jednání o příměří, pokud USA veřejně neoznámí žádné nové sankce.', '{R} offers ceasefire talks through a back channel, provided the US announces no new sanctions publicly.'],
    choices: [
      { l: ['Přijmout', 'Accept'], eff: { will: 8, talks: 1, esc: -5, rel: { HAWKS: -3 } } },
      { l: ['Odmítnout', 'Refuse'], eff: { will: -5 } },
    ] },
];

// crises from the wider world; most are urgent and pause the clock
G.CRISES = [
  { id: 'c_cable', kind: 'crisis', urgent: true, dl: 3, dflt: 1,
    title: ['Přerušený kabel', 'Cable cut'],
    text: ['Neznámá ponorka poškodila podmořský datový kabel v Atlantiku. Stopy ukazují na {R4}.', 'An unknown submarine has damaged a subsea data cable in the Atlantic. The evidence points to {R}.'],
    choices: [
      { l: ['Obvinit veřejně', 'Accuse publicly'], eff: { esc: 5, sup: 3, pres: 2 } },
      { l: ['Vyšetřovat tiše', 'Investigate quietly'], cost: 4, eff: {} },
    ] },
  { id: 'c_leak', kind: 'crisis', urgent: true, dl: 3, dflt: 1, cond: S => S.talks >= 1,
    title: ['Únik do tisku', 'Press leak'],
    text: ['Novináři zjistili, že USA tajně jednají s {R7}. Kongres žádá vysvětlení.', 'Journalists have found out that the US is secretly negotiating with {R}. Congress demands an explanation.'],
    choices: [
      { l: ['Přiznat a obhájit', 'Admit and defend it'], eff: { sup: -4, pres: 2 } },
      { l: ['Popřít', 'Deny it'], p: .6, eff: {}, fail: { sup: -8, pres: -5 } },
    ] },
  { id: 'c_general', kind: 'crisis', urgent: true, dl: 3, dflt: 0,
    title: ['Návrh preventivního úderu', 'Pre-emptive strike proposed'],
    text: ['Náčelník štábu letectva navrhuje preventivní konvenční úder na odpalovací zařízení {R2}. Tvrdí, že okno se zavírá.', 'The Air Force Chief of Staff proposes a pre-emptive conventional strike on launchers in {R}. He says the window is closing.'],
    choices: [
      { l: ['Odmítnout', 'Reject'], eff: { rel: { HAWKS: -2 } } },
      { l: ['Připravit plány', 'Prepare the plans'], eff: { esc: 4, deter: 3 } },
      { l: ['Schválit úder', 'Approve the strike'], eff: { esc: 22, pres: -6, rel: { DOVES: -10 } }, fn: (S, X) => X.apply({ will: X.deterrence() > 1.3 ? 8 : -10 }) },
    ] },
  { id: 'c_plant', kind: 'crisis', urgent: true, dl: 3, dflt: 2,
    title: ['Jaderná elektrárna v ohrožení', 'Nuclear plant in danger'],
    text: ['Jaderná elektrárna v oblasti konfliktu hlásí výpadek chlazení. Hrozí únik radiace.', 'A nuclear power plant in the conflict zone reports a cooling failure. A radiation leak is possible.'],
    choices: [
      { l: ['Vyslat experty', 'Send experts'], cost: 6, eff: { pres: 5, esc: -3 } },
      { l: ['Vyzvat OSN', 'Call on the UN'], eff: { pres: 2 } },
      { l: ['Nezasahovat', 'Stay out'], eff: { pres: -4 } },
    ] },
  { id: 'c_refugees', kind: 'crisis', dl: 5, dflt: 1,
    title: ['Uprchlíci', 'Refugees'],
    text: ['Statisíce lidí prchají z pohraničí. Spojenci žádají finanční pomoc.', 'Hundreds of thousands are fleeing the border areas. The allies are asking for financial help.'],
    choices: [
      { l: ['Financovat pomoc', 'Fund the relief'], eff: { eco: -3, pres: 4, rel: { MEMBERS: 3 } } },
      { l: ['Odmítnout', 'Decline'], eff: { pres: -3, rel: { MEMBERS: -2 } } },
    ] },
  { id: 'c_false', kind: 'crisis', urgent: true, dl: 2, dflt: 0,
    title: ['Poplach', 'Alarm'],
    text: ['Systém včasné výstrahy hlásí start rakety. Data jsou nejasná a satelity si odporují.', 'Early warning reports a missile launch. The data are unclear and the satellites disagree.'],
    choices: [
      { l: ['Ověřit, nic nedělat', 'Verify, do nothing yet'], eff: {} },
      { l: ['Okamžitě DEFCON 1', 'DEFCON 1 at once'], eff: { defcon: -4, esc: 12 } },
      { l: ['Zavolat horkou linkou', 'Call on the hotline'], cost: 5, eff: { esc: -3, will: 2 } },
    ] },
  { id: 'c_markets', kind: 'crisis', dl: 5, dflt: 2,
    title: ['Panika na trzích', 'Market panic'],
    text: ['Akciové trhy se propadají a cena ropy letí vzhůru.', 'Stock markets are plunging and oil prices are soaring.'],
    choices: [
      { l: ['Uvolnit strategické rezervy', 'Release strategic reserves'], cost: 8, eff: { eco: 6 } },
      { l: ['Uklidnit trhy projevem', 'Calm markets with a speech'], cost: 5, eff: { eco: 3, sup: 1 } },
      { l: ['Nechat trhy být', 'Let markets be'], eff: { eco: -5, sup: -3 } },
    ] },
  { id: 'c_sub', kind: 'crisis', urgent: true, dl: 3, dflt: 1,
    title: ['Ponorka u pobřeží', 'Submarine off the coast'],
    text: ['Ponorka {R2} byla zachycena v amerických teritoriálních vodách u Virginie.', 'A submarine from {R} has been detected in US territorial waters off Virginia.'],
    choices: [
      { l: ['Vytlačit ji námořnictvem', 'Force it out with the Navy'], eff: { esc: 5, sup: 3 } },
      { l: ['Tiše monitorovat', 'Monitor quietly'], eff: { sup: -2 } },
    ] },
  { id: 'c_defector', kind: 'crisis', dl: 4, dflt: 0,
    title: ['Přeběhlík', 'Defector'],
    text: ['Vysoký důstojník z {R2} přeběhl a nabízí plány generálního štábu.', 'A senior officer from {R} has defected and is offering General Staff plans.'],
    choices: [
      { l: ['Přijmout', 'Take him in'], eff: { esc: 3, deter: 4, will: 3 } },
      { l: ['Vydat zpět jako gesto', 'Hand him back as a gesture'], eff: { will: 5, pres: -2, rel: { HAWKS: -3 } } },
    ] },
  { id: 'c_congress', kind: 'crisis', dl: 5, dflt: 2, cond: S => S.sup < 50,
    title: ['Vzpoura v Kongresu', 'Revolt in Congress'],
    text: ['Kongres hrozí zablokovat financování krizových opatření, pokud administrativa neposkytne informace.', 'Congress threatens to block funding for crisis measures unless the administration shares information.'],
    choices: [
      { l: ['Uspořádat briefing', 'Hold a briefing'], cost: 6, eff: { sup: 5 } },
      { l: ['Vyjít Kongresu vstříc', 'Meet Congress halfway'], eff: { sup: 3, pk: -8 } },
      { l: ['Ignorovat', 'Ignore it'], eff: { sup: -6, pk: -10 } },
    ] },
  { id: 'c_brink', kind: 'crisis', urgent: true, dl: 2, dflt: 1, cond: S => S.esc >= 85, repeat: true,
    title: ['Na hraně', 'On the brink'],
    text: ['Obě strany mají strategické síly v nejvyšší pohotovosti. Analytici varují, že stačí jediná chyba.', 'Both sides have strategic forces on highest alert. Analysts warn that a single mistake would be enough.'],
    choices: [
      { l: ['Velký ústupek', 'A major concession'], eff: { esc: -15, sup: -10, will: 5, rel: { HAWKS: -5 } } },
      { l: ['Vydržet', 'Hold firm'], eff: { esc: 4 } },
      { l: ['Horká linka', 'Use the hotline'], cost: 12, p: .5, eff: { esc: -12, will: 5 }, fail: { esc: 6 } },
    ] },
];

// scenario openings and fixed beats
G.SCRIPT = {
  open: {
    baltic: { id: 's_open', kind: 'script', urgent: true, dl: null,
      title: ['Záblesk nad Baltem', 'Flash over the Baltic'],
      text: ['Ruská taktická jaderná zbraň explodovala nad Baltským mořem 40 km od pobřeží. Nikdo nezemřel, ale Moskva to označila za poslední varování NATO. Spojenci volají Washington.', 'A Russian tactical nuclear weapon has detonated over the Baltic Sea, 40 km offshore. No one was killed, but Moscow calls it a final warning to NATO. The allies are calling Washington.'],
      choices: [
        { l: ['Vyhlásit DEFCON 2', 'Declare DEFCON 2'], eff: { defcon: -1, esc: 8, sup: 5, rel: { HAWKS: 5, DOVES: -4 } } },
        { l: ['Svolat spojence', 'Rally the allies'], cost: 10, eff: { deter: 5, rel: { MEMBERS: 5 } } },
        { l: ['Okamžitě horká linka', 'Hotline at once'], cost: 8, eff: { esc: -5, will: 5, rel: { HAWKS: -3 } } },
      ] },
    pacific: { id: 's_open', kind: 'script', urgent: true, dl: null,
      title: ['Blokáda', 'Blockade'],
      text: ['Čínské námořnictvo uzavřelo přístupy k Tchaj-wanu. Peking varuje, že každý zásah bude považován za válku. Japonsko žádá okamžitou koordinaci.', 'The Chinese navy has sealed the approaches to Taiwan. Beijing warns that any intervention will be treated as war. Japan asks for immediate coordination.'],
      choices: [
        { l: ['Vyslat letadlové lodě', 'Send the carriers'], eff: { deter: 6, esc: 7, sup: 4, rel: { JP: 6 } } },
        { l: ['Svolat spojence', 'Rally the allies'], cost: 10, eff: { deter: 4, rel: { MEMBERS: 5 } } },
        { l: ['Nabídnout jednání', 'Offer talks'], cost: 8, eff: { esc: -5, will: 5, rel: { JP: -4 } } },
      ] },
    coup: { id: 's_open', kind: 'script', urgent: true, dl: null,
      title: ['Puč', 'Coup'],
      text: ['Generálové v Moskvě sesadili vládu. Ovládají část jaderných sil a tvrdí, že jsou připraveni „jednat se Západem“. Velení zbytku arzenálu je nejasné.', 'Generals in Moscow have toppled the government. They control part of the nuclear forces and say they are ready to “talk to the West”. Command of the rest of the arsenal is unclear.'],
      choices: [
        { l: ['Navázat kontakt s generály', 'Contact the generals'], cost: 6, eff: { will: 8, talks: 1, pres: -3 } },
        { l: ['Zvýšit pohotovost', 'Raise readiness'], eff: { defcon: -1, esc: 6, sup: 4 } },
        { l: ['Koordinovat se spojenci', 'Coordinate with allies'], cost: 8, eff: { rel: { MEMBERS: 6 }, deter: 3 } },
      ] },
  },
  unAnnounce: { id: 's_un1', kind: 'script', dl: 4, dflt: 0,
    title: ['Hlasování v OSN', 'UN vote'],
    text: ['Za 6 hodin hlasuje Valné shromáždění OSN o rezoluci odsuzující {R4}. Výsledek ovlivní, kolik zemí bude na vaší straně (vztah aspoň 25) a kolik na straně soupeře.', 'In 6 hours the UN General Assembly votes on a resolution condemning {R}. The outcome depends on how many countries are on your side (relation 25 or more) and how many back the rival.'],
    choices: [
      { l: ['Rozumím', 'Understood'], eff: {} },
      { l: ['Zahájit lobbing', 'Start lobbying'], cost: 10, eff: { rel: { ALL: 4 } } },
    ] },
  summit: { id: 's_summit', kind: 'script', urgent: true, dl: null,
    title: ['Mírová konference', 'Peace conference'],
    text: ['{R} souhlasí s mírovou konferencí v Ženevě. Delegace čekají na vaše instrukce. Jakou linii zvolíte?', '{R} agrees to a peace conference in Geneva. The delegations are waiting for your instructions. What line will you take?'],
    choices: [
      { l: ['Tvrdé podmínky', 'Hard terms'], p: (S, k, X) => clamp(X.deterrence() - .8, .1, .9), eff: { end: 'peace_strong' }, fail: { esc: 15, will: -25, talks: -9, summitFail: 1 } },
      { l: ['Vyvážený kompromis', 'A balanced compromise'], eff: { end: 'peace' } },
      { l: ['Velké ústupky', 'Major concessions'], eff: { sup: -15, end: 'peace_weak' } },
    ] },
};
})();
