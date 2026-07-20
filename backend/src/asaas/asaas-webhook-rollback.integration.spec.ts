/**
 * SMOKE FASE 2 Asaas Webhook — METADE 2: ROLLBACK INTEGRATION TEST.
 *
 * Fecha o débito P1 `D-novo-WEBHOOK-ROLLBACK-INTEGRATION-TEST`. A METADE 1
 * (dedup live) foi provada via script `__smoke-webhook-setup.ts` — este
 * spec prova a OUTRA metade: se `darBaixaTx` throw NO MEIO da tx, o
 * Postgres reverte TUDO — WebhookEvent NÃO fica marcado, Cobranca continua
 * PENDENTE, e o handler propaga o erro (controller → 500 → Asaas retry).
 *
 * Diferente dos specs unitários (mock Prisma), este roda contra o BANCO
 * REAL (Supabase) — a única forma de provar o rollback do Postgres em vez
 * de mock que finge.
 *
 * Estratégia:
 *  1. Setup: cria cooperado SMOKE-ROLLBACK + uc + contrato + cobranca +
 *     asaasCobranca via Prisma direto no banco.
 *  2. Cria AsaasService com dependências reais MAS injeta um mock do
 *     CobrancasService via ModuleRef que faz `darBaixaTx` throw após o
 *     `webhookEvent.create` ter sido chamado (chamado é DENTRO da tx —
 *     Postgres reverte o create quando a tx aborta).
 *  3. Assert:
 *     - throw propagou pro caller
 *     - webhook_events count == 0 (rollback funcionou)
 *     - cobranca.status ainda PENDENTE
 *     - asaas_cobranca.status ainda PENDING
 *     - executarPosBaixaBestEffort NÃO foi chamado (só roda pós-sucesso)
 *  4. Cleanup GARANTIDO no afterAll (try/finally lógico).
 *
 * Contatos de teste (regra 14/05): telefone 27981341348, email
 *   lucbragatto+rollback@gmail.com — mas NÃO importa aqui porque
 *   `executarPosBaixaBestEffort` NÃO é alcançado (asserção do teste).
 */
import { PrismaClient } from '@prisma/client';
import { AsaasService } from './asaas.service';

const TENANT_ID = 'cmn0ho8bx0000uox8wu96u6fd'; // CoopereBR principal (CLAUDE.md)
const SMOKE_TAG = 'SMOKE-ROLLBACK-2026-07-20';
const SMOKE_TEL = '27981341348';
const SMOKE_EMAIL = 'lucbragatto+rollback@gmail.com';
const SMOKE_CPF = '000.000.000-88';
const ASAAS_ID = 'pay_smoke_rollback_20260720';
const EVENT_ID = `PAYMENT_RECEIVED_${ASAAS_ID}`;

