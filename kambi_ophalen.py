#!/usr/bin/env python3
"""Odds van Nederlandse bookmakers op het Kambi-platform (Unibet, Jack's, LeoVegas) via de openbare feed die hun
eigen websites gebruiken. Geen sleutel nodig. Onofficieel: de feed kan zonder waarschuwing veranderen of dichtgaan;
elke fout wordt daarom opgevangen en levert gewoon minder (of geen) Nederlandse prijzen op.

Per competitie en bookmaker één verzoek (lijstweergave): 1X2 en de hoofdlijn van over/under.
Wordt gebruikt door odds_ophalen.py; los draaien toont wat er binnenkomt:  python3 kambi_ophalen.py
"""
import datetime as dt
import difflib
import json
import time
import unicodedata
import urllib.request

BASIS = "https://eu-offering-api.kambicdn.com/offering/v2018"
BOOKMAKERS = {"ubnl": "Unibet", "jvh": "Jacks", "leonl": "LeoVegas"}
PADEN = {"ENG1": "england/premier_league", "GER1": "germany/bundesliga", "ESP1": "spain/la_liga", "ITA1": "italy/serie_a",
         "FRA1": "france/ligue_1", "POR1": "portugal/primeira_liga", "BEL1": "belgium/jupiler_pro_league",
         "NED1": "netherlands/eredivisie", "TUR1": "turkey/super_lig", "POL1": "poland/ekstraklasa",
         "NED2": "netherlands/eerste_divisie", "UCL": "champions_league", "UEL": "europa_league", "UECL": "conference_league",
         "UNL": "uefa_nations_league"}
PAUZE = 0.4
WEG = {"fc", "sc", "sv", "cf", "ac", "as", "ss", "us", "afc", "bk", "fk", "sk", "if", "cd", "ud", "rc", "rcd", "ca", "club", "de", "kv", "krc",
       "ks", "kks", "mks", "gks", "rks", "calcio", "1", "04", "05", "1899", "1846", "1910", "tsg", "vfb", "vfl", "bsc", "ogc", "aj", "stade", "real", "29", "07", "estac", "fsv", "republic", "of", "and", "rep"}
ZELFDE = {"psg": "paris saint germain", "man": "manchester", "utd": "united", "spurs": "tottenham", "inter": "internazionale",
          "monchengladbach": "gladbach", "m'gladbach": "gladbach", "st": "saint", "nijmegen": "nec", "wolves": "wolverhampton",
          "munchen": "munich", "bayern": "bayern munich", "koln": "cologne", "atletico": "atl", "athletic": "ath", "sporting": "sporting cp",
          "milan": "ac milan", "brestois": "brest", "turkiye": "turkey", "czechia": "czech", "fyr": "north"}


def _norm(naam):
    s = unicodedata.normalize("NFKD", naam or "").encode("ascii", "ignore").decode().lower()
    s = "".join(c if c.isalnum() or c == "'" else " " for c in s)
    woorden = [ZELFDE.get(w, w) for w in s.split()]
    kern = [w for w in " ".join(woorden).split() if w not in WEG]
    return " ".join(kern or woorden)


def gelijkenis(a, b):
    """0..1: hoe waarschijnlijk dezelfde club (genormaliseerde namen, woordoverlap of lettergelijkenis)."""
    x, y = _norm(a), _norm(b)
    if not x or not y:
        return 0.0
    if x == y:
        return 1.0
    wx, wy = set(x.split()), set(y.split())
    if wx <= wy or wy <= wx:
        return 0.9
    return difflib.SequenceMatcher(None, x, y).ratio()


def _odd(o):
    v = o.get("odds")
    return round(v / 1000, 3) if isinstance(v, (int, float)) and v > 1000 and o.get("status", "OPEN") == "OPEN" else None


