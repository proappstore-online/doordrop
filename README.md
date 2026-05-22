# DoorDrop

A two-sided flyer-delivery marketplace on **[ProAppStore](https://proappstore.online)**. Clients post campaigns targeting specific suburbs + streets; walkers browse open campaigns, get assigned, and deliver door-to-door with GPS-tracked auto-delivery (geofenced, walking-pace validated).

Ported from the original Firebase-based DoorDrop ([`DoorDrop/platform`](https://github.com/DoorDrop/platform)). See [`doordrop-port-plan.md`](../doordrop-port-plan.md) for the architectural decisions and status of every porting task.

## URLs

- **Production**: <https://proappstore-doordrop.pages.dev>
- **Data Worker (API)**: <https://pas-data-doordrop.serge-the-dev.workers.dev>
- **GitHub**: <https://github.com/proappstore-online/doordrop>
- _Custom domain `doordrop.proappstore.online` pending a platform fix in `fas/admin` — see port plan §17._

## What works end-to-end

- **Walker happy path** — sign in (GitHub OAuth via `@proappstore/sdk`) → role pick → `/walker` (browse open campaigns) → click campaign → details → "Start Delivery" → live GPS tracking with auto-delivery when within radius and at walking pace.
- **Client happy path** — sign in → role pick → `/app` (dashboard) → `/app/setup` (create) → `/app/campaign/:id` (manage doors, publish, approve walker interest, watch live track, complete, review).
- **API** — 38 hand-rolled `/v1/*` endpoints in the custom Worker with authz allow-lists derived from the original `firestore.rules` (campaign-admin, assigned-walker, owner-only, admin-only).

## Stack

| Layer | What |
|---|---|
| Hosting | Cloudflare Pages |
| Database | Cloudflare D1 (`pas-data-doordrop`) — 19 tables |
| API | Custom Cloudflare Worker (`pas-data-doordrop.serge-the-dev.workers.dev`), Hono + per-resource handlers |
| Auth | `@proappstore/sdk` → FAS GitHub OAuth, session-token Bearer auth into the Worker |
| Storage | R2 via `pas.storage.uploadPublic()` for flyers/photos |
| Frontend | React 19 + Vite + Tailwind v4 + react-router-dom v6 |
| Maps | Leaflet + react-leaflet + react-leaflet-cluster (browser-native Geolocation API for GPS) |
| Tests | Playwright (E2E), `tests/e2e/` |

## Develop

```bash
pnpm install
pnpm --filter @doordrop/web dev          # React app on :5173
pnpm --filter @doordrop/worker dev       # Worker on :8787 (optional; prod Worker also reachable)
```

## Build & deploy

```bash
pnpm --filter @doordrop/web build
cd web && wrangler pages deploy dist --project-name=proappstore-doordrop --branch=main
```

The Worker is independently deployed with `pnpm --filter @doordrop/worker run deploy` — note that running `pas publish` re-deploys the platform's generic Data Worker on top of ours, so re-run the worker deploy after any `pas publish`. (Tracked in [`doordrop-port-plan.md`](../doordrop-port-plan.md) §17 follow-ups.)

## Test

```bash
pnpm --filter @doordrop/web test:e2e      # Playwright headless
pnpm --filter @doordrop/web test:e2e:ui   # Playwright interactive runner
```

## Status

14 of 17 port-plan tasks complete. See `CLAUDE.md` for the architecture overview and `doordrop-port-plan.md` for the running task list and what's deferred (chat onto `fas.rooms`, in-app notifications, admin app, 7 stubbed pages, platform follow-ups).

## License

MIT (per ProAppStore convention).
