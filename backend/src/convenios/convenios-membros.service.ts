import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { Prisma, AdmissionOrigem, StatusMembroConvenio } from '@prisma/client';
import * as crypto from 'node:crypto';
import { PrismaService } from '../prisma.service';
import { ConveniosProgressaoService } from './convenios-progressao.service';
// Sprint Convênio FUNDAÇÃO (21/06/2026) — E1: tokens FICAM com funcionário no
// desligamento. removerMembro NÃO toca saldo; só notifica o cooperado pra
// reforçar que os tokens continuam dele (transparência + UX).
import { WhatsappSenderService } from '../whatsapp/whatsapp-sender.service';

// Sprint Convite-Convênio Fatia 2 (03/06/2026) — TTL do magic link de aprovação
// da empresa (alinhado com ConviteProprietarioService M31).
const APROVACAO_TTL_DIAS = 7;

@Injectable()
export class ConveniosMembrosService {
  private readonly logger = new Logger(ConveniosMembrosService.name);

  constructor(
    private prisma: PrismaService,
    private progressaoService: ConveniosProgressaoService,
    private waSender: WhatsappSenderService,
  ) {}

  /**
   * D-FISCAL-2.4.3 (01/06/2026 noite) — `tx` opcional adicionado.
   * Sprint Convite-Convênio Fatia 2 (03/06/2026) — `origem` opcional adicionada.
   *
   * Quando chamado dentro de uma transação serializável (ex: aceite de
   * proposta com convenioCusteioId), passe o `tx` do `$transaction` pra
   * vincular o membro atomicamente junto ao Contrato. Os side effects
   * MLM (recalcularFaixa + registrarIndicacao) ficam pulados no caminho
   * tx — eles dependem de `this.prisma` e não fazem sentido pro Caso 1
   * (custeio puro, sem MLM/indicação).
   *
   * `origem` discrimina o caminho de admissão:
   *  - ADMIN_MANUAL (default): membro nasce MEMBRO_ATIVO + ativo=true → entra
   *    direto na consolidada. Preserva os 4 callers legados (admin manual via
   *    /convenios/:id/membros, CSV import, motor.aceitar via UI admin Caso 1,
   *    vínculo MLM via codigoRef).
   *  - CSV: idem ADMIN_MANUAL (import em massa supõe pré-aprovação).
   *  - CONVITE_PUBLICO: membro nasce PENDENTE_APROVACAO_EMPRESA + ativo=false
   *    (NÃO entra na consolidada) + cria AprovacaoConvenioMembro no MESMO `tx`
   *    (magic link token crypto.randomBytes(32).hex, TTL 7d). Pula MLM porque
   *    custeio público não é MLM.
   *
   * Quando chamado sem `tx` (fluxo legado de admin/manual), comportamento
   * idêntico ao anterior.
   */
  async adicionarMembro(
    convenioId: string,
    cooperadoId: string,
    matricula?: string,
    tx?: Prisma.TransactionClient,
    origem: AdmissionOrigem = 'ADMIN_MANUAL',
  ) {
    const db = tx ?? this.prisma;

    const convenio = await db.contratoConvenio.findUnique({ where: { id: convenioId } });
    if (!convenio) throw new NotFoundException('Convênio não encontrado');
    if (convenio.status !== 'ATIVO') throw new BadRequestException('Convênio não está ativo');

    const cooperado = await db.cooperado.findUnique({ where: { id: cooperadoId } });
    if (!cooperado) throw new NotFoundException('Cooperado não encontrado');

    // Verificar que cooperado pertence à mesma cooperativa
    if (cooperado.cooperativaId !== convenio.cooperativaId) {
      throw new BadRequestException('Cooperado não pertence a esta cooperativa');
    }

    // Verificar se cooperado já é membro de outro convênio ativo
    const membroOutro = await db.convenioCooperado.findFirst({
      where: {
        cooperadoId,
        ativo: true,
        convenioId: { not: convenioId },
      },
    });
    if (membroOutro) {
      throw new BadRequestException('Cooperado já é membro de outro convênio ativo. Desvincule primeiro.');
    }

    // Verificar se já existe vínculo
    const existente = await db.convenioCooperado.findUnique({
      where: { convenioId_cooperadoId: { convenioId, cooperadoId } },
    });

    // Sprint Convite-Convênio Fatia 2 — status/ativo conforme origem.
    // CONVITE_PUBLICO nasce pendente; demais entram ATIVO (preserva legado).
    const isConvitePublico = origem === 'CONVITE_PUBLICO';
    const statusNovo: StatusMembroConvenio = isConvitePublico
      ? 'PENDENTE_APROVACAO_EMPRESA'
      : 'MEMBRO_ATIVO';
    const ativoNovo = !isConvitePublico;

    let membro;
    if (existente) {
      // Bloqueio defensivo: vínculo pendente OU ativo bloqueia novo cadastro do
      // mesmo CPF neste convênio (dedup Caso C da Fatia 2 — proteção em camada).
      if (
        existente.ativo ||
        existente.status === 'PENDENTE_APROVACAO_EMPRESA' ||
        existente.status === 'PENDENTE_APROVACAO_ADMIN'
      ) {
        throw new BadRequestException('Cooperado já vinculado a este convênio');
      }
      // Reativar — usa estado conforme origem (CONVITE_PUBLICO reativa em PENDENTE)
      membro = await db.convenioCooperado.update({
        where: { id: existente.id },
        data: {
          ativo: ativoNovo,
          status: statusNovo,
          origem,
          matricula: matricula ?? existente.matricula,
          dataAdesao: new Date(),
          dataDesligamento: null,
          // Limpa carimbos de aprovação antigos (nova rodada de fluxo)
          aprovadoPorEmpresaEm: null,
          aprovadoPorAdminEm: null,
          rejeitadoPorEmpresaEm: null,
          rejeitadoPorAdminEm: null,
          motivoRejeicao: null,
        },
      });
    } else {
      membro = await db.convenioCooperado.create({
        data: {
          convenioId,
          cooperadoId,
          matricula,
          ativo: ativoNovo,
          status: statusNovo,
          origem,
          dataAdesao: new Date(),
        },
      });
    }

    // CONVITE_PUBLICO — criar magic link de aprovação da empresa no MESMO tx.
    // Atômico: se a criação do token falhar, rollback total do vínculo.
    if (isConvitePublico) {
      const token = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + APROVACAO_TTL_DIAS * 24 * 60 * 60 * 1000);
      await db.aprovacaoConvenioMembro.create({
        data: {
          membroId: membro.id,
          token,
          expiresAt,
        },
      });
      this.logger.log(
        `[convite-publico] Membro PENDENTE criado: convenioId=${convenioId} ` +
          `cooperadoId=${cooperadoId} membroId=${membro.id} tokenSufixo=...${token.slice(-6)} ` +
          `expira=${expiresAt.toISOString()}`,
      );
    }

