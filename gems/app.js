
const AUTH_KEY = "gems.strlabs.auth.v1";
async function sha256Hex(text) {
  const data = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, "0")).join("");
}
function fmtUsd(n) {
  if (n == null || Number.isNaN(Number(n))) return "—";
  const v = Number(n);
  if (v >= 1e6) return "$" + (v / 1e6).toFixed(2) + "M";
  if (v >= 1e3) return "$" + (v / 1e3).toFixed(1) + "k";
  return "$" + v.toFixed(0);
}
function fmtPct(n) {
  if (n == null || Number.isNaN(Number(n))) return "—";
  const v = Number(n);
  return (v > 0 ? "+" : "") + v.toFixed(2) + "%";
}
function fmtTime(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}
function scoreClass(score) {
  if (score == null) return "lo";
  if (score >= 78) return "hi";
  if (score >= 70) return "mid";
  return "lo";
}
function pctClass(n) {
  if (n == null || Number.isNaN(Number(n))) return "";
  return Number(n) >= 0 ? "pos" : "neg";
}
function statusBadge(c) {
  if (c.notify) return '<span class="badge notify">NOTIFY</span>';
  const s = (c.status || "").toLowerCase();
  if (s.includes("kill")) return '<span class="badge kill">killed</span>';
  if (s.includes("brief") || s.includes("watch") || s.includes("track")) return `<span class="badge watch">${s}</span>`;
  if (s.includes("class") || s.includes("whale") || s.includes("queue") || s.includes("research")) return `<span class="badge blue">${s}</span>`;
  return `<span class="badge">${s || "—"}</span>`;
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
function sparkSVG(series) {
  const pts = (series || []).map((p) => Number(p.p)).filter((v) => !Number.isNaN(v));
  if (pts.length < 2) return '<div class="muted" style="padding:.6rem 0">No chart points yet</div>';
  const w = 320, h = 84, pad = 8;
  const min = Math.min(...pts), max = Math.max(...pts);
  const span = max - min || 1;
  const xy = pts.map((p, i) => {
    const x = pad + (i * (w - 2 * pad)) / Math.max(pts.length - 1, 1);
    const y = h - pad - ((p - min) / span) * (h - 2 * pad);
    return [x, y];
  });
  const d = xy.map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + "," + p[1].toFixed(1)).join(" ");
  const area = d + ` L${xy[xy.length - 1][0].toFixed(1)},${h - pad} L${xy[0][0].toFixed(1)},${h - pad} Z`;
  const up = pts[pts.length - 1] >= pts[0];
  const col = up ? "#34D399" : "#F87171";
  return `<svg class="spark" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none"><path d="${area}" fill="${col}" opacity=".12"></path><path d="${d}" fill="none" stroke="${col}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"></path></svg>`;
}
function renderNotifyCards(cards) {
  const root = document.getElementById("notify-cards");
  if (!cards || !cards.length) {
    root.innerHTML = '<div class="empty">No notification-worthy cards right now.</div>';
    return;
  }
  root.innerHTML = cards.map((c) => {
    const d = c.detail || {};
    const links = d.links || {};
    const live = d.market_live || {};
    const charts = d.charts || {};
    const linkHtml = Object.entries(links).map(([k, u]) => `<a href="${esc(u)}" target="_blank" rel="noopener">${esc(k)}</a>`).join("");
    const reasoning = (d.reasoning || []).map((x) => `<li>${esc(x)}</li>`).join("") || '<li class="muted">No thesis bullets parsed</li>';
    const risks = (d.risks || []).map((x) => `<li>${esc(x)}</li>`).join("") || '<li class="muted">No explicit risks parsed</li>';
    const inv = (d.invalidation || []).map((x) => `<li>${esc(x)}</li>`).join("");
    const stack = (d.score_stack || []).map((it) => `<div class="stack-row"><span>${esc(it.label)}</span><span class="${it.delta >= 0 ? "pos" : "neg"} mono">${it.delta > 0 ? "+" : ""}${it.delta}</span></div>`).join("") || '<div class="muted">No score stack</div>';
    const checks = Object.entries(d.checks || {}).slice(0, 14).map(([id, v]) => {
      const st = (v.status || "").toLowerCase();
      const cls = st === "pass" ? "notify" : st === "fail" ? "kill" : st === "blocked" ? "watch" : "";
      return `<span class="badge ${cls}">${esc(id)}:${esc(st || "?")}</span>`;
    }).join("") || '<span class="muted">no checks</span>';
    const cls = c.notify ? "" : " watchish";
    return `<article class="ncard${cls}">
      <div class="nhead">
        <div>
          <h3>$${esc(c.symbol || "?")} <span class="score ${scoreClass(c.score)}">${c.score ?? "—"}</span></h3>
          <div class="muted" style="font-size:.8rem;margin-top:.2rem">${esc(c.chain || "—")} · ${esc(c.category || "")}${c.subcategory ? " / " + esc(c.subcategory) : ""} · ${esc(shortCa(c.token))}</div>
        </div>
        <div class="nmeta">${statusBadge(c)}<span class="badge blue">${esc(d.why_notify || "")}</span>${d.score_line ? `<span class="badge">${esc(d.score_line)}</span>` : ""}</div>
      </div>
      <div class="links">${linkHtml || '<span class="muted">no links</span>'}</div>
      <div class="nbody">
        <div>
          <div class="kv">
            <div class="cell"><div class="k">MC</div><div class="v">${fmtUsd(live.mc ?? c.mc)}</div></div>
            <div class="cell"><div class="k">Liq</div><div class="v">${fmtUsd(live.liq ?? c.liq)}</div></div>
            <div class="cell"><div class="k">Vol 24h</div><div class="v">${fmtUsd(live.vol_h24 ?? c.vol_h24)}</div></div>
            <div class="cell"><div class="k">h1</div><div class="v ${pctClass(live.change_h1)}">${fmtPct(live.change_h1)}</div></div>
            <div class="cell"><div class="k">h24</div><div class="v ${pctClass(live.change_h24)}">${fmtPct(live.change_h24)}</div></div>
            <div class="cell"><div class="k">B/S h24</div><div class="v mono" style="font-size:.8rem">${live.buys_h24 ?? "—"}/${live.sells_h24 ?? "—"}</div></div>
          </div>
          <div class="sec">Why / reasoning</div><ul class="bullets">${reasoning}</ul>
          <div class="sec">Risks</div><ul class="bullets">${risks}</ul>
          ${inv ? `<div class="sec">Invalidation</div><ul class="bullets">${inv}</ul>` : ""}
          ${d.mechanism ? `<div class="sec">Mechanism</div><div class="mech">${esc(d.mechanism)}</div>` : ""}
        </div>
        <div>
          ${sparkSVG(charts.price_series)}
          <div class="sec">Score stack</div><div class="stack">${stack}</div>
          <div class="sec">Checks</div><div class="checks">${checks}</div>
        </div>
      </div>
    </article>`;
  }).join("");
}
function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value == null ? "" : String(value);
}
function render(data) {
  const appEl = document.getElementById("app");
  const gateEl = document.getElementById("gate");
  if (appEl) appEl.style.display = "block";
  if (gateEl) gateEl.style.display = "none";
  const filters = data.filters || {};
  const bar = filters.notify_min_score ?? 78;
  setText("notify-bar", String(bar));
  setText("published-at", fmtTime(data.published_at || data.updated_at));
  setText("row-count", String((data.candidates || []).length));
  setText("focus-line", data.focus_summary || "Gem desk live");
  setText("update-mode", (data.meta && data.meta.update_mode) || "manual");
  setText("source-line", `v${(data.meta && data.meta.version) || "?"} · ${(data.candidates || []).length} rows · ${(data.notify_cards || []).length} detail cards · ${data._source || "api"}`);
  const counts = (data.pipeline && data.pipeline.counts) || {};
  const terminal = (data.pipeline && data.pipeline.terminal) || {};
  const stats = [["queued", counts.queued || 0], ["classified", counts.classified || 0], ["whale", counts.whale_reviewed || 0], ["briefed", counts.briefed || 0], ["notified", counts.notified || 0], ["killed", terminal.killed || 0], ["needs checks", terminal.needs_checks || 0]];
  document.getElementById("pipeline-stats").innerHTML = stats.map(([k, v]) => `<div class="stat"><div class="k">${k}</div><div class="v">${v}</div></div>`).join("");
  const acc = data.accuracy || {};
  const accBox = document.getElementById("accuracy-box");
  if (!acc.available) {
    accBox.innerHTML = `<div class="list-item muted">${esc(acc.why || "No accuracy data yet")}</div>`;
  } else {
    const verdicts = acc.verdicts || {};
    accBox.innerHTML = `<div class="list-item">Tracked <strong>${acc.tracked ?? 0}</strong> · Graded <strong>${acc.graded ?? 0}</strong> · Pending <strong>${acc.pending ?? 0}</strong></div><div class="list-item mono">${Object.entries(verdicts).map(([k, v]) => `${k}:${v}`).join(" · ") || "no verdicts"}</div><div class="list-item muted">${esc(acc.note || "")}</div>`;
  }
  renderNotifyCards(data.notify_cards || []);
  const body = document.getElementById("cand-body");
  const cands = (data.candidates || []).slice().sort((a, b) => {
    if (!!b.notify !== !!a.notify) return Number(!!b.notify) - Number(!!a.notify);
    return (b.score || -1) - (a.score || -1);
  });
  if (!cands.length) {
    body.innerHTML = `<tr><td colspan="7" class="empty">No candidates</td></tr>`;
  } else {
    body.innerHTML = cands.map((c) => {
      const link = c.url ? `<a href="${esc(c.url)}" target="_blank" rel="noopener">${esc(c.symbol || "?")}</a>` : esc(c.symbol || "?");
      const failed = (c.checks_failed || []).length;
      const blocked = (c.checks_blocked || []).length;
      const checkTxt = failed || blocked ? `<span class="badge kill">${failed} fail</span> <span class="badge watch">${blocked} blocked</span>` : `<span class="muted">${c.checks_done || 0} done</span>`;
      return `<tr>
        <td><div class="sym">${link}</div><div class="muted mono" style="font-size:.75rem">${esc(c.chain || "—")} · ${esc(shortCa(c.token))}</div><div class="muted" style="font-size:.75rem">${[c.category, c.novelty].filter(Boolean).map(esc).join(" · ")}</div></td>
        <td class="score ${scoreClass(c.score)}">${c.score == null ? "—" : c.score}</td>
        <td>${statusBadge(c)}</td>
        <td class="muted">${esc(c.waiting_on || "—")}</td>
        <td class="mono" style="font-size:.8rem">mc ${fmtUsd(c.mc)}<br>liq ${fmtUsd(c.liq)}<br>vol ${fmtUsd(c.vol_h24)}</td>
        <td>${checkTxt}</td>
        <td class="muted" style="font-size:.78rem">${esc(c.last_touch_by || "—")}<br>${fmtTime(c.last_touch_at)}</td>
      </tr>`;
    }).join("");
  }
  const blockers = data.blockers || [];
  const b = document.getElementById("blockers");
  if (!blockers.length) b.innerHTML = '<div class="list-item muted">No blockers surfaced</div>';
  else b.innerHTML = blockers.map((x) => `<div class="list-item"><strong>${esc(x.symbol || "?")}</strong> · ${esc(x.status || "—")} · failed: <span class="mono">${esc((x.failed || []).join(", ") || "—")}</span></div>`).join("");
}
async function loadRadarPayload() {
  const urls = ["./api/v1/radar.json", "./data/radar.json"];
  let lastErr = null;
  for (const url of urls) {
    try {
      const res = await fetch(url + "?t=" + Date.now(), { cache: "no-store" });
      if (!res.ok) throw new Error(url + " HTTP " + res.status);
      const data = await res.json();
      data._source = url;
      return data;
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr || new Error("No radar payload");
}

let _pollTimer = null;
function startPolling() {
  if (_pollTimer) return;
  _pollTimer = setInterval(async () => {
    try {
      const data = await loadRadarPayload();
      render(data);
    } catch (_) {}
  }, 60000);
}

async function boot() {
  const err = document.getElementById("gate-error");
  const setErr = (msg) => { if (err) err.textContent = msg || ""; };
  let auth;
  try {
    const authRes = await fetch("./data/auth.json", { cache: "no-store" });
    if (!authRes.ok) { setErr("auth.json missing"); return; }
    auth = await authRes.json();
    if (!auth || !auth.hash) { setErr("auth.json invalid"); return; }
  } catch (e) {
    setErr(e.message || "auth load failed");
    return;
  }
  const loadApp = async () => {
    const data = await loadRadarPayload();
    render(data);
    startPolling();
  };
  if (alreadyUnlocked(auth)) {
    try { await loadApp(); } catch (e) { setErr(e.message || String(e)); }
    return;
  }
  const go = async () => {
    setErr("");
    try {
      const pwEl = document.getElementById("pw");
      await unlock((pwEl && pwEl.value) || "", auth);
      await loadApp();
    } catch (e) {
      setErr(e.message || "Unlock failed");
    }
  };
  const btn = document.getElementById("unlock");
  const pw = document.getElementById("pw");
  if (btn) btn.addEventListener("click", go);
  if (pw) {
    pw.addEventListener("keydown", (e) => { if (e.key === "Enter") go(); });
    pw.focus();
  }
}
boot();
