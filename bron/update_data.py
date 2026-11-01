#!/usr/bin/env python3
"""Ververst het datablok van de Voetbalvoorspeller (tussen /*DATA-START*/ en /*DATA-END*/).

Bronnen (allemaal openbaar via GitHub):
  - openfootball/football.json  : speelschema's en uitslagen PL, BL, LaLiga, Serie A, Ligue 1, Eredivisie, Liga Portugal
  - martj42/international_results: alle interlands (Elo-historie + uitslagen huidig seizoen)
  - optioneel --fd-url           : football-data.org-bundel {"fd":[...]} (bv. raw-URL uit een eigen GitHub-repo met Action)
  - optioneel --web              : JSON-lijst met elders gecontroleerde uitslagen [{competitie,datum,ronde,thuis,uit,thuisgoals,uitgoals}]

Gebruik: python3 update_data.py pagina.html uit.html [--fd-url URL] [--web web_rows.json]
"""
import csv, datetime as dt, io, json, os, re, sys, urllib.request

OF = {"en.1": "ENG1", "de.1": "GER1", "es.1": "ESP1", "it.1": "ITA1", "fr.1": "FRA1", "nl.1": "NED1", "pt.1": "POR1"}
LEAGUES = {"ENG1", "GER1", "ESP1", "ITA1", "FRA1", "POR1", "BEL1", "NED1", "TUR1", "POL1", "NED2"}
K = {"friendly": 20, "nl": 35, "qual": 40, "final": 55}


def get(url, timeout=30):
    with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "voetbalvoorspeller"}), timeout=timeout) as r:
        return r.read().decode("utf-8")


def season_bounds(today):
    y = today.year if today.month >= 7 else today.year - 1
    return f"{y}-{str(y + 1)[2:]}", f"{y}-07-01"


def imp(t):
    if t == "Friendly": return "friendly"
    if re.search("qualification", t, re.I): return "qual"
    if "Nations League" in t: return "nl"
    if t in ("FIFA World Cup", "UEFA Euro", "Copa América", "African Cup of Nations", "AFC Asian Cup", "Gold Cup"): return "final"
    return "nl"


HIST_OF = {"en.1": "ENG1", "de.1": "GER1", "es.1": "ESP1", "it.1": "ITA1", "fr.1": "FRA1", "nl.1": "NED1", "pt.1": "POR1",
           "be.1": "BEL1", "tr.1": "TUR1", "en.2": "ENG2", "de.2": "GER2", "es.2": "ESP2", "it.2": "ITA2", "fr.2": "FRA2"}
MON3 = {m: i + 1 for i, m in enumerate(["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"])}


def parse_cl_txt(txt, start_year):
    """openfootball Football.TXT (champions-league repo): geeft [datum, thuis, uit, hg, ag, neutraal] met de stand na 90 minuten."""
    out, date, final = [], None, False
    for line in txt.splitlines():
        if line.startswith("▪"): final = "Final" in line and "Finals, Final" in line; continue
        md = re.match(r"\s+(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun) (\w{3}) (\d{1,2})(?: (\d{4}))?\s*$", line)
        if md:
            mo, dd = MON3[md.group(1)], int(md.group(2)); yr = int(md.group(3)) if md.group(3) else (start_year if mo >= 7 else start_year + 1)
            date = f"{yr}-{mo:02d}-{dd:02d}"; continue
        mm = re.match(r"\s+(?:\d{2}:\d{2}\s+)?(.+?)\s+v\s+(.+?)\s+(\d+)-(\d+)(.*)$", line)
        if mm and date:
            h, a = [re.sub(r"\s*\([A-Z]{3}\)\s*$", "", x.strip()) for x in (mm.group(1), mm.group(2))]
            hg, ag, rest = int(mm.group(3)), int(mm.group(4)), mm.group(5)
            if "a.e.t." in rest:
                p = re.search(r"\((\d+)-(\d+)", rest)
                if not p: continue
                hg, ag = int(p.group(1)), int(p.group(2))
            out.append([date, h, a, hg, ag, 1 if final else 0])
    return out