def haal(codes=None, log=None):
    """Lijst van {comp, start (datetime UTC), thuis, uit, bm, 1x2: [1,X,2] of None, ou: {"2.50": [over, onder]}}."""
    uit, nu = [], dt.datetime.now(dt.timezone.utc)
    for code, pad in PADEN.items():
        if codes and code not in codes:
            continue
        for op, naam in BOOKMAKERS.items():
            url = f"{BASIS}/{op}/listView/football/{pad}.json?lang=nl_NL&market=NL&useCombined=true"
            try:
                time.sleep(PAUZE)
                req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0", "Accept": "application/json"})
                with urllib.request.urlopen(req, timeout=30) as r:
                    data = json.load(r)
            except Exception as e:  # noqa: BLE001
                if log is not None:
                    log.append(f"Kambi {naam} {code}: niet opgehaald ({type(e).__name__})")
                continue
            for ev in data.get("events", []):
                e = ev.get("event") or {}
                try:
                    start = dt.datetime.fromisoformat(e["start"].replace("Z", "+00:00"))
                except (KeyError, ValueError):
                    continue
                if start <= nu or e.get("state") == "STARTED" or not e.get("homeName") or not e.get("awayName"):
                    continue
                thuis, uit_ = e["homeName"], e["awayName"]
                # landen staan in het Nederlands in homeName ("Turkije"); de Engelse naam past bij API-Football
                en = (e.get("englishName") or "").split(f' {e.get("nameDelimiter") or "-"} ')
                if code == "UNL" and len(en) == 2:
                    thuis, uit_ = en
                rij = {"comp": code, "start": start, "thuis": thuis, "uit": uit_, "bm": naam, "1x2": None, "ou": {}}
                for bo in ev.get("betOffers", []):
                    soort = (bo.get("betOfferType") or {}).get("englishName")
                    oc = bo.get("outcomes") or []
                    if soort == "Match" and len(oc) == 3:
                        m = {o.get("type"): _odd(o) for o in oc}
                        r = [m.get("OT_ONE"), m.get("OT_CROSS"), m.get("OT_TWO")]
                        if all(r):
                            rij["1x2"] = r
                    elif soort == "Over/Under" and len(oc) == 2 and (bo.get("criterion") or {}).get("englishLabel") == "Total Goals":
                        m = {o.get("type"): (_odd(o), o.get("line")) for o in oc}
                        ov, on = m.get("OT_OVER"), m.get("OT_UNDER")
                        if ov and on and ov[0] and on[0] and ov[1] == on[1] and ov[1]:
                            rij["ou"][f"{ov[1] / 1000:.2f}"] = [ov[0], on[0]]
                if rij["1x2"] or rij["ou"]:
                    uit.append(rij)
    return uit


def koppel(regels, comp, aftrap, thuis, uit, drempel=0.6):
    """Per bookmaker de markten van het duel dat bij deze wedstrijd hoort, in de vorm van odds_ophalen.verzamel():
    {bookmaker: {"1x2": {"-": [..]}, "ou": {"2.50": [..]}}}. Koppeling: zelfde competitie, aftrap binnen 72 uur
    (API-Football heeft soms nog een voorlopige aftraptijd; binnen één competitie speelt een club niet twee keer in 72 uur),
    beide clubnamen herkend. Bij twijfel (geen duidelijke winnaar) wordt niets gekoppeld."""
    try:
        t = dt.datetime.fromisoformat(aftrap.replace("Z", "+00:00"))
    except (AttributeError, ValueError):
        return {}
    res = {}
    for naam in set(r["bm"] for r in regels):
        kand = []
        for r in regels:
            if r["bm"] != naam or r["comp"] != comp or abs((r["start"] - t).total_seconds()) > 72 * 3600:
                continue
            kand.append((min(gelijkenis(thuis, r["thuis"]), gelijkenis(uit, r["uit"])), r))
        kand.sort(key=lambda x: -x[0])
        if not kand or kand[0][0] < drempel or (len(kand) > 1 and kand[1][0] >= drempel and kand[0][0] - kand[1][0] < 0.15):
            continue
        r = kand[0][1]
        res[naam] = {"1x2": {"-": r["1x2"]} if r["1x2"] else {}, "ou": dict(r["ou"])}
    return res


if __name__ == "__main__":
    logboek = []
    alles = haal(log=logboek)
    for r in sorted(alles, key=lambda x: (x["comp"], x["start"], x["thuis"], x["bm"])):
        print(r["comp"], r["start"].strftime("%m-%d %H:%M"), f'{r["thuis"]} – {r["uit"]}'.ljust(44), r["bm"].ljust(9), r["1x2"], r["ou"])
    print("\n".join(logboek)); print(len(alles), "regels")
