// ===================== SEED-DATA (stand 30-10-2026) =====================
// Bronnen: Wikipedia-seizoenspagina's 2026–27 (teamlijsten, programma's, uitslagen voor zover daar vermeld),
// KNVB Promotie- en degradatieregeling 2026/'27, football-coefficient.eu (landencoëfficiënt),
// FIFA/Coca-Cola World Ranking 7-10-2026 (startwaarden nationale teams).
const SEED_DATE = '2026-10-30';

const SEED_COEF = [ // UEFA-landencoëfficiënt, live-stand periode 2022/23–2026/27 (football-coefficient.eu, eind okt. 2026)
  {cc:'ENG', name:'Engeland', coef:98.520},
  {cc:'ITA', name:'Italië', coef:84.232},
  {cc:'ESP', name:'Spanje', coef:78.621},
  {cc:'GER', name:'Duitsland', coef:76.690},
  {cc:'FRA', name:'Frankrijk', coef:65.083},
  {cc:'POR', name:'Portugal', coef:60.850},
  {cc:'BEL', name:'België', coef:56.150},
  {cc:'NED', name:'Nederland', coef:49.146},
  {cc:'TUR', name:'Turkije', coef:45.975},
  {cc:'POL', name:'Polen', coef:43.025},
  {cc:'CZE', name:'Tsjechië', coef:42.025}
];

const Z = (from,to,type,extra) => Object.assign({from,to,type},extra||{});
const SEED_COMPS = [
  {id:'ENG1', name:'Premier League', short:'PL', type:'league', cc:'ENG', tier:1, format:{kind:'league', rr:2, teams:20, rounds:38, tiebreak:['pts','gd','gf'],
    zones:[Z(1,1,'champ'),Z(1,4,'cl'),Z(5,5,'el'),Z(6,6,'ecl',{assumed:true}),Z(18,20,'rel')]},
    notes:['Plaats 6 → Conference League is een aanname: in Engeland hangen EL/ECL-tickets af van FA Cup- en League Cup-winnaars.']},
  {id:'ITA1', name:'Serie A', short:'SA', type:'league', cc:'ITA', tier:1, format:{kind:'league', rr:2, teams:20, rounds:38, tiebreak:['pts','gd','gf'],
    zones:[Z(1,1,'champ'),Z(1,4,'cl'),Z(5,5,'el'),Z(6,6,'ecl'),Z(18,20,'rel')]}, notes:['Onderling resultaat als eerste tiebreaker is in de simulatie vereenvoudigd tot doelsaldo/doelpunten.']},
  {id:'ESP1', name:'La Liga', short:'LL', type:'league', cc:'ESP', tier:1, format:{kind:'league', rr:2, teams:20, rounds:38, tiebreak:['pts','gd','gf'],
    zones:[Z(1,1,'champ'),Z(1,4,'cl'),Z(5,5,'el'),Z(6,6,'ecl'),Z(18,20,'rel')]}, notes:['Onderling resultaat als tiebreaker vereenvoudigd tot doelsaldo/doelpunten.']},
  {id:'GER1', name:'Bundesliga', short:'BL', type:'league', cc:'GER', tier:1, format:{kind:'league', rr:2, teams:18, rounds:34, tiebreak:['pts','gd','gf'],
    zones:[Z(1,1,'champ'),Z(1,4,'cl'),Z(5,5,'el'),Z(6,6,'ecl'),Z(16,16,'relpo'),Z(17,18,'rel')]}, notes:['Nr. 16 speelt een play-off tegen de nr. 3 van de 2. Bundesliga; de uitkomst daarvan wordt niet gesimuleerd.']},
  {id:'FRA1', name:'Ligue 1', short:'L1', type:'league', cc:'FRA', tier:1, format:{kind:'league', rr:2, teams:18, rounds:34, tiebreak:['pts','gd','gf'],
    zones:[Z(1,1,'champ'),Z(1,3,'cl'),Z(4,4,'clq'),Z(5,5,'el'),Z(6,6,'ecl'),Z(16,16,'relpo'),Z(17,18,'rel')]}, notes:['Nr. 16 speelt een barrage tegen Ligue 2; uitkomst niet gesimuleerd.']},
  {id:'POR1', name:'Liga Portugal', short:'LP', type:'league', cc:'POR', tier:1, format:{kind:'league', rr:2, teams:18, rounds:34, tiebreak:['pts','gd','gf'],
    zones:[Z(1,1,'champ'),Z(1,2,'cl'),Z(3,3,'clq'),Z(4,4,'el'),Z(5,5,'ecl'),Z(16,16,'relpo'),Z(17,18,'rel')]}, notes:['Nr. 16 speelt tegen de nr. 3 van Liga Portugal 2; uitkomst niet gesimuleerd.']},
  {id:'BEL1', name:'Jupiler Pro League', short:'JPL', type:'league', cc:'BEL', tier:1, format:{kind:'league', rr:2, teams:18, rounds:34, tiebreak:['pts','w','gd','gf'],
    zones:[Z(1,1,'champ'),Z(1,1,'cl'),Z(2,2,'clq'),Z(3,3,'el'),Z(4,4,'ecl'),Z(17,18,'rel')]}, notes:['Vanaf 2026/27: 18 clubs, gewone competitie zonder play-offs, onderste twee degraderen (Wikipedia 2026–27 Belgian Pro League).']},
  {id:'NED1', name:'Eredivisie', short:'ERE', type:'league', cc:'NED', tier:1, format:{kind:'league', rr:2, teams:18, rounds:34, tiebreak:['pts','gd','gf'], link:'NED2',
    zones:[Z(1,1,'champ'),Z(1,1,'cl'),Z(2,2,'clq'),Z(3,3,'el'),Z(4,7,'eurpo',{assumed:true}),Z(16,16,'relpo'),Z(17,18,'rel')]},
    notes:['KNVB-regeling 2026/27: nrs. 17 en 18 degraderen rechtstreeks, nr. 16 speelt de play-off promotie/degradatie (finale tegen de beste KKD-club uit de play-offs).','Plaatsen 4–7 → play-offs Europees voetbal is een aanname (afhankelijk van bekerwinnaar).']},
  {id:'TUR1', name:'Süper Lig', short:'SL', type:'league', cc:'TUR', tier:1, format:{kind:'league', rr:2, teams:18, rounds:34, tiebreak:['pts','gd','gf'],
    zones:[Z(1,1,'champ'),Z(1,1,'cl'),Z(2,2,'clq'),Z(3,3,'el'),Z(4,4,'ecl'),Z(16,18,'rel')]}, notes:[]},
  {id:'POL1', name:'Ekstraklasa', short:'EK', type:'league', cc:'POL', tier:1, format:{kind:'league', rr:2, teams:18, rounds:34, tiebreak:['pts','gd','gf'],
    zones:[Z(1,1,'champ'),Z(1,2,'clq'),Z(3,3,'el'),Z(4,4,'ecl'),Z(16,18,'rel')]}, notes:['Polen staat 10e, net vóór Tsjechië (verschil ±1 punt); controleer de ranglijst bij de start van een nieuw seizoen.']},
  {id:'NED2', name:'Keuken Kampioen Divisie', short:'KKD', type:'league', cc:'NED', tier:2, parent:'NED1', fixed:true, format:{kind:'league', rr:2, teams:20, rounds:38, tiebreak:['pts','gd','gf'], link:'NED1',
    ineligible:['jong-ajax','jong-az','jong-psv','jong-fc-utrecht'], parents:{'jong-ajax':'ajax','jong-az':'az','jong-psv':'psv','jong-fc-utrecht':'utrecht'},
    zones:[Z(1,1,'champ'),Z(1,2,'promo',{eligibleOnly:true})],
    periods:[[1,9],[10,19],[20,29],[30,38]], periodsAssumed:true,
    playoff:{kkdSpots:6, ladder:[4,2,0,1], external:{comp:'NED1', pos:16}, assumed:true}},
    notes:['KNVB-regeling 2026/27: de twee hoogst geëindigde eerste elftallen promoveren rechtstreeks; Jong-teams kunnen niet promoveren en zijn uitgesloten van de play-offs (plek schuift door).',
      'Play-off: 4 periodekampioenen + 2 hoogst geëindigde eerste elftallen zonder ticket, plus de nr. 16 van de Eredivisie, strijden om één plek.',
      'Geen degradatie van eerste elftallen naar de Tweede Divisie in 2026/27 (art. 9). Een Jong-team degradeert wel als het eerste elftal uit de Eredivisie degradeert (art. 10).',
      'Aanname: periodes = speelronde 1–9, 10–19, 20–29, 30–38 (reglement periodekampioenschappen niet ingezien).',
      'Aanname play-offschema (zoals 2025/26): ronde 1 met de 4 laagst geplaatste deelnemers, ronde 2 met de 2 hoogst geplaatste, ronde 3, finale tegen nr. 16 Eredivisie; alles over twee duels.']},
  {id:'UCL', name:'Champions League', short:'CL', type:'euro', format:{kind:'euro', lpMatches:8, direct:8, playoffTo:24, finalNeutral:true}, notes:['Competitiefase 8 duels, top 8 direct naar 1/8e finale, 9–24 naar knock-out play-offs (Wikipedia 2026–27 UCL league phase).']},
  {id:'UEL', name:'Europa League', short:'EL', type:'euro', format:{kind:'euro', lpMatches:8, direct:8, playoffTo:24, finalNeutral:true}, notes:[]},
  {id:'UECL', name:'Conference League', short:'ECL', type:'euro', format:{kind:'euro', lpMatches:6, direct:8, playoffTo:24, finalNeutral:true}, notes:['Competitiefase 6 duels (zes potten).']},
  {id:'UNL', name:'Nations League', short:'UNL', type:'nation', format:{kind:'groups', nl:true, rr:2, importance:'nl', tiebreak:['pts','gd','gf']},
    notes:['League A: nrs. 1–2 naar kwartfinales (twee duels, groepswinnaar thuis in 2e duel), Finals in juni 2027.','Promotie/degradatie per league volgens Wikipedia 2026–27 UNL; play-offs zelf worden niet gesimuleerd.','Onderling resultaat (eerste tiebreaker) vereenvoudigd tot doelsaldo/doelpunten.']},
  {id:'EUROQ', name:'EK-kwalificatie 2028', short:'EKQ', type:'nation', format:{kind:'groups', rr:2, importance:'qual', tiebreak:['pts','gd','gf'], groupZones:[{pos:1,type:'q'},{pos:2,type:'qpo'}]},
    notes:['Format nog niet vastgesteld door UEFA (afhankelijk van goedkeuring EK 2028-reglement). Template: groepswinnaars geplaatst, nrs. 2 naar play-offs. Groepen importeren via JSON.']},
  {id:'EURO', name:'EK 2028', short:'EK', type:'nation', format:{kind:'tournament', importance:'final', groupRR:1, perGroup:2, bestThirds:4, host:[], neutral:true},
    notes:['Template 24 landen: 6 groepen van 4, top 2 + 4 beste nummers 3 naar 1/8e finale. Deelnemers en groepen nog onbekend → importeren.','Gastlanden (VK/Ierland) spelen thuis; stel in via format.host.']},
  {id:'WC', name:'WK 2030', short:'WK', type:'nation', format:{kind:'tournament', importance:'final', groupRR:1, perGroup:2, bestThirds:8, host:[], neutral:true},
    notes:['Template 48 landen: 12 groepen van 4, top 2 + 8 beste nummers 3 naar 1/16e finale. Deelnemers onbekend → importeren.']},
  {id:'FRIENDLY', name:'Interlands', short:'INT', type:'nation', format:{kind:'matches', importance:'friendly'}, notes:['Losse (vriendschappelijke) interlands: alleen voorspelling en Elo-update.']}
];