def build_hist(prev_folder, start_year, log):
    rows = []
    for f, code in HIST_OF.items():
        try:
            d = json.loads(get(f"https://raw.githubusercontent.com/openfootball/football.json/master/{prev_folder}/{f}.json"))
        except Exception as e:
            log.append(f"historie {code}: niet beschikbaar ({e})"); continue
        n = 0
        for x in d.get("matches", []):
            sc = x.get("score"); ft = sc if isinstance(sc, list) else (sc or {}).get("ft") if isinstance(sc, dict) else None
            if ft: rows.append([code, x["date"], x["team1"], x["team2"], ft[0], ft[1], 0]); n += 1
        log.append(f"historie {code} {prev_folder}: {n} uitslagen")
    try:
        cl = parse_cl_txt(get(f"https://raw.githubusercontent.com/openfootball/champions-league/master/{prev_folder}/cl.txt"), start_year)
        rows += [["UCL"] + r for r in cl]; log.append(f"historie UCL {prev_folder}: {len(cl)} uitslagen")
    except Exception as e:
        log.append(f"historie UCL: niet beschikbaar ({e})")
    return rows


AF_URL = "https://raw.githubusercontent.com/jc5ks4n7fz-art/voetbal-data/main/data/apifootball.json"
AF_KO = {"Knockout Round Play-offs": "po", "Round of 16": "r16", "8th Finals": "r16", "Quarter-finals": "qf", "Semi-finals": "sf", "Final": "f"}


def af_rows(af, cur_year):
    """API-Football-bundel (uit de repository voetbal-data) -> compacte rijen voor de tool.
    rij: [comp, seizoen, datum, tijd, ronde, fase, thuis, uit, hg90, ag90, xg_thuis, xg_uit]"""
    from zoneinfo import ZoneInfo
    ams = ZoneInfo("Europe/Amsterdam"); cur, hist = [], []
    for w in af.get("wedstrijden", {}).values():
        st = w.get("status"); klaar = st in ("FT", "AET", "PEN")
        if not klaar and st not in ("NS", "TBD"): continue
        rnd = w.get("ronde") or ""; fase, nr = "league", None
        if w["comp"] in ("UCL", "UEL", "UECL"):
            if rnd.startswith("League Stage"): fase = "lp"
            elif rnd in AF_KO: fase = AF_KO[rnd]
            else: continue  # voorrondes: niet in de tool
        m = re.search(r"(\d+)\s*$", rnd)
        if m and fase in ("league", "lp"): nr = int(m.group(1))
        t = dt.datetime.fromisoformat(w["datum"]).astimezone(ams)
        na90 = w.get("na90") or [None, None]
        xg = ((w.get("stats") or {}).get("xg") or [None, None]) if klaar else [None, None]
        row = [w["comp"], w["seizoen"], t.strftime("%Y-%m-%d"), t.strftime("%H:%M"), nr, fase, w["thuis"], w["uit"],
               na90[0] if klaar else None, na90[1] if klaar else None, xg[0], xg[1]]
        if w["seizoen"] == cur_year: cur.append(row)
        elif klaar: hist.append(row)
    return cur, hist


# ---------- odds (voor de pagina Waarde) en markeringen (CLV-logboek) ----------
REPO_RAW = "https://raw.githubusercontent.com/jc5ks4n7fz-art/voetbal-data/main/data/"
FD_DIV = {"E0": "ENG1", "D1": "GER1", "SP1": "ESP1", "I1": "ITA1", "F1": "FRA1", "N1": "NED1", "B1": "BEL1", "P1": "POR1", "T1": "TUR1"}
FD_BMS = {"B365": "Bet365"}  # beste prijs alleen bij bookmakers met een Nederlandse vergunning (van de bookmakers in football-data alleen Bet365)


def _raw(name, timeout=60):
    return get(REPO_RAW + name, timeout)


def _fnum(x):
    try:
        v = float(x); return v if v > 1 else None
    except (TypeError, ValueError):
        return None


def _uk_to_ams(d, t):
    from zoneinfo import ZoneInfo
    dd, mm, yy = d.split("/"); hh, mi = (t or "15:00").split(":")
    x = dt.datetime(int(yy), int(mm), int(dd), int(hh), int(mi), tzinfo=ZoneInfo("Europe/London"))
    return x.astimezone(ZoneInfo("Europe/Amsterdam")), x.astimezone(dt.timezone.utc)


