import { Controller, Logger } from '@nestjs/common';
import { GatewaysPagamentoConfigService } from './gateways-pagamento-config.service';

/**
 * Stub Etapa A — endpoints reais na Etapa F.
 */
@Controller('gateways-pagamento')
export class GatewaysPagamentoConfigController {
  private readonly logger = new Logger(GatewaysPagamentoConfigController.name);

  constructor(private readonly service: GatewaysPagamentoConfigService) {}
}
