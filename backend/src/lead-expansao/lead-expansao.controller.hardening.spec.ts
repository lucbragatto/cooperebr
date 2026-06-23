/**
 * Sprint Hardening Lateral (23/06/2026) — Bloco A.
 *
 * Fix D-novo-LEAD-EXPANSAO-PUBLIC-TENANT-SPOOF P1 (3ª ocorrência M45).
 *
 *  - cooperativaId NUNCA vem do body (descartado).
 *  - ?tenant= opcional: válido → usa; ausente → cooperativaId=null; inválido → 404.
 */
import { NotFoundException } from '@nestjs/common';
import { LeadExpansaoController } from './lead-expansao.controller';

function setup() {
  const serviceCreate = jest.fn().mockResolvedValue({ id: 'lead-1' });
  const cooperativaFindUnique = jest.fn();
  const prismaMock = {
    cooperativa: { findUnique: cooperativaFindUnique },
  } as any;
  const controller = new LeadExpansaoController({ create: serviceCreate } as any, prismaMock);
  return { controller, serviceCreate, cooperativaFindUnique };
}

const BODY_BASE = { telefone: '5527999999999', distribuidora: 'EDP-ES' };

describe('LeadExpansao — Hardening Lateral 23/06', () => {
  it('descarta body.cooperativaId mesmo sem ?tenant= (lead órfão)', async () => {
    const { controller, serviceCreate } = setup();
    await controller.create({ ...BODY_BASE, cooperativaId: 'TENANT-FORJADO' }, undefined);
    expect(serviceCreate).toHaveBeenCalledWith(
      expect.objectContaining({ cooperativaId: undefined }),
    );
    // O body.cooperativaId NÃO chega ao service.
    const args = serviceCreate.mock.calls[0][0];
    expect(args.cooperativaId).not.toBe('TENANT-FORJADO');
  });

  it('?tenant= válido e ativo → usa esse tenant; body é ignorado', async () => {
    const { controller, serviceCreate, cooperativaFindUnique } = setup();
    cooperativaFindUnique.mockResolvedValue({ id: 'TENANT-REAL', ativo: true });
    await controller.create(
      { ...BODY_BASE, cooperativaId: 'TENANT-FORJADO' },
      'TENANT-REAL',
    );
    expect(serviceCreate).toHaveBeenCalledWith(
      expect.objectContaining({ cooperativaId: 'TENANT-REAL' }),
    );
  });

  it('?tenant=fake → 404 (anti-enumeração)', async () => {
    const { controller, cooperativaFindUnique } = setup();
    cooperativaFindUnique.mockResolvedValue(null);
    await expect(
      controller.create({ ...BODY_BASE }, 'TENANT-FAKE'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('?tenant= existente mas inativo → 404 (anti-enumeração)', async () => {
    const { controller, cooperativaFindUnique } = setup();
    cooperativaFindUnique.mockResolvedValue({ id: 'TENANT-X', ativo: false });
    await expect(
      controller.create({ ...BODY_BASE }, 'TENANT-X'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('sem ?tenant= e sem body.cooperativaId → lead órfão (cooperativaId=null)', async () => {
    const { controller, serviceCreate } = setup();
    await controller.create({ ...BODY_BASE }, undefined);
    expect(serviceCreate).toHaveBeenCalledWith(
      expect.objectContaining({ cooperativaId: undefined }),
    );
  });
});
