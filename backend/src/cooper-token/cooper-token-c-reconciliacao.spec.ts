/**
 * Sprint C Hardening (17/06/2026) — D-novo-RECONCILIACAO-CONTABIL-CRON P2.
 *
 * Cobre `CooperTokenJob.reconciliarContabilPendentes` — cron a cada 15min que
 * re-tenta `lancarResgatePix` em recibos `PAGO_CREDITO_PENDENTE`.
 *
 * Cenários cobertos:
 *  1. Sem recibos pendentes → cron retorna silenciosamente.
 *  2. Recibo elegível (proximaEm passou) + lancarResgatePix sucesso →
 *     status volta PAGO_RECIBO_EMITIDO + zera tentativas + zera
 *     motivoFalha + reconciliacaoProximaEm=null.
 *  3. Recibo elegível + falha (tentativa < MAX) → tentativas++ +
 *     reconciliacaoUltimaEm + reconciliacaoProximaEm agendada via
 *     backoff [5, 30, 120, 720, 1440] minutos.
 *  4. Recibo elegível + 5ª falha consecutiva → DESISTIDO=true +
 *     AuditLog.create + emit evento `reconciliacao-desistido`.
 *  5. Recibo com proximaEm FUTURO → não é processado nesse ciclo.
 *  6. Recibo já DESISTIDO → não é re-tentado.
 *  7. Recibo status ≠ PAGO_CREDITO_PENDENTE → não é processado
 *     (defense in depth: query já filtra).
 *  8. Sem TokenContabilService injetado (spec antigo) → cron pula
 *     silenciosamente sem throw.
 *  9. Multi-tenant: cron processa recibos de TODOS os tenants no
 *     mesmo ciclo (não JWT-scoped).
 * 10. updateMany de sucesso usa `cooperativaId+id+status` no where
 *     (defense in depth multi-tenant).
 */
import { CooperTokenJob } from './cooper-token.job';

const COOP_A = 'coop-A-id';
const COOP_B = 'coop-B-id';

interface ReciboPendente {
  id: string;
  cooperativaId: string;
  cooperadoEstabelecimentoId: string;
  numeroRecibo: string;
  valorLiquidoReais: number;
  asaasTransferId: string | null;
  reconciliacaoTentativas: number;
  reconciliacaoDesistido: boolean;
  reconciliacaoProximaEm: Date | null;
  status: string;
}

interface SetupOpts {
  pendentes?: ReciboPendente[];
  lancarMock?: jest.Mock;
  injectarContabil?: boolean;
}

function setup(opts: SetupOpts = {}) {
  const pendentes = opts.pendentes ?? [];

  const findMany = jest.fn(async (args: any) => {
    const where = args.where ?? {};
    return pendentes.filter((r) => {
      if (where.status && r.status !== where.status) return false;
      if (
        where.reconciliacaoDesistido !== undefined &&
        r.reconciliacaoDesistido !== where.reconciliacaoDesistido
      )
        return false;
      if (where.reconciliacaoProximaEm?.lte) {
        if (!r.reconciliacaoProximaEm) return false;
        if (r.reconciliacaoProximaEm > where.reconciliacaoProximaEm.lte) return false;
      }
      return true;
    });
  });

  const updateMany = jest.fn(async (args: any) => {
    const where = args.where ?? {};
    let count = 0;
    for (const r of pendentes) {
      if (where.id && r.id !== where.id) continue;
      if (where.cooperativaId && r.cooperativaId !== where.cooperativaId) continue;
      if (where.status && r.status !== where.status) continue;
      Object.assign(r, args.data);
      count++;
    }
    return { count };
  });

  const auditCreate = jest.fn().mockResolvedValue({ id: 'audit-1' });

  const prisma: any = {
    resgateRecibo: { findMany, updateMany },
    auditLog: { create: auditCreate },
  };

  const lancarResgatePix = opts.lancarMock ?? jest.fn().mockResolvedValue({ id: 'lanc-1' });
  const tokenContabil: any = { lancarResgatePix };
  const eventEmitter = { emit: jest.fn() };
  const cooperTokenService: any = {};

  const job = new CooperTokenJob(
    prisma,
    cooperTokenService,
    opts.injectarContabil === false ? undefined : tokenContabil,
    eventEmitter as any,
  );

  return { job, prisma, pendentes, lancarResgatePix, eventEmitter, auditCreate };
}

