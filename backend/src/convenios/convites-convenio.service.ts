import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import * as crypto from 'node:crypto';
import { PrismaService } from '../prisma.service';
import { WhatsappSenderService } from '../whatsapp/whatsapp-sender.service';
// Sprint Convite-Lote LOTE.5 (07/06/2026) — helper reusável de wa.me.
// FIX texto convite (06/07/2026) — montarMensagemConvite passa a ser fonte
// única do texto no caminho automático (enviarLinkPorWhatsapp), eliminando
// a string duplicada que estava desincronizada com o texto do wa.me.
import {
  buildWaMeConviteUrl,
  montarMensagemConvite,
  type WaMeConviteParams,
} from './lib/wa-me-builder';
// Sprint Token-WA Fase 2 F2.2 (07/06/2026) — OTP helpers extraídos pra reuso
// (AparelhoVinculadoService, TokenTransacaoService, etc).
import {
  gerarCodigoOtp,
  gerarSaltOtp,
  hashOtp,
  compararOtp,
} from '../common/security/otp-helper';

/**
 * Sprint Convite-Convênio Fatia 2a (03/06/2026).
 *
 * Service de gestão de ConviteConvenioMembro (link per-recipient phone-bound).
 * Espelho conceitual do ConviteProprietarioService (M31, 2026-05-26).
 *
 * Convite TTL: 7 dias (alinhado ConviteProprietario).
 * Token: crypto.randomBytes(32).toString('hex') (64 chars hex).
 * Reuse-if-alive: se já existe convite (não-usado, não-expirado) pra mesma
 * (convenioId, telefone), REUSA — atualiza createdBy + retorna mesmo token.
 *
 * OTP (campos otpCodigoHash/otpSalt/otpExpiresAt/otpTentativas/...) fica
 * dormente no MVP da 2a — preenchido na Fatia 2b.
 *
 * NÃO valida pagador=EMPRESA aqui (controller faz via @TenantResource e o
 * caller admin verifica). Foco do service: ciclo de vida do convite.
 */
@Injectable()
export class ConvitesConvenioService {
  private readonly logger = new Logger(ConvitesConvenioService.name);
  private static readonly CONVITE_TTL_DIAS = 7;

  // Fatia 2b (03/06/2026) — Política OTP
  static readonly OTP_TTL_MIN = 10;             // 10 minutos
  static readonly OTP_MAX_TENTATIVAS = 5;       // 5 erros → bloqueio
  static readonly OTP_MAX_REENVIOS = 3;         // 3 reenvios por convite
  static readonly OTP_COOLDOWN_SEG = 60;        // 60s entre reenvios
  static readonly OTP_BLOQUEIO_HORAS = 1;       // bloqueio 1h após exaustão

  constructor(
    private readonly prisma: PrismaService,
    private readonly waSender: WhatsappSenderService,
  ) {}

  /**
   * Normaliza telefone pro formato E.164 BR usado pelo whatsapp-service:
   * `55DDXXXXXXXXX` (13 dígitos, sem `+`/máscara, com dígito 9 da operadora).
   * Padrão derivado de `publico.controller.ts:78-86` (iniciarCadastro).
   *
   * Aceita entradas comuns: "(27) 99876-5432" / "27998765432" / "5527998765432"
   * Rejeita: vazio, < 10 dígitos (sem DDD), > 13 dígitos.
   */
  static normalizarTelefoneBR(input: string): string {
    if (!input) {
      throw new BadRequestException('Telefone obrigatório.');
    }
    let t = input.replace(/\D/g, '');
    if (!t.startsWith('55')) {
      t = '55' + t;
    }
    const semPais = t.slice(2);
    if (semPais.length === 10) {
      // 10 dígitos pós-país (DDD + 8 dígitos) → adiciona dígito 9 da operadora
      t = '55' + semPais.slice(0, 2) + '9' + semPais.slice(2);
    }
    // Após normalização, esperamos 55 + DDD(2) + 9 + numero(8) = 13
    if (t.length !== 13) {
      throw new BadRequestException(
        `Telefone inválido (${input}). Use DDD + número com dígito 9 da operadora.`,
      );
    }
    return t;
  }

  // ─── Sprint Convite-Lote (07/06/2026) — preview do lote ──────────────

  /**
   * Status de cada linha do preview.
   *  - PRONTO: passa nas validações e dedups; pode entrar no envio.
   *  - DUPLICATA_CSV: mesmo telefone aparece mais de uma vez no CSV; só a 1ª
   *    fica PRONTO, as demais ficam DUPLICATA_CSV.
   *  - JA_MEMBRO: telefone bate com cooperado que já é membro ATIVO no convênio
   *    (não precisa convidar de novo).
   *  - JA_CONVIDADO: já existe ConviteConvenioMembro vivo (não-usado, não-
   *    expirado) pra mesmo (convenioId, telefone). Empresa pode reenviar pelo
   *    endpoint existente em vez de criar outro.
   *  - INVALIDO: nome muito curto ou telefone fora do padrão BR.
   */
  static readonly PREVIEW_STATUS = [
    'PRONTO',
    'DUPLICATA_CSV',
    'JA_MEMBRO',
    'JA_CONVIDADO',
    'INVALIDO',
  ] as const;

