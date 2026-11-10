
// ===================== WAARDE: model + markt, beste prijs, Kelly, closing line value =====================
// Getoetst op 736 duels 2026/27 (walk-forward, prijzen van gangbare bookmakers): alleen op het model wedden gaf CLV −5,4%;
// marktkans met modelgewicht 0,15 en drempel 3% gaf 39 markeringen met gemiddeld CLV +8% (nog niet significant). Hoger gewicht = slechter.
const VALUE_DEF = {valueW: 0.15, valueThr: 0.03, bank: 500, kellyFrac: 0.25, maxStake: 0.02, maxOdds: 6};
function vset(k) { const v = S.settings[k]; return v == null || v === '' ? VALUE_DEF[k] : +v; }
function devigPower(o) {
  if (!o || o.some(x => !(x > 1))) return null; const inv = o.map(x => 1 / x); let lo = 0.3, hi = 3;
  for (let i = 0; i < 60; i++) { const k = (lo + hi) / 2, s = inv.reduce((a, x) => a + Math.pow(x, k), 0); if (s > 1) lo = k; else hi = k; }
  const k = (lo + hi) / 2, p = inv.map(x => Math.pow(x, k)), t = p.reduce((a, b) => a + b, 0); return p.map(x => x / t);
}
function overround(o) { return o && o.every(x => x > 1) ? o.reduce((a, x) => a + 1 / x, 0) : null; }
// faire marktkans: scherpe referentie (Pinnacle of Betfair Exchange) als die plausibel is, anders het gemiddelde
function fairFrom(e) {
  if (!e) return null; const r = overround(e.ref);
  if (r && r > 0.97 && r < 1.12) return {p: devigPower(e.ref), src: e.refN || 'referentie'};
  // gemiddelde alleen gebruiken als er genoeg bookmakers zijn (bij 1-3 bookmakers op een randlijn is het te onbetrouwbaar)
  const g = overround(e.gem); if (g && g > 1.0 && g < 1.25 && !(e.n != null && e.n < 4)) return {p: devigPower(e.gem), src: 'gemiddelde bookmakers'};
  return null;
}
function blendP(pm, pk, w) { const e = pm.map((a, i) => Math.exp(w * Math.log(Math.max(a, 1e-9)) + (1 - w) * Math.log(Math.max(pk[i], 1e-9)))); const t = e.reduce((a, b) => a + b, 0); return e.map(x => x / t); }
let ODDS_CACHE = null;
function oddsList() { return typeof EXTRA_ODDS !== 'undefined' && Array.isArray(EXTRA_ODDS) ? EXTRA_ODDS : []; }
function picksList() { return typeof EXTRA_PICKS !== 'undefined' && Array.isArray(EXTRA_PICKS) ? EXTRA_PICKS : []; }
function teamIn(sid, c, name) { const sc = (S.seasons[sid].comps[c] || {teams: []}).teams; const id = findTeam(name, isNation(c) ? 'nation' : 'club', sc); return id && sc.includes(id) ? id : null; }
function oddsIndex(sid) {
  const key = sid + '|' + (typeof DATA_VERSION !== 'undefined' ? DATA_VERSION : '') + '|' + VER;
  if (ODDS_CACHE && ODDS_CACHE.key === key) return ODDS_CACHE.map;
  const map = new Map();
  for (const e of oddsList()) { if (!S.comps[e.c]) continue; const h = teamIn(sid, e.c, e.h), a = teamIn(sid, e.c, e.a); if (!h || !a) continue; e._h = h; e._a = a;
    const k = e.c + '|' + h + '|' + a, old = map.get(k); if (!old || (e.src === 'api' && old.src !== 'api') || (e.src === old.src && e.d > old.d)) map.set(k, e); }
  ODDS_CACHE = {key, map}; return map;
}
function oddsForMatch(sid, m) { const e = oddsIndex(sid).get(m.c + '|' + m.h + '|' + m.a); return e && Math.abs(daysBetween(e.d, m.d)) <= 3 ? e : null; }
function overProb(M, N, L) { let s = 0; for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) if (i + j > L) s += M[i * N + j]; return s; }
// modelgewicht, eventueel per competitie (instelling 'valueWComp', bv. "NED2=0.3, POL1=0.2")
function wFor(c) {
  const t = String(S.settings.valueWComp || ''); const m = t.match(new RegExp('(?:^|[\\s,;])' + c + '\\s*=\\s*([0-9.,]+)', 'i'));
  if (m) { const v = +m[1].replace(',', '.'); if (v >= 0 && v <= 1) return v; }
  // landenteams: het Elo-model is niet tegen de markt getoetst (geen historische odds), dus standaard telt alleen de markt
  return isNation(c) ? 0 : vset('valueW');
}
// ---------- afwezigen (blessures/schorsingen) ----------
// Getoetst (573 duels top-5 + Eredivisie + Süper Lig, 2026/27; meldingen ontdubbeld): λ × exp(−1·att + 1·verdediging tegenstander),
// gekozen op de eerste helft, verbeterde op de tweede helft de log-loss van het model (0,9542 → 0,9461) en van de combinatie
// (0,9474 → 0,9454, markt alleen 0,9484).
let INJ_CACHE = null;
function injIndex(sid) {
  const key = sid + '|' + VER; if (INJ_CACHE && INJ_CACHE.key === key) return INJ_CACHE.map; const map = new Map();
  const src = typeof EXTRA_INJ !== 'undefined' && EXTRA_INJ ? EXTRA_INJ : {};
  for (const k in src) { const [c, d, hn, an] = k.split('|'); if (!S.comps[c]) continue; const h = teamIn(sid, c, hn), a = teamIn(sid, c, an); if (h && a) map.set(c + '|' + h + '|' + a, {d, v: src[k]}); }
  INJ_CACHE = {key, map}; return map;
}
function injFor(sid, m) { const x = injIndex(sid).get(m.c + '|' + m.h + '|' + m.a); return x && Math.abs(daysBetween(x.d, m.d)) <= 2 ? x.v : null; }
function applyInj(l, v) {
  const ka = S.settings.injAtt != null ? +S.settings.injAtt : 1, kd = S.settings.injDef != null ? +S.settings.injDef : 1;
  if (!v || (!ka && !kd)) return l; const [aH, dH, aA, dA] = v;
  return [l[0] * Math.exp(-ka * aH + kd * dA), l[1] * Math.exp(-ka * aA + kd * dH), l[2]];
}
// alle kandidaten voor één duel (alle markten/lijnen), met modelkans, marktkans, combinatie, beste prijs en verwachte waarde.
// Dubbele kans en draw no bet krijgen hun faire kans uit de 1X2-markt (zelfde combinatie), zodat alle markten consistent zijn.
function matchValue(sid, m, e, snapKey, before) {
  const snap = e && e[snapKey || 'last']; if (!snap) return {list: []};
  const inj = before ? null : injFor(sid, m), l0 = lambdas(sid, m.c, m.h, m.a, !!m.n, before ? {before} : undefined), l = inj ? applyInj(l0, inj) : l0, p = predict(l[0], l[1], l[2]);
  const W = wFor(m.c), out = [], hn = tName(m.h), an = tName(m.a);
  // q = gecombineerde kans dat de inzet wint (exclusief 'push'), pp = kans op geld terug
  const add = (mk, line, side, label, pM, pK, q, ent, pp, src) => {
    if (!ent || !ent.max || !(ent.max[side] > 1)) return;
    const o = ent.max[side], np = 1 - (pp || 0), ev = np * (q * o - 1), kelly = Math.max(0, (q * o - 1) / (o - 1)) * vset('kellyFrac');
    out.push({m, e, mk, line, side, label, pModel: pM, pMarkt: pK, p: q, pWin: np * q, push: pp || 0, odds: o, bm: (ent.bm || [])[side] || '', n: ent.n || 0, src,
      ev, fair: 1 / q, minOdds: (vset('valueThr') / np + 1) / q, stake: Math.round(Math.min(kelly, vset('maxStake')) * vset('bank')), t: snap.t});
  };
  const two = (mk, line, side, label, pm, fair, ent, pp) => { const pb = blendP(pm, fair.p, W); add(mk, line, side, label, pm[side], fair.p[side], pb[side], ent, pp, fair.src); };
  const x = snap.x || {};
  const e1 = (x['1x2'] || {})['-']; const f1 = fairFrom(e1);
  if (f1) {
    const pm = [p.pH, p.pD, p.pA], pb = blendP(pm, f1.p, W), pk = f1.p;
    [0, 1, 2].forEach(i => add('1x2', null, i, ['1 ' + hn, 'X gelijk', '2 ' + an][i], pm[i], pk[i], pb[i], e1, 0, f1.src));
    // dubbele kans: 1X, 12, X2
    const dc = (x.dc || {})['-'], DC = [[0, 1], [0, 2], [1, 2]], sum = (a, ij) => a[ij[0]] + a[ij[1]];
    if (dc) DC.forEach((ij, k) => add('dc', null, k, ['1X ' + hn + ' of gelijk', '12 geen gelijkspel', 'X2 ' + an + ' of gelijk'][k], sum(pm, ij), sum(pk, ij), sum(pb, ij), dc, 0, f1.src));
    // draw no bet (= Asian handicap 0): bij gelijkspel inzet terug
    const dnb = (x.dnb || {})['-'] || (x.ah || {})['+0.00'] || (x.ah || {})['-0.00'] || (x.ah || {})['0.00'];
    if (dnb) [0, 2].forEach((i, k) => add('dnb', 0, k, (k ? an : hn) + ' draw no bet (AH 0)', pm[i] / (pm[0] + pm[2]), pk[i] / (pk[0] + pk[2]), pb[i] / (pb[0] + pb[2]), dnb, pb[1], f1.src));
  }
  for (const [k, ent] of Object.entries(x.ou || {})) { const L = +k; if (Math.abs(L * 2 - Math.round(L * 2)) > 1e-9 || Math.round(L * 2) % 2 === 0 || L < 1.5 || L > 4.5) continue;
    const f = fairFrom(ent); if (!f) continue; const ov = overProb(p.M, p.N, L); [0, 1].forEach(i => two('ou', L, i, (i ? 'Under ' : 'Over ') + num(L, 1), [ov, 1 - ov], f, ent)); }
  for (const [k, ent] of Object.entries(x.ah || {})) { const L = +k; if (Math.abs(L) < 1e-9) continue; const f = fairFrom(ent); if (!f || !ent.max || ent.max.some(o => !(o >= 1.4 && o <= 3.2))) continue;
    const r = ahLine(p.M, p.N, L), wl = r.w + r.l; if (wl <= 0) continue;
    const ahLab = (t, x) => t + ' ' + ahFmt(x) + (Math.abs(x - 0.5) < 1e-9 ? ' (= wint of gelijk)' : Math.abs(x + 0.5) < 1e-9 ? ' (= moet winnen)' : '');
    [0, 1].forEach(i => two('ah', L, i, i ? ahLab(an, -L) : ahLab(hn, L), [r.w / wl, r.l / wl], f, ent, r.p)); }
  return {list: out, p, l, inj};
}
function upcomingWithOdds(sid, fromIso) {
  const now = fromIso || new Date().toISOString(), today = refDate();
  return S.matches.filter(m => m.s === sid && !played(m) && m.d && m.d >= today && m.d <= addDaysStr(today, 10) && S.comps[m.c])
    .map(m => ({m, e: oddsForMatch(sid, m)})).filter(x => x.e && (x.e.ko || (x.e.d + 'T' + (x.e.t || '23:59') + ':00')) > now);
}
// Per duel de beste speelwijze (hoogste verwachte waarde) boven de drempel, met een rustiger alternatief als dat
// bijna even veel waarde heeft maar een duidelijk grotere kans op winst (minder schommelingen).
function valueBets(sid, opt) {
  opt = opt || {}; const thr = opt.thr != null ? opt.thr : vset('valueThr'), mo = vset('maxOdds'), all = [];
  for (const {m, e} of upcomingWithOdds(sid, opt.now)) {
    const c = matchValue(sid, m, e).list.filter(v => v.odds <= mo); if (!c.length) continue;
    const best = c.reduce((a, v) => v.ev > a.ev ? v : a);
    if (best.ev < thr) continue;
    const alts = c.filter(v => v !== best && v.ev >= Math.max(thr, 0.6 * best.ev) && v.pWin >= best.pWin + 0.08);
    best.alt = alts.length ? alts.reduce((a, v) => v.ev > a.ev ? v : a) : null;
    all.push(best);
  }
  return all.sort((a, b) => b.ev - a.ev);
}
// Mening van het model: duels zonder waarde waar het model duidelijk anders denkt dan de markt.
// Toont de kant die het model sterker ziet en de rustigste manier om die te spelen, met de (meestal negatieve) waarde.
function modelOpinions(sid, opt) {
  opt = opt || {}; const thr = vset('valueThr'), out = [];
  for (const {m, e} of upcomingWithOdds(sid, opt.now)) {
    const r = matchValue(sid, m, e); const c = r.list; if (!c.length) continue;
    if (c.some(v => v.ev >= thr && v.odds <= vset('maxOdds'))) continue;
    const x1 = c.filter(v => v.mk === '1x2'); if (x1.length < 3) continue;
    const diff = x1.map(v => v.pModel - v.pMarkt), i = diff.indexOf(Math.max(diff[0], diff[2]));
    if (diff[i] < 0.04) continue;
    const side = x1[i]; const k = i === 0 ? 0 : 1;
    // ook handicaplijnen in het voordeel van die kant: +0,5 = wint of gelijk, +0,25 = half draw no bet, enz.
    const ahSide = c.filter(v => v.mk === 'ah' && (i === 0 ? v.side === 0 && v.line >= 0 : v.side === 1 && v.line <= 0) && v.odds <= vset('maxOdds'));
    const opts = [side, c.find(v => v.mk === 'dnb' && v.side === k), c.find(v => v.mk === 'dc' && v.side === (i === 0 ? 0 : 2)), ...ahSide].filter(Boolean);
    const calm = opts.reduce((a, v) => v.pWin > a.pWin ? v : a); if (calm.odds > vset('maxOdds')) continue;
    out.push({m, e, side, calm, opts, gap: diff[i], only: opts.length === 1});
  }
  return out.sort((a, b) => b.gap - a.gap);
}
// closing line value van opgeslagen markeringen (EXTRA_PICKS): odds die we kregen × faire slotkans − 1
function settlePick(k, hg, ag) {
  if (hg == null) return null;
  if (k.mk === '1x2') return (hg > ag ? 0 : hg === ag ? 1 : 2) === k.side ? k.odds - 1 : -1;
  if (k.mk === 'ou') { const over = hg + ag > k.line; return (over === (k.side === 0)) ? k.odds - 1 : -1; }
  if (k.mk === 'dc') { const y = hg > ag ? 0 : hg === ag ? 1 : 2; return [[0, 1], [0, 2], [1, 2]][k.side].includes(y) ? k.odds - 1 : -1; }
  if (k.mk === 'dnb') { if (hg === ag) return 0; return (hg > ag) === (k.side === 0) ? k.odds - 1 : -1; }
  const L = k.line, parts = Math.round(Math.abs(L) * 4) % 2 === 1 ? [L - 0.25, L + 0.25] : [L]; let r = 0;
  parts.forEach(x => { const d = (hg - ag + x) * (k.side ? -1 : 1); r += (d > 1e-9 ? k.odds - 1 : d < -1e-9 ? -1 : 0) / parts.length; }); return r;
}
function clvLog(sid) {
  return picksList().map(k => {
    const h = teamIn(sid, k.c, k.h), a = teamIn(sid, k.c, k.a);
    const m = h && a ? S.matches.find(x => x.s === sid && x.c === k.c && x.h === h && x.a === a && Math.abs(daysBetween(x.d, k.d)) <= 3) : null;
    const f = k.close ? fairFrom(k.close) : null; let pc = f ? f.p[k.side] : null;
    if (f && k.mk === 'dc') pc = [[0, 1], [0, 2], [1, 2]][k.side].reduce((s, i) => s + f.p[i], 0);
    if (f && k.mk === 'dnb') pc = f.p[k.side ? 2 : 0] / (f.p[0] + f.p[2]);
    const clv = pc ? k.odds * pc - 1 : null; const res = m && played(m) ? settlePick(k, m.hg, m.ag) : null;
    return Object.assign({}, k, {match: m, pClose: pc, clv, res, pnl: res == null ? null : res * (k.stake || 0)});
  }).sort((x, y) => (y.d + y.t).localeCompare(x.d + x.t));
}

