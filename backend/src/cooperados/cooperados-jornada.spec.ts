/**
 * Frente Jornada do Cooperado (01/07/2026) — cobertura da unificação de
 * visibilidade.
 *
 * Cenários:
 *  - findOne inclui `listaEspera` (AGUARDANDO, ordenada por posição) +
 *    `enviosLista` (últimos 3, com dados do envio-mãe) — chegam ao
 *    frontend pra montar o card "Jornada do Cooperado".
 *  - Guard multi-tenant preservado (M45): cooperativaId do JWT vence.
 */
import { NotFoundException } from '@nestjs/common';
import { CooperadosService } from './cooperados.service';

describe('CooperadosService.findOne — include Jornada (Frente 01/07)', () => {
  let service: CooperadosService;
  let prisma: any;

  beforeEach(() => {
    prisma = {
      cooperado: {
        findUnique: jest.fn(),
      },
    };
    service = Object.create(CooperadosService.prototype);
    (service as any).prisma = prisma;
  });

  it('findOne pede listaEspera(AGUARDANDO) + enviosLista(3 últimos com envio-mãe)', async () => {
    prisma.cooperado.findUnique.mockResolvedValue({
      id: 'coop-1',
      cooperativaId: 'tenant-A',
      canalCadastro: 'CADASTRO_PUBLICO',
      listaEspera: [{ id: 'le-1', posicao: 2, kwhNecessario: '250.00', status: 'AGUARDANDO' }],
      enviosLista: [
        {
          id: 'elc-1',
          statusIndividual: 'PENDENTE',
          envio: {
            id: 'env-1',
            numeroInterno: 'LIST-USINA-202607-001',
            status: 'PROTOCOLADA',
            geradaEm: new Date('2026-07-01'),
            enviadaEm: new Date('2026-07-05'),
            liberadaEm: null,
          },
        },
      ],
    });

    const r = await service.findOne('coop-1', 'tenant-A');

    // 1. include correto foi disparado
    expect(prisma.cooperado.findUnique).toHaveBeenCalledTimes(1);
    const arg = prisma.cooperado.findUnique.mock.calls[0][0];
    expect(arg.include.listaEspera).toEqual({
      where: { status: 'AGUARDANDO' },
      orderBy: { posicao: 'asc' },
    });
    expect(arg.include.enviosLista).toEqual({
      orderBy: { createdAt: 'desc' },
      take: 3,
      include: {
        envio: {
          select: {
            id: true,
            numeroInterno: true,
            status: true,
            geradaEm: true,
            enviadaEm: true,
            liberadaEm: true,
          },
        },
      },
    });
    // 2. roteamentoTenantAlvo permanece omitido (defesa M48).
    expect(arg.omit).toEqual({ roteamentoTenantAlvo: true });
    // 3. payload flui pro cliente com os campos novos + canalCadastro.
    expect(r.canalCadastro).toBe('CADASTRO_PUBLICO');
    expect(r.listaEspera).toHaveLength(1);
    expect(r.enviosLista[0].envio.numeroInterno).toBe('LIST-USINA-202607-001');
  });

  it('multi-tenant preservado: cooperado de outro tenant → NotFound', async () => {
    prisma.cooperado.findUnique.mockResolvedValue({
      id: 'coop-1',
      cooperativaId: 'tenant-OUTRO',
      listaEspera: [],
      enviosLista: [],
    });

    await expect(service.findOne('coop-1', 'tenant-A')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('findOne sem cooperativaId (SUPER_ADMIN cross-tenant) segue', async () => {
    prisma.cooperado.findUnique.mockResolvedValue({
      id: 'coop-1',
      cooperativaId: 'tenant-QUALQUER',
      listaEspera: [],
      enviosLista: [],
    });

    const r = await service.findOne('coop-1');
    expect(r.id).toBe('coop-1');
  });
});
