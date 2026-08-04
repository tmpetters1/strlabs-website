# Gem Radar — Trading Strategy

> Owner: Tor-Magnus (human capital). **Executor: Conductor (Ant)** — authorized 2026-08-04 to control wallet and execute spot trades on Robinhood + Base.
> Specialists stay research/orchestration. Only Conductor signs txs. Never print/Discord/commit the private key.

## Mandate

- Pipeline (Scout → Class → Whale → Research → Conductor) surfaces candidates; Conductor decides and **executes** buys/sells within these rails.
- Log every fill to `state/trading/trades.jsonl` + update `memory/positions.yaml` / `state/trading/positions.json`. Reconcile vs live wallet scans.
- Active trade chains: **Robinhood (primary)** + **Base (primary peer)**. BSC secondary/watch. Solana weight 0 (disabled 2026-08-04, noise).
- Wallet (public): `0x80630a7ed74f6feD614097Db8Cf2A945f4afa9E0`. Key only in `~/.openclaw/.env` (`PRIVATE_KEY`), in-process for signing — never exfiltrate.
- Pre-trade gate still required: dd_checklist + score/liq/kill-list. No blind apes. Hard-confirm path in code (route, amount in, min out, gas) before broadcast.

## Capital

- Working capital: **~$220** on RH today, plus optional Base sleeve Tor-Magnus may top up.
  - Native RH ETH: ~0.0465 ETH — **gas + optional WETH buy inventory**. Floor **≥0.015 ETH** on RH always (sells must never be gas-blocked).
  - DTF: ~517,559 tokens (~$137) — live RH bag; manage under invalidation rules.
  - **Base sleeve (requested):** yes — keep dry powder on Base. Target **$60–100** total on Base:
    - **~$50–80 USDC** (buy inventory)
    - **~$10–20 ETH** gas on Base (floor ≥0.005 ETH)
  - Do **not** bridge the whole RH stack while DTF is open; fund Base as a **separate top-up** from Tor-Magnus when possible.
- Micro-cap bankroll. Every bag can go to zero. Never size so one loss kills the next trade + gas floors on both chains.

## Position Sizing

- Max single new position: **25–30% of deployable capital** (~$45–60) at current bankroll size. Below $500 total capital, more positions ≠ more edge — it mostly adds gas drag and attention drag.
- Keep 2–4 open positions max at this capital size. More than that and per-position research/monitoring quality drops below the desk's own notify bar.
- Never add to a losing position to average down on a RH microcap unless the *thesis* strengthened (e.g., staking % or a verified reward loop expanded) — averaging down on a fading meme is the single most common way small bankrolls die.
- Scale size to desk score and liquidity depth, not conviction alone:
  - Score ≥ 78 (notify bar) + liq ≥ $30k + real product/mechanism verified → upper end of sizing band.
  - Score 65–77 (watch tier) → half-size or skip; these are desk "interesting, not yet convinced" tokens.
  - Score < 65 or any open `fail`/`blocked` check on deployer/contract/concentration → do not size in from this desk's queue; if Tor-Magnus buys anyway (self-sourced), log it but flag as off-desk-thesis in `positions.yaml`.

## When to Buy

Buy candidates must clear the desk's existing entry criteria (`context/focus.yaml`) before human review:

- Min liquidity $8,000 · Min MC $15,000 · Max MC $2,000,000
- Vol/Liq ratio ≥ 0.15 (reject dead-book echoes, vol prints with no real book)
- Website or socials required for non-profile-sourced candidates
- GoPlus contract fence clean on Base/BSC finalists; factory/implementation fence clean on all chains (`context/kill_list.yaml`)
- No `fail` on `deployer_history`, `concentration`, or `contract_risk` checks

On top of the automated gate, for this bankroll specifically:
- Prefer RH-chain candidates first — it's the primary chain, has the desk's deepest research coverage, and avoids a bridge step.
- Require a **verified mechanism**, not just narrative: for `rwa-finance/stock-reward-mining` that means a confirmed on-chain buy+claim path for real tokenized stocks (see `LEARNED.md: srm-requires-buy-claim`), not ticker cosplay.
- Do not buy into a token still showing `needs_checks` in the pipeline — wait for Whale + Research to close out concentration and smart-money checks first.

## When to Sell / Stops / Invalidations

No stop-loss orders exist on these DEXs (no limit-order infra assumed) — all exits are manual, so **invalidation triggers must be checked, not just price**:

- **Hard invalidation (sell immediately, regardless of price):** kill-list match found post-entry, deployer/contract risk check flips to `fail`, LP pulled or drops >50% from entry, a labeled rug/scam wallet appears in top holders, or the project's core mechanism (e.g. staking contract, buy+claim router) stops functioning on-chain.
- **Soft invalidation (re-review, likely trim/exit):** thesis-driving metric stalls (e.g. staking % plateaus, stock distributions stop, social goes from "organic" to "suspect/thin" per `social_x_pass` checks), or the token's desk score would now fall below 65 if rescored.
- **Price-based discipline (no hard number, use judgment against thesis):** a position down >50% from entry with no thesis change is functionally dead capital at this bankroll size — either it's a re-conviction buy-the-dip (rare, needs a real reason) or it's a cut. A position up 2–3x+ with the original thesis intact is a candidate for a partial trim (sell enough to recover initial cost basis, let the rest ride) rather than an all-or-nothing exit.
- Re-review every open position whenever `outcome_check.py` / accuracy tracking marks its score band's realized win rate down, or whenever a kill-list pattern is later found to retroactively match the contract/deployer.

