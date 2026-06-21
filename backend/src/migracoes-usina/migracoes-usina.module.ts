import { Module, forwardRef } from '@nestjs/common';
import { MigracoesUsinaController } from './migracoes-usina.controller';
import { MigracoesUsinaService } from './migracoes-usina.service';
import { PrismaService } from '../prisma.service';
import { ContratosModule } from '../contratos/contratos.module';
import { UsinasModule } from '../usinas/usinas.module';
import { WhatsappModule } from '../whatsapp/whatsapp.module';
// Sprint M47 (21/06/2026): mecânica de migração externa
// (DISTRIBUIDORA/COOPERATIVA concorrente → SISGD). Wrapper sobre MigracaoUsina
// existente, com 3 endpoints sob /cooperados/:id/migrar*.
import { MigracaoExternaService } from './migracao-externa.service';
// Sprint M47 Fatia D — cron diário que detecta migrações > 30d em PENDENTE
// e alerta admin do tenant via WA + AuditLog forense.
import { MigracaoExternaJob } from './migracao-externa.job';

@Module({
  imports: [
    forwardRef(() => ContratosModule),
    UsinasModule,
    forwardRef(() => WhatsappModule),
  ],
  controllers: [MigracoesUsinaController],
  providers: [MigracoesUsinaService, MigracaoExternaService, MigracaoExternaJob, PrismaService],
  exports: [MigracoesUsinaService, MigracaoExternaService],
})
export class MigracoesUsinaModule {}
