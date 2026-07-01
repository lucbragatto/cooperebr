import { Test, TestingModule } from '@nestjs/testing';
import { CooperadosService } from './cooperados.service';
import { PrismaService } from '../prisma.service';
import { NotificacoesService } from '../notificacoes/notificacoes.service';
import { UsinasService } from '../usinas/usinas.service';
import { WhatsappCicloVidaService } from '../whatsapp/whatsapp-ciclo-vida.service';
import { WhatsappSenderService } from '../whatsapp/whatsapp-sender.service';
import { EmailService } from '../email/email.service';
import { FaturasService } from '../faturas/faturas.service';

// Carona Frente Jornada (01/07/2026) — regressão pré-existente: sprints
// desde M31 foram adicionando deps no CooperadosService (UsinasService,
// Whatsapp*, Email, Faturas) sem atualizar os providers deste spec, então
// "should be defined" quebrava com "Nest can't resolve dependencies".
// Stubs vazios são suficientes pra passar o smoke test — testes de
// comportamento moram em cooperados-guard-ativacao.spec.ts.
describe('CooperadosService', () => {
  let service: CooperadosService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CooperadosService,
        { provide: PrismaService, useValue: {} },
        { provide: NotificacoesService, useValue: { criar: jest.fn() } },
        { provide: UsinasService, useValue: {} },
        { provide: WhatsappCicloVidaService, useValue: {} },
        { provide: WhatsappSenderService, useValue: {} },
        { provide: EmailService, useValue: {} },
        { provide: FaturasService, useValue: {} },
      ],
    }).compile();

    service = module.get<CooperadosService>(CooperadosService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
