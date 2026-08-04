function renderPie(data) {
  const slices = (data.slices || []).map((s) => ({ label: s.category, count: s.count }));
  document.getElementById("pie-chart").innerHTML = Desk.pieSVG(slices, { size: 240, stroke: 32 });
  document.getElementById("legend").innerHTML = Desk.legendHtml(slices);
}

function renderCoverage(data) {
  const stats = [
    ["total candidates", data.total_candidates ?? 0],
    ["classified", data.classified_candidates ?? 0],
    ["unclassified", data.unclassified_candidates ?? 0],
    ["categories seen", (data.slices || []).length],
  ];
  document.getElementById("coverage-stats").innerHTML = stats
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
        .map((sc) => `<div>${Desk.esc(sc.subcategory)} <span class="muted">· ${sc.count}</span></div>`)
        .join("");
      return `<div style="margin-bottom:1rem">
        <div style="display:flex;align-items:center;gap:.5rem;font-weight:700">
          <span class="swatch" style="background:${color};display:inline-block;width:12px;height:12px;border-radius:4px"></span>
          <span style="text-transform:capitalize">${Desk.esc(s.category)}</span>
          <span class="badge">${s.count} · ${s.pct}%</span>
        </div>
        <div class="muted" style="font-size:.8rem;margin:.25rem 0 .3rem 1.7rem">${Desk.esc(s.description || "")}</div>
        <div class="sub-list">${subs}</div>
      </div>`;
    })
    .join("");
}

async function load() {
  document.getElementById("nav-root").innerHTML = Desk.navHtml("research");
  const data = await Desk.fetchJson("./data/taxonomy_pie.json");
  document.getElementById("generated-at").textContent = Desk.fmtTime(data.generated_at);
  renderPie(data);
  renderCoverage(data);
  renderBreakdown(data);
}

Desk.boot(load);
