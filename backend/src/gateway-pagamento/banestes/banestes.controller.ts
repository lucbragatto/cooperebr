import { BadRequestException, Controller, Logger, Post, Query, Req } from '@nestjs/common';
import { BanestesAdapter } from './banestes.adapter';
import { Roles } from '../../auth/roles.decorator';
import { PerfilUsuario } from '../../auth/perfil.enum';
import { AuditLog } from '../../audit/audit-log.decorator';

const { SUPER_ADMIN, ADMIN } = PerfilUsuario;

/**
 * Endpoints administrativos do adapter Banestes.
 *
 * Sub-Sprint Gateways de Pagamento — Fatia F3 (M28, 2026-05-26):
 * remove fallback 'plataforma' (nao faz sentido apos refator multi-tenant
 * — ConfigGateway BANESTES e por tenant real). Exige cooperativaId
 * (do JWT pra ADMIN ou via query pra SUPER_ADMIN).
 *
 * SO `testar-conexao` por enquanto. Emissao de cobranca vai pelo fluxo
 * canonico `/gateway-pagamento` (via GatewayPagamentoService.emitirCobranca).
 *
 * Auth: JWT SUPER_ADMIN ou ADMIN do tenant.
 *
 * NOTA: testar-conexao tambem disponivel via fluxo canonico
 * `POST /gateways-pagamento/:id/testar` (M27) — esse endpoint aqui e
 * direto pro adapter sem precisar do id de ConfigGateway. Util pra debug.
 */
@Controller('gateway-pagamento/banestes')
export class BanestesController {
  private readonly logger = new Logger(BanestesController.name);

  constructor(private readonly adapter: BanestesAdapter) {}

  /**
   * Smoke test contra Banestes (sandbox ou producao, conforme
   * `ConfigGateway.ambiente` do tenant).
   *
   * Auth: SUPER_ADMIN (via query cooperativaId) ou ADMIN (via JWT.cooperativaId).
   *
   * Retorno:
   *   { ok: boolean, totalCustomers?: number, erro?: string }
   *
   * Sucesso (ok=true) confirma que:
   *   - ConfigGateway BANESTES ativa pro tenant
   *   - Credenciais decifradas com sucesso (GATEWAY_ENCRYPT_KEY ok)
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
  async testarConexao(@Req() req: any, @Query('cooperativaId') queryCoopId?: string) {
    const cooperativaId = this.resolverTenant(req, queryCoopId);
    this.logger.log(
      `testar-conexao Banestes (usuario=${req.user?.userId ?? req.user?.id}, tenant=${cooperativaId})`,
    );
    return this.adapter.testarConexao(cooperativaId);
  }

  /**
   * SUPER_ADMIN deve passar query cooperativaId. ADMIN usa cooperativaId
   * do JWT; query divergente e rejeitada.
   */
  private resolverTenant(req: any, queryCoopId: string | undefined): string {
    const ehSuperAdmin = req.user?.perfil === SUPER_ADMIN;
    if (ehSuperAdmin) {
      const escolhido = queryCoopId ?? req.user?.cooperativaId;
      if (!escolhido) {
        throw new BadRequestException(
          'SUPER_ADMIN deve informar cooperativaId via query param ' +
            '(POST /gateway-pagamento/banestes/testar-conexao?cooperativaId=...).',
        );
      }
      return escolhido;
    }
    const jwt = req.user?.cooperativaId;
    if (!jwt) {
      throw new BadRequestException('cooperativaId nao identificado no JWT.');
    }
    if (queryCoopId && queryCoopId !== jwt) {
      throw new BadRequestException(
        'ADMIN nao pode testar conexao de outra cooperativa. Use o seu proprio tenant.',
      );
    }
    return jwt;
  }
}