const SEED_TEAMS = {
 ENG1:['Arsenal','Aston Villa','Bournemouth','Brentford','Brighton & Hove Albion','Chelsea','Coventry City','Crystal Palace','Everton','Fulham','Hull City','Ipswich Town','Leeds United','Liverpool','Manchester City','Manchester United','Newcastle United','Nottingham Forest','Sunderland','Tottenham Hotspur'],
 ITA1:['Atalanta','Bologna','Cagliari','Como','Fiorentina','Frosinone','Genoa','Inter Milan','Juventus','Lazio','Lecce','AC Milan','Monza','Napoli','Parma','Roma','Sassuolo','Torino','Udinese','Venezia'],
 ESP1:['Alavés','Athletic Bilbao','Atlético Madrid','Barcelona','Celta Vigo','Deportivo A Coruña','Elche','Espanyol','Getafe','Levante','Málaga','Osasuna','Racing Santander','Rayo Vallecano','Real Betis','Real Madrid','Real Sociedad','Sevilla','Valencia','Villarreal'],
 GER1:['FC Augsburg','Union Berlin','Werder Bremen','Borussia Dortmund','SV Elversberg','Eintracht Frankfurt','SC Freiburg','Hamburger SV','TSG Hoffenheim','1. FC Köln','RB Leipzig','Bayer Leverkusen','Mainz 05','Borussia Mönchengladbach','Bayern Munich','SC Paderborn','Schalke 04','VfB Stuttgart'],
 FRA1:['Angers','Auxerre','Brest','Le Havre','Le Mans','Lens','Lille','Lorient','Lyon','Marseille','Monaco','Nice','Paris FC','Paris Saint-Germain','Rennes','Strasbourg','Toulouse','Troyes'],
 POR1:['Académico de Viseu','Alverca','Arouca','Benfica','Braga','Casa Pia','Estoril Praia','Estrela da Amadora','Famalicão','Gil Vicente','Marítimo','Moreirense','Nacional','Porto','Rio Ave','Santa Clara','Sporting CP','Vitória de Guimarães'],
 BEL1:['Anderlecht','Antwerp','Beveren','Cercle Brugge','Charleroi','Club Brugge','Genk','Gent','Kortrijk','La Louvière','Lommel SK','Mechelen','OH Leuven','Sint-Truiden','Standard Liège','Union SG','Westerlo','Zulte Waregem'],
 NED1:['ADO Den Haag','Ajax','AZ','Cambuur','Excelsior','Feyenoord','Fortuna Sittard','Go Ahead Eagles','Groningen','Heerenveen','NEC','PEC Zwolle','PSV','Sparta Rotterdam','Telstar','Twente','Utrecht','Willem II'],
 TUR1:['Alanyaspor','Amedspor','Başakşehir','Beşiktaş','Çorum','Erzurumspor','Eyüpspor','Fenerbahçe','Galatasaray','Gaziantep','Gençlerbirliği','Göztepe','Kasımpaşa','Kocaelispor','Konyaspor','Rizespor','Samsunspor','Trabzonspor'],
 POL1:['Cracovia','GKS Katowice','Górnik Zabrze','Jagiellonia Białystok','Korona Kielce','Lech Poznań','Legia Warsaw','Motor Lublin','Piast Gliwice','Pogoń Szczecin','Radomiak Radom','Raków Częstochowa','Śląsk Wrocław','Widzew Łódź','Wieczysta Kraków','Wisła Kraków','Wisła Płock','Zagłębie Lubin'],
 NED2:['Almere City','De Graafschap','Den Bosch','Dordrecht','Eindhoven','Emmen','Helmond Sport','Heracles Almelo','Jong Ajax','Jong AZ','Jong PSV','Jong FC Utrecht','MVV Maastricht','NAC Breda','RKC Waalwijk','Roda JC Kerkrade','TOP Oss','Vitesse','Volendam','VVV-Venlo']
};
const SEED_PROMOTED = ['Coventry City','Ipswich Town','Hull City','Venezia','Frosinone','Monza','Racing Santander','Deportivo A Coruña','Málaga','Schalke 04','SV Elversberg','SC Paderborn','Troyes','Le Mans','Marítimo','Académico de Viseu','Beveren','Kortrijk','Lommel SK','ADO Den Haag','Cambuur','Willem II','Erzurumspor','Amedspor','Çorum','Wisła Kraków','Śląsk Wrocław','Wieczysta Kraków'];
const SEED_RELEGATED_INTO_2ND = ['Heracles Almelo','NAC Breda','Volendam'];

