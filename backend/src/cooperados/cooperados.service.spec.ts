import { Test, TestingModule } from '@nestjs/testing';
import { CooperadosService } from './cooperados.service';

describe('CooperadosService', () => {
  let service: CooperadosService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CooperadosService],
    }).compile();

    service = module.get<CooperadosService>(CooperadosService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