## Continuous Research on Holdings

Every open position stays in the active research loop, not just new candidates:

- Re-run `social_x_pass` and holder/concentration checks periodically (desk cadence, not fixed clock) — a clean entry can decay (dev wallet starts distributing, social flips from organic to bot-driven).
- Watch the same `watch_triggers` recorded at notify time (e.g. DTF: `labeled_sm`, `prize_contract_verified`, `stock_distributions_continue`, `holders_gt_300`) — these are the specific facts that would upgrade or downgrade conviction.
- Any lesson added to `memory/lessons.md` or `context/LEARNED.md` that touches an open position's category/mechanism gets applied retroactively to that position, not just to future candidates.

## Execution Notes (RH + Base)

- Robinhood chain (id 4663) is the primary venue. Pairs observed so far are Uniswap-family V2/V3/V4 pools, quoted in WETH or USDG.
- **Correction (verified 2026-08-04, live-probed — do not use the older assumption that RH isn't a Kyber chain):** KyberSwap Aggregator **does** list Robinhood chain (id 4663, path `robinhood`) as a supported network — status **Provisional** (newly added, "may be discontinued following evaluation" per Kyber's own docs). Confirmed two ways: (1) `docs.kyberswap.com/getting-started/supported-exchanges-and-networks` explicitly lists Robinhood; (2) a live call to `https://aggregator-api.kyberswap.com/robinhood/api/v1/routes` returns HTTP 400 "token not found" (same behavior as a known-good chain path with a dummy token), while a genuinely unsupported chain path returns HTTP 404. Coverage on RH: Aggregator ✅, Limit Order ✅, Zap ❌, Cross-chain Swap ✅. Full writeup: `state/trading/kyber_rh_support.md`.
- **Execution path, in order:** (1) Try KyberSwap Aggregator on the `robinhood` chain path first — it routes across RH DEXs and gives best-execution pricing instead of hitting one pool directly. (2) If a route lookup fails (thin liquidity, brand-new token, provisional-network hiccup), fall back to Uniswap directly on RH chain against the specific pair contract. Because Kyber-on-RH is provisional, don't treat it as infra-grade — re-check availability periodically and always have the direct-Uniswap fallback ready, don't assume long-term stability without re-verifying.
- Base and Ethereum mainnet are fully-supported (non-provisional) Kyber chains — fine to lean on Kyber there without the same caveat, e.g. if capital is ever bridged out of RH chain.
- Gas floor: keep ≥0.01 native ETH on RH chain at all times (see Capital section) so a sell is never blocked by an empty gas tank.
- Any actual swap execution is a **hard-confirm** action: state the exact route, amount, and expected output before sending, even when explicitly authorized to execute — this is irreversible on-chain spend, not a reversible file edit.

## Learn Loop

- Every closed position (win, loss, or rug) gets a structured entry in `state/trading/learnings.json` and, if it changes desk behavior, a mirrored entry in `memory/lessons.md` / `context/LEARNED.md`.
- Track realized vs. desk score at entry — the goal is calibration: does a 78+ desk score actually outperform a 65 score in realized terms? `data/accuracy.json` on the public dashboard already tracks this at the pipeline level; `state/trading/pnl.json` tracks it at the actual-money level.
- Feed corrections both ways: if a position the desk would have scored low turns out to work (or vice versa), that's a scoring-model lesson, not just a trading lesson.

## Current Open Positions (see Trade page for live data)

- **DTF** (DeFi Traded Fund, robinhood) — `rwa-finance/stock-reward-mining`, peer to GLD/SRM class; USDG-quoted, verified AMD flowing into a confirmed staking contract. Entry price $0.0003254. Desk score 81 (notify). Wallet-confirmed balance: ~517,559 DTF.
- **BOOTS** — sold 2026-08-04 (Tor-Magnus). Removed from tracker; no PnL carried.

## Risk Framework (desk-wide, applies above sizing rules)

- Thin liquidity + concentrated team EOA holdings (>double-digit % of supply) blocks a notify even with a strong product (`product-thin-liq-no-notify`).
- Identity is always `(chain, contract)`, never symbol — clone farms reuse tickers freely; never buy off a ticker match alone.
- `context/kill_list.yaml` fences known scam implementations/deployers before any manual review time is spent — treat a fence hit as a hard no, not a discussion.
- No leverage, no perps, no bridging capital off RH chain for this bankroll unless explicitly decided with Tor-Magnus — the strategy is spot-only, RH-chain-first, small-size, research-backed.

---
_Last refreshed: 2026-08-04. Source of truth for filters is `context/focus.yaml`; source of truth for taxonomy is `context/taxonomy.yaml`; source of truth for live holdings is `state/wallet_holdings_rh.json` + `state/trading/positions.json`._
