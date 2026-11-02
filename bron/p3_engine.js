// ===================== KERN: opslag, teams, model, simulaties =====================
const STORE_KEY = 'voetbalvoorspeller-v1', UI_KEY = 'voetbalvoorspeller-ui-v1';
const DEFAULT_SETTINGS = {
  halfLife: 365, priorMatches: 8, regress: 0.33, promotedPenalty: 0.15, relegatedBonus: 0.2,
  leagueScale: 0.6, tierGap: 0.55, otherLeague: -0.5, clubCoefWeight: 0.2, hfaPrior: 0.12,
  useHistory: true, hfaTau: 600, hfaTauNoHist: 600, xgWeight: 0.5, spread: 1.5, supCap: 1.0, rhoMode: 'fit', rhoFixed: -0.05, maxGoals: 10, mcRuns: 10000, simNoise: 0.15, penShareHome: 0.5,
  eloHome: 100, eloK: {friendly: 20, nl: 35, qual: 40, final: 55}, eloGoals: 2.6, nationRho: -0.04, eloRegress: 0, refDate: '',
  valueW: 0.15, valueThr: 0.03, bank: 500, kellyFrac: 0.25, maxStake: 0.02, maxOdds: 6, valueWComp: '', injAtt: 1, injDef: 1
};
const ZONE_INFO = {
  champ: {label: 'Kampioen', short: 'Kamp.', cls: 'z-champ'},
  cl: {label: 'Champions League', short: 'CL', cls: 'z-cl'},
  clq: {label: 'CL-voorronde', short: 'CL-vr', cls: 'z-clq'},
  el: {label: 'Europa League', short: 'EL', cls: 'z-el'},
  ecl: {label: 'Conference League', short: 'ECL', cls: 'z-ecl'},
  eurpo: {label: 'Play-offs Europees voetbal', short: 'PO-Eur', cls: 'z-eurpo'},
  promo: {label: 'Directe promotie', short: 'Promo', cls: 'z-promo'},
  po: {label: 'Play-offs promotie', short: 'PO', cls: 'z-po'},
  promopo: {label: 'Promotie via play-offs', short: 'Promo PO', cls: 'z-po'},
  promotot: {label: 'Promotie totaal', short: 'Promo tot.', cls: 'z-promo'},
  relpo: {label: 'Play-off degradatie', short: 'PO-degr.', cls: 'z-relpo'},
  relpoloss: {label: 'Degradatie via play-off', short: 'Degr. PO', cls: 'z-relpo'},
  rel: {label: 'Directe degradatie', short: 'Degr.', cls: 'z-rel'},
  reltot: {label: 'Degradatie totaal', short: 'Degr. tot.', cls: 'z-rel'},
  jongrel: {label: 'Jong-team degradeert (art. 10)', short: 'Jong ↓', cls: 'z-rel'},
  kf: {label: 'Kwartfinale', short: 'KF', cls: 'z-cl'},
  q: {label: 'Geplaatst', short: 'Gepl.', cls: 'z-promo'},
  qpo: {label: 'Play-offs', short: 'PO', cls: 'z-po'}
};
const KO_LABEL = {po: 'Play-offs', r16: '1/8 finale', qf: 'Kwartfinale', sf: 'Halve finale', f: 'Finale'};

let S = null, VER = 0;
const CACHE = new Map();
const SIMS = {};
function bump() { VER++; CACHE.clear(); HIST = null; }
const clone = o => JSON.parse(JSON.stringify(o));

// ---------- hulpfuncties ----------
function todayStr() { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10); }
function refDate() { return S.settings.refDate || todayStr(); }
function daysBetween(a, b) { return (Date.parse(b) - Date.parse(a)) / 864e5; }
const played = m => m.hg != null && m.ag != null && m.hg !== '' && m.ag !== '';
function baseNorm(s) { return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/ø/g, 'o').replace(/ł/g, 'l').replace(/ı/g, 'i').replace(/ß/g, 'ss').replace(/æ/g, 'ae').replace(/[^a-z0-9]+/g, ' ').trim(); }
function looseNorm(s) { return baseNorm(s).replace(/\b(fc|afc|cf|sc|sk|fk|sv|bv|kv|club|the|calcio|ssc|1)\b/g, ' ').replace(/\s+/g, ' ').trim(); }
function slug(s) { return baseNorm(s).replace(/\s+/g, '-') || ('t' + Math.random().toString(36).slice(2, 7)); }
function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }
function gauss() { let u = 0, v = 0; while (!u) u = Math.random(); while (!v) v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
const isNation = cid => S.comps[cid] && S.comps[cid].type === 'nation';
const isClubComp = cid => S.comps[cid] && S.comps[cid].type !== 'nation';
const tName = id => (S.teams[id] && S.teams[id].name) || id;

// ---------- opslag ----------
let saveError = null;
function save() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(S)); saveError = null; }
  catch (e) { saveError = 'Opslaan in de browser is mislukt (' + (e && e.name || 'fout') + '). Exporteer een back-up via Data om niets te verliezen.'; }
}
function load() {
  try { const raw = localStorage.getItem(STORE_KEY); if (!raw) return null; const o = JSON.parse(raw); if (!o || o.v !== 1 || !o.teams) return null; return o; }
  catch (e) { saveError = 'Opgeslagen data kon niet worden gelezen; startdata geladen. Importeer zo nodig een back-up.'; return null; }
}

// ---------- teams ----------
function teamIndex() {
  const key = 'tidx|' + VER; if (CACHE.has(key)) return CACHE.get(key);
  const exact = {}, loose = {};
  for (const id in S.teams) {
    const t = S.teams[id];
    [t.name, ...(t.aliases || [])].forEach(n => { exact[baseNorm(n)] = id; const l = looseNorm(n); if (l) (loose[l] = loose[l] || new Set()).add(id); });
  }
  const byName = {}; for (const id in S.teams) byName[S.teams[id].name] = id;
  for (const a in S.aliases) { const tid = byName[S.aliases[a]]; if (tid) exact[baseNorm(a)] = tid; }
  const r = {exact, loose}; CACHE.set(key, r); return r;
}
function findTeam(name, kind, scope) {
  if (!name) return null;
  if (S.teams[name]) return name;
  const ix = teamIndex(); const b = baseNorm(name);
  let id = ix.exact[b];
  if (id && (!kind || S.teams[id].kind === kind)) return id;
  const l = looseNorm(name); const set = ix.loose[l];
  if (set) { const c = [...set].filter(x => !kind || S.teams[x].kind === kind); if (c.length === 1) return c[0]; }
  if (scope && scope.length && l.length >= 4) {
    const c = scope.filter(t => { const tl = looseNorm(tName(t)); return tl && (tl.includes(l) || l.includes(tl)); });
    if (c.length === 1) return c[0];
  }
  return null;
}
function ensureTeam(name, kind, cc, scope) {
  const f = findTeam(name, kind, scope); if (f) return f;
  let id = slug(name); while (S.teams[id]) id += '-2';
  S.teams[id] = {id, name: String(name).trim(), kind: kind || 'club', cc: cc || '', aliases: []};
  const ti = CACHE.get('tidx|' + VER); if (ti) { const t = S.teams[id]; ti.exact[baseNorm(t.name)] = id; const l = looseNorm(t.name); if (l) (ti.loose[l] = ti.loose[l] || new Set()).add(id); }
  return id;
}

// ---------- seed opbouwen ----------
function parseFixtureBlock(txt) {
  const out = []; let md = 0, date = '';
  txt.split('\n').forEach(line => {
    line = line.trim(); if (!line) return;
    if (line[0] === '#') { const p = line.slice(1).split(' '); md = +p[0]; date = mmdd(p[1]); return; }
    const m = line.match(/^(.+?) v (.+?)(?: (\d+)-(\d+))?$/);
    if (m) out.push({md, date, h: m[1], a: m[2], hg: m[3] != null ? +m[3] : null, ag: m[4] != null ? +m[4] : null});
  });
  return out;
}
function mmdd(s) { const mo = +s.slice(0, 2); return (mo >= 7 ? '2026' : '2027') + '-' + s.slice(0, 2) + '-' + s.slice(2, 4); }
function nlRound(d) { const x = d.slice(5); if (x <= '09-26') return 1; if (x <= '09-29') return 2; if (x <= '10-03') return 3; if (x <= '10-06') return 4; if (x <= '11-14') return 5; return 6; }

