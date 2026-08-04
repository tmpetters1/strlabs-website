/* BUILD NOTE (2026-08-04): Gem Radar pipeline visualization.
   Static reference page — no data/*.json fetch, content is the desk's own
   architecture (agents, handoffs, Discord rails, shared-brain stores) sourced
   from context/ops.yaml, COMMS.md, dd_checklist.yaml, sm_pipeline.md,
   onchain_intel.md and focus.yaml/kill_list.yaml. Update this file (not just
   the yaml) if the desk's stage/channel/store shape changes materially. */
(function () {
  "use strict";
  const D = window.Desk;

  const CHANNELS = [
    { id: "standup", discordId: "1473450982037000292", title: "#standup",
      purpose: "Live activity log. Every non-empty cycle gets 1-3 lines here — including “0 passers” scans — so Tor-Magnus can watch the desk breathe without anyone going silent.",
      when: "empty_scan, dashboard_publish, outcome_lesson" },
    { id: "delegation", discordId: "1472288122967556218", title: "#delegation",
      purpose: "Handoffs and wakes. Posted the moment something needs another specialist right now — new candidates, notify-bar briefs — with @mentions, not waiting for the next heartbeat.",
      when: "candidates_found, brief_score_ge_notify routing" },
    { id: "discussion", discordId: "1472368603197079705", title: "#discussion",
      purpose: "Research surface. Whale smart-money hits and finished Research briefs land here — the interesting stuff, not routine scans.",
      when: "whale_hit, brief_ready" },
    { id: "decisions-log", discordId: "1472368778879828222", title: "#decisions-log",
      purpose: "Focus and taxonomy changes. Macro posts weight shifts here; Class posts genuinely new taxonomy leaves.",
      when: "focus_shift, taxonomy_new" },
    { id: "errors", discordId: "1472368665390223585", title: "#errors",
      purpose: "Blockers only — API failures, rate limits, stuck queues, missing keys. A blocked tool result is never reported as a pass.",
      when: "blocker" },
  ];

  const STORES = [
    { id: "focus", title: "focus.yaml", path: "context/focus.yaml",
      purpose: "Living filter and weight map — active chains, launchpad weights, hot metas, watch_x handles. Read at runtime by every scan; filter values are never hardcoded in a script or a prompt.",
      keyRule: "Owned by Macro (+ Conductor). Robinhood + Base are primary (weight 1.0 / 0.7), BSC secondary (0.5) with stricter filters, Solana is off (weight 0.0)." },
    { id: "kill-list", title: "kill_list.yaml", path: "context/kill_list.yaml",
      purpose: "Skip/downweight patterns plus explicit blocklists — fenced factory implementations, blocked wallets, chain-name ticker farms, dead-book search echoes.",
      keyRule: "Read by Scout and Class before anything is queued or classified; grown by Learn from recorded outcomes." },
    { id: "dd-checklist", title: "dd_checklist.yaml", path: "context/dd_checklist.yaml + DD_CHECKLIST.md",
      purpose: "The self-interrogation gate every stage must answer before handoff — pass / fail / n_a / blocked per check, run through a script rather than eyeballed when one exists.",
      keyRule: "Missing required checks → status=needs_checks, owner re-woken, no human ping. Conductor can bounce incomplete work at any stage." },
    { id: "learned", title: "LEARNED.md", path: "context/LEARNED.md + learned_rules.yaml",
      purpose: "The binding output of the outcome loop — rules that actually change desk behavior (agent_rule / kill_* / focus_filter / taxonomy_gate), not just prose lessons.",
      keyRule: "Owned by Learn. Read every session by all agents; auto-applied via the gem-learn-apply cron every 30 minutes." },
    { id: "briefs", title: "briefs/", path: "briefs/ (+ briefs/improvements/)",
      purpose: "Research's deep-dive write-ups per token, plus Macro's periodic meta-improvement research briefs.",
      keyRule: "Written by Research at brief time; read by Radar for publish and by Conductor before a human ping." },
    { id: "state", title: "state/", path: "state/watchlist/, state/onchain/, state/sm/, state/trading/",
      purpose: "Runtime state: the living score≥50 watchlist, Whale's onchain intel outputs, cached SM wallet scores, and trade fills/positions.",
      keyRule: "watchlist_monitor.py re-evaluates traction every Conductor heartbeat — a brief is not the end of coverage." },
    { id: "whales", title: "memory/whales/", path: "memory/whales/0x*.yaml",
      purpose: "The living smart-money wallet registry — tier smart/alpha/watch/noise, built from multi-play multi-day evidence, not a static list.",
      keyRule: "Hard SM (smart/alpha) requires ≥2–3 distinct plays with multi-day holds and a low sniper score; insider/deployer bags are never hard SM." },
  ];

  const STAGES = [
    { id: "macro", kind: "agent", loop: true, tag: "@hume · Macro", title: "Macro",
      role: "Sets the weather. Runs Dune macro queries, tracks trending metas and launchpads, and owns focus.yaml — the live weight map every other agent reads before it does anything.",
      inputs: ["Dune API queries", "X trending scan", "novelty_high wake from Class", "improvement_research sweeps (weekly deep)"],
      outputs: ["Writes focus.yaml (chain / launchpad / meta weights)", "Promotes taxonomy_pending.yaml leaves with non-vapor evidence", "Posts #decisions-log on focus or taxonomy shifts", "Wakes Scout + Conductor on focus_shift"],
      scripts: ["context/focus.yaml (owns)", "context/taxonomy_pending.yaml", "briefs/improvements/"],
      cadence: "30m heartbeat + weekly deep improvement sweep",
      checklist: "macro_before_promote: non_vapor_example, not_boost_narrative, focus_still_valid",
      channels: [{ id: "decisions-log", note: "focus_shift / taxonomy_new" }],
      stores: [{ id: "focus", mode: "writes" }, { id: "kill-list", mode: "reads" }] },

    { id: "scout", kind: "agent", tag: "@dev · Scout", title: "Scout",
      role: "Surfaces new candidates from DexScreener (boosts / profiles / search) and the Uniswap Launches proxy across Robinhood, Base and BSC, then appends anything live to the shared queue.",
      inputs: ["focus.yaml chain weights + min_liq/min_mc/max_mc filters", "kill_list.yaml dedupe/skip patterns", "DexScreener + uniswap_launches.py feeds"],
      outputs: ["Appends to queue/candidates.jsonl via queue_lib.py (status: queued)", "Wakes Class + Whale + Research on a new candidate", "Posts #standup even on 0-passer scans, #delegation when candidates land"],
      scripts: ["scripts/dex_client.py", "scripts/uniswap_launches.py", "scripts/explorer_client.py fence", "scripts/queue_lib.py"],
      cadence: "10m heartbeat, max 5 candidates/run",
      checklist: "scout_before_queue: live_filters, not_duplicate, ca_pair_chain, source_tagged, links_captured, factory_fence",
      channels: [{ id: "standup", note: "empty_scan" }, { id: "delegation", note: "candidates_found" }],
      stores: [{ id: "focus", mode: "reads" }, { id: "kill-list", mode: "reads" }] },

    { id: "queue", kind: "store", tag: "candidates.jsonl · shared state", title: "Queue",
      role: "The single source of truth for the whole pipeline. Every stage reads and updates it — but only ever through queue_lib.py, which locks the file, enforces the status/check vocabulary, and reads the append back before anything is allowed to claim success.",
      inputs: ["Scout appends new rows", "Class / Whale / Research / Conductor update status + checks"],
      outputs: ["Read by every downstream agent, and by Radar for publish"],
      scripts: ["scripts/queue_lib.py (only writer)", "queue/candidates.jsonl"],
      statusFlow: "queued → classified → whale_reviewed → researching → briefed → notified  (also: needs_checks, tracking, deprioritized, killed)",
      identityRule: "Identity is always (chain, contract) — never symbol alone. Clone farms reuse tickers.",
      channels: [],
      stores: [] },

    { id: "class", kind: "agent", tag: "@hook · Class", title: "Class",
      role: "Labels taxonomy and novelty — is this a known category, a real new primitive, or ticker cosplay? First line of defense against clone farms and dead-flow noise.",
      inputs: ["Queued row from Scout", "context/taxonomy.yaml + taxonomy_pending.yaml", "kill_list.yaml patterns"],
      outputs: ["Writes taxonomy + novelty + checks to the queue row (status: classified)", "Wakes Macro when novelty is genuinely high", "Can kill on dead_flow / clone_count fail", "Posts #decisions-log on new taxonomy leaves"],
      scripts: ["scripts/queue_lib.py"],
      cadence: "15m heartbeat, wake-driven on candidate_new",
      checklist: "class_before_handoff: clone_count, contract_name_vs_ticker, website_shell, socials_exist, dead_flow, novelty_honest",
      killNote: "dead_flow fail → kill (do not deep-dive). clone_count fail on a fenced farm → kill, or novelty=none + low confidence.",
      channels: [{ id: "decisions-log", note: "taxonomy_new" }, { id: "delegation", note: "handoff wake" }],
      stores: [{ id: "kill-list", mode: "reads" }, { id: "dd-checklist", mode: "reads" }] },

    { id: "whale", kind: "agent", tag: "@autom · Whale", title: "Whale",
      role: "Smart-money and holder analysis. Runs the living SM buyer mine on every candidate plus the richer onchain intel pack — not a static wallet list.",
      inputs: ["Classified row from Class", "memory/whales/ registry", "explorer_client.py / deployer_check.py / goplus_client.py"],
      outputs: ["Every pass: sm_score.py score-token --stamp-queue AND onchain_intel.py run --stamp-queue", "Writes holder + SM + onchain checks to the queue row (status: whale_reviewed)", "Wakes Research immediately on a smart-money hit", "Posts #discussion on whale_hit"],
      scripts: ["scripts/sm_score.py", "scripts/sm_mine.py", "scripts/onchain_intel.py", "scripts/explorer_client.py", "scripts/deployer_check.py", "scripts/goplus_client.py"],
      cadence: "15m heartbeat",
      checklist: "whale_before_handoff: top_holders, label_lp_burn_lock, deployer_or_owner, dev_wallet_history, buyer_quality, concentration, smart_money_match, lp_secured (+ optional onchain checks)",
      livingSm: "Hard SM tiers (smart/alpha) need ≥2–3 distinct non-stable plays with multi-day holds and sniper_score ≤0.25–0.4. Late/mid-life buyers are first-class; day-0 early is a bonus only. Sniper clusters and insider/deployer bags are never hard SM.",
      onchainStamps: "onchain_flow, holder_growth, lp_timeline, authority_surface, product_events, bytecode_twin → state/onchain/",
      channels: [{ id: "discussion", note: "whale_hit" }],
      stores: [{ id: "whales", mode: "writes" }, { id: "state", mode: "writes" }, { id: "dd-checklist", mode: "reads" }] },

    { id: "research", kind: "agent", tag: "@reece · Research", title: "Research",
      role: "The deep dive. Reads Class + Whale's work, checks the website / product / socials for real vs. theater, stacks a score with explicit penalties, and makes the notify call.",
      inputs: ["Whale-reviewed row (Class + Whale outputs)", "scripts/x_client.py social pass", "scripts/goplus_client.py contract risk"],
      outputs: ["Writes a brief to briefs/", "Writes checks to the queue row (status: researching → briefed)", "Sets a top-level notify: true/false boolean", "Wakes Conductor + Radar when the brief clears the notify bar", "Posts #discussion when a brief is ready"],
      scripts: ["scripts/x_client.py", "scripts/goplus_client.py", "scripts/queue_lib.py"],
      cadence: "20m heartbeat, max 2 parallel",
      checklist: "research_before_brief: upstream_read, website_product_truth, site_points_to_ca, social_x_pass, contract_risk, deployer_in_score, thesis_invalidation, score_stack, notify_gate",
      notifyNote: "notify_gate is a top-level DECISION, not just a passed check. “notify_gate: pass” on the checklist means the gate was evaluated — it is not clearance to ping a human on its own.",
      failCaps: "website_product_truth fail → cap score ≤69. dev_wallet_history serial-rug fail → kill or ≤40. dead_flow fail → kill. clone_count farm fail → kill. concentration_extreme → cap notify unless LP locked + thesis is strong.",
      channels: [{ id: "discussion", note: "brief_ready" }],
      stores: [{ id: "briefs", mode: "writes" }, { id: "dd-checklist", mode: "reads" }] },

    { id: "conductor", kind: "agent", star: true, tag: "@ant / main · Conductor", title: "Conductor",
      role: "Orchestrator. Owns the human ping budget, the trading rails, and desk reliability — every specialist staying functional every cycle is the Conductor's job, not a status update to wait on.",
      inputs: ["Briefed queue rows", "conductor_before_ping checklist", "watchlist_monitor.py traction reevals"],
      outputs: ["Human Discord ping — max 8/day, min score 78, always-ping ≥90 (never for empty scans)", "May execute spot buy/sell on the RH + Base wallet under trading_strategy.md risk rails (require_dd_checks, min_score_to_buy 78)", "Runs watchlist_monitor.py every heartbeat on score≥50 tracked names → wakes Research/Whale on traction", "Fixes broken desk infrastructure before escalating to the human"],
      scripts: ["scripts/watchlist_monitor.py", "trading execution path (RH + Base, wallet 0x8063…a9E0)"],
      cadence: "15m heartbeat, wake-driven on hot signals",
      checklist: "conductor_before_ping: checks_present, multi_signal, score_bar, ping_budget",
      pingNote: "Only pings the human at score ≥ human_ping_min_score (78), on genuine novelty, or when the desk is blocked — agent-to-agent chatter in Discord is separate and expected, not a ping.",
      channels: [{ id: "errors", note: "blocker (desk reliability owner)" }],
      stores: [{ id: "dd-checklist", mode: "reads" }, { id: "state", mode: "writes" }] },

    { id: "radar", kind: "agent", tag: "@clip · Radar", title: "Radar",
      role: "Publishes the desk's state — queue, briefs, positions — out to this Str.Labs gems dashboard so Tor-Magnus can watch it live.",
      inputs: ["Queue + state + briefs", "Wake on brief_score_ge_notify"],
      outputs: ["publish_radar.py copies state → gems/data/*.json on this site", "Posts #standup on dashboard_publish"],
      scripts: ["scripts/publish_radar.py"],
      cadence: "30m heartbeat, wake-driven",
      channels: [{ id: "standup", note: "dashboard_publish" }],
      stores: [{ id: "state", mode: "reads" }, { id: "briefs", mode: "reads" }] },

    { id: "learn", kind: "agent", loop: true, tag: "@ed · Learn", title: "Learn",
      role: "Closes the loop. Tracks real outcomes on notified/tracked tokens and turns lessons into binding rule changes, not just prose in a memory file.",
      inputs: ["scripts/outcome_check.py over 1h/6h/24h/7d windows"],
      outputs: ["memory/lessons.md", "Binding updates to LEARNED.md / learned_rules.yaml (agent_rule / kill_* / focus_filter / taxonomy_gate) so kill_list, focus and agent behavior auto-update", "Posts #standup on outcome_lesson"],
      scripts: ["scripts/outcome_check.py", "scripts/learn_loop.py"],
      cadence: "1h heartbeat + gem-learn-apply cron every 30m",
      rule: "Writing memory/lessons.md alone is insufficient — every actionable lesson must become an enforceable rule, or state explicitly why it can't be.",
      channels: [{ id: "standup", note: "outcome_lesson" }],
      stores: [{ id: "learned", mode: "writes" }, { id: "kill-list", mode: "writes (via rule updates)" }, { id: "state", mode: "reads" }] },
  ];

  const EDGES = [
    { from: "macro", to: "scout", label: "focus.yaml read every session",
      what: "Macro's chain/launchpad/meta weights and filter values.", trigger: "Continuous — Scout reads focus.yaml fresh on every scan, never hardcoded." },
    { from: "scout", to: "queue", label: "queue_lib.append (verified)",
      what: "New candidate row: chain, contract, pair, symbol, source, links, scout_before_queue checks.", trigger: "Any live pass matching focus.yaml filters that isn't a duplicate or kill_list hit." },
    { from: "queue", to: "class", label: "status: queued → classify",
      what: "Wake to Class (+ Whale, Research) the moment a row lands.", trigger: "wake.routes.candidate_new: [hook, autom, reece]" },
    { from: "class", to: "whale", label: "status: classified → holders",
      what: "Taxonomy, novelty, and class_before_handoff checks attached to the row.", trigger: "Class passes required checks (or bounces to needs_checks)." },
    { from: "whale", to: "research", label: "status: whale_reviewed → deep dive",
      what: "Holder concentration, dev wallet history, living-SM tier, onchain intel stamps.", trigger: "smart_money_hit wakes Research immediately; otherwise normal heartbeat pickup." },
    { from: "research", to: "conductor", label: "brief + notify:true/false",
      what: "Finished brief (briefs/), score stack, and the top-level notify decision.", trigger: "brief_score_ge_notify wakes Conductor + Radar together." },
    { from: "conductor", to: "radar", label: "checks_present + score≥78",
      what: "Cleared-to-publish signal; may also trigger a trade or human ping in parallel.", trigger: "conductor_before_ping checklist passes." },
    { from: "radar", to: "learn", label: "published → outcome tracking",
      what: "Published/tracked token enters outcome_check.py's 1h/6h/24h/7d windows.", trigger: "Every publish; watchlist_monitor also feeds reevals back into this loop." },
  ];

  const CH_BY_ID = Object.fromEntries(CHANNELS.map((c) => [c.id, c]));
  const ST_BY_ID = Object.fromEntries(STORES.map((s) => [s.id, s]));
  const STAGE_BY_ID = Object.fromEntries(STAGES.map((s) => [s.id, s]));

  // reverse maps: who reads/writes each channel/store
  const channelUsers = {};
  const storeUsers = {};
  STAGES.forEach((s) => {
    (s.channels || []).forEach((c) => {
      (channelUsers[c.id] = channelUsers[c.id] || []).push({ stage: s, note: c.note });
    });
    (s.stores || []).forEach((st) => {
      (storeUsers[st.id] = storeUsers[st.id] || []).push({ stage: s, mode: st.mode });
    });
  });

  function esc(s) { return D.esc(s); }

  function renderStages() {
    const root = document.getElementById("pl-spine");
    let html = "";
    STAGES.forEach((s, i) => {
      html += `<button class="pl-stage${s.loop ? " pl-loop" : ""}" id="stage-${s.id}" data-open="stage:${s.id}" type="button">
        <div class="pl-stage-head">
          <span class="pl-idx">${i}</span>
          <div><div class="pl-stage-title">${esc(s.title)}${s.star ? ' <span class="pl-badge star">★ orchestrator</span>' : ""}</div><div class="pl-stage-tag">${esc(s.tag)}</div></div>
        </div>
        <div class="pl-stage-role">${esc(s.role)}</div>
        <div class="pl-badges">${badgesHtml(s)}</div>
      </button>`;
      if (i < EDGES.length) {
        const e = EDGES[i];
        html += `<div class="pl-edge" id="edge-${e.from}-${e.to}">
          <div class="pl-edge-line"></div>
          <button class="pl-edge-label" data-open="edge:${i}" type="button">${esc(e.label)} ↓</button>
        </div>`;
      }
    });
    root.innerHTML = html;
  }

  function badgesHtml(s) {
    const chips = [];
    (s.channels || []).forEach((c) => {
      const ch = CH_BY_ID[c.id];
      if (ch) chips.push(`<span class="pl-badge ch" data-open="channel:${ch.id}">${esc(ch.title)}</span>`);
    });
    (s.stores || []).forEach((st) => {
      const store = ST_BY_ID[st.id];
      if (store) chips.push(`<span class="pl-badge st" data-open="store:${store.id}">${esc(store.title)}</span>`);
    });
    return chips.join("");
  }

  function renderRail(container, items, type) {
    container.innerHTML = items
      .map(
        (it) => `<button class="pl-node ${type}" data-open="${type}:${it.id}" type="button">
        <div class="pl-node-title">${esc(it.title)}</div>
        <div class="pl-node-sub">${esc((it.purpose || it.when || "").slice(0, 90))}${(it.purpose || "").length > 90 ? "…" : ""}</div>
      </button>`
      )
      .join("");
  }

  // --- drawer ---
  const drawer = document.getElementById("drawer");
  const backdrop = document.getElementById("drawer-backdrop");
  const drawerTitle = document.getElementById("drawer-title");
  const drawerKind = document.getElementById("drawer-kind");
  const drawerBody = document.getElementById("drawer-body");

  function openDrawer(type, id) {
    if (type === "stage") return openStageDrawer(id);
    if (type === "channel") return openChannelDrawer(id);
    if (type === "store") return openStoreDrawer(id);
    if (type === "edge") return openEdgeDrawer(id);
  }

  function sec(title, bodyHtml) {
    return `<div class="pl-dsec"><h4>${esc(title)}</h4>${bodyHtml}</div>`;
  }
  function list(items) {
    if (!items || !items.length) return "<p>—</p>";
    return `<ul>${items.map((i) => `<li>${esc(i)}</li>`).join("")}</ul>`;
  }

  function openStageDrawer(id) {
    const s = STAGE_BY_ID[id];
    if (!s) return;
    drawerTitle.textContent = s.title;
    drawerKind.textContent = (s.kind === "store" ? "Data store · " : "Agent · ") + s.tag;
    let body = sec("Role", `<p>${esc(s.role)}</p>`);
    body += sec("Inputs", list(s.inputs));
    body += sec("Outputs", list(s.outputs));
    if (s.scripts) body += sec("Key scripts", `<p>${s.scripts.map((x) => `<code>${esc(x)}</code>`).join(" · ")}</p>`);
    if (s.cadence) body += sec("Cadence", `<p>${esc(s.cadence)}</p>`);
    if (s.checklist) body += sec("Checklist gate", `<p>${esc(s.checklist)}</p>`);
    if (s.statusFlow) body += sec("Status vocabulary", `<p><code>${esc(s.statusFlow)}</code></p>`);
    if (s.identityRule) body += sec("Identity rule", `<p>${esc(s.identityRule)}</p>`);
    if (s.killNote) body += sec("Kill path", `<p>${esc(s.killNote)}</p>`);
    if (s.livingSm) body += sec("Living smart-money rule", `<p>${esc(s.livingSm)}</p>`);
    if (s.onchainStamps) body += sec("Onchain intel stamps", `<p>${esc(s.onchainStamps)}</p>`);
    if (s.notifyNote) body += sec("Notify rule", `<p>${esc(s.notifyNote)}</p>`);
    if (s.failCaps) body += sec("Fail caps", `<p>${esc(s.failCaps)}</p>`);
    if (s.pingNote) body += sec("Human ping rule", `<p>${esc(s.pingNote)}</p>`);
    if (s.rule) body += sec("Rule", `<p>${esc(s.rule)}</p>`);
    const chain = badgesHtml(s);
    if (chain) body += sec("Touches", `<div class="pl-chain">${chain}</div>`);
    drawerBody.innerHTML = body;
    show();
  }

  function openChannelDrawer(id) {
    const c = CH_BY_ID[id];
    if (!c) return;
    drawerTitle.textContent = c.title;
    drawerKind.textContent = "Discord channel · " + c.discordId;
    let body = sec("Purpose", `<p>${esc(c.purpose)}</p>`);
    body += sec("Posted on", `<p>${esc(c.when)}</p>`);
    const users = channelUsers[id] || [];
    if (users.length) {
      body += sec(
        "Posted by",
        `<div class="pl-chain">${users.map((u) => `<span class="pl-badge" data-open="stage:${u.stage.id}">${esc(u.stage.title)}${u.note ? " · " + esc(u.note) : ""}</span>`).join("")}</div>`
      );
    }
    drawerBody.innerHTML = body;
    show();
  }

  function openStoreDrawer(id) {
    const s = ST_BY_ID[id];
    if (!s) return;
    drawerTitle.textContent = s.title;
    drawerKind.textContent = "Shared brain · " + s.path;
    let body = sec("Purpose", `<p>${esc(s.purpose)}</p>`);
    body += sec("Key rule", `<p>${esc(s.keyRule)}</p>`);
    const users = storeUsers[id] || [];
    if (users.length) {
      body += sec(
        "Read / written by",
        `<div class="pl-chain">${users.map((u) => `<span class="pl-badge" data-open="stage:${u.stage.id}">${esc(u.stage.title)} · ${esc(u.mode)}</span>`).join("")}</div>`
      );
    }
    drawerBody.innerHTML = body;
    show();
  }

  function openEdgeDrawer(idxStr) {
    const e = EDGES[Number(idxStr)];
    if (!e) return;
    const from = STAGE_BY_ID[e.from], to = STAGE_BY_ID[e.to];
    drawerTitle.textContent = `${from.title} → ${to.title}`;
    drawerKind.textContent = "Handoff";
    let body = sec("What moves", `<p>${esc(e.what)}</p>`);
    body += sec("Trigger", `<p>${esc(e.trigger)}</p>`);
    body += sec("Endpoints", `<div class="pl-chain"><span class="pl-badge" data-open="stage:${from.id}">${esc(from.title)}</span><span class="pl-badge" data-open="stage:${to.id}">${esc(to.title)}</span></div>`);
    drawerBody.innerHTML = body;
    show();
  }

  function show() {
    drawer.classList.add("open");
    backdrop.classList.add("open");
  }
  function hide() {
    drawer.classList.remove("open");
    backdrop.classList.remove("open");
  }

  document.addEventListener("click", (e) => {
    const openEl = e.target.closest("[data-open]");
    if (openEl) {
      const [type, id] = openEl.getAttribute("data-open").split(":");
      openDrawer(type, id);
      return;
    }
    if (e.target.id === "drawer-close" || e.target === backdrop) hide();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") hide();
  });

  // --- replay path animation ---
  const HAPPY_PATH = STAGES.map((s) => s.id);
  const KILL_PATH = ["macro", "scout", "queue", "class"];
  let currentMode = "happy";
  let animating = false;

  function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

  function ensureChip() {
    let chip = document.getElementById("pl-token-chip");
    if (!chip) {
      chip = document.createElement("div");
      chip.id = "pl-token-chip";
      chip.className = "pl-token-chip";
      chip.textContent = "● token";
      document.getElementById("pl-spine").appendChild(chip);
    }
    return chip;
  }
  function ensureFlash() {
    let flash = document.getElementById("pl-flash");
    if (!flash) {
      flash = document.createElement("div");
      flash.id = "pl-flash";
      flash.className = "pl-flash";
      document.getElementById("pl-spine").appendChild(flash);
    }
    return flash;
  }
  function showFlash(afterEl, text, kill) {
    const flash = ensureFlash();
    flash.classList.toggle("kill", !!kill);
    flash.textContent = text;
    const spine = document.getElementById("pl-spine");
    const spineRect = spine.getBoundingClientRect();
    const elRect = afterEl.getBoundingClientRect();
    flash.style.top = elRect.bottom - spineRect.top + 6 + "px";
    flash.style.opacity = "1";
    setTimeout(() => { flash.style.opacity = "0"; }, 1300);
  }

  async function replay(mode) {
    if (animating) return;
    animating = true;
    const btn = document.getElementById("replay-btn");
    btn.disabled = true;
    btn.textContent = "■ Running…";
    document.querySelectorAll(".pl-hit,.pl-hit-kill").forEach((el) => el.classList.remove("pl-hit", "pl-hit-kill"));
    const stops = mode === "kill" ? KILL_PATH : HAPPY_PATH;
    const spine = document.getElementById("pl-spine");
    const chip = ensureChip();
    chip.classList.toggle("kill-mode", mode === "kill");
    chip.style.opacity = "0";
    await sleep(60);
    let lastEl = null;
    for (let i = 0; i < stops.length; i++) {
      const el = document.getElementById("stage-" + stops[i]);
      if (!el) continue;
      const spineRect = spine.getBoundingClientRect();
      const elRect = el.getBoundingClientRect();
      chip.style.top = elRect.top - spineRect.top + elRect.height / 2 - 12 + "px";
      chip.style.left = elRect.left - spineRect.left + 18 + "px";
      chip.style.opacity = "1";
      el.classList.add(mode === "kill" ? "pl-hit-kill" : "pl-hit");
      lastEl = el;
      await sleep(600);
      if (i < stops.length - 1) el.classList.remove("pl-hit", "pl-hit-kill");
    }
    if (lastEl) {
      if (mode === "kill") showFlash(lastEl, "✕ KILLED — kill_list / dead_flow fail_cap", true);
      else showFlash(lastEl, "✓ Loop closed → LEARNED.md constrains next pass", false);
    }
    await sleep(1400);
    chip.style.opacity = "0";
    if (lastEl) lastEl.classList.remove("pl-hit", "pl-hit-kill");
    btn.disabled = false;
    btn.textContent = "▶ Replay path";
    animating = false;
  }

  function initControls() {
    const happyBtn = document.getElementById("mode-happy");
    const killBtn = document.getElementById("mode-kill");
    happyBtn.addEventListener("click", () => {
      currentMode = "happy";
      happyBtn.classList.add("on");
      killBtn.classList.remove("on", "kill-on");
    });
    killBtn.addEventListener("click", () => {
      currentMode = "kill";
      killBtn.classList.add("on", "kill-on");
      happyBtn.classList.remove("on");
    });
    document.getElementById("replay-btn").addEventListener("click", () => replay(currentMode));
  }

  async function load() {
    renderStages();
    renderRail(document.getElementById("rail-channels"), CHANNELS, "channel");
    renderRail(document.getElementById("rail-stores"), STORES, "store");
    initControls();
  }

  D.boot(load);
})();
