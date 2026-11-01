# Toetsen en bijstellen

- `node toets/fit.js pagina.html '{"hfaPrior":0.12}' uit.json` — walk-forward voorspellingen 2026/27 (alleen data van vóór de speelweek) met odds van football-data.co.uk.
- `python3 toets/hfa_an.py uit.json` — log-loss model en combinatie, gemiddelde thuis/uit-kans.
- `python3 toets/fit_an2.py uit.json named` — beste modelgewicht en weddenschapstest (CLV, ROI) met prijzen van gangbare bookmakers.

Regel: een instelling wordt alleen aangepast als ze beter is op de laatste 4 weken (niet gebruikt bij het kiezen) én over het hele seizoen.

- `python3 toets/blessure_features.py bf.json` en `node toets/blessure_toets.js pagina2.html bf.json` — effect van afwezigen (injAtt/injDef) toetsen, met splitsing eerste/tweede helft.
