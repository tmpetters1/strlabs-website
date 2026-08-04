function tickerLink(t) {
  if (window.Desk && typeof Desk.tickerHtml === "function") {
    return Desk.tickerHtml(t);
  }
  const esc = (s) => {
    return String(s ?? "")
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;");
  };
  const sym = t.symbol || t.ticker || "?";
  const chain = (t.chain || "").toLowerCase();
  let url = t.dex_url || (t.links && t.links.dex) || null;
  if (!url && chain && t.pair) url = "https://dexscreener.com/" + chain + "/" + t.pair;
  if (!url && chain && t.token) url = "https://dexscreener.com/" + chain + "/" + t.token;
  const label = "$" + esc(sym);
  if (!url) return '<span class="ticker">' + label + "</span>";
  return '<a class="ticker-link" href="' + esc(url) + '" target="_blank" rel="noopener">' + label + "</a>";
}

function money(n) {
  if (window.Desk && typeof Desk.fmtUsd === "function") return Desk.fmtUsd(n);
  if (n == null || Number.isNaN(Number(n))) return "—";
  const v = Number(n);
  if (Math.abs(v) >= 1e6) return "$" + (v / 1e6).toFixed(2) + "M";
  if (Math.abs(v) >= 1e3) return "$" + (v / 1e3).toFixed(1) + "k";
  return "$" + v.toFixed(0);
}

