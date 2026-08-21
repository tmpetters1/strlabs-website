# Infrastructure

How strlabs.app is hosted and wired up. Written down so this is recoverable from any machine, not just Cloudflare's dashboard.

## Hosting

- **Site**: GitHub Pages, built from the `main` branch, root path (`/`), legacy build type.
- **Custom domain**: `strlabs.app` (set via the `CNAME` file in this repo).
- **HTTPS enforcement on GitHub Pages: OFF.** GitHub isn't forcing HTTP → HTTPS itself.

## DNS (Cloudflare, zone `strlabs.app`, "Full" setup — Cloudflare is authoritative)

18 records total. Grouped by purpose:

**Site traffic**
| Type | Name | Value | Proxy |
|---|---|---|---|
| A | `@` | 185.199.108.153 | Proxied |
| A | `@` | 185.199.109.153 | Proxied |
| A | `@` | 185.199.110.153 | Proxied |
| A | `@` | 185.199.111.153 | Proxied |
| CNAME | `www` | `tmpetters1.github.io` | Proxied |

The four A records are GitHub Pages' standard IP set.

**Mail — Google Workspace (primary mailbox)**
| Type | Name | Value | Priority |
|---|---|---|---|
| MX | `@` | aspmx.l.google.com | 1 |
| MX | `@` | alt1.aspmx.l.google.com | 5 |
| MX | `@` | alt2.aspmx.l.google.com | 5 |
| MX | `@` | alt3.aspmx.l.google.com | 10 |
| MX | `@` | alt4.aspmx.l.google.com | 10 |
| TXT | `@` | `v=spf1 include:_spf.google.com ~all` | — |
| TXT | `google._domainkey` | Google Workspace DKIM key | — |
| TXT | `_dmarc` | `v=DMARC1; p=none;` | — |
| TXT | `@` | `google-site-verification=...` | — |

DMARC policy is `p=none` — monitoring only, not enforcing. Consider tightening once you've confirmed all senders (Google, SES, Resend) pass alignment.

**Mail — transactional/outbound (Amazon SES, via `send.strlabs.app`)**
| Type | Name | Value | Priority |
|---|---|---|---|
| MX | `send.strlabs.app` | feedback-smtp.eu-west-1.amazonses.com | 10 |
| TXT | `send.strlabs.app` | `v=spf1 include:amazonses.com ~all` | — |

**Mail — transactional (Resend)**
| Type | Name | Value |
|---|---|---|
| TXT | `resend._domainkey` | DKIM key (two records present, see note) |

⚠️ **Note**: there are currently *two* `resend._domainkey` TXT records with different key values. That's likely a leftover from a key rotation or a re-setup — worth checking Resend's dashboard to confirm which key is actually live and removing the stale one.

## SSL/TLS

- **Mode**: Full (Cloudflare validates the origin's own cert — correct for GitHub Pages, which serves valid certs).
- **Always Use HTTPS**: **OFF**. Combined with HTTPS enforcement being off on the GitHub Pages side too, there's currently nothing forcing `http://strlabs.app` to redirect to `https://`. Low risk day-to-day (most traffic hits HTTPS via links/bookmarks), but worth turning on if you care about that edge case — flip the toggle at SSL/TLS → Edge Certificates → Always Use HTTPS. Cloudflare's own warning: don't also force HTTPS redirects at the origin, or you'll get a redirect loop.
- Universal SSL certificate (`*.strlabs.app`, `strlabs.app`) is active, standard shared cert, no custom/advanced cert manager in use.

## Rules, Workers, Page Rules

None configured. No Cloudflare Workers, no Redirect/Cache/Transform Rules, no legacy Page Rules (0 of 3 used). Traffic just flows DNS → GitHub Pages, unmodified.

## GitHub Actions

- `.github/workflows/timereg-keepalive.yml` — pings a Supabase project (Timeregistrering) every 3 days to prevent the free-tier 7-day inactivity pause. Uses a hardcoded Supabase **anon** key (safe to be public — anon keys are client-visible by design — but double-check RLS policies on the tables it can reach).

## `gems/` dashboard

A password-gated "Gem Radar" pipeline dashboard served at `/gems`. Data (`radar.json`, etc.) is published by an external Python pipeline (`gem-radar/scripts/publish_radar.py`, not in this repo) and committed here for GitHub Pages to serve. The gate (`gems/data/auth.json`) is a client-side SHA-256 password check only — not real access control, just a speed bump.

## Not tracked here

Domain registrar, Cloudflare account billing/plan tier, and any account-level settings (WAF, Zero Trust, etc. — none appear to be configured for this zone as of writing) live only in the Cloudflare/registrar dashboards themselves.
