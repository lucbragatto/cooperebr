import { BadRequestException, NotFoundException } from '@nestjs/common';
import { FluxoConvenio, TipoBeneficioConvenio } from '@prisma/client';
import { ConveniosCtService } from './convenios-ct.service';

/**
 * D-novo-BR-CT CT.2 — Specs do CRUD Convenio (model novo segregação).
 *
 * @deprecated D-FISCAL-2.5 (02/06/2026) — service deprecated junto com o
 * ConveniosCtController. Specs mantidos durante o período de transição
 * (1 sprint) pra garantir multi-tenant continua bloqueando enquanto
 * chamadas órfãs forem rastreadas. Remover specs + service + controller
 * em D-FISCAL-2.5 cleanup (pós-sprint).
 *
 * Multi-tenant: tenant A não vê/altera convênio de B (defesa em
 * profundidade — Guard sistêmico já bloqueia via @TenantResource, mas
 * service mantém findFirst {id, cooperativaId} como segunda camada).
 */
describe('ConveniosCtService — CT.2', () => {
  const convCreate = jest.fn();
  const convFindMany = jest.fn();
  const convFindFirst = jest.fn();
  const convFindUnique = jest.fn();
  const convUpdate = jest.fn();

  const prismaMock = {
    convenio: {
      create: convCreate,
      findMany: convFindMany,
      findFirst: convFindFirst,
      findUnique: convFindUnique,
      update: convUpdate,
    },
  } as any;

  let service: ConveniosCtService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ConveniosCtService(prismaMock);
  });

  describe('create', () => {
    const dtoBase = {
      nome: 'Convenio Custeio Solar',
      fluxoFinanceiro: FluxoConvenio.INGRESSO_CUSTEIO_AUXILIAR,
      classificacaoFiscal: 'Ato Auxiliar Art. 88 + STF Tema 536',
      vigenciaInicio: '2026-06-01',
    };

    it('cria com tipoBeneficio default ENERGIA_SCEE', async () => {
      convCreate.mockResolvedValueOnce({ id: 'conv1', cooperativaId: 'coop-A' });
      const r = await service.create(dtoBase, 'coop-A');
      expect(r.id).toBe('conv1');
      expect(convCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            cooperativaId: 'coop-A',
            tipoBeneficio: TipoBeneficioConvenio.ENERGIA_SCEE,
          }),
        }),
      );
    });

    it('rejeita tipoBeneficio diferente de ENERGIA_SCEE em prod', async () => {
      await expect(
        service.create({ ...dtoBase, tipoBeneficio: 'SAUDE' as any }, 'coop-A'),
      ).rejects.toThrow(BadRequestException);
      expect(convCreate).not.toHaveBeenCalled();
    });

    it('cooperativaId vem do parâmetro (controller injetou JWT), não do body', async () => {
      convCreate.mockResolvedValueOnce({ id: 'conv1' });
      // mesmo se tivesse cooperativaId no body, service ignora
      await service.create(dtoBase, 'coop-A');
      expect(convCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ cooperativaId: 'coop-A' }),
        }),
      );
    });
  });

  describe('findAll', () => {
    it('ADMIN tenant → filtra por cooperativaId', async () => {
      convFindMany.mockResolvedValueOnce([]);
      await service.findAll('coop-A');
      expect(convFindMany).toHaveBeenCalledWith({
        where: { cooperativaId: 'coop-A' },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('SUPER_ADMIN (null) → sem filtro', async () => {
      convFindMany.mockResolvedValueOnce([]);
      await service.findAll(null);
      expect(convFindMany).toHaveBeenCalledWith({
        where: undefined,
        orderBy: { createdAt: 'desc' },
      });
    });
  });

  describe('findOne', () => {
    it('ADMIN tenant A → recupera próprio', async () => {
      convFindFirst.mockResolvedValueOnce({ id: 'conv1', cooperativaId: 'coop-A' });
      const r = await service.findOne('conv1', 'coop-A');
      expect(r.id).toBe('conv1');
    });

    it('ADMIN tenant A buscando convênio B → NotFound (defesa em profundidade)', async () => {
      convFindFirst.mockResolvedValueOnce(null);
      await expect(service.findOne('conv-B', 'coop-A')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('rejeita mudança pra tipoBeneficio não-ENERGIA_SCEE', async () => {
      await expect(
        service.update('conv1', { tipoBeneficio: 'SAUDE' as any }, 'coop-A'),
      ).rejects.toThrow(BadRequestException);
    });

    it('ADMIN tenant A update próprio convênio → sucesso', async () => {
      convFindFirst.mockResolvedValueOnce({ id: 'conv1' });
      convUpdate.mockResolvedValueOnce({ id: 'conv1', nome: 'Novo Nome' });
      const r = await service.update('conv1', { nome: 'Novo Nome' }, 'coop-A');
      expect(r.nome).toBe('Novo Nome');
    });

    it('ADMIN tenant A tentando atualizar convênio B → NotFound (defesa)', async () => {
      convFindFirst.mockResolvedValueOnce(null);
      await expect(service.update('conv-B', { nome: 'HACK' }, 'coop-A')).rejects.toThrow(NotFoundException);
      expect(convUpdate).not.toHaveBeenCalled();
    });
  });

  describe('remove (soft-delete preservando histórico contábil)', () => {
    it('ADMIN tenant A → marca ativo=false', async () => {
      convFindFirst.mockResolvedValueOnce({ id: 'conv1' });
      convUpdate.mockResolvedValueOnce({ id: 'conv1', ativo: false });
      await service.remove('conv1', 'coop-A');
      expect(convUpdate).toHaveBeenCalledWith({
        where: { id: 'conv1' },
        data: { ativo: false },
      });
    });
  });
});