  /**
   * Faz preview READ-ONLY de uma planilha de destinatários (CSV/TXT colado).
   *
   * NÃO cria convite, NÃO envia WA. Só parseia, valida e classifica linha-a-
   * linha pra o frontend mostrar a tabela de prévia antes do envio em lote.
   * O envio em si vem na fatia LOTE.2.
   *
   * Anti-IDOR: caller passa `cooperativaId` resolvido server-side (do guard
   * `@PagadorCooperadoOnly` no portal-empresa, ou do `req.user.cooperativaId`
   * no admin). Service valida que o convênio pertence ao tenant; cross-tenant
   * retorna 404 (anti-enumeração).
   */
  async previewLote(input: {
    convenioId: string;
    cooperativaId: string;
    csv: string;
  }): Promise<{
    resumo: {
      total: number;
      pronto: number;
      duplicataCsv: number;
      jaMembro: number;
      jaConvidado: number;
      invalido: number;
    };
    linhas: Array<{
      linha: number;
      nome: string;
      telefone: string;
      telefoneFmt: string | null;
      status: (typeof ConvitesConvenioService.PREVIEW_STATUS)[number];
      motivo?: string;
    }>;
  }> {
    const { convenioId, cooperativaId } = input;
    if (!convenioId) throw new BadRequestException('convenioId obrigatório.');
    if (!cooperativaId) {
      throw new BadRequestException('cooperativaId obrigatório.');
    }
    if (!input.csv || typeof input.csv !== 'string') {
      throw new BadRequestException('csv obrigatório (string com linhas).');
    }

    // Anti-IDOR: confirma posse do convênio no tenant + pagador=EMPRESA + ATIVO.
    const convenio = await this.prisma.contratoConvenio.findFirst({
      where: { id: convenioId, cooperativaId },
      select: { id: true, status: true, pagador: true, empresaNome: true },
    });
    if (!convenio) {
      throw new NotFoundException('Convênio não encontrado neste tenant.');
    }
    if (convenio.status !== 'ATIVO') {
      throw new BadRequestException(
        `Convênio "${convenio.empresaNome}" não está ATIVO.`,
      );
    }
    if (convenio.pagador !== 'EMPRESA') {
      throw new BadRequestException(
        `Convênio "${convenio.empresaNome}" tem pagador=${convenio.pagador}; ` +
          `convites de custeio exigem pagador=EMPRESA.`,
      );
    }

    // Parse + normalização inicial. Sem dedups ainda.
    const linhasRaw = input.csv
      .split(/\r?\n/)
      .map((l, idx) => ({ raw: l, idx: idx + 1 }))
      .filter((l) => l.raw.trim().length > 0);

    type Bruto = {
      linha: number;
      nome: string;
      telefoneOriginal: string;
      telefoneNorm: string | null;
      erroParse?: string;
    };
    const brutos: Bruto[] = linhasRaw.map((l) => {
      // Detecta separador (vírgula, ponto e vírgula, tab). Pega o primeiro
      // que aparece na string — se nenhum, considera nome inteiro sem telefone.
      const sep = [',', ';', '\t'].find((s) => l.raw.includes(s)) ?? null;
      let nome = l.raw.trim();
      let telefoneOriginal = '';
      if (sep) {
        const partes = l.raw.split(sep);
        nome = (partes[0] ?? '').trim();
        telefoneOriginal = (partes.slice(1).join(sep) ?? '').trim();
      }
      // Cabeçalho comum (`nome,telefone`) — ignora se a 1ª linha bate.
      const ehCabecalho =
        l.idx === 1 &&
        /^nome$/i.test(nome) &&
        /^(telefone|celular|whats?app)$/i.test(telefoneOriginal);
      if (ehCabecalho) {
        return {
          linha: l.idx,
          nome: '',
          telefoneOriginal: '',
          telefoneNorm: null,
          erroParse: 'CABECALHO',
        };
      }
      let telefoneNorm: string | null = null;
      let erroParse: string | undefined;
      if (!telefoneOriginal) {
        erroParse = 'Telefone ausente — formato esperado "Nome, Telefone".';
      } else {
        try {
          telefoneNorm =
            ConvitesConvenioService.normalizarTelefoneBR(telefoneOriginal);
        } catch (err) {
          erroParse = err instanceof Error ? err.message : 'Telefone inválido.';
        }
      }
      return { linha: l.idx, nome, telefoneOriginal, telefoneNorm, erroParse };
    });

    // Remove cabeçalho do conjunto retornado (não conta no resumo).
    const semCabecalho = brutos.filter((b) => b.erroParse !== 'CABECALHO');

    // Carrega snapshots de DB pra dedup externo (uma query por tipo).
    const telefonesValidos = semCabecalho
      .filter((b) => b.telefoneNorm !== null)
      .map((b) => b.telefoneNorm!);

    const [membrosAtivos, convitesVivos] = await Promise.all([
      telefonesValidos.length > 0
        ? this.prisma.convenioCooperado.findMany({
            where: {
              convenioId,
              ativo: true,
              cooperado: { telefone: { in: telefonesValidos } },
            },
            select: { cooperado: { select: { telefone: true } } },
          })
        : Promise.resolve([]),
      telefonesValidos.length > 0
        ? this.prisma.conviteConvenioMembro.findMany({
            where: {
              convenioId,
              telefone: { in: telefonesValidos },
              usedAt: null,
              expiresAt: { gt: new Date() },
            },
            select: { telefone: true },
          })
        : Promise.resolve([]),
    ]);
    const telefonesJaMembro = new Set(
      membrosAtivos
        .map((m) => m.cooperado?.telefone)
        .filter((t): t is string => Boolean(t)),
    );
    const telefonesJaConvidado = new Set(convitesVivos.map((c) => c.telefone));

    // Classificação final + dedup interno (1ª aparição PRONTO; resto DUPLICATA_CSV).
    const telefonesVistosNoCsv = new Set<string>();
    const linhas = semCabecalho.map((b) => {
      const base = {
        linha: b.linha,
        nome: b.nome,
        telefone: b.telefoneOriginal,
        telefoneFmt: b.telefoneNorm,
      };
      // Validação básica
      if (!b.nome || b.nome.length < 2) {
        return {
          ...base,
          status: 'INVALIDO' as const,
          motivo: 'Nome obrigatório (mínimo 2 caracteres).',
        };
      }
      if (b.erroParse || !b.telefoneNorm) {
        return {
          ...base,
          status: 'INVALIDO' as const,
          motivo: b.erroParse ?? 'Telefone inválido.',
        };
      }
      // Dedup interno: telefone repetido no próprio CSV
      if (telefonesVistosNoCsv.has(b.telefoneNorm)) {
        return {
          ...base,
          status: 'DUPLICATA_CSV' as const,
          motivo: 'Telefone aparece mais de uma vez no arquivo.',
        };
      }
      telefonesVistosNoCsv.add(b.telefoneNorm);
      // Dedup externo: já é membro ATIVO?
      if (telefonesJaMembro.has(b.telefoneNorm)) {
        return {
          ...base,
          status: 'JA_MEMBRO' as const,
          motivo: 'Telefone já vinculado a um funcionário ativo neste convênio.',
        };
      }
      // Dedup externo: já tem convite vivo?
      if (telefonesJaConvidado.has(b.telefoneNorm)) {
        return {
          ...base,
          status: 'JA_CONVIDADO' as const,
          motivo:
            'Já existe um convite ativo pra este telefone — use "reenviar" se quiser.',
        };
      }
      return { ...base, status: 'PRONTO' as const };
    });

    const resumo = {
      total: linhas.length,
      pronto: linhas.filter((l) => l.status === 'PRONTO').length,
      duplicataCsv: linhas.filter((l) => l.status === 'DUPLICATA_CSV').length,
      jaMembro: linhas.filter((l) => l.status === 'JA_MEMBRO').length,
      jaConvidado: linhas.filter((l) => l.status === 'JA_CONVIDADO').length,
      invalido: linhas.filter((l) => l.status === 'INVALIDO').length,
    };

    this.logger.log(
      `[convite-lote] Preview convênio="${convenio.empresaNome}" total=${resumo.total} ` +
        `pronto=${resumo.pronto} jaMembro=${resumo.jaMembro} jaConvidado=${resumo.jaConvidado} ` +
        `duplicataCsv=${resumo.duplicataCsv} invalido=${resumo.invalido}`,
    );

    return { resumo, linhas };
  }

  // ─── Sprint Convite-Lote LOTE.5 (07/06/2026) — modo B "Abrir no WhatsApp" ──

