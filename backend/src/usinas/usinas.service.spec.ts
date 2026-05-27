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
});
