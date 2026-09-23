import { initPro } from '@proappstore/sdk';

export const APP_ID = 'doordrop';

// Custom Data Worker URL — overrides the SDK default of data-{appId}.proappstore.online.
// Source of truth: ../../.pas.json. Hardcoded here to avoid Vite needing to walk above
// the workspace root for a JSON import.
export const DATA_API_BASE = 'https://pas-data-doordrop.serge-the-dev.workers.dev';

export const pas = initPro({
  appId: APP_ID,
  dataApiBase: DATA_API_BASE,
  // Explicit on purpose (#71 / platform #20). SDK >= 1.16.46 defaults hosted
  // pages to 'platform-cookie', where every SDK call is mediated through the
  // app origin's /.pas/* routes. That mediation only reaches the CANONICAL
  // data host (data-doordrop.proappstore.online); DATA_API_BASE above is the
  // workers.dev URL, so in cookie mode api() would go out unmediated and
  // unauthenticated. Flip to 'platform-cookie' once the custom data worker is
  // bound to data-doordrop.proappstore.online and DATA_API_BASE is dropped.
  authMode: 'legacy-bearer',
});
