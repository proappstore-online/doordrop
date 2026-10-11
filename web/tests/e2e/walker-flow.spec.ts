import { test, expect } from '@playwright/test';
import { setupWalkerAuth } from './fixtures/walker-auth';

test.describe('Walker happy path (mocked)', () => {
  const fakeCampaigns = [
    {
      id: 'campaign-1',
      name: 'Oak Ave Test',
      status: 'ready',
      suburb: 'parramatta',
      postcode: '2150',
      admin_ids: ['gh:1'],
      assigned_walker_id: null,
      created_at: 1_700_000_000_000,
    },
  ];

  test.beforeEach(async ({ page, context }) => {
    // Mock campaigns endpoint FIRST before any mocks that setupWalkerAuth registers
    await page.route(/\/\.pas\/worker\/v1\/campaigns(\?|$)/, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(fakeCampaigns),
      }),
    );

    // Set up walker authentication using shared fixture
    await setupWalkerAuth(page, context);
  });

  test('/walker lands on the campaigns page and lists open campaigns', async ({ page }) => {
    // Navigate to /walker (setupWalkerAuth already navigated to /,now navigate to walker route)
    await page.goto('/walker');
    await expect(page).toHaveURL('/walker');
    await expect(page.getByText('Oak Ave Test')).toBeVisible({ timeout: 10_000 });
  });
});
