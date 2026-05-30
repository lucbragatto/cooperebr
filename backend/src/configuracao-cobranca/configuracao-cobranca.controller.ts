import { Controller, Get, Put, Param, Body, Req, BadRequestException, ForbiddenException } from '@nestjs/common';
import { ConfiguracaoCobrancaService } from './configuracao-cobranca.service';
import { PrismaService } from '../prisma.service';
import { Roles } from '../auth/roles.decorator';
import { PerfilUsuario } from '../auth/perfil.enum';

const { SUPER_ADMIN, ADMIN } = PerfilUsuario;

/**
 * D-novo-BQ.2 C5 + C6 (30/05/2026) — Cooperativa-id NÃO mais aceito do BODY
 * para ADMIN. SUPER_ADMIN pode informar cooperativaId no body (cross-tenant
 * intencional / impersonate). ADMIN sempre fica preso ao próprio tenant.
 */
@Controller('configuracao-cobranca')
export class ConfiguracaoCobrancaController {
  constructor(
    private readonly service: ConfiguracaoCobrancaService,
    private readonly prisma: PrismaService,
  ) {}

  private resolverTenant(req: any, body?: { cooperativaId?: string }): string {
    const perfil = req?.user?.perfil;
    const jwtCoop: string | undefined = req?.user?.cooperativaId;
    if (perfil === SUPER_ADMIN) {
      // SA pode operar em outro tenant explicitamente, mas precisa indicar (body ou próprio JWT)
      const target = body?.cooperativaId ?? jwtCoop;
      if (!target) {
        throw new BadRequestException('SUPER_ADMIN deve informar cooperativaId no body');
      }
      return target;
    }
    // ADMIN ignora body — sempre o próprio tenant
    if (!jwtCoop) {
      throw new ForbiddenException('Usuário sem cooperativaId no token');
    }
    return jwtCoop;
  }

  @Roles(SUPER_ADMIN, ADMIN)
  @Get()
  findCooperativa(@Req() req: any) {
    const cooperativaId = req.user?.cooperativaId;
    return this.service.findByCooperativa(cooperativaId || 'default');
  }

  @Roles(SUPER_ADMIN, ADMIN)
  @Put()
  upsertCooperativa(
    @Body() body: { descontoPadrao: number; descontoMin: number; descontoMax: number; baseCalculo?: string; cooperativaId?: string },
    @Req() req: any,
  ) {
    const cooperativaId = this.resolverTenant(req, body);
    return this.service.upsertCooperativa(cooperativaId, body);
  }

  @Roles(SUPER_ADMIN, ADMIN)
  @Get('usina/:usinaId')
  findByUsina(@Param('usinaId') usinaId: string) {
    return this.service.findByUsina(usinaId);
  }

  @Roles(SUPER_ADMIN, ADMIN)
  @Put('usina/:usinaId')
  async upsertUsina(
    @Param('usinaId') usinaId: string,
    @Body() body: { descontoPadrao: number; descontoMin: number; descontoMax: number; baseCalculo?: string; cooperativaId?: string },
    @Req() req: any,
  ) {
    const cooperativaId = this.resolverTenant(req, body);
    // Verificar que a usina pertence ao tenant (ou SA bypass quando body explicita o tenant)
    const usina = await this.prisma.usina.findFirst({
      where: { id: usinaId, cooperativaId },
      select: { id: true },
    });
    if (!usina) {
      throw new ForbiddenException('Usina não pertence ao seu tenant');
    }
    return this.service.upsertUsina(usinaId, cooperativaId, body);
  }

  @Roles(SUPER_ADMIN, ADMIN)
  @Get('resolver/:contratoId')
  resolverDesconto(@Param('contratoId') contratoId: string) {
    return this.service.resolverDesconto(contratoId);
  }
}
