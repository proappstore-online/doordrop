import { test, expect } from '@playwright/test';

// Regression for #82 / #75: the campaign location step used to re-run geocoding on
// every form state change (83 Nominatim requests in ~4s for a single address).
// Entering two distinct addresses should cost exactly two Nominatim requests.
test.describe('Campaign location step geocoding (#82)', () => {
  const FAKE_USER = { id: 'gh:test-geocode', login: 'test-geocode', avatarUrl: null };
  const FAKE_TOKEN = 'fake-session-token';

  const fakeClientUser = {
    id: 'gh:test-geocode',
    email: 'geocode@example.com',
    name: 'Geocode Test Client',
    photo_url: null,
    role: 'client',
    created_at: 1_700_000_000_000,
    clientProfile: {
      onboardingCompleted: true,
    },
  };

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(
      ({ token, user }) => {
        localStorage.setItem(
          'fas:session:doordrop',
          JSON.stringify({ token, user, savedAt: Date.now() }),
        );
      },
      { token: FAKE_TOKEN, user: FAKE_USER },
    );

    await page.route('**/.pas/auth/me', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(FAKE_USER) }),
    );

    await page.route('**/.pas/worker/v1/me', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ user: fakeClientUser, needsRoleSelection: false }),
      }),
    );

    await page.route('**/.pas/worker/v1/users/*/flyers', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) }),
    );
  });

  test('entering two distinct addresses makes one Nominatim request per address', async ({ page }) => {
    let nominatimRequests = 0;
    await page.route('**/nominatim.openstreetmap.org/**', (route) => {
      nominatimRequests++;
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([{ lat: '-33.8150', lon: '151.0010' }]),
      });
    });

    await page.goto('/app/setup');
    await expect(page.getByRole('heading', { name: 'Create a Campaign' })).toBeVisible();

    // Address 1: NSW / Parramatta / 2150
    await page.locator('[class*="-control"]').first().click();
    await page.getByRole('option', { name: 'New South Wales' }).click();
    await page.fill('#suburb', 'Parramatta');
    await page.fill('#postcode', '2150');

    await expect.poll(() => nominatimRequests, { timeout: 10_000 }).toBe(1);

    // Let any debounced or looping requests land before asserting the count. Without this,
    // a regressed loop could still be catching up when the assertion runs.
    await page.waitForTimeout(2_000);
    expect(nominatimRequests).toBe(1);

    // Address 2: change only the postcode
    await page.fill('#postcode', '2151');

    await expect.poll(() => nominatimRequests, { timeout: 10_000 }).toBe(2);
    await page.waitForTimeout(2_000);
    expect(nominatimRequests).toBe(2);
  });
});