def _fd_entry(r, suf, ref_pre, ref_name, avg_pre="Avg"):
    """Eén markt uit een football-data-rij: ref (exchange/Pinnacle), beste benoemde prijs, gemiddelde."""
    ref = [_fnum(r.get(ref_pre + x)) for x in suf] if ref_pre else None
    gem = [_fnum(r.get(avg_pre + x)) for x in suf]
    mx, bm = [], []
    for x in suf:
        best = max(((_fnum(r.get(k + x)), n) for k, n in FD_BMS.items()), key=lambda z: z[0] or 0)
        mx.append(best[0]); bm.append(best[1])
    if not all(mx): return None
    return {"ref": ref if ref and all(ref) else None, "refN": ref_name, "max": mx, "bm": bm, "gem": gem if all(gem) else None}


def odds_build(af, log):
    out, upd = [], []
    W = (af or {}).get("wedstrijden", {})
    now = dt.datetime.now(dt.timezone.utc)
    try:
        od = json.loads(_raw("odds.json", 120)); n = 0
        for fid, w in od.get("wedstrijden", {}).items():
            f = W.get(fid); ko = w.get("aftrap")
            if not f or not ko or not w.get("laatste"): continue
            k = dt.datetime.fromisoformat(ko.replace("Z", "+00:00"))
            if k < now - dt.timedelta(days=60): continue
            from zoneinfo import ZoneInfo
            ka = k.astimezone(ZoneInfo("Europe/Amsterdam"))
            def conv(sn):
                x = {}
                for mk in ("1x2", "ah", "ou", "dc", "dnb"):
                    x[mk] = {}
                    for ln, e in (sn.get(mk) or {}).items():
                        if mk == "ou" and not (1.5 <= float(ln) <= 4.5 and abs(float(ln) * 2 - round(float(ln) * 2)) < 1e-9): continue
                        if mk == "ah" and not all(o is not None and 1.3 <= o <= 3.5 for o in e["max"]): continue
                        x[mk][ln] = {"ref": e.get("pin"), "refN": "Pinnacle", "max": e["max"], "bm": e["bm"], "gem": e["gem"], "n": e.get("n")}
                return {"t": sn.get("t"), "x": x}
            out.append({"c": w.get("comp") or f["comp"], "d": ka.strftime("%Y-%m-%d"), "t": ka.strftime("%H:%M"), "ko": k.strftime("%Y-%m-%dT%H:%M:%SZ"),
                        "h": f["thuis"], "a": f["uit"], "src": "api", "fid": fid, "first": conv(w["eerste"]), "last": conv(w["laatste"])})
            n += 1
        if n: upd.append(f"API-Football {od.get('bijgewerkt', '')[:16].replace('T', ' ')} UTC")
        log.append(f"Odds API-Football: {n} duels")
    except Exception as e:
        log.append(f"Odds API-Football: niet opgehaald ({e})")
    try:
        rows = list(csv.DictReader(io.StringIO(_raw("fd/fixtures.csv").lstrip("﻿")))); n = 0
        for r in rows:
            c = FD_DIV.get(r.get("Div"))
            if not c: continue
            ams, utc = _uk_to_ams(r["Date"], r.get("Time"))
            if utc < now: continue
            x = {"1x2": {}, "ah": {}, "ou": {}}
            e = _fd_entry(r, ["H", "D", "A"], "BFE", "Betfair Exchange")
            if e: x["1x2"]["-"] = e
            e = _fd_entry(r, [">2.5", "<2.5"], "BFE", "Betfair Exchange")
            if e: x["ou"]["2.50"] = e
            if r.get("AHh") not in (None, ""):
                e = _fd_entry(r, ["AHH", "AHA"], "BFE", "Betfair Exchange")
                if e: x["ah"][f"{float(r['AHh']):+.2f}"] = e
            sn = {"t": None, "x": x}
            out.append({"c": c, "d": ams.strftime("%Y-%m-%d"), "t": ams.strftime("%H:%M"), "ko": utc.strftime("%Y-%m-%dT%H:%M:%SZ"), "h": r["HomeTeam"], "a": r["AwayTeam"],
                        "src": "fd", "div": r["Div"], "first": sn, "last": sn}); n += 1
        for r in csv.DictReader(io.StringIO(_raw("fd/new_league_fixtures.csv").lstrip("﻿"))):
            if r.get("Country") != "Poland": continue
            ams, utc = _uk_to_ams(r["Date"], r.get("Time"))
            if utc < now: continue
            e = _fd_entry(r, ["H", "D", "A"], "PS", "Pinnacle")
            if not e: continue
            sn = {"t": None, "x": {"1x2": {"-": e}, "ah": {}, "ou": {}}}
            out.append({"c": "POL1", "d": ams.strftime("%Y-%m-%d"), "t": ams.strftime("%H:%M"), "ko": utc.strftime("%Y-%m-%dT%H:%M:%SZ"), "h": r["Home"], "a": r["Away"],
                        "src": "fd", "div": "POL", "first": sn, "last": sn}); n += 1
        upd.append("football-data.co.uk (programma met odds, wekelijks)"); log.append(f"Odds football-data.co.uk: {n} duels")
    except Exception as e:
        log.append(f"Odds football-data.co.uk: niet opgehaald ({e})")
    return out, " · ".join(upd)


