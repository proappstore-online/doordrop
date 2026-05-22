# DoorDrop — agent guide

A two-sided flyer-delivery marketplace ported from Firebase to PAS (ProAppStore). If you're picking this up cold, start here, then the running task list in `../doordrop-port-plan.md`.

## Product shape

- **Clients** create *campaigns* targeting a suburb/postcode/street, set door radius + flyer policies, upload printouts, publish, approve walker interest, watch delivery happen, leave reviews.
- **Walkers** browse open campaigns, express interest, get assigned by the client, then run a GPS-tracked delivery: geofence detects when they're near a door at walking pace and auto-marks the door delivered.
- **Admins** manage users, promote roles, oversee compliance.

Each role has a separate route subtree (`/app`, `/walker`, `/admin`) gated by `PrivateRoute`.

## Architecture

```
   ┌─────────────────────┐                   ┌─────────────────────┐
   │ web/  (React app)   │  Bearer (FAS JWT) │  worker/            │
   │ - useProGate auth   │ ────────────────▶ │  - Hono + /v1/*     │
   │ - 14 repositories   │                   │  - 19 D1 tables     │
   │ - useDeliveryTrack  │                   │  - authz from        │
   │ - Leaflet maps      │                   │    firestore.rules   │
   └─────────────────────┘                   └──────────┬──────────┘
            ▲                                            │
            │ initPro({...}) via @proappstore/sdk        │ D1 binding
            │ - pas.auth (GitHub OAuth via FAS)          │
            │ - pas.storage (R2 uploads/uploadPublic)    ▼
            │ - pas.usage (auto-heartbeat)         ┌─────────────────┐
            │                                     │ pas-data-doordrop│
            ▼                                     │   D1 database    │
   ┌──────────────────────────┐                  └─────────────────┘
   │ Cloudflare Pages         │
   │ proappstore-doordrop     │
   │ .pages.dev               │
   └──────────────────────────┘
```

### Why we override the platform Data Worker

`pas create` deploys a generic SQL gateway (`/query`, `/execute`, `/migrate`) as `pas-data-<appId>`. That's wrong-by-default for any app with non-trivial authz, because all rules would have to be client-side. DoorDrop's authz (campaign-admin vs assigned-walker × per-field allow-lists) needs server enforcement, so we **redeploy our own Worker with the same name** — same URL contract, our handlers. The `worker/` package has the source.

**Gotcha**: running `pas publish` redeploys the platform's generic Worker over ours. After any `pas publish`, re-run `cd worker && pnpm run deploy`. Long-term fix in `pas/platform/` is in the port-plan §17.

### Wire format ↔ domain models

- D1 columns are snake_case. JSON columns (`admin_ids`, `client_profile`, `walker_profile`, `history`, etc.) are TEXT — worker handlers parse them before responding.
- Domain models in `web/src/models/` are camelCase, dates as `Date`.
- `web/src/lib/transform.ts` does the boundary: `fromWire` on read (snake→camel + epoch-ms→Date for known fields), `toWire` on write (camel→snake + Date→ms).
- Repositories wrap fetches with these. Pages never see snake_case.

### Real-time, currently via polling

The original used Firestore `onSnapshot` for live updates. The port uses **polling** as a stopgap:
- doors list: 5s polling in `useCampaignData`, `WalkerDeliveryPage`, `WalkerCampaignDetailPage`
- track sessions (clients watching the walker live): 10s polling in `ClientCampaignDetailPage`
- chat messages: 3s polling in `chatRepository.subscribeToMessages`
- notifications: 5s polling in `notificationRepository.subscribe`
- active-campaign tracking indicator: 30s polling in `useActiveCampaignTracking`

Replacing with `fas.rooms` (WebSocket Durable Objects) is task #10/#11 in the port plan. The Worker would broadcast on writes; the polling stubs would join the room instead. Search for `TODO(task #10)` / `TODO(task #11)` comments in the codebase to find every site.

### Auth & identity

- Sign-in: `useProGate` → `pas.auth.signIn()` → redirect to FAS hosted OAuth start → GitHub → callback hash → SDK persists to localStorage.
- The Worker's `requireAuth` validates Bearer tokens via `api.freeappstore.online/v1/auth/me` (60s in-memory cache).
- `currentUser` from `useAuthContext()` is the FAS `User` shape: `{ id, login, avatarUrl, dateOfBirth }`. **Not** `{ uid, email, displayName }` — Firebase Auth's shape is gone.
- The full `userData` (email, name, role, profile, etc.) lives in our D1 `users` table, fetched via `/v1/me`. Use `useUserData()` for it.
- First-time sign-in returns `{ needsRoleSelection: true }` from `/v1/me`. The router redirects to `/select-role` which lets the user pick `client` or `walker`. `admin` is granted only via `/v1/admin/users/:id/role` (admin-only).

### Storage

`pas.storage.uploadPublic(path, file, contentType)` returns a long-lived public URL safe for `<img src>`. Used in `utils/storageUpload.ts` for flyer designs, property photos, etc. R2 binding is platform-managed; we don't configure it ourselves.

## File layout

