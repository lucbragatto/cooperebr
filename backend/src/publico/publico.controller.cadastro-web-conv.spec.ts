/**
 * D-novo-CADWEB-CONV-TENANT (05/06/2026) — specs do fix do gate inicial
 * de POST /publico/cadastro-web quando o cadastro vem via convite público
 * (?conv=<token>).
 *
 * Bug original: handler só conhecia `body.cooperativaId` e `?tenant=` como
 * fontes de tenant. Link de convite por WhatsApp não tem `?tenant=`, e
 * `NEXT_PUBLIC_COOPERATIVA_ID` no celular real é vazio → wizard quebrava
 * com 400 "cooperativaId ou query param ?tenant= é obrigatório no modo v2",
 * mesmo com `payload.token` chegando no body.
 *
 * Fix: deriva cooperativaId do convênio do convite server-side, espelhando
 * o padrão anti-spoof já usado em /auto-inscrever (linha 568).
 *
 * Cobertura:
 *  1. token válido sem cooperativaId/?tenant= → resolve do convite
 *  2. token válido + body.cooperativaId diferente → anti-spoof (convite vence)
 *  3. token inválido sem fallback → 400 "Convite inválido ou expirado"
 *  4. token inválido + body.cooperativaId presente → 400 "Convite inválido ou expirado"
 *     (não cai no fallback — token corrompido = erro claro, mesmo com tenant alternativo)
 *  5. sem token e sem cooperativaId/?tenant= → 400 genérico (regressão guard)
 */
import { BadRequestException } from '@nestjs/common';
import { PublicoController } from './publico.controller';

describe('PublicoController.cadastroWeb — resolução de tenant via convite (?conv=)', () => {
  let controller: PublicoController;
  let prismaMock: {
    conviteConvenioMembro: {
      findUnique: jest.Mock;
    };
  };
  let cadastroWebV2Mock: jest.Mock;
  const originalEnv = process.env.CADASTRO_V2_ATIVO;

  beforeEach(() => {
    process.env.CADASTRO_V2_ATIVO = 'true';

    prismaMock = {
      conviteConvenioMembro: {
        findUnique: jest.fn(),
      },
    };

    controller = Object.create(PublicoController.prototype);
    (controller as any).prisma = prismaMock;
    (controller as any).logger = { log: jest.fn(), warn: jest.fn(), error: jest.fn() };

    cadastroWebV2Mock = jest.fn().mockResolvedValue({ ok: true });
    (controller as any).cadastroWebV2 = cadastroWebV2Mock;
  });

  afterEach(() => {
    process.env.CADASTRO_V2_ATIVO = originalEnv;
    jest.clearAllMocks();
  });

  const bodyBase = (overrides: Record<string, unknown> = {}) => ({
    nome: 'Convidado Teste',
    cpf: '12345678901',
    email: 'convidado@example.com',
    telefone: '5527999999999',
    endereco: { cep: '29100000', logradouro: 'R X', numero: '1', bairro: 'B', cidade: 'Vitória', estado: 'ES' },
    instalacao: { numeroUC: '0001234567', distribuidora: 'EDP_ES', consumoMedioKwh: 300 },
    ...overrides,
  });

  // ─── Cenário 1 — caminho feliz: token resolve tenant ───────────
  it('1) token válido sem cooperativaId/?tenant= → resolve do convite', async () => {
    prismaMock.conviteConvenioMembro.findUnique.mockResolvedValue({
      cooperativaId: 'coop-derivada-do-convite',
    });

    const body = bodyBase({ token: 'tok_abc123', origem: 'CONVITE_PUBLICO' });

    await controller.cadastroWeb(body as any, undefined);

    expect(prismaMock.conviteConvenioMembro.findUnique).toHaveBeenCalledWith({
      where: { token: 'tok_abc123' },
      select: { cooperativaId: true },
    });
    expect(cadastroWebV2Mock).toHaveBeenCalledTimes(1);
    expect(cadastroWebV2Mock).toHaveBeenCalledWith(body, 'coop-derivada-do-convite');
  });

  // ─── Cenário 2 — anti-spoof: convite sobrepõe body.cooperativaId ─
  it('2) token válido + body.cooperativaId diferente → convite vence (anti-spoof cross-tenant)', async () => {
    prismaMock.conviteConvenioMembro.findUnique.mockResolvedValue({
      cooperativaId: 'coop-real-do-convite',
    });

    const body = bodyBase({
      token: 'tok_xyz789',
      origem: 'CONVITE_PUBLICO',
      cooperativaId: 'coop-spoofed-pelo-client', // tentativa de spoof
    });

    await controller.cadastroWeb(body as any, 'tenant-via-query-spoof');

    expect(cadastroWebV2Mock).toHaveBeenCalledWith(body, 'coop-real-do-convite');
    expect(cadastroWebV2Mock).not.toHaveBeenCalledWith(body, 'coop-spoofed-pelo-client');
    expect(cadastroWebV2Mock).not.toHaveBeenCalledWith(body, 'tenant-via-query-spoof');
  });

  // ─── Cenário 3 — token inválido sem fallback ─────────────────────
  it('3) token presente mas convite não existe → 400 "Convite inválido ou expirado"', async () => {
    prismaMock.conviteConvenioMembro.findUnique.mockResolvedValue(null);

    const body = bodyBase({ token: 'tok_invalido' });

    await expect(
      controller.cadastroWeb(body as any, undefined),
    ).rejects.toThrow(BadRequestException);
    await expect(
      controller.cadastroWeb(body as any, undefined),
    ).rejects.toThrow('Convite inválido ou expirado.');

    expect(cadastroWebV2Mock).not.toHaveBeenCalled();
  });

  // ─── Cenário 4 — token inválido + body.cooperativaId presente ────
  it('4) token inválido + body.cooperativaId presente → 400 (NÃO cai no fallback)', async () => {
    prismaMock.conviteConvenioMembro.findUnique.mockResolvedValue(null);

    const body = bodyBase({
      token: 'tok_revogado',
      cooperativaId: 'coop-alternativa', // não deve mascarar o erro
    });

    await expect(
      controller.cadastroWeb(body as any, undefined),
    ).rejects.toThrow('Convite inválido ou expirado.');

    expect(cadastroWebV2Mock).not.toHaveBeenCalled();
  });

  // ─── Cenário 5 — sem token e sem cooperativaId (regressão guard) ─
  it('5) sem token e sem cooperativaId/?tenant= → 400 genérico (regressão original)', async () => {
    const body = bodyBase(); // sem token, sem cooperativaId

    await expect(
      controller.cadastroWeb(body as any, undefined),
    ).rejects.toThrow('cooperativaId ou query param ?tenant= é obrigatório no modo v2');

    expect(prismaMock.conviteConvenioMembro.findUnique).not.toHaveBeenCalled();
    expect(cadastroWebV2Mock).not.toHaveBeenCalled();
  });

  // ─── Bônus: sem token mas com ?tenant= → caminho legado funciona ─
  it('bônus) sem token mas com ?tenant= → usa tenantParam, não consulta convite', async () => {
    const body = bodyBase();

    await controller.cadastroWeb(body as any, 'tenant-via-query');

    expect(prismaMock.conviteConvenioMembro.findUnique).not.toHaveBeenCalled();
    expect(cadastroWebV2Mock).toHaveBeenCalledWith(body, 'tenant-via-query');
  });
});
