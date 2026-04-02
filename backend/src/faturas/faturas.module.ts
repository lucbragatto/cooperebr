import { Module, forwardRef } from '@nestjs/common';
import { FaturasController } from './faturas.controller';
import { FaturasService } from './faturas.service';
import { RelatorioFaturaService } from './relatorio-fatura.service';
import { PrismaService } from '../prisma.service';
import { NotificacoesModule } from '../notificacoes/notificacoes.module';
import { ConfigTenantModule } from '../config-tenant/config-tenant.module';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [NotificacoesModule, ConfigTenantModule, EmailModule],
  controllers: [FaturasController],
  providers: [FaturasService, RelatorioFaturaService, PrismaService],
  exports: [FaturasService, RelatorioFaturaService],
})
export class FaturasModule {}