def odds_hist(log):
    """Odds van vóór de aftrap voor gespeelde duels dit seizoen (football-data.co.uk), voor de terugblik:
    [comp, datum, thuis, uit, ref1x2, gem1x2, beste1x2, bookmakers, ou_ref, ou_gem, ou_beste, ah_lijn, ah_ref, ah_gem, ah_beste]."""
    out = []
    for div, c in FD_DIV.items():
        try:
            rows = list(csv.DictReader(io.StringIO(_raw(f"fd/{div}_2627.csv").lstrip("\ufeff"))))
        except Exception as e:
            log.append(f"Terugblik-odds {div}: niet opgehaald ({e})"); continue
        for r in rows:
            if r.get("FTHG") in (None, ""): continue
            d = r["Date"].split("/"); iso = f"{d[2] if len(d[2]) == 4 else '20' + d[2]}-{d[1]}-{d[0]}"
            e1 = _fd_entry(r, ["H", "D", "A"], "BFE", "Betfair Exchange")
            if not e1: continue
            eo = _fd_entry(r, [">2.5", "<2.5"], "BFE", "Betfair Exchange")
            ea = _fd_entry(r, ["AHH", "AHA"], "BFE", "Betfair Exchange") if r.get("AHh") not in (None, "") else None
            out.append([c, iso, r["HomeTeam"], r["AwayTeam"], e1["ref"], e1["gem"], e1["max"], e1["bm"],
                        eo and eo["ref"], eo and eo["gem"], eo and eo["max"],
                        float(r["AHh"]) if ea else None, ea and ea["ref"], ea and ea["gem"], ea and ea["max"]])
    log.append(f"Terugblik-odds: {len(out)} gespeelde duels met odds van vóór de aftrap")
    return out