// UEFA-clubcoëfficiënten 2026 (uit de potindelingen van CL/EL/ECL 2026–27) + land voor clubs buiten de 11 competities
const SEED_CLUBCOEF = {'Paris Saint-Germain':132,'Bayern Munich':147.5,'Real Madrid':144.5,'Liverpool':130,'Inter Milan':127,'Manchester City':125.5,'Arsenal':119,'Barcelona':113.25,'Atlético Madrid':104.75,'Borussia Dortmund':100.75,'Roma':97.75,'Sporting CP':84,'Aston Villa':83,'Porto':80.75,'Manchester United':76.5,'Club Brugge':75.25,'Real Betis':74.5,'PSV':71.25,'Feyenoord':71,'Lille':68.75,'Bodø/Glimt':64,'Napoli':63,'RB Leipzig':61,'Villarreal':59,'Fenerbahçe':57.75,'Shakhtar Donetsk':56.25,'Galatasaray':53.5,'Slavia Prague':44,'Slovan Bratislava':36,'VfB Stuttgart':27.5,'AEK Athens':24,'LASK':21,'Como':19.989,'Lens':16.699,'Viking':8.247,'Sabah':6,
 'Bayer Leverkusen':105,'Benfica':90,'Juventus':72.25,'AC Milan':66,'Lyon':65.75,'AZ':62.875,'Olympiacos':62.25,'Real Sociedad':57,'Marseille':54,'Ferencváros':51.25,'Viktoria Plzeň':50.5,'Union SG':48,'Dinamo Zagreb':46.5,'Red Bull Salzburg':45,'Celtic':44,'Sparta Prague':38.25,'Rennes':35,'Anderlecht':30.75,'Sturm Graz':28,'Lech Poznań':27.25,'Crystal Palace':23.903,'Bournemouth':23.903,'Sunderland':23.903,'Celje':23,'Jagiellonia Białystok':22,'Omonia':21.25,'Celta Vigo':19.409,'TSG Hoffenheim':18.58,'Beşiktaş':15.5,'Torreense':14.633,"Hapoel Be'er Sheva":14,'NEC':13.585,'OFI':9.682,'Lillestrøm':8.247,'Levski Sofia':7,'Ararat-Armenia':7,
 'Atalanta':84,'Braga':63.75,'Ajax':58.25,'SC Freiburg':56.5,'Monaco':56,'Copenhagen':54.375,'Midtjylland':48.25,'Red Star Belgrade':46.5,'Gent':39,'Panathinaikos':29.25,'Pafos':24.125,'Brighton & Hove Albion':23.903,'Lugano':21.25,'Getafe':19.409,'KuPS':14,'Twente':13.585,'Lincoln Red Imps':13.5,'Borac Banja Luka':13.125,'Sint-Truiden':12.45,'Brann':12.25,'Heart of Midlothian':11.5,'Kairat':11,'Trabzonspor':11,'Universitatea Craiova':10.5,'Riga':10.5,'Hajduk Split':10,'Jablonec':9.705,'Nordsjælland':8.421,'AGF':8.421,"Inter Club d'Escaldes":7.5,'Thun':6.94,'CSKA Sofia':6.5,'Kauno Žalgiris':6,'Mjällby AIF':5.925,'Iberia 1999':5,'Egnatia':4.5};
const SEED_CLUBCC = {'Bodø/Glimt':'NOR','Shakhtar Donetsk':'UKR','Slavia Prague':'CZE','Slovan Bratislava':'SVK','AEK Athens':'GRE','LASK':'AUT','Viking':'NOR','Sabah':'AZE','Olympiacos':'GRE','Ferencváros':'HUN','Viktoria Plzeň':'CZE','Dinamo Zagreb':'CRO','Red Bull Salzburg':'AUT','Celtic':'SCO','Sparta Prague':'CZE','Sturm Graz':'AUT','Celje':'SVN','Omonia':'CYP','Torreense':'POR',"Hapoel Be'er Sheva":'ISR','OFI':'GRE','Lillestrøm':'NOR','Levski Sofia':'BUL','Ararat-Armenia':'ARM','Copenhagen':'DEN','Midtjylland':'DEN','Red Star Belgrade':'SRB','Panathinaikos':'GRE','Pafos':'CYP','Lugano':'SUI','KuPS':'FIN','Lincoln Red Imps':'GIB','Borac Banja Luka':'BIH','Brann':'NOR','Heart of Midlothian':'SCO','Kairat':'KAZ','Universitatea Craiova':'ROU','Riga':'LVA','Hajduk Split':'CRO','Jablonec':'CZE','Nordsjælland':'DEN','AGF':'DEN',"Inter Club d'Escaldes":'AND','Thun':'SUI','CSKA Sofia':'BUL','Kauno Žalgiris':'LTU','Mjällby AIF':'SWE','Iberia 1999':'GEO','Egnatia':'ALB'};

