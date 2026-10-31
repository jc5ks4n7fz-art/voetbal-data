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
MAX_PER_RUN = int(os.environ.get("MAX_PER_RUN", "7000"))  # zodat een run binnen de tijdslimiet blijft
KLAAR = {"FT", "AET", "PEN"}


class Budget(Exception):
    pass


def vraag(pad, params, sleutel, stand):
    return _vraag(pad, params, sleutel, stand, volledig=False)


def _vraag(pad, params, sleutel, stand, volledig):
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
            time.sleep(61); return _vraag(pad, params, sleutel, stand, volledig)
        if "limit" in tekst.lower() or "requests" in tekst.lower():
            raise Budget()
        raise RuntimeError(f"API-fout bij {pad} {params}: {tekst}")
    return data if volledig else data.get("response", [])


def vraag_ruw(pad, params, sleutel, stand):
    return _vraag(pad, params, sleutel, stand, volledig=True)


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
BLESSURES = "data/blessures.json"
SPELERS = "data/spelers.json"
LEAGUES = {"ENG1", "GER1", "ESP1", "ITA1", "FRA1", "POR1", "BEL1", "NED1", "TUR1", "POL1", "NED2"}


def laad(pad, leeg):
    try:
        return json.load(open(pad, encoding="utf-8"))
    except (FileNotFoundError, json.JSONDecodeError):
        return leeg


def blessures(seizoen, sleutel, stand, log, BL):
    """Afwezige spelers per wedstrijd (blessure, schorsing, twijfelachtig). Huidig seizoen elke run, vorige seizoenen eenmalig."""
    vorig = seizoen != SEIZOENEN[0]
    if vorig and str(seizoen) in BL["seizoenen"]:
        return
    n = 0
    for lid, code in COMPETITIES.items():
        try:
            resp = vraag("injuries", {"league": lid, "season": seizoen}, sleutel, stand)
        except RuntimeError as e:
            log.append(f"blessures {code} {seizoen}: {str(e)[:120]}"); continue
        per = {}
        for x in resp:
            fid = str((x.get("fixture") or {}).get("id") or "")
            if not fid: continue
            per.setdefault(fid, []).append([x["team"]["id"], x["player"]["id"], x["player"]["name"], x["player"].get("type"), x["player"].get("reason")])
        BL["per_wedstrijd"].update(per); n += len(resp)
    BL["seizoenen"][str(seizoen)] = dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%d")
    log.append(f"blessures {seizoen}: {n} meldingen")


def spelers(seizoen, W, sleutel, stand, log, SP, ververs_dagen):
    """Per club: minuten, wedstrijden, goals, assists en beoordeling per speler (voor het gewicht van afwezigen)."""
    teams = sorted({(w["thuis_id"]) for w in W.values() if w.get("comp") in LEAGUES and w.get("seizoen") == SEIZOENEN[0] and w.get("thuis_id")})
    vandaag = dt.date.today(); n = 0
    for tid in teams:
        sleutel_ts = f"{tid}|{seizoen}"; laatst = SP["opgehaald"].get(sleutel_ts)
        if laatst and (ververs_dagen is None or (vandaag - dt.date.fromisoformat(laatst)).days < ververs_dagen):
            continue
        rijen, pagina, totaal = {}, 1, 1
        while pagina <= totaal:
            data = vraag_ruw("players", {"team": tid, "season": seizoen, "page": pagina}, sleutel, stand)
            totaal = (data.get("paging") or {}).get("total") or 1
            for x in data.get("response", []):
                p = x["player"]; mins = apps = g = a = 0; rating = []; pos = None
                for st in x.get("statistics", []):
                    if (st.get("team") or {}).get("id") != tid: continue
                    ga = st.get("games") or {}; gl = st.get("goals") or {}
                    mins += ga.get("minutes") or 0; apps += ga.get("appearences") or 0; pos = pos or ga.get("position")
                    g += gl.get("total") or 0; a += gl.get("assists") or 0
                    if ga.get("rating"):
                        try: rating.append(float(ga["rating"]))
                        except ValueError: pass
                rijen[str(p["id"])] = [p.get("name"), pos, apps, mins, g, a, round(sum(rating) / len(rating), 2) if rating else None]
            pagina += 1
        SP["teams"].setdefault(str(tid), {})[str(seizoen)] = rijen
        SP["opgehaald"][sleutel_ts] = vandaag.isoformat(); n += 1
    if n: log.append(f"spelers {seizoen}: {n} clubs bijgewerkt")


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
    BL = laad(BLESSURES, {"seizoenen": {}, "per_wedstrijd": {}})
    SP = laad(SPELERS, {"opgehaald": {}, "teams": {}})
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
                    "thuis_id": f["teams"]["home"]["id"], "uit_id": f["teams"]["away"]["id"],
                    "thuisgoals": f["goals"]["home"], "uitgoals": f["goals"]["away"],
                    "rust": [f["score"]["halftime"]["home"], f["score"]["halftime"]["away"]],
                    "na90": [f["score"]["fulltime"]["home"], f["score"]["fulltime"]["away"]],
                })
                W[fid] = w
          if seizoen != SEIZOENEN[0] and not fouten_seizoen:
            gedaan.add(seizoen)
        db["seizoenen_compleet"] = sorted(gedaan)
        # 1b) blessures/schorsingen per wedstrijd (1 verzoek per competitie per seizoen)
        blessures(SEIZOENEN[0], sleutel, stand, log, BL)
        # 1c) spelersstatistieken (minuten, goals, assists) per club in de competities: huidig seizoen wekelijks verversen
        spelers(SEIZOENEN[0], W, sleutel, stand, log, SP, ververs_dagen=6)
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
        # 3) vorig seizoen: blessures en spelers eenmalig (nodig om het effect van afwezigen te toetsen)
        if len(SEIZOENEN) > 1:
            blessures(SEIZOENEN[1], sleutel, stand, log, BL)
            spelers(SEIZOENEN[1], W, sleutel, stand, log, SP, ververs_dagen=None)
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
        for pad, obj in ((BLESSURES, BL), (SPELERS, SP)):
            with open(pad, "w", encoding="utf-8") as fh:
                json.dump(obj, fh, ensure_ascii=False, separators=(",", ":"))
        met = sum(1 for w in W.values() if w.get("stats") and w["stats"].get("xg") and w["stats"]["xg"][0] is not None)
        log.append(f"verzoeken gebruikt: {stand['gebruikt']}, over volgens API: {stand['over']}; duels met xG: {met}")
        if fout: log.append("FOUT: " + fout.replace(sleutel, "***"))
        print("\n".join(log))
        schrijf_status(fout is None, (fout or "ok").replace(sleutel, "***"), {"log": [x.replace(sleutel, "***") for x in log],
                       "duels": len(W), "met_xg": met, "verzoeken": stand["gebruikt"], "over": stand["over"]})
    return 0 if fout is None else 1


if __name__ == "__main__":
    sys.exit(main())
