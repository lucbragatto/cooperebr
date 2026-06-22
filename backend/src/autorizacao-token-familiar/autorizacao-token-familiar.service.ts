/**
 * Sprint Convênio FAMÍLIA M49 (22/06/2026) — Fatia C.
 *
 * Gerencia AutorizacaoTokenFamiliar (consentimento bilateral entre cooperado
 * PAGADOR e cooperado TITULAR pra permitir `usarNaFatura` familiar).
 *
 * Fluxo (decisões orquestrador 22/06):
 *  1. PAGADOR cria a autorização com PIN obrigatório (compromete tokens dela).
 *     `confirmadoPagadorEm` setado. `ativo=false` até titular confirmar.
 *  2. TITULAR confirma no portal/app — PIN se tiver; aceite autenticado sem.
 *     `confirmadoTitularEm` setado + `ativo=true`.
 *  3. Qualquer um (pagador OU titular) pode REVOGAR unilateralmente sem PIN
 *     do outro (registra `revogadoPorCooperadoId` + `motivoRevogacao`).
 *     `ativo=false` após revogação. Tokens já usados NÃO voltam (queimaram).
 *
 * Multi-tenant inegociável (lição M45):
 *  - `cooperativaId` do JWT em TODOS os endpoints.
 *  - `pagador.cooperativaId === titular.cooperativaId` validado no criar.
 *
 * Cardinalidade 1:1 v1 via `@@unique([cooperadoPagadorId, cooperadoTitularId])`.
 * Multi (E5/E6) = sprint futura.
 *
 * Notificação WA (transparência total — pattern E1 M46):
 *  - Criar → notifica titular ("você foi solicitado/a aceitar abate familiar").
 *  - Confirmar → notifica pagador ("titular aceitou; vocês podem abater fatura").
 *  - Revogar → notifica o outro lado ("autorização revogada por {nome}").
 */
import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { PinCooperadoService } from '../cooperados/pin-cooperado.service';
import { WhatsappSenderService } from '../whatsapp/whatsapp-sender.service';
import { estimarTokensPorConsumo, SizingResultado } from './sizing.helper';

/**
 * Erros tipados pra controller mapear via instanceof (pattern M48 H1).
 */
export class AutorizacaoNaoEncontradaError extends Error {
  readonly code = 'AUTORIZACAO_NOT_FOUND';
  constructor(msg: string) { super(msg); this.name = 'AutorizacaoNaoEncontradaError'; }
}
export class AutorizacaoConflitoError extends Error {
  readonly code = 'AUTORIZACAO_CONFLITO';
  constructor(msg: string) { super(msg); this.name = 'AutorizacaoConflitoError'; }
}
export class CrossTenantError extends Error {
  readonly code = 'CROSS_TENANT';
  constructor(msg: string) { super(msg); this.name = 'CrossTenantError'; }
}

@Injectable()
export class AutorizacaoTokenFamiliarService {
  private readonly logger = new Logger(AutorizacaoTokenFamiliarService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly pinCooperadoService: PinCooperadoService,
    private readonly waSender: WhatsappSenderService,
  ) {}

