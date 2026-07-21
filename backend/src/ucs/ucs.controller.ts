import { Controller, Get, Post, Put, Delete, Param, Body, Req } from '@nestjs/common';
import { UcsService } from './ucs.service';
import { Roles } from '../auth/roles.decorator';
import { PerfilUsuario } from '../auth/perfil.enum';
import { TenantResource } from '../auth/tenant-resource.decorator';
import { resolveTenantIdFromReq } from '../auth/tenant-resolver';

const { SUPER_ADMIN, ADMIN, OPERADOR, COOPERADO } = PerfilUsuario;

@Controller('ucs')
export class UcsController {
  constructor(private readonly ucsService: UcsService) {}

  @Roles(SUPER_ADMIN, ADMIN, OPERADOR)
  @Get()
  findAll(@Req() req: any) {
    return this.ucsService.findAll(req.user?.cooperativaId);
  }

  // Corretiva IDOR 21/07 Onda 2 item 8a — posse via cooperado.cooperativaId
  // porque Uc.cooperativaId tem drift (19 NULLs + 2 registros com tenant
  // divergente do dono real via cooperado, catalogado D-novo-UC-TENANT-DRIFT).
  // Guard 404 cross-tenant automático (SUPER_ADMIN bypass).
  @Roles(SUPER_ADMIN, ADMIN, OPERADOR, COOPERADO)
  @TenantResource({ model: 'uc', via: 'cooperado.cooperativaId' })
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.ucsService.findOne(id);
  }

  // Corretiva IDOR 21/07 Onda 2 item 8b — guard valida cooperado no tenant.
  @Roles(SUPER_ADMIN, ADMIN, OPERADOR, COOPERADO)
  @TenantResource({ model: 'cooperado', idParam: 'cooperadoId' })
  @Get('cooperado/:cooperadoId')
  findByCooperado(@Param('cooperadoId') cooperadoId: string) {
    return this.ucsService.findByCooperado(cooperadoId);
  }

  @Roles(SUPER_ADMIN, ADMIN, OPERADOR)
  @Post()
  create(
    @Body()
    body: {
      numero: string;
      endereco: string;
      cidade: string;
      estado: string;
      cooperadoId: string;
      distribuidora: string;
      numeroUC?: string;
      numeroConcessionariaOriginal?: string;
      cep?: string;
      bairro?: string;
      classificacao?: string;
      codigoMedidor?: string;
      modalidadeTarifaria?: string;
      tensaoNominal?: string;
      tipoFornecimento?: string;
    },
    @Req() req: any,
  ) {
    // Corretiva IDOR 21/07 Onda 2 item 8c — service valida que body.cooperadoId
    // pertence ao tenant do caller ANTES de criar a UC. Sem isso, ADMIN de A
    // criava UCs "sobre" cooperados de B (o UC ficaria orfa do ponto de vista
    // do tenant B, mas o dado do cooperado B ficava associado a input do A).
    const cooperativaId = resolveTenantIdFromReq(req);
    return this.ucsService.create(body, cooperativaId);
  }

  @Roles(SUPER_ADMIN, ADMIN, OPERADOR)
  @Put(':id')
  update(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    return this.ucsService.update(id, body, req.user?.cooperativaId ?? null);
  }

  @Roles(SUPER_ADMIN, ADMIN)
  @Delete(':id')
  remove(@Param('id') id: string, @Req() req: any) {
    return this.ucsService.remove(id, req.user?.cooperativaId ?? null);
  }
}
