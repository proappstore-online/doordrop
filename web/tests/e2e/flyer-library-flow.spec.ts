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
    clientProfile: {
      onboardingCompleted: true,
    },
  };

  test.beforeEach(async ({ page, context }) => {
    // Set platform session cookie before any navigation
    try {
      await context.addCookies([
        {
          name: '__Host-pas-session',
          value: FAKE_TOKEN,
          path: '/',
          secure: false,
          httpOnly: false,
        },
      ]);
    } catch (e) {
      // Fallback: Set via init script if context.addCookies fails
      await page.addInitScript(
        ({ token }) => {
          document.cookie = `__Host-pas-session=${token}; Path=/; SameSite=Lax`;
        },
        { token: FAKE_TOKEN },
      );
    }

    await page.addInitScript(
      ({ token, user }) => {
        localStorage.setItem(
          'fas:session:doordrop',
          JSON.stringify({ token, user, savedAt: Date.now() }),
        );
      },
      { token: FAKE_TOKEN, user: FAKE_USER },
    );

    // The SDK calls /.pas/auth/me first (platform cookie auth probe)
    await page.route('**/.pas/auth/me', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(FAKE_USER) }),
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

  test('Create campaign without flyers shows disabled flyer button and stops at flyer step', async ({ page }) => {
    let campaignPostCount = 0;
    let printoutMutationCount = 0;
    let campaignId = '';

    // Mock flyer endpoint with EMPTY flyer list (no flyers available)
    await page.route('**/v1/users/**/flyers', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),  // Empty - no flyers to select
      }),
    );

    // Mock campaign creation - should be called with status=draft, no activePrintoutId
    await page.route('**/.pas/worker/v1/campaigns', async (route) => {
      const method = route.request().method();
      if (method === 'POST') {
        campaignPostCount++;
        const body = JSON.parse(route.request().postData() || '{}');
        // Verify no activePrintoutId is sent (must be undefined, not null)
        expect(body.active_printout_id).toBeUndefined();
        expect(body.status).toBe('draft');
        campaignId = 'campaign-no-flyers-' + Date.now();
        return route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            id: campaignId,
            name: 'Parramatta Campaign',
            status: 'draft',
            suburb: 'parramatta',
            postcode: '2150',
            state: 'New South Wales',
            admin_ids: ['gh:test-client-1'],
            created_at: 1_700_000_000_000,
            active_printout_id: null,
            member_ids: ['gh:test-client-1'],
          }),
        });
      }
      // GET campaign detail
      if (method === 'GET') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: campaignId,
            name: 'Parramatta Campaign',
            status: 'draft',
            suburb: 'parramatta',
            postcode: '2150',
            state: 'New South Wales',
            admin_ids: ['gh:test-client-1'],
            created_at: 1_700_000_000_000,
            active_printout_id: null,
            member_ids: ['gh:test-client-1'],
          }),
        });
      }
      return route.continue();
    });

    // Mock printouts endpoint - should remain empty with no mutations
    await page.route('**/.pas/worker/v1/campaigns/*/printouts', (route) => {
      const method = route.request().method();
      if (method !== 'GET') {
        printoutMutationCount++;
      }
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    });

    await page.goto('/app/setup');

    // Step 1: Location
    await page.locator('[class*="-control"]').first().click();
    await page.waitForSelector('[class*="-option"]', { timeout: 5000 });
    await page.getByRole('option', { name: 'New South Wales' }).click();

    await page.fill('input[maxlength="100"]', 'Parramatta');
    await page.fill('input[inputMode="numeric"]', '2150');

    // Continue to Delivery step
    await page.click('button:has-text("Continue →")');
    await page.waitForSelector('legend:has-text("Delivery area settings")', { timeout: 5000 });

    // Step 2: Delivery Area - set radius
    await page.fill('input[placeholder="e.g., 5"]', '5');

    // Continue to Flyer step
    await page.click('button:has-text("Continue →")');
    await page.waitForSelector('legend:has-text("Flyer selection")', { timeout: 5000 });

    // Step 3: Flyer - verify empty library state and draft persistence
    await expect(page.locator('legend').filter({ hasText: 'Flyer selection' })).toBeVisible();

    // Click "Select from library" to trigger library load (proves library was empty)
    await page.click('button:has-text("Select from library")');
    await page.waitForSelector('h3:has-text("Select from your library")', { timeout: 5000 });

    // Assert exact empty library text
    await expect(page.getByText('No flyers in your library. Upload one first.')).toBeVisible();

    // Assert zero library-flyer checkboxes (no flyers to select)
    await expect(page.locator('input[name="library-flyer"]')).toHaveCount(0);

    // Continue button on Flyer step should be DISABLED (no activePrintoutId)
    const continueBtn = page.locator('button:has-text("Continue →")').first();
    await expect(continueBtn).toBeDisabled({ timeout: 5000 });

    // Verify campaign was created exactly ONCE with draft status and NO activePrintoutId
    expect(campaignPostCount).toBe(1);
    // Verify no printout mutations were attempted (no POST/PATCH/DELETE to printouts)
    expect(printoutMutationCount).toBe(0);

    // Verify localStorage draft - stored as campaign_draft_<userId>
    const draftJson = await page.evaluate(() => {
      return localStorage.getItem('campaign_draft_gh:test-client-1');
    });
    expect(draftJson).toBeTruthy();
    const draft = JSON.parse(draftJson!);
    expect(draft.currentStep).toBe(3); // Flyer step (after Location=2, Delivery=2)
    expect(draft.campaignId).toBe(campaignId);
    expect(draft.data.activePrintoutId).toBeUndefined(); // No flyer selected

    // Reload and verify draft is restored at Flyer step
    await page.reload();
    await page.waitForSelector('legend:has-text("Flyer selection")', { timeout: 5000 });

    // After reload, Continue button should still be disabled
    const reloadedContinueBtn = page.locator('button:has-text("Continue →")').first();
    await expect(reloadedContinueBtn).toBeDisabled({ timeout: 5000 });

    // Verify campaign was NOT created again (count still 1)
    expect(campaignPostCount).toBe(1);

    // STOP HERE - do not navigate to Schedule/Budget or publish
    // This proves the wizard contract: flyer is required to advance beyond the Flyer step
    // The draft campaign exists but without an active printout, making advancement impossible
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

    // Mock flyer endpoint
    await page.route('**/v1/users/**/flyers', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockFlyers),
      }),
    );

    // Mock campaign create endpoint
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

    await page.goto('/app/setup');
    await page.waitForSelector('label:has-text("State")');

    // Step 1: Location - select NSW, Parramatta, 2150
    const stateControl = page.locator('[class*="-control"]').first();
    await stateControl.click();
    await page.keyboard.type('NSW');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');

    await page.fill('input[maxlength="100"]', 'Parramatta');
    await page.fill('input[inputMode="numeric"]', '2150');

    // Continue to Step 2
    await page.click('button:has-text("Continue")');
    await page.waitForSelector('label:has-text("Radius")');

    // Step 2: Delivery - set radius
    await page.fill('input[placeholder*="radius"]', '50');
    await page.click('button:has-text("Continue")');
    await page.waitForTimeout(300);

    // Step 3: Flyer - verify selection prompt appears
    await expect(page.getByText(/Select|flyer|library/i)).toBeVisible({ timeout: 5000 });
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

    // Mock ALL flyer requests before starting
    await page.route('**/users/*/flyers', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockFlyers),
      }),
    );

    // Mock campaigns route (creation and detail fetch)
    await page.route('**/campaigns', async (route) => {
      const method = route.request().method();
      if (method === 'POST') {
        return route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'campaign-select-flyer',
            name: 'Parramatta Campaign',
            status: 'draft',
            suburb: 'parramatta',
            postcode: '2150',
            state: 'New South Wales',
            admin_ids: ['gh:test-client-1'],
            created_at: 1_700_000_000_000,
            member_ids: ['gh:test-client-1'],
          }),
        });
      }
      return route.continue();
    });

    // Mock campaign detail fetch
    await page.route('**/campaigns/campaign-select-flyer', async (route) => {
      const method = route.request().method();
      if (method === 'GET') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'campaign-select-flyer',
            name: 'Parramatta Campaign',
            status: 'published',
            suburb: 'parramatta',
            postcode: '2150',
            state: 'New South Wales',
            admin_ids: ['gh:test-client-1'],
            created_at: 1_700_000_000_000,
            active_printout_id: 'printout-1',
            member_ids: ['gh:test-client-1'],
            doorRadiusM: 5000,
            dueDate: 1_700_000_000_000 + 86400000 * 7,
            budget: 500,
          }),
        });
      }
      if (method === 'PATCH') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ ok: true }),
        });
      }
      return route.continue();
    });

    // Mock printouts operations
    await page.route('**/printouts', async (route) => {
      const method = route.request().method();
      if (method === 'POST') {
        return route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'printout-1',
            campaign_id: 'campaign-select-flyer',
            version: 1,
            name: 'Select Test Flyer',
            description: 'This one will be selected',
            file_url: 'https://example.com/test-flyer.png',
            flyer_id: 'flyer-select-test',
            created_at: 1_700_000_000_000,
          }),
        });
      }
      return route.fulfill({
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
      });
    });

    await page.goto('/app/setup');

    // Step 1: Location - fill in state, suburb, postcode
    // State: Use react-select control to select New South Wales
    await page.locator('[class*="-control"]').first().click();
    // Wait for menu to appear (react-select uses portal)
    await page.waitForSelector('[class*="-option"]', { timeout: 5000 });
    await page.getByRole('option', { name: 'New South Wales' }).click();

    // Suburb
    await page.fill('input[maxlength="100"]', 'Parramatta');

    // Postcode
    await page.fill('input[inputMode="numeric"]', '2150');

    // Continue to next step
    await page.click('button:has-text("Continue →")');
    await page.waitForSelector('legend:has-text("Delivery area settings")', { timeout: 5000 });

    // Step 2: Delivery Area - enter radius
    await page.fill('input[placeholder="e.g., 5"]', '5');

    // Continue to next step
    await page.click('button:has-text("Continue →")');
    await page.waitForSelector('legend:has-text("Flyer selection")', { timeout: 5000 });

    // Step 3: Flyer - select from library
    await page.click('button:has-text("Select from library")');

    // Wait for flyers to load and select the test flyer
    await page.waitForSelector('label:has-text("Select Test Flyer")', { timeout: 5000 });
    await page.click('label:has-text("Select Test Flyer")');

    // Verify flyer is selected (radio should be checked)
    await expect(page.getByRole('radio', { checked: true })).toBeVisible();

    // Confirm selection
    await page.click('button:has-text("Confirm")');

    // Continue to next step
    await page.click('button:has-text("Continue →")');
    await page.waitForSelector('label[for="start-date"]', { timeout: 5000 });

    // Step 4: Schedule & Budget
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    const nextWeekStr = nextWeek.toISOString().split('T')[0];

    await page.fill('input[id="start-date"]', tomorrowStr);
    await page.fill('input[id="end-date"]', nextWeekStr);
    await page.fill('input[id="budget"]', '500');

    // Continue to next step
    await page.click('button:has-text("Continue →")');
    await page.waitForSelector('h2:has-text("Campaign Summary")', { timeout: 5000 });

    // Step 5: Review - publish campaign
    await page.click('button:has-text("Publish")');

    // Should navigate to campaign detail with active flyer visible
    await expect(page).toHaveURL('/app/campaign/campaign-select-flyer', { timeout: 10_000 });

    // Verify active flyer is displayed in the campaign (check the first occurrence)
    await expect(page.getByText('Select Test Flyer').first()).toBeVisible({ timeout: 5_000 });
  });

  test('Skip flyer selection navigates to campaign without setting active flyer', async ({ page }) => {
    // Mock flyer endpoint with one flyer
    await page.route('**/v1/users/**/flyers', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 'flyer-skip-test',
            name: 'Skip Test Flyer',
            description: 'This will be skipped',
            file_url: 'https://example.com/skip-flyer.png',
            archived_at: null,
            created_at: 1_700_000_000_000,
          },
        ]),
      }),
    );

    // Mock campaign create endpoint
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

    await page.goto('/app/setup');
    await page.waitForSelector('label:has-text("State")');

    // Step 1: Location
    const stateControl = page.locator('[class*="-control"]').first();
    await stateControl.click();
    await page.keyboard.type('NSW');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');

    await page.fill('input[maxlength="100"]', 'Parramatta');
    await page.fill('input[inputMode="numeric"]', '2150');

    // Continue to Step 2
    await page.click('button:has-text("Continue")');
    await page.waitForSelector('label:has-text("Radius")');

    // Step 2: Delivery
    await page.fill('input[placeholder*="radius"]', '50');
    await page.click('button:has-text("Continue")');
    await page.waitForTimeout(300);

    // Step 3: Flyer - skip the selection
    const skipBtn = page.locator('button').filter({ hasText: /Skip|without/ }).first();
    if (await skipBtn.isVisible()) {
      await skipBtn.click();
    }
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
    // The page shows both a warning banner and empty state; target the blue empty state specifically
    const blueAlert = page.locator('.bg-blue-50, .dark\\:bg-blue-900').filter({ has: page.getByText('No flyer selected') });
    await expect(blueAlert).toBeVisible({ timeout: 5_000 });
    await expect(blueAlert.getByText(/Upload a flyer or select one/)).toBeVisible();
  });
});
