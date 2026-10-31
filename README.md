# Voetbal-data (API-Football)

Deze repository haalt elke dag automatisch uitslagen en wedstrijdstatistieken (expected goals, schoten, balbezit) op bij API-Football en bewaart ze in `data/apifootball.json`. De Voetbalvoorspeller leest dat bestand.

De API-sleutel staat **niet** in deze bestanden, maar als geheim (secret) in de instellingen van de repository.

## Installatie (eenmalig, ±10 minuten)

1. **Sleutel aanvragen** – maak een gratis account op dashboard.api-football.com en kopieer je API-sleutel. Deel die sleutel met niemand, ook niet in een chat.
2. **Repository maken** – op github.com: *New repository*, naam bijvoorbeeld `voetbal-data`, zichtbaarheid **Public** (dan kan de voorspeller het databestand lezen; de sleutel blijft geheim).
3. **Bestanden uploaden** – *Add file → Upload files* en sleep deze map erin: `apifootball_ophalen.py`, `README.md` en de map `.github/workflows/` met `apifootball.yml`. Lukt het slepen van de verborgen map `.github` niet: kies *Add file → Create new file*, typ als naam `.github/workflows/apifootball.yml` en plak de inhoud.
4. **Sleutel als geheim opslaan** – *Settings → Secrets and variables → Actions → New repository secret*. Naam: `APIFOOTBALL_KEY`, waarde: je sleutel.
5. **Eerste keer starten** – tabblad *Actions → API-Football ophalen → Run workflow*. Na een paar minuten staat er een bestand `data/apifootball.json`.
6. **Laat de naam van de repository weten** (bijvoorbeeld `rikjansen/voetbal-data`) – dan koppel ik het bestand aan de voorspeller.

## Budget

Het gratis abonnement geeft 100 verzoeken per dag. Per dag kost het programma 14 verzoeken (één per competitie); de rest gaat naar statistieken per wedstrijd, nieuwste eerst. Het inhalen van het hele lopende seizoen duurt daardoor ongeveer twee weken; daarna is elke dag ruim voldoende. Met het Pro-abonnement (7.500 per dag) is alles in één keer binnen.
