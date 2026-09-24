import { initPro } from '@proappstore/sdk';

export const APP_ID = 'doordrop';

// Custom Data Worker, on its CANONICAL host. The platform host worker proxies
// data-<app>.proappstore.online to the pas-data-<app> worker, and in
// platform-cookie mode the SDK rewrites this origin to same-origin /.pas/data
// mediation, so api() never leaves the app origin with a bearer token.
// Source of truth: ../../.pas.json. Hardcoded here to avoid Vite needing to walk
// above the workspace root for a JSON import.
export const DATA_API_BASE = 'https://data-doordrop.proappstore.online';

export const pas = initPro({
  appId: APP_ID,
  dataApiBase: DATA_API_BASE,
  // Flip to platform-cookie once the canonical host reaches the worker — done,
  // see platform #197. Explicit rather than relying on the SDK default so the
  // mode is visible to audits (PAS-AUTH-001).
  authMode: 'platform-cookie',
});
