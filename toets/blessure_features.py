#!/usr/bin/env python3
"""Per duel de 'waarde' van afwezige spelers per ploeg, uit data/blessures.json + data/spelers.json:
  att = aandeel van de afwezigen in goals + ½·assists van hun club (Questionable telt half)
  dfd = belang van afwezige verdedigers/keeper: som(minuten / meeste minuten in de club) / 5
Uitvoer: {"comp|datum|thuis|uit": [attThuis, dfdThuis, attUit, dfdUit, nThuis, nUit]} (namen zoals API-Football)."""
import json, sys, datetime as dt
from zoneinfo import ZoneInfo
B = json.load(open("data/blessures.json")); P = json.load(open("data/spelers.json")); A = json.load(open("data/apifootball.json"))["wedstrijden"]
def team_info(tid):
    ps = (P["teams"].get(str(tid)) or {}).get("2026") or {}
    gmax = max([v[3] or 0 for v in ps.values()] + [1])
    ga = sum((v[4] or 0) + 0.5 * (v[5] or 0) for v in ps.values()) or 1
    return ps, gmax, ga
out = {}
for fid, lst in B["per_wedstrijd"].items():
    w = A.get(fid)
    if not w: continue
    d = dt.datetime.fromisoformat(w["datum"]).astimezone(ZoneInfo("Europe/Amsterdam")).strftime("%Y-%m-%d")
    uniek = {}
    for x in lst:  # API-Football levert soms dezelfde speler twee keer; "Missing Fixture" gaat voor "Questionable"
        k = (x[0], x[1])
        if k not in uniek or uniek[k][3] == "Questionable": uniek[k] = x
    lst = list(uniek.values())
    res = []
    for tid in (w["thuis_id"], w["uit_id"]):
        ps, gmax, ga = team_info(tid); att = dfd = 0.0; n = 0
        for t, pid, naam, typ, reden in lst:
            if t != tid: continue
            f = 0.5 if typ == "Questionable" else 1.0
            v = ps.get(str(pid))
            if not v: continue
            imp = (v[3] or 0) / gmax
            if imp < 0.15: continue  # nauwelijks gespeeld: geen effect
            n += 1
            att += f * ((v[4] or 0) + 0.5 * (v[5] or 0)) / ga
            if v[1] in ("Defender", "Goalkeeper"): dfd += f * imp / 5
        res += [round(att, 4), round(min(dfd, 1), 4), n]
    out[f'{w["comp"]}|{d}|{w["thuis"]}|{w["uit"]}'] = [res[0], res[1], res[3], res[4], res[2], res[5]]
json.dump(out, open(sys.argv[1] if len(sys.argv) > 1 else "blessure_features.json", "w"))
import statistics
print("duels", len(out), "gem. att-verlies", round(statistics.mean(v[0] for v in out.values()), 3), "gem. verdediging", round(statistics.mean(v[1] for v in out.values()), 3))
