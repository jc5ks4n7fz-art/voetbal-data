import json, math, sys
R = json.load(open(sys.argv[1] if len(sys.argv) > 1 else 'fitrows.json'))

def power(odds):
    if not odds or any(o is None or o <= 1 for o in odds): return None
    inv = [1 / o for o in odds]
    lo, hi = 0.5, 3.0
    for _ in range(60):
        k = (lo + hi) / 2
        s = sum(x ** k for x in inv)
        if s > 1: lo = k
        else: hi = k
    p = [x ** k for x in inv]; t = sum(p); return [x / t for x in p]

def norm(odds):
    if not odds or any(o is None or o <= 1 for o in odds): return None
    inv = [1 / o for o in odds]; t = sum(inv)
    if not (0.97 < t < 1.12): return None   # illiquide exchange-notering: niet bruikbaar
    return power(odds)

def mkt_early(r):  # exchange als die er is, anders gemiddelde (power)
    return norm(r['bfe']) or power(r['avg'])
def mkt_close(r):
    return norm(r['bfec']) or power(r['avgc'])

def blend(pm, pk, w):
    l = [w * math.log(max(a, 1e-9)) + (1 - w) * math.log(max(b, 1e-9)) for a, b in zip(pm, pk)]
    e = [math.exp(x) for x in l]; t = sum(e); return [x / t for x in e]

KEY1, KEYOU, KEYAH = ('nb','nbou','nbah') if 'named' in sys.argv else ('max','ou','ahMax')
rows = [r for r in R if mkt_early(r) and mkt_close(r) and all(r['max'])]
print('duels met vroege+slot odds:', len(rows))
ll = lambda p, y: -math.log(max(p[y], 1e-12))
def mean(x): return sum(x) / len(x) if x else float('nan')
print('prijzen:', KEY1)
print('logloss model      %.4f' % mean([ll(r['pm'], r['y']) for r in rows]))
print('logloss markt vroeg %.4f' % mean([ll(mkt_early(r), r['y']) for r in rows]))
print('logloss markt slot  %.4f' % mean([ll(mkt_close(r), r['y']) for r in rows]))
best = None
for w in [i / 20 for i in range(0, 21)]:
    v = mean([ll(blend(r['pm'], mkt_early(r), w), r['y']) for r in rows])
    if best is None or v < best[1]: best = (w, v)
    if w in (0, .1, .2, .3, .4, .5, 1): print(f'  w={w:.2f} logloss {v:.4f}')
print('beste w (vs vroege markt): %.2f  %.4f' % best)
# per competitie
from collections import defaultdict
by = defaultdict(list)
for r in rows: by[r['cid']].append(r)
for c, rr in sorted(by.items()):
    bw = min(((w / 20, mean([ll(blend(r['pm'], mkt_early(r), w / 20), r['y']) for r in rr])) for w in range(21)), key=lambda x: x[1])
    print(f'  {c}: n={len(rr)} model {mean([ll(r["pm"], r["y"]) for r in rr]):.4f} markt {mean([ll(mkt_early(r), r["y"]) for r in rr]):.4f} beste w {bw[0]:.2f} ({bw[1]:.4f})')

# weddenschappen: beslissen op vroege markt + model, inzetten tegen hoogste vroege odds, CLV tegen slotmarkt
def sim(w, thr, markets=('1x2', 'ah', 'ou'), maxodds=6.0):
    res = []
    for r in rows:
        pk = mkt_early(r); pc = mkt_close(r); pb = blend(r['pm'], pk, w)
        if '1x2' in markets:
            for i in range(3):
                o = r[KEY1][i]
                if o > maxodds: continue
                ev = pb[i] * o - 1
                if ev >= thr:
                    res.append(('1x2', ev, o * pc[i] - 1, (o - 1) if r['y'] == i else -1))
        if 'ou' in markets and all(r[KEYOU]) and (norm(r['ouBfe']) or power(r['ouAvg'])) and (norm(r['ouc']) or power(r['oucAvg'])):
            mk = norm(r['ouBfe']) or power(r['ouAvg']); mc = norm(r['ouc']) or power(r['oucAvg'])
            po = [r['over'], 1 - r['over']]; pbo = blend(po, mk, w)
            over = r['hg'] + r['ag'] > 2.5
            for i in range(2):
                o = r[KEYOU][i]; ev = pbo[i] * o - 1
                if ev >= thr: res.append(('ou', ev, o * mc[i] - 1, (o - 1) if (over == (i == 0)) else -1))
        if 'ah' in markets and r['ahw'] and all(r[KEYAH]) and all(r['ahAvg']) and r['ahLc'] == r['ahL'] and all(r['ahc']):
            w_, p_, l_ = r['ahw']
            mk = power(r['ahAvg']); mc = power(r['ahc'])
            # modelkans thuis 'wint' (excl. push) als binaire kans
            pm2 = [w_ / (w_ + l_), l_ / (w_ + l_)] if w_ + l_ > 0 else None
            if pm2 and mk and mc:
                pb2 = blend(pm2, mk, w)
                for i in range(2):
                    o = r[KEYAH][i]; ev = pb2[i] * o - 1
                    if ev >= thr:
                        L = r['ahL']; parts = [L - .25, L + .25] if round(abs(L) * 4) % 2 == 1 else [L]; pnl = 0
                        for x in parts:
                            d = (r['hg'] - r['ag'] + x) * (1 if i == 0 else -1)
                            pnl += ((o - 1) if d > 0 else -1 if d < 0 else 0) / len(parts)
                        res.append(('ah', ev, o * mc[i] - 1, pnl))
    return res

print()
for w in (0.0, 0.15, 0.25, 0.35, 0.5, 1.0):
    for thr in (0.02, 0.03, 0.05):
        s = sim(w, thr)
        if not s: continue
        n = len(s); roi = mean([x[3] for x in s]); clv = mean([x[2] for x in s]); pos = mean([1 if x[2] > 0 else 0 for x in s])
        sd = (sum((x[2] - clv) ** 2 for x in s) / max(n - 1, 1)) ** .5; t = clv / (sd / n ** .5) if sd else 0
        by_m = {m: (len([x for x in s if x[0] == m]), mean([x[2] for x in s if x[0] == m])) for m in ('1x2', 'ah', 'ou')}
        print(f'w={w:.2f} drempel {thr:.2f}: n={n:4d} ROI {roi*100:+6.1f}%  CLV {clv*100:+5.2f}% (t={t:+.1f}, {pos*100:.0f}% positief)  ' + ' '.join(f'{m}:{a}/{b*100:+.1f}%' for m, (a, b) in by_m.items() if a))
