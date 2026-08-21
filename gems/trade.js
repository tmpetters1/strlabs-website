function publicLinks(p) {
  const dex = Desk.dexUrl(p);
  const out = [];
  if (dex) out.push(`<a href="${Desk.esc(dex)}" target="_blank" rel="noopener">DexScreener</a>`);
  for (const [k, u] of Object.entries(p.links || {})) {
    if (!u || k === "dex" || k === "brief") continue;
    if (String(u).startsWith("/") || String(u).startsWith("file:")) continue;
    out.push(`<a href="${Desk.esc(u)}" target="_blank" rel="noopener">${Desk.esc(k)}</a>`);
  }
  return out.join(" · ");
}

function renderPositions(positions) {
  const root = document.getElementById("positions");
  if (!positions.length) {
    root.innerHTML = '<div class="empty">No open positions.</div>';
    return;
  }
  root.innerHTML = positions
    .map((p, idx) => {
      const pnlCls = Desk.pctClass(p.pnl_pct);
      const pnlCompact = p.wallet_confirmed
        ? `<span class="pnl-inline ${pnlCls}">${Desk.fmtUsd(p.pnl_usd)} (${Desk.fmtPct(p.pnl_pct)})</span>`
        : `<span class="pnl-inline ${pnlCls}">${Desk.fmtPct(p.pnl_pct)}</span>`;
      const bal = p.wallet_confirmed
        ? Number(p.wallet_balance_tokens).toLocaleString(undefined, { maximumFractionDigits: 0 })
        : "unconfirmed";
      const value = p.wallet_confirmed ? Desk.fmtUsd(p.value_usd) : "—";
      const briefHtml = p.brief_md
        ? Desk.mdToHtml(p.brief_md)
        : '<div class="empty">No research brief on file for this position.</div>';
      const openAttr = idx === 0 ? " open" : "";
      return `<details class="pos-card pos-expand"${openAttr}>
        <summary class="pos-summary">
          <div class="pos-summary-main">
            <div class="pos-title-row">
              ${Desk.tickerHtml(p)}
              <span class="badge blue">${Desk.esc(p.chain || "")}</span>
              <span class="badge">score ${p.desk_score ?? "—"}</span>
            </div>
            <div class="muted pos-thesis">${Desk.esc(p.thesis || "")}</div>
          </div>
          <div class="pos-summary-side">
            <div class="pos-live mono">${Desk.fmtUsd(p.current_price_usd, { precise: true })}</div>
            ${pnlCompact}
            <div class="muted pos-value">${value} · ${bal} tok</div>
            <span class="expand-hint" aria-hidden="true">details</span>
          </div>
        </summary>
        <div class="pos-body">
          <div class="kv">
            <div class="cell"><div class="k">Entry price</div><div class="v mono">${Desk.fmtUsd(p.entry_price_usd, {
              precise: true,
            })}</div></div>
            <div class="cell"><div class="k">Live price</div><div class="v mono">${Desk.fmtUsd(p.current_price_usd, {
              precise: true,
            })}</div></div>
            <div class="cell"><div class="k">Entry MC</div><div class="v">${Desk.fmtUsd(p.entry_mc_usd)}</div></div>
            <div class="cell"><div class="k">Live MC</div><div class="v">${Desk.fmtUsd(p.current_mc_usd)}</div></div>
            <div class="cell"><div class="k">Liquidity</div><div class="v">${Desk.fmtUsd(p.current_liq_usd)}</div></div>
            <div class="cell"><div class="k">1h / 24h</div><div class="v"><span class="${Desk.pctClass(
              p.change_h1_pct
            )}">${Desk.fmtPct(p.change_h1_pct)}</span> · <span class="${Desk.pctClass(
        p.change_h24_pct
      )}">${Desk.fmtPct(p.change_h24_pct)}</span></div></div>
            <div class="cell"><div class="k">Wallet balance</div><div class="v mono" style="font-size:.8rem">${bal}</div></div>
            <div class="cell"><div class="k">Value now</div><div class="v">${value}</div></div>
          </div>
          <div class="pos-links">${publicLinks(p)}</div>
          <div class="brief-wrap">
            <div class="brief-label">Research brief</div>
            <div class="md-article brief-body">${briefHtml}</div>
          </div>
        </div>
      </details>`;
    })
    .join("");
}

