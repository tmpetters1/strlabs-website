# Gem Radar API

Static JSON API served from GitHub Pages.

## Endpoints

- `GET /gems/api/v1/health.json`
- `GET /gems/api/v1/radar.json` — full desk payload (candidates + notify cards)
- `GET /gems/api/v1/notify.json` — notification-worthy cards only
- `GET /gems/api/v1/index.json` — token index
- `GET /gems/api/config.json` — client config

Legacy:
- `/gems/data/radar.json`
- `/gems/data/notify_cards.json`

## Live local server (on-demand rebuild per request)

```bash
python3 /Users/tmpettersen/.openclaw/gem-radar/scripts/dashboard_api.py serve --port 8787
# then:
# curl http://127.0.0.1:8787/api/v1/radar
# curl http://127.0.0.1:8787/api/v1/token/DTF
```

## Publish

```bash
python3 /Users/tmpettersen/.openclaw/gem-radar/scripts/publish_radar.py --push
# or
python3 /Users/tmpettersen/.openclaw/gem-radar/scripts/dashboard_api.py generate --push
```

Cron `gem-radar-dashboard-publish` runs publish every 15 minutes.
