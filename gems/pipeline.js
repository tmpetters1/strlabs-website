/* BUILD NOTE (2026-08-04): Gem Radar pipeline visualization — wireflow v3.
   Static reference page — no data/*.json fetch, content is the desk's own
   architecture (agents, handoffs, Discord rails, shared-brain stores) sourced
   from context/ops.yaml, COMMS.md, dd_checklist.yaml, sm_pipeline.md,
   onchain_intel.md and focus.yaml/kill_list.yaml. Update this file (not just
   the yaml) if the desk's stage/channel/store shape changes materially.

   v3 note: layout stretches vertically. Conductor lives on its own orchestration
   rail (not in the specialist row). Queue is a separate bus lane under the
   specialists (not an agent card). STAGES/CHANNELS/STORES/EDGES remain the
   single source of truth for Wireflow + Sequence. */
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
      killNote: "factory_fence / kill_list hit before queueing → never enters the queue at all (silent skip, not a kill event on a row).",
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
      killNote: "dev_wallet_history serial-rug fail or a clone_count farm fail → kill even this late, not just capped.",
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

  // kill/fence branches into the KILLED sink — sourced from the same stage
  // objects' killNote fields, not new facts.
  const KILL_EDGES = [
    { from: "scout", label: "factory_fence / kill_list" },
    { from: "class", label: "dead_flow / clone_count" },
    { from: "research", label: "serial-rug / clone farm" },
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

  // ---------------------------------------------------------------- wireflow render

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

  // Layout lanes: specialists stay in the middle agent path.
  // Queue is a bus (not an agent). Conductor is orchestration (not a specialist).
  const SPECIALIST_IDS = ["macro", "scout", "class", "whale", "research", "radar", "learn"];
  const ORCH_IDS = ["conductor"];
  const QUEUE_IDS = ["queue"];

  function stageCardHtml(s, displayIdx, extraClass) {
    const cls = ["wf-stage"];
    if (s.loop) cls.push("pl-loop");
    if (s.star) cls.push("wf-conductor");
    if (s.kind === "store" || s.id === "queue") cls.push("wf-queue-card");
    if (extraClass) cls.push(extraClass);
    const role = s.role.length > 96 ? s.role.slice(0, 93).trim() + "…" : s.role;
    const idxLabel = displayIdx == null ? (s.star ? "★" : "·") : String(displayIdx);
    return `<button class="${cls.join(" ")}" id="stage-${s.id}" data-open="stage:${s.id}" data-stage-id="${s.id}" type="button">
      <div class="wf-stage-head">
        <span class="pl-idx">${esc(idxLabel)}</span>
        <div><div class="wf-stage-title">${esc(s.title)}${s.star ? ' <span class="pl-badge star">★</span>' : ""}</div><div class="wf-stage-tag">${esc(s.tag)}</div></div>
      </div>
      <div class="wf-stage-role">${esc(role)}</div>
    </button>`;
  }

  function renderStageNodes() {
    const stageRoot = document.getElementById("wf-stage-nodes");
    const orchRoot = document.getElementById("wf-orch-nodes");
    const queueRoot = document.getElementById("wf-queue-nodes");
    let specialistHtml = "";
    let orchHtml = "";
    let queueHtml = "";
    let specialistN = 0;

    STAGES.forEach((s) => {
      if (ORCH_IDS.includes(s.id)) {
        orchHtml += stageCardHtml(s, null, "wf-orch-card");
        return;
      }
      if (QUEUE_IDS.includes(s.id)) {
        queueHtml += stageCardHtml(s, null, "wf-queue-card");
        return;
      }
      // default: specialist path (+ anything unexpected stays visible)
      specialistHtml += stageCardHtml(s, specialistN, SPECIALIST_IDS.includes(s.id) ? "" : "wf-misc-card");
      specialistN += 1;
    });

    // Kill sink sits with the specialist path end — still a path outcome, not an agent.
    specialistHtml += `<button class="wf-kill-sink" id="wf-kill-sink" data-open="killnode:info" type="button">✕ KILLED<span class="sub">no brief · no publish</span></button>`;

    if (stageRoot) stageRoot.innerHTML = specialistHtml;
    if (orchRoot) orchRoot.innerHTML = orchHtml || "<div class=\"wf-empty\">—</div>";
    if (queueRoot) {
      queueRoot.innerHTML = queueHtml
        + `<div class="wf-queue-note">candidates.jsonl · only via queue_lib.py · identity = (chain, contract)</div>`;
    }
  }

  function renderRail(container, items, type) {
    container.innerHTML = items
      .map(
        (it) => `<button class="pl-node ${type}" id="${type}-${it.id}" data-open="${type}:${it.id}" data-node-id="${it.id}" type="button">
        <div class="pl-node-title">${esc(it.title)}</div>
        <div class="pl-node-sub">${esc((it.purpose || it.when || "").slice(0, 80))}${(it.purpose || "").length > 80 ? "…" : ""}</div>
      </button>`
      )
      .join("");
  }

  // -------------------------------------------------------------- svg connector engine

  function relRect(container, el) {
    const c = container.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    return { x: r.left - c.left, y: r.top - c.top, w: r.width, h: r.height, cx: r.left - c.left + r.width / 2, cy: r.top - c.top + r.height / 2 };
  }

  function boxEdgePoint(rect, dirX, dirY) {
    const hw = rect.w / 2, hh = rect.h / 2;
    if (!dirX && !dirY) return { x: rect.cx, y: rect.cy };
    const tx = dirX ? hw / Math.abs(dirX) : Infinity;
    const ty = dirY ? hh / Math.abs(dirY) : Infinity;
    const t = Math.min(tx, ty);
    return { x: rect.cx + dirX * t, y: rect.cy + dirY * t };
  }

  function connectorPoints(rectA, rectB) {
    let dx = rectB.cx - rectA.cx, dy = rectB.cy - rectA.cy;
    const len = Math.hypot(dx, dy) || 1;
    dx /= len; dy /= len;
    return { p1: boxEdgePoint(rectA, dx, dy), p2: boxEdgePoint(rectB, -dx, -dy) };
  }

  const SVGNS = "http://www.w3.org/2000/svg";
  function svgEl(tag, attrs) {
    const el = document.createElementNS(SVGNS, tag);
    Object.keys(attrs || {}).forEach((k) => el.setAttribute(k, attrs[k]));
    return el;
  }

  function pathD(p1, p2, curve) {
    if (!curve) return `M${p1.x},${p1.y} L${p2.x},${p2.y}`;
    const mx = (p1.x + p2.x) / 2, my = (p1.y + p2.y) / 2;
    const dx = p2.x - p1.x, dy = p2.y - p1.y;
    const nx = -dy, ny = dx;
    const nlen = Math.hypot(nx, ny) || 1;
    const off = curve;
    const cx = mx + (nx / nlen) * off, cy = my + (ny / nlen) * off;
    return `M${p1.x},${p1.y} Q${cx},${cy} ${p2.x},${p2.y}`;
  }

  function shortLabel(s, max) {
    const t = String(s || "").replace(/\s+/g, " ").trim();
    if (t.length <= max) return t;
    return t.slice(0, Math.max(0, max - 1)).trim() + "…";
  }

  let wfEdgePaths = []; // {el, from, to, isKill}

  function clearSvgExceptDefs(svg) {
    Array.from(svg.children).forEach((n) => {
      if (n.tagName.toLowerCase() !== "defs") n.remove();
    });
  }

  function drawWireflow() {
    const inner = document.getElementById("wf-inner");
    const svg = document.getElementById("wf-svg");
    if (!inner || !svg || inner.offsetParent === null) return;
    clearSvgExceptDefs(svg);
    document.querySelectorAll("#view-wireflow .wf-edge-label").forEach((n) => n.remove());
    wfEdgePaths = [];

    const stageRect = (id) => { const el = document.getElementById("stage-" + id); return el ? relRect(inner, el) : null; };
    const chRect = (id) => { const el = document.getElementById("channel-" + id); return el ? relRect(inner, el) : null; };
    const stRect = (id) => { const el = document.getElementById("store-" + id); return el ? relRect(inner, el) : null; };
    const killRect = () => { const el = document.getElementById("wf-kill-sink"); return el ? relRect(inner, el) : null; };

    // main handoff edges
    EDGES.forEach((e, i) => {
      const ra = stageRect(e.from), rb = stageRect(e.to);
      if (!ra || !rb) return;
      const { p1, p2 } = connectorPoints(ra, rb);
      const path = svgEl("path", { d: pathD(p1, p2, 0), class: "wf-path main", "marker-end": "url(#wf-arrow)" });
      svg.appendChild(path);
      wfEdgePaths.push({ el: path, from: e.from, to: e.to });
      const mid = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "wf-edge-label";
      btn.setAttribute("data-open", "edge:" + i);
      btn.style.left = mid.x + "px";
      btn.style.top = (mid.y - 10) + "px";
      btn.textContent = shortLabel(e.short || e.label, 22);
      btn.title = e.label + " — click for details";
      inner.appendChild(btn);
    });

    // secondary: stage -> channel (posts to)
    STAGES.forEach((s) => {
      const ra = stageRect(s.id);
      if (!ra) return;
      (s.channels || []).forEach((c) => {
        const rb = chRect(c.id);
        if (!rb) return;
        const { p1, p2 } = connectorPoints(ra, rb);
        const path = svgEl("path", { d: pathD(p1, p2, -18), class: "wf-path secondary to-channel", "marker-end": "url(#wf-arrow)" });
        svg.appendChild(path);
        wfEdgePaths.push({ el: path, from: s.id, to: "ch:" + c.id });
      });
      (s.stores || []).forEach((st) => {
        const rb = stRect(st.id);
        if (!rb) return;
        const reads = /read/.test(st.mode);
        const { p1, p2 } = connectorPoints(ra, rb);
        const path = svgEl("path", { d: pathD(p1, p2, 18), class: "wf-path secondary " + (reads ? "to-store-read" : "to-store-write"), "marker-end": "url(#wf-arrow)" });
        svg.appendChild(path);
        wfEdgePaths.push({ el: path, from: s.id, to: "st:" + st.id });
      });
    });

    // kill branches
    const rk = killRect();
    if (rk) {
      KILL_EDGES.forEach((k) => {
        const ra = stageRect(k.from);
        if (!ra) return;
        const { p1, p2 } = connectorPoints(ra, rk);
        const path = svgEl("path", { d: pathD(p1, p2, 0), class: "wf-path kill", "marker-end": "url(#wf-arrow)" });
        svg.appendChild(path);
        wfEdgePaths.push({ el: path, from: k.from, to: "KILLED", kill: true });
        const mid = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "wf-edge-label kill";
        btn.setAttribute("data-open", "stage:" + k.from);
        btn.style.left = mid.x + "px";
        btn.style.top = (mid.y - 8) + "px";
        btn.textContent = shortLabel(k.short || k.label, 20);
        btn.title = k.label + " — click for details";
        inner.appendChild(btn);
      });
    }
  }

  function wireHoverHighlight() {
    document.querySelectorAll(".wf-stage[data-stage-id]").forEach((el) => {
      const id = el.getAttribute("data-stage-id");
      el.addEventListener("mouseenter", () => highlightStage(id));
      el.addEventListener("mouseleave", clearHighlight);
      el.addEventListener("focus", () => highlightStage(id));
      el.addEventListener("blur", clearHighlight);
    });
  }

  function highlightStage(id) {
    wfEdgePaths.forEach((e) => {
      const related = e.from === id || e.to === id;
      e.el.classList.toggle("hi", related);
      e.el.classList.toggle("dim", !related);
    });
    document.querySelectorAll(".wf-stage[data-stage-id]").forEach((el) => {
      el.classList.toggle("wf-dim", el.getAttribute("data-stage-id") !== id);
    });
  }

  function clearHighlight() {
    wfEdgePaths.forEach((e) => { e.el.classList.remove("hi", "dim"); });
    document.querySelectorAll(".wf-stage[data-stage-id]").forEach((el) => el.classList.remove("wf-dim"));
  }

  // ---------------------------------------------------------------- sequence view

  const SEQ_LANES = [
    { id: "scout", label: "Scout" },
    { id: "class", label: "Class" },
    { id: "whale", label: "Whale" },
    { id: "research", label: "Research" },
    { id: "conductor", label: "Conductor" },
    { id: "radar", label: "Radar" },
    { id: "discord", label: "Discord", discord: true },
  ];

  // Only orders/labels the same EDGES + channel data above — no new facts.
  const SEQ_MESSAGES = [
    { note: "scout", text: EDGES[0].what },
    { note: "scout", text: EDGES[1].label },
    { from: "scout", to: "class", open: { type: "edge", id: 2 }, text: EDGES[2].label },
    { from: "scout", to: "discord", open: { type: "channel", id: "standup" }, text: "#standup" },
    { from: "scout", to: "discord", open: { type: "channel", id: "delegation" }, text: "#delegation" },
    { kill: "scout", open: { type: "stage", id: "scout" }, text: "✕ factory_fence / kill_list → KILLED" },
    { from: "class", to: "whale", open: { type: "edge", id: 3 }, text: EDGES[3].label },
    { from: "class", to: "discord", open: { type: "channel", id: "decisions-log" }, text: "#decisions-log" },
    { kill: "class", open: { type: "stage", id: "class" }, text: "✕ dead_flow / clone_count → KILLED" },
    { from: "whale", to: "research", open: { type: "edge", id: 4 }, text: EDGES[4].label },
    { from: "whale", to: "discord", open: { type: "channel", id: "discussion" }, text: "#discussion · whale_hit" },
    { from: "research", to: "conductor", open: { type: "edge", id: 5 }, text: EDGES[5].label },
    { from: "research", to: "discord", open: { type: "channel", id: "discussion" }, text: "#discussion · brief_ready" },
    { kill: "research", open: { type: "stage", id: "research" }, text: "✕ serial-rug / clone farm → KILLED" },
    { from: "conductor", to: "radar", open: { type: "edge", id: 6 }, text: EDGES[6].label },
    { from: "radar", to: "discord", open: { type: "channel", id: "standup" }, text: "#standup · dashboard_publish" },
    { note: "radar", text: EDGES[7].what + " (→ Learn)" },
  ];

  const SEQ_ROW_H = 46, SEQ_TOP = 18;

  function renderSeqHeads() {
    const head = document.getElementById("wf-seq-head");
    head.innerHTML = SEQ_LANES.map((l) => `<div class="wf-lane-hdr${l.discord ? " discord" : ""}" id="seqlane-${l.id}" data-open="${l.discord ? "" : "stage:" + l.id}">${esc(l.label)}</div>`).join("");
  }

  function drawSequence() {
    const inner = document.getElementById("wf-seq-inner");
    const svg = document.getElementById("wf-seq-svg");
    const body = document.getElementById("wf-seq-body");
    if (!inner || !svg || inner.offsetParent === null) return;
    clearSvgExceptDefs(svg);
    body.innerHTML = "";

    const laneX = {};
    let headBottom = 60;
    const headEl = document.getElementById("wf-seq-head");
    if (headEl) headBottom = relRect(inner, headEl).y + relRect(inner, headEl).h + 14;
    SEQ_LANES.forEach((l) => {
      const el = document.getElementById("seqlane-" + l.id);
      if (!el) return;
      const r = relRect(inner, el);
      laneX[l.id] = r.cx;
    });

    const bodyH = SEQ_TOP + SEQ_MESSAGES.length * SEQ_ROW_H + 30;
    const totalH = headBottom + bodyH;
    inner.style.height = totalH + "px";
    svg.setAttribute("height", totalH);

    // lifelines
    SEQ_LANES.forEach((l) => {
      const x = laneX[l.id];
      if (x == null) return;
      svg.appendChild(svgEl("line", { x1: x, y1: 6, x2: x, y2: totalH - 20, class: "wf-seq-lifeline" }));
    });

    SEQ_MESSAGES.forEach((m, i) => {
      const y = headBottom + SEQ_TOP + i * SEQ_ROW_H;
      if (m.from && m.to) {
        const x1 = laneX[m.from], x2 = laneX[m.to];
        if (x1 == null || x2 == null) return;
        const path = svgEl("path", { d: `M${x1},${y} L${x2},${y}`, class: "wf-path", "marker-end": "url(#wf-arrow)" });
        svg.appendChild(path);
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "wf-seq-msg";
        btn.style.left = ((x1 + x2) / 2) + "px";
        btn.style.top = (y - 6) + "px";
        btn.textContent = m.text;
        if (m.open) btn.setAttribute("data-open", m.open.type + ":" + m.open.id);
        body.appendChild(btn);
      } else if (m.note || m.kill) {
        const laneId = m.note || m.kill;
        const x = laneX[laneId];
        if (x == null) return;
        const div = document.createElement("div");
        div.className = "wf-seq-note" + (m.kill ? " wf-seq-kill" : "");
        div.style.left = x + "px";
        div.style.top = (y - 10) + "px";
        div.textContent = m.text;
        if (m.open) div.setAttribute("data-open", m.open.type + ":" + m.open.id);
        body.appendChild(div);
      }
    });
  }

  // ---------------------------------------------------------------- drawer

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
    if (type === "killnode") return openKillDrawer();
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

  function openKillDrawer() {
    drawerTitle.textContent = "KILLED";
    drawerKind.textContent = "Sink · not published";
    let body = sec("What this means", `<p>The candidate drops out of the pipeline entirely — no brief, no dashboard publish, no human ping. It can happen at more than one stage; earlier is cheaper.</p>`);
    body += sec("Where it fires", list([
      "Scout — factory_fence or kill_list.yaml hit before the row is even queued (silent skip).",
      "Class — dead_flow fail, or a clone_count fail on a fenced factory farm.",
      "Research — dev_wallet_history serial-rug fail or a clone_count farm fail, caught even this late.",
    ]));
    body += sec("Related", `<div class="pl-chain"><span class="pl-badge" data-open="stage:scout">Scout</span><span class="pl-badge" data-open="stage:class">Class</span><span class="pl-badge" data-open="stage:research">Research</span><span class="pl-badge st" data-open="store:kill-list">kill_list.yaml</span></div>`);
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
      const val = openEl.getAttribute("data-open");
      if (!val) return;
      const [type, id] = val.split(":");
      openDrawer(type, id);
      return;
    }
    if (e.target.id === "drawer-close" || e.target === backdrop) hide();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") hide();
  });

  // ---------------------------------------------------------------- view toggle

  const VIEWS = ["wireflow", "sequence", "legend"];
  function setView(name) {
    VIEWS.forEach((v) => {
      const el = document.getElementById("view-" + v);
      const btn = document.getElementById("view-" + v + "-btn");
      if (v === name) {
        el.hidden = false;
        btn.classList.add("on");
      } else {
        el.hidden = true;
        btn.classList.remove("on");
      }
    });
    if (name === "wireflow") requestAnimationFrame(() => requestAnimationFrame(() => { drawWireflow(); fitWireflow(28); }));
    if (name === "sequence") requestAnimationFrame(() => requestAnimationFrame(drawSequence));
  }

  function initViewToggle() {
    document.getElementById("view-wireflow-btn").addEventListener("click", () => setView("wireflow"));
    document.getElementById("view-sequence-btn").addEventListener("click", () => setView("sequence"));
    document.getElementById("view-legend-btn").addEventListener("click", () => setView("legend"));
  }

  // ---------------------------------------------------------------- replay path animation

  const HAPPY_PATH = STAGES.map((s) => s.id);
  const KILL_PATH = ["macro", "scout", "queue", "class", "KILLED"];
  let currentMode = "happy";
  let animating = false;

  function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

  function ensureChip() {
    let chip = document.getElementById("wf-token-chip");
    if (!chip) {
      chip = document.createElement("div");
      chip.id = "wf-token-chip";
      chip.className = "wf-token-chip";
      chip.textContent = "● token";
      document.getElementById("wf-inner").appendChild(chip);
    }
    return chip;
  }
  function ensureFlash() {
    let flash = document.getElementById("wf-flash");
    if (!flash) {
      flash = document.createElement("div");
      flash.id = "wf-flash";
      flash.className = "wf-flash";
      document.getElementById("wf-inner").appendChild(flash);
    }
    return flash;
  }
  function showFlash(afterEl, text, kill) {
    const flash = ensureFlash();
    flash.classList.toggle("kill", !!kill);
    flash.textContent = text;
    const inner = document.getElementById("wf-inner");
    const r = relRect(inner, afterEl);
    flash.style.left = r.cx + "px";
    flash.style.top = (r.y + r.h + 8) + "px";
    flash.style.opacity = "1";
    setTimeout(() => { flash.style.opacity = "0"; }, 1300);
  }

  function stopElFor(id) {
    return id === "KILLED" ? document.getElementById("wf-kill-sink") : document.getElementById("stage-" + id);
  }

  async function replay(mode) {
    if (animating) return;
    setView("wireflow");
    await sleep(90);
    animating = true;
    const btn = document.getElementById("replay-btn");
    btn.disabled = true;
    btn.textContent = "■ Running…";
    document.querySelectorAll(".pl-hit,.pl-hit-kill").forEach((el) => el.classList.remove("pl-hit", "pl-hit-kill"));
    wfEdgePaths.forEach((e) => e.el.classList.remove("replay-active"));
    const stops = mode === "kill" ? KILL_PATH : HAPPY_PATH;
    const inner = document.getElementById("wf-inner");
    const canvas = document.getElementById("wf-canvas");
    const chip = ensureChip();
    chip.classList.toggle("kill-mode", mode === "kill");
    chip.style.opacity = "0";
    await sleep(60);
    let lastEl = null;
    for (let i = 0; i < stops.length; i++) {
      const el = stopElFor(stops[i]);
      if (!el) continue;
      el.scrollIntoView({ inline: "center", block: "nearest" });
      const r = relRect(inner, el);
      chip.style.top = (r.cy - 12) + "px";
      chip.style.left = (r.x + 14) + "px";
      chip.style.opacity = "1";
      el.classList.add(mode === "kill" ? "pl-hit-kill" : "pl-hit");
      if (i > 0) {
        const prevId = stops[i - 1];
        const edge = wfEdgePaths.find((e) => (e.from === prevId && e.to === stops[i]) || (mode === "kill" && e.kill && e.from === prevId && e.to === "KILLED"));
        if (edge) edge.el.classList.add("replay-active");
      }
      lastEl = el;
      await sleep(650);
      if (i < stops.length - 1) el.classList.remove("pl-hit", "pl-hit-kill");
    }
    if (lastEl) {
      if (mode === "kill") showFlash(lastEl, "✕ KILLED — kill_list / dead_flow fail_cap", true);
      else showFlash(lastEl, "✓ Loop closed → LEARNED.md constrains next pass", false);
    }
    await sleep(1400);
    chip.style.opacity = "0";
    wfEdgePaths.forEach((e) => e.el.classList.remove("replay-active"));
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

  // ---------------------------------------------------------------- zoom / pan

  const zoomState = { scale: 1, x: 0, y: 0, min: 0.35, max: 1.75 };
  let panning = false;
  let panStart = null;

  function applyZoomTransform() {
    const world = document.getElementById("wf-world");
    const pct = document.getElementById("wf-zoom-pct");
    if (!world) return;
    world.style.transform = "translate(" + zoomState.x + "px," + zoomState.y + "px) scale(" + zoomState.scale + ")";
    if (pct) pct.textContent = Math.round(zoomState.scale * 100) + "%";
  }

  function fitWireflow(pad) {
    const canvas = document.getElementById("wf-canvas");
    const inner = document.getElementById("wf-inner");
    if (!canvas || !inner) return;
    const p = pad == null ? 28 : pad;
    // natural content size (unscaled)
    const cw = canvas.clientWidth;
    const ch = canvas.clientHeight;
    const iw = Math.max(inner.scrollWidth, inner.offsetWidth, 1);
    const ih = Math.max(inner.scrollHeight, inner.offsetHeight, 1);
    const sx = (cw - p * 2) / iw;
    const sy = (ch - p * 2) / ih;
    let s = Math.min(sx, sy, 1);
    s = Math.max(zoomState.min, Math.min(zoomState.max, s));
    zoomState.scale = s;
    zoomState.x = Math.max(0, (cw - iw * s) / 2);
    zoomState.y = Math.max(12, (ch - ih * s) / 2);
    applyZoomTransform();
  }

  function zoomAt(clientX, clientY, nextScale) {
    const canvas = document.getElementById("wf-canvas");
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = clientX - rect.left;
    const my = clientY - rect.top;
    const s0 = zoomState.scale;
    const s1 = Math.max(zoomState.min, Math.min(zoomState.max, nextScale));
    if (s1 === s0) return;
    // keep point under cursor stable
    const wx = (mx - zoomState.x) / s0;
    const wy = (my - zoomState.y) / s0;
    zoomState.scale = s1;
    zoomState.x = mx - wx * s1;
    zoomState.y = my - wy * s1;
    applyZoomTransform();
  }

  function initZoomPan() {
    const canvas = document.getElementById("wf-canvas");
    if (!canvas) return;
    const zin = document.getElementById("wf-zoom-in");
    const zout = document.getElementById("wf-zoom-out");
    const zfit = document.getElementById("wf-zoom-fit");
    const z100 = document.getElementById("wf-zoom-100");
    if (zin) zin.addEventListener("click", () => {
      const r = canvas.getBoundingClientRect();
      zoomAt(r.left + r.width / 2, r.top + r.height / 2, zoomState.scale * 1.15);
    });
    if (zout) zout.addEventListener("click", () => {
      const r = canvas.getBoundingClientRect();
      zoomAt(r.left + r.width / 2, r.top + r.height / 2, zoomState.scale / 1.15);
    });
    if (zfit) zfit.addEventListener("click", () => fitWireflow(28));
    if (z100) z100.addEventListener("click", () => {
      zoomState.scale = 1;
      zoomState.x = 16;
      zoomState.y = 16;
      applyZoomTransform();
    });

    canvas.addEventListener("wheel", (e) => {
      e.preventDefault();
      const factor = e.deltaY > 0 ? 1 / 1.1 : 1.1;
      zoomAt(e.clientX, e.clientY, zoomState.scale * factor);
    }, { passive: false });

    canvas.addEventListener("pointerdown", (e) => {
      if (e.button !== 0) return;
      // don't pan when clicking interactive controls
      if (e.target.closest("button, a, input, [data-open]")) return;
      panning = true;
      panStart = { x: e.clientX, y: e.clientY, ox: zoomState.x, oy: zoomState.y };
      canvas.classList.add("panning");
      canvas.setPointerCapture(e.pointerId);
    });
    canvas.addEventListener("pointermove", (e) => {
      if (!panning || !panStart) return;
      zoomState.x = panStart.ox + (e.clientX - panStart.x);
      zoomState.y = panStart.oy + (e.clientY - panStart.y);
      applyZoomTransform();
    });
    const endPan = (e) => {
      if (!panning) return;
      panning = false;
      panStart = null;
      canvas.classList.remove("panning");
      try { canvas.releasePointerCapture(e.pointerId); } catch (_) {}
    };
    canvas.addEventListener("pointerup", endPan);
    canvas.addEventListener("pointercancel", endPan);

    // basic pinch
    let pinch = null;
    canvas.addEventListener("touchstart", (e) => {
      if (e.touches.length === 2) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        pinch = { dist: Math.hypot(dx, dy) || 1, scale: zoomState.scale };
      }
    }, { passive: true });
    canvas.addEventListener("touchmove", (e) => {
      if (!pinch || e.touches.length !== 2) return;
      e.preventDefault();
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.hypot(dx, dy) || 1;
      const cx = (e.touches[0].clientX + e.touches[1].clientX) / 2;
      const cy = (e.touches[0].clientY + e.touches[1].clientY) / 2;
      zoomAt(cx, cy, pinch.scale * (dist / pinch.dist));
    }, { passive: false });
    canvas.addEventListener("touchend", () => { pinch = null; });
  }

  // ---------------------------------------------------------------- boot

  async function load() {
    renderStageNodes();
    renderRail(document.getElementById("wf-channel-nodes"), CHANNELS, "channel");
    renderRail(document.getElementById("wf-store-nodes"), STORES, "store");
    renderSeqHeads();
    wireHoverHighlight();
    initViewToggle();
    initControls();
    initZoomPan();

    // initial connector draw must happen after #app is revealed (boot() flips
    // display:none -> block right after load() resolves); schedule as a
    // macrotask so it runs after that synchronous reveal.
    setTimeout(() => {
      drawWireflow();
      // double-rAF so layout settles, then fit to viewport (no sideways scroll)
      requestAnimationFrame(() => requestAnimationFrame(() => fitWireflow(28)));
    }, 0);

    let resizeTimer = null;
    const scheduleRedraw = () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        if (!document.getElementById("view-wireflow").hidden) {
          drawWireflow();
          fitWireflow(28);
        }
        if (!document.getElementById("view-sequence").hidden) drawSequence();
      }, 100);
    };
    if (window.ResizeObserver) {
      const ro = new ResizeObserver(scheduleRedraw);
      const canvas = document.getElementById("wf-canvas");
      if (canvas) ro.observe(canvas);
    }
    window.addEventListener("resize", scheduleRedraw);
  }

  D.boot(load);
})();
