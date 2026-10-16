# Krizový štáb

Diplomatická strategická hra pro PC v češtině i angličtině. Jste poradce prezidenta pro národní bezpečnost a vedete krizový štáb Bílého domu ve chvíli, kdy je svět na pokraji jaderné války.

*A diplomatic strategy game in Czech and English. You run the White House Situation Room while the world stands on the brink of nuclear war.*

## Jak spustit

Otevřete `index.html` v prohlížeči. Hra nepotřebuje server ani instalaci, jen připojení k internetu kvůli fontům.

## Jak se hraje

Čas běží sám: jedna hodina krize trvá 5 sekund, celá krize 72 hodin. Hru můžete pozastavit (mezerník) nebo zrychlit (1/2/3). Naléhavé krize hru samy pozastaví.

- **Depeše** přicházejí automaticky: požadavky spojenců, nabídky neutrálních zemí, ultimáta soupeře a světové krize. Většina má lhůtu. Když ji nestihnete, použije se výchozí reakce.
- **Státy** mají vztah k USA i k soupeři, důvěru, povahu (jestřáb, holubice, pragmatik, oportunista) a skryté zájmy (ekonomika, bezpečnost, energie, prestiž). Rozhovorem zjistíte, co chtějí.
- **Diplomatické tahy:** rozhovor, šest typů nabídek, návrh aliance, nátlak a žádosti o sankce, zprostředkování nebo nasazení sil.
- **Horká linka se soupeřem:** příměří, tajný kanál, ultimátum, ústupek a sankce.
- **Domácí scéna a armáda:** projevy, briefingy, ropné rezervy, DEFCON, letadlové lodě, kybernetické operace a omezený úder.
- **Politický kapitál** platí za každý tah a obnovuje se podle podpory doma.
- **Koalice proti bloku:** síla koalice určuje odstrašení. Spojenci mohou odejít, neutrální státy přeběhnout k soupeři.
- **Hlasování v OSN** v 24. hodině odmění, kolik zemí máte na své straně.

**Vítězství:** dotlačte soupeře k mírové konferenci. Jeho ochota jednat musí dosáhnout 70, eskalace klesnout pod 40 a potřebujete dva kroky k míru. Na konferenci pak volíte tvrdé podmínky, kompromis, nebo ústupky.

**Prohra:** eskalace 100 znamená jadernou válku. Krizi prohrajete i ztrátou podpory, prestiže nebo ekonomiky. Po 72 hodinách bez dohody končí krize zamrzlým konfliktem.

## Scénáře

- **Baltský záblesk:** Rusko odpálilo varovnou jadernou zbraň nad Baltem.
- **Tichomořská blokáda:** Čína blokuje Tchaj-wan a soupeřem je Peking.
- **Puč v Moskvě:** generálové ovládli část jaderných sil a situace je nevyzpytatelná.

Obtížnost Kadet, Velitel nebo Veterán mění agresivitu soupeře, množství požadavků a obnovu kapitálu.

## Struktura

- `index.html`: rozvržení
- `css/style.css`: vzhled
- `js/util.js`: jazyk, formátování
- `js/i18n.js`: statické texty v obou jazycích
- `js/data.js`: státy, nabídky, scénáře
- `js/content.js`: depeše, krize, scénářové události
- `js/sim.js`: simulace, umělá inteligence států, tahy hráče
- `js/ui.js`: vykreslování panelů a závěrečné zprávy
- `js/main.js`: start, herní smyčka, klávesy

Fiktivní simulace. Postavy, čísla a události jsou smyšlené a zjednodušené.
