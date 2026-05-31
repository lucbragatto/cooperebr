import { Controller, Get, Post, Patch, Delete, Param, Body, Req, BadRequestException, ForbiddenException } from '@nestjs/common';
import { CondominiosService } from './condominios.service';
import { Roles } from '../auth/roles.decorator';
import { PerfilUsuario } from '../auth/perfil.enum';

const { SUPER_ADMIN, ADMIN } = PerfilUsuario;

@Controller('condominios')
export class CondominiosController {
  constructor(private readonly service: CondominiosService) {}

  @Roles(SUPER_ADMIN, ADMIN)
  @Get()
  findAll(@Req() req: any) {
    return this.service.findAll(req.user?.cooperativaId);
  }

  @Roles(SUPER_ADMIN, ADMIN)
  @Post()
  create(@Body() body: any, @Req() req: any) {
    // D-novo-BR F0.4 MA4 — body.cooperativaId só vale pra SUPER_ADMIN.
    const perfil = req.user?.perfil;
    const jwtCoop = req.user?.cooperativaId;
    let cooperativaId: string;
    if (perfil === SUPER_ADMIN) {
      cooperativaId = body.cooperativaId ?? jwtCoop;
      if (!cooperativaId) throw new BadRequestException('SUPER_ADMIN deve informar cooperativaId');
    } else {
      if (!jwtCoop) throw new ForbiddenException('Usuário sem cooperativaId no token');
      cooperativaId = jwtCoop;
    }
    return this.service.create({
      ...body,
      cooperativaId,
    });
  }

  @Roles(SUPER_ADMIN, ADMIN)
  @Get(':id')
  findOne(@Param('id') id: string, @Req() req: any) {
    return this.service.findOne(id, req.user?.cooperativaId);
  }

  @Roles(SUPER_ADMIN, ADMIN)
  @Patch(':id')
  update(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    return this.service.update(id, body, req.user?.cooperativaId);
  }

  @Roles(SUPER_ADMIN, ADMIN)
  @Delete(':id')
  remove(@Param('id') id: string, @Req() req: any) {
    return this.service.remove(id, req.user?.cooperativaId);
  }

  @Roles(SUPER_ADMIN, ADMIN)
  @Post(':id/unidades')
  adicionarUnidade(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    return this.service.adicionarUnidade(id, body, req.user?.cooperativaId);
  }

  @Roles(SUPER_ADMIN, ADMIN)
  @Delete(':id/unidades/:unidadeId')
  removerUnidade(@Param('unidadeId') unidadeId: string, @Param('id') id: string, @Req() req: any) {
    return this.service.removerUnidade(unidadeId, req.user?.cooperativaId);
  }

  @Roles(SUPER_ADMIN, ADMIN)
  @Post(':id/rateio')
  calcularRateio(@Param('id') id: string, @Body() body: { kWhGerado?: number; energiaTotal?: number }, @Req() req: any) {
    const kwh = body.kWhGerado ?? body.energiaTotal;
    if (!kwh || kwh <= 0) {
      throw new BadRequestException('kWhGerado deve ser maior que zero');
    }
    // D-novo-BR F0.4 BA1 — JWT pra prevenir vazamento cross-tenant
    return this.service.calcularRateio(id, kwh, req.user?.cooperativaId ?? null);
  }
}
