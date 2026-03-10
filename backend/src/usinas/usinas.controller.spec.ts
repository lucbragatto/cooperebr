import { Test, TestingModule } from '@nestjs/testing';
import { UsinasController } from './usinas.controller';

describe('UsinasController', () => {
  let controller: UsinasController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsinasController],
    }).compile();

    controller = module.get<UsinasController>(UsinasController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
