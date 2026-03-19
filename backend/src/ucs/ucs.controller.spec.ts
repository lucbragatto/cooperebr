import { Test, TestingModule } from '@nestjs/testing';
import { UcsController } from './ucs.controller';
import { UcsService } from './ucs.service';
import { PrismaService } from '../prisma.service';

describe('UcsController', () => {
  let controller: UcsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UcsController],
      providers: [UcsService, { provide: PrismaService, useValue: {} }],
    }).compile();

    controller = module.get<UcsController>(UcsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
