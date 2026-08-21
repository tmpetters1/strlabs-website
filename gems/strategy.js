function renderHoldings(positions) {
  const root = document.getElementById("strategy-holdings");
  if (!root) return;
  if (!positions.length) {
    root.innerHTML = '<div class="empty">No open holdings.</div>';
    return;
  }
  root.innerHTML = positions
    .map((p) => {
      const dex = Desk.dexUrl(p);
      return `<div class="hold-card">
      <div class="hold-top">
        <div>${Desk.tickerHtml(p)} <span class="badge blue">${Desk.esc(p.chain || "")}</span></div>
        <div class="${Desk.pctClass(p.pnl_pct)}">${Desk.fmtPct(p.pnl_pct)}</div>
      </div>
      <div class="kv">
        <div class="cell"><div class="k">Live price</div><div class="v mono">${Desk.fmtUsd(p.current_price_usd, {
          precise: true,
        })}</div></div>
        <div class="cell"><div class="k">Live MC</div><div class="v">${Desk.fmtUsd(p.current_mc_usd)}</div></div>
        <div class="cell"><div class="k">Liq</div><div class="v">${Desk.fmtUsd(p.current_liq_usd)}</div></div>
        <div class="cell"><div class="k">24h</div><div class="v ${Desk.pctClass(p.change_h24_pct)}">${Desk.fmtPct(
        p.change_h24_pct
      )}</div></div>
        <div class="cell"><div class="k">Value</div><div class="v">${
          p.wallet_confirmed ? Desk.fmtUsd(p.value_usd) : "—"
        }</div></div>
        <div class="cell"><div class="k">Score</div><div class="v">${p.desk_score ?? "—"}</div></div>
      </div>
      <div class="muted" style="font-size:.82rem;margin-top:.45rem">${Desk.esc(p.thesis || "")}</div>
      <div style="margin-top:.35rem">${
        dex ? `<a href="${Desk.esc(dex)}" target="_blank" rel="noopener">DexScreener</a>` : ""
      }</div>
    </div>`;
    })
    .join("");
}

async function load() {
  const nav = document.getElementById("nav-root");
  if (nav) nav.innerHTML = Desk.navHtml("strategy");
  const [md, trading] = await Promise.all([
    Desk.fetchText("./data/strategy.md"),
    Desk.fetchJson("./data/trading.json").catch(() => ({ positions: [] })),
  ]);
  const body = document.getElementById("strategy-body");
  if (body) body.innerHTML = Desk.mdToHtml(md);
  const live = await Desk.enrichPositionsLive(trading.positions || []);
  renderHoldings(live);
  Desk.setText("generated-at", Desk.fmtTime(trading.generated_at));
}

Desk.boot(load);
