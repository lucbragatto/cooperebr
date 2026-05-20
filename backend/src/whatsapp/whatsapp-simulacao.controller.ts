import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Post,
} from '@nestjs/common';
import { Roles } from '../auth/roles.decorator';
import { PerfilUsuario } from '../auth/perfil.enum';
import { CurrentUser } from '../auth/current-user.decorator';
import {
  PreviewModeloInput,
  PreviewModeloOutput,
  SimulacaoInput,
  SimulacaoOutput,
  WhatsappFluxoMotorService,
} from './whatsapp-fluxo-motor.service';

interface UsuarioAutenticado {
  id: string;
  perfil: string;
  cooperativaId?: string | null;
}

interface SimularBody {
  mensagem: string;
  estadoInicial?: string;
  dadosTemp?: Record<string, unknown>;
  cooperativaId?: string | null; // apenas SUPER_ADMIN pode definir; demais sao ignorados
}

interface PreviewModeloBody {
  modeloId: string;
  dadosTemp?: Record<string, unknown>;
  cooperativaId?: string | null; // apenas SUPER_ADMIN pode definir; demais sao ignorados
}

/**
 * Endpoint de simulacao in-memory do fluxo Assis.
 *
 * Permite que o admin veja, dentro do dashboard, qual seria a resposta do
 * bot para uma mensagem hipotetica de cooperado, SEM:
 *   - persistir conversa no banco
 *   - disparar mensagem real via Baileys
 *   - incrementar usosCount do modelo
 *
 * Usado pela Fase 5 (UI de configuracao com simulador de telefone). Tambem
 * util para QA/debug de fluxo e validacao de templates apos edicao.
 *
 * MULTI-TENANT:
 *   - ADMIN: simulacao roda sempre com cooperativaId do JWT.
 *     Tentativa de informar cooperativaId diferente no body e ignorada.
 *   - SUPER_ADMIN: pode informar cooperativaId no body para simular como
 *     qualquer tenant ou null (simulacao apenas com etapas/modelos globais).
 */
@Controller('whatsapp')
export class WhatsappSimulacaoController {
  constructor(private readonly motor: WhatsappFluxoMotorService) {}

  @Roles(PerfilUsuario.ADMIN, PerfilUsuario.SUPER_ADMIN)
  @Post('simular')
  async simular(
    @Body() body: SimularBody,
    @CurrentUser() user: UsuarioAutenticado,
  ): Promise<SimulacaoOutput> {
    if (!body || typeof body.mensagem !== 'string' || body.mensagem.length === 0) {
      throw new BadRequestException('Campo "mensagem" e obrigatorio (string nao vazia)');
    }
    if (body.mensagem.length > 4096) {
      throw new BadRequestException('Mensagem excede 4096 caracteres');
    }
    if (body.estadoInicial !== undefined && typeof body.estadoInicial !== 'string') {
      throw new BadRequestException('Campo "estadoInicial" deve ser string');
    }

    const cooperativaId = this.resolverEscopo(body.cooperativaId, user);

    const input: SimulacaoInput = {
      mensagem: body.mensagem,
      cooperativaId,
      estadoInicial: body.estadoInicial,
      dadosTemp: body.dadosTemp,
    };

    return this.motor.simular(input);
  }

  /**
   * Fase C - Preview isolado de modelo de mensagem.
   * Renderiza um modelo com as variaveis do tenant logado sem disparar fluxo
   * nem incrementar contador de uso. Usado pelo botao "Pre-visualizar" no
   * Banco de Mensagens da tela /dashboard/whatsapp-config.
   */
  @Roles(PerfilUsuario.ADMIN, PerfilUsuario.SUPER_ADMIN)
  @Post('preview-modelo')
  async previewModelo(
    @Body() body: PreviewModeloBody,
    @CurrentUser() user: UsuarioAutenticado,
  ): Promise<PreviewModeloOutput> {
    if (!body || typeof body.modeloId !== 'string' || body.modeloId.length === 0) {
      throw new BadRequestException('Campo "modeloId" e obrigatorio (string nao vazia)');
    }

    const cooperativaId = this.resolverEscopo(body.cooperativaId, user);

    const input: PreviewModeloInput = {
      modeloId: body.modeloId,
      cooperativaId,
      dadosTemp: body.dadosTemp,
    };

    return this.motor.previewModelo(input);
  }

  /**
   * Define qual tenant sera usado na simulacao a partir do perfil do
   * usuario autenticado.
   *
   * SUPER_ADMIN: respeita cooperativaId do body (pode simular qualquer
   * tenant ou null para escopo global).
   *
   * Demais perfis (ADMIN): ignora cooperativaId do body e forca o do JWT.
   * Se ADMIN tenta informar tenant diferente do proprio -> Forbidden.
   */
  private resolverEscopo(
    cooperativaIdBody: string | null | undefined,
    user: UsuarioAutenticado,
  ): string | null | undefined {
    if (user.perfil === PerfilUsuario.SUPER_ADMIN) {
      // null explicito = simular escopo global; undefined = sem filtro
      return cooperativaIdBody === undefined ? undefined : cooperativaIdBody;
    }

    const proprio = user.cooperativaId ?? null;

    if (
      cooperativaIdBody !== undefined &&
      cooperativaIdBody !== null &&
      cooperativaIdBody !== proprio
    ) {
      throw new ForbiddenException(
        'ADMIN nao pode simular como outra cooperativa',
      );
    }

    return proprio;
  }
}