// Programma's competitiefase. Regel '#speeldag mmdd' zet speeldag/datum; daarna 'Thuis v Uit [uitslag]'.
// Uitslagen alleen waar de bron ze vermeldde (UCL speeldag 1, UECL speeldag 1). Overige gespeelde duels: importeren.
const SEED_UCL = `#1 0908
AEK Athens v LASK 1-0
Club Brugge v Aston Villa 2-3
Borussia Dortmund v Villarreal 3-2
Porto v Manchester City 0-2
Lille v Real Betis 2-3
Real Madrid v Inter Milan 2-1
#1 0909
Barcelona v Feyenoord 5-1
VfB Stuttgart v Viking 3-1
Liverpool v Atlético Madrid 2-1
Paris Saint-Germain v Slovan Bratislava 6-1
Sporting CP v Galatasaray 3-1
Napoli v Arsenal 0-1
#1 0910
Fenerbahçe v Roma 1-1
PSV v Shakhtar Donetsk 1-1
Como v RB Leipzig 4-1
Bayern Munich v Bodø/Glimt 5-0
Manchester United v Sabah 4-0
Slavia Prague v Lens 2-3
#2 1013
Lens v Sporting CP
Sabah v Slavia Prague
Arsenal v Lille
Atlético Madrid v Manchester United
Inter Milan v Club Brugge
Galatasaray v Barcelona
RB Leipzig v PSV
Viking v Bayern Munich
Villarreal v Napoli
#2 1014
Feyenoord v Como
LASK v Liverpool
Roma v Real Madrid
Aston Villa v Fenerbahçe
Shakhtar Donetsk v AEK Athens
Bodø/Glimt v Borussia Dortmund
Manchester City v Paris Saint-Germain
Real Betis v Porto
Slovan Bratislava v VfB Stuttgart
#3 1020
Fenerbahçe v Slavia Prague
Sabah v Borussia Dortmund
Roma v Slovan Bratislava
Porto v PSV
Liverpool v Villarreal
Manchester City v AEK Athens
Paris Saint-Germain v Barcelona
Napoli v Bodø/Glimt
VfB Stuttgart v Atlético Madrid
#3 1021
Como v Manchester United
Lille v Galatasaray
Aston Villa v Viking
Club Brugge v Lens
Bayern Munich v Arsenal
Inter Milan v Shakhtar Donetsk
Real Madrid v RB Leipzig
Real Betis v Feyenoord
Sporting CP v LASK
#4 1103
Shakhtar Donetsk v Sporting CP
Galatasaray v VfB Stuttgart
Atlético Madrid v Bayern Munich
Barcelona v Aston Villa
Feyenoord v Inter Milan
Bodø/Glimt v Lille
LASK v Slovan Bratislava
Manchester United v Roma
Villarreal v Paris Saint-Germain
#4 1104
AEK Athens v Real Madrid
Fenerbahçe v Liverpool
Borussia Dortmund v Real Betis
Porto v Napoli
PSV v Club Brugge
RB Leipzig v Manchester City
Lens v Como
Slavia Prague v Arsenal
Viking v Sabah
#5 1124
Bodø/Glimt v LASK
Galatasaray v Aston Villa
Arsenal v Borussia Dortmund
Como v AEK Athens
Feyenoord v Porto
Manchester City v Napoli
RB Leipzig v Lens
Real Madrid v PSV
Slovan Bratislava v Real Betis
#5 1125
Sabah v Barcelona
Slavia Prague v Villarreal
Atlético Madrid v Viking
Club Brugge v Liverpool
Inter Milan v VfB Stuttgart
Shakhtar Donetsk v Fenerbahçe
Lille v Bayern Munich
Paris Saint-Germain v Roma
Sporting CP v Manchester United
#6 1208
Viking v Feyenoord
Villarreal v Sabah
AEK Athens v Galatasaray
Roma v Sporting CP
Aston Villa v Paris Saint-Germain
Barcelona v Manchester City
Bayern Munich v Slavia Prague
Manchester United v RB Leipzig
Napoli v Club Brugge
#6 1209
Real Betis v Como
Slovan Bratislava v Shakhtar Donetsk
Arsenal v Real Madrid
Borussia Dortmund v Inter Milan
LASK v Fenerbahçe
Liverpool v Porto
PSV v Atlético Madrid
Lens v Bodø/Glimt
VfB Stuttgart v Lille
#7 0119
Bodø/Glimt v Atlético Madrid
Galatasaray v Feyenoord
AEK Athens v Roma
Aston Villa v Borussia Dortmund
Inter Milan v Liverpool
Porto v Slavia Prague
Lille v Slovan Bratislava
Real Madrid v LASK
VfB Stuttgart v Club Brugge
#7 0120
Fenerbahçe v Villarreal
Sabah v Napoli
Como v Paris Saint-Germain
Manchester United v Bayern Munich
RB Leipzig v Shakhtar Donetsk
Lens v Manchester City
Real Betis v Arsenal
Sporting CP v Barcelona
Viking v PSV
#8 0127
Arsenal v Sabah
Roma v Lille
Atlético Madrid v Fenerbahçe
Borussia Dortmund v AEK Athens
Club Brugge v Bodø/Glimt
Bayern Munich v Real Betis
Barcelona v Como
Shakhtar Donetsk v Real Madrid
Feyenoord v RB Leipzig
LASK v Porto
Liverpool v Lens
Manchester City v Sporting CP
Paris Saint-Germain v Galatasaray
PSV v VfB Stuttgart
Slavia Prague v Aston Villa
Napoli v Viking
Villarreal v Manchester United
Slovan Bratislava v Inter Milan`;

const SEED_UEL = `#1 0916
Ararat-Armenia v Sparta Prague
Omonia v Celta Vigo
AC Milan v Benfica
Bayer Leverkusen v Celje
Hapoel Be'er Sheva v Dinamo Zagreb
Olympiacos v Jagiellonia Białystok
Anderlecht v Lyon
Sturm Graz v Rennes
Sunderland v AZ
#1 0917
OFI v TSG Hoffenheim
Levski Sofia v Red Bull Salzburg
Beşiktaş v Marseille
Celtic v Ferencváros
Crystal Palace v Lech Poznań
Viktoria Plzeň v Union SG
Juventus v NEC
Lillestrøm v Torreense
Real Sociedad v Bournemouth
#2 1015
Sparta Prague v Lillestrøm
AZ v Hapoel Be'er Sheva
Red Bull Salzburg v AC Milan
Lech Poznań v Bayer Leverkusen
Celje v Omonia
Lyon v Crystal Palace
Union SG v Real Sociedad
Torreense v Sunderland
Bournemouth v Sturm Graz
Ferencváros v Viktoria Plzeň
Dinamo Zagreb v Anderlecht
Jagiellonia Białystok v Ararat-Armenia
NEC v Levski Sofia
Marseille v Olympiacos
Celta Vigo v Juventus
Benfica v Celtic
Rennes v OFI
TSG Hoffenheim v Beşiktaş
#3 1022
Ararat-Armenia v AZ
Ferencváros v Torreense
Dinamo Zagreb v NEC
Juventus v Rennes
Lech Poznań v Sunderland
OFI v Bayer Leverkusen
Union SG v Hapoel Be'er Sheva
Sturm Graz v Marseille
Bournemouth v AC Milan
Beşiktaş v Crystal Palace
Celtic v Celta Vigo
Viktoria Plzeň v Levski Sofia
Jagiellonia Białystok v Anderlecht
Lillestrøm v Real Sociedad
Celje v Red Bull Salzburg
Olympiacos v Sparta Prague
Omonia v Benfica
TSG Hoffenheim v Lyon
#4 1105
AC Milan v Ferencváros
Sparta Prague v Bournemouth
Crystal Palace v TSG Hoffenheim
Lillestrøm v Viktoria Plzeň
NEC v Omonia
Levski Sofia v Jagiellonia Białystok
Real Sociedad v Lyon
Anderlecht v Red Bull Salzburg
Rennes v Olympiacos
AZ v Juventus
Bayer Leverkusen v Marseille
Celtic v Beşiktaş
Hapoel Be'er Sheva v OFI
Celta Vigo v Union SG
Torreense v Ararat-Armenia
Sturm Graz v Celje
Benfica v Lech Poznań
Sunderland v Dinamo Zagreb
#5 1126
Beşiktaş v Hapoel Be'er Sheva
Red Bull Salzburg v Ararat-Armenia
Viktoria Plzeň v Benfica
Dinamo Zagreb v Bayer Leverkusen
Olympiacos v AC Milan
Marseille v Levski Sofia
Union SG v Lech Poznań
Celta Vigo v Bournemouth
Sparta Prague v AZ
Crystal Palace v Real Sociedad
Ferencváros v Celje
Juventus v Omonia
NEC v Rennes
OFI v Anderlecht
Lyon v Lillestrøm
Torreense v Celtic
Sunderland v Jagiellonia Białystok
TSG Hoffenheim v Sturm Graz
#6 1210
AZ v Sturm Graz
Ararat-Armenia v NEC
Hapoel Be'er Sheva v Juventus
Jagiellonia Białystok v Crystal Palace
Marseille v Celta Vigo
Omonia v Celtic
Anderlecht v TSG Hoffenheim
Rennes v Dinamo Zagreb
AC Milan v Sunderland
Bournemouth v Viktoria Plzeň
Bayer Leverkusen v Beşiktaş
Red Bull Salzburg v Sparta Prague
Lech Poznań v Ferencváros
Celje v Olympiacos
Lyon v Union SG
Levski Sofia v Lillestrøm
Real Sociedad v Torreense
Benfica v OFI
#7 0121
Beşiktaş v Union SG
Ararat-Armenia v Celje
Ferencváros v Juventus
Jagiellonia Białystok v Lyon
Lillestrøm v Bournemouth
NEC v Benfica
Olympiacos v TSG Hoffenheim
Real Sociedad v Viktoria Plzeň
Sturm Graz v OFI
AZ v Dinamo Zagreb
Bayer Leverkusen v Red Bull Salzburg
Celtic v Marseille
Crystal Palace v Sparta Prague
Hapoel Be'er Sheva v Celta Vigo
Lech Poznań v Torreense
Levski Sofia v AC Milan
Anderlecht v Sunderland
Rennes v Omonia
#8 0128
AC Milan v Ararat-Armenia
Sparta Prague v Rennes
Bournemouth v Hapoel Be'er Sheva
Red Bull Salzburg v Crystal Palace
Viktoria Plzeň v Jagiellonia Białystok
Dinamo Zagreb v Sturm Graz
Juventus v Real Sociedad
Celje v NEC
OFI v Lech Poznań
Marseille v Anderlecht
Lyon v Bayer Leverkusen
Omonia v Beşiktaş
Union SG v Celtic
Celta Vigo v Lillestrøm
Torreense v Olympiacos
Benfica v AZ
Sunderland v Levski Sofia
TSG Hoffenheim v Ferencváros`;

