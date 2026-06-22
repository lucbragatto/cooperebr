/**
 * Sprint Convênio FAMÍLIA M49 (22/06/2026) — Fatia C.
 *
 * 3 endpoints sob /autorizacao-token-familiar:
 *  - POST            (criar — pagador)
 *  - POST /:id/confirmar (titular)
 *  - POST /:id/revogar   (pagador OU titular)
 *
 * cooperativaId + cooperadoId SEMPRE do JWT (lição M45). NUNCA do body.
 * Erros tipados mapeados via instanceof (pattern M48 H1).
 */
import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  Query,
  Req,
  ForbiddenException,
  BadRequestException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import {
  AutorizacaoTokenFamiliarService,
  AutorizacaoNaoEncontradaError,
  AutorizacaoConflitoError,
  CrossTenantError,
} from './autorizacao-token-familiar.service';
import { Roles } from '../auth/roles.decorator';
import { PerfilUsuario } from '../auth/perfil.enum';
import { AuditLog } from '../audit/audit-log.decorator';

const { COOPERADO, ADMIN, SUPER_ADMIN, OPERADOR } = PerfilUsuario;

@Controller('autorizacao-token-familiar')
export class AutorizacaoTokenFamiliarController {
  constructor(private readonly service: AutorizacaoTokenFamiliarService) {}

  /**
   * Sprint Família M49 — Fatia E (G4 sizing).
   *
   * Display-only: dada uma cotaKwhMensal, devolve estimativa de tokens
   * + R$ + premissas (tarifaKwh, valorTokenReais, fontes). Não persiste,
   * não emite. cooperativaId SEMPRE do JWT (lição M45).
   */
  @Roles(COOPERADO, ADMIN, SUPER_ADMIN, OPERADOR)
  @Get('sizing')
  async sizing(
    @Query('cotaKwhMensal') cotaKwhMensalRaw: string,
    @Query('distribuidora') distribuidora: string | undefined,
    @Req() req: any,
  ) {
    const cooperativaId: string | undefined = req.user?.cooperativaId;
    if (!cooperativaId) {
      throw new ForbiddenException('JWT sem cooperativaId.');
    }
    const cotaKwhMensal = Number(cotaKwhMensalRaw);
    if (!Number.isFinite(cotaKwhMensal) || cotaKwhMensal < 0) {
      throw new BadRequestException('cotaKwhMensal obrigatório (>= 0).');
    }
    return this.service.sizing({
      cooperativaId,
      cotaKwhMensal,
      distribuidora: distribuidora?.trim() || null,
    });
  }

  /**
   * Criar autorização — pagador inicia. Body só com titularId + PIN.
   * Pagador é o JWT.cooperadoId.
   */
  @Roles(COOPERADO, ADMIN, SUPER_ADMIN, OPERADOR)
  @AuditLog({ acao: 'autorizacao-token-familiar.criar', recurso: 'AutorizacaoTokenFamiliar' })
  @Post()
  async criar(
    @Body() body: { cooperadoTitularId: string; pinPagador: string },
    @Req() req: any,
  ) {
    const cooperativaId: string | undefined = req.user?.cooperativaId;
    const cooperadoPagadorId: string | undefined = req.user?.cooperadoId;
    if (!cooperativaId || !cooperadoPagadorId) {
      throw new ForbiddenException(
        'JWT sem cooperativaId/cooperadoId — operação requer cooperado autenticado.',
      );
    }
    if (!body.cooperadoTitularId?.trim() || !body.pinPagador?.trim()) {
      throw new BadRequestException('cooperadoTitularId + pinPagador obrigatórios.');
    }
    try {
      return await this.service.criar({
        cooperadoPagadorId,
        cooperadoTitularId: body.cooperadoTitularId,
        cooperativaId,
        pinPagador: body.pinPagador,
      });
    } catch (err) {
      this.mapearErro(err);
    }
  }

  /**
   * Titular confirma autorização. JWT.cooperadoId DEVE ser o titular.
   * PIN opcional (Q2 orquestrador — aceite autenticado sem PIN OK).
   */
  @Roles(COOPERADO, ADMIN, SUPER_ADMIN, OPERADOR)
  @AuditLog({ acao: 'autorizacao-token-familiar.confirmar', recurso: 'AutorizacaoTokenFamiliar', recursoIdParam: 'id' })
  @Post(':id/confirmar')
  async confirmar(
    @Param('id') autorizacaoId: string,
    @Body() body: { pinTitular?: string },
    @Req() req: any,
  ) {
    const cooperativaId: string | undefined = req.user?.cooperativaId;
    const cooperadoTitularId: string | undefined = req.user?.cooperadoId;
    if (!cooperativaId || !cooperadoTitularId) {
      throw new ForbiddenException('JWT sem cooperativaId/cooperadoId.');
    }
    try {
      return await this.service.confirmarTitular({
        autorizacaoId,
        cooperadoTitularId,
        cooperativaId,
        pinTitular: body?.pinTitular,
      });
    } catch (err) {
      this.mapearErro(err);
    }
  }

  /**
   * Revogar autorização — qualquer um dos 2 cooperados envolvidos
   * (pagador ou titular). Sem PIN do outro (Q3 orquestrador).
   */
  @Roles(COOPERADO, ADMIN, SUPER_ADMIN, OPERADOR)
  @AuditLog({ acao: 'autorizacao-token-familiar.revogar', recurso: 'AutorizacaoTokenFamiliar', recursoIdParam: 'id' })
  @Post(':id/revogar')
  async revogar(
    @Param('id') autorizacaoId: string,
    @Body() body: { motivo?: string },
    @Req() req: any,
  ) {
    const cooperativaId: string | undefined = req.user?.cooperativaId;
    const cooperadoRevogadorId: string | undefined = req.user?.cooperadoId;
    if (!cooperativaId || !cooperadoRevogadorId) {
      throw new ForbiddenException('JWT sem cooperativaId/cooperadoId.');
    }
    try {
      return await this.service.revogar({
        autorizacaoId,
        cooperadoRevogadorId,
        cooperativaId,
        motivo: body?.motivo,
      });
    } catch (err) {
      this.mapearErro(err);
    }
  }

  /**
   * Mapeia erros tipados do service pra HTTP exceptions (pattern M48 H1).
   */
  private mapearErro(err: unknown): never {
    if (err instanceof AutorizacaoNaoEncontradaError) {
      throw new NotFoundException(err.message);
    }
    if (err instanceof AutorizacaoConflitoError) {
      throw new ConflictException(err.message);
    }
    if (err instanceof CrossTenantError) {
      throw new ForbiddenException(err.message);
    }
    throw err;
  }
}
