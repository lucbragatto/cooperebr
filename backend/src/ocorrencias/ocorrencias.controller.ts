import { Controller, Get, Post, Put, Delete, Param, Body, Req } from '@nestjs/common';
import { OcorrenciasService } from './ocorrencias.service';
import { Roles } from '../auth/roles.decorator';
import { PerfilUsuario } from '../auth/perfil.enum';
import { TenantResource } from '../auth/tenant-resource.decorator';

const { SUPER_ADMIN, ADMIN, OPERADOR, COOPERADO } = PerfilUsuario;

@Controller('ocorrencias')
export class OcorrenciasController {
  constructor(private readonly ocorrenciasService: OcorrenciasService) {}

  @Roles(SUPER_ADMIN, ADMIN, OPERADOR)
  @Get()
  findAll(@Req() req: any) {
    return this.ocorrenciasService.findAll(req.user?.cooperativaId);
  }

  @Roles(SUPER_ADMIN, ADMIN, OPERADOR, COOPERADO)
  @Get(':id')
  findOne(@Param('id') id: string, @Req() req: any) {
    return this.ocorrenciasService.findOne(id, req.user?.cooperativaId);
  }

  // Corretiva IDOR 21/07 Onda 1 item 9a — guarda posse do cooperado no tenant.
  // Guard 404 cross-tenant automático (SUPER_ADMIN bypass). Service permanece.
  @Roles(SUPER_ADMIN, ADMIN, OPERADOR, COOPERADO)
  @TenantResource({ model: 'cooperado', idParam: 'cooperadoId' })
  @Get('cooperado/:cooperadoId')
  findByCooperado(@Param('cooperadoId') cooperadoId: string) {
    return this.ocorrenciasService.findByCooperado(cooperadoId);
  }

  // COOPERADO pode abrir ocorrências
  @Roles(SUPER_ADMIN, ADMIN, OPERADOR, COOPERADO)
  @Post()
  create(
    @Body()
    body: {
      cooperadoId: string;
      ucId?: string;
      tipo: 'FALTA_ENERGIA' | 'MEDICAO_INCORRETA' | 'PROBLEMA_FATURA' | 'SOLICITACAO' | 'OUTROS';
      descricao: string;
      prioridade: 'BAIXA' | 'MEDIA' | 'ALTA' | 'CRITICA';
    },
    @Req() req: any,
  ) {
    // D-novo-BR F0.3 MA2 — cooperativaId do JWT (ignora body)
    return this.ocorrenciasService.create(body, req.user?.cooperativaId ?? null);
  }

  @Roles(SUPER_ADMIN, ADMIN, OPERADOR)
  @Put(':id')
  update(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    return this.ocorrenciasService.update(id, body, req.user?.cooperativaId ?? null);
  }

  @Roles(SUPER_ADMIN, ADMIN)
  @Delete(':id')
  remove(@Param('id') id: string, @Req() req: any) {
    return this.ocorrenciasService.remove(id, req.user?.cooperativaId ?? null);
  }
}
