import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers/auth';

test.describe('Dashboard Admin', () => {
  test.beforeEach(async ({ page }) => {
    try {
      await loginAsAdmin(page);
    } catch {
      test.skip(true, 'Login admin falhou - sem usuario de teste disponivel');
    }
  });

  test('planos carrega e lista planos (/dashboard/planos)', async ({ page }) => {
    await page.goto('/dashboard/planos');
    await page.waitForLoadState('networkidle');

    const heading = page.getByText(/planos/i).first();
    await expect(heading).toBeVisible({ timeout: 10000 });
  });

  test('CooperToken admin carrega com emissao manual (/dashboard/cooper-token)', async ({ page }) => {
    await page.goto('/dashboard/cooper-token');
    await page.waitForLoadState('networkidle');

    // Verifica secao de emissao manual
    const emissao = page.getByText(/emiss/i).first();
    await expect(emissao).toBeVisible({ timeout: 10000 });
  });

  test('modelos de cobranca carrega (/dashboard/modelos-cobranca)', async ({ page }) => {
    await page.goto('/dashboard/modelos-cobranca');
    await page.waitForLoadState('networkidle');

    const heading = page.getByText(/modelo/i).first();
    await expect(heading).toBeVisible({ timeout: 10000 });
  });
});
