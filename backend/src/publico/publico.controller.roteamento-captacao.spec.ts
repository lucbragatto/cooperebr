/**
 * FIX A.2 Frente 2 vitrines mínimas (01/07/2026) — specs do wiring de
 * notificação admin quando o motor roteador M48 classifica o cadastro como
 * A_MIGRACAO (lead de captação) ou AMBIGUO_ADMIN (caso ambíguo, decisão
 * manual).
 *
 * Bug latente pré-FIX: o motor M48 já gravava `roteamentoCaminho` +
 * `roteamentoRazao` nos 4 campos aditivos do Cooperado, mas o admin NUNCA
 * recebia aviso — o único disparo de `notificarAdminCreditosInjetados`
 * vivia no bloco legado v1 (morto pois `CADASTRO_V2_ATIVO=true`). Elo
 * OCR→captação quebrado.
 *
 * Cobertura:
 *  1. A_MIGRACAO → dispara `notificarAdminRoteamentoCaptacao` com dados corretos
 *  2. AMBIGUO_ADMIN → dispara
 *  3. C_NOVO → NÃO dispara (caso comum, sem atenção humana necessária)
 *  4. B_REDIRECT_PARCEIRO → NÃO dispara (só informativo)
 *  5. cadastroWebV2 retorna sem cooperadoId → NÃO dispara (safeguard nula)
 *  6. body.jaRecebeCreditosGd + fornecedorGdAtual chegam no motor roteador
 */
import { PublicoController } from './publico.controller';