const SEED_UECL = `#1 1015
Lugano v Red Star Belgrade 3-2
Hajduk Split v Ajax 2-1
Gent v AGF 1-0
Egnatia v Midtjylland 1-1
KuPS v Trabzonspor 2-4
Mjällby AIF v Inter Club d'Escaldes 2-0
Panathinaikos v Borac Banja Luka 2-1
CSKA Sofia v Monaco 1-2
Riga v Kairat 1-1
Universitatea Craiova v Getafe 1-1
Atalanta v Pafos 3-1
Brighton & Hove Albion v Kauno Žalgiris 4-0
Copenhagen v Braga 3-0
Twente v Thun 1-0
Heart of Midlothian v Nordsjælland 1-1
Sint-Truiden v Iberia 1999 2-0
SC Freiburg v Jablonec 3-2
Brann v Lincoln Red Imps 2-1
#2 1022
Kairat v Panathinaikos
Iberia 1999 v Mjällby AIF
Nordsjælland v CSKA Sofia
Red Star Belgrade v Copenhagen
Jablonec v Brighton & Hove Albion
Kauno Žalgiris v Brann
Getafe v Lugano
Inter Club d'Escaldes v Universitatea Craiova
Pafos v Riga
Trabzonspor v Heart of Midlothian
Ajax v Atalanta
AGF v Egnatia
Monaco v SC Freiburg
Midtjylland v Sint-Truiden
Thun v Hajduk Split
Borac Banja Luka v KuPS
Lincoln Red Imps v Twente
Braga v Gent
#3 1105
AGF v Braga
Atalanta v Kairat
Midtjylland v Ajax
Thun v Heart of Midlothian
Red Star Belgrade v Inter Club d'Escaldes
KuPS v Gent
Lincoln Red Imps v Hajduk Split
Mjällby AIF v Borac Banja Luka
Trabzonspor v SC Freiburg
Monaco v Nordsjælland
Copenhagen v Iberia 1999
Lugano v Kauno Žalgiris
Twente v Pafos
Getafe v Brighton & Hove Albion
Sint-Truiden v Brann
Panathinaikos v CSKA Sofia
Riga v Jablonec
Universitatea Craiova v Egnatia
#4 1126
Kairat v Mjällby AIF
Ajax v Thun
Brighton & Hove Albion v Universitatea Craiova
Iberia 1999 v Getafe
Jablonec v Lugano
Kauno Žalgiris v Riga
Heart of Midlothian v Monaco
Egnatia v Lincoln Red Imps
Pafos v Midtjylland
Brann v AGF
Nordsjælland v Panathinaikos
Borac Banja Luka v Atalanta
Hajduk Split v Sint-Truiden
Inter Club d'Escaldes v Copenhagen
Gent v Red Star Belgrade
CSKA Sofia v Trabzonspor
Braga v KuPS
SC Freiburg v Twente
#5 1210
Kairat v Universitatea Craiova
Copenhagen v Lugano
Iberia 1999 v Red Star Belgrade
Getafe v Inter Club d'Escaldes
KuPS v CSKA Sofia
Lincoln Red Imps v Midtjylland
Riga v Atalanta
SC Freiburg v Panathinaikos
Brann v Braga
Trabzonspor v Jablonec
AGF v Twente
Brighton & Hove Albion v Monaco
Thun v Gent
Heart of Midlothian v Borac Banja Luka
Hajduk Split v Nordsjælland
Sint-Truiden v Ajax
Egnatia v Kauno Žalgiris
Mjällby AIF v Pafos
#6 1217
Ajax v Getafe
Monaco v Lincoln Red Imps
Atalanta v Mjällby AIF
Lugano v Sint-Truiden
Midtjylland v Hajduk Split
Nordsjælland v KuPS
Twente v Kairat
Borac Banja Luka v Riga
Red Star Belgrade v Trabzonspor
Jablonec v Iberia 1999
Kauno Žalgiris v SC Freiburg
Inter Club d'Escaldes v AGF
Gent v Brann
Pafos v Heart of Midlothian
Panathinaikos v Brighton & Hove Albion
CSKA Sofia v Thun
Braga v Egnatia
Universitatea Craiova v Copenhagen`;

