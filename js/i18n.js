'use strict';
// Static page texts. Elements carry data-i18n (text), data-i18n-html (markup), data-i18n-title, data-i18n-aria.
(() => {
const T = {
  brand: ['Velín Cheyenne Mountain', 'Cheyenne Mountain Command'],
  since: ['Čas od detekce', 'Since detection'],
  esc: ['Eskalace', 'Escalation'],
  escTip: ['Ochota protivníka pokračovat v útocích', 'The enemy’s willingness to keep attacking'],
  cred: ['Odstrašení', 'Deterrence'],
  credTip: ['Věrohodnost americké odvety', 'Credibility of American retaliation'],
  order: ['Veřejný pořádek', 'Public order'],
  orderTip: ['Ovlivňuje účinnost varování EAS', 'Affects how well EAS warnings work'],
  cas: ['Ztráty USA', 'US casualties'],
  command: ['Velení', 'Command'],
  pauseTip: ['Mezerník', 'Space bar'],
  pause: ['Pauza', 'Pause'], sound: ['Zvuk: zap', 'Sound: on'], verify: ['Ověřit', 'Verify'],
  langTip: ['Switch to English', 'Přepnout do češtiny'],
  contacts: ['Sledované kontakty', 'Tracked contacts'],
  cities: ['Města · varování EAS', 'Cities · EAS warnings'],
  noContacts: ['Žádné kontakty. Satelity SBIRS a radary včasné výstrahy jsou v pohotovosti.', 'No contacts. SBIRS satellites and early-warning radars are on watch.'],
  mapHead: ['Azimutální projekce · severní pól', 'Azimuthal projection · North Pole'],
  mapAria: ['Situační mapa', 'Situation map'],
  zIn: ['Přiblížit', 'Zoom in'], zOut: ['Oddálit', 'Zoom out'], zUS: ['Zaměřit USA', 'Focus on the US'], zReset: ['Celý pohled', 'Full view'],
  lgU: ['Neověřený kontakt', 'Unverified contact'],
  lgC: ['Potvrzená hrozba', 'Confirmed threat'],
  lgO: ['Vlastní síly · ◆ torpédoborec', 'Own forces · ◆ destroyer'],
  lgF: ['Falešný / zničený', 'False / destroyed'],
  tabK: ['Kontakt', 'Contact'], tabS: ['Síly', 'Forces'], tabI: ['Zprav.', 'Intel'], tabD: ['Diplom.', 'Diplom.'], tabC: ['Civil', 'Civil'], tabO: ['Odveta', 'Strike'],
  type: ['Typ', 'Type'], origin: ['Původ', 'Origin'], target: ['Pravděpodobný cíl', 'Likely target'], tti: ['Čas do dopadu', 'Time to impact'],
  prev: ['◂ Předchozí', '◂ Previous'], next: ['Další ▸', 'Next ▸'],
  engage: ['Prostředky k zásahu', 'Engagement options'],
  readiness: ['Pohotovost', 'Readiness'], readinessLvl: ['Stupeň pohotovosti', 'Readiness level'],
  defUp: ['Zvýšit (DEFCON −1)', 'Raise (DEFCON −1)'], defDown: ['Snížit', 'Lower'],
  defNote: ['DEFCON 2 aktivuje GMD. DEFCON 1 je nutný pro jaderný úder, ale zvyšuje eskalaci.', 'DEFCON 2 activates GMD. DEFCON 1 is required for a nuclear strike, but raises escalation.'],
  bmd: ['Protiraketová obrana', 'Missile defence'], aegis: ['Torpédoborce Aegis', 'Aegis destroyers'], triad: ['Strategické síly', 'Strategic forces'],
  ops: ['Operace', 'Operations'], radars: ['Síť radarů včasné výstrahy', 'Early-warning radar network'],
  hotline: ['Horká linka Washington–Moskva', 'Washington–Moscow hotline'], lineStatus: ['Stav linky', 'Line status'],
  allies: ['Spojenci a prostředníci', 'Allies and mediators'], truce: ['Cesta k příměří', 'Path to a ceasefire'],
  cog: ['Kontinuita vlády', 'Continuity of government'], pop: ['Obyvatelstvo', 'Population'],
  st1: ['1 · Cíle', '1 · Targets'], st2: ['2 · Nosiče', '2 · Delivery'], st3: ['3 · Autorizace', '3 · Authorisation'],
  sas: ['Rozlomit obálku SAS', 'Break the SAS envelope'], sasLbl: ['Autentizační kód z obálky', 'Authentication code from the envelope'],
  strike: ['Autorizovat jaderný úder', 'Authorise nuclear strike'],
  bombers: ['Bombardéry na cestě', 'Bombers en route'], bomberStrikes: ['Údery bombardérů', 'Bomber strikes'], recall: ['Odvolat bombardéry', 'Recall bombers'],
  logAria: ['Hlášení', 'Reports'],
  intro: ['Jste velitel směny v podzemním velínu NORAD. Satelity právě hlásí starty raket. Během 90 minut rozhodujete o obraně, strategických silách, diplomacii, ochraně obyvatel a o tom, zda konflikt skončí příměřím, nebo totální válkou.',
    'You are the duty commander in NORAD’s underground command centre. Satellites are reporting missile launches. Over the next 90 minutes you decide on defence, strategic forces, diplomacy and civil protection, and whether the conflict ends in a ceasefire or all-out war.'],
  scenario: ['Scénář', 'Scenario'], difficulty: ['Obtížnost', 'Difficulty'], language: ['Jazyk', 'Language'], howto: ['Jak hrát', 'How to play'],
  rules: [
    `<li><b>Kontakty ověřujte.</b> Část hlášení jsou falešné poplachy. Máte 3 ověřovací kanály, ověření trvá 90 s. Radary cíl potvrdí samy až těsně před dopadem.</li>
<li><b>Obrana:</b> GMD (jen ICBM, DEFCON 2), torpédoborce Aegis se střelami SM-3 (ICBM i SLBM v dosahu lodi), stíhači F-22 proti bombardérům. Lodě lze přesouvat.</li>
<li><b>Strategické síly:</b> nechte vzlétnout bombardéry, vyplout ponorky a vyslat E-6B TACAMO. Co zůstane na zemi, může být zničeno.</li>
<li><b>Zpravodajství:</b> satelitní průzkum předpoví další vlnu, odposlech zrychlí ověřování, kybernetická operace může útok zdržet.</li>
<li><b>Civilní ochrana:</b> varujte města přes EAS, evakuujte prezidenta i viceprezidenta, posílejte FEMA proti spadu a držte veřejný pořádek.</li>
<li><b>Diplomacie:</b> horká linka nabízí čtyři přístupy. Příměří nastane po dvou dohodách, když eskalace klesne pod 20 a odstrašení zůstane aspoň 40.</li>
<li><b>Odveta:</b> vyberte cíle a nosiče, zadejte kód z obálky SAS. Každý úder zvedne eskalaci a vyvolá odpověď.</li>
<li><b>Rozhodovací karty</b> během hry pozastaví čas a chtějí rychlou volbu.</li>
<li>Klávesy: mezerník pauza, 1/2/3 rychlost, V ověřit, J/K další/předchozí kontakt, G nejlepší interceptor.</li>`,
    `<li><b>Verify contacts.</b> Some reports are false alarms. You have 3 verification channels; a check takes 90 s. Radars confirm a target on their own only shortly before impact.</li>
<li><b>Defence:</b> GMD (ICBMs only, DEFCON 2), Aegis destroyers with SM-3 missiles (ICBMs and SLBMs within the ship’s reach), F-22 fighters against bombers. Ships can be repositioned.</li>
<li><b>Strategic forces:</b> launch the bombers, send the submarines to sea and put the E-6B TACAMO in the air. Whatever stays on the ground may be destroyed.</li>
<li><b>Intelligence:</b> satellite reconnaissance forecasts the next wave, signals intercepts speed up verification, a cyber operation can delay an attack.</li>
<li><b>Civil protection:</b> warn cities through EAS, evacuate the President and Vice President, send FEMA against fallout and keep public order.</li>
<li><b>Diplomacy:</b> the hotline offers four approaches. A ceasefire comes after two agreements, once escalation drops below 20 and deterrence stays at 40 or more.</li>
<li><b>Retaliation:</b> choose targets and delivery systems, enter the code from the SAS envelope. Every strike raises escalation and invites a response.</li>
<li><b>Decision cards</b> pause the clock during play and demand a quick call.</li>
<li>Keys: space pause, 1/2/3 speed, V verify, J/K next/previous contact, G best interceptor.</li>`],
  take: ['Převzít velení', 'Take command'],
  fine: ['Fiktivní simulace. Čísla a postupy jsou zjednodušené a neodpovídají skutečným plánům.', 'A work of fiction. Numbers and procedures are simplified and do not reflect real plans.'],
  paused: ['Čas je pozastaven, dokud nerozhodnete.', 'Time is paused until you decide.'],
};

function apply() {
  const i = G.lang === 'en' ? 1 : 0;
  document.documentElement.lang = G.lang;
  document.querySelectorAll('[data-i18n]').forEach(e => { const v = T[e.dataset.i18n]; if (v) e.textContent = v[i]; });
  document.querySelectorAll('[data-i18n-html]').forEach(e => { const v = T[e.dataset.i18nHtml]; if (v) e.innerHTML = v[i]; });
  document.querySelectorAll('[data-i18n-title]').forEach(e => { const v = T[e.dataset.i18nTitle]; if (v) e.title = v[i]; });
  document.querySelectorAll('[data-i18n-aria]').forEach(e => { const v = T[e.dataset.i18nAria]; if (v) e.setAttribute('aria-label', v[i]); });
  const b = document.getElementById('bLang'); if (b) b.textContent = G.lang === 'en' ? 'CZ' : 'EN';
}
function setLang(l) {
  G.lang = l;
  try { localStorage.setItem('velin-lang', l); } catch (_) {}
  apply();
}

G.i18n = { T, apply, setLang, t: k => T[k][G.lang === 'en' ? 1 : 0] };
})();
