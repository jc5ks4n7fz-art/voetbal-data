// Walk-forward toets 2026-27: model vs markt, combinatiegewicht w, en weddenschappen op 'waarde' met CLV.
// Gebruik: node fit.js final6.html
const fs = require('fs'); global.performance = require('perf_hooks').performance;
const file = process.argv[2] || 'final6.html'; const SET = process.argv[3] ? JSON.parse(process.argv[3]) : {}; const OUT = process.argv[4] || 'fitrows.json'; const h = fs.readFileSync(file, 'utf8');
const js = h.slice(h.indexOf('<script>') + 8, h.indexOf('\nboot();\n</scr' + 'ipt>'));
const FD = process.env.FD_DIR || require('path').join(__dirname, '..', 'data', 'fd') + '/';
function csv(p) { const t = fs.readFileSync(p, 'utf8').replace(/^﻿/, '').trim().split(/\r?\n/); const k = t[0].split(','); return t.slice(1).map(l => { const v = l.split(','); const o = {}; k.forEach((x, i) => o[x] = v[i]); return o; }); }
const MAP = { E0: 'ENG1', D1: 'GER1', SP1: 'ESP1', I1: 'ITA1', F1: 'FRA1', N1: 'NED1', B1: 'BEL1', P1: 'POR1', T1: 'TUR1' };
eval(js + `
buildSeed(); Object.assign(S.settings, SET); bump(); const sid = S.active; const out = []; const miss = new Set();
for (const [div, cid] of Object.entries(MAP)) {
  for (const r of csv(FD + div + '_2627.csv')) {
    if (r.FTHG === '' || r.FTHG == null) continue;
    const d = r.Date.split('/').reverse().join('-');
    const sc = S.seasons[sid].comps[cid].teams; const ht = findTeam(r.HomeTeam, 'club', sc), at = findTeam(r.AwayTeam, 'club', sc);
    if (!ht || !sc.includes(ht)) { miss.add(cid + ':' + r.HomeTeam); continue; } if (!at || !sc.includes(at)) { miss.add(cid + ':' + r.AwayTeam); continue; }
    const hg = +r.FTHG, ag = +r.FTAG;
    const l = lambdas(sid, cid, ht, at, false, { before: weekStart(d), noAdj: true }); const p = predict(l[0], l[1], l[2]);
    const g = k => +r[k] || null; const tri = pre => [g(pre + 'H'), g(pre + 'D'), g(pre + 'A')];
    const ahL = r.AHh === '' ? null : +r.AHh, ahLc = r.AHCh === '' ? null : +r.AHCh;
    const ahw = ahL == null ? null : ahLine(p.M, p.N, ahL);
    out.push({ cid, d, hg, ag, y: hg > ag ? 0 : hg === ag ? 1 : 2, pm: [p.pH, p.pD, p.pA], over: p.over,
      bfe: tri('BFE'), avg: tri('Avg'), max: tri('Max'), bfec: tri('BFEC'), avgc: tri('AvgC'),
      ou: [g('Max>2.5'), g('Max<2.5')], ouAvg: [g('Avg>2.5'), g('Avg<2.5')], ouBfe: [g('BFE>2.5'), g('BFE<2.5')], ouc: [g('BFEC>2.5'), g('BFEC<2.5')], oucAvg: [g('AvgC>2.5'), g('AvgC<2.5')],
      ahL, ahw: ahw && [ahw.w, ahw.p, ahw.l], ahMax: [g('MaxAHH'), g('MaxAHA')], ahAvg: [g('AvgAHH'), g('AvgAHA')], ahLc, ahc: [g('AvgCAHH'), g('AvgCAHA')],
      nb: ['H','D','A'].map(x => Math.max(...['B365','BFD','BV','BW','PP','SKB'].map(b => g(b + x) || 0)) || null), nbou: [g('B365>2.5'), g('B365<2.5')], nbah: [g('B365AHH'), g('B365AHA')] });
  }
}
fs.writeFileSync(OUT, JSON.stringify(out));
console.log('rijen', out.length, 'niet gekoppeld', [...miss].join(' | '));
`);