function renderHistory(data) {
  const body = document.getElementById("history-body");
  const rows = data.history || [];
  if (!rows.length) {
    body.innerHTML = '<tr><td colspan="7" class="empty">No trade history yet</td></tr>';
    return;
  }
  body.innerHTML = rows
    .map(
      (t) => `<tr>
        <td class="sym">${Desk.tickerHtml(t)} <span class="muted" style="font-size:.75rem">${Desk.esc(
        t.chain || ""
      )}</span></td>
        <td><span class="badge ${t.side === "sell" ? "kill" : "notify"}">${Desk.esc(t.side || "—")}</span></td>
        <td class="muted" style="font-size:.82rem">${Desk.fmtTime(t.at)}</td>
        <td class="mono">${Desk.fmtUsd(t.price_usd, { precise: true, fallback: "—" })}</td>
        <td>${Desk.fmtUsd(t.mc_usd, { fallback: "—" })}</td>
        <td class="muted">${
          t.size_usd ? Desk.fmtUsd(t.size_usd) : t.size_tokens ? Number(t.size_tokens).toLocaleString() : "—"
        }</td>
        <td class="muted">${Desk.esc(t.reported_by || "—")}</td>
      </tr>`
    )
    .join("");
}

function renderPnl(data, positions) {
  const pnl = { ...(data.pnl || {}) };
  let unreal = 0;
  let known = true;
  let any = false;
  for (const p of positions || []) {
    if (p.wallet_confirmed && p.pnl_usd != null) {
      unreal += Number(p.pnl_usd);
      any = true;
    } else if (p.wallet_confirmed === false) {
      known = false;
    }
  }
  if (any) {
    pnl.unrealized_usd = Math.round(unreal * 100) / 100;
    pnl.unrealized_complete = known;
  }
  const root = document.getElementById("pnl-summary");
  root.innerHTML = `
    <div class="stats">
      <div class="stat"><div class="k">Realized</div><div class="v ${Desk.pctClass(pnl.realized_usd)}">${Desk.fmtUsd(
    pnl.realized_usd
  )}</div></div>
      <div class="stat"><div class="k">Unrealized</div><div class="v ${Desk.pctClass(pnl.unrealized_usd)}">${
    pnl.unrealized_usd == null ? "n/a" : Desk.fmtUsd(pnl.unrealized_usd)
  }</div></div>
      <div class="stat"><div class="k">Open</div><div class="v">${
    pnl.open_position_count ?? (positions || []).length
  }</div></div>
      <div class="stat"><div class="k">Closed</div><div class="v">${pnl.closed_position_count ?? 0}</div></div>
    </div>
  `;
}

async function load() {
  const nav = document.getElementById("nav-root");
  if (nav) nav.innerHTML = Desk.navHtml("trade");
  const data = await Desk.fetchJson("./data/trading.json");
  Desk.setText("generated-at", Desk.fmtTime(data.generated_at));
  const walletEl = document.getElementById("wallet-addr");
  if (walletEl) {
    const addr = data.wallet_address || "—";
    walletEl.textContent = Desk.shortAddr(addr);
    walletEl.title = addr;
  }
  const livePositions = await Desk.enrichPositionsLive(data.positions || []);
  renderPnl(data, livePositions);
  renderPositions(livePositions);
  renderHistory(data);
  const disc = document.querySelector(".disclaimer");
  if (disc && data.disclaimer) {
    disc.innerHTML = `<strong>Experimental.</strong> ${Desk.esc(data.disclaimer)}`;
  }
}

Desk.boot(load);
