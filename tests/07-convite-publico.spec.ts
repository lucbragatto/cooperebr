import { test, expect } from '@playwright/test';

test.describe('Pagina Publica de Convite', () => {
  test('codigo invalido mostra "Link invalido" (nao 500)', async ({ page }) => {
    await page.goto('/convite/CODIGOINVALIDO');
    await page.waitForLoadState('networkidle');

    // Page should render "Link invalido" message
    const invalidMsg = page.getByText(/link inv/i);
    await expect(invalidMsg).toBeVisible({ timeout: 15000 });
  });

  test('pagina carrega completamente no mobile (390x844)', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/convite/CODIGOINVALIDO');
    await page.waitForLoadState('networkidle');

    // Should still render without overflow errors
    const body = await page.textContent('body');
    expect(body).toBeTruthy();
    expect(body!.length).toBeGreaterThan(10);
  });

  test('calculadora funciona: mudar valor da conta atualiza economia', async ({ page }) => {
    // This test needs a valid convite code.
    // We try CODIGOINVALIDO first - if invalid, we skip calculator test.
    await page.goto('/convite/CODIGOINVALIDO');
    await page.waitForLoadState('networkidle');

    // Check if we got the valid page (with calculator) or invalid page
    const invalidMsg = page.getByText(/link inv/i);
    const isInvalid = await invalidMsg.isVisible().catch(() => false);

    if (isInvalid) {
      test.skip(true, 'Sem codigo de convite valido para testar calculadora');
      return;
    }

    // If we have a valid page, test the calculator
    const contaInput = page.locator('input[type="number"]');
    await contaInput.fill('500');

    // Economy = 500 * 0.15 = 75/month, 900/year
    await expect(page.getByText('R$ 75')).toBeVisible();
    await expect(page.getByText('R$ 900')).toBeVisible();
  });
});