// ===================== VOORSPELLING: combinatie markt + model, per duel =====================
// Hoofdvoorspelling = faire marktkans (zonder marge) gecombineerd met het model (gewicht wFor); zonder odds alleen het model.
// De scorematrix van het model wordt herschaald naar de gecombineerde 1X2, zodat uitslagen, over/under en poule-advies kloppen.
function scaleMatrix(M, N, from, to) {
  const out = new Float64Array(M.length); for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) { const k = i > j ? 0 : i === j ? 1 : 2; out[i * N + j] = from[k] > 0 ? M[i * N + j] * to[k] / from[k] : 0; }
  return out;
}
function predictMatch(sid, m, opt) {
  opt = opt || {}; const bf = opt.before ? {before: opt.before} : undefined;
  const e = 'e' in opt ? opt.e : oddsForMatch(sid, m); const r = e ? matchValue(sid, m, e, 'last', opt.before) : null;
  const inj = r ? r.inj : (opt.before ? null : injFor(sid, m));
  const l = r ? r.l : (inj ? applyInj(lambdas(sid, m.c, m.h, m.a, !!m.n, bf), inj) : lambdas(sid, m.c, m.h, m.a, !!m.n, bf)), p = r ? r.p : predict(l[0], l[1], l[2]);
  const pm = [p.pH, p.pD, p.pA]; let pk = null, src = 'alleen model (geen odds)', pb = pm;
  const f1 = e && fairFrom(((e.last || {}).x || {})['1x2'] && e.last.x['1x2']['-']);
  if (f1) { pk = f1.p; pb = blendP(pm, pk, wFor(m.c)); src = 'markt (' + f1.src + ') + model ' + pct(wFor(m.c)); }
  const M = scaleMatrix(p.M, p.N, pm, pb), N = p.N; const cells = []; let over = 0, btts = 0;
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) { const v = M[i * N + j]; cells.push([i, j, v]); if (i + j > 2.5) over += v; if (i && j) btts += v; }
  cells.sort((a, b) => b[2] - a[2]);
  const fav = pb[0] >= pb[2] ? 0 : 2, pf = pb[fav], other = 2 - fav, fn = tName(fav ? m.a : m.h);
  const sure = pf >= 0.6 ? 'Duidelijke favoriet' : pf >= 0.45 ? 'Favoriet' : pf - pb[other] >= 0.08 ? 'Lichte favoriet' : 'Open duel';
  // speelwijze die bij de voorspelling past: hoe minder zeker, hoe meer bescherming
  let play;
  if (pf >= 0.6) play = {mk: '1x2', label: (fav ? '2 ' : '1 ') + fn, q: pf, push: 0, why: 'duidelijke favoriet: gewoon winst'};
  else if (pf >= 0.45) play = {mk: 'dnb', label: fn + ' draw no bet (AH 0)', q: pf / (pf + pb[other]), push: pb[1], why: 'favoriet, maar gelijkspel goed mogelijk: inzet terug bij gelijk'};
  else play = {mk: 'dc', label: (fav ? 'X2 ' : '1X ') + fn + ' of gelijk', q: pf + pb[1], push: 0, why: 'open duel: ' + fn + ' mag ook gelijkspelen'};
  play.fair = 1 / play.q;
  if (r) { // beste beschikbare prijs voor deze speelwijze (dubbele kans kan ook als handicap +0,5)
    const k = fav ? 1 : 0, c = r.list;
    const cand = play.mk === '1x2' ? c.filter(v => v.mk === '1x2' && v.side === fav)
      : play.mk === 'dnb' ? c.filter(v => v.mk === 'dnb' && v.side === k)
      : c.filter(v => (v.mk === 'dc' && v.side === (fav ? 2 : 0)) || (v.mk === 'ah' && v.side === k && Math.abs((k ? -v.line : v.line) - 0.5) < 1e-9));
    const best = cand.length ? cand.reduce((a, v) => v.odds > a.odds ? v : a) : null;
    if (best) { play.odds = best.odds; play.bm = best.bm; play.ev = (1 - play.push) * (play.q * best.odds - 1); play.via = best.mk === 'ah' ? 'als handicap +0,5' : ''; }
    else if (opt.approx && play.mk !== '1x2') { // terugblik: geen echte prijs → benaderen uit de beste 1X2-odds
      const b = c.filter(v => v.mk === '1x2').sort((a, b) => a.side - b.side).map(v => v.odds);
      if (b.length === 3) { const o = play.mk === 'dnb' ? b[fav] * (b[1] - 1) / b[1] : 1 / (1 / b[fav] + 1 / b[1]); play.odds = Math.round(o * 100) / 100; play.bm = 'benaderd'; play.ev = (1 - play.push) * (play.q * play.odds - 1); }
    }
  }
  // waar wijkt het model af van de markt?
  let dev = null;
  if (pk) { const d = [0, 1, 2].map(i => pm[i] - pk[i]); const i = [0, 1, 2].reduce((a, b) => Math.abs(d[b]) > Math.abs(d[a]) ? b : a, 0);
    if (Math.abs(d[i]) >= 0.04) dev = {i, d: d[i], pm: pm[i], pk: pk[i], label: ['1 ' + tName(m.h), 'gelijkspel', '2 ' + tName(m.a)][i]}; }
  const vb = r ? r.list.filter(v => v.odds <= vset('maxOdds') && v.ev >= vset('valueThr')).sort((a, b) => b.ev - a.ev)[0] : null;
  return {m, e, l, pm, pk, pb, src, M, N, top: cells.slice(0, 5), over, btts, sure, fav, play, dev, value: vb || null, hasOdds: !!pk, inj};
}
// Poule-advies (Roda JC-poule): exacte uitslag 5, juist doelsaldo + uitkomst 3, alleen juiste uitkomst 2.
// Kiest de voorspelling met de hoogste verwachte punten, vanuit het perspectief van 'team' (eerst diens doelpunten).
function pouleAdvice(P, team, maxG) {
  const {M, N, m} = P, home = m.h === team, G = Math.min(maxG || 5, N - 1), res = [];
  for (let a = 0; a <= G; a++) for (let b = 0; b <= G; b++) { // a = doelpunten team, b = tegenstander
    let ep = 0, exact = 0;
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) { const v = M[i * N + j]; if (!v) continue; const x = home ? i : j, y = home ? j : i;
      if (x === a && y === b) { ep += 5 * v; exact += v; } else if (x - y === a - b) ep += 3 * v; else if (Math.sign(x - y) === Math.sign(a - b)) ep += 2 * v; }
    res.push({a, b, ep, exact});
  }
  return res.sort((x, y) => y.ep - x.ep);
}