  /**
   * Cria convite individual e devolve URL `wa.me` pra o cliente abrir o
   * WhatsApp pessoal do remetente. NÃO dispara WA via API Meta (modo
   * automático fica intacto via `criarConvite` + `enviarLinkPorWhatsapp`).
   *
   * Reusa o helper puro `buildWaMeConviteUrl` — mesmo gerador será usado
   * pelo convite individual de indicação (MLM futuro, portal do membro).
   *
   * Atribuição: `cooperadoIndicadorId` opcional carimba quem indicou
   * (member-to-member). Empresa/admin convidando = null.
   */
  async criarConviteComUrlWa(input: {
    convenioId: string;
    nomeConvidado: string;
    telefone: string;
    criadoPorUserId: string;
    cooperativaId: string;
    cooperadoIndicadorId?: string | null;
    /** Variante da mensagem — default CONVENIO_EMPRESA. */
    variante?: WaMeConviteParams['variante'];
    /** Para INDICACAO_COOPERADO: nome do indicador (vem do JWT no caller). */
    nomeIndicador?: string;
  }): Promise<{
    id: string;
    tokenSufixo: string;
    link: string;
    telefone: string;
    nomeConvidado: string;
    urlWa: string;
    mensagem: string;
    reused: boolean;
    expiresAt: Date;
  }> {
    const convite = await this.criarConvite({
      convenioId: input.convenioId,
      nomeConvidado: input.nomeConvidado,
      telefone: input.telefone,
      criadoPorUserId: input.criadoPorUserId,
      cooperativaId: input.cooperativaId,
      cooperadoIndicadorId: input.cooperadoIndicadorId,
    });
    const wa = buildWaMeConviteUrl({
      telefoneDestinatario: convite.telefone,
      nomeDestinatario: convite.nomeConvidado,
      empresaNome: convite.empresaNome,
      linkConvite: convite.link,
      variante: input.variante,
      nomeIndicador: input.nomeIndicador,
    });
    this.logger.log(
      `[convite-modo-b] Convite individual com wa.me: convenioId=${input.convenioId} ` +
        `tokenSufixo=...${convite.token.slice(-6)} ` +
        `indicador=${input.cooperadoIndicadorId ?? 'admin/empresa'}`,
    );
    return {
      id: convite.id,
      tokenSufixo: '...' + convite.token.slice(-6),
      link: convite.link,
      telefone: convite.telefone,
      nomeConvidado: convite.nomeConvidado,
      urlWa: wa.urlWa,
      mensagem: wa.mensagem,
      reused: convite.reused,
      expiresAt: convite.expiresAt,
    };
  }

  // ─── Sprint Convite-Lote LOTE.2 (07/06/2026) — envio em fila ─────────

  /** Throttle entre envios WA — anti-spam Meta. 2s = ~30 envios/min. */
  static readonly LOTE_THROTTLE_MS = 2000;