function escText(s) {
  if (window.Desk && typeof Desk.esc === "function") return Desk.esc(s);
  return String(s ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

function flattenTokens(data) {
  if (data.tokens && data.tokens.length) return data.tokens.slice();
  const out = [];
  for (const s of data.slices || []) {
    for (const t of s.tokens || []) out.push(t);
    for (const sc of s.subcategories || []) {
      for (const t of sc.tokens || []) out.push(t);
    }
  }
  const seen = new Set();
  const uniq = [];
  for (const t of out) {
    const key = String(t.chain || "").toLowerCase() + "|" + String(t.token || t.symbol || "").toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    uniq.push(t);
  }
  return uniq;
}

function tokenChips(tokens) {
  if (!tokens || !tokens.length) {
    return '<div class="muted" style="font-size:.8rem;margin:.35rem 0">No tickers in this bucket yet.</div>';
  }
  return (
    '<div class="token-chips">' +
    tokens
      .map((t) => {
        const meta = [t.chain, t.score != null ? "score " + t.score : null, t.mc != null ? "mc " + money(t.mc) : null]
          .filter(Boolean)
          .join(" · ");
        return (
          '<div class="token-chip">' +
          tickerLink(t) +
          '<span class="chip-meta">' +
          escText(meta) +
          "</span></div>"
        );
      })
      .join("") +
    "</div>"
  );
}

function renderPie(data) {
  const slices = (data.slices || []).map((s) => ({ label: s.category, count: s.count }));
  const pie = document.getElementById("pie-chart");
  const legend = document.getElementById("legend");
  if (pie && window.Desk && Desk.pieSVG) pie.innerHTML = Desk.pieSVG(slices, { size: 240, stroke: 32 });
  if (legend && window.Desk && Desk.legendHtml) legend.innerHTML = Desk.legendHtml(slices);
}

function renderCoverage(data) {
  const all = flattenTokens(data);
  const stats = [
    ["total candidates", data.total_candidates ?? 0],
    ["classified", data.classified_candidates ?? 0],
    ["unclassified", data.unclassified_candidates ?? 0],
    ["tickers shown", all.length],
  ];
  const cov = document.getElementById("coverage-stats");
  if (!cov) return;
  cov.innerHTML = stats
    .map(function (pair) {
      return (
        '<div class="stat"><div class="k">' +
        escText(pair[0]) +
        '</div><div class="v">' +
        pair[1] +
        "</div></div>"
      );
    })
    .join("");
}

function renderBreakdown(data) {
  const root = document.getElementById("breakdown");
  if (!root) return;
  const slices = data.slices || [];
  if (!slices.length) {
    root.innerHTML = '<div class="empty">No classified candidates yet.</div>';
    return;
  }
  const palette =
    (window.Desk && Desk.PALETTE) ||
    ["#E8734A", "#60A5FA", "#34D399", "#FBBF24", "#A78BFA", "#F472B6", "#2DD4BF", "#F87171"];
  root.innerHTML = slices
    .map(function (s, i) {
      const color = palette[i % palette.length];
      let tokens = s.tokens && s.tokens.length ? s.tokens : [];
      if (!tokens.length) {
        tokens = [];
        for (const sc of s.subcategories || []) {
          for (const t of sc.tokens || []) tokens.push(t);
        }
      }
      const subs = (s.subcategories || [])
        .map(function (sc) {
          return (
            '<div class="sub-block"><div class="sub-head">' +
            escText(sc.subcategory) +
            ' <span class="muted">· ' +
            sc.count +
            "</span></div>" +
            tokenChips(sc.tokens || []) +
            "</div>"
          );
        })
        .join("");
      return (
        '<div class="cat-block">' +
        '<div class="cat-head">' +
        '<span class="swatch" style="background:' +
        color +
        '"></span>' +
        '<span class="cat-name">' +
        escText(s.category) +
        "</span>" +
        '<span class="badge">' +
        s.count +
        " · " +
        s.pct +
        "% · " +
        tokens.length +
        " tickers</span>" +
        "</div>" +
        '<div class="muted cat-desc">' +
        escText(s.description || "") +
        "</div>" +
        '<div class="cat-tickers-label">Tickers</div>' +
        tokenChips(tokens) +
        '<div class="sub-list">' +
        subs +
        "</div></div>"
      );
    })
    .join("");
}

function renderTickerTable(data) {
  const body = document.getElementById("ticker-body");
  if (!body) return;
  const tokens = flattenTokens(data);
  if (!tokens.length) {
    body.innerHTML = '<tr><td colspan="7" class="empty">No classified tickers yet</td></tr>';
    return;
  }
  body.innerHTML = tokens
    .map(function (t) {
      const cat =
        escText(t.category || "—") +
        (t.subcategory ? ' <span class="muted">/ ' + escText(t.subcategory) + "</span>" : "");
      return (
        "<tr>" +
        '<td class="sym">' +
        tickerLink(t) +
        "</td>" +
        "<td>" +
        escText(t.name || "—") +
        "</td>" +
        '<td><span class="badge blue">' +
        escText(t.chain || "—") +
        "</span></td>" +
        '<td style="text-transform:capitalize">' +
        cat +
        "</td>" +
        "<td>" +
        (t.score != null ? t.score : "—") +
        "</td>" +
        "<td>" +
        money(t.mc) +
        "</td>" +
        "<td>" +
        money(t.liq) +
        "</td>" +
        "</tr>"
      );
    })
    .join("");
}

async function load() {
  const nav = document.getElementById("nav-root");
  if (nav && window.Desk && Desk.navHtml) nav.innerHTML = Desk.navHtml("research");

  const res = await fetch("./data/taxonomy_pie.json?t=" + Date.now(), { cache: "no-store" });
  if (!res.ok) throw new Error("taxonomy_pie.json HTTP " + res.status);
  const data = await res.json();

  if (window.Desk && Desk.setText) {
    Desk.setText("generated-at", Desk.fmtTime(data.generated_at));
  } else {
    const el = document.getElementById("generated-at");
    if (el) el.textContent = data.generated_at || "—";
  }

  const all = flattenTokens(data);
  const banner = document.getElementById("ticker-banner");
  if (banner) {
    banner.textContent = all.length
      ? all.length + " classified tickers · all link to DexScreener"
      : "No classified tickers in payload";
  }

  renderPie(data);
  renderCoverage(data);
  renderBreakdown(data);
  renderTickerTable(data);

  const src = document.getElementById("source-line");
  if (src) {
    src.textContent =
      "data/taxonomy_pie.json · " + all.length + " tickers · " + (data.slices || []).length + " categories";
  }
}

if (window.Desk && typeof Desk.boot === "function") {
  Desk.boot(load);
} else {
  document.addEventListener("DOMContentLoaded", function () {
    const err = document.getElementById("gate-error");
    if (err) err.textContent = "desk.js failed to load — cannot unlock";
  });
}

