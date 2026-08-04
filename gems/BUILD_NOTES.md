# Trading Desk build notes — 2026-08-04

## What changed

Added a full Trading Desk to the Gem Radar dashboard. Radar page and its data path
(`data/radar.json`, `app.js`) are untouched except for a nav bar.

### New pages
- `trade.html` / `trade.js` — wallet address, open positions with live PnL, trade
  history, PnL summary. Positions come from `gem-radar/memory/positions.yaml`
  (human-reported fills), reconciled against `state/wallet_holdings_rh.json`
  (actual on-chain balance) and live DexScreener price for the pair.
- `research.html` / `research.js` — pure-SVG donut chart of category mix across
  every classified candidate in `queue/candidates.jsonl`, plus a full
  category → subcategory breakdown table.
- `strategy.html` / `strategy.js` — renders `context/trading_strategy.md` with a
  small built-in markdown renderer (headings, lists, bold/italic, links, code,
  blockquotes — no CDN).
- `learnings.html` / `learnings.js` — timeline of desk lessons parsed from
  `memory/lessons.md` (date / observation / action / owner).

### New shared assets
- `desk.js` — shared gate/auth boot (same `sessionStorage` key as the existing
  radar gate, so one password unlock covers every page), nav bar renderer,
  format helpers, tiny markdown renderer, pure-SVG pie chart + legend builder.
- `desk.css` — shared dark theme extracted/extended from the radar page's
  inline styles so every desk page looks consistent.
- `index.html` — added a `desk.js`-driven nav bar (`Radar | Trade | Research |
  Strategy | Learnings`). No existing IDs, classes, or `app.js` logic changed.

### New data files (gems/data/)
- `trading.json` — positions, trade history, PnL summary, wallet address,
  disclaimer.
- `taxonomy_pie.json` — category/subcategory counts + descriptions.
- `learnings.json` — parsed lessons timeline.
- `strategy.md` — raw copy of the strategy doc (rendered client-side).

### New generator script
- `gem-radar/scripts/publish_trading.py` — reads `positions.yaml`,
  `wallet_holdings_rh.json`, `candidates.jsonl`, `taxonomy.yaml`,
  `trading_strategy.md`, `lessons.md`; fetches live price/liq/MC per position
  from the DexScreener pairs API; writes the JSON above plus mirrors under
  `gem-radar/state/trading/` (`positions.json`, `pnl.json`, `trades.jsonl`,
  `learnings.json`, `strategy.md`). Follows the `publish_radar.py` pattern
  (stdlib only, atomic writes, optional `--push` that commits — never force,
  never auto-push unless `--push` is explicitly passed). Re-run it any time
  desk state changes; the frontend polls the JSON directly, no rebuild needed.

### New context file
- `gem-radar/context/trading_strategy.md` — standing thesis, capital, position
  sizing, buy/sell/invalidation rules, RH-chain execution notes. Human-owned;
  desk mirrors it read-only onto the Strategy page.

## Data integrity notes

- **BOOTS** has no confirmed wallet balance in `wallet_holdings_rh.json` — the
  Trade page shows its live price/% change but explicitly labels PnL "size
  unconfirmed" rather than inventing a dollar figure.
- **DTF** does have a confirmed wallet balance (~517,559 tokens), so its PnL is
  computed as `balance × (current_price − entry_price)` — currently ≈ −$31.7
  (≈ −18–19%) against a live DexScreener quote.
- Taxonomy pie is built from whatever fraction of `candidates.jsonl` currently
  has a `category` field (20 of 48 rows at last publish) — the unclassified
  count is shown, not hidden.

## How to view locally

```
cd /Users/tmpettersen/.openclaw/publish/strlabs-website
python3 -m http.server 8080
```

Then open `http://localhost:8080/gems/trade.html` (or `/research.html`,
`/strategy.html`, `/learnings.html`, `/index.html`). Password gate is shared
with the existing radar dashboard (`gems/data/auth.json`).

## Refreshing data

```
cd /Users/tmpettersen/.openclaw/gem-radar/scripts
python3 publish_trading.py          # writes JSON, no git action
python3 publish_trading.py --push   # writes JSON + git commit (no push)
```

Existing `publish_radar.py` is unchanged and still owns `radar.json`,
`accuracy.json`, `notify_cards.json`.

## Not done / left for a human call

- No git push was performed (per instructions) — the `gems/` repo has
  uncommitted new files ready for review.
- Root `index.html` got a minimal, single-viewport-preserving addition: a
  small "Trade Desk ↗" link under the existing Gem Radar button. QRderobe and
  timereg were not touched.