function buildSeed() {
  S = {v: 1, settings: clone(DEFAULT_SETTINGS), coef: clone(SEED_COEF), teams: {}, comps: {}, seasons: {}, matches: [], adj: {}, aliases: clone(SEED_ALIASES), active: '2026/27', nextId: 1, created: SEED_DATE, modelRev: 4};
  SEED_COMPS.forEach(c => S.comps[c.id] = clone(c));
  const sid = '2026/27';
  const season = S.seasons[sid] = {id: sid, status: 'actief', start: '2026-07-01', end: '2027-06-30', comps: {}, prior: {}, archive: null};
  for (const cid in SEED_TEAMS) season.comps[cid] = {teams: SEED_TEAMS[cid].map(n => ensureTeam(n, 'club', S.comps[cid].cc))};
  for (const n in SEED_CLUBCOEF) { const id = ensureTeam(n, 'club', SEED_CLUBCC[n] || ''); S.teams[id].coef = SEED_CLUBCOEF[n]; }
  [['UCL', SEED_UCL], ['UEL', SEED_UEL], ['UECL', SEED_UECL]].forEach(([cid, txt]) => {
    const set = new Set();
    parseFixtureBlock(txt).forEach(f => {
      const h = ensureTeam(f.h, 'club', SEED_CLUBCC[f.h]), a = ensureTeam(f.a, 'club', SEED_CLUBCC[f.a]);
      set.add(h); set.add(a);
      addMatch({s: sid, c: cid, d: f.date, r: f.md, h, a, hg: f.hg, ag: f.ag, st: 'lp', src: 'seed'});
    });
    season.comps[cid] = {teams: [...set]};
  });
  const nat = (txt, assumed) => txt.split('|').forEach(x => { const m = x.trim().match(/^(.+) ([\d.]+)$/); if (!m) return; const id = ensureTeam(m[1], 'nation'); const t = S.teams[id]; t.fifa = +m[2]; t.elo0 = Math.round(1500 + (t.fifa - 1500) * 2 / 3); t.eloNote = assumed ? 'aanname' : 'FIFA 7-10-2026'; });
  nat(SEED_FIFA, false); nat(SEED_FIFA_ASSUMED, true);
  const groups = {};
  SEED_UNL.split('\n').forEach(line => {
    const m = line.trim().match(/^([A-D]\d) (\d{4}) (.+?) v (.+)$/); if (!m) return;
    const d = mmdd(m[2]), h = ensureTeam(m[3], 'nation'), a = ensureTeam(m[4], 'nation');
    (groups[m[1]] = groups[m[1]] || new Set()).add(h); groups[m[1]].add(a);
    addMatch({s: sid, c: 'UNL', d, r: nlRound(d), h, a, st: 'group', g: m[1], src: 'seed'});
  });
  const g = {}; Object.keys(groups).sort().forEach(k => g[k] = [...groups[k]]);
  season.comps.UNL = {teams: Object.values(g).flat(), groups: g};
  ['EUROQ', 'EURO', 'WC', 'FRIENDLY'].forEach(c => season.comps[c] = {teams: [], groups: {}});
  computeSeedPriors(sid);
  applyExtraData();
}
// Opgehaalde data (openfootball / international_results) toevoegen of bijwerken; niet-destructief, ook voor bestaande opslag.
function applyExtraData() {
  if (typeof DATA_VERSION === 'undefined' || S.dataVersion === DATA_VERSION) return null;
  if (typeof EXTRA_ELO_DATE !== 'undefined') S.eloBase = EXTRA_ELO_DATE;
  for (const name in EXTRA_ELO) { const id = ensureTeam(name, 'nation'); const t = S.teams[id]; if (!t.eloManual) { t.elo0 = EXTRA_ELO[name]; t.eloNote = 'Elo-historie t/m ' + (S.eloBase || ''); } }
  const reps = [];
  reps.push(importRows(EXTRA_CLUB.map(r => ({competitie: r[0], datum: r[1], ronde: r[2], thuis: r[3], uit: r[4], thuisgoals: r[5], uitgoals: r[6], fase: 'league', bron: 'openfootball'})), {quiet: true}));
  reps.push(importRows(EXTRA_INTL.map(r => ({competitie: r[0], datum: r[1], thuis: r[2], uit: r[3], thuisgoals: r[4], uitgoals: r[5], neutraal: r[6] ? 'ja' : '', belang: r[7], fase: r[0] === 'UNL' ? 'group' : 'friendly', bron: 'international_results'})), {quiet: true}));
  if (typeof EXTRA_FD !== 'undefined' && EXTRA_FD) reps.push(importFootballData(EXTRA_FD));
  if (typeof EXTRA_WEB !== 'undefined' && EXTRA_WEB.length) reps.push(importRows(EXTRA_WEB.map(r => Object.assign({bron: 'web'}, r)), {quiet: true}));
  if (typeof EXTRA_AF !== 'undefined' && EXTRA_AF.length) reps.push(importRows(EXTRA_AF.map(([c, sz, d, t, r, st, h, a, hg, ag, xh, xa]) => ({competitie: c, datum: d, tijd: t, ronde: r, fase: st, thuis: h, uit: a, thuisgoals: hg, uitgoals: ag, xg_thuis: xh, xg_uit: xa, bron: 'api-football'})), {quiet: true}));
  S.dataVersion = DATA_VERSION; S.dataUpdated = typeof DATA_UPDATED !== 'undefined' ? DATA_UPDATED : ''; bump();
  return {added: reps.reduce((s, r) => s + r.added, 0), updated: reps.reduce((s, r) => s + r.updated, 0), errors: reps.flatMap(r => r.errors), newTeams: reps.flatMap(r => r.newTeams)};
}
function primaryLeague(sid, t) {
  const sc = S.seasons[sid].comps;
  for (const cid in sc) if (S.comps[cid] && S.comps[cid].type === 'league' && sc[cid].teams.includes(t)) return cid;
  return null;
}
function leagueOffset(cid) {
  const st = S.settings, c = S.comps[cid]; if (!c) return st.otherLeague;
  if (c.tier >= 2 && c.parent) return leagueOffset(c.parent) - st.tierGap * (c.tier - 1);
  const k = S.coef.find(x => x.cc === c.cc);
  return k ? st.leagueScale * Math.log(k.coef / 60) : st.otherLeague;
}
function clubBonus(t) { const c = S.teams[t] && S.teams[t].coef; return c ? clamp(S.settings.clubCoefWeight * Math.log(c / 20), -0.2, 0.6) : 0; }
function computeSeedPriors(sid) {
  const season = S.seasons[sid], st = S.settings;
  const promoted = new Set(SEED_PROMOTED.map(n => findTeam(n, 'club'))), rel = new Set(SEED_RELEGATED_INTO_2ND.map(n => findTeam(n, 'club')));
  for (const id in S.teams) {
    if (S.teams[id].kind !== 'club') continue;
    const cid = primaryLeague(sid, id);
    let s = (cid ? leagueOffset(cid) : st.otherLeague) + clubBonus(id);
    if (promoted.has(id)) s -= st.promotedPenalty;
    if (rel.has(id)) s += st.relegatedBonus;
    season.prior[id] = {a: s / 2, d: s / 2, src: 'start'};
  }
  bump();
}
function priorOf(sid, t) {
  const p = S.seasons[sid] && S.seasons[sid].prior[t]; if (p) return p;
  const cid = primaryLeague(sid, t); const s = (cid ? leagueOffset(cid) : S.settings.otherLeague) + clubBonus(t) - (cid ? S.settings.promotedPenalty : 0);
  return {a: s / 2, d: s / 2, src: 'afgeleid'};
}
function addMatch(o) {
  const m = {id: S.nextId++, s: o.s, c: o.c, d: o.d, r: o.r != null && o.r !== '' ? +o.r : null, h: o.h, a: o.a,
    hg: o.hg != null && o.hg !== '' ? +o.hg : null, ag: o.ag != null && o.ag !== '' ? +o.ag : null};
  ['n', 'st', 'g', 'tie', 'leg', 'pw', 'o', 'imp', 'src', 't', 'xg'].forEach(k => { if (o[k] != null && o[k] !== '') m[k] = o[k]; });
  S.matches.push(m); return m;
}

// ---------- doelpuntenmodel ----------
function dcTau(x, y, l, m, r) {
  if (x === 0 && y === 0) return 1 - l * m * r;
  if (x === 0 && y === 1) return 1 + l * r;
  if (x === 1 && y === 0) return 1 + m * r;
  if (x === 1 && y === 1) return 1 - r;
  return 1;
}
function poisArr(l, n) { const a = new Float64Array(n + 1); a[0] = Math.exp(-l); for (let k = 1; k <= n; k++) a[k] = a[k - 1] * l / k; return a; }
function scoreMatrix(lh, la, rho, maxG) {
  maxG = maxG || S.settings.maxGoals; const N = maxG + 1, ph = poisArr(lh, maxG), pa = poisArr(la, maxG);
  const M = new Float64Array(N * N); let tot = 0;
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) { const v = Math.max(0, ph[i] * pa[j] * dcTau(i, j, lh, la, rho)); M[i * N + j] = v; tot += v; }
  for (let k = 0; k < M.length; k++) M[k] /= tot;
  return {M, N};
}
function outcome(lh, la, rho, maxG) {
  const {M, N} = scoreMatrix(lh, la, rho, maxG); let h = 0, d = 0, a = 0;
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) { const v = M[i * N + j]; if (i > j) h += v; else if (i === j) d += v; else a += v; }
  return {h, d, a, M, N};
}
function predict(lh, la, rho) {
  const o = outcome(lh, la, rho); const {M, N} = o; const cells = []; let over = 0, btts = 0;
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) { const v = M[i * N + j]; cells.push([i, j, v]); if (i + j > 2.5) over += v; if (i > 0 && j > 0) btts += v; }
  cells.sort((x, y) => y[2] - x[2]);
  return {pH: o.h, pD: o.d, pA: o.a, xgH: lh, xgA: la, rho, top: cells.slice(0, 5), over, btts, M, N};
}

// Asian handicap. L = handicap voor de thuisploeg (bv. -0.75 = thuis geeft 0,75 voor). Kwartlijnen = halve inzet op elk van de twee buurlijnen.
// w = kans dat de thuisinzet wint, p = kans dat (een deel van) de inzet terugkomt, l = kans dat de thuisinzet verliest (half-uitkomsten naar rato).
function ahLine(M, N, L) {
  const parts = Math.round(Math.abs(L) * 4) % 2 === 1 ? [L - 0.25, L + 0.25] : [L]; let w = 0, p = 0, l = 0;
  parts.forEach(x => { for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) { const v = M[i * N + j] / parts.length, s = i - j + x; if (s > 1e-9) w += v; else if (s < -1e-9) l += v; else p += v; } });
  return {L, w, p, l, oH: w > 0 ? 1 + l / w : Infinity, oA: l > 0 ? 1 + w / l : Infinity};
}
// faire hoofdlijn: de kwartlijn waarop thuis- en uitinzet het dichtst bij gelijke kans liggen
function ahMain(M, N) {
  let best = null; for (let k = -24; k <= 24; k++) { const r = ahLine(M, N, k / 4); if (!best || Math.abs(r.w - r.l) < Math.abs(best.w - best.l)) best = r; }
  return best;
}
function ahLadder(M, N, center, span) { const out = []; for (let x = center - (span || 1); x <= center + (span || 1) + 1e-9; x += 0.25) out.push(ahLine(M, N, Math.round(x * 4) / 4)); return out; }
// kans dat de thuisploeg (van dit duel) doorgaat in een enkel knock-outduel
function koSingleAdv(lh, la, rho) {
  const p = outcome(lh, la, rho), e = outcome(lh / 3, la / 3, 0, 6), ps = S.settings.penShareHome;
  return p.h + p.d * (e.h + e.d * ps);
}
// tweeluik: A speelt duel 1 thuis, B duel 2 thuis. leg1: [goalsA, goalsB] of null. Retourneert P(A gaat door).
function koTwoLegAdv(lA1, lB1, rho1, lB2, lA2, rho2, leg1) {
  const ps = S.settings.penShareHome; const L2 = outcome(lB2, lA2, rho2, 8), E = outcome(lB2 / 3, lA2 / 3, 0, 6);
  const etA = E.a + E.d * (1 - ps);
  function advGiven(d1) { let p = 0; const N = L2.N; for (let b = 0; b < N; b++) for (let a = 0; a < N; a++) { const v = L2.M[b * N + a]; const d = d1 + a - b; if (d > 0) p += v; else if (d === 0) p += v * etA; } return p; }
  if (leg1) return advGiven(leg1[0] - leg1[1]);
  const L1 = outcome(lA1, lB1, rho1, 8); let p = 0; const memo = {};
  for (let i = 0; i < L1.N; i++) for (let j = 0; j < L1.N; j++) { const d = i - j; if (memo[d] == null) memo[d] = advGiven(d); p += L1.M[i * L1.N + j] * memo[d]; }
  return p;
}
function poisson(l) { let p = Math.exp(-l), s = p, k = 0; const u = Math.random(); while (u > s && k < 30) { k++; p *= l / k; s += p; } return k; }
let SX = 0, SY = 0;
function sample2(l, m, r) {
  const M = r ? Math.max(1, 1 - l * m * r, 1 - r, 1 + l * r, 1 + m * r) : 1;
  for (let k = 0; k < 50; k++) {
    const x = poisson(l), y = poisson(m);
    if (M === 1 || ((x > 1 || y > 1) ? Math.random() * M < 1 : Math.random() * M < dcTau(x, y, l, m, r))) { SX = x; SY = y; return; }
  }
  SX = poisson(l); SY = poisson(m);
}
function sampleScore(l, m, r) {
  if (!r) return [poisson(l), poisson(m)];
  const M = Math.max(1, 1 - l * m * r, 1 - r, 1 + l * r, 1 + m * r);
  for (let k = 0; k < 50; k++) { const x = poisson(l), y = poisson(m); if (x > 1 || y > 1) { if (M === 1 || Math.random() * M < 1) return [x, y]; continue; } if (Math.random() * M < dcTau(x, y, l, m, r)) return [x, y]; }
  return [poisson(l), poisson(m)];
}

