/**
 * Sprint Clube P1 — F3 Bloco A (12/06/2026).
 *
 * Specs do helper mass-write. Cobertura:
 *  - Validações universais (cooperativaId, clientRequestId, items vazios)
 *  - Cap-check (default 200 + custom)
 *  - Idempotência por lote: CONFIRM com retry retorna resultado anterior
 *    + cria AuditLog *.IDEMPOTENT_RETRY
 *  - PREVIEW vs CONFIRM: writes só em CONFIRM
 *  - Alertas bloqueantes em CONFIRM → BadRequest
 *  - Alertas bloqueantes em PREVIEW → podeProsseguir=false (sem throw)
 *  - AuditLog após commit (fora da tx)
 *  - AuditLog falhando não derruba commit
 *  - Tx Serializable é passada ao $transaction
 */
import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  executarMassWrite,
  MASS_WRITE_CAP_DEFAULT,
  MassWriteAlerta,
} from './mass-write.helper';

interface ItemTeste {
  id: string;
  qtd: number;
}

function setup(opts: {
  itemsCount?: number;
  alertas?: MassWriteAlerta[];
  idempotenciaRetorna?: any;
  commitLanca?: Error;
  auditLogLanca?: Error;
} = {}) {
  const items: ItemTeste[] = Array.from({ length: opts.itemsCount ?? 3 }, (_, i) => ({
    id: `item-${i}`,
    qtd: 10,
  }));

  const transactionFn = jest.fn(
    async (cb: any, _o?: any) => cb({ /* tx mock */ }),
  );
  const auditLogCreate = opts.auditLogLanca
    ? jest.fn().mockRejectedValue(opts.auditLogLanca)
    : jest.fn().mockResolvedValue({});

  const prisma: any = {
    $transaction: transactionFn,
    auditLog: { create: auditLogCreate },
  };

  const verificarIdempotencia = jest
    .fn()
    .mockResolvedValue(opts.idempotenciaRetorna ?? null);

  const previewFn = jest.fn().mockResolvedValue({
    totalItens: items.length,
    alertas: opts.alertas ?? [],
    resumo: { somaQtd: items.reduce((a, b) => a + b.qtd, 0) },
  });

  const commitFn = opts.commitLanca
    ? jest.fn().mockRejectedValue(opts.commitLanca)
    : jest.fn().mockResolvedValue({ commitId: 'cmt-1', n: items.length });

  return { prisma, transactionFn, auditLogCreate, verificarIdempotencia, previewFn, commitFn, items };
}

const baseOpts = (over: Partial<any> = {}) => ({
  acao: 'MASS_WRITE_TESTE',
  cooperativaId: 'coop-A',
  usuarioId: 'usr-1',
  clientRequestId: 'uuid-12345678-test-1234-9999-aaaabbbbcccc',
  mode: 'CONFIRM' as const,
  ...over,
});

describe('MassWrite helper — validações universais', () => {
  it('cooperativaId vazio → BadRequest', async () => {
    const s = setup();
    await expect(
      executarMassWrite(s.prisma, {
        ...baseOpts({ cooperativaId: '' }),
        items: s.items,
        verificarIdempotencia: s.verificarIdempotencia,
        preview: s.previewFn,
        commit: s.commitFn,
      }),
    ).rejects.toThrow(/cooperativaId obrigatório/);
  });

  it('clientRequestId vazio → BadRequest pedindo UUID', async () => {
    const s = setup();
    await expect(
      executarMassWrite(s.prisma, {
        ...baseOpts({ clientRequestId: '' }),
        items: s.items,
        verificarIdempotencia: s.verificarIdempotencia,
        preview: s.previewFn,
        commit: s.commitFn,
      }),
    ).rejects.toThrow(/clientRequestId obrigatório/);
  });

  it('clientRequestId curto (<8) → BadRequest', async () => {
    const s = setup();
    await expect(
      executarMassWrite(s.prisma, {
        ...baseOpts({ clientRequestId: 'abc' }),
        items: s.items,
        verificarIdempotencia: s.verificarIdempotencia,
        preview: s.previewFn,
        commit: s.commitFn,
      }),
    ).rejects.toThrow(/clientRequestId obrigatório/);
  });

  it('items vazio → BadRequest', async () => {
    const s = setup({ itemsCount: 0 });
    await expect(
      executarMassWrite(s.prisma, {
        ...baseOpts(),
        items: [],
        verificarIdempotencia: s.verificarIdempotencia,
        preview: s.previewFn,
        commit: s.commitFn,
      }),
    ).rejects.toThrow(/Lote vazio/);
  });
});

