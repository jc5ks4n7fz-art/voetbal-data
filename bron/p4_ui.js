// ===================== INTERFACE =====================
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
const pct = (p, d) => (p == null || isNaN(p)) ? '–' : (p * 100).toFixed(d == null ? (p > 0 && p < 0.01 ? 1 : 0) : d).replace('.', ',') + '%';
const num = (x, d) => (x == null || isNaN(x)) ? '–' : (+x).toFixed(d == null ? 2 : d).replace('.', ',');
const fmtDate = d => { if (!d) return ''; const [y, m, dd] = d.split('-'); return +dd + ' ' + ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'][+m - 1] + (y !== String(new Date().getFullYear()) ? ' ' + y.slice(2) : ''); };
let ui = {type: 'league', comp: 'NED2', fn: 'stand', page: 'week', season: null, round: {}, pred: {}, rank: 'clubs', dataTab: 'import', confirm: null, edit: null, msg: null, filter: {}, bt: null};
let simState = null; // {key, prog}
const FN = {
  league: [['stand', 'Stand'], ['ronde', 'Speelronde'], ['sim', 'Eindstand-simulatie'], ['voorspel', 'Wedstrijdvoorspelling'], ['teams', 'Teams & correcties'], ['format', 'Format'], ['backtest', 'Backtest']],
  euro: [['stand', 'Competitiefase'], ['ronde', 'Speeldag'], ['sim', 'Toernooisimulatie'], ['voorspel', 'Wedstrijdvoorspelling'], ['teams', 'Teams & correcties'], ['format', 'Format'], ['backtest', 'Backtest']],
  nation: [['stand', 'Groepen'], ['ronde', 'Speeldag'], ['sim', 'Toernooisimulatie'], ['voorspel', 'Wedstrijdvoorspelling'], ['teams', 'Teams & correcties'], ['format', 'Format'], ['backtest', 'Backtest']]
};
const TYPE_LABEL = {league: 'Nationale competities', euro: 'Europese clubtoernooien', nation: 'Nationale teams'};
function saveUI() { try { localStorage.setItem(UI_KEY, JSON.stringify({type: ui.type, comp: ui.comp, fn: ui.fn, rank: ui.rank, page: ['week', 'value', 'review', 'mybets'].includes(ui.page) ? ui.page : null})); } catch (e) {} }
function loadUI() { try { const o = JSON.parse(localStorage.getItem(UI_KEY) || 'null'); if (o) Object.assign(ui, o); } catch (e) {} }
const SID = () => (ui.season && S.seasons[ui.season]) ? ui.season : S.active;
function top10cc() { return S.coef.slice().sort((a, b) => b.coef - a.coef).slice(0, 10).map(x => x.cc); }
function compsOfType(type) {
  const t10 = top10cc();
  return Object.values(S.comps).filter(c => c.type === type && !c.hidden).sort((a, b) => {
    if (type === 'league') { const ra = a.tier > 1 ? 99 + a.tier : (t10.indexOf(a.cc) < 0 ? 50 : t10.indexOf(a.cc)), rb = b.tier > 1 ? 99 + b.tier : (t10.indexOf(b.cc) < 0 ? 50 : t10.indexOf(b.cc)); return ra - rb; }
    return 0;
  });
}
function changed(msg) { bump(); save(); if (msg) ui.msg = msg; render(); autoSim(); }
function autoSim() {
  if (ui.page || ui.fn !== 'sim' || simState) return; const k = SID() + '|' + ui.comp, s = SIMS[k];
  if (s && s.ver !== VER) startSim();
}
function startSim() {
  const sid = SID(), cid = ui.comp, key = sid + '|' + cid; if (simState) return;
  simState = {key, prog: 0}; render();
  runSim(sid, cid, p => { simState.prog = p; const el = document.getElementById('simbar'); if (el) el.style.width = (p * 100).toFixed(1) + '%'; const lt = document.getElementById('simpct'); if (lt) lt.textContent = Math.round(p * 100) + '%'; },
    (out, err) => { simState = null; if (err) { ui.msg = 'Simulatie mislukt: ' + (err.message || err); console.error(err); } render(); });
}

// ---------- kleine componenten ----------
function bar3(pH, pD, pA, compact) {
  return `<div class="bar3${compact ? ' sm' : ''}" role="img" aria-label="1 ${pct(pH)}, X ${pct(pD)}, 2 ${pct(pA)}"><span class="b1" style="width:${pH * 100}%">${pH > .12 ? pct(pH) : ''}</span><span class="bx" style="width:${pD * 100}%">${pD > .12 ? pct(pD) : ''}</span><span class="b2" style="width:${pA * 100}%">${pA > .12 ? pct(pA) : ''}</span></div>`;
}
function pbar(p, cls) { return `<div class="pb"><span class="pf ${cls || ''}" style="width:${Math.min(100, p * 100)}%"></span><em>${pct(p)}</em></div>`; }
function teamLink(t) { const x = S.teams[t]; return `<span class="tn">${esc(x ? x.name : t)}${adjV(t) ? ` <i class="adjchip" title="Handmatige correctie">${adjV(t) > 0 ? '+' : ''}${Math.round(adjV(t) * 100)}</i>` : ''}</span>`; }
function zoneClassAt(f, pos, elig) {
  for (const z of (f.zones || [])) { if (z.type === 'champ') continue; if (pos >= z.from && pos <= z.to) return ZONE_INFO[z.type] ? ZONE_INFO[z.type].cls : ''; }
  return '';
}
function notice(html, kind) { return `<div class="note ${kind || ''}">${html}</div>`; }
function legend(types) { return `<div class="legend">${types.map(t => ZONE_INFO[t] ? `<span><i class="sw ${ZONE_INFO[t].cls}"></i>${esc(ZONE_INFO[t].label)}</span>` : '').join('')}</div>`; }

// ---------- render ----------
function render() {
  const app = document.getElementById('app'); const sy = window.scrollY;
  const sid = SID(), season = S.seasons[sid];
  let main = '';
  try { main = ui.page ? renderPage() : renderComp(); } catch (e) { console.error(e); main = notice('Weergavefout: ' + esc(e.message) + '. Controleer de data of het format (JSON).', 'bad'); }
  const types = ['league', 'euro', 'nation'];
  const comps = compsOfType(ui.type);
  app.innerHTML = `
  <header class="top">
    <div class="brand"><span class="mark" aria-hidden="true"></span><div><h1>Voetbalvoorspeller</h1><p>Poisson/Dixon-Coles · Elo · Monte Carlo</p></div></div>
    <div class="topctl">
      <label class="seasonsel">Seizoen <select id="seasonSel" data-change="season">${Object.keys(S.seasons).sort().map(k => `<option value="${k}" ${k === sid ? 'selected' : ''}>${k}${S.seasons[k].status === 'afgesloten' ? ' (archief)' : k === S.active ? ' (actief)' : ''}</option>`).join('')}</select></label>
      <nav class="pages">${[['week', 'Komende wedstrijden'], ['review', 'Terugblik'], ['mybets', 'Mijn bets'], ['value', 'Waarde'], ['rank', 'Ranglijst'], ['data', 'Data'], ['seasons', 'Seizoenen'], ['settings', 'Instellingen'], ['help', 'Uitleg']].map(([k, l]) => `<button class="pg ${ui.page === k ? 'on' : ''}" data-act="page" data-v="${k}">${l}</button>`).join('')}
      <button class="pg" data-act="theme" title="Licht/donker wisselen">Thema</button></nav>
    </div>
  </header>
  ${saveError ? notice(esc(saveError), 'bad') : ''}
  ${ui.msg ? `<div class="toast" role="status">${esc(ui.msg)}<button data-act="msgx" aria-label="Sluiten">×</button></div>` : ''}
  ${season && season.status === 'afgesloten' ? notice('Je bekijkt het afgesloten seizoen ' + esc(sid) + ' (archief). Wijzigingen zijn mogelijk, maar het archief zelf wordt niet herberekend.', 'info') : ''}
  <nav class="crumbs" aria-label="Navigatie">
    <div class="lvl types">${types.map(t => `<button class="${!ui.page && ui.type === t ? 'on' : ''}" data-act="type" data-v="${t}">${TYPE_LABEL[t]}</button>`).join('')}</div>
    <div class="lvl comps">${comps.map(c => { const n = (season.comps[c.id] || {teams: []}).teams.length; return `<button class="${!ui.page && ui.comp === c.id ? 'on' : ''}" data-act="comp" data-v="${c.id}" title="${esc(c.name)}">${esc(c.name)}${c.tier > 1 ? '' : ''}${!n ? '<i class="dim"> · leeg</i>' : ''}</button>`; }).join('')}</div>
    ${!ui.page ? `<div class="lvl fns">${FN[S.comps[ui.comp].type].map(([k, l]) => `<button class="${ui.fn === k ? 'on' : ''}" data-act="fn" data-v="${k}">${l}</button>`).join('')}</div>` : ''}
  </nav>
  <main id="main">${main}</main>
  <footer class="foot">Data lokaal in deze browser opgeslagen · ${S.matches.length} wedstrijden · ${Object.keys(S.teams).length} teams · referentiedatum ${esc(refDate())}${S.dataUpdated ? ' · automatische data bijgewerkt ' + esc(S.dataUpdated) : ''}</footer>`;
  window.scrollTo(0, sy);
}
function renderComp() {
  const sid = SID(), cid = ui.comp, c = S.comps[cid];
  if (!c) return notice('Competitie niet gevonden.', 'bad');
  const sc = S.seasons[sid].comps[cid];
  const head = `<div class="ctitle"><h2>${esc(c.name)}</h2><span class="meta">${esc(sid)} · ${c.type === 'league' ? (c.tier > 1 ? 'tweede niveau' : 'hoogste niveau') + ' · ' + esc((S.coef.find(x => x.cc === c.cc) || {}).name || c.cc) : c.type === 'euro' ? 'UEFA-clubtoernooi' : 'nationale teams'}</span></div>`;
  if (!sc || !sc.teams.length) return head + notice(`Voor ${esc(c.name)} in ${esc(sid)} zijn nog geen deelnemers bekend. Importeer teams/groepen en wedstrijden via <button class="lnk" data-act="page" data-v="data">Data → Importeren</button>. Een voorbeeldformaat staat onder <button class="lnk" data-act="page" data-v="help">Uitleg</button>.`, 'info') + (ui.fn === 'format' ? viewFormat(sid, cid) : ui.fn === 'voorspel' ? viewPredict(sid, cid) : '');
  const v = {stand: viewStand, ronde: viewRound, sim: viewSim, voorspel: viewPredict, teams: viewTeams, format: viewFormat, backtest: viewBacktest}[ui.fn] || viewStand;
  return head + v(sid, cid);
}
function coverage(sid, cid) {
  const c = S.comps[cid];
  if (c.type === 'league') {
    const L = leagueInfo(sid, cid);
    const parts = [`<b>${L.playedN}</b> van ${L.expected} competitieduels met uitslag`];
    if (L.overdue) parts.push(`<b class="warn">${L.overdue}</b> duels liggen in het verleden maar hebben nog geen uitslag`);
    if (L.gen.length) parts.push(`${L.gen.length} resterende duels zonder bekend speelschema: <b>aangenomen</b> (ontbrekende paren uit de dubbele competitie)`);
    if (L.inferred) parts.push(`${L.inferred} duels zonder rondenummer: ronde afgeleid uit datum (aanname)`);
    return notice('Datadekking: ' + parts.join(' · ') + (L.playedN === 0 ? '. <b>Er zijn nog geen uitslagen geïmporteerd</b>: alle kansen zijn gebaseerd op de startratings (aanname). Importeer uitslagen via Data voor betrouwbare voorspellingen.' : '.'), L.playedN === 0 || L.overdue ? 'warn' : 'info');
  }
  const ms = S.matches.filter(m => m.s === sid && m.c === cid), pl = ms.filter(played).length, od = ms.filter(m => !played(m) && m.d < refDate()).length;
  return notice(`Datadekking: <b>${pl}</b> van ${ms.length} bekende duels met uitslag${od ? ` · <b class="warn">${od}</b> duels in het verleden zonder uitslag (importeer ze; de simulatie behandelt ze nu als nog te spelen)` : ''}.`, od ? 'warn' : 'info');
}
function notesHTML(cid) { const n = S.comps[cid].notes || []; return n.length ? `<details class="notes"><summary>Format-opmerkingen en aannames (${n.length})</summary><ul>${n.map(x => `<li>${esc(x)}</li>`).join('')}</ul></details>` : ''; }

// ---------- stand ----------
function formChips(sid, cid, t) {
  const ms = S.matches.filter(m => m.s === sid && m.c === cid && played(m) && (m.h === t || m.a === t)).sort((a, b) => a.d < b.d ? 1 : -1).slice(0, 5).reverse();
  return ms.map(m => { const gf = m.h === t ? m.hg : m.ag, ga = m.h === t ? m.ag : m.hg; const r = gf > ga ? 'W' : gf === ga ? 'G' : 'V'; return `<i class="fc f${r}" title="${esc(tName(m.h))} ${m.hg}-${m.ag} ${esc(tName(m.a))}">${r}</i>`; }).join('');
}
function tableHTML(rows, f, opts) {
  opts = opts || {};
  return `<div class="tw"><table class="tbl stand"><thead><tr><th>#</th><th class="l">Team</th><th>Gs</th><th>W</th><th>G</th><th>V</th><th>Doelp.</th><th>DS</th><th>Ptn</th>${opts.form ? '<th class="l hide-s">Vorm</th>' : ''}${opts.str ? '<th class="hide-s" title="Modelsterkte: verwacht doelsaldo per duel tegen een gemiddelde tegenstander">Sterkte</th>' : ''}</tr></thead><tbody>
  ${rows.map((r, p) => `<tr class="${f ? zoneClassAt(f, p + 1) : ''} ${r.inel ? 'inel' : ''}"><td class="pos">${p + 1}</td><td class="l">${teamLink(r.t)}${r.inel ? ' <i class="tag">Jong</i>' : ''}</td><td>${r.pl}</td><td>${r.w}</td><td>${r.d}</td><td>${r.l}</td><td class="mono">${r.gf}-${r.ga}</td><td class="mono">${r.gd > 0 ? '+' : ''}${r.gd}</td><td class="pts">${r.pts}</td>${opts.form ? `<td class="l hide-s">${opts.form(r.t)}</td>` : ''}${opts.str ? `<td class="mono hide-s">${opts.str(r.t)}</td>` : ''}</tr>`).join('')}
  </tbody></table></div>`;
}
function rowsFromTab(teams, t, order) { return order.map(i => ({t: teams[i], pl: t.pl[i], w: t.w[i], d: t.d[i], l: t.l[i], gf: t.gf[i], ga: t.ga[i], gd: t.gd[i], pts: t.pts[i]})); }
function strFmt(sid) { return t => { const s = teamStrength(sid, t); return (s > 0 ? '+' : '') + num(s, 2); }; }
function viewStand(sid, cid) {
  const c = S.comps[cid];
  if (c.type === 'league') {
    const ct = currentTable(sid, cid), inel = new Set(c.format.ineligible || []);
    const rows = rowsFromTab(ct.L.teams, ct.t, ct.order).map(r => Object.assign(r, {inel: inel.has(r.t)}));
    let per = '';
    if (c.format.periods) {
      const P = c.format.periods; const L = ct.L;
      per = `<h3>Periodestanden <small>${c.format.periodsAssumed ? '(periodegrenzen = aanname)' : ''}</small></h3><div class="grid4">${P.map((p, k) => {
        const t = newTab(L.n); L.ms.forEach(m => { if (!played(m)) return; const r = L.rOf.get(m.id); if (r >= p[0] && r <= p[1]) applyRes(t, L.ix[m.h], L.ix[m.a], m.hg, m.ag); });
        const ord = rankIdx([...Array(L.n).keys()], t, ['pts', 'gd', 'gf'], L.teams.map((_, i) => -i)).filter(i => t.pl[i] > 0).slice(0, 5);
        return `<div class="mini"><b>Periode ${k + 1}</b> <span class="dim">ronde ${p[0]}–${p[1]}</span><ol>${ord.map(i => `<li>${esc(tName(L.teams[i]))}${inel.has(L.teams[i]) ? ' <i class="tag">Jong</i>' : ''} <span class="mono">${t.pts[i]}</span></li>`).join('') || '<li class="dim">nog geen duels</li>'}</ol></div>`;
      }).join('')}</div>`;
    }
    const zt = [...new Set((c.format.zones || []).map(z => z.type).filter(t => t !== 'champ'))];
    return coverage(sid, cid) + notesHTML(cid) + tableHTML(rows, c.format, {form: t => formChips(sid, cid, t), str: strFmt(sid)}) + legend(zt) + per;
  }
  if (c.type === 'euro') {
    const E = euroInfo(sid, cid), t = newTab(E.n); E.lp.forEach(m => { if (played(m)) applyRes(t, E.ix[m.h], E.ix[m.a], m.hg, m.ag); });
    const order = rankIdx([...Array(E.n).keys()], t, ['pts', 'gd', 'gf', 'agf', 'w', 'aw'], E.teams.map((_, i) => -i));
    const f = {zones: [Z(1, E.f.direct || 8, 'cl'), Z((E.f.direct || 8) + 1, E.f.playoffTo || 24, 'po'), Z((E.f.playoffTo || 24) + 1, E.n, 'rel')]};
    const ko = KO_ROUNDS.filter(r => E.ko[r].length).map(r => `<h3>${KO_LABEL[r]}</h3>` + E.ko[r].map(tie => `<div class="tie">${esc(tName(tie.A))} – ${esc(tName(tie.B))}: ${tie.legs.map(m => played(m) ? `${m.hg}-${m.ag}${m.pw ? ' (strafschoppen: ' + esc(tName(m.pw)) + ')' : ''}` : fmtDate(m.d)).join(' / ')}</div>`).join('')).join('');
    return coverage(sid, cid) + notesHTML(cid) + tableHTML(rowsFromTab(E.teams, t, order), f, {str: strFmt(sid)}) + `<div class="legend"><span><i class="sw z-cl"></i>Direct naar 1/8 finale</span><span><i class="sw z-po"></i>Knock-out play-offs</span><span><i class="sw z-rel"></i>Uitgeschakeld</span></div>` + ko;
  }
  const I = groupInfo(sid, cid);
  if (!Object.keys(I.G).length) return coverage(sid, cid) + notesHTML(cid) + notice('Geen groepen gedefinieerd. Importeer groepen via JSON (zie Uitleg).', 'info') + viewNationList(sid, cid);
  return coverage(sid, cid) + notesHTML(cid) + `<div class="groups">${Object.keys(I.G).map(g => {
    const X = I.G[g], t = newTab(X.teams.length); X.ms.forEach(m => { if (played(m)) applyRes(t, X.ix[m.h], X.ix[m.a], m.hg, m.ag); });
    const ord = rankIdx([...Array(X.teams.length).keys()], t, ['pts', 'gd', 'gf'], X.teams.map((_, i) => -i));
    return `<section class="grp"><h3>Groep ${esc(g)}</h3>${tableHTML(rowsFromTab(X.teams, t, ord), null, {str: t => Math.round(teamStrength(sid, t))})}</section>`;
  }).join('')}</div>`;
}
function viewNationList(sid, cid) { const sc = S.seasons[sid].comps[cid]; return sc.teams.length ? `<p>${sc.teams.map(tName).join(', ')}</p>` : ''; }

// ---------- speelronde ----------
function roundsOf(sid, cid) {
  const c = S.comps[cid]; let ms = S.matches.filter(m => m.s === sid && m.c === cid);
  const key = m => c.type === 'league' ? (leagueInfo(sid, cid).rOf.get(m.id) || 0) : (m.st && m.st !== 'lp' && m.st !== 'group' ? 'ko-' + m.st : (m.r || 0));
  const g = {}; ms.forEach(m => { const k = key(m); (g[k] = g[k] || []).push(m); });
  const keys = Object.keys(g).sort((a, b) => { const na = isNaN(+a), nb = isNaN(+b); if (na !== nb) return na ? 1 : -1; if (na) return KO_ROUNDS.indexOf(a.slice(3)) - KO_ROUNDS.indexOf(b.slice(3)); return +a - +b; });
  return {g, keys};
}
function viewRound(sid, cid) {
  const c = S.comps[cid], R = roundsOf(sid, cid);
  if (!R.keys.length) return coverage(sid, cid) + notice('Er zijn nog geen wedstrijden bekend. Importeer het speelschema (CSV/JSON) via Data of voeg wedstrijden handmatig toe.', 'info') + (c.type === 'league' ? genPreview(sid, cid) : '');
  let cur = ui.round[sid + cid];
  if (cur == null || !R.g[cur]) { cur = R.keys.find(k => R.g[k].some(m => !played(m))) || R.keys[R.keys.length - 1]; }
  const label = k => isNaN(+k) ? KO_LABEL[k.slice(3)] : (c.type === 'league' ? 'Speelronde ' : 'Speeldag ') + k;
  const ms = R.g[cur].slice().sort((a, b) => a.d < b.d ? -1 : a.d > b.d ? 1 : a.id - b.id);
  const ki = R.keys.indexOf(String(cur));
  const rows = ms.map(m => {
    const l = lambdas(sid, cid, m.h, m.a, !!m.n), single = m.st === 'f';
    const p = outcome(l[0], l[1], l[2]); const ahm = played(m) ? null : ahMain(p.M, p.N);
    const editing = ui.edit === m.id;
    return `<div class="mrow ${played(m) ? 'done' : ''}">
      <div class="mdate">${fmtDate(m.d)}${m.t ? ' ' + esc(m.t) : ''}${m.xg ? `<br><span title="Expected goals (API-Football)">xG ${num(m.xg[0], 2)}–${num(m.xg[1], 2)}</span>` : ''}${m.g ? ` · ${esc(m.g)}` : ''}${m.n ? ' · neutraal' : ''}</div>
      <div class="mteams"><span class="h">${teamLink(m.h)}</span>
        ${editing ? `<span class="score edit"><input id="eh${m.id}" type="number" min="0" max="30" value="${m.hg != null ? m.hg : ''}" aria-label="Doelpunten thuis"><b>–</b><input id="ea${m.id}" type="number" min="0" max="30" value="${m.ag != null ? m.ag : ''}" aria-label="Doelpunten uit"></span>`
        : `<button class="score ${played(m) ? '' : 'open'}" data-act="editscore" data-v="${m.id}" title="Uitslag invoeren of corrigeren">${played(m) ? `${m.hg}<b>–</b>${m.ag}` : 'uitslag'}</button>`}
        <span class="a">${teamLink(m.a)}</span></div>
      <div class="mpred">${bar3(p.h, p.d, p.a, true)}<span class="xg mono" title="Verwachte doelpunten">${num(l[0], 2)} – ${num(l[1], 2)}</span>${ahm ? `<span class="xg" title="Faire Asian handicap-hoofdlijn voor de thuisploeg">AH ${ahFmt(ahm.L)}</span>` : ''}
        ${editing ? `<span class="eb"><button class="btn sm pri" data-act="savescore" data-v="${m.id}">Opslaan</button>${played(m) ? `<button class="btn sm" data-act="clearscore" data-v="${m.id}">Wis uitslag</button>` : ''}<button class="btn sm ghost" data-act="canceledit">Annuleer</button></span>` : `<button class="lnk sm" data-act="predict" data-v="${m.id}">details</button>`}</div>
    </div>`;
  }).join('');
  return coverage(sid, cid) + `<div class="roundnav"><button class="btn" data-act="rnd" data-v="${R.keys[Math.max(0, ki - 1)]}" ${ki <= 0 ? 'disabled' : ''} aria-label="Vorige">‹</button>
    <select id="roundSel" data-change="round">${R.keys.map(k => `<option value="${k}" ${String(k) === String(cur) ? 'selected' : ''}>${label(k)} (${R.g[k].filter(played).length}/${R.g[k].length})</option>`).join('')}</select>
    <button class="btn" data-act="rnd" data-v="${R.keys[Math.min(R.keys.length - 1, ki + 1)]}" ${ki >= R.keys.length - 1 ? 'disabled' : ''} aria-label="Volgende">›</button>
    <span class="dim">Klik op een uitslag om die in te voeren of te corrigeren; ratings en voorspellingen worden direct herberekend.</span></div>
    <div class="mlist">${rows}</div>${c.type === 'league' ? genPreview(sid, cid) : ''}`;
}
function genPreview(sid, cid) {
  const L = leagueInfo(sid, cid); if (!L.gen.length) return '';
  return `<details class="notes"><summary>${L.gen.length} aangenomen resterende duels (geen speelschema bekend)</summary><p class="dim">Deze paren ontbreken in de geïmporteerde data en worden in de simulatie gespeeld met de aangenomen ronde. Importeer het officiële speelschema om dit te vervangen.</p></details>`;
}

// ---------- simulatie ----------
function simHeader(sid, cid) {
  const key = sid + '|' + cid, s = SIMS[key], running = simState && simState.key === key;
  const runs = Math.max(10000, +S.settings.mcRuns || 10000);
  return `<div class="simbar">
    <button class="btn pri" data-act="sim" ${running || simState ? 'disabled' : ''}>${s ? 'Opnieuw simuleren' : 'Simuleer'} (${runs.toLocaleString('nl-NL')} runs)</button>
    ${running ? `<div class="prog" aria-live="polite"><span id="simbar" style="width:${(simState.prog * 100).toFixed(1)}%"></span></div><span id="simpct" class="mono">${Math.round(simState.prog * 100)}%</span><span class="dim">Bezig met rekenen…</span>` : ''}
    ${s && !running ? `<span class="dim">Laatst berekend ${s.at.toLocaleTimeString('nl-NL', {hour: '2-digit', minute: '2-digit'})}${s.ver !== VER ? ' · <b class="warn">verouderd door wijzigingen</b>' : ''}</span>` : ''}
  </div>`;
}
function posDist(pos) { const mx = Math.max(...pos); return `<div class="pd" style="grid-template-columns:repeat(${pos.length},1fr)" aria-hidden="true">${pos.map((p, i) => `<i style="opacity:${mx ? (0.08 + 0.92 * p / mx).toFixed(2) : 0}" title="Plaats ${i + 1}: ${pct(p, 1)}"></i>`).join('')}</div>`; }
function viewSim(sid, cid) {
  const c = S.comps[cid], s = SIMS[sid + '|' + cid];
  let body = '';
  if (!s) body = notice('Nog niet gesimuleerd. Een simulatie draait pas op verzoek (of automatisch opnieuw na een wijziging zodra er een resultaat is).', 'info');
  else if (s.res.kind === 'league') body = simLeagueHTML(sid, cid, s.res);
  else if (s.res.kind === 'euro') body = simEuroHTML(sid, cid, s.res);
  else body = simGroupsHTML(sid, cid, s.res);
  return coverage(sid, cid) + simHeader(sid, cid) + body;
}
const ZONE_ORDER = ['champ', 'cl', 'clq', 'el', 'ecl', 'eurpo', 'promo', 'po', 'promopo', 'promotot', 'relpo', 'relpoloss', 'rel', 'reltot', 'jongrel'];
function simLeagueHTML(sid, cid, r) {
  const c = S.comps[cid], types = ZONE_ORDER.filter(t => r.zoneTypes.includes(t));
  const inel = new Set(c.format.ineligible || []);
  return `${r.gen ? notice(`${r.gen} resterende duels zonder bekend speelschema zijn als aanname meegesimuleerd.`, 'info') : ''}
  <div class="tw"><table class="tbl sim"><thead><tr><th class="l">Team</th><th title="Verwachte eindpunten">Ptn</th><th title="Verwachte eindpositie">Pos</th>${types.map(t => `<th class="${ZONE_INFO[t].cls}h" title="${esc(ZONE_INFO[t].label)}">${esc(ZONE_INFO[t].short)}</th>`).join('')}<th class="l hide-s">Verdeling eindpositie (1 → ${r.n})</th></tr></thead>
  <tbody>${r.rows.map(x => `<tr><td class="l">${teamLink(x.t)}${inel.has(x.t) ? ' <i class="tag">Jong</i>' : ''}</td><td class="mono">${num(x.expPts, 1)}</td><td class="mono">${num(x.expPos, 1)}</td>${types.map(t => `<td class="pc" style="--p:${(x.z[t] || 0)}">${(x.z[t] || 0) >= 0.0005 ? pct(x.z[t]) : '<span class="dim">–</span>'}</td>`).join('')}<td class="hide-s">${posDist(x.pos)}</td></tr>`).join('')}</tbody></table></div>
  ${legend(types)}<p class="dim">Kansen per kolom zijn het aandeel van ${r.runs.toLocaleString('nl-NL')} gesimuleerde seizoenen. ${c.format.playoff ? 'Play-offs: deelnemers en winnaar volgens de KNVB-regeling 2026/27; finale tegen de gesimuleerde nr. 16 van de Eredivisie.' : ''}</p>`;
}
const REACH_LABEL = {top8: 'Top 8', po: 'Play-offs', r16: '1/8', qf: 'KF', sf: 'HF', f: 'Finale', w: 'Winnaar', ko: 'KO-fase'};
function bracketHTML(cols, nodes) {
  return `<div class="bracket-wrap"><div class="bracket">${cols.map(col => `<div class="bcol"><h4>${esc(col.label)}</h4><div class="bstack">${col.keys.map(k => { const list = (nodes[k] || []).slice(0, 3); return `<div class="bnode">${list.length ? list.map(([t, p], i) => `<div class="${i ? '' : 'lead'}"><span>${esc(tName(t))}</span><b class="mono">${pct(p)}</b></div>`).join('') : '<div class="dim">–</div>'}</div>`; }).join('')}</div></div>`).join('')}</div></div>`;
}
function simEuroHTML(sid, cid, r) {
  const keys = r.reachKeys;
  const tbl = `<div class="tw"><table class="tbl sim"><thead><tr><th class="l">Team</th><th>Ptn</th><th>Pos</th>${keys.map(k => `<th>${REACH_LABEL[k]}</th>`).join('')}<th class="l hide-s">Positie competitiefase (1 → ${r.n})</th></tr></thead><tbody>
  ${r.rows.map(x => `<tr><td class="l">${teamLink(x.t)}</td><td class="mono">${num(x.expPts, 1)}</td><td class="mono">${num(x.expPos, 1)}</td>${keys.map(k => `<td class="pc" style="--p:${x.reach[k] || 0}">${(x.reach[k] || 0) >= 0.0005 ? pct(x.reach[k]) : '<span class="dim">–</span>'}</td>`).join('')}<td class="hide-s">${posDist(x.pos)}</td></tr>`).join('')}</tbody></table></div>`;
  const br = bracketHTML([{label: '1/8 finale', keys: [1, 8, 4, 5, 2, 7, 3, 6].map(k => 'r16-' + k)}, {label: 'Kwartfinale', keys: ['qf-1', 'qf-2', 'qf-3', 'qf-4']}, {label: 'Halve finale', keys: ['sf-1', 'sf-2']}, {label: 'Finale (neutraal)', keys: ['f']}], r.nodes);
  return `<h3>Schema (meest waarschijnlijke winnaar per vak)</h3><p class="dim">Vak in de 1/8 finale = duel van de nr. 1 t/m 8 van de competitiefase; de loting voor play-offs en 1/8 finale wordt per run gesimuleerd binnen de UEFA-seedingparen. Tweeluiken zonder uitdoelpuntenregel, met verlenging en strafschoppen.</p>${br}<h3>Kansen per ronde</h3>${tbl}`;
}
function simGroupsHTML(sid, cid, r) {
  const f = S.comps[cid].format;
  const zt = ZONE_ORDER.concat(['kf', 'q', 'qpo']).filter(t => r.zones[t]);
  const rk = f.nl ? ['qf', 'sf', 'f', 'w'] : f.kind === 'tournament' ? ['ko'].concat(Object.keys(r.reach).filter(k => /^r\d+$/.test(k)).sort(), ['w']) : [];
  const rl = k => k === 'qf' ? 'KF' : k === 'sf' ? 'Finals' : k === 'f' ? 'Finale' : k === 'w' ? 'Winnaar' : k === 'ko' ? 'KO-fase' : 'Ronde ' + (+k.slice(1) + 1);
  const groups = Object.keys(r.groups).map(g => `<section class="grp"><h3>Groep ${esc(g)}</h3><div class="tw"><table class="tbl sim"><thead><tr><th class="l">Land</th><th>Ptn</th>${r.groups[g][0].pos.map((_, i) => `<th>${i + 1}e</th>`).join('')}${zt.map(t => `<th class="${ZONE_INFO[t].cls}h" title="${esc(ZONE_INFO[t].label)}">${esc(ZONE_INFO[t].short)}</th>`).join('')}${rk.map(k => `<th>${rl(k)}</th>`).join('')}</tr></thead><tbody>
    ${r.groups[g].map(x => `<tr><td class="l">${teamLink(x.t)}</td><td class="mono">${num(x.expPts, 1)}</td>${x.pos.map(p => `<td class="pc" style="--p:${p}">${pct(p)}</td>`).join('')}${zt.map(t => `<td class="pc" style="--p:${(r.zones[t] || {})[x.t] || 0}">${pct((r.zones[t] || {})[x.t] || 0)}</td>`).join('')}${rk.map(k => `<td class="pc" style="--p:${(r.reach[k] || {})[x.t] || 0}">${((r.reach[k] || {})[x.t] || 0) >= 0.0005 ? pct((r.reach[k] || {})[x.t]) : '<span class="dim">–</span>'}</td>`).join('')}</tr>`).join('')}</tbody></table></div></section>`).join('');
  let br = '';
  if (f.nl && r.nodes.f) br = `<h3>League A: kwartfinales en Finals</h3><p class="dim">Kwartfinale: groepswinnaar tegen nr. 2 uit een andere groep (twee duels, winnaar thuis in duel 2); halve finales via loting, Finals op neutraal terrein.</p>` + bracketHTML([{label: 'Kwartfinale', keys: ['qf-1', 'qf-2', 'qf-3', 'qf-4']}, {label: 'Halve finale', keys: ['sf-1', 'sf-2']}, {label: 'Finale', keys: ['f']}], r.nodes);
  if (f.kind === 'tournament') {
    const rounds = {}; Object.keys(r.nodes).forEach(k => { const m = k.match(/^k(\d+)-(\d+)$/); if (m) (rounds[m[1]] = rounds[m[1]] || []).push(+m[2]); });
    br = `<h3>Knock-outschema</h3><p class="dim">Benadering: plaatsing in het schema op basis van groepspositie en punten; de officiële UEFA/FIFA-indeling voor beste nummers 3 wordt niet exact gevolgd.</p>` + bracketHTML(Object.keys(rounds).sort((a, b) => a - b).map(rr => ({label: 'Ronde ' + (+rr + 1), keys: rounds[rr].sort((a, b) => a - b).map(k => 'k' + rr + '-' + k)})), r.nodes);
  }
  return (zt.length ? legend(zt) : '') + br + `<div class="groups wide">${groups}</div>`;
}

// ---------- wedstrijdvoorspelling ----------
function viewPredict(sid, cid) {
  const c = S.comps[cid], kind = c.type === 'nation' ? 'nation' : 'club';
  const P = ui.pred[cid] = ui.pred[cid] || {};
  const pool = (S.seasons[sid].comps[cid] || {teams: []}).teams;
  const all = Object.values(S.teams).filter(t => t.kind === kind).sort((a, b) => a.name.localeCompare(b.name, 'nl'));
  if (!P.h) P.h = pool[0] || (all[0] && all[0].id); if (!P.a) P.a = pool[1] || (all[1] && all[1].id);
  const opts = sel => `<optgroup label="${esc(c.name)}">${pool.slice().sort((a, b) => tName(a).localeCompare(tName(b), 'nl')).map(t => `<option value="${t}" ${t === sel ? 'selected' : ''}>${esc(tName(t))}</option>`).join('')}</optgroup><optgroup label="Alle ${kind === 'nation' ? 'landen' : 'clubs'}">${all.filter(t => !pool.includes(t.id)).map(t => `<option value="${t.id}" ${t.id === sel ? 'selected' : ''}>${esc(t.name)}</option>`).join('')}</optgroup>`;
  const venue = P.venue || 'thuis', mode = P.mode || 'normaal';
  const form = `<div class="pform">
    <label>Thuis / team A<select id="pH" data-change="pred" data-k="h">${opts(P.h)}</select></label>
    <label>Uit / team B<select id="pA" data-change="pred" data-k="a">${opts(P.a)}</select></label>
    <label>Terrein<select id="pV" data-change="pred" data-k="venue"><option value="thuis" ${venue === 'thuis' ? 'selected' : ''}>Thuis voor team A</option><option value="neutraal" ${venue === 'neutraal' ? 'selected' : ''}>Neutraal</option></select></label>
    <label>Type<select id="pM" data-change="pred" data-k="mode"><option value="normaal" ${mode === 'normaal' ? 'selected' : ''}>Gewone wedstrijd</option><option value="ko" ${mode === 'ko' ? 'selected' : ''}>Knock-out (één duel)</option><option value="leg1" ${mode === 'leg1' ? 'selected' : ''}>Tweeluik: 1e duel (A thuis)</option><option value="leg2" ${mode === 'leg2' ? 'selected' : ''}>Tweeluik: 2e duel (A thuis), 1e duel gespeeld</option></select></label>
    ${mode === 'leg2' ? `<label>Uitslag 1e duel (B thuis – A uit)<span class="pair"><input id="pL1b" type="number" min="0" value="${P.l1b != null ? P.l1b : 0}" data-input="pred" data-k="l1b" aria-label="Doelpunten B in duel 1"><b>–</b><input id="pL1a" type="number" min="0" value="${P.l1a != null ? P.l1a : 0}" data-input="pred" data-k="l1a" aria-label="Doelpunten A in duel 1"></span></label>` : ''}
    <label>Odds 1 / X / 2 (optioneel)<span class="pair"><input id="pO1" inputmode="decimal" placeholder="1" value="${esc(P.o1 || '')}" data-input="pred" data-k="o1"><input id="pOX" inputmode="decimal" placeholder="X" value="${esc(P.ox || '')}" data-input="pred" data-k="ox"><input id="pO2" inputmode="decimal" placeholder="2" value="${esc(P.o2 || '')}" data-input="pred" data-k="o2"></span></label>
  </div>`;
  if (!P.h || !P.a || P.h === P.a) return form + notice('Kies twee verschillende teams.', 'info');
  const neutral = venue === 'neutraal';
  const l = lambdas(sid, cid, P.h, P.a, neutral), p = predict(l[0], l[1], l[2]);
  let ko = '';
  if (mode === 'ko') ko = `<div class="kbox"><h4>Kans op doorgaan (incl. verlenging en strafschoppen)</h4>${pbar(koSingleAdv(l[0], l[1], l[2]), 'a1')}<span>${esc(tName(P.h))}</span>${pbar(1 - koSingleAdv(l[0], l[1], l[2]), 'a2')}<span>${esc(tName(P.a))}</span></div>`;
  if (mode === 'leg1' || mode === 'leg2') {
    const l2 = lambdas(sid, cid, P.a, P.h, false);
    let adv;
    if (mode === 'leg1') adv = koTwoLegAdv(l[0], l[1], l[2], l2[0], l2[1], l2[2], null);
    else { const lb = lambdas(sid, cid, P.a, P.h, false); adv = 1 - koTwoLegAdv(lb[0], lb[1], lb[2], l[0], l[1], l[2], [+(P.l1b || 0), +(P.l1a || 0)]); }
    ko = `<div class="kbox"><h4>Kans op doorgaan over twee duels (geen uitdoelpuntenregel; verlenging en strafschoppen in duel 2)</h4>${pbar(adv, 'a1')}<span>${esc(tName(P.h))}</span>${pbar(1 - adv, 'a2')}<span>${esc(tName(P.a))}</span></div>`;
  }
  let odds = '';
  const o = [P.o1, P.ox, P.o2].map(x => parseFloat(String(x || '').replace(',', '.')));
  if (o.every(x => x > 1)) {
    const inv = o.map(x => 1 / x), s = inv.reduce((a, b) => a + b, 0), imp = inv.map(x => x / s), mp = [p.pH, p.pD, p.pA];
    odds = `<div class="kbox"><h4>Vergelijking met de markt</h4><table class="tbl compact"><thead><tr><th class="l"></th><th>1</th><th>X</th><th>2</th></tr></thead><tbody>
      <tr><td class="l">Impliciete kans (marge ${pct(s - 1, 1)} verwijderd)</td>${imp.map(x => `<td class="mono">${pct(x, 1)}</td>`).join('')}</tr>
      <tr><td class="l">Model</td>${mp.map(x => `<td class="mono">${pct(x, 1)}</td>`).join('')}</tr>
      <tr><td class="l">Verschil model − markt</td>${mp.map((x, i) => `<td class="mono ${x - imp[i] > 0 ? 'up' : 'down'}">${(x - imp[i] > 0 ? '+' : '') + num((x - imp[i]) * 100, 1)} pp</td>`).join('')}</tr>
      <tr><td class="l">Faire odds volgens model</td>${mp.map(x => `<td class="mono">${num(1 / x, 2)}</td>`).join('')}</tr></tbody></table>
      <p class="dim">Een groot verschil betekent vaker dat het model informatie mist (blessures, opstellingen) dan dat de markt fout zit.</p></div>`;
  }
  const extra = kind === 'nation' ? `Elo ${Math.round(eloState().get(P.h))} – ${Math.round(eloState().get(P.a))}` : (() => { const f = clubFit(sid); return `Thuisvoordeel ${esc(c.short)}: ${neutral ? 'n.v.t. (neutraal)' : pct(Math.exp(f.hfa[cid] != null ? f.hfa[cid] : S.settings.hfaPrior) - 1) + ' meer doelpunten'} · ρ = ${num(f.rho, 2)}`; })();
  return form + `<div class="pred">
    <div class="phead"><div class="pt">${teamLink(P.h)}</div><div class="xgbig mono">${num(p.xgH, 2)} <small>xG</small> ${num(p.xgA, 2)}</div><div class="pt r">${teamLink(P.a)}</div></div>
    ${bar3(p.pH, p.pD, p.pA)}
    <div class="plabels"><span>1 · ${pct(p.pH, 1)}</span><span>X · ${pct(p.pD, 1)}</span><span>2 · ${pct(p.pA, 1)}</span></div>
    <div class="pgrid">
      <div class="kbox"><h4>Meest waarschijnlijke uitslagen</h4><ol class="top5">${p.top.map(([i, j, v]) => `<li><b class="mono">${i}–${j}</b>${pbar(v, 'a0')}</li>`).join('')}</ol></div>
      <div class="kbox"><h4>Doelpuntenmarkten</h4><div class="kv"><span>Over 2,5</span>${pbar(p.over)}</div><div class="kv"><span>Under 2,5</span>${pbar(1 - p.over)}</div><div class="kv"><span>Beide teams scoren</span>${pbar(p.btts)}</div><div class="kv"><span>Niet beide scoren</span>${pbar(1 - p.btts)}</div></div>
      ${ahBox(p.M, p.N, P.h, P.a)}
      ${ko}${odds}
    </div>
    <p class="dim">${extra} · Handmatige correcties: ${esc(tName(P.h))} ${adjV(P.h) ? Math.round(adjV(P.h) * 100) : 0}, ${esc(tName(P.a))} ${adjV(P.a) ? Math.round(adjV(P.a) * 100) : 0} (aan te passen onder Teams & correcties). Kansen zijn modeluitkomsten, geen zekerheden.</p>
  </div>`;
}


// ---------- Asian handicap & komende wedstrijden ----------
function ahFmt(L) { const a = Math.abs(L); return (L > 0 ? '+' : L < 0 ? '−' : '') + (a % 1 === 0 ? a.toFixed(0) : a % 0.5 === 0 ? a.toFixed(1) : a.toFixed(2)).replace('.', ','); }
const oddsFmt = o => isFinite(o) && o < 100 ? num(o, 2) : '–';
function ahTable(M, N, hName, aName, span) {
  const main = ahMain(M, N), lad = ahLadder(M, N, main.L, span == null ? 1 : span);
  return `<div class="tw"><table class="tbl compact ah"><thead><tr><th class="l">Lijn ${esc(hName)}</th><th>${esc(hName)} wint</th><th>Inzet (deels) terug</th><th>${esc(aName)} wint</th><th>Faire odds ${esc(hName)}</th><th>Faire odds ${esc(aName)}</th></tr></thead><tbody>${lad.map(r => `<tr class="${r.L === main.L ? 'main' : ''}"><td class="l mono">${ahFmt(r.L)}${r.L === main.L ? ' <span class="tag">hoofdlijn</span>' : ''}</td><td class="mono">${pct(r.w, 1)}</td><td class="mono">${pct(r.p, 1)}</td><td class="mono">${pct(r.l, 1)}</td><td class="mono">${oddsFmt(r.oH)}</td><td class="mono">${oddsFmt(r.oA)}</td></tr>`).join('')}</tbody></table></div>`;
}
function ahBox(M, N, h, a) {
  return `<div class="kbox ahbox"><h4>Asian handicap</h4>${ahTable(M, N, tName(h), tName(a), 1)}<span>Lijn voor ${esc(tName(h))}; ${esc(tName(a))} krijgt de tegengestelde lijn. Kwartlijnen (bv. −0,75) zijn een halve inzet op beide buurlijnen; “terug” is de kans dat (een deel van) de inzet wordt terugbetaald. Faire odds = zonder bookmakermarge.</span></div>`;
}
function addDaysStr(d, n) { const t = new Date(Date.parse(d) + n * 864e5); return t.toISOString().slice(0, 10); }
function upcomingSets(sid) {
  const today = refDate(), out = [];
  Object.values(S.comps).forEach(c => {
    const ms = S.matches.filter(m => m.s === sid && m.c === c.id && !played(m) && m.d && m.d >= addDaysStr(today, -1)).sort((a, b) => (a.d + (a.t || '')).localeCompare(b.d + (b.t || '')) || a.id - b.id);
    if (!ms.length) return;
    let groups = [];
    if (c.type === 'league') {
      const L = leagueInfo(sid, c.id), byR = new Map();
      ms.forEach(m => { const r = L.rOf.get(m.id); if (!byR.has(r)) byR.set(r, []); byR.get(r).push(m); });
      // een ronde hoort bij de week van de meeste duels; losse inhaalduels ver in de toekomst tellen niet als 'volgende ronde'
      groups = [...byR.entries()].map(([r, g]) => ({label: 'Speelronde ' + r, ms: g, d: g[Math.floor(g.length / 2)].d})).filter(g => g.ms.length >= Math.min(3, L.n / 4)).sort((a, b) => a.d.localeCompare(b.d));
    } else {
      let cur = null; ms.forEach(m => { if (!cur || daysBetween(cur.last, m.d) > 3) { cur = {ms: [], d: m.d, last: m.d}; groups.push(cur); } cur.ms.push(m); cur.last = m.d; });
      groups.forEach(g => { const rs = [...new Set(g.ms.map(m => m.r).filter(Boolean))]; g.label = c.type === 'euro' && rs.length === 1 ? 'Speeldag ' + rs[0] : fmtDate(g.d) + (g.last !== g.d ? ' – ' + fmtDate(g.last) : ''); });
    }
    if (groups.length) out.push({c, groups});
  });
  return out;
}
function pouleHTML(sid) {
  const sc = S.seasons[sid].comps.NED2; if (!sc) return ''; const roda = findTeam('Roda JC', 'club', sc.teams); if (!roda) return '';
  const today = refDate(); const m = S.matches.filter(x => x.s === sid && x.c === 'NED2' && !played(x) && x.d && x.d >= today && (x.h === roda || x.a === roda)).sort((a, b) => (a.d + (a.t || '')).localeCompare(b.d + (b.t || '')))[0];
  if (!m) return '';
  const P = predictMatch(sid, m), adv = pouleAdvice(P, roda), opp = tName(m.h === roda ? m.a : m.h), rk = m.h === roda ? 0 : 2;
  const pw = P.pb[rk], pd = P.pb[1], pl = P.pb[2 - rk];
  return `<section class="poule"><h3>Poule-advies: ${esc(tName(m.h))} – ${esc(tName(m.a))} <small>· ${fmtDate(m.d)}${m.t ? ' ' + esc(m.t) : ''}</small></h3>
  <p>Kansen (${esc(P.hasOdds ? 'markt + model' : 'alleen model')}): Roda wint <b>${pct(pw)}</b> · gelijk <b>${pct(pd)}</b> · ${esc(opp)} wint <b>${pct(pl)}</b>.</p>
  <div class="tw"><table class="tbl compact"><thead><tr><th class="l">Voorspelling (Roda eerst)</th><th>Verwachte punten</th><th>Kans exact</th></tr></thead><tbody>
  ${adv.slice(0, 5).map((x, k) => `<tr${k ? '' : ' class="best"'}><td class="l"><b>${x.a}–${x.b}</b>${k ? '' : ' <small class="tag">beste keuze</small>'}</td><td class="mono">${num(x.ep, 2)}</td><td class="mono">${pct(x.exact, 1)}</td></tr>`).join('')}
  </tbody></table></div>
  <p class="dim">Verwachte punten volgens de poule-regels (exact 5, juist doelsaldo 3, juiste uitkomst 2), berekend over alle mogelijke uitslagen. De beste keuze is niet altijd de meest waarschijnlijke uitslag: een voorspelling die bij veel uitslagen nog 2 of 3 punten oplevert, scoort gemiddeld vaak beter. Topscorerpunten zitten hier niet in.</p></section>`;
}

function pageWeek() {
  const sid = SID(), k = ui.weekOff || 0, sets = upcomingSets(sid);
  const types = ui.weekTypes || {league: true, euro: true, nation: true};
  const tabs = `<div class="tabs">${[[0, 'Volgende speelronde'], [1, 'Speelronde daarna']].map(([v, l]) => `<button class="${k === v ? 'on' : ''}" data-act="weekoff" data-v="${v}">${l}</button>`).join('')}
    ${['league', 'euro', 'nation'].map(t => `<label class="chk"><input type="checkbox" data-change="weektype" data-k="${t}" ${types[t] ? 'checked' : ''}> ${TYPE_LABEL[t]}</label>`).join('')}</div>`;
  const blocks = sets.filter(x => types[x.c.type] && x.groups[k]).map(({c, groups}) => {
    const g = groups[k];
    const rows = g.ms.map(m => {
      const P = predictMatch(sid, m), pb = P.pb, hn = tName(m.h), an = tName(m.a), pl = P.play, open = ui.ahOpen === m.id;
      const play = `<b>${esc(pl.label)}</b><br><small>${esc(P.sure)} · faire odds ${num(pl.fair, 2)}${pl.odds ? ` · beste ${num(pl.odds, 2)} ${esc(pl.bm)}${pl.via ? ' (' + pl.via + ')' : ''} → <span class="${pl.ev >= vset('valueThr') ? 'pos' : 'dim'}">${pl.ev >= 0 ? '+' : ''}${pct(pl.ev, 1)}</span>` : ''}</small>${P.value ? `<br><small class="alt">Waarde: <b>${esc(P.value.label)}</b> @ ${num(P.value.odds, 2)} (+${pct(P.value.ev, 1)})</small>` : ''}`;
      const dev = P.dev ? `<b>${esc(P.dev.label)}</b><br><small>model ${pct(P.dev.pm)} · markt ${pct(P.dev.pk)}</small>` : (P.hasOdds ? '<span class="dim">eens</span>' : '<span class="dim">geen odds</span>');
      return `<tr><td class="l mono dim hide-s">${fmtDate(m.d)}${m.t ? ' ' + esc(m.t) : ''}</td><td class="l wm">${teamLink(m.h)} – ${teamLink(m.a)}<small class="show-s">${fmtDate(m.d)}${m.t ? ' ' + esc(m.t) : ''}</small><small class="blk">${P.hasOdds ? 'markt + model' : 'alleen model'}${P.inj && (P.inj[4].length || P.inj[5].length) ? ' · afwezigen verwerkt' : ''}</small><small class="show-s mono">1 ${pct(pb[0])} · X ${pct(pb[1])} · 2 ${pct(pb[2])}</small></td>
        ${pb.map((x, i) => `<td class="pc hide-s" style="--p:${x.toFixed(3)}"><b>${pct(x)}</b><br><small>${num(1 / x, 2)}</small></td>`).join('')}
        <td class="mono hide-s l">${P.top.slice(0, 3).map(([i, j, v]) => `${i}–${j} <small>${pct(v)}</small>`).join('<br>')}</td>
        <td class="l wp">${play}</td><td class="l hide-s">${dev}</td>
        <td><button class="lnk sm" data-act="ahopen" data-v="${m.id}">${open ? 'sluit' : 'meer'}</button></td></tr>
        ${open ? `<tr class="ahrow"><td colspan="10"><p><b>Waarom deze speelwijze:</b> ${esc(pl.why)}. Bron van de kansen: ${esc(P.src)}.</p>
          <p class="dim">Model alleen: 1 ${pct(P.pm[0])} · X ${pct(P.pm[1])} · 2 ${pct(P.pm[2])} · xG ${num(P.l[0], 2)}–${num(P.l[1], 2)}${P.pk ? ` · Markt alleen: 1 ${pct(P.pk[0])} · X ${pct(P.pk[1])} · 2 ${pct(P.pk[2])}` : ''} · Over 2,5: ${pct(P.over)} · Beide scoren: ${pct(P.btts)}</p>
          ${P.inj ? `<p><b>Afwezig</b> (blessure/schorsing, API-Football): ${esc(hn)}: ${esc(P.inj[4].join(', ') || 'geen belangrijke spelers')} · ${esc(an)}: ${esc(P.inj[5].join(', ') || 'geen belangrijke spelers')}. Verwerkt in de verwachte doelpunten.</p>` : ''}
          ${P.dev ? `<p class="dim">Het model wijkt ${Math.round(Math.abs(P.dev.d) * 100)} procentpunt af van de markt bij ${esc(P.dev.label)}. Vaak weet de markt iets wat het model mist (blessures, schorsingen, rotatie, trainerswissel); soms ziet het model iets (bijv. sterke xG) dat de markt onderschat. Jouw eigen kennis van de ploegen beslist.</p>` : ''}
          ${ahTable(P.M, P.N, hn, an, 1.5)}<p class="dim">Meest waarschijnlijke uitslagen: ${P.top.map(([i, j, v]) => `${i}–${j} (${pct(v, 1)})`).join(' · ')}</p></td></tr>` : ''}`;
    }).join('');
    return `<section class="wk"><h3>${esc(c.name)} <small>· ${esc(g.label)}</small></h3><div class="tw"><table class="tbl compact wkt"><thead><tr><th class="l hide-s">Datum</th><th class="l">Wedstrijd</th><th class="hide-s">1</th><th class="hide-s">X</th><th class="hide-s">2</th><th class="l hide-s">Uitslagen</th><th class="l">Voorspelling en speelwijze</th><th class="l hide-s">Model wijkt af</th><th></th></tr></thead><tbody>${rows}</tbody></table></div></section>`;
  }).join('');
  const missing = Object.values(S.comps).filter(c => types[c.type] && (S.seasons[sid].comps[c.id] || {teams: []}).teams.length && !sets.some(x => x.c.id === c.id && x.groups[k]));
  return `<h2>Komende wedstrijden</h2>${tabs}
    <p class="dim">Per wedstrijd de beste voorspelling: de kans op 1, X en 2 (met faire odds), de meest waarschijnlijke uitslagen, hoe zeker het is en de speelwijze die daarbij past: winst bij een duidelijke favoriet, draw no bet bij een gewone favoriet, en "wint of gelijk" bij een open duel. Waar odds bekend zijn, is de voorspelling de faire marktkans gecombineerd met het model (de markt blijkt scherper, het model corrigeert); anders alleen het model. "Model wijkt af" toont waar het eigen model het duidelijk anders ziet dan de markt. De beste prijs en de waarde staan erbij: een speelwijze die past bij de voorspelling is nog geen goede weddenschap; alleen een groen getal boven ${pct(vset('valueThr'))} is waarde. Speelschema bijgewerkt ${esc(S.dataUpdated || '–')}.</p>
    ${pouleHTML(sid)}
    ${blocks || notice('Geen wedstrijden met een bekende datum gevonden voor deze selectie.', 'info')}
    ${missing.length ? `<p class="dim">Geen wedstrijden gepland in deze periode: ${missing.map(c => esc(c.name)).join(', ')}.</p>` : ''}
    <p class="dim">Blessures en schorsingen (API-Football) worden verwerkt voor de Premier League, Bundesliga, LaLiga, Serie A, Ligue 1, Eredivisie, Süper Lig en een deel van de Europese duels; zie "meer" bij een wedstrijd. Opstellingen zitten er nog niet in. Voor andere competities zonder odds: corrigeer zelf via Teams & correcties.</p>`;
}

const MK_LABEL = {'1x2': '1X2', ah: 'Asian handicap', ou: 'Over/under', dc: 'Dubbele kans', dnb: 'Draw no bet'};
function pageValue() {
  const sid = SID(), all = !!ui.valAll, thr = vset('valueThr');
  const rows = valueBets(sid, {thr: all ? -1 : thr});
  const n = upcomingWithOdds(sid).length, bank = vset('bank');
  const upd = typeof ODDS_UPDATED !== 'undefined' ? ODDS_UPDATED : '';
  const tr = rows.map(v => { const m = v.m, c = S.comps[m.c];
    return `<tr class="${v.ev >= thr ? '' : 'dim'}"><td class="l mono dim hide-s">${fmtDate(m.d)}${v.e.t ? ' ' + esc(v.e.t) : ''}</td>
      <td class="l wm">${esc(tName(m.h))} – ${esc(tName(m.a))}<small class="blk">${esc(c.name)}<span class="show-s"> · ${fmtDate(m.d)}${v.e.t ? ' ' + esc(v.e.t) : ''}</span></small></td>
      <td class="l"><b>${esc(v.label)}</b><br><small>${MK_LABEL[v.mk]} · kans op winst ${pct(v.pWin)}</small>${v.alt ? `<br><small class="alt">Rustiger: <b>${esc(v.alt.label)}</b> @ ${num(v.alt.odds, 2)} (${esc(v.alt.bm)}), min. ${num(v.alt.minOdds, 2)}, waarde +${pct(v.alt.ev, 1)}, kans op winst ${pct(v.alt.pWin)}</small>` : ''}</td>
      <td class="mono hide-s">${pct(v.pModel, 1)}</td><td class="mono hide-s" title="Bron: ${esc(v.src)}">${pct(v.pMarkt, 1)}</td><td class="mono hide-s"><b>${pct(v.p, 1)}</b></td>
      <td class="mono hide-s">${num(v.fair, 2)}</td><td class="mono"><b>${num(v.minOdds, 2)}</b></td>
      <td class="mono">${num(v.odds, 2)}<br><small>${esc(v.bm)}</small></td>
      <td class="mono"><b>${v.ev >= 0 ? '+' : ''}${pct(v.ev, 1)}</b></td><td class="mono">${v.stake ? '€' + v.stake : '–'}</td></tr>`; }).join('');
  const log = clvLog(sid), withC = log.filter(k => k.clv != null), settled = log.filter(k => k.res != null);
  const avg = a => a.length ? a.reduce((s, x) => s + x, 0) / a.length : null;
  const staked = settled.reduce((s, k) => s + (k.stake || 0), 0), pnl = settled.reduce((s, k) => s + (k.pnl || 0), 0);
  const logRows = log.slice(0, 200).map(k => `<tr><td class="l mono dim">${fmtDate(k.d)}</td><td class="l wm">${esc(k.h)} – ${esc(k.a)}<small class="blk">${esc((S.comps[k.c] || {}).name || k.c)}</small></td>
    <td class="l">${esc(k.label)}<br><small>${MK_LABEL[k.mk]} · gemarkeerd ${esc(String(k.at || '').slice(0, 16).replace('T', ' '))}</small></td><td class="mono">${num(k.odds, 2)}<br><small>${esc(k.bm || '')}</small></td>
    <td class="mono">${k.pClose != null ? num(1 / k.pClose, 2) : '–'}</td><td class="mono"><b>${k.clv == null ? '–' : (k.clv >= 0 ? '+' : '') + pct(k.clv, 1)}</b></td>
    <td class="mono">${k.match && played(k.match) ? k.match.hg + '–' + k.match.ag : '–'}</td><td class="mono">${k.pnl == null ? '–' : (k.pnl >= 0 ? '+€' : '−€') + num(Math.abs(k.pnl), 2)}</td></tr>`).join('');
  return `<h2>Waarde</h2>
  <p class="dim">Per duel de beste speelwijze: de markt met de meeste waarde, en als die er is een <b>rustiger alternatief</b> (bijvoorbeeld draw no bet of dubbele kans) met bijna evenveel waarde maar meer kans op winst. Per keuze: de <b>marktkans</b> (odds van een scherpe bookmaker of de exchange, zonder marge), de <b>modelkans</b> en de <b>combinatie</b> (${pct(1 - vset('valueW'))} markt, ${pct(vset('valueW'))} model). Waarde = combinatiekans × beste prijs − 1. De tool toont per duel en markt de beste keuze vanaf ${pct(thr)} waarde. <b>Min. odds</b> is de laagste odds waarbij een weddenschap nog genoeg waarde heeft: controleer de prijs bij je eigen bookmaker en wed alleen als die minstens zo hoog is. Inzet = ¼-Kelly van een bank van €${bank}, maximaal ${pct(vset('maxStake'))} per duel. Bank, gewicht en drempel stel je in onder Instellingen → Waarde en inzet.</p>
  <div class="tabs"><label class="chk"><input type="checkbox" data-change="valall" ${all ? 'checked' : ''}> Ook duels onder de drempel tonen</label></div>
  ${rows.length ? `<div class="tw"><table class="tbl compact wkt"><thead><tr><th class="l hide-s">Aftrap</th><th class="l">Wedstrijd</th><th class="l">Keuze</th><th class="hide-s">Model</th><th class="hide-s">Markt</th><th class="hide-s">Comb.</th><th class="hide-s">Faire odds</th><th title="Minimaal benodigde odds voor ${pct(thr)} waarde">Min. odds</th><th>Beste prijs</th><th>Waarde</th><th>Inzet</th></tr></thead><tbody>${tr}</tbody></table></div>`
    : notice(n ? `Geen weddenschap met minstens ${pct(thr)} waarde bij de ${n} komende duels met odds. Dat is normaal: de markt is meestal scherp.` : 'Nog geen odds bekend voor komende duels. Ze worden elke twee uur opgehaald en bij de dagelijkse update meegenomen.', 'info')}
  <p class="dim">Odds bijgewerkt: ${esc(upd || '–')}. Prijzen bewegen: wat hier staat kan intussen veranderd zijn. Wed nooit met geld dat je niet kunt missen; ook met een echt voordeel horen lange verliesreeksen erbij.</p>
  ${opinionHTML(sid)}
  <h3>CLV-logboek</h3>
  <p class="dim">Elke markering wordt bewaard met de odds op dat moment. Na de aftrap vergelijken we met de faire slotkoers. Gemiddeld positieve closing line value (CLV) over 100–200 markeringen is het beste bewijs dat de aanpak werkt, veel eerder dan winst of verlies dat laat zien.</p>
  <div class="kpis"><div><b>${log.length}</b><small>markeringen</small></div><div><b>${withC.length ? (avg(withC.map(k => k.clv)) >= 0 ? '+' : '') + pct(avg(withC.map(k => k.clv)), 1) : '–'}</b><small>gem. CLV (${withC.length} met slotkoers)</small></div><div><b>${withC.length ? pct(withC.filter(k => k.clv > 0).length / withC.length) : '–'}</b><small>beter dan slotkoers</small></div><div><b>${settled.length ? (pnl >= 0 ? '+€' : '−€') + num(Math.abs(pnl), 2) : '–'}</b><small>resultaat op €${num(staked, 0)} inzet</small></div></div>
  ${withC.length ? perCompCLV(withC) : ''}
  ${log.length ? `<div class="tw"><table class="tbl compact"><thead><tr><th class="l">Datum</th><th class="l">Wedstrijd</th><th class="l">Keuze</th><th>Odds</th><th>Faire slot</th><th>CLV</th><th>Uitslag</th><th>Resultaat</th></tr></thead><tbody>${logRows}</tbody></table></div>` : notice('Nog geen markeringen opgeslagen.', 'info')}`;
}

function perCompCLV(rows) {
  const by = {}; rows.forEach(k => (by[k.c] = by[k.c] || []).push(k));
  return `<details class="notes"><summary>CLV per competitie (om te zien waar het model het meest toevoegt)</summary><div class="tw"><table class="tbl compact"><thead><tr><th class="l">Competitie</th><th>Markeringen</th><th>Gem. CLV</th><th>Beter dan slot</th><th>Modelgewicht nu</th></tr></thead><tbody>${Object.entries(by).sort((a, b) => b[1].length - a[1].length).map(([c, a]) => { const m = a.reduce((s, k) => s + k.clv, 0) / a.length;
    return `<tr><td class="l">${esc((S.comps[c] || {}).name || c)}</td><td class="mono">${a.length}</td><td class="mono">${m >= 0 ? '+' : ''}${pct(m, 1)}</td><td class="mono">${pct(a.filter(k => k.clv > 0).length / a.length)}</td><td class="mono">${num(wFor(c), 2)}</td></tr>`; }).join('')}</tbody></table></div>
  <p class="dim">Pas na zo'n 30+ markeringen per competitie zegt dit iets. Is de CLV in een competitie duidelijk positiever, dan kan het model daar zwaarder meetellen (Instellingen → Modelgewicht per competitie).</p></details>`;
}
function opinionHTML(sid) {
  const ops = modelOpinions(sid);
  const rows = ops.slice(0, 40).map(o => { const m = o.m, c = o.calm;
    return `<tr><td class="l mono dim hide-s">${fmtDate(m.d)}${o.e.t ? ' ' + esc(o.e.t) : ''}</td><td class="l wm">${esc(tName(m.h))} – ${esc(tName(m.a))}<small class="blk">${esc(S.comps[m.c].name)}<span class="show-s"> · ${fmtDate(m.d)}${o.e.t ? ' ' + esc(o.e.t) : ''}</span></small></td>
      <td class="l">${esc(o.side.label.replace(/^[12] /, ''))}<br><small>model ${pct(o.side.pModel)} · markt ${pct(o.side.pMarkt)}</small></td>
      <td class="l"><b>${esc(c.label)}</b><br><small>${MK_LABEL[c.mk]} · kans op winst ${pct(c.pWin)}${o.only ? ' · geen rustiger markt in de data' : ''}</small></td>
      <td class="mono">${num(c.odds, 2)}<br><small>${esc(c.bm)}</small></td><td class="mono">${num(c.minOdds, 2)}</td><td class="mono">${c.ev >= 0 ? '+' : ''}${pct(c.ev, 1)}</td></tr>`; }).join('');
  return `<h3>Mening van het model <small class="tag">geen waarde</small></h3>
  <p class="dim">Duels waar het model een kant duidelijk sterker inschat dan de markt (minstens 4 procentpunt), maar waar geen weddenschap de drempel haalt. Per duel de rustigste manier om die kant te spelen (draw no bet of dubbele kans als die er is). <b>Dit is geen advies:</b> het model is gemiddeld minder scherp dan de markt, dus de verwachte waarde is meestal negatief. Leuk voor je poule of een kleine gok voor de lol, niet om geld mee te verdienen. Pas als de prijs bij je bookmaker minstens de minimale odds is, is er volgens de berekening wél waarde.</p>
  ${rows ? `<div class="tw"><table class="tbl compact wkt"><thead><tr><th class="l hide-s">Aftrap</th><th class="l">Wedstrijd</th><th class="l">Model ziet sterker</th><th class="l">Rustigste speelwijze</th><th>Beste prijs</th><th>Min. odds</th><th>Waarde</th></tr></thead><tbody>${rows}</tbody></table></div>` : notice('Geen duels waar het model duidelijk afwijkt van de markt.', 'info')}`;
}

function pageReview() {
  const sid = SID(), ST = 10;
  if (!ui.revOn) return `<h2>Terugblik</h2><p class="dim">Hoe pakten de voorspellingen uit bij wedstrijden die al gespeeld zijn? Voor elk duel met odds van vóór de aftrap rekent de tool de voorspelling opnieuw uit met alleen de data van vóór die speelweek, en vergelijkt die met de uitslag. Daarnaast: wat had €${ST} op de speelwijze per duel opgeleverd, en wat de waarde-bets. Het rekenen duurt een paar seconden.</p><button class="btn pri" data-act="revrun">Terugblik berekenen</button>`;
  const R = ui.revData || (ui.revData = reviewRows(sid));
  if (!R.length) return `<h2>Terugblik</h2>` + notice('Nog geen gespeelde duels met odds van vóór de aftrap.', 'info');
  const sum = a => a.reduce((s, x) => s + x, 0), eur = v => (v >= 0 ? '+€' : '−€') + num(Math.abs(v), 2);
  const stats = rows => { const pl = rows.filter(r => r.res != null), vb = rows.filter(r => r.vres != null), wk = rows.filter(r => r.brK != null);
    return {n: rows.length, hit: sum(rows.map(r => +r.hit)) / rows.length, hitM: sum(rows.map(r => +r.hitM)) / rows.length, hitK: wk.length ? sum(wk.map(r => +r.hitK)) / wk.length : null,
      brC: sum(rows.map(r => r.brC)) / rows.length, brM: sum(rows.map(r => r.brM)) / rows.length, brK: wk.length ? sum(wk.map(r => r.brK)) / wk.length : null,
      pn: pl.length, ppl: sum(pl.map(r => r.res)) * ST, vn: vb.length, vpl: sum(vb.map(r => r.vres)) * ST}; };
  const A = stats(R);
  const byWeek = {}; R.forEach(r => (byWeek[weekStart(r.m.d)] = byWeek[weekStart(r.m.d)] || []).push(r));
  const weeks = Object.keys(byWeek).sort().reverse();
  const days = [...new Set(R.map(r => r.m.d))].sort().reverse().slice(0, ui.revDays || 3);
  const dayHTML = days.map(dd => { const rs = R.filter(r => r.m.d === dd), s = stats(rs);
    return `<section class="wk"><h3>${fmtDate(dd)} <small>· ${rs.length} duels · uitkomst goed ${s.n ? Math.round(s.hit * s.n) : 0}/${s.n} · speelwijze ${eur(s.ppl)} · waarde-bets ${s.vn} (${eur(s.vpl)})</small></h3><div class="tw"><table class="tbl compact wkt"><thead><tr><th class="l">Wedstrijd</th><th>Uitslag</th><th class="hide-s">1</th><th class="hide-s">X</th><th class="hide-s">2</th><th>Goed?</th><th class="l">Speelwijze</th><th>Resultaat</th><th class="l hide-s">Waarde-bet</th></tr></thead><tbody>
    ${rs.map(r => { const P = r.P, pl = P.play;
      return `<tr><td class="l wm">${esc(tName(r.m.h))} – ${esc(tName(r.m.a))}<small class="blk">${esc(S.comps[r.m.c].name)}</small><small class="show-s mono">1 ${pct(P.pb[0])} · X ${pct(P.pb[1])} · 2 ${pct(P.pb[2])}</small></td><td class="mono"><b>${r.m.hg}–${r.m.ag}</b></td>
      ${P.pb.map((x, i) => `<td class="pc hide-s" style="--p:${x.toFixed(3)}">${i === r.y ? '<b>' + pct(x) + '</b>' : pct(x)}</td>`).join('')}
      <td>${r.hit ? '<span class="pos">✓</span>' : '<span class="dim">✗</span>'}</td>
      <td class="l wp">${esc(pl.label)}<br><small>${pl.odds ? '@ ' + num(pl.odds, 2) + (pl.bm === 'benaderd' ? ' (benaderd)' : '') : 'geen prijs'}</small></td>
      <td class="mono">${r.res == null ? '–' : `<span class="${r.res > 0 ? 'pos' : r.res < 0 ? 'neg' : 'dim'}">${eur(r.res * ST)}</span>`}</td>
      <td class="l hide-s">${r.vb ? `${esc(r.vb.label)} @ ${num(r.vb.odds, 2)}<br><small>${eur(r.vres * ST)}</small>` : '<span class="dim">–</span>'}</td></tr>`; }).join('')}
    </tbody></table></div></section>`; }).join('');
  return `<h2>Terugblik</h2>
  <p class="dim">Voorspellingen opnieuw berekend met alleen data van vóór de speelweek, odds van vóór de aftrap (football-data.co.uk; faire kans uit Betfair Exchange, prijs van Bet365 als bookmaker met Nederlandse vergunning). Inzet in deze terugblik: €${ST} per bet. Prijzen voor draw no bet en dubbele kans zijn benaderd uit de beste 1X2-odds en in het echt vaak iets lager. Ekstraklasa, Keuken Kampioen Divisie en Europese duels ontbreken nog (geen odds van vóór de aftrap).</p>
  <div class="kpis"><div><b>${A.n}</b><small>duels</small></div>
  <div><b>${pct(A.hit)}</b><small>uitkomst goed (combinatie) · model ${pct(A.hitM)} · markt ${pct(A.hitK)}</small></div>
  <div><b>${num(A.brC, 3)}</b><small>Brier combinatie · model ${num(A.brM, 3)} · markt ${num(A.brK, 3)} (lager = beter)</small></div>
  <div><b>${eur(A.ppl)}</b><small>speelwijze op ${A.pn} duels (${pct(A.ppl / (A.pn * ST), 1)} van €${A.pn * ST})</small></div>
  <div><b>${eur(A.vpl)}</b><small>${A.vn} waarde-bets (${A.vn ? pct(A.vpl / (A.vn * ST), 1) : '–'} van €${A.vn * ST})</small></div></div>
  <details class="notes"><summary>Per week</summary><div class="tw"><table class="tbl compact"><thead><tr><th class="l">Week van</th><th>Duels</th><th>Uitkomst goed</th><th>Speelwijze</th><th>Waarde-bets</th></tr></thead><tbody>
  ${weeks.map(w => { const s = stats(byWeek[w]); return `<tr><td class="l mono">${fmtDate(w)}</td><td class="mono">${s.n}</td><td class="mono">${pct(s.hit)}</td><td class="mono">${eur(s.ppl)}</td><td class="mono">${s.vn} · ${eur(s.vpl)}</td></tr>`; }).join('')}
  </tbody></table></div></details>
  <p class="dim">Eén dag of week zegt weinig: bij 25 bets van €${ST} schommelt het resultaat al gauw €30 heen en weer. Kijk naar de totalen over het seizoen.</p>
  ${dayHTML}
  <div class="row"><button class="btn" data-act="revmore">${(ui.revDays || 3) < 30 ? 'Meer dagen tonen' : 'Minder dagen'}</button></div>`;
}

function pageMyBets() {
  const sid = SID(); S.mybets = S.mybets || []; const mb = ui.mb = ui.mb || {legs: []};
  const today = refDate(), up = S.matches.filter(m => m.s === sid && !played(m) && m.d && m.d >= today && m.d <= addDaysStr(today, 10) && S.comps[m.c] && S.comps[m.c].type !== 'nation')
    .sort((a, b) => (a.d + (a.t || '')).localeCompare(b.d + (b.t || '')));
  const m = up.find(x => String(x.id) === String(mb.mid));
  const qn = baseNorm(mb.q || ''), upQ = qn ? up.filter(x => (m && x.id === m.id) || baseNorm(tName(x.h) + ' ' + tName(x.a) + ' ' + S.comps[x.c].name).includes(qn)) : up;
  const LO = m ? legOptions(sid, m) : null;
  const opt = LO && mb.opt != null ? LO.opts[+mb.opt] : null;
  const form = `<div class="poule"><h3>Bet samenstellen</h3><div class="row wrap">
    <label>Zoek wedstrijd of team<input id="mbQ" type="search" data-input="mbsearch" placeholder="bv. PSV, Roda, Arsenal" value="${esc(mb.q || '')}" autocomplete="off"></label>
    <label>Wedstrijd<select id="mbSel" data-change="mbmatch"><option value="">kies… (${mb.q ? upQ.length + ' gevonden' : up.length + ' wedstrijden'})</option>${upQ.map(x => `<option value="${x.id}" data-s="${esc(baseNorm(tName(x.h) + ' ' + tName(x.a) + ' ' + S.comps[x.c].name))}" ${m && x.id === m.id ? 'selected' : ''}>${fmtDate(x.d)} ${esc(x.t || '')} · ${esc(tName(x.h))} – ${esc(tName(x.a))} (${esc(S.comps[x.c].name)})</option>`).join('')}</select></label>
    ${LO ? `<label>Markt<select data-change="mbopt"><option value="">kies…</option>${LO.opts.map((o, i) => `<option value="${i}" ${String(mb.opt) === String(i) ? 'selected' : ''}>${esc(o.label)} — tool ${pct(o.q * (1 - o.pp))}${o.pp > 0.005 ? ' (+' + pct(o.pp) + ' geld terug)' : ''}</option>`).join('')}</select></label>` : ''}
    ${opt ? `<label>Odds<input id="mbOdds" type="number" step="0.01" min="1.01" placeholder="bv. 1,85"></label><label>Jouw kans (%)<input id="mbOwn" type="number" step="1" min="1" max="99" placeholder="bv. 70"></label><button class="btn" data-act="mbadd">Toevoegen</button>` : ''}
  </div>${opt ? `<p class="dim">Faire odds volgens de tool: ${num(1 / opt.q, 2)}. Jouw kans is optioneel, maar juist daarmee zie je later of je eigen inschatting klopt.</p>` : ''}
  ${mb.legs.length ? `<table class="tbl compact"><tbody>${mb.legs.map((l, i) => `<tr><td class="l">${esc(l.h)} – ${esc(l.a)}<br><small>${esc(l.label)}</small></td><td class="mono">${num(l.odds, 2)}</td><td class="mono">tool ${pct(l.tool)}${l.own != null ? ' · jij ' + pct(l.own) : ''}</td><td><button class="lnk sm" data-act="mbdel" data-v="${i}">weg</button></td></tr>`).join('')}</tbody></table>
    <div class="row wrap"><span class="mono">Totale odds <b>${num(mb.legs.reduce((s, l) => s * l.odds, 1), 2)}</b> · ${mb.legs.length > 1 ? 'acca' : 'losse bet'}</span>
    <label>Inzet (€)<input id="mbStake" type="number" step="1" min="0" value="5"></label><label class="chk"><input type="checkbox" id="mbPaper" checked> op papier (niet echt ingezet)</label>
    <button class="btn pri" data-act="mbsave">Bet opslaan</button></div>` : ''}</div>`;
  const rows = S.mybets.map(b => Object.assign({b}, myBetStatus(sid, b))).sort((x, y) => (y.b.at || '').localeCompare(x.b.at || ''));
  const done = rows.filter(r => r.state !== 'open'), stake = done.reduce((s, r) => s + r.b.stake, 0), pnl = done.reduce((s, r) => s + r.pnl, 0);
  const legsDone = rows.flatMap(r => r.legs.filter(l => l.res != null)), hit = legsDone.filter(l => l.res > 0).length;
  const own = legsDone.filter(l => l.own != null), br = (p, w) => Math.pow(p - (w ? 1 : 0), 2);
  const brOwn = own.length ? own.reduce((s, l) => s + br(l.own, l.res > 0), 0) / own.length : null, brTool = own.length ? own.reduce((s, l) => s + br(l.tool, l.res > 0), 0) / own.length : null;
  const buckets = [[0, .5], [.5, .6], [.6, .7], [.7, .8], [.8, .9], [.9, 1.01]].map(([a, b]) => { const x = own.filter(l => l.own >= a && l.own < b); return {a, b, n: x.length, p: x.length ? x.reduce((s, l) => s + l.own, 0) / x.length : 0, w: x.length ? x.filter(l => l.res > 0).length / x.length : 0}; }).filter(x => x.n);
  const eur = v => (v >= 0 ? '+€' : '−€') + num(Math.abs(v), 2);
  return `<h2>Mijn bets</h2><p class="dim">Leg hier je eigen bets en acca's vast, ook op papier. Per onderdeel bewaart de tool zijn eigen kans en, als je die invult, jouw kans. Uitslagen worden automatisch verwerkt. Na een paar maanden zie je of jouw inschatting beter is dan die van de tool, en wat het had opgeleverd. Opgeslagen in deze browser; maak af en toe een export via Data.</p>
  ${form}
  <div class="kpis"><div><b>${rows.length}</b><small>bets (${rows.filter(r => r.state === 'open').length} open)</small></div><div><b>${done.length ? eur(pnl) : '–'}</b><small>resultaat op €${num(stake, 0)} (${stake ? pct(pnl / stake, 1) : '–'})</small></div>
  <div><b>${legsDone.length ? pct(hit / legsDone.length) : '–'}</b><small>onderdelen goed (${hit}/${legsDone.length})</small></div>
  <div><b>${brOwn != null ? num(brOwn, 3) : '–'}</b><small>Brier jouw kans · tool ${brTool != null ? num(brTool, 3) : '–'} (lager = beter, ${own.length} onderdelen)</small></div></div>
  ${buckets.length ? `<details class="notes" open><summary>Klopt jouw gevoel? (jouw kans vs uitkomst)</summary><table class="tbl compact"><thead><tr><th class="l">Jouw kans</th><th>Aantal</th><th>Gemiddeld ingeschat</th><th>Uitgekomen</th></tr></thead><tbody>${buckets.map(x => `<tr><td class="l">${pct(x.a)}–${pct(Math.min(1, x.b))}</td><td class="mono">${x.n}</td><td class="mono">${pct(x.p)}</td><td class="mono"><b>${pct(x.w)}</b></td></tr>`).join('')}</tbody></table></details>` : ''}
  ${rows.length ? `<div class="tw"><table class="tbl compact"><thead><tr><th class="l">Bet</th><th>Odds</th><th>Inzet</th><th>Status</th><th>Resultaat</th><th></th></tr></thead><tbody>${rows.map(r => `<tr><td class="l">${r.legs.map(l => `${esc(l.h)} – ${esc(l.a)}: <b>${esc(l.label)}</b> @ ${num(l.odds, 2)}${l.score ? ` <small>(${l.score} ${l.res > 0 ? '✓' : l.res < 0 ? '✗' : '='})</small>` : ''}`).join('<br>')}<br><small>${esc(String(r.b.at || '').slice(0, 10))}${r.b.paper ? ' · papier' : ''}</small></td>
    <td class="mono">${num(r.b.legs.reduce((s, l) => s * l.odds, 1), 2)}</td><td class="mono">€${num(r.b.stake, 2)}</td><td>${esc(r.state)}</td><td class="mono">${r.pnl == null ? '–' : `<span class="${r.pnl > 0 ? 'pos' : r.pnl < 0 ? 'neg' : 'dim'}">${eur(r.pnl)}</span>`}</td><td><button class="lnk sm" data-act="mbrm" data-v="${esc(r.b.id)}">${ui.confirm === 'mbrm' + r.b.id ? 'zeker?' : 'verwijder'}</button></td></tr>`).join('')}</tbody></table></div>` : notice('Nog geen bets vastgelegd.', 'info')}`;
}

// ---------- teams ----------
function viewTeams(sid, cid) {
  const c = S.comps[cid], teams = (S.seasons[sid].comps[cid] || {teams: []}).teams.slice();
  const nat = c.type === 'nation';
  let rows;
  if (nat) {
    const es = eloState();
    rows = teams.map(t => ({t, s: es.get(t) + adjV(t) * 350, base: es.get(t), g: es.games[t] || 0})).sort((a, b) => b.s - a.s);
  } else {
    const f = clubFit(sid);
    rows = teams.map(t => { const r = f.r(t); return {t, a: r.a, d: r.d, s: r.a + r.d + adjV(t), n: f.nm[t] || 0, src: priorOf(sid, t).src}; }).sort((a, b) => b.s - a.s);
  }
  const mu = nat ? 0 : clubFit(sid).mu;
  return `<p class="dim">De schuifregelaar corrigeert de sterkte van een team (blessures, vorm, trainerswissel) van −30 tot +30 punten. Bij clubs is 10 punten ≈ 10% meer verwachte doelpunten vóór en 10% minder tegen; bij landen ≈ 35 Elo-punten. Wijzigingen werken direct door in alle voorspellingen en simulaties.</p>
  <div class="tw"><table class="tbl teams"><thead><tr><th>#</th><th class="l">Team</th>${nat ? '<th>Elo</th><th>Start-Elo</th><th>Duels</th>' : '<th title="Verwachte doelpunten vóór tegen een gemiddelde tegenstander (neutraal)">xG vóór</th><th title="Verwachte doelpunten tegen">xG tegen</th><th title="Verwacht doelsaldo per duel tegen een gemiddelde tegenstander">Sterkte</th><th title="Gewogen duels dit seizoen">Duels</th><th class="hide-s">Startrating</th>'}<th class="l">Correctie</th><th class="l hide-s">Notitie</th></tr></thead><tbody>
  ${rows.map((r, i) => `<tr><td class="pos">${i + 1}</td><td class="l">${esc(tName(r.t))}</td>${nat ? `<td class="mono">${Math.round(r.base)}</td><td class="mono">${esc(S.teams[r.t].elo0 != null ? S.teams[r.t].elo0 : '1350*')}${S.teams[r.t].eloNote === 'aanname' ? ' <i class="tag">aanname</i>' : ''}</td><td class="mono">${r.g}</td>` : `<td class="mono">${num(Math.exp(mu + r.a), 2)}</td><td class="mono">${num(Math.exp(mu - r.d), 2)}</td><td class="mono">${num(Math.exp(mu + r.a + adjV(r.t) / 2) - Math.exp(mu - r.d - adjV(r.t) / 2), 2)}</td><td class="mono">${r.n}</td><td class="hide-s dim">${esc(r.src)}</td>`}
    <td class="l"><input type="range" min="-30" max="30" step="1" id="adj-${esc(r.t)}" value="${Math.round(adjV(r.t) * 100)}" data-change="adj" data-v="${esc(r.t)}" aria-label="Correctie ${esc(tName(r.t))}"><output class="mono">${Math.round(adjV(r.t) * 100)}</output></td>
    <td class="l hide-s"><input type="text" class="note-in" id="adjn-${esc(r.t)}" value="${esc((S.adj[r.t] || {}).note || '')}" placeholder="bv. spits geblesseerd" data-change="adjnote" data-v="${esc(r.t)}"></td></tr>`).join('')}
  </tbody></table></div>
  <details class="notes"><summary>Team hernoemen, alias toevoegen of samenvoegen</summary>
    <div class="row wrap"><label>Team<select id="tmSel">${teams.map(t => `<option value="${t}">${esc(tName(t))}</option>`).join('')}</select></label>
    <label>Nieuwe naam / alias<input id="tmName" type="text" placeholder="naam"></label>
    <button class="btn" data-act="tmrename">Hernoemen</button><button class="btn" data-act="tmalias">Als alias toevoegen</button></div>
    <div class="row wrap"><label>Samenvoegen: dubbel team<select id="tmFrom">${Object.values(S.teams).filter(t => t.kind === (nat ? 'nation' : 'club')).sort((a, b) => a.name.localeCompare(b.name)).map(t => `<option value="${t.id}">${esc(t.name)}</option>`).join('')}</select></label>
    <label>opgaan in<select id="tmTo">${teams.map(t => `<option value="${t}">${esc(tName(t))}</option>`).join('')}</select></label>
    <button class="btn" data-act="tmmerge">${ui.confirm === 'merge' ? 'Bevestig samenvoegen' : 'Samenvoegen'}</button></div>
    <p class="dim">Samenvoegen verplaatst alle wedstrijden, correcties en competitie-inschrijvingen naar het gekozen team en bewaart de oude naam als alias, zodat volgende imports goed koppelen.</p>
  </details>`;
}

// ---------- format ----------
function viewFormat(sid, cid) {
  const c = S.comps[cid], f = c.format;
  const lines = [];
  if (f.kind === 'league') {
    lines.push(`${f.teams || '?'} clubs, ${f.rr === 1 ? 'enkele' : 'dubbele'} competitie, ${f.rounds || '?'} speelronden`, 'Klassering: ' + (f.tiebreak || []).map(k => ({pts: 'punten', gd: 'doelsaldo', gf: 'doelpunten voor', w: 'overwinningen', agf: 'uitdoelpunten', aw: 'uitoverwinningen'}[k] || k)).join(' → '));
    (f.zones || []).forEach(z => lines.push(`Plaats ${z.from}${z.to !== z.from ? '–' + z.to : ''}${z.eligibleOnly ? ' (alleen eerste elftallen)' : ''}: ${ZONE_INFO[z.type] ? ZONE_INFO[z.type].label : z.type}${z.assumed ? ' <i class="tag">aanname</i>' : ''}`));
    if (f.periods) lines.push('Periodes: ' + f.periods.map((p, k) => `P${k + 1} ronde ${p[0]}–${p[1]}`).join(', ') + (f.periodsAssumed ? ' <i class="tag">aanname</i>' : ''));
    if (f.playoff) lines.push(`Play-offs: ${f.playoff.kkdSpots} KKD-clubs (periodekampioenen + hoogst geëindigden zonder ticket) + nr. ${f.playoff.external.pos} ${esc((S.comps[f.playoff.external.comp] || {}).name || '')}; nieuwkomers per ronde ${(f.playoff.ladder || []).join(' / ')}; alles over twee duels` + (f.playoff.assumed ? ' <i class="tag">aanname rondeschema</i>' : ''));
    if (f.ineligible) lines.push('Niet promotiegerechtigd: ' + f.ineligible.map(tName).join(', '));
  } else if (f.kind === 'euro') {
    lines.push(`Competitiefase: ${f.lpMatches} duels per club, één ranglijst`, `Plaats 1–${f.direct}: 1/8 finale · ${f.direct + 1}–${f.playoffTo}: knock-out play-offs · daarna uitgeschakeld`, 'Play-offs, 1/8, kwart- en halve finale over twee duels, hoger geklasseerde club thuis in duel 2, geen uitdoelpuntenregel, verlenging en strafschoppen', 'Finale: één duel op neutraal terrein', 'Loting: play-offs 9/10 vs 23/24, 11/12 vs 21/22, 13/14 vs 19/20, 15/16 vs 17/18; 1/8 finale nrs. 1/2 tegen winnaars 15–18, 3/4 tegen 13/14–19/20 enz.');
  } else if (f.kind === 'groups') {
    lines.push(`Groepen, ${f.rr === 2 ? 'thuis en uit' : 'enkele ronde'}; wedstrijdbelang voor Elo: ${f.importance}`);
    if (f.groupZones) f.groupZones.forEach(z => lines.push(`Plaats ${z.pos}: ${ZONE_INFO[z.type].label}`));
  } else if (f.kind === 'tournament') {
    lines.push(`Groepsfase (enkele ronde), top ${f.perGroup} + ${f.bestThirds} beste nummers 3 naar de knock-outfase; alles op neutraal terrein behalve voor het gastland`, 'Gastland: ' + ((f.host || []).map(tName).join(', ') || 'nog niet ingesteld'));
  } else lines.push('Losse wedstrijden; wedstrijdbelang ' + (f.importance || 'friendly'));
  return `<div class="fmt"><ul class="flist">${lines.map(l => `<li>${l}</li>`).join('')}</ul>${notesHTML(cid)}
  <h3>Configuratie (JSON, aanpasbaar)</h3><p class="dim">Zonetypes: ${Object.keys(ZONE_INFO).join(', ')}. Wijzig bijvoorbeeld zones, periodes of het aantal play-offplaatsen als het reglement verandert.</p>
  <textarea id="fmtJson" class="code" rows="14" spellcheck="false">${esc(JSON.stringify(f, null, 2))}</textarea>
  <div class="row"><button class="btn pri" data-act="savefmt">Format opslaan</button><button class="btn" data-act="hidecomp">${c.hidden ? 'Tonen in navigatie' : 'Verbergen uit navigatie'}</button></div></div>`;
}

// ---------- backtest ----------
function viewBacktest(sid, cid) {
  if (ui.bt !== sid + cid) return `<p>De backtest voorspelt elk gespeeld duel van ${esc(sid)} met alleen de informatie van vóór die speelweek (clubs: wekelijkse herfit; landen: Elo vóór het duel) en vergelijkt met de uitslag.</p><button class="btn pri" data-act="runbt">Backtest uitvoeren</button>`;
  const b = backtest(sid, cid);
  if (!b.n) return notice('Nog geen gespeelde duels met uitslag in dit seizoen.', 'info');
  const row = (l, s) => s ? `<tr><td class="l">${l}</td><td class="mono">${s.n}</td><td class="mono">${num(s.brier, 3)}</td><td class="mono">${num(s.logloss, 3)}</td><td class="mono">${pct(s.acc, 1)}</td></tr>` : '';
  const W = 300, H = 300, pad = 34;
  const pts = b.bins.filter(x => x.n).map(x => [x.p / x.n, x.o / x.n, x.n]);
  const sx = v => pad + v * (W - pad - 10), sy = v => H - pad - v * (H - pad - 10);
  const svg = `<svg viewBox="0 0 ${W} ${H}" class="calib" role="img" aria-label="Kalibratiegrafiek"><rect x="${pad}" y="10" width="${W - pad - 10}" height="${H - pad - 10}" class="cbg"/>${[0, .25, .5, .75, 1].map(v => `<line x1="${sx(v)}" y1="10" x2="${sx(v)}" y2="${H - pad}" class="grid"/><line x1="${pad}" y1="${sy(v)}" x2="${W - 10}" y2="${sy(v)}" class="grid"/><text x="${sx(v)}" y="${H - pad + 16}" text-anchor="middle">${v * 100}%</text><text x="${pad - 6}" y="${sy(v) + 4}" text-anchor="end">${v * 100}%</text>`).join('')}<line x1="${sx(0)}" y1="${sy(0)}" x2="${sx(1)}" y2="${sy(1)}" class="diag"/><polyline points="${pts.map(p => sx(p[0]) + ',' + sy(p[1])).join(' ')}" class="cl"/>${pts.map(p => `<circle cx="${sx(p[0])}" cy="${sy(p[1])}" r="${3 + Math.min(6, Math.sqrt(p[2]) / 3)}" class="cd"><title>voorspeld ${pct(p[0])}, uitgekomen ${pct(p[1])}, n=${p[2]}</title></circle>`).join('')}<text x="${W / 2}" y="${H - 2}" text-anchor="middle" class="ax">voorspelde kans</text></svg>`;
  const last = b.preds.slice(-12).reverse();
  return `<div class="btgrid"><div><table class="tbl"><thead><tr><th class="l">Voorspeller</th><th>n</th><th title="Lager is beter (0 = perfect, 0,667 = gelijke kansen)">Brier</th><th title="Lager is beter">Log-loss</th><th>% juist 1X2</th></tr></thead><tbody>${row('Model', b.model)}${row('Naïef (frequenties tot dan toe)', b.naive)}${row('Markt (geïmporteerde odds)', b.market)}</tbody></table>
  <p class="dim">Brier = som van gekwadrateerde fouten over 1, X en 2. ${b.market ? '' : 'Importeer odds (bijv. football-data.co.uk-bestanden) om met de markt te vergelijken.'}</p>
  <h4>Laatste voorspellingen</h4><div class="tw"><table class="tbl compact"><tbody>${last.map(r => `<tr><td class="l">${esc(tName(r.m.h))} – ${esc(tName(r.m.a))}</td><td class="mono">${r.m.hg}-${r.m.ag}</td><td style="min-width:140px">${bar3(r.p[0], r.p[1], r.p[2], true)}</td></tr>`).join('')}</tbody></table></div></div>
  <div><h4>Kalibratie (alle uitkomsten, per 10%-bak)</h4>${svg}<p class="dim">Punten op de diagonaal = goed gekalibreerd.</p></div></div>`;
}

// ---------- pagina's ----------
function renderPage() { return ({week: pageWeek, review: pageReview, mybets: pageMyBets, value: pageValue, rank: pageRank, data: pageData, seasons: pageSeasons, settings: pageSettings, help: pageHelp}[ui.page] || pageRank)(); }
function pageRank() {
  const sid = SID();
  const tabs = `<div class="tabs">${[['clubs', 'Clubs Europa'], ['leagues', 'Competitiesterkte'], ['nations', 'Landen (Elo)']].map(([k, l]) => `<button class="${ui.rank === k ? 'on' : ''}" data-act="rank" data-v="${k}">${l}</button>`).join('')}</div>`;
  if (ui.rank === 'nations') {
    const es = eloState(); const list = Object.values(S.teams).filter(t => t.kind === 'nation').map(t => ({t: t.id, e: es.get(t.id), g: es.games[t.id] || 0})).sort((a, b) => b.e - a.e);
    return `<h2>Sterkste landen</h2>${tabs}<p class="dim">Elo-rating (start: FIFA-ranglijst 7-10-2026 omgerekend; bijgewerkt met elk geïmporteerd interlandresultaat).</p><div class="tw"><table class="tbl"><thead><tr><th>#</th><th class="l">Land</th><th>Elo</th><th>Duels verwerkt</th></tr></thead><tbody>${list.map((x, i) => `<tr><td class="pos">${i + 1}</td><td class="l">${teamLink(x.t)}</td><td class="mono">${Math.round(x.e)}</td><td class="mono">${x.g}</td></tr>`).join('')}</tbody></table></div>`;
  }
  const f = clubFit(sid);
  const lg = t => { const c = primaryLeague(sid, t); return c ? S.comps[c].short : (S.teams[t].cc || 'overig'); };
  if (ui.rank === 'leagues') {
    const agg = {}; f.T.forEach(t => { const c = primaryLeague(sid, t) || 'overig'; const r = f.r(t); (agg[c] = agg[c] || []).push(r.a + r.d); });
    const rows = Object.entries(agg).map(([c, v]) => ({c, n: v.length, m: v.reduce((a, b) => a + b, 0) / v.length, eu: S.matches.filter(m => m.s === sid && S.comps[m.c] && S.comps[m.c].type === 'euro' && played(m) && (primaryLeague(sid, m.h) === c || primaryLeague(sid, m.a) === c)).length})).sort((a, b) => b.m - a.m);
    return `<h2>Competitiesterkte</h2>${tabs}<p class="dim">Gemiddelde clubsterkte per competitie op de gezamenlijke schaal. De onderlinge verhouding start bij de UEFA-coëfficiënt (aanname) en wordt bijgesteld door Europese duels, omdat clubs uit verschillende competities daar in één model tegen elkaar worden gefit.</p><div class="tw"><table class="tbl"><thead><tr><th>#</th><th class="l">Competitie</th><th>Clubs</th><th>Gem. sterkte</th><th>Europese duels (gespeeld)</th></tr></thead><tbody>${rows.map((r, i) => `<tr><td class="pos">${i + 1}</td><td class="l">${esc(S.comps[r.c] ? S.comps[r.c].name : 'Overige competities')}</td><td class="mono">${r.n}</td><td class="mono">${num(r.m, 2)}</td><td class="mono">${r.eu}</td></tr>`).join('')}</tbody></table></div>`;
  }
  const list = f.T.filter(t => S.teams[t].kind === 'club').map(t => { const r = f.r(t); return {t, s: r.a + r.d + adjV(t), a: r.a, d: r.d, n: f.nm[t] || 0}; }).sort((a, b) => b.s - a.s).slice(0, 150);
  return `<h2>Sterkste clubs van Europa</h2>${tabs}<p class="dim">Gezamenlijke rating over alle competities (top 150). Sterkte = aanvals- plus verdedigingsrating (log-schaal); 0,10 ≈ 10% doelpuntenverhouding.</p><div class="tw"><table class="tbl"><thead><tr><th>#</th><th class="l">Club</th><th class="l">Comp.</th><th>Sterkte</th><th>Aanval</th><th>Verdediging</th><th>Duels</th></tr></thead><tbody>${list.map((x, i) => `<tr><td class="pos">${i + 1}</td><td class="l">${teamLink(x.t)}</td><td class="l dim">${esc(lg(x.t))}</td><td class="mono">${num(x.s, 2)}</td><td class="mono">${num(x.a, 2)}</td><td class="mono">${num(x.d, 2)}</td><td class="mono">${x.n}</td></tr>`).join('')}</tbody></table></div>`;
}
const CSV_EX = {
  league: `seizoen;competitie;datum;ronde;thuis;uit;thuisgoals;uitgoals;odds_1;odds_x;odds_2
2026/27;NED2;2026-10-30;12;Roda JC Kerkrade;MVV Maastricht;2;1;2.10;3.40;3.30
2026/27;NED2;2026-11-06;13;VVV-Venlo;Roda JC Kerkrade;;;;;`,
  euro: `seizoen;competitie;datum;fase;ronde;thuis;uit;thuisgoals;uitgoals;tie;winnaar_na_strafschoppen
2026/27;UCL;2026-10-21;lp;3;Bayern Munich;Arsenal;2;2;;
2027/28;UCL;2028-02-15;po;;Feyenoord;Benfica;1;0;po1;
2027/28;UCL;2028-02-23;po;;Benfica;Feyenoord;2;1;po1;Feyenoord`,
  nation: `seizoen;competitie;datum;groep;ronde;thuis;uit;thuisgoals;uitgoals;neutraal;belang
2026/27;UNL;2026-09-24;A2;1;Netherlands;Germany;1;1;;
2026/27;FRIENDLY;2026-11-18;;;Netherlands;Japan;;;ja;friendly`
};
const JSON_EX = `{
  "seizoen": "2026/27",
  "competitie": "EURO",
  "groepen": { "A": ["England", "Spain", "Croatia", "Albania"], "B": ["..."] },
  "gastland": ["England"],
  "wedstrijden": [
    { "datum": "2028-06-09", "groep": "A", "thuis": "England", "uit": "Albania", "thuisgoals": null, "uitgoals": null }
  ]
}`;
function pageData() {
  const tabs = `<div class="tabs">${[['import', 'Importeren'], ['matches', 'Wedstrijden'], ['backup', 'Back-up']].map(([k, l]) => `<button class="${ui.dataTab === k ? 'on' : ''}" data-act="dtab" data-v="${k}">${l}</button>`).join('')}</div>`;
  if (ui.dataTab === 'backup') {
    return `<h2>Back-up</h2>${tabs}<p>Alle data (wedstrijden, teams, formats, seizoenen, correcties en instellingen) staat alleen in deze browser. Maak regelmatig een back-up.</p>
    <div class="row wrap"><button class="btn pri" data-act="mkbackup">Back-up maken</button><button class="btn" data-act="dlbackup">Downloaden als bestand</button><button class="btn" data-act="copybackup">Kopiëren</button>${ui.backup && ui.backup.startsWith('seizoen;') ? '<button class="btn" data-act="dlcsv">CSV downloaden</button>' : ''}</div>
    <textarea id="backupTxt" class="code" rows="8" readonly placeholder="Klik op 'Back-up maken'; kopieer de tekst en bewaar die als .json-bestand.">${ui.backup ? esc(ui.backup) : ''}</textarea>
    <p class="dim">Bij Downloaden vraagt de pagina eerst om bevestiging. Lukt downloaden niet, gebruik dan Kopiëren.</p>
    <h3>Back-up terugzetten</h3><p>Importeer een back-up via het tabblad Importeren (het bestand wordt herkend). Daarna wordt de huidige data vervangen.</p>
    <h3>Opnieuw beginnen</h3><button class="btn danger" data-act="reset">${ui.confirm === 'reset' ? 'Bevestig: alles wissen en startdata laden' : 'Startdata herstellen'}</button>`;
  }
  if (ui.dataTab === 'matches') {
    const F = ui.filter, sid = F.s || SID(), cid = F.c || ui.comp, q = (F.q || '').toLowerCase();
    let ms = S.matches.filter(m => m.s === sid && (!cid || m.c === cid) && (!q || tName(m.h).toLowerCase().includes(q) || tName(m.a).toLowerCase().includes(q))).sort((a, b) => a.d < b.d ? -1 : 1);
    const total = ms.length; ms = ms.slice(0, 300);
    const e = ui.edit && typeof ui.edit === 'object' ? ui.edit : {s: sid, c: cid, d: todayStr()};
    const kind = isNation(e.c) ? 'nation' : 'club';
    const tl = Object.values(S.teams).filter(t => t.kind === kind).sort((a, b) => a.name.localeCompare(b.name));
    return `<h2>Wedstrijden</h2>${tabs}
    <form class="mform" id="mform" data-submit="savematch"><h3>${e.id ? 'Wedstrijd bewerken' : 'Wedstrijd toevoegen'}</h3>
      <div class="row wrap">
      <label>Seizoen<select id="mfS">${Object.keys(S.seasons).map(k => `<option ${k === e.s ? 'selected' : ''}>${k}</option>`).join('')}</select></label>
      <label>Competitie<select id="mfC" data-change="mfcomp">${Object.values(S.comps).map(c => `<option value="${c.id}" ${c.id === e.c ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></label>
      <label>Datum<input id="mfD" type="date" value="${esc(e.d)}" required></label>
      <label>Ronde<input id="mfR" type="number" min="1" value="${e.r || ''}"></label>
      <label>Fase<select id="mfSt">${['', 'league', 'lp', 'group', 'po', 'r16', 'qf', 'sf', 'f'].map(x => `<option value="${x}" ${(e.st || '') === x ? 'selected' : ''}>${x || '(standaard)'}</option>`).join('')}</select></label>
      <label>Groep<input id="mfG" value="${esc(e.g || '')}" size="4"></label></div>
      <div class="row wrap"><label>Thuis<input id="mfH" list="tlist" value="${esc(e.h ? tName(e.h) : '')}" required></label>
      <label>Uit<input id="mfA" list="tlist" value="${esc(e.a ? tName(e.a) : '')}" required></label>
      <label>Uitslag<span class="pair"><input id="mfHG" type="number" min="0" value="${e.hg != null ? e.hg : ''}" aria-label="Doelpunten thuis"><b>–</b><input id="mfAG" type="number" min="0" value="${e.ag != null ? e.ag : ''}" aria-label="Doelpunten uit"></span></label>
      <label>Winnaar strafschoppen<input id="mfPW" list="tlist" value="${esc(e.pw ? tName(e.pw) : '')}"></label>
      <label class="chk"><input id="mfN" type="checkbox" ${e.n ? 'checked' : ''}> Neutraal</label>
      <label>Tweeluik-id<input id="mfT" value="${esc(e.tie || '')}" size="6"></label>
      <label>Odds 1/X/2<span class="pair"><input id="mfO1" value="${esc(e.o ? e.o.h : '')}" size="4"><input id="mfOX" value="${esc(e.o ? e.o.d : '')}" size="4"><input id="mfO2" value="${esc(e.o ? e.o.a : '')}" size="4"></span></label>
      ${kind === 'nation' ? `<label>Belang<select id="mfI">${['', 'friendly', 'nl', 'qual', 'final'].map(x => `<option ${(e.imp || '') === x ? 'selected' : ''}>${x}</option>`).join('')}</select></label>` : ''}</div>
      <datalist id="tlist">${tl.map(t => `<option value="${esc(t.name)}">`).join('')}</datalist>
      <div class="row"><button class="btn pri" type="submit">${e.id ? 'Wijziging opslaan' : 'Toevoegen'}</button>${e.id ? `<button class="btn" type="button" data-act="newmatch">Nieuw</button><button class="btn danger" type="button" data-act="delmatch" data-v="${e.id}">${ui.confirm === 'del' + e.id ? 'Bevestig verwijderen' : 'Verwijderen'}</button>` : ''}</div>
    </form>
    <h3>Overzicht</h3><div class="row wrap"><label>Seizoen<select id="flS" data-change="filter" data-k="s">${Object.keys(S.seasons).map(k => `<option ${k === sid ? 'selected' : ''}>${k}</option>`).join('')}</select></label>
    <label>Competitie<select id="flC" data-change="filter" data-k="c"><option value="">Alle</option>${Object.values(S.comps).map(c => `<option value="${c.id}" ${c.id === cid ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></label>
    <label>Zoek team<input id="flQ" value="${esc(F.q || '')}" data-change="filter" data-k="q"></label>
    <button class="btn" data-act="exportcsv">Exporteer als CSV</button></div>
    <p class="dim">${total} wedstrijden${total > 300 ? ' (eerste 300 getoond)' : ''}.</p>
    <div class="tw"><table class="tbl compact"><thead><tr><th class="l">Datum</th><th class="l">Comp.</th><th class="l">Thuis</th><th>Uitslag</th><th class="l">Uit</th><th class="l">Bron</th><th></th></tr></thead><tbody>${ms.map(m => `<tr><td class="l mono">${m.d}</td><td class="l">${esc(S.comps[m.c] ? S.comps[m.c].short : m.c)}${m.st && m.st !== 'league' ? ' · ' + esc(m.st) : ''}${m.g ? ' · ' + esc(m.g) : ''}</td><td class="l">${esc(tName(m.h))}</td><td class="mono">${played(m) ? m.hg + '-' + m.ag : '–'}</td><td class="l">${esc(tName(m.a))}</td><td class="l dim">${esc(m.src || '')}</td><td><button class="lnk sm" data-act="editmatch" data-v="${m.id}">bewerken</button></td></tr>`).join('')}</tbody></table></div>`;
  }
  return `<h2>Importeren</h2>${tabs}
  <p>Importeer speelschema's en uitslagen als CSV of JSON, een teamlijst/groepsindeling (JSON) of een volledige back-up. Bestaande wedstrijden (zelfde seizoen, competitie, thuis- en uitploeg en datum) worden bijgewerkt in plaats van verdubbeld; onbekende teamnamen worden gekoppeld via naam, alias of gelijkenis, anders aangemaakt.</p>
  <div class="row wrap"><label>Bestand(en)<input id="impFile" type="file" accept=".csv,.json,.txt" multiple></label>
  <label>Standaardcompetitie (als kolom ontbreekt)<select id="impComp"><option value="">–</option>${Object.values(S.comps).map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}</select></label></div>
  <textarea id="impTxt" class="code" rows="8" placeholder="…of plak hier CSV- of JSON-tekst"></textarea>
  <div class="row"><button class="btn pri" data-act="import">Importeren</button></div>
  ${ui.importRep ? `<div class="note ${ui.importRep.errors && ui.importRep.errors.length ? 'warn' : 'ok'}">${ui.importRep.html}</div>` : ''}
  ${ui.pendingBackup ? `<div class="note warn">Dit is een volledige back-up (${ui.pendingBackup.matches.length} wedstrijden). Terugzetten vervangt alle huidige data. <button class="btn danger" data-act="restore">Back-up terugzetten</button> <button class="btn" data-act="cancelrestore">Annuleren</button></div>` : ''}
  <h3>Voorbeeldformaten</h3>
  <div class="exgrid">${['league', 'euro', 'nation'].map(k => `<div><h4>${TYPE_LABEL[k]} (CSV)</h4><pre class="code">${esc(CSV_EX[k])}</pre><button class="lnk sm" data-act="useex" data-v="${k}">in het invoerveld zetten</button></div>`).join('')}
  <div><h4>Groepen/deelnemers + wedstrijden (JSON)</h4><pre class="code">${esc(JSON_EX)}</pre></div></div>
  <p class="dim">Ook ondersteund: JSON van de football-data.org-API (v4, <code>/competitions/{code}/matches</code>; codes PL, BL1, PD, SA, FL1, DED, PPL, CL, EC, WC), los of als bundel <code>{"fd":[…]}</code> uit het ophaalscript. CSV-bestanden van football-data.co.uk (kolommen Div, Date, HomeTeam, AwayTeam, FTHG, FTAG en odds) voor E0, I1, SP1, D1, F1, P1, B1, N1 en T1. Scheidingsteken komma of puntkomma; datum JJJJ-MM-DD of DD/MM/JJJJ.</p>`;
}
function pageSeasons() {
  const list = Object.values(S.seasons).sort((a, b) => a.id < b.id ? -1 : 1);
  const prop = ui.newSeason;
  return `<h2>Seizoenen</h2>
  <div class="tw"><table class="tbl"><thead><tr><th class="l">Seizoen</th><th class="l">Periode</th><th class="l">Status</th><th>Wedstrijden</th><th></th></tr></thead><tbody>${list.map(s => `<tr><td class="l"><b>${esc(s.id)}</b>${s.id === S.active ? ' <i class="tag">actief</i>' : ''}</td><td class="l mono">${s.start} – ${s.end}</td><td class="l">${s.status}</td><td class="mono">${S.matches.filter(m => m.s === s.id).length}</td><td class="l">${s.status !== 'afgesloten' ? `<button class="btn sm" data-act="closeseason" data-v="${s.id}">${ui.confirm === 'close' + s.id ? 'Bevestig afsluiten' : 'Afsluiten en archiveren'}</button>` : `<button class="btn sm" data-act="viewarch" data-v="${s.id}">Archief bekijken</button>`}</td></tr>`).join('')}</tbody></table></div>
  ${ui.arch && S.seasons[ui.arch] && S.seasons[ui.arch].archive ? archiveHTML(ui.arch) : ''}
  <h3>Nieuw seizoen aanmaken</h3>
  <p>De tool stelt de teamlijsten voor op basis van de eindstand (of, als die nog niet compleet is, de verwachte eindstand uit de laatste simulatie) met promotie en degradatie. Ratings gaan mee naar het nieuwe seizoen met ${pct(S.settings.regress)} terugtrekking richting het competitiegemiddelde (instelbaar); gepromoveerde clubs starten op hun niveau uit de lagere competitie, nieuwe clubs op het competitiegemiddelde min ${num(S.settings.promotedPenalty, 2)}.</p>
  ${!prop ? `<button class="btn pri" data-act="propose">Voorstel maken</button>` : `
  <div class="row wrap"><label>Naam<input id="nsId" value="${esc(prop.id)}"></label><label>Start<input id="nsStart" type="date" value="${esc(prop.start)}"></label><label>Einde<input id="nsEnd" type="date" value="${esc(prop.end)}"></label></div>
  <div class="nsgrid">${Object.keys(prop.lists).map(cid => `<div><h4>${esc(S.comps[cid].name)}</h4>${prop.lists[cid].notes.map(n => `<p class="dim">${esc(n)}</p>`).join('')}<textarea id="ns-${cid}" rows="8" class="code">${esc(prop.lists[cid].teams.map(tName).join('\n'))}</textarea></div>`).join('')}</div>
  <p class="dim">Eén club per regel. Europese toernooien en nationale-teamtoernooien starten leeg: importeer deelnemers en programma zodra de loting bekend is.</p>
  <div class="row"><button class="btn pri" data-act="createseason">Seizoen aanmaken en activeren</button><button class="btn" data-act="cancelseason">Annuleren</button></div>`}`;
}
function archiveHTML(sid) {
  const a = S.seasons[sid].archive;
  return `<section class="arch"><h3>Archief ${esc(sid)} <small class="dim">afgesloten ${esc(a.closedAt)}</small></h3>
  <div class="tw"><table class="tbl"><thead><tr><th class="l">Competitie</th><th>Duels</th><th>Brier model</th><th>Brier naïef</th><th>Log-loss</th><th>% juist</th><th class="l">Kampioen / winnaar</th></tr></thead><tbody>${Object.keys(a.comps).map(cid => { const x = a.comps[cid], m = x.bt.model; return `<tr><td class="l">${esc(S.comps[cid] ? S.comps[cid].name : cid)}</td><td class="mono">${x.bt.n}</td><td class="mono">${m ? num(m.brier, 3) : '–'}</td><td class="mono">${x.bt.naive ? num(x.bt.naive.brier, 3) : '–'}</td><td class="mono">${m ? num(m.logloss, 3) : '–'}</td><td class="mono">${m ? pct(m.acc, 1) : '–'}</td><td class="l">${x.table && x.table[0] ? esc(tName(x.table[0].t)) : '–'}</td></tr>`; }).join('')}</tbody></table></div>
  ${Object.keys(a.comps).filter(c => a.comps[c].table && a.comps[c].table.length).map(cid => `<details class="notes"><summary>Eindstand ${esc(S.comps[cid].name)}</summary><ol class="arch-ol">${a.comps[cid].table.map(r => `<li>${esc(tName(r.t))} <span class="mono dim">${r.pts} ptn · ${r.gd > 0 ? '+' : ''}${r.gd}</span></li>`).join('')}</ol></details>`).join('')}</section>`;
}
function pageSettings() {
  const st = S.settings, f = (k, l, h, step) => `<label>${l}<input id="set-${k}" data-setting="${k}" type="number" step="${step || 'any'}" value="${st[k]}"><small>${h}</small></label>`;
  const t10 = top10cc();
  return `<h2>Instellingen</h2>
  <form class="settings" data-submit="savesettings">
  <h3>Clubmodel (Poisson + Dixon-Coles)</h3><div class="sgrid">
  ${f('halfLife', 'Halfwaardetijd (dagen)', 'Recente duels wegen zwaarder; na deze periode telt een duel half zo zwaar.', 1)}
  ${f('priorMatches', 'Gewicht startrating (duels)', 'Hoeveel duels de startrating “waard” is.', 0.5)}
  ${f('hfaPrior', 'Thuisvoordeel prior (log)', '0,12 ≈ 13% meer doelpunten thuis; wordt per competitie gefit en naar deze waarde getrokken. Getoetst: hogere waarden overschatten de thuisploeg.', 0.01)}
  <label>ρ (Dixon-Coles)<select id="set-rhoMode" data-setting="rhoMode"><option value="fit" ${st.rhoMode === 'fit' ? 'selected' : ''}>Fitten op data</option><option value="fixed" ${st.rhoMode === 'fixed' ? 'selected' : ''}>Vaste waarde</option></select><small>Correctie voor 0-0, 1-0, 0-1, 1-1.</small></label>
  ${f('rhoFixed', 'Vaste ρ', 'Gebruikt bij “vaste waarde” of te weinig data.', 0.01)}
  ${f('maxGoals', 'Max. doelpunten in scorematrix', '', 1)}
  <label>Historie vorig seizoen<select id="set-useHistory" data-setting="useHistory" data-bool="1"><option value="1" ${st.useHistory !== false ? 'selected' : ''}>Meenemen</option><option value="0" ${st.useHistory === false ? 'selected' : ''}>Niet meenemen</option></select><small>Uitslagen van 2025/26 (7 topcompetities volledig, overige deels, Championship en CL) wegen mee via de halfwaardetijd.</small></label>
  ${f('hfaTau', 'Gewicht prior thuisvoordeel (duels)', 'Hoe sterk het thuisvoordeel per competitie naar de prior wordt getrokken.', 1)}
  ${f('hfaTauNoHist', 'Idem, competities zonder historie', 'Voor competities zonder data van vorige seizoenen (KKD, Ekstraklasa): sterker naar de prior, omdat één seizoen toeval bevat.', 1)}
  ${f('xgWeight', 'Gewicht expected goals (0–1)', 'Waar xG bekend is (API-Football), telt het model deze mix van xG en echte doelpunten. 0 = alleen doelpunten.', 0.05)}
  ${f('spread', 'Kalibratie: spreiding', 'Vergroot het krachtsverschil per duel (1 = uit). Afgestemd met de backtest en slotodds.', 0.05)}
  ${f('supCap', 'Kalibratie: verzadiging', 'Remt extreme krachtsverschillen af (0 = uit).', 0.05)}
  </div><h3>Waarde en inzet</h3><div class="sgrid">
  ${f('valueW', 'Gewicht model naast markt (0–1)', 'Aandeel van het model in de combinatiekans; de rest is de faire marktkans. 0,15 gaf in de toets 2026/27 de beste resultaten; hoger werkte slechter.', 0.05)}
  ${f('valueThr', 'Drempel waarde', 'Minimale verwachte waarde om een weddenschap te markeren (0,03 = 3%).', 0.005)}
  ${f('bank', 'Bank (€)', 'Totaalbedrag voor het inzetadvies.', 10)}
  ${f('kellyFrac', 'Kelly-fractie', '0,25 = kwart-Kelly: voorzichtig, omdat de kans zelf een schatting is.', 0.05)}
  ${f('maxStake', 'Maximale inzet per duel (deel van bank)', '0,02 = 2%.', 0.005)}
  <label>Modelgewicht per competitie<input id="set-valueWComp" data-setting="valueWComp" type="text" value="${esc(st.valueWComp || '')}" placeholder="bv. NED2=0.3, POL1=0.2"><small>Overschrijft het algemene gewicht voor die competities. Pas aanpassen als het CLV-logboek daar aanleiding toe geeft.</small></label>
  ${f('injAtt', 'Blessures: effect op aanval', 'Hoe sterk afwezige spelers (aandeel in goals en assists) de verwachte doelpunten verlagen. 0 = uit. Getoetst: 1.', 0.05)}
  ${f('injDef', 'Blessures: effect op verdediging', 'Hoe sterk afwezige verdedigers/keeper de verwachte tegengoals verhogen. 0 = uit. Getoetst: 1.', 0.05)}
  ${f('maxOdds', 'Hoogste odds', 'Outsiders boven deze odds worden overgeslagen (veel marge, veel ruis).', 0.5)}
  </div><h3>Seizoensovergang en startratings</h3><div class="sgrid">
  ${f('regress', 'Terugtrekking naar gemiddelde', '0 = rating volledig meenemen, 1 = iedereen gemiddeld.', 0.01)}
  ${f('promotedPenalty', 'Correctie nieuwe/gepromoveerde club', 'In sterktepunten (log-schaal).', 0.01)}
  ${f('relegatedBonus', 'Bonus gedegradeerde club (start 2026/27)', '', 0.01)}
  ${f('leagueScale', 'Schaal landencoëfficiënt', 'Competitieniveau = schaal × ln(coëfficiënt/60).', 0.01)}
  ${f('tierGap', 'Niveauverschil tweede niveau', '', 0.01)}
  ${f('otherLeague', 'Niveau overige competities', '', 0.01)}
  ${f('clubCoefWeight', 'Gewicht UEFA-clubcoëfficiënt', '', 0.01)}
  </div><h3>Landen (Elo)</h3><div class="sgrid">
  ${f('eloHome', 'Thuisvoordeel (Elo-punten)', 'Niet bij neutraal terrein.', 1)}
  <label>K vriendschappelijk<input id="set-k1" data-elok="friendly" type="number" value="${st.eloK.friendly}"></label>
  <label>K Nations League<input id="set-k2" data-elok="nl" type="number" value="${st.eloK.nl}"></label>
  <label>K kwalificatie<input id="set-k3" data-elok="qual" type="number" value="${st.eloK.qual}"></label>
  <label>K eindtoernooi<input id="set-k4" data-elok="final" type="number" value="${st.eloK.final}"></label>
  ${f('eloGoals', 'Gemiddeld aantal doelpunten interland', 'Voor omrekening Elo → doelpunten.', 0.05)}
  ${f('nationRho', 'ρ interlands', '', 0.01)}
  ${f('eloRegress', 'Elo-terugtrekking per seizoen', '', 0.01)}
  </div><h3>Simulatie</h3><div class="sgrid">
  ${f('mcRuns', 'Aantal runs (min. 10.000)', 'Meer runs = nauwkeuriger, maar trager.', 1000)}
  ${f('simNoise', 'Onzekerheid teamsterkte per run', 'Standaardafwijking in sterktepunten; voorkomt overmoedige kansen.', 0.01)}
  ${f('penShareHome', 'Strafschoppen: kans thuisploeg', '', 0.01)}
  <label>Referentiedatum<input id="set-refDate" data-setting="refDate" type="date" value="${esc(st.refDate)}"><small>Leeg = vandaag. Bepaalt tijdsweging en “verleden zonder uitslag”.</small></label>
  </div>
  <div class="row"><button class="btn pri" type="submit">Instellingen toepassen</button><button class="btn" type="button" data-act="defaults">Standaardwaarden</button><button class="btn" type="button" data-act="reprior">Startratings 2026/27 herberekenen</button></div>
  </form>
  <h3>UEFA-landencoëfficiënt</h3><p class="dim">Bepaalt welke tien competities als top 10 gelden en het startniveau per competitie. Werk bij aan het begin van elk seizoen. De Keuken Kampioen Divisie blijft altijd opgenomen.</p>
  <div class="tw"><table class="tbl"><thead><tr><th>#</th><th class="l">Land</th><th class="l">Code</th><th>Coëfficiënt</th><th class="l">Competitie in tool</th><th></th></tr></thead><tbody>${S.coef.slice().sort((a, b) => b.coef - a.coef).map((x, i) => { const c = Object.values(S.comps).find(c => c.type === 'league' && c.tier === 1 && c.cc === x.cc); return `<tr class="${i < 10 ? '' : 'out'}"><td class="pos">${i + 1}</td><td class="l"><input id="cn-${x.cc}" data-coef="${x.cc}" data-k="name" value="${esc(x.name)}"></td><td class="l mono">${esc(x.cc)}</td><td><input id="cv-${x.cc}" data-coef="${x.cc}" data-k="coef" type="number" step="0.001" value="${x.coef}"></td><td class="l">${c ? esc(c.name) + (c.hidden ? ' (verborgen)' : '') : (i < 10 ? '<b class="warn">ontbreekt – voeg toe ↓</b>' : '–')}</td><td><button class="lnk sm" data-act="delcoef" data-v="${x.cc}">verwijder</button></td></tr>`; }).join('')}</tbody></table></div>
  <div class="row wrap"><label>Land<input id="ncName" placeholder="Tsjechië"></label><label>Code<input id="ncCc" placeholder="CZE" size="4"></label><label>Coëfficiënt<input id="ncCoef" type="number" step="0.001"></label><button class="btn" data-act="addcoef">Land toevoegen</button><button class="btn" data-act="savecoef">Coëfficiënten opslaan</button></div>
  <h3>Competitie toevoegen</h3>
  <div class="row wrap"><label>Code<input id="acId" placeholder="CZE1" size="6"></label><label>Naam<input id="acName" placeholder="Chance Liga"></label><label>Land (code)<input id="acCc" placeholder="CZE" size="4"></label><label>Type<select id="acType"><option value="league">Competitie</option><option value="euro">Europees toernooi</option><option value="nation">Landentoernooi</option></select></label><label>Clubs<input id="acTeams" type="number" value="16"></label><button class="btn" data-act="addcomp">Toevoegen</button></div>
  <p class="dim">Een nieuwe competitie krijgt een standaardformat (dubbele competitie, kampioen = CL, laatste twee degraderen). Pas het format aan onder Format en importeer teams en wedstrijden.</p>`;
}
function pageHelp() {
  return `<article class="help"><h2>Uitleg</h2>
  <h3>Waarde: model en markt gecombineerd</h3>
  <p>Toetsen op 736 duels van 2026/27 lieten zien dat wedden op afwijkingen tussen model en bookmaker verlies oplevert: de slotkoers was gemiddeld ruim 5% scherper dan onze gemarkeerde prijzen. De markt (vooral een scherpe bookmaker als Pinnacle of de Betfair-exchange) voorspelt beter dan het model. Daarom gebruikt de pagina Waarde de <b>faire marktkans</b> (odds zonder marge, berekend met de power-methode, die rekening houdt met de extra marge op outsiders) en laat het model maar 15% meetellen. Een weddenschap wordt gemarkeerd als de beste prijs bij een gangbare bookmaker minstens 3% boven die combinatiekans ligt.</p>
  <p>Dat komt een paar keer per week voor, meestal bij een bookmaker die achterloopt op de markt. Elke markering wordt opgeslagen. Na de aftrap vergelijkt het CLV-logboek de prijs met de faire slotkoers: is die gemiddeld positief, dan werkt de aanpak. Pas na 100–200 markeringen is daar iets zinnigs over te zeggen. Inzetadvies: ¼-Kelly, maximaal 2% van de bank per duel.</p>
  <p>Per duel worden alle markten vergeleken: 1X2, dubbele kans (1X, 12, X2), draw no bet (= Asian handicap 0), handicaplijnen en over/under. Dubbele kans en draw no bet krijgen hun kans uit dezelfde 1X2-kansen, dus alle markten zijn onderling consistent. Een "veiligere" markt maakt een weddenschap zonder waarde niet goed: de bookmaker rekent elke markt uit dezelfde kansen en legt overal marge op. Wel kan bij een weddenschap mét waarde een rustiger alternatief bijna dezelfde waarde hebben met veel minder schommelingen; dat toont de pagina dan als "Rustiger".</p>
  <p>Onder "Mening van het model" staan duels waar het model een kant duidelijk sterker ziet dan de markt maar geen waarde vindt. Dat is bedoeld als informatie (bijvoorbeeld voor een poule), niet als wedadvies.</p>
  <h3>Hoe het model werkt</h3>
  <p><b>Clubs.</b> Elke club heeft een aanvals- en een verdedigingsrating op één gezamenlijke schaal voor alle competities en Europese toernooien. Het verwachte aantal doelpunten van de thuisploeg is exp(μ + thuisvoordeel<sub>competitie</sub> + aanval<sub>thuis</sub> − verdediging<sub>uit</sub>), en omgekeerd voor de uitploeg. De ratings worden gefit met een gewogen Poisson-likelihood over dit seizoen én het vorige seizoen (2025/26: de zeven topcompetities volledig, België, Turkije en de tweede niveaus van Engeland, Duitsland, Spanje, Italië en Frankrijk deels, plus de Champions League). Recente duels wegen zwaarder (halfwaardetijd standaard 365 dagen) en elke club wordt naar een startrating getrokken (prior). Omdat Europese duels in hetzelfde model zitten, bepalen die de onderlinge sterkte van competities. De kans op elke uitslag volgt uit twee Poisson-verdelingen met de Dixon-Coles-correctie (ρ) voor lage scores.</p>
  <p><b>Landen.</b> Een apart Elo-model (startwaarden uit de FIFA-ranglijst van 7-10-2026) met K-factor naar wedstrijdbelang (vriendschappelijk, Nations League, kwalificatie, eindtoernooi), een doelsaldovermenigvuldiger en thuisvoordeel behalve op neutraal terrein. Het Elo-verschil wordt omgezet naar verwachte doelpunten, zodat dezelfde uitslagmarkten beschikbaar zijn.</p>
  <p><b>Knock-out.</b> Bij één duel: 90 minuten, dan verlenging (een derde van de verwachte doelpunten) en strafschoppen. Bij een tweeluik wordt de stand na het eerste duel meegenomen; geen uitdoelpuntenregel.</p>
  <p><b>Simulaties.</b> Monte Carlo met minimaal 10.000 runs. Per run krijgt elke ploeg een kleine willekeurige sterkte-afwijking (modelonzekerheid). Resterende duels worden gesimuleerd met Dixon-Coles-scores; Europese toernooien inclusief loting van play-offs en 1/8 finale binnen de UEFA-seedingparen; de KKD inclusief periodetitels, play-offs en de finale tegen de nr. 16 van de Eredivisie (die tegelijk gesimuleerd wordt).</p>
  <p><b>Expected goals.</b> Voor dit seizoen en (deels) de twee vorige seizoenen komen uitslagen en expected goals (xG) van API-Football. Het model fit dan op een mix van 50% xG en 50% werkelijke doelpunten: xG bevat minder toeval en voorspelt daardoor beter, de echte doelpunten houden de afwerkkwaliteit van ploegen in beeld. De mix is gekozen op de backtest.</p>
  <p><b>Kalibratie.</b> Een puur op uitslagen gebaseerd model is vroeg in het seizoen te voorzichtig: favorieten wonnen in de backtest vaker dan voorspeld. Daarom wordt het krachtsverschil per duel met een factor vergroot (spreiding 1,3) en bij extreme duels afgeremd (verzadiging 1,0). Beide waarden zijn gekozen op de backtest (962 competitieduels, alleen met eerdere data voorspeld) en gecontroleerd tegen slotodds van bookmakers. Stand 30-10-2026: Brier-score 0,587 (naïef 0,653); op 73 Premier League-duels 0,623 tegen 0,603 voor de markt; voor de komende speelronde wijkt het model gemiddeld 4,5 procentpunt af van de bookmakerkansen (correlatie 0,91). De markt is dus nog steeds beter geïnformeerd: zij kent blessures, opstellingen en transfers.</p>
  <p><b>Asian handicap.</b> Uit dezelfde scorekansmatrix wordt per handicaplijn berekend hoe vaak de thuisploeg (na optelling van de handicap) wint, gelijkspeelt (inzet terug) of verliest. Kwartlijnen (±0,25, ±0,75 …) zijn een halve inzet op beide buurlijnen. De faire hoofdlijn is de lijn waarop beide kanten zo dicht mogelijk bij 50% liggen; faire odds = 1 + kans verlies / kans winst (zonder marge).</p>
  <p><b>Backtest.</b> Elk gespeeld duel wordt voorspeld met alleen data van vóór die speelweek. Maten: Brier-score (lager is beter), log-loss en het percentage juiste 1X2-voorspellingen, naast een naïeve voorspeller en (met odds) de markt.</p>
  <h3>Gebruikte data</h3>
  <p><b>Automatisch opgehaald</b> (laatst bijgewerkt ${esc(S.dataUpdated || '–')}; een geplande taak ververst dit twee keer per week): volledige speelschema's en uitslagen van Premier League, Bundesliga, La Liga, Serie A, Ligue 1, Eredivisie en Liga Portugal uit openfootball en alle interlands uit martj42/international_results (Elo opgebouwd uit de volledige historie sinds 1872), optioneel aangevuld met football-data.org en gecontroleerde uitslagen van webbronnen voor de overige competities. Bij een nieuwe versie van de tool worden deze gegevens automatisch samengevoegd met je eigen data; je eigen invoer blijft staan.</p>
  <p>Het bijgevoegde document <i>Learn to Code with Soccer – kernpunten</i> bevat geen uitslagen, standen of speelschema's; het is gebruikt als methodische leidraad (Poisson/Dixon-Coles, Elo, tijdsgebonden validatie, beoordelen met Brier en log-loss, vergelijking met odds, vaste koppeltabel voor teamnamen). Het bijgevoegde betting-artikel bevat geen voetbaldata. De startdata komt uit openbare bronnen (stand 30-10-2026):</p>
  <ul><li>UEFA-landencoëfficiënt: football-coefficient.eu (top 10: ENG, ITA, ESP, GER, FRA, POR, BEL, NED, TUR, POL).</li><li>Deelnemers 2026/27 van alle 11 competities en de competitiefase van CL, EL en ECL (inclusief volledig programma): Wikipedia-seizoenspagina's.</li><li>Uitslagen en het programma van de komende twee speelronden van alle 11 competities en CL/EL/ECL: betexplorer.com en pouletips.nl, gecontroleerd tegen de actuele stand (vavel.com, thestatsapi.com).</li><li>Nations League 2026/27: groepen en programma (Wikipedia); FIFA-ranglijst 7-10-2026 voor Elo-startwaarden.</li><li>KKD-regels: KNVB Promotie- en degradatieregeling betaald voetbal 2026/'27.</li></ul>
  <h3>Importformaten</h3>
  <p>CSV met kopregel (komma of puntkomma). Verplicht: <code>competitie</code> (code, zie hieronder), <code>datum</code>, <code>thuis</code>, <code>uit</code>. Optioneel: <code>seizoen</code>, <code>ronde</code>, <code>thuisgoals</code>, <code>uitgoals</code> (leeg = nog te spelen), <code>fase</code> (league, lp, group, po, r16, qf, sf, f), <code>groep</code>, <code>tie</code> (zelfde id voor beide duels van een tweeluik), <code>winnaar_na_strafschoppen</code>, <code>neutraal</code> (ja/nee), <code>belang</code> (friendly, nl, qual, final), <code>odds_1</code>, <code>odds_x</code>, <code>odds_2</code>.</p>
  <p>Competitiecodes: ${Object.values(S.comps).map(c => `<code>${c.id}</code> ${esc(c.name)}`).join(', ')}.</p>
  ${['league', 'euro', 'nation'].map(k => `<h4>${TYPE_LABEL[k]}</h4><pre class="code">${esc(CSV_EX[k])}</pre>`).join('')}
  <h4>JSON: deelnemers, groepen en wedstrijden</h4><pre class="code">${esc(JSON_EX)}</pre>
  <p>Een JSON-lijst <code>[{…}, {…}]</code> met dezelfde sleutels als de CSV-kolommen wordt ook geaccepteerd.</p>
  <h3>Aannames (gemarkeerd in de tool)</h3>
  <ul><li>Startratings clubs: competitieniveau uit de landencoëfficiënt, plus een bonus uit de UEFA-clubcoëfficiënt voor clubs in Europa, min een correctie voor gepromoveerde clubs. Na enkele speelronden met geïmporteerde uitslagen domineren de echte resultaten.</li><li>Ontbrekende speelschema's: de resterende paren van de dubbele competitie worden als aanname ingepland.</li><li>KKD-periodegrenzen (ronde 1–9, 10–19, 20–29, 30–38) en het rondeschema van de play-offs (zoals 2025/26).</li><li>Eredivisie plaats 4–7: play-offs Europees voetbal; Premier League plaats 6: Conference League.</li><li>Onderling resultaat als tiebreaker is vereenvoudigd tot doelsaldo en doelpunten.</li><li>Groepslabels Nations League (A1–D2) volgen de volgorde van de bron.</li></ul>
  <h3>Grootste beperkingen</h3>
  <ul><li>Zonder geïmporteerde uitslagen rekent de tool met aannames; de kwaliteit hangt volledig af van de data die je invoert.</li><li>Het model kent geen spelers, blessures, schorsingen of opstellingen: gebruik daarvoor de correctieschuif.</li><li>Bekertoernooien (die Europese tickets beïnvloeden) en nacompetities buiten de KKD/Eredivisie worden niet gesimuleerd.</li><li>De indeling van beste nummers 3 bij EK/WK en officiële bracketpaden worden benaderd.</li><li>Data staat alleen in deze browser: maak back-ups.</li></ul>
  </article>`;
}


// Bestand aanbieden: in de Claude-weergave via de downloads-capability (met bevestiging), anders via een gewone downloadlink.
async function saveFile(filename, data) {
  if (window.claude && typeof window.claude.use === 'function') {
    try {
      const d = await window.claude.use('downloads');
      if (d) { await d.save({filename, data}); ui.msg = 'Bestand opgeslagen: ' + filename; render(); return; }
    } catch (e) { ui.msg = e && e.code === 'declined' ? 'Opslaan geannuleerd.' : 'Downloaden lukt hier niet (' + esc((e && e.code) || 'onbekend') + '); gebruik Kopiëren.'; render(); return; }
  }
  try { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([data], {type: filename.endsWith('.csv') ? 'text/csv' : 'application/json'})); a.download = filename; document.body.appendChild(a); a.click(); a.remove(); ui.msg = 'Download gestart.'; }
  catch (x) { ui.msg = 'Downloaden lukt hier niet; gebruik Kopiëren.'; }
  render();
}

// ---------- events ----------
function val(id) { const el = document.getElementById(id); return el ? el.value : ''; }
function teamFromInput(v, kind, cid, sid) { if (!v) return null; const sc = (S.seasons[sid].comps[cid] || {teams: []}).teams; return ensureTeam(v.trim(), kind, S.comps[cid].cc, sc); }
async function doImport() {
  const files = document.getElementById('impFile').files, txt = val('impTxt').trim(), comp = val('impComp');
  const chunks = []; for (const f of files) chunks.push({name: f.name, text: await f.text()});
  if (txt) chunks.push({name: 'invoerveld', text: txt});
  if (!chunks.length) { ui.importRep = {html: 'Kies een bestand of plak tekst.', errors: ['leeg']}; render(); return; }
  const out = [];
  for (const ch of chunks) {
    const t = ch.text.trim();
    try {
      if (t[0] === '{' || t[0] === '[') {
        const o = JSON.parse(t);
        if (Array.isArray(o) && !isFootballData(o)) { const r = importRows(o, {comp}); out.push({name: ch.name, r}); continue; }
        const r = importJSON(o); if (r.backup) { ui.pendingBackup = o; out.push({name: ch.name, r: {added: 0, updated: 0, newTeams: [], errors: [], backup: true}}); continue; }
        out.push({name: ch.name, r});
      } else {
        const rows = parseCSV(t); if (rows.length < 2) { out.push({name: ch.name, r: {errors: ['Geen gegevensregels gevonden'], added: 0, updated: 0, newTeams: []}}); continue; }
        const o = csvToObjects(rows); const r = importRows(o.rows, {comp}); r.format = o.format; out.push({name: ch.name, r});
      }
    } catch (e) { out.push({name: ch.name, r: {errors: ['Kon niet lezen: ' + e.message], added: 0, updated: 0, newTeams: []}}); }
  }
  const errs = out.flatMap(o => o.r.errors || []);
  ui.importRep = {errors: errs, html: out.map(o => o.r.backup ? `<b>${esc(o.name)}</b>: back-up herkend.` : `<b>${esc(o.name)}</b>${o.r.format ? ' (' + esc(o.r.format) + ')' : ''}: ${o.r.added} toegevoegd, ${o.r.updated} bijgewerkt${o.r.teamsSet ? ', ' + o.r.teamsSet + ' teams ingesteld' : ''}${o.r.newTeams && o.r.newTeams.length ? `, nieuwe teams: ${esc(o.r.newTeams.slice(0, 20).join(', '))}${o.r.newTeams.length > 20 ? '…' : ''} (controleer of dit geen spellingsvarianten zijn; samenvoegen kan onder Teams)` : ''}.`).join('<br>') + (errs.length ? `<ul>${errs.slice(0, 15).map(e => `<li>${esc(e)}</li>`).join('')}</ul>` : '')};
  changed();
}
function mergeTeams(from, to) {
  if (from === to) return;
  S.matches.forEach(m => { if (m.h === from) m.h = to; if (m.a === from) m.a = to; if (m.pw === from) m.pw = to; });
  for (const sid in S.seasons) { const s = S.seasons[sid]; for (const c in s.comps) { const sc = s.comps[c]; sc.teams = [...new Set(sc.teams.map(t => t === from ? to : t))]; if (sc.groups) for (const g in sc.groups) sc.groups[g] = [...new Set(sc.groups[g].map(t => t === from ? to : t))]; } if (s.prior[from] && !s.prior[to]) s.prior[to] = s.prior[from]; delete s.prior[from]; }
  const t = S.teams[to]; t.aliases = [...new Set((t.aliases || []).concat([S.teams[from].name], S.teams[from].aliases || []))];
  if (S.adj[from] && !S.adj[to]) S.adj[to] = S.adj[from]; delete S.adj[from]; delete S.teams[from];
}
function onClick(e) {
  const b = e.target.closest('[data-act]'); if (!b) return;
  const act = b.dataset.act, v = b.dataset.v;
  const keepConfirm = ['reset', 'delmatch', 'closeseason', 'tmmerge', 'mbrm'].includes(act);
  if (!keepConfirm) ui.confirm = null;
  switch (act) {
    case 'page': ui.page = v; ui.edit = null; break;
    case 'revrun': ui.revOn = true; ui.revData = null; { const b = e.target.closest('button'); if (b) { b.disabled = true; b.textContent = 'Bezig met rekenen…'; } } setTimeout(render, 30); return;
    case 'mbadd': { const sid = SID(), mb = ui.mb, m = S.matches.find(x => String(x.id) === String(mb.mid)); if (!m || mb.opt == null) break;
      const o = legOptions(sid, m).opts[+mb.opt], odds = parseFloat(val('mbOdds').replace(',', '.')), own = parseFloat(val('mbOwn').replace(',', '.'));
      if (!(odds > 1)) { ui.msg = 'Vul geldige odds in (groter dan 1).'; break; }
      mb.legs.push({mid: m.id, c: m.c, d: m.d, h: tName(m.h), a: tName(m.a), mk: o.mk, line: o.line, side: o.side, label: o.label, odds, tool: o.q * (1 - o.pp), own: own > 0 && own < 100 ? own / 100 : null});
      mb.mid = ''; mb.opt = null; mb.q = ''; break; }
    case 'mbdel': ui.mb.legs.splice(+v, 1); break;
    case 'mbsave': { const mb = ui.mb, st = parseFloat(val('mbStake').replace(',', '.')) || 0; if (!mb.legs.length) break;
      S.mybets = S.mybets || []; S.mybets.push({id: 'b' + Date.now().toString(36), at: new Date().toISOString(), stake: st, paper: document.getElementById('mbPaper').checked, legs: mb.legs.slice()});
      ui.mb = {legs: []}; save(); ui.msg = 'Bet opgeslagen.'; break; }
    case 'mbrm': if (ui.confirm === 'mbrm' + v) { S.mybets = (S.mybets || []).filter(b => b.id !== v); ui.confirm = null; save(); } else ui.confirm = 'mbrm' + v; break;
    case 'revmore': ui.revDays = (ui.revDays || 3) < 30 ? (ui.revDays || 3) + 7 : 3; break;
    case 'weekoff': ui.weekOff = +v; break;
    case 'ahopen': ui.ahOpen = ui.ahOpen === +v ? null : +v; break;
    case 'type': ui.page = null; ui.type = v; { const c = compsOfType(v)[0]; if (S.comps[ui.comp].type !== v) ui.comp = c ? c.id : ui.comp; } break;
    case 'comp': ui.page = null; ui.comp = v; ui.edit = null; break;
    case 'fn': ui.fn = v; ui.edit = null; break;
    case 'theme': { const r = document.documentElement, cur = r.getAttribute('data-theme'), dark = cur ? cur === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches; r.setAttribute('data-theme', dark ? 'light' : 'dark'); try { localStorage.setItem(UI_KEY + '-theme', dark ? 'light' : 'dark'); } catch (x) {} return; }
    case 'msgx': ui.msg = null; break;
    case 'sim': startSim(); return;
    case 'rnd': ui.round[SID() + ui.comp] = v; ui.edit = null; break;
    case 'editscore': ui.edit = +v; render(); { const el = document.getElementById('eh' + v); if (el) el.focus(); } return;
    case 'canceledit': ui.edit = null; break;
    case 'savescore': case 'clearscore': {
      const m = S.matches.find(x => x.id === +v); if (!m) break;
      if (act === 'clearscore') { m.hg = null; m.ag = null; }
      else { const h = val('eh' + v), a = val('ea' + v); if (h === '' || a === '') { ui.msg = 'Vul beide scores in.'; break; } m.hg = +h; m.ag = +a; }
      m.src = 'handmatig'; ui.edit = null; changed(act === 'clearscore' ? 'Uitslag gewist' : 'Uitslag opgeslagen; ratings en voorspellingen herberekend'); return;
    }
    case 'predict': { const m = S.matches.find(x => x.id === +v); if (m) { ui.pred[m.c] = Object.assign(ui.pred[m.c] || {}, {h: m.h, a: m.a, venue: m.n || m.st === 'f' ? 'neutraal' : 'thuis', mode: m.st === 'f' ? 'ko' : (m.st && !['league', 'lp', 'group'].includes(m.st) ? 'leg1' : 'normaal')}); ui.fn = 'voorspel'; } break; }
    case 'runbt': ui.bt = SID() + ui.comp; break;
    case 'savefmt': try { const o = JSON.parse(val('fmtJson')); if (!o.kind) throw new Error('veld "kind" ontbreekt'); S.comps[ui.comp].format = o; changed('Format opgeslagen'); } catch (x) { ui.msg = 'Format niet opgeslagen: ' + x.message; render(); } return;
    case 'hidecomp': S.comps[ui.comp].hidden = !S.comps[ui.comp].hidden; changed(); return;
    case 'tmrename': { const t = val('tmSel'), n = val('tmName').trim(); if (t && n) { S.teams[t].aliases = [...new Set((S.teams[t].aliases || []).concat([S.teams[t].name]))]; S.teams[t].name = n; changed('Team hernoemd'); } return; }
    case 'tmalias': { const t = val('tmSel'), n = val('tmName').trim(); if (t && n) { S.teams[t].aliases = [...new Set((S.teams[t].aliases || []).concat([n]))]; changed('Alias toegevoegd'); } return; }
    case 'tmmerge': { if (ui.confirm !== 'merge') { ui.confirm = 'merge'; break; } ui.confirm = null; const f = val('tmFrom'), t = val('tmTo'); if (f && t && f !== t) { mergeTeams(f, t); changed('Teams samengevoegd'); } return; }
    case 'rank': ui.rank = v; break;
    case 'dtab': ui.dataTab = v; ui.edit = null; break;
    case 'import': doImport(); return;
    case 'useex': document.getElementById('impTxt').value = CSV_EX[v]; return;
    case 'restore': { const o = ui.pendingBackup; S = o; ui.pendingBackup = null; ui.importRep = null; Object.keys(SIMS).forEach(k => delete SIMS[k]); ui.season = null; if (!S.comps[ui.comp]) ui.comp = 'NED2'; changed('Back-up teruggezet'); return; }
    case 'cancelrestore': ui.pendingBackup = null; break;
    case 'mkbackup': ui.backup = JSON.stringify(S); break;
    case 'copybackup': { const t = ui.backup || JSON.stringify(S); ui.backup = t; const fallback = () => { render(); const el = document.getElementById('backupTxt'); if (el) { el.focus(); el.select(); } ui.msg = 'Selecteer en kopieer de tekst handmatig (Ctrl/Cmd+C).'; }; if (navigator.clipboard) navigator.clipboard.writeText(t).then(() => { ui.msg = 'Back-up gekopieerd naar het klembord'; render(); }, fallback); else fallback(); return; }
    case 'dlbackup': saveFile('voetbalvoorspeller-backup-' + todayStr() + '.json', JSON.stringify(S)); return;
    case 'dlcsv': if (ui.backup) saveFile('voetbalvoorspeller-wedstrijden-' + todayStr() + '.csv', ui.backup); return;
    case 'exportcsv': {
      const F = ui.filter, sid = F.s || SID(), cid = F.c || '';
      const ms = S.matches.filter(m => m.s === sid && (!cid || m.c === cid));
      const head = 'seizoen;competitie;datum;ronde;fase;groep;thuis;uit;thuisgoals;uitgoals;neutraal;tie;winnaar_na_strafschoppen;odds_1;odds_x;odds_2';
      const q = s => /[;"\n]/.test(String(s)) ? '"' + String(s).replace(/"/g, '""') + '"' : s;
      ui.backup = head + '\n' + ms.map(m => [m.s, m.c, m.d, m.r || '', m.st || '', m.g || '', tName(m.h), tName(m.a), m.hg != null ? m.hg : '', m.ag != null ? m.ag : '', m.n ? 'ja' : '', m.tie || '', m.pw ? tName(m.pw) : '', m.o ? m.o.h : '', m.o ? m.o.d : '', m.o ? m.o.a : ''].map(q).join(';')).join('\n');
      ui.dataTab = 'backup'; ui.msg = 'CSV staat in het tekstvak; kopieer of download het.'; break;
    }
    case 'reset': if (ui.confirm !== 'reset') { ui.confirm = 'reset'; break; } ui.confirm = null; buildSeed(); Object.keys(SIMS).forEach(k => delete SIMS[k]); ui.season = null; changed('Startdata hersteld'); return;
    case 'editmatch': { const m = S.matches.find(x => x.id === +v); if (m) ui.edit = clone(m); window.scrollTo(0, 0); break; }
    case 'newmatch': ui.edit = null; break;
    case 'delmatch': if (ui.confirm !== 'del' + v) { ui.confirm = 'del' + v; break; } S.matches = S.matches.filter(m => m.id !== +v); ui.confirm = null; ui.edit = null; changed('Wedstrijd verwijderd'); return;
    case 'propose': { const p = proposeLists(S.active), y = +S.active.slice(0, 4) + 1; ui.newSeason = {id: y + '/' + String(y + 1).slice(2), start: y + '-07-01', end: (y + 1) + '-06-30', lists: p}; break; }
    case 'cancelseason': ui.newSeason = null; break;
    case 'createseason': {
      const p = ui.newSeason, id = val('nsId').trim(); if (!id || S.seasons[id]) { ui.msg = 'Kies een nieuwe, unieke seizoensnaam.'; break; }
      const lists = {}; for (const cid in p.lists) lists[cid] = val('ns-' + cid).split('\n').map(x => x.trim()).filter(Boolean).map(n => findTeam(n, 'club') || n);
      createSeason(id, val('nsStart'), val('nsEnd'), lists); ui.newSeason = null; ui.season = null; changed('Seizoen ' + id + ' aangemaakt en actief'); return;
    }
    case 'closeseason': if (ui.confirm !== 'close' + v) { ui.confirm = 'close' + v; break; } ui.confirm = null; closeSeason(v); ui.arch = v; changed('Seizoen ' + v + ' afgesloten en gearchiveerd'); return;
    case 'viewarch': ui.arch = v; break;
    case 'defaults': S.settings = clone(DEFAULT_SETTINGS); changed('Standaardinstellingen hersteld'); return;
    case 'reprior': { const first = Object.values(S.seasons).find(s => !s.from); if (first) computeSeedPriors(first.id); changed('Startratings herberekend'); return; }
    case 'addcoef': { const cc = val('ncCc').trim().toUpperCase(), n = val('ncName').trim(), c = parseFloat(val('ncCoef')); if (cc && n && c > 0 && !S.coef.find(x => x.cc === cc)) { S.coef.push({cc, name: n, coef: c}); changed('Land toegevoegd'); } else { ui.msg = 'Vul land, unieke code en coëfficiënt in.'; break; } return; }
    case 'delcoef': S.coef = S.coef.filter(x => x.cc !== v); changed(); return;
    case 'savecoef': document.querySelectorAll('[data-coef]').forEach(el => { const x = S.coef.find(c => c.cc === el.dataset.coef); if (x) x[el.dataset.k] = el.dataset.k === 'coef' ? parseFloat(el.value) || x.coef : el.value; }); changed('Coëfficiënten opgeslagen'); return;
    case 'addcomp': {
      const id = val('acId').trim().toUpperCase(), n = val('acName').trim(), cc = val('acCc').trim().toUpperCase(), type = val('acType'), nt = +val('acTeams') || 16;
      if (!id || !n || S.comps[id]) { ui.msg = 'Vul een unieke code en naam in.'; break; }
      const fmt = type === 'league' ? {kind: 'league', rr: 2, teams: nt, rounds: 2 * (nt - 1), tiebreak: ['pts', 'gd', 'gf'], zones: [Z(1, 1, 'champ'), Z(1, 1, 'cl'), Z(nt - 1, nt, 'rel')]} : type === 'euro' ? {kind: 'euro', lpMatches: 8, direct: 8, playoffTo: 24, finalNeutral: true} : {kind: 'groups', rr: 2, importance: 'qual', tiebreak: ['pts', 'gd', 'gf']};
      S.comps[id] = {id, name: n, short: id, type, cc, tier: 1, format: fmt, notes: ['Toegevoegd met standaardformat; controleer en pas aan.']};
      for (const s in S.seasons) S.seasons[s].comps[id] = S.seasons[s].comps[id] || {teams: [], groups: {}};
      ui.page = null; ui.type = type; ui.comp = id; ui.fn = 'format'; changed('Competitie toegevoegd'); return;
    }
  }
  render();
}
function onChange(e) {
  const el = e.target, k = el.dataset.change;
  if (k === 'season') { ui.season = el.value; render(); return; }
  if (k === 'round') { ui.round[SID() + ui.comp] = el.value; ui.edit = null; render(); return; }
  if (k === 'pred') { const P = ui.pred[ui.comp] = ui.pred[ui.comp] || {}; P[el.dataset.k] = el.value; render(); return; }
  if (k === 'adj') { const t = el.dataset.v, v = (+el.value) / 100; S.adj[t] = Object.assign(S.adj[t] || {}, {v}); if (!v && !S.adj[t].note) delete S.adj[t]; changed(); return; }
  if (k === 'adjnote') { const t = el.dataset.v; S.adj[t] = Object.assign(S.adj[t] || {v: 0}, {note: el.value}); save(); return; }
  if (k === 'weektype') { ui.weekTypes = Object.assign({league: true, euro: true, nation: true}, ui.weekTypes, {[el.dataset.k]: el.checked}); render(); return; }
  if (k === 'mbmatch') { ui.mb = Object.assign(ui.mb || {legs: []}, {mid: el.value, opt: null}); render(); return; }
  if (k === 'mbopt') { ui.mb.opt = el.value === '' ? null : el.value; render(); return; }
  if (k === 'valall') { ui.valAll = el.checked; render(); return; }
  if (k === 'filter') { ui.filter[el.dataset.k] = el.value; render(); return; }
  if (k === 'mfcomp') { const e2 = ui.edit && typeof ui.edit === 'object' ? ui.edit : {}; e2.c = el.value; e2.s = val('mfS'); e2.d = val('mfD'); ui.edit = e2; render(); return; }
}
function onInput(e) {
  const el = e.target;
  if (el.type === 'range' && el.nextElementSibling) el.nextElementSibling.textContent = el.value;
  if (el.dataset.input === 'mbsearch') { // wedstrijdlijst filteren zonder opnieuw te tekenen (focus blijft in het zoekveld); opties opnieuw opbouwen werkt ook op iPhone
    const q = baseNorm(el.value); ui.mb = ui.mb || {legs: []}; ui.mb.q = el.value; const sel = document.getElementById('mbSel'); if (!sel) return;
    if (!sel._all) sel._all = [...sel.options].filter(o => o.value).map(o => ({v: o.value, t: o.textContent, s: o.dataset.s || ''}));
    const hits = sel._all.filter(o => !q || o.s.includes(q)), cur = sel.value;
    sel.innerHTML = `<option value="">${q ? `kies… (${hits.length} gevonden)` : `kies… (${sel._all.length} wedstrijden)`}</option>` + hits.map(o => `<option value="${esc(o.v)}">${esc(o.t)}</option>`).join('');
    if (hits.some(o => o.v === cur)) sel.value = cur;
    if (hits.length === 1 && sel.value !== hits[0].v) { sel.value = hits[0].v; sel.dispatchEvent(new Event('change', {bubbles: true})); }
    return; }
  if (el.dataset.input === 'pred') { const P = ui.pred[ui.comp] = ui.pred[ui.comp] || {}; P[el.dataset.k] = el.value; clearTimeout(onInput.t); onInput.t = setTimeout(() => { const id = el.id, pos = el.selectionStart; render(); const n = document.getElementById(id); if (n) { n.focus(); try { n.setSelectionRange(pos, pos); } catch (x) {} } }, 350); }
}
function onSubmit(e) {
  const f = e.target.closest('[data-submit]'); if (!f) return; e.preventDefault();
  if (f.dataset.submit === 'savesettings') {
    f.querySelectorAll('[data-setting]').forEach(el => { const k = el.dataset.setting; S.settings[k] = el.dataset.bool ? el.value === '1' : el.type === 'number' ? (el.value === '' ? DEFAULT_SETTINGS[k] : +el.value) : el.value; });
    f.querySelectorAll('[data-elok]').forEach(el => S.settings.eloK[el.dataset.elok] = +el.value || DEFAULT_SETTINGS.eloK[el.dataset.elok]);
    S.settings.mcRuns = Math.max(10000, S.settings.mcRuns); S.settings.halfLife = Math.max(10, S.settings.halfLife);
    E2L.clear(); changed('Instellingen toegepast; alles wordt opnieuw berekend'); return;
  }
  if (f.dataset.submit === 'savematch') {
    const sid = val('mfS'), cid = val('mfC'), kind = isNation(cid) ? 'nation' : 'club';
    const h = teamFromInput(val('mfH'), kind, cid, sid), a = teamFromInput(val('mfA'), kind, cid, sid);
    if (!h || !a || h === a) { ui.msg = 'Kies twee verschillende teams.'; render(); return; }
    const sc = S.seasons[sid].comps[cid] = S.seasons[sid].comps[cid] || {teams: [], groups: {}};
    [h, a].forEach(t => { if (!sc.teams.includes(t)) sc.teams.push(t); });
    const g = val('mfG').trim(); if (g) { sc.groups = sc.groups || {}; const G = sc.groups[g] = sc.groups[g] || []; [h, a].forEach(t => { if (!G.includes(t)) G.push(t); }); }
    const o1 = parseFloat(val('mfO1')), ox = parseFloat(val('mfOX')), o2 = parseFloat(val('mfO2'));
    const rec = {s: sid, c: cid, d: val('mfD'), r: val('mfR'), h, a, hg: val('mfHG'), ag: val('mfAG'), n: document.getElementById('mfN').checked || null, st: val('mfSt') || null, g: g || null, tie: val('mfT') || null,
      pw: val('mfPW') ? teamFromInput(val('mfPW'), kind, cid, sid) : null, o: o1 > 1 && ox > 1 && o2 > 1 ? {h: o1, d: ox, a: o2} : null, imp: document.getElementById('mfI') ? val('mfI') || null : null, src: 'handmatig'};
    const ed = ui.edit && typeof ui.edit === 'object' && ui.edit.id ? S.matches.find(m => m.id === ui.edit.id) : null;
    if (ed) { const nm = addMatch(rec); S.matches.pop(); Object.keys(ed).forEach(k => { if (k !== 'id') delete ed[k]; }); Object.assign(ed, nm, {id: ed.id}); ui.edit = null; changed('Wedstrijd bijgewerkt'); }
    else { addMatch(rec); ui.edit = null; changed('Wedstrijd toegevoegd'); }
  }
}

// ---------- start ----------
function boot() {
  try { const th = localStorage.getItem(UI_KEY + '-theme'); if (th) document.documentElement.setAttribute('data-theme', th); } catch (e) {}
  S = load(); if (!S) { buildSeed(); save(); }
  else { S.aliases = S.aliases || {}; for (const k in SEED_ALIASES) if (!(k in S.aliases)) S.aliases[k] = SEED_ALIASES[k];
    try { const r = applyExtraData(); if (r) { save(); ui.msg = 'Nieuwe opgehaalde data verwerkt: ' + r.added + ' wedstrijden toegevoegd, ' + r.updated + ' bijgewerkt.'; } } catch (e) { console.error(e); } }
  for (const k in DEFAULT_SETTINGS) if (S.settings[k] == null) S.settings[k] = clone(DEFAULT_SETTINGS[k]);
  // modelrevisie 2 (okt. 2026): nieuwe, met backtest en slotodds afgestemde standaardwaarden; alleen waarden die de gebruiker niet zelf wijzigde
  if ((S.modelRev || 0) < 2) { const OLD = {halfLife: 150, simNoise: 0.06}; for (const k in OLD) if (S.settings[k] === OLD[k]) S.settings[k] = DEFAULT_SETTINGS[k]; S.modelRev = 2; save(); }
  // modelrevisie 3 (31 okt. 2026): lager thuisvoordeel (getoetst op 736 duels: thuiswinst voorspeld 45% → 43%, werkelijk 43%; betere log-loss)
  if ((S.modelRev || 0) < 3) { const OLD = {hfaPrior: 0.25, hfaTau: 100}; for (const k in OLD) if (S.settings[k] === OLD[k]) S.settings[k] = DEFAULT_SETTINGS[k]; S.modelRev = 3; save(); }
  // modelrevisie 4 (2 nov. 2026): grotere spreiding sterkteverschil (spread 1,3 → 1,5; log-loss op 736 duels 0,9708 → 0,9683, controleweken 0,9495 → 0,9448)
  if ((S.modelRev || 0) < 4) { const OLD = {spread: 1.3}; for (const k in OLD) if (S.settings[k] === OLD[k]) S.settings[k] = DEFAULT_SETTINGS[k]; S.modelRev = 4; save(); }
  loadUI(); if (!S.comps[ui.comp]) { ui.comp = 'NED2'; ui.type = 'league'; } if (S.comps[ui.comp].type !== ui.type) ui.type = S.comps[ui.comp].type;
  if (!FN[ui.type].some(x => x[0] === ui.fn)) ui.fn = 'stand';
  const app = document.getElementById('app');
  app.addEventListener('click', e => { onClick(e); saveUI(); });
  app.addEventListener('change', onChange);
  app.addEventListener('input', onInput);
  app.addEventListener('submit', onSubmit);
  render();
}
