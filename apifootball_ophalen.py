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
# startjaren: huidig seizoen eerst, daarna twee vorige seizoenen (voor de historie van het model)
SEIZOENEN = [int(x) for x in os.environ.get("SEIZOENEN", "2026,2025,2024").split(",")]
# API-Football competitie-id's -> code in de Voetbalvoorspeller (het script controleert de naam in het antwoord)
COMPETITIES = {39: "ENG1", 78: "GER1", 140: "ESP1", 135: "ITA1", 61: "FRA1", 94: "POR1", 144: "BEL1",
               88: "NED1", 203: "TUR1", 106: "POL1", 89: "NED2", 2: "UCL", 3: "UEL", 848: "UECL"}
UITVOER = "data/apifootball.json"
RESERVE = 5          # verzoeken die we per dag overlaten
PAUZE = float(os.environ.get("PAUZE", "0.25"))  # seconden tussen verzoeken (Pro: 300 per minuut; gratis: zet op 6.5)
MAX_PER_RUN = int(os.environ.get("MAX_PER_RUN", "4000"))  # zodat een run binnen de tijdslimiet blijft
KLAAR = {"FT", "AET", "PEN"}


class Budget(Exception):
    pass


def vraag(pad, params, sleutel, stand):
    if (stand["over"] is not None and stand["over"] <= RESERVE) or stand["gebruikt"] >= MAX_PER_RUN:
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
        if "per minute" in tekst.lower() or "ratelimit" in tekst.lower():
            time.sleep(61); return vraag(pad, params, sleutel, stand)
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


STATUS = "data/status.json"


def schrijf_status(ok, melding, extra=None):
    """Status in de repository, zodat ook zonder toegang tot de Actions-logboeken zichtbaar is wat er gebeurde.
    Bevat nooit de sleutel."""
    os.makedirs(os.path.dirname(STATUS), exist_ok=True)
    st = {"tijd": dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%d %H:%M UTC"), "ok": ok, "melding": melding}
    st.update(extra or {})
    with open(STATUS, "w", encoding="utf-8") as fh:
        json.dump(st, fh, ensure_ascii=False, indent=1)


def main():
    sleutel = (os.environ.get("APIFOOTBALL_KEY") or "").strip()
    if not sleutel:
        schrijf_status(False, "APIFOOTBALL_KEY ontbreekt: zet de sleutel als repository secret (Settings > Secrets and variables > Actions).")
        print("APIFOOTBALL_KEY ontbreekt"); return 1
    try:
        db = json.load(open(UITVOER, encoding="utf-8"))
    except (FileNotFoundError, json.JSONDecodeError):
        db = {}
    db["seizoenen"] = SEIZOENEN
    db.setdefault("wedstrijden", {})
    W = db["wedstrijden"]
    stand = {"over": None, "gebruikt": 0}
    log = []
    fout = None
    try:
        # 1) programma en uitslagen per competitie (1 verzoek per competitie)
        # vorige seizoenen hoeven maar één keer opgehaald te worden
        gedaan = set(db.get("seizoenen_compleet", []))
        for seizoen in SEIZOENEN:
          if seizoen != SEIZOENEN[0] and seizoen in gedaan:
            continue
          fouten_seizoen = 0
          for lid, code in COMPETITIES.items():
            try:
                resp = vraag("fixtures", {"league": lid, "season": seizoen}, sleutel, stand)
            except RuntimeError as e:
                log.append(f"{code} {seizoen}: {str(e)[:160]}"); fouten_seizoen += 1; continue
            if resp:
                naam = resp[0]["league"]["name"]
                log.append(f"{code} {seizoen} (id {lid}, '{naam}'): {len(resp)} duels")
            for f in resp:
                fid = str(f["fixture"]["id"])
                w = W.get(fid, {})
                w.update({
                    "comp": code, "seizoen": seizoen, "datum": f["fixture"]["date"], "status": f["fixture"]["status"]["short"],
                    "ronde": f["league"].get("round"), "thuis": f["teams"]["home"]["name"], "uit": f["teams"]["away"]["name"],
                    "thuisgoals": f["goals"]["home"], "uitgoals": f["goals"]["away"],
                    "rust": [f["score"]["halftime"]["home"], f["score"]["halftime"]["away"]],
                    "na90": [f["score"]["fulltime"]["home"], f["score"]["fulltime"]["away"]],
                })
                W[fid] = w
          if seizoen != SEIZOENEN[0] and not fouten_seizoen:
            gedaan.add(seizoen)
        db["seizoenen_compleet"] = sorted(gedaan)
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
    except urllib.error.HTTPError as e:
        fout = f"HTTP {e.code} van API-Football: {e.read()[:300].decode(errors='ignore')}"
    except Exception as e:  # noqa: BLE001 - melding naar status.json
        fout = f"{type(e).__name__}: {str(e)[:400]}"
    finally:
        db["bijgewerkt"] = dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
        os.makedirs(os.path.dirname(UITVOER), exist_ok=True)
        with open(UITVOER, "w", encoding="utf-8") as fh:
            json.dump(db, fh, ensure_ascii=False, separators=(",", ":"))
        met = sum(1 for w in W.values() if w.get("stats") and w["stats"].get("xg") and w["stats"]["xg"][0] is not None)
        log.append(f"verzoeken gebruikt: {stand['gebruikt']}, over volgens API: {stand['over']}; duels met xG: {met}")
        if fout: log.append("FOUT: " + fout.replace(sleutel, "***"))
        print("\n".join(log))
        schrijf_status(fout is None, (fout or "ok").replace(sleutel, "***"), {"log": [x.replace(sleutel, "***") for x in log],
                       "duels": len(W), "met_xg": met, "verzoeken": stand["gebruikt"], "over": stand["over"]})
    return 0 if fout is None else 1


if __name__ == "__main__":
    sys.exit(main())
