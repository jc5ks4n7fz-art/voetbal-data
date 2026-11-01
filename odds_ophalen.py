#!/usr/bin/env python3
"""Haalt de pre-match odds op bij API-Football (v3) voor alle komende duels in de competities van de
Voetbalvoorspeller en bewaart per duel een samenvatting in data/odds.json:

  - de eerste waarneming (de 'openingsodds' zoals wij die zagen) en de laatste waarneming vóór de aftrap
    (benadering van de slotkoers; met een run elke twee uur ligt die hooguit ~2 uur voor de aftrap);
  - per markt (1X2, Asian handicap, over/under) en per uitkomst: de odds van Pinnacle (scherpe referentie),
    de hoogste odds met de naam van die bookmaker, de gemiddelde odds en het aantal bookmakers.

De API-sleutel komt uit de omgevingsvariabele APIFOOTBALL_KEY (GitHub-secret) en wordt nergens opgeslagen.
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
SEIZOEN = int(os.environ.get("SEIZOEN", "2026"))
COMPETITIES = {39: "ENG1", 78: "GER1", 140: "ESP1", 135: "ITA1", 61: "FRA1", 94: "POR1", 144: "BEL1",
               88: "NED1", 203: "TUR1", 106: "POL1", 89: "NED2", 2: "UCL", 3: "UEL", 848: "UECL"}
UITVOER = "data/odds.json"
STATUS = "data/odds_status.json"
VOORBEELD = "data/odds_voorbeeld.json"
PAUZE = 0.25
RESERVE = 50
PINNACLE = "pinnacle"
# niet beschikbaar voor wedders in Nederland (geen KSA-vergunning): wel als marktinformatie, niet als "beste prijs"
NIET_IN_NL = {"pinnacle", "1xbet", "sbo", "dafabet", "marathonbet", "188bet", "betway"}


def nu():
    return dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def vraag(pad, params, sleutel, stand):
    if stand["over"] is not None and stand["over"] <= RESERVE:
        raise RuntimeError("dagbudget bijna op")
    url = f"{BASE}/{pad}?{urllib.parse.urlencode(params)}"
    req = urllib.request.Request(url, headers={"x-apisports-key": sleutel})
    time.sleep(PAUZE)
    with urllib.request.urlopen(req, timeout=40) as r:
        over = r.headers.get("x-ratelimit-requests-remaining")
        if over is not None and over.isdigit():
            stand["over"] = int(over)
        data = json.load(r)
    stand["gebruikt"] += 1
    if data.get("errors"):
        tekst = json.dumps(data["errors"])
        if "per minute" in tekst.lower():
            time.sleep(61)
            return vraag(pad, params, sleutel, stand)
        raise RuntimeError(f"API-fout bij {pad} {params}: {tekst}")
    return data


def getal(x):
    try:
        v = float(x)
        return v if v > 1.0 else None
    except (TypeError, ValueError):
        return None


def lijn(tekst):
    """'Home -0.25' / 'Over 2.5' / 'Away +1' -> ('Home', -0.25)."""
    delen = str(tekst).split()
    if len(delen) != 2:
        return None, None
    try:
        return delen[0].lower(), float(delen[1])
    except ValueError:
        return None, None


def verzamel(bookmakers):
    """Per bookmaker de odds van de drie markten, als {markt: {sleutel: [odds per uitkomst]}}."""
    per_bm = {}
    for bm in bookmakers:
        naam = bm.get("name", "?")
        markten = {"1x2": {}, "ah": {}, "ou": {}, "dc": {}, "dnb": {}}
        for bet in bm.get("bets", []):
            bid, vals = bet.get("id"), bet.get("values", [])
            if bid == 1:  # Match Winner
                m = {str(v.get("value")).lower(): getal(v.get("odd")) for v in vals}
                if all(m.get(k) for k in ("home", "draw", "away")):
                    markten["1x2"]["-"] = [m["home"], m["draw"], m["away"]]
            elif bid == 12 or bet.get("name") == "Double Chance":  # 1X, 12, X2
                m = {str(v.get("value")).lower().replace(" ", ""): getal(v.get("odd")) for v in vals}
                r = [m.get("home/draw"), m.get("home/away"), m.get("draw/away")]
                if all(r):
                    markten["dc"]["-"] = r
            elif bid == 2 or bet.get("name") == "Home/Away":  # draw no bet
                m = {str(v.get("value")).lower(): getal(v.get("odd")) for v in vals}
                if m.get("home") and m.get("away"):
                    markten["dnb"]["-"] = [m["home"], m["away"]]
            elif bid == 4:  # Asian Handicap: per lijn (vanuit de thuisploeg) [thuis, uit]
                for v in vals:
                    kant, l = lijn(v.get("value"))
                    o = getal(v.get("odd"))
                    if kant not in ("home", "away") or o is None:
                        continue
                    # API-Football noteert bij beide kanten de handicap van de THUISploeg: 'Home -1' (5,00) en
                    # 'Away -1' (1,17) horen bij dezelfde lijn (thuis −1 / uit +1); gecontroleerd: 1/5,00 + 1/1,17 ≈ 1,05.
                    thuislijn = l
                    s = markten["ah"].setdefault(f"{thuislijn:+.2f}", [None, None])
                    s[0 if kant == "home" else 1] = o
            elif bid == 5:  # Goals Over/Under
                for v in vals:
                    kant, l = lijn(v.get("value"))
                    o = getal(v.get("odd"))
                    if kant not in ("over", "under") or o is None:
                        continue
                    s = markten["ou"].setdefault(f"{l:.2f}", [None, None])
                    s[0 if kant == "over" else 1] = o
        for mk in ("ah", "ou"):
            markten[mk] = {k: v for k, v in markten[mk].items() if None not in v}
        per_bm[naam] = markten
    return per_bm


def samenvatting(per_bm):
    """Per markt/lijn: pinnacle, max (+ bookmaker), gemiddelde en aantal bookmakers."""
    uit = {}
    for mk in ("1x2", "ah", "ou", "dc", "dnb"):
        lijnen = {}
        for naam, markten in per_bm.items():
            for k, odds in markten[mk].items():
                lijnen.setdefault(k, []).append((naam, odds))
        res = {}
        for k, rij in lijnen.items():
            n = len(rij[0][1])
            pin = next((o for nm, o in rij if nm.lower() == PINNACLE), None)
            mx, mxbm, gem = [], [], []
            nl = [x for x in rij if x[0].lower() not in NIET_IN_NL]
            for i in range(n):
                if nl:
                    beste = max(nl, key=lambda x: x[1][i])
                    mx.append(beste[1][i]); mxbm.append(beste[0])
                else:
                    mx.append(None); mxbm.append(None)
                gem.append(round(sum(x[1][i] for x in rij) / len(rij), 3))
            res[k] = {"pin": pin, "max": mx, "bm": mxbm, "gem": gem, "n": len(rij)}
        uit[mk] = res
    return uit


def main():
    sleutel = (os.environ.get("APIFOOTBALL_KEY") or "").strip()
    os.makedirs("data", exist_ok=True)
    if not sleutel:
        json.dump({"tijd": nu(), "ok": False, "melding": "APIFOOTBALL_KEY ontbreekt"}, open(STATUS, "w"))
        return 1
    try:
        db = json.load(open(UITVOER, encoding="utf-8"))
    except (FileNotFoundError, json.JSONDecodeError):
        db = {}
    W = db.setdefault("wedstrijden", {})
    stand = {"over": None, "gebruikt": 0}
    log, fout, voorbeeld = [], None, []
    tijd = nu()
    try:
        for lid, code in COMPETITIES.items():
            pagina, totaal, n = 1, 1, 0
            while pagina <= totaal:
                data = vraag("odds", {"league": lid, "season": SEIZOEN, "page": pagina}, sleutel, stand)
                totaal = (data.get("paging") or {}).get("total") or 1
                for x in data.get("response", []):
                    fx = x.get("fixture") or {}
                    fid = str(fx.get("id"))
                    aftrap = fx.get("date")
                    if not aftrap:
                        continue
                    # alleen waarnemingen vóór de aftrap tellen (live odds niet)
                    if dt.datetime.fromisoformat(aftrap.replace("Z", "+00:00")) <= dt.datetime.now(dt.timezone.utc):
                        continue
                    per_bm = verzamel(x.get("bookmakers", []))
                    if not per_bm:
                        continue
                    snap = {"t": tijd, "bron_t": x.get("update"), **samenvatting(per_bm)}
                    w = W.setdefault(fid, {"comp": code})
                    w["aftrap"] = aftrap
                    w.setdefault("eerste", snap)
                    w["laatste"] = snap
                    n += 1
                    if len(voorbeeld) < 2:
                        voorbeeld.append({**x, "bookmakers": [{**b, "bets": [t for t in b.get("bets", []) if t.get("id") in (1, 2, 4, 5, 12)]} for b in x.get("bookmakers", [])]})
                pagina += 1
            log.append(f"{code}: {n} duels met odds")
    except urllib.error.HTTPError as e:
        fout = f"HTTP {e.code}"
    except Exception as e:  # noqa: BLE001
        fout = f"{type(e).__name__}: {str(e)[:300]}"
    finally:
        # oude duels (aftrap > 60 dagen geleden) opruimen, zodat het bestand klein blijft
        grens = (dt.datetime.now(dt.timezone.utc) - dt.timedelta(days=60)).strftime("%Y-%m-%d")
        for k in [k for k, w in W.items() if (w.get("aftrap") or "9999")[:10] < grens]:
            del W[k]
        db["bijgewerkt"] = tijd
        with open(UITVOER, "w", encoding="utf-8") as fh:
            json.dump(db, fh, ensure_ascii=False, separators=(",", ":"))
        if voorbeeld:
            with open(VOORBEELD, "w", encoding="utf-8") as fh:
                json.dump(voorbeeld, fh, ensure_ascii=False, indent=1)
        log.append(f"verzoeken gebruikt: {stand['gebruikt']}, over volgens API: {stand['over']}")
        melding = (fout or "ok").replace(sleutel, "***")
        print("\n".join(log)); print(melding)
        with open(STATUS, "w", encoding="utf-8") as fh:
            json.dump({"tijd": tijd, "ok": fout is None, "melding": melding, "log": log}, fh, ensure_ascii=False, indent=1)
    return 0 if fout is None else 1


if __name__ == "__main__":
    sys.exit(main())
