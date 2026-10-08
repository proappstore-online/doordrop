import { test, expect } from '@playwright/test';

test.describe('Flyer library unification (Issue #21)', () => {
  const FAKE_USER = { id: 'gh:test-client-1', login: 'test-client', avatarUrl: null };
  const FAKE_TOKEN = 'fake-session-token';

  const fakeClientUser = {
    id: 'gh:test-client-1',
    email: 'client@example.com',
    name: 'Test Client',
    photo_url: null,
    role: 'client',
    created_at: 1_700_000_000_000,
  };

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
    await page.route('**/.pas/worker/v1/me', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ user: fakeClientUser, needsRoleSelection: false }),
      }),
    );
  });

  test('Create campaign without flyers shows no prompt and navigates directly', async ({ page }) => {
    // Mock flyer list as empty
    await page.route('**/.pas/worker/v1/users/gh:test-client-1/flyers', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      }),
    );

    // Mock campaign creation
    await page.route('**/.pas/worker/v1/campaigns', async (route) => {
      if (route.request().method() === 'POST') {
        return route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({ id: 'campaign-no-flyers' }),
        });
      }
      return route.continue();
    });

    // Mock campaign detail fetch
    await page.route('**/.pas/worker/v1/campaigns/campaign-no-flyers', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'campaign-no-flyers',
          name: 'Test Campaign',
          status: 'draft',
          suburb: 'parramatta',
          postcode: '2150',
          admin_ids: ['gh:test-client-1'],
          created_at: 1_700_000_000_000,
          active_printout_id: null,
          member_ids: ['gh:test-client-1'],
        }),
      }),
    );

    // Mock printouts list
    await page.route('**/.pas/worker/v1/campaigns/campaign-no-flyers/printouts', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      }),
    );

    await page.goto('/app/new-campaign');

    // Fill in campaign form
    const stateSelect = page.locator('input[placeholder="Select a state"]');
    await stateSelect.click();
    await page.getByText('NSW', { exact: true }).first().click();

    await page.fill('input[maxlength="100"]', 'Parramatta');
    await page.fill('input[inputMode="numeric"]', '2150');

    // Create campaign
    await page.click('button:has-text("Create Campaign")');

    // Should navigate directly to campaign detail without flyer prompt
    await expect(page).toHaveURL('/app/campaign/campaign-no-flyers', { timeout: 10_000 });

    // Verify we're on campaign detail page
    await expect(page.getByText('No flyer selected')).toBeVisible({ timeout: 5_000 });
  });

  test('Create campaign with library flyers shows selection prompt', async ({ page }) => {
    const mockFlyers = [
      {
        id: 'flyer-1',
        name: 'Summer Sale Flyer',
        description: 'Great summer deals',
        file_url: 'https://example.com/flyer1.png',
        archived_at: null,
        created_at: 1_700_000_000_000,
      },
      {
        id: 'flyer-2',
        name: 'Winter Promo',
        description: 'Winter specials',
        file_url: 'https://example.com/flyer2.png',
        archived_at: null,
        created_at: 1_700_000_000_000,
      },
    ];

    await page.route('**/.pas/worker/v1/users/gh:test-client-1/flyers', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockFlyers),
      }),
    );

    await page.route('**/.pas/worker/v1/campaigns', async (route) => {
      if (route.request().method() === 'POST') {
        return route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({ id: 'campaign-with-flyers' }),
        });
      }
      return route.continue();
    });

    await page.goto('/app/new-campaign');

    // Fill in campaign form
    const stateSelect = page.locator('input[placeholder="Select a state"]');
    await stateSelect.click();
    await page.getByText('NSW', { exact: true }).first().click();

    await page.fill('input[maxlength="100"]', 'Parramatta');
    await page.fill('input[inputMode="numeric"]', '2150');

    // Create campaign
    await page.click('button:has-text("Create Campaign")');

    // Flyer selection prompt should appear
    await expect(page.getByText('Attach a Flyer?')).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText('Summer Sale Flyer')).toBeVisible();
    await expect(page.getByText('Winter Promo')).toBeVisible();
  });

  test('Select library flyer in campaign setup creates printout and sets active', async ({ page }) => {
    const mockFlyers = [
      {
        id: 'flyer-select-test',
        name: 'Select Test Flyer',
        description: 'This one will be selected',
        file_url: 'https://example.com/test-flyer.png',
        archived_at: null,
        created_at: 1_700_000_000_000,
      },
    ];

    await page.route('**/.pas/worker/v1/users/gh:test-client-1/flyers', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockFlyers),
      }),
    );

    await page.route('**/.pas/worker/v1/campaigns', async (route) => {
      if (route.request().method() === 'POST') {
        return route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({ id: 'campaign-select-flyer' }),
        });
      }
      return route.continue();
    });

    // Mock printout creation
    await page.route('**/.pas/worker/v1/campaigns/campaign-select-flyer/printouts', async (route) => {
      if (route.request().method() === 'POST') {
        return route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({ id: 'printout-1' }),
        });
      }
      return route.continue();
    });

    // Mock campaign update to set active printout
    await page.route('**/.pas/worker/v1/campaigns/campaign-select-flyer', async (route) => {
      if (route.request().method() === 'PATCH') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ ok: true }),
        });
      }
      return route.continue();
    });

    // Mock campaign detail fetch with active printout
    await page.route('**/.pas/worker/v1/campaigns/campaign-select-flyer', (route) => {
      if (route.request().method() === 'GET') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'campaign-select-flyer',
            name: 'Test Campaign',
            status: 'draft',
            suburb: 'parramatta',
            postcode: '2150',
            admin_ids: ['gh:test-client-1'],
            created_at: 1_700_000_000_000,
            active_printout_id: 'printout-1',
            member_ids: ['gh:test-client-1'],
          }),
        });
      }
      return route.continue();
    });

    // Mock printouts list with active flyer
    await page.route('**/.pas/worker/v1/campaigns/campaign-select-flyer/printouts', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 'printout-1',
            campaign_id: 'campaign-select-flyer',
            version: 1,
            name: 'Select Test Flyer',
            description: 'This one will be selected',
            file_url: 'https://example.com/test-flyer.png',
            flyer_id: 'flyer-select-test',
            created_at: 1_700_000_000_000,
          },
        ]),
      }),
    );

    await page.goto('/app/new-campaign');

    // Fill in campaign form
    const stateSelect = page.locator('input[placeholder="Select a state"]');
    await stateSelect.click();
    await page.getByText('NSW', { exact: true }).first().click();

    await page.fill('input[maxlength="100"]', 'Parramatta');
    await page.fill('input[inputMode="numeric"]', '2150');

    // Create campaign
    await page.click('button:has-text("Create Campaign")');

    // Flyer selection prompt should appear
    await expect(page.getByText('Attach a Flyer?')).toBeVisible({ timeout: 5_000 });

    // Select the flyer
    await page.click('label:has-text("Select Test Flyer")');
    await expect(page.getByRole('radio', { checked: true })).toBeVisible();

    // Click attach button
    await page.click('button:has-text("Attach Flyer")');

    // Should navigate to campaign detail with active flyer visible
    await expect(page).toHaveURL('/app/campaign/campaign-select-flyer', { timeout: 10_000 });

    // Verify active flyer is displayed
    await expect(page.getByText('Select Test Flyer')).toBeVisible({ timeout: 5_000 });
  });

  test('Skip flyer selection navigates to campaign without setting active flyer', async ({ page }) => {
    const mockFlyers = [
      {
        id: 'flyer-skip-test',
        name: 'Skip Test Flyer',
        description: 'This will be skipped',
        file_url: 'https://example.com/skip-flyer.png',
        archived_at: null,
        created_at: 1_700_000_000_000,
      },
    ];

    await page.route('**/.pas/worker/v1/users/gh:test-client-1/flyers', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockFlyers),
      }),
    );

    await page.route('**/.pas/worker/v1/campaigns', async (route) => {
      if (route.request().method() === 'POST') {
        return route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({ id: 'campaign-skip-flyer' }),
        });
      }
      return route.continue();
    });

    // Mock campaign detail fetch without active printout
    await page.route('**/.pas/worker/v1/campaigns/campaign-skip-flyer', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'campaign-skip-flyer',
          name: 'Test Campaign',
          status: 'draft',
          suburb: 'parramatta',
          postcode: '2150',
          admin_ids: ['gh:test-client-1'],
          created_at: 1_700_000_000_000,
          active_printout_id: null,
          member_ids: ['gh:test-client-1'],
        }),
      }),
    );

    // Mock printouts list
    await page.route('**/.pas/worker/v1/campaigns/campaign-skip-flyer/printouts', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      }),
    );

    await page.goto('/app/new-campaign');

    // Fill in campaign form
    const stateSelect = page.locator('input[placeholder="Select a state"]');
    await stateSelect.click();
    await page.getByText('NSW', { exact: true }).first().click();

    await page.fill('input[maxlength="100"]', 'Parramatta');
    await page.fill('input[inputMode="numeric"]', '2150');

    // Create campaign
    await page.click('button:has-text("Create Campaign")');

    // Flyer selection prompt should appear
    await expect(page.getByText('Attach a Flyer?')).toBeVisible({ timeout: 5_000 });

    // Click skip button
    await page.click('button:has-text("Skip for Now")');

    // Should navigate to campaign detail without active flyer
    await expect(page).toHaveURL('/app/campaign/campaign-skip-flyer', { timeout: 10_000 });

    // Verify empty state is shown
    await expect(page.getByText('No flyer selected')).toBeVisible({ timeout: 5_000 });
  });

  test('Campaign detail shows empty state when no flyer selected', async ({ page }) => {
    // Mock campaign with no active printout
    await page.route('**/.pas/worker/v1/campaigns/campaign-empty-state', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'campaign-empty-state',
          name: 'Empty State Test',
          status: 'draft',
          suburb: 'parramatta',
          postcode: '2150',
          admin_ids: ['gh:test-client-1'],
          created_at: 1_700_000_000_000,
          active_printout_id: null,
          member_ids: ['gh:test-client-1'],
        }),
      }),
    );

    // Mock printouts list
    await page.route('**/.pas/worker/v1/campaigns/campaign-empty-state/printouts', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      }),
    );

    // Mock user flyers
    await page.route('**/.pas/worker/v1/users/gh:test-client-1/flyers', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      }),
    );

    await page.goto('/app/campaign/campaign-empty-state');

    // Verify empty state messaging is visible
    await expect(page.getByText('No flyer selected — Walkers won\'t see anything to deliver.')).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText('Upload a flyer or select one from your library to get started.')).toBeVisible();
  });
});
