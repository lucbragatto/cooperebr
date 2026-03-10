import { Test, TestingModule } from '@nestjs/testing';
import { CooperadosController } from './cooperados.controller';

describe('CooperadosController', () => {
  let controller: CooperadosController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CooperadosController],
    }).compile();

    controller = module.get<CooperadosController>(CooperadosController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
