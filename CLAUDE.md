# Voetbalvoorspeller — werkinstructies voor Claude Code

Dit is de repository achter Riks Voetbalvoorspeller: één HTML-pagina (geen server) die wedstrijden voorspelt
voor de top-10-competities van Europa, de Keuken Kampioen Divisie, de Europese bekers en interlands. Schrijf in het
Nederlands (uitleg, commits, UI-teksten). Rik gebruikt de tool vooral om te **voorspellen**; waarde-bets en het
CLV-logboek zijn een bijzaak en worden alleen op papier gevolgd. Gok-advies altijd nuchter en eerlijk.

## Opbouw

```
bron/            ← de master van de pagina; wijzig hier, nooit in een gebouwde .html
  p1_head.html   titel, lettertype, CSS (Apple-bento-stijl, licht + donker)
  p2_data.js     competities, formats, teams, aliassen (SEED_*)
  p2b_extra.js   lege standaardwaarden voor het datablok (/*DATA-START*/ … /*DATA-END*/)
  p3_engine.js   model: Poisson/Dixon-Coles-fit (clubFit), lambdas(), predict(), calibrate(), Elo, simulatie,
                 DEFAULT_SETTINGS
  p3b_value.js   markt + model: devig (power), blendP, matchValue, valueBets, predictMatch, pouleAdvice,
                 blessures (injFor/applyInj), terugblik (reviewRows), Mijn bets
  p4_ui.js       alle pagina's en knoppen (render, onClick, onChange, pageWeek, pageReview, pageMyBets, …),
                 boot() met settings-migraties (modelRev)
  bouw.py        plakt de delen aan elkaar + sluit update_data.py en waarde.js in als <script type="text/x-…">
  update_data.py haalt alle data op en schrijft het datablok in de pagina
  waarde.js      markeert waarde-bets en voegt ze toe aan data/picks.json (CLV-logboek)
toets/           walk-forward toetsen (zie toets/README.md)
data/            door GitHub Actions bijgewerkt: apifootball.json, odds.json, blessures.json, spelers.json,
                 fd/*.csv (football-data.co.uk), picks.json (markeringen)
rapporten/       weekrapporten van de wekelijkse toets
*_ophalen.py     scripts van de GitHub Actions (API-Football, odds, Kambi-feed, football-data.co.uk)
bron/markeren.sh markeert in de odds-run automatisch waarde-bets (op papier) en bewaart slotkoersen in picks.json
```

## Bouwen en bekijken

```bash
python3 bron/bouw.py basis.html
python3 bron/update_data.py basis.html pagina.html        # haalt data van GitHub raw + openfootball e.d.
node bron/waarde.js pagina.html data/picks.json pagina2.html
# bekijken: open pagina2.html in de browser (bijv. npx serve .)
```

De gebouwde .html-bestanden staan in .gitignore. Test UI-wijzigingen met Playwright op 1280 px én 390 px,
licht én donker: geen pageerrors, geen horizontale scroll (`document.documentElement.scrollWidth`).
De JS uit een gebouwde pagina laden in Node: neem de tekst tussen `<script>` en `\nboot();\n</script>` en
roep `buildSeed()` aan (zie toets/fit.js).

## Model in het kort

- Rating-fit: gewogen Poisson-MLE met blok-Gauss-Seidel (halfLife 365 d), doel = 0,5·xG + 0,5·goals,
  historie van 2 vorige seizoenen als prior, thuisvoordeel per competitie (hfaPrior 0,12, hfaTau 600).
- Kalibratie: spread/supCap op de supremacy (zie `calibrate()`); de wekelijkse toets stelt spread bij.
- Blessures: λ × exp(−injAtt·aandeel goals+½assists afwezigen + injDef·belang afwezige verdedigers tegenstander).
- Voorspelling = faire marktkans (Pinnacle/Betfair Exchange, power-devig) gecombineerd met het model
  (gewicht 0,15, per competitie instelbaar via valueWComp); zonder odds alleen het model.
- "Beste prijs" alleen bij bookmakers met Nederlandse vergunning: Bet365 (API-Football) en Unibet, Jack's en
  LeoVegas (kambi_ophalen.py: openbare, onofficiële Kambi-feed, alleen 1X2 en de hoofdlijn over/under). De
  Kambi-prijzen tellen niet mee in het gemiddelde of als referentie, alleen als beste prijs.
- Nations League (UNL): odds via API-Football (competitie-id 5) en de Kambi-feed; de landnamen staan bij het duel
  in odds.json. Het modelgewicht is voor landenteams standaard 0 (alleen de markt): het Elo-model is niet tegen
  odds getoetst. Aanpassen kan met valueWComp, bv. "UNL=0.15".

## Regels

- Een standaardinstelling (DEFAULT_SETTINGS) alleen wijzigen als de toets aantoonbaar beter is: log-loss
  minstens 0,001 beter op de laatste 4 weken (niet gebruikt bij het kiezen) én over het hele seizoen. Verhoog dan
  `modelRev` en voeg in boot() een migratie toe zoals bij modelRev 3–5.
- Nooit uitslagen, odds of wedstrijden verzinnen. De API-sleutel (secret APIFOOTBALL_KEY) staat alleen in GitHub;
  nooit tonen of loggen.
- Workflows schrijven naar data/: altijd `git pull --rebase` vóór push.
- Odds van API-Football: bij Asian handicap noteert de API bij beide kanten de handicap van de thuisploeg.

## Publiceren

De pagina leeft als claude.ai-artifact: https://claude.ai/artifact/FTPDonNG29E9kxi81MQpPv. Publiceer
vanuit een sessie met de Artifact-tool (action publish, url hierboven, file_path = pagina2.html, capabilities
weglaten). Een geplande taak ververst de data elke ochtend (07:41) en de weektoets draait maandag 14:17; beide
bouwen vanuit bron/ in deze repository.