// Nations League 2026/27 competitiefase: 'GROEP mmdd Thuis v Uit' (Wikipedia 2026–27 UEFA Nations League)
// Groepscodes volgen de volgorde op de bronpagina; uitslagen van gespeelde speeldagen zijn niet beschikbaar → importeren.
const SEED_UNL = `A1 0925 Türkiye v France
A1 0928 Belgium v France
A1 1002 France v Italy
A1 1005 France v Belgium
A1 1112 Italy v France
A1 1115 France v Türkiye
A1 0925 Italy v Belgium
A1 1005 Italy v Türkiye
A1 1115 Belgium v Italy
A1 1002 Belgium v Türkiye
A1 0928 Türkiye v Italy
A1 1112 Türkiye v Belgium
A2 1116 Germany v Netherlands
A2 1001 Germany v Serbia
A2 0927 Germany v Greece
A2 0924 Netherlands v Germany
A2 1004 Netherlands v Serbia
A2 1113 Netherlands v Greece
A2 1113 Serbia v Germany
A2 0927 Serbia v Netherlands
A2 0924 Serbia v Greece
A2 1004 Greece v Germany
A2 1001 Greece v Netherlands
A2 1116 Greece v Serbia
A3 0929 Spain v Croatia
A3 1115 Spain v England
A3 1003 Spain v Czechia
A3 1006 Croatia v Spain
A3 1003 Croatia v England
A3 1115 Croatia v Czechia
A3 0926 England v Spain
A3 1112 England v Croatia
A3 1006 England v Czechia
A3 1112 Czechia v Spain
A3 0926 Czechia v Croatia
A3 0929 Czechia v England
A4 1114 Portugal v Denmark
A4 1004 Portugal v Norway
A4 0924 Portugal v Wales
A4 1001 Denmark v Portugal
A4 1117 Denmark v Norway
A4 0927 Denmark v Wales
A4 0927 Norway v Portugal
A4 0924 Norway v Denmark
A4 1114 Norway v Wales
A4 1117 Wales v Portugal
A4 1004 Wales v Denmark
A4 1001 Wales v Norway
B1 0929 Scotland v Switzerland
B1 1006 Scotland v Slovenia
B1 1113 Scotland v North Macedonia
B1 1116 Switzerland v Scotland
B1 1003 Switzerland v Slovenia
B1 1006 Switzerland v North Macedonia
B1 0926 Slovenia v Scotland
B1 1113 Slovenia v Switzerland
B1 0929 Slovenia v North Macedonia
B1 1003 North Macedonia v Scotland
B1 0926 North Macedonia v Switzerland
B1 1116 North Macedonia v Slovenia
B2 0925 Hungary v Ukraine
B2 1002 Hungary v Georgia
B2 1117 Hungary v Northern Ireland
B2 1005 Ukraine v Hungary
B2 1117 Ukraine v Georgia
B2 1002 Ukraine v Northern Ireland
B2 1114 Georgia v Hungary
B2 0928 Georgia v Ukraine
B2 0925 Georgia v Northern Ireland
B2 0928 Northern Ireland v Hungary
B2 1114 Northern Ireland v Ukraine
B2 1005 Northern Ireland v Georgia
B3 1117 Israel v Austria
B3 0927 Israel v Republic of Ireland
B3 1001 Israel v Kosovo
B3 0924 Austria v Israel
B3 1114 Austria v Republic of Ireland
B3 0927 Austria v Kosovo
B3 1004 Republic of Ireland v Israel
B3 1001 Republic of Ireland v Austria
B3 1117 Republic of Ireland v Kosovo
B3 1114 Kosovo v Israel
B3 1004 Kosovo v Austria
B3 0924 Kosovo v Republic of Ireland
B4 0925 Poland v Bosnia and Herzegovina
B4 1002 Poland v Romania
B4 1117 Poland v Sweden
B4 1005 Bosnia and Herzegovina v Poland
B4 1117 Bosnia and Herzegovina v Romania
B4 1002 Bosnia and Herzegovina v Sweden
B4 1114 Romania v Poland
B4 0928 Romania v Bosnia and Herzegovina
B4 1005 Romania v Sweden
B4 0928 Sweden v Poland
B4 1114 Sweden v Bosnia and Herzegovina
B4 0925 Sweden v Romania
C1 1112 Albania v Finland
C1 0926 Albania v Belarus
C1 1006 Albania v San Marino
C1 1003 Finland v Albania
C1 0929 Finland v Belarus
C1 1115 Finland v San Marino
C1 1115 Belarus v Albania
C1 1006 Belarus v Finland
C1 1003 Belarus v San Marino
C1 0929 San Marino v Albania
C1 0926 San Marino v Finland
C1 1112 San Marino v Belarus
C2 1005 Montenegro v Armenia
C2 0925 Montenegro v Cyprus
C2 1112 Montenegro v Latvia
C2 0928 Armenia v Montenegro
C2 1112 Armenia v Cyprus
C2 0925 Armenia v Latvia
C2 1115 Cyprus v Montenegro
C2 1002 Cyprus v Armenia
C2 1005 Cyprus v Latvia
C2 1002 Latvia v Montenegro
C2 1115 Latvia v Armenia
C2 0928 Latvia v Cyprus
C3 1116 Kazakhstan v Slovakia
C3 1006 Kazakhstan v Faroe Islands
C3 1002 Kazakhstan v Moldova
C3 0929 Slovakia v Kazakhstan
C3 1113 Slovakia v Faroe Islands
C3 0926 Slovakia v Moldova
C3 0926 Faroe Islands v Kazakhstan
C3 1002 Faroe Islands v Slovakia
C3 1116 Faroe Islands v Moldova
C3 1113 Moldova v Kazakhstan
C3 1006 Moldova v Slovakia
C3 0929 Moldova v Faroe Islands
C4 1003 Iceland v Bulgaria
C4 0926 Iceland v Estonia
C4 1116 Iceland v Luxembourg
C4 1113 Bulgaria v Iceland
C4 0929 Bulgaria v Estonia
C4 0926 Bulgaria v Luxembourg
C4 1006 Estonia v Iceland
C4 1116 Estonia v Bulgaria
C4 1003 Estonia v Luxembourg
C4 0929 Luxembourg v Iceland
C4 1006 Luxembourg v Bulgaria
C4 1113 Luxembourg v Estonia
D1 1116 Gibraltar v Malta
D1 0927 Gibraltar v Andorra
D1 1001 Malta v Gibraltar
D1 1004 Malta v Andorra
D1 1113 Andorra v Gibraltar
D1 0924 Andorra v Malta
D2 0927 Lithuania v Azerbaijan
D2 1116 Lithuania v Liechtenstein
D2 1004 Azerbaijan v Lithuania
D2 1001 Azerbaijan v Liechtenstein
D2 0924 Liechtenstein v Lithuania
D2 1113 Liechtenstein v Azerbaijan`;

