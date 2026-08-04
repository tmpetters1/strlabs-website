(function () {
  const state = {
    data: null,
    sortBy: "score",
    sortDir: "desc",
    chain: "all",
    openCats: new Set(),
    openSubs: new Set(),
  };

  function esc(s) {
    if (window.Desk && typeof Desk.esc === "function") return Desk.esc(s);
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function money(n) {
    if (window.Desk && typeof Desk.fmtUsd === "function") return Desk.fmtUsd(n);
    if (n == null || Number.isNaN(Number(n))) return "—";
    const v = Number(n);
    const a = Math.abs(v);
    if (a >= 1e6) return (v < 0 ? "-" : "") + "$" + (a / 1e6).toFixed(2) + "M";
    if (a >= 1e3) return (v < 0 ? "-" : "") + "$" + (a / 1e3).toFixed(1) + "k";
    return (v < 0 ? "-" : "") + "$" + a.toFixed(0);
  }

  function num(v) {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }

  function ageMinutes(t) {
    if (!t) return null;
    if (t.pair_age_minutes != null && Number.isFinite(Number(t.pair_age_minutes))) {
      return Number(t.pair_age_minutes);
    }
    const created = t.pair_created_at || t.pairCreatedAt || t.created_at_ms;
    if (created == null) return null;
    const ms = Number(created);
    if (!Number.isFinite(ms)) return null;
    // Dex uses ms epoch; allow seconds if small
    const createdMs = ms < 1e12 ? ms * 1000 : ms;
    return Math.max(0, (Date.now() - createdMs) / 60000);
  }

  function fmtAge(t) {
    const mins = ageMinutes(t);
    if (mins == null || !Number.isFinite(mins)) return "—";
    const totalMin = Math.max(0, Math.floor(mins));
    const days = Math.floor(totalMin / (60 * 24));
    const hours = Math.floor((totalMin % (60 * 24)) / 60);
    return days + "days, " + hours + "hours";
  }

  function dexUrl(t) {
    if (t.dex_url) return t.dex_url;
    if (t.links && t.links.dex) return t.links.dex;
    const chain = String(t.chain || "").toLowerCase();
    if (chain && t.pair) return "https://dexscreener.com/" + chain + "/" + t.pair;
    if (chain && t.token) return "https://dexscreener.com/" + chain + "/" + t.token;
    return null;
  }

  function tickerLink(t) {
    if (window.Desk && typeof Desk.tickerHtml === "function") return Desk.tickerHtml(t);
    const sym = t.symbol || t.ticker || "?";
    const url = dexUrl(t);
    const label = "$" + esc(sym);
    if (!url) return '<span class="ticker">' + label + "</span>";
    return '<a class="ticker-link" href="' + esc(url) + '" target="_blank" rel="noopener">' + label + "</a>";
  }

  function tokenKey(t) {
    return String(t.chain || "").toLowerCase() + "|" + String(t.token || t.symbol || "").toLowerCase();
  }

  function subKey(cat, sub) {
    return String(cat || "").toLowerCase() + "::" + String(sub || "").toLowerCase();
  }

  function chainOk(t) {
    if (state.chain === "all") return true;
    return String(t.chain || "").toLowerCase() === state.chain;
  }

  function filterTokens(list) {
    return (list || []).filter(chainOk);
  }

  function avgScore(tokens) {
    const vals = tokens.map((t) => num(t.score)).filter((x) => x != null);
    if (!vals.length) return null;
    return vals.reduce((a, b) => a + b, 0) / vals.length;
  }

  function maxOf(tokens, field) {
    let best = null;
    for (const t of tokens) {
      let v;
      if (field === "age") v = ageMinutes(t);
      else v = num(t[field]);
      if (v == null) continue;
      if (best == null || v > best) best = v;
    }
    return best;
  }

  function cmpValues(a, b, dir) {
    const mul = dir === "asc" ? 1 : -1;
    if (a == null && b == null) return 0;
    if (a == null) return 1;
    if (b == null) return -1;
    if (typeof a === "string" || typeof b === "string") {
      return String(a).localeCompare(String(b), undefined, { sensitivity: "base" }) * mul;
    }
    if (a === b) return 0;
    return a > b ? mul : -mul;
  }

  function sortTokens(tokens) {
    const by = state.sortBy;
    const dir = state.sortDir;
    return tokens.slice().sort((x, y) => {
      let av;
      let bv;
      if (by === "symbol") {
        av = (x.symbol || x.ticker || "").toLowerCase();
        bv = (y.symbol || y.ticker || "").toLowerCase();
      } else if (by === "name") {
        av = (x.name || "").toLowerCase();
        bv = (y.name || "").toLowerCase();
      } else if (by === "category") {
        av = ((x.category || "") + "/" + (x.subcategory || "")).toLowerCase();
        bv = ((y.category || "") + "/" + (y.subcategory || "")).toLowerCase();
      } else if (by === "chain") {
        av = (x.chain || "").toLowerCase();
        bv = (y.chain || "").toLowerCase();
      } else if (by === "age") {
        av = ageMinutes(x);
        bv = ageMinutes(y);
      } else {
        av = num(x[by]);
        bv = num(y[by]);
      }
      const c = cmpValues(av, bv, dir);
      if (c) return c;
      return String(x.symbol || "").localeCompare(String(y.symbol || ""));
    });
  }

  // Subs can still be ordered by ticker sort metric for convenience; categories stay fixed.
  function sortSubs(subs) {
    const by = state.sortBy;
    const dir = state.sortDir;
    return subs.slice().sort((a, b) => {
      const at = filterTokens(a.tokens || []);
      const bt = filterTokens(b.tokens || []);
      let av;
      let bv;
      if (by === "symbol" || by === "name") {
        av = (a.subcategory || "").toLowerCase();
        bv = (b.subcategory || "").toLowerCase();
      } else if (by === "score") {
        av = avgScore(at);
        bv = avgScore(bt);
      } else if (by === "mc" || by === "liq" || by === "age") {
        av = maxOf(at, by);
        bv = maxOf(bt, by);
      } else {
        av = at.length;
        bv = bt.length;
      }
      const c = cmpValues(av, bv, dir);
      if (c) return c;
      return String(a.subcategory || "").localeCompare(String(b.subcategory || ""));
    });
  }

  function allCatTokens(slice) {
    const out = [];
    const seen = new Set();
    for (const sc of slice.subcategories || []) {
      for (const t of filterTokens(sc.tokens || [])) {
        const k = tokenKey(t);
        if (seen.has(k)) continue;
        seen.add(k);
        out.push(Object.assign({ category: slice.category, subcategory: sc.subcategory }, t));
      }
    }
    if (!(slice.subcategories || []).length) {
      for (const t of filterTokens(slice.tokens || [])) {
        const k = tokenKey(t);
        if (seen.has(k)) continue;
        seen.add(k);
        out.push(Object.assign({ category: slice.category, subcategory: t.subcategory || "unclassified" }, t));
      }
    }
    return out;
  }

  function normalizeSlices(data) {
    // Preserve payload order — do not sort categories.
    return (data.slices || []).map((s) => {
      const subs = (s.subcategories || []).map((sc) => ({
        subcategory: sc.subcategory || "unclassified",
        count: sc.count,
        tokens: (sc.tokens || []).slice(),
      }));
      if (!subs.length && (s.tokens || []).length) {
        const buckets = new Map();
        for (const t of s.tokens || []) {
          const name = t.subcategory || "unclassified";
          if (!buckets.has(name)) buckets.set(name, []);
          buckets.get(name).push(t);
        }
        for (const [name, tokens] of buckets.entries()) {
          subs.push({ subcategory: name, count: tokens.length, tokens });
        }
      }
      return {
        category: s.category,
        count: s.count,
        pct: s.pct,
        description: s.description || "",
        subcategories: subs,
      };
    });
  }

  function flattenAll(data) {
    const slices = normalizeSlices(data);
    const out = [];
    const seen = new Set();
    for (const s of slices) {
      for (const t of allCatTokens(s)) {
        const k = tokenKey(t);
        if (seen.has(k)) continue;
        seen.add(k);
        out.push(t);
      }
    }
    if (!out.length) {
      for (const t of data.tokens || []) {
        if (!chainOk(t)) continue;
        const k = tokenKey(t);
        if (seen.has(k)) continue;
        seen.add(k);
        out.push(t);
      }
    }
    return out;
  }

  function renderPie(data) {
    const slices = (data.slices || []).map((s) => ({ label: s.category, count: s.count }));
    const pie = document.getElementById("pie-chart");
    const legend = document.getElementById("legend");
    if (pie && window.Desk && Desk.pieSVG) pie.innerHTML = Desk.pieSVG(slices, { size: 220, stroke: 30 });
    if (legend && window.Desk && Desk.legendHtml) legend.innerHTML = Desk.legendHtml(slices);
  }

  function renderCoverage(data, flat) {
    const cov = document.getElementById("coverage-stats");
    if (!cov) return;
    const stats = [
      ["candidates", data.total_candidates ?? 0],
      ["classified", data.classified_candidates ?? 0],
      ["unclassified", data.unclassified_candidates ?? 0],
      ["tickers shown", flat.length],
    ];
    cov.innerHTML = stats
      .map(
        (pair) =>
          '<div class="stat"><div class="k">' +
          esc(pair[0]) +
          '</div><div class="v">' +
          pair[1] +
          "</div></div>"
      )
      .join("");
  }

  function fillChainFilter(flat) {
    const sel = document.getElementById("chain-filter");
    if (!sel) return;
    const chains = Array.from(new Set(flat.map((t) => String(t.chain || "").toLowerCase()).filter(Boolean))).sort();
    const cur = state.chain;
    sel.innerHTML =
      '<option value="all">all</option>' +
      chains.map((c) => '<option value="' + esc(c) + '">' + esc(c) + "</option>").join("");
    sel.value = chains.includes(cur) || cur === "all" ? cur : "all";
    state.chain = sel.value;
  }

  function tokenRow(t) {
    const meta = [
      t.chain,
      fmtAge(t),
      t.score != null ? "score " + t.score : null,
      t.mc != null ? "mc " + money(t.mc) : null,
    ]
      .filter(Boolean)
      .join(" · ");
    return (
      '<div class="tok-row">' +
      '<div class="tok-main">' +
      tickerLink(t) +
      '<span class="tok-name">' +
      esc(t.name || "—") +
      "</span></div>" +
      '<div class="tok-meta mono">' +
      esc(meta) +
      "</div>" +
      '<div class="tok-nums">' +
      '<span title="age">' +
      esc(fmtAge(t)) +
      "</span>" +
      '<span title="score">' +
      (t.score != null ? esc(String(t.score)) : "—") +
      "</span>" +
      "<span>" +
      money(t.mc) +
      "</span>" +
      "<span>" +
      money(t.liq) +
      "</span></div></div>"
    );
  }

  function renderExplorer(data) {
    const root = document.getElementById("explorer");
    if (!root) return;
    const slices = normalizeSlices(data); // fixed category order
    if (!slices.length) {
      root.innerHTML = '<div class="empty">No classified candidates yet.</div>';
      return;
    }
    const palette =
      (window.Desk && Desk.PALETTE) ||
      ["#E8734A", "#60A5FA", "#34D399", "#FBBF24", "#A78BFA", "#F472B6", "#2DD4BF", "#F87171"];

    root.innerHTML = slices
      .map((s, i) => {
        const color = palette[i % palette.length];
        const catOpen = state.openCats.has(s.category);
        const catTokens = allCatTokens(s);
        if (!catTokens.length && state.chain !== "all") return "";
        const subs = sortSubs(s.subcategories || []).filter((sc) => filterTokens(sc.tokens || []).length);
        const subsHtml = subs
          .map((sc) => {
            const key = subKey(s.category, sc.subcategory);
            const open = state.openSubs.has(key);
            const toks = sortTokens(filterTokens(sc.tokens || []));
            return (
              '<details class="sub-acc" data-sub-key="' +
              esc(key) +
              '"' +
              (open ? " open" : "") +
              ">" +
              '<summary class="sub-sum">' +
              '<span class="sub-name">' +
              esc(sc.subcategory) +
              "</span>" +
              '<span class="badge">' +
              toks.length +
              "</span>" +
              '<span class="expand-hint">tickers</span>' +
              "</summary>" +
              '<div class="sub-body">' +
              (toks.length ? toks.map(tokenRow).join("") : '<div class="empty">No tickers</div>') +
              "</div></details>"
            );
          })
          .join("");

        return (
          '<details class="cat-acc" data-cat="' +
          esc(s.category) +
          '"' +
          (catOpen ? " open" : "") +
          ">" +
          '<summary class="cat-sum">' +
          '<span class="swatch" style="background:' +
          color +
          '"></span>' +
          '<span class="cat-name">' +
          esc(s.category) +
          "</span>" +
          '<span class="badge">' +
          catTokens.length +
          (s.pct != null ? " · " + s.pct + "%" : "") +
          "</span>" +
          '<span class="muted cat-subcount">' +
          subs.length +
          " subs</span>" +
          "</summary>" +
          '<div class="cat-body">' +
          (s.description ? '<div class="cat-desc muted">' + esc(s.description) + "</div>" : "") +
          (subsHtml || '<div class="empty">No subcategories with tickers</div>') +
          "</div></details>"
        );
      })
      .filter(Boolean)
      .join("");

    root.querySelectorAll("details.cat-acc").forEach((el) => {
      el.addEventListener("toggle", () => {
        const cat = el.getAttribute("data-cat");
        if (el.open) state.openCats.add(cat);
        else state.openCats.delete(cat);
      });
    });
    root.querySelectorAll("details.sub-acc").forEach((el) => {
      el.addEventListener("toggle", () => {
        const key = el.getAttribute("data-sub-key");
        if (el.open) state.openSubs.add(key);
        else state.openSubs.delete(key);
      });
    });
  }

  function renderTable(flat) {
    const body = document.getElementById("ticker-body");
    const count = document.getElementById("sorted-count");
    if (!body) return;
    const rows = sortTokens(flat);
    if (count) count.textContent = rows.length + " tickers";
    if (!rows.length) {
      body.innerHTML = '<tr><td colspan="8" class="empty">No tickers for this filter</td></tr>';
      return;
    }
    body.innerHTML = rows
      .map((t) => {
        const cat =
          esc(t.category || "—") +
          (t.subcategory ? ' <span class="muted">/ ' + esc(t.subcategory) + "</span>" : "");
        return (
          "<tr>" +
          '<td class="sym">' +
          tickerLink(t) +
          "</td>" +
          "<td>" +
          esc(t.name || "—") +
          "</td>" +
          '<td><span class="badge blue">' +
          esc(t.chain || "—") +
          "</span></td>" +
          '<td style="text-transform:capitalize">' +
          cat +
          "</td>" +
          '<td class="mono">' +
          esc(fmtAge(t)) +
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

  function markSortHeaders() {
    document.querySelectorAll("th.th-sort").forEach((th) => {
      const key = th.getAttribute("data-sort");
      th.classList.toggle("active", key === state.sortBy);
      th.dataset.dir = state.sortDir;
    });
  }

  function rerender() {
    if (!state.data) return;
    const flat = flattenAll(state.data);
    renderPie(state.data);
    renderCoverage(state.data, flat);
    renderExplorer(state.data);
    renderTable(flat);
    markSortHeaders();
    const banner = document.getElementById("ticker-banner");
    if (banner) {
      banner.textContent =
        flat.length +
        " tickers · categories fixed · sort " +
        state.sortBy +
        " " +
        state.sortDir +
        (state.chain !== "all" ? " · chain " + state.chain : "");
    }
    const src = document.getElementById("source-line");
    if (src) {
      src.textContent =
        "data/taxonomy_pie.json · " +
        flat.length +
        " tickers · " +
        (state.data.slices || []).length +
        " categories";
    }
  }

  function wireControls() {
    const by = document.getElementById("sort-by");
    const dir = document.getElementById("sort-dir");
    const chain = document.getElementById("chain-filter");
    if (by) {
      by.value = state.sortBy;
      by.addEventListener("change", () => {
        state.sortBy = by.value;
        // age default: newest first feels right as desc? actually age desc = oldest first. Prefer youngest first = asc minutes.
        if (state.sortBy === "age" && dir) {
          state.sortDir = "asc";
          dir.value = "asc";
        }
        rerender();
      });
    }
    if (dir) {
      dir.value = state.sortDir;
      dir.addEventListener("change", () => {
        state.sortDir = dir.value;
        rerender();
      });
    }
    if (chain) {
      chain.addEventListener("change", () => {
        state.chain = chain.value;
        rerender();
      });
    }
    const expand = document.getElementById("expand-all");
    const collapse = document.getElementById("collapse-all");
    if (expand) {
      expand.addEventListener("click", () => {
        if (!state.data) return;
        for (const s of normalizeSlices(state.data)) {
          state.openCats.add(s.category);
          for (const sc of s.subcategories || []) state.openSubs.add(subKey(s.category, sc.subcategory));
        }
        rerender();
      });
    }
    if (collapse) {
      collapse.addEventListener("click", () => {
        state.openCats.clear();
        state.openSubs.clear();
        rerender();
      });
    }
    document.querySelectorAll("th.th-sort").forEach((th) => {
      th.addEventListener("click", () => {
        const key = th.getAttribute("data-sort");
        if (!key) return;
        if (state.sortBy === key) state.sortDir = state.sortDir === "asc" ? "desc" : "asc";
        else {
          state.sortBy = key;
          state.sortDir =
            key === "symbol" || key === "name" || key === "category" || key === "chain" || key === "age"
              ? "asc"
              : "desc";
        }
        if (by && ["score", "mc", "liq", "age", "symbol", "name"].includes(state.sortBy)) by.value = state.sortBy;
        if (dir) dir.value = state.sortDir;
        rerender();
      });
    });
  }

  async function load() {
    const nav = document.getElementById("nav-root");
    if (nav && window.Desk && Desk.navHtml) nav.innerHTML = Desk.navHtml("research");

    const res = await fetch("./data/taxonomy_pie.json?t=" + Date.now(), { cache: "no-store" });
    if (!res.ok) throw new Error("taxonomy_pie.json HTTP " + res.status);
    state.data = await res.json();

    if (window.Desk && Desk.setText) Desk.setText("generated-at", Desk.fmtTime(state.data.generated_at));
    else {
      const el = document.getElementById("generated-at");
      if (el) el.textContent = state.data.generated_at || "—";
    }

    const slices = normalizeSlices(state.data);
    if (slices[0]) state.openCats.add(slices[0].category);

    fillChainFilter(flattenAll(state.data));
    wireControls();
    rerender();
  }

  if (window.Desk && typeof Desk.boot === "function") Desk.boot(load);
  else {
    document.addEventListener("DOMContentLoaded", function () {
      const err = document.getElementById("gate-error");
      if (err) err.textContent = "desk.js failed to load — cannot unlock";
    });
  }
})();
