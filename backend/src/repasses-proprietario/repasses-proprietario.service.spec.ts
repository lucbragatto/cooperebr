import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { RepassesProprietarioService } from './repasses-proprietario.service';

/**
 * D-novo-AN AN.1 (M42, 2026-05-30) — Specs do RepassesProprietarioService.
 *
 * Foco: workflow PENDENTE→PAGO/CANCELADO + transação atômica que vincula
 * despesas DESCONTO_NO_REPASSE pendentes + race-condition + multi-tenant.
 */
describe('RepassesProprietarioService', () => {
  const repasseFindUnique = jest.fn();
  const repasseFindMany = jest.fn();
  const repasseCreate = jest.fn();
  const repasseUpdate = jest.fn();
  const contaUpdateMany = jest.fn();
  const usinaFindMany = jest.fn();

  const $transaction = jest.fn();

  const prismaMock = {
    repasseProprietario: {
      findUnique: repasseFindUnique,
      findMany: repasseFindMany,
      create: repasseCreate,
      update: repasseUpdate,
    },
    contaAPagar: { updateMany: contaUpdateMany },
    usina: { findMany: usinaFindMany },
    $transaction,
  } as any;

  let service: RepassesProprietarioService;

  const periodoInicio = new Date('2026-04-01T00:00:00.000Z');
  const periodoFim = new Date('2026-04-30T23:59:59.000Z');

  const repasseBase = {
    id: 'r1',
    cooperativaId: 'coop-A',
    usinaId: 'u1',
    proprietarioUsuarioId: null,
    periodoInicio,
    periodoFim,
    valorBruto: 1500,
    totalDespesasAbatidas: 0,
    valorLiquido: 1500,
    status: 'PENDENTE',
    metodoPagamento: null,
    dataPagamento: null,
    comprovante: null,
    observacao: null,
    registradoPorUsuarioId: null,
    canceladoPorUsuarioId: null,
    canceladoEm: null,
    motivoCancelamento: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new RepassesProprietarioService(prismaMock);
  });

  // ─── criarPendente ────────────────────────────────────────────────

  it('criarPendente cria repasse idempotente', async () => {
    repasseCreate.mockResolvedValueOnce({ ...repasseBase, valorBruto: 1500, valorLiquido: 1500 });

    const r = await service.criarPendente({
      cooperativaId: 'coop-A',
      usinaId: 'u1',
      periodoInicio,
      periodoFim,
      valorBruto: 1500,
      valorLiquido: 1500,
      totalDespesasAbatidas: 0,
    });

    expect(r.status).toBe('PENDENTE');
    expect(r.valorBruto).toBe(1500);
    expect(r.valorLiquido).toBe(1500);
    expect(repasseCreate).toHaveBeenCalledTimes(1);
    const args = repasseCreate.mock.calls[0][0].data;
    expect(args.cooperativaId).toBe('coop-A');
    expect(args.usinaId).toBe('u1');
    expect(args.status).toBe('PENDENTE');
  });

  it('criarPendente re-lança ConflictException quando unique constraint viola (P2002)', async () => {
    repasseCreate.mockRejectedValueOnce({ code: 'P2002' });

    await expect(
      service.criarPendente({
        cooperativaId: 'coop-A',
        usinaId: 'u1',
        periodoInicio,
        periodoFim,
        valorBruto: 1500,
        valorLiquido: 1500,
        totalDespesasAbatidas: 0,
      }),
    ).rejects.toThrow(ConflictException);
  });

  // ─── marcarPago (transação atômica) ───────────────────────────────

  it('marcarPago: transação atômica APROVA + vincula despesas abatidas', async () => {
    repasseFindUnique.mockResolvedValueOnce({
      id: 'r1',
      cooperativaId: 'coop-A',
      usinaId: 'u1',
      periodoInicio,
      periodoFim,
      status: 'PENDENTE',
    });
    // Mock do $transaction retornando o resultado das duas operações
    const repasseAtualizado = {
      ...repasseBase,
      status: 'PAGO',
      metodoPagamento: 'PIX',
      dataPagamento: new Date('2026-05-01'),
      registradoPorUsuarioId: 'admin-1',
    };
    $transaction.mockResolvedValueOnce([repasseAtualizado, { count: 1 }]);

    const r = await service.marcarPago(
      'r1',
      { metodoPagamento: 'PIX' as any, dataPagamento: '2026-05-01' },
      'admin-1',
      'coop-A',
      'ADMIN',
    );

    expect(r.status).toBe('PAGO');
    expect(r.metodoPagamento).toBe('PIX');
    expect(r.registradoPorUsuarioId).toBe('admin-1');
    expect($transaction).toHaveBeenCalledTimes(1);
  });

  it('marcarPago: race-condition (status !== PENDENTE) → 409 Conflict', async () => {
    repasseFindUnique.mockResolvedValueOnce({
      id: 'r1',
      cooperativaId: 'coop-A',
      usinaId: 'u1',
      periodoInicio,
      periodoFim,
      status: 'PAGO',
    });

    await expect(
      service.marcarPago(
        'r1',
        { metodoPagamento: 'PIX' as any, dataPagamento: '2026-05-01' },
        'admin-1',
        'coop-A',
        'ADMIN',
      ),
    ).rejects.toThrow(ConflictException);
    expect($transaction).not.toHaveBeenCalled();
  });

  it('marcarPago: multi-tenant guard — ADMIN tentando coop alheia → ForbiddenException', async () => {
    repasseFindUnique.mockResolvedValueOnce({
      id: 'r1',
      cooperativaId: 'coop-A',
      usinaId: 'u1',
      periodoInicio,
      periodoFim,
      status: 'PENDENTE',
    });

    await expect(
      service.marcarPago(
        'r1',
        { metodoPagamento: 'PIX' as any, dataPagamento: '2026-05-01' },
        'admin-1',
        'coop-OUTRA',
        'ADMIN',
      ),
    ).rejects.toThrow(ForbiddenException);
    expect($transaction).not.toHaveBeenCalled();
  });

  it('marcarPago: SUPER_ADMIN bypass tenant (cross-tenant OK)', async () => {
    repasseFindUnique.mockResolvedValueOnce({
      id: 'r1',
      cooperativaId: 'coop-A',
      usinaId: 'u1',
      periodoInicio,
      periodoFim,
      status: 'PENDENTE',
    });
    $transaction.mockResolvedValueOnce([{ ...repasseBase, status: 'PAGO' }, { count: 0 }]);

    const r = await service.marcarPago(
      'r1',
      { metodoPagamento: 'PIX' as any, dataPagamento: '2026-05-01' },
      'sa-1',
      undefined, // SA não tem coopId fixo
      'SUPER_ADMIN',
    );

    expect(r.status).toBe('PAGO');
  });

  it('marcarPago: OUTRO sem observacao → BadRequest', async () => {
    repasseFindUnique.mockResolvedValueOnce({
      id: 'r1',
      cooperativaId: 'coop-A',
      usinaId: 'u1',
      periodoInicio,
      periodoFim,
      status: 'PENDENTE',
    });

    await expect(
      service.marcarPago(
        'r1',
        { metodoPagamento: 'OUTRO' as any, dataPagamento: '2026-05-01' },
        'admin-1',
        'coop-A',
        'ADMIN',
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('marcarPago: dataPagamento futuro → BadRequest', async () => {
    repasseFindUnique.mockResolvedValueOnce({
      id: 'r1',
      cooperativaId: 'coop-A',
      usinaId: 'u1',
      periodoInicio,
      periodoFim,
      status: 'PENDENTE',
    });
    const futuro = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    await expect(
      service.marcarPago(
        'r1',
        { metodoPagamento: 'PIX' as any, dataPagamento: futuro },
        'admin-1',
        'coop-A',
        'ADMIN',
      ),
    ).rejects.toThrow(BadRequestException);
  });

  // ─── cancelar ─────────────────────────────────────────────────────

  it('cancelar PENDENTE → status CANCELADO + motivo', async () => {
    repasseFindUnique.mockResolvedValueOnce({
      id: 'r1',
      cooperativaId: 'coop-A',
      status: 'PENDENTE',
    });
    repasseUpdate.mockResolvedValueOnce({
      ...repasseBase,
      status: 'CANCELADO',
      canceladoPorUsuarioId: 'admin-1',
      motivoCancelamento: 'Contrato encerrado',
      canceladoEm: new Date(),
    });

    const r = await service.cancelar(
      'r1',
      { motivo: 'Contrato encerrado' },
      'admin-1',
      'coop-A',
      'ADMIN',
    );

    expect(r.status).toBe('CANCELADO');
    expect(r.motivoCancelamento).toBe('Contrato encerrado');
    expect(r.canceladoPorUsuarioId).toBe('admin-1');
  });

  it('cancelar repasse PAGO → 409 Conflict', async () => {
    repasseFindUnique.mockResolvedValueOnce({
      id: 'r1',
      cooperativaId: 'coop-A',
      status: 'PAGO',
    });

    await expect(
      service.cancelar('r1', { motivo: 'tarde demais' }, 'admin-1', 'coop-A', 'ADMIN'),
    ).rejects.toThrow(ConflictException);
    expect(repasseUpdate).not.toHaveBeenCalled();
  });

  // ─── listar ───────────────────────────────────────────────────────

  it('listarGlobal: ADMIN filtra por própria cooperativa', async () => {
    repasseFindMany.mockResolvedValueOnce([repasseBase]);
    await service.listarGlobal('coop-A', 'ADMIN', {});
    const args = repasseFindMany.mock.calls[0][0];
    expect(args.where.cooperativaId).toBe('coop-A');
  });

  it('listarGlobal: SUPER_ADMIN NÃO filtra cooperativaId (cross-tenant)', async () => {
    repasseFindMany.mockResolvedValueOnce([repasseBase]);
    await service.listarGlobal(undefined, 'SUPER_ADMIN', {});
    const args = repasseFindMany.mock.calls[0][0];
    expect(args.where.cooperativaId).toBeUndefined();
  });

  it('listarPorUsina: força filtro usinaId', async () => {
    repasseFindMany.mockResolvedValueOnce([repasseBase]);
    await service.listarPorUsina('u1', 'coop-A', 'ADMIN', {});
    const args = repasseFindMany.mock.calls[0][0];
    expect(args.where.usinaId).toBe('u1');
    expect(args.where.cooperativaId).toBe('coop-A');
  });

  it('listarPorProprietario: respeita Caminho A (cooperadoId) E Caminho B (email)', async () => {
    usinaFindMany.mockResolvedValueOnce([{ id: 'u1' }, { id: 'u2' }]);
    repasseFindMany.mockResolvedValueOnce([repasseBase]);

    await service.listarPorProprietario(
      { id: 'usr-1', email: 'dono@x.com', cooperadoId: 'coopdo-1' },
      {},
    );

    const usinaArgs = usinaFindMany.mock.calls[0][0];
    expect(usinaArgs.where.OR).toEqual(
      expect.arrayContaining([
        { proprietarioCooperadoId: 'coopdo-1' },
        { proprietarioEmail: 'dono@x.com' },
      ]),
    );

    const repasseArgs = repasseFindMany.mock.calls[0][0];
    // OR deve incluir usinasIds (Caminho B) + proprietarioUsuarioId (Caminho A direto)
    expect(repasseArgs.where.OR).toEqual(
      expect.arrayContaining([
        { proprietarioUsuarioId: 'usr-1' },
        { usinaId: { in: ['u1', 'u2'] } },
      ]),
    );
  });

  it('listarPorProprietario: usuário SEM email/cooperadoId/usuarioId → retorna vazio sem query', async () => {
    const r = await service.listarPorProprietario({} as any, {});
    expect(r).toEqual([]);
    expect(repasseFindMany).not.toHaveBeenCalled();
  });

  it('findOne: NotFoundException quando id inexistente', async () => {
    repasseFindUnique.mockResolvedValueOnce(null);
    await expect(service.findOne('r-inex', 'coop-A', 'ADMIN')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('findOne: multi-tenant guard bloqueia coop alheia', async () => {
    repasseFindUnique.mockResolvedValueOnce({ ...repasseBase, cooperativaId: 'coop-OUTRA' });
    await expect(service.findOne('r1', 'coop-A', 'ADMIN')).rejects.toThrow(ForbiddenException);
  });

  // ─── helpers ──────────────────────────────────────────────────────

  it('toDto: deriva atrasado=true se PENDENTE + periodoFim > 30d atrás', async () => {
    const periodoAntigo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
    repasseFindUnique.mockResolvedValueOnce({
      ...repasseBase,
      periodoInicio: periodoAntigo,
      periodoFim: periodoAntigo,
      status: 'PENDENTE',
    });
    const r = await service.findOne('r1', 'coop-A', 'ADMIN');
    expect(r.atrasado).toBe(true);
  });

  it('toDto: PAGO nunca atrasado mesmo se periodoFim muito antigo', async () => {
    const periodoAntigo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
    repasseFindUnique.mockResolvedValueOnce({
      ...repasseBase,
      periodoInicio: periodoAntigo,
      periodoFim: periodoAntigo,
      status: 'PAGO',
    });
    const r = await service.findOne('r1', 'coop-A', 'ADMIN');
    expect(r.atrasado).toBe(false);
  });
});
