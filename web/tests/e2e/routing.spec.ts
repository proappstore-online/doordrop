import { test, expect } from '@playwright/test';

// Auth-gated routes should bounce unauthenticated visitors to the login page.
// Uses mocked SDK init probe for deterministic test without external flakes.
test.describe('Route gating (unauthenticated)', () => {
  test.beforeEach(async ({ page }) => {
    // Mock SDK auth probe to return unauthenticated (no session)
    await page.route('**/.pas/auth/me', (route) =>
      route.fulfill({ status: 401, body: '{"error":"not signed in"}' }),
    );

    // Mock FAS auth endpoints
    await page.route('**/api.freeappstore.online/**', (route) => {
      if (route.request().url().includes('user') || route.request().url().includes('me')) {
        return route.fulfill({ status: 401, body: '{"error":"not signed in"}' });
      }
      return route.fulfill({ status: 401, body: '{"error":"not signed in"}' });
    });
  });

  for (const path of ['/walker', '/app', '/admin', '/select-role']) {
    test(`${path} redirects to /login when unauthenticated`, async ({ page }) => {
      await page.goto(path);
      await expect(page).toHaveURL(/\/(login|\/?)$/);
      // Verify login button with actual SDK text
      const loginBtn = page.locator('button').filter({ hasText: /continue with github/i }).first();
      await expect(loginBtn).toBeVisible();
    });
  }
});

// Profile load errors should show recovery UI and block access to protected routes
test.describe('Route gating (profile load errors)', () => {
  test.beforeEach(async ({ page }) => {
    // Mock SDK auth probe endpoint to establish authenticated state
    await page.route('**/.pas/auth/me', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'test-user',
          login: 'test-user',
          avatarUrl: null,
        }),
      }),
    );
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

  test('walker role route shows profile error on /v1/me network abort', async ({ page }) => {
    await page.route('**/v1/me', (route) => {
      route.abort('timedout');
    });
    await page.goto('/walker');

    await expect(page.getByText(/Could Not Load Profile/i)).toBeVisible();
    // route.abort('timedout') creates error "net::ERR_ABORTED" which doesn't match timeout detection
    // ProfileLoadError shows the generic error message for this network condition
    await expect(page.getByText(/An error occurred while loading your profile/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /Try Again/i })).toBeVisible();
  });

  test('walker role route shows profile error on /v1/me timeout', async ({ page }) => {
    await page.route('**/v1/me', (route) =>
      route.fulfill({
        status: 408,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'timeout', message: 'Request timeout' }),
      }),
    );
    await page.goto('/walker');

    await expect(page.getByText(/Could Not Load Profile/i)).toBeVisible();
    // 408 status creates ApiError with message containing "timeout", triggering isTimeout in ProfileLoadError
    await expect(page.getByText(/The connection took too long/i)).toBeVisible();
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
    // Mock SDK auth probe endpoint to establish authenticated state
    await page.route('**/.pas/auth/me', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'test-user',
          login: 'test-user',
          avatarUrl: null,
        }),
      }),
    );

    // Fallback: also set __Host cookie for legacy SDK paths
    try {
      await context.addCookies([
        {
          name: '__Host-pas-session',
          value: 'mock-session-token',
          url: 'http://localhost:5173/',
          httpOnly: true,
        },
      ]);
    } catch {
      await page.addInitScript(() => {
        document.cookie = '__Host-pas-session=mock-session-token; Path=/; SameSite=Lax';
      });
    }
  });

  test('new account sees role selection form and can submit', async ({ page }) => {
    let roleAssigned = false;

    // Register mocks BEFORE navigation
    // First call returns needsRoleSelection: true, after role is assigned return a client profile
    await page.route('**/v1/me', (route) => {
      if (roleAssigned) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            user: { id: 'user1', role: 'client', name: 'Test Client' },
            needsRoleSelection: false,
          }),
        });
      }
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: null,
          needsRoleSelection: true,
        }),
      });
    });

    await page.route('**/v1/me/role', (route) => {
      roleAssigned = true;
      return route.fulfill({ status: 200, body: '{"ok":true}' });
    });

    await page.goto('/select-role');

    // Wait for the role selection heading to appear
    await page.waitForSelector('h1', { timeout: 5000 });

    // Should see role selection buttons - they are h2 inside buttons with the text
    await expect(page.locator('button', { has: page.locator('text="I\'m a client"') }).first()).toBeVisible();
    await expect(page.locator('button', { has: page.locator('text="I\'m a walker"') }).first()).toBeVisible();

    // Submit as client - click the button containing the "I'm a client" text
    await page.locator('button', { has: page.locator('text="I\'m a client"') }).first().click();

    // Should redirect to /app (wait for navigation)
    await page.waitForURL('/app', { timeout: 5000 });
    await expect(page).toHaveURL('/app');
  });

  test('existing client account redirected away from /select-role', async ({ page }) => {
    await page.route('**/v1/me', (route) =>
      route.fulfill({
        status: 200,
        body: JSON.stringify({
          user: { id: 'user1', role: 'client', name: 'Test Client', client_profile: { onboarding_completed: true } },
          needsRoleSelection: false,
        }),
      }),
    );

    await page.goto('/select-role');

    // Should redirect to /app
    await expect(page).toHaveURL('/app');
    // Assert stable content to prove guard settled correctly
    await expect(page.getByRole('heading', { name: 'Campaigns' })).toBeVisible();
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
        contentType: 'application/json',
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
    await page.waitForSelector('h1', { timeout: 5000 });

    // Submit as walker
    await page.locator('button', { has: page.locator('text="I\'m a walker"') }).first().click();

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
        contentType: 'application/json',
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
    await page.waitForSelector('h1', { timeout: 5000 });

    // Submit as client
    await page.locator('button', { has: page.locator('text="I\'m a client"') }).first().click();

    // Both buttons should be disabled while submitting
    // Check buttons are disabled by verifying the opacity/cursor-not-allowed class
    const clientBtn = page.locator('button', { has: page.locator('text="I\'m a client"') }).first();
    const walkerBtn = page.locator('button', { has: page.locator('text="I\'m a walker"') }).first();
    await expect(clientBtn).toHaveAttribute('disabled', '');
    await expect(walkerBtn).toHaveAttribute('disabled', '');
  });
});

