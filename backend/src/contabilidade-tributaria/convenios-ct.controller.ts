import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
} from '@nestjs/common';
import { ConveniosCtService } from './convenios-ct.service';
import { CreateConvenioDto } from './dto/create-convenio.dto';
import { UpdateConvenioDto } from './dto/update-convenio.dto';
import { Roles } from '../auth/roles.decorator';
import { TenantExempt, TenantResource } from '../auth/tenant-resource.decorator';
import { PerfilUsuario } from '../auth/perfil.enum';

const { SUPER_ADMIN, ADMIN } = PerfilUsuario;

/**
 * D-novo-BR-CT CT.2 (31/05/2026) — Convenio CRUD (model novo da contabilidade
 * tributária, NÃO ContratoConvenio legado).
 *
 * Multi-tenant via Guard sistêmico F1.1+F1.2:
 *   - GET listas: filtradas por cooperativaId do JWT no service.
 *   - POST: cooperativaId vem do JWT (não body — anti body-injection).
 *   - PATCH/DELETE: @TenantResource({model:'convenio'}) bloqueia cross-tenant
 *     antes do service.
 *
 * Endpoints protegidos pelo lint baseline+ratchet F1.4 (cada handler
 * declara explicitamente).
 */
@Controller('contabilidade-tributaria/convenios')
export class ConveniosCtController {
  constructor(private readonly service: ConveniosCtService) {}

  @Roles(SUPER_ADMIN, ADMIN)
  @Get()
  findAll(@Req() req: any) {
    // SUPER_ADMIN vê todos; ADMIN tenant-scoped
    const cooperativaId = req.user?.perfil === SUPER_ADMIN
      ? null
      : (req.user?.cooperativaId ?? null);
    return this.service.findAll(cooperativaId);
  }

  @Roles(SUPER_ADMIN, ADMIN)
  @TenantResource({ model: 'convenio' })
  @Get(':id')
  findOne(@Param('id') id: string, @Req() req: any) {
    const cooperativaId = req.user?.perfil === SUPER_ADMIN
      ? null
      : (req.user?.cooperativaId ?? null);
    return this.service.findOne(id, cooperativaId);
  }

  /**
   * Create não tem `:id` pra Guard validar — cooperativaId vem do JWT.
   * @TenantExempt() satisfaz o lint anti-reincidência (F1.4) declarando
   * explicitamente que este handler intencionalmente não usa @TenantResource.
   */
  @TenantExempt()
  @Roles(SUPER_ADMIN, ADMIN)
  @Post()
  create(@Body() dto: CreateConvenioDto, @Req() req: any) {
    // cooperativaId do JWT — anti body-injection (padrão BR F0 C5/C6)
    const cooperativaId = req.user?.cooperativaId;
    if (!cooperativaId) {
      // SUPER_ADMIN sem tenant vinculado precisa impersonate
      throw new Error('cooperativaId obrigatório — SUPER_ADMIN sem tenant deve impersonate');
    }
    return this.service.create(dto, cooperativaId);
  }

  @Roles(SUPER_ADMIN, ADMIN)
  @TenantResource({ model: 'convenio' })
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateConvenioDto, @Req() req: any) {
    const cooperativaId = req.user?.perfil === SUPER_ADMIN
      ? null
      : (req.user?.cooperativaId ?? null);
    return this.service.update(id, dto, cooperativaId);
  }

  @Roles(SUPER_ADMIN, ADMIN)
  @TenantResource({ model: 'convenio' })
  @Delete(':id')
  remove(@Param('id') id: string, @Req() req: any) {
    const cooperativaId = req.user?.perfil === SUPER_ADMIN
      ? null
      : (req.user?.cooperativaId ?? null);
    return this.service.remove(id, cooperativaId);
  }
}
