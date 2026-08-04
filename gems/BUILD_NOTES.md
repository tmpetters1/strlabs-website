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
