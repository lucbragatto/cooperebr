import { CooperadosService } from './cooperados.service';

/**
 * D-novo-CAD-CUSTEADO-FATURA (02/06/2026) — Specs do bypass via ambienteTeste
 * no CreateCooperadoDto / service.create.
 *
 * Cobre:
 *  1. create propaga ambienteTeste=true pro Prisma.
 *  2. create sem ambienteTeste mantém comportamento legado (não envia flag).
 *  3. ambienteTeste=true ainda permite tipoPessoa/representante etc.
 */
describe('CooperadosService.create — D-novo-CAD-CUSTEADO-FATURA (ambienteTeste)', () => {
  const cooperadoCreate = jest.fn();
  const prismaMock = {
    cooperado: { create: cooperadoCreate },
  } as any;

  const noop = jest.fn().mockResolvedValue(undefined);
  const whatsappMock = { notificarMembroCriado: noop } as any;
  const emailMock = { enviarBoasVindas: noop } as any;

  let service: CooperadosService;

  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.NOTIFICACOES_ATIVAS;
    cooperadoCreate.mockImplementation(async ({ data }: any) => ({
      id: 'coop-novo-1',
      ...data,
    }));
    // Constructor com mocks mínimos
    service = new CooperadosService(
      prismaMock,
      whatsappMock,
      emailMock,
      {} as any, // notificacoes
      {} as any, // motorProposta
      {} as any, // contratosService
      {} as any, // configTenant
    );
  });

  it('ambienteTeste=true → propaga pro Prisma', async () => {
    const r = await service.create({
      nomeCompleto: 'Dr. Teste',
      cpf: '12345678901',
      email: 'teste@example.com',
      ambienteTeste: true,
    });

    expect(cooperadoCreate).toHaveBeenCalledTimes(1);
    const data = cooperadoCreate.mock.calls[0][0].data;
    expect(data.ambienteTeste).toBe(true);
    expect(data.nomeCompleto).toBe('Dr. Teste');
    expect(r.ambienteTeste).toBe(true);
  });

  it('SEM ambienteTeste → não envia flag (comportamento legado preservado)', async () => {
    await service.create({
      nomeCompleto: 'Dr. Real',
      cpf: '98765432109',
      email: 'real@example.com',
    });

    expect(cooperadoCreate).toHaveBeenCalledTimes(1);
    const data = cooperadoCreate.mock.calls[0][0].data;
    expect(data.ambienteTeste).toBeUndefined();
  });

  it('ambienteTeste=true + tipoPessoa=PJ + representante → todos propagados', async () => {
    await service.create({
      nomeCompleto: 'Clínica Teste LTDA',
      cpf: '11222333000144',
      email: 'clinica@example.com',
      tipoPessoa: 'PJ',
      representanteLegalNome: 'Dr. Resp',
      representanteLegalCpf: '12345678901',
      representanteLegalCargo: 'Sócio',
      ambienteTeste: true,
    });

    const data = cooperadoCreate.mock.calls[0][0].data;
    expect(data.ambienteTeste).toBe(true);
    expect(data.tipoPessoa).toBe('PJ');
    expect(data.representanteLegalNome).toBe('Dr. Resp');
  });
});
