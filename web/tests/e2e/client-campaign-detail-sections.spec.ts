import { test, expect, type Page } from '@playwright/test';

// #92: ClientCampaignDetailPage used to render several sections twice. Each section must show exactly
// once for the statuses and roles it is meant for, and not at all for the others.

const CLIENT_ID = 'client-sections-test';
const OTHER_ADMIN_ID = 'someone-else';
const CAMPAIGN_ID = 'campaign-sections-1';

type Status = 'draft' | 'ready' | 'assigned' | 'complete' | 'review' | 'payment' | 'archive';

interface Scenario {
  status: Status;
  /** 'admin': the signed-in user administers the campaign. 'walker': assigned to it, not an admin. */
  role: 'admin' | 'walker';
  withActiveFlyer?: boolean;
  withPrintouts?: boolean;
}

async function openCampaign(page: Page, { status, role, withActiveFlyer = true, withPrintouts = true }: Scenario) {
  await page.route('**/.pas/auth/me', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ id: CLIENT_ID, login: 'test-client', avatarUrl: null }),
    }),
  );
  await page.route('**/v1/me', (route) =>
    route.fulfill({
      status: 200,
      body: JSON.stringify({
        user: { id: CLIENT_ID, role: 'client', name: 'Test Client', clientProfile: { onboardingCompleted: true } },
        needsRoleSelection: false,
      }),
    }),
  );

  const printouts = withPrintouts
    ? [{ id: 'printout-1', name: 'Spring Flyer', description: 'Two-sided A5', version: 1, createdAt: Date.now(), createdBy: CLIENT_ID }]
    : [];
  const campaign = {
    id: CAMPAIGN_ID,
    name: 'Sections Campaign',
    status,
    adminIds: role === 'admin' ? [CLIENT_ID] : [OTHER_ADMIN_ID],
    assignedWalkerId: role === 'walker' ? CLIENT_ID : undefined,
    activePrintoutId: withActiveFlyer && withPrintouts ? 'printout-1' : undefined,
    suburb: 'Melbourne',
    postcode: '3000',
    state: 'Victoria',
    lat: -37.8136,
    lng: 144.9631,
    doorRadiusM: 1000,
    totalDoors: 1,
  };
  const doors = [
    { id: 'door-1', campaignId: CAMPAIGN_ID, address: '1 Elm St', streetName: 'Elm St', houseNumber: '1', status: 'pending', lat: -37.8136, lng: 144.9631 },
  ];

  await page.route(`**/v1/campaigns/${CAMPAIGN_ID}`, (route) =>
    route.request().method() === 'GET' ? route.fulfill({ status: 200, body: JSON.stringify(campaign) }) : route.fallthrough(),
  );
  await page.route(`**/v1/campaigns/${CAMPAIGN_ID}/printouts`, (route) =>
    route.request().method() === 'GET' ? route.fulfill({ status: 200, body: JSON.stringify(printouts) }) : route.fallthrough(),
  );
  await page.route(`**/v1/campaigns/${CAMPAIGN_ID}/doors`, (route) =>
    route.request().method() === 'GET' ? route.fulfill({ status: 200, body: JSON.stringify(doors) }) : route.fallthrough(),
  );
  await page.route('**/v1/flyers*', (route) => route.fulfill({ status: 200, body: JSON.stringify([]) }));

  await page.goto(`/app/campaign/${CAMPAIGN_ID}`);
  // The command header carries the campaign name once the page has loaded
  await expect(page.getByText('Sections Campaign').first()).toBeVisible();
}

// A marker for each section that shows on this page
const sections = (page: Page) => ({
  settings: page.getByRole('heading', { name: 'Campaign Settings' }),
  tracking: page.getByRole('heading', { name: 'Delivery Tracking' }),
  stats: page.getByText('Delivered', { exact: true }),
  map: page.locator('.leaflet-container'),
  doorList: page.getByRole('heading', { name: /^Doors \(\d+\)$/ }),
  addressSearch: page.getByPlaceholder('e.g. Collins Street'),
  flyerPanel: page.getByRole('heading', { name: 'Active Flyer' }),
  flyerCard: page.getByText('Flyer for This Campaign'),
  archived: page.getByRole('heading', { name: 'Campaign Archived' }),
});

