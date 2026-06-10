import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  StatusMembroConvenio,
  TipoDocumento,
} from '@prisma/client';
import * as crypto from 'node:crypto';
import { PrismaService } from '../prisma.service';
import { NotificacoesService } from '../notificacoes/notificacoes.service';
import { WhatsappSenderService } from '../whatsapp/whatsapp-sender.service';
// Sprint Onboarding Bloco 1 Fatia 1.3 (06/06/2026) — gate MEMBRO_ATIVO constrói
// o membro completo (contrato + clube + flip status + pendência).
import { MembroBuilderService } from './membro-builder.service';

/**
 * Sprint Convite-Convênio Fatia 3 (03/06/2026) — Aprovação 3 portas.
 *
 * Porta 0 (identidade) = OTP (Fatia 2b).
 * Porta 1 (empresa) = magic link via WhatsApp — AprovacaoConvenioMembro.
 * Porta 2 (CoopereBR admin) = dashboard JWT.
 *
 * State machine ConvenioCooperado:
 *
 *   PENDENTE_APROVACAO_EMPRESA (ativo=false)
 *     ├─ empresa magic link APROVAR → PENDENTE_APROVACAO_ADMIN + aprovadoPorEmpresaEm
 *     ├─ empresa magic link REJEITAR → MEMBRO_REJEITADO_EMPRESA + rejeitadoPorEmpresaEm
 *     ├─ admin DELETE (cleanup) → registro deletado
 *     └─ admin REENVIAR magic link → regenera token + WA
 *
 *   PENDENTE_APROVACAO_ADMIN (ativo=false)
 *     ├─ admin APROVAR → MEMBRO_ATIVO + ativo=true (ENTRA na consolidada)
 *     ├─ admin SOLICITAR DOCUMENTAÇÃO → mantém status + documentacaoSolicitadaEm
 *     │   + cria N DocumentoCooperado(tipo, PENDENTE)
 *     └─ admin REJEITAR → MEMBRO_REJEITADO_ADMIN + rejeitadoPorAdminEm
 *
 *   MEMBRO_REJEITADO_* / MEMBRO_DESLIGADO → terminais.
 *
 * GUARDS:
 *   - Empresa só age em PENDENTE_APROVACAO_EMPRESA (decisão Luciano).
 *   - Admin NÃO pula a empresa (decisão Luciano). Admin só age em
 *     PENDENTE_APROVACAO_ADMIN. Em PENDENTE_APROVACAO_EMPRESA, admin só
 *     pode DELETAR (cleanup) ou REENVIAR magic link.
 *   - Magic link single-use (usedAt+decisao preenchidos), TTL 7d.
 *   - $transaction Serializable em todas as transições — atomicidade
 *     mesmo padrão da Fatia 2c.1.
 */
