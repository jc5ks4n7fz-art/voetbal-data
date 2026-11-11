# Toetsen en bijstellen

- `node toets/fit.js pagina.html '{"hfaPrior":0.12}' uit.json` — walk-forward voorspellingen 2026/27 (alleen data van vóór de speelweek) met odds van football-data.co.uk.
- `python3 toets/hfa_an.py uit.json` — log-loss model en combinatie, gemiddelde thuis/uit-kans.
- `python3 toets/fit_an2.py uit.json named` — beste modelgewicht en weddenschapstest (CLV, ROI) met prijzen van gangbare bookmakers.

Regel: een instelling wordt alleen aangepast als ze beter is op de laatste 4 weken (niet gebruikt bij het kiezen) én over het hele seizoen.

- `python3 toets/blessure_features.py bf.json` en `node toets/blessure_toets.js pagina2.html bf.json` — effect van afwezigen (injAtt/injDef) toetsen, met splitsing eerste/tweede helft.

## Recente vorm (proef-instelling `formW`, standaard uit)

`node toets/fit.js pagina.html '{"formW":0.05}' uit.json` — telt het gemiddelde verschil tussen behaald en verwacht doelsaldo
(xG/goals-mix) in de laatste 5 duels mee in de verwachte doelpunten. Toets 11 nov 2026 (904 duels, keuze vóór 12 okt):

| formW | keuze | controle | totaal | combinatie (w 0,15) totaal |
|---|---|---|---|---|
| 0 | 0,9701 | 0,9159 | 0,9500 | 0,9425 |
| 0,05 | 0,9699 | 0,9124 | 0,9486 | 0,9423 |
| 0,10 | 0,9708 | 0,9109 | 0,9486 | 0,9422 |
| 0,20 | 0,9758 | 0,9136 | 0,9527 | 0,9421 |

0,05 haalt de regel op papier (controle −0,0035, seizoen −0,0014), maar de winst op de keuzeperiode is 0,0002 (ruis) en de
combinatie die de pagina toont wint 0,0002. Niet als standaard gezet; meenemen in de weektoets als er meer duels zijn.
