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
 * Mocks:
 * 1. Platform session cookie (__Host-pas-session) - required for SDK's authMode: 'platform-cookie'
 * 2. Worker /v1/me endpoint - returns user data with role='walker'
 * 3. FAS auth endpoint (/v1/auth/me) - fallback auth check
 * 4. Catch-all for any other auth-related endpoints the SDK might call
 */
export async function setupWalkerAuth(page: Page, context: BrowserContext) {
  // Navigate to the base URL first so Playwright can set cookies for the domain
  // (Playwright requires navigation to a domain before setting cookies for it)
  await page.goto('/', { waitUntil: 'domcontentloaded' });

  // Set platform session cookie - this is what the SDK looks for (authMode: 'platform-cookie')
  // The SDK's useProAuth() hook checks for this cookie to determine if user is authenticated
  // __Host- prefix requires secure=true in production, but Playwright may have issues with this
  // Try with the cookie, or fall back to setting it via page script if needed
  try {
    await context.addCookies([
      {
        name: '__Host-pas-session',
        value: FAKE_TOKEN,
        url: 'http://localhost:5173',
        path: '/',
        httpOnly: true,
      },
    ]);
  } catch (e) {
    // Fallback: Set via page script if context.addCookies fails (Playwright may have strict validation)
    // This is less secure but works for testing
    await page.evaluate(({ token }) => {
      document.cookie = `__Host-pas-session=${token}; Path=/; SameSite=Lax`;
    }, { token: FAKE_TOKEN });
  }

  // Also set localStorage session as a secondary fallback (doesn't hurt, matches SDK's hydration)
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

  // Mock worker /v1/me endpoint - user profile fetch (called after cookie auth)
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
