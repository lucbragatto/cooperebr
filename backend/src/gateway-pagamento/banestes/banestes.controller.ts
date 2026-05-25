import { Controller, Post, Req, Logger } from '@nestjs/common';
import { BanestesAdapter } from './banestes.adapter';
import { Roles } from '../../auth/roles.decorator';
import { PerfilUsuario } from '../../auth/perfil.enum';
import { AuditLog } from '../../audit/audit-log.decorator';

const { SUPER_ADMIN, ADMIN } = PerfilUsuario;

/**
 * Endpoints administrativos do adapter Banestes — Cenario Minimo (M26).
 *
 * SO `testar-conexao` por enquanto. Emissao de cobranca vai pelo fluxo
 * canonico `/gateway-pagamento` (via GatewayPagamentoService.emitirCobranca).
 *
 * Auth: JWT SUPER_ADMIN ou ADMIN do tenant.
 */
@Controller('gateway-pagamento/banestes')
export class BanestesController {
  private readonly logger = new Logger(BanestesController.name);

  constructor(private readonly adapter: BanestesAdapter) {}

  /**
   * Smoke test contra Banestes sandbox (ou producao, conforme env).
   * Util pos-Luciano configurar .env BANESTES_* + .pfx no disco.
   *
   * Retorno:
   *   { ok: boolean, totalCustomers?: number, erro?: string }
   *
   * Sucesso (ok=true) confirma que:
   *   - .pfx carregou + senha correta
   *   - OAuth credentials validos (token obtido)
   *   - Conectividade de rede + DNS ok
   *   - mTLS handshake passou (Banestes aceitou o cert)
   */
  @Roles(SUPER_ADMIN, ADMIN)
  @AuditLog({
    acao: 'gateway_banestes.testar_conexao',
    recurso: 'GatewayBanestes',
  })
  @Post('testar-conexao')
  async testarConexao(@Req() req: any) {
    const cooperativaId = req.user?.cooperativaId ?? 'plataforma';
    this.logger.log(
      `testar-conexao Banestes (usuario=${req.user?.userId ?? req.user?.id}, tenant=${cooperativaId})`,
    );
    return this.adapter.testarConexao(cooperativaId);
  }
}
