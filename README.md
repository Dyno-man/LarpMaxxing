# LARPmaxxing

A deliberately unserious desktop-vibe audit. Upload a screenshot of your coding setup, let a vision model identify the visible ceremony, and receive a shareable LARPer score plus a spot on the leaderboard.

The app is a small Node service with a no-build frontend. It uses OpenRouter for live image analysis and a JSON file for leaderboard persistence, which makes it easy to run on a single VPS.

## What is included

- Drag-and-drop PNG, JPEG, and WebP uploads up to 6 MB
- A structured 100-point LARPer metric with six categories
- Vision scoring through `openrouter/free` by default
- Explicitly labeled deterministic demo mode when no API key is present
- Demo scores stay off the public leaderboard
- Public leaderboard with optional X profile links
- Native share and X intent actions
- No screenshot persistence—the image exists in memory for the request only
- Rate limiting, security headers, input validation, and a plain-English privacy note
- Docker Compose and Caddy examples for VPS deployment

## Run locally

Requires Node 20 or newer.

```bash
npm install
cp .env.example .env
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Without an API key, the UI runs in clearly labeled demo-simulator mode.

For real visual scoring, create an OpenRouter key and add it to `.env`:

```dotenv
OPENROUTER_API_KEY=sk-or-v1-your-key
OPENROUTER_MODEL=openrouter/free
APP_URL=http://localhost:3000
```

`openrouter/free` is intentional: OpenRouter filters the free pool for the capabilities in the request, including image input and structured output. Free availability changes over time and is intended for demos or low traffic. At the time this MVP was built, free accounts were limited to 50 free-model requests per day; purchasing at least $10 of credits raised that free-model limit to 1,000 per day. Check OpenRouter's current limits before launch.

## The LARPer metric

| Count | Category | Max | What scores points |
| --- | --- | ---: | --- |
| 01 | Tool density | 25 | Editors, terminals, AI panes, and dashboards competing for oxygen |
| 02 | Agentic excess | 20 | Multiple copilots, MCPs, agents, and orchestration layers |
| 03 | Terminal theater | 15 | Split panes, logs, custom prompts, and tmux grids |
| 04 | Visual overkill | 15 | Cinematic themes, widgets, transparency, wallpapers, and RGB mood |
| 05 | Hardware posturing | 10 | Ultrawides, extra displays, niche peripherals, and conspicuous compute |
| 06 | Ritual complexity | 15 | Distance between having an idea and changing a line of code |

The server recalculates the total from clamped component scores instead of trusting a model-provided total. The prompt forbids guessing sensitive personal traits and tells the model not to repeat visible secrets or private text.

## VPS deployment

1. Point the chosen dyno-domain DNS record at the VPS.
2. Clone this repository on the VPS.
3. Copy `.env.example` to `.env` and set `OPENROUTER_API_KEY`, `APP_URL`, and any non-default options.
4. Start the app:

   ```bash
   docker compose up -d --build
   ```

5. Add the site block from `deploy/Caddyfile.example` to the VPS Caddyfile, replacing the placeholder hostname, then reload Caddy.
6. Verify `https://your-host/api/health` returns `{"ok":true,"mode":"live"}`.

The Compose service only binds Node to `127.0.0.1:3000`; Caddy is expected to terminate HTTPS. Leaderboard data lives in the `larpmaxxing_data` Docker volume.

If the VPS already uses Nginx, proxy the chosen hostname to `http://127.0.0.1:3000` and preserve `X-Forwarded-For`/`X-Forwarded-Proto`.

## Configuration

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `3000` | Node listen port |
| `OPENROUTER_API_KEY` | empty | Enables real visual analysis |
| `OPENROUTER_MODEL` | `openrouter/free` | OpenRouter model or router slug |
| `APP_URL` | `http://localhost:3000` | Public URL sent as the OpenRouter referrer |
| `DATA_DIR` | `./data` | Leaderboard persistence directory |
| `TRUST_PROXY` | `0` | Set to `1` behind one reverse proxy so rate limits use client IPs |

## Verification

```bash
npm test
curl http://localhost:3000/api/health
```

## Sensible next steps after the gag lands

- Replace the JSON store with Postgres before running multiple app instances.
- Add X OAuth only if verified identity becomes important; the MVP treats handles as profile links, not proof of ownership.
- Add moderation and a record-deletion flow before opening the leaderboard broadly.
- Use a paid, pinned vision model when reliability matters more than zero-cost inference.
