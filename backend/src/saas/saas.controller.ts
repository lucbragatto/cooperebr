import { Controller, Get, Post, Patch, Delete, Param, Body, Query, Request } from '@nestjs/common';
import { SaasService } from './saas.service';
import { MetricasSaasService } from './metricas-saas.service';
import { Roles } from '../auth/roles.decorator';
import { PerfilUsuario } from '../auth/perfil.enum';
import { assertSameTenantOrSuperAdmin } from '../auth/tenant-guard.helper';
import { AuditLog } from '../audit/audit-log.decorator';

const { SUPER_ADMIN, ADMIN } = PerfilUsuario;

@Controller('saas')
export class SaasController {
  constructor(
    private readonly saasService: SaasService,
    private readonly metricasSaasService: MetricasSaasService,
  ) {}

  // ─── Painel super-admin ──────────────────────────────────

  @Roles(SUPER_ADMIN)
  @Get('dashboard')
  getDashboard() {
    return this.metricasSaasService.getResumoGeral();
  }

  @Roles(SUPER_ADMIN)
  @Get('parceiros')
  getParceiros() {
    return this.metricasSaasService.getListaParceirosEnriquecida();
  }

  @Roles(SUPER_ADMIN, ADMIN)
  @Get('parceiros/:id/saude')
  getSaudeParceiro(@Param('id') id: string, @Request() req: any) {
    assertSameTenantOrSuperAdmin(req.user, id);
    return this.metricasSaasService.getSaudeParceiro(id);
  }

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
  @AuditLog({ acao: 'saas.plano.vincular', recurso: 'PlanoSaas' })
  @Post('planos/vincular')
  vincularPlano(@Body() body: { cooperativaId: string; planoSaasId: string | null }) {
    return this.saasService.vincularPlano(body.cooperativaId, body.planoSaasId);
  }

  @Roles(SUPER_ADMIN)
  @AuditLog({ acao: 'saas.plano.criar', recurso: 'PlanoSaas' })
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
  @AuditLog({ acao: 'saas.plano.atualizar', recurso: 'PlanoSaas', recursoIdParam: 'id' })
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
  @AuditLog({ acao: 'saas.plano.deletar', recurso: 'PlanoSaas', recursoIdParam: 'id' })
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
  @AuditLog({ acao: 'saas.fatura.gerar', recurso: 'FaturaSaas' })
  @Post('faturas/gerar')
  gerarFaturas() {
    return this.saasService.gerarFaturasMensal();
  }
}