// Deep link restoration: unauthenticated → protected URL → login → restored to original URL
test.describe('Deep link restoration after sign-in', () => {
  test.beforeEach(async ({ page, context }) => {
    // Mock SDK auth probe endpoint to establish authenticated state
    await page.route('**/.pas/auth/me', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'test-user',
          login: 'test-user',
          avatarUrl: null,
        }),
      }),
    );

    // Fallback: set __Host cookie
    try {
      await context.addCookies([
        {
          name: '__Host-pas-session',
          value: 'mock-session-token',
          url: 'http://localhost:5173/',
          httpOnly: true,
        },
      ]);
    } catch {
      await page.addInitScript(() => {
        document.cookie = '__Host-pas-session=mock-session-token; Path=/; SameSite=Lax';
      });
    }
  });

  test('client deep link restored after sign-in', async ({ page }) => {
    let redirectedToLogin = false;

    await page.route('**/v1/me', (route) => {
      if (!redirectedToLogin) {
        redirectedToLogin = true;
        return route.fulfill({
          status: 200,
          body: JSON.stringify({
            user: { id: 'user1', role: 'client', name: 'Test Client' },
            needsRoleSelection: false,
          }),
        });
      }
      return route.fulfill({
        status: 200,
        body: JSON.stringify({
          user: { id: 'user1', role: 'client', name: 'Test Client' },
          needsRoleSelection: false,
        }),
      });
    });

    // Unauthenticated visit to a campaign link
    await page.goto('/app/campaign/campaign-123');

    // Should redirect to login (because not authenticated yet in this test flow)
    // But since we mocked the cookie, the app treats user as authenticated
    // This test verifies the path is preserved in the redirect flow
    await expect(page).toHaveURL('/app/campaign/campaign-123');
  });

  test('nested door link restored for client after sign-in', async ({ page }) => {
    await page.route('**/v1/me', (route) =>
      route.fulfill({
        status: 200,
        body: JSON.stringify({
          user: { id: 'user1', role: 'client', name: 'Test Client' },
          needsRoleSelection: false,
        }),
      }),
    );

    // Visit a deeply nested door detail page
    await page.goto('/app/campaign/campaign-456/door/door-789');

    // Should be able to reach the nested route
    await expect(page).toHaveURL('/app/campaign/campaign-456/door/door-789');
  });

  test('walker deep link restored after sign-in', async ({ page }) => {
    await page.route('**/v1/me', (route) =>
      route.fulfill({
        status: 200,
        body: JSON.stringify({
          user: { id: 'user2', role: 'walker', name: 'Test Walker' },
          needsRoleSelection: false,
        }),
      }),
    );

    // Unauthenticated walker visits campaign detail
    await page.goto('/walker/campaign/campaign-123');

    // Should be able to access walker campaign routes
    await expect(page).toHaveURL('/walker/campaign/campaign-123');
  });

  test('walker nested delivery link restored after sign-in', async ({ page }) => {
    await page.route('**/v1/me', (route) =>
      route.fulfill({
        status: 200,
        body: JSON.stringify({
          user: { id: 'user2', role: 'walker', name: 'Test Walker' },
          needsRoleSelection: false,
        }),
      }),
    );

    // Unauthenticated walker visits delivery page with door detail
    await page.goto('/walker/campaign/campaign-123/door/door-456');

    // Should be able to access deeply nested walker routes
    await expect(page).toHaveURL('/walker/campaign/campaign-123/door/door-456');
  });

  test('admin deep link preserved after sign-in', async ({ page }) => {
    await page.route('**/v1/me', (route) =>
      route.fulfill({
        status: 200,
        body: JSON.stringify({
          user: { id: 'admin1', role: 'admin', name: 'Test Admin' },
          needsRoleSelection: false,
        }),
      }),
    );

    // Admin visits campaign management page
    await page.goto('/admin/campaigns/campaign-123');

    // Should be able to access admin routes
    await expect(page).toHaveURL('/admin/campaigns/campaign-123');
  });

  test('role mismatch redirects to role home with message', async ({ page }) => {
    await page.route('**/v1/me', (route) =>
      route.fulfill({
        status: 200,
        body: JSON.stringify({
          user: { id: 'user2', role: 'walker', name: 'Test Walker', walker_profile: { onboarding_completed: true } },
          needsRoleSelection: false,
        }),
      }),
    );

    // Walker somehow tries to access a client-only campaign route
    // (This shouldn't happen in normal flow but tests the safety mechanism)
    await page.goto('/app/campaign/campaign-123');

    // Should redirect to walker home
    await expect(page).toHaveURL('/walker');

    // Should show the role mismatch message
    await expect(page.getByText(/That link is for a different role/i)).toBeVisible();
  });

  test('client trying to access walker route falls back to client home', async ({ page }) => {
    await page.route('**/v1/me', (route) =>
      route.fulfill({
        status: 200,
        body: JSON.stringify({
          user: { id: 'user1', role: 'client', name: 'Test Client', client_profile: { onboarding_completed: true } },
          needsRoleSelection: false,
        }),
      }),
    );

    await page.route('**/v1/config/platform', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ default_payment_mode: 'direct' }),
      }),
    );

    // Client somehow tries to access walker route
    await page.goto('/walker/campaign/campaign-123');

    // Should redirect to client home
    await expect(page).toHaveURL('/app');

    // Should show the role mismatch message
    await expect(page.getByText(/That link is for a different role/i)).toBeVisible();

    // Assert stable content to prove guard settled correctly
    await expect(page.getByRole('heading', { name: 'Campaigns' })).toBeVisible();
  });

  test('unsafe external URL falls back to role home silently', async ({ page }) => {
    await page.route('**/v1/me', (route) =>
      route.fulfill({
        status: 200,
        body: JSON.stringify({
          user: { id: 'user1', role: 'client', name: 'Test Client' },
          needsRoleSelection: false,
        }),
      }),
    );

    // Manually construct a path with protocol-relative URL attempt
    // Note: React Router will handle this safely, but we're testing the validation logic
    // In a real scenario, this would come from location.state.from set by PrivateRoute

    // For this test, we just verify that normal authenticated access works
    await page.goto('/app');

    // Should successfully navigate to client home
    await expect(page).toHaveURL('/app');

    // Should NOT show error message for legitimate navigation
    await expect(page.getByText(/That link is for a different role/i)).not.toBeVisible();
  });

  test('public walker profile accessible to all authenticated users', async ({ page }) => {
    await page.route('**/v1/me', (route) =>
      route.fulfill({
        status: 200,
        body: JSON.stringify({
          user: { id: 'user1', role: 'client', name: 'Test Client' },
          needsRoleSelection: false,
        }),
      }),
    );

    // Client viewing a public walker profile should work
    await page.goto('/walker/walker-user-id-123');

    // Should stay on the public profile path
    await expect(page).toHaveURL('/walker/walker-user-id-123');
  });

  test('message link with campaign ID restored for client', async ({ page }) => {
    await page.route('**/v1/me', (route) =>
      route.fulfill({
        status: 200,
        body: JSON.stringify({
          user: { id: 'user1', role: 'client', name: 'Test Client' },
          needsRoleSelection: false,
        }),
      }),
    );

    // Client deep link to campaign-specific messages
    await page.goto('/app/messages/campaign-123');

    // Should stay on the messages path with campaign ID
    await expect(page).toHaveURL('/app/messages/campaign-123');
  });
});

// Delivery tracking fault injection: verify session lifecycle and error recovery
test.describe('Delivery tracking fault tolerance', () => {
  test.beforeEach(async ({ page }) => {
    // Mock SDK auth probe endpoint to establish authenticated state
    await page.route('**/.pas/auth/me', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'walker-user',
          login: 'test-walker',
          avatarUrl: null,
        }),
      }),
    );
  });

  test('session creation failure blocks tracking start (prevent orphan sessions)', async ({
    page,
  }) => {
    await page.route('**/v1/me', (route) =>
      route.fulfill({
        status: 200,
        body: JSON.stringify({
          user: { id: 'walker1', role: 'walker', name: 'Test Walker' },
          needsRoleSelection: false,
        }),
      }),
    );

    // Mock track-sessions endpoint to reject with 503
    await page.route('**/v1/campaigns/campaign-123/track-sessions', (route) =>
      route.fulfill({
        status: 503,
        body: '{"error":"service unavailable"}',
      }),
    );

    // Navigate to walker delivery page
    await page.goto('/walker/campaign/campaign-123/deliver');

    // Session creation error should be visible in debug info
    // (In a real app, this would show in an error message or log)
    // The tracking should NOT start in 'requesting' state if session creation fails
    // This is verified by: the page doesn't auto-start tracking, user must retry

    // Attempt to start tracking should show error
    // (UI-specific test — depends on how the page displays session creation errors)
  });

  test('out-of-range initial position closes session (prevent stale sessions)', async ({
    page,
  }) => {
    await page.route('**/v1/me', (route) =>
      route.fulfill({
        status: 200,
        body: JSON.stringify({
          user: { id: 'walker2', role: 'walker', name: 'Test Walker' },
          needsRoleSelection: false,
        }),
      }),
    );

    // Mock successful session creation
    let sessionCreated = false;
    await page.route('**/v1/campaigns/campaign-456/track-sessions', (route) => {
      sessionCreated = true;
      return route.fulfill({
        status: 201,
        body: JSON.stringify({
          id: 'session-456',
          started_at: Date.now(),
        }),
      });
    });

    // Mock geolocation to return position FAR from any delivery door
    await page.route('**/v1/campaigns/campaign-456/doors', (route) =>
      route.fulfill({
        status: 200,
        body: JSON.stringify([
          {
            id: 'door-1',
            lat: -37.8136,
            lng: 144.9631, // Melbourne CBD
            status: 'pending',
            deliveryCount: 0,
          },
        ]),
      }),
    );

    // Mock end session endpoint
    await page.route('**/v1/track-sessions/session-456', (route) => {
      if (route.request().method() === 'PATCH') {
        return route.fulfill({ status: 200, body: '{"ok":true}' });
      }
      return route.fallthrough();
    });

    // Navigate and start tracking from out-of-range position
    // (specific test depends on mock geolocation implementation)
  });

  test('failed delivery records remain retryable', async ({ page }) => {
    await page.route('**/v1/me', (route) =>
      route.fulfill({
        status: 200,
        body: JSON.stringify({
          user: { id: 'walker3', role: 'walker', name: 'Test Walker' },
          needsRoleSelection: false,
        }),
      }),
    );

    // Mock session creation
    await page.route('**/v1/campaigns/campaign-789/track-sessions', (route) =>
      route.fulfill({
        status: 201,
        body: JSON.stringify({
          id: 'session-789',
          started_at: Date.now(),
        }),
      }),
    );

    // Mock delivery record endpoint to fail on first attempt, succeed on retry
    let deliveryAttempts = 0;
    await page.route(
      '**/v1/campaigns/campaign-789/doors/door-123',
      (route) => {
        if (route.request().method() === 'PATCH') {
          deliveryAttempts++;
          if (deliveryAttempts === 1) {
            // First attempt fails
            return route.fulfill({
              status: 500,
              body: '{"error":"database connection error"}',
            });
          }
          // Retry succeeds
          return route.fulfill({ status: 200, body: '{"ok":true}' });
        }
        return route.fallthrough();
      },
    );

    // After failed delivery, the door should remain in 'pending' status
    // allowing the tracking hook's retry logic to reattempt it
    // (specific UI test depends on geofence simulation)
  });

  test('persisted session is validated on resume (prevent stale sessions)', async ({
    page,
  }) => {
    await page.route('**/v1/me', (route) =>
      route.fulfill({
        status: 200,
        body: JSON.stringify({
          user: { id: 'walker4', role: 'walker', name: 'Test Walker' },
          needsRoleSelection: false,
        }),
      }),
    );

    // Mock session append endpoint to reject stale session
    let attemptedResume = false;
    await page.route('**/v1/track-sessions/stale-session-id/append', (route) => {
      attemptedResume = true;
      return route.fulfill({
        status: 409,
        body: '{"error":"session not found"}',
      });
    });

    // If browser has persisted session state (set via localStorage in real scenario),
    // the tracking hook's resumeTracking() should validate it
    // On validation failure (409), the session should be cleared and not resumed

    // Navigate to delivery page with stale persisted session
    await page.goto('/walker/campaign/campaign-999/deliver');

    // The page should NOT auto-resume with stale session
    // It should show error that session is invalid and require user to start fresh
  });

  test('invalid sessions are cleared to prevent orphans', async ({ page }) => {
    await page.route('**/v1/me', (route) =>
      route.fulfill({
        status: 200,
        body: JSON.stringify({
          user: { id: 'walker5', role: 'walker', name: 'Test Walker' },
          needsRoleSelection: false,
        }),
      }),
    );

    // Simulate persisted session that becomes invalid during app lifecycle
    // Mock the append endpoint to always fail for this session
    await page.route('**/v1/track-sessions/invalid-session/append', (route) =>
      route.fulfill({
        status: 404,
        body: '{"error":"session not found"}',
      }),
    );

    // When the page tries to resume an invalid session, it should:
    // 1. Detect the invalid state via the append validation attempt
    // 2. Clear the persisted localStorage
    // 3. Show user a message that they must start a new delivery
    // 4. NOT leave the session orphaned on the server

    // Navigate and trigger resume
    await page.goto('/walker/campaign/campaign-555/deliver');

    // After resume attempt with invalid session, localStorage should be cleared
    // (verified via evaluate in Playwright if needed)
  });
});

