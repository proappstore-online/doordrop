import { test, expect } from '@playwright/test';

test.describe('Flyer upload validation (Epic #32)', () => {
  const FAKE_USER = { id: 'gh:test-client-upload', login: 'test-upload', avatarUrl: null };
  const FAKE_TOKEN = 'fake-session-token';

  const fakeClientUser = {
    id: 'gh:test-client-upload',
    email: 'upload@example.com',
    name: 'Upload Test Client',
    photo_url: null,
    role: 'client',
    created_at: 1_700_000_000_000,
  };

  test.beforeEach(async ({ page }) => {
    // Mock authentication
    await page.addInitScript(
      ({ token, user }) => {
        localStorage.setItem(
          'fas:session:doordrop',
          JSON.stringify({ token, user, savedAt: Date.now() }),
        );
      },
      { token: FAKE_TOKEN, user: FAKE_USER },
    );

    // Mock auth endpoints
    await page.route('**/api.freeappstore.online/v1/auth/me', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(FAKE_USER) }),
    );

    // Mock worker user endpoint
    await page.route('**/.pas/worker/v1/me', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ user: fakeClientUser, needsRoleSelection: false }),
      }),
    );

    // Mock flyer list endpoint
    await page.route('**/.pas/worker/v1/users/gh:test-client-upload/flyers', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) }),
    );

    await page.goto('/app/flyers');
    await page.waitForSelector('h1:has-text("My Flyers")', { timeout: 10000 });
  });

  test('shows error for file too large', async ({ page }) => {
    // Click "Add Flyer" button
    const addButton = page.getByRole('button', { name: /Add Flyer/ });
    await addButton.click();

    // Wait for form to appear
    await page.waitForSelector('input[id="flyer-name"]');

    // Fill in flyer name
    const nameInput = page.locator('input[id="flyer-name"]');
    await nameInput.fill('Test Large File');

    // Create a file buffer larger than 10MB
    const largeBuffer = Buffer.alloc(11 * 1024 * 1024, 'x');

    // Upload the large file
    const fileInput = page.locator('input[type="file"]');
    const fileName = 'large-file.pdf';

    // Note: Playwright's setInputFiles can handle buffer data
    await fileInput.setInputFiles({
      name: fileName,
      mimeType: 'application/pdf',
      buffer: largeBuffer,
    });

    // Wait for preview or file to be processed
    await page.waitForTimeout(500);

    // Click submit button
    const submitButton = page.getByRole('button', { name: /Save Flyer/ });
    await submitButton.click();

    // Assert error message appears
    await expect(page.locator('text=File too large. Maximum size is 10 MB.')).toBeVisible();
  });

  test('shows error for invalid file type', async ({ page }) => {
    // Click "Add Flyer" button
    const addButton = page.getByRole('button', { name: /Add Flyer/ });
    await addButton.click();

    // Wait for form to appear
    await page.waitForSelector('input[id="flyer-name"]');

    // Fill in flyer name
    const nameInput = page.locator('input[id="flyer-name"]');
    await nameInput.fill('Test Invalid File');

    // Upload an invalid file type (txt)
    const fileInput = page.locator('input[type="file"]');

    const invalidBuffer = Buffer.from('This is a text file');
    await fileInput.setInputFiles({
      name: 'document.txt',
      mimeType: 'text/plain',
      buffer: invalidBuffer,
    });

    // Wait for file processing
    await page.waitForTimeout(500);

    // Click submit button
    const submitButton = page.getByRole('button', { name: /Save Flyer/ });
    await submitButton.click();

    // Assert error message appears
    await expect(page.locator('text=Invalid file type. Please upload a PDF, PNG, or JPG.')).toBeVisible();
  });

  test('accepts valid PNG file', async ({ page }) => {
    // Click "Add Flyer" button
    const addButton = page.getByRole('button', { name: /Add Flyer/ });
    await addButton.click();

    // Wait for form to appear
    await page.waitForSelector('input[id="flyer-name"]');

    // Fill in flyer name
    const nameInput = page.locator('input[id="flyer-name"]');
    await nameInput.fill('Test Valid PNG');

    // Create a minimal valid PNG file (~100 bytes)
    const pngBuffer = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, // PNG signature
      0x00, 0x00, 0x00, 0x0d, // IHDR chunk size
      0x49, 0x48, 0x44, 0x52, // IHDR
      0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, // 1x1 pixel
      0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, // 8-bit RGB, crc
      0xde, 0x00, 0x00, 0x00, 0x0c, // IDAT chunk size
      0x49, 0x44, 0x41, 0x54, // IDAT
      0x08, 0x99, 0x01, 0x01, 0x00, 0x00, 0xfe, 0xff, // Single pixel
      0x00, 0x00, 0x00, 0x02, 0x00, 0x01, 0xb1, 0xb9, // crc
      0xd3, 0xf8, 0x00, 0x00, 0x00, 0x00, // IEND
      0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82, // IEND crc
    ]);

    // Upload the valid file
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: 'design.png',
      mimeType: 'image/png',
      buffer: pngBuffer,
    });

    // Wait for preview
    await page.waitForTimeout(500);

    // Verify no error message
    const errorMessage = page.locator('text=File too large|Invalid file type');
    await expect(errorMessage).not.toBeVisible();
  });
});
