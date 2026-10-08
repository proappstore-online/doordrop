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

// Role selection routing: new accounts see the form, existing accounts are redirected away
test.describe('Role selection routing', () => {
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

  test('new account sees role selection form and can submit', async ({ page }) => {
    await page.route('**/v1/me', (route) =>
      route.fulfill({
        status: 200,
        body: JSON.stringify({
          user: null,
          needsRoleSelection: true,
        }),
      }),
    );
    await page.route('**/v1/me/role', (route) =>
      route.fulfill({ status: 200, body: '{"ok":true}' }),
    );

    await page.goto('/select-role');

    // Should see role selection buttons
    await expect(page.getByRole('button', { name: /I'm a client/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /I'm a walker/i })).toBeVisible();

    // Should not be disabled
    await expect(page.getByRole('button', { name: /I'm a client/i })).toBeEnabled();

    // Submit as client
    await page.getByRole('button', { name: /I'm a client/i }).click();

    // Should redirect to /app
    await expect(page).toHaveURL('/app');
  });

  test('existing client account redirected away from /select-role', async ({ page }) => {
    await page.route('**/v1/me', (route) =>
      route.fulfill({
        status: 200,
        body: JSON.stringify({
          user: { id: 'user1', role: 'client', name: 'Test Client' },
          needsRoleSelection: false,
        }),
      }),
    );

    await page.goto('/select-role');

    // Should redirect to /app
    await expect(page).toHaveURL('/app');
  });

  test('existing walker account redirected away from /select-role', async ({ page }) => {
    await page.route('**/v1/me', (route) =>
      route.fulfill({
        status: 200,
        body: JSON.stringify({
          user: { id: 'user2', role: 'walker', name: 'Test Walker' },
          needsRoleSelection: false,
        }),
      }),
    );

    await page.goto('/select-role');

    // Should redirect to /walker
    await expect(page).toHaveURL('/walker');
  });

  test('existing admin account redirected away from /select-role', async ({ page }) => {
    await page.route('**/v1/me', (route) =>
      route.fulfill({
        status: 200,
        body: JSON.stringify({
          user: { id: 'admin1', role: 'admin', name: 'Test Admin' },
          needsRoleSelection: false,
        }),
      }),
    );

    await page.goto('/select-role');

    // Should redirect to /admin
    await expect(page).toHaveURL('/admin');
  });

  test('role selection failure shows recoverable error', async ({ page }) => {
    await page.route('**/v1/me', (route) =>
      route.fulfill({
        status: 200,
        body: JSON.stringify({
          user: null,
          needsRoleSelection: true,
        }),
      }),
    );
    await page.route('**/v1/me/role', (route) =>
      route.fulfill({
        status: 409,
        body: '{"error":"user already has a role"}',
      }),
    );

    await page.goto('/select-role');

    // Submit as walker
    await page.getByRole('button', { name: /I'm a walker/i }).click();

    // Should show error message
    await expect(page.getByText(/Failed to set role:/i)).toBeVisible();
    await expect(page.getByText(/user already has a role/i)).toBeVisible();

    // Should show dismiss button
    await expect(page.getByRole('button', { name: /Dismiss/i })).toBeVisible();

    // Dismiss button should hide the error
    await page.getByRole('button', { name: /Dismiss/i }).click();
    await expect(page.getByText(/Failed to set role:/i)).not.toBeVisible();
  });

  test('role selection buttons disabled while submitting', async ({ page }) => {
    await page.route('**/v1/me', (route) =>
      route.fulfill({
        status: 200,
        body: JSON.stringify({
          user: null,
          needsRoleSelection: true,
        }),
      }),
    );
    await page.route('**/v1/me/role', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 500));
      return route.fulfill({ status: 200, body: '{"ok":true}' });
    });

    await page.goto('/select-role');

    // Submit as client
    const submitButton = page.getByRole('button', { name: /I'm a client/i });
    await submitButton.click();

    // Both buttons should be disabled while submitting
    await expect(page.getByRole('button', { name: /I'm a client/i })).toBeDisabled();
    await expect(page.getByRole('button', { name: /I'm a walker/i })).toBeDisabled();
  });
});
