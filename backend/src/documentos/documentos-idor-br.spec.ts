import { NotFoundException } from '@nestjs/common';
import { DocumentosService } from './documentos.service';

/**
 * D-novo-BR F0.2 AA2+AA3+AA4+MA1 (31/05/2026) — posse via cooperado.cooperativaId.
 * Dispara WhatsApp; cross-tenant não pode atingir cooperado alheio.
 */
describe('DocumentosService — F0.2 IDOR via-relação', () => {
  const docFindFirst = jest.fn();
  const docFindUnique = jest.fn();
  const docUpdate = jest.fn();
  const docDelete = jest.fn();
  const coopFindFirst = jest.fn();
  const coopFindUniqueOuter = jest.fn();
  const notifCriar = jest.fn();
  const checkProntoParaAtivar = jest.fn();
  const notificarApr = jest.fn();
  const notificarRep = jest.fn();

  const prismaMock = {
    documentoCooperado: {
      findFirst: docFindFirst,
      findUnique: docFindUnique,
      update: docUpdate,
      delete: docDelete,
    },
    cooperado: {
      findFirst: coopFindFirst,
      findUnique: coopFindUniqueOuter,
    },
  } as any;

  const notifMock = { criar: notifCriar } as any;
  const cooperadosServiceMock = { checkProntoParaAtivar } as any;
  const whatsappMock = {
    notificarDocumentoAprovado: notificarApr,
    notificarDocumentoReprovado: notificarRep,
  } as any;

  let service: DocumentosService;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.SUPABASE_URL = 'https://x.supabase.co';
    process.env.SUPABASE_SERVICE_KEY = 'fake';
    service = new DocumentosService(prismaMock, notifMock, cooperadosServiceMock, whatsappMock);
    docUpdate.mockResolvedValue({ id: 'd1', status: 'APROVADO' });
    notifCriar.mockResolvedValue(undefined);
    checkProntoParaAtivar.mockResolvedValue(undefined);
    notificarApr.mockResolvedValue(undefined);
    notificarRep.mockResolvedValue(undefined);
    coopFindUniqueOuter.mockResolvedValue({ id: 'c1', nomeCompleto: 'X', telefone: '27', cooperativaId: 'coop-A' });
  });

  describe('aprovar (AA2)', () => {
    it('ADMIN tenant B → NotFoundException (não dispara WhatsApp ao cooperado alheio)', async () => {
      docFindFirst.mockResolvedValueOnce(null);
      await expect(service.aprovar('d1', 'coop-B')).rejects.toThrow(NotFoundException);
      expect(docUpdate).not.toHaveBeenCalled();
      expect(notificarApr).not.toHaveBeenCalled();
      expect(docFindFirst).toHaveBeenCalledWith({
        where: { id: 'd1', cooperado: { cooperativaId: 'coop-B' } },
      });
    });

    it('ADMIN tenant A → sucesso', async () => {
      docFindFirst.mockResolvedValueOnce({ id: 'd1', tipo: 'RG_FRENTE', cooperadoId: 'c1' });
      const r = await service.aprovar('d1', 'coop-A');
      expect(r.status).toBe('APROVADO');
    });

    it('SUPER_ADMIN (null) → bypass', async () => {
      docFindUnique.mockResolvedValueOnce({ id: 'd1', tipo: 'RG_FRENTE', cooperadoId: 'c1' });
      const r = await service.aprovar('d1', null);
      expect(r.status).toBe('APROVADO');
      expect(docFindFirst).not.toHaveBeenCalled();
    });
  });

  describe('reprovar (AA3)', () => {
    it('ADMIN tenant B → NotFoundException (sem WhatsApp)', async () => {
      docFindFirst.mockResolvedValueOnce(null);
      await expect(service.reprovar('d1', 'Borrado', 'coop-B')).rejects.toThrow(NotFoundException);
      expect(notificarRep).not.toHaveBeenCalled();
    });
  });

  describe('remove (AA4)', () => {
    it('ADMIN tenant B → NotFoundException (não deleta arquivo Supabase)', async () => {
      docFindFirst.mockResolvedValueOnce(null);
      await expect(service.remove('d1', 'coop-B')).rejects.toThrow(NotFoundException);
      expect(docDelete).not.toHaveBeenCalled();
    });
  });

  describe('uploadAdmin (MA1)', () => {
    it('ADMIN tenant B → NotFoundException ANTES de upload', async () => {
      coopFindFirst.mockResolvedValueOnce(null);
      const arquivo: any = { buffer: Buffer.from('x'), originalname: 'a.pdf', mimetype: 'application/pdf', size: 1 };
      await expect(
        service.uploadAdmin('c1', 'RG_FRENTE', arquivo, 'coop-B'),
      ).rejects.toThrow(NotFoundException);
      expect(notifCriar).not.toHaveBeenCalled();
    });
  });
});