test.describe('ClientCampaignDetailPage renders each section once (#92)', () => {
  test('admin, draft: settings, map, door list and address search once; no stats or tracking', async ({ page }) => {
    await openCampaign(page, { status: 'draft', role: 'admin', withActiveFlyer: false });
    const s = sections(page);

    await expect(s.settings).toHaveCount(1);
    await expect(s.map).toHaveCount(1);
    await expect(s.doorList).toHaveCount(1);
    await expect(s.addressSearch).toHaveCount(1);
    // A draft has no stats, no tracking panel, and its flyer is shown by the notices, not the sidebar panel
    await expect(s.stats).toHaveCount(0);
    await expect(s.tracking).toHaveCount(0);
    await expect(s.flyerPanel).toHaveCount(0);
    await expect(page.getByText('No active flyer set')).toHaveCount(1);
  });

  test('admin, ready: settings, stats, map, door list and address search once', async ({ page }) => {
    await openCampaign(page, { status: 'ready', role: 'admin' });
    const s = sections(page);

    await expect(s.settings).toHaveCount(1);
    await expect(s.stats).toHaveCount(1);
    await expect(s.map).toHaveCount(1);
    await expect(s.doorList).toHaveCount(1);
    await expect(s.addressSearch).toHaveCount(1);
    await expect(s.tracking).toHaveCount(0);
  });

  test('admin, assigned: one flyer panel with its description, one map, one stats block, no settings', async ({ page }) => {
    await openCampaign(page, { status: 'assigned', role: 'admin' });
    const s = sections(page);

    await expect(s.flyerPanel).toHaveCount(1);
    await expect(s.flyerCard).toHaveCount(0);
    // The description the old second flyer card showed is on the panel, once. (The admin's printout
    // manager also lists the flyer, so look inside the panel only.)
    await expect(s.flyerPanel.locator('xpath=..').getByText('Two-sided A5')).toHaveCount(1);
    await expect(s.stats).toHaveCount(1);
    await expect(s.map).toHaveCount(1);
    await expect(s.doorList).toHaveCount(1);
    await expect(s.settings).toHaveCount(0);
    await expect(s.addressSearch).toHaveCount(0);
  });

  test('assigned walker, assigned: one tracking panel, one map, no settings', async ({ page }) => {
    await openCampaign(page, { status: 'assigned', role: 'walker' });
    const s = sections(page);

    await expect(s.tracking).toHaveCount(1);
    await expect(s.map).toHaveCount(1);
    await expect(s.stats).toHaveCount(1);
    await expect(s.settings).toHaveCount(0);
    await expect(s.addressSearch).toHaveCount(0);
  });

  for (const status of ['complete', 'review', 'payment'] as const) {
    test(`admin, ${status}: stats once, map and door list once, no tracking or settings`, async ({ page }) => {
      await openCampaign(page, { status, role: 'admin' });
      const s = sections(page);

      await expect(s.stats).toHaveCount(1);
      await expect(s.map).toHaveCount(1);
      await expect(s.doorList).toHaveCount(1);
      await expect(s.tracking).toHaveCount(0);
      await expect(s.settings).toHaveCount(0);
      await expect(s.flyerPanel).toHaveCount(1);
      await expect(s.flyerCard).toHaveCount(0);
    });
  }

  test('admin, archive: the archived notice and stats once', async ({ page }) => {
    await openCampaign(page, { status: 'archive', role: 'admin' });
    const s = sections(page);

    await expect(s.archived).toHaveCount(1);
    await expect(s.stats).toHaveCount(1);
    await expect(s.map).toHaveCount(1);
    await expect(s.settings).toHaveCount(0);
  });
});
