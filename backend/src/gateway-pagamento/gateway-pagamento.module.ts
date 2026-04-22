import { Module } from '@nestjs/common';
import { GatewayPagamentoService } from './gateway-pagamento.service';
import { AsaasAdapter } from './adapters/asaas.adapter';
import { AsaasModule } from '../asaas/asaas.module';
import { PrismaService } from '../prisma.service';

@Module({
  imports: [AsaasModule],
  providers: [GatewayPagamentoService, AsaasAdapter, PrismaService],
  exports: [GatewayPagamentoService],
})
export class GatewayPagamentoModule {}
