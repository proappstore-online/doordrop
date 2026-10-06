// doordrop's app worker (ADR-009, platform#264). Built to dist/app.js and
// deployed by the platform; browser routes arrive as /.pas/worker/* on
// doordrop.proappstore.online with the signed-in user's caller grant, and every
// data access is a registered action from ../../mcp.json run as that user.
import { defineAppWorker } from '@proappstore/sdk/worker';
import { app } from './app.js';

export default defineAppWorker({
  fetch: (request, pas) => app.fetch(request, { pas }),
});
