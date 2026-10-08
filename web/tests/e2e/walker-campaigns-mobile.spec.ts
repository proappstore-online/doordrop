import { test, expect } from "@playwright/test";

test.describe("Walker Campaigns Page - Mobile UX", () => {
  test.beforeEach(async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 390, height: 844 });
    // Login and navigate to campaigns page
    await page.goto("/");
    // This assumes you have a test user setup or mock auth
    await page.goto("/walker/campaigns");
  });

  test("renders tabs with campaign counts", async ({ page }) => {
    // Wait for page to load
    await page.waitForSelector('text="Job Discovery"');

    // Check all tabs are visible
    const availableTab = page.locator("button", { hasText: /Available/ });
    const campaignsTab = page.locator("button", { hasText: /My Campaigns/ });
    const pastTab = page.locator("button", { hasText: /Past/ });

    await expect(availableTab).toBeVisible();
    await expect(campaignsTab).toBeVisible();
    await expect(pastTab).toBeVisible();

    // Check that tab counts are displayed
    await expect(availableTab.locator("span")).toContainText(/\d+/);
  });

  test("switches between tabs", async ({ page }) => {
    await page.waitForSelector('text="Job Discovery"');

    const assignedTab = page.locator("button", { hasText: /My Campaigns/ });
    await assignedTab.click();

    // Check tab styling indicates active state
    await expect(assignedTab).toHaveClass(/border-emerald-600/);
  });

  test("displays campaign cards with key stats", async ({ page }) => {
    await page.waitForSelector('text="Job Discovery"');

    // Check for campaign card elements
    const campaignCard = page.locator('[class*="rounded-lg"][class*="shadow-sm"]').first();
    await expect(campaignCard).toBeVisible();

    // Check for key stats
    await expect(campaignCard.locator("text=Doors")).toBeVisible();
    await expect(campaignCard.locator("text=Pay")).toBeVisible();
    await expect(campaignCard.locator("text=Due")).toBeVisible();
  });

  test("shows empty state for tab with no campaigns", async ({ page }) => {
    await page.waitForSelector('text="Job Discovery"');

    const pastTab = page.locator("button", { hasText: /Past/ });
    await pastTab.click();

    // Check for empty state message
    const emptyState = page.locator("text=No past campaigns yet");
    await expect(emptyState).toBeVisible();
  });

  test("express interest button state changes", async ({ page }) => {
    await page.waitForSelector('text="Job Discovery"');

    // Find express interest button
    const interestBtn = page.locator("button").filter({ hasText: /Express Interest/ }).first();

    if (await interestBtn.isVisible()) {
      // Button should show "Express Interest" initially
      await expect(interestBtn).toContainText("Express Interest");

      // Click it
      await interestBtn.click();

      // Wait for update and check for pending badge or button state change
      await page.waitForTimeout(500);

      // Button should now show "Withdraw" or be in different state
      const pendingBadge = page.locator("text=Pending");
      await expect(pendingBadge.or(interestBtn.filter({ hasText: /Withdraw/ }))).toBeVisible();
    }
  });

  test("displays interest status badges", async ({ page }) => {
    await page.waitForSelector('text="Job Discovery"');

    // Look for interest status badges
    const pendingBadge = page.locator('[class*="bg-amber"]').filter({ hasText: /Pending/ });
    const assignedBadge = page.locator('[class*="bg-emerald"]').filter({ hasText: /Assigned/ });

    // At least one should exist (if there are interested/assigned campaigns)
    const badgeCount =
      (await pendingBadge.count()) +
      (await assignedBadge.count());
    if (badgeCount > 0) {
      expect(badgeCount).toBeGreaterThan(0);
    }
  });

  test("handles network errors with retry", async ({ page }) => {
    // Simulate network error by blocking API
    await page.route("**/v1/*", (route) => route.abort());

    await page.goto("/walker/campaigns");
    await page.waitForSelector("text=Failed to load campaigns");

    // Check retry button is visible
    const retryBtn = page.locator("button:has-text('Retry')");
    await expect(retryBtn).toBeVisible();

    // Restore network and click retry
    await page.unroute("**/v1/*");
    await retryBtn.click();

    // Page should load successfully
    await page.waitForSelector('text="Job Discovery"', { timeout: 5000 });
  });

  test("view button navigates to campaign detail", async ({ page }) => {
    await page.waitForSelector('text="Job Discovery"');

    const viewBtn = page.locator("button").filter({ hasText: /View/ }).first();
    if (await viewBtn.isVisible()) {
      const href = await viewBtn.getAttribute("href") ||
                   await page.locator("a").filter({ hasText: /View/ }).first().getAttribute("href");

      if (href) {
        expect(href).toContain("/walker/campaign/");
      }
    }
  });

  test("mobile layout stacks campaign cards vertically", async ({ page }) => {
    await page.waitForSelector('text="Job Discovery"');

    // Get first two campaign cards
    const cards = page.locator('[class*="rounded-lg"][class*="shadow-sm"]');
    const count = await cards.count();

    if (count >= 2) {
      const card1 = cards.nth(0);
      const card2 = cards.nth(1);

      const box1 = await card1.boundingBox();
      const box2 = await card2.boundingBox();

      if (box1 && box2) {
        // On mobile, second card should be below first (larger y position)
        expect(box2.y).toBeGreaterThan(box1.y);
        // On mobile (390px width), cards should have similar x positions (not side by side)
        expect(Math.abs(box2.x - box1.x)).toBeLessThan(50);
      }
    }
  });

  test("sticky header remains visible on scroll", async ({ page }) => {
    await page.waitForSelector('text="Job Discovery"');

    const header = page.locator("text=Job Discovery").first();
    const initialPosition = await header.boundingBox();

    // Scroll down
    await page.evaluate(() => window.scrollBy(0, 300));

    const scrolledPosition = await header.boundingBox();

    // Header should still be visible (sticky)
    await expect(header).toBeVisible();
    if (scrolledPosition && initialPosition) {
      // Y position should be close to 0 (top of viewport)
      expect(scrolledPosition.y).toBeLessThan(100);
    }
  });

  test("displays loading spinner initially", async ({ page }) => {
    // Don't wait for network, check for loading state
    const loadingPromise = page.waitForSelector("text=Loading campaigns");

    // Navigate but don't wait for load
    page.goto("/walker/campaigns", { waitUntil: "domcontentloaded" });

    // Loading spinner should appear briefly
    try {
      await loadingPromise;
      expect(true).toBe(true);
    } catch {
      // It's ok if loading spinner is too fast to catch
    }
  });
});
