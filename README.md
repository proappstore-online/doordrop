# DoorDrop

A two-sided flyer-delivery marketplace on **[ProAppStore](https://proappstore.online)**. Clients post campaigns targeting specific suburbs + streets; walkers browse open campaigns, get assigned, and deliver door-to-door with GPS-tracked auto-delivery (geofenced, walking-pace validated).

Ported from the original Firebase-based DoorDrop ([`DoorDrop/platform`](https://github.com/DoorDrop/platform)). See [`doordrop-port-plan.md`](../doordrop-port-plan.md) for the architectural decisions and status of every porting task.

## URLs

- **Production**: <https://proappstore-doordrop.pages.dev>
- **API**: `https://doordrop.proappstore.online/.pas/worker/v1/*` (app worker; not enabled yet — platform#264)
- **GitHub**: <https://github.com/proappstore-online/doordrop>
- _Custom domain `doordrop.proappstore.online` pending a platform fix in `fas/admin` — see port plan §17._

## What works end-to-end

- **Walker happy path** — sign in (GitHub OAuth via `@proappstore/sdk`) → role pick → `/walker` (browse open campaigns) → click campaign → details → "Start Delivery" → live GPS tracking with auto-delivery when within radius and at walking pace.
- **Client happy path** — sign in → role pick → `/app` (dashboard) → `/app/setup` (create) → `/app/campaign/:id` (manage doors, publish, approve walker interest, watch live track, complete, review).
- **API** — `/v1/*` endpoints in the app worker (`worker/`), each backed by registered actions in `mcp.json` that carry the authz derived from the original `firestore.rules` (campaign-admin, assigned-walker, owner-only, admin-only).

## Stack

| Layer | What |
|---|---|
| Hosting | Cloudflare Pages |
| Database | Cloudflare D1 (`pas-data-doordrop`) — 18 tables, reached only through `mcp.json` actions |
| API | PAS app worker (`worker/`, `defineAppWorker`), Hono + per-resource handlers, served at `/.pas/worker/*` |
| Auth | `@proappstore/sdk` platform-cookie session; the platform runs the worker's actions as the signed-in user |
| Storage | R2 via `pas.storage.uploadPublic()` for flyers/photos |
| Frontend | React 19 + Vite + Tailwind v4 + react-router-dom v6 |
| Maps | Leaflet + react-leaflet + react-leaflet-cluster (browser-native Geolocation API for GPS) |
| Tests | Vitest authz + manifest tests (`worker/test/`), Playwright (E2E), `web/tests/e2e/` |

## Develop

```bash
pnpm install
pnpm --filter @doordrop/web dev          # React app on :5173
pnpm --filter @doordrop/worker test      # worker authz + mcp.json tests
```

## Build & deploy

Push to `main`: the platform's canonical `deploy.yml` builds `web/`, registers `mcp.json` and uploads to R2 with keyless OIDC credentials. The worker builds with `pnpm --filter @doordrop/worker build`; the platform deploys it once app workers are enabled for doordrop (platform#264, #305).

## Test

```bash
pnpm --filter @doordrop/web test:e2e      # Playwright headless
pnpm --filter @doordrop/web test:e2e:ui   # Playwright interactive runner
```

## Status

14 of 17 port-plan tasks complete. See `CLAUDE.md` for the architecture overview and `doordrop-port-plan.md` for the running task list and what's deferred (chat onto `fas.rooms`, in-app notifications, admin app, 7 stubbed pages, platform follow-ups).

## License

MIT (per ProAppStore convention).
