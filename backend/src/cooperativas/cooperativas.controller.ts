import { Controller, Get, Post, Put, Patch, Delete, Param, Body, Request, Res, BadRequestException } from '@nestjs/common';
import { Response } from 'express';
import { CooperativasService } from './cooperativas.service';
import { Roles } from '../auth/roles.decorator';
import { PerfilUsuario } from '../auth/perfil.enum';
import { assertSameTenantOrSuperAdmin } from '../auth/tenant-guard.helper';
import { getTiposDisponiveis } from './tipo-parceiro.helper';
import { AuditLog } from '../audit/audit-log.decorator';

const { SUPER_ADMIN, ADMIN } = PerfilUsuario;

@Controller('cooperativas')
export class CooperativasController {
  constructor(private readonly cooperativasService: CooperativasService) {}

  @Roles(SUPER_ADMIN, ADMIN)
  @Get('tipos')
  tipos() {
    return getTiposDisponiveis();
  }

  @Roles(SUPER_ADMIN, ADMIN)
  @Get('financeiro/:id')
  getFinanceiro(@Param('id') id: string, @Request() req: any) {
    assertSameTenantOrSuperAdmin(req.user, id);
    return this.cooperativasService.getFinanceiro(id);
  }

  @Roles(SUPER_ADMIN, ADMIN)
  @Patch('financeiro/:id')
  updateFinanceiro(
    @Param('id') id: string,
    @Body() body: { multaAtraso?: number; jurosDiarios?: number; diasCarencia?: number },
    @Request() req: any,
  ) {
    assertSameTenantOrSuperAdmin(req.user, id);
    return this.cooperativasService.updateFinanceiro(id, body);
  }

  @Roles(ADMIN)
  @Get('meu-dashboard')
  meuDashboard(@Request() req: any) {
    const cooperativaId = req.user?.cooperativaId;
    if (!cooperativaId) {
      throw new BadRequestException('Usuário não vinculado a uma cooperativa');
    }
    return this.cooperativasService.meuDashboard(cooperativaId);
  }

  @Roles(SUPER_ADMIN, ADMIN)
  @Get()
  findAll(@Request() req: any) {
    if (req.user?.perfil === ADMIN) {
      const cooperativaId = req.user?.cooperativaId;
      if (!cooperativaId) {
        throw new BadRequestException('Usuário não vinculado a uma cooperativa');
      }
      return this.cooperativasService.findOne(cooperativaId).then((c) => [c]);
    }
    return this.cooperativasService.findAll();
  }

  @Roles(SUPER_ADMIN, ADMIN)
  @Get(':id/painel-parceiro')
  painelParceiro(@Param('id') id: string, @Request() req: any) {
    assertSameTenantOrSuperAdmin(req.user, id);
    return this.cooperativasService.painelParceiro(id);
  }

  @Roles(SUPER_ADMIN, ADMIN)
  @Get(':id/qrcode')
  async gerarQrCode(@Param('id') id: string, @Request() req: any) {
    assertSameTenantOrSuperAdmin(req.user, id);
    return this.cooperativasService.gerarQrCode(id);
  }

  @Roles(SUPER_ADMIN, ADMIN)
  @Get(':id')
  findOne(@Param('id') id: string, @Request() req: any) {
    assertSameTenantOrSuperAdmin(req.user, id);
    return this.cooperativasService.findOne(id);
  }

  @Roles(SUPER_ADMIN)
  @AuditLog({ acao: 'cooperativa.criar', recurso: 'Cooperativa' })
  @Post()
  create(
    @Body()
    body: {
      nome: string;
      cnpj: string;
      email?: string;
      telefone?: string;
      endereco?: string;
      numero?: string;
      bairro?: string;
      cidade?: string;
      estado?: string;
      cep?: string;
      ativo?: boolean;
      tipoParceiro?: string;
    },
  ) {
    return this.cooperativasService.create(body);
  }

  @Roles(SUPER_ADMIN, ADMIN)
  @Put('minha')
  updateMinha(
    @Body()
    body: {
      nome?: string;
      cnpj?: string;
      email?: string;
      telefone?: string;
      endereco?: string;
      numero?: string;
      bairro?: string;
      cidade?: string;
      estado?: string;
      cep?: string;
      ativo?: boolean;
      tipoParceiro?: string;
      bandeiraAtiva?: boolean;
      bandeiraSincronizacaoAuto?: boolean;
    },
    @Request() req: any,
  ) {
    // D-30Y2 fix: tela /dashboard/parceiros/configurar consome este endpoint.
    // Usa cooperativaId do JWT em vez de :id no path — admin nunca pode
    // editar outra cooperativa por esta rota.
    const cooperativaId = req.user?.cooperativaId;
    if (!cooperativaId) {
      throw new BadRequestException('Usuário não vinculado a uma cooperativa');
    }
    return this.cooperativasService.update(cooperativaId, body);
  }

  @Roles(SUPER_ADMIN, ADMIN)
  @AuditLog({ acao: 'cooperativa.atualizar', recurso: 'Cooperativa', recursoIdParam: 'id' })
  @Put(':id')
  update(
    @Param('id') id: string,
    @Body()
    body: {
      nome?: string;
      cnpj?: string;
      email?: string;
      telefone?: string;
      endereco?: string;
      numero?: string;
      bairro?: string;
      cidade?: string;
      estado?: string;
      cep?: string;
      ativo?: boolean;
      tipoParceiro?: string;
      bandeiraAtiva?: boolean;
      bandeiraSincronizacaoAuto?: boolean;
    },
    @Request() req: any,
  ) {
    assertSameTenantOrSuperAdmin(req.user, id);
    return this.cooperativasService.update(id, body);
  }

  @Roles(SUPER_ADMIN)
  @AuditLog({ acao: 'cooperativa.plano.vincular', recurso: 'Cooperativa', recursoIdParam: 'id' })
  @Patch(':id/plano')
  vincularPlano(
    @Param('id') id: string,
    @Body() body: { planoSaasId: string | null },
  ) {
    return this.cooperativasService.update(id, { planoSaasId: body.planoSaasId ?? undefined });
  }

  @Roles(SUPER_ADMIN)
  @AuditLog({ acao: 'cooperativa.deletar', recurso: 'Cooperativa', recursoIdParam: 'id' })
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.cooperativasService.remove(id);
  }
}
