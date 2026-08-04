const AUTH_KEY = "gems.strlabs.auth.v1";

async function sha256Hex(text) {
  const data = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
function fmtUsd(n) {
  if (n == null || Number.isNaN(Number(n))) return "—";
  const v = Number(n);
  const sign = v < 0 ? "-" : "";
  const av = Math.abs(v);
  if (av >= 1e6) return sign + "$" + (av / 1e6).toFixed(2) + "M";
  if (av >= 1e3) return sign + "$" + (av / 1e3).toFixed(1) + "k";
  return sign + "$" + av.toFixed(2);
}
function fmtPrice(n) {
  if (n == null || Number.isNaN(Number(n))) return "—";
  const v = Number(n);
  if (v === 0) return "$0";
  if (v >= 1) return "$" + v.toFixed(4);
  return "$" + v.toPrecision(3);
}
function fmtPct(n) {
  if (n == null || Number.isNaN(Number(n))) return "—";
  const v = Number(n);
  return (v > 0 ? "+" : "") + v.toFixed(1) + "%";
}
function fmtTime(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}
function pctClass(n) {
  if (n == null || Number.isNaN(Number(n))) return "";
  return Number(n) >= 0 ? "pos" : "neg";
}
function shortCa(ca) {
  if (!ca || ca.length < 12) return ca || "—";
  return ca.slice(0, 6) + "…" + ca.slice(-4);
}
function esc(s) {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
async function unlock(password, auth) {
  const hash = await sha256Hex(password);
  if (hash !== auth.hash) throw new Error("Wrong password");
  sessionStorage.setItem(AUTH_KEY, hash);
}
function alreadyUnlocked(auth) {
  return sessionStorage.getItem(AUTH_KEY) === auth.hash;
}

// Minimal markdown renderer: headings (##/###), bullets, bold, code, hr, paragraphs.
function renderMarkdown(md) {
  const lines = (md || "").split("\n");
  let html = "";
  let inList = false;
  let listDepth = 0;
  const closeList = () => { while (listDepth > 0) { html += "</ul>"; listDepth--; } inList = false; };
  const inline = (s) => esc(s)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/`(.+?)`/g, "<code>$1</code>")
    .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  for (const raw of lines) {
    const line = raw.replace(/\r$/, "");
    if (/^\s*$/.test(line)) continue;
    if (/^#{1,3}\s+/.test(line)) {
      closeList();
      html += `<h3>${inline(line.replace(/^#{1,3}\s+/, ""))}</h3>`;
      continue;
    }
    if (/^---\s*$/.test(line)) { closeList(); html += "<hr>"; continue; }
    if (/^>\s?/.test(line)) { closeList(); html += `<p><em>${inline(line.replace(/^>\s?/, ""))}</em></p>`; continue; }
    const bulletMatch = line.match(/^(\s*)-\s+(.*)$/);
    if (bulletMatch) {
      const depth = Math.floor(bulletMatch[1].length / 2) + 1;
      while (listDepth < depth) { html += "<ul>"; listDepth++; }
      while (listDepth > depth) { html += "</ul>"; listDepth--; }
      inList = true;
      html += `<li>${inline(bulletMatch[2])}</li>`;
      continue;
    }
    closeList();
    html += `<p>${inline(line)}</p>`;
  }
  closeList();
  return html;
}

function donutSVG(slices) {
  const size = 168, r = 62, cx = size / 2, cy = size / 2, circ = 2 * Math.PI * r;
  let offset = 0;
  const total = slices.reduce((a, s) => a + s.count, 0) || 1;
  const arcs = slices.map((s) => {
    const frac = s.count / total;
    const len = frac * circ;
    const dasharray = `${len} ${circ - len}`;
    const dashoffset = -offset;
    offset += len;
    return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${s.color}" stroke-width="24" stroke-dasharray="${dasharray}" stroke-dashoffset="${dashoffset}" transform="rotate(-90 ${cx} ${cy})"></circle>`;
  }).join("");
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${arcs}<text x="${cx}" y="${cy - 4}" text-anchor="middle" fill="#F5F5F5" font-family="Inter,sans-serif" font-weight="800" font-size="22">${total}</text><text x="${cx}" y="${cy + 16}" text-anchor="middle" fill="#8A8A8A" font-family="Inter,sans-serif" font-size="11">researched</text></svg>`;
}

async function fetchJson(url) {
  const res = await fetch(url + "?t=" + Date.now(), { cache: "no-store" });
  if (!res.ok) throw new Error(url + " HTTP " + res.status);
  return res.json();
}
async function fetchText(url) {
  const res = await fetch(url + "?t=" + Date.now(), { cache: "no-store" });
  if (!res.ok) throw new Error(url + " HTTP " + res.status);
  return res.text();
}

function renderPortfolio(wallet, positions, pnl) {
  document.getElementById("wallet-line").innerHTML =
    `<a href="${esc(wallet.explorer)}" target="_blank" rel="noopener" class="mono">${esc(shortCa(wallet.address))}</a> · ${esc(wallet.chain)} chain`;
  const dtfLike = positions.filter((p) => p.wallet_confirmed && p.value_usd != null);
  const trackedValue = dtfLike.reduce((a, p) => a + (p.value_usd || 0), 0);
  const totalValue = trackedValue + (wallet.native_eth_usd || 0);
  document.getElementById("portfolio-value").textContent = fmtUsd(totalValue);
  document.getElementById("unrealized-pnl").textContent = fmtUsd(pnl.unrealized_usd);
  document.getElementById("unrealized-pnl").className = pctClass(pnl.unrealized_usd);
  document.getElementById("position-count").textContent = String(pnl.open_position_count ?? positions.filter((p) => p.status === "open").length);
  const stats = [
    ["Total value", fmtUsd(totalValue)],
    ["Gas (ETH)", `${wallet.native_eth.toFixed(4)} (${fmtUsd(wallet.native_eth_usd)})`],
    ["Tracked positions value", fmtUsd(trackedValue)],
    ["Unrealized PnL", fmtUsd(pnl.unrealized_usd)],
    ["Realized PnL", fmtUsd(pnl.realized_usd)],
    ["Open / Closed", `${pnl.open_position_count ?? "—"} / ${pnl.closed_position_count ?? "—"}`],
  ];
  document.getElementById("portfolio-stats").innerHTML = stats.map(([k, v]) => `<div class="stat"><div class="k">${esc(k)}</div><div class="v">${v}</div></div>`).join("");
}

function renderPositions(positions) {
  const body = document.getElementById("pos-body");
  if (!positions.length) { body.innerHTML = `<tr><td colspan="6" class="empty">No positions</td></tr>`; return; }
  body.innerHTML = positions.map((p) => {
    const statusBadge = p.status === "open"
      ? (p.wallet_confirmed ? '<span class="badge notify">open · confirmed</span>' : '<span class="badge watch">open · unconfirmed</span>')
      : `<span class="badge">${esc(p.status || "—")}</span>`;
    return `<tr>
      <td><div class="sym">$${esc(p.symbol)}</div><div class="muted mono" style="font-size:.75rem">${esc(p.chain)} · ${esc(shortCa(p.token))}</div><div class="muted" style="font-size:.75rem">${esc(p.thesis || "")}</div></td>
      <td>${fmtPrice(p.entry_price_usd)}<div class="muted" style="font-size:.75rem">score ${p.desk_score ?? "—"}</div></td>
      <td>${fmtPrice(p.current_price_usd)}<div class="muted" style="font-size:.75rem">mc ${fmtUsd(p.current_mc_usd)}</div></td>
      <td class="${pctClass(p.pnl_pct)}">${fmtPct(p.pnl_pct)}${p.pnl_usd != null ? `<div style="font-size:.75rem">${fmtUsd(p.pnl_usd)}</div>` : ""}</td>
      <td>${p.value_usd != null ? fmtUsd(p.value_usd) : '<span class="muted">unconfirmed</span>'}</td>
      <td>${statusBadge}</td>
    </tr>`;
  }).join("");
}

function renderHistory(trades) {
  const el = document.getElementById("history");
  if (!trades.length) { el.innerHTML = '<div class="empty">No trade history yet</div>'; return; }
  el.innerHTML = trades.slice().reverse().map((t) => `<div class="list-item">
    <strong>${esc((t.side || "").toUpperCase())} $${esc(t.symbol)}</strong> · ${esc(t.chain)} · ${fmtPrice(t.price_usd)}
    <div class="muted mono" style="font-size:.78rem">${fmtTime(t.at)} · ${t.size_usd != null ? fmtUsd(t.size_usd) : "size n/a"} · reported by ${esc(t.reported_by || "—")}</div>
  </div>`).join("");
}

function renderPie(taxonomy) {
  const el = document.getElementById("pie");
  const slices = (taxonomy.slices || []).filter((s) => s.count > 0);
  if (!slices.length) { el.innerHTML = '<div class="empty">No classified candidates yet</div>'; return; }
  const legend = slices.map((s) => {
    const leaf = (s.leaves || []).slice(0, 3).map((l) => `${l.subcategory}(${l.count})`).join(", ");
    return `<div class="legend-row"><span class="swatch" style="background:${s.color}"></span><span>${esc(s.category)}</span><span class="muted" style="font-size:.75rem">${esc(leaf)}</span><span class="n">${s.count} · ${s.pct}%</span></div>`;
  }).join("");
  el.innerHTML = `${donutSVG(slices)}<div class="legend">${legend}</div>`;
}

function renderLearnings(learnings) {
  const el = document.getElementById("learnings");
  const entries = learnings.entries || [];
  if (!entries.length) { el.innerHTML = '<div class="empty">No learnings logged yet</div>'; return; }
  el.innerHTML = entries.slice(0, 20).map((e) => `<div class="learn-item">
    <div class="lh"><span class="title">${esc(e.title || "—")}</span><span class="date mono">${esc(e.date || "—")} · ${esc(e.owner || "—")}</span></div>
    <div class="body"><b>Observation:</b> ${esc(e.observation || "—")}</div>
    <div class="body" style="margin-top:.3rem"><b>Action:</b> ${esc(e.action || "—")}</div>
  </div>`).join("");
}

async function boot() {
  const err = document.getElementById("gate-error");
  const authRes = await fetch("../data/auth.json", { cache: "no-store" });
  if (!authRes.ok) { err.textContent = "auth.json missing"; return; }
  const auth = await authRes.json();
  if (!auth.hash) { err.textContent = "auth.json invalid"; return; }

  const loadApp = async () => {
    const base = "../data/trading/";
    const [wallet, positions, pnl, trades, learnings, taxonomy, strategyMd] = await Promise.all([
      fetchJson(base + "wallet.json"),
      fetchJson(base + "positions.json"),
      fetchJson(base + "pnl.json"),
      fetchJson(base + "trades.json"),
      fetchJson(base + "learnings.json"),
      fetchJson(base + "taxonomy_pie.json"),
      fetchText(base + "strategy.md"),
    ]);
    document.getElementById("app").style.display = "block";
    document.getElementById("gate").style.display = "none";
    renderPortfolio(wallet, positions, pnl);
    renderPositions(positions);
    renderHistory(trades);
    renderPie(taxonomy);
    document.getElementById("strategy").innerHTML = renderMarkdown(strategyMd);
    renderLearnings(learnings);
    document.getElementById("source-line").textContent = `${positions.length} positions · ${trades.length} trades · ${taxonomy.total_candidates || 0} classified`;
  };

  if (alreadyUnlocked(auth)) {
    try { await loadApp(); } catch (e) { err.textContent = e.message; }
    return;
  }
  const go = async () => {
    err.textContent = "";
    try {
      await unlock(document.getElementById("pw").value || "", auth);
      await loadApp();
    } catch (e) {
      err.textContent = e.message || "Unlock failed";
    }
  };
  document.getElementById("unlock").addEventListener("click", go);
  document.getElementById("pw").addEventListener("keydown", (e) => { if (e.key === "Enter") go(); });
  document.getElementById("pw").focus();
}
boot();
