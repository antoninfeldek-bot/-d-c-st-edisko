'use strict';
// Static game data: coarse coastlines, sites, launch areas, scenarios, difficulty.
(() => {
const LAND = [
  [[71,-156],[70,-141],[69,-133],[68,-115],[67,-108],[68,-98],[66,-87],[70,-85],[73,-80],[70,-68],[66,-62],[60,-64],[56,-61],[52,-56],[47,-53],[46,-60],[44,-66],[42,-70],[41,-72],[40,-74],[37,-76],[35,-75.5],[32,-80],[30,-81],[27,-80],[25,-80.5],[27,-82.5],[30,-84],[30,-89],[29,-94],[26,-97],[22,-97.8],[19,-96],[18,-94],[21,-90],[21,-87],[18,-88],[16,-88],[15,-84],[11,-83.5],[9,-79],[8,-77],[7,-78],[9,-80],[8,-83],[13,-88],[16,-95],[19,-105],[23,-106],[27,-111],[31,-113],[24,-110],[23,-110],[27,-114],[32,-117],[34,-119],[35,-121],[38,-123],[40,-124],[43,-124.5],[46,-124],[48,-124.7],[50,-128],[54,-131],[58,-136],[60,-141],[60,-147],[59,-152],[57,-157],[55,-162],[58,-162],[61,-166],[64,-165],[66,-168],[68,-166],[71,-156]],
  [[60,-44],[61,-48],[65,-52],[69,-51],[71,-55],[75,-58],[77,-68],[79,-72],[82,-62],[83.5,-40],[82,-22],[79,-18],[75,-19],[71,-22],[68,-30],[65,-38],[62,-42],[60,-44]],
  [[63,-65],[66,-62],[70,-68],[73,-78],[71,-86],[68,-80],[64,-78],[62,-72],[63,-65]],
  [[76,-80],[79,-75],[82,-65],[83,-75],[80,-95],[77,-95],[76,-80]],
  [[69,-105],[70,-118],[73,-118],[73,-105],[69,-105]],
  [[63.5,-22],[64,-14],[65.5,-13.5],[66.5,-16],[66,-23],[65,-24],[63.5,-22]],
  [[50,-5.5],[51,1.5],[53,0.5],[55,-1.5],[57.5,-1.8],[58.6,-3],[58.5,-5],[56,-6],[54.5,-3.4],[53,-4.6],[51.5,-5],[50,-5.5]],
  [[51.5,-9.8],[54,-10],[55.3,-7.5],[54,-6],[52,-6.3],[51.5,-9.8]],
  [[58,6],[59,10],[59,11.5],[56,12.5],[55.5,14],[58,16.5],[61,17],[63.5,20],[65.7,22.5],[67,24],[69,28],[71,26],[71,24],[70,19],[68,15],[66,13],[64,10],[62,5],[60,5],[58,6]],
  [[36,-6],[43,-9],[43.5,-1.5],[46.5,-1.5],[48.5,-4.7],[49.5,0],[51,2],[53.5,5],[54,8.5],[54,11],[54.5,14],[54.5,19],[57,21],[59.5,24],[60.5,29],[65,34],[66.5,33],[66,40],[68,44],[68.5,54],[69,60],[73,70],[70,73],[72.5,80],[74,87],[76,100],[77.5,105],[74,113],[73,120],[72,130],[71,140],[71,152],[70,160],[69.5,170],[67,-175],[65.5,-170],[64.5,-173],[62,179],[60,170],[57,163],[51,156.5],[57,156],[59.5,154],[59,143],[54,137],[53,141],[48,140],[43,135],[40,129],[38,128.5],[35,129],[34.5,126.5],[37.5,126.5],[39,125],[39,121.5],[40.5,122],[37.5,119],[35,119.5],[32,121.5],[30,122],[25,119.5],[22,114],[21.5,108],[19,106],[16,108],[11,109],[9,105],[10.5,104],[13.5,100],[8,100.5],[1.3,104],[4,100.5],[8,98.3],[16.5,97.5],[16,94.5],[20.5,92.3],[22,88.5],[21,86.5],[15.5,80.2],[10,79.8],[8,77.5],[12,75],[19,72.8],[22.5,70],[23.5,68],[25,61.5],[26.5,57],[24,56.5],[22.5,59.8],[18,56.5],[15,51],[12.7,45],[13,43.3],[17,42.5],[21,39],[27.5,35],[30,32.5],[31,32],[31.5,34.5],[33,35],[36,36],[36.5,30],[37,27.5],[40,26.2],[41,26],[40.5,23],[39,20.5],[40.5,19.4],[42.5,18],[45.5,13.5],[44.5,12.3],[42,15.5],[40,18.5],[38,16],[38,15.6],[40,15.5],[41.2,13],[43,10.5],[44,8.5],[43.2,5.5],[43,3],[41.5,2.2],[39.5,-0.3],[37,-2],[36.7,-4.5],[36,-6]],
  [[35.8,-5.9],[34,-7],[31,-9.8],[28,-13],[21,-17],[15,-17.5],[10,-15],[7,-12],[4.5,-7.5],[5,-2],[6,2],[4,6],[4.5,9],[-1,9],[-5,12],[-12,13.5],[-17,11.7],[-23,14.5],[-29,16.5],[-34.5,19.5],[-34,26],[-30,31],[-25,33],[-20,35],[-15,40.5],[-10,40],[-5,39],[-1,42],[2,45],[5,48],[10,51],[11.8,51],[11.5,43.5],[15,39.5],[19,37.5],[22,36.8],[27,34],[30,32.5],[31.5,30],[31,25],[32.5,23],[31,20],[32.5,15],[33,11],[37,10.5],[37,7],[36.8,3],[35.5,0],[35.8,-5.9]],
  [[12,-72],[11,-75],[9,-77],[7,-78],[1,-80],[-5,-81],[-15,-75],[-10,-50],[-5,-35],[0,-50],[5,-52],[7,-58],[10,-62],[10.5,-67],[12,-72]],
  [[31,130.5],[34,130.8],[35.5,133],[36,136],[37.5,137],[40.5,140],[41.5,140.5],[43.5,141.5],[45.5,142],[44,145],[42.5,143.5],[41.5,141],[38,141],[35,140.5],[34.5,138.5],[33.5,135.5],[33,132],[31,130.5]],
  [[46,142],[50,142.2],[54.3,142.7],[52,143.5],[47,143.5],[46,142]],
  [[70.5,57],[72,52],[74.5,55],[76.5,62],[77,68],[75,60],[72.5,57],[70.5,57]],
  [[77,15],[78.5,11],[80,17],[80,27],[78,24],[77,15]],
  [[78,100],[80,92],[81,97],[79.5,105],[78,100]],
  [[22,-84.5],[23,-82],[23,-80],[21.5,-77],[20,-74.5],[20,-77.5],[21.5,-79],[22,-84.5]]
];
const WATER = [
  [[63,-94],[60,-94],[57,-92],[55,-85],[52,-80],[56,-77],[60,-78],[62,-78],[64,-87],[63,-94]],
  [[41.2,29],[41.7,32],[42,35],[41.5,38],[41.5,41.5],[44,39],[45.2,37],[47,38.5],[46,34],[46.5,31],[45,29.6],[43.5,28.5],[42,28],[41.2,29]],
  [[47,51],[45,53],[42,53],[40,53],[37,54],[37,50],[39,49],[41,49],[42.5,47.5],[44.5,47],[47,49],[47,51]]
];

const SITES = {
  // cities: pop in millions (metro area)
  DC:{n:'Washington D.C.',s:'WASHINGTON',lat:38.9,lon:-77.04,type:'city',pop:6.3},
  NYC:{n:'New York',s:'NEW YORK',lat:40.71,lon:-74.0,type:'city',pop:19.5},
  BOS:{n:'Boston',s:'BOSTON',lat:42.36,lon:-71.06,type:'city',pop:4.9},
  CHI:{n:'Chicago',s:'CHICAGO',lat:41.88,lon:-87.63,type:'city',pop:9.4},
  ATL:{n:'Atlanta',s:'ATLANTA',lat:33.75,lon:-84.39,type:'city',pop:6.1},
  HOU:{n:'Houston',s:'HOUSTON',lat:29.76,lon:-95.37,type:'city',pop:7.1},
  DEN:{n:'Denver',s:'DENVER',lat:39.74,lon:-104.99,type:'city',pop:2.9,left:1},
  LA:{n:'Los Angeles',s:'LOS ANGELES',lat:34.05,lon:-118.24,type:'city',pop:13.2},
  SF:{n:'San Francisco',s:'SAN FRANCISCO',lat:37.77,lon:-122.42,type:'city',pop:4.7,left:1},
  SEA:{n:'Seattle',s:'SEATTLE',lat:47.61,lon:-122.33,type:'city',pop:4.0},
  // strategic forces
  MALM:{n:'Malmstrom AFB',s:'MALMSTROM',lat:47.5,lon:-111.18,type:'silo',missiles0:150},
  MINOT:{n:'Minot AFB',s:'MINOT',lat:48.42,lon:-101.36,type:'silo',missiles0:150,up:1},
  WARREN:{n:'F. E. Warren AFB',s:'WARREN',lat:41.13,lon:-104.87,type:'silo',missiles0:150},
  WHITEMAN:{n:'Whiteman AFB (B-2)',s:'WHITEMAN',lat:38.73,lon:-93.55,type:'base'},
  BARKSDALE:{n:'Barksdale AFB (B-52)',s:'BARKSDALE',lat:32.5,lon:-93.66,type:'base'},
  KINGS:{n:'Kings Bay (ponorky SSBN)',en:'Kings Bay (SSBN submarines)',s:'KINGS BAY',lat:30.8,lon:-81.56,type:'base'},
  BANGOR:{n:'Bangor (ponorky SSBN)',en:'Bangor (SSBN submarines)',s:'BANGOR',lat:47.73,lon:-122.71,type:'base',left:1},
  TINKER:{n:'Tinker AFB (E-6B TACAMO)',s:'TINKER',lat:35.41,lon:-97.39,type:'base'},
  OFFUTT:{n:'Offutt AFB (STRATCOM)',s:'OFFUTT',lat:41.12,lon:-95.91,type:'base'},
  NORFOLK:{n:'Námořní základna Norfolk',en:'Naval Station Norfolk',s:'NORFOLK',lat:36.95,lon:-76.33,type:'base'},
  // defence
  GREELY:{n:'Fort Greely (GMD)',s:'GREELY',lat:63.98,lon:-145.73,type:'gmd',stock0:12},
  VAFB:{n:'Vandenberg (GMD)',s:'VANDENBERG',lat:34.73,lon:-120.57,type:'gmd',stock0:4,left:1},
  ELM:{n:'JB Elmendorf (F-22)',s:'ELMENDORF',lat:61.25,lon:-149.8,type:'air',fighters0:6,left:1},
  LANGLEY:{n:'JB Langley (F-22)',s:'LANGLEY',lat:37.08,lon:-76.36,type:'air',fighters0:4,left:1},
  // early warning radars
  THULE:{n:'Pituffik / Thule (radar)',s:'THULE',lat:76.53,lon:-68.7,type:'radar'},
  CLEAR:{n:'Clear (radar)',s:'CLEAR',lat:64.29,lon:-149.19,type:'radar'},
  CAPECOD:{n:'Cape Cod (radar)',s:'CAPE COD',lat:41.75,lon:-70.54,type:'radar'},
  BEALE:{n:'Beale (radar)',s:'BEALE',lat:39.11,lon:-121.36,type:'radar',left:1},
  FYLING:{n:'Fylingdales (radar, UK)',s:'FYLINGDALES',lat:54.36,lon:-0.67,type:'radar',safe:1},
  CMOC:{n:'Cheyenne Mountain',s:'NORAD',lat:38.74,lon:-104.85,type:'hq'},
};
const RADARS = ['THULE','CLEAR','CAPECOD','BEALE','FYLING'];
const SILOS = ['MALM','MINOT','WARREN'];

const LAUNCH = {
  ICBM:[['Kozelsk',54.03,35.78],['Tatiščevo',51.67,45.6,null,'Tatishchevo'],['Tějkovo',56.93,40.53,null,'Teykovo'],['Jasnyj',51.1,59.85,null,'Yasny'],['Užur',55.3,89.83,null,'Uzhur'],['Novosibirsk',55.0,83.0],['Irkutsk',52.3,104.3],['Barnaul',53.3,83.8]],
  SLBM:[['Barentsovo moře',73,40,'arc','Barents Sea'],['severní Atlantik',47,-42,'atl','North Atlantic'],['severní Pacifik',44,-158,'pac','North Pacific'],['Ochotské moře',55,150,'pac','Sea of Okhotsk'],['Norské moře',68,2,'arc','Norwegian Sea']],
  BMB:[['Engels',51.48,46.2],['Ukrajinka',51.17,128.4,null,'Ukrainka'],['Olenja',68.15,33.46,null,'Olenya']],
};
const POOL = {
  ICBM:{MALM:9,MINOT:9,WARREN:9,OFFUTT:4,GREELY:4,VAFB:3,CMOC:2,DC:5,NYC:5,CHI:4,LA:4,HOU:3,SEA:3,SF:3,BOS:2,ATL:3,DEN:2,ELM:2,KINGS:2,BANGOR:2,NORFOLK:2,WHITEMAN:3,BARKSDALE:2,TINKER:1,CLEAR:2,BEALE:2,THULE:2},
  atl:{DC:6,NYC:5,BOS:4,NORFOLK:4,KINGS:4,ATL:2,CAPECOD:2,LANGLEY:2},
  pac:{SEA:4,SF:4,LA:5,BANGOR:4,VAFB:3,ELM:2,GREELY:2,BEALE:2,CLEAR:1},
  BMB:{ELM:4,GREELY:3,SEA:3,BANGOR:2,MINOT:2,THULE:2,CLEAR:2},
};

// Retaliation target sets (abstract numbers)
const RU_SETS = {
  cf:{n:'Sila ICBM',en:'ICBM silos',d:'Odpalovací pole raket. Sníží ruský arzenál.',dEn:'Missile fields. Reduces the Russian arsenal.',
      targets:[[54.03,35.78],[51.67,45.6],[56.93,40.53],[51.1,59.85],[55.3,89.83],[55.0,83.0],[52.3,104.3],[53.3,83.8]],esc:15,cred:15,cas:1.2,missiles:30},
  nav:{n:'Námořní a letecké základny',en:'Naval and air bases',d:'Omezí útoky ponorek a bombardérů.',dEn:'Curbs submarine and bomber attacks.',
      targets:[[69.07,33.42],[52.93,158.4],[51.48,46.2],[51.17,128.4],[68.15,33.46]],esc:8,cred:10,cas:0.6,missiles:15},
  c2:{n:'Velitelská centra',en:'Command centres',d:'Ochromí koordinaci útoků, ale nebude s kým jednat.',dEn:'Paralyses attack coordination, but leaves no one to negotiate with.',
      targets:[[55.75,37.6],[59.5,59.0],[54.25,58.1]],esc:25,cred:15,cas:3,missiles:12},
  cv:{n:'Průmysl a města',en:'Industry and cities',d:'Odveta proti obyvatelstvu. Obrovské oběti.',dEn:'Retaliation against the population. Enormous casualties.',
      targets:[[55.75,37.6],[59.9,30.3],[56.8,60.6],[43.1,131.9],[55.0,82.9],[53.2,50.1],[48.7,44.5],[56.3,44.0]],esc:40,cred:20,cas:40,missiles:40},
};
const PLATFORMS = {
  icbm:{n:'ICBM Minuteman III',s:'ICBM',ft:1650,d:'Dopad za ~28 min. Rakety ze sil, která ještě stojí.',dEn:'Impact in ~28 min. Missiles from silos still standing.'},
  slbm:{n:'SLBM Trident II',s:'SLBM',ft:900,d:'Dopad za ~15 min. Vyžaduje spojení E-6B TACAMO.',dEn:'Impact in ~15 min. Requires the E-6B TACAMO link.'},
  bomb:{n:'Bombardéry s ALCM',en:'Bombers with ALCM',s:'Bombardéry',sEn:'Bombers',ft:10800,d:'Dopad za ~3 h. Jen bombardéry ve vzduchu. Lze odvolat.',dEn:'Impact in ~3 h. Airborne bombers only. Can be recalled.'},
};
const SSBN_PATROL = [[40,-38],[62,-20],[45,-150],[30,-165]];

const STATIONS = {
  natl:{n:'Severní Atlantik',en:'North Atlantic',lat:44,lon:-50},
  nor:{n:'Norské moře',en:'Norwegian Sea',lat:67,lon:2},
  east:{n:'Východní pobřeží',en:'East Coast',lat:37,lon:-70},
  npac:{n:'Severní Pacifik',en:'North Pacific',lat:47,lon:-160},
  bering:{n:'Beringovo moře',en:'Bering Sea',lat:58,lon:-175},
  west:{n:'Západní pobřeží',en:'West Coast',lat:38,lon:-128},
};
const SHIPS0 = [
  {id:'DDG-64',name:'USS Carney',st:'natl'},
  {id:'DDG-78',name:'USS Porter',st:'east'},
  {id:'DDG-89',name:'USS Mustin',st:'npac'},
];
const WINGS0 = [
  {id:'b52m',name:'5. křídlo B-52',en:'5th Bomb Wing B-52',base:'MINOT',n:10},
  {id:'b2',name:'509. křídlo B-2',en:'509th Bomb Wing B-2',base:'WHITEMAN',n:8},
  {id:'b52b',name:'2. křídlo B-52',en:'2nd Bomb Wing B-52',base:'BARKSDALE',n:10},
];

const SCEN = {
  standard:{n:'Odvetný řetězec',en:'Chain of Retaliation',d:'Rusko zahájilo úder na americká raketová sila. Ubráníte se a zastavíte eskalaci?',dEn:'Russia has struck the American missile fields. Can you defend and stop the escalation?',
    esc:35,cred:70,arsenal:150,slbm:.33,bmb:.12,firstWave:420},
  subs:{n:'Tichý úder',en:'Silent Strike',d:'Ruské ponorky útočí z blízkosti pobřeží. Varovací doba je jen kolem 10 minut a Washington je v ohrožení.',dEn:'Russian submarines strike from close to the coast. Warning time is only about 10 minutes and Washington is at risk.',
    esc:45,cred:65,arsenal:100,slbm:.7,bmb:.05,firstWave:480},
  petrov:{n:'Podzim 83',en:'Autumn 83',d:'Systém včasné výstrahy hlásí útok, ale satelity a radary si odporují. Je to skutečné? Zdrženlivost může zachránit svět.',dEn:'Early warning reports an attack, but satellites and radars disagree. Is it real? Restraint may save the world.',
    esc:25,cred:70,arsenal:150,slbm:.3,bmb:.1,firstWave:600,petrov:true},
};
const DIFF = {
  kadet:{n:'Kadet',en:'Cadet',d:'Menší vlny, spolehlivější interceptory.',dEn:'Smaller waves, more reliable interceptors.',wave:.7,falseP:.25,pk:1.15,score:.8},
  velitel:{n:'Velitel',en:'Commander',d:'Vyvážená obtížnost.',dEn:'Balanced difficulty.',wave:1,falseP:.35,pk:1,score:1},
  veteran:{n:'Veterán',en:'Veteran',d:'Větší vlny, víc falešných poplachů.',dEn:'Bigger waves, more false alarms.',wave:1.3,falseP:.45,pk:.85,score:1.3},
};

G.DATA = { LAND, WATER, SITES, RADARS, SILOS, LAUNCH, POOL, RU_SETS, PLATFORMS, SSBN_PATROL, STATIONS, SHIPS0, WINGS0, SCEN, DIFF };
})();
