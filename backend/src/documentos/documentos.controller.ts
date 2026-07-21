/// <reference types="multer" />
import {
  Body, Controller, Delete, Get, Param, Patch, Post, Req,
  UploadedFile, UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { DocumentosService } from './documentos.service';
import { Roles } from '../auth/roles.decorator';
import { PerfilUsuario } from '../auth/perfil.enum';
import { TenantResource } from '../auth/tenant-resource.decorator';
import { resolveTenantIdFromReq } from '../auth/tenant-resolver';

@Controller('documentos')
@Roles(PerfilUsuario.ADMIN, PerfilUsuario.OPERADOR)
export class DocumentosController {
  constructor(private readonly documentosService: DocumentosService) {}

  // Corretiva IDOR 21/07 Onda 1 item 7 — guarda posse do cooperado no tenant
  // do JWT (SUPER_ADMIN bypass automático). Corta vazamento de RG/CNH/URLs
  // cross-tenant. Service.findByCooperado permanece igual — o guard mata o
  // request antes de chegar.
  @TenantResource({ model: 'cooperado', idParam: 'cooperadoId' })
  @Get('cooperado/:cooperadoId')
  findByCooperado(@Param('cooperadoId') cooperadoId: string) {
    return this.documentosService.findByCooperado(cooperadoId);
  }

  @Post('upload/:cooperadoId')
  @UseInterceptors(FileInterceptor('arquivo'))
  uploadAdmin(
    @Param('cooperadoId') cooperadoId: string,
    @Body('tipo') tipo: string,
    @UploadedFile() arquivo: Express.Multer.File,
    @Req() req: any,
  ) {
    return this.documentosService.uploadAdmin(cooperadoId, tipo, arquivo, resolveTenantIdFromReq(req));
  }

  @Patch(':id/aprovar')
  aprovar(@Param('id') id: string, @Req() req: any) {
    return this.documentosService.aprovar(id, resolveTenantIdFromReq(req));
  }

  @Patch(':id/reprovar')
  reprovar(
    @Param('id') id: string,
    @Body('motivoRejeicao') motivoRejeicao: string,
    @Req() req: any,
  ) {
    return this.documentosService.reprovar(id, motivoRejeicao, resolveTenantIdFromReq(req));
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Req() req: any) {
    return this.documentosService.remove(id, resolveTenantIdFromReq(req));
  }
}
