import { Test, TestingModule } from '@nestjs/testing';
import { CooperadosController } from './cooperados.controller';
import { CooperadosService } from './cooperados.service';
import { PrismaService } from '../prisma.service';
import { NotificacoesService } from '../notificacoes/notificacoes.service';

describe('CooperadosController', () => {
  let controller: CooperadosController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CooperadosController],
      providers: [
        CooperadosService,
        { provide: PrismaService, useValue: {} },
        { provide: NotificacoesService, useValue: { criar: jest.fn() } },
      ],
    }).compile();

    controller = module.get<CooperadosController>(CooperadosController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