// FIFA-punten 7-10-2026 (top 100). Elo-start = 1500 + (FIFA − 1500) × 2/3 (omrekening van FIFA-schaal /600 naar Elo-schaal /400).
const SEED_FIFA = `Spain 2011.57|Argentina 1972.80|France 1958.86|England 1925.59|Portugal 1807.69|Brazil 1806.51|Morocco 1805.34|Belgium 1779.17|Netherlands 1778.61|Mexico 1738.48|Colombia 1735.80|Switzerland 1725.39|Germany 1717.52|Croatia 1714.74|Italy 1713.04|United States 1705.47|Japan 1684.75|Senegal 1648.84|Norway 1637.89|Uruguay 1635.54|Denmark 1619.62|Austria 1600.66|IR Iran 1597.31|Ecuador 1587.07|Egypt 1585.86|Australia 1580.52|Canada 1575.31|Algeria 1574.77|Côte d'Ivoire 1569.32|Nigeria 1567.97|Türkiye 1563.54|Korea Republic 1562.49|Paraguay 1552.30|Sweden 1543.80|Russia 1537.45|Ukraine 1535.27|Poland 1514.58|Hungary 1511.24|Wales 1510.37|Congo DR 1506.37|Greece 1498.71|Cameroon 1485.30|Scotland 1483.57|Serbia 1482.24|Slovakia 1477.34|Panama 1476.97|Mali 1474.14|South Africa 1468.88|Venezuela 1465.87|Chile 1458.97|Czechia 1457.12|Slovenia 1452.48|Peru 1450.95|Costa Rica 1444.85|Saudi Arabia 1443.17|Republic of Ireland 1438.62|Bosnia and Herzegovina 1429.32|Romania 1428.88|Uzbekistan 1416.61|Qatar 1416.47|Tunisia 1415.38|Burkina Faso 1407.80|Iraq 1400.91|Northern Ireland 1383.86|United Arab Emirates 1376.95|Albania 1375.78|Honduras 1375.40|Cabo Verde 1373.58|Jamaica 1361.97|Ghana 1361.27|North Macedonia 1350.91|Jordan 1350.88|Iceland 1349.42|Georgia 1345.88|Finland 1340.73|Kosovo 1328.14|Israel 1325.52|Bolivia 1322.19|Montenegro 1315.49|Curaçao 1304.98|Oman 1302.77|Guinea 1296.67|Angola 1281.79|Haiti 1280.91|Gabon 1280.12|Syria 1279.94|Uganda 1278.26|New Zealand 1277.02|Benin 1266.01|Bulgaria 1262.57|Zambia 1260.61|Palestine 1253.75|Thailand 1251.42|Belarus 1249.60|Guatemala 1245.10|China PR 1241.90|Bahrain 1240.30|Mozambique 1238.23|Vietnam 1231.29|Tajikistan 1218.88`;
// Aanname (buiten FIFA-top-100, punten niet ingezien): geschatte FIFA-punten
const SEED_FIFA_ASSUMED = `Luxembourg 1205|Kazakhstan 1180|Armenia 1170|Azerbaijan 1150|Cyprus 1140|Estonia 1125|Faroe Islands 1120|Latvia 1100|Lithuania 1095|Moldova 1080|Malta 1070|Andorra 1000|Gibraltar 960|Liechtenstein 950|San Marino 860`;

