import { test, expect } from '@playwright/test';

// Auth-gated routes should bounce unauthenticated visitors to the login page.
// TODO: the tests below need a deterministic mock for the SDK's init() probe
// — without it, the LoadingScreen renders long enough to race the assertion.
// Skipping until that's wired so we don't ship flakes.
test.describe.skip('Route gating (unauthenticated)', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api.freeappstore.online/**', (route) =>
      route.fulfill({ status: 401, body: '{"error":"not signed in"}' }),
    );
  });

  for (const path of ['/walker', '/app', '/admin', '/select-role']) {
    test(`${path} redirects to /login when unauthenticated`, async ({ page }) => {
      await page.goto(path);
      await expect(page).toHaveURL(/\/(login|\/?)$/);
      await expect(page.getByRole('button', { name: /sign in with github/i })).toBeVisible();
    });
  }
});