// ---------- clubratings: gewogen Poisson-fit met prior ----------
// ---------- historie vorig seizoen (alleen voor de ratingfit; wordt niet opgeslagen) ----------
let HIST = null, HIST_TEAMS = {};
const HIST_PARENT = {ENG2: 'ENG1', GER2: 'GER1', ESP2: 'ESP1', ITA2: 'ITA1', FRA2: 'FRA1'};
function histRows() {
  if (HIST) return HIST; HIST = []; HIST_TEAMS = {};
  const OF = typeof EXTRA_HIST !== 'undefined' ? EXTRA_HIST : [], AFH = typeof EXTRA_AF_HIST !== 'undefined' ? EXTRA_AF_HIST : [];
  if (!OF.length && !AFH.length) return HIST;
  const known = new Set(); Object.values(S.seasons).forEach(se => { for (const c in se.comps) if (isClubComp(c)) se.comps[c].teams.forEach(t => known.add(t)); });
  Object.values(S.teams).forEach(t => { if (t.kind === 'club' && t.coef) known.add(t.id); });
  const map = (name, code) => {
    const id = findTeam(name, 'club'); if (id && known.has(id)) return id;
    const pid = '~' + baseNorm(name).replace(/\s+/g, '-'); if (!HIST_TEAMS[pid]) HIST_TEAMS[pid] = {name, code}; return pid;
  };
  // API-Football (met xG) heeft voorrang; openfootball vult aan voor competitie-seizoenen die daar ontbreken (bv. 2e niveaus)
  const seasonOf = d => { const y = +d.slice(0, 4), mo = +d.slice(5, 7); return mo >= 7 ? y : y - 1; };
  const afHas = new Set(AFH.map(r => r[0] + '|' + r[1]));
  AFH.forEach(([c, sz, d, t, r, st, h, a, hg, ag, xh, xa]) => { if (hg == null || ag == null) return; HIST.push({c, d, h: map(h, c), a: map(a, c), hg, ag, n: st === 'f', xg: xh != null && xa != null ? [xh, xa] : null, hist: true}); });
  OF.forEach(([c, d, h, a, hg, ag, n]) => { if (afHas.has(c + '|' + seasonOf(d))) return; HIST.push({c, d, h: map(h, c), a: map(a, c), hg, ag, n: !!n, hist: true}); });
  return HIST;
}
function histPrior(t) {
  const x = HIST_TEAMS[t], st = S.settings; if (!x) return {a: 0, d: 0};
  const s = HIST_PARENT[x.code] ? leagueOffset(HIST_PARENT[x.code]) - st.tierGap : S.comps[x.code] && S.comps[x.code].type === 'league' ? leagueOffset(x.code) - st.promotedPenalty : st.otherLeague;
  return {a: s / 2, d: s / 2};
}
function clubFit(sid, before) {
  const key = 'fit|' + sid + '|' + (before || '') + '|' + VER; if (CACHE.has(key)) return CACHE.get(key);
  const st = S.settings, season = S.seasons[sid]; const ref = before || refDate();
  const cur = S.matches.filter(m => m.s === sid && played(m) && isClubComp(m.c) && (!before || m.d < before));
  const hist = st.useHistory !== false ? histRows().filter(m => m.d < (season.start || '0000') && (!before || m.d < before)) : [];
  const ms = cur.concat(hist);
  const ids = new Set(Object.keys(season.prior || {}));
  for (const c in season.comps) if (isClubComp(c)) season.comps[c].teams.forEach(t => ids.add(t));
  ms.forEach(m => { ids.add(m.h); ids.add(m.a); });
  const TA = [...ids].filter(t => S.teams[t] || HIST_TEAMS[t]), ix = {}; TA.forEach((t, i) => ix[t] = i);
  const T = TA.filter(t => S.teams[t]);
  const n = TA.length, att = new Float64Array(n), def = new Float64Array(n), pa = new Float64Array(n), pd = new Float64Array(n);
  TA.forEach((t, i) => { const p = S.teams[t] ? priorOf(sid, t) : histPrior(t); pa[i] = att[i] = p.a; pd[i] = def[i] = p.d; });
  const hfa = {}; let mu = 0.27;
  const lam = Math.LN2 / Math.max(10, st.halfLife), W = ms.map(m => Math.exp(-lam * Math.max(0, daysBetween(m.d, ref))));
  const MI = ms.map(m => [ix[m.h], ix[m.a]]);
  // doelwit van de fit: mix van werkelijke doelpunten en expected goals (xG) waar beschikbaar
  const xw = Math.max(0, Math.min(1, st.xgWeight || 0));
  const GH = ms.map(m => m.xg && xw ? xw * m.xg[0] + (1 - xw) * m.hg : m.hg), GA = ms.map(m => m.xg && xw ? xw * m.xg[1] + (1 - xw) * m.ag : m.ag);
  ms.forEach(m => { if (!m.n && hfa[m.c] == null) hfa[m.c] = st.hfaPrior; });
  const tau = st.priorMatches * 1.35, tauH = st.hfaTau != null ? st.hfaTau : 25;
  // competities zonder historie (bv. KKD, Polen) leunen op één seizoen: thuisvoordeel daar sterker naar de prior trekken
  const tauHN = st.hfaTauNoHist != null ? st.hfaTauNoHist : tauH, histComps = new Set(hist.map(m => m.c));
  const gA = new Float64Array(n), hA = new Float64Array(n), gD = new Float64Array(n), hD = new Float64Array(n);
  // Blokgewijze Newton-stappen (Gauss-Seidel): eerst aanval, dan verdediging, thuisvoordeel en intercept, telkens met verse verwachtingen.
  // Alles tegelijk bijwerken schiet door omdat μ, aanval en verdediging samen hetzelfde niveau verklaren.
  const pass = blk => {
    gA.fill(0); hA.fill(0); gD.fill(0); hD.fill(0); const gH = {}, hH = {}; let gM = 0, hM = 0;
    for (let k = 0; k < ms.length; k++) {
      const m = ms[k], w = W[k], i = MI[k][0], j = MI[k][1], ha = m.n ? 0 : hfa[m.c];
      const lh = Math.exp(mu + ha + att[i] - def[j]), la = Math.exp(mu + att[j] - def[i]);
      const yh = GH[k], ya = GA[k];
      gA[i] += w * (yh - lh); hA[i] += w * lh; gA[j] += w * (ya - la); hA[j] += w * la;
      gD[j] += w * (lh - yh); hD[j] += w * lh; gD[i] += w * (la - ya); hD[i] += w * la;
      if (!m.n) { gH[m.c] = (gH[m.c] || 0) + w * (yh - lh); hH[m.c] = (hH[m.c] || 0) + w * lh; }
      gM += w * (yh - lh + ya - la); hM += w * (lh + la);
    }
    if (blk === 'a') for (let i = 0; i < n; i++) att[i] += (gA[i] - tau * (att[i] - pa[i])) / (hA[i] + tau);
    else if (blk === 'd') for (let i = 0; i < n; i++) def[i] += (gD[i] - tau * (def[i] - pd[i])) / (hD[i] + tau);
    else if (blk === 'h') for (const c in hfa) { const t = histComps.has(c) ? tauH : tauHN; hfa[c] += ((gH[c] || 0) - t * (hfa[c] - st.hfaPrior)) / ((hH[c] || 0) + t); }
    else mu += (gM - 2 * (mu - 0.27)) / (hM + 2);
  };
  for (let it = 0; it < (ms.length ? 30 : 0); it++) { pass('m'); pass('a'); pass('d'); pass('h'); }
  let rho = st.rhoFixed;
  if (st.rhoMode === 'fit' && ms.length > 50) {
    let best = -Infinity;
    for (let r = -0.25; r <= 0.1501; r += 0.01) {
      let L = 0, ok = true;
      for (let k = 0; k < ms.length; k++) {
        const m = ms[k]; if (m.hg > 1 || m.ag > 1) continue;
        const i = MI[k][0], j = MI[k][1], ha = m.n ? 0 : hfa[m.c];
        const t = dcTau(m.hg, m.ag, Math.exp(mu + ha + att[i] - def[j]), Math.exp(mu + att[j] - def[i]), r);
        if (t <= 0) { ok = false; break; } L += W[k] * Math.log(t);
      }
      if (ok && L > best) { best = L; rho = Math.round(r * 100) / 100; }
    }
  }
  const nm = {}; cur.forEach(m => { nm[m.h] = (nm[m.h] || 0) + 1; nm[m.a] = (nm[m.a] || 0) + 1; });
  let ma = 0, md = 0; T.forEach(t => { ma += att[ix[t]]; md += def[ix[t]]; }); ma /= T.length || 1; md /= T.length || 1;
  const fit = {sid, T, ix, att, def, hfa, mu, rho, n: cur.length, nHist: hist.length, nm, ma, md,
    r(t) { const i = ix[t]; if (i == null) { const p = priorOf(sid, t); return {a: p.a, d: p.d}; } return {a: att[i], d: def[i]}; }};
  CACHE.set(key, fit); return fit;
}
const adjV = t => (S.adj[t] && +S.adj[t].v) || 0;

// ---------- Elo nationale teams ----------
function elo0(t) { const x = S.teams[t]; return x && x.elo0 != null ? x.elo0 : 1350; }
function eloState(before) {
  const key = 'elo|' + (before || '') + '|' + VER; if (CACHE.has(key)) return CACHE.get(key);
  const st = S.settings, elo = {}, pre = {}, games = {};
  const base = S.eloBase || '0000';
  const ms = S.matches.filter(m => isNation(m.c) && played(m) && m.d >= base && (!before || m.d < before)).sort((x, y) => x.d < y.d ? -1 : x.d > y.d ? 1 : x.id - y.id);
  let curS = null;
  for (const m of ms) {
    if (curS && m.s !== curS && st.eloRegress > 0) { const v = Object.values(elo); const mean = v.reduce((a, b) => a + b, 0) / (v.length || 1); for (const t in elo) elo[t] = (1 - st.eloRegress) * elo[t] + st.eloRegress * mean; }
    curS = m.s;
    const eh = elo[m.h] != null ? elo[m.h] : elo0(m.h), ea = elo[m.a] != null ? elo[m.a] : elo0(m.a);
    const dr = eh - ea + (m.n ? 0 : st.eloHome); pre[m.id] = [eh, ea, dr];
    const E = 1 / (1 + Math.pow(10, -dr / 400)), W = m.hg > m.ag ? 1 : m.hg === m.ag ? 0.5 : 0, gd = Math.abs(m.hg - m.ag);
    const G = gd <= 1 ? 1 : gd === 2 ? 1.5 : (11 + gd) / 8;
    const imp = m.imp || (S.comps[m.c] && S.comps[m.c].format.importance) || 'friendly', K = st.eloK[imp] || 20;
    const delta = K * G * (W - E); elo[m.h] = eh + delta; elo[m.a] = ea - delta;
    games[m.h] = (games[m.h] || 0) + 1; games[m.a] = (games[m.a] || 0) + 1;
  }
  const r = {elo, pre, games, get: t => elo[t] != null ? elo[t] : elo0(t)}; CACHE.set(key, r); return r;
}
const E2L = new Map();
function eloToLam(d) {
  d = Math.round(d); const k = d + '|' + S.settings.eloGoals + '|' + S.settings.nationRho; if (E2L.has(k)) return E2L.get(k);
  const E = 1 / (1 + Math.pow(10, -d / 400)), T = S.settings.eloGoals, rho = S.settings.nationRho;
  let lo = -3.5, hi = 3.5;
  for (let it = 0; it < 34; it++) { const s = (lo + hi) / 2; const o = outcome(T / 2 * Math.exp(s), T / 2 * Math.exp(-s), rho, 9); if (o.h + 0.5 * o.d < E) lo = s; else hi = s; }
  const s = (lo + hi) / 2, r = [T / 2 * Math.exp(s), T / 2 * Math.exp(-s), rho]; E2L.set(k, r); return r;
}

