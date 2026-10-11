import { Page } from '@playwright/test';

export const FAKE_WALKER_USER = {
  id: 'gh:test-walker-auth',
  login: 'test-walker',
  avatarUrl: null,
};

export const FAKE_WALKER_USER_DATA = {
  id: 'gh:test-walker-auth',
  email: 'walker@example.com',
  name: 'Test Walker',
  photo_url: null,
  role: 'walker' as const,
  created_at: 1_700_000_000_000,
};

const FAKE_TOKEN = 'fake-session-token';

/**
 * Set up walker authentication mocks for E2E tests.
 * This enables tests to navigate to /walker/* routes without PrivateRoute redirecting to /login.
 *
 * Mocks:
 * 1. localStorage session (fas:session:doordrop) - SDK may check this during init
 * 2. FAS auth endpoint (/v1/auth/me) - returns fake walker user
 * 3. Worker /v1/me endpoint - returns user data with role='walker'
 * 4. Catch-all for any auth-related endpoints the SDK might call
 */
export async function setupWalkerAuth(page: Page) {
  // Mock localStorage session - SDK may hydrate from this
  await page.addInitScript(
    ({ token, user }) => {
      localStorage.setItem(
        'fas:session:doordrop',
        JSON.stringify({ token, user, savedAt: Date.now() }),
      );
    },
    { token: FAKE_TOKEN, user: FAKE_WALKER_USER },
  );

  // Mock FAS auth endpoint - primary auth check
  await page.route('**/api.freeappstore.online/v1/auth/me', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(FAKE_WALKER_USER),
    }),
  );

  // Mock worker /v1/me endpoint - user profile fetch
  await page.route('**/.pas/worker/v1/me', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ user: FAKE_WALKER_USER_DATA, needsRoleSelection: false }),
    }),
  );

  // Catch-all for any other auth endpoint calls
  await page.route('**/.pas/auth/**', (route) => {
    // Pass through unless it's a me endpoint
    if (route.request().url().includes('/me')) {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(FAKE_WALKER_USER),
      });
    } else {
      route.continue();
    }
  });
}