def inj_build(af, log):
    """Afwezigen (blessures/schorsingen, API-Football) voor komende duels, met hun gewicht voor het model:
    {"comp|datum|thuis|uit": [attThuis, verdThuis, attUit, verdUit, [namen thuis], [namen uit]]}.
    att = aandeel in goals + ½·assists van de club; verd = belang afwezige verdedigers/keeper (minuten/meeste minuten)/5."""
    from zoneinfo import ZoneInfo
    try:
        B = json.loads(_raw("blessures.json", 120)); P = json.loads(_raw("spelers.json", 120))
    except Exception as e:
        log.append(f"Blessures: niet opgehaald ({e})"); return {}
    W = (af or {}).get("wedstrijden", {}); out = {}; nu = dt.datetime.now(dt.timezone.utc)
    for fid, lst in B.get("per_wedstrijd", {}).items():
        w = W.get(fid)
        if not w or w.get("status") in ("FT", "AET", "PEN"): continue
        k = dt.datetime.fromisoformat(w["datum"])
        if k < nu - dt.timedelta(hours=3) or k > nu + dt.timedelta(days=12): continue
        uniek = {}
        for x in lst:  # API-Football levert soms dezelfde speler twee keer; "Missing Fixture" gaat voor "Questionable"
            kk = (x[0], x[1])
            if kk not in uniek or uniek[kk][3] == "Questionable": uniek[kk] = x
        lst = list(uniek.values())
        res = []
        for tid in (w["thuis_id"], w["uit_id"]):
            ps = (P.get("teams", {}).get(str(tid)) or {}).get("2026") or {}
            gmax = max([v[3] or 0 for v in ps.values()] + [1]); ga = sum((v[4] or 0) + 0.5 * (v[5] or 0) for v in ps.values()) or 1
            att = dfd = 0.0; namen = []
            for t, pid, naam, typ, reden in lst:
                if t != tid: continue
                v = ps.get(str(pid)); f = 0.5 if typ == "Questionable" else 1.0
                if not v: continue
                imp = (v[3] or 0) / gmax
                if imp < 0.15: continue
                att += f * ((v[4] or 0) + 0.5 * (v[5] or 0)) / ga
                if v[1] in ("Defender", "Goalkeeper"): dfd += f * imp / 5
                namen.append((imp, naam + (" (twijfel)" if typ == "Questionable" else "")))
            namen = [n for _, n in sorted(namen, reverse=True)[:4]]
            res.append((round(att, 4), round(min(dfd, 1), 4), namen))
        d = k.astimezone(ZoneInfo("Europe/Amsterdam")).strftime("%Y-%m-%d")
        out[f'{w["comp"]}|{d}|{w["thuis"]}|{w["uit"]}'] = [res[0][0], res[0][1], res[1][0], res[1][1], res[0][2], res[1][2]]
    log.append(f"Blessures: {len(out)} komende duels met afwezigen")
    return out


def picks_build(odds, log):
    """Markeringen uit data/picks.json, aangevuld met de slotkoers zodra de aftrap voorbij is."""
    try:
        picks = json.loads(_raw("picks.json"))
    except Exception as e:
        log.append(f"Markeringen: geen picks.json ({e})"); return []
    now = dt.datetime.now(dt.timezone.utc)
    api = {p["fid"]: p for p in odds if p.get("src") == "api"}
    seasons = {}
    def fd_rows(div):
        if div not in seasons:
            try:
                name = "fd/POL.csv" if div == "POL" else f"fd/{div}_2627.csv"
                seasons[div] = list(csv.DictReader(io.StringIO(_raw(name).lstrip("﻿"))))
            except Exception:
                seasons[div] = []
        return seasons[div]
    for k in picks:
        if k.get("close") or not k.get("ko") or dt.datetime.fromisoformat(k["ko"].replace("Z", "+00:00")) > now: continue
        mk = "1x2" if k["mk"] in ("1x2", "dc", "dnb") else k["mk"]  # dubbele kans/draw no bet: slotkans uit de 1X2-markt
        ln = "-" if mk == "1x2" else (f"{k['line']:+.2f}" if mk == "ah" else f"{k['line']:.2f}")
        if k.get("fid") and k["fid"] in api:
            e = api[k["fid"]]["last"]["x"].get(mk, {}).get(ln)
            if e: k["close"] = {"ref": e.get("ref"), "refN": e.get("refN"), "gem": e.get("gem"), "bron": "laatste API-waarneming"}
            continue
        if not k.get("div"): continue
        for r in fd_rows(k["div"]):
            hn, an = (r.get("HomeTeam") or r.get("Home")), (r.get("AwayTeam") or r.get("Away"))
            if hn != k["h"] or an != k["a"]: continue
            d = r["Date"].split("/"); iso = f"{d[2] if len(d[2]) == 4 else '20' + d[2]}-{d[1]}-{d[0]}"
            if abs((dt.date.fromisoformat(iso) - dt.date.fromisoformat(k["d"])).days) > 3: continue
            g = lambda c: _fnum(r.get(c))
            if k["mk"] in ("1x2", "dc", "dnb"):
                pre = "PSC" if k["div"] == "POL" else "BFEC"
                k["close"] = {"ref": [g(pre + "H"), g(pre + "D"), g(pre + "A")], "refN": "Pinnacle" if k["div"] == "POL" else "Betfair Exchange", "gem": [g("AvgCH"), g("AvgCD"), g("AvgCA")]}
            elif k["mk"] == "ou" and abs(k["line"] - 2.5) < 1e-9:
                k["close"] = {"ref": [g("BFEC>2.5"), g("BFEC<2.5")], "refN": "Betfair Exchange", "gem": [g("AvgC>2.5"), g("AvgC<2.5")]}
            elif k["mk"] == "ah" and r.get("AHCh") not in (None, "") and abs(float(r["AHCh"]) - k["line"]) < 1e-9:
                k["close"] = {"ref": [g("BFECAHH"), g("BFECAHA")], "refN": "Betfair Exchange", "gem": [g("AvgCAHH"), g("AvgCAHA")]}
            if k.get("close"):
                for kk in ("ref", "gem"):
                    if k["close"][kk] and not all(k["close"][kk]): k["close"][kk] = None
            break
    log.append(f"Markeringen: {len(picks)}, waarvan {sum(1 for k in picks if k.get('close'))} met slotkoers")
    return picks


