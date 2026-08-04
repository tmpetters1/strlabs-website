function tokenChips(tokens) {
  if (!tokens || !tokens.length) return "";
  return `<div class="token-chips">${tokens
    .map((t) => {
      const meta = [
        t.chain,
        t.score != null ? `score ${t.score}` : null,
        t.mc != null ? `mc ${Desk.fmtUsd(t.mc)}` : null,
      ]
        .filter(Boolean)
        .join(" · ");
      return `<div class="token-chip">${Desk.tickerHtml(t)}<span class="chip-meta">${Desk.esc(meta)}</span></div>`;
    })
    .join("")}</div>`;
}

function renderPie(data) {
  const slices = (data.slices || []).map((s) => ({ label: s.category, count: s.count }));
  const pie = document.getElementById("pie-chart");
  const legend = document.getElementById("legend");
  if (pie) pie.innerHTML = Desk.pieSVG(slices, { size: 240, stroke: 32 });
  if (legend) legend.innerHTML = Desk.legendHtml(slices);
}

function renderCoverage(data) {
  const tickerCount =
    (data.tokens || []).length ||
    (data.slices || []).reduce((a, s) => a + ((s.tokens || []).length), 0);
  const stats = [
    ["total candidates", data.total_candidates ?? 0],
    ["classified", data.classified_candidates ?? 0],
    ["unclassified", data.unclassified_candidates ?? 0],
    ["tickers shown", tickerCount],
  ];
  const cov = document.getElementById("coverage-stats");
  if (cov) cov.innerHTML = stats
    .map(([k, v]) => `<div class="stat"><div class="k">${Desk.esc(k)}</div><div class="v">${v}</div></div>`)
    .join("");
}

function renderBreakdown(data) {
  const root = document.getElementById("breakdown");
  const slices = data.slices || [];
  if (!slices.length) {
    root.innerHTML = '<div class="empty">No classified candidates yet.</div>';
    return;
  }
  root.innerHTML = slices
    .map((s, i) => {
      const color = Desk.PALETTE[i % Desk.PALETTE.length];
      const subs = (s.subcategories || [])
        .map((sc) => {
          const chips = tokenChips(sc.tokens || []);
          return `<div class="sub-block"><div class="sub-head">${Desk.esc(sc.subcategory)} <span class="muted">· ${sc.count}</span></div>${chips}</div>`;
        })
        .join("");
      const topChips = tokenChips(s.tokens || []);
      return `<div class="cat-block">
        <div class="cat-head">
          <span class="swatch" style="background:${color}"></span>
          <span class="cat-name">${Desk.esc(s.category)}</span>
          <span class="badge">${s.count} · ${s.pct}%</span>
        </div>
        <div class="muted cat-desc">${Desk.esc(s.description || "")}</div>
        ${topChips}
        <div class="sub-list">${subs}</div>
      </div>`;
    })
    .join("");
}

function renderTickerTable(data) {
  const body = document.getElementById("ticker-body");
  if (!body) return;
  let tokens = data.tokens || [];
  if (!tokens.length) {
    tokens = [];
    for (const s of data.slices || []) {
      for (const t of s.tokens || []) tokens.push(t);
    }
  }
  if (!tokens.length) {
    body.innerHTML = '<tr><td colspan="7" class="empty">No classified tickers yet</td></tr>';
    return;
  }
  body.innerHTML = tokens
    .map(
      (t) => `<tr>
      <td class="sym">${Desk.tickerHtml(t)}</td>
      <td>${Desk.esc(t.name || "—")}</td>
      <td><span class="badge blue">${Desk.esc(t.chain || "—")}</span></td>
      <td style="text-transform:capitalize">${Desk.esc(t.category || "—")}${
        t.subcategory ? ` <span class="muted">/ ${Desk.esc(t.subcategory)}</span>` : ""
      }</td>
      <td>${t.score != null ? t.score : "—"}</td>
      <td>${Desk.fmtUsd(t.mc)}</td>
      <td>${Desk.fmtUsd(t.liq)}</td>
    </tr>`
    )
    .join("");
}

async function load() {
  const nav = document.getElementById("nav-root");
  if (nav) nav.innerHTML = Desk.navHtml("research");
  const data = await Desk.fetchJson("./data/taxonomy_pie.json");
  Desk.setText("generated-at", Desk.fmtTime(data.generated_at));
  renderPie(data);
  renderCoverage(data);
  renderBreakdown(data);
  renderTickerTable(data);
}

Desk.boot(load);
