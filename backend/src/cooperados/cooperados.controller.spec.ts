import { Test, TestingModule } from '@nestjs/testing';
import { CooperadosController } from './cooperados.controller';
import { CooperadosService } from './cooperados.service';
import { PrismaService } from '../prisma.service';
import { NotificacoesService } from '../notificacoes/notificacoes.service';
import { UsinasService } from '../usinas/usinas.service';
import { WhatsappCicloVidaService } from '../whatsapp/whatsapp-ciclo-vida.service';
import { WhatsappSenderService } from '../whatsapp/whatsapp-sender.service';
import { EmailService } from '../email/email.service';
import { FaturasService } from '../faturas/faturas.service';
import { UcsService } from '../ucs/ucs.service';
import { MotorPropostaService } from '../motor-proposta/motor-proposta.service';
import { MigracaoExternaService } from '../migracoes-usina/migracao-externa.service';
import { RoteamentoCadastroService } from '../roteamento-cadastro/roteamento-cadastro.service';

// Carona Frente Jornada (01/07/2026) — regressão pré-existente: várias
// sprints (M31, M47, M48) adicionaram deps sem atualizar este spec.
describe('CooperadosController', () => {
  let controller: CooperadosController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CooperadosController],
      providers: [
        CooperadosService,
        { provide: PrismaService, useValue: {} },
        { provide: NotificacoesService, useValue: { criar: jest.fn() } },
        { provide: UsinasService, useValue: {} },
        { provide: WhatsappCicloVidaService, useValue: {} },
        { provide: WhatsappSenderService, useValue: {} },
        { provide: EmailService, useValue: {} },
        { provide: FaturasService, useValue: {} },
        { provide: UcsService, useValue: {} },
        { provide: MotorPropostaService, useValue: {} },
        { provide: MigracaoExternaService, useValue: {} },
        { provide: RoteamentoCadastroService, useValue: {} },
      ],
    }).compile();

    controller = module.get<CooperadosController>(CooperadosController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
