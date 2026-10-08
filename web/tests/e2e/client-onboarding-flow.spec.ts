import { test, expect } from '@playwright/test';

// First-time client flow: incomplete profile redirects to onboarding before allowing
// access to campaigns, dashboard, setup, etc.
test.describe('Client onboarding requirement', () => {
  test('incomplete profile redirects /app to /app/onboarding', async ({ page, context }) => {
    // Mock auth as authenticated (simulating a signed-in session)
    await context.addCookies([
      {
        name: '__Host-pas-session',
        value: 'mock-session-token',
        domain: 'localhost',
        path: '/',
        secure: false,
        httpOnly: false, // Allow access from JS for testing
      },
    ]);

    // Mock /v1/me with incomplete client profile
    await page.route('**/v1/me', (route) =>
      route.fulfill({
        status: 200,
        body: JSON.stringify({
          user: {
            id: 'client-incomplete-1',
            role: 'client',
            name: 'New Client',
            clientProfile: null,
          },
          needsRoleSelection: false,
        }),
      }),
    );

    // Try to access dashboard
    await page.goto('/app');

    // Should redirect to onboarding
    await expect(page).toHaveURL('/app/onboarding');
    await expect(page.getByRole('heading', { name: /Complete Your Profile/i })).toBeVisible();
  });

  test('incomplete profile redirects /app/setup to /app/onboarding', async ({ page }) => {

    // Mock /v1/me with incomplete client profile (no onboardingCompleted)
    await page.route('**/v1/me', (route) =>
      route.fulfill({
        status: 200,
        body: JSON.stringify({
          user: {
            id: 'client-incomplete-2',
            role: 'client',
            name: 'New Client',
            clientProfile: {
              accountType: 'business',
              onboardingCompleted: false,
            },
          },
          needsRoleSelection: false,
        }),
      }),
    );

    // Try to access campaign creation
    await page.goto('/app/setup');

    // Should redirect to onboarding
    await expect(page).toHaveURL('/app/onboarding');
  });

  test('incomplete profile does NOT redirect from /app/onboarding', async ({ page }) => {

    // Mock /v1/me with incomplete client profile
    await page.route('**/v1/me', (route) =>
      route.fulfill({
        status: 200,
        body: JSON.stringify({
          user: {
            id: 'client-incomplete-3',
            role: 'client',
            name: 'New Client',
            clientProfile: null,
          },
          needsRoleSelection: false,
        }),
      }),
    );

    // Visit onboarding directly
    await page.goto('/app/onboarding');

    // Should NOT redirect away
    await expect(page).toHaveURL('/app/onboarding');
  });

  test('incomplete profile does NOT redirect from profile edit page', async ({ page }) => {
    const userId = 'client-incomplete-4';

    // Mock /v1/me with incomplete client profile
    await page.route('**/v1/me', (route) =>
      route.fulfill({
        status: 200,
        body: JSON.stringify({
          user: {
            id: userId,
            role: 'client',
            name: 'New Client',
            clientProfile: null,
          },
          needsRoleSelection: false,
        }),
      }),
    );

    // Visit profile edit directly
    await page.goto(`/app/user/${userId}/edit`);

    // Should NOT redirect to onboarding
    await expect(page).toHaveURL(`/app/user/${userId}/edit`);
  });

  test('completed profile does NOT redirect from /app', async ({ page }) => {

    // Mock /v1/me with completed client profile
    await page.route('**/v1/me', (route) =>
      route.fulfill({
        status: 200,
        body: JSON.stringify({
          user: {
            id: 'client-complete-1',
            role: 'client',
            name: 'Established Client',
            clientProfile: {
              accountType: 'business',
              businessName: 'Acme Inc',
              contactFirstName: 'John',
              contactLastName: 'Doe',
              contactEmail: 'john@acme.com',
              contactPhone: '0412345678',
              addressLine1: '123 Main St',
              suburb: 'Melbourne',
              state: 'Victoria',
              postcode: '3000',
              country: 'Australia',
              billingSameAsAddress: true,
              onboardingCompleted: true,
              agreedToTerms: true,
            },
          },
          needsRoleSelection: false,
        }),
      }),
    );

    // Mock campaign list (empty for new client)
    await page.route('**/v1/campaigns', (route) =>
      route.fulfill({
        status: 200,
        body: JSON.stringify([]),
      }),
    );

    // Access dashboard
    await page.goto('/app');

    // Should stay on dashboard (not redirect)
    await expect(page).toHaveURL('/app');

    // Should see campaigns heading (not onboarding message)
    await expect(page.getByRole('heading', { name: /Campaigns/i })).toBeVisible();
  });

  test('completed profile allows /app/setup access', async ({ page }) => {

    // Mock /v1/me with completed profile
    await page.route('**/v1/me', (route) =>
      route.fulfill({
        status: 200,
        body: JSON.stringify({
          user: {
            id: 'client-complete-2',
            role: 'client',
            name: 'Established Client',
            clientProfile: {
              accountType: 'business',
              businessName: 'Acme Inc',
              contactFirstName: 'John',
              contactLastName: 'Doe',
              contactEmail: 'john@acme.com',
              contactPhone: '0412345678',
              addressLine1: '123 Main St',
              suburb: 'Melbourne',
              state: 'Victoria',
              postcode: '3000',
              country: 'Australia',
              billingSameAsAddress: true,
              onboardingCompleted: true,
              agreedToTerms: true,
            },
          },
          needsRoleSelection: false,
        }),
      }),
    );

    // Access campaign creation
    await page.goto('/app/setup');

    // Should stay on setup (not redirect)
    await expect(page).toHaveURL('/app/setup');
  });

  test('incomplete profile shows onboarding banner on first load', async ({ page }) => {

    // Mock /v1/me with incomplete client profile
    await page.route('**/v1/me', (route) =>
      route.fulfill({
        status: 200,
        body: JSON.stringify({
          user: {
            id: 'client-incomplete-5',
            role: 'client',
            name: 'New Client',
            clientProfile: null,
          },
          needsRoleSelection: false,
        }),
      }),
    );

    // Try to visit app (will redirect to onboarding)
    await page.goto('/app');

    // Should be on onboarding page
    await expect(page).toHaveURL('/app/onboarding');

    // Should show the onboarding form
    await expect(
      page.getByRole('heading', { name: /Complete Your Profile/i }),
    ).toBeVisible();

    // Should mention that setup is required
    await expect(page.getByText(/Set up your account to start creating campaigns/i)).toBeVisible();
  });
});