```
web/                                React app (this is what runs in the browser)
├── src/
│   ├── App.tsx                      route tree
│   ├── main.tsx                     awaits pas.auth.init() before render
│   ├── services/pas.ts              singleton ProAppStore SDK instance
│   ├── lib/
│   │   ├── api.ts                   fetch wrapper with Bearer auth + ApiError
│   │   └── transform.ts             fromWire / toWire (snake↔camel, ms↔Date)
│   ├── repositories/                14 ported repos, same surface as original
│   ├── hooks/                       useAuthContext, useUserData, useDeliveryTracking, ...
│   ├── components/                  35 components (Leaflet maps, modals, panels)
│   ├── pages/                       page tree (auth, Campaign, client, walker, admin, ...)
│   ├── models/                      13 domain types (canonical camelCase)
│   └── routes/PrivateRoute.tsx      role-gated route guard
├── tests/e2e/                       Playwright specs
├── playwright.config.ts
└── package.json

worker/                              Custom Data Worker (overrides pas-data-doordrop)
├── src/
│   ├── index.ts                     Hono app, mounts /v1/* routers + admin-gated SQL ops
│   ├── auth.ts                      requireAuth / requireAdmin / requireCampaignAdmin / requireAssignedWalker
│   ├── env.ts                       Env interface (DB, APP_ID, FAS_API_BASE)
│   ├── lib.ts                       toJson, fromJson, newId, propertyId helpers
│   └── routes/                      13 resource routers
└── wrangler.toml                    binding to pas-data-doordrop D1

migrations/
└── 0001_init.sql                    19-table schema

.pas.json                            { appId, dataApiBase, d1DatabaseId }
```

## How to add a feature

1. **Storage**: if a new column or table — add to a new `migrations/000N_*.sql`, apply via the Worker's `POST /migrate` (admin-gated).
2. **Worker endpoint**: add a route in `worker/src/routes/<resource>.ts`. Always gate with one of `requireAuth | requireAdmin | requireCampaignAdmin | requireAssignedWalker`. For PATCH, use an explicit allow-list of fields to mirror the `firestore.rules` pattern. Mount it in `worker/src/index.ts` via `app.route('/v1', <router>)`.
3. **Repository**: add or extend in `web/src/repositories/`. Run requests through `lib/api.ts`'s `apiGet/apiPost/apiPatch/apiPut/apiDelete`. Use `toWire(data)` on writes and `fromWire(response)` on reads — never expose snake_case to the page layer.
4. **Hook / page**: import the repo, treat the returned shape as the canonical model. If you need real-time, follow the existing polling pattern with a `TODO(task #10)` comment so it's findable when we migrate to `fas.rooms`.
5. **Route**: add to `web/src/App.tsx` under the correct `PrivateRoute allowedRoles={[...]}`. Admins implicitly pass every role check; that's intentional.

## How to deploy

1. Build: `pnpm --filter @doordrop/web build`
2. Deploy app: `cd web && wrangler pages deploy dist --project-name=proappstore-doordrop --branch=main`
3. If Worker changed: `cd worker && pnpm run deploy` (deploys to `pas-data-doordrop` Worker)
4. Commit + push to `main` on `proappstore-online/doordrop`

No CI yet — direct deploy from local. Eventually move to GitHub Actions per the workspace-wide CI memory.

## Gotchas

- **Don't run `pas publish` casually**: it redeploys the platform's generic Worker over our custom one and has a known server-side crash on the hosting-route step. Re-run `worker:deploy` after.
- **`currentUser.uid/.email/.displayName` don't exist** — FAS User is `{ id, login, avatarUrl, dateOfBirth }`. There's a sed history of fixing these; if you see one, it's the bug.
- **Bundle size is 851 KiB precache** (single chunk). Code-splitting the Campaign components would cut the initial download substantially. Hasn't mattered yet.
- **The 7 stubbed pages render "Coming soon"** — `DoorDetailPage`, `MessagesPage`, `ShareHirePage`, `UserProfileEditPage`, `WalkerDashboardPage`, `WalkerDeliverRedirect`, `WalkerHistoryPage`. Their imports + repository surfaces are wired so each one is a self-contained porting unit.
- **Stubs that no-op or throw**: `DeliveryRunRepository.*` (worker endpoints not built yet — surface the call sites if you need them), `WalkerInterestRepository.castVote/hasUserVoted/getVoteCount` (votes feature dropped, methods are no-ops so the UI doesn't crash).
- **Date round-trip**: dates go out as `Date.getTime()` (epoch ms int) and come back as Date via `fromWire`. Don't bypass `toWire`/`fromWire` or you'll round-trip strings.
- **Permissions-Policy in `web/public/_headers`** allows `geolocation=(self)` and `camera=(self)` — required for the GPS hook and photo uploads. Don't tighten without checking that flow first.

## Reference

- Port plan + task list: [`../doordrop-port-plan.md`](../doordrop-port-plan.md)
- PAS platform conventions: <https://proappstore.online/skills.md>
- Original DoorDrop (Firebase): <https://github.com/DoorDrop/platform> (private)
- Cloned locally at `~/dev/doordrop` for reference reads
