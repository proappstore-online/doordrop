import { Page, BrowserContext } from '@playwright/test';

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
 * Sequence (for correct mock registration order):
 * 1. Call setupWalkerAuth() to set auth + register auth mocks
 * 2. Register any additional endpoint mocks (campaigns, etc)
 * 3. Test calls page.goto() to navigate and trigger SDK init
 *
 * This function does NOT navigate - it only sets up mocks.
 *
 * Mocks:
 * 1. Platform session cookie (via localStorage/page.evaluate)
 * 2. Worker /v1/me endpoint - returns user data with role='walker'
 * 3. FAS auth endpoint (/v1/auth/me) - fallback auth check
 * 4. Catch-all for any other auth-related endpoints the SDK might call
 */
export async function setupWalkerAuth(page: Page, context: BrowserContext) {
  // Set localStorage session and cookie (will be available when page loads)
  await page.addInitScript(
    ({ token, user }) => {
      localStorage.setItem(
        'fas:session:doordrop',
        JSON.stringify({ token, user, savedAt: Date.now() }),
      );
      // Set the session cookie via document.cookie
      document.cookie = `__Host-pas-session=${token}; Path=/; SameSite=Lax`;
    },
    { token: FAKE_TOKEN, user: FAKE_WALKER_USER },
  );

  // Register auth endpoint mocks BEFORE page navigation
  // Any additional endpoint mocks should be registered by the test AFTER this call

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

  // NOTE: Do NOT call page.goto() here.
  // Tests must call page.goto() themselves after all mocks are registered.
}
