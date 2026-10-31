#!/usr/bin/env python3
"""Downloadt de uitslagen-met-odds van football-data.co.uk (o.a. Pinnacle-openings- en slotkoersen, hoogste en
gemiddelde odds, Asian handicap) voor het lopende en het vorige seizoen. Wordt gebruikt om te toetsen hoe zwaar
het model moet meetellen naast de marktkans, en om closing line value te meten. Geen sleutel nodig."""
import os
import urllib.request

SEIZOENEN = ["2627", "2526"]
LIGA = ["E0", "D1", "SP1", "I1", "F1", "N1", "B1", "P1", "T1"]
EXTRA = ["POL"]  # 'new'-bestanden: alle seizoenen in één bestand
os.makedirs("data/fd", exist_ok=True)


def haal(url, pad):
    try:
        with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"}), timeout=40) as r:
            data = r.read()
        if len(data) > 500:
            open(pad, "wb").write(data)
            print("ok", pad, len(data))
    except Exception as e:  # noqa: BLE001
        print("mislukt", url, e)


for s in SEIZOENEN:
    for l in LIGA:
        haal(f"https://www.football-data.co.uk/mmz4281/{s}/{l}.csv", f"data/fd/{l}_{s}.csv")
for l in EXTRA:
    haal(f"https://www.football-data.co.uk/new/{l}.csv", f"data/fd/{l}.csv")
haal("https://www.football-data.co.uk/fixtures.csv", "data/fd/fixtures.csv")
haal("https://www.football-data.co.uk/new_league_fixtures.csv", "data/fd/new_league_fixtures.csv")
