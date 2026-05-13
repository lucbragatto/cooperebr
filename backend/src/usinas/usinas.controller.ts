import { Controller, Get, Post, Put, Delete, Param, Body, Query, Req } from '@nestjs/common';
import { UsinasService } from './usinas.service';
import { UsinasAnaliticoService } from './usinas-analitico.service';
import { Roles } from '../auth/roles.decorator';
import { PerfilUsuario } from '../auth/perfil.enum';

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

  @Roles(SUPER_ADMIN, ADMIN, OPERADOR)
  @Get('disponiveis')
  findDisponiveis(@Query('ucId') ucId: string) {
    return this.usinasService.findDisponiveis(ucId);
  }

  @Roles(SUPER_ADMIN, ADMIN, OPERADOR)
  @Get(':id/saude-financeira')
  saudeFinanceira(@Param('id') id: string) {
    return this.analiticoService.saudeFinanceira(id);
  }

  @Roles(SUPER_ADMIN, ADMIN, OPERADOR)
  @Get(':id/ocupacao')
  ocupacao(@Param('id') id: string) {
    return this.analiticoService.ocupacao(id);
  }

  @Roles(SUPER_ADMIN, ADMIN, OPERADOR, COOPERADO)
  @Get(':id/distribuicao')
  distribuicao(@Param('id') id: string) {
    return this.usinasService.distribuicaoCreditos(id);
  }

  @Roles(SUPER_ADMIN, ADMIN, OPERADOR)
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
  create(@Body() body: any) {
    return this.usinasService.create(body);
  }

  @Roles(SUPER_ADMIN, ADMIN, OPERADOR)
  @Put(':id')
  update(@Param('id') id: string, @Body() body: any) {
    return this.usinasService.update(id, body);
  }

  @Roles(SUPER_ADMIN, ADMIN)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.usinasService.remove(id);
  }
}