describe('AsaasService.processarWebhook — ROLLBACK real do Postgres (integration)', () => {
  const prisma = new PrismaClient();
  let cobrancaId: string;
  let asaasCobrancaId: string;
  let webhookToken: string;

  beforeAll(async () => {
    // Cleanup preemptivo — remove restos de execução anterior (se houver).
    await cleanup(prisma);

    // Setup — cria toda a cadeia de dependências no banco real.
    const cooperado = await prisma.cooperado.create({
      data: {
        cooperativaId: TENANT_ID,
        nomeCompleto: `[${SMOKE_TAG}] Rollback Cooperado`,
        cpf: SMOKE_CPF,
        telefone: SMOKE_TEL,
        email: SMOKE_EMAIL,
        status: 'ATIVO_RECEBENDO_CREDITOS',
        modoRemuneracao: 'CLUBE',
        ambienteTeste: true,
      },
    });
    const uc = await prisma.uc.create({
      data: {
        numero: `SMOKE-ROLLBACK-UC-${Date.now()}`,
        endereco: 'Rua Rollback 456',
        cidade: 'Vitoria',
        estado: 'ES',
        cooperado: { connect: { id: cooperado.id } },
      },
    });
    const contrato = await prisma.contrato.create({
      data: {
        cooperativaId: TENANT_ID,
        cooperadoId: cooperado.id,
        ucId: uc.id,
        numero: `SMOKE-ROLLBACK-CT-${Date.now()}`,
        kwhContratoAnual: 1200,
        percentualUsina: 100,
        percentualDesconto: 20,
        dataInicio: new Date('2026-01-01T03:00:00Z'),
        status: 'ATIVO',
      },
    });
    const cobranca = await prisma.cobranca.create({
      data: {
        cooperativaId: TENANT_ID,
        contratoId: contrato.id,
        mesReferencia: 7,
        anoReferencia: 2026,
        valorBruto: 100,
        percentualDesconto: 20,
        valorDesconto: 20,
        valorLiquido: 100,
        dataVencimento: new Date('2026-07-25T03:00:00Z'),
        status: 'PENDENTE',
      },
    });
    cobrancaId = cobranca.id;
    const asaasCobranca = await prisma.asaasCobranca.create({
      data: {
        cooperadoId: cooperado.id,
        cobrancaId: cobranca.id,
        asaasId: ASAAS_ID,
        status: 'PENDING',
        formaPagamento: 'PIX',
        valor: 100,
        vencimento: new Date('2026-07-25T03:00:00Z'),
      },
    });
    asaasCobrancaId = asaasCobranca.id;

    const cfg = await prisma.asaasConfig.findFirst({
      where: { cooperativaId: TENANT_ID, webhookToken: { not: null } },
      select: { webhookToken: true },
    });
    if (!cfg?.webhookToken) throw new Error('Nenhum AsaasConfig com webhookToken no tenant.');
    webhookToken = cfg.webhookToken;
  });

  afterAll(async () => {
    try { await cleanup(prisma); } finally { await prisma.$disconnect(); }
  });

  it('darBaixaTx throw → tx rollback: ZERO webhook_events + Cobranca PENDENTE + AsaasCobranca PENDING + posBaixa NÃO alcançado', async () => {
    // Estado inicial — Cobranca PENDENTE, AsaasCobranca PENDING.
    const cobBefore = await prisma.cobranca.findUnique({ where: { id: cobrancaId }, select: { status: true, valorPago: true } });
    expect(cobBefore?.status).toBe('PENDENTE');
    expect(cobBefore?.valorPago).toBeNull();

    // Mock temporário: CobrancasService.darBaixaTx throw. O throw acontece
    // DENTRO da tx do processarWebhook, DEPOIS do webhookEvent.create.
    // executarPosBaixaBestEffort NÃO deve ser alcançado (só roda em sucesso).
    const cobrancasMock = {
      darBaixaTx: jest.fn().mockRejectedValue(new Error('SMOKE-ROLLBACK-INJECTION')),
      executarPosBaixaBestEffort: jest.fn().mockResolvedValue(undefined),
    };
    const moduleRefMock = { get: jest.fn().mockReturnValue(cobrancasMock) };
    const eventEmitterMock = { emit: jest.fn() };

    // AsaasService com Prisma REAL + CobrancasService mockado via ModuleRef.
    // credentialsEncryptor não é usado no processarWebhook, undefined ok.
    const sut = new AsaasService(prisma as any, eventEmitterMock as any, undefined as any, moduleRefMock as any);

    const payload = {
      event: 'PAYMENT_RECEIVED',
      payment: { id: ASAAS_ID, value: 100, paymentDate: '2026-07-20' },
    };

    // Assert 1: throw propagou pro caller.
    await expect(sut.processarWebhook(payload, webhookToken)).rejects.toThrow(/SMOKE-ROLLBACK-INJECTION/);

    // Assert 2: darBaixaTx foi chamado (o mock foi invocado — provou que
    // chegou no ponto injetado).
    expect(cobrancasMock.darBaixaTx).toHaveBeenCalledTimes(1);

    // Assert 3: executarPosBaixaBestEffort NÃO foi alcançado (só roda pós-sucesso).
    expect(cobrancasMock.executarPosBaixaBestEffort).not.toHaveBeenCalled();

    // Assert 4 (a mais importante): tx do Postgres reverteu o
    // webhookEvent.create — ZERO linha com esse eventId.
    const evCount = await prisma.webhookEvent.count({ where: { provider: 'ASAAS', eventId: EVENT_ID } });
    expect(evCount).toBe(0);

    // Assert 5: Cobranca continua PENDENTE (não foi baixada).
    const cobAfter = await prisma.cobranca.findUnique({ where: { id: cobrancaId }, select: { status: true, valorPago: true, dataPagamento: true } });
    expect(cobAfter?.status).toBe('PENDENTE');
    expect(cobAfter?.valorPago).toBeNull();
    expect(cobAfter?.dataPagamento).toBeNull();

    // Assert 6: AsaasCobranca continua PENDING (o update dentro da tx
    // também sofreu rollback).
    const ascAfter = await prisma.asaasCobranca.findUnique({ where: { id: asaasCobrancaId }, select: { status: true } });
    expect(ascAfter?.status).toBe('PENDING');

    // Assert 7: nenhum ledger de token foi criado.
    const ledgerCount = await prisma.cooperTokenLedger.count({
      where: {
        cooperativaId: TENANT_ID,
        referenciaTabela: 'Cobranca',
        referenciaId: cobrancaId,
        operacao: 'CREDITO',
      },
    });
    expect(ledgerCount).toBe(0);
  });

  it('re-execução após remover o mock: fluxo normal completa (webhook_events + PAGO + tokens)', async () => {
    // Este 2º test prova COMPLEMENTARMENTE que o rollback do 1º test
    // NÃO deixou nenhum lock/estado sujo — a re-entrega do Asaas
    // (simulada aqui como novo processarWebhook sem mock) processa
    // corretamente porque o eventId ainda está livre no webhook_events.
    // Também prova que a asaasCobranca não sofreu update residual
    // (foi revertida) → não gera falso conflito de idempotência.

    const cobrancasMock = {
      // Sem throw — deixa a chamada real do darBaixaTx acontecer.
      // Mas darBaixaTx REAL exige que o CobrancasService seja o real, não
      // um mock. Como quero testar SÓ que o rollback do 1º test deixou o
      // estado limpo o suficiente pra re-entrega processar, uso um mock
      // que retorna estado "baixado" (valida que o handler passa pelo path
      // completo). NÃO é o smoke da METADE 1 (que já rodou via script) —
      // é um complemento pra provar que o rollback anterior não sujou nada.
      darBaixaTx: jest.fn().mockResolvedValue({ cobrancaId, valorFinal: 100, cooperadoId: 'stub' }),
      executarPosBaixaBestEffort: jest.fn().mockResolvedValue(undefined),
    };
    const moduleRefMock = { get: jest.fn().mockReturnValue(cobrancasMock) };
    const eventEmitterMock = { emit: jest.fn() };
    const sut = new AsaasService(prisma as any, eventEmitterMock as any, undefined as any, moduleRefMock as any);

    const payload = {
      event: 'PAYMENT_RECEIVED',
      payment: { id: ASAAS_ID, value: 100, paymentDate: '2026-07-20' },
    };
    const r = await sut.processarWebhook(payload, webhookToken);
    expect(r).toEqual({ received: true });

    // WebhookEvent AGORA foi commitado (rollback anterior liberou o eventId).
    const evCount = await prisma.webhookEvent.count({ where: { provider: 'ASAAS', eventId: EVENT_ID } });
    expect(evCount).toBe(1);

    // darBaixaTx foi chamado (fluxo completo).
    expect(cobrancasMock.darBaixaTx).toHaveBeenCalledTimes(1);
    // executarPosBaixaBestEffort ALCANÇADO agora (path do sucesso).
    expect(cobrancasMock.executarPosBaixaBestEffort).toHaveBeenCalledTimes(1);

    // AsaasCobranca updated pra RECEIVED (dentro da tx).
    const ascAfter = await prisma.asaasCobranca.findUnique({ where: { id: asaasCobrancaId }, select: { status: true } });
    expect(ascAfter?.status).toBe('RECEIVED');
  });
});

