function renderPositions(positions) {
  const root = document.getElementById("positions");
  if (!positions.length) {
    root.innerHTML = '<div class="empty">No open positions.</div>';
    return;
  }
  root.innerHTML = positions
    .map((p) => {
      const pnlCls = Desk.pctClass(p.pnl_pct);
      const pnlLine = p.wallet_confirmed
        ? `<div class="pnl-big ${pnlCls}">${Desk.fmtUsd(p.pnl_usd)} <span style="font-size:.6em">(${Desk.fmtPct(p.pnl_pct)})</span></div>`
        : `<div class="pnl-big ${pnlCls}">${Desk.fmtPct(p.pnl_pct)}</div><div class="muted" style="font-size:.75rem;margin-top:.15rem">size unconfirmed in wallet — % only</div>`;
      const dex = Desk.dexUrl(p);
      const links = Object.entries(p.links || {})
        .map(([k, u]) => {
          if (!u || String(u).startsWith("/Users/")) return "";
          return `<a href="${Desk.esc(u)}" target="_blank" rel="noopener" style="margin-right:.6rem">${Desk.esc(k)}</a>`;
        })
        .filter(Boolean)
        .join("");
      const priceSrc =
        p.price_source === "dexscreener-live"
          ? "live DexScreener"
          : p.price_source || "—";
      const priceNote =
        p.current_price_usd == null
          ? `<div class="muted" style="font-size:.75rem;margin-top:.3rem">live price unavailable${
              p.price_error ? ": " + Desk.esc(p.price_error) : ""
            }</div>`
          : `<div class="muted" style="font-size:.75rem;margin-top:.3rem">price: ${Desk.esc(priceSrc)}${
              p.price_fetched_at ? " · " + Desk.fmtTime(p.price_fetched_at) : ""
            }</div>`;
      return `<article class="pos-card">
        <div class="pos-head">
          <h3>${Desk.tickerHtml(p)} <span class="badge blue">${Desk.esc(p.chain)}</span> <span class="badge">score ${
        p.desk_score ?? "—"
      }</span></h3>
          ${pnlLine}
        </div>
        <div class="muted" style="font-size:.85rem;margin-bottom:.5rem">${Desk.esc(p.thesis || "")}</div>
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
          <div class="cell"><div class="k">Wallet balance</div><div class="v mono" style="font-size:.8rem">${
            p.wallet_confirmed
              ? Number(p.wallet_balance_tokens).toLocaleString(undefined, { maximumFractionDigits: 0 })
              : "unconfirmed"
          }</div></div>
          <div class="cell"><div class="k">Value now</div><div class="v">${
            p.wallet_confirmed ? Desk.fmtUsd(p.value_usd) : "—"
          }</div></div>
        </div>
        <div style="margin-top:.4rem">${
          dex ? `<a href="${Desk.esc(dex)}" target="_blank" rel="noopener">DexScreener</a> · ` : ""
        }${links || ""}</div>
        ${priceNote}
      </article>`;
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
    <div class="muted" style="font-size:.78rem;margin-top:.6rem">${Desk.esc(
      pnl.note || ""
    )} Live prices refreshed from DexScreener in-browser.</div>
  `;
}

async function load() {
  document.getElementById("nav-root").innerHTML = Desk.navHtml("trade");
  const data = await Desk.fetchJson("./data/trading.json");
  document.getElementById("generated-at").textContent = Desk.fmtTime(data.generated_at);
  document.getElementById("wallet-addr").textContent = data.wallet_address || "—";
  const note =
    data.chain_focus &&
    (Array.isArray(data.chain_focus.primary)
      ? data.chain_focus.primary.join(" + ") + " · " + (data.chain_focus.note || "")
      : data.chain_focus.note);
  document.getElementById("wallet-note").textContent = note || "";
  document.getElementById("copy-wallet").addEventListener("click", () => {
    navigator.clipboard?.writeText(data.wallet_address || "");
    const b = document.getElementById("copy-wallet");
    b.textContent = "copied";
    setTimeout(() => (b.textContent = "copy"), 1200);
  });
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