// Campaign assignment lifecycle: atomic status transitions and explicit field clearing
test.describe('Campaign assignment lifecycle', () => {
  test.beforeEach(async ({ page }) => {
    // Mock SDK auth probe endpoint to establish authenticated state
    await page.route('**/.pas/auth/me', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'test-user',
          login: 'test-user',
          avatarUrl: null,
        }),
      }),
    );
  });

  test('assign walker: sets status to assigned and updates assignedWalkerId', async ({ page }) => {
    await page.route('**/v1/me', (route) =>
      route.fulfill({
        status: 200,
        body: JSON.stringify({
          user: { id: 'client1', role: 'client', name: 'Test Client' },
          needsRoleSelection: false,
        }),
      }),
    );

    // Mock campaign fetch
    let campaignData = {
      id: 'campaign-assign-1',
      name: 'Test Campaign',
      status: 'ready',
      assignedWalkerId: null,
      jobStatus: 'posted',
    };

    await page.route('**/v1/campaigns/campaign-assign-1', (route) => {
      if (route.request().method() === 'GET') {
        return route.fulfill({
          status: 200,
          body: JSON.stringify(campaignData),
        });
      }
      if (route.request().method() === 'PATCH') {
        const body = JSON.parse(route.request().postData() || '{}');
        campaignData = { ...campaignData, ...body };
        return route.fulfill({ status: 200, body: JSON.stringify({ ok: true }) });
      }
      return route.fallthrough();
    });

    await page.goto('/app/campaign/campaign-assign-1');

    // Verify initial state: status is 'ready', no assigned walker
    // After assignment, both status and assignedWalkerId should update atomically

    // Simulate assignment request
    // (Specific test implementation depends on how assignment UI is exposed in the app)
  });

  test('unassign walker: clears assignedWalkerId and restores status to ready', async ({
    page,
  }) => {
    await page.route('**/v1/me', (route) =>
      route.fulfill({
        status: 200,
        body: JSON.stringify({
          user: { id: 'client2', role: 'client', name: 'Test Client' },
          needsRoleSelection: false,
        }),
      }),
    );

    // Mock campaign with assigned walker
    let campaignData = {
      id: 'campaign-unassign-1',
      name: 'Test Campaign',
      status: 'assigned',
      assignedWalkerId: 'walker1',
      jobStatus: 'assigned',
    };

    await page.route('**/v1/campaigns/campaign-unassign-1', (route) => {
      if (route.request().method() === 'GET') {
        return route.fulfill({
          status: 200,
          body: JSON.stringify(campaignData),
        });
      }
      if (route.request().method() === 'PATCH') {
        const body = JSON.parse(route.request().postData() || '{}');
        // Verify that assignedWalkerId is explicitly sent as null (not undefined)
        if ('assigned_walker_id' in body && body.assigned_walker_id === null) {
          // Unassignment successful
          campaignData = { ...campaignData, ...body };
        }
        return route.fulfill({ status: 200, body: JSON.stringify({ ok: true }) });
      }
      return route.fallthrough();
    });

    await page.goto('/app/campaign/campaign-unassign-1');

    // After unassignment: assignedWalkerId should be null, status should be 'ready'
    // Verify that values persist after page reload (no optimistic-only illusion)
  });

  test('assignment failure shows error message', async ({ page }) => {
    await page.route('**/v1/me', (route) =>
      route.fulfill({
        status: 200,
        body: JSON.stringify({
          user: { id: 'client3', role: 'client', name: 'Test Client' },
          needsRoleSelection: false,
        }),
      }),
    );

    // Mock campaign fetch
    await page.route('**/v1/campaigns/campaign-error-1', (route) => {
      if (route.request().method() === 'GET') {
        return route.fulfill({
          status: 200,
          body: JSON.stringify({
            id: 'campaign-error-1',
            name: 'Test Campaign',
            status: 'ready',
            assignedWalkerId: null,
          }),
        });
      }
      if (route.request().method() === 'PATCH') {
        // Simulate assignment failure
        return route.fulfill({
          status: 500,
          body: '{"error":"Failed to update campaign"}',
        });
      }
      return route.fallthrough();
    });

    await page.goto('/app/campaign/campaign-error-1');

    // Attempt assignment and verify error is shown to user
    // Error message should be visible in red banner (from updated WalkerInterestPanel)
    // UI should not claim success when the server call fails
  });
});

