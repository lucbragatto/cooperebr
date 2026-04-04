import { test, expect } from '@playwright/test';
import { checkBackendHealth, checkFrontendHealth } from './helpers/api';

test.describe('Sanity Check', () => {
  test('backend responds (health check)', async () => {
    const healthy = await checkBackendHealth();
    expect(healthy).toBe(true);
  });

  test('frontend loads without 500', async ({ page }) => {
    const res = await page.goto('/');
    expect(res).not.toBeNull();
    expect(res!.status()).toBeLessThan(500);
  });

  test('public invite page loads without 500 (invalid code)', async ({ page }) => {
    const res = await page.goto('/convite/TESTE123');
    expect(res).not.toBeNull();
    expect(res!.status()).toBeLessThan(500);
    // Should show "Link invalido" or loading state, but NOT crash
    await page.waitForLoadState('networkidle');
    const body = await page.textContent('body');
    expect(body).toBeTruthy();
  });
});
