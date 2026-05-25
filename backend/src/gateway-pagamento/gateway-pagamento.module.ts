import { Module } from '@nestjs/common';
import { GatewayPagamentoService } from './gateway-pagamento.service';
import { AsaasAdapter } from './adapters/asaas.adapter';
import { AsaasModule } from '../asaas/asaas.module';
import { BanestesModule } from './banestes/banestes.module';
import { BanestesAdapter } from './banestes/banestes.adapter';
import { PrismaService } from '../prisma.service';

@Module({
  imports: [AsaasModule, BanestesModule],
  providers: [GatewayPagamentoService, AsaasAdapter, BanestesAdapter, PrismaService],
  exports: [GatewayPagamentoService],
})
export class GatewayPagamentoModule {}