@Injectable()
export class ConvenioAprovacaoService {
  private readonly logger = new Logger(ConvenioAprovacaoService.name);
  private static readonly APROVACAO_TTL_DIAS = 7;

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificacoes: NotificacoesService,
    private readonly waSender: WhatsappSenderService,
    // Fatia 1.3 — gate único MEMBRO_ATIVO.
    private readonly membroBuilder: MembroBuilderService,
  ) {}

  // ─── Porta 1 (EMPRESA via magic link) ─────────────────────────────

  /**
   * Valida token publicamente (página /aprovacao-membro/[token]). NUNCA
   * retorna CPF/telefone integrais (defesa LGPD/anti-enumeration).
   */
  async validarTokenAprovacao(token: string): Promise<
    | { valido: false; motivo: string }
    | {
        valido: true;
        empresaNome: string;
        nomeConvidado: string;
        cpfSufixo: string;
        telefoneSufixo: string;
        dataAdesao: Date;
      }
  > {
    if (!token) return { valido: false, motivo: 'Token ausente.' };

    const aprovacao = await this.prisma.aprovacaoConvenioMembro.findUnique({
      where: { token },
      include: {
        membro: {
          include: {
            cooperado: { select: { nomeCompleto: true, cpf: true, telefone: true } },
            convenio: { select: { empresaNome: true } },
          },
        },
      },
    });
    if (!aprovacao) return { valido: false, motivo: 'Convite não encontrado.' };
    if (aprovacao.usedAt) {
      return { valido: false, motivo: 'Esta decisão já foi registrada.' };
    }
    if (aprovacao.expiresAt <= new Date()) {
      return {
        valido: false,
        motivo: 'Link expirado. Solicite ao admin pra gerar um novo.',
      };
    }
    if (aprovacao.membro.status !== 'PENDENTE_APROVACAO_EMPRESA') {
      return {
        valido: false,
        motivo: 'Este cadastro não está mais aguardando sua confirmação.',
      };
    }
    return {
      valido: true,
      empresaNome: aprovacao.membro.convenio.empresaNome,
      nomeConvidado: aprovacao.membro.cooperado.nomeCompleto,
      cpfSufixo: '...' + (aprovacao.membro.cooperado.cpf ?? '').slice(-3),
      telefoneSufixo: '...' + (aprovacao.membro.cooperado.telefone ?? '').slice(-4),
      dataAdesao: aprovacao.membro.dataAdesao,
    };
  }

  /**
   * Empresa decide via magic link. Single-use ATÔMICO em $transaction
   * Serializable: update aprovacao where {token, usedAt:null} retorna
   * P2025 se outro POST consumiu antes (race → 409).
   */
  async decidirAprovacaoEmpresa(input: {
    token: string;
    decisao: 'APROVAR' | 'REJEITAR';
    motivo?: string;
    ip?: string;
    userAgent?: string;
  }): Promise<{ ok: true; status: StatusMembroConvenio }> {
    const { token, decisao, motivo, ip, userAgent } = input;

    if (decisao === 'REJEITAR' && (!motivo || motivo.trim().length < 2)) {
      throw new BadRequestException(
        'Motivo obrigatório ao recusar (mínimo 2 caracteres).',
      );
    }

    // Carrega ANTES do tx pra validar estado do membro + dar mensagens claras
    const aprovacao = await this.prisma.aprovacaoConvenioMembro.findUnique({
      where: { token },
      include: {
        membro: { select: { id: true, status: true, convenioId: true } },
      },
    });
    if (!aprovacao) throw new NotFoundException('Convite não encontrado.');
    if (aprovacao.usedAt) {
      throw new ConflictException('Esta decisão já foi registrada.');
    }
    if (aprovacao.expiresAt <= new Date()) {
      throw new BadRequestException(
        'Link expirado. Solicite ao admin pra gerar um novo.',
      );
    }
    // Guard: empresa só age em PENDENTE_APROVACAO_EMPRESA
    if (aprovacao.membro.status !== 'PENDENTE_APROVACAO_EMPRESA') {
      throw new ConflictException(
        'Este cadastro não está mais aguardando sua confirmação.',
      );
    }

    const novoStatus: StatusMembroConvenio =
      decisao === 'APROVAR' ? 'PENDENTE_APROVACAO_ADMIN' : 'MEMBRO_REJEITADO_EMPRESA';
    const agora = new Date();

    try {
      await this.prisma.$transaction(
        async (tx) => {
          // Single-use atômico
          try {
            await tx.aprovacaoConvenioMembro.update({
              where: { id: aprovacao.id, usedAt: null },
              data: {
                usedAt: agora,
                decisao: decisao === 'APROVAR' ? 'APROVADO' : 'REJEITADO',
                motivoRejeicao: decisao === 'REJEITAR' ? motivo?.trim() : null,
                aprovadorIp: ip,
                aprovadorUserAgent: userAgent,
              },
            });
          } catch (err: any) {
            if (
              err instanceof Prisma.PrismaClientKnownRequestError &&
              err.code === 'P2025'
            ) {
              throw new ConflictException('RACE_USED_AT');
            }
            throw err;
          }

          // Atualiza ConvenioCooperado (membro)
          const dadosMembro: Prisma.ConvenioCooperadoUpdateInput =
            decisao === 'APROVAR'
              ? {
                  status: novoStatus,
                  aprovadoPorEmpresaEm: agora,
                }
              : {
                  status: novoStatus,
                  rejeitadoPorEmpresaEm: agora,
                  motivoRejeicao: motivo!.trim(),
                };

          // Guard adicional no update: where com status atual (defesa em
          // profundidade contra race entre o load e o tx)
          const r = await tx.convenioCooperado.updateMany({
            where: {
              id: aprovacao.membro.id,
              status: 'PENDENTE_APROVACAO_EMPRESA',
            },
            data: dadosMembro,
          });
          if (r.count === 0) {
            throw new ConflictException('RACE_STATUS_CHANGED');
          }
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (err: any) {
      if (err instanceof ConflictException) {
        const m = err.message;
        if (m === 'RACE_USED_AT' || m === 'RACE_STATUS_CHANGED') {
          this.logger.warn(
            `[aprovacao-empresa] Race: token=...${token.slice(-6)} motivo=${m}`,
          );
          throw new ConflictException('Esta decisão já foi registrada.');
        }
      }
      throw err;
    }

    // Notificações in-app (Fatia 6 traz WA+email)
    // TODO Fatia 6: notif WA/email pro Cooperado quando REJEITAR (com motivo).
    // TODO Fatia 6: notif WA/email pro Admin quando APROVAR/REJEITAR.
    await this.notificarPosAprovacaoEmpresa({
      membroId: aprovacao.membro.id,
      convenioId: aprovacao.membro.convenioId,
      decisao,
      motivo,
    });

    this.logger.log(
      `[aprovacao-empresa] OK: token=...${token.slice(-6)} ` +
        `membroId=${aprovacao.membro.id} decisao=${decisao} novoStatus=${novoStatus}`,
    );

    return { ok: true, status: novoStatus };
  }

  // ─── Porta 1b (Empresa logada via portal) ─────────────────────────

  /**
   * Sprint Portal Empresa HOTFIX (04/06/2026) — empresa decide IN-PORTAL
   * (JWT, sem depender de AprovacaoConvenioMembro/magic link). Espelha a
   * state machine de `decidirAprovacaoEmpresa` mas opera direto no membroId.
   *
   * Justificativa: o magic link só é criado quando o admin envia "Reenviar
   * aprovação empresa". No /auto-inscrever da Fatia 2c o membro nasce
   * PENDENTE_APROVACAO_EMPRESA sem AprovacaoConvenioMembro automaticamente
   * (depende do admin clicar reenviar). Empresa logada NÃO depende disso —
   * o JWT já comprova posse via PagadorCooperadoGuard.
   *
   * GUARDS:
   *  - Multi-tenant via cooperativaId (guard externo + carregarMembroDoTenant).
   *  - status === PENDENTE_APROVACAO_EMPRESA (senão erro claro 409).
   *  - REJEITAR exige motivo >= 2 chars.
   *  - $transaction Serializable + updateMany com status check (idempotência
   *    + anti-race) — mesma defesa em profundidade da Porta 1.
   *
   * EFEITOS:
   *  - APROVAR → status PENDENTE_APROVACAO_ADMIN + aprovadoPorEmpresaEm=now.
   *  - REJEITAR → MEMBRO_REJEITADO_EMPRESA + rejeitadoPorEmpresaEm=now + motivoRejeicao.
   *  - Se EXISTIR AprovacaoConvenioMembro pro membro, marca usedAt+decisao
   *    pra consistência (NÃO exige). IP + UA gravados também se houver.
   *  - Notificações mesma cadeia da Porta 1 (notificarPosAprovacaoEmpresa).
   */
  async decidirAprovacaoEmpresaLogada(input: {
    membroId: string;
    cooperativaId: string;
    decisao: 'APROVAR' | 'REJEITAR';
    motivo?: string;
    ip?: string;
    userAgent?: string;
  }): Promise<{ ok: true; status: StatusMembroConvenio }> {
    const { membroId, cooperativaId, decisao, motivo, ip, userAgent } = input;

    if (decisao === 'REJEITAR' && (!motivo || motivo.trim().length < 2)) {
      throw new BadRequestException(
        'Motivo obrigatório ao recusar (mínimo 2 caracteres).',
      );
    }

    const membro = await this.carregarMembroDoTenant(membroId, cooperativaId, {
      includeAprovacao: true,
    });

    if (membro.status !== 'PENDENTE_APROVACAO_EMPRESA') {
      throw new ConflictException(
        'Este cadastro não está mais aguardando sua confirmação.',
      );
    }

    const novoStatus: StatusMembroConvenio =
      decisao === 'APROVAR' ? 'PENDENTE_APROVACAO_ADMIN' : 'MEMBRO_REJEITADO_EMPRESA';
    const agora = new Date();

    try {
      await this.prisma.$transaction(
        async (tx) => {
          // 1. Atualiza ConvenioCooperado (membro) com guard de status
          const dadosMembro: Prisma.ConvenioCooperadoUpdateInput =
            decisao === 'APROVAR'
              ? {
                  status: novoStatus,
                  aprovadoPorEmpresaEm: agora,
                }
              : {
                  status: novoStatus,
                  rejeitadoPorEmpresaEm: agora,
                  motivoRejeicao: motivo!.trim(),
                };

          const r = await tx.convenioCooperado.updateMany({
            where: {
              id: membroId,
              status: 'PENDENTE_APROVACAO_EMPRESA',
            },
            data: dadosMembro,
          });
          if (r.count === 0) {
            throw new ConflictException('RACE_STATUS_CHANGED');
          }

          // 2. Se houver AprovacaoConvenioMembro pendente, consome ela pra
          //    manter consistência (single-use). NÃO falha se não existir.
          const aprov = (membro as any).aprovacao;
          if (aprov && !aprov.usedAt) {
            await tx.aprovacaoConvenioMembro.update({
              where: { id: aprov.id },
              data: {
                usedAt: agora,
                decisao: decisao === 'APROVAR' ? 'APROVADO' : 'REJEITADO',
                motivoRejeicao: decisao === 'REJEITAR' ? motivo?.trim() : null,
                aprovadorIp: ip,
                aprovadorUserAgent: userAgent,
              },
            });
          }
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (err: any) {
      if (err instanceof ConflictException && err.message === 'RACE_STATUS_CHANGED') {
        this.logger.warn(
          `[aprovacao-empresa-logada] Race em membroId=${membroId}: status já mudou.`,
        );
        throw new ConflictException('Esta decisão já foi registrada.');
      }
      throw err;
    }

    await this.notificarPosAprovacaoEmpresa({
      membroId,
      convenioId: membro.convenio.id,
      decisao,
      motivo,
    });

    this.logger.log(
      `[aprovacao-empresa-logada] OK: membroId=${membroId} ` +
        `decisao=${decisao} novoStatus=${novoStatus} (sem token; via JWT empresa)`,
    );

    return { ok: true, status: novoStatus };
  }

  // ─── Porta 2 (CoopereBR ADMIN via dashboard) ──────────────────────

  /**
   * Lista membros PENDENTE_* do convênio (admin). Paginado.
   */
  async listarPendentes(
    convenioId: string,
    cooperativaId: string,
    params?: {
      status?: StatusMembroConvenio;
      page?: number;
      limit?: number;
    },
  ) {
    await this.assertConvenioDoTenant(convenioId, cooperativaId);
    const { status, page = 1, limit = 50 } = params ?? {};

    const where: Prisma.ConvenioCooperadoWhereInput = {
      convenioId,
      status: status
        ? { equals: status }
        : { in: ['PENDENTE_APROVACAO_EMPRESA', 'PENDENTE_APROVACAO_ADMIN'] },
    };
    // Bug C (10/06/2026) — listagem expande `cooperado.ucs[]` + `cotaKwhMensal`
    // pro detalhe do membro pendente exibir UC + energia. Antes a UI mostrava
    // "sem UC" pra todo mundo porque o select nao incluia a relacao. Tenant
    // ja assertado em assertConvenioDoTenant acima — cooperativaId continua
    // vindo do JWT do chamador (controller).
    const [data, total] = await Promise.all([
      this.prisma.convenioCooperado.findMany({
        where,
        include: {
          cooperado: {
            select: {
              id: true,
              nomeCompleto: true,
              cpf: true,
              email: true,
              telefone: true,
              cotaKwhMensal: true,
              ucs: {
                // C-1 (10/06/2026) — filtro cross-tenant EXPLÍCITO no select
                // aninhado (defense in depth). Invariante já garantia que
                // Uc.cooperativaId == Cooperado.cooperativaId == ContratoConvenio.cooperativaId
                // e o assertConvenioDoTenant acima ja escopa por tenant; este
                // where torna a regra independente do invariante (resiste a
                // refator/desnormalizacao futura).
                where: { cooperativaId },
                select: {
                  id: true,
                  numero: true,
                  tipoUc: true,
                  numeroUC: true,
                  numeroConcessionariaOriginal: true,
                  distribuidora: true,
                },
              },
            },
          },
          aprovacao: {
            select: { token: true, expiresAt: true, usedAt: true, decisao: true },
          },
          convite: {
            select: { id: true, nomeConvidado: true, telefone: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.convenioCooperado.count({ where }),
    ]);

    // Sufixo no token de aprovação (defesa LGPD — token integral só vai pro WA da empresa)
    return {
      data: data.map((m) => ({
        ...m,
        cooperado: {
          ...m.cooperado,
          // Prisma Decimal → number pra serialização JSON (front consome number).
          cotaKwhMensal:
            m.cooperado.cotaKwhMensal != null
              ? Number(m.cooperado.cotaKwhMensal)
              : null,
        },
        aprovacao: m.aprovacao
          ? {
              tokenSufixo: '...' + m.aprovacao.token.slice(-6),
              expiresAt: m.aprovacao.expiresAt,
              usedAt: m.aprovacao.usedAt,
              decisao: m.aprovacao.decisao,
            }
          : null,
      })),
      total,
      page,
      limit,
    };
  }

  /**
   * Admin aprova membro PENDENTE_APROVACAO_ADMIN → MEMBRO_ATIVO (entra
   * na consolidada). GUARD strict: rejeita qualquer outro status.
   */
  async aprovarPorAdmin(input: {
    membroId: string;
    cooperativaId: string;
    adminUserId: string;
  }) {
    const { membroId, cooperativaId, adminUserId } = input;
    const membro = await this.carregarMembroDoTenant(membroId, cooperativaId);
    if (membro.status !== 'PENDENTE_APROVACAO_ADMIN') {
      throw new BadRequestException(
        'Membro não está em PENDENTE_APROVACAO_ADMIN. Apenas membros já confirmados pela empresa podem ser aprovados.',
      );
    }

    const agora = new Date();
    await this.prisma.$transaction(
      async (tx) => {
        const r = await tx.convenioCooperado.updateMany({
          where: { id: membroId, status: 'PENDENTE_APROVACAO_ADMIN' },
          data: {
            status: 'MEMBRO_ATIVO',
            ativo: true,
            aprovadoPorAdminEm: agora,
            aprovadoPorAdminUserId: adminUserId,
          },
        });
        if (r.count === 0) {
          throw new ConflictException('Estado do membro mudou — recarregue a lista.');
        }
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    // Fatia 1.3 — CONSTRÓI o membro (contrato + clube + flip status + pendência).
    // Roda FORA do tx Serializable acima porque motor.aceitar abre tx Serializable
    // própria (Prisma savepoint nested não funciona bem em Serializable).
    // try/catch — NUNCA propaga. Aprovação JÁ foi feita; falha aqui vira pendência
    // catalogada no Cooperado, admin reconcilia depois (Fatia 1.4).
    try {
      await this.membroBuilder.construirMembroCompleto({
        cooperadoId: membro.cooperadoId,
        convenioId: membro.convenio.id,
        cooperativaId,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'erro desconhecido';
      this.logger.warn(
        `[aprovar-admin] construirMembroCompleto falhou (membroId=${membroId}): ${msg} — ` +
          `aprovação MEMBRO_ATIVO já efetivada, reconciliação manual via Fatia 1.4.`,
      );
    }

    // TODO Fatia 6: notif WA+email pro Cooperado ("você foi aprovado!")
    await this.notificacoes
      .criar({
        cooperadoId: membro.cooperadoId,
        cooperativaId,
        tipo: 'CONVENIO_MEMBRO_APROVADO',
        titulo: 'Cadastro custeado aprovado',
        mensagem:
          `Você foi aprovado no convênio "${membro.convenio?.empresaNome ?? ''}" — ` +
          `sua energia agora é custeada pela empresa.`,
        link: '/portal',
      })
      .catch(() => {});

    this.logger.log(
      `[aprovar-admin] OK: membroId=${membroId} adminUserId=${adminUserId} → MEMBRO_ATIVO`,
    );

    return { ok: true, status: 'MEMBRO_ATIVO' as const };
  }

  /**
   * Admin solicita documentação ao cooperado — cria N DocumentoCooperado
   * (status PENDENTE) e marca documentacaoSolicitadaEm. Status do membro
   * MANTÉM PENDENTE_APROVACAO_ADMIN.
   */
  async solicitarDocumentacao(input: {
    membroId: string;
    cooperativaId: string;
    adminUserId: string;
    tipos: TipoDocumento[];
  }) {
    const { membroId, cooperativaId, tipos } = input;
    if (!Array.isArray(tipos) || tipos.length === 0) {
      throw new BadRequestException('Forneça pelo menos 1 tipo de documento.');
    }
    const membro = await this.carregarMembroDoTenant(membroId, cooperativaId);
    if (membro.status !== 'PENDENTE_APROVACAO_ADMIN') {
      throw new BadRequestException(
        'Membro não está em PENDENTE_APROVACAO_ADMIN.',
      );
    }

    const agora = new Date();
    await this.prisma.$transaction(
      async (tx) => {
        await tx.convenioCooperado.update({
          where: { id: membroId },
          data: { documentacaoSolicitadaEm: agora },
        });
        // Cria N DocumentoCooperado(tipo, PENDENTE) — @@unique([cooperadoId, tipo])
        // protege contra duplicação se admin repetir tipo de doc já anexado.
        for (const tipo of tipos) {
          await tx.documentoCooperado.upsert({
            where: { cooperadoId_tipo: { cooperadoId: membro.cooperadoId, tipo } },
            create: {
              cooperadoId: membro.cooperadoId,
              tipo,
              url: '', // cooperado preenche ao anexar via portal
              status: 'PENDENTE',
            },
            update: {
              // Reset pra PENDENTE caso doc anterior estivesse REPROVADO
              status: 'PENDENTE',
              motivoRejeicao: null,
            },
          });
        }
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    // TODO Fatia 6: WA+email pro Cooperado ("envie: RG_FRENTE, CNH_FRENTE ...")
    await this.notificacoes
      .criar({
        cooperadoId: membro.cooperadoId,
        cooperativaId,
        tipo: 'CONVENIO_MEMBRO_DOC_SOLICITADA',
        titulo: 'Documentação solicitada',
        mensagem:
          `O admin solicitou: ${tipos.join(', ')}. Envie pelo portal /portal/documentos.`,
        link: '/portal/documentos',
      })
      .catch(() => {});

    this.logger.log(
      `[solicitar-doc] OK: membroId=${membroId} tipos=[${tipos.join(',')}]`,
    );

    return { ok: true, tipos };
  }

  /**
   * Admin rejeita membro PENDENTE_APROVACAO_ADMIN. Estado terminal.
   */
  async rejeitarPorAdmin(input: {
    membroId: string;
    cooperativaId: string;
    adminUserId: string;
    motivo: string;
  }) {
    const { membroId, cooperativaId, adminUserId, motivo } = input;
    if (!motivo || motivo.trim().length < 2) {
      throw new BadRequestException(
        'Motivo obrigatório ao recusar (mínimo 2 caracteres).',
      );
    }
    const membro = await this.carregarMembroDoTenant(membroId, cooperativaId);
    if (membro.status !== 'PENDENTE_APROVACAO_ADMIN') {
      throw new BadRequestException(
        'Membro não está em PENDENTE_APROVACAO_ADMIN.',
      );
    }

    const agora = new Date();
    await this.prisma.$transaction(
      async (tx) => {
        const r = await tx.convenioCooperado.updateMany({
          where: { id: membroId, status: 'PENDENTE_APROVACAO_ADMIN' },
          data: {
            status: 'MEMBRO_REJEITADO_ADMIN',
            rejeitadoPorAdminEm: agora,
            rejeitadoPorAdminUserId: adminUserId,
            motivoRejeicao: motivo.trim(),
          },
        });
        if (r.count === 0) {
          throw new ConflictException('Estado do membro mudou.');
        }
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    // TODO Fatia 6: WA+email pro Cooperado com o motivo
    await this.notificacoes
      .criar({
        cooperadoId: membro.cooperadoId,
        cooperativaId,
        tipo: 'CONVENIO_MEMBRO_REJEITADO',
        titulo: 'Cadastro não aprovado',
        mensagem: `Cadastro recusado: ${motivo.trim()}`,
        link: '/portal',
      })
      .catch(() => {});

    this.logger.log(
      `[rejeitar-admin] OK: membroId=${membroId} adminUserId=${adminUserId} motivo="${motivo.trim().slice(0, 60)}"`,
    );

    return { ok: true, status: 'MEMBRO_REJEITADO_ADMIN' as const };
  }

  /**
   * Reenvia magic link da empresa: regenera token + estende expiresAt + envia
   * novo link via WA pro telefone do convite. GUARD: PENDENTE_APROVACAO_EMPRESA.
   * Útil quando WA não chegou ou link expirou.
   */
  async reenviarAprovacaoEmpresa(input: {
    membroId: string;
    cooperativaId: string;
  }): Promise<{ ok: true; tokenSufixo: string; expiresAt: Date; whatsappEnviado: boolean; whatsappErro?: string }> {
    const { membroId, cooperativaId } = input;
    const membro = await this.carregarMembroDoTenant(membroId, cooperativaId, {
      includeConvite: true,
      includeAprovacao: true,
    });
    if (membro.status !== 'PENDENTE_APROVACAO_EMPRESA') {
      throw new BadRequestException(
        'Só é possível reenviar a confirmação enquanto o membro estiver aguardando a empresa.',
      );
    }
    if (!membro.aprovacao) {
      throw new BadRequestException(
        'Membro sem registro de aprovação — recrie o convite pra gerar novo link.',
      );
    }
    if (membro.aprovacao.usedAt) {
      throw new ConflictException('Esta decisão já foi registrada.');
    }
    if (!membro.convite) {
      throw new BadRequestException(
        'Membro sem convite vinculado — recrie o convite manualmente.',
      );
    }

    const novoToken = crypto.randomBytes(32).toString('hex');
    const novoExpiresAt = new Date(
      Date.now() + ConvenioAprovacaoService.APROVACAO_TTL_DIAS * 24 * 60 * 60 * 1000,
    );

    await this.prisma.aprovacaoConvenioMembro.update({
      where: { id: membro.aprovacao.id },
      data: { token: novoToken, expiresAt: novoExpiresAt },
    });

    const baseUrl =
      process.env.FRONTEND_URL ?? process.env.NEXTAUTH_URL ?? 'http://localhost:3001';
    const link = `${baseUrl}/aprovacao-membro/${novoToken}`;
    const texto =
      `Olá! Você (empresa) tem um cadastro pendente de aprovação no convênio CoopereBR.\n\n` +
      `Cooperado: *${membro.cooperado?.nomeCompleto ?? membro.convite.nomeConvidado}*\n\n` +
      `Acesse para confirmar ou recusar:\n${link}\n\n` +
      `Validade: 7 dias.`;

    let whatsappEnviado = true;
    let whatsappErro: string | undefined;
    try {
      await this.waSender.enviarMensagem(membro.convite.telefone, texto, {
        tipoDisparo: 'convenio_aprovacao_reenviar',
        cooperativaId,
      });
    } catch (err) {
      whatsappEnviado = false;
      whatsappErro = err instanceof Error ? err.message : 'erro desconhecido';
      this.logger.warn(
        `[reenviar-aprovacao] WA falhou: membroId=${membroId} ${whatsappErro}`,
      );
    }

    this.logger.log(
      `[reenviar-aprovacao] OK: membroId=${membroId} novoTokenSufixo=...${novoToken.slice(-6)} wa=${whatsappEnviado}`,
    );

    return {
      ok: true,
      tokenSufixo: '...' + novoToken.slice(-6),
      expiresAt: novoExpiresAt,
      whatsappEnviado,
      whatsappErro,
    };
  }

  /**
   * Cleanup admin de membro PENDENTE_* (B.1): hard DELETE do
   * ConvenioCooperado + AprovacaoConvenioMembro + clear cross-ref no
   * ConviteConvenioMembro. Diferente do `removerMembro` legado que faz
   * soft-delete (status MEMBRO_DESLIGADO) — pendente nunca chegou a ser
   * ativo, então deletar mesmo é correto.
   *
   * GUARD: só PENDENTE_APROVACAO_EMPRESA ou PENDENTE_APROVACAO_ADMIN.
   * MEMBRO_ATIVO continua usando removerMembro legado (soft-delete).
   * Estados terminais (MEMBRO_REJEITADO_* / MEMBRO_DESLIGADO): pode
   * deletar também (limpa histórico — útil pós-auditoria).
   */
  async cleanupPendente(input: {
    membroId: string;
    cooperativaId: string;
    adminUserId: string;
  }) {
    const { membroId, cooperativaId } = input;
    const membro = await this.carregarMembroDoTenant(membroId, cooperativaId);

    const podeDeletar =
      membro.status === 'PENDENTE_APROVACAO_EMPRESA' ||
      membro.status === 'PENDENTE_APROVACAO_ADMIN' ||
      membro.status === 'MEMBRO_REJEITADO_EMPRESA' ||
      membro.status === 'MEMBRO_REJEITADO_ADMIN' ||
      membro.status === 'MEMBRO_DESLIGADO';
    if (!podeDeletar) {
      throw new BadRequestException(
        `Cleanup só é permitido em status PENDENTE_*, REJEITADO_* ou DESLIGADO. ` +
          `Status atual: ${membro.status}. Use o endpoint legado pra desligar MEMBRO_ATIVO.`,
      );
    }

    await this.prisma.$transaction(
      async (tx) => {
        // Limpa AprovacaoConvenioMembro (FK 1-1)
        await tx.aprovacaoConvenioMembro.deleteMany({
          where: { membroId },
        });
        // Limpa cross-ref no ConviteConvenioMembro (opcional 1-1; opcional)
        await tx.conviteConvenioMembro.updateMany({
          where: { membroId },
          data: { membroId: null },
        });
        // Hard delete do membro
        await tx.convenioCooperado.delete({ where: { id: membroId } });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    this.logger.log(
      `[cleanup-pendente] OK: membroId=${membroId} statusAnterior=${membro.status}`,
    );

    return { ok: true, deletado: true, statusAnterior: membro.status };
  }

  // ─── Helpers privados ─────────────────────────────────────────────

  private async assertConvenioDoTenant(convenioId: string, cooperativaId: string) {
    const conv = await this.prisma.contratoConvenio.findFirst({
      where: { id: convenioId, cooperativaId },
      select: { id: true },
    });
    if (!conv) {
      throw new NotFoundException('Convênio não encontrado neste tenant.');
    }
  }

  private async carregarMembroDoTenant(
    membroId: string,
    cooperativaId: string,
    opts?: { includeConvite?: boolean; includeAprovacao?: boolean },
  ) {
    const membro = await this.prisma.convenioCooperado.findUnique({
      where: { id: membroId },
      include: {
        convenio: { select: { id: true, cooperativaId: true, empresaNome: true } },
        cooperado: { select: { id: true, nomeCompleto: true, telefone: true } },
        convite: opts?.includeConvite ? { select: { id: true, telefone: true, nomeConvidado: true } } : false,
        aprovacao: opts?.includeAprovacao
          ? { select: { id: true, token: true, expiresAt: true, usedAt: true } }
          : false,
      },
    });
    if (!membro) {
      throw new NotFoundException('Membro não encontrado.');
    }
    if (membro.convenio.cooperativaId !== cooperativaId) {
      throw new ForbiddenException('Membro não pertence ao seu tenant.');
    }
    return membro;
  }

  private async notificarPosAprovacaoEmpresa(input: {
    membroId: string;
    convenioId: string;
    decisao: 'APROVAR' | 'REJEITAR';
    motivo?: string;
  }) {
    // TODO Fatia 6: trazer EmailService + WhatsappSender pra avisos ricos.
    // Aqui só notificação in-app via NotificacoesService (já injetado).
    const membro = await this.prisma.convenioCooperado.findUnique({
      where: { id: input.membroId },
      include: { convenio: { select: { cooperativaId: true, empresaNome: true } } },
    });
    if (!membro) return;
    const cooperativaId = membro.convenio.cooperativaId!;
    if (input.decisao === 'APROVAR') {
      await this.notificacoes
        .criar({
          cooperativaId,
          tipo: 'CONVENIO_MEMBRO_APROVADO_EMPRESA',
          titulo: 'Membro pendente pra revisão admin',
          mensagem: `A empresa ${membro.convenio.empresaNome} confirmou um novo membro. Revise no painel.`,
          link: `/dashboard/convenios/${input.convenioId}`,
        })
        .catch(() => {});
    } else {
      // REJEITAR: notifica admin + cooperado (cooperado também via in-app)
      await this.notificacoes
        .criar({
          cooperativaId,
          tipo: 'CONVENIO_MEMBRO_REJEITADO_EMPRESA',
          titulo: 'Empresa recusou um cadastro custeado',
          mensagem: `${membro.convenio.empresaNome} recusou: ${input.motivo ?? '(sem motivo)'}`,
          link: `/dashboard/convenios/${input.convenioId}`,
        })
        .catch(() => {});
      await this.notificacoes
        .criar({
          cooperadoId: membro.cooperadoId,
          cooperativaId,
          tipo: 'CONVENIO_MEMBRO_REJEITADO_PELO_PATRAO',
          titulo: 'Cadastro custeado não aprovado',
          mensagem: `A empresa não confirmou seu vínculo: ${input.motivo ?? '(sem motivo)'}`,
          link: '/portal',
        })
        .catch(() => {});
    }
  }
}