// Veelvoorkomende naamvarianten (o.a. football-data.co.uk) → vaste teamnaam
// Nederlandse weergavenamen voor landenteams (de data zelf blijft Engels, zoals de uitslagenbron)
const NL_LAND = {"Albania": "Albanië", "Andorra": "Andorra", "Armenia": "Armenië", "Austria": "Oostenrijk", "Azerbaijan": "Azerbeidzjan", "Belarus": "Wit-Rusland", "Belgium": "België", "Bosnia and Herzegovina": "Bosnië en Herzegovina", "Bulgaria": "Bulgarije", "Croatia": "Kroatië", "Cyprus": "Cyprus", "Czechia": "Tsjechië", "Denmark": "Denemarken", "England": "Engeland", "Estonia": "Estland", "Faroe Islands": "Faeröer", "Finland": "Finland", "France": "Frankrijk", "Georgia": "Georgië", "Germany": "Duitsland", "Gibraltar": "Gibraltar", "Greece": "Griekenland", "Hungary": "Hongarije", "Iceland": "IJsland", "Israel": "Israël", "Italy": "Italië", "Kazakhstan": "Kazachstan", "Kosovo": "Kosovo", "Latvia": "Letland", "Liechtenstein": "Liechtenstein", "Lithuania": "Litouwen", "Luxembourg": "Luxemburg", "Malta": "Malta", "Moldova": "Moldavië", "Montenegro": "Montenegro", "Netherlands": "Nederland", "North Macedonia": "Noord-Macedonië", "Northern Ireland": "Noord-Ierland", "Norway": "Noorwegen", "Poland": "Polen", "Portugal": "Portugal", "Republic of Ireland": "Ierland", "Romania": "Roemenië", "Russia": "Rusland", "San Marino": "San Marino", "Scotland": "Schotland", "Serbia": "Servië", "Slovakia": "Slowakije", "Slovenia": "Slovenië", "Spain": "Spanje", "Sweden": "Zweden", "Switzerland": "Zwitserland", "Türkiye": "Turkije", "Ukraine": "Oekraïne", "Wales": "Wales"};
const SEED_ALIASES = Object.assign({'Bosnia & Herzegovina':'Bosnia and Herzegovina','Bosnia-Herzegovina':'Bosnia and Herzegovina','Rep. Of Ireland':'Republic of Ireland','FYR Macedonia':'North Macedonia','Union St. Gilloise':'Union SG','Deportivo La Coruna':'Deportivo A Coruña','1899 Hoffenheim':'TSG Hoffenheim','FC OSS':'TOP Oss','Academico Viseu':'Académico de Viseu','Slavia Praha':'Slavia Prague','Sparta Praha':'Sparta Prague','Aarhus':'AGF','FK Crvena Zvezda':'Red Star Belgrade','Hapoel Beer Sheva':"Hapoel Be'er Sheva",'Olympiakos Piraeus':'Olympiacos','Royal Antwerp FC':'Antwerp','RAAL La Louviére':'La Louvière','RAAL La Louvière':'La Louvière','RSC Anderlecht':'Anderlecht','KVC Westerlo':'Westerlo','Sporting Charleroi':'Charleroi','RSC Charleroi':'Charleroi','KRC Genk':'Genk','Sint-Truidense VV':'Sint-Truiden','KAA Gent':'Gent','Çaykur Rizespor':'Rizespor','Royale Union Saint-Gilloise':'Union SG','SK Slavia Praha':'Slavia Prague','PAE Olympiakos SFP':'Olympiacos','Paphos FC':'Pafos','FC København':'Copenhagen','FC Copenhagen':'Copenhagen'}, {'Club Atlético de Madrid':'Atlético Madrid','Real Madrid CF':'Real Madrid','FC Barcelona':'Barcelona','Athletic Club':'Athletic Bilbao','RCD Espanyol de Barcelona':'Espanyol','Sport Lisboa e Benfica':'Benfica','Sporting Clube de Braga':'Braga','Sporting Clube de Portugal':'Sporting CP','FC Internazionale Milano':'Inter Milan','AC Milan':'AC Milan','FC Bayern München':'Bayern Munich','Paris Saint-Germain FC':'Paris Saint-Germain','Paris FC':'Paris FC','Real Betis Balompié':'Real Betis','Real Sociedad de Fútbol':'Real Sociedad','Racing Club de Lens':'Lens','Real Racing Club de Santander':'Racing Santander','RC Deportivo La Coruña':'Deportivo A Coruña','Rayo Vallecano de Madrid':'Rayo Vallecano','Olympique Lyonnais':'Lyon','Olympique de Marseille':'Marseille','Stade Rennais FC 1901':'Rennes','Stade Brestois 29':'Brest','RC Strasbourg Alsace':'Strasbourg','Feyenoord Rotterdam':'Feyenoord','SC Cambuur-Leeuwarden':'Cambuur','Willem II Tilburg':'Willem II','SBV Excelsior':'Excelsior','Telstar 1963':'Telstar',"FC Twente '65":'Twente','AFC Ajax':'Ajax','FC Utrecht':'Utrecht','FC Groningen':'Groningen','SC Heerenveen':'Heerenveen','Vitória Guimarães':'Vitória de Guimarães','FC Porto':'Porto','CD Nacional':'Nacional','CD Santa Clara':'Santa Clara','1. FC Union Berlin':'Union Berlin','SV Werder Bremen':'Werder Bremen','Bayer 04 Leverkusen':'Bayer Leverkusen','TSG 1899 Hoffenheim':'TSG Hoffenheim','SV 07 Elversberg':'SV Elversberg','SC Paderborn 07':'SC Paderborn','FC Schalke 04':'Schalke 04','1. FSV Mainz 05':'Mainz 05','AS Roma':'Roma','SS Lazio':'Lazio','SSC Napoli':'Napoli','Juventus FC':'Juventus','Atalanta BC':'Atalanta','AC Monza':'Monza','AS Monaco FC':'Monaco','Lille OSC':'Lille','OGC Nice':'Nice','Le Mans FC':'Le Mans','Le Havre AC':'Le Havre','ES Troyes AC':'Troyes','Toulouse FC':'Toulouse','FC Lorient':'Lorient','AJ Auxerre':'Auxerre','Angers SCO':'Angers','Valencia CF':'Valencia','Sevilla FC':'Sevilla','Villarreal CF':'Villarreal','Getafe CF':'Getafe','Elche CF':'Elche','Levante UD':'Levante','Málaga CF':'Málaga','CA Osasuna':'Osasuna','RC Celta de Vigo':'Celta Vigo','Deportivo Alavés':'Alavés','Torino FC':'Torino','Genoa CFC':'Genoa','Udinese Calcio':'Udinese','Cagliari Calcio':'Cagliari','US Lecce':'Lecce','US Sassuolo Calcio':'Sassuolo','Parma Calcio 1913':'Parma','Bologna FC 1909':'Bologna','ACF Fiorentina':'Fiorentina','Como 1907':'Como','Venezia FC':'Venezia','Frosinone Calcio':'Frosinone','Casa Pia AC':'Casa Pia','FC Alverca':'Alverca','FC Arouca':'Arouca','FC Famalicão':'Famalicão','CS Marítimo':'Marítimo','Académico de Viseu FC':'Académico de Viseu','GD Estoril Praia':'Estoril Praia','CF Estrela da Amadora':'Estrela da Amadora','Gil Vicente FC':'Gil Vicente','Moreirense FC':'Moreirense','Rio Ave FC':'Rio Ave'}, {'Man United':'Manchester United','Man Utd':'Manchester United','Man City':'Manchester City',"Nott'm Forest":'Nottingham Forest','Newcastle':'Newcastle United','Tottenham':'Tottenham Hotspur','Spurs':'Tottenham Hotspur','Brighton':'Brighton & Hove Albion','Leeds':'Leeds United','Coventry':'Coventry City','Ipswich':'Ipswich Town','Hull':'Hull City',
 'Inter':'Inter Milan','Internazionale':'Inter Milan','Milan':'AC Milan','Ath Madrid':'Atlético Madrid','Atletico Madrid':'Atlético Madrid','Atleti':'Atlético Madrid','Ath Bilbao':'Athletic Bilbao','Athletic Club':'Athletic Bilbao','Betis':'Real Betis','Sociedad':'Real Sociedad','Celta':'Celta Vigo','Vallecano':'Rayo Vallecano','La Coruna':'Deportivo A Coruña','Deportivo':'Deportivo A Coruña','Santander':'Racing Santander','Espanol':'Espanyol','Malaga':'Málaga','Alaves':'Alavés',
 'Bayern München':'Bayern Munich','Dortmund':'Borussia Dortmund','Leverkusen':'Bayer Leverkusen','Leipzig':'RB Leipzig',"M'gladbach":'Borussia Mönchengladbach','Gladbach':'Borussia Mönchengladbach','Ein Frankfurt':'Eintracht Frankfurt','FC Koln':'1. FC Köln','Köln':'1. FC Köln','Hoffenheim':'TSG Hoffenheim','Freiburg':'SC Freiburg','Stuttgart':'VfB Stuttgart','Mainz':'Mainz 05','Augsburg':'FC Augsburg','Hamburg':'Hamburger SV','Paderborn':'SC Paderborn','Elversberg':'SV Elversberg','Schalke':'Schalke 04','Werder':'Werder Bremen',
 'Paris SG':'Paris Saint-Germain','PSG':'Paris Saint-Germain','PSV Eindhoven':'PSV','N.E.C.':'NEC','Nijmegen':'NEC','For Sittard':'Fortuna Sittard','Heracles':'Heracles Almelo','Zwolle':'PEC Zwolle','Sparta':'Sparta Rotterdam','FC Utrecht':'Utrecht','AZ Alkmaar':'AZ','Den Haag':'ADO Den Haag','Roda JC':'Roda JC Kerkrade','Roda':'Roda JC Kerkrade','MVV':'MVV Maastricht','VVV':'VVV-Venlo','FC Eindhoven':'Eindhoven','Graafschap':'De Graafschap','Jong Utrecht':'Jong FC Utrecht','NAC':'NAC Breda','RKC':'RKC Waalwijk','Almere':'Almere City','Helmond':'Helmond Sport',
 'Sp Lisbon':'Sporting CP','Sporting':'Sporting CP','Sp Braga':'Braga','Guimaraes':'Vitória de Guimarães','Estoril':'Estoril Praia','Estrela':'Estrela da Amadora','Famalicao':'Famalicão','Maritimo':'Marítimo','Viseu':'Académico de Viseu',
 'St Truiden':'Sint-Truiden','St. Gilloise':'Union SG','Union Saint-Gilloise':'Union SG','Standard':'Standard Liège','Oud-Heverlee Leuven':'OH Leuven','Waregem':'Zulte Waregem','Lommel':'Lommel SK','Club Brugge KV':'Club Brugge',
 'Buyuksehyr':'Başakşehir','Istanbul Basaksehir':'Başakşehir','Fenerbahce':'Fenerbahçe','Besiktas':'Beşiktaş','Goztepe':'Göztepe','Kasimpasa':'Kasımpaşa','Genclerbirligi':'Gençlerbirliği','Corum':'Çorum','Eyupspor':'Eyüpspor',
 'Legia':'Legia Warsaw','Legia Warszawa':'Legia Warsaw','Lech':'Lech Poznań','Rakow':'Raków Częstochowa','Jagiellonia':'Jagiellonia Białystok',
 'Turkey':'Türkiye','China':'China PR','DR Congo':'Congo DR','Cape Verde Islands':'Cabo Verde','Czech Republic':'Czechia','Ireland':'Republic of Ireland','Bosnia':'Bosnia and Herzegovina','Korea':'Korea Republic','South Korea':'Korea Republic','USA':'United States','Iran':'IR Iran','Ivory Coast':'Côte d\'Ivoire','Cape Verde':'Cabo Verde','Holland':'Netherlands','Nederland':'Netherlands','Duitsland':'Germany','België':'Belgium','Frankrijk':'France','Spanje':'Spain','Engeland':'England','Italië':'Italy','Feyenoord Rotterdam':'Feyenoord','FC Twente':'Twente','Willem II':'Willem II','SC Telstar':'Telstar','Excelsior':'Excelsior','FC Bayern München':'Bayern Munich','Bayer 04 Leverkusen':'Bayer Leverkusen','Sporting CP':'Sporting CP','SL Benfica':'Benfica','SC Braga':'Braga','FC Porto':'Porto','Club Brugge KV':'Club Brugge','Galatasaray SK':'Galatasaray','Fenerbahçe SK':'Fenerbahçe','PSV':'PSV','AFC Bournemouth':'Bournemouth','Wolverhampton Wanderers FC':'Wolverhampton Wanderers','Brighton & Hove Albion FC':'Brighton & Hove Albion'});
