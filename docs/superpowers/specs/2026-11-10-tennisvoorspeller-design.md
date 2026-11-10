# Tennisvoorspeller — ontwerp

Datum: 10 november 2026. Status: ter beoordeling door Rik.

Dit document staat tijdelijk op een werkbranch van `voetbal-data` en verhuist naar de nieuwe repository
`tennis-data` zodra die bestaat.

## Doel

Een tennisvoorspeller naar het voorbeeld van de Voetbalvoorspeller: één HTML-pagina zonder server, die
tenniswedstrijden voorspelt. Rik gebruikt de tool om te **voorspellen**; aanbevelingen voor weddenschappen zijn
bijzaak en worden alleen op papier gevolgd. Gok-advies blijft nuchter en eerlijk.

Geslaagd als:

- de pagina elke dag de komende ATP- en WTA-wedstrijden toont met winkans, setstand en games;
- de walk-forward toets laat zien dat de winkans goed gekalibreerd is en beter dan alleen de ranking;
- alles draait op gratis bronnen, met een duidelijke melding zodra dat niet meer houdbaar is.

## Afbakening

Binnen de eerste versie:

- enkelspel, ATP en WTA op tourniveau (Grand Slams, Masters/1000, 500, 250, Finals);
- voorspellen vóór de wedstrijd;
- winnaar, setstand, totaal aantal games, game-handicap en sethandicap;
- persoonlijk, niet-commercieel gebruik.

Buiten de eerste versie: live voorspellen tijdens de wedstrijd, weer per wedstrijd (wind, hitte), Challengers,
WTA125 en ITF, dubbelspel, en service- en returncijfers per speler.

## Keuzes en waarom

| Keuze | Reden |
|---|---|
| Eén HTML-pagina als artifact, data via GitHub Actions | Zelfde vorm als voetbal; gratis; bouw- en toetsopzet herbruikbaar |
| Eigen repository `tennis-data` | Eigen workflows en data; voetbal en tennis kunnen elkaar niet breken |
| Komende wedstrijden en prijzen uit de Kambi-feed | Getest op 10-11-2026: levert tennis met volledige namen, toernooi, niveau en drie markten; geen sleutel nodig |
| Historie en uitslagen van tennis-data.co.uk | Gratis, ATP vanaf 2000 en WTA vanaf 2007, met Pinnacle- en Bet365-odds |
| Geen betaalde API bij de start | Niet nodig voor model en toets; zie "Wanneer een API wel nodig wordt" |
| Elo per ondergrond als kern | Bewezen sterkste enkele voorspeller (ongeveer 65–70% goed) en te bouwen op alleen uitslagen |

Vastgesteld bij het uitzoeken:

- API-Sports (de dienst achter de API-Football-sleutel) heeft geen tennisdienst.
- De originele Sackmann-bestanden geven een 404.
- tennis-data.co.uk wordt vanuit een Claude-sessie geblokkeerd door Cloudflare; of het vanuit GitHub Actions
  lukt, is de eerste bouwstap.

## Opbouw van de repository

```
bron/            master van de pagina; wijzig hier, nooit in een gebouwde .html
  p1_head.html   titel, lettertype, CSS (bento, licht + donker)
  p2_data.js     toernooitabel: naam, aliassen, tour, niveau, ondergrond, indoor, hoogte, best-of, land
  p2b_extra.js   lege standaardwaarden voor het datablok (/*DATA-START*/ … /*DATA-END*/)
  p3_engine.js   Elo per ondergrond, winkans, puntmodel (set, games, handicap), kalibratie, DEFAULT_SETTINGS
  p3b_value.js   markt + model (devig, mengen), aanbevelingen, terugblik, Mijn bets
  p4_ui.js       pagina's en knoppen, boot() met settings-migraties (modelRev)
  bouw.py        plakt de delen aan elkaar
  update_data.py haalt de data op en schrijft het datablok in de pagina
  waarde.js      markeert aanbevelingen en voegt ze toe aan data/picks.json
toets/           walk-forward toets
data/            td/*.csv (historie), odds.json, spelers.json (aliassen), picks.json
rapporten/       weekrapporten van de toets
td_ophalen.py    historie en uitslagen van tennis-data.co.uk
kambi_ophalen.py komende wedstrijden en prijzen
CLAUDE.md        werkinstructies: opbouw, regels, publiceren
```

## Gegevens

