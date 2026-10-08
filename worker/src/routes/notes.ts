import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { campaignAccess, whoami } from '../auth.js';
import { rows, run, publishRoom, type AppEnv, type Ctx } from '../pas.js';
import { newId } from '../lib.js';

const router = new Hono<AppEnv>();

// Campaign admin OR the assigned walker.
async function requireNotesAccess(c: Ctx, campaignId: string): Promise<void> {
  const access = await campaignAccess(c, campaignId);
  if (!access || !(access.is_admin || access.is_walker)) {
    throw new HTTPException(403, { message: 'campaign-admin or assigned-walker only' });
  }
}

async function requireSelf(c: Ctx): Promise<void> {
  if ((await whoami(c)).id !== c.req.param('userId')) throw new HTTPException(403, { message: 'self only' });
}

router.get('/campaigns/:campaignId/notes', async (c) => {
  const campaignId = c.req.param('campaignId');
  await requireNotesAccess(c, campaignId);
  const since = c.req.query('since');
  return c.json(await rows(c, 'list_campaign_notes', { campaign_id: campaignId, since: since ? Number(since) : undefined }));
});

router.post('/campaigns/:campaignId/notes', async (c) => {
  const campaignId = c.req.param('campaignId');
  await requireNotesAccess(c, campaignId);
  const body = await c.req.json<{ text?: string; userName?: string }>();
  if (typeof body.text !== 'string' || body.text.length === 0 || body.text.length > 5000) {
    throw new HTTPException(400, { message: 'text required (max 5000)' });
  }
  if (typeof body.userName !== 'string' || body.userName.length === 0 || body.userName.length > 200) {
    throw new HTTPException(400, { message: 'userName required (max 200)' });
  }
  const id = newId();
  const ts = Date.now();
  await run(c, 'create_campaign_note', { id, campaign_id: campaignId, user_name: body.userName, text: body.text, created_at: ts });
  void publishRoom(c, `campaign:${campaignId}:notes`, { action: 'refresh' });
  return c.json({ id, createdAt: ts }, 201);
});

router.put('/users/:userId/chat-read-state/:campaignId', async (c) => {
  await requireSelf(c);
  const userId = c.req.param('userId');
  await run(c, 'set_chat_read_state', { campaign_id: c.req.param('campaignId') });
  void publishRoom(c, `user:${userId}:read-state`, { action: 'refresh' });
  return c.json({ ok: true });
});

router.get('/users/:userId/chat-read-state', async (c) => {
  await requireSelf(c);
  const result = await rows<{ campaign_id: string; last_read_at: number }>(c, 'list_my_chat_read_state');
  const states: Record<string, { lastReadAt: number }> = {};
  for (const r of result) states[r.campaign_id] = { lastReadAt: r.last_read_at };
  return c.json(states);
});

export default router;
