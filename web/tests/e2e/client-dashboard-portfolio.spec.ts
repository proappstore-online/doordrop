import { test, expect } from '@playwright/test';

test.describe('Client Dashboard - Campaign Portfolio (Issue #45)', () => {
  const FAKE_USER = { id: 'gh:test-client-portfolio', login: 'test-portfolio', avatarUrl: null };
  const FAKE_TOKEN = 'fake-session-token';

  const fakeClientUser = {
    id: 'gh:test-client-portfolio',
    email: 'client@example.com',
    name: 'Test Client',
    photo_url: null,
    role: 'client' as const,
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

    // Mock authentication
    await page.addInitScript(
      ({ token, user }) => {
        localStorage.setItem(
          'fas:session:doordrop',
          JSON.stringify({ token, user, savedAt: Date.now() }),
        );
      },
      { token: FAKE_TOKEN, user: FAKE_USER },
    );

    // Mock auth endpoints
    // The SDK calls /.pas/auth/me first (platform cookie auth probe)
    await page.route('**/.pas/auth/me', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(FAKE_USER),
      }),
    );

    await page.route('**/api.freeappstore.online/v1/auth/me', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(FAKE_USER),
      }),
    );

    // Mock worker user endpoint
    await page.route('**/.pas/worker/v1/me', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ user: fakeClientUser, needsRoleSelection: false }),
      }),
    );
  });

  test('shows loading state while campaigns are fetching', async ({ page }) => {
    // Don't return the campaigns request immediately
    await page.route('**/.pas/worker/v1/campaigns**', (route) => {
      // Hold the route open to simulate loading
      setTimeout(() => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([]),
        });
      }, 500);
    });

    // Navigate after all mocks are registered for this test
    await page.goto('/app');

    // Check for loading state
    const loadingSpinner = page.locator('[role="status"]');
    await expect(loadingSpinner).toBeVisible();
    await expect(loadingSpinner).toHaveAccessibleName(/loading campaigns/i);
  });

  test('shows first-time empty state for new client', async ({ page }) => {
    // Mock empty campaigns list
    await page.route('**/.pas/worker/v1/campaigns**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      }),
    );

    // Navigate after all mocks are registered for this test
    await page.goto('/app');

    // Check for first-time empty state
    await expect(page.getByText('Create your first campaign')).toBeVisible();
    await expect(page.getByText(/Choose the suburb you want to reach/)).toBeVisible();

    // Check CTA buttons are present
    const createButton = page.getByRole('link', { name: /Create a campaign/ });
    const flyerButton = page.getByRole('link', { name: /Upload a flyer first/ });
    await expect(createButton).toBeVisible();
    await expect(flyerButton).toBeVisible();
  });

  test('shows error state with retry button', async ({ page }) => {
    let callCount = 0;
    await page.route('**/.pas/worker/v1/campaigns**', (route) => {
      callCount++;
      if (callCount === 1) {
        route.abort('failed');
      } else {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([]),
        });
      }
    });

    await page.goto('/app');

    // Check for error state
    const errorAlert = page.locator('[role="alert"]');
    await expect(errorAlert).toBeVisible();
    await expect(page.getByText(/Unable to load campaigns/)).toBeVisible();

    // Check retry button
    const retryButton = page.getByRole('button', { name: /Try again/ });
    await expect(retryButton).toBeVisible();

    // Click retry
    await retryButton.click();

    // After retry, should show empty state
    await expect(page.getByText('Create your first campaign')).toBeVisible({ timeout: 5000 });
  });

  test('renders active and draft sections in correct order', async ({ page }) => {
    const now = new Date();
    const mockCampaigns = [
      {
        id: 'camp-active',
        name: 'Active Campaign',
        status: 'assigned' as const,
        suburb: 'sydney',
        postcode: '2000',
        total_doors: 150,
        budget: 1000,
        due_date: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).getTime(), // Future date
        admin_ids: ['gh:test-client-portfolio'],
        plan_type: 'roster' as const,
        created_at: now.getTime(),
        updated_at: new Date(now.getTime() - 1 * 60 * 60 * 1000).getTime(),
        active_printout_id: 'flyer-1',
        assigned_walker_id: 'walker-1',
      },
      {
        id: 'camp-draft',
        name: 'Draft Campaign',
        status: 'draft' as const,
        suburb: 'melbourne',
        postcode: '3000',
        total_doors: 200,
        budget: 1500,
        admin_ids: ['gh:test-client-portfolio'],
        plan_type: 'roster' as const,
        created_at: now.getTime(),
        lat: -37.8136,
        lng: 144.9631,
        active_printout_id: 'flyer-2',
      },
    ];

    await page.route('**/.pas/worker/v1/campaigns**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockCampaigns),
      }),
    );

    await page.goto('/app');

    // Check section headings exist using heading role for semantic accuracy
    await expect(page.getByRole('heading', { name: 'Active campaigns' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Draft campaigns' })).toBeVisible();

    // Verify order: Active should appear before Draft
    const activeHeading = page.getByRole('heading', { name: 'Active campaigns' });
    const draftHeading = page.getByRole('heading', { name: 'Draft campaigns' });
    const activeBoundingBox = await activeHeading.boundingBox();
    const draftBoundingBox = await draftHeading.boundingBox();

    if (activeBoundingBox && draftBoundingBox) {
      expect(activeBoundingBox.y).toBeLessThan(draftBoundingBox.y);
    }
  });

  test('shows attention badge for draft campaign without flyer', async ({ page }) => {
    const now = new Date();
    const mockCampaigns = [
      {
        id: 'camp-no-flyer',
        name: 'Campaign Without Flyer',
        status: 'draft' as const,
        suburb: 'sydney',
        postcode: '2000',
        admin_ids: ['gh:test-client-portfolio'],
        plan_type: 'roster' as const,
        created_at: now.getTime(),
        lat: -33.8688,
        lng: 151.2093,
        // activePrintoutId is missing
      },
    ];

    await page.route('**/.pas/worker/v1/campaigns**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockCampaigns),
      }),
    );

    await page.goto('/app');

    // Check for attention badge
    const attentionBadge = page.locator('[role="status"]').filter({
      has: page.locator('text=/Attention needed|No flyer/'),
    });
    await expect(attentionBadge).toBeVisible();
  });

  test('shows attention badge for past-due campaign', async ({ page }) => {
    const now = new Date();
    const pastDate = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000); // Yesterday

    const mockCampaigns = [
      {
        id: 'camp-past-due',
        name: 'Past Due Campaign',
        status: 'ready' as const,
        suburb: 'sydney',
        postcode: '2000',
        admin_ids: ['gh:test-client-portfolio'],
        plan_type: 'roster' as const,
        created_at: now.getTime(),
        due_date: pastDate.getTime(),
        active_printout_id: 'flyer-1',
      },
    ];

    await page.route('**/.pas/worker/v1/campaigns**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockCampaigns),
      }),
    );

    await page.goto('/app');

    // Check for attention badge indicating past due
    const attentionBadge = page.locator('[role="status"]').filter({
      has: page.locator('text=/Attention needed|Past due/'),
    });
    await expect(attentionBadge).toBeVisible();
  });

  test('campaign cards are keyboard navigable', async ({ page }) => {
    const now = new Date();
    const mockCampaigns = [
      {
        id: 'camp-1',
        name: 'Campaign One',
        status: 'draft' as const,
        suburb: 'sydney',
        postcode: '2000',
        admin_ids: ['gh:test-client-portfolio'],
        plan_type: 'roster' as const,
        created_at: now.getTime(),
        lat: -33.8688,
        lng: 151.2093,
        active_printout_id: 'flyer-1',
      },
    ];

    await page.route('**/.pas/worker/v1/campaigns**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockCampaigns),
      }),
    );

    await page.goto('/app');

    // Wait for campaigns to load
    await expect(page.getByText('Campaign One')).toBeVisible();

    // Tab through the page (TopBar nav, then to campaign card)
    // Continue tabbing until we reach the campaign card link
    for (let i = 0; i < 20; i++) {
      await page.keyboard.press('Tab');
      const focusedHref = await page.evaluate(() => {
        const elem = document.activeElement as HTMLAnchorElement;
        return elem?.href || '';
      });
      if (focusedHref.includes('/app/campaign/camp-1')) {
        break;
      }
    }

    // Verify focus is on the campaign link
    const focusedHref = await page.evaluate(() => (document.activeElement as HTMLAnchorElement)?.href);
    expect(focusedHref).toContain('/app/campaign/camp-1');

    // Press Enter to navigate
    await page.keyboard.press('Enter');

    // Should navigate to campaign detail
    await expect(page).toHaveURL(/\/app\/campaign\/camp-1$/);
  });

  test('campaign cards have proper accessibility labels', async ({ page }) => {
    const now = new Date();
    const mockCampaigns = [
      {
        id: 'camp-a11y',
        name: 'Accessible Campaign',
        status: 'assigned' as const,
        suburb: 'sydney',
        postcode: '2000',
        admin_ids: ['gh:test-client-portfolio'],
        plan_type: 'roster' as const,
        created_at: now.getTime(),
        active_printout_id: 'flyer-1',
        assigned_walker_id: 'walker-1',
      },
    ];

    await page.route('**/.pas/worker/v1/campaigns**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockCampaigns),
      }),
    );

    await page.goto('/app');

    // Check campaign card has accessible label
    const card = page.locator('[role="article"]');
    const ariaLabel = await card.getAttribute('aria-label');
    expect(ariaLabel).toContain('Accessible Campaign');
    expect(ariaLabel).toContain('assigned');
    expect(ariaLabel).toContain('sydney');
  });

  test('responsive grid layout on mobile, tablet, desktop', async ({ page }) => {
    const now = new Date();
    const mockCampaigns = Array.from({ length: 6 }, (_, i) => ({
      id: `camp-${i}`,
      name: `Campaign ${i + 1}`,
      status: 'draft' as const,
      suburb: 'sydney',
      postcode: '2000',
      admin_ids: ['gh:test-client-portfolio'],
      plan_type: 'roster' as const,
      created_at: now.getTime(),
      lat: -33.8688,
      lng: 151.2093,
      active_printout_id: 'flyer-1',
    }));

    await page.route('**/.pas/worker/v1/campaigns**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockCampaigns),
      }),
    );

    // Test mobile view (single column)
    await page.setViewportSize({ width: 320, height: 640 });
    await page.goto('/app');
    await expect(page.getByText('Campaign 1')).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText('Campaign 2')).toBeVisible();

    // Verify grid layout: mobile defaults to single column
    const mobileSection = page.locator('section').filter({ has: page.getByText('Campaign 1') }).first();
    const mobileGrid = mobileSection.locator('.grid').first();
    await expect(mobileGrid).toBeVisible();

    // Check computed grid-template-columns on mobile (should be single column)
    const mobileGridStyles = await mobileGrid.evaluate((el) => {
      const styles = window.getComputedStyle(el);
      return styles.gridTemplateColumns;
    });
    expect(mobileGridStyles).toMatch(/^\d+(\.\d+)?px$/); // Single column = one value

    // Verify cards don't overflow at mobile width
    const mobileCards = mobileSection.locator('[role="article"]');
    const mobileCardCount = await mobileCards.count();
    expect(mobileCardCount).toBeGreaterThan(0);
    const firstMobileCard = await mobileCards.first().boundingBox();
    if (firstMobileCard) {
      expect(firstMobileCard.right).toBeLessThanOrEqual(320); // No horizontal overflow
    }

    // Test tablet view (should show 2 columns via md:grid-cols-2)
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.waitForLoadState('networkidle');
    await expect(page.getByText('Campaign 1')).toBeVisible({ timeout: 5_000 });

    const tabletSection = page.locator('section').filter({ has: page.getByText('Campaign 1') }).first();
    const tabletGrid = tabletSection.locator('.grid').first();

    // Check computed grid-template-columns at tablet width (md breakpoint = 768px)
    const tabletGridStyles = await tabletGrid.evaluate((el) => {
      const styles = window.getComputedStyle(el);
      return styles.gridTemplateColumns;
    });
    // Should have 2 columns at tablet width
    const tabletColumns = tabletGridStyles.split(' ').length;
    expect(tabletColumns).toBe(2);

    // Test desktop view (should show 3 columns via xl:grid-cols-3)
    await page.setViewportSize({ width: 1400, height: 900 });
    await page.waitForLoadState('networkidle');
    await expect(page.getByText('Campaign 1')).toBeVisible({ timeout: 5_000 });

    const desktopSection = page.locator('section').filter({ has: page.getByText('Campaign 1') }).first();
    const desktopGrid = desktopSection.locator('.grid').first();

    // Check computed grid-template-columns at desktop width (xl breakpoint = 1280px)
    const desktopGridStyles = await desktopGrid.evaluate((el) => {
      const styles = window.getComputedStyle(el);
      return styles.gridTemplateColumns;
    });
    // Should have 3 columns at desktop width
    const desktopColumns = desktopGridStyles.split(' ').length;
    expect(desktopColumns).toBe(3);
  });

  test('main actions are prominent and accessible', async ({ page }) => {
    await page.route('**/.pas/worker/v1/campaigns**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      }),
    );

    await page.goto('/app');

    // Check primary CTAs are visible and accessible
    const newCampaignButton = page.getByRole('link', { name: /\+ New campaign/ });
    const manageFlyersButton = page.getByRole('link', { name: /Manage flyers/ });

    await expect(newCampaignButton).toBeVisible();
    await expect(manageFlyersButton).toBeVisible();

    // Check they're keyboard accessible
    await newCampaignButton.focus();
    const focusedHref = await newCampaignButton.getAttribute('href');
    expect(focusedHref).toBe('/app/setup');
  });

  test('shows walker status on active campaigns with assigned walker', async ({ page }) => {
    const now = new Date();
    const mockCampaigns = [
      {
        id: 'camp-walker-assigned',
        name: 'Campaign with Walker',
        status: 'assigned' as const,
        suburb: 'sydney',
        postcode: '2000',
        admin_ids: ['gh:test-client-portfolio'],
        plan_type: 'roster' as const,
        created_at: now.getTime(),
        active_printout_id: 'flyer-1',
        assigned_walker_id: 'walker-john-123',
      },
    ];

    await page.route('**/.pas/worker/v1/campaigns**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockCampaigns),
      }),
    );

    await page.goto('/app');

    // Check walker status is visible
    await expect(page.getByText(/✓ Walker assigned/)).toBeVisible();
  });

  test('shows walker lookup status on ready campaigns without assigned walker', async ({ page }) => {
    const now = new Date();
    const mockCampaigns = [
      {
        id: 'camp-walker-needed',
        name: 'Campaign Needing Walker',
        status: 'ready' as const,
        suburb: 'sydney',
        postcode: '2000',
        admin_ids: ['gh:test-client-portfolio'],
        plan_type: 'roster' as const,
        created_at: now.getTime(),
        active_printout_id: 'flyer-1',
        // assigned_walker_id intentionally omitted
      },
    ];

    await page.route('**/.pas/worker/v1/campaigns**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockCampaigns),
      }),
    );

    await page.goto('/app');

    // Check walker lookup message is visible
    await expect(page.getByText(/Looking for walker/)).toBeVisible();
  });

  test('does not show walker status on draft campaigns', async ({ page }) => {
    const now = new Date();
    const mockCampaigns = [
      {
        id: 'camp-draft-no-walker',
        name: 'Draft Campaign',
        status: 'draft' as const,
        suburb: 'sydney',
        postcode: '2000',
        admin_ids: ['gh:test-client-portfolio'],
        plan_type: 'roster' as const,
        created_at: now.getTime(),
        lat: -33.8688,
        lng: 151.2093,
        active_printout_id: 'flyer-1',
      },
    ];

    await page.route('**/.pas/worker/v1/campaigns**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockCampaigns),
      }),
    );

    await page.goto('/app');

    // Walker status should NOT appear on draft campaigns
    const walkerText = page.getByText(/Walker assigned|Looking for walker/);
    await expect(walkerText).not.toBeVisible();
  });
});
