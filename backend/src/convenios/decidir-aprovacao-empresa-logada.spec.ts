/**
 * Sprint Portal Empresa HOTFIX (04/06/2026) — Specs de
 * ConvenioAprovacaoService.decidirAprovacaoEmpresaLogada.
 *
 * Cobre:
 *  1. APROVAR sem AprovacaoConvenioMembro existente → status muda + sem
 *     update do token (correta independência do magic link).
 *  2. APROVAR com AprovacaoConvenioMembro pendente → status muda + token
 *     marcado usedAt+decisao (consistência).
 *  3. APROVAR com AprovacaoConvenioMembro já usedAt → status muda + token
 *     NÃO é re-updated.
 *  4. REJEITAR happy path → MEMBRO_REJEITADO_EMPRESA + motivo gravado.
 *  5. REJEITAR sem motivo → BadRequest sem tocar banco.
 *  6. REJEITAR motivo < 2 chars → BadRequest.
 *  7. Membro não pertence ao tenant → Forbidden (carregarMembroDoTenant).
 *  8. Status ≠ PENDENTE_APROVACAO_EMPRESA → Conflict 409.
 *  9. Race: updateMany count=0 → Conflict 409 "já registrada".
 */
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { ConvenioAprovacaoService } from './convenios-aprovacao.service';

