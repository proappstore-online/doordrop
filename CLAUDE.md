# DoorDrop — agent guide

A two-sided flyer-delivery marketplace ported from Firebase to PAS (ProAppStore). If you're picking this up cold, start here. For the running task list and status of the port, see the [closed GitHub issues](https://github.com/proappstore-online/doordrop/issues?q=is%3Aissue+is%3Aclosed) tracking each phase (e.g., #46 campaign setup wizard, #48 lifecycle state machine, #49 command center, #52 walker mobile UX).

## Product shape

- **Clients** create *campaigns* targeting a suburb/postcode/street, set door radius + flyer policies, upload printouts, publish, approve walker interest, watch delivery happen, leave reviews.
- **Walkers** browse open campaigns, express interest, get assigned by the client, then run a GPS-tracked delivery: geofence detects when they're near a door at walking pace and auto-marks the door delivered.
- **Admins** manage users, promote roles, oversee compliance.

Each role has a separate route subtree (`/app`, `/walker`, `/admin`) gated by `PrivateRoute`.

## Architecture

```
   ┌─────────────────────┐  same-origin       ┌──────────────────────────┐
   │ web/  (React app)   │  /.pas/worker/v1/* │  worker/  (app worker)   │
   │ - useProAuth        │ ─────────────────▶ │  - Hono + /v1/* routes   │
   │ - 14 repositories   │  session cookie    │  - cross-row checks      │
   │ - useDeliveryTrack  │                    │  - no DB binding         │
   │ - Leaflet maps      │                    └────────────┬─────────────┘
   └─────────────────────┘                                 │ pas.actions.call(...)
            ▲                                              │ run AS the signed-in user
            │ initPro({...}) via @proappstore/sdk          ▼
            │ - pas.auth (platform-cookie)        ┌──────────────────────────┐
            │ - pas.storage (R2 uploads)          │ mcp.json actions         │
            │                                     │ (SQL + :__user_id authz) │
   ┌──────────────────────────┐                   │  → pas-data-doordrop D1  │
   │ R2 (pas-apps/apps/doordrop)│                 └──────────────────────────┘
   └──────────────────────────┘
```

### App worker, not a Data Worker override (platform#264)

DoorDrop's authz (campaign-admin vs assigned-walker × per-field allow-lists) needs server enforcement. It used to get it by redeploying its own Worker under the platform's `pas-data-doordrop` script name; every fleet redeploy and session-key drift repair put the generic worker back, and the API 404'd from 2026-07-22. Now:

- `worker/` is a platform **app worker** (`defineAppWorker({ fetch })`, ADR-009). The browser calls `/.pas/worker/v1/*` on the app origin; the platform authenticates the session cookie, mints a caller grant and invokes the worker. The worker has **no** D1 binding, no signing key and no Cloudflare credential.
- Every read and write is a **registered action** in `mcp.json`, run as the caller (`:__user_id`). Rules SQL can express — campaign admin, assigned walker, app admin (`users.role = 'admin'`), owner-only rows, the walker's door-field allow-list, `delivered_by` = self, `access_user_ids` never shrinks, `payment_mode` set-once — are in the action SQL, because **a signed-in user can call any of these actions directly**, bypassing the worker. The worker keeps the request validation and the 400/403/404/409 answers.
- Actions marked `auth.caller_unscoped` are the reads the old worker left open to any signed-in user (users, campaigns, doors, printouts, interests, reviews, history, config). Kept as-is by the faithful port; tightening them is separate work.
- `pas-data-doordrop` is the platform's generic data worker **by design** now; fleet redeploys don't touch the app worker.
- The canonical deploy workflow builds `worker/` and uploads it to the platform keyless (OIDC). The deploy fails until a platform admin enables app workers for doordrop (`PUT /v1/admin/apps/doordrop/worker-enabled`); once enabled, `GET /.pas/worker/v1/me` answers 401/200 from the app worker.

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

