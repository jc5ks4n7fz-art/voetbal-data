const fs=require('fs');global.performance=require('perf_hooks').performance;global.localStorage={getItem:()=>null,setItem:()=>{}};
const h=fs.readFileSync(process.argv[2]||'pagina2.html','utf8');const js=h.slice(h.indexOf('<script>')+8,h.indexOf('\nboot();\n</scr'+'ipt>'));
const FD=require('path').join(__dirname,'..','data','fd')+'/';const INJ=JSON.parse(fs.readFileSync(process.argv[3]||'blessure_features.json','utf8'));
function csv(p){const t=fs.readFileSync(p,'utf8').replace(/^﻿/,'').trim().split(/\r?\n/);const k=t[0].split(',');return t.slice(1).map(l=>{const v=l.split(',');const o={};k.forEach((x,i)=>o[x]=v[i]);return o;});}
const MAP={E0:'ENG1',D1:'GER1',SP1:'ESP1',I1:'ITA1',F1:'FRA1',N1:'NED1',T1:'TUR1'};
new Function('INJ','MAP','csv','FD','fs',js+`buildSeed();const sid=S.active;
const idx=new Map();for(const k in INJ){const [c,d,hn,an]=k.split('|');const sc=(S.seasons[sid].comps[c]||{teams:[]}).teams;const h=findTeam(hn,'club',sc),a=findTeam(an,'club',sc);if(h&&a)idx.set(c+'|'+h+'|'+a,{d,v:INJ[k]});}
const rows=[];
for(const [div,c] of Object.entries(MAP)) for(const r of csv(FD+div+'_2627.csv')){ if(r.FTHG===''||r.FTHG==null)continue; const d=r.Date.split('/').reverse().join('-');
 const sc=S.seasons[sid].comps[c].teams,h=findTeam(r.HomeTeam,'club',sc),a=findTeam(r.AwayTeam,'club',sc); if(!h||!a)continue;
 const f=idx.get(c+'|'+h+'|'+a); if(!f||Math.abs(daysBetween(f.d,d))>2)continue;
 const g=k=>+r[k]||null; const mk=fairFrom({ref:[g('BFEH'),g('BFED'),g('BFEA')],refN:'x',gem:[g('AvgH'),g('AvgD'),g('AvgA')]}); if(!mk||!mk.p||mk.p.some(x=>!isFinite(x)))continue;
 const l=lambdas(sid,c,h,a,false,{before:weekStart(d),noAdj:true}); const hg=+r.FTHG,ag=+r.FTAG; rows.push({d,l,mk:mk.p,y:hg>ag?0:hg===ag?1:2,v:f.v,c});}
console.log('duels met blessuredata en odds',rows.length);
const ll=(p,y)=>-Math.log(Math.max(p[y],1e-12));
rows.sort((a,b)=>a.d.localeCompare(b.d)); const cut=rows[Math.floor(rows.length*0.55)].d; console.log('splits op',cut);
const evalSet=(set,ka,kd)=>{let sm=0,sc=0;for(const r of set){const [aH,dH,aA,dA]=r.v; const lh=r.l[0]*Math.exp(-ka*aH+kd*dA), la=r.l[1]*Math.exp(-ka*aA+kd*dH); const p=predict(lh,la,r.l[2]); const pm=[p.pH,p.pD,p.pA]; sm+=ll(pm,r.y); sc+=ll(blendP(pm,r.mk,0.15),r.y);} return [sm/set.length,sc/set.length];};
const A=rows.filter(r=>r.d<cut),B=rows.filter(r=>r.d>=cut);
let best=null; for(const ka of [0,0.5,0.75,1,1.25,1.5,2]) for(const kd of [0,0.5,0.75,1,1.5,2]){const e=evalSet(A,ka,kd); if(!best||e[0]<best[2])best=[ka,kd,e[0]];}
console.log('gekozen op eerste deel',best[0],best[1]); for(const [ka,kd] of [[0.25,0.25],[0.5,0.5],[0.5,0.25],[0.25,0.5]]){const e0=evalSet(B,0,0),e=evalSet(B,ka,kd);let m0=0,m1=0; for(const w of [0.25]){} console.log('tweede deel ka',ka,'kd',kd,'model',e0[0].toFixed(4),'->',e[0].toFixed(4),'comb',e0[1].toFixed(4),'->',e[1].toFixed(4));} let mb=0;for(const r of B)mb+=ll(r.mk,r.y);console.log('markt tweede deel',(mb/B.length).toFixed(4)); const b0=evalSet(B,0,0),b1=evalSet(B,best[0],best[1]);
console.log('controle (tweede deel, n='+B.length+'): model',b0[0].toFixed(4),'->',b1[0].toFixed(4),' combinatie',b0[1].toFixed(4),'->',b1[1].toFixed(4));
for (const w of [0.15,0.25,0.35]) { let s0=0,s1=0; for(const r of rows){const [aH,dH,aA,dA]=r.v; const p0=predict(r.l[0],r.l[1],r.l[2]),lh=r.l[0]*Math.exp(-0.5*aH+0.5*dA),la=r.l[1]*Math.exp(-0.5*aA+0.5*dH),p1=predict(lh,la,r.l[2]); s0+=ll(blendP([p0.pH,p0.pD,p0.pA],r.mk,w),r.y); s1+=ll(blendP([p1.pH,p1.pD,p1.pA],r.mk,w),r.y);} console.log('w',w,'combinatie zonder',(s0/rows.length).toFixed(4),'met',(s1/rows.length).toFixed(4)); }
const res=[];
for(const ka of [0,0.5,0.75,1,1.25,1.5,2]) for(const kd of [0,0.5,0.75,1,1.5,2]){ let sm=0,sc=0;
 for(const r of rows){const [aH,dH,aA,dA]=r.v; const lh=r.l[0]*Math.exp(-ka*aH+kd*dA), la=r.l[1]*Math.exp(-ka*aA+kd*dH); const p=predict(lh,la,r.l[2]); const pm=[p.pH,p.pD,p.pA];
  sm+=ll(pm,r.y); sc+=ll(blendP(pm,r.mk,0.15),r.y);}
 res.push([ka,kd,sm/rows.length,sc/rows.length]);}
res.sort((x,y)=>x[2]-y[2]); console.log('ka kd | model | combinatie'); res.slice(0,6).forEach(r=>console.log(r[0],r[1],r[2].toFixed(4),r[3].toFixed(4)));
const base=res.find(r=>r[0]===0&&r[1]===0); console.log('zonder correctie',base[2].toFixed(4),base[3].toFixed(4));
let mm=0; for(const r of rows) mm+=ll(r.mk,r.y); console.log('markt alleen',(mm/rows.length).toFixed(4));`)(INJ,MAP,csv,FD,fs);
