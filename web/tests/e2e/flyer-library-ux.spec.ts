import { test, expect } from '@playwright/test';

test.describe('Flyer library UX (Issue #50)', () => {
  const FAKE_USER = { id: 'gh:test-client-2', login: 'test-client', avatarUrl: null };
  const FAKE_TOKEN = 'fake-session-token';

  const fakeClientUser = {
    id: 'gh:test-client-2',
    email: 'client@example.com',
    name: 'Test Client',
    photo_url: null,
    role: 'client',
    created_at: 1_700_000_000_000,
  };

  const mockFlyers = [
    {
      id: 'flyer-a-oldest',
      name: 'Autumn Leaves',
      description: 'Fall collection promo',
      file_url: 'https://example.com/autumn.jpg',
      archived_at: null,
      created_at: 1_700_000_000_000,
      created_by: 'gh:test-client-2',
    },
    {
      id: 'flyer-b-middle',
      name: 'Summer Vibes',
      description: 'Beach sale campaign',
      file_url: 'https://example.com/summer.jpg',
      archived_at: null,
      created_at: 1_700_100_000_000,
      created_by: 'gh:test-client-2',
    },
    {
      id: 'flyer-c-newest',
      name: 'Winter Wonderland',
      description: 'Holiday season promotion',
      file_url: 'https://example.com/winter.jpg',
      archived_at: null,
      created_at: 1_700_200_000_000,
      created_by: 'gh:test-client-2',
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
    await page.route('**/.pas/worker/v1/me', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ user: fakeClientUser, needsRoleSelection: false }),
      }),
    );
  });

  test('displays flyer library with visual cards and search/sort controls', async ({ page }) => {
    // Mock flyer list
    await page.route('**/.pas/worker/v1/users/gh:test-client-2/flyers', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockFlyers),
      }),
    );

    // Mock campaign counts for each flyer
    await page.route('**/.pas/worker/v1/users/gh:test-client-2/flyers/*/campaigns', (route) => {
      const flyerId = route.request().url().split('/flyers/')[1].split('/')[0];
      let campaignCount = 0;
      if (flyerId === 'flyer-a-oldest') campaignCount = 2;
      else if (flyerId === 'flyer-b-middle') campaignCount = 5;
      else if (flyerId === 'flyer-c-newest') campaignCount = 0;

      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(Array(campaignCount).fill(null).map((_, i) => ({
          id: `campaign-${i}`,
          name: `Campaign ${i}`,
          status: 'ready',
        }))),
      });
    });

    await page.goto('/app/my-flyers');

    // Verify header
    await expect(page.getByRole('heading', { name: 'My Flyers' })).toBeVisible();

    // Verify search and sort controls
    await expect(page.getByPlaceholder('Search flyers...')).toBeVisible();
    const sortSelect = page.locator('select[aria-label="Sort flyers by"]');
    await expect(sortSelect).toBeVisible();

    // Verify all flyers are displayed
    await expect(page.getByText('Autumn Leaves')).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText('Summer Vibes')).toBeVisible();
    await expect(page.getByText('Winter Wonderland')).toBeVisible();

    // Verify campaign usage indicators
    await expect(page.getByText('2 campaigns')).toBeVisible();
    await expect(page.getByText('5 campaigns')).toBeVisible();
  });

  test('search filters flyers by name and description', async ({ page }) => {
    await page.route('**/.pas/worker/v1/users/gh:test-client-2/flyers', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockFlyers),
      }),
    );

    await page.route('**/.pas/worker/v1/users/gh:test-client-2/flyers/*/campaigns', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      }),
    );

    await page.goto('/app/my-flyers');

    // Wait for flyers to load
    await expect(page.getByText('Autumn Leaves')).toBeVisible({ timeout: 5_000 });

    // Search for "Summer"
    await page.fill('input[placeholder="Search flyers..."]', 'Summer');

    // Only Summer Vibes should be visible
    await expect(page.getByText('Summer Vibes')).toBeVisible();
    await expect(page.getByText('Autumn Leaves')).not.toBeVisible();
    await expect(page.getByText('Winter Wonderland')).not.toBeVisible();

    // Search for "sale" (in description)
    await page.fill('input[placeholder="Search flyers..."]', 'sale');

    // Only Summer Vibes should be visible (has "sale" in description)
    await expect(page.getByText('Summer Vibes')).toBeVisible();
    await expect(page.getByText('Autumn Leaves')).not.toBeVisible();

    // Clear search
    await page.fill('input[placeholder="Search flyers..."]', '');

    // All should be visible again
    await expect(page.getByText('Autumn Leaves')).toBeVisible();
    await expect(page.getByText('Summer Vibes')).toBeVisible();
    await expect(page.getByText('Winter Wonderland')).toBeVisible();
  });

  test('sort changes display order', async ({ page }) => {
    await page.route('**/.pas/worker/v1/users/gh:test-client-2/flyers', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockFlyers),
      }),
    );

    await page.route('**/.pas/worker/v1/users/gh:test-client-2/flyers/*/campaigns', (route) => {
      const flyerId = route.request().url().split('/flyers/')[1].split('/')[0];
      let campaignCount = 0;
      if (flyerId === 'flyer-a-oldest') campaignCount = 2;
      else if (flyerId === 'flyer-b-middle') campaignCount = 5;
      else if (flyerId === 'flyer-c-newest') campaignCount = 0;

      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(Array(campaignCount).fill(null).map((_, i) => ({
          id: `campaign-${i}`,
          name: `Campaign ${i}`,
          status: 'ready',
        }))),
      });
    });

    await page.goto('/app/my-flyers');

    // Wait for flyers to load
    await expect(page.getByText('Autumn Leaves')).toBeVisible({ timeout: 5_000 });

    // Default sort is "Newest first"
    let cards = page.locator('[class*="grid"]').locator('> div');
    const firstCardText = await cards.first().locator('text=Winter Wonderland, Summer Vibes, Autumn Leaves').first();

    // Sort by Name (A–Z)
    await page.locator('select[aria-label="Sort flyers by"]').selectOption('name');

    // Should be alphabetically sorted
    const nameOrder = page.locator('text="Autumn Leaves"').locator('..').first();
    const anotherCard = page.locator('text="Summer Vibes"').locator('..').first();
    const boundingBoxA = await nameOrder.boundingBox();
    const boundingBoxB = await anotherCard.boundingBox();
    if (boundingBoxA && boundingBoxB) {
      // Autumn should come before Summer
      expect(boundingBoxA.y).toBeLessThanOrEqual(boundingBoxB.y);
    }

    // Sort by Most used
    await page.locator('select[aria-label="Sort flyers by"]').selectOption('usage');

    // Summer Vibes (5 campaigns) should appear before Autumn Leaves (2 campaigns)
    const summerCard = page.locator('text="Summer Vibes"').locator('..').first();
    const autumnCard = page.locator('text="Autumn Leaves"').locator('..').first();
    const boundingBoxSummer = await summerCard.boundingBox();
    const boundingBoxAutumn = await autumnCard.boundingBox();
    if (boundingBoxSummer && boundingBoxAutumn) {
      expect(boundingBoxSummer.y).toBeLessThanOrEqual(boundingBoxAutumn.y);
    }
  });

  test('empty state guides first-time upload', async ({ page }) => {
    // Mock empty flyer list
    await page.route('**/.pas/worker/v1/users/gh:test-client-2/flyers', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      }),
    );

    await page.goto('/app/my-flyers');

    // Verify empty state messaging
    await expect(page.getByText('Build your flyer library')).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText(/Upload your flyer designs once/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /Upload your first flyer/i })).toBeVisible();

    // Click to upload
    await page.click('button:has-text("Upload your first flyer")');

    // Form should appear
    await expect(page.getByText('Upload a new flyer')).toBeVisible();
  });

  test('no-results state appears when search yields nothing', async ({ page }) => {
    await page.route('**/.pas/worker/v1/users/gh:test-client-2/flyers', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockFlyers),
      }),
    );

    await page.route('**/.pas/worker/v1/users/gh:test-client-2/flyers/*/campaigns', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      }),
    );

    await page.goto('/app/my-flyers');

    // Wait for flyers to load
    await expect(page.getByText('Autumn Leaves')).toBeVisible({ timeout: 5_000 });

    // Search for something that doesn't exist
    await page.fill('input[placeholder="Search flyers..."]', 'nonexistent-search-term-xyz');

    // No-results state should appear
    await expect(page.getByText('No flyers match your search')).toBeVisible();
    await expect(page.getByRole('button', { name: /Clear search/i })).toBeVisible();
  });

  test('edit and delete actions are accessible', async ({ page }) => {
    await page.route('**/.pas/worker/v1/users/gh:test-client-2/flyers', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([mockFlyers[0]]),
      }),
    );

    await page.route('**/.pas/worker/v1/users/gh:test-client-2/flyers/*/campaigns', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      }),
    );

    await page.goto('/app/my-flyers');

    // Wait for flyer to load
    await expect(page.getByText('Autumn Leaves')).toBeVisible({ timeout: 5_000 });

    // Find the card and verify edit/delete buttons are accessible
    const card = page.locator('text="Autumn Leaves"').locator('..');

    // Check for accessible labels on buttons
    await expect(card.getByRole('button', { name: /Edit/i })).toBeVisible();
    await expect(card.getByRole('button', { name: /Delete/i })).toBeVisible();

    // Verify campaign usage is visible
    await expect(card.getByText('campaigns')).toBeVisible();
  });
});