// ---------- verwachte doelpunten voor elk duel ----------
function lambdas(sid, cid, h, a, neutral, opt) {
  opt = opt || {};
  if (isNation(cid)) {
    const es = eloState(opt.before); let d = es.get(h) - es.get(a) + (neutral ? 0 : S.settings.eloHome);
    if (!opt.noAdj) d += (adjV(h) - adjV(a)) * 350; if (opt.noise) d += opt.noise * 350;
    return eloToLam(d);
  }
  const f = clubFit(sid, opt.before), rh = f.r(h), ra = f.r(a);
  const ah = opt.noAdj ? 0 : adjV(h), aa = opt.noAdj ? 0 : adjV(a);
  const hf = neutral ? 0 : (f.hfa[cid] != null ? f.hfa[cid] : S.settings.hfaPrior);
  return calibrate(Math.exp(f.mu + hf + rh.a + ah / 2 - ra.d - aa / 2), Math.exp(f.mu + ra.a + aa / 2 - rh.d - ah / 2), f.rho);
}
// Kalibratie (afgestemd met de backtest en vergeleken met slotodds): het krachtsverschil s = ½·ln(λthuis/λuit) wordt
// vergroot met factor 'spread' maar verzadigt boven 'supCap' (tanh), zodat extreme duels niet ontsporen. Het totaal λthuis·λuit blijft gelijk.
function calibrate(lh, la, rho) {
  const g = S.settings.spread || 1, C = S.settings.supCap || 0; if (g === 1 && !C) return [lh, la, rho];
  const s = Math.log(lh / la) / 2, m = Math.log(lh * la) / 2, s2 = C ? C * Math.tanh(g * s / C) : g * s;
  return [Math.exp(m + s2), Math.exp(m - s2), rho];
}
function teamStrength(sid, t) {
  if (S.teams[t] && S.teams[t].kind === 'nation') return eloState().get(t) + adjV(t) * 350;
  const r = clubFit(sid).r(t); return r.a + r.d + adjV(t);
}

// ---------- tabellen ----------
const TB_KEYS = ['pts', 'gd', 'gf', 'w', 'agf', 'aw', 'pl'];
function newTab(n) { const t = {}; TB_KEYS.forEach(k => t[k] = new Float64Array(n)); t.ga = new Float64Array(n); t.d = new Float64Array(n); t.l = new Float64Array(n); return t; }
function copyTab(t) { const o = {}; for (const k in t) o[k] = t[k].slice(); return o; }
function applyRes(t, i, j, x, y) {
  t.pl[i]++; t.pl[j]++; t.gf[i] += x; t.gf[j] += y; t.ga[i] += y; t.ga[j] += x; t.gd[i] += x - y; t.gd[j] += y - x; t.agf[j] += y;
  if (x > y) { t.pts[i] += 3; t.w[i]++; t.l[j]++; } else if (x < y) { t.pts[j] += 3; t.w[j]++; t.aw[j]++; t.l[i]++; } else { t.pts[i]++; t.pts[j]++; t.d[i]++; t.d[j]++; }
}
function rankIdx(idx, t, tb, rnd) {
  return idx.slice().sort((x, y) => { for (const k of tb) { const d = (t[k] ? t[k][y] - t[k][x] : 0); if (d) return d; } return rnd ? rnd[y] - rnd[x] : 0; });
}

// ---------- competitie: voorbereiding + Monte Carlo ----------
function leagueInfo(sid, cid) {
  const key = 'linfo|' + sid + '|' + cid + '|' + VER; if (CACHE.has(key)) return CACHE.get(key);
  const f = S.comps[cid].format, sc = S.seasons[sid].comps[cid] || {teams: []}, teams = sc.teams.slice(), n = teams.length;
  const ix = {}; teams.forEach((t, i) => ix[t] = i);
  const ms = S.matches.filter(m => m.s === sid && m.c === cid && (!m.st || m.st === 'league') && ix[m.h] != null && ix[m.a] != null);
  const perRound = Math.max(1, Math.floor(n / 2)), sorted = ms.slice().sort((x, y) => x.d < y.d ? -1 : x.d > y.d ? 1 : x.id - y.id);
  const rOf = new Map(); let inferred = 0;
  sorted.forEach((m, k) => { if (m.r) rOf.set(m.id, m.r); else { rOf.set(m.id, Math.floor(k / perRound) + 1); inferred++; } });
  const have = new Set(ms.map(m => m.h + '|' + m.a)), gen = [], rr = f.rr || 2;
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    if (i === j) continue; const h = teams[i], a = teams[j];
    if (rr === 2) { if (!have.has(h + '|' + a)) gen.push({h, a}); }
    else if (i < j && !have.has(h + '|' + a) && !have.has(a + '|' + h)) gen.push(Math.random() < 0.5 ? {h, a} : {h: a, a: h});
  }
  let maxR = 0; rOf.forEach(v => maxR = Math.max(maxR, v));
  const rounds = f.rounds || rr * (n - 1);
  gen.sort((x, y) => (x.h + x.a) < (y.h + y.a) ? -1 : 1);
  gen.forEach((g, k) => g.r = Math.min(rounds, maxR + 1 + Math.floor(k * Math.max(1, rounds - maxR) / Math.max(1, gen.length))));
  const today = refDate();
  const info = {cid, f, teams, n, ix, ms, gen, rOf, inferred, playedN: ms.filter(played).length, openKnown: ms.filter(m => !played(m)).length,
    overdue: ms.filter(m => !played(m) && m.d < today).length, expected: rr === 2 ? n * (n - 1) : n * (n - 1) / 2};
  CACHE.set(key, info); return info;
}
function currentTable(sid, cid) {
  const L = leagueInfo(sid, cid); const t = newTab(L.n);
  L.ms.forEach(m => { if (played(m)) applyRes(t, L.ix[m.h], L.ix[m.a], m.hg, m.ag); });
  const idx = [...Array(L.n).keys()]; return {L, t, order: rankIdx(idx, t, L.f.tiebreak || ['pts', 'gd', 'gf'], L.teams.map((_, i) => -i))};
}
function makeLeagueCtx(sid, cid) {
  const L = leagueInfo(sid, cid), f = L.f, n = L.n;
  const base = newTab(n); const P = f.periods || null;
  const pOf = r => { if (!P) return -1; for (let k = 0; k < P.length; k++) if (r >= P[k][0] && r <= P[k][1]) return k; return -1; };
  const pbase = P ? P.map(() => newTab(n)) : [];
  L.ms.forEach(m => { if (!played(m)) return; const i = L.ix[m.h], j = L.ix[m.a]; applyRes(base, i, j, m.hg, m.ag); const p = pOf(L.rOf.get(m.id)); if (p >= 0) applyRes(pbase[p], i, j, m.hg, m.ag); });
  const open = L.ms.filter(m => !played(m)).map(m => ({h: m.h, a: m.a, r: L.rOf.get(m.id), n: m.n})).concat(L.gen);
  const FH = new Int32Array(open.length), FA = new Int32Array(open.length), LH = new Float64Array(open.length), LA = new Float64Array(open.length), FP = new Int32Array(open.length);
  let rho = 0;
  open.forEach((o, k) => { FH[k] = L.ix[o.h]; FA[k] = L.ix[o.a]; const l = lambdas(sid, cid, o.h, o.a, !!o.n); LH[k] = l[0]; LA[k] = l[1]; rho = l[2]; FP[k] = pOf(o.r); });
  const inel = new Set((f.ineligible || []).map(x => L.ix[x]).filter(x => x != null));
  const acc = {pos: new Float64Array(n * n), pts: new Float64Array(n), zones: {}};
  return {sid, cid, L, f, n, base, pbase, FH, FA, LH, LA, FP, rho, inel, acc, order: null, elig: null, idx: [...Array(n).keys()]};
}
function runLeagueOnce(c, sigma) {
  const t = copyTab(c.base), pt = c.pbase.map(copyTab), e = new Float64Array(c.n), rnd = new Float64Array(c.n);
  for (let i = 0; i < c.n; i++) { e[i] = sigma ? gauss() * sigma : 0; rnd[i] = Math.random(); }
  for (let k = 0; k < c.FH.length; k++) {
    const i = c.FH[k], j = c.FA[k], q = Math.exp((e[i] - e[j]) / 2);
    sample2(c.LH[k] * q, c.LA[k] / q, c.rho); applyRes(t, i, j, SX, SY);
    if (c.FP[k] >= 0) applyRes(pt[c.FP[k]], i, j, SX, SY);
  }
  const tb = c.f.tiebreak || ['pts', 'gd', 'gf'];
  c.order = rankIdx(c.idx, t, tb, rnd); c.elig = c.order.filter(i => !c.inel.has(i)); c.tab = t; c.ptab = pt; c.rnd = rnd;
  for (let p = 0; p < c.n; p++) c.acc.pos[c.order[p] * c.n + p]++;
  for (let i = 0; i < c.n; i++) c.acc.pts[i] += t.pts[i];
}
function zoneAdd(c, type, i) { (c.acc.zones[type] = c.acc.zones[type] || new Float64Array(c.n))[i]++; }
function countZones(c) {
  (c.f.zones || []).forEach(z => { const list = z.eligibleOnly ? c.elig : c.order; for (let p = z.from; p <= z.to; p++) if (list[p - 1] != null) zoneAdd(c, z.type, list[p - 1]); });
}
function simTwoLegIds(sid, cid, A, B, aHostsLeg2) {
  // A speelt duel 1 uit (tenzij aHostsLeg2=false) → standaard: B thuis in duel 1, A thuis in duel 2
  const home1 = aHostsLeg2 ? B : A, home2 = aHostsLeg2 ? A : B;
  const l1 = lambdas(sid, cid, home1, home2, false), l2 = lambdas(sid, cid, home2, home1, false);
  const s1 = sampleScore(l1[0], l1[1], l1[2]), s2 = sampleScore(l2[0], l2[1], l2[2]);
  let g1 = s1[0] + s2[1], g2 = s1[1] + s2[0]; // doelpunten home1 / home2
  if (g1 !== g2) return g1 > g2 ? home1 : home2;
  const et = sampleScore(l2[0] / 3, l2[1] / 3, 0);
  if (et[0] !== et[1]) return et[0] > et[1] ? home2 : home1;
  return Math.random() < S.settings.penShareHome ? home2 : home1;
}
function kkdPlayoff(c, ext) {
  const pf = c.f.playoff, teams = c.L.teams, promoted = c.elig.slice(0, (c.f.zones.find(z => z.type === 'promo') || {to: 2}).to);
  const promSet = new Set(promoted), part = [];
  if (c.f.periods) c.ptab.forEach(pt => {
    const pr = rankIdx(c.idx.filter(i => !c.inel.has(i)), pt, ['pts', 'gd', 'gf'], c.rnd);
    const w = pr[0]; if (w != null && !promSet.has(w) && !part.includes(w)) part.push(w);
  });
  for (const i of c.elig) { if (part.length >= pf.kkdSpots) break; if (!promSet.has(i) && !part.includes(i)) part.push(i); }
  const posOf = {}; c.order.forEach((i, p) => posOf[i] = p);
  part.sort((x, y) => posOf[x] - posOf[y]);
  part.forEach(i => zoneAdd(c, 'po', i));
  promoted.forEach(i => zoneAdd(c, 'promotot', i));
  // ladder: seeds (beste eerst), nieuwkomers per ronde vanaf de laagste seeds
  let remaining = part.map(i => ({id: teams[i], seed: posOf[i], kkd: i})), pool = [];
  const ladder = pf.ladder || [4, 2, 0, 1];
  for (let r = 0; r < ladder.length; r++) {
    let k = ladder[r];
    if (r === ladder.length - 1 && pf.external && k > 0) { if (ext) pool.push({id: ext, seed: -1, ext: true}); k = 0; }
    if (k > 0) pool = pool.concat(remaining.splice(remaining.length - k, k));
    pool.sort((x, y) => x.seed - y.seed); if (pool.length < 2) break;
    const next = [];
    while (pool.length >= 2) { const hi = pool.shift(), lo = pool.pop(); const w = simTwoLegIds(c.sid, c.cid, hi.id, lo.id, true); next.push(w === hi.id ? hi : lo); }
    pool = next.concat(pool);
  }
  const winner = pool[0];
  if (winner && !winner.ext) { zoneAdd(c, 'promopo', winner.kkd); zoneAdd(c, 'promotot', winner.kkd); }
  return winner ? !!winner.ext : true; // true = Eredivisie-club handhaaft zich
}
function simLeagueTask(sid, cid) {
  const cids = [cid]; const lk = S.comps[cid].format.link;
  if (lk && S.seasons[sid].comps[lk] && S.seasons[sid].comps[lk].teams.length) cids.push(lk);
  const ctxs = cids.map(x => makeLeagueCtx(sid, x)), sigma = S.settings.simNoise;
  const byId = {}; ctxs.forEach(c => byId[c.cid] = c);
  return {
    runOnce() {
      ctxs.forEach(c => { runLeagueOnce(c, sigma); countZones(c); });
      const kkd = ctxs.find(c => c.f.playoff);
      let extRelegated = null, extId = null, ereCtx = null;
      if (kkd) {
        ereCtx = kkd.f.playoff.external && byId[kkd.f.playoff.external.comp];
        if (ereCtx) extId = ereCtx.L.teams[ereCtx.order[kkd.f.playoff.external.pos - 1]];
        const survived = kkdPlayoff(kkd, extId);
        if (ereCtx && extId) { const ei = ereCtx.L.ix[extId]; if (!survived) zoneAdd(ereCtx, 'relpoloss', ei); extRelegated = !survived ? extId : null; }
      }
      ctxs.forEach(c => {
        const relZ = (c.f.zones || []).filter(z => z.type === 'rel');
        const rel = new Set(); relZ.forEach(z => { for (let p = z.from; p <= z.to; p++) if (c.order[p - 1] != null) rel.add(c.order[p - 1]); });
        if (extRelegated && c === ereCtx) rel.add(c.L.ix[extRelegated]);
        if ((c.f.zones || []).some(z => z.type === 'relpo') || relZ.length) rel.forEach(i => zoneAdd(c, 'reltot', i));
        c._relIds = new Set([...rel].map(i => c.L.teams[i]));
      });
      if (kkd && kkd.f.parents && ereCtx) for (const j in kkd.f.parents) { if (ereCtx._relIds.has(kkd.f.parents[j]) && kkd.L.ix[j] != null) zoneAdd(kkd, 'jongrel', kkd.L.ix[j]); }
    },
    finish(runs) { const out = {}; ctxs.forEach(c => out[c.cid] = summarizeLeague(c, runs)); return out; }
  };
}
function summarizeLeague(c, runs) {
  const rows = c.L.teams.map((t, i) => {
    const pos = []; let ep = 0; for (let p = 0; p < c.n; p++) { const v = c.acc.pos[i * c.n + p] / runs; pos.push(v); ep += v * (p + 1); }
    const z = {}; for (const k in c.acc.zones) z[k] = c.acc.zones[k][i] / runs;
    return {t, pos, expPos: ep, expPts: c.acc.pts[i] / runs, z};
  });
  rows.sort((a, b) => a.expPos - b.expPos);
  return {kind: 'league', rows, zoneTypes: Object.keys(c.acc.zones), runs, n: c.n, gen: c.L.gen.length, inferred: c.L.inferred};
}

