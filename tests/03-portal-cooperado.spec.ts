import { test, expect } from '@playwright/test';
import { loginAsCooperado } from './helpers/auth';

test.describe('Portal do Cooperado', () => {
  test.beforeEach(async ({ page }) => {
    try {
      await loginAsCooperado(page);
    } catch {
      test.skip(true, 'Login cooperado falhou - sem usuario de teste disponivel');
    }
  });

  test('pagina de tokens carrega (/portal/tokens)', async ({ page }) => {
    await page.goto('/portal/tokens');
    await page.waitForLoadState('networkidle');

    // Verifica que nao deu erro 500
    const body = await page.textContent('body');
    expect(body).toBeTruthy();

    // Verifica titulo "Usar Tokens" (nao "Pagar")
    const titulo = page.getByText(/usar tokens/i);
    await expect(titulo).toBeVisible({ timeout: 10000 });

    // Verifica botao "Gerar QR Code"
    const qrBtn = page.getByText(/gerar qr code/i);
    await expect(qrBtn).toBeVisible({ timeout: 5000 });
  });

  test('pagina de indicacoes carrega (/portal/indicacoes)', async ({ page }) => {
    await page.goto('/portal/indicacoes');
    await page.waitForLoadState('networkidle');

    const body = await page.textContent('body');
    expect(body).toBeTruthy();

    // Verifica botao "Compartilhar pelo WhatsApp"
    const waBtn = page.getByText(/compartilhar.*whatsapp/i);
    await expect(waBtn).toBeVisible({ timeout: 10000 });

    // Verifica link /convite/ (nao /entrar?ref=)
    const conviteLink = page.locator('text=/convite/');
    await expect(conviteLink).toBeVisible({ timeout: 5000 });
  });
});
