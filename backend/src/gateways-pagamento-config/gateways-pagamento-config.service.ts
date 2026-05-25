import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CredentialsEncryptor } from './credentials-encryptor.service';
import { GatewayPagamentoService } from '../gateway-pagamento/gateway-pagamento.service';

/**
 * Stub Etapa A — implementacao real nas Etapas D + E.
 */
@Injectable()
export class GatewaysPagamentoConfigService {
  private readonly logger = new Logger(GatewaysPagamentoConfigService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly encryptor: CredentialsEncryptor,
    private readonly gatewayPagamento: GatewayPagamentoService,
  ) {}
}
