'use strict';
// Static page texts. Elements carry data-i18n (text), data-i18n-html (markup), data-i18n-title, data-i18n-aria.
(() => {
const T = {
  brand: ['Krizový štáb', 'Situation Room'],
  eyebrow: ['Bílý dům · Situation Room · Tajné', 'The White House · Situation Room · Classified'],
  capital: ['Politický kapitál', 'Political capital'],
  pause: ['Pauza', 'Pause'], pauseTip: ['Mezerník', 'Space bar'],
  sound: ['Zvuk: zap', 'Sound: on'],
  autoTip: ['Pozastavit čas, když přijde naléhavá krize', 'Pause the clock when an urgent crisis arrives'],
  langTip: ['Switch to English', 'Přepnout do češtiny'],
  inbox: ['Depeše', 'Cables'], world: ['Státy', 'Countries'], overview: ['Přehled', 'Overview'],
  logAria: ['Zpravodajství', 'News'],
  intro: ['Jste poradce prezidenta pro národní bezpečnost a vedete krizový štáb. Svět je na pokraji jaderné války. Čas běží, depeše přicházejí samy a státy jednají podle svých zájmů. Získejte spojence, izolujte soupeře a dotlačte ho k mírové konferenci, aniž byste překročili jaderný práh.',
    'You are the President’s National Security Advisor running the Situation Room. The world is on the brink of nuclear war. The clock runs on its own, cables keep arriving and every country follows its own interests. Win allies, isolate the rival and push it to a peace conference without crossing the nuclear threshold.'],
  scenario: ['Scénář', 'Scenario'], difficulty: ['Obtížnost', 'Difficulty'], language: ['Jazyk', 'Language'], howto: ['Jak hrát', 'How to play'],
  rules: [
    `<li><b>Čas běží sám.</b> Jedna hodina krize trvá 5 sekund, celá krize 72 hodin. Pauza je na mezerníku, hru můžete zrychlit.</li>
<li><b>Depeše</b> vlevo jsou požadavky, nabídky, ultimáta a krize. Většina má lhůtu. Když nestihnete odpovědět, použije se výchozí reakce.</li>
<li><b>Státy</b> vpravo mají vztah k USA i k soupeři, povahu a skryté zájmy. Rozhovorem zjistíte, co chtějí, a vaše nabídky pak zaberou víc.</li>
<li><b>Politický kapitál</b> platí za každý tah a obnovuje se podle podpory doma.</li>
<li><b>Koalice proti bloku:</b> čím silnější koalice, tím větší odstrašení. Spojenci ale mohou odejít a neutrální státy přeběhnout.</li>
<li><b>Soupeř</b> má ukazatel ochoty jednat. Horká linka, sankce, zprostředkování a silné odstrašení ho zvedají.</li>
<li><b>Mírová konference</b> přijde, když ochota soupeře dosáhne 70, eskalace klesne pod 40 a máte za sebou dva kroky k míru.</li>
<li><b>Prohra:</b> eskalace 100 znamená jadernou válku. Prohrát můžete i ztrátou podpory, prestiže nebo ekonomiky.</li>
<li>Za 18 hodin oznámí OSN hlasování a v 24. hodině se hlasuje. Do té doby získejte co nejvíc zemí.</li>`,
    `<li><b>The clock runs on its own.</b> One crisis hour lasts 5 seconds, the whole crisis 72 hours. Space bar pauses; you can speed up.</li>
<li><b>Cables</b> on the left are demands, offers, ultimatums and crises. Most have a deadline. Miss it and the default response is applied.</li>
<li><b>Countries</b> on the right have a relation to the US and to the rival, a personality and hidden interests. Call them to learn what they want, and your offers will work better.</li>
<li><b>Political capital</b> pays for every move and regenerates with support at home.</li>
<li><b>Coalition vs bloc:</b> the stronger the coalition, the stronger deterrence. But allies may walk away and neutrals may defect.</li>
<li><b>The rival</b> has a will-to-talk meter. The hotline, sanctions, mediation and strong deterrence raise it.</li>
<li><b>A peace conference</b> comes once the rival’s will reaches 70, escalation is below 40 and you have taken two steps towards peace.</li>
<li><b>Defeat:</b> escalation 100 means nuclear war. You can also lose through collapsing support, prestige or economy.</li>
<li>At hour 18 the UN announces a vote, held at hour 24. Win over as many countries as you can before then.</li>`],
  take: ['Převzít krizový štáb', 'Take the chair'],
  fine: ['Fiktivní simulace. Postavy, čísla a události jsou smyšlené a zjednodušené.', 'A work of fiction. Characters, numbers and events are invented and simplified.'],
};

function apply() {
  const i = G.lang === 'en' ? 1 : 0;
  document.documentElement.lang = G.lang;
  document.title = T.brand[i];
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
G.i18n = { T, apply, setLang };
})();
