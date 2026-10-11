import { test, expect } from '@playwright/test';

test.describe('Campaign wizard regressions (#20 postcode, #21 printout)', () => {
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

  test('#20: invalid postcode blocks advance', async ({ page }) => {
    let campaignPostCount = 0;

    await page.route('**/users/**/flyers', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      }),
    );

    await page.route('**/.pas/worker/v1/campaigns', async (route) => {
      if (route.request().method() === 'POST') {
        campaignPostCount++;
      }
      return route.continue();
    });

    await page.goto('/app/setup');

    // Fill location step
    await page.locator('[class*="-control"]').first().click();
    await page.waitForSelector('[class*="-option"]', { timeout: 5000 });
    await page.getByRole('option', { name: 'New South Wales' }).click();
    await page.fill('input[maxlength="100"]', 'Parramatta');
    await page.fill('input[inputMode="numeric"]', '123'); // Invalid 3-digit postcode

    // Continue button should be disabled
    const continueBtn = page.locator('button:has-text("Continue →")').first();
    await expect(continueBtn).toBeDisabled({ timeout: 5000 });

    // No campaign should be created
    expect(campaignPostCount).toBe(0);
  });

  test('#20: valid postcode allows campaign creation', async ({ page }) => {
    let campaignPostCount = 0;

    await page.route('**/users/**/flyers', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      }),
    );

    await page.route('**/.pas/worker/v1/campaigns', async (route) => {
      if (route.request().method() === 'POST') {
        campaignPostCount++;
        return route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'campaign-123',
            name: 'Parramatta 3000',
            status: 'draft',
            suburb: 'parramatta',
            postcode: '3000',
            state: 'New South Wales',
          }),
        });
      }
      return route.continue();
    });

    await page.goto('/app/setup');

    // Fill location step with valid postcode
    await page.locator('[class*="-control"]').first().click();
    await page.waitForSelector('[class*="-option"]', { timeout: 5000 });
    await page.getByRole('option', { name: 'New South Wales' }).click();
    await page.fill('input[maxlength="100"]', 'Parramatta');
    await page.fill('input[inputMode="numeric"]', '3000'); // Valid 4-digit postcode

    // Continue button should be enabled
    const continueBtn = page.locator('button:has-text("Continue →")').first();
    await expect(continueBtn).toBeEnabled({ timeout: 5000 });

    // Click to advance
    await page.click('button:has-text("Continue →")');

    // Should see next step
    await page.waitForSelector('legend:has-text("Delivery area settings")', { timeout: 5000 });

    // Campaign should be created
    expect(campaignPostCount).toBe(1);
  });

  test('#21: library flyer selection creates campaign printout', async ({ page }) => {
    const LIBRARY_FLYER_ID = 'lib-flyer-456';
    const PRINTOUT_ID = 'cp-789';
    let campaignId = '';
    let printoutCreatedBody: any = null;

    // Mock library flyers
    await page.route('**/.pas/worker/v1/users/gh%3Atest-client-1/flyers', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: LIBRARY_FLYER_ID,
            name: 'Test Flyer',
            description: 'Test description',
            file_url: 'https://example.com/flyer.png',
          },
        ]),
      }),
    );

    // Mock printout creation
    await page.route('**/.pas/worker/v1/campaigns/**/printouts', async (route) => {
      if (route.request().method() === 'POST') {
        printoutCreatedBody = JSON.parse(route.request().postData() || '{}');
        return route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            id: PRINTOUT_ID,
            campaign_id: campaignId,
            version: 1,
            flyer_id: LIBRARY_FLYER_ID,
            name: 'Test Flyer',
          }),
        });
      }
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });

    // Mock campaign creation
    await page.route('**/.pas/worker/v1/campaigns', async (route) => {
      if (route.request().method() === 'POST') {
        campaignId = 'test-campaign-123';
        return route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            id: campaignId,
            name: 'Test Campaign',
            status: 'draft',
            suburb: 'test',
            postcode: '2150',
            state: 'New South Wales',
          }),
        });
      }
      return route.continue();
    });

    await page.goto('/app/setup');

    // Location step
    await page.locator('[class*="-control"]').first().click();
    await page.waitForSelector('[class*="-option"]', { timeout: 5000 });
    await page.getByRole('option', { name: 'New South Wales' }).click();
    await page.fill('input[maxlength="100"]', 'Test');
    await page.fill('input[inputMode="numeric"]', '2150');
    await page.click('button:has-text("Continue →")');

    // Delivery step
    await page.waitForSelector('legend:has-text("Delivery area settings")', { timeout: 5000 });
    await page.fill('input[placeholder="e.g., 5"]', '5');
    await page.click('button:has-text("Continue →")');

    // Flyer step - select from library
    await page.waitForSelector('legend:has-text("Flyer selection")', { timeout: 5000 });
    await page.click('button:has-text("Select from library")');
    await page.waitForSelector('label:has-text("Test Flyer")', { timeout: 5000 });
    await page.click('label:has-text("Test Flyer")');

    // Confirm selection
    await page.click('button:has-text("Confirm")');

    // Wait for the printout creation to complete
    await expect.poll(() => printoutCreatedBody, { timeout: 10000 }).toBeTruthy();

    // Verify printout was created with flyer reference
    expect(printoutCreatedBody.flyer_id).toBe(LIBRARY_FLYER_ID);
    expect(printoutCreatedBody.name).toBe('Test Flyer');

    // Click Continue to trigger saveDraft in parent, which saves activePrintoutId to localStorage
    await page.click('button:has-text("Continue →")');
    await page.waitForSelector('label[for="start-date"]', { timeout: 5000 });

    // Now verify activePrintoutId was saved to localStorage with the PRINTOUT ID, not library flyer ID
    const draft = JSON.parse(
      await page.evaluate(() => localStorage.getItem('campaign_draft_gh:test-client-1') || '{}'),
    );
    expect(draft.data.activePrintoutId).toBe(PRINTOUT_ID);
    expect(draft.data.activePrintoutId).not.toBe(LIBRARY_FLYER_ID);
  });

  test('#21: failed printout creation shows error', async ({ page }) => {
    const LIBRARY_FLYER_ID = 'lib-flyer-fail';
    let campaignId = '';

    // Mock library flyers
    await page.route('**/.pas/worker/v1/users/gh%3Atest-client-1/flyers', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: LIBRARY_FLYER_ID,
            name: 'Fail Flyer',
            description: 'This will fail',
            file_url: 'https://example.com/fail.png',
          },
        ]),
      }),
    );

    // Mock printout creation to FAIL
    await page.route('**/.pas/worker/v1/campaigns/**/printouts', async (route) => {
      if (route.request().method() === 'POST') {
        return route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Internal server error' }),
        });
      }
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });

    // Mock campaign creation
    await page.route('**/.pas/worker/v1/campaigns', async (route) => {
      if (route.request().method() === 'POST') {
        campaignId = 'test-campaign-fail';
        return route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            id: campaignId,
            name: 'Fail Campaign',
            status: 'draft',
            suburb: 'fail',
            postcode: '2150',
            state: 'New South Wales',
          }),
        });
      }
      return route.continue();
    });

    await page.goto('/app/setup');

    // Location step
    await page.locator('[class*="-control"]').first().click();
    await page.waitForSelector('[class*="-option"]', { timeout: 5000 });
    await page.getByRole('option', { name: 'New South Wales' }).click();
    await page.fill('input[maxlength="100"]', 'Fail');
    await page.fill('input[inputMode="numeric"]', '2150');
    await page.click('button:has-text("Continue →")');

    // Delivery step
    await page.waitForSelector('legend:has-text("Delivery area settings")', { timeout: 5000 });
    await page.fill('input[placeholder="e.g., 5"]', '5');
    await page.click('button:has-text("Continue →")');

    // Flyer step - try to select from library
    await page.waitForSelector('legend:has-text("Flyer selection")', { timeout: 5000 });
    await page.click('button:has-text("Select from library")');
    await page.waitForSelector('label:has-text("Fail Flyer")', { timeout: 5000 });
    await page.click('label:has-text("Fail Flyer")');

    // Confirm - will fail
    await page.click('button:has-text("Confirm")');

    // Verify error message is shown
    await expect(page.locator('text=/Failed|error/i')).toBeVisible({ timeout: 5000 });

    // Wait a moment for any state updates
    await page.waitForTimeout(500);

    // Verify activePrintoutId is NOT set
    const draft = JSON.parse(
      await page.evaluate(() => localStorage.getItem('campaign_draft_gh:test-client-1') || '{}'),
    );
    expect(draft.data?.activePrintoutId).toBeUndefined();

    // Verify Continue button is still disabled
    const continueBtn = page.locator('button:has-text("Continue →")').first();
    await expect(continueBtn).toBeDisabled();
  });
});

