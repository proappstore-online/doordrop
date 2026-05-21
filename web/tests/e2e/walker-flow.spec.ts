import { test, expect } from '@playwright/test';

// Mocked walker happy path. Skipped until we nail down the SDK's localStorage
// session key shape — the current seed shape (fas:session:<appId>) doesn't
// hydrate the React state on first paint, so /walker bounces to /login.
//
// To finish: open a real signed-in session in DevTools, observe the actual
// key/value the SDK persists, and update the seed in beforeEach to match.
test.describe.skip('Walker happy path (mocked)', () => {
  const FAKE_USER = { id: 'gh:999999', login: 'test-walker', avatarUrl: null };
  const FAKE_TOKEN = 'fake-session-token';

  const fakeWalker = {
    id: 'gh:999999',
    email: 'walker@example.com',
    name: 'Test Walker',
    photo_url: null,
    role: 'walker',
    created_at: 1_700_000_000_000,
  };

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

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(
      ({ token, user }) => {
        localStorage.setItem(
          'fas:session:doordrop',
          JSON.stringify({ token, user, savedAt: Date.now() }),
        );
      },
      { token: FAKE_TOKEN, user: FAKE_USER },
    );

    await page.route('**/api.freeappstore.online/v1/auth/me', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(FAKE_USER) }),
    );
    await page.route('**/pas-data-doordrop.serge-the-dev.workers.dev/v1/me', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ user: fakeWalker, needsRoleSelection: false }),
      }),
    );
    await page.route(/pas-data-doordrop.+\/v1\/campaigns(\?|$)/, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(fakeCampaigns),
      }),
    );
  });

  test('/walker lands on the campaigns page and lists open campaigns', async ({ page }) => {
    await page.goto('/walker');
    await expect(page).toHaveURL('/walker');
    await expect(page.getByText('Oak Ave Test')).toBeVisible({ timeout: 10_000 });
  });
});