// ===================== TERUGBLIK: hoe pakten de voorspellingen van gespeelde duels uit? =====================
// Per gespeeld duel met odds van vóór de aftrap: voorspelling met alleen data van vóór die speelweek (wekelijkse herfit),
// uitkomst, de speelwijze tegen de beste prijs (€1 per duel) en de waarde-bets. Dubbele kans/draw no bet zijn benaderd uit 1X2.
function histOddsList() { return typeof EXTRA_ODDS_HIST !== 'undefined' && Array.isArray(EXTRA_ODDS_HIST) ? EXTRA_ODDS_HIST : []; }
function histSnap(r) {
  const [c, d, h, a, r1, g1, b1, bm1, ro, go, bo, L, ra, ga, ba] = r, x = {'1x2': {'-': {ref: r1, refN: 'Betfair Exchange', gem: g1, max: b1, bm: bm1}}, ou: {}, ah: {}};
  if (bo) x.ou['2.50'] = {ref: ro, refN: 'Betfair Exchange', gem: go, max: bo, bm: ['', '']};
  if (L != null && ba) x.ah[(L >= 0 ? '+' : '') + L.toFixed(2)] = {ref: ra, refN: 'Betfair Exchange', gem: ga, max: ba, bm: ['', '']};
  return {t: null, x};
}
function reviewRows(sid) {
  const out = [];
  for (const r of histOddsList()) {
    if (!S.comps[r[0]]) continue; const h = teamIn(sid, r[0], r[2]), a = teamIn(sid, r[0], r[3]); if (!h || !a) continue;
    const m = S.matches.find(x => x.s === sid && x.c === r[0] && x.h === h && x.a === a && played(x) && Math.abs(daysBetween(x.d, r[1])) <= 3); if (!m) continue;
    const snap = histSnap(r), e = {first: snap, last: snap, d: r[1]};
    const P = predictMatch(sid, m, {e, before: weekStart(m.d), approx: true});
    const y = m.hg > m.ag ? 0 : m.hg === m.ag ? 1 : 2, pl = P.play;
    let res = null; if (pl.odds) res = settlePick({mk: pl.mk, line: pl.mk === 'dnb' ? 0 : null, side: pl.mk === 'dc' ? (P.fav ? 2 : 0) : pl.mk === 'dnb' ? (P.fav ? 1 : 0) : P.fav, odds: pl.odds}, m.hg, m.ag);
    const vb = P.value; const vres = vb ? settlePick(vb, m.hg, m.ag) : null;
    const br = k => [0, 1, 2].reduce((s, i) => s + Math.pow(k[i] - (i === y ? 1 : 0), 2), 0);
    out.push({m, P, y, hit: P.pb.indexOf(Math.max(...P.pb)) === y, hitM: P.pm.indexOf(Math.max(...P.pm)) === y, hitK: P.pk ? P.pk.indexOf(Math.max(...P.pk)) === y : null,
      brC: br(P.pb), brM: br(P.pm), brK: P.pk ? br(P.pk) : null, res, vb, vres});
  }
  return out.sort((a, b) => (b.m.d + (b.m.t || '')).localeCompare(a.m.d + (a.m.t || '')));
}