- Sign-in: `useProAuth` → `pas.auth.signIn()` → redirect to FAS hosted OAuth start → GitHub → callback hash → SDK persists to localStorage.
- The worker never sees a token: the platform verifies the session cookie on `/.pas/worker/*` and the worker's actions run as that user. `worker/src/auth.ts` only resolves the caller's standing (`whoami`, `campaign_access`).
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
│   │   ├── api.ts                   fetch wrapper (pas.auth.authenticatedFetch) + ApiError
│   │   └── transform.ts             fromWire / toWire (snake↔camel, ms↔Date)
│   ├── repositories/                ported repos (incl. admin, booking, deliveryRun), same surface as original
│   ├── hooks/                       useAuthContext, useUserData, useDeliveryTracking, ...
│   ├── services/pushNotifications   web push enable/disable (service worker: public/push-sw.js)
│   ├── components/                  Leaflet maps, modals, panels, layout (TopBar, NotificationBell)
│   ├── pages/                       page tree (auth, Campaign, client, walker, admin, ...)
│   │   └── admin/                   /admin/* (layout, dashboard, users, campaigns, addresses)
│   ├── models/                      13 domain types (canonical camelCase)
│   └── routes/PrivateRoute.tsx      role-gated route guard
├── tests/e2e/                       Playwright specs
├── playwright.config.ts
└── package.json

worker/                              App worker (ADR-009), built to dist/app.js
├── src/
│   ├── index.ts                     defineAppWorker({ fetch }) → the Hono app
│   ├── app.ts                       mounts /v1/* routers + /v1/me
│   ├── pas.ts                       rows / first / run / batch over pas.actions
│   ├── auth.ts                      whoami / requireAdmin / requireCampaignAdmin / requireAssignedWalker / requireOwner
│   ├── lib.ts                       toJson, fromJson, newId, propertyId, pickDefined
│   └── routes/                      resource routers (incl. admin, bookings, deliveryRuns)
└── test/                            vitest: mcp.json lint + authz, run against SQLite built from migrations/

mcp.json                             the registered actions (registered on every deploy)
migrations/
├── 0001_init.sql                    18-table schema
└── 0002_bookings.sql                bookings table

.pas.json                            { appId, dataApiBase, d1DatabaseId }
```

## How to add a feature

1. **Storage**: if a new column or table — add a new `migrations/000N_*.sql`. The worker cannot run DDL: the deploy applies `migrations.json` (ledgered in `_migrations`) to D1 before anything else ships. Add the same SQL as a new `{ "name": "000N_*", "sql": "..." }` entry in `migrations.json` (the worker tests build their SQLite from it). Migrations must be additive and idempotent (`IF NOT EXISTS`, `INSERT ... ON CONFLICT DO NOTHING`), and the platform lint rejects any statement containing DROP/DELETE/UPDATE/RENAME/REPLACE/PRAGMA, including `ON DELETE CASCADE`.
2. **Action**: add it to `mcp.json`. Scope every statement with `:__user_id` (or declare `auth.caller_unscoped` with a reason) and put the authz in the SQL — users can call actions directly. Partial updates take a `patch` JSON param (`CASE WHEN json_type(:patch, '$.col') IS NULL THEN col ELSE json_extract(:patch, '$.col') END`).
3. **Worker endpoint**: add a route in `worker/src/routes/<resource>.ts` that validates the request, resolves 404 vs 403 with `auth.ts`, and calls the action. Mount it in `worker/src/app.ts`. Add the access cases to `worker/test/authz.test.ts`, both through the worker and straight at the action.
4. **Repository**: add or extend in `web/src/repositories/`. Run requests through `lib/api.ts`'s `apiGet/apiPost/apiPatch/apiPut/apiDelete`. Use `toWire(data)` on writes and `fromWire(response)` on reads — never expose snake_case to the page layer.
5. **Hook / page**: import the repo, treat the returned shape as the canonical model. If you need real-time, follow the existing polling pattern with a `TODO(task #10)` comment so it's findable when we migrate to `fas.rooms`.
6. **Route**: add to `web/src/App.tsx` under the correct `PrivateRoute allowedRoles={[...]}`. Admins implicitly pass every role check; that's intentional.

## How to deploy

Push to `main`. `.github/workflows/deploy.yml` is the platform's canonical workflow (keep it byte-identical to `packages/admin/src/__fixtures__/canonical-deploy.yml` in `proappstore-online/platform`): it builds `web/`, registers `mcp.json`, and uploads to R2 with keyless GitHub OIDC credentials. No repo secrets, no wrangler.

The workflow also applies `migrations.json` (before the frontend and `mcp.json`) and builds and deploys the app worker (`worker/dist/app.js`). App workers are enabled per app by a platform admin; until then the worker step fails the deploy.

## Gotchas

- **`pas-data-doordrop` is the platform's generic data worker** — that is correct. Don't deploy anything under that name.
- **`currentUser.uid/.email/.displayName` don't exist** — FAS User is `{ id, login, avatarUrl, dateOfBirth }`. There's a sed history of fixing these; if you see one, it's the bug.
- **Bundle size is ~1048 KiB precache** (single chunk). Code-splitting the Campaign components would cut the initial download substantially. Hasn't mattered yet.
- **Client dashboard and core pages are now complete.** The client dashboard was a placeholder until [#18 (client dashboard)](https://github.com/proappstore-online/doordrop/issues/18). All admin pages (`/admin/*`, linked from the top bar for admins) are now ported and functional.
- **Remaining stub**: `WalkerInterestRepository.castVote/hasUserVoted/getVoteCount` (votes feature dropped, methods are no-ops so the UI doesn't crash). See [#20 (votes)](https://github.com/proappstore-online/doordrop/issues/20).
- **Admin lists are capped at 500 rows** (`LIMIT 500` in the `mcp.json` users/campaigns actions, no pagination). `ListCapNotice` in `web/src/pages/admin/adminUi.tsx` warns when the cap is hit.
- **Terms / privacy** are static pages, `web/public/terms.html` and `privacy.html` (ported from the original website; styles/assets in `web/public/site/`). Link to them as `/terms.html` and `/privacy.html`. `web/public/privacy.md` is the platform-template copy, not linked.
- **Date round-trip**: dates go out as `Date.getTime()` (epoch ms int) and come back as Date via `fromWire`. Don't bypass `toWire`/`fromWire` or you'll round-trip strings.
- **Permissions-Policy in `web/public/_headers`** allows `geolocation=(self)` and `camera=(self)` — required for the GPS hook and photo uploads. Don't tighten without checking that flow first.

## Reference

- **Port status & task tracking**: See closed GitHub issues (#46 campaign setup wizard, #48 lifecycle state machine, #49 command center, #52 walker mobile UX, #18 client dashboard, #20 votes, #21 chat, #22 notifications).
- **Platform architecture**: [ADR-009 app workers](https://github.com/proappstore-online/platform/discussions) — the app worker model used by DoorDrop (see deploy.yml for how it's built and deployed).
- **PAS platform conventions**: <https://proappstore.online/skills.md>
- **Original DoorDrop (Firebase)**: <https://github.com/DoorDrop/platform> (private reference only)
