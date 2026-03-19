import { Test, TestingModule } from '@nestjs/testing';
import { UsinasController } from './usinas.controller';
import { UsinasService } from './usinas.service';
import { PrismaService } from '../prisma.service';

describe('UsinasController', () => {
  let controller: UsinasController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsinasController],
      providers: [UsinasService, { provide: PrismaService, useValue: {} }],
    }).compile();

    controller = module.get<UsinasController>(UsinasController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
