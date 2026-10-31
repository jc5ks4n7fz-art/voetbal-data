import json,sys,math
exec(open('fit_an2.py').read().split("rows = [r for r in R if")[0].replace("R = json.load(open(sys.argv[1] if len(sys.argv) > 1 else 'fitrows.json'))","R=json.load(open(sys.argv[1]))"))
rows=[r for r in R if (norm(r['bfe']) or power(r['avg']))]
ll=lambda p,y:-math.log(max(p[y],1e-12))
m=lambda a:sum(a)/len(a)
L=m([ll(r['pm'],r['y']) for r in rows]); B=m([ll(blend(r['pm'],norm(r['bfe']) or power(r['avg']),.15),r['y']) for r in rows])
print(sys.argv[1], 'model %.4f  comb15 %.4f  pH %.3f pA %.3f' % (L,B,m([r['pm'][0] for r in rows]),m([r['pm'][2] for r in rows])))
