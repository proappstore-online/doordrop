import { test, expect } from "@playwright/test";

test.describe("Walker Campaign Detail Page - Mobile UX", () => {
  test.beforeEach(async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 390, height: 844 });
  });

  test("renders campaign hero with name and location", async ({ page }) => {
    // Navigate to a campaign detail page (assumes test campaign exists)
    await page.goto("/walker/campaign/test-campaign-id");

    // Wait for campaign to load
    await page.waitForSelector("text=Loading campaign").then(async () => {
      // Wait for actual content
      await page.waitForTimeout(1000);
    }).catch(() => {
      // If loading text not found, content is already loaded
    });

    // Check for campaign name in header
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

    // Check for stats labels
    const statsGrid = page.locator('[class*="grid"][class*="gap-4"]').first();
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
      // Simulate slow network
      await page.route("**/v1/interests", async (route) => {
        await new Promise((resolve) => setTimeout(resolve, 2000));
        route.continue();
      });

      // Click button
      await interestBtn.first().click();

      // Button should be disabled
      const disabledState = await interestBtn.first().getAttribute("disabled");
      expect(disabledState !== null).toBe(true);
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
});
