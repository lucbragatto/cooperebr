import { Test, TestingModule } from '@nestjs/testing';
import { CooperadosService } from './cooperados.service';
import { PrismaService } from '../prisma.service';
import { NotificacoesService } from '../notificacoes/notificacoes.service';

describe('CooperadosService', () => {
  let service: CooperadosService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CooperadosService,
        { provide: PrismaService, useValue: {} },
        { provide: NotificacoesService, useValue: { criar: jest.fn() } },
      ],
    }).compile();

    service = module.get<CooperadosService>(CooperadosService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