  /**
   * PAGADOR cria autorização. PIN OBRIGATÓRIO (Q2 orquestrador).
   * Multi-tenant: titular DEVE estar no mesmo tenant do pagador.
   */
  async criar(params: {
    cooperadoPagadorId: string;
    cooperadoTitularId: string;
    cooperativaId: string;     // do JWT (M45)
    pinPagador: string;
  }) {
    const { cooperadoPagadorId, cooperadoTitularId, cooperativaId, pinPagador } = params;

    if (cooperadoPagadorId === cooperadoTitularId) {
      throw new BadRequestException('Pagador e titular devem ser cooperados diferentes.');
    }
    if (!/^\d{6}$/.test(pinPagador)) {
      throw new BadRequestException('PIN obrigatório (6 dígitos numéricos).');
    }

    // Multi-tenant: ambos cooperados no MESMO tenant (lição M45 + nota orquestrador).
    const [pagador, titular] = await Promise.all([
      this.prisma.cooperado.findFirst({
        where: { id: cooperadoPagadorId, cooperativaId },
        select: { id: true, nomeCompleto: true, telefone: true },
      }),
      this.prisma.cooperado.findFirst({
        where: { id: cooperadoTitularId, cooperativaId },
        select: { id: true, nomeCompleto: true, telefone: true },
      }),
    ]);
    if (!pagador) {
      throw new NotFoundException('Cooperado pagador não encontrado neste tenant.');
    }
    if (!titular) {
      throw new CrossTenantError(
        'Cooperado titular não encontrado neste tenant — autorização familiar só entre cooperados da MESMA cooperativa.',
      );
    }

    // PIN do pagador (compromete tokens dela).
    const pinRes = await this.pinCooperadoService.validarPinComLockout({
      cooperadoId: cooperadoPagadorId,
      pin: pinPagador,
      cooperativaId,
    });
    if (!pinRes.ok) {
      if (pinRes.motivo === 'PIN_NAO_DEFINIDO') {
        throw new BadRequestException('PIN do pagador não foi definido. Configure no portal.');
      }
      if (pinRes.motivo === 'PIN_BLOQUEADO') {
        throw new ForbiddenException(
          `PIN bloqueado até ${pinRes.desbloqueiaEm.toISOString()}.`,
        );
      }
      throw new ForbiddenException('PIN incorreto.');
    }

    // Idempotência: se já existe autorização ativa (não-revogada) entre os 2, retorna.
    //
    // P1-mtenant reviewer 22/06 — o @@unique é global (pagadorId+titularId, sem
    // cooperativaId). findUnique retorna record de outro tenant se par colidir
    // (caso de borda de migração). Defesa: lê cooperativaId no select e aborta
    // com CrossTenantError se não bate. Multi-tenant inegociável M45.
    const existente = await this.prisma.autorizacaoTokenFamiliar.findUnique({
      where: {
        cooperadoPagadorId_cooperadoTitularId: {
          cooperadoPagadorId,
          cooperadoTitularId,
        },
      },
      select: {
        id: true,
        cooperativaId: true,
        ativo: true,
        revogadoEm: true,
        confirmadoTitularEm: true,
      },
    });
    if (existente && existente.cooperativaId !== cooperativaId) {
      throw new CrossTenantError(
        'Já existe autorização entre esses cooperados em outro tenant — peça pro admin investigar.',
      );
    }
    if (existente && !existente.revogadoEm) {
      throw new AutorizacaoConflitoError(
        'Já existe autorização entre esses cooperados — use revogar antes de recriar.',
      );
    }

    // Cria (ou recria se houve revogação antiga).
    //
    // P1-mtenant reviewer 22/06 — recriar usa update com cooperativaId no where
    // (defense-in-depth — paridade com confirmar/revogar). Sem isso, o where
    // por id puro confia em garantia de @@unique global.
    const agora = new Date();
    const autorizacao = existente
      ? await this.prisma.autorizacaoTokenFamiliar.update({
          where: { id: existente.id, cooperativaId },
          data: {
            confirmadoPagadorEm: agora,
            confirmadoTitularEm: null,
            ativo: false,
            revogadoEm: null,
            revogadoPorCooperadoId: null,
            motivoRevogacao: null,
          },
        })
      : await this.prisma.autorizacaoTokenFamiliar.create({
          data: {
            cooperativaId,
            cooperadoPagadorId,
            cooperadoTitularId,
            confirmadoPagadorEm: agora,
            ativo: false,
          },
        });

    // P2-code reviewer 22/06 — void + .catch evita unhandled rejection
    // mesmo se o método lançar antes do try interno.
    void this.notificarTitularSolicitacao(titular, pagador, autorizacao.id, cooperativaId).catch(
      (err) => this.logger.warn(`[m49] notif criar falhou: ${(err as Error).message}`),
    );

    this.logger.log(
      `[m49] autorizacao criada id=${autorizacao.id.slice(0, 8)}… pagador=${cooperadoPagadorId.slice(0, 8)}… titular=${cooperadoTitularId.slice(0, 8)}… tenant=${cooperativaId.slice(0, 8)}…`,
    );
    return autorizacao;
  }

