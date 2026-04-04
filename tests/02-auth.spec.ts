import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  test('login with valid credentials redirects away from /login', async ({ page }) => {
    // Skip if no test user available
    const email = process.env.QA_ADMIN_EMAIL ?? 'superadmin@cooperebr.com.br';
    const password = process.env.QA_ADMIN_PASSWORD ?? 'SuperAdmin@2026';

    await page.goto('/login');
    await page.locator('#identificador').fill(email);
    await page.locator('#senha').fill(password);
    await page.getByRole('button', { name: /entrar/i }).click();

    // Should redirect to /selecionar-contexto or /dashboard
    await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 15000 });
    expect(page.url()).not.toContain('/login');
  });

  test('login with invalid credentials shows error message', async ({ page }) => {
    await page.goto('/login');
    await page.locator('#identificador').fill('invalido@naoexiste.com');
    await page.locator('#senha').fill('senhaerrada123');
    await page.getByRole('button', { name: /entrar/i }).click();

    // Wait for error message
    const errorMsg = page.locator('text=inválidos');
    await expect(errorMsg).toBeVisible({ timeout: 10000 });
  });

  test('portal login with invalid credentials shows error', async ({ page }) => {
    await page.goto('/portal/login');
    await page.locator('#identificador').fill('invalido@naoexiste.com');
    await page.locator('#senha').fill('senhaerrada123');
    await page.getByRole('button', { name: /entrar/i }).click();

    const errorMsg = page.locator('text=incorretos');
    await expect(errorMsg).toBeVisible({ timeout: 10000 });
  });
});
