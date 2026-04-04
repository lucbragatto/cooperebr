import { test, expect } from '@playwright/test';
import { getToken, apiGet, checkBackendHealth } from './helpers/api';

const COOPERADO_EMAIL = process.env.QA_COOPERADO_EMAIL ?? 'maria.silva@gmail.com';
const COOPERADO_PASSWORD = process.env.QA_COOPERADO_PASSWORD ?? 'Teste@123';

const ADMIN_EMAIL = process.env.QA_ADMIN_EMAIL ?? 'superadmin@cooperebr.com.br';
const ADMIN_PASSWORD = process.env.QA_ADMIN_PASSWORD ?? 'SuperAdmin@2026';

test.describe('CooperToken API', () => {
  test.beforeAll(async () => {
    const healthy = await checkBackendHealth();
    if (!healthy) test.skip(true, 'Backend offline');
  });

  test('GET /cooper-token/saldo retorna saldoDisponivel para cooperado', async () => {
    let token: string;
    try {
      token = await getToken(COOPERADO_EMAIL, COOPERADO_PASSWORD);
    } catch {
      test.skip(true, 'Login cooperado falhou - sem usuario de teste');
      return;
    }

    const data = await apiGet('/cooper-token/saldo', token);
    expect(data).toHaveProperty('saldoDisponivel');
  });

  test('GET /cooper-token/admin/config retorna config para admin', async () => {
    let token: string;
    try {
      token = await getToken(ADMIN_EMAIL, ADMIN_PASSWORD);
    } catch {
      test.skip(true, 'Login admin falhou - sem usuario de teste');
      return;
    }

    const data = await apiGet('/cooper-token/admin/config', token);
    expect(data).toBeDefined();
  });

  test('GET /cooper-token/admin/resumo retorna dados para admin', async () => {
    let token: string;
    try {
      token = await getToken(ADMIN_EMAIL, ADMIN_PASSWORD);
    } catch {
      test.skip(true, 'Login admin falhou - sem usuario de teste');
      return;
    }

    const data = await apiGet('/cooper-token/admin/resumo', token);
    expect(data).toBeDefined();
  });
});