describe('MassWrite helper — cap-check', () => {
  it('items.length > cap (default 200) → BadRequest com mensagem clara', async () => {
    const items = Array.from({ length: 201 }, (_, i) => ({ id: `i-${i}`, qtd: 1 }));
    const s = setup({ itemsCount: 0 });
    await expect(
      executarMassWrite(s.prisma, {
        ...baseOpts(),
        items,
        verificarIdempotencia: s.verificarIdempotencia,
        preview: s.previewFn,
        commit: s.commitFn,
      }),
    ).rejects.toThrow(/cap.*201.*200/);
  });

  it('cap customizado é respeitado', async () => {
    const items = Array.from({ length: 11 }, (_, i) => ({ id: `i-${i}`, qtd: 1 }));
    const s = setup({ itemsCount: 0 });
    await expect(
      executarMassWrite(s.prisma, {
        ...baseOpts(),
        items,
        cap: 10,
        verificarIdempotencia: s.verificarIdempotencia,
        preview: s.previewFn,
        commit: s.commitFn,
      }),
    ).rejects.toThrow(/cap.*11.*10/);
  });

  it('exatamente no cap NÃO bloqueia (boundary inclusive)', async () => {
    const items = Array.from(
      { length: MASS_WRITE_CAP_DEFAULT },
      (_, i) => ({ id: `i-${i}`, qtd: 1 }),
    );
    const s = setup({ itemsCount: 0 });
    const r = await executarMassWrite(s.prisma, {
      ...baseOpts(),
      items,
      verificarIdempotencia: s.verificarIdempotencia,
      preview: s.previewFn,
      commit: s.commitFn,
    });
    expect(r.modo).toBe('CONFIRM');
  });
});

describe('MassWrite helper — idempotência', () => {
  it('CONFIRM com idempotência hit retorna resultadoAnterior + idempotente=true', async () => {
    const previo = { commitId: 'cmt-OLD', n: 5 };
    const s = setup({ idempotenciaRetorna: previo });
    const r: any = await executarMassWrite(s.prisma, {
      ...baseOpts(),
      items: s.items,
      verificarIdempotencia: s.verificarIdempotencia,
      preview: s.previewFn,
      commit: s.commitFn,
    });
    expect(r.modo).toBe('CONFIRM');
    expect(r.idempotente).toBe(true);
    expect(r.resultado).toEqual(previo);
    // NÃO chamou commit nem preview de novo
    expect(s.commitFn).not.toHaveBeenCalled();
    expect(s.previewFn).not.toHaveBeenCalled();
  });

  it('CONFIRM idempotência hit cria AuditLog *.IDEMPOTENT_RETRY', async () => {
    const previo = { commitId: 'cmt-OLD' };
    const s = setup({ idempotenciaRetorna: previo });
    await executarMassWrite(s.prisma, {
      ...baseOpts(),
      items: s.items,
      verificarIdempotencia: s.verificarIdempotencia,
      preview: s.previewFn,
      commit: s.commitFn,
    });
    const auditCall = s.auditLogCreate.mock.calls[0][0];
    expect(auditCall.data.acao).toBe('MASS_WRITE_TESTE.IDEMPOTENT_RETRY');
    expect(auditCall.data.recursoId).toBe(baseOpts().clientRequestId);
  });

  it('PREVIEW NÃO chama verificarIdempotencia (preview pode repetir)', async () => {
    const s = setup();
    await executarMassWrite(s.prisma, {
      ...baseOpts({ mode: 'PREVIEW' as const }),
      items: s.items,
      verificarIdempotencia: s.verificarIdempotencia,
      preview: s.previewFn,
      commit: s.commitFn,
    });
    expect(s.verificarIdempotencia).not.toHaveBeenCalled();
  });

  it('AuditLog falhando no idempotency-hit NÃO derruba retorno', async () => {
    const previo = { commitId: 'cmt-OLD' };
    const s = setup({
      idempotenciaRetorna: previo,
      auditLogLanca: new Error('audit insert down'),
    });
    const r: any = await executarMassWrite(s.prisma, {
      ...baseOpts(),
      items: s.items,
      verificarIdempotencia: s.verificarIdempotencia,
      preview: s.previewFn,
      commit: s.commitFn,
    });
    expect(r.resultado).toEqual(previo);
  });
});