describe('PublicoController.cadastroWeb — notificação admin roteamento V2 (FIX A.2)', () => {
  let controller: PublicoController;
  let cadastroWebV2Mock: jest.Mock;
  let notificarAdminRoteamentoMock: jest.Mock;
  let decidirCaminhoMock: jest.Mock;
  const originalEnv = process.env.CADASTRO_V2_ATIVO;

  beforeEach(() => {
    process.env.CADASTRO_V2_ATIVO = 'true';

    const prismaMock = {
      conviteConvenioMembro: { findUnique: jest.fn() },
      cooperativa: {
        findUnique: jest.fn().mockResolvedValue({ id: 'coop-tenant-valido', ativo: true }),
      },
    };

    controller = Object.create(PublicoController.prototype);
    (controller as any).prisma = prismaMock;
    (controller as any).logger = { log: jest.fn(), warn: jest.fn(), error: jest.fn() };

    decidirCaminhoMock = jest.fn();
    (controller as any).roteamentoCadastroService = { decidirCaminho: decidirCaminhoMock };

    cadastroWebV2Mock = jest.fn().mockResolvedValue({
      ok: true,
      data: { cooperadoId: 'coop-abc-123', ucId: 'uc-1' },
    });
    (controller as any).cadastroWebV2 = cadastroWebV2Mock;

    notificarAdminRoteamentoMock = jest.fn().mockResolvedValue(undefined);
    (controller as any).notificarAdminRoteamentoCaptacao = notificarAdminRoteamentoMock;
  });

  afterEach(() => {
    process.env.CADASTRO_V2_ATIVO = originalEnv;
    jest.clearAllMocks();
  });

  const bodyBase = (overrides: Record<string, unknown> = {}) => ({
    nome: 'Fulano de Teste',
    cpf: '12345678901',
    email: 'fulano@example.com',
    telefone: '5527999999999',
    endereco: { cep: '29100000', logradouro: 'R X', numero: '1', bairro: 'B', cidade: 'Vitória', estado: 'ES' },
    instalacao: { numeroUC: '0001234567', distribuidora: 'EDP_ES', consumoMedioKwh: 300 },
    ...overrides,
  });

  // ─── Cenário 1 — A_MIGRACAO dispara ─────────────────────────────
  it('1) A_MIGRACAO dispara notificarAdminRoteamentoCaptacao', async () => {
    decidirCaminhoMock.mockResolvedValue({
      caminho: 'A_MIGRACAO',
      razao: 'Fornecedor GD diferente detectado (Cooperativa X)',
    });

    await (controller as any).cadastroWeb(
      bodyBase({ jaRecebeCreditosGd: true, fornecedorGdAtual: 'Cooperativa X' }),
      'coop-tenant-valido',
    );

    // Espera bola dentro (não deu erro) — nota: fire-and-forget usa .catch(),
    // então precisamos flushar microtasks.
    await new Promise((r) => setImmediate(r));

    expect(notificarAdminRoteamentoMock).toHaveBeenCalledTimes(1);
    expect(notificarAdminRoteamentoMock).toHaveBeenCalledWith({
      cooperadoId: 'coop-abc-123',
      nome: 'Fulano de Teste',
      numeroUC: '0001234567',
      caminho: 'A_MIGRACAO',
      razao: 'Fornecedor GD diferente detectado (Cooperativa X)',
    });
  });

  // ─── Cenário 2 — AMBIGUO_ADMIN dispara ──────────────────────────
  it('2) AMBIGUO_ADMIN dispara notificarAdminRoteamentoCaptacao', async () => {
    decidirCaminhoMock.mockResolvedValue({
      caminho: 'AMBIGUO_ADMIN',
      razao: 'Alias parcial encontrado — decisão manual necessária',
    });

    await (controller as any).cadastroWeb(bodyBase(), 'coop-tenant-valido');
    await new Promise((r) => setImmediate(r));

    expect(notificarAdminRoteamentoMock).toHaveBeenCalledTimes(1);
    expect(notificarAdminRoteamentoMock).toHaveBeenCalledWith(
      expect.objectContaining({ caminho: 'AMBIGUO_ADMIN' }),
    );
  });

  // ─── Cenário 3 — C_NOVO NÃO dispara ─────────────────────────────
  it('3) C_NOVO (caso comum) NÃO dispara notificação — só ruído', async () => {
    decidirCaminhoMock.mockResolvedValue({
      caminho: 'C_NOVO',
      razao: 'Cadastro novo, sem sinal de GD anterior',
    });

    await (controller as any).cadastroWeb(bodyBase(), 'coop-tenant-valido');
    await new Promise((r) => setImmediate(r));

    expect(notificarAdminRoteamentoMock).not.toHaveBeenCalled();
  });

  // ─── Cenário 4 — B_REDIRECT_PARCEIRO NÃO dispara ────────────────
  it('4) B_REDIRECT_PARCEIRO (informativo) NÃO dispara notificação', async () => {
    decidirCaminhoMock.mockResolvedValue({
      caminho: 'B_REDIRECT_PARCEIRO',
      tenantAlvo: 'outro-tenant-sisgd',
      razao: 'Fornecedor GD atual é outro parceiro SISGD',
    });

    await (controller as any).cadastroWeb(bodyBase(), 'coop-tenant-valido');
    await new Promise((r) => setImmediate(r));

    expect(notificarAdminRoteamentoMock).not.toHaveBeenCalled();
  });

  // ─── Cenário 5 — cadastroWebV2 sem cooperadoId NÃO dispara ──────
  it('5) cadastroWebV2 retorna sem cooperadoId → NÃO dispara (safeguard)', async () => {
    decidirCaminhoMock.mockResolvedValue({
      caminho: 'A_MIGRACAO',
      razao: 'Motivo qualquer',
    });
    cadastroWebV2Mock.mockResolvedValueOnce({ ok: true, data: {} });

    await (controller as any).cadastroWeb(bodyBase(), 'coop-tenant-valido');
    await new Promise((r) => setImmediate(r));

    expect(notificarAdminRoteamentoMock).not.toHaveBeenCalled();
  });

  // ─── Cenário 6 — body.jaRecebeCreditosGd chega no motor ─────────
  it('6) body.jaRecebeCreditosGd + fornecedorGdAtual chegam no motor roteador', async () => {
    decidirCaminhoMock.mockResolvedValue({
      caminho: 'A_MIGRACAO',
      razao: 'x',
    });

    await (controller as any).cadastroWeb(
      bodyBase({
        jaRecebeCreditosGd: true,
        fornecedorGdAtual: 'Solar Verde',
      }),
      'coop-tenant-valido',
    );

    expect(decidirCaminhoMock).toHaveBeenCalledWith({
      jaRecebeCreditosGd: true,
      fornecedorGdAtual: 'Solar Verde',
      cooperativaIdSugerida: 'coop-tenant-valido',
    });
  });
});