describe('ConvenioAprovacaoService.decidirAprovacaoEmpresaLogada — HOTFIX 04/06/2026', () => {
  const findUniqueMembro = jest.fn();
  const updateManyMembroTx = jest.fn();
  const updateAprovacaoTx = jest.fn();
  const findUniqueConvenio = jest.fn();
  const notificarFindUniqueMembro = jest.fn(); // chamado em notificarPosAprovacaoEmpresa

  const prismaMock = {
    convenioCooperado: {
      findUnique: findUniqueMembro,
    },
    contratoConvenio: { findFirst: jest.fn() },
    $transaction: jest.fn(async (cb: any) => {
      const tx = {
        convenioCooperado: { updateMany: updateManyMembroTx },
        aprovacaoConvenioMembro: { update: updateAprovacaoTx },
      };
      return cb(tx);
    }),
  } as any;

  const notificacoesMock = { criar: jest.fn().mockResolvedValue(undefined) } as any;
  const waSenderMock = { enviarMensagem: jest.fn() } as any;

  let service: ConvenioAprovacaoService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ConvenioAprovacaoService(prismaMock, notificacoesMock, waSenderMock);

    // notificarPosAprovacaoEmpresa faz findUnique direto (não tx) — mocka
    // pra não quebrar com null e seguir o fluxo.
    findUniqueMembro.mockImplementation(async (args: any) => {
      // Quando chamado dentro de notificarPos, retorna shape simplificado
      if (!args?.include?.convenio?.select) return null;
      return {
        cooperadoId: 'coop-c',
        convenio: { cooperativaId: 'coop-A', empresaNome: 'Clínica Teste' },
      };
    });
  });

  const membroBase = {
    id: 'membro-1',
    status: 'PENDENTE_APROVACAO_EMPRESA',
    cooperadoId: 'coop-c',
    convenio: { id: 'conv-1', cooperativaId: 'coop-A', empresaNome: 'Clínica Teste' },
    cooperado: { id: 'coop-c', nomeCompleto: 'Dr. Race', telefone: '5527981341348' },
  };

  function mockCarregarMembro(extra?: Partial<typeof membroBase> & { aprovacao?: any }) {
    findUniqueMembro.mockImplementationOnce(async () => ({ ...membroBase, ...extra }));
  }

  it('APROVAR sem AprovacaoConvenioMembro → status muda, token NÃO atualizado', async () => {
    mockCarregarMembro({ aprovacao: null });
    updateManyMembroTx.mockResolvedValueOnce({ count: 1 });

    const r = await service.decidirAprovacaoEmpresaLogada({
      membroId: 'membro-1',
      cooperativaId: 'coop-A',
      decisao: 'APROVAR',
    });

    expect(r).toEqual({ ok: true, status: 'PENDENTE_APROVACAO_ADMIN' });
    expect(updateManyMembroTx).toHaveBeenCalledWith({
      where: { id: 'membro-1', status: 'PENDENTE_APROVACAO_EMPRESA' },
      data: { status: 'PENDENTE_APROVACAO_ADMIN', aprovadoPorEmpresaEm: expect.any(Date) },
    });
    expect(updateAprovacaoTx).not.toHaveBeenCalled(); // sem token, nada a marcar
  });

  it('APROVAR com AprovacaoConvenioMembro pendente → status muda + token consumido', async () => {
    mockCarregarMembro({
      aprovacao: { id: 'aprov-1', token: 't'.repeat(64), expiresAt: new Date(Date.now() + 60000), usedAt: null },
    });
    updateManyMembroTx.mockResolvedValueOnce({ count: 1 });
    updateAprovacaoTx.mockResolvedValueOnce({});

    await service.decidirAprovacaoEmpresaLogada({
      membroId: 'membro-1',
      cooperativaId: 'coop-A',
      decisao: 'APROVAR',
      ip: '127.0.0.1',
      userAgent: 'jest',
    });

    expect(updateAprovacaoTx).toHaveBeenCalledWith({
      where: { id: 'aprov-1' },
      data: {
        usedAt: expect.any(Date),
        decisao: 'APROVADO',
        motivoRejeicao: null,
        aprovadorIp: '127.0.0.1',
        aprovadorUserAgent: 'jest',
      },
    });
  });

  it('APROVAR com AprovacaoConvenioMembro JÁ usedAt → token NÃO é re-atualizado', async () => {
    mockCarregarMembro({
      aprovacao: { id: 'aprov-1', token: 't', expiresAt: new Date(Date.now() + 60000), usedAt: new Date() },
    });
    updateManyMembroTx.mockResolvedValueOnce({ count: 1 });

    await service.decidirAprovacaoEmpresaLogada({
      membroId: 'membro-1',
      cooperativaId: 'coop-A',
      decisao: 'APROVAR',
    });

    expect(updateAprovacaoTx).not.toHaveBeenCalled();
  });

  it('REJEITAR happy path → MEMBRO_REJEITADO_EMPRESA + motivo gravado', async () => {
    mockCarregarMembro({ aprovacao: null });
    updateManyMembroTx.mockResolvedValueOnce({ count: 1 });

    const r = await service.decidirAprovacaoEmpresaLogada({
      membroId: 'membro-1',
      cooperativaId: 'coop-A',
      decisao: 'REJEITAR',
      motivo: 'Não é funcionário da empresa',
    });

    expect(r.status).toBe('MEMBRO_REJEITADO_EMPRESA');
    expect(updateManyMembroTx).toHaveBeenCalledWith({
      where: { id: 'membro-1', status: 'PENDENTE_APROVACAO_EMPRESA' },
      data: {
        status: 'MEMBRO_REJEITADO_EMPRESA',
        rejeitadoPorEmpresaEm: expect.any(Date),
        motivoRejeicao: 'Não é funcionário da empresa',
      },
    });
  });

  it('REJEITAR sem motivo → BadRequest sem tocar banco', async () => {
    await expect(
      service.decidirAprovacaoEmpresaLogada({
        membroId: 'membro-1',
        cooperativaId: 'coop-A',
        decisao: 'REJEITAR',
      }),
    ).rejects.toThrow(BadRequestException);

    expect(findUniqueMembro).not.toHaveBeenCalled();
    expect(updateManyMembroTx).not.toHaveBeenCalled();
  });

  it('REJEITAR motivo < 2 chars → BadRequest', async () => {
    await expect(
      service.decidirAprovacaoEmpresaLogada({
        membroId: 'membro-1',
        cooperativaId: 'coop-A',
        decisao: 'REJEITAR',
        motivo: 'a',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('membro não pertence ao tenant → Forbidden', async () => {
    findUniqueMembro.mockImplementationOnce(async () => ({
      ...membroBase,
      convenio: { ...membroBase.convenio, cooperativaId: 'OUTRO-TENANT' },
    }));

    await expect(
      service.decidirAprovacaoEmpresaLogada({
        membroId: 'membro-1',
        cooperativaId: 'coop-A',
        decisao: 'APROVAR',
      }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('status ≠ PENDENTE_APROVACAO_EMPRESA → Conflict 409', async () => {
    findUniqueMembro.mockImplementationOnce(async () => ({
      ...membroBase,
      status: 'MEMBRO_ATIVO',
    }));

    await expect(
      service.decidirAprovacaoEmpresaLogada({
        membroId: 'membro-1',
        cooperativaId: 'coop-A',
        decisao: 'APROVAR',
      }),
    ).rejects.toThrow(ConflictException);

    expect(updateManyMembroTx).not.toHaveBeenCalled();
  });

  it('race: updateMany count=0 → Conflict 409 "já registrada"', async () => {
    mockCarregarMembro({ aprovacao: null });
    updateManyMembroTx.mockResolvedValueOnce({ count: 0 });

    await expect(
      service.decidirAprovacaoEmpresaLogada({
        membroId: 'membro-1',
        cooperativaId: 'coop-A',
        decisao: 'APROVAR',
      }),
    ).rejects.toThrow(ConflictException);
  });
});