// ===================== MIJN BETS: eigen (papieren) bets en acca's, met eigen kans en kans van de tool =====================
// Kansopties per duel op basis van de voorspelling (gecombineerde scorematrix): q = kans dat de inzet wint, pp = kans op geld terug.
function legOptions(sid, m) {
  const P = predictMatch(sid, m), {M, N, pb} = P, hn = tName(m.h), an = tName(m.a), o = [];
  const add = (mk, line, side, label, q, pp) => o.push({mk, line, side, label, q, pp: pp || 0});
  add('1x2', null, 0, '1 · ' + hn + ' wint', pb[0]); add('1x2', null, 1, 'X · gelijk', pb[1]); add('1x2', null, 2, '2 · ' + an + ' wint', pb[2]);
  add('dc', null, 0, '1X · ' + hn + ' of gelijk', pb[0] + pb[1]); add('dc', null, 2, 'X2 · ' + an + ' of gelijk', pb[1] + pb[2]); add('dc', null, 1, '12 · geen gelijkspel', pb[0] + pb[2]);
  add('dnb', 0, 0, hn + ' draw no bet', pb[0] / (pb[0] + pb[2]), pb[1]); add('dnb', 0, 1, an + ' draw no bet', pb[2] / (pb[0] + pb[2]), pb[1]);
  for (let L = -2.5; L <= 2.5 + 1e-9; L += 0.25) { const x = Math.round(L * 4) / 4; if (!x) continue; const r = ahLine(M, N, x), wl = r.w + r.l; if (wl <= 0) continue;
    add('ah', x, 0, 'AH ' + hn + ' ' + ahFmt(x), r.w / wl, r.p); add('ah', x, 1, 'AH ' + an + ' ' + ahFmt(-x), r.l / wl, r.p); }
  [0.5, 1.5, 2.5, 3.5, 4.5].forEach(L => { const ov = overProb(M, N, L); add('ou', L, 0, 'Over ' + num(L, 1), ov); add('ou', L, 1, 'Under ' + num(L, 1), 1 - ov); });
  add('btts', null, 0, 'Beide teams scoren', P.btts); add('btts', null, 1, 'Niet beide teams scoren', 1 - P.btts);
  return {P, opts: o.sort((a, b) => 0)};
}
function settleLeg(k, hg, ag) {
  if (k.mk === 'btts') { const y = hg > 0 && ag > 0; return (y === (k.side === 0)) ? k.odds - 1 : -1; }
  return settlePick(k, hg, ag);
}
function myBetStatus(sid, b) {
  let ret = 1, open = false; const legs = b.legs.map(l => {
    const m = S.matches.find(x => x.id === l.mid) || S.matches.find(x => x.s === sid && x.c === l.c && tName(x.h) === l.h && tName(x.a) === l.a);
    if (!m || !played(m)) { open = true; return Object.assign({}, l, {res: null}); }
    const r = settleLeg(l, m.hg, m.ag); ret *= 1 + r; return Object.assign({}, l, {res: r, score: m.hg + '–' + m.ag});
  });
  const lost = legs.some(l => l.res === -1);
  if (lost) return {legs, state: 'verloren', pnl: -b.stake};
  if (open) return {legs, state: 'open', pnl: null};
  return {legs, state: ret > 1 + 1e-9 ? 'gewonnen' : ret < 1 - 1e-9 ? 'verloren' : 'geld terug', pnl: b.stake * (ret - 1)};
}
