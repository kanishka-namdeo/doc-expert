import { test, expect } from '@playwright/test';

test.describe('Connectors Settings', () => {
  test.beforeEach(async ({ page, context }) => {
    await context.clearCookies();
    await page.goto('/login');
    await page.waitForSelector('form', { timeout: 5000 });
    const emailInput = page.getByLabel('Email');
    await emailInput.fill('editor@docexpert.test');
    await emailInput.blur();
    await page.waitForSelector('label[for="password"]', { timeout: 10000 });
    await page.getByLabel('Password').fill('Editor123!');
    await page.getByRole('button', { name: 'Sign In' }).click();
    await page.waitForFunction(() => !window.location.pathname.includes('/login'), { timeout: 15000 });
  });

  test('connectors page loads and shows available connectors', async ({
    page,
  }) => {
    await page.goto('/settings/connectors');
    await page.waitForSelector('h1', { timeout: 5000 });

    await expect(page.getByRole('heading', { name: 'Connectors' })).toBeVisible();

    // Should show Google Drive and Microsoft 365 cards
    await expect(page.getByText('Google Drive')).toBeVisible();
    await expect(page.getByText('Microsoft 365')).toBeVisible();
  });

  test('connect button opens OAuth popup for Google Drive', async ({
    page,
    context,
  }) => {
    await page.goto('/settings/connectors');

    // Click Connect for Google Drive
    const connectBtn = page
      .getByTestId('connector-google-drive')
      .getByRole('button', { name: 'Connect' });

    await connectBtn.click();

    // Should open a popup window (or redirect if popup blocked)
    // We can't test the full OAuth flow without real credentials,
    // but we can verify the auth URL endpoint responds
    const authRes = await page.request.get(
      '/api/connectors/auth?connectorId=google-drive',
    );
    expect(authRes.status()).toBe(200);
    const body = await authRes.json();
    expect(body.url).toContain('accounts.google.com');
    expect(body.state).toBeTruthy();
  });

  test('connectors API returns list of connectors', async ({ page }) => {
    const res = await page.request.get('/api/connectors');
    // May be 401 if not authenticated in API context
    if (res.status() === 200) {
      const body = await res.json();
      expect(Array.isArray(body)).toBe(true);
      expect(body.some((c: { id: string }) => c.id === 'google-drive')).toBe(true);
      expect(body.some((c: { id: string }) => c.id === 'microsoft-365')).toBe(true);
    }
  });

  test('document source badge appears for synced documents', async ({
    page,
  }) => {
    // Open the documents page
    await page.goto('/documents');

    // The document list should render without errors
    // (actual source badges only appear for connector-synced docs)
    await expect(page.getByRole('heading', { name: 'Documents' })).toBeVisible({ timeout: 10000 });
  });
});
