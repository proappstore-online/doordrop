import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { requireCampaignAdmin, requireCampaignParticipant } from '../auth.js';
import { rows, run, type AppEnv, type Ctx } from '../pas.js';
import { newId, pickDefined } from '../lib.js';

const router = new Hono<AppEnv>();

async function getCampaignStatus(c: Ctx, campaignId: string): Promise<string | null> {
  const campaigns = await rows(c, 'get_campaign', { id: campaignId });
  if (campaigns.length === 0) return null;
  return campaigns[0]!.status;
}

router.get('/campaigns/:campaignId/printouts', async (c) => {
  const campaignId = c.req.param('campaignId');
  await requireCampaignAdmin(c, campaignId);
  return c.json(await rows(c, 'list_printouts', { campaign_id: campaignId }));
});

router.post('/campaigns/:campaignId/printouts', async (c) => {
  const campaignId = c.req.param('campaignId');
  await requireCampaignAdmin(c, campaignId);
  const body = await c.req.json<Record<string, unknown>>();
  if (typeof body.name !== 'string' || body.name.length === 0 || body.name.length > 200) {
    throw new HTTPException(400, { message: 'name required (max 200)' });
  }
  const id = newId();
  await run(c, 'create_printout', {
    id,
    campaign_id: campaignId,
    version: typeof body.version === 'number' ? body.version : 1,
    name: body.name,
    description: body.description,
    file_url: body.file_url,
    flyer_id: body.flyer_id,
  });
  return c.json({ id }, 201);
});

router.patch('/campaigns/:campaignId/printouts/:printoutId', async (c) => {
  const campaignId = c.req.param('campaignId');
  await requireCampaignAdmin(c, campaignId);
  const body = await c.req.json<Record<string, unknown>>();
  const updates = pickDefined(body, ['version', 'name', 'description', 'file_url', 'flyer_id']);
  if (Object.keys(updates).length === 0) return c.json({ ok: true, changed: 0 });

  const status = await getCampaignStatus(c, campaignId);
  if (status && status !== 'draft') {
    return c.json(
      {
        error: 'Cannot modify printout: campaign delivery has started (campaign is immutable)',
        campaignStatus: status
      },
      409
    );
  }

  await run(c, 'update_printout', { id: c.req.param('printoutId'), campaign_id: campaignId, patch: JSON.stringify(updates) });
  return c.json({ ok: true });
});

router.delete('/campaigns/:campaignId/printouts/:printoutId', async (c) => {
  const campaignId = c.req.param('campaignId');
  await requireCampaignAdmin(c, campaignId);
  await run(c, 'delete_printout', { id: c.req.param('printoutId'), campaign_id: campaignId });
  return c.json({ ok: true });
});

export default router;