| Stroom | Bron | Hoe vaak | Bevat |
|---|---|---|---|
| Historie en uitslagen | tennis-data.co.uk | dagelijks proberen (de site ververst wekelijks) | uitslag, setstanden, ondergrond, ronde, best-of, ranking, odds |
| Komende wedstrijden en prijzen | Kambi-feed (Unibet, Jack's, LeoVegas) | paar keer per dag | spelers, starttijd, toernooi, niveau, winnaar, game-handicap, totaal games |
| Toernooikenmerken | eigen tabel in `p2_data.js` | handmatig bij een onbekend toernooi | ondergrond, indoor, hoogte, best-of |

De Kambi-feed levert geen ondergrond, ronde of best-of; die komen uit de toernooitabel. De feed toont alleen
wedstrijden waar al odds voor zijn (één à twee dagen vooruit), dus geen volledige loting. Sethandicap staat niet
in de lijstweergave; bij de bouw wordt uitgezocht of die per wedstrijd op te vragen is. Lukt dat niet, dan toont
de pagina alleen de eerlijke prijs.

### Spelers koppelen

tennis-data.co.uk schrijft "Mannarino A.", Kambi schrijft "Adrian Mannarino". Koppelen gaat op genormaliseerde
achternaam plus voorletter, binnen dezelfde tour. Uitzonderingen staan in `data/spelers.json`. Een speler of
toernooi dat niet eenduidig te koppelen is, krijgt geen voorspelling en komt in de zichtbare lijst
"niet herkend". Er wordt nooit gegokt op de dichtstbijzijnde naam.

### Als een bron uitvalt

- Kambi: de laatste goede stand blijft staan met de datum erbij; "Zelf invoeren" is het vangnet.
- tennis-data.co.uk: ratings blijven op de laatste stand; de pagina toont tot welke datum uitslagen zijn verwerkt.
- Elke fout in een ophaalscript wordt opgevangen en gelogd; een mislukte run overschrijft nooit goede data.

## Model

### Ratings

- Per speler vier Elo-ratings: totaal, hard, gravel, gras. Indoor hard telt als hard.
- Mannen en vrouwen gescheiden.
- K = 250 / (aantal wedstrijden + 5)^0,4, per rating met het eigen aantal wedstrijden.
- Verwachte score: 1 / (1 + 10^((Elo tegenstander − Elo speler) / 400)).
- Afwezigheid: na een lange pauze gaat de rating omlaag en is K een paar wedstrijden hoger. Drempel en grootte
  kiest de toets.
- Opgaves tellen mee met een lager gewicht; walk-overs tellen niet mee.
- Wedstrijden worden verwerkt op volgorde van datum, toernooi en ronde. De rating van vóór de wedstrijd wordt
  bewaard voor de toets.

### Winkans

- Wedstrijdrating = 50% totaal + 50% ondergrond. De verhouding is een instelling.
- Daaruit volgt de winkans voor best-of-3. Voor best-of-5 rekent het puntmodel de kans om.
- Kalibratie: een stap die corrigeert als het model structureel te stellig of te voorzichtig is, bijgesteld door
  de weektoets.

### Setstand, games en handicaps

- Per tour en ondergrond geldt een gemiddelde kans om een punt op eigen service te winnen, gemeten uit de
  setstanden in de historie.
- Het model zoekt de twee servicekansen rond dat gemiddelde die samen precies de winkans opleveren.
- Uit die servicekansen volgen, via game → tiebreak → set → wedstrijd, de kans op elke setstand, de verdeling van
  het totaal aantal games en de kans op elke game- en sethandicap.
- Alle uitkomsten komen uit hetzelfde model en zijn onderling consistent.

Dit is bewust grover dan een model met servicecijfers per speler: twee spelers met dezelfde winkans krijgen
dezelfde gamesverdeling, ook als de een een grote serveerder is.

### Markt erbij

- Met odds: faire marktkans (power-devig) gemengd met het model. Zonder odds: alleen het model.
- Startgewicht van het model 0,15, bij te stellen door de toets.
- Voor komende wedstrijden is het marktanker Unibet (Kambi), geen Pinnacle. De toets meet op historie wat een
  minder scherp anker kost, met Bet365 als stand-in.

### Instellingen

`DEFAULT_SETTINGS` bevat onder meer: mengverhouding totaal/ondergrond, K-formule, afwezigheidskorting,
gewicht voor opgaves, servicevoordeel per ondergrond, kalibratie, modelgewicht en drempels voor aanbevelingen.
Een standaardinstelling verandert alleen als de toets aantoonbaar beter is: log-loss minstens 0,001 beter op de
laatste 4 weken (niet gebruikt bij het kiezen) én over het hele seizoen. Dan gaat `modelRev` omhoog en komt er
een migratie in `boot()`.

## Toets

Walk-forward: chronologisch door alle wedstrijden, steeds voorspellen met de stand van vóór de wedstrijd.

| Onderdeel | Maatstaf | Vergeleken met |
|---|---|---|
| Winnaar | log-loss, Brier, kalibratie, percentage goed | Pinnacle (zonder marge), alleen ranking |
| Setstand | log-loss over de setstanden, kalibratie | vaste verdeling per ondergrond |
| Games | kalibratie van over/onder op gangbare lijnen, gemiddelde fout | gemiddelde per ondergrond |
| Marktmix | log-loss van markt + model bij verschillende gewichten | markt alleen |

Apart gerapporteerd per tour, per ondergrond en voor best-of-5. Walk-overs vallen buiten de toets.

Experimenten die meelopen en alleen standaard worden als ze de 0,001-regel halen: gewogen Elo (WElo), vorm per
ondergrond, thuisvoordeel, rustdagen en sets in de vorige ronde.

Verwachting: ongeveer 65–68% goed en een log-loss rond 0,60, tegen ongeveer 0,55–0,58 voor Pinnacle. Het model
alleen verslaat de markt niet. Een resultaat dat duidelijk beter is dan Pinnacle wordt eerst behandeld als een
fout (informatie uit de toekomst) en nagelopen.

Voor handicaps en totalen bestaan geen gratis historische odds. De toets kan dus wel zeggen of de games-kansen
kloppen met de echte standen, maar niet of een aanbeveling geld had opgeleverd.

## Pagina

Bento-stijl, licht en donker, getest op 1280 en 390 px zonder horizontale scroll.

| Pagina | Inhoud |
|---|---|
| Vandaag en morgen | Komende wedstrijden per toernooi: winkans, verwachte setstand en games, markt ernaast |
| Wedstrijd | Ratings per ondergrond, vorm op deze ondergrond, onderlinge duels, rustdagen, setstanden, handicaps |
| Ranglijst | Elo per ondergrond, mannen en vrouwen, zoekbaar |
| Zelf invoeren | Twee spelers, ondergrond en best-of kiezen |
| Terugblik | Hoe goed de voorspellingen waren, per week en per ondergrond |
| Mijn bets | Papieren logboek met slotkoers en CLV |
| Instellingen | Modelinstellingen en de lijst "niet herkend" |

Vorm per ondergrond en onderlinge duels staan in beeld als achtergrond, ook zolang ze niet in het model
meetellen.

## Aanbevelingen

- Een aanbeveling verschijnt als voorspelde kans × beste Nederlandse prijs boven een drempel uitkomt.
- Winnaar: op basis van de gemengde kans van markt en model.
- Game-handicap, sethandicap en totaal games: alleen model, met het label "minder betrouwbaar" en een hogere
  drempel. Ze worden pas getoond als de toets laat zien dat de games-kansen goed gekalibreerd zijn.
- Bij elke aanbeveling staat de eerlijke prijs.
- Spelers met weinig historie krijgen een waarschuwing en geen aanbeveling.
- Alles op papier; slotkoersen worden bewaard voor CLV.

## Automatisch bijwerken en publiceren

- Drie GitHub Actions: uitslagen (dagelijks), odds (paar keer per dag, inclusief markeren en slotkoersen) en de
  weektoets (maandag, rapport in `rapporten/`). Elke workflow doet `git pull --rebase` vóór de push.
- De pagina wordt een nieuw claude.ai-artifact met een eigen adres. Een geplande taak bouwt elke ochtend vanuit
  `bron/` en publiceert opnieuw.

## Regels

- Nooit uitslagen, odds of wedstrijden verzinnen.
- Geen officiële sites (ATP, WTA, Flashscore) scrapen; hun voorwaarden verbieden dat.
- De Kambi-feed is onofficieel en kan zonder waarschuwing veranderen of dichtgaan.
- Schrijven in het Nederlands: uitleg, commits en teksten op de pagina.

## Wanneer een API wel nodig wordt

Rik hoort het zodra een van deze punten optreedt:

1. tennis-data.co.uk is vanuit GitHub Actions niet bereikbaar, of de wekelijkse verversing is te traag voor
   bruikbare ratings midden in een toernooi.
2. De toets laat zien dat Unibet als marktanker duidelijk slechter is dan Pinnacle.
3. Er is behoefte aan service- en returncijfers per speler voor een scherper gamesmodel.

## Bouwvolgorde

1. Proef: is tennis-data.co.uk bereikbaar vanuit GitHub Actions?
2. Historie inlezen, Elo per ondergrond en de toets voor de winnaar.
3. Puntmodel voor setstand en games, met toets.
4. Kambi-ophaalscript, toernooitabel en spelers koppelen.
5. Pagina en aanbevelingen.
6. Workflows, weektoets, publiceren en CLAUDE.md.