- Observed evidence of a concurrent build on this same repo during this
  session: `trading_strategy.md` and `gems/index.html` were edited mid-task by
  another process, and `git log` shows this exact file set already committed
  at HEAD (auto-committed by whatever runs the `chore(gems): publish radar…`
  loop) plus a now-deleted `gems/trade/{index.html,app.js}` and a now-deleted
  `gems/data/trading/*.json` nested layout from an earlier/parallel attempt —
  neither existed on disk when this build started and neither was touched
  here. Nothing currently links to those paths; left as-is for a human/
  Conductor call rather than guessing intent.

## Addendum — verification pass (same session)

- Confirmed the two concurrent-build artifacts noted above (`gems/trade/`
  subdir, `gems/data/trading/` nested dir) were unreferenced by any page and
  removed them; the live pages only ever read the sibling-file layout
  (`gems/trade.html` + `gems/data/trading.json`, etc.) described above.
- Independently verified the KyberSwap-on-Robinhood-chain claim in
  `state/trading/kyber_rh_support.md` two ways: Kyber's own supported-networks
  docs list Robinhood, and a live call to
  `aggregator-api.kyberswap.com/robinhood/api/v1/routes` returns HTTP 400
  ("token not found" — a recognized, routed chain) rather than HTTP 404 (what
  a genuinely unsupported chain path returns). This corrects an initial build
  assumption that RH wasn't a Kyber chain — see `trading_strategy.md`'s
  RH-First Execution Notes section.
- Filed the Kyber finding and the BOOTS wallet/positions.yaml size-field gap
  (BOOTS shows `status: open` in `positions.yaml` but zero confirmed wallet
  balance, and no fill ever recorded `size_tokens`/`size_usd`) as proper
  entries in `memory/lessons.md`, then re-ran `publish_trading.py` so both
  flow through into `data/learnings.json` on the Learnings page (39 entries,
  up from 37) rather than being one-off edits that a future regeneration
  would silently drop.
- Added `gem-radar/state/trading/README.md` (documents every file in that
  directory and the update cadence) and `state/trading/wallet.json` (public
  wallet address + native ETH balance/USD snapshot, gas-floor note) — neither
  is touched by `publish_trading.py`, so they persist across re-runs.
- Verified every page serves 200 locally (`python3 -m http.server`), every
  `.js` file passes `node --check`, and every CSS class referenced across
  `trade.html`/`research.html`/`strategy.html`/`learnings.html` exists in
  `desk.css`. No browser-automation tool was reachable from this session to
  do a rendered-pixel check — static verification only; a human should still
  eyeball it once in an actual browser before treating this as fully done.

## Addendum — Pipeline page (2026-08-04, separate session)

