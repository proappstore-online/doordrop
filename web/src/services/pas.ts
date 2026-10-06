import { initPro } from '@proappstore/sdk';

export const APP_ID = 'doordrop';

// doordrop's API is its app worker (../../../worker), served same-origin at
// /.pas/worker/* by the platform host; the session cookie is the credential and
// the worker runs registered actions as the signed-in user (platform#264).
export const DATA_API_BASE = '/.pas/worker';

export const pas = initPro({
  appId: APP_ID,
  // Explicit rather than relying on the SDK default so the mode is visible to
  // audits (PAS-AUTH-001); /.pas/worker only works with the session cookie.
  authMode: 'platform-cookie',
});
