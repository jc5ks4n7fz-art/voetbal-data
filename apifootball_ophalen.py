#!/usr/bin/env python3
"""Haalt uitslagen en wedstrijdstatistieken (expected goals, schoten) op bij API-Football (v3)
en bewaart alles in data/apifootball.json. Bedoeld om dagelijks te draaien in een GitHub Action.

De API-sleutel komt uit de omgevingsvariabele APIFOOTBALL_KEY (GitHub-secret); hij staat nergens in dit bestand.
Gratis abonnement: 100 verzoeken per dag. Het script houdt zelf een reserve aan en gaat de volgende dag verder
waar het gebleven was (de nieuwste duels eerst).
"""
import datetime as dt
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

BASE = "https://v3.football.api-sports.io"
SEIZOEN = int(os.environ.get("SEIZOEN", "2026"))  # startjaar: 2026 = 2026/27
# API-Football competitie-id's -> code in de Voetbalvoorspeller (het script controleert de naam in het antwoord)
COMPETITIES = {39: "ENG1", 78: "GER1", 140: "ESP1", 135: "ITA1", 61: "FRA1", 94: "POR1", 144: "BEL1",
               88: "NED1", 203: "TUR1", 106: "POL1", 89: "NED2", 2: "UCL", 3: "UEL", 848: "UECL"}
UITVOER = "data/apifootball.json"
RESERVE = 5          # verzoeken die we per dag overlaten
PAUZE = 6.5          # seconden tussen verzoeken (gratis: max. 10 per minuut)
KLAAR = {"FT", "AET", "PEN"}


class Budget(Exception):
    pass


def vraag(pad, params, sleutel, stand):
    if stand["over"] is not None and stand["over"] <= RESERVE:
        raise Budget()
    url = f"{BASE}/{pad}?{urllib.parse.urlencode(params)}"
    req = urllib.request.Request(url, headers={"x-apisports-key": sleutel})
    time.sleep(PAUZE)
    with urllib.request.urlopen(req, timeout=40) as r:
        over = r.headers.get("x-ratelimit-requests-remaining")
        if over is not None and over.isdigit():
            stand["over"] = int(over)
        data = json.load(r)
    stand["gebruikt"] += 1
    fouten = data.get("errors")
    if fouten:
        tekst = json.dumps(fouten)
        if "limit" in tekst.lower() or "requests" in tekst.lower():
            raise Budget()
        raise RuntimeError(f"API-fout bij {pad} {params}: {tekst}")
    return data.get("response", [])


def stat(lijst, naam):
    for s in lijst:
        if s.get("type", "").lower() == naam.lower():
            v = s.get("value")
            if v in (None, ""):
                return None
            try:
                return float(str(v).replace("%", ""))
            except ValueError:
                return None
    return None


def main():
    sleutel = os.environ.get("APIFOOTBALL_KEY")
    if not sleutel:
        sys.exit("APIFOOTBALL_KEY ontbreekt (zet hem als secret in GitHub).")
    try:
        db = json.load(open(UITVOER, encoding="utf-8"))
    except (FileNotFoundError, json.JSONDecodeError):
        db = {}
    db.setdefault("seizoen", SEIZOEN)
    db.setdefault("wedstrijden", {})
    W = db["wedstrijden"]
    stand = {"over": None, "gebruikt": 0}
    log = []
    try:
        # 1) programma en uitslagen per competitie (1 verzoek per competitie)
        for lid, code in COMPETITIES.items():
            resp = vraag("fixtures", {"league": lid, "season": SEIZOEN}, sleutel, stand)
            if resp:
                naam = resp[0]["league"]["name"]
                log.append(f"{code} (id {lid}, '{naam}'): {len(resp)} duels")
            for f in resp:
                fid = str(f["fixture"]["id"])
                w = W.get(fid, {})
                w.update({
                    "comp": code, "datum": f["fixture"]["date"], "status": f["fixture"]["status"]["short"],
                    "ronde": f["league"].get("round"), "thuis": f["teams"]["home"]["name"], "uit": f["teams"]["away"]["name"],
                    "thuisgoals": f["goals"]["home"], "uitgoals": f["goals"]["away"],
                    "rust": [f["score"]["halftime"]["home"], f["score"]["halftime"]["away"]],
                    "na90": [f["score"]["fulltime"]["home"], f["score"]["fulltime"]["away"]],
                })
                W[fid] = w
        # 2) statistieken (xG, schoten) voor gespeelde duels die die nog missen; nieuwste eerst
        todo = sorted([k for k, w in W.items() if w["status"] in KLAAR and "stats" not in w], key=lambda k: W[k]["datum"], reverse=True)
        log.append(f"{len(todo)} gespeelde duels zonder statistieken")
        for fid in todo:
            resp = vraag("fixtures/statistics", {"fixture": fid}, sleutel, stand)
            w = W[fid]
            if len(resp) == 2:
                h, a = resp[0]["statistics"], resp[1]["statistics"]
                w["stats"] = {
                    "xg": [stat(h, "expected_goals"), stat(a, "expected_goals")],
                    "schoten": [stat(h, "Total Shots"), stat(a, "Total Shots")],
                    "opdoel": [stat(h, "Shots on Goal"), stat(a, "Shots on Goal")],
                    "balbezit": [stat(h, "Ball Possession"), stat(a, "Ball Possession")],
                }
            else:
                w["stats"] = None  # niet beschikbaar bij de bron; niet opnieuw proberen
    except Budget:
        log.append("dagbudget bereikt; morgen verder")
    finally:
        db["bijgewerkt"] = dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
        os.makedirs(os.path.dirname(UITVOER), exist_ok=True)
        with open(UITVOER, "w", encoding="utf-8") as fh:
            json.dump(db, fh, ensure_ascii=False, separators=(",", ":"))
        met = sum(1 for w in W.values() if w.get("stats") and w["stats"].get("xg") and w["stats"]["xg"][0] is not None)
        log.append(f"verzoeken gebruikt: {stand['gebruikt']}, over volgens API: {stand['over']}; duels met xG: {met}")
        print("\n".join(log))


if __name__ == "__main__":
    main()
