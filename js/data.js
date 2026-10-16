'use strict';
// Static game data: countries, offers, scenarios, difficulty. Texts are [czech, english] pairs.
(() => {
// Czech case forms: g genitive, d dative, a accusative, i instrumental, l locative.
// w = interest weights (eco, sec, energy, prest); pw = power; pers = personality.
const COUNTRIES = {
  RU: { n: 'Rusko', en: 'Russia', code: 'RUS', pw: 9, nuke: 1, pers: 'hawk', w: { eco: .3, sec: .2, energy: 0, prest: .5 }, g: 'Ruska', d: 'Rusku', a: 'Rusko', i: 'Ruskem', l: 'Rusku' },
  CN: { n: 'Čína', en: 'China', code: 'CHN', pw: 10, nuke: 1, pers: 'prag', w: { eco: .6, sec: .1, energy: .1, prest: .2 }, g: 'Číny', d: 'Číně', a: 'Čínu', i: 'Čínou', l: 'Číně' },
  GB: { n: 'Spojené království', en: 'United Kingdom', code: 'GBR', pw: 6, nuke: 1, pers: 'hawk', w: { eco: .2, sec: .5, energy: 0, prest: .3 }, g: 'Spojeného království', d: 'Spojenému království', a: 'Spojené království', i: 'Spojeným královstvím', l: 'Spojeném království' },
  FR: { n: 'Francie', en: 'France', code: 'FRA', pw: 6, nuke: 1, pers: 'prag', w: { eco: .3, sec: .3, energy: 0, prest: .4 }, g: 'Francie', d: 'Francii', a: 'Francii', i: 'Francií', l: 'Francii' },
  DE: { n: 'Německo', en: 'Germany', code: 'DEU', pw: 7, pers: 'dove', w: { eco: .4, sec: .2, energy: .4, prest: 0 }, g: 'Německa', d: 'Německu', a: 'Německo', i: 'Německem', l: 'Německu' },
  PL: { n: 'Polsko', en: 'Poland', code: 'POL', pw: 4, pers: 'hawk', w: { eco: .1, sec: .7, energy: .2, prest: 0 }, g: 'Polska', d: 'Polsku', a: 'Polsko', i: 'Polskem', l: 'Polsku' },
  TR: { n: 'Turecko', en: 'Turkey', code: 'TUR', pw: 5, pers: 'opp', w: { eco: .3, sec: .2, energy: .2, prest: .3 }, g: 'Turecka', d: 'Turecku', a: 'Turecko', i: 'Tureckem', l: 'Turecku' },
  IN: { n: 'Indie', en: 'India', code: 'IND', pw: 7, nuke: 1, pers: 'prag', w: { eco: .4, sec: 0, energy: .3, prest: .3 }, g: 'Indie', d: 'Indii', a: 'Indii', i: 'Indií', l: 'Indii' },
  JP: { n: 'Japonsko', en: 'Japan', code: 'JPN', pw: 6, pers: 'dove', w: { eco: .2, sec: .5, energy: .3, prest: 0 }, g: 'Japonska', d: 'Japonsku', a: 'Japonsko', i: 'Japonskem', l: 'Japonsku' },
  SA: { n: 'Saúdská Arábie', en: 'Saudi Arabia', code: 'SAU', pw: 4, pers: 'opp', w: { eco: .3, sec: .4, energy: 0, prest: .3 }, g: 'Saúdské Arábie', d: 'Saúdské Arábii', a: 'Saúdskou Arábii', i: 'Saúdskou Arábií', l: 'Saúdské Arábii' },
  BR: { n: 'Brazílie', en: 'Brazil', code: 'BRA', pw: 5, pers: 'dove', w: { eco: .5, sec: 0, energy: 0, prest: .5 }, g: 'Brazílie', d: 'Brazílii', a: 'Brazílii', i: 'Brazílií', l: 'Brazílii' },
  KP: { n: 'Severní Korea', en: 'North Korea', code: 'PRK', pw: 2, nuke: 1, pers: 'hawk', w: { eco: 0, sec: .5, energy: 0, prest: .5 }, g: 'Severní Koreje', d: 'Severní Koreji', a: 'Severní Koreu', i: 'Severní Koreou', l: 'Severní Koreji' },
  IR: { n: 'Írán', en: 'Iran', code: 'IRN', pw: 3, pers: 'hawk', w: { eco: .4, sec: .3, energy: 0, prest: .3 }, g: 'Íránu', d: 'Íránu', a: 'Írán', i: 'Íránem', l: 'Íránu' },
};
const US_POWER = 10;

const PERS = {
  hawk: [['Jestřáb', 'Hawk'], ['Oceňuje tvrdost, ústupky mu vadí.', 'Respects toughness, dislikes concessions.']],
  dove: [['Holubice', 'Dove'], ['Chce deeskalaci, vysoké napětí mu vadí.', 'Wants de-escalation, dislikes high tension.']],
  prag: [['Pragmatik', 'Pragmatist'], ['Jde mu o vlastní zájmy.', 'Follows its own interests.']],
  opp: [['Oportunista', 'Opportunist'], ['Přidá se k silnějšímu nebo k tomu, kdo víc nabídne.', 'Sides with the stronger party or the higher bidder.']],
};
const INTERESTS = { eco: ['Ekonomika', 'Economy'], sec: ['Bezpečnost', 'Security'], energy: ['Energie', 'Energy'], prest: ['Prestiž', 'Prestige'] };

// Offers the player can make to a country. Value = Σ w[interest] × country weight.
const OFFERS = {
  trade: { n: ['Obchodní dohoda', 'Trade deal'], cost: 10, w: { eco: 1 }, eff: { eco: -3 } },
  arms: { n: ['Dodávky zbraní', 'Arms deliveries'], cost: 12, w: { sec: 1 }, eff: { esc: 3 } },
  guarantee: { n: ['Bezpečnostní záruky', 'Security guarantees'], cost: 16, w: { sec: 1.4 }, eff: { esc: 2, pres: 1 }, minRel: 30 },
  lng: { n: ['Dodávky LNG', 'LNG supplies'], cost: 8, w: { energy: 1 }, eff: { eco: -2 } },
  intel: { n: ['Sdílení zpravodajství', 'Intelligence sharing'], cost: 6, w: { sec: .5 }, trust: 8 },
  summit: { n: ['Pozvání na summit', 'Summit invitation'], cost: 8, w: { prest: 1 } },
};

// init: [relation to US, relation to rival, side] where side c = coalition, b = rival bloc
const SCEN = {
  baltic: {
    n: 'Baltský záblesk', en: 'Baltic Flash', rival: 'RU',
    d: 'Rusko odpálilo taktickou jadernou zbraň nad Baltským mořem jako „poslední varování“ NATO. Svět čeká, co udělá Washington.',
    dEn: 'Russia has detonated a tactical nuclear weapon over the Baltic Sea as a “final warning” to NATO. The world is watching Washington.',
    esc: 45, will: 20, sup: 60, pres: 55, eco: 70, pk: 50, aggr: .5, defcon: 3,
    init: { GB: [60, -30, 'c'], FR: [50, -10, 'c'], DE: [45, 10, 'c'], PL: [70, -60, 'c'], TR: [15, 25], IN: [15, 35], JP: [40, -10], SA: [15, 20], BR: [5, 15], CN: [10, 45], KP: [-60, 50, 'b'], IR: [-60, 45, 'b'] },
  },
  pacific: {
    n: 'Tichomořská blokáda', en: 'Pacific Blockade', rival: 'CN',
    d: 'Čína vyhlásila námořní blokádu Tchaj-wanu a varovala, že každý zásah bude považován za válku s jadernými důsledky.',
    dEn: 'China has declared a naval blockade of Taiwan and warned that any intervention will be treated as war with nuclear consequences.',
    esc: 40, will: 25, sup: 58, pres: 55, eco: 65, pk: 50, aggr: .45, defcon: 3,
    init: { JP: [60, -30, 'c'], GB: [50, -10, 'c'], FR: [35, 10], DE: [30, 25], PL: [40, -5], TR: [10, 15], IN: [30, -20], SA: [15, 25], BR: [5, 25], RU: [-10, 45], KP: [-60, 60, 'b'], IR: [-50, 40, 'b'] },
  },
  coup: {
    n: 'Puč v Moskvě', en: 'Moscow Coup', rival: 'RU', volatile: true,
    d: 'Skupina generálů převzala moc v Moskvě a ovládá část jaderných sil. Jsou ochotni jednat, ale nikdo neví, kdo skutečně velí.',
    dEn: 'A group of generals has seized power in Moscow and controls part of the nuclear forces. They are willing to talk, but no one knows who is really in charge.',
    esc: 55, will: 35, sup: 55, pres: 50, eco: 65, pk: 55, aggr: .7, defcon: 3,
    init: { GB: [60, -30, 'c'], FR: [50, -10, 'c'], DE: [45, 5, 'c'], PL: [70, -60, 'c'], TR: [20, 15], IN: [20, 25], JP: [40, -10], SA: [20, 10], BR: [10, 5], CN: [10, 30], KP: [-60, 40, 'b'], IR: [-50, 30, 'b'] },
  },
};

const DIFF = {
  kadet: { n: 'Kadet', en: 'Cadet', d: 'Klidnější soupeř, rychlejší obnova kapitálu.', dEn: 'Calmer rival, faster capital regeneration.', aggr: .7, pk: 1.3, msg: .8, score: .8 },
  velitel: { n: 'Velitel', en: 'Commander', d: 'Vyvážená obtížnost.', dEn: 'Balanced difficulty.', aggr: 1, pk: 1, msg: 1, score: 1 },
  veteran: { n: 'Veterán', en: 'Veteran', d: 'Agresivní soupeř, víc požadavků, méně kapitálu.', dEn: 'Aggressive rival, more demands, less capital.', aggr: 1.6, pk: .65, msg: 1.4, score: 1.3 },
};

G.DATA = { COUNTRIES, US_POWER, PERS, INTERESTS, OFFERS, SCEN, DIFF };
})();
