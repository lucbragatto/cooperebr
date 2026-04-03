import { Module, forwardRef } from '@nestjs/common';
import { FaturasController } from './faturas.controller';
import { FaturasService } from './faturas.service';
import { RelatorioFaturaService } from './relatorio-fatura.service';
import { PrismaService } from '../prisma.service';
import { NotificacoesModule } from '../notificacoes/notificacoes.module';
import { ConfigTenantModule } from '../config-tenant/config-tenant.module';
import { EmailModule } from '../email/email.module';
import { CooperTokenModule } from '../cooper-token/cooper-token.module';

@Module({
  imports: [NotificacoesModule, ConfigTenantModule, EmailModule, CooperTokenModule],
  controllers: [FaturasController],
  providers: [FaturasService, RelatorioFaturaService, PrismaService],
  exports: [FaturasService, RelatorioFaturaService],
})
export class FaturasModule {}
