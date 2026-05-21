import { initPro } from '@proappstore/sdk';

export const APP_ID = 'doordrop';

// Custom Data Worker URL — overrides the SDK default of data-{appId}.proappstore.online.
// Source of truth: ../../.pas.json. Hardcoded here to avoid Vite needing to walk above
// the workspace root for a JSON import.
export const DATA_API_BASE = 'https://pas-data-doordrop.serge-the-dev.workers.dev';

export const pas = initPro({
  appId: APP_ID,
  dataApiBase: DATA_API_BASE,
});
