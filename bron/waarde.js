// Markeert waardeweddenschappen met het model uit de pagina en bewaart ze voor het CLV-logboek.
// Gebruik: node waarde.js pagina.html picks.json [uit.html]
//   - leest de modelcode en data uit de pagina, berekent de waardelijst (zelfde regels als de pagina Waarde)
//   - voegt nieuwe markeringen toe aan picks.json (één per duel/markt/lijn/kant, met de odds van dat moment)
//   - zet de bijgewerkte lijst ook in de pagina (uit.html), zodat het logboek meteen klopt
const fs = require('fs'); global.performance = require('perf_hooks').performance;
const [src, picksPath, dst] = process.argv.slice(2);
const html = fs.readFileSync(src, 'utf8');
const END = '\nboot();\n</scr' + 'ipt>'; const js = html.slice(html.indexOf('<script>') + 8, html.indexOf(END));
global.localStorage = {getItem: () => null, setItem: () => {}, removeItem: () => {}};
let oud = []; try { oud = JSON.parse(fs.readFileSync(picksPath, 'utf8')); } catch (e) { oud = []; }
const res = new Function('oud', js + `
buildSeed(); const sid = S.active; const nu = new Date().toISOString();
const vb = valueBets(sid, {now: new Date(Date.now() + 30 * 60e3).toISOString()});
const have = new Set(oud.map(k => k.id)); const nieuw = [];
for (const v of vb) {
  const e = v.e; const id = (e.fid || (e.c + '|' + e.h + '|' + e.a + '|' + e.d)) + '|' + v.mk + '|' + (v.line == null ? '-' : v.line) + '|' + v.side;
  if (have.has(id)) continue; have.add(id);
  nieuw.push({id, at: nu, c: e.c, d: e.d, t: e.t, ko: e.ko, h: e.h, a: e.a, src: e.src, fid: e.fid || null, div: e.div || null, mk: v.mk, line: v.line, side: v.side,
    label: v.label, odds: v.odds, bm: v.bm, p: +v.p.toFixed(4), pMarkt: +v.pMarkt.toFixed(4), pModel: +v.pModel.toFixed(4), ev: +v.ev.toFixed(4), minOdds: +v.minOdds.toFixed(3), stake: v.stake, ref: v.src});
}
return {nieuw, lijst: vb.map(v => [v.m.d, v.e.t, v.m.c, tName(v.m.h) + ' – ' + tName(v.m.a), v.label, (v.p * 100).toFixed(1) + '%', v.odds + ' (' + v.bm + ')', 'min ' + v.minOdds.toFixed(2), '+' + (v.ev * 100).toFixed(1) + '%', '€' + v.stake].join(' | '))};
`)(oud);
const alle = oud.concat(res.nieuw);
fs.writeFileSync(picksPath, JSON.stringify(alle, null, 1));
if (dst) {
  const m = html.match(/const EXTRA_PICKS = (\[[\s\S]*?\]);\n/);
  let ingebed = []; try { ingebed = m ? JSON.parse(m[1]) : []; } catch (e) { ingebed = []; }
  const ids = new Set(ingebed.map(k => k.id)); const merged = ingebed.concat(alle.filter(k => !ids.has(k.id)));
  const out = m ? html.replace(m[0], () => 'const EXTRA_PICKS = ' + JSON.stringify(merged) + ';\n') : html;
  fs.writeFileSync(dst, out);
}
console.log(`waardelijst: ${res.lijst.length} weddenschappen, ${res.nieuw.length} nieuwe markeringen (totaal ${alle.length})`);
res.lijst.forEach(x => console.log('  ' + x));
