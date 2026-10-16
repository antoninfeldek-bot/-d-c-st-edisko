# Velín Cheyenne Mountain

Webová strategická hra pro PC. Jste velitel směny v podzemním velínu NORAD v Cheyenne Mountain během 90 minut fiktivního jaderného konfliktu.

## Jak spustit

Otevřete `index.html` v prohlížeči. Hra nepotřebuje server ani instalaci, jen připojení k internetu kvůli fontům.

## Scénáře a obtížnost

- **Odvetný řetězec:** Rusko útočí na americká raketová sila. Ubráníte se a zastavíte eskalaci?
- **Tichý úder:** útok ruských ponorek z blízkosti pobřeží, varovací doba jen kolem 10 minut.
- **Podzim 83:** systém hlásí útok, ale je skutečný? Vyhrajete zdrženlivostí.

Obtížnost Kadet, Velitel nebo Veterán mění velikost vln, počet falešných poplachů a spolehlivost interceptorů.

## Co můžete dělat

- **Kontakty:** ověřování přes 3 kanály, výběr na mapě nebo v seznamu, střelba nejlepším dostupným prostředkem.
- **Obrana:** GMD (Fort Greely, Vandenberg), torpédoborce Aegis se střelami SM-3, které lze přesouvat mezi stanovišti, a stíhači F-22 proti bombardérům.
- **Strategické síly:** DEFCON, poplachový vzlet bombardérů, vyplutí ponorek z přístavů a letoun E-6B TACAMO pro spojení s ponorkami.
- **Zpravodajství:** satelitní průzkum s předpovědí další vlny, odposlech zrychlující ověřování, kybernetická operace a síť radarů, jejíž ztráta zkracuje varovací dobu.
- **Diplomacie:** horká linka se čtyřmi přístupy, konzultace NATO, britské a francouzské ponorky a zprostředkování Číny.
- **Civilní ochrana:** varování EAS pro města, celostátní poplach, evakuace prezidenta a viceprezidenta, projev k národu, Národní garda a týmy FEMA proti radioaktivnímu spadu.
- **Odveta:** plánovač úderu s výběrem cílů a nosičů (ICBM, SLBM, bombardéry, které lze odvolat), odhad dopadů a autorizace kódem z obálky SAS.
- **Rozhodovací karty:** během hry vyskakují dilemata, například použít, nebo ztratit sila, neautorizovaný start nebo hrozbu elektromagnetického impulzu.

Na konci směny dostanete hlášení s grafem průběhu a skóre. Tabulka nejlepších výsledků se ukládá v prohlížeči.

Klávesy: mezerník pauza, 1/2/3 rychlost, V ověřit, J/K další a předchozí kontakt, G nejlepší interceptor. Mapu lze přibližovat kolečkem a posouvat tažením.

## Struktura

- `index.html`: rozvržení
- `css/style.css`: vzhled
- `js/data.js`: mapa, základny, scénáře
- `js/sim.js`: simulace
- `js/events.js`: rozhodovací karty
- `js/map.js`: vykreslování mapy
- `js/ui.js`: panely a obrazovky
- `js/main.js`: start a herní smyčka

Fiktivní simulace. Čísla a postupy jsou zjednodušené a neodpovídají skutečným plánům.