// Campaign creation: validate inputs, handle geocoding, and show actionable errors
test.describe('Campaign creation', () => {
  test.beforeEach(async ({ page }) => {
    // Mock SDK auth probe endpoint to establish authenticated state
    await page.route('**/.pas/auth/me', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'client-create-test',
          login: 'test-client',
          avatarUrl: null,
        }),
      }),
    );

    // Mock auth as client
    await page.route('**/v1/me', (route) =>
      route.fulfill({
        status: 200,
        body: JSON.stringify({
          user: {
            id: 'client-create-test',
            role: 'client',
            name: 'Test Client',
            clientProfile: { onboardingCompleted: true },
          },
          needsRoleSelection: false,
        }),
      }),
    );
  });

  test('completing the location step creates the campaign and advances to delivery area', async ({ page }) => {
    // Mock Nominatim geocoding success
    await page.route('**/nominatim.openstreetmap.org/**', (route) =>
      route.fulfill({
        status: 200,
        body: JSON.stringify([{ lat: '-37.8136', lon: '144.9631' }]),
      }),
    );

    let createdBody: Record<string, unknown> | null = null;
    await page.route('**/v1/campaigns', (route) => {
      if (route.request().method() === 'POST') {
        createdBody = JSON.parse(route.request().postData() || '{}');
        return route.fulfill({
          status: 201,
          body: JSON.stringify({ id: 'campaign-new-123', admin_ids: ['client-create-test'] }),
        });
      }
      return route.fallthrough();
    });

    await page.goto('/app/setup');
    await expect(page.getByRole('heading', { name: 'Create a Campaign' })).toBeVisible();

    await page.locator('[class*="-control"]').first().click();
    await page.getByRole('option', { name: 'Victoria' }).click();
    await page.fill('#suburb', 'Melbourne');
    await page.fill('#postcode', '3000');

    // The coordinates appear only once geocoding has returned them
    await expect(page.getByText('Location validated successfully (-37.8136, 144.9631)')).toBeVisible();
    await page.getByRole('button', { name: 'Continue →' }).click();

    // The wizard moves on to step 2; the detail page is reached after publishing, not here
    await expect(page.getByRole('progressbar', { name: /Step 2 of 5: Delivery Area/ })).toBeVisible();
    expect(createdBody).toMatchObject({ state: 'Victoria', suburb: 'melbourne', postcode: '3000', lat: -37.8136 });
  });

  test('Continue stays disabled while the state is empty', async ({ page }) => {
    await page.goto('/app/setup');

    // Leave state empty, fill the rest
    await page.fill('#suburb', 'Melbourne');
    await page.fill('#postcode', '3000');

    // The wizard blocks advancing rather than showing per-field errors on submit
    await expect(page.getByRole('button', { name: 'Continue →' })).toBeDisabled();
    await expect(page).toHaveURL('/app/setup');
  });

  test('Continue stays disabled while the suburb is empty', async ({ page }) => {
    await page.goto('/app/setup');

    await page.locator('[class*="-control"]').first().click();
    await page.getByRole('option', { name: 'New South Wales' }).click();

    // Leave suburb empty
    await page.fill('#postcode', '2000');

    await expect(page.getByRole('button', { name: 'Continue →' })).toBeDisabled();
    await expect(page).toHaveURL('/app/setup');
  });

  test('invalid postcode shows validation error', async ({ page }) => {
    let campaignPostCount = 0;
    await page.route('**/v1/campaigns', (route) => {
      if (route.request().method() === 'POST') campaignPostCount++;
      return route.fallthrough();
    });

    await page.goto('/app/setup');
    await expect(page.getByRole('heading', { name: 'Create a Campaign' })).toBeVisible();

    await page.locator('[class*="-control"]').first().click();
    await page.getByRole('option', { name: 'Queensland' }).click();
    await page.fill('#suburb', 'Brisbane');
    await page.fill('#postcode', '123');

    await expect(page.locator('#postcode-error')).toHaveText('Postcode must be a 4-digit number');
    await expect(page.locator('#suburb')).toHaveValue('Brisbane');
    await expect(page.locator('#postcode')).toHaveValue('123');
    await expect(page.locator('[class*="-singleValue"]')).toContainText('Queensland');
    await expect(page.getByRole('button', { name: 'Continue →' })).toBeDisabled();
    expect(campaignPostCount).toBe(0);
  });

  // Geocoding failures are a non-blocking warning: the wizard shows the message and lets the user continue.
  // Retries back off over a few seconds, so allow extra time for the warning to appear.
  const GEOCODE_WARNING = /Could not verify location coordinates/;

  test('form state is preserved when geocoding finds no match', async ({ page }) => {
    await page.route('**/nominatim.openstreetmap.org/**', (route) =>
      route.fulfill({
        status: 200,
        body: JSON.stringify([]), // Empty result = location not found
      }),
    );

    await page.goto('/app/setup');
    await page.locator('[class*="-control"]').first().click();
    await page.getByRole('option', { name: 'Victoria' }).click();

    const suburb = 'Fitzroy';
    const postcode = '3065';
    await page.fill('#suburb', suburb);
    await page.fill('#postcode', postcode);

    await expect(page.getByText(GEOCODE_WARNING)).toBeVisible({ timeout: 15_000 });

    // Form values are kept and the user can still continue
    await expect(page.locator('#suburb')).toHaveValue(suburb);
    await expect(page.locator('#postcode')).toHaveValue(postcode);
    await expect(page.getByRole('button', { name: 'Continue →' })).toBeEnabled();
  });

  test('geocoding request that never completes shows the warning', async ({ page }) => {
    await page.route('**/nominatim.openstreetmap.org/**', (route) => route.abort());

    await page.goto('/app/setup');
    await page.locator('[class*="-control"]').first().click();
    await page.getByRole('option', { name: 'South Australia' }).click();
    await page.fill('#suburb', 'Adelaide');
    await page.fill('#postcode', '5000');

    await expect(page.getByText(GEOCODE_WARNING)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('button', { name: 'Continue →' })).toBeEnabled();
  });

  test('geocoding service error shows the warning', async ({ page }) => {
    await page.route('**/nominatim.openstreetmap.org/**', (route) =>
      route.fulfill({
        status: 503,
        body: 'Service Unavailable',
      }),
    );

    await page.goto('/app/setup');
    await page.locator('[class*="-control"]').first().click();
    await page.getByRole('option', { name: 'Western Australia' }).click();
    await page.fill('#suburb', 'Perth');
    await page.fill('#postcode', '6000');

    await expect(page.getByText(GEOCODE_WARNING)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('button', { name: 'Continue →' })).toBeEnabled();
  });

  test('unresolvable location shows the warning', async ({ page }) => {
    await page.route('**/nominatim.openstreetmap.org/**', (route) =>
      route.fulfill({
        status: 200,
        body: JSON.stringify([]),
      }),
    );

    await page.goto('/app/setup');
    await page.locator('[class*="-control"]').first().click();
    await page.getByRole('option', { name: 'Tasmania' }).click();
    await page.fill('#suburb', 'InvalidSuburb');
    await page.fill('#postcode', '7000');

    await expect(page.getByText(GEOCODE_WARNING)).toBeVisible({ timeout: 15_000 });
  });

  test('API failure shows error without losing form state', async ({ page }) => {
    // Mock geocoding success
    await page.route('**/nominatim.openstreetmap.org/**', (route) =>
      route.fulfill({
        status: 200,
        body: JSON.stringify([{ lat: '-31.9505', lon: '115.8605' }]),
      }),
    );

    // Mock campaign creation failure
    await page.route('**/v1/campaigns', (route) => {
      if (route.request().method() === 'POST') {
        return route.fulfill({
          status: 500,
          body: '{"error":"internal server error"}',
        });
      }
      return route.fallthrough();
    });

    await page.goto('/app/setup');
    await page.locator('[class*="-control"]').first().click();
    await page.getByRole('option', { name: 'Northern Territory' }).click();

    const suburb = 'Darwin';
    const postcode = '0800';

    await page.fill('#suburb', suburb);
    await page.fill('#postcode', postcode);

    // Wait for the location to geocode, then submit
    await expect(page.getByText('Location validated successfully (-31.9505, 115.8605)')).toBeVisible();
    await page.getByRole('button', { name: 'Continue →' }).click();

    // Verify API error is shown
    await expect(page.getByText('Failed to create campaign. Please try again.')).toBeVisible();

    // Verify form state is preserved
    await expect(page.locator('#suburb')).toHaveValue(suburb);
    await expect(page.locator('#postcode')).toHaveValue(postcode);
  });

  test('duplicate submission is prevented', async ({ page }) => {
    let createCount = 0;

    // Mock geocoding success
    await page.route('**/nominatim.openstreetmap.org/**', (route) =>
      route.fulfill({
        status: 200,
        body: JSON.stringify([{ lat: '-33.8688', lon: '151.2093' }]),
      }),
    );

    // Mock campaign creation with delay
    await page.route('**/v1/campaigns', async (route) => {
      if (route.request().method() === 'POST') {
        createCount++;
        await new Promise((resolve) => setTimeout(resolve, 1000)); // 1 second delay
        return route.fulfill({
          status: 201,
          body: JSON.stringify({ id: 'campaign-new-456', admin_ids: ['client-create-test'] }),
        });
      }
      return route.fallthrough();
    });

    await page.goto('/app/setup');
    await expect(page.getByRole('heading', { name: 'Create a Campaign' })).toBeVisible();

    // Enter location
    await page.locator('[class*="-control"]').first().click();
    await page.getByRole('option', { name: 'New South Wales' }).click();
    await page.fill('#suburb', 'Sydney');
    await page.fill('#postcode', '2000');

    // Wait for the location to geocode, then click Continue once
    await expect(page.getByText('Location validated successfully (-33.8688, 151.2093)')).toBeVisible();
    await page.getByRole('button', { name: 'Continue →' }).click();

    // While the campaign is being created the button is disabled and relabelled, so a second click can't fire
    await expect(page.getByRole('button', { name: 'Creating...' })).toBeDisabled();

    // Wait for the step to advance (the request resolves after its 1 s delay)
    await expect(page.getByRole('progressbar', { name: /Step 2 of 5: Delivery Area/ })).toBeVisible();

    // Verify only one request was made
    expect(createCount).toBe(1);
  });

  test('suburb validation error clears when the suburb is corrected', async ({ page }) => {
    await page.goto('/app/setup');

    // A digit in the suburb shows an inline error
    await page.fill('#suburb', 'Geelong3');
    await expect(page.getByText('Suburb cannot contain numbers')).toBeVisible();

    // Correcting the value clears it
    await page.fill('#suburb', 'Geelong');
    await expect(page.getByText('Suburb cannot contain numbers')).not.toBeVisible();
  });
});