  /**
   * Envia convites em lote pra uma lista pré-validada de destinatários.
   *
   * Síncrono no DB (cria todos os ConviteConvenioMembro com `loteEnvioWaStatus=
   * PENDENTE` antes de retornar), assíncrono no WA (envios disparam em fila com
   * throttle de 2s entre cada — protege contra rate-limit do WhatsApp Business).
   * Caller (controller) recebe `loteId` IMEDIATO + total. UI polla
   * `GET /lote/:loteId/status` (LOTE.3) pra acompanhar.
   *
   * Reusa `criarConvite` por destinatário — herda reuse-if-alive (idempotência)
   * + validações de tenant/pagador/ativo. Cada item rodado isolado: falha num
   * NÃO derruba os outros (logger.warn + statusEnvio='FALHOU').
   *
   * Anti-IDOR: caller passa `cooperativaId` resolvido server-side. Service
   * confia no caller (mesmo padrão de `previewLote`); `criarConvite` revalida
   * tenant em cada item.
   *
   * Destinatários inválidos (nome curto / telefone errado) já foram filtrados
   * pelo preview (LOTE.1) — service confia que `destinatarios` veio só com
   * status=PRONTO da prévia.
   */
  async enviarLote(input: {
    convenioId: string;
    cooperativaId: string;
    criadoPorUserId: string;
    destinatarios: Array<{ nome: string; telefone: string }>;
  }): Promise<{ loteId: string; total: number }> {
    const { convenioId, cooperativaId, criadoPorUserId } = input;
    if (!convenioId) throw new BadRequestException('convenioId obrigatório.');
    if (!cooperativaId) {
      throw new BadRequestException('cooperativaId obrigatório.');
    }
    if (!criadoPorUserId) {
      throw new BadRequestException('criadoPorUserId obrigatório.');
    }
    if (
      !Array.isArray(input.destinatarios) ||
      input.destinatarios.length === 0
    ) {
      throw new BadRequestException(
        'destinatarios obrigatório (array não-vazio).',
      );
    }

    // Anti-IDOR + posse do convênio (defesa em profundidade — `criarConvite`
    // também valida, mas falhar cedo evita criar convites parciais).
    const convenio = await this.prisma.contratoConvenio.findFirst({
      where: { id: convenioId, cooperativaId },
      select: { id: true, status: true, pagador: true, empresaNome: true },
    });
    if (!convenio) {
      throw new NotFoundException('Convênio não encontrado neste tenant.');
    }
    if (convenio.status !== 'ATIVO') {
      throw new BadRequestException(
        `Convênio "${convenio.empresaNome}" não está ATIVO.`,
      );
    }
    if (convenio.pagador !== 'EMPRESA') {
      throw new BadRequestException(
        `Convênio "${convenio.empresaNome}" tem pagador=${convenio.pagador}.`,
      );
    }

    // loteId opaco — caller usa pro poll de status.
    const loteId = crypto.randomBytes(12).toString('hex');

    // Cria os convites em sequência (não em tx — cada criarConvite tem reuse-
    // if-alive que pode ler/criar diferente por linha; tx longa segura WA).
    // Após criar, marca loteId+statusEnvio=PENDENTE.
    type ItemLote = {
      conviteId: string;
      nomeConvidado: string;
      telefone: string;
      link: string;
      reused: boolean;
    };
    const itens: ItemLote[] = [];
    for (const dest of input.destinatarios) {
      try {
        const convite = await this.criarConvite({
          convenioId,
          nomeConvidado: dest.nome,
          telefone: dest.telefone,
          criadoPorUserId,
          cooperativaId,
        });
        await this.prisma.conviteConvenioMembro.update({
          where: { id: convite.id },
          data: { loteId, loteEnvioWaStatus: 'PENDENTE' },
        });
        itens.push({
          conviteId: convite.id,
          nomeConvidado: convite.nomeConvidado,
          telefone: convite.telefone,
          link: convite.link,
          reused: convite.reused,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'erro';
        this.logger.warn(
          `[convite-lote] criarConvite falhou pra ${dest.nome.slice(0, 20)} ` +
            `(${dest.telefone}): ${msg}`,
        );
        // Não bloqueia o lote — pula este destinatário.
      }
    }

    if (itens.length === 0) {
      throw new BadRequestException(
        'Nenhum convite pôde ser criado neste lote.',
      );
    }

    this.logger.log(
      `[convite-lote] Lote criado: loteId=${loteId} convênio="${convenio.empresaNome}" ` +
        `total=${itens.length} (de ${input.destinatarios.length} solicitados)`,
    );

    // Dispara fila de envio WA em background (não bloqueia a resposta HTTP).
    // setImmediate desacopla do request lifecycle. NUNCA propaga erros — cada
    // item é registrado individualmente.
    setImmediate(() => {
      void this.processarFilaWa(itens, convenio.empresaNome, cooperativaId);
    });

    return { loteId, total: itens.length };
  }

  /**
   * Processa fila de envio WA com throttle in-process. Roda em background
   * (chamado via setImmediate por enviarLote). Cada item atualiza
   * `loteEnvioWaStatus` + `loteEnvioWaEm` + `loteEnvioWaErro` no banco.
   *
   * Throttle de 2s entre envios garante ~30 mensagens/min — suficiente pro
   * volume típico de uma clínica (10-50 funcionários) e seguro contra rate-
   * limit do WhatsApp Business.
   */
  private async processarFilaWa(
    itens: Array<{
      conviteId: string;
      nomeConvidado: string;
      telefone: string;
      link: string;
    }>,
    empresaNome: string,
    cooperativaId: string,
  ): Promise<void> {
    for (let i = 0; i < itens.length; i++) {
      const item = itens[i]!;
      const envio = await this.enviarLinkPorWhatsapp({
        telefone: item.telefone,
        link: item.link,
        nomeConvidado: item.nomeConvidado,
        empresaNome,
        cooperativaId,
      });
      await this.prisma.conviteConvenioMembro
        .update({
          where: { id: item.conviteId },
          data: {
            loteEnvioWaStatus: envio.enviado ? 'ENVIADO' : 'FALHOU',
            loteEnvioWaEm: new Date(),
            loteEnvioWaErro: envio.enviado ? null : (envio.erro ?? 'falha WA'),
          },
        })
        .catch((err) =>
          this.logger.warn(
            `[convite-lote] Falha update statusEnvio conviteId=${item.conviteId}: ${err instanceof Error ? err.message : 'erro'}`,
          ),
        );
      // Throttle entre envios (último não precisa esperar).
      if (i < itens.length - 1) {
        await new Promise((resolve) =>
          setTimeout(resolve, ConvitesConvenioService.LOTE_THROTTLE_MS),
        );
      }
    }
    this.logger.log(
      `[convite-lote] Fila WA processada: ${itens.length} envios (throttle ${ConvitesConvenioService.LOTE_THROTTLE_MS}ms)`,
    );
  }

  /**
   * Sprint Convite-Lote LOTE.3 (07/06/2026) — status do lote.
   *
   * Retorna lista de envios + agregados pra UI mostrar progresso ("X de N
   * enviados / Y falhas / Z pendentes"). Anti-IDOR via cooperativaId no filtro.
   */
  async statusLote(input: {
    loteId: string;
    convenioId: string;
    cooperativaId: string;
  }): Promise<{
    loteId: string;
    convenioId: string;
    resumo: { total: number; pendente: number; enviado: number; falhou: number };
    itens: Array<{
      conviteId: string;
      nomeConvidado: string;
      telefoneSufixo: string; // LGPD — só últimos 4 dígitos
      statusEnvio: 'PENDENTE' | 'ENVIADO' | 'FALHOU';
      enviadoEm: Date | null;
      erro: string | null;
    }>;
  }> {
    const { loteId, convenioId, cooperativaId } = input;
    if (!loteId) throw new BadRequestException('loteId obrigatório.');

    const convites = await this.prisma.conviteConvenioMembro.findMany({
      where: {
        loteId,
        convenioId,
        cooperativaId,
      },
      select: {
        id: true,
        nomeConvidado: true,
        telefone: true,
        loteEnvioWaStatus: true,
        loteEnvioWaEm: true,
        loteEnvioWaErro: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    if (convites.length === 0) {
      throw new NotFoundException('Lote não encontrado neste convênio.');
    }

    const itens = convites.map((c) => ({
      conviteId: c.id,
      nomeConvidado: c.nomeConvidado,
      telefoneSufixo: '...' + c.telefone.slice(-4),
      statusEnvio: (c.loteEnvioWaStatus ?? 'PENDENTE') as
        | 'PENDENTE'
        | 'ENVIADO'
        | 'FALHOU',
      enviadoEm: c.loteEnvioWaEm,
      erro: c.loteEnvioWaErro,
    }));
    const resumo = {
      total: itens.length,
      pendente: itens.filter((i) => i.statusEnvio === 'PENDENTE').length,
      enviado: itens.filter((i) => i.statusEnvio === 'ENVIADO').length,
      falhou: itens.filter((i) => i.statusEnvio === 'FALHOU').length,
    };
    return { loteId, convenioId, resumo, itens };
  }

  /**
   * Cria convite (ou reusa se já existe vivo pra mesmo convenioId+telefone).
   * Multi-tenant: convênio deve pertencer ao cooperativaId do admin.
   */
  async criarConvite(input: {
    convenioId: string;
    nomeConvidado: string;
    telefone: string;
    criadoPorUserId: string;
    cooperativaId: string;
    /** LOTE.5 — opcional: cooperado que indica (member-to-member MLM). */
    cooperadoIndicadorId?: string | null;
  }): Promise<{
    id: string;
    token: string;
    link: string;
    nomeConvidado: string;
    telefone: string;
    expiresAt: Date;
    reused: boolean;
    empresaNome: string;
  }> {
    const { convenioId, criadoPorUserId, cooperativaId } = input;
    const nomeConvidado = input.nomeConvidado?.trim();
    if (!nomeConvidado || nomeConvidado.length < 2) {
      throw new BadRequestException('nomeConvidado obrigatório (min 2 chars).');
    }
    if (!convenioId) throw new BadRequestException('convenioId obrigatório.');
    if (!cooperativaId) throw new BadRequestException('cooperativaId obrigatório.');

    const telefone = ConvitesConvenioService.normalizarTelefoneBR(input.telefone);

    // Multi-tenant: convênio pertence ao tenant + pagador=EMPRESA + status ATIVO
    const convenio = await this.prisma.contratoConvenio.findFirst({
      where: { id: convenioId, cooperativaId },
      select: { id: true, status: true, pagador: true, empresaNome: true },
    });
    if (!convenio) {
      throw new NotFoundException('Convênio não encontrado neste tenant.');
    }
    if (convenio.status !== 'ATIVO') {
      throw new BadRequestException(`Convênio "${convenio.empresaNome}" não está ATIVO.`);
    }
    if (convenio.pagador !== 'EMPRESA') {
      throw new BadRequestException(
        `Convênio "${convenio.empresaNome}" tem pagador=${convenio.pagador}; ` +
          `convites de custeio exigem pagador=EMPRESA (Caso 1).`,
      );
    }

    // Reuse-if-alive: convite existente pra (convenioId, telefone) que ainda
    // está vivo (não usado, não expirado) é REUSADO. Decisão Luciano Fase 1.
    const existente = await this.prisma.conviteConvenioMembro.findUnique({
      where: { convenioId_telefone: { convenioId, telefone } },
    });
    if (existente && !existente.usedAt && existente.expiresAt > new Date()) {
      this.logger.log(
        `[convite-convenio] Convite reusado (já existia vivo): convenioId=${convenioId} ` +
          `telefone=${telefone.slice(0, 4)}***${telefone.slice(-4)} tokenSufixo=...${existente.token.slice(-6)}`,
      );
      return {
        id: existente.id,
        token: existente.token,
        link: this.montarLink(existente.token),
        nomeConvidado: existente.nomeConvidado,
        telefone: existente.telefone,
        expiresAt: existente.expiresAt,
        reused: true,
        empresaNome: convenio.empresaNome,
      };
    }

    const token = this.gerarToken();
    const expiresAt = new Date(
      Date.now() + ConvitesConvenioService.CONVITE_TTL_DIAS * 24 * 60 * 60 * 1000,
    );

    // Se existia mas estava usado/expirado → recriar (delete + create, ou upsert).
    // Decisão: deletar o antigo (audit já cobre histórico) e criar novo limpo.
    let convite;
    if (existente) {
      await this.prisma.conviteConvenioMembro.delete({ where: { id: existente.id } });
    }
    convite = await this.prisma.conviteConvenioMembro.create({
      data: {
        convenioId,
        cooperativaId,
        nomeConvidado,
        telefone,
        token,
        expiresAt,
        createdBy: criadoPorUserId,
        ...(input.cooperadoIndicadorId
          ? { cooperadoIndicadorId: input.cooperadoIndicadorId }
          : {}),
      },
    });

    this.logger.log(
      `[convite-convenio] Convite criado: id=${convite.id} convenioId=${convenioId} ` +
        `telefone=${telefone.slice(0, 4)}***${telefone.slice(-4)} tokenSufixo=...${token.slice(-6)} ` +
        `expira=${expiresAt.toISOString()}`,
    );

    return {
      id: convite.id,
      token: convite.token,
      link: this.montarLink(convite.token),
      nomeConvidado: convite.nomeConvidado,
      telefone: convite.telefone,
      expiresAt: convite.expiresAt,
      reused: false,
      empresaNome: convenio.empresaNome,
    };
  }

  /**
   * Valida token PUBLICAMENTE (sem JWT). Retorna `{ valido, motivo?, dados? }`.
   * Pra uso na página /convite/[token] (GET pre-populate).
   * NÃO retorna o telefone completo — defesa LGPD/anti-enumeration. Só sufixo
   * pra UX ("código vai pra ...XX99").
   */
  async validarToken(token: string): Promise<{
    valido: boolean;
    motivo?: string;
    dados?: {
      empresaNome: string;
      nomeConvidado: string;
      telefoneSufixo: string;
      expiresAt: Date;
      otpJaValidado: boolean;
      // Sprint Onboarding Bloco 1 Fatia 1.1 (06/06/2026) — repasse do convite.
      // convenioId pro frontend setar `convenioCusteioId` (vincula ao convênio
      // CERTO, server-side, anti-spoof). permiteSemUc pro frontend respeitar
      // o slim path (cooperado SEM_UC vs COM_UC).
      convenioId: string;
      permiteSemUc: boolean;
    };
  }> {
    if (!token) return { valido: false, motivo: 'Token ausente.' };

    const convite = await this.prisma.conviteConvenioMembro.findUnique({
      where: { token },
      // Fatia 1.1 — convenioId + permiteSemUc DO CONVITE (anti-spoof: vem do
      // próprio modelo, não do client). Frontend usa pra payload do
      // /cadastro-web; backend cadastroWebV2 também re-valida pelo token.
      select: {
        usedAt: true,
        expiresAt: true,
        nomeConvidado: true,
        telefone: true,
        otpValidadoEm: true,
        convenioId: true,
        permiteSemUc: true,
        convenio: { select: { empresaNome: true } },
      },
    });

    if (!convite) return { valido: false, motivo: 'Convite não encontrado.' };
    if (convite.usedAt) return { valido: false, motivo: 'Convite já utilizado.' };
    if (convite.expiresAt <= new Date()) {
      return { valido: false, motivo: 'Convite expirado.' };
    }

    return {
      valido: true,
      dados: {
        empresaNome: convite.convenio.empresaNome,
        nomeConvidado: convite.nomeConvidado,
        telefoneSufixo: '...' + convite.telefone.slice(-4),
        expiresAt: convite.expiresAt,
        otpJaValidado: !!convite.otpValidadoEm,
        convenioId: convite.convenioId,
        permiteSemUc: convite.permiteSemUc,
      },
    };
  }

  /**
   * Marca convite como usado + vincula ao membro recém-criado.
   * Chamado pela Fatia 2c (/auto-inscrever após criar Cooperado+Membro).
   * Multi-tenant: caller passa cooperativaId pra defesa em profundidade.
   */
  async marcarUsado(input: {
    conviteId: string;
    membroId: string;
    cooperativaId: string;
  }) {
    const { conviteId, membroId, cooperativaId } = input;
    const convite = await this.prisma.conviteConvenioMembro.findUnique({
      where: { id: conviteId },
    });
    if (!convite) throw new NotFoundException('Convite não encontrado.');
    if (convite.cooperativaId !== cooperativaId) {
      throw new ForbiddenException('Convite não pertence ao tenant.');
    }
    if (convite.usedAt) {
      throw new BadRequestException('Convite já utilizado.');
    }
    return this.prisma.conviteConvenioMembro.update({
      where: { id: conviteId },
      data: { usedAt: new Date(), membroId },
    });
  }

  /**
   * Lista convites do convênio (admin + empresa). Tenant-scoped via convênio.
   * NÃO retorna o token integral (apenas sufixo) — defesa LGPD.
   *
   * Sprint Convite-Convênio Fatia 5 (03/06/2026) — status DERIVADO refinado:
   * cruza ConviteConvenioMembro + ConvenioCooperado + AprovacaoConvenioMembro
   * pra dar uma string única coerente com o pipeline 3 portas + contadores
   * agregados pro card de overview. Mesmo endpoint serve admin e empresa
   * (Fatia 9.1) — só muda o caller.
   *
   * Status possíveis (9):
   *  - AGUARDANDO_OTP            (convite vivo, nunca solicitou OTP)
   *  - AGUARDANDO_CADASTRO       (OTP validado, ainda não usou o convite)
   *  - PENDENTE_APROVACAO_EMPRESA (cadastrou, aguarda empresa)
   *  - PENDENTE_APROVACAO_ADMIN  (empresa aprovou, aguarda CoopereBR)
   *  - AGUARDANDO_DOCS           (admin solicitou docs — sub-estado do PENDENTE_ADMIN)
   *  - ATIVO                     (admin aprovou, entra na consolidada)
   *  - REJEITADO_EMPRESA
   *  - REJEITADO_ADMIN
   *  - LINK_EXPIRADO             (convite expirado sem uso)
   */
  async listarPorConvenio(convenioId: string, cooperativaId: string) {
    const convenio = await this.prisma.contratoConvenio.findFirst({
      where: { id: convenioId, cooperativaId },
      select: { id: true },
    });
    if (!convenio) throw new NotFoundException('Convênio não encontrado neste tenant.');

    const convites = await this.prisma.conviteConvenioMembro.findMany({
      where: { convenioId },
      orderBy: { createdAt: 'desc' },
      include: {
        membro: {
          select: {
            id: true,
            status: true,
            ativo: true,
            documentacaoSolicitadaEm: true,
            motivoRejeicao: true,
            cooperado: {
              select: {
                id: true,
                nomeCompleto: true,
                cpf: true,
                email: true,
              },
            },
          },
        },
      },
    });

    const agora = new Date();
    const data = convites.map((c) => {
      const status = derivarStatusConvite(c, agora);
      return {
        id: c.id,
        nomeConvidado: c.nomeConvidado,
        telefone: c.telefone,
        tokenSufixo: '...' + c.token.slice(-6),
        expiresAt: c.expiresAt,
        usedAt: c.usedAt,
        createdAt: c.createdAt,
        createdBy: c.createdBy,
        otpValidadoEm: c.otpValidadoEm,
        membroId: c.membroId,
        status,
        // Dados do membro (quando já cadastrou) — sufixos LGPD
        membro: c.membro
          ? {
              id: c.membro.id,
              status: c.membro.status,
              ativo: c.membro.ativo,
              documentacaoSolicitadaEm: c.membro.documentacaoSolicitadaEm,
              motivoRejeicao: c.membro.motivoRejeicao,
              cooperadoNome: c.membro.cooperado?.nomeCompleto ?? null,
              cooperadoCpfSufixo: c.membro.cooperado?.cpf
                ? '...' + c.membro.cooperado.cpf.slice(-3)
                : null,
            }
          : null,
      };
    });

    // Contadores agregados pro overview
    const contadores = {
      total: data.length,
      aguardando_otp: data.filter((d) => d.status === 'AGUARDANDO_OTP').length,
      aguardando_cadastro: data.filter((d) => d.status === 'AGUARDANDO_CADASTRO').length,
      pendente_empresa: data.filter((d) => d.status === 'PENDENTE_APROVACAO_EMPRESA').length,
      pendente_admin: data.filter((d) => d.status === 'PENDENTE_APROVACAO_ADMIN').length,
      aguardando_docs: data.filter((d) => d.status === 'AGUARDANDO_DOCS').length,
      ativo: data.filter((d) => d.status === 'ATIVO').length,
      rejeitado_empresa: data.filter((d) => d.status === 'REJEITADO_EMPRESA').length,
      rejeitado_admin: data.filter((d) => d.status === 'REJEITADO_ADMIN').length,
      link_expirado: data.filter((d) => d.status === 'LINK_EXPIRADO').length,
    };

    return { data, contadores };
  }

  /**
   * Cancela convite (DELETE real). Só se ainda não foi usado.
   * Multi-tenant: caller passa cooperativaId.
   */
  async cancelar(conviteId: string, cooperativaId: string): Promise<{ cancelado: boolean }> {
    const convite = await this.prisma.conviteConvenioMembro.findUnique({
      where: { id: conviteId },
    });
    if (!convite) throw new NotFoundException('Convite não encontrado.');
    if (convite.cooperativaId !== cooperativaId) {
      throw new ForbiddenException('Convite não pertence ao tenant.');
    }
    if (convite.usedAt) {
      throw new BadRequestException(
        'Convite já utilizado — não pode ser cancelado. O cooperado criado já existe.',
      );
    }
    await this.prisma.conviteConvenioMembro.delete({ where: { id: conviteId } });
    return { cancelado: true };
  }

  /**
   * Reenvia convite (regenera token + estende expiresAt). NÃO reseta OTP
   * (isso é responsabilidade da Fatia 2b via solicitar-otp).
   */
  async reenviarConvite(
    conviteId: string,
    cooperativaId: string,
  ): Promise<{ id: string; token: string; link: string; expiresAt: Date }> {
    const convite = await this.prisma.conviteConvenioMembro.findUnique({
      where: { id: conviteId },
    });
    if (!convite) throw new NotFoundException('Convite não encontrado.');
    if (convite.cooperativaId !== cooperativaId) {
      throw new ForbiddenException('Convite não pertence ao tenant.');
    }
    if (convite.usedAt) {
      throw new BadRequestException(
        'Convite já utilizado — não pode ser reenviado. Crie um novo.',
      );
    }

    const novoToken = this.gerarToken();
    const novoExpiresAt = new Date(
      Date.now() + ConvitesConvenioService.CONVITE_TTL_DIAS * 24 * 60 * 60 * 1000,
    );

    const atualizado = await this.prisma.conviteConvenioMembro.update({
      where: { id: conviteId },
      data: { token: novoToken, expiresAt: novoExpiresAt },
    });

    return {
      id: atualizado.id,
      token: atualizado.token,
      link: this.montarLink(atualizado.token),
      expiresAt: atualizado.expiresAt,
    };
  }

  /**
   * Envia o link do convite por WhatsApp pro telefone DO CONVITE.
   * Best-effort: erro de envio é registrado no log do WA-sender (FALHOU) mas
   * NÃO reverte a criação do convite (admin pode reenviar manualmente).
   */
  async enviarLinkPorWhatsapp(input: {
    telefone: string;
    link: string;
    nomeConvidado: string;
    empresaNome: string;
    cooperativaId: string;
  }): Promise<{ enviado: boolean; erro?: string }> {
    const { telefone, link, nomeConvidado, empresaNome, cooperativaId } = input;
    // FIX texto convite (06/07/2026) — fonte única em wa-me-builder.
    // Uma mudança de texto agora atualiza os 2 caminhos (auto + wa.me manual).
    const texto = montarMensagemConvite({
      telefoneDestinatario: telefone,
      nomeDestinatario: nomeConvidado,
      empresaNome,
      linkConvite: link,
      variante: 'CONVENIO_EMPRESA',
    });
    try {
      // Bug A (10/06/2026) — sender pode retornar { enviado:false, motivo } SEM throw
      // em DEV/whitelist ou número-protegido. Antes (até M28) o helper ignorava o
      // retorno e marcava enviado:true → lote gravava loteEnvioWaStatus='ENVIADO'
      // mentiroso. Agora propaga FALHOU + motivo para individual + lote + reenvio.
      const resultado = await this.waSender.enviarMensagem(telefone, texto, {
        tipoDisparo: 'convite_convenio',
        cooperativaId,
      });
      if (!resultado.enviado) {
        const motivo = resultado.motivo ?? 'falha desconhecida';
        this.logger.warn(
          `[convite-convenio] WA não enviado pra ${telefone.slice(0, 4)}***${telefone.slice(-4)}: ${motivo}`,
        );
        return { enviado: false, erro: motivo };
      }
      return { enviado: true };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'erro desconhecido';
      this.logger.warn(
        `[convite-convenio] Falha enviar WA pra ${telefone.slice(0, 4)}***${telefone.slice(-4)}: ${msg}`,
      );
      return { enviado: false, erro: msg };
    }
  }

  // ─── Sprint Convite-Convênio Fatia 2b (03/06/2026) — OTP ────────────

  /**
   * Statics OTP — DELEGATE pra `common/security/otp-helper.ts` (F2.2 Sprint
   * Token-WA, 07/06/2026). Mantidos como métodos estáticos pra compatibilidade
   * com specs existentes (F1.4 Sprint Convite-Convênio); novos consumidores
   * devem importar diretamente do helper.
   */
  static gerarCodigoOtp(): string {
    return gerarCodigoOtp();
  }

  static gerarSaltOtp(): string {
    return gerarSaltOtp();
  }

  static hashOtp(codigo: string, salt: string): string {
    return hashOtp(codigo, salt);
  }

  static compararOtp(codigo: string, salt: string, hashEsperado: string): boolean {
    return compararOtp(codigo, salt, hashEsperado);
  }

  /**
   * Gera código OTP novo + envia por WhatsApp pro `convite.telefone` (NUNCA
   * pra outro número). Atualiza otpCodigoHash/Salt/ExpiresAt + carimbo
   * envio + incremento reenvios + reset tentativas (novo código = nova chance).
   *
   * Guards (ordem):
   *  1. Convite vivo (existe + não usado + não expirado).
   *  2. otpBloqueadoAte > now → HTTP 429 'bloqueado' (5 erros consumiram cota).
   *  3. otpReenvios >= 3 → HTTP 429 'reenvios_esgotados'.
   *  4. otpUltimoEnvioEm + 60s > now → HTTP 429 'cooldown' (informa segundos restantes).
   *
   * Best-effort no envio WA: se WA falhar, NÃO reverte a gravação do hash
   * (admin pode re-emitir via reenvio); retorna { whatsappEnviado: false, erro }.
   */
  async solicitarOtp(token: string): Promise<{
    ok: boolean;
    expiraEmSegundos: number;
    reenviosRestantes: number;
    whatsappEnviado: boolean;
    whatsappErro?: string;
  }> {
    const convite = await this.prisma.conviteConvenioMembro.findUnique({
      where: { token },
      include: { convenio: { select: { empresaNome: true } } },
    });
    if (!convite) {
      throw new NotFoundException('Convite indisponível.');
    }
    if (convite.usedAt) {
      throw new BadRequestException('Convite já utilizado.');
    }
    if (convite.expiresAt <= new Date()) {
      throw new BadRequestException('Convite expirado.');
    }

    const now = new Date();

    // Guard 1: bloqueio temporário por exaustão de tentativas
    if (convite.otpBloqueadoAte && convite.otpBloqueadoAte > now) {
      const segundos = Math.ceil((convite.otpBloqueadoAte.getTime() - now.getTime()) / 1000);
      throw new HttpException(
        {
          erro: 'bloqueado',
          mensagem: `Muitas tentativas erradas. Tente novamente em ${segundos} segundos.`,
          desbloqueadoEm: convite.otpBloqueadoAte,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // Guard 2: reenvios esgotados
    if (convite.otpReenvios >= ConvitesConvenioService.OTP_MAX_REENVIOS) {
      throw new HttpException(
        {
          erro: 'reenvios_esgotados',
          mensagem:
            `Limite de ${ConvitesConvenioService.OTP_MAX_REENVIOS} reenvios atingido. ` +
            `Solicite um novo convite à empresa.`,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // Guard 3: cooldown entre reenvios
    if (convite.otpUltimoEnvioEm) {
      const proximoLiberadoEm = new Date(
        convite.otpUltimoEnvioEm.getTime() + ConvitesConvenioService.OTP_COOLDOWN_SEG * 1000,
      );
      if (proximoLiberadoEm > now) {
        const aguarde = Math.ceil((proximoLiberadoEm.getTime() - now.getTime()) / 1000);
        throw new HttpException(
          {
            erro: 'cooldown',
            mensagem: `Aguarde ${aguarde} segundos para solicitar um novo código.`,
            liberadoEm: proximoLiberadoEm,
          },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    }

    // Gera código + salt + hash; expira em 10min; zera tentativas (novo código,
    // nova chance — caso atacante esteja brute-forçando o anterior, ele não
    // pode somar tentativas no novo).
    const codigo = ConvitesConvenioService.gerarCodigoOtp();
    const salt = ConvitesConvenioService.gerarSaltOtp();
    const hash = ConvitesConvenioService.hashOtp(codigo, salt);
    const expiresAt = new Date(now.getTime() + ConvitesConvenioService.OTP_TTL_MIN * 60 * 1000);

    const atualizado = await this.prisma.conviteConvenioMembro.update({
      where: { id: convite.id },
      data: {
        otpCodigoHash: hash,
        otpSalt: salt,
        otpExpiresAt: expiresAt,
        otpUltimoEnvioEm: now,
        otpReenvios: { increment: 1 },
        otpTentativas: 0,
      },
      select: { otpReenvios: true },
    });

    // Envia WA pro telefone DO CONVITE (NUNCA pra outro número)
    const texto =
      `Olá, ${convite.nomeConvidado}!\n\n` +
      `Seu código de confirmação CoopereBR (convênio *${convite.convenio.empresaNome}*):\n\n` +
      `*${codigo}*\n\n` +
      `Válido por ${ConvitesConvenioService.OTP_TTL_MIN} minutos.\n\n` +
      `Se você não solicitou, ignore esta mensagem.`;

    let whatsappEnviado = true;
    let whatsappErro: string | undefined;
    try {
      await this.waSender.enviarMensagem(convite.telefone, texto, {
        tipoDisparo: 'convite_convenio_otp',
        cooperativaId: convite.cooperativaId,
      });
    } catch (err) {
      whatsappEnviado = false;
      whatsappErro = err instanceof Error ? err.message : 'erro desconhecido';
      this.logger.warn(
        `[convite-otp] Falha WA telefone=${convite.telefone.slice(0, 4)}***${convite.telefone.slice(-4)}: ${whatsappErro}`,
      );
    }

    this.logger.log(
      `[convite-otp] Código emitido: conviteId=${convite.id} ` +
        `telefone=${convite.telefone.slice(0, 4)}***${convite.telefone.slice(-4)} ` +
        `reenvio=${atualizado.otpReenvios}/${ConvitesConvenioService.OTP_MAX_REENVIOS} ` +
        `expira=${expiresAt.toISOString()} wa=${whatsappEnviado}`,
    );

    return {
      ok: true,
      expiraEmSegundos: ConvitesConvenioService.OTP_TTL_MIN * 60,
      reenviosRestantes: ConvitesConvenioService.OTP_MAX_REENVIOS - atualizado.otpReenvios,
      whatsappEnviado,
      whatsappErro,
    };
  }

  /**
   * Valida código OTP digitado pelo destinatário. Mantém comparação
   * constant-time (timingSafeEqual). Em erro, incrementa tentativas; ao
   * atingir limite, marca otpBloqueadoAte=+1h.
   *
   * Casos de retorno:
   *  - OK: { ok: true } + marca otpValidadoEm=now (consumível 1× pela Fatia 2c)
   *  - código vazio/curto: 400 erro 'codigo_invalido' (sem contar como tentativa)
   *  - sem OTP solicitado ainda: 400 erro 'sem_codigo_pendente'
   *  - expirado: 400 erro 'expirado' + podeReenviar:true
   *  - bloqueado: 429 erro 'bloqueado' + desbloqueadoEm
   *  - errado: 400 erro 'codigo_invalido' + tentativasRestantes (após increment)
   *  - errado E atingiu limite: 429 erro 'bloqueado' + desbloqueadoEm
   */
  async validarOtp(token: string, codigo: string): Promise<{ ok: true }> {
    if (!codigo || typeof codigo !== 'string' || !/^\d{6}$/.test(codigo)) {
      throw new BadRequestException({
        erro: 'codigo_invalido',
        mensagem: 'Código deve conter 6 dígitos.',
      });
    }

    const convite = await this.prisma.conviteConvenioMembro.findUnique({
      where: { token },
    });
    if (!convite) throw new NotFoundException('Convite indisponível.');
    if (convite.usedAt) throw new BadRequestException('Convite já utilizado.');
    if (convite.expiresAt <= new Date()) {
      throw new BadRequestException('Convite expirado.');
    }

    const now = new Date();

    // Bloqueio temporário ativo
    if (convite.otpBloqueadoAte && convite.otpBloqueadoAte > now) {
      const segundos = Math.ceil((convite.otpBloqueadoAte.getTime() - now.getTime()) / 1000);
      throw new HttpException(
        {
          erro: 'bloqueado',
          mensagem: `Muitas tentativas erradas. Tente novamente em ${segundos} segundos.`,
          desbloqueadoEm: convite.otpBloqueadoAte,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // Não há código pendente (nunca solicitado)
    if (!convite.otpCodigoHash || !convite.otpSalt || !convite.otpExpiresAt) {
      throw new BadRequestException({
        erro: 'sem_codigo_pendente',
        mensagem: 'Solicite o código primeiro.',
      });
    }

    // Código expirou (TTL 10min)
    if (convite.otpExpiresAt <= now) {
      throw new BadRequestException({
        erro: 'expirado',
        mensagem: 'Código expirado. Solicite um novo.',
        podeReenviar:
          convite.otpReenvios < ConvitesConvenioService.OTP_MAX_REENVIOS,
      });
    }

    // Comparação constant-time
    const ok = ConvitesConvenioService.compararOtp(
      codigo,
      convite.otpSalt,
      convite.otpCodigoHash,
    );

    if (ok) {
      // Valida — marca otpValidadoEm (Fatia 2c consome em /auto-inscrever)
      await this.prisma.conviteConvenioMembro.update({
        where: { id: convite.id },
        data: { otpValidadoEm: now },
      });
      this.logger.log(
        `[convite-otp] Código VALIDADO: conviteId=${convite.id} ` +
          `tentativas=${convite.otpTentativas}/${ConvitesConvenioService.OTP_MAX_TENTATIVAS}`,
      );
      return { ok: true };
    }

    // Errado — incrementa tentativas; se atingir limite, bloqueia
    const novasTentativas = convite.otpTentativas + 1;
    const atingiuLimite = novasTentativas >= ConvitesConvenioService.OTP_MAX_TENTATIVAS;
    const otpBloqueadoAte = atingiuLimite
      ? new Date(now.getTime() + ConvitesConvenioService.OTP_BLOQUEIO_HORAS * 60 * 60 * 1000)
      : convite.otpBloqueadoAte;

    await this.prisma.conviteConvenioMembro.update({
      where: { id: convite.id },
      data: {
        otpTentativas: novasTentativas,
        otpBloqueadoAte,
      },
    });

    this.logger.warn(
      `[convite-otp] Código ERRADO: conviteId=${convite.id} ` +
        `tentativas=${novasTentativas}/${ConvitesConvenioService.OTP_MAX_TENTATIVAS}` +
        (atingiuLimite ? ' → BLOQUEADO por 1h' : ''),
    );

    if (atingiuLimite) {
      throw new HttpException(
        {
          erro: 'bloqueado',
          mensagem: 'Muitas tentativas erradas. Tente novamente em 1 hora.',
          desbloqueadoEm: otpBloqueadoAte,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    throw new BadRequestException({
      erro: 'codigo_invalido',
      mensagem: 'Código incorreto.',
      tentativasRestantes:
        ConvitesConvenioService.OTP_MAX_TENTATIVAS - novasTentativas,
    });
  }

  // ─── Helpers privados ────────────────────────────────────────────────

  private gerarToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  private montarLink(token: string): string {
    const baseUrl =
      process.env.FRONTEND_URL ?? process.env.NEXTAUTH_URL ?? 'http://localhost:3001';
    // Fatia 4 — rota correta é /convite-convenio/{token} (anti-colisão MLM).
    return `${baseUrl}/convite-convenio/${token}`;
  }
}

/**
 * Sprint Convite-Convênio Fatia 5 (03/06/2026) — Status derivado de um convite.
 *
 * Cruza ConviteConvenioMembro + ConvenioCooperado em uma única string coerente
 * com o pipeline de 3 portas. Export nomeado pra reusar nos specs.
 *
 * Tabela de decisão (em ordem de prioridade):
 *  - convite.usedAt=null + expiresAt < now             → LINK_EXPIRADO
 *  - convite.usedAt=null + otpValidadoEm=null          → AGUARDANDO_OTP
 *  - convite.usedAt=null + otpValidadoEm!=null         → AGUARDANDO_CADASTRO
 *  - membro.status=MEMBRO_ATIVO                        → ATIVO
 *  - membro.status=MEMBRO_REJEITADO_EMPRESA            → REJEITADO_EMPRESA
 *  - membro.status=MEMBRO_REJEITADO_ADMIN              → REJEITADO_ADMIN
 *  - membro.status=PENDENTE_APROVACAO_EMPRESA          → PENDENTE_APROVACAO_EMPRESA
 *  - membro.status=PENDENTE_APROVACAO_ADMIN
 *      + documentacaoSolicitadaEm!=null                → AGUARDANDO_DOCS
 *  - membro.status=PENDENTE_APROVACAO_ADMIN            → PENDENTE_APROVACAO_ADMIN
 *  - fallback (nunca deveria atingir)                  → AGUARDANDO_OTP
 */
export type StatusConviteDerivado =
  | 'AGUARDANDO_OTP'
  | 'AGUARDANDO_CADASTRO'
  | 'PENDENTE_APROVACAO_EMPRESA'
  | 'PENDENTE_APROVACAO_ADMIN'
  | 'AGUARDANDO_DOCS'
  | 'ATIVO'
  | 'REJEITADO_EMPRESA'
  | 'REJEITADO_ADMIN'
  | 'LINK_EXPIRADO';

export function derivarStatusConvite(
  convite: {
    usedAt: Date | null;
    expiresAt: Date;
    otpValidadoEm: Date | null;
    membro: {
      status: string;
      documentacaoSolicitadaEm: Date | null;
    } | null;
  },
  agora: Date = new Date(),
): StatusConviteDerivado {
  // Convite ainda não foi usado pra cadastro
  if (!convite.usedAt) {
    if (convite.expiresAt <= agora) return 'LINK_EXPIRADO';
    if (!convite.otpValidadoEm) return 'AGUARDANDO_OTP';
    return 'AGUARDANDO_CADASTRO';
  }
  // Convite usado — status vem do membro
  if (!convite.membro) return 'AGUARDANDO_OTP'; // defensivo: usado mas sem membro = inconsistente
  switch (convite.membro.status) {
    case 'MEMBRO_ATIVO':
      return 'ATIVO';
    case 'MEMBRO_REJEITADO_EMPRESA':
      return 'REJEITADO_EMPRESA';
    case 'MEMBRO_REJEITADO_ADMIN':
      return 'REJEITADO_ADMIN';
    case 'PENDENTE_APROVACAO_EMPRESA':
      return 'PENDENTE_APROVACAO_EMPRESA';
    case 'PENDENTE_APROVACAO_ADMIN':
      return convite.membro.documentacaoSolicitadaEm
        ? 'AGUARDANDO_DOCS'
        : 'PENDENTE_APROVACAO_ADMIN';
    default:
      return 'PENDENTE_APROVACAO_ADMIN';
  }
}
