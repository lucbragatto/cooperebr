import { Test, TestingModule } from '@nestjs/testing';
import { UcsService } from './ucs.service';
import { PrismaService } from '../prisma.service';

describe('UcsService', () => {
  let service: UcsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [UcsService, { provide: PrismaService, useValue: {} }],
    }).compile();

    service = module.get<UcsService>(UcsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