- Added `pipeline.html` / `pipeline.js` — an interactive, password-gated diagram
  of the gem-radar multi-agent desk itself (not queue data): Macro → Scout →
  Queue → Class → Whale → Research → Conductor → Radar → Learn, plus a Discord
  rail (#standup/#delegation/#discussion/#decisions-log/#errors) and a shared
  data-store rail (focus.yaml, kill_list.yaml, dd_checklist.yaml, LEARNED.md,
  briefs/, state/, memory/whales/). Every stage, channel, store and handoff
  pill is clickable and opens a shared detail drawer (role/inputs/outputs/
  scripts/checklist/status vocab, cross-linked). A "Replay path" control
  animates a token chip through the happy path or a kill/fence path (stops at
  Class with a "KILLED" flash) using plain CSS transitions — no SVG line
  math, no external deps. Content is static reference data sourced from
  `context/ops.yaml`, `COMMS.md`, `dd_checklist.yaml`, `sm_pipeline.md`,
  `onchain_intel.md`, `focus.yaml`, `kill_list.yaml` — it does not fetch a
  live `data/*.json` file, so it never goes stale-looking but also never
  reflects a queue state change without a code edit.
- Extended `desk.css` with a `pl-*` class block (legend/controls/rails/spine/
  stage cards/edge pills/token chip/flash/drawer) instead of a separate
  `pipeline.css` file, matching how `research.html`'s explorer view extended
  this same file rather than shipping its own stylesheet.
- Added a `Pipeline` entry to `Desk.NAV_ITEMS` in `desk.js` so every gated
  page picks up the new nav link automatically via the existing
  `Desk.navHtml(activeId)` call — no per-page nav markup to touch.
- Bumped the shared `desk.js`/`desk.css` cache-bust query param to
  `v=20260804e` on every page that references them (`index.html`,
  `research.html`, `strategy.html`, `learnings.html`, `trade.html`,
  `pipeline.html`) so the new nav entry and styles aren't served stale from a
  prior visit's cache.
- Verified: `node --check` passes on `pipeline.js`/`desk.js`; every class
  referenced in `pipeline.html`/`pipeline.js` exists in `desk.css` (scripted
  cross-check, zero misses); `pipeline.html`, `pipeline.js`, `desk.css`, and
  `data/auth.json` all serve HTTP 200 from a local static server. Browser
  navigation to `localhost` was blocked by this session's tool policy
  (host-target browser control unavailable, sandbox browser not enabled), so
  there was no rendered-pixel/interaction check this session — a human
  should click through the gate, a stage card, a channel/store badge, and
  "Replay path" once in an actual browser before treating this as fully
  verified.

## Addendum — Pipeline page v2: true wireflow (2026-08-04, separate session)

Tor-Magnus asked "is it wireflow?" about the v1 vertical process-map Pipeline
page, then said "yes please" to a proper wireflow rebuild: real arrows,
swimlanes, sequence-style who-sends-what-where.

- `pipeline.js` rewritten around the same `CHANNELS`/`STORES`/`STAGES`/`EDGES`
  data model (facts unchanged, verbatim) plus a new `KILL_EDGES` array that
  only labels existing `killNote` facts — no new content invented.
- **Wireflow view** (default): three horizontal lanes inside a
  horizontally-scrollable `#wf-canvas` — Discord rails on top, the 9-stage
  agent flow left → right in the middle, shared-brain stores on the bottom —
  plus a red dashed `KILLED` sink node. A generic SVG connector engine
  (`relRect` + `boxEdgePoint` + `connectorPoints`) computes every arrow from
  live `getBoundingClientRect()` positions, so it works unmodified whether
  the lane is a horizontal row (desktop) or a vertical stack (mobile,
  `max-width:900px`) — no separate mobile layout code path. Main handoffs are
  solid orange with a clickable label pill; secondary wires are thin purple
  (→ Discord), thin blue solid/dashed (→ store write/read); kill branches
  (Scout fence, Class dead_flow, Research serial-rug/clone) are dashed red
  into the sink. Hovering a stage dims every unrelated wire and node.
- **Sequence view** (toggle): a lightweight UML-style timeline — one
  lifeline per Scout/Class/Whale/Research/Conductor/Radar/Discord, messages
  drawn top→bottom in real handoff order, reusing the same `EDGES`/channel
  data via a `SEQ_MESSAGES` array that only orders and labels it.
- **Legend view** (toggle): static reference for node types, connector
  types, interactions, and the three views.
- Replay path animation ported to the new layout (chip moves stage-to-stage
  inside `#wf-inner`, `scrollIntoView`'d as it goes) and now also lights up
  the SVG edge it's currently traversing (`.wf-path.replay-active`,
  `stroke-dashoffset` march); kill-mode replay ends at the `KILLED` sink
  instead of stopping on Class.
- Click-to-drawer behavior is unchanged (`data-open="type:id"` delegation) —
  added a `killnode` drawer type explaining what "killed" means and where it
  can fire, cross-linked to Scout/Class/Research and `kill_list.yaml`.
- `desk.css`: replaced the old `.pl-grid`/`.pl-rail`/`.pl-spine-col` vertical
  layout with `.wf-*` lane/canvas/svg/sequence/legend rules; kept every
  `.pl-node`/`.pl-badge`/`.pl-drawer`/`.pl-dsec` rule since the drawer and
  rail-node styling carried over unchanged.
- Bumped the shared `desk.css` cache-bust query param to `v=20260804f` on
  every page that references it (`index.html`, `research.html`,
  `strategy.html`, `learnings.html`, `trade.html`, `pipeline.html`).
  `desk.js` was not touched this session, so its `?v=` query was left as-is
  except on `pipeline.html`/`pipeline.js` where it was bumped alongside the
  page's own script version for consistency.
- Verified: `node --check` passes on `pipeline.js`; scripted cross-check of
  every class/id referenced in `pipeline.html`/`pipeline.js` against
  `desk.css` definitions and DOM ids (zero real misses — a few false
  positives from dynamically-templated ids were manually confirmed present).
  Caught and fixed two real bugs during self-review before shipping: (1) the
  SVG-clear helper only removed `<path>`/`<g>` children, which would have
  let sequence-view `<line>` lifelines pile up on every redraw/resize — now
  clears all non-`<defs>` children; (2) the sequence lifelines were drawn
  with a CSS class (`wf-path secondary`) whose stylesheet rule would have
  overridden the inline `stroke="var(--line)"` attribute, coloring them
  agent-orange instead of neutral grey — now a dedicated `.wf-seq-lifeline`
  class. No headless browser or display was available in this sandbox
  (`node`/`npx puppeteer` absent, no `chromium`/`google-chrome` binary), so
  there was no rendered-pixel/interaction smoke test this session — same as
  the v1 addendum above, a human should click through Wireflow hover/click,
  Sequence, Legend, and both Replay modes once in an actual browser before
  treating this as fully verified.
