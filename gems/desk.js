/* Shared helpers for Trading Desk pages (trade/research/strategy/learnings).
   Reuses the same password gate as index.html/app.js — one unlock, same sessionStorage key. */
(function (global) {
  const AUTH_KEY = "gems.strlabs.auth.v1";

  const NAV_ITEMS = [
    { id: "radar", label: "Radar", href: "./index.html" },
    { id: "trade", label: "Trade", href: "./trade.html" },
    { id: "research", label: "Research", href: "./research.html" },
    { id: "strategy", label: "Strategy", href: "./strategy.html" },
    { id: "learnings", label: "Learnings", href: "./learnings.html" },
  ];

  async function sha256Hex(text) {
    const data = new TextEncoder().encode(text);
    const digest = await crypto.subtle.digest("SHA-256", data);
    return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  function esc(s) {
    return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function fmtUsd(n, opts) {
    opts = opts || {};
    if (n == null || Number.isNaN(Number(n))) return opts.fallback ?? "—";
    const v = Number(n);
    const sign = v < 0 ? "-" : "";
    const av = Math.abs(v);
    if (av >= 1e6) return sign + "$" + (av / 1e6).toFixed(2) + "M";
    if (av >= 1e3) return sign + "$" + (av / 1e3).toFixed(1) + "k";
    if (opts.precise && av < 1) return sign + "$" + av.toFixed(6).replace(/0+$/, "").replace(/\.$/, "");
    return sign + "$" + av.toFixed(2);
  }

  function fmtPct(n, digits) {
    if (n == null || Number.isNaN(Number(n))) return "—";
    const v = Number(n);
    return (v > 0 ? "+" : "") + v.toFixed(digits ?? 2) + "%";
  }

  function fmtTime(iso) {
    if (!iso) return "—";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return String(iso);
    return d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  }

  function pctClass(n) {
    if (n == null || Number.isNaN(Number(n))) return "";
    return Number(n) >= 0 ? "pos" : "neg";
  }

  function shortAddr(a) {
    if (!a || a.length < 12) return a || "—";
    return a.slice(0, 6) + "…" + a.slice(-4);
  }

  function navHtml(activeId) {
    const links = NAV_ITEMS.map(
      (it) => `<a class="nav-link${it.id === activeId ? " active" : ""}" href="${it.href}">${esc(it.label)}</a>`
    ).join("");
    return `<nav class="desk-nav">${links}</nav>`;
  }

  // Minimal markdown renderer: headings, bold/italic, lists, paragraphs, hr, links, code spans.
  function mdToHtml(md) {
    if (!md) return "";
    const lines = md.replace(/\r\n/g, "\n").split("\n");
    let html = "";
    let inList = false;
    let inCode = false;
    const inlineFmt = (s) =>
      esc(s)
        .replace(/`([^`]+)`/g, "<code>$1</code>")
        .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
        .replace(/_([^_]+)_/g, "<em>$1</em>")
        .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
    for (const raw of lines) {
      const line = raw;
      if (line.trim().startsWith("```")) {
        inCode = !inCode;
        html += inCode ? "<pre><code>" : "</code></pre>";
        continue;
      }
      if (inCode) {
        html += esc(line) + "\n";
        continue;
      }
      const h = line.match(/^(#{1,4})\s+(.*)$/);
      if (h) {
        if (inList) { html += "</ul>"; inList = false; }
        const lvl = h[1].length;
        html += `<h${lvl + 1}>${inlineFmt(h[2])}</h${lvl + 1}>`;
        continue;
      }
      if (/^---+\s*$/.test(line.trim())) {
        if (inList) { html += "</ul>"; inList = false; }
        html += "<hr>";
        continue;
      }
      const li = line.match(/^\s*[-*]\s+(.*)$/);
      if (li) {
        if (!inList) { html += "<ul>"; inList = true; }
        html += `<li>${inlineFmt(li[1])}</li>`;
        continue;
      }
      if (line.trim() === "") {
        if (inList) { html += "</ul>"; inList = false; }
        continue;
      }
      const bq = line.match(/^>\s?(.*)$/);
      if (bq) {
        html += `<blockquote>${inlineFmt(bq[1])}</blockquote>`;
        continue;
      }
      html += `<p>${inlineFmt(line)}</p>`;
    }
    if (inList) html += "</ul>";
    if (inCode) html += "</code></pre>";
    return html;
  }

  const PALETTE = ["#E8734A", "#60A5FA", "#34D399", "#FBBF24", "#F87171", "#A78BFA", "#4ADE80", "#F472B6", "#38BDF8", "#FB923C"];

  // Pure-SVG donut chart. slices: [{label, count}]
  function pieSVG(slices, opts) {
    opts = opts || {};
    const size = opts.size || 260;
    const stroke = opts.stroke || 34;
    const r = (size - stroke) / 2;
    const cx = size / 2;
    const cy = size / 2;
    const circumference = 2 * Math.PI * r;
    const total = slices.reduce((a, s) => a + (s.count || 0), 0);
    if (!total) {
      return `<div class="muted" style="padding:1rem 0">No classified candidates yet</div>`;
    }
    let offset = 0;
    const arcs = slices
      .map((s, i) => {
        const frac = (s.count || 0) / total;
        const len = frac * circumference;
        const dash = `${len.toFixed(2)} ${(circumference - len).toFixed(2)}`;
        const rot = (offset / total) * 360;
        offset += s.count || 0;
        const color = PALETTE[i % PALETTE.length];
        return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${color}" stroke-width="${stroke}" stroke-dasharray="${dash}" transform="rotate(${(rot - 90).toFixed(2)} ${cx} ${cy})"><title>${esc(s.label)}: ${s.count} (${((s.count / total) * 100).toFixed(1)}%)</title></circle>`;
      })
      .join("");
    return `<svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">${arcs}<circle cx="${cx}" cy="${cy}" r="${r - stroke / 2 - 4}" fill="#0A0A0A"></circle><text x="${cx}" y="${cy - 4}" text-anchor="middle" fill="#F5F5F5" font-size="26" font-weight="700" font-family="Inter,sans-serif">${total}</text><text x="${cx}" y="${cy + 16}" text-anchor="middle" fill="#8A8A8A" font-size="11" font-family="Inter,sans-serif">classified</text></svg>`;
  }

  function legendHtml(slices) {
    const total = slices.reduce((a, s) => a + (s.count || 0), 0) || 1;
    return slices
      .map((s, i) => {
        const color = PALETTE[i % PALETTE.length];
        return `<div class="legend-row"><span class="swatch" style="background:${color}"></span><span class="legend-label">${esc(s.label)}</span><span class="legend-val">${s.count} <span class="muted">(${((s.count / total) * 100).toFixed(1)}%)</span></span></div>`;
      })
      .join("");
  }

  async function fetchJson(url) {
    const res = await fetch(url + (url.includes("?") ? "&" : "?") + "t=" + Date.now(), { cache: "no-store" });
    if (!res.ok) throw new Error(url + " HTTP " + res.status);
    return res.json();
  }

  async function fetchText(url) {
    const res = await fetch(url + "?t=" + Date.now(), { cache: "no-store" });
    if (!res.ok) throw new Error(url + " HTTP " + res.status);
    return res.text();
  }

  function alreadyUnlocked(auth) {
    return sessionStorage.getItem(AUTH_KEY) === auth.hash;
  }

  async function unlock(password, auth) {
    const hash = await sha256Hex(password);
    if (hash !== auth.hash) throw new Error("Wrong password");
    sessionStorage.setItem(AUTH_KEY, hash);
  }

  // Boots a gated page: shows #gate until unlocked, then calls loadFn() and reveals #app.
  function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value == null ? "" : String(value);
    return el;
  }

  async function boot(loadFn) {
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
    const reveal = () => {
      const app = document.getElementById("app");
      const gate = document.getElementById("gate");
      if (app) app.style.display = "block";
      if (gate) gate.style.display = "none";
    };
    const run = async () => {
      try {
        await loadFn();
        reveal();
      } catch (e) {
        console.error(e);
        setErr(e.message || String(e));
      }
    };
    if (alreadyUnlocked(auth)) { await run(); return; }
    const go = async () => {
      setErr("");
      try {
        const pwEl = document.getElementById("pw");
        await unlock((pwEl && pwEl.value) || "", auth);
        await run();
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

  function dexUrl(p) {
    if (!p) return null;
    if (p.dex_url) return p.dex_url;
    if (p.links && p.links.dex) return p.links.dex;
    const chain = (p.chain || "").toLowerCase();
    if (p.pair && chain) return `https://dexscreener.com/${chain}/${p.pair}`;
    if (p.token && chain) return `https://dexscreener.com/${chain}/${p.token}`;
    return null;
  }

  function tickerHtml(p, opts) {
    opts = opts || {};
    const sym = p.symbol || p.ticker || "?";
    const url = dexUrl(p);
    const label = opts.noDollar ? esc(sym) : ("$" + esc(sym));
    if (!url) return `<span class="ticker">${label}</span>`;
    return `<a class="ticker-link" href="${esc(url)}" target="_blank" rel="noopener">${label}</a>`;
  }

  async function fetchDexPair(chain, pair) {
    if (!chain || !pair) return null;
    const url = `https://api.dexscreener.com/latest/dex/pairs/${encodeURIComponent(chain)}/${encodeURIComponent(pair)}`;
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) return null;
      const data = await res.json();
      const p = (data.pairs && data.pairs[0]) || data.pair || null;
      if (!p) return null;
      return {
        price_usd: p.priceUsd != null ? Number(p.priceUsd) : null,
        mc: p.marketCap != null ? Number(p.marketCap) : (p.fdv != null ? Number(p.fdv) : null),
        liq_usd: p.liquidity && p.liquidity.usd != null ? Number(p.liquidity.usd) : null,
        vol_h24: p.volume && p.volume.h24 != null ? Number(p.volume.h24) : null,
        change_h24: p.priceChange && p.priceChange.h24 != null ? Number(p.priceChange.h24) : null,
        change_h1: p.priceChange && p.priceChange.h1 != null ? Number(p.priceChange.h1) : null,
        url: p.url || null,
        fetched_at: new Date().toISOString(),
        source: "dexscreener-live",
      };
    } catch (e) {
      return null;
    }
  }

  async function enrichPositionsLive(positions) {
    const out = [];
    for (const pos of positions || []) {
      const live = await fetchDexPair(pos.chain, pos.pair);
      if (!live || live.price_usd == null) { out.push(pos); continue; }
      const next = { ...pos };
      next.current_price_usd = live.price_usd;
      if (live.mc != null) next.current_mc_usd = live.mc;
      if (live.liq_usd != null) next.current_liq_usd = live.liq_usd;
      if (live.vol_h24 != null) next.vol_h24_usd = live.vol_h24;
      if (live.change_h24 != null) next.change_h24_pct = live.change_h24;
      if (live.change_h1 != null) next.change_h1_pct = live.change_h1;
      next.price_source = live.source;
      next.price_fetched_at = live.fetched_at;
      if (live.url) {
        next.dex_url = live.url;
        next.links = { ...(next.links || {}), dex: live.url };
      }
      const entry = Number(next.entry_price_usd);
      const cur = Number(next.current_price_usd);
      if (entry > 0 && cur > 0) {
        next.pnl_pct = ((cur - entry) / entry) * 100;
        if (next.wallet_confirmed && next.wallet_balance_tokens != null) {
          const bal = Number(next.wallet_balance_tokens);
          next.value_usd = bal * cur;
          next.cost_basis_usd = bal * entry;
          next.pnl_usd = next.value_usd - next.cost_basis_usd;
        }
      }
      out.push(next);
    }
    return out;
  }

  global.Desk = {
    esc, fmtUsd, fmtPct, fmtTime, pctClass, shortAddr, setText,
    navHtml, mdToHtml, pieSVG, legendHtml,
    fetchJson, fetchText, boot,
    dexUrl, tickerHtml, fetchDexPair, enrichPositionsLive,
    PALETTE,
  };
})(window);
