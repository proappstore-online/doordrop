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

// Profile load errors should show recovery UI and block access to protected routes
test.describe('Route gating (profile load errors)', () => {
  test.beforeEach(async ({ page, context }) => {
    // Mock authentication to succeed
    await context.addCookies([
      {
        name: '__Host-pas-session',
        value: 'mock-session-token',
        domain: 'localhost',
        path: '/',
        secure: false,
        httpOnly: true,
      },
    ]);
  });

  test('client role route shows profile error on /v1/me failure', async ({ page }) => {
    await page.route('**/v1/me', (route) =>
      route.fulfill({ status: 500, body: '{"error":"server error"}' }),
    );
    await page.goto('/app');

    await expect(page.getByText(/Could Not Load Profile/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /Try Again/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Sign Out/i })).toBeVisible();
  });

  test('walker role route shows profile error on /v1/me timeout', async ({ page }) => {
    await page.route('**/v1/me', (route) => {
      route.abort('timedout');
    });
    await page.goto('/walker');

    await expect(page.getByText(/Could Not Load Profile/i)).toBeVisible();
    await expect(page.getByText(/connection took too long/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /Try Again/i })).toBeVisible();
  });

  test('admin role route shows profile error on /v1/me failure', async ({ page }) => {
    await page.route('**/v1/me', (route) =>
      route.fulfill({ status: 503, body: '{"error":"service unavailable"}' }),
    );
    await page.goto('/admin');

    await expect(page.getByText(/Could Not Load Profile/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /Try Again/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Sign Out/i })).toBeVisible();
  });

  test('unprotected route also blocks rendering on profile load error', async ({ page }) => {
    await page.route('**/v1/me', (route) =>
      route.fulfill({ status: 500, body: '{"error":"server error"}' }),
    );
    await page.goto('/walker/123');

    // Even public walker profile route should show error, not the profile
    await expect(page.getByText(/Could Not Load Profile/i)).toBeVisible();
  });

  test('retry button retries profile load', async ({ page }) => {
    let failureCount = 0;

    await page.route('**/v1/me', (route) => {
      if (failureCount < 1) {
        failureCount++;
        return route.fulfill({ status: 500, body: '{"error":"server error"}' });
      }
      return route.fulfill({
        status: 200,
        body: JSON.stringify({
          user: { id: 'user1', role: 'client', name: 'Test User' },
          needsRoleSelection: false,
        }),
      });
    });

    await page.goto('/app');

    await expect(page.getByText(/Could Not Load Profile/i)).toBeVisible();

    await page.getByRole('button', { name: /Try Again/i }).click();

    // After retry, should load successfully
    await expect(page.getByText(/Could Not Load Profile/i)).not.toBeVisible();
  });
});