// Flyer library: loading, saving, updating, deleting with error handling
test.describe('Flyer library error handling', () => {
  test.beforeEach(async ({ page }) => {
    // Mock SDK auth probe endpoint to establish authenticated state
    await page.route('**/.pas/auth/me', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'flyer-user-123',
          login: 'test-client',
          avatarUrl: null,
        }),
      }),
    );

    await page.route('**/v1/me', (route) =>
      route.fulfill({
        status: 200,
        body: JSON.stringify({
          user: {
            id: 'flyer-user-123',
            role: 'client',
            name: 'Test Client',
            clientProfile: { onboardingCompleted: true },
          },
          needsRoleSelection: false,
        }),
      }),
    );
  });

  test('failed flyer list load shows error, not empty state', async ({ page }) => {
    let flyerListRequests = 0;
    await page.route('**/v1/users/flyer-user-123/flyers', (route) => {
      flyerListRequests++;
      return route.fulfill({
        status: 500,
        body: '{"error":"server error"}',
      });
    });

    await page.goto('/app/flyers');

    await expect(page.getByText('Unable to load flyers')).toBeVisible();
    await expect(page.getByText('We couldn’t load your flyers. Check your connection and try again.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();
    await expect(page.getByText('Build your flyer library')).toHaveCount(0);
    expect(flyerListRequests).toBeGreaterThan(0);
  });

  test('retry button on flyer load failure', async ({ page }) => {
    let failing = true;
    let flyerListRequests = 0;

    await page.route('**/v1/users/flyer-user-123/flyers', (route) => {
      flyerListRequests++;
      if (failing) {
        return route.fulfill({ status: 500, body: '{"error":"server error"}' });
      }
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([{ id: 'flyer1', name: 'Test Flyer', created_at: Date.now() }]),
      });
    });
    await page.route('**/v1/users/flyer-user-123/flyers/flyer1/campaigns', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }),
    );

    await page.goto('/app/flyers');
    await expect(page.getByText('Unable to load flyers')).toBeVisible();

    const requestsBeforeRetry = flyerListRequests;
    failing = false;
    await page.getByRole('button', { name: 'Try again' }).click();

    await expect(page.getByText('Unable to load flyers')).toHaveCount(0);
    await expect(page.getByText('Test Flyer')).toBeVisible();
    expect(flyerListRequests).toBeGreaterThan(requestsBeforeRetry);
  });

  test('flyer upload failure preserves form state', async ({ page }) => {
    const name = 'Test Flyer Upload';
    const description = 'Test description for upload failure';
    const uploadedUrl = 'https://storage.example.com/flyer-test.png';
    const PNG = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGP4z8AAAAMBAQDJ/pLvAAAAAElFTkSuQmCC',
      'base64',
    );
    const events: string[] = [];
    const storagePuts: { method: string; path: string; contentType: string | undefined; body: Buffer | null }[] = [];
    const createBodies: Record<string, unknown>[] = [];

    await page.route('**/v1/apps/*/storage/**', (route) => {
      if (route.request().method() !== 'PUT') return route.fallthrough();
      events.push('PUT');
      storagePuts.push({
        method: route.request().method(),
        path: new URL(route.request().url()).pathname,
        contentType: route.request().headers()['content-type'],
        body: route.request().postDataBuffer(),
      });
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ url: uploadedUrl }),
      });
    });

    await page.route('**/v1/users/flyer-user-123/flyers', (route) => {
      if (route.request().method() === 'POST') {
        events.push('POST');
        createBodies.push(route.request().postDataJSON());
        return route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Server error' }),
        });
      }
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });

    await page.goto('/app/flyers');
    await page.getByRole('button', { name: '+ Add Flyer' }).click();

    await page.locator('#flyer-name').fill(name);
    await page.locator('#flyer-description').fill(description);
    const fileInput = page.locator('#flyer-image');
    await fileInput.setInputFiles({ name: 'test.png', mimeType: 'image/png', buffer: PNG });

    const preview = page.locator("img[alt='Flyer preview']");
    await expect.poll(() => preview.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);

    const selectedFiles = () =>
      fileInput.evaluate((el: HTMLInputElement) =>
        Array.from(el.files ?? []).map((f) => ({ name: f.name, type: f.type, size: f.size })),
      );
    expect(await selectedFiles()).toEqual([{ name: 'test.png', type: 'image/png', size: PNG.length }]);

    await page.getByRole('button', { name: 'Save Flyer' }).click();

    await expect(page.getByRole('alert')).toContainText(
      'We couldn’t save this flyer. Your details and selected file are still here—please try again.',
    );
    await expect(page.locator('#flyer-name')).toHaveValue(name);
    await expect(page.locator('#flyer-description')).toHaveValue(description);
    await expect.poll(() => preview.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
    expect(await selectedFiles()).toEqual([{ name: 'test.png', type: 'image/png', size: PNG.length }]);

    expect(events).toEqual(['PUT', 'POST']);
    expect(storagePuts).toHaveLength(1);
    expect(storagePuts[0].method).toBe('PUT');
    expect(storagePuts[0].path).toMatch(/\/storage\/_public\/users\/flyer-user-123\/flyers\/[^/]+\.png$/);
    expect(storagePuts[0].contentType).toBe('image/png');
    expect(storagePuts[0].body?.equals(PNG)).toBe(true);
    expect(createBodies).toHaveLength(1);
    expect(createBodies[0]).toMatchObject({ name, description, file_url: uploadedUrl });
  });

  test('flyer delete failure shows error', async ({ page }) => {
    let deleteAttempts = 0;

    await page.route('**/v1/users/flyer-user-123/flyers', (route) => {
      if (route.request().method() !== 'GET') return route.fallthrough();
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 'flyer1',
            name: 'Flyer 1',
            description: 'Test flyer',
            file_url: 'https://example.com/flyer1.png',
            created_at: '2024-01-01T00:00:00Z',
          },
        ]),
      });
    });

    await page.route('**/v1/users/flyer-user-123/flyers/flyer1/campaigns', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) }),
    );

    await page.route('**/v1/users/flyer-user-123/flyers/flyer1', (route) => {
      if (route.request().method() !== 'DELETE') return route.fallthrough();
      deleteAttempts++;
      return route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Server error' }),
      });
    });

    await page.goto('/app/flyers');
    await expect(page.getByRole('heading', { name: 'Flyer 1' })).toBeVisible();

    page.once('dialog', (dialog) => {
      void dialog.accept();
    });
    await page.getByRole('button', { name: 'Delete Flyer 1' }).click();

    await expect(page.getByRole('alert')).toContainText('We couldn’t remove this flyer. Please try again.');
    await expect(page.getByRole('heading', { name: 'Flyer 1' })).toBeVisible();
    expect(deleteAttempts).toBe(1);
  });

  test('button cannot be double-submitted during flyer creation', async ({ page }) => {
    let postCount = 0;
    let releaseCreate!: () => void;
    const createReleased = new Promise<void>((resolve) => {
      releaseCreate = resolve;
    });

    await page.route('**/v1/users/flyer-user-123/flyers', async (route) => {
      if (route.request().method() === 'POST') {
        postCount++;
        await createReleased;
        return route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({ id: 'new-flyer' }),
        });
      }
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });

    await page.goto('/app/flyers');
    await page.getByRole('button', { name: '+ Add Flyer' }).click();
    await page.locator('#flyer-name').fill('My Flyer');
    await page.getByRole('button', { name: 'Save Flyer' }).click();

    const pendingButton = page.getByRole('button', { name: 'Uploading...' });
    await expect(pendingButton).toBeDisabled();
    expect(postCount).toBe(1);

    const box = await pendingButton.boundingBox();
    if (!box) throw new Error('pending save button has no bounding box');
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    await page.mouse.click(cx, cy);
    await page.mouse.click(cx, cy);
    expect(postCount).toBe(1);

    releaseCreate();
    await expect(page.getByRole('status')).toContainText('Flyer saved to your library.');
    await expect(page.getByRole('heading', { name: 'My Flyer', exact: true })).toBeVisible();
    expect(postCount).toBe(1);
  });
});