// ---------- Europese toernooien ----------
const KO_ROUNDS = ['po', 'r16', 'qf', 'sf', 'f'];
function euroInfo(sid, cid) {
  const key = 'einfo|' + sid + '|' + cid + '|' + VER; if (CACHE.has(key)) return CACHE.get(key);
  const sc = S.seasons[sid].comps[cid] || {teams: []}, teams = sc.teams.slice(), n = teams.length, ix = {}; teams.forEach((t, i) => ix[t] = i);
  const lp = S.matches.filter(m => m.s === sid && m.c === cid && m.st === 'lp' && ix[m.h] != null && ix[m.a] != null);
  const ko = {}; KO_ROUNDS.forEach(r => ko[r] = tiesOf(sid, cid, r));
  const info = {teams, n, ix, lp, ko, f: S.comps[cid].format, overdue: lp.filter(m => !played(m) && m.d < refDate()).length};
  CACHE.set(key, info); return info;
}
function tiesOf(sid, cid, st) {
  const ms = S.matches.filter(m => m.s === sid && m.c === cid && m.st === st).sort((x, y) => x.d < y.d ? -1 : 1);
  const g = {}; ms.forEach(m => { const k = m.tie || [m.h, m.a].sort().join('|'); (g[k] = g[k] || []).push(m); });
  return Object.values(g).map(legs => ({A: legs[0].h, B: legs[0].a, legs}));
}
function playTie(sid, cid, A, B, tie, single, neutral) {
  // A = thuisploeg duel 1. Retourneert winnaar.
  const legs = tie ? tie.legs : [];
  if (single) {
    const m = legs[0];
    let x, y; if (m && played(m)) { x = m.hg; y = m.ag; if (x === y && m.pw) return m.pw; if (m.h !== A) [x, y] = [y, x]; }
    else { const l = lambdas(sid, cid, A, B, neutral); [x, y] = sampleScore(l[0], l[1], l[2]); }
    if (x !== y) return x > y ? A : B;
    const l = lambdas(sid, cid, A, B, neutral), e = sampleScore(l[0] / 3, l[1] / 3, 0);
    if (e[0] !== e[1]) return e[0] > e[1] ? A : B;
    return Math.random() < (neutral ? 0.5 : S.settings.penShareHome) ? A : B;
  }
  let gA = 0, gB = 0; const m1 = legs[0], m2 = legs[1];
  if (m1 && played(m1)) { if (m1.h === A) { gA += m1.hg; gB += m1.ag; } else { gA += m1.ag; gB += m1.hg; } }
  else { const l = lambdas(sid, cid, A, B, false), s = sampleScore(l[0], l[1], l[2]); gA += s[0]; gB += s[1]; }
  if (m2 && played(m2)) { if (m2.h === B) { gB += m2.hg; gA += m2.ag; } else { gA += m2.hg; gB += m2.ag; } if (gA === gB && m2.pw) return m2.pw; if (gA !== gB) return gA > gB ? A : B; }
  else { const l = lambdas(sid, cid, B, A, false), s = sampleScore(l[0], l[1], l[2]); gB += s[0]; gA += s[1]; }
  if (gA !== gB) return gA > gB ? A : B;
  const l = lambdas(sid, cid, B, A, false), e = sampleScore(l[0] / 3, l[1] / 3, 0);
  if (e[0] !== e[1]) return e[0] > e[1] ? B : A;
  return Math.random() < S.settings.penShareHome ? B : A;
}
function simEuroTask(sid, cid) {
  const E = euroInfo(sid, cid), n = E.n, f = E.f, sigma = S.settings.simNoise;
  const base = newTab(n); E.lp.forEach(m => { if (played(m)) applyRes(base, E.ix[m.h], E.ix[m.a], m.hg, m.ag); });
  const open = E.lp.filter(m => !played(m));
  const FH = open.map(m => E.ix[m.h]), FA = open.map(m => E.ix[m.a]), LL = open.map(m => lambdas(sid, cid, m.h, m.a, !!m.n));
  const idx = [...Array(n).keys()], tb = ['pts', 'gd', 'gf', 'agf', 'w', 'aw'];
  const acc = {pos: new Float64Array(n * n), pts: new Float64Array(n), reach: {}, node: {}};
  const reach = (k, t) => { (acc.reach[k] = acc.reach[k] || {})[t] = (acc.reach[k][t] || 0) + 1; };
  const node = (k, t) => { (acc.node[k] = acc.node[k] || {})[t] = (acc.node[k][t] || 0) + 1; };
  const D = f.direct || 8, PT = f.playoffTo || 24;
  const known = r => E.ko[r] && E.ko[r].length ? E.ko[r] : null;
  return {
    runOnce() {
      const t = copyTab(base), e = new Float64Array(n), rnd = new Float64Array(n);
      for (let i = 0; i < n; i++) { e[i] = gauss() * sigma; rnd[i] = Math.random(); }
      for (let k = 0; k < FH.length; k++) { const i = FH[k], j = FA[k], q = Math.exp((e[i] - e[j]) / 2); const s = sampleScore(LL[k][0] * q, LL[k][1] / q, LL[k][2]); applyRes(t, i, j, s[0], s[1]); }
      const order = rankIdx(idx, t, tb, rnd); const ids = order.map(i => E.teams[i]); const rank = {}; ids.forEach((id, p) => rank[id] = p + 1);
      for (let p = 0; p < n; p++) acc.pos[order[p] * n + p]++;
      for (let i = 0; i < n; i++) acc.pts[i] += t.pts[i];
      ids.slice(0, D).forEach(x => { reach('top8', x); reach('r16', x); });
      ids.slice(D, PT).forEach(x => reach('po', x));
      // play-offs: seeds (D+1..D+8) vs (PT-7..PT) in paren
      const poWinners = []; const kPO = known('po');
      const pairs = []; // [seeded, unseeded, group]
      if (kPO && kPO.length === (PT - D) / 2) kPO.forEach(tie => { const s = rank[tie.A] < rank[tie.B] ? tie.A : tie.B; pairs.push({A: tie.A, B: tie.B, tie, g: Math.floor((Math.min(rank[tie.A], rank[tie.B]) - D - 1) / 2), s}); });
      else for (let g = 0; g < (PT - D) / 4; g++) {
        const se = shuffle([ids[D + 2 * g], ids[D + 2 * g + 1]]), un = shuffle([ids[PT - 2 - 2 * g], ids[PT - 1 - 2 * g]]);
        for (let q = 0; q < 2; q++) if (se[q] && un[q]) pairs.push({A: un[q], B: se[q], g, s: se[q]});
      }
      pairs.forEach(p => { const w = playTie(sid, cid, p.A, p.B, p.tie, false, false); poWinners.push({w, g: p.g}); reach('r16', w); });
      // 1/8 finale: seed k (1..8) tegen winnaar van groep die bij k hoort
      const slot = {}; const kR16 = known('r16');
      if (kR16 && kR16.length === D) kR16.forEach(tie => { const k = Math.min(rank[tie.A] || 99, rank[tie.B] || 99); slot[k] = tie; });
      else {
        const nG = (PT - D) / 4;
        for (let g = 0; g < nG; g++) {
          const seeds = [2 * (nG - 1 - g) + 1, 2 * (nG - 1 - g) + 2]; // groep 0 (9/10) ↔ seeds 7/8
          const ws = shuffle(poWinners.filter(x => x.g === g).map(x => x.w));
          seeds.forEach((k, q) => { if (ids[k - 1] && ws[q]) slot[k] = {A: ws[q], B: ids[k - 1], legs: []}; });
        }
      }
      const r16w = {};
      for (const k in slot) { const tie = slot[k], A = tie.legs.length ? tie.A : tie.A, B = tie.B; const w = playTie(sid, cid, A, B, tie.legs.length ? tie : null, false, false); r16w[k] = w; node('r16-' + k, w); reach('qf', w); }
      const QF = [[1, 8], [4, 5], [2, 7], [3, 6]], qfw = [];
      const kQF = known('qf');
      QF.forEach((pq, q) => {
        const a = r16w[pq[0]], b = r16w[pq[1]]; if (!a || !b) return;
        const kt = kQF && kQF.find(x => (x.A === a && x.B === b) || (x.A === b && x.B === a));
        const hi = rank[a] < rank[b] ? a : b, lo = hi === a ? b : a;
        const w = kt ? playTie(sid, cid, kt.A, kt.B, kt, false, false) : playTie(sid, cid, lo, hi, null, false, false);
        qfw[q] = w; node('qf-' + (q + 1), w); reach('sf', w);
      });
      const sfw = [];
      [[0, 1], [2, 3]].forEach((ps, k) => {
        const a = qfw[ps[0]], b = qfw[ps[1]]; if (!a || !b) return;
        const hi = rank[a] < rank[b] ? a : b, lo = hi === a ? b : a;
        const w = playTie(sid, cid, lo, hi, null, false, false); sfw[k] = w; node('sf-' + (k + 1), w); reach('f', w);
      });
      if (sfw[0] && sfw[1]) {
        const kF = known('f'); const tie = kF && kF[0];
        const w = tie ? playTie(sid, cid, tie.A, tie.B, tie, true, true) : playTie(sid, cid, sfw[0], sfw[1], null, true, true);
        node('f', w); reach('w', w);
      }
    },
    finish(runs) {
      const rows = E.teams.map((t, i) => {
        let ep = 0; const pos = []; for (let p = 0; p < n; p++) { const v = acc.pos[i * n + p] / runs; pos.push(v); ep += v * (p + 1); }
        const r = {}; for (const k in acc.reach) r[k] = (acc.reach[k][t] || 0) / runs;
        return {t, pos, expPos: ep, expPts: acc.pts[i] / runs, reach: r};
      }).sort((a, b) => a.expPos - b.expPos);
      const nodes = {}; for (const k in acc.node) nodes[k] = Object.entries(acc.node[k]).map(([t, c]) => [t, c / runs]).sort((a, b) => b[1] - a[1]);
      return {[cid]: {kind: 'euro', rows, nodes, runs, n, reachKeys: ['top8', 'po', 'r16', 'qf', 'sf', 'f', 'w']}};
    }
  };
}

