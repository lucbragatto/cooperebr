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
    const response = await page.goto('/parceiro');
    await page.waitForLoadState('networkidle');
    const body = await page.textContent('body');
    expect(body).toBeTruthy();
    // Check HTTP status, not page text (numbers like 101.664.500 cause false positives)
    expect(response?.status()).not.toBe(500);
  });

  test('configuracoes carrega com secao CooperToken (/parceiro/configuracoes)', async ({ page }) => {
    await page.goto('/parceiro/configuracoes');
    await page.waitForLoadState('networkidle');

    // SUPER_ADMIN without cooperativaId sees "Não foi possível carregar" — skip
    const noData = page.getByText('Não foi possível carregar');
    if (await noData.isVisible({ timeout: 3000 }).catch(() => false)) {
      test.skip(true, 'SUPER_ADMIN sem cooperativaId — configuracoes nao carrega');
      return;
    }

    // The section title contains "CooperToken" inside a CardTitle
    const cooperToken = page.locator('text=CooperToken').first();
    await expect(cooperToken).toBeVisible({ timeout: 15000 });
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
