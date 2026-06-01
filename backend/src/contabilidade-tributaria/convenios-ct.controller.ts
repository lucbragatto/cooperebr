import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Req,
} from '@nestjs/common';
import { ConveniosCtService } from './convenios-ct.service';
import { ContabilidadeTributariaService } from './contabilidade-tributaria.service';
import { CreateConvenioDto } from './dto/create-convenio.dto';
import { UpdateConvenioDto } from './dto/update-convenio.dto';
import { RegistrarMovimentoConvenioDto } from './dto/registrar-movimento-convenio.dto';
import { Roles } from '../auth/roles.decorator';
import { TenantExempt, TenantResource } from '../auth/tenant-resource.decorator';
import { AuditLog } from '../audit/audit-log.decorator';
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
  constructor(
    private readonly service: ConveniosCtService,
    private readonly contabilidade: ContabilidadeTributariaService,
  ) {}

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

  /**
   * D-novo-CT-CT.9 (01/06/2026) — Registrar movimento manual (Design A).
   * Síncrono: cria LancamentoCaixa Auxiliar (Art. 88) na hora; erros sobem
   * pra UI (mês fechado → ConflictException; não-coop → BadRequest).
   */
  @Roles(SUPER_ADMIN, ADMIN)
  @TenantResource({ model: 'convenio' })
  @AuditLog({
    acao: 'contabilidade.convenio.movimento',
    recurso: 'Convenio',
    recursoIdParam: 'id',
  })
  @HttpCode(201)
  @Post(':id/movimentos')
  async registrarMovimento(
    @Param('id') id: string,
    @Body() dto: RegistrarMovimentoConvenioDto,
    @Req() req: any,
  ) {
    const cooperativaId =
      req.user?.perfil === SUPER_ADMIN
        ? // SUPER_ADMIN sem tenant precisa impersonate — carrega o tenant do convênio
          (await this.service.findOne(id, null)).cooperativaId
        : req.user?.cooperativaId;
    if (!cooperativaId) {
      throw new Error('cooperativaId não resolvido');
    }
    // CT.9.1 BUG 1: parsear YYYY-MM-DD como LOCAL (não UTC).
    // `new Date('2026-08-01')` é UTC midnight → vira 31/07 em GMT-3.
    // `new Date(2026, 7, 1)` é local midnight → 01/08 correto.
    const [ano, mes, dia] = dto.dataMovimento.split('-').map(Number);
    const dataMovimento = new Date(ano, mes - 1, dia);
    // Competência derivada da STRING (não da Date) — garante consistência
    // com o que o usuário digitou independente de timezone.
    const competencia = dto.dataMovimento.substring(0, 7); // YYYY-MM
    return this.contabilidade.criarLancamentoConvenio({
      convenioId: id,
      valor: dto.valor,
      dataMovimento,
      competencia,
      descricao: dto.descricao,
      cooperativaId,
    });
  }

  /**
   * D-novo-CT-CT.9 (01/06/2026) — Histórico de movimentos do convênio.
   */
  @Roles(SUPER_ADMIN, ADMIN, PerfilUsuario.OPERADOR)
  @TenantResource({ model: 'convenio' })
  @Get(':id/movimentos')
  listarMovimentos(@Param('id') id: string, @Req() req: any) {
    const cooperativaId =
      req.user?.perfil === SUPER_ADMIN ? null : req.user?.cooperativaId ?? null;
    return this.service.listarMovimentos(id, cooperativaId);
  }

  /**
   * D-novo-CT-CT.9.1 (01/06/2026 noite) — Estorna movimento de convênio.
   * Mesmo padrão do estorno RepasseProprietario: deleta LancamentoCaixa
   * atomicamente, com gate apuração FECHADA.
   */
  @Roles(SUPER_ADMIN, ADMIN)
  @TenantResource({ model: 'convenio' })
  @AuditLog({
    acao: 'contabilidade.convenio.movimento.estornar',
    recurso: 'Convenio',
    recursoIdParam: 'id',
  })
  @Delete(':id/movimentos/:lancamentoId')
  async estornarMovimento(
    @Param('id') id: string,
    @Param('lancamentoId') lancamentoId: string,
    @Body() body: { motivo?: string } | undefined,
    @Req() req: any,
  ) {
    const cooperativaId =
      req.user?.perfil === SUPER_ADMIN
        ? (await this.service.findOne(id, null)).cooperativaId
        : req.user?.cooperativaId;
    if (!cooperativaId) {
      throw new Error('cooperativaId não resolvido');
    }
    return this.contabilidade.estornarMovimentoConvenio({
      convenioId: id,
      lancamentoId,
      cooperativaId,
      motivo: body?.motivo,
      usuarioId: req.user?.id ?? req.user?.userId,
    });
  }
}