  /**
   * TITULAR confirma a autorização. PIN se tiver (Q2 orquestrador: aceite
   * autenticado é suficiente — não bloquear se titular não definiu PIN).
   * Após confirmar, `ativo=true`.
   */
  async confirmarTitular(params: {
    autorizacaoId: string;
    cooperadoTitularId: string;
    cooperativaId: string;
    pinTitular?: string;
  }) {
    const { autorizacaoId, cooperadoTitularId, cooperativaId, pinTitular } = params;

    const autorizacao = await this.prisma.autorizacaoTokenFamiliar.findFirst({
      where: { id: autorizacaoId, cooperativaId, cooperadoTitularId },
      include: {
        cooperadoPagador: { select: { id: true, nomeCompleto: true, telefone: true } },
      },
    });
    if (!autorizacao) {
      throw new AutorizacaoNaoEncontradaError(
        'Autorização não encontrada ou você não é o titular dela.',
      );
    }
    if (autorizacao.revogadoEm) {
      throw new AutorizacaoConflitoError('Autorização revogada — não pode confirmar.');
    }
    if (autorizacao.confirmadoTitularEm) {
      throw new AutorizacaoConflitoError('Autorização já foi confirmada pelo titular.');
    }

    // PIN se tiver — aceite autenticado é OK sem (Q2 orquestrador).
    if (pinTitular && /^\d{6}$/.test(pinTitular)) {
      const pinRes = await this.pinCooperadoService.validarPinComLockout({
        cooperadoId: cooperadoTitularId,
        pin: pinTitular,
        cooperativaId,
      });
      if (!pinRes.ok && pinRes.motivo !== 'PIN_NAO_DEFINIDO') {
        if (pinRes.motivo === 'PIN_BLOQUEADO') {
          throw new ForbiddenException(
            `PIN bloqueado até ${pinRes.desbloqueiaEm.toISOString()}.`,
          );
        }
        throw new ForbiddenException('PIN incorreto.');
      }
    }

    const agora = new Date();
    const atualizada = await this.prisma.autorizacaoTokenFamiliar.update({
      where: { id: autorizacao.id, cooperativaId },
      data: { confirmadoTitularEm: agora, ativo: true },
    });

    // P1-mtenant reviewer 22/06 — findFirst com cooperativaId (findUnique
    // by id puro lê cooperado de qualquer tenant). Não-quebrante: titular
    // já foi validado no where da autorização (linha 184), mas defesa
    // explícita aqui evita drift se a query upstream mudar.
    const titular = await this.prisma.cooperado.findFirst({
      where: { id: cooperadoTitularId, cooperativaId },
      select: { nomeCompleto: true, telefone: true },
    });
    void this.notificarPagadorConfirmado(
      autorizacao.cooperadoPagador,
      titular,
      autorizacao.id,
      cooperativaId,
    ).catch((err) =>
      this.logger.warn(`[m49] notif confirmar falhou: ${(err as Error).message}`),
    );

    this.logger.log(
      `[m49] autorizacao ${autorizacao.id} CONFIRMADA titular=${cooperadoTitularId} ativo=true`,
    );
    return atualizada;
  }

  /**
   * Revogação unilateral (Q3 orquestrador). Pagador OU titular pode revogar
   * sem PIN do outro. Tokens já usados NÃO voltam.
   */
  async revogar(params: {
    autorizacaoId: string;
    cooperadoRevogadorId: string;   // quem está pedindo a revogação (JWT)
    cooperativaId: string;
    motivo?: string;
  }) {
    const { autorizacaoId, cooperadoRevogadorId, cooperativaId, motivo } = params;

    const autorizacao = await this.prisma.autorizacaoTokenFamiliar.findFirst({
      where: { id: autorizacaoId, cooperativaId },
      include: {
        cooperadoPagador: { select: { id: true, nomeCompleto: true, telefone: true } },
        cooperadoTitular: { select: { id: true, nomeCompleto: true, telefone: true } },
      },
    });
    if (!autorizacao) {
      throw new AutorizacaoNaoEncontradaError('Autorização não encontrada neste tenant.');
    }
    if (autorizacao.revogadoEm) {
      throw new AutorizacaoConflitoError('Autorização já estava revogada.');
    }

    const ehPagador = autorizacao.cooperadoPagadorId === cooperadoRevogadorId;
    const ehTitular = autorizacao.cooperadoTitularId === cooperadoRevogadorId;
    if (!ehPagador && !ehTitular) {
      throw new ForbiddenException(
        'Só pagador ou titular podem revogar essa autorização.',
      );
    }

    const motivoLimpo = motivo?.trim().slice(0, 500) || null;
    const agora = new Date();
    const atualizada = await this.prisma.autorizacaoTokenFamiliar.update({
      where: { id: autorizacao.id, cooperativaId },
      data: {
        ativo: false,
        revogadoEm: agora,
        revogadoPorCooperadoId: cooperadoRevogadorId,
        motivoRevogacao: motivoLimpo,
      },
    });

    // Notifica o OUTRO lado (Q4 orquestrador).
    const outro = ehPagador ? autorizacao.cooperadoTitular : autorizacao.cooperadoPagador;
    const quemRevogou = ehPagador
      ? autorizacao.cooperadoPagador.nomeCompleto
      : autorizacao.cooperadoTitular.nomeCompleto;
    void this.notificarRevogacao(outro, quemRevogou, motivoLimpo, autorizacao.id, cooperativaId).catch(
      (err) => this.logger.warn(`[m49] notif revogar falhou: ${(err as Error).message}`),
    );

    this.logger.log(
      `[m49] autorizacao ${autorizacao.id} REVOGADA por ${cooperadoRevogadorId} (${ehPagador ? 'pagador' : 'titular'}) motivo="${motivoLimpo ?? '—'}"`,
    );
    return atualizada;
  }

