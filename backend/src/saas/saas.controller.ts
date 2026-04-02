import { Controller, Get, Post, Patch, Delete, Param, Body, Query } from '@nestjs/common';
import { SaasService } from './saas.service';
import { Roles } from '../auth/roles.decorator';
import { PerfilUsuario } from '../auth/perfil.enum';

const { SUPER_ADMIN } = PerfilUsuario;

@Controller('saas')
export class SaasController {
  constructor(private readonly saasService: SaasService) {}

  // ─── Planos ───────────────────────────────────────────────

  @Roles(SUPER_ADMIN)
  @Get('planos')
  findAllPlanos() {
    return this.saasService.findAllPlanos();
  }

  @Roles(SUPER_ADMIN)
  @Get('planos/:id')
  findOnePlano(@Param('id') id: string) {
    return this.saasService.findOnePlano(id);
  }

  @Roles(SUPER_ADMIN)
  @Post('planos/vincular')
  vincularPlano(@Body() body: { cooperativaId: string; planoSaasId: string | null }) {
    return this.saasService.vincularPlano(body.cooperativaId, body.planoSaasId);
  }

  @Roles(SUPER_ADMIN)
  @Post('planos')
  createPlano(
    @Body() body: {
      nome: string;
      descricao?: string;
      taxaSetup?: number;
      mensalidadeBase?: number;
      limiteMembros?: number;
      percentualReceita?: number;
      modulosHabilitados?: string[];
      modalidadesModulos?: Record<string, string>;
    },
  ) {
    return this.saasService.createPlano(body);
  }

  @Roles(SUPER_ADMIN)
  @Patch('planos/:id')
  updatePlano(
    @Param('id') id: string,
    @Body() body: Partial<{
      nome: string;
      descricao: string;
      taxaSetup: number;
      mensalidadeBase: number;
      limiteMembros: number;
      percentualReceita: number;
      ativo: boolean;
      modulosHabilitados: string[];
      modalidadesModulos: Record<string, string>;
    }>,
  ) {
    return this.saasService.updatePlano(id, body);
  }

  @Roles(SUPER_ADMIN)
  @Delete('planos/:id')
  deletePlano(@Param('id') id: string) {
    return this.saasService.deletePlano(id);
  }

  // ─── Faturas ──────────────────────────────────────────────

  @Roles(SUPER_ADMIN)
  @Get('faturas')
  findAllFaturas(@Query('status') status?: string) {
    return this.saasService.findAllFaturas(status ? { status } : undefined);
  }

  @Roles(SUPER_ADMIN)
  @Post('faturas/gerar')
  gerarFaturas() {
    return this.saasService.gerarFaturasMensal();
  }
}