def main():
    a = sys.argv[1:]
    if len(a) < 2: sys.exit(__doc__)
    src, dst = a[0], a[1]
    fd_url = a[a.index("--fd-url") + 1] if "--fd-url" in a else None
    web = a[a.index("--web") + 1] if "--web" in a else None
    html = open(src, encoding="utf-8").read()
    m = re.search(r"/\*DATA-START\*/(.*?)/\*DATA-END\*/", html, re.S)
    if not m: sys.exit("Datablok-markers niet gevonden in " + src)
    old = m.group(1)
    today = dt.date.today()
    folder, start = season_bounds(today)
    log = []

    club = []
    for f, cid in OF.items():
        try:
            d = json.loads(get(f"https://raw.githubusercontent.com/openfootball/football.json/master/{folder}/{f}.json"))
        except Exception as e:
            log.append(f"{cid}: niet beschikbaar ({e})"); continue
        n = p = 0
        for x in d.get("matches", []):
            sc = x.get("score"); ft = sc if isinstance(sc, list) else (sc or {}).get("ft") if isinstance(sc, dict) else None
            rnd = re.sub(r"\D", "", str(x.get("round", ""))) or None
            club.append([cid, x["date"], int(rnd) if rnd else None, x["team1"], x["team2"], ft[0] if ft else None, ft[1] if ft else None])
            n += 1; p += 1 if ft else 0
        log.append(f"{cid}: {n} duels, {p} met uitslag")

    rows = list(csv.DictReader(io.StringIO(get("https://raw.githubusercontent.com/martj42/international_results/master/results.csv", 60))))
    elo, last, recent = {}, {}, []
    for r in rows:
        try: hg, ag = int(r["home_score"]), int(r["away_score"])
        except ValueError: continue
        neutral = r["neutral"].upper() == "TRUE"
        if r["date"] < start:
            eh, ea = elo.get(r["home_team"], 1500), elo.get(r["away_team"], 1500)
            dr = eh - ea + (0 if neutral else 100); E = 1 / (1 + 10 ** (-dr / 400))
            W = 1 if hg > ag else 0.5 if hg == ag else 0; gd = abs(hg - ag); G = 1 if gd <= 1 else 1.5 if gd == 2 else (11 + gd) / 8
            dl = K[imp(r["tournament"])] * G * (W - E); elo[r["home_team"]] = eh + dl; elo[r["away_team"]] = ea - dl
            last[r["home_team"]] = last[r["away_team"]] = r["date"]
        else:
            recent.append(["UNL" if r["tournament"] == "UEFA Nations League" else "FRIENDLY", r["date"], r["home_team"], r["away_team"], hg, ag, 1 if neutral else 0, imp(r["tournament"])])
    cutoff = str(int(start[:4]) - 4) + start[4:]
    e0 = {t: round(v) for t, v in elo.items() if last.get(t, "") >= cutoff}
    log.append(f"Interlands: Elo voor {len(e0)} landen t/m {start}, {len(recent)} duels sinds {start} (laatste {recent[-1][1] if recent else '-'})")

    fd = None
    if fd_url:
        try:
            fd = json.loads(get(fd_url, 60)); log.append(f"football-data.org: {sum(len(x.get('matches', [])) for x in fd.get('fd', []))} duels")
        except Exception as e:
            log.append(f"football-data.org: niet opgehaald ({e})")

    prev_web = []
    mw = re.search(r"const EXTRA_WEB = (\[.*?\]);", old, re.S)
    if mw:
        try: prev_web = json.loads(mw.group(1))
        except Exception: prev_web = []
    if web:
        new = json.load(open(web, encoding="utf-8"))
        # competities: elk duel (thuis-uit) komt één keer voor, dus sleutel zonder datum (verplaatste duels overschrijven het oude programma)
        key = lambda r: (r["competitie"], r["thuis"], r["uit"]) + (() if r["competitie"] in LEAGUES else (r["datum"],))
        merged = {key(r): r for r in prev_web}
        for r in new:
            o = merged.get(key(r))
            if o and o.get("thuisgoals") is not None and r.get("thuisgoals") is None: r = dict(r, thuisgoals=o["thuisgoals"], uitgoals=o["uitgoals"])
            merged[key(r)] = r
        prev_web = list(merged.values())
        log.append(f"Webbronnen: {len(new)} nieuwe/bijgewerkte duels, totaal {len(prev_web)}")

    # historie: de twee voorgaande seizoenen (getest: beter dan één seizoen)
    y0 = int(start[:4]); folders = [f"{y0 - k}-{str(y0 - k + 1)[2:]}" for k in (1, 2)]; prev_folder = "+".join(folders)
    mh = re.search(r"const EXTRA_HIST_SEASON = '([^']*)';\s*const EXTRA_HIST = (\[.*?\]);", old, re.S)
    if mh and mh.group(1) == prev_folder and "--refresh-hist" not in a:
        hist = json.loads(mh.group(2)); log.append(f"historie {prev_folder}: {len(hist)} duels (hergebruikt)")
    else:
        hist = []
        for k, fo in zip((1, 2), folders): hist += build_hist(fo, y0 - k, log)
    af_cur, af_hist, af_tijd = [], [], ""
    af_src = a[a.index("--af") + 1] if "--af" in a else AF_URL
    if af_src and af_src != "geen":
        try:
            af = json.load(open(af_src, encoding="utf-8")) if os.path.exists(af_src) else json.loads(get(af_src, 120))
            af_cur, af_hist = af_rows(af, y0); af_tijd = af.get("bijgewerkt", "")
            log.append(f"API-Football: {len(af_cur)} duels dit seizoen ({sum(1 for r in af_cur if r[10] is not None)} met xG), {len(af_hist)} historisch ({sum(1 for r in af_hist if r[10] is not None)} met xG), bijgewerkt {af_tijd}")
        except Exception as e:
            log.append(f"API-Football: niet opgehaald ({e})")
    try:
        af_obj = af if af_src and af_src != "geen" else None
    except NameError:
        af_obj = None
    odds, odds_upd = odds_build(af_obj, log)
    picks = picks_build(odds, log)
    ohist = odds_hist(log)
    inj = inj_build(af_obj, log)
    now = dt.datetime.now()
    j = lambda o: json.dumps(o, ensure_ascii=False, separators=(",", ":"))
    block = (f"\nconst DATA_VERSION = '{now:%Y%m%d%H%M}';\nconst DATA_UPDATED = '{now:%Y-%m-%d %H:%M}';\nconst EXTRA_ELO_DATE = '{start}';\n"
             f"const EXTRA_HIST_SEASON = '{prev_folder}';\nconst EXTRA_HIST = {j(hist)};\n"
             f"const EXTRA_AF_TIME = '{af_tijd}';\nconst EXTRA_AF = {j(af_cur)};\nconst EXTRA_AF_HIST = {j(af_hist)};\n"
             f"const EXTRA_CLUB = {j(club)};\nconst EXTRA_ELO = {j(e0)};\nconst EXTRA_INTL = {j(recent)};\nconst EXTRA_FD = {j(fd)};\nconst EXTRA_WEB = {j(prev_web)};\n"
             f"const ODDS_UPDATED = {j(odds_upd)};\nconst EXTRA_ODDS = {j(odds)};\nconst EXTRA_PICKS = {j(picks)};\nconst EXTRA_ODDS_HIST = {j(ohist)};\nconst EXTRA_INJ = {j(inj)};\n")
    open(dst, "w", encoding="utf-8").write(html[:m.start(1)] + block + html[m.end(1):])
    print("\n".join(log)); print("Geschreven:", dst)


if __name__ == "__main__":
    main()