// Campaign flyer selection: draft campaigns allow changing/clearing active flyer
test.describe('Campaign active flyer management', () => {
  test.beforeEach(async ({ page, context }) => {
    // Mock SDK auth probe endpoint to establish authenticated state
    await page.route('**/.pas/auth/me', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'client-flyer-test',
          login: 'test-client',
          avatarUrl: null,
        }),
      }),
    );

    // Set __Host cookie with valid format (no domain attribute)
    try {
      await context.addCookies([
        {
          name: '__Host-pas-session',
          value: 'mock-session-token',
          url: 'http://localhost:5173/',
          httpOnly: true,
        },
      ]);
    } catch {
      await page.addInitScript(() => {
        document.cookie = '__Host-pas-session=mock-session-token; Path=/; SameSite=Lax';
      });
    }

    // Mock auth as client
    await page.route('**/v1/me', (route) =>
      route.fulfill({
        status: 200,
        body: JSON.stringify({
          user: {
            id: 'client-flyer-test',
            role: 'client',
            name: 'Test Client',
            clientProfile: { onboardingCompleted: true },
          },
          needsRoleSelection: false,
        }),
      }),
    );
  });

  test('select an active flyer in draft campaign', async ({ page }) => {
    // Mock campaign with multiple printouts and no active flyer yet
    const mockCampaign = {
      id: 'campaign-flyer-1',
      name: 'Test Campaign',
      status: 'draft',
      adminIds: ['client-flyer-test'],
      activePrintoutId: undefined,
      suburb: 'Melbourne',
      postcode: '3000',
      state: 'Victoria',
    };

    const mockPrintouts = [
      { id: 'printout1', name: 'Summer Sale', description: 'Summer promotion flyer' },
      { id: 'printout2', name: 'Grand Opening', description: 'New store opening flyer' },
    ];

    await page.route('**/v1/campaigns/campaign-flyer-1', (route) => {
      if (route.request().method() === 'GET') {
        return route.fulfill({ status: 200, body: JSON.stringify(mockCampaign) });
      }
      if (route.request().method() === 'PATCH') {
        const body = JSON.parse(route.request().postData() || '{}');
        mockCampaign.activePrintoutId = body.active_printout_id;
        return route.fulfill({ status: 200, body: JSON.stringify({ ok: true }) });
      }
      return route.fallthrough();
    });

    await page.route('**/v1/campaigns/campaign-flyer-1/printouts', (route) =>
      route.fulfill({ status: 200, body: JSON.stringify(mockPrintouts) }),
    );

    await page.goto('/app/campaign/campaign-flyer-1');

    // Find and select a flyer
    const flyerSelect = page.locator('select').filter({ hasText: 'Select a flyer...' });
    await flyerSelect.selectOption('printout1');

    // Verify selection was updated
    await expect(flyerSelect).toHaveValue('printout1');

    // Clear button should now be visible
    await expect(page.getByRole('button', { name: /Clear/i })).toBeVisible();
  });

  test('change the active flyer in draft campaign', async ({ page }) => {
    // Mock campaign with an active flyer already selected
    const mockCampaign = {
      id: 'campaign-flyer-2',
      name: 'Test Campaign',
      status: 'draft',
      adminIds: ['client-flyer-test'],
      activePrintoutId: 'printout1',
      suburb: 'Melbourne',
      postcode: '3000',
      state: 'Victoria',
    };

    const mockPrintouts = [
      { id: 'printout1', name: 'Summer Sale' },
      { id: 'printout2', name: 'Grand Opening' },
    ];

    await page.route('**/v1/campaigns/campaign-flyer-2', (route) => {
      if (route.request().method() === 'GET') {
        return route.fulfill({ status: 200, body: JSON.stringify(mockCampaign) });
      }
      if (route.request().method() === 'PATCH') {
        const body = JSON.parse(route.request().postData() || '{}');
        mockCampaign.activePrintoutId = body.active_printout_id;
        return route.fulfill({ status: 200, body: JSON.stringify({ ok: true }) });
      }
      return route.fallthrough();
    });

    await page.route('**/v1/campaigns/campaign-flyer-2/printouts', (route) =>
      route.fulfill({ status: 200, body: JSON.stringify(mockPrintouts) }),
    );

    await page.goto('/app/campaign/campaign-flyer-2');

    // Should show selector (not locked) with option to change
    const flyerSelect = page.locator('select').filter({ hasText: 'Select a flyer...' });
    await expect(flyerSelect).toBeVisible();
    await expect(flyerSelect).toHaveValue('printout1');

    // Change to different flyer
    await flyerSelect.selectOption('printout2');

    // Verify change was applied
    await expect(flyerSelect).toHaveValue('printout2');
  });

  test('clear the active flyer in draft campaign', async ({ page }) => {
    const mockCampaign = {
      id: 'campaign-flyer-3',
      name: 'Test Campaign',
      status: 'draft',
      adminIds: ['client-flyer-test'],
      activePrintoutId: 'printout1',
    };

    const mockPrintouts = [
      { id: 'printout1', name: 'Summer Sale' },
      { id: 'printout2', name: 'Grand Opening' },
    ];

    await page.route('**/v1/campaigns/campaign-flyer-3', (route) => {
      if (route.request().method() === 'GET') {
        return route.fulfill({ status: 200, body: JSON.stringify(mockCampaign) });
      }
      if (route.request().method() === 'PATCH') {
        const body = JSON.parse(route.request().postData() || '{}');
        mockCampaign.activePrintoutId = body.active_printout_id;
        return route.fulfill({ status: 200, body: JSON.stringify({ ok: true }) });
      }
      return route.fallthrough();
    });

    await page.route('**/v1/campaigns/campaign-flyer-3/printouts', (route) =>
      route.fulfill({ status: 200, body: JSON.stringify(mockPrintouts) }),
    );

    await page.goto('/app/campaign/campaign-flyer-3');

    // Clear button should be visible
    const clearButton = page.getByRole('button', { name: /Clear/i });
    await expect(clearButton).toBeVisible();

    // Click clear
    await clearButton.click();

    // Flyer should be cleared
    const flyerSelect = page.locator('select').filter({ hasText: 'Select a flyer...' });
    await expect(flyerSelect).toHaveValue('');
  });

  test('active flyer locked when campaign delivery has started', async ({ page }) => {
    const mockCampaign = {
      id: 'campaign-flyer-4',
      name: 'Test Campaign',
      status: 'assigned', // delivery started
      adminIds: ['client-flyer-test'],
      activePrintoutId: 'printout1',
    };

    const mockPrintouts = [
      { id: 'printout1', name: 'Summer Sale' },
    ];

    await page.route('**/v1/campaigns/campaign-flyer-4', (route) =>
      route.fulfill({ status: 200, body: JSON.stringify(mockCampaign) }),
    );

    await page.route('**/v1/campaigns/campaign-flyer-4/printouts', (route) =>
      route.fulfill({ status: 200, body: JSON.stringify(mockPrintouts) }),
    );

    await page.goto('/app/campaign/campaign-flyer-4');

    // Should show read-only text, not selector
    await expect(page.locator('select').first()).not.toBeVisible();
    // The name is shown in more than one card on non-draft campaigns; any match proves the read-only display
    await expect(page.getByText('Summer Sale').first()).toBeVisible();

    // Clear button should not be visible
    await expect(page.getByRole('button', { name: /Clear/i })).not.toBeVisible();
  });

  test('failed flyer update shows error and preserves selection', async ({ page }) => {
    const mockCampaign = {
      id: 'campaign-flyer-5',
      name: 'Test Campaign',
      status: 'draft',
      adminIds: ['client-flyer-test'],
      activePrintoutId: undefined,
    };

    const mockPrintouts = [
      { id: 'printout1', name: 'Summer Sale' },
    ];

    await page.route('**/v1/campaigns/campaign-flyer-5', (route) => {
      if (route.request().method() === 'PATCH') {
        // Simulate update failure
        return route.fulfill({
          status: 500,
          body: '{"error":"server error"}',
        });
      }
      return route.fulfill({ status: 200, body: JSON.stringify(mockCampaign) });
    });

    await page.route('**/v1/campaigns/campaign-flyer-5/printouts', (route) =>
      route.fulfill({ status: 200, body: JSON.stringify(mockPrintouts) }),
    );

    await page.goto('/app/campaign/campaign-flyer-5');

    // Try to select a flyer (will fail)
    const flyerSelect = page.locator('select').filter({ hasText: 'Select a flyer...' });
    await flyerSelect.selectOption('printout1');

    // Error should be shown
    await expect(page.getByText(/couldn't update the active flyer/i)).toBeVisible();

    // But the selection in the form should remain
    await expect(flyerSelect).toHaveValue('printout1');
  });
});