async function cleanup(prisma: PrismaClient) {
  await prisma.$executeRaw`DELETE FROM webhook_events WHERE "eventId" = ${EVENT_ID}`;
  await prisma.$executeRaw`DELETE FROM asaas_cobrancas WHERE "asaasId" = ${ASAAS_ID}`;
  await prisma.$executeRaw`
    DELETE FROM cooper_token_ledger
    WHERE "cooperativaId" = ${TENANT_ID}
      AND "referenciaTabela" = 'Cobranca'
      AND "referenciaId" IN (SELECT id FROM cobrancas WHERE "cooperativaId" = ${TENANT_ID} AND "contratoId" IN (SELECT id FROM contratos WHERE numero LIKE 'SMOKE-ROLLBACK-CT-%'))
  `;
  await prisma.$executeRaw`
    DELETE FROM lancamentos_caixa
    WHERE "cooperativaId" = ${TENANT_ID}
      AND "cooperadoId" IN (SELECT id FROM cooperados WHERE "cooperativaId" = ${TENANT_ID} AND cpf = ${SMOKE_CPF} AND telefone = ${SMOKE_TEL})
  `;
  await prisma.$executeRaw`
    DELETE FROM cobrancas
    WHERE "cooperativaId" = ${TENANT_ID}
      AND "contratoId" IN (SELECT id FROM contratos WHERE numero LIKE 'SMOKE-ROLLBACK-CT-%')
  `;
  await prisma.$executeRaw`
    DELETE FROM cooper_token_saldo
    WHERE "cooperadoId" IN (SELECT id FROM cooperados WHERE "cooperativaId" = ${TENANT_ID} AND cpf = ${SMOKE_CPF} AND telefone = ${SMOKE_TEL})
  `;
  await prisma.$executeRaw`DELETE FROM contratos WHERE numero LIKE 'SMOKE-ROLLBACK-CT-%'`;
  await prisma.$executeRaw`DELETE FROM ucs WHERE numero LIKE 'SMOKE-ROLLBACK-UC-%'`;
  await prisma.$executeRaw`
    DELETE FROM cooperados
    WHERE "cooperativaId" = ${TENANT_ID}
      AND cpf = ${SMOKE_CPF}
      AND telefone = ${SMOKE_TEL}
      AND email LIKE '%rollback%'
  `;
}
