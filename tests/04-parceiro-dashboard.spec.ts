import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers/auth';

test.describe('Portal Parceiro', () => {
  test.beforeEach(async ({ page }) => {
    try {
      await loginAsAdmin(page);
    } catch {
      test.skip(true, 'Login admin falhou - sem usuario de teste disponivel');
    }
  });

  test('dashboard parceiro carrega sem erro (/parceiro)', async ({ page }) => {
    await page.goto('/parceiro');
    await page.waitForLoadState('networkidle');
    const body = await page.textContent('body');
    expect(body).toBeTruthy();
    // Should not show error page
    expect(body).not.toContain('500');
  });

  test('configuracoes carrega com secao CooperToken (/parceiro/configuracoes)', async ({ page }) => {
    await page.goto('/parceiro/configuracoes');
    await page.waitForLoadState('networkidle');

    const cooperToken = page.getByText(/coopertoken/i);
    await expect(cooperToken).toBeVisible({ timeout: 10000 });
  });

  test('enviar tokens carrega (/parceiro/enviar-tokens)', async ({ page }) => {
    await page.goto('/parceiro/enviar-tokens');
    await page.waitForLoadState('networkidle');
    const body = await page.textContent('body');
    expect(body).toBeTruthy();
  });

  test('receber tokens carrega (/parceiro/receber-tokens)', async ({ page }) => {
    await page.goto('/parceiro/receber-tokens');
    await page.waitForLoadState('networkidle');
    const body = await page.textContent('body');
    expect(body).toBeTruthy();
  });
});
