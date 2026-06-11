import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Request,
  BadRequestException,
} from '@nestjs/common';
import { ConciergeService } from './concierge.service';
import { Roles } from '../auth/roles.decorator';
import { PerfilUsuario } from '../auth/perfil.enum';
import { assertSameTenantOrSuperAdmin } from '../auth/tenant-guard.helper';
import type { FaturaRawInput } from './fatura-canonica/fatura-canonica.types';

const { SUPER_ADMIN, ADMIN } = PerfilUsuario;

interface PreviewBody {
  distribuidora: 'EDP_ES' | 'ELFSM' | 'ENERGISA_TO';
  rubricas: Array<{
    descricao: string;
    unidade?: string;
    quantidade?: number;
    precoUnitarioComTributos?: number;
    tarifaUnitariaBase?: number;
    valorTotalReais?: number;
    baseCalculoIcms?: number;
    aliquotaIcms?: number;
    valorIcms?: number;
    valorPisCofins?: number;
  }>;
  metadados: {
    mesReferencia: string;
    classificacao: string;
    valorTotalFatura: number;
    titularNome?: string;
    titularDocumento?: string;
    numeroUC?: string;
    basePisCofinsDeclarada?: number;
    aliquotaPisDeclarada?: number;
    aliquotaCofinsDeclarada?: number;
    modalidadeTarifaria?: string;
    dataVencimento?: string;
  };
}

@Controller('concierge')
export class ConciergeController {
  constructor(private readonly conciergeService: ConciergeService) {}

  /**
   * Status do modulo Concierge da cooperativa do usuario logado.
   * Util pro frontend decidir se mostra a tela ou banner upgrade.
   */
  @Roles(SUPER_ADMIN, ADMIN)
  @Get('status')
  async getStatus(@Request() req: any): Promise<{
    cooperativaId: string;
    moduloConciergeAtivo: boolean;
  }> {
    const cooperativaId = req.user.cooperativaId;
    const isSuperAdmin = req.user.perfil === SUPER_ADMIN;
    const ativo = await this.conciergeService.verificarModuloAtivo(
      cooperativaId,
      isSuperAdmin,
    );
    return { cooperativaId, moduloConciergeAtivo: ativo };
  }

  /**
   * Lista cooperados auditaveis (com pelo menos 1 fatura processada).
   * Apenas pra cooperativas com modulo ativo.
   */
  @Roles(SUPER_ADMIN, ADMIN)
  @Get('auditaveis')
  async listarAuditaveis(@Request() req: any): Promise<{
    items: Array<{
      cooperadoId: string;
      nome: string;
      email: string | null;
      qtdFaturasProcessadas: number;
      ultimaFaturaMes: string | null;
    }>;
    total: number;
  }> {
    const cooperativaId = req.user.cooperativaId;
    const isSuperAdmin = req.user.perfil === SUPER_ADMIN;
    await this.conciergeService.assertModuloAtivoOrThrow(
      cooperativaId,
      isSuperAdmin,
    );
    const items = await this.conciergeService.listarAuditaveis(cooperativaId);
    return { items, total: items.length };
  }

  /**
   * Preview do diagnostico de indebito - in-memory, nao persiste.
   * Recebe rubricas + metadados (formato adaptavel para qualquer distribuidora).
   */
  @Roles(SUPER_ADMIN, ADMIN)
  @Post('preview')
  async previewDiagnostico(
    @Request() req: any,
    @Body() body: PreviewBody,
  ): Promise<{
    fatura: any;
    resultado: any;
    erro?: string;
  }> {
    const cooperativaId = req.user.cooperativaId;
    const isSuperAdmin = req.user.perfil === SUPER_ADMIN;
    await this.conciergeService.assertModuloAtivoOrThrow(
      cooperativaId,
      isSuperAdmin,
    );

    if (!body.distribuidora) {
      throw new BadRequestException('Campo distribuidora obrigatorio');
    }
    if (!body.rubricas || body.rubricas.length === 0) {
      throw new BadRequestException('Campo rubricas[] obrigatorio (nao vazio)');
    }
    if (!body.metadados) {
      throw new BadRequestException('Campo metadados obrigatorio');
    }

    const input: FaturaRawInput = {
      rubricas: body.rubricas,
      metadados: body.metadados,
    };
    return this.conciergeService.previewDiagnostico(input, body.distribuidora);
  }

  // ─── SUPER_ADMIN — gestao do modulo por parceiro ──────────────────

  @Roles(SUPER_ADMIN)
  @Get('saas/cooperativas-ativas')
  async listarCooperativasAtivas(): Promise<{
    items: Array<{ id: string; nome: string; ativadoEm: Date | null }>;
    total: number;
  }> {
    const items = await this.conciergeService.listarCooperativasComConcierge();
    return { items, total: items.length };
  }

  @Roles(SUPER_ADMIN)
  @Patch('saas/cooperativas/:id/ativar')
  async ativar(
    @Param('id') id: string,
    @Request() req: any,
  ): Promise<{ id: string; moduloConciergeAtivo: boolean }> {
    assertSameTenantOrSuperAdmin(req.user, id);
    return this.conciergeService.alterarStatusModulo(id, true);
  }

  @Roles(SUPER_ADMIN)
  @Patch('saas/cooperativas/:id/desativar')
  async desativar(
    @Param('id') id: string,
    @Request() req: any,
  ): Promise<{ id: string; moduloConciergeAtivo: boolean }> {
    assertSameTenantOrSuperAdmin(req.user, id);
    return this.conciergeService.alterarStatusModulo(id, false);
  }
}
