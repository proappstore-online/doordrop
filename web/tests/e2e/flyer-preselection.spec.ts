import { test, expect } from '@playwright/test';

test.describe('Flyer pre-selection in campaign setup (Issue #63)', () => {
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

  test('flying from library with flyerId query param pre-selects flyer in setup', async ({ page }) => {
    // Mock flyer list with one flyer
    const testFlyer = {
      id: 'flyer-test-123',
      name: 'Summer Sale',
      description: 'Test flyer for summer',
      file_url: 'https://example.com/flyer.png',
      created_by: 'gh:test-client-1',
      created_at: 1_700_000_000_000,
      archived_at: null,
    };

    await page.route('**/.pas/worker/v1/users/gh:test-client-1/flyers', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([testFlyer]),
      }),
    );

    // Navigate directly to campaign setup with flyerId in URL (simulating the "Use" button click)
    await page.goto('/app/setup?flyerId=flyer-test-123');

    // Wait for page to load
    await page.waitForSelector('text="Create a Campaign"');

    // Should start on location step (step 1)
    const stepIndicator = page.locator('text="Location"');
    await expect(stepIndicator).toBeVisible();

    // Fill in location to move to next steps
    const stateSelect = page.locator('input[placeholder="Select a state"]');
    await stateSelect.click();
    await page.getByText('NSW', { exact: true }).first().click();

    await page.fill('input[maxlength="100"]', 'Parramatta');
    await page.fill('input[inputMode="numeric"]', '2150');

    // Mock campaign creation
    await page.route('**/.pas/worker/v1/campaigns', async (route) => {
      if (route.request().method() === 'POST') {
        return route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({ id: 'campaign-with-flyer' }),
        });
      }
      return route.continue();
    });

    // Continue to next step (delivery area)
    await page.click('button:has-text("Continue")');

    // Fill delivery area
    await page.fill('input[inputMode="decimal"]', '100');

    // Continue to flyer step
    await page.click('button:has-text("Continue")');

    // Verify flyer step shows the pre-selected flyer
    await page.waitForSelector('text="Flyer selected"');
    const selectedFlyer = page.locator('text="Flyer selected"');
    await expect(selectedFlyer).toBeVisible();

    // Verify the flyer ID is shown
    const flyerConfirmation = page.locator('text="flyer-test-123"');
    await expect(flyerConfirmation).toBeVisible();
  });

  test('draft restores are not overwritten by flyerId query param', async ({ page }) => {
    // This test ensures that if a user has a saved draft, navigating with a flyerId
    // query param doesn't overwrite it

    // Mock user draft (simulated by localStorage)
    await page.addInitScript(() => {
      const draft = {
        currentStep: 3,
        campaignId: 'campaign-draft-123',
        data: {
          activePrintoutId: 'flyer-from-draft',
        },
        timestamp: Date.now(),
      };
      localStorage.setItem('campaign_draft_gh:test-client-1', JSON.stringify(draft));
    });

    // Navigate to campaign setup with a different flyerId
    await page.goto('/app/setup?flyerId=flyer-different-123');

    // Wait for page to load
    await page.waitForSelector('text="Create a Campaign"');

    // Should restore to step 3 (flyer step) from draft
    await page.waitForTimeout(500);

    // The selected flyer should be from the draft, not from the query param
    const selectedFlyer = page.locator('text="flyer-from-draft"');
    await expect(selectedFlyer).toBeVisible();
  });

  test('invalid or missing flyerId does not break campaign setup', async ({ page }) => {
    // Mock empty flyer list
    await page.route('**/.pas/worker/v1/users/gh:test-client-1/flyers', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      }),
    );

    // Navigate with invalid flyerId
    await page.goto('/app/setup?flyerId=nonexistent-flyer-id');

    // Wait for page to load
    await page.waitForSelector('text="Create a Campaign"');

    // Should still be usable - just without a pre-selected flyer
    const createButton = page.locator('button:has-text("Continue")');
    await expect(createButton).toBeDisabled();

    // User should be able to fill in location and continue
    const stateSelect = page.locator('input[placeholder="Select a state"]');
    await stateSelect.click();
    await page.getByText('NSW', { exact: true }).first().click();

    await page.fill('input[maxlength="100"]', 'Parramatta');
    await page.fill('input[inputMode="numeric"]', '2150');

    // Now continue button should be enabled
    await expect(createButton).not.toBeDisabled();
  });
});