function novoRecibo(over: Partial<ReciboPendente> = {}): ReciboPendente {
  return {
    id: `rec-${Math.random().toString(36).slice(2, 8)}`,
    cooperativaId: COOP_A,
    cooperadoEstabelecimentoId: 'coop-pf-1',
    numeroRecibo: 'RES-2026-00099',
    valorLiquidoReais: 4.5,
    asaasTransferId: 'asaas-tx-1',
    reconciliacaoTentativas: 0,
    reconciliacaoDesistido: false,
    reconciliacaoProximaEm: new Date(Date.now() - 60_000), // já passou
    status: 'PAGO_CREDITO_PENDENTE',
    ...over,
  };
}

describe('Sprint C — reconciliarContabilPendentes', () => {
  it('1. sem recibos pendentes → retorna silenciosamente (não chama lancarResgatePix)', async () => {
    const { job, lancarResgatePix } = setup({ pendentes: [] });
    await job.reconciliarContabilPendentes();
    expect(lancarResgatePix).not.toHaveBeenCalled();
  });

  it('2. recibo elegível + sucesso → status PAGO_RECIBO_EMITIDO + zera retry', async () => {
    const r = novoRecibo();
    const { job, lancarResgatePix } = setup({ pendentes: [r] });

    await job.reconciliarContabilPendentes();

    expect(lancarResgatePix).toHaveBeenCalledTimes(1);
    expect(r.status).toBe('PAGO_RECIBO_EMITIDO');
    expect(r.reconciliacaoTentativas).toBe(0);
    expect(r.reconciliacaoProximaEm).toBeNull();
    expect(r.reconciliacaoDesistido).toBe(false);
    expect((r as any).motivoFalha).toBeNull();
  });

  it('3. falha com tentativa 0 → tentativas=1 + próxima agendada em 5min (BACKOFF[0])', async () => {
    // P1 fix Sprint C (17/06): off-by-one corrigido. 1ª falha
    // (novaTentativa=1) agora usa BACKOFF_MINUTOS[novaTentativa-1]=BACKOFF[0]=5min,
    // não BACKOFF[1]=30min. Alinha com decisão Luciano aprovada.
    const r = novoRecibo({ reconciliacaoTentativas: 0 });
    const lancarMock = jest.fn().mockRejectedValue(new Error('Postgres timeout'));
    const { job } = setup({ pendentes: [r], lancarMock });

    const antes = Date.now();
    await job.reconciliarContabilPendentes();
    const depois = Date.now();

    expect(r.reconciliacaoTentativas).toBe(1);
    expect(r.reconciliacaoDesistido).toBe(false);
    expect(r.status).toBe('PAGO_CREDITO_PENDENTE'); // permanece pendente
    expect(r.reconciliacaoProximaEm).toBeInstanceOf(Date);
    const delaMs = r.reconciliacaoProximaEm!.getTime() - antes;
    // BACKOFF[0] = 5min em ms
    expect(delaMs).toBeGreaterThanOrEqual(5 * 60 * 1000 - (depois - antes) - 5000);
    expect(delaMs).toBeLessThanOrEqual(5 * 60 * 1000 + 5000);
  });

  it('4. 5ª falha consecutiva (tentativas=4 + falha) → DESISTIDO=true + AuditLog + evento', async () => {
    const r = novoRecibo({ reconciliacaoTentativas: 4 });
    const lancarMock = jest.fn().mockRejectedValue(new Error('Constraint violation'));
    const { job, auditCreate, eventEmitter } = setup({ pendentes: [r], lancarMock });

    await job.reconciliarContabilPendentes();

    expect(r.reconciliacaoTentativas).toBe(5);
    expect(r.reconciliacaoDesistido).toBe(true);
    expect(r.status).toBe('PAGO_CREDITO_PENDENTE'); // permanece pra admin ver
    expect(auditCreate).toHaveBeenCalledTimes(1);
    expect(auditCreate.mock.calls[0][0].data.acao).toBe(
      'cooper-token.reconciliacao.desistido',
    );
    expect(auditCreate.mock.calls[0][0].data.usuarioId).toBe('SYSTEM_CRON');
    expect(auditCreate.mock.calls[0][0].data.usuarioPerfil).toBe('SYSTEM');
    expect(eventEmitter.emit).toHaveBeenCalledWith(
      'cooper-token-resgate.reconciliacao-desistido',
      expect.objectContaining({
        reciboId: r.id,
        numeroRecibo: r.numeroRecibo,
        tentativas: 5,
      }),
    );
  });

  it('5. recibo com proximaEm FUTURA → NÃO é processado', async () => {
    const r = novoRecibo({
      reconciliacaoProximaEm: new Date(Date.now() + 60 * 60 * 1000), // +1h
    });
    const { job, lancarResgatePix } = setup({ pendentes: [r] });
    await job.reconciliarContabilPendentes();
    expect(lancarResgatePix).not.toHaveBeenCalled();
    expect(r.status).toBe('PAGO_CREDITO_PENDENTE'); // intocado
  });

  it('6. recibo já DESISTIDO → NÃO é re-tentado pelo cron', async () => {
    const r = novoRecibo({ reconciliacaoDesistido: true, reconciliacaoTentativas: 5 });
    const { job, lancarResgatePix } = setup({ pendentes: [r] });
    await job.reconciliarContabilPendentes();
    expect(lancarResgatePix).not.toHaveBeenCalled();
  });

  it('7. recibo status ≠ PAGO_CREDITO_PENDENTE → não é processado (query filtra)', async () => {
    const r = novoRecibo({ status: 'PAGO_RECIBO_EMITIDO' });
    const { job, lancarResgatePix } = setup({ pendentes: [r] });
    await job.reconciliarContabilPendentes();
    expect(lancarResgatePix).not.toHaveBeenCalled();
  });

  it('8. TokenContabilService NÃO injetado → cron pula silenciosamente (spec antigo)', async () => {
    const r = novoRecibo();
    const { job, lancarResgatePix } = setup({
      pendentes: [r],
      injectarContabil: false,
    });
    await job.reconciliarContabilPendentes();
    expect(r.status).toBe('PAGO_CREDITO_PENDENTE'); // intocado
    expect(lancarResgatePix).not.toHaveBeenCalled();
  });

  it('9. multi-tenant: cron processa recibos de COOP_A e COOP_B no MESMO ciclo', async () => {
    const r1 = novoRecibo({ cooperativaId: COOP_A, numeroRecibo: 'RES-A-001' });
    const r2 = novoRecibo({ cooperativaId: COOP_B, numeroRecibo: 'RES-B-001' });
    const { job, lancarResgatePix } = setup({ pendentes: [r1, r2] });

    await job.reconciliarContabilPendentes();

    expect(lancarResgatePix).toHaveBeenCalledTimes(2);
    expect(r1.status).toBe('PAGO_RECIBO_EMITIDO');
    expect(r2.status).toBe('PAGO_RECIBO_EMITIDO');
    // Confirma que cada call usou o cooperativaId correto.
    const coops = lancarResgatePix.mock.calls.map((c: any[]) => c[0].cooperativaId);
    expect(coops).toEqual(expect.arrayContaining([COOP_A, COOP_B]));
  });

  it('10. updateMany de sucesso usa where {id, cooperativaId, status} (defense in depth)', async () => {
    const r = novoRecibo();
    const { job, prisma } = setup({ pendentes: [r] });
    await job.reconciliarContabilPendentes();

    // Primeira updateMany é a do sucesso.
    const calls = prisma.resgateRecibo.updateMany.mock.calls;
    const sucessoCall = calls.find((c: any[]) =>
      c[0]?.data?.status === 'PAGO_RECIBO_EMITIDO',
    );
    expect(sucessoCall).toBeDefined();
    expect(sucessoCall[0].where.id).toBe(r.id);
    expect(sucessoCall[0].where.cooperativaId).toBe(r.cooperativaId);
    expect(sucessoCall[0].where.status).toBe('PAGO_CREDITO_PENDENTE');
  });

  it('11. backoff completo: tentativas 0→1→2→3→4→5 acerta cada backoff esperado (P1 fix off-by-one)', async () => {
    const BACKOFF = [5, 30, 120, 720, 1440]; // minutos
    // Simula 5 ciclos sequenciais — em cada um o cron falha e agenda
    // a próxima. Após o 5º ciclo (tentativa=5), desistido=true.
    // P1 fix Sprint C (17/06): ciclo i → novaTentativa=(i+1) → agenda
    // BACKOFF[novaTentativa-1] = BACKOFF[i]. Pré-fix usava BACKOFF[i+1].
    const r = novoRecibo();
    const lancarMock = jest.fn().mockRejectedValue(new Error('falha persistente'));

    for (let ciclo = 0; ciclo < 5; ciclo++) {
      r.reconciliacaoProximaEm = new Date(Date.now() - 1000);
      const { job } = setup({ pendentes: [r], lancarMock });
      const antes = Date.now();
      await job.reconciliarContabilPendentes();
      const depois = Date.now();
      expect(r.reconciliacaoTentativas).toBe(ciclo + 1);
      if (ciclo < 4) {
        // BACKOFF[ciclo] — pós-fix: 0→5min, 1→30min, 2→2h, 3→12h, 4→desistido.
        const esperadoMs = BACKOFF[ciclo] * 60 * 1000;
        const delaMs = r.reconciliacaoProximaEm!.getTime() - antes;
        expect(delaMs).toBeGreaterThanOrEqual(esperadoMs - (depois - antes) - 5000);
        expect(delaMs).toBeLessThanOrEqual(esperadoMs + 5000);
      }
    }
    // Após o 5º ciclo → desistido.
    expect(r.reconciliacaoDesistido).toBe(true);
    expect(r.reconciliacaoTentativas).toBe(5);
  });

  it('12. AuditLog metadata: valor arredondado em 2 casas + asaasTransferId truncado (LGPD)', async () => {
    // P2 review security + financeiro Sprint C (17/06): no AuditLog
    // forense de desistido, `valor` deve estar arredondado e
    // `asaasTransferId` truncado pra reduzir exposição em logs.
    const r = novoRecibo({ reconciliacaoTentativas: 4 });
    // Força valor com drift float (Decimal→Number típico).
    r.valorLiquidoReais = 4.499999999;
    const lancarMock = jest.fn().mockRejectedValue(new Error('persistente'));
    const { job, auditCreate } = setup({ pendentes: [r], lancarMock });

    await job.reconciliarContabilPendentes();

    expect(auditCreate).toHaveBeenCalledTimes(1);
    const meta = auditCreate.mock.calls[0][0].data.metadata;
    expect(meta.valor).toBe(4.5); // arredondado 2 casas
    expect(meta.asaasTransferIdPrefix).toMatch(/^asaas-tx…?$|^asaas-t…$|^[a-zA-Z0-9-]+…$/);
    expect(meta.asaasTransferIdPrefix.length).toBeLessThanOrEqual(10);
  });

  it('10b. updateMany de FALHA não-desistida usa where {id, cooperativaId, status} (defense in depth)', async () => {
    const r = novoRecibo({ reconciliacaoTentativas: 1 });
    const lancarMock = jest.fn().mockRejectedValue(new Error('temp'));
    const { job, prisma } = setup({ pendentes: [r], lancarMock });
    await job.reconciliarContabilPendentes();

    const calls = prisma.resgateRecibo.updateMany.mock.calls;
    const falhaCall = calls.find((c: any[]) =>
      c[0]?.data?.motivoFalha?.includes('tentativa 2/5'),
    );
    expect(falhaCall).toBeDefined();
    expect(falhaCall[0].where.id).toBe(r.id);
    expect(falhaCall[0].where.cooperativaId).toBe(r.cooperativaId);
    expect(falhaCall[0].where.status).toBe('PAGO_CREDITO_PENDENTE');
  });

  it('10c. updateMany de DESISTIDO usa where {id, cooperativaId, status} (defense in depth)', async () => {
    const r = novoRecibo({ reconciliacaoTentativas: 4 });
    const lancarMock = jest.fn().mockRejectedValue(new Error('persistente'));
    const { job, prisma } = setup({ pendentes: [r], lancarMock });
    await job.reconciliarContabilPendentes();

    const calls = prisma.resgateRecibo.updateMany.mock.calls;
    const desistidoCall = calls.find((c: any[]) =>
      c[0]?.data?.reconciliacaoDesistido === true,
    );
    expect(desistidoCall).toBeDefined();
    expect(desistidoCall[0].where.id).toBe(r.id);
    expect(desistidoCall[0].where.cooperativaId).toBe(r.cooperativaId);
    expect(desistidoCall[0].where.status).toBe('PAGO_CREDITO_PENDENTE');
  });
});
