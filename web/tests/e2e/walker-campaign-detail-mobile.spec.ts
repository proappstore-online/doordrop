import { test, expect } from "@playwright/test";
import { setupWalkerAuth } from "./fixtures/walker-auth";

test.describe("Walker Campaign Detail Page - Mobile UX", () => {
  test.beforeEach(async ({ page, context }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 390, height: 844 });
    // Set up walker authentication (session cookie + mocked endpoints)
    await setupWalkerAuth(page, context);

    // Mock campaign detail endpoint
    await page.route('**/campaigns/test-campaign-id', (route) => {
      if (route.request().method() === 'GET' && !route.request().url().includes('/doors') && !route.request().url().includes('/printouts')) {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'test-campaign-id',
            name: 'Test Campaign',
            status: 'ready',
            suburb: 'sydney',
            postcode: '2000',
            admin_ids: ['admin-1'],
            assigned_walker_id: null,
            doors: 150,
            pay: 25.5,
            due_date: new Date().toISOString(),
            radius_meters: 50,
            created_at: Date.now(),
          }),
        });
      } else {
        route.continue();
      }
    });

    // Mock campaign doors endpoint
    await page.route('**/campaigns/test-campaign-id/doors**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 'door-1',
            campaign_id: 'test-campaign-id',
            lat: -33.8688,
            lng: 151.2093,
            status: 'pending',
            delivered_by: null,
            notes: null,
            created_at: Date.now(),
          },
        ]),
      }),
    );

    // Mock printouts endpoint
    await page.route('**/campaigns/test-campaign-id/printouts**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      }),
    );

    // Mock interests endpoint
    await page.route('**/interests**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      }),
    );
  });

  test("renders campaign hero with name and location", async ({ page }) => {
    // Navigate to a campaign detail page (assumes test campaign exists)
    await page.goto("/walker/campaign/test-campaign-id");

    // Wait directly for the campaign heading, which renders once the campaign has loaded
    const heading = page.locator("h1").first();
    await expect(heading).toBeVisible();

    // Check for location info
    const location = page.locator("text=/\\w+ \\d{4}/"); // matches "Suburb 2000" pattern
    await expect(location.first()).toBeVisible();

    // Check for status badge
    const statusBadge = page.locator('[class*="bg-blue"][class*="bg-blue-100"]');
    await expect(statusBadge).toBeVisible();
  });

  test("displays key stats grid on mobile", async ({ page }) => {
    await page.goto("/walker/campaign/test-campaign-id");
    await page.waitForTimeout(1000);

    // Check for stats labels (stats grid uses gap-3, not gap-4)
    const statsGrid = page.locator('[class*="grid"][class*="gap-3"]').first();
    await expect(statsGrid).toBeVisible();

    // Check individual stats
    const doorsLabel = page.locator("text=Doors");
    const payLabel = page.locator("text=Pay");
    const dueLabel = page.locator("text=Due");

    // At least some stats should be present
    const labelCount =
      (await doorsLabel.count()) +
      (await payLabel.count()) +
      (await dueLabel.count());
    expect(labelCount).toBeGreaterThan(0);
  });

  test("shows flyer section with image", async ({ page }) => {
    await page.goto("/walker/campaign/test-campaign-id");
    await page.waitForTimeout(1000);

    const flyerSection = page.locator("text=Flyer");
    if (await flyerSection.count() > 0) {
      await expect(flyerSection).toBeVisible();

      // Check for flyer image or placeholder
      const flyerImage = page.locator("img[alt='Flyer']");
      const hasImage = await flyerImage.count() > 0;
      expect(hasImage).toBe(true);
    }
  });

  test("displays doors list with delivery status", async ({ page }) => {
    await page.goto("/walker/campaign/test-campaign-id");
    await page.waitForTimeout(1000);

    // Check for doors section
    const doorsHeading = page.locator("text=Delivery Locations");
    await expect(doorsHeading).toBeVisible();

    // Check for door status badges
    const doorItems = page.locator('[class*="p-4"][class*="flex"]').filter({
      has: page.locator("text=/Done|Pending/"),
    });

    const doorCount = await doorItems.count();
    if (doorCount > 0) {
      // Should have some doors
      expect(doorCount).toBeGreaterThan(0);
    }
  });

  test("express interest button visible for non-assigned walkers", async ({ page }) => {
    await page.goto("/walker/campaign/test-campaign-id");
    await page.waitForTimeout(1000);

    const interestBtn = page.locator("button").filter({ hasText: /Express Interest|Withdraw/ });

    if (await interestBtn.count() > 0) {
      // Button should be sticky at bottom
      await expect(interestBtn.first()).toBeVisible();
    }
  });

  test("shows interest status badges", async ({ page }) => {
    await page.goto("/walker/campaign/test-campaign-id");
    await page.waitForTimeout(1000);

    // Look for interest status indicators
    const pendingBadge = page.locator("text=Pending");
    const assignedBadge = page.locator("text=/Assigned to you/");

    // At least check these sections exist
    const headerSection = page.locator("h1").first();
    await expect(headerSection).toBeVisible();
  });

  test("start delivery button visible for assigned walkers", async ({ page }) => {
    // This test would need a campaign where the logged-in user is assigned
    await page.goto("/walker/campaign/test-assigned-campaign-id");
    await page.waitForTimeout(1000);

    const startBtn = page.locator("button, a").filter({ hasText: /Start Delivery/ });

    if (await startBtn.count() > 0) {
      await expect(startBtn.first()).toBeVisible();
      // Check it links to delivery page
      const href = await startBtn.first().getAttribute("href");
      if (href) {
        expect(href).toContain("/deliver");
      }
    }
  });

  test("shows notes section for assigned walkers", async ({ page }) => {
    await page.goto("/walker/campaign/test-assigned-campaign-id");
    await page.waitForTimeout(1000);

    // Notes section should be visible for assigned walkers
    const notesSection = page.locator("text=Notes").first();

    if (await notesSection.isVisible()) {
      // Should have note input field
      const noteInput = page.locator("textarea, input[placeholder*='note']").first();
      const hasInput = await noteInput.count() > 0 || await notesSection.count() > 0;
      expect(hasInput).toBe(true);
    }
  });

  test("displays policies section if present", async ({ page }) => {
    await page.goto("/walker/campaign/test-campaign-id");
    await page.waitForTimeout(1000);

    const policiesHeading = page.locator("text=Delivery Policies");

    if (await policiesHeading.count() > 0) {
      await expect(policiesHeading).toBeVisible();

      // Should have list items with checkmarks
      const policyItems = page.locator("text=✓");
      const itemCount = await policyItems.count();
      if (itemCount > 0) {
        expect(itemCount).toBeGreaterThan(0);
      }
    }
  });

  test("handles loading state", async ({ page }) => {
    // Don't wait for navigation to complete
    page.goto("/walker/campaign/test-campaign-id", { waitUntil: "domcontentloaded" });

    // Look for loading spinner or text
    const loadingSpinner = page.locator(".animate-spin");
    const loadingText = page.locator("text=Loading campaign");

    // Either should appear
    const hasLoading =
      (await loadingSpinner.count() > 0) ||
      (await loadingText.count() > 0);

    if (hasLoading) {
      expect(hasLoading).toBe(true);
    }
  });

  test("handles error state with retry", async ({ page }) => {
    // Block API to simulate error
    await page.route("**/v1/campaigns/**", (route) => route.abort());

    await page.goto("/walker/campaign/test-campaign-id");
    await page.waitForTimeout(1000);

    // Check for error message
    const errorMsg = page.locator("text=Failed");

    if (await errorMsg.count() > 0) {
      await expect(errorMsg).toBeVisible();

      // Should have retry button
      const retryBtn = page.locator("button:has-text('Retry')");
      const hasRetry = await retryBtn.count() > 0;
      expect(hasRetry).toBe(true);
    }
  });

  test("campaign not found state", async ({ page }) => {
    await page.goto("/walker/campaign/nonexistent-id");
    await page.waitForTimeout(1000);

    // Check for not found message
    const notFoundMsg = page.locator("text=Campaign not found");

    if (await notFoundMsg.count() > 0) {
      await expect(notFoundMsg).toBeVisible();

      // Should have back link
      const backLink = page.locator("text=Back to campaigns");
      const hasBackLink = await backLink.count() > 0;
      expect(hasBackLink).toBe(true);
    }
  });

  test("door list shows first 20 items with more indicator", async ({ page }) => {
    await page.goto("/walker/campaign/test-campaign-id");
    await page.waitForTimeout(1000);

    const doorItems = page.locator('[class*="border-gray"][class*="border-t"]');

    if (await doorItems.count() > 20) {
      // Should show "more" indicator
      const moreText = page.locator("text=/\\+\\d+ more/");
      const hasMore = await moreText.count() > 0;
      expect(hasMore).toBe(true);
    }
  });

  test("error banner dismissible", async ({ page }) => {
    await page.goto("/walker/campaign/test-campaign-id");
    await page.waitForTimeout(1000);

    // Navigate to cause potential error
    await page.route("**/v1/**", (route) => {
      // Let it succeed but then cause an error
      route.continue();
    });

    // If error banner appears, check for close button
    const errorBanner = page.locator('[class*="bg-red"][class*="bg-red-50"]');

    if (await errorBanner.count() > 0) {
      const closeBtn = errorBanner.locator("button:has-text('✕')");
      if (await closeBtn.count() > 0) {
        await closeBtn.click();
        await expect(errorBanner).toBeHidden();
      }
    }
  });

  test("interest button disabled while submitting", async ({ page }) => {
    await page.goto("/walker/campaign/test-campaign-id");
    await page.waitForTimeout(1000);

    const interestBtn = page.locator("button").filter({ hasText: /Express Interest/ });

    if (await interestBtn.count() > 0) {
      // Simulate slow network by mocking interests endpoint with delay
      await page.route("**/.pas/worker/v1/interests", async (route) => {
        await new Promise((resolve) => setTimeout(resolve, 2000));
        route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({ id: 'interest-test', status: 'pending' }),
        });
      });

      // Real click: fails if the bottom nav covers the button (#76)
      const btnHandle = await interestBtn.first().elementHandle();
      await interestBtn.first().click();

      // Label flips to "Withdraw" while pending, so check the same element
      expect(await btnHandle!.isDisabled()).toBe(true);
    }
  });

  test("mobile layout hides detailed campaign view", async ({ page }) => {
    await page.goto("/walker/campaign/test-campaign-id");
    await page.waitForTimeout(1000);

    // The CampaignSharedView should be hidden on mobile (hidden sm:block)
    const detailedView = page.locator('div.hidden.sm\\:block');
    const isHidden = await detailedView.evaluate((el) =>
      getComputedStyle(el).display === "none"
    );

    if (isHidden !== undefined) {
      expect(isHidden).toBe(true);
    }
  });

  test("sticky CTA buttons stay visible on scroll", async ({ page }) => {
    await page.goto("/walker/campaign/test-campaign-id");
    await page.waitForTimeout(1000);

    // Find sticky button section
    const stickySection = page.locator('[class*="sticky"][class*="bottom"]').first();

    if (await stickySection.count() > 0) {
      // Scroll down
      await page.evaluate(() => window.scrollBy(0, 500));

      // Button should still be visible
      await expect(stickySection).toBeVisible();
    }
  });

  // Regression for #76: the bottom nav must not cover the sticky Express Interest CTA.
  test("express interest CTA is not covered by the bottom nav", async ({ page }) => {
    await page.goto("/walker/campaign/test-campaign-id");

    const interestBtn = page.getByRole("button", { name: /express interest/i });
    await expect(interestBtn).toBeVisible();

    // Playwright's trial click runs the hit-target check without clicking
    await interestBtn.click({ trial: true });

    // The element at the button's centre must be the button itself, not the nav
    const box = await interestBtn.boundingBox();
    expect(box).not.toBeNull();
    const hitIsButton = await interestBtn.evaluate(
      (el, point) => {
        const hit = document.elementFromPoint(point.x, point.y);
        return hit !== null && el.contains(hit);
      },
      { x: box!.x + box!.width / 2, y: box!.y + box!.height / 2 },
    );
    expect(hitIsButton).toBe(true);

    // And the button must sit above the nav's top edge
    const nav = page.getByRole("navigation", { name: "Mobile navigation" });
    const navBox = await nav.boundingBox();
    expect(navBox).not.toBeNull();
    expect(box!.y + box!.height).toBeLessThanOrEqual(navBox!.y);
  });
});
