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
});
