import { Controller, Get, Post, Put, Delete, Param, Body, Query, Req } from '@nestjs/common';
import { UsinasService } from './usinas.service';
import { UsinasAnaliticoService } from './usinas-analitico.service';
import { Roles } from '../auth/roles.decorator';
import { PerfilUsuario } from '../auth/perfil.enum';
import { CreateUsinaDto } from './dto/create-usina.dto';
import { UpdateUsinaDto } from './dto/update-usina.dto';
import { TenantResource } from '../auth/tenant-resource.decorator';
import { resolveTenantIdFromReq } from '../auth/tenant-resolver';

const { SUPER_ADMIN, ADMIN, OPERADOR, COOPERADO } = PerfilUsuario;

@Controller('usinas')
export class UsinasController {
  constructor(
    private readonly usinasService: UsinasService,
    private readonly analiticoService: UsinasAnaliticoService,
  ) {}

  @Roles(SUPER_ADMIN, ADMIN, OPERADOR, COOPERADO)
  @Get()
  findAll(@Req() req: any, @Query('distribuidora') distribuidora?: string) {
    return this.usinasService.findAll(distribuidora, req.user?.cooperativaId);
  }

  // Corretiva IDOR 21/07 Onda 2 item 6 — Query param (nao @Param), fora do
  // alcance do @TenantResource. Fix service-level: passa cooperativaId do JWT
  // fail-CLOSED, service valida UC no tenant ANTES de listar usinas.
  @Roles(SUPER_ADMIN, ADMIN, OPERADOR)
  @Get('disponiveis')
  findDisponiveis(@Query('ucId') ucId: string, @Req() req: any) {
    const cooperativaId = resolveTenantIdFromReq(req);
    return this.usinasService.findDisponiveis(ucId, cooperativaId);
  }

  // Corretiva IDOR 21/07 Onda 1 item 5 — @TenantResource nos 4 handlers
  // analíticos de :id de usina (o guard 404 cross-tenant automático). Corta
  // vazamento de nome+CPF via /distribuicao e leitura cross-tenant de
  // saúde/ocupacao/lista-concessionaria. SUPER_ADMIN bypass automático.
  // 11 usinas no banco, 0 com tenant nulo — zero regressão esperada.
  @Roles(SUPER_ADMIN, ADMIN, OPERADOR)
  @TenantResource({ model: 'usina' })
  @Get(':id/saude-financeira')
  saudeFinanceira(@Param('id') id: string) {
    return this.analiticoService.saudeFinanceira(id);
  }

  @Roles(SUPER_ADMIN, ADMIN, OPERADOR)
  @TenantResource({ model: 'usina' })
  @Get(':id/ocupacao')
  ocupacao(@Param('id') id: string) {
    return this.analiticoService.ocupacao(id);
  }

  @Roles(SUPER_ADMIN, ADMIN, OPERADOR, COOPERADO)
  @TenantResource({ model: 'usina' })
  @Get(':id/distribuicao')
  distribuicao(@Param('id') id: string) {
    return this.usinasService.distribuicaoCreditos(id);
  }

  @Roles(SUPER_ADMIN, ADMIN, OPERADOR)
  @TenantResource({ model: 'usina' })
  @Get(':id/lista-concessionaria')
  listaConcessionaria(@Param('id') id: string) {
    return this.usinasService.gerarListaConcessionaria(id);
  }

  @Roles(SUPER_ADMIN, ADMIN, OPERADOR)
  @Post(':id/verificar-espera')
  verificarEspera(@Param('id') id: string, @Req() req: any) {
    // D-48.7: injeta cooperativaId do JWT (null = SUPER_ADMIN bypass).
    return this.usinasService.verificarListaEspera(id, req.user?.cooperativaId ?? null);
  }

  @Roles(SUPER_ADMIN, ADMIN, OPERADOR, COOPERADO)
  @Get('proprietario/dashboard')
  proprietarioDashboard(@Req() req: any) {
    return this.usinasService.proprietarioDashboard(req.user?.cooperadoId);
  }

  @Roles(SUPER_ADMIN, ADMIN, OPERADOR, COOPERADO)
  @Get(':id')
  findOne(@Param('id') id: string, @Req() req: any) {
    return this.usinasService.findOne(id, req.user?.cooperativaId);
  }

  @Roles(SUPER_ADMIN, ADMIN, OPERADOR)
  @Post()
  create(@Body() body: CreateUsinaDto) {
    return this.usinasService.create(body as any);
  }

  @Roles(SUPER_ADMIN, ADMIN, OPERADOR)
  @Put(':id')
  update(@Param('id') id: string, @Body() body: UpdateUsinaDto, @Req() req: any) {
    return this.usinasService.update(id, body as any, req.user?.cooperativaId ?? null);
  }

  @Roles(SUPER_ADMIN, ADMIN)
  @Delete(':id')
  remove(@Param('id') id: string, @Req() req: any) {
    return this.usinasService.remove(id, req.user?.cooperativaId ?? null);
  }
}