describe('MassWrite helper — PREVIEW mode', () => {
  it('PREVIEW retorna preview + podeProsseguir=true quando sem alertas bloqueantes', async () => {
    const s = setup({
      alertas: [{ codigo: 'A', mensagem: 'só aviso', severidade: 'aviso' }],
    });
    const r: any = await executarMassWrite(s.prisma, {
      ...baseOpts({ mode: 'PREVIEW' as const }),
      items: s.items,
      verificarIdempotencia: s.verificarIdempotencia,
      preview: s.previewFn,
      commit: s.commitFn,
    });
    expect(r.modo).toBe('PREVIEW');
    expect(r.podeProsseguir).toBe(true);
    expect(r.preview.alertas).toHaveLength(1);
  });

  it('PREVIEW com bloqueante → podeProsseguir=false (sem throw)', async () => {
    const s = setup({
      alertas: [
        { codigo: 'SALDO_INSUFICIENTE', mensagem: 'faltam 10', severidade: 'bloqueante' },
      ],
    });
    const r: any = await executarMassWrite(s.prisma, {
      ...baseOpts({ mode: 'PREVIEW' as const }),
      items: s.items,
      verificarIdempotencia: s.verificarIdempotencia,
      preview: s.previewFn,
      commit: s.commitFn,
    });
    expect(r.modo).toBe('PREVIEW');
    expect(r.podeProsseguir).toBe(false);
  });

  it('PREVIEW NÃO chama commit nem AuditLog principal', async () => {
    const s = setup();
    await executarMassWrite(s.prisma, {
      ...baseOpts({ mode: 'PREVIEW' as const }),
      items: s.items,
      verificarIdempotencia: s.verificarIdempotencia,
      preview: s.previewFn,
      commit: s.commitFn,
    });
    expect(s.commitFn).not.toHaveBeenCalled();
    // AuditLog principal não roda em PREVIEW (só roda no IDEMPOTENT_RETRY ou após commit).
    expect(s.auditLogCreate).not.toHaveBeenCalled();
  });
});

describe('MassWrite helper — CONFIRM mode', () => {
  it('CONFIRM com bloqueante → BadRequest com lista de alertas', async () => {
    const s = setup({
      alertas: [
        { codigo: 'SALDO_INSUFICIENTE', mensagem: 'faltam 10', severidade: 'bloqueante' },
        { codigo: 'CLT_NAO_CONFIRMADO', mensagem: 'declare CLT', severidade: 'bloqueante' },
      ],
    });
    await expect(
      executarMassWrite(s.prisma, {
        ...baseOpts(),
        items: s.items,
        verificarIdempotencia: s.verificarIdempotencia,
        preview: s.previewFn,
        commit: s.commitFn,
      }),
    ).rejects.toThrow(/SALDO_INSUFICIENTE.*CLT_NAO_CONFIRMADO/);
    expect(s.commitFn).not.toHaveBeenCalled();
  });

  it('CONFIRM sem alertas → chama commit + cria AuditLog após commit', async () => {
    const s = setup();
    const r: any = await executarMassWrite(s.prisma, {
      ...baseOpts(),
      items: s.items,
      verificarIdempotencia: s.verificarIdempotencia,
      preview: s.previewFn,
      commit: s.commitFn,
    });
    expect(r.modo).toBe('CONFIRM');
    expect(r.resultado).toEqual({ commitId: 'cmt-1', n: 3 });
    expect(s.commitFn).toHaveBeenCalled();

    const auditCall = s.auditLogCreate.mock.calls[0][0];
    expect(auditCall.data.acao).toBe('MASS_WRITE_TESTE');
    expect(auditCall.data.metadata.nItens).toBe(3);
    expect(auditCall.data.recursoId).toBe(baseOpts().clientRequestId);
  });

  it('CONFIRM passa isolationLevel Serializable ao $transaction', async () => {
    const s = setup();
    await executarMassWrite(s.prisma, {
      ...baseOpts(),
      items: s.items,
      verificarIdempotencia: s.verificarIdempotencia,
      preview: s.previewFn,
      commit: s.commitFn,
    });
    const txOpts = s.transactionFn.mock.calls[0][1];
    expect(txOpts).toEqual(
      expect.objectContaining({
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      }),
    );
  });

  it('AuditLog falhando após commit NÃO derruba o commit', async () => {
    const s = setup({ auditLogLanca: new Error('audit down') });
    const r: any = await executarMassWrite(s.prisma, {
      ...baseOpts(),
      items: s.items,
      verificarIdempotencia: s.verificarIdempotencia,
      preview: s.previewFn,
      commit: s.commitFn,
    });
    expect(r.modo).toBe('CONFIRM');
    expect(r.resultado).toBeDefined();
  });

  it('logExtra é incluído no metadata do AuditLog', async () => {
    const s = setup();
    await executarMassWrite(s.prisma, {
      ...baseOpts(),
      items: s.items,
      verificarIdempotencia: s.verificarIdempotencia,
      preview: s.previewFn,
      commit: s.commitFn,
      logExtra: () => ({ saldoAntes: 1000, saldoDepois: 700 }),
    });
    const meta = s.auditLogCreate.mock.calls[0][0].data.metadata;
    expect(meta.saldoAntes).toBe(1000);
    expect(meta.saldoDepois).toBe(700);
  });

  it('ip + userAgent são propagados ao AuditLog', async () => {
    const s = setup();
    await executarMassWrite(s.prisma, {
      ...baseOpts(),
      items: s.items,
      ip: '192.168.0.1',
      userAgent: 'smoke/1.0',
      verificarIdempotencia: s.verificarIdempotencia,
      preview: s.previewFn,
      commit: s.commitFn,
    });
    const log = s.auditLogCreate.mock.calls[0][0].data;
    expect(log.ip).toBe('192.168.0.1');
    expect(log.userAgent).toBe('smoke/1.0');
  });
});
