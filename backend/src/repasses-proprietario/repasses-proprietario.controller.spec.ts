import { RepassesProprietarioController } from './repasses-proprietario.controller';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';

/**
 * D-novo-AN AN.2 (M42, 2026-05-30) — Specs do controller REST.
 *
 * Foco: delegação correta pro service + assinatura dos métodos + propagação
 * dos guards multi-tenant (que o service implementa).
 */
describe('RepassesProprietarioController', () => {
  const serviceMock = {
    listarGlobal: jest.fn(),
    listarPorUsina: jest.fn(),
    listarPorProprietario: jest.fn(),
    findOne: jest.fn(),
    marcarPago: jest.fn(),
    cancelar: jest.fn(),
  } as any;

  let controller: RepassesProprietarioController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new RepassesProprietarioController(serviceMock);
  });

  // ─── GET /repasses ────────────────────────────────────────────

  it('GET /repasses delega listarGlobal com cooperativaId+perfil do JWT', async () => {
    serviceMock.listarGlobal.mockResolvedValueOnce([]);
    const req: any = { user: { cooperativaId: 'coop-A', perfil: 'ADMIN' } };
    await controller.listarGlobal(req, {});
    expect(serviceMock.listarGlobal).toHaveBeenCalledWith('coop-A', 'ADMIN', {});
  });

  // ─── GET /repasses/proprietario ───────────────────────────────

  it('GET /repasses/proprietario propaga user inteiro pro service (Caminho A/B)', async () => {
    serviceMock.listarPorProprietario.mockResolvedValueOnce([]);
    const req: any = {
      user: { id: 'u1', email: 'dono@x.com', cooperadoId: 'coopdo-1' },
    };
    await controller.listarPorProprietario(req, { status: 'PENDENTE' as any });
    expect(serviceMock.listarPorProprietario).toHaveBeenCalledWith(req.user, { status: 'PENDENTE' });
  });

  // ─── GET /repasses/:id ────────────────────────────────────────

  it('GET /repasses/:id delega findOne com guard tenant', async () => {
    serviceMock.findOne.mockResolvedValueOnce({ id: 'r1' });
    const req: any = { user: { cooperativaId: 'coop-A', perfil: 'ADMIN' } };
    await controller.findOne('r1', req);
    expect(serviceMock.findOne).toHaveBeenCalledWith('r1', 'coop-A', 'ADMIN');
  });

  it('GET /repasses/:id propaga ForbiddenException do service', async () => {
    serviceMock.findOne.mockRejectedValueOnce(new ForbiddenException('Repasse de outra coop'));
    const req: any = { user: { cooperativaId: 'coop-A', perfil: 'ADMIN' } };
    await expect(controller.findOne('r1', req)).rejects.toThrow(ForbiddenException);
  });

  // ─── PUT /repasses/:id/marcar-pago ────────────────────────────

  it('PUT /repasses/:id/marcar-pago delega com usuarioId + cooperativaId + perfil', async () => {
    serviceMock.marcarPago.mockResolvedValueOnce({ status: 'PAGO' });
    const req: any = { user: { id: 'admin-1', cooperativaId: 'coop-A', perfil: 'ADMIN' } };
    await controller.marcarPago(
      'r1',
      { metodoPagamento: 'PIX' as any, dataPagamento: '2026-05-01' },
      req,
    );
    expect(serviceMock.marcarPago).toHaveBeenCalledWith(
      'r1',
      expect.objectContaining({ metodoPagamento: 'PIX', dataPagamento: '2026-05-01' }),
      'admin-1',
      'coop-A',
      'ADMIN',
    );
  });

  // ─── PUT /repasses/:id/cancelar ───────────────────────────────

  it('PUT /repasses/:id/cancelar delega motivo + usuarioId', async () => {
    serviceMock.cancelar.mockResolvedValueOnce({ status: 'CANCELADO' });
    const req: any = { user: { id: 'admin-1', cooperativaId: 'coop-A', perfil: 'ADMIN' } };
    await controller.cancelar('r1', { motivo: 'Contrato encerrado' }, req);
    expect(serviceMock.cancelar).toHaveBeenCalledWith(
      'r1',
      { motivo: 'Contrato encerrado' },
      'admin-1',
      'coop-A',
      'ADMIN',
    );
  });

  // ─── POST /repasses/upload-comprovante ────────────────────────

  it('POST /upload-comprovante: sem arquivo → BadRequest', () => {
    const req: any = { user: { cooperativaId: 'coop-A' } };
    expect(() => controller.uploadComprovante(undefined as any, req)).toThrow(BadRequestException);
  });

  it('POST /upload-comprovante: retorna URL no formato /uploads/repasses/<coop>/<ano>/<mês>/<filename>', () => {
    const file: any = {
      filename: '1234567890-abc-arquivo.pdf',
      size: 12345,
      mimetype: 'application/pdf',
      originalname: 'arquivo.pdf',
    };
    const req: any = { user: { cooperativaId: 'coop-A' } };
    const r = controller.uploadComprovante(file, req);
    const ano = new Date().getFullYear();
    const mes = String(new Date().getMonth() + 1).padStart(2, '0');
    expect(r.url).toBe(`/uploads/repasses/coop-A/${ano}/${mes}/1234567890-abc-arquivo.pdf`);
    expect(r.mimetype).toBe('application/pdf');
  });

  // ─── Race + tenant guards propagados ──────────────────────────

  it('marcarPago: propaga 409 ConflictException do service', async () => {
    serviceMock.marcarPago.mockRejectedValueOnce(new ConflictException('Já está PAGO'));
    const req: any = { user: { id: 'admin-1', cooperativaId: 'coop-A', perfil: 'ADMIN' } };
    await expect(
      controller.marcarPago('r1', { metodoPagamento: 'PIX' as any, dataPagamento: '2026-05-01' }, req),
    ).rejects.toThrow(ConflictException);
  });

  it('cancelar: propaga NotFoundException quando id inexistente', async () => {
    serviceMock.cancelar.mockRejectedValueOnce(new NotFoundException('Repasse não encontrado.'));
    const req: any = { user: { id: 'admin-1', cooperativaId: 'coop-A', perfil: 'ADMIN' } };
    await expect(controller.cancelar('r-inex', { motivo: 'x' }, req)).rejects.toThrow(NotFoundException);
  });
});
