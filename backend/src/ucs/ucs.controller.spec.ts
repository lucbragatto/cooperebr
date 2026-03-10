import { Test, TestingModule } from '@nestjs/testing';
import { UcsController } from './ucs.controller';

describe('UcsController', () => {
  let controller: UcsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UcsController],
    }).compile();

    controller = module.get<UcsController>(UcsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