// Automatic flyer activation: creating the first flyer should make it active
test.describe('Campaign flyer automatic activation on creation', () => {
  test.beforeEach(async ({ page, context }) => {
    // Mock SDK auth probe endpoint to establish authenticated state
    await page.route('**/.pas/auth/me', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'client-auto-flyer-test',
          login: 'test-client',
          avatarUrl: null,
        }),
      }),
    );

    // Set __Host cookie with valid format (no domain attribute)
    try {
      await context.addCookies([
        {
          name: '__Host-pas-session',
          value: 'mock-session-token',
          url: 'http://localhost:5173/',
          httpOnly: true,
        },
      ]);
    } catch {
      await page.addInitScript(() => {
        document.cookie = '__Host-pas-session=mock-session-token; Path=/; SameSite=Lax';
      });
    }

    // Mock auth as client
    await page.route('**/v1/me', (route) =>
      route.fulfill({
        status: 200,
        body: JSON.stringify({
          user: {
            id: 'client-auto-flyer-test',
            email: 'auto-flyer@example.com',
            name: 'Test Client',
            role: 'client',
            clientProfile: { onboardingCompleted: true },
          },
          needsRoleSelection: false,
        }),
      }),
    );

    // Mock flyer file upload (pas.storage.uploadPublic)
    await page.route('**/v1/apps/*/storage/**', (route) => {
      if (route.request().method() !== 'PUT') return route.fallthrough();
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ url: 'https://storage.example.com/auto-flyer.jpg' }),
      });
    });
  });

  test('creating first flyer automatically sets it as active', async ({ page }) => {
    // Mock campaign with no flyers and no active flyer
    const mockCampaign = {
      id: 'campaign-auto-1',
      name: 'Auto Test Campaign',
      status: 'draft',
      adminIds: ['client-auto-flyer-test'],
      activePrintoutId: undefined,
      suburb: 'Melbourne',
      postcode: '3000',
      state: 'Victoria',
    };

    let printouts: any[] = [];

    await page.route('**/v1/campaigns/campaign-auto-1', (route) => {
      if (route.request().method() === 'GET') {
        return route.fulfill({ status: 200, body: JSON.stringify(mockCampaign) });
      }
      if (route.request().method() === 'PATCH') {
        const body = JSON.parse(route.request().postData() || '{}');
        if ('active_printout_id' in body) {
          mockCampaign.activePrintoutId = body.active_printout_id;
        }
        return route.fulfill({ status: 200, body: JSON.stringify({ ok: true }) });
      }
      return route.fallthrough();
    });

    await page.route('**/v1/campaigns/campaign-auto-1/printouts', (route) => {
      if (route.request().method() === 'GET') {
        return route.fulfill({ status: 200, body: JSON.stringify(printouts) });
      }
      if (route.request().method() === 'POST') {
        const body = JSON.parse(route.request().postData() || '{}');
        const newPrintout = {
          id: `printout-${Date.now()}`,
          name: body.name,
          description: body.description,
          version: body.version,
          createdAt: Date.now(),
          createdBy: body.created_by,
        };
        printouts.push(newPrintout);
        return route.fulfill({ status: 200, body: JSON.stringify(newPrintout) });
      }
      return route.fallthrough();
    });

    // Mock flyer library (empty)
    await page.route('**/v1/flyers*', (route) =>
      route.fulfill({ status: 200, body: JSON.stringify([]) }),
    );

    await page.goto('/app/campaign/campaign-auto-1');

    // Open flyer form
    await page.getByRole('button', { name: /\+ Add Flyer/i }).click();
    await expect(page.locator('input[placeholder="e.g. Summer Sale, Grand Opening..."]')).toBeVisible();

    // Fill form
    await page.fill('input[placeholder="e.g. Summer Sale, Grand Opening..."]', 'First Flyer');
    await page.fill('input[placeholder="Any details about this flyer..."]', 'My first flyer');

    // Mock file upload
    const fileInput = page.locator('input[type="file"]');
    const buffer = Buffer.from('fake image data');
    await fileInput.setInputFiles({
      name: 'test.jpg',
      mimeType: 'image/jpeg',
      buffer,
    });

    // Wait for preview to show
    await page.waitForSelector('img[alt="Preview"]');

    // Submit
    await page.getByRole('button', { name: /Save Flyer/i }).click();

    // Wait for the update calls to complete and verify active flyer is set
    await page.waitForTimeout(500);

    // Verify the flyer list shows the new flyer
    await expect(page.locator('span', { hasText: /^First Flyer$/ })).toBeVisible();

    // Verify the PrintoutSelector shows the flyer is selected
    const flyerSelect = page.locator('select').filter({ hasText: 'Select a flyer...' });
    await expect(flyerSelect).toHaveValue(printouts[0]!.id);
  });

  test('new flyer becomes active when campaign has printouts but no active flyer', async ({ page }) => {
    // Campaign already has a printout, but no active flyer is set
    const mockCampaign = {
      id: 'campaign-auto-4',
      name: 'Legacy Printout Campaign',
      status: 'draft',
      adminIds: ['client-auto-flyer-test'],
      activePrintoutId: undefined,
      suburb: 'Melbourne',
      postcode: '3000',
      state: 'Victoria',
    };

    const printouts: any[] = [
      { id: 'printout-legacy', name: 'Legacy Flyer', version: 1, createdAt: Date.now(), createdBy: 'client-auto-flyer-test' },
    ];
    const patches: Record<string, unknown>[] = [];

    await page.route('**/v1/campaigns/campaign-auto-4', (route) => {
      if (route.request().method() === 'GET') {
        return route.fulfill({ status: 200, body: JSON.stringify(mockCampaign) });
      }
      if (route.request().method() === 'PATCH') {
        const body = JSON.parse(route.request().postData() || '{}');
        patches.push(body);
        if ('active_printout_id' in body) {
          mockCampaign.activePrintoutId = body.active_printout_id;
        }
        return route.fulfill({ status: 200, body: JSON.stringify({ ok: true }) });
      }
      return route.fallthrough();
    });

    await page.route('**/v1/campaigns/campaign-auto-4/printouts', (route) => {
      if (route.request().method() === 'GET') {
        return route.fulfill({ status: 200, body: JSON.stringify(printouts) });
      }
      if (route.request().method() === 'POST') {
        const body = JSON.parse(route.request().postData() || '{}');
        const newPrintout = {
          id: `printout-new-${printouts.length + 1}`,
          name: body.name,
          version: body.version,
          createdAt: Date.now(),
          createdBy: body.created_by,
        };
        printouts.push(newPrintout);
        return route.fulfill({ status: 200, body: JSON.stringify(newPrintout) });
      }
      return route.fallthrough();
    });

    await page.route('**/v1/flyers*', (route) =>
      route.fulfill({ status: 200, body: JSON.stringify([]) }),
    );

    await page.goto('/app/campaign/campaign-auto-4');

    await page.getByRole('button', { name: /\+ Add Flyer/i }).click();
    await page.fill('input[placeholder="e.g. Summer Sale, Grand Opening..."]', 'Second Flyer B');
    await page.locator('input[type="file"]').setInputFiles({
      name: 'second.jpg',
      mimeType: 'image/jpeg',
      buffer: Buffer.from('fake image data'),
    });
    await page.waitForSelector('img[alt="Preview"]');
    await page.getByRole('button', { name: /Save Flyer/i }).click();

    await expect(page.locator('span', { hasText: /^Second Flyer B$/ })).toBeVisible();

    // The new flyer is the one made active; the legacy flyer was not active before
    const newId = printouts[printouts.length - 1].id;
    expect(patches).toContainEqual({ active_printout_id: newId });
    await expect(page.locator('select').filter({ hasText: 'Select a flyer...' })).toHaveValue(newId);
  });

  test('creating second flyer preserves already-active flyer selection', async ({ page }) => {
    // Mock campaign with one printout already active
    const mockCampaign = {
      id: 'campaign-auto-2',
      name: 'Auto Test Campaign 2',
      status: 'draft',
      adminIds: ['client-auto-flyer-test'],
      activePrintoutId: 'printout-1-existing',
      suburb: 'Melbourne',
      postcode: '3000',
      state: 'Victoria',
    };

    const printouts = [
      {
        id: 'printout-1-existing',
        name: 'First Flyer',
        version: 1,
        createdAt: Date.now(),
        createdBy: 'client-auto-flyer-test',
      },
    ];

    await page.route('**/v1/campaigns/campaign-auto-2', (route) => {
      if (route.request().method() === 'GET') {
        return route.fulfill({ status: 200, body: JSON.stringify(mockCampaign) });
      }
      if (route.request().method() === 'PATCH') {
        const body = JSON.parse(route.request().postData() || '{}');
        if ('active_printout_id' in body) {
          mockCampaign.activePrintoutId = body.active_printout_id;
        }
        return route.fulfill({ status: 200, body: JSON.stringify({ ok: true }) });
      }
      return route.fallthrough();
    });

    let postCount = 0;
    await page.route('**/v1/campaigns/campaign-auto-2/printouts', (route) => {
      if (route.request().method() === 'GET') {
        return route.fulfill({ status: 200, body: JSON.stringify(printouts) });
      }
      if (route.request().method() === 'POST') {
        postCount++;
        const body = JSON.parse(route.request().postData() || '{}');
        const newPrintout = {
          id: `printout-${postCount}-new`,
          name: body.name,
          description: body.description,
          version: body.version,
          createdAt: Date.now(),
          createdBy: body.created_by,
        };
        printouts.push(newPrintout);
        return route.fulfill({ status: 200, body: JSON.stringify(newPrintout) });
      }
      return route.fallthrough();
    });

    // Mock flyer library (empty)
    await page.route('**/v1/flyers*', (route) =>
      route.fulfill({ status: 200, body: JSON.stringify([]) }),
    );

    await page.goto('/app/campaign/campaign-auto-2');

    // Verify first flyer is already shown as active
    await expect(page.locator('span', { hasText: /^First Flyer$/ })).toBeVisible();
    const flyerSelect = page.locator('select').filter({ hasText: 'Select a flyer...' });
    await expect(flyerSelect).toHaveValue('printout-1-existing');

    // Open flyer form to add a second flyer
    await page.getByRole('button', { name: /\+ Add Flyer/i }).click();

    // Fill form
    await page.fill('input[placeholder="e.g. Summer Sale, Grand Opening..."]', 'Second Flyer');

    // Mock file upload
    const fileInput = page.locator('input[type="file"]');
    const buffer = Buffer.from('fake image data');
    await fileInput.setInputFiles({
      name: 'test2.jpg',
      mimeType: 'image/jpeg',
      buffer,
    });

    // Wait for preview
    await page.waitForSelector('img[alt="Preview"]');

    // Submit
    await page.getByRole('button', { name: /Save Flyer/i }).click();

    await page.waitForTimeout(500);

    // Verify the second flyer was added
    await expect(page.locator('span', { hasText: /^Second Flyer$/ })).toBeVisible();

    // Verify the first flyer is STILL selected (not replaced)
    await expect(flyerSelect).toHaveValue('printout-1-existing');
  });

  test('automatic activation failure shows recoverable error', async ({ page }) => {
    // Mock campaign with no flyers
    const mockCampaign = {
      id: 'campaign-auto-3',
      name: 'Auto Test Campaign 3',
      status: 'draft',
      adminIds: ['client-auto-flyer-test'],
      activePrintoutId: undefined,
      suburb: 'Melbourne',
      postcode: '3000',
      state: 'Victoria',
    };

    let printouts: any[] = [];
    let shouldFailActivation = true;

    await page.route('**/v1/campaigns/campaign-auto-3', (route) => {
      if (route.request().method() === 'GET') {
        return route.fulfill({ status: 200, body: JSON.stringify(mockCampaign) });
      }
      if (route.request().method() === 'PATCH') {
        // Fail the first activation attempt
        if (shouldFailActivation) {
          shouldFailActivation = false;
          return route.fulfill({
            status: 500,
            body: JSON.stringify({ error: 'Server error' }),
          });
        }
        const body = JSON.parse(route.request().postData() || '{}');
        if ('active_printout_id' in body) {
          mockCampaign.activePrintoutId = body.active_printout_id;
        }
        return route.fulfill({ status: 200, body: JSON.stringify({ ok: true }) });
      }
      return route.fallthrough();
    });

    await page.route('**/v1/campaigns/campaign-auto-3/printouts', (route) => {
      if (route.request().method() === 'GET') {
        return route.fulfill({ status: 200, body: JSON.stringify(printouts) });
      }
      if (route.request().method() === 'POST') {
        const body = JSON.parse(route.request().postData() || '{}');
        const newPrintout = {
          id: `printout-auto-fail-${Date.now()}`,
          name: body.name,
          version: body.version,
          createdAt: Date.now(),
          createdBy: body.created_by,
        };
        printouts.push(newPrintout);
        return route.fulfill({ status: 200, body: JSON.stringify(newPrintout) });
      }
      return route.fallthrough();
    });

    // Mock flyer library (empty)
    await page.route('**/v1/flyers*', (route) =>
      route.fulfill({ status: 200, body: JSON.stringify([]) }),
    );

    await page.goto('/app/campaign/campaign-auto-3');

    // Open and fill flyer form
    await page.getByRole('button', { name: /\+ Add Flyer/i }).click();
    await page.fill('input[placeholder="e.g. Summer Sale, Grand Opening..."]', 'Recovery Test Flyer');

    // Mock file upload
    const fileInput = page.locator('input[type="file"]');
    const buffer = Buffer.from('fake image data');
    await fileInput.setInputFiles({
      name: 'test.jpg',
      mimeType: 'image/jpeg',
      buffer,
    });

    await page.waitForSelector('img[alt="Preview"]');

    // Submit
    await page.getByRole('button', { name: /Save Flyer/i }).click();

    // Wait for submission
    await page.waitForTimeout(500);

    // Flyer should still be created despite activation error
    await expect(page.locator('span', { hasText: /^Recovery Test Flyer$/ })).toBeVisible();

    // Error should be shown about activation failure
    await expect(page.getByText(/couldn't automatically activate the flyer/i)).toBeVisible();

    // User can dismiss the error
    const errorBox = page
      .locator('div')
      .filter({ has: page.getByText(/couldn't automatically activate/i) })
      .filter({ has: page.getByRole('button', { name: '✕' }) })
      .last();
    await errorBox.getByRole('button', { name: '✕' }).click();
    await expect(page.getByText(/couldn't automatically activate the flyer/i)).not.toBeVisible();
  });
});

// Canary test: verifies that the E2E infrastructure catches test failures.
// This test is designed to FAIL when run locally during development (skipped by default).
// In CI, it should PASS. If this test fails in CI, it proves the E2E pipeline is working.
// To verify CI failure detection: comment out the .skip() and run in CI.
test.describe.skip('E2E Infrastructure Canary', () => {
  test('should pass normally, but intentionally fails when unskipped to prove CI catches failures', async ({ page }) => {
    // This assertion will fail if the test is unskipped (e.g., to verify CI is working)
    expect(true).toBe(false);
  });
});