// ---------- nationale teams: groepen, Nations League, eindtoernooien ----------
function groupInfo(sid, cid) {
  const key = 'ginfo|' + sid + '|' + cid + '|' + VER; if (CACHE.has(key)) return CACHE.get(key);
  const f = S.comps[cid].format, sc = S.seasons[sid].comps[cid] || {teams: [], groups: {}}, groups = sc.groups || {};
  const host = new Set(f.host || []), G = {};
  for (const g in groups) {
    const teams = groups[g], ix = {}; teams.forEach((t, i) => ix[t] = i);
    const ms = S.matches.filter(m => m.s === sid && m.c === cid && m.g === g && (m.st || 'group') === 'group');
    const have = new Set(ms.map(m => m.h + '|' + m.a)), gen = [], rr = f.groupRR || f.rr || 1;
    for (let i = 0; i < teams.length; i++) for (let j = 0; j < teams.length; j++) {
      if (i === j) continue; const h = teams[i], a = teams[j];
      if (rr === 2) { if (!have.has(h + '|' + a)) gen.push({h, a, n: false}); }
      else if (i < j && !have.has(h + '|' + a) && !have.has(a + '|' + h)) { const hh = host.has(a) ? a : h, aa = hh === h ? a : h; gen.push({h: hh, a: aa, n: f.kind === 'tournament' && !host.has(hh)}); }
    }
    G[g] = {teams, ix, ms, gen};
  }
  const info = {f, G, groups, host}; CACHE.set(key, info); return info;
}
function bracketOrder(N) { let o = [1]; while (o.length < N) { const m = o.length * 2 + 1; o = o.flatMap(x => [x, m - x]); } return o; }
function simGroupsTask(sid, cid) {
  const I = groupInfo(sid, cid), f = I.f, sigma = S.settings.simNoise, tb = f.tiebreak || ['pts', 'gd', 'gf'];
  const gctx = {};
  for (const g in I.G) {
    const X = I.G[g], n = X.teams.length, base = newTab(n);
    X.ms.forEach(m => { if (played(m)) applyRes(base, X.ix[m.h], X.ix[m.a], m.hg, m.ag); });
    const open = X.ms.filter(m => !played(m)).map(m => ({h: m.h, a: m.a, n: !!m.n})).concat(X.gen);
    gctx[g] = {X, n, base, FH: open.map(o => X.ix[o.h]), FA: open.map(o => X.ix[o.a]), LL: open.map(o => lambdas(sid, cid, o.h, o.a, o.n)), idx: [...Array(n).keys()],
      pos: new Float64Array(n * n), pts: new Float64Array(n)};
  }
  const reach = {}, nodeAcc = {}, zones = {};
  const add = (o, k, t) => { (o[k] = o[k] || {})[t] = (o[k][t] || 0) + 1; };
  const neutralKO = f.kind === 'tournament';
  const isHost = t => I.host.has(t);
  function koMatch(A, B, round) { // enkel duel; gastland speelt thuis
    let h = A, a = B, neutral = neutralKO;
    if (isHost(B) && !isHost(A)) { h = B; a = A; }
    if (isHost(h)) neutral = false;
    return playTie(sid, cid, h, a, null, true, neutral);
  }
  return {
    runOnce() {
      const res = {};
      for (const g in gctx) {
        const c = gctx[g], t = copyTab(c.base), rnd = new Float64Array(c.n), e = new Float64Array(c.n);
        for (let i = 0; i < c.n; i++) { rnd[i] = Math.random(); e[i] = gauss() * sigma; }
        for (let k = 0; k < c.FH.length; k++) { const i = c.FH[k], j = c.FA[k], q = Math.exp((e[i] - e[j]) / 2); const s = sampleScore(c.LL[k][0] * q, c.LL[k][1] / q, c.LL[k][2]); applyRes(t, i, j, s[0], s[1]); }
        const order = rankIdx(c.idx, t, tb, rnd); for (let p = 0; p < c.n; p++) c.pos[order[p] * c.n + p]++;
        for (let i = 0; i < c.n; i++) c.pts[i] += t.pts[i];
        res[g] = {ids: order.map(i => c.X.teams[i]), t, order, rnd};
      }
      if (f.nl) {
        const fourthC = [];
        for (const g in res) {
          const L = g[0], ids = res[g].ids;
          if (L === 'A') { add(zones, 'kf', ids[0]); add(zones, 'kf', ids[1]); if (ids[2]) add(zones, 'relpo', ids[2]); if (ids[3]) add(zones, 'rel', ids[3]); }
          else if (L === 'B') { add(zones, 'promo', ids[0]); add(zones, 'po', ids[1]); if (ids[2]) add(zones, 'relpo', ids[2]); if (ids[3]) add(zones, 'rel', ids[3]); }
          else if (L === 'C') { add(zones, 'promo', ids[0]); add(zones, 'po', ids[1]); if (ids[3]) { const r = res[g], i = r.order[3]; fourthC.push({id: ids[3], pts: r.t.pts[i], gd: r.t.gd[i], gf: r.t.gf[i], rnd: r.rnd[i]}); } }
          else if (L === 'D') { add(zones, 'promo', ids[0]); if (ids[1]) add(zones, 'po', ids[1]); }
        }
        fourthC.sort((a, b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf || b.rnd - a.rnd);
        fourthC.forEach((x, k) => add(zones, k < 2 ? 'relpo' : 'rel', x.id));
        const AG = Object.keys(res).filter(g => g[0] === 'A');
        if (AG.length === 4) {
          const W = AG.map(g => ({id: res[g].ids[0], g})), R = AG.map(g => ({id: res[g].ids[1], g}));
          let rr = shuffle(R.slice()); for (let k = 0; k < 60 && rr.some((x, q) => x.g === W[q].g); k++) shuffle(rr);
          const qf = W.map((w, q) => { const win = playTie(sid, cid, rr[q].id, w.id, null, false, false); add(nodeAcc, 'qf-' + (q + 1), win); add(reach, 'sf', win); return win; });
          W.forEach(w => add(reach, 'qf', w.id)); R.forEach(r => add(reach, 'qf', r.id));
          const sfp = shuffle(qf.slice()); const sw = [];
          for (let k = 0; k < 2; k++) { const w = playTie(sid, cid, sfp[2 * k], sfp[2 * k + 1], null, true, true); sw.push(w); add(nodeAcc, 'sf-' + (k + 1), w); add(reach, 'f', w); }
          const champ = playTie(sid, cid, sw[0], sw[1], null, true, true); add(nodeAcc, 'f', champ); add(reach, 'w', champ);
        }
      } else if (f.kind === 'tournament') {
        const q = [], thirds = [];
        for (const g in res) {
          const r = res[g];
          r.ids.forEach((id, p) => {
            const i = r.order[p], rec = {id, g, p, pts: r.t.pts[i], gd: r.t.gd[i], gf: r.t.gf[i], rnd: r.rnd[i]};
            if (p < (f.perGroup || 2)) q.push(rec); else if (p === (f.perGroup || 2)) thirds.push(rec);
          });
        }
        thirds.sort((a, b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf || b.rnd - a.rnd);
        const Q = q.concat(thirds.slice(0, f.bestThirds || 0));
        let N = 1; while (N * 2 <= Q.length) N *= 2;
        Q.sort((a, b) => a.p - b.p || b.pts - a.pts || b.gd - a.gd || b.gf - a.gf || b.rnd - a.rnd);
        const seeds = Q.slice(0, N); seeds.forEach(s => add(reach, 'ko', s.id));
        const ord = bracketOrder(N).map(k => seeds[k - 1]);
        for (let k = 0; k < ord.length; k += 2) if (ord[k].g === ord[k + 1].g && k + 3 < ord.length) { const tmp = ord[k + 1]; ord[k + 1] = ord[k + 3]; ord[k + 3] = tmp; }
        let cur = ord.map(s => s.id), r = 0;
        while (cur.length > 1) {
          const nxt = []; for (let k = 0; k < cur.length; k += 2) { const w = koMatch(cur[k], cur[k + 1]); nxt.push(w); add(nodeAcc, 'k' + r + '-' + (k / 2 + 1), w); }
          r++; cur = nxt; nxt.forEach(w => add(reach, 'r' + r, w));
        }
        if (cur[0]) add(reach, 'w', cur[0]);
      } else if (f.groupZones) {
        for (const g in res) f.groupZones.forEach(z => { const id = res[g].ids[z.pos - 1]; if (id) add(zones, z.type, id); });
      }
    },
    finish(runs) {
      const groups = {};
      for (const g in gctx) {
        const c = gctx[g];
        groups[g] = c.X.teams.map((t, i) => { const pos = []; let ep = 0; for (let p = 0; p < c.n; p++) { const v = c.pos[i * c.n + p] / runs; pos.push(v); ep += v * (p + 1); } return {t, pos, expPos: ep, expPts: c.pts[i] / runs}; }).sort((a, b) => a.expPos - b.expPos);
      }
      const norm = o => { const r = {}; for (const k in o) { r[k] = {}; for (const t in o[k]) r[k][t] = o[k][t] / runs; } return r; };
      const nodes = {}; for (const k in nodeAcc) nodes[k] = Object.entries(nodeAcc[k]).map(([t, c]) => [t, c / runs]).sort((a, b) => b[1] - a[1]);
      return {[cid]: {kind: 'groups', groups, zones: norm(zones), reach: norm(reach), nodes, runs}};
    }
  };
}

// ---------- Monte Carlo-uitvoering in blokken ----------
function runSim(sid, cid, onProg, onDone) {
  const c = S.comps[cid], runs = Math.max(10000, +S.settings.mcRuns || 10000);
  let task;
  try { task = c.type === 'league' ? simLeagueTask(sid, cid) : c.type === 'euro' ? simEuroTask(sid, cid) : simGroupsTask(sid, cid); }
  catch (e) { onDone(null, e); return; }
  const ver = VER; let i = 0;
  (function tick() {
    const t0 = performance.now();
    try { while (i < runs && performance.now() - t0 < 40) { task.runOnce(); i++; } } catch (e) { onDone(null, e); return; }
    onProg(i / runs);
    if (i < runs) setTimeout(tick, 0);
    else { const out = task.finish(runs); for (const k in out) SIMS[sid + '|' + k] = {ver, at: new Date(), res: out[k]}; onDone(out); }
  })();
}

// ---------- backtest ----------
function outcomeIdx(m) { return m.hg > m.ag ? 0 : m.hg === m.ag ? 1 : 2; }
function weekStart(d) { const t = new Date(d + 'T12:00:00Z'); const wd = (t.getUTCDay() + 6) % 7; t.setUTCDate(t.getUTCDate() - wd); return t.toISOString().slice(0, 10); }
function backtest(sid, cid) {
  const key = 'bt|' + sid + '|' + cid + '|' + VER; if (CACHE.has(key)) return CACHE.get(key);
  const ms = S.matches.filter(m => m.s === sid && m.c === cid && played(m)).sort((x, y) => x.d < y.d ? -1 : 1);
  const preds = []; const es = isNation(cid) ? eloState() : null;
  let cnt = [10 * 0.45, 10 * 0.27, 10 * 0.28];
  for (const m of ms) {
    let l;
    if (es) { const p = es.pre[m.id]; l = p ? eloToLam(p[2]) : lambdas(sid, cid, m.h, m.a, !!m.n, {noAdj: true}); }
    else l = lambdas(sid, cid, m.h, m.a, !!m.n, {before: weekStart(m.d), noAdj: true});
    const o = outcome(l[0], l[1], l[2], 8), p = [o.h, o.d, o.a];
    const tot = cnt[0] + cnt[1] + cnt[2], nv = cnt.map(x => x / tot);
    let mk = null; if (m.o && m.o.h > 1 && m.o.d > 1 && m.o.a > 1) { const inv = [1 / m.o.h, 1 / m.o.d, 1 / m.o.a], s = inv[0] + inv[1] + inv[2]; mk = inv.map(x => x / s); }
    const y = outcomeIdx(m); preds.push({m, p, nv, mk, y}); cnt[y]++;
  }
  const score = key => {
    let br = 0, ll = 0, acc = 0, n = 0;
    preds.forEach(r => { const p = r[key]; if (!p) return; n++; for (let k = 0; k < 3; k++) br += (p[k] - (r.y === k ? 1 : 0)) ** 2; ll -= Math.log(Math.max(1e-9, p[r.y])); const am = p.indexOf(Math.max(...p)); if (am === r.y) acc++; });
    return n ? {n, brier: br / n, logloss: ll / n, acc: acc / n} : null;
  };
  const bins = Array.from({length: 10}, () => ({p: 0, o: 0, n: 0}));
  preds.forEach(r => r.p.forEach((p, k) => { const b = Math.min(9, Math.floor(p * 10)); bins[b].p += p; bins[b].o += r.y === k ? 1 : 0; bins[b].n++; }));
  const res = {n: preds.length, model: score('p'), naive: score('nv'), market: score('mk'), bins, preds};
  CACHE.set(key, res); return res;
}

// ---------- import ----------
function parseCSV(txt) {
  txt = txt.replace(/^﻿/, ''); const first = txt.split(/\r?\n/)[0] || '';
  const delim = (first.match(/;/g) || []).length > (first.match(/,/g) || []).length ? ';' : (first.includes('\t') ? '\t' : ',');
  const rows = []; let row = [], cur = '', q = false;
  for (let i = 0; i < txt.length; i++) {
    const ch = txt[i];
    if (q) { if (ch === '"') { if (txt[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += ch; }
    else if (ch === '"') q = true;
    else if (ch === delim) { row.push(cur); cur = ''; }
    else if (ch === '\n' || ch === '\r') { if (ch === '\r' && txt[i + 1] === '\n') i++; row.push(cur); rows.push(row); row = []; cur = ''; }
    else cur += ch;
  }
  if (cur !== '' || row.length) { row.push(cur); rows.push(row); }
  return rows.filter(r => r.some(x => String(x).trim() !== ''));
}
const FD_DIV = {E0: 'ENG1', I1: 'ITA1', SP1: 'ESP1', D1: 'GER1', F1: 'FRA1', P1: 'POR1', B1: 'BEL1', N1: 'NED1', T1: 'TUR1'};
function normDate(s) {
  s = String(s || '').trim(); let m;
  if ((m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/))) return m[1] + '-' + m[2].padStart(2, '0') + '-' + m[3].padStart(2, '0');
  if ((m = s.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})/))) { let y = m[3]; if (y.length === 2) y = (+y > 70 ? '19' : '20') + y; return y + '-' + m[2].padStart(2, '0') + '-' + m[1].padStart(2, '0'); }
  return null;
}
function seasonForDate(d) { for (const id in S.seasons) { const s = S.seasons[id]; if (d >= s.start && d <= s.end) return id; } return null; }
// rijen: objecten met sleutels zoals in het CSV-voorbeeld. Retourneert rapport.
function importRows(rows, opt) {
  opt = opt || {}; const rep = {added: 0, updated: 0, newTeams: [], errors: [], skipped: 0};
  rows.forEach((r, k) => {
    const cid = r.competitie || r.competition || r.comp || opt.comp;
    if (!cid || !S.comps[cid]) { rep.errors.push('Rij ' + (k + 2) + ': onbekende competitie "' + (cid || '') + '"'); return; }
    const d = normDate(r.datum || r.date); if (!d) { rep.errors.push('Rij ' + (k + 2) + ': ongeldige datum'); return; }
    const sid = r.seizoen || r.season || seasonForDate(d) || opt.season || S.active;
    if (!S.seasons[sid]) { rep.errors.push('Rij ' + (k + 2) + ': seizoen ' + sid + ' bestaat niet (maak het eerst aan)'); return; }
    const kind = isNation(cid) ? 'nation' : 'club', sc = S.seasons[sid].comps[cid] = S.seasons[sid].comps[cid] || {teams: [], groups: {}};
    const hn = r.thuis || r.home, an = r.uit || r.away; if (!hn || !an) { rep.errors.push('Rij ' + (k + 2) + ': thuis/uit ontbreekt'); return; }
    const before = Object.keys(S.teams).length;
    const scope = sc.teams;
    const h = ensureTeam(hn, kind, S.comps[cid].cc, scope), a = ensureTeam(an, kind, S.comps[cid].cc, scope);
    if (Object.keys(S.teams).length > before) { [h, a].forEach(x => { if (!rep.newTeams.includes(tName(x))) rep.newTeams.push(tName(x)); }); }
    [h, a].forEach(x => { if (!sc.teams.includes(x)) sc.teams.push(x); });
    const g = r.groep || r.group || ''; if (g) { sc.groups = sc.groups || {}; const G = sc.groups[g] = sc.groups[g] || []; [h, a].forEach(x => { if (!G.includes(x)) G.push(x); }); }
    const num = v => v === '' || v == null ? null : (isFinite(+String(v).replace(',', '.')) ? +String(v).replace(',', '.') : null);
    const hg = num(r.thuisgoals != null ? r.thuisgoals : r.home_goals), ag = num(r.uitgoals != null ? r.uitgoals : r.away_goals);
    const o = {h: num(r.odds_1), d: num(r.odds_x), a: num(r.odds_2)};
    const xh = num(r.xg_thuis), xa = num(r.xg_uit), xgv = xh != null && xa != null && hg != null ? [xh, xa] : null;
    const st = r.fase || r.stage || (S.comps[cid].type === 'euro' ? 'lp' : S.comps[cid].type === 'nation' && g ? 'group' : 'league');
    const src = r.bron || 'import';
    const pwn = r.winnaar_na_strafschoppen || r.pens_winner; const pw = pwn ? ensureTeam(pwn, kind, S.comps[cid].cc, scope) : null;
    const neutral = ['1', 'ja', 'true', 'j', 'yes'].includes(String(r.neutraal || r.neutral || '').toLowerCase());
    const pairUnique = S.comps[cid].type === 'league' && st === 'league' && (S.comps[cid].format.rr || 2) === 2;
    const ex = S.matches.find(m => m.s === sid && m.c === cid && m.h === h && m.a === a && (m.d === d || (pairUnique && (m.st || 'league') === 'league') || (!played(m) && Math.abs(daysBetween(m.d, d)) <= 4 && (st === 'league' || st === 'lp' || st === 'group'))));
    if (ex) {
      if (ex.src === 'handmatig' && opt.quiet && !(hg != null && ag != null)) { rep.skipped++; return; }
      ex.d = d; if (hg != null && ag != null) { ex.hg = hg; ex.ag = ag; }
      if (r.ronde || r.round) ex.r = +(r.ronde || r.round); if (r.tijd || r.time) ex.t = r.tijd || r.time; if (xgv) ex.xg = xgv; if (o.h) ex.o = o; if (pw) ex.pw = pw; if (neutral) ex.n = true; ex.src = src; rep.updated++;
    } else {
      addMatch({s: sid, c: cid, d, r: r.ronde || r.round, h, a, hg, ag, n: neutral || null, st, g: g || null, tie: r.tie || null, leg: r.leg || null, pw, o: o.h ? o : null, imp: r.belang || r.importance || null, src, t: r.tijd || r.time || null, xg: xgv});
      rep.added++;
    }
  });
  bump(); return rep;
}
function csvToObjects(rows) {
  const head = rows[0].map(h => String(h).trim());
  if (head.includes('Div') && head.includes('HomeTeam') && head.includes('FTHG')) {
    const ix = k => head.indexOf(k); const out = [];
    rows.slice(1).forEach(r => {
      const cid = FD_DIV[r[ix('Div')]]; if (!cid) return;
      const pick = ks => { for (const k of ks) { const i = ix(k); if (i >= 0 && r[i]) return r[i]; } return ''; };
      out.push({competitie: cid, datum: r[ix('Date')], thuis: r[ix('HomeTeam')], uit: r[ix('AwayTeam')], thuisgoals: r[ix('FTHG')], uitgoals: r[ix('FTAG')],
        odds_1: pick(['PSCH', 'PSH', 'AvgH', 'B365H']), odds_x: pick(['PSCD', 'PSD', 'AvgD', 'B365D']), odds_2: pick(['PSCA', 'PSA', 'AvgA', 'B365A'])});
    });
    return {rows: out, format: 'football-data.co.uk'};
  }
  const keys = head.map(h => h.toLowerCase());
  return {rows: rows.slice(1).map(r => { const o = {}; keys.forEach((k, i) => o[k] = r[i] != null ? String(r[i]).trim() : ''); return o; }), format: 'CSV (eigen formaat)'};
}
const FD_COMP = {PL: 'ENG1', BL1: 'GER1', PD: 'ESP1', SA: 'ITA1', FL1: 'FRA1', DED: 'NED1', PPL: 'POR1', CL: 'UCL', EC: 'EURO', WC: 'WC'};
const FD_STAGE = {REGULAR_SEASON: 'league', LEAGUE_STAGE: 'lp', GROUP_STAGE: 'group', PLAYOFFS: 'po', LAST_16: 'r16', QUARTER_FINALS: 'qf', SEMI_FINALS: 'sf', FINAL: 'f'};
// football-data.org v4: één /matches-antwoord, een lijst daarvan, of {fd:[...]} (zoals het meegeleverde script schrijft)
function isFootballData(o) { const one = x => x && Array.isArray(x.matches) && x.matches.length && x.matches[0].homeTeam && x.matches[0].score; return one(o) || (Array.isArray(o) && o.some(one)) || (o && Array.isArray(o.fd) && o.fd.some(one)); }
function importFootballData(o) {
  const resp = Array.isArray(o) ? o : o.fd ? o.fd : [o]; const rows = [], skipped = new Set();
  resp.forEach(r => (r.matches || []).forEach(m => {
    const code = (m.competition && m.competition.code) || (r.competition && r.competition.code); const cid = FD_COMP[code];
    if (!cid || !S.comps[cid]) { skipped.add(code); return; }
    const d = (m.utcDate || '').slice(0, 10); const sid = seasonForDate(d) || S.active; if (!S.seasons[sid]) return;
    const kind = isNation(cid) ? 'nation' : 'club', scope = (S.seasons[sid].comps[cid] || {teams: []}).teams;
    const nm = t => { if (!t) return null; const id = findTeam(t.name, kind, scope) || findTeam(t.shortName, kind, scope) || findTeam(t.name, kind) || findTeam(t.shortName, kind); return id ? tName(id) : (t.name || t.shortName); };
    const h = nm(m.homeTeam), a = nm(m.awayTeam); if (!h || !a) return;
    const sc = m.score || {}; let hg = null, ag = null, pw = '';
    if (m.status === 'FINISHED' || m.status === 'AWARDED') {
      if (sc.duration === 'PENALTY_SHOOTOUT' && sc.regularTime) { hg = (sc.regularTime.home || 0) + ((sc.extraTime || {}).home || 0); ag = (sc.regularTime.away || 0) + ((sc.extraTime || {}).away || 0); pw = sc.winner === 'HOME_TEAM' ? h : sc.winner === 'AWAY_TEAM' ? a : ''; }
      else if (sc.fullTime) { hg = sc.fullTime.home; ag = sc.fullTime.away; }
    }
    const st = FD_STAGE[m.stage] || (S.comps[cid].type === 'euro' ? 'lp' : 'league');
    const g = m.group ? String(m.group).replace(/^GROUP_/, '') : '';
    rows.push({seizoen: sid, competitie: cid, datum: d, ronde: m.matchday || '', thuis: h, uit: a, thuisgoals: hg, uitgoals: ag, fase: st, groep: st === 'group' ? g : '', winnaar_na_strafschoppen: pw, neutraal: st === 'f' && S.comps[cid].type !== 'league' ? 'ja' : '', bron: 'football-data.org'});
  }));
  const rep = importRows(rows); rep.format = 'football-data.org'; if (skipped.size) rep.errors.push('Overgeslagen competities (niet in de tool): ' + [...skipped].join(', ')); return rep;
}
function importJSON(o) {
  if (o && o.v === 1 && o.teams && o.matches && o.seasons) return {backup: true};
  if (isFootballData(o)) return importFootballData(o);
  const rep = {added: 0, updated: 0, newTeams: [], errors: [], teamsSet: 0};
  const sid = o.seizoen || o.season || S.active, cid = o.competitie || o.competition;
  if (cid && !S.comps[cid] && o.format) S.comps[cid] = {id: cid, name: o.naam || cid, short: cid, type: o.type || 'league', cc: o.land || '', tier: o.niveau || 1, format: o.format, notes: []};
  if (cid && S.comps[cid] && (o.teams || o.groepen || o.groups)) {
    if (!S.seasons[sid]) rep.errors.push('Seizoen ' + sid + ' bestaat niet');
    else {
      const kind = isNation(cid) ? 'nation' : 'club', sc = S.seasons[sid].comps[cid] = S.seasons[sid].comps[cid] || {teams: [], groups: {}};
      if (o.teams) { sc.teams = o.teams.map(n => ensureTeam(n, kind, S.comps[cid].cc)); rep.teamsSet = sc.teams.length; }
      const gr = o.groepen || o.groups; if (gr) { sc.groups = {}; for (const g in gr) sc.groups[g] = gr[g].map(n => ensureTeam(n, kind, S.comps[cid].cc)); sc.teams = [...new Set(Object.values(sc.groups).flat().concat(sc.teams))]; rep.teamsSet = sc.teams.length; }
      if (o.gastland || o.host) S.comps[cid].format.host = (o.gastland || o.host).map(n => ensureTeam(n, kind));
      if (o.format) S.comps[cid].format = Object.assign(S.comps[cid].format, o.format);
      sc.teams.forEach(t => { if (kind === 'club' && !S.seasons[sid].prior[t]) S.seasons[sid].prior[t] = priorOf(sid, t); });
    }
  }
  const ms = o.wedstrijden || o.matches;
  if (ms) { const r = importRows(ms.map(x => Object.assign({competitie: cid, seizoen: o.seizoen || o.season}, x))); Object.assign(rep, {added: r.added, updated: r.updated, newTeams: r.newTeams, errors: rep.errors.concat(r.errors)}); }
  bump(); return rep;
}

// ---------- seizoenen ----------
function finalTable(sid, cid) {
  const c = S.comps[cid];
  if (c.type === 'league') { const ct = currentTable(sid, cid); return ct.order.map(i => ({t: ct.L.teams[i], pts: ct.t.pts[i], gd: ct.t.gd[i], gf: ct.t.gf[i], pl: ct.t.pl[i]})); }
  return null;
}
function closeSeason(sid) {
  const s = S.seasons[sid], arch = {closedAt: todayStr(), comps: {}};
  for (const cid in s.comps) {
    if (!S.comps[cid]) continue;
    const bt = backtest(sid, cid);
    arch.comps[cid] = {table: finalTable(sid, cid), bt: {n: bt.n, model: bt.model, naive: bt.naive, market: bt.market}};
    const sim = SIMS[sid + '|' + cid]; if (sim && sim.res.kind !== 'league') arch.comps[cid].sim = sim.res.kind === 'euro' ? {w: sim.res.rows.map(r => [r.t, r.reach.w || 0]).sort((a, b) => b[1] - a[1]).slice(0, 8)} : null;
  }
  const fit = clubFit(sid); arch.ratings = fit.T.map(t => [t, +(fit.r(t).a + fit.r(t).d).toFixed(3)]).sort((a, b) => b[1] - a[1]).slice(0, 60);
  s.archive = arch; s.status = 'afgesloten'; bump();
}
// voorstel teamlijsten nieuw seizoen (promotie/degradatie op basis van eindstand of meest waarschijnlijke simulatie)
function proposeLists(sid) {
  const out = {}, s = S.seasons[sid];
  const finalOrder = cid => {
    const L = leagueInfo(sid, cid); const complete = L.playedN >= L.expected;
    const sim = SIMS[sid + '|' + cid];
    if (complete || !sim) return {ids: currentTable(sid, cid).order.map(i => L.teams[i]), src: complete ? 'eindstand' : 'huidige stand'};
    return {ids: sim.res.rows.map(r => r.t), src: 'verwachte eindstand (simulatie)'};
  };
  for (const cid in s.comps) { const c = S.comps[cid]; if (!c || c.type !== 'league') continue; out[cid] = {teams: s.comps[cid].teams.slice(), notes: []}; }
  for (const cid in out) {
    const c = S.comps[cid]; const fo = finalOrder(cid);
    const relZ = (c.format.zones || []).filter(z => z.type === 'rel');
    const rel = []; relZ.forEach(z => { for (let p = z.from; p <= z.to; p++) if (fo.ids[p - 1]) rel.push(fo.ids[p - 1]); });
    if (rel.length) { out[cid].teams = out[cid].teams.filter(t => !rel.includes(t)); out[cid].notes.push('Degradeert (' + fo.src + '): ' + rel.map(tName).join(', ')); }
    const lower = Object.keys(out).find(k => S.comps[k].parent === cid);
    if (lower) {
      const lo = finalOrder(lower), lf = S.comps[lower].format, inel = new Set(lf.ineligible || []);
      const elig = lo.ids.filter(t => !inel.has(t)); const direct = elig.slice(0, 2);
      out[cid].teams.push(...direct); out[cid].notes.push('Promoveert direct uit ' + S.comps[lower].name + ': ' + direct.map(tName).join(', '));
      out[lower].teams = out[lower].teams.filter(t => !direct.includes(t)).concat(rel);
      const par = lf.parents || {}; const jr = Object.keys(par).filter(j => rel.includes(par[j]) && out[lower].teams.includes(j));
      if (jr.length) { out[lower].teams = out[lower].teams.filter(t => !jr.includes(t)); out[lower].notes.push('Jong-team degradeert omdat het eerste elftal degradeert (art. 10): ' + jr.map(tName).join(', ')); }
      const po = fo.ids[15]; if (po && (c.format.zones || []).some(z => z.type === 'relpo')) out[cid].notes.push('Let op: uitkomst play-off promotie/degradatie (' + tName(po) + ' vs. KKD) handmatig verwerken.');
    } else if (rel.length) out[cid].notes.push('Vul de ' + rel.length + ' gepromoveerde club(s) handmatig aan.');
  }
  return out;
}
function createSeason(id, start, end, lists) {
  const prev = S.active, st = S.settings, r = st.regress, fit = clubFit(prev);
  const season = {id, status: 'actief', start, end, comps: {}, prior: {}, archive: null, from: prev};
  for (const cid in S.comps) {
    const c = S.comps[cid];
    if (c.type === 'league') season.comps[cid] = {teams: (lists[cid] || (S.seasons[prev].comps[cid] || {teams: []}).teams).map(n => S.teams[n] ? n : ensureTeam(n, 'club', c.cc))};
    else season.comps[cid] = {teams: [], groups: {}};
  }
  S.seasons[id] = season;
  // competitiegemiddelden (oude ratings van clubs in de nieuwe samenstelling)
  const meanOf = (sid2, cid) => {
    const sc = S.seasons[sid2].comps[cid]; const rated = sc ? sc.teams.filter(t => fit.ix[t] != null) : [];
    if (rated.length >= 3) return {a: rated.reduce((s, t) => s + fit.r(t).a, 0) / rated.length, d: rated.reduce((s, t) => s + fit.r(t).d, 0) / rated.length};
    const o = leagueOffset(cid) / 2; return {a: o, d: o};
  };
  const prevMean = {}, newMean = {};
  for (const cid in S.comps) if (S.comps[cid].type === 'league') { if (S.seasons[prev].comps[cid]) prevMean[cid] = meanOf(prev, cid); newMean[cid] = meanOf(id, cid); }
  for (const id2 in S.teams) {
    if (S.teams[id2].kind !== 'club') continue;
    const pc = primaryLeague(prev, id2), nc = primaryLeague(id, id2);
    // regressie richting het gemiddelde van de competitie waarin de club vorig seizoen speelde (gepromoveerde clubs houden zo hun niveau uit de lagere competitie)
    const mean = pc && prevMean[pc] ? prevMean[pc] : nc && newMean[nc] ? newMean[nc] : {a: st.otherLeague / 2, d: st.otherLeague / 2};
    if (fit.ix[id2] != null && (fit.nm[id2] || 0) > 0) { const x = fit.r(id2); season.prior[id2] = {a: (1 - r) * x.a + r * mean.a, d: (1 - r) * x.d + r * mean.d, src: 'vorig seizoen'}; }
    else if (fit.ix[id2] != null) { const x = fit.r(id2); season.prior[id2] = {a: x.a, d: x.d, src: 'vorige prior'}; }
    else { const m2 = nc && newMean[nc] ? newMean[nc] : mean; season.prior[id2] = {a: m2.a - st.promotedPenalty / 2, d: m2.d - st.promotedPenalty / 2, src: 'nieuw'}; }
  }
  S.active = id; bump();
}