    // Side effects MLM — só fora de transação serializável (Caso legado)
    // E só pra origens não-públicas. CONVITE_PUBLICO nunca dispara MLM
    // (custeio puro) nem recalcula faixa (pendente não ocupa faixa MLM).
    if (!tx && !isConvitePublico) {
      if (convenio.registrarComoIndicacao && convenio.conveniadoId) {
        try {
          await this.registrarIndicacaoConvenio(convenio.conveniadoId, cooperadoId, convenio.cooperativaId, membro.id);
        } catch (err) {
          this.logger.warn(`Falha ao registrar indicação do convênio: ${err.message}`);
        }
      }
      await this.progressaoService.recalcularFaixa(convenioId, 'NOVO_MEMBRO');
    }

    return membro;
  }

  async removerMembro(convenioId: string, cooperadoId: string) {
    const vinculo = await this.prisma.convenioCooperado.findUnique({
      where: { convenioId_cooperadoId: { convenioId, cooperadoId } },
    });
    if (!vinculo) throw new NotFoundException('Vínculo não encontrado');
    if (!vinculo.ativo) throw new BadRequestException('Membro já desligado');

    const updated = await this.prisma.convenioCooperado.update({
      where: { id: vinculo.id },
      data: {
        ativo: false,
        status: 'MEMBRO_DESLIGADO',
        dataDesligamento: new Date(),
      },
    });

    // Recalcular faixa
    await this.progressaoService.recalcularFaixa(convenioId, 'MEMBRO_DESLIGADO');

    // Sprint Convênio FUNDAÇÃO (21/06/2026) — E1: tokens FICAM com o
    // funcionário no desligamento (decisão Luciano). removerMembro NÃO
    // toca saldo de token, ledger, qualificação Clube ou TokenTransacao.
    // Notifica o cooperado pra reforçar transparência + UX. Best-effort:
    // falha de WA não derruba o desligamento (já commitado). Sem telefone =
    // skip + log warn (D-novo-NOTIF-EMAIL-FALLBACK P3 catalogado).
    await this.notificarDesligamentoE1(convenioId, cooperadoId);

    return updated;
  }

  /**
   * Sprint Convênio FUNDAÇÃO (21/06/2026) — E1 inline.
   * Notifica cooperado desligado de convênio que tokens continuam com ele.
   * Best-effort: erros logados, nunca propagados (desligamento já commitado).
   */
  private async notificarDesligamentoE1(convenioId: string, cooperadoId: string): Promise<void> {
    try {
      const convenio = await this.prisma.contratoConvenio.findUnique({
        where: { id: convenioId },
        select: { cooperativaId: true, empresaNome: true },
      });
      if (!convenio) {
        this.logger.warn(`[E1] convênio ${convenioId} não encontrado pós-remoção`);
        return;
      }
      const cooperado = await this.prisma.cooperado.findFirst({
        where: { id: cooperadoId, cooperativaId: convenio.cooperativaId },
        select: { telefone: true, nomeCompleto: true },
      });
      if (!cooperado?.telefone) {
        this.logger.warn(
          `[E1] cooperado ${cooperadoId} sem telefone — notificação pulada (D-novo-NOTIF-EMAIL-FALLBACK)`,
        );
        return;
      }
      const cooperativaId = convenio.cooperativaId;
      if (!cooperativaId) {
        // Defesa — todos os ContratoConvenio reais têm cooperativaId.
        this.logger.warn(`[E1] convênio ${convenioId} sem cooperativaId — pulado`);
        return;
      }
      const [saldo, config] = await Promise.all([
        this.prisma.cooperTokenSaldo.findUnique({
          where: { cooperadoId },
          select: { saldoDisponivel: true },
        }),
        this.prisma.configCooperToken.findUnique({
          where: { cooperativaId },
          select: { valorTokenReais: true },
        }),
      ]);
      const tokens = Number(saldo?.saldoDisponivel ?? 0);
      const valorTokenReais = Number(config?.valorTokenReais ?? 0.45);
      const valorReais = Math.round(tokens * valorTokenReais * 100) / 100;

      const linhaTokens = tokens > 0
        ? `Você ainda tem ${tokens.toLocaleString('pt-BR', { maximumFractionDigits: 4 })} CooperTokens ` +
          `(aprox. ${valorReais.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}). ` +
          `Eles CONTINUAM SEUS — use no app pra abater sua própria fatura ou pagar em estabelecimentos do Clube.`
        : `Caso receba tokens no futuro, eles serão seus.`;

      const texto =
        `ℹ️ Desligamento do convênio\n\n` +
        `Olá, ${cooperado.nomeCompleto}!\n\n` +
        `Você foi desligado do convênio com ${convenio.empresaNome}.\n\n` +
        `${linhaTokens}`;

      await this.waSender.enviarMensagem(cooperado.telefone, texto, {
        tipoDisparo: 'CONVENIO_DESLIGAMENTO_E1',
        disparoId: `${convenioId}:${cooperadoId}`,
        cooperadoId,
        cooperativaId: convenio.cooperativaId ?? undefined,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(
        `[E1] Falha ao notificar desligamento cooperado=${cooperadoId} convenio=${convenioId}: ${msg}`,
      );
    }
  }

  async updateMembro(convenioId: string, cooperadoId: string, data: { descontoOverride?: number | null; matricula?: string }) {
    const vinculo = await this.prisma.convenioCooperado.findUnique({
      where: { convenioId_cooperadoId: { convenioId, cooperadoId } },
    });
    if (!vinculo) throw new NotFoundException('Vínculo não encontrado');

    const updateData: any = {};
    if (data.descontoOverride !== undefined) updateData.descontoOverride = data.descontoOverride;
    if (data.matricula !== undefined) updateData.matricula = data.matricula;

    return this.prisma.convenioCooperado.update({
      where: { id: vinculo.id },
      data: updateData,
    });
  }

  async listarMembros(convenioId: string, cooperativaIdJwt?: string) {
    // Sprint Hardening Lateral (23/06/2026) — fix
    // D-novo-CONVENIO-LISTAR-MEMBROS-SEM-COOPID P2 (defense-in-depth).
    // Antes: where: {convenioId} sem filtro tenant. Pre-check do controller
    // protege ADMIN; reafirmamos via `convenio.cooperativaId` no where
    // pra resistir a chamadores futuros sem pre-check.
    return this.prisma.convenioCooperado.findMany({
      where: {
        convenioId,
        ...(cooperativaIdJwt
          ? { convenio: { cooperativaId: cooperativaIdJwt } }
          : {}),
      },
      include: {
        cooperado: {
          select: { id: true, nomeCompleto: true, cpf: true, email: true, telefone: true, tipoCooperado: true },
        },
        indicacao: { select: { id: true, status: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async importarMembros(convenioId: string, membros: { cooperadoId: string; matricula?: string }[]) {
    const convenio = await this.prisma.contratoConvenio.findUnique({ where: { id: convenioId } });
    if (!convenio) throw new NotFoundException('Convênio não encontrado');
    if (convenio.status !== 'ATIVO') throw new BadRequestException('Convênio não está ativo');

    const resultados = { sucesso: 0, erros: [] as string[], parcial: false };

    for (const m of membros) {
      try {
        await this.adicionarMembroSemRecalculo(convenioId, convenio, m.cooperadoId, m.matricula);
        resultados.sucesso++;
      } catch (err: any) {
        resultados.erros.push(`${m.cooperadoId}: ${err.message}`);
      }
    }

    resultados.parcial = resultados.erros.length > 0;

    // Recálculo final único
    await this.progressaoService.recalcularFaixa(convenioId, 'IMPORTACAO_MASSA');

    return resultados;
  }

  private async adicionarMembroSemRecalculo(convenioId: string, convenio: any, cooperadoId: string, matricula?: string) {
    const cooperado = await this.prisma.cooperado.findUnique({ where: { id: cooperadoId } });
    if (!cooperado) throw new NotFoundException('Cooperado não encontrado');
    if (cooperado.cooperativaId !== convenio.cooperativaId) {
      throw new BadRequestException('Cooperado não pertence a esta cooperativa');
    }

    const membroOutro = await this.prisma.convenioCooperado.findFirst({
      where: { cooperadoId, ativo: true, convenioId: { not: convenioId } },
    });
    if (membroOutro) throw new BadRequestException('Cooperado já é membro de outro convênio ativo');

    const existente = await this.prisma.convenioCooperado.findUnique({
      where: { convenioId_cooperadoId: { convenioId, cooperadoId } },
    });

    let membro;
    if (existente) {
      if (existente.ativo) return existente;
      membro = await this.prisma.convenioCooperado.update({
        where: { id: existente.id },
        data: { ativo: true, status: 'MEMBRO_ATIVO', matricula: matricula ?? existente.matricula, dataAdesao: new Date(), dataDesligamento: null },
      });
    } else {
      membro = await this.prisma.convenioCooperado.create({
        data: { convenioId, cooperadoId, matricula, ativo: true, status: 'MEMBRO_ATIVO', dataAdesao: new Date() },
      });
    }

    // Indicação sem recálculo
    if (convenio.registrarComoIndicacao && convenio.conveniadoId) {
      try {
        await this.registrarIndicacaoConvenio(convenio.conveniadoId, cooperadoId, convenio.cooperativaId, membro.id);
      } catch (err) {
        this.logger.warn(`Falha indicação import: ${err.message}`);
      }
    }

    return membro;
  }

  // ─── Private ──────────────────────────────────────────────────────────────

  private async registrarIndicacaoConvenio(
    indicadorId: string,
    indicadoId: string,
    cooperativaId: string | null,
    membroId: string,
  ) {
    if (!cooperativaId) return;
    if (indicadorId === indicadoId) return;

    // Verificar se já existe indicação para este indicado
    const existente = await this.prisma.indicacao.findFirst({
      where: { cooperadoIndicadoId: indicadoId, nivel: 1 },
    });
    if (existente) return; // Já tem indicação, não duplicar

    const indicacao = await this.prisma.indicacao.create({
      data: {
        cooperativaId,
        cooperadoIndicadorId: indicadorId,
        cooperadoIndicadoId: indicadoId,
        nivel: 1,
        status: 'PENDENTE',
      },
    });

    // Vincular indicação ao membro
    await this.prisma.convenioCooperado.update({
      where: { id: membroId },
      data: { indicacaoId: indicacao.id },
    });

    this.logger.log(`Indicação registrada: ${indicadorId} → ${indicadoId} (convênio)`);
  }
}
