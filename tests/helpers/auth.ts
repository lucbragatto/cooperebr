import { type Page, expect } from '@playwright/test';

const ADMIN_EMAIL = process.env.QA_ADMIN_EMAIL ?? 'superadmin@cooperebr.com.br';
const ADMIN_PASSWORD = process.env.QA_ADMIN_PASSWORD ?? 'SuperAdmin@2026';

const COOPERADO_EMAIL = process.env.QA_COOPERADO_EMAIL ?? 'maria.silva@gmail.com';
const COOPERADO_PASSWORD = process.env.QA_COOPERADO_PASSWORD ?? 'Teste@123';

/**
 * Login via admin panel (/login) and wait for redirect.
 */
export async function loginAsAdmin(page: Page): Promise<void> {
  await page.goto('/login');
  await page.locator('#identificador').fill(ADMIN_EMAIL);
  await page.locator('#senha').fill(ADMIN_PASSWORD);
  await page.getByRole('button', { name: /entrar/i }).click();
  // Wait for redirect away from /login
  await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 15000 });
}

/**
 * Login via portal (/portal/login) and wait for redirect.
 */
export async function loginAsCooperado(page: Page): Promise<void> {
  await page.goto('/portal/login');
  await page.locator('#identificador').fill(COOPERADO_EMAIL);
  await page.locator('#senha').fill(COOPERADO_PASSWORD);
  await page.getByRole('button', { name: /entrar/i }).click();
  await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 15000 });
}
