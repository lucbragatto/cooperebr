import { Controller, Get, Put, Param, Body } from '@nestjs/common';
import { ConfiguracaoCobrancaService } from './configuracao-cobranca.service';
import { Roles } from '../auth/roles.decorator';
import { PerfilUsuario } from '../auth/perfil.enum';

const { SUPER_ADMIN, ADMIN } = PerfilUsuario;

@Controller('configuracao-cobranca')
export class ConfiguracaoCobrancaController {
  constructor(private readonly service: ConfiguracaoCobrancaService) {}

  @Roles(SUPER_ADMIN, ADMIN)
  @Get()
  findCooperativa() {
    // TODO: extrair cooperativaId do token quando multi-tenant estiver pronto
    return this.service.findByCooperativa('default');
  }

  @Roles(SUPER_ADMIN, ADMIN)
  @Put()
  upsertCooperativa(@Body() body: { descontoPadrao: number; descontoMin: number; descontoMax: number; baseCalculo?: string; cooperativaId?: string }) {
    const cooperativaId = body.cooperativaId ?? 'default';
    return this.service.upsertCooperativa(cooperativaId, body);
  }

  @Roles(SUPER_ADMIN, ADMIN)
  @Get('usina/:usinaId')
  findByUsina(@Param('usinaId') usinaId: string) {
    return this.service.findByUsina(usinaId);
  }

  @Roles(SUPER_ADMIN, ADMIN)
  @Put('usina/:usinaId')
  upsertUsina(
    @Param('usinaId') usinaId: string,
    @Body() body: { descontoPadrao: number; descontoMin: number; descontoMax: number; baseCalculo?: string; cooperativaId?: string },
  ) {
    const cooperativaId = body.cooperativaId ?? 'default';
    return this.service.upsertUsina(usinaId, cooperativaId, body);
  }

  @Roles(SUPER_ADMIN, ADMIN)
  @Get('resolver/:contratoId')
  resolverDesconto(@Param('contratoId') contratoId: string) {
    return this.service.resolverDesconto(contratoId);
  }
}
