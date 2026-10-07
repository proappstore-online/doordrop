import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { requireAdmin } from '../auth.js';
import { first, rows, run, type AppEnv } from '../pas.js';
import { fromJson } from '../lib.js';

const router = new Hono<AppEnv>();

const STATUSES = new Set(['draft', 'ready', 'assigned', 'complete', 'review', 'payment', 'archive']);
const JOB_STATUSES = new Set(['draft', 'posted', 'assigned', 'in_progress', 'completed']);

router.get('/admin/stats', async (c) => {
  await requireAdmin(c);
  return c.json(await first(c, 'admin_stats'));
});

router.get('/admin/doors', async (c) => {
  await requireAdmin(c);
  const result = await rows(c, 'admin_list_doors');
  return c.json(result.map((r) => ({ ...r, history: fromJson(r.history as string | null, []) })));
});

router.post('/admin/campaigns/:id/status', async (c) => {
  await requireAdmin(c);
  const { status, job_status } = await c.req.json<{ status?: string; job_status?: string }>();
  if (status === undefined && job_status === undefined) {
    throw new HTTPException(400, { message: 'status or job_status required' });
  }
  if (status !== undefined && !STATUSES.has(status)) throw new HTTPException(400, { message: 'invalid status' });
  if (job_status !== undefined && !JOB_STATUSES.has(job_status)) throw new HTTPException(400, { message: 'invalid job_status' });
  const changed = await run(c, 'admin_set_campaign_status', { id: c.req.param('id'), status, job_status });
  if (changed === 0) throw new HTTPException(404, { message: 'campaign not found' });
  return c.json({ ok: true });
});

export default router;
