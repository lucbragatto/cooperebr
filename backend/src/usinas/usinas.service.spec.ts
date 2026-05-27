import { Test, TestingModule } from '@nestjs/testing';
import { UsinasService } from './usinas.service';
import { PrismaService } from '../prisma.service';

describe('UsinasService', () => {
  let service: UsinasService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [UsinasService, { provide: PrismaService, useValue: {} }],
    }).compile();

    service = module.get<UsinasService>(UsinasService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ─── F.7a (M35, 28/05/2026) — Classe GD no cadastro ─────────────────

  describe('create() — F.7a Classe GD + statusHomologacao', () => {
    function makePrismaMock() {
      return {
        usina: {
          create: jest.fn().mockResolvedValue({ id: 'u-fake', nome: 'X' }),
        },
        leadExpansao: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
      };
    }

    it('persiste classeGdAnotada quando passado no DTO', async () => {
      const prismaMock = makePrismaMock();
      const svc = new UsinasService(prismaMock as any);
      await svc.create({
        nome: 'Solar X',
        potenciaKwp: 200,
        cidade: 'Linhares',
        estado: 'ES',
        classeGdAnotada: 'GD_II',
      });
      const args = prismaMock.usina.create.mock.calls[0][0];
      expect(args.data.classeGdAnotada).toBe('GD_II');
    });

    it('aceita create sem classeGdAnotada (campo opcional)', async () => {
      const prismaMock = makePrismaMock();
      const svc = new UsinasService(prismaMock as any);
      await svc.create({
        nome: 'Solar Y',
        potenciaKwp: 50,
        cidade: 'Vitoria',
        estado: 'ES',
      });
      const args = prismaMock.usina.create.mock.calls[0][0];
      expect(args.data.classeGdAnotada).toBeUndefined();
    });

    it('persiste statusHomologacao quando passado no DTO', async () => {
      const prismaMock = makePrismaMock();
      const svc = new UsinasService(prismaMock as any);
      await svc.create({
        nome: 'Solar Z',
        potenciaKwp: 100,
        cidade: 'Linhares',
        estado: 'ES',
        statusHomologacao: 'EM_PRODUCAO',
      });
      const args = prismaMock.usina.create.mock.calls[0][0];
      expect(args.data.statusHomologacao).toBe('EM_PRODUCAO');
    });
  });

  // ─── F.7b (M36, 28/05/2026) — update() paridade campos ─────────────

  describe('update() — F.7b paridade campos', () => {
    function makeUpdateMock(usinaAtual: any = { id: 'u1', dataHomologacao: null, dataInicioProducao: null }) {
      return {
        usina: {
          findUnique: jest.fn().mockResolvedValue(usinaAtual),
          update: jest.fn().mockImplementation(({ data }: any) =>
            Promise.resolve({ id: 'u1', ...data }),
          ),
        },
      };
    }

    it('persiste classeGdAnotada via update', async () => {
      const prismaMock = makeUpdateMock();
      const svc = new UsinasService(prismaMock as any);
      await svc.update('u1', { classeGdAnotada: 'GD_III' });
      const args = prismaMock.usina.update.mock.calls[0][0];
      expect(args.data.classeGdAnotada).toBe('GD_III');
    });

    it('persiste distribuidora via update (F.7b — paridade)', async () => {
      const prismaMock = makeUpdateMock();
      const svc = new UsinasService(prismaMock as any);
      await svc.update('u1', { distribuidora: 'EDP_ES' });
      const args = prismaMock.usina.update.mock.calls[0][0];
      expect(args.data.distribuidora).toBe('EDP_ES');
    });

    it('persiste politicaBandeira via update (F.7b — paridade)', async () => {
      const prismaMock = makeUpdateMock();
      const svc = new UsinasService(prismaMock as any);
      await svc.update('u1', { politicaBandeira: 'NAO_APLICAR' });
      const args = prismaMock.usina.update.mock.calls[0][0];
      expect(args.data.politicaBandeira).toBe('NAO_APLICAR');
    });

    it('persiste apelidoInterno + endereço Bloco H via update', async () => {
      const prismaMock = makeUpdateMock();
      const svc = new UsinasService(prismaMock as any);
      await svc.update('u1', {
        apelidoInterno: 'cooperebr3',
        enderecoLogradouro: 'Rua X',
        enderecoNumero: '123',
        enderecoCep: '29900-000',
      });
      const args = prismaMock.usina.update.mock.calls[0][0];
      expect(args.data.apelidoInterno).toBe('cooperebr3');
      expect(args.data.enderecoLogradouro).toBe('Rua X');
      expect(args.data.enderecoNumero).toBe('123');
      expect(args.data.enderecoCep).toBe('29900-000');
    });

    it('persiste valorKwhPadrao via update', async () => {
      const prismaMock = makeUpdateMock();
      const svc = new UsinasService(prismaMock as any);
      await svc.update('u1', { valorKwhPadrao: 0.46863 });
      const args = prismaMock.usina.update.mock.calls[0][0];
      expect(args.data.valorKwhPadrao).toBe(0.46863);
    });
  });
});