  /**
   * Sprint Família M49 — Fatia E (G4 sizing display-only).
   * Wrapper que mantém o controller livre de PrismaService direto
   * (P2-code reviewer 22/06).
   */
  async sizing(params: {
    cooperativaId: string;
    cotaKwhMensal: number;
    distribuidora?: string | null;
  }): Promise<SizingResultado> {
    return estimarTokensPorConsumo(this.prisma, params);
  }

  // ─── Notificações WA (best-effort, padrão M46) ───────────────────────

  private async notificarTitularSolicitacao(
    titular: { nomeCompleto: string; telefone: string | null },
    pagador: { nomeCompleto: string },
    autorizacaoId: string,
    cooperativaId: string,
  ): Promise<void> {
    if (!titular.telefone) {
      this.logger.warn(
        `[m49] sem telefone — notif TITULAR solicitação pulada (D-novo-NOTIF-EMAIL-FALLBACK)`,
      );
      return;
    }
    const texto =
      `🤝 Autorização familiar solicitada\n\n` +
      `Olá, ${titular.nomeCompleto}!\n\n` +
      `${pagador.nomeCompleto} pediu autorização pra usar os CooperTokens dele(a) ` +
      `pra abater a SUA fatura de energia.\n\n` +
      `Pra aceitar, entre no app e confirme a autorização. ` +
      `Você pode revogar a qualquer momento depois.\n\n` +
      `ID da autorização: ${autorizacaoId.slice(0, 8)}…`;

    try {
      await this.waSender.enviarMensagem(titular.telefone, texto, {
        tipoDisparo: 'AUTORIZACAO_FAMILIAR_SOLICITADA',
        disparoId: `${autorizacaoId}:solicitar`,
        cooperativaId,
      });
    } catch (err) {
      this.logger.warn(`[m49] notif TITULAR solicitacao falhou autorizacaoId=${autorizacaoId}: ${(err as Error).message}`);
    }
  }

  private async notificarPagadorConfirmado(
    pagador: { nomeCompleto: string; telefone: string | null },
    titular: { nomeCompleto: string } | null,
    autorizacaoId: string,
    cooperativaId: string,
  ): Promise<void> {
    if (!pagador.telefone) {
      this.logger.warn(`[m49] sem telefone — notif PAGADOR confirmação pulada`);
      return;
    }
    const texto =
      `✅ Autorização familiar ativa\n\n` +
      `Olá, ${pagador.nomeCompleto}!\n\n` +
      `${titular?.nomeCompleto ?? 'O titular'} aceitou sua autorização. ` +
      `Agora você pode usar seus CooperTokens pra abater a fatura dele(a).\n\n` +
      `Acesse o app pra ver a fatura disponível.`;

    try {
      await this.waSender.enviarMensagem(pagador.telefone, texto, {
        tipoDisparo: 'AUTORIZACAO_FAMILIAR_CONFIRMADA',
        disparoId: `${autorizacaoId}:confirmar`,
        cooperativaId,
      });
    } catch (err) {
      this.logger.warn(`[m49] notif PAGADOR confirmação falhou autorizacaoId=${autorizacaoId}: ${(err as Error).message}`);
    }
  }

  private async notificarRevogacao(
    outroLado: { nomeCompleto: string; telefone: string | null },
    quemRevogou: string,
    motivo: string | null,
    autorizacaoId: string,
    cooperativaId: string,
  ): Promise<void> {
    if (!outroLado.telefone) {
      this.logger.warn(`[m49] sem telefone — notif REVOGACAO pulada`);
      return;
    }
    const texto =
      `ℹ️ Autorização familiar revogada\n\n` +
      `Olá, ${outroLado.nomeCompleto}!\n\n` +
      `${quemRevogou} revogou a autorização familiar entre vocês.\n\n` +
      (motivo ? `Motivo: ${motivo}\n\n` : ``) +
      `Tokens já utilizados em faturas continuam aplicados (não voltam). ` +
      `Se quiser uma nova autorização no futuro, refaça o pedido pelo app.`;

    try {
      await this.waSender.enviarMensagem(outroLado.telefone, texto, {
        tipoDisparo: 'AUTORIZACAO_FAMILIAR_REVOGADA',
        disparoId: `${autorizacaoId}:revogar`,
        cooperativaId,
      });
    } catch (err) {
      this.logger.warn(`[m49] notif REVOGAÇÃO falhou autorizacaoId=${autorizacaoId}: ${(err as Error).message}`);
    }
  }
}
