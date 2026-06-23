import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../prisma.service';
import { CooperTokenService } from './cooper-token.service';
import { CooperTokenTipo, Prisma } from '@prisma/client';
import { AsPlatform } from '../common/tenant-context';
// Sprint M52a v2 (23/06/2026) — re-review code (a)+(b): helper extraída
// pra arquivo dedicado sem dependência NestJS, importável por scripts e
// specs sem carregar a classe Job inteira.
import { sinalDaOperacao } from './cooper-token.ledger-utils';
// Sprint Clube P1 — Fase 1.5 Bloco 3 (10/06/2026): gate juridico da oxidacao.
import { isAmbienteReal } from '../common/safety/ambiente';
// Sprint C Hardening (17/06/2026) — D-novo-RECONCILIACAO-CONTABIL-CRON P2.
// Re-tenta lancarResgatePix em recibos PAGO_CREDITO_PENDENTE.
import { TokenContabilService } from '../financeiro/token-contabil.service';


@Injectable()
export class CooperTokenJob {
  private readonly logger = new Logger(CooperTokenJob.name);

  // Sprint C Hardening (17/06/2026) — backoff exponencial pra retry
  // de reconciliação contábil. Após N=5 falhas, desistido=true e
  // dispara alerta forte (AuditLog + evento). Tempo total até
  // desistir: 5min + 30min + 2h + 12h + 24h ≈ 39h cobertura.
  // Cron */15 garante que o backoff é resolvido dentro de 15min
  // da janela alvo.
  private static readonly BACKOFF_MINUTOS = [5, 30, 120, 720, 1440];
  private static readonly MAX_TENTATIVAS = CooperTokenJob.BACKOFF_MINUTOS.length;

  constructor(
    private prisma: PrismaService,
    private cooperTokenService: CooperTokenService,
    // Sprint C Hardening — opcional pra não quebrar specs antigos que
    // instanciam o job sem injetar (smoke + cron usam em prod).
    private tokenContabilService?: TokenContabilService,
    private eventEmitter?: EventEmitter2,
  ) {}

  /**
   * Diariamente Ã s 6h: apura excedentes de faturas processadas
   * em planos com cooperTokenAtivo=true
   */
  @Cron('0 6 * * *')

  @AsPlatform()
  async apurarExcedentes() {
    this.logger.log('Iniciando apuraÃ§Ã£o de excedentes CooperToken...');

    // Buscar faturas processadas nÃ£o apuradas, com plano cooperTokenAtivo
    const faturas = await this.prisma.faturaProcessada.findMany({
      where: {
        tokenApurado: false,
        status: 'APROVADA',
        cooperado: {
          contratos: {
            some: {
              status: 'ATIVO',
              plano: { cooperTokenAtivo: true },
            },
          },
        },
      },
      include: {
        cooperado: {
          include: {
            contratos: {
              where: { status: 'ATIVO' },
              include: { plano: true },
              take: 1,
            },
          },
        },
      },
    });

    this.logger.log(`Encontradas ${faturas.length} faturas para apuraÃ§Ã£o`);

    let totalTokensCreditados = 0;

    for (const fatura of faturas) {
      try {
        if (!fatura.cooperado || !fatura.cooperadoId) continue;
        const contrato = fatura.cooperado.contratos[0];
        if (!contrato) continue;

        const plano = contrato.plano;
        if (!plano) continue;

        // BUG-008: cooperados sem cota definida não devem receber tokens de excedente
        const cotaKwhRaw = fatura.cooperado.cotaKwhMensal;
        if (!cotaKwhRaw || Number(cotaKwhRaw) <= 0) {
          await this.prisma.faturaProcessada.update({
            where: { id: fatura.id },
            data: { tokenApurado: true },
          });
          continue;
        }

        const cotaKwh = Number(cotaKwhRaw);
        const kwhGerado = Number(fatura.mediaKwhCalculada ?? 0);
        const excedente = Math.round((kwhGerado - cotaKwh) * 100) / 100;

        if (excedente <= 0) {
          await this.prisma.faturaProcessada.update({
            where: { id: fatura.id },
            data: { tokenApurado: true },
          });
          continue;
        }

        const tokenPorKwh = Number(plano.tokenPorKwhExcedente ?? 1);
        const quantidade = Math.round(excedente * tokenPorKwh * 100) / 100;

        await this.cooperTokenService.creditar({
          cooperadoId: fatura.cooperadoId!,
          cooperativaId: contrato.cooperativaId ?? '',
          tipo: CooperTokenTipo.GERACAO_EXCEDENTE,
          quantidade,
          referenciaId: fatura.id,
          referenciaTabela: 'FaturaProcessada',
          expiracaoMeses: plano.tokenExpiracaoMeses ?? 12,
        });

        await this.prisma.faturaProcessada.update({
          where: { id: fatura.id },
          data: { tokenApurado: true },
        });

        totalTokensCreditados += quantidade;
      } catch (error) {
        this.logger.error(
          `Erro ao apurar fatura ${fatura.id}: ${error.message}`,
        );
      }
    }

    this.logger.log(
      `ApuraÃ§Ã£o concluÃ­da. Total de tokens creditados: ${totalTokensCreditados}`,
    );
  }

  /**
   * Todo dia 1Âº Ã s 2h: expira tokens vencidos
   */
  @Cron('0 2 1 * *')

  @AsPlatform()
  async expirarTokensVencidos() {
    this.logger.log('Iniciando expiraÃ§Ã£o de tokens vencidos...');

    const cooperativas = await this.prisma.cooperativa.findMany({
      where: { ativo: true },
      select: { id: true, nome: true },
    });

    let totalExpirado = 0;

    for (const coop of cooperativas) {
      try {
        const expirados = await this.cooperTokenService.expirarVencidos(
          coop.id,
        );
        totalExpirado += expirados;

        if (expirados > 0) {
          this.logger.log(
            `Expirados ${expirados} tokens da cooperativa ${coop.nome}`,
          );
        }
      } catch (error) {
        this.logger.error(
          `Erro ao expirar tokens da cooperativa ${coop.nome}: ${error.message}`,
        );
      }
    }

    this.logger.log(
      `ExpiraÃ§Ã£o concluÃ­da. Total expirado: ${totalExpirado} tokens`,
    );
  }

  /**
   * Sprint Clube P1 — Fase 1.5 Bloco 3 (10/06/2026).
   *
   * Mensalmente dia 1 as 3h: aplica oxidacao DECAY_CONTINUO nas cooperativas
   * que ligaram a feature (`ConfigCooperToken.oxidacaoPercMes > 0`).
   *
   * Roda 1h DEPOIS do `expirarTokensVencidos` (que esta em 02:00) pra nao
   * competir por bloqueios de saldo. Cooperativas sem config OU com perc=0
   * sao puladas pelo proprio `aplicarOxidacao`.
   *
   * GATE JURIDICO: em producao real (`isAmbienteReal()` true), exige flag
   * `OXIDACAO_PRODUCAO_LIBERADA=true` no .env — trava tecnica enquanto
   * Luciano nao tem politica de quebra escrita+aprovada + auditoria.
   * Em DEV roda normal (testes operacionais). Decisao confirmada 10/06.
   */
  @Cron('0 3 1 * *')
  @AsPlatform()
  async aplicarOxidacaoMensal() {
    this.logger.log('Iniciando oxidacao DECAY_CONTINUO mensal...');

    if (isAmbienteReal() && process.env.OXIDACAO_PRODUCAO_LIBERADA !== 'true') {
      this.logger.warn(
        '[oxidacao] Gate juridico ATIVO em producao: OXIDACAO_PRODUCAO_LIBERADA != true. Cron SKIPADO. Liberar so apos politica de quebra escrita/aprovada + auditoria.',
      );
      return;
    }

    const cooperativas = await this.prisma.cooperativa.findMany({
      where: { ativo: true },
      select: { id: true, nome: true },
    });

    let totalOxidadoGlobal = 0;
    let totalCooperadosAfetadosGlobal = 0;

    for (const coop of cooperativas) {
      try {
        const r = await this.cooperTokenService.aplicarOxidacao(coop.id);
        totalOxidadoGlobal += r.totalTokensReduzidos;
        totalCooperadosAfetadosGlobal += r.cooperadosAfetados;

        if (r.cooperadosAfetados > 0) {
          this.logger.log(
            `[oxidacao] ${coop.nome}: ${r.cooperadosAfetados} cooperados, ${r.totalTokensReduzidos} tokens reduzidos`,
          );
        }
      } catch (error) {
        this.logger.error(
          `[oxidacao] erro ${coop.nome}: ${error instanceof Error ? error.message : 'erro desconhecido'}`,
        );
      }
    }

    this.logger.log(
      `[oxidacao] Mensal concluida. Total ${totalCooperadosAfetadosGlobal} cooperados afetados, ${totalOxidadoGlobal} tokens reduzidos.`,
    );
  }

  // ════════════════════════════════════════════════════════════════════
  //  Sprint C Hardening (17/06/2026) — D-novo-RECONCILIACAO-CONTABIL-CRON
  //
  //  Cron */15: re-tenta `tokenContabilService.lancarResgatePix` em
  //  recibos `PAGO_CREDITO_PENDENTE` cuja `reconciliacaoProximaEm` já
  //  passou. Fecha a janela do M41/D2 onde o caminho contábil pós-PIX-
  //  out podia ficar pendente indefinidamente.
  //
  //  IDEMPOTÊNCIA: `lancarResgatePix` tem `findFirst` guard interno por
  //  `descricao startsWith '[Token] Resgate PIX — Resgate ${numeroRecibo}'`.
  //  `numeroRecibo` é único, então retry NUNCA duplica LancamentoCaixa.
  //
  //  MULTI-TENANT: cron varre TODOS os tenants (sem JWT) — é cron de
  //  cura, não rota autenticada. Writes usam `updateMany` com
  //  `cooperativaId` e `id` no `where` (defense in depth padrão
  //  rules/multi-tenant.md mesmo em cron platform-scoped).
  //
  //  SEMPRE LIGADO em prod (sem gate `RECONCILIACAO_PRODUCAO_LIBERADO`):
  //  é cron de cura passivo — só age sobre recibos em estado degradado
  //  e nunca causa side effect novo (idempotente). Decisão Luciano 17/06.
  //
  //  DESISTIDO após `MAX_TENTATIVAS` falhas: dispara AuditLog (record
  //  forense) + evento `cooper-token-resgate.reconciliacao-desistido`
  //  (alerta admin no painel). Cron deixa de tentar até admin
  //  resetar manualmente.
  // ════════════════════════════════════════════════════════════════════
  @Cron('*/15 * * * *')
  @AsPlatform()
  async reconciliarContabilPendentes() {
    if (!this.tokenContabilService) {
      // Specs antigas instanciam sem injetar — pula silenciosamente em
      // teste. P3 review multitenant Sprint C (17/06): em PROD, se o
      // módulo não wireou TokenContabilService por bug de config, log
      // de warning explícito pra investigação operacional.
      if (process.env.NODE_ENV === 'production') {
        this.logger.warn(
          '[reconciliacao] TokenContabilService NÃO injetado em PROD — cron desativado. Verificar wiring de CooperTokenModule.',
        );
      }
      return;
    }
    const inicio = Date.now();
    const pendentes = await this.prisma.resgateRecibo.findMany({
      where: {
        status: 'PAGO_CREDITO_PENDENTE',
        reconciliacaoDesistido: false,
        reconciliacaoProximaEm: { lte: new Date() },
      },
      select: {
        id: true,
        cooperativaId: true,
        cooperadoEstabelecimentoId: true,
        numeroRecibo: true,
        valorLiquidoReais: true,
        asaasTransferId: true,
        reconciliacaoTentativas: true,
      },
      orderBy: { reconciliacaoProximaEm: 'asc' },
      take: 100,
    });

    if (pendentes.length === 0) {
      // Sem ruído de log em cada execução vazia.
      return;
    }

    this.logger.log(
      `[reconciliacao] Iniciando ciclo — ${pendentes.length} recibo(s) elegível(eis) pra retry contábil`,
    );

    let sucesso = 0;
    let falha = 0;
    let desistido = 0;

    for (const recibo of pendentes) {
      try {
        // P1 reviewer financeiro M42: referenciaId/Tabela obrigatórios
        // pra idempotência (Sprint C P1 fix: agora via @@unique
        // origemTipo/origemId no LancamentoCaixa).
        // P3 review security Sprint C (17/06): asaasTransferId truncado
        // em observacoes (lançamento contábil pode aparecer em relatórios
        // exportáveis — reduz superfície de exposição mantendo
        // rastreabilidade operacional).
        const asaasShort = (recibo.asaasTransferId ?? '?').slice(0, 8);
        await this.tokenContabilService.lancarResgatePix({
          cooperativaId: recibo.cooperativaId,
          cooperadoId: recibo.cooperadoEstabelecimentoId,
          valor: Math.round(Number(recibo.valorLiquidoReais) * 100) / 100,
          descricao: `Resgate ${recibo.numeroRecibo}`,
          observacoes: `Recibo ${recibo.numeroRecibo} — liquidação voucher CooperToken (PIX-out Asaas ${asaasShort}…) — reconciliação cron tentativa ${recibo.reconciliacaoTentativas + 1}`,
          referenciaId: recibo.id,
          referenciaTabela: 'ResgateRecibo',
        });

        // Sucesso → status volta PAGO_RECIBO_EMITIDO + zera estado retry.
        // Multi-tenant: updateMany com cooperativaId+id+status no where.
        const r = await this.prisma.resgateRecibo.updateMany({
          where: {
            id: recibo.id,
            cooperativaId: recibo.cooperativaId,
            status: 'PAGO_CREDITO_PENDENTE',
          },
          data: {
            status: 'PAGO_RECIBO_EMITIDO',
            motivoFalha: null,
            reconciliacaoTentativas: 0,
            reconciliacaoProximaEm: null,
            reconciliacaoUltimaEm: new Date(),
            reconciliacaoDesistido: false,
          },
        });
        if (r.count > 0) {
          sucesso++;
          this.logger.log(
            `[reconciliacao] [OK] recibo=${recibo.numeroRecibo} reconciliado após ${recibo.reconciliacaoTentativas + 1} tentativa(s) — status PAGO_RECIBO_EMITIDO`,
          );
        } else {
          // P3 review security Sprint C (17/06): updateMany count=0 após
          // lancarResgatePix OK indica race (outra instância PM2/processo
          // mudou status entre findMany e updateMany). Idempotente mas
          // merece visibilidade pra diagnóstico forense.
          this.logger.warn(
            `[reconciliacao] [WARN] recibo=${recibo.numeroRecibo} — lancarResgatePix OK mas updateMany count=0 (race ou estado mudou entre findMany e updateMany)`,
          );
        }
      } catch (err) {
        falha++;
        const msg = err instanceof Error ? err.message : 'erro desconhecido';
        const novaTentativa = recibo.reconciliacaoTentativas + 1;
        const atingiuMax = novaTentativa >= CooperTokenJob.MAX_TENTATIVAS;

        if (atingiuMax) {
          desistido++;
          // Desistido: AuditLog forte + evento. Cron deixa de tentar
          // até admin resetar reconciliacaoDesistido manualmente.
          await this.prisma.resgateRecibo.updateMany({
            where: {
              id: recibo.id,
              cooperativaId: recibo.cooperativaId,
              status: 'PAGO_CREDITO_PENDENTE',
            },
            data: {
              reconciliacaoTentativas: novaTentativa,
              reconciliacaoUltimaEm: new Date(),
              reconciliacaoDesistido: true,
              motivoFalha: `Reconciliação desistida após ${novaTentativa} tentativas. Último motivo: ${msg.slice(0, 300)}`,
            },
          });

          // AuditLog forense via tabela direto (cron não tem req/res
          // context pra usar o @AuditLog decorator interceptor).
          // P2 review financeiro Sprint C (17/06): valor arredondado em 2
          // casas (Math.round pra evitar drift Decimal→Number). P2 review
          // security: asaasTransferId truncado (8 chars) pra reduzir
          // superfície LGPD de logs exportáveis.
          // P3 review multitenant: comentário pro implementador futuro
          // do listener — sempre usar payload.cooperativaId, NUNCA JWT.
          const valorRounded = Math.round(Number(recibo.valorLiquidoReais) * 100) / 100;
          const asaasShort = recibo.asaasTransferId ? recibo.asaasTransferId.slice(0, 8) + '…' : null;
          try {
            await this.prisma.auditLog.create({
              data: {
                cooperativaId: recibo.cooperativaId,
                acao: 'cooper-token.reconciliacao.desistido',
                recurso: 'ResgateRecibo',
                recursoId: recibo.id,
                usuarioId: 'SYSTEM_CRON',
                usuarioPerfil: 'SYSTEM',
                metadata: {
                  numeroRecibo: recibo.numeroRecibo,
                  tentativas: novaTentativa,
                  ultimoMotivo: msg.slice(0, 500),
                  valor: valorRounded,
                  asaasTransferIdPrefix: asaasShort,
                } as any,
              },
            });
          } catch (errAudit) {
            this.logger.error(
              `[reconciliacao] AuditLog desistido falhou pra recibo=${recibo.numeroRecibo}: ${(errAudit as Error).message}`,
            );
          }

          // Evento forte: admin precisa intervir.
          // OBRIGATÓRIO ao implementar listener (D-novo-RECONCILIACAO-
          // DESISTIDO-LISTENER P2 catalogado): usar payload.cooperativaId
          // pra escopo de tenant, NUNCA req.user.cooperativaId (cron não
          // tem req).
          if (this.eventEmitter) {
            this.eventEmitter.emit('cooper-token-resgate.reconciliacao-desistido', {
              reciboId: recibo.id,
              cooperativaId: recibo.cooperativaId,
              cooperadoEstabelecimentoId: recibo.cooperadoEstabelecimentoId,
              numeroRecibo: recibo.numeroRecibo,
              tentativas: novaTentativa,
              ultimoMotivo: msg.slice(0, 400),
              valor: valorRounded,
            });
          }

          this.logger.error(
            `[reconciliacao] [ERR] DESISTIDO recibo=${recibo.numeroRecibo} após ${novaTentativa} tentativas — admin precisa intervir. Último motivo: ${msg.slice(0, 200)}`,
          );
        } else {
          // Falha mas ainda tem tentativas — agenda próxima via backoff.
          // P1 review financeiro-token (17/06): off-by-one — `novaTentativa`
          // já foi incrementada (ex: 1ª falha → novaTentativa=1). O índice
          // do backoff é zero-based: [5min, 30min, 2h, 12h, 24h]. Logo a 1ª
          // falha (novaTentativa=1) deve usar BACKOFF[0]=5min, não BACKOFF[1]=
          // 30min. Decisão Luciano aprovada: 1ª falha = 5min. Fix:
          // BACKOFF[novaTentativa - 1].
          const proximoMin = CooperTokenJob.BACKOFF_MINUTOS[novaTentativa - 1];
          const proximaEm = new Date(Date.now() + proximoMin * 60 * 1000);
          await this.prisma.resgateRecibo.updateMany({
            where: {
              id: recibo.id,
              cooperativaId: recibo.cooperativaId,
              status: 'PAGO_CREDITO_PENDENTE',
            },
            data: {
              reconciliacaoTentativas: novaTentativa,
              reconciliacaoUltimaEm: new Date(),
              reconciliacaoProximaEm: proximaEm,
              motivoFalha: `Contábil pendente (tentativa ${novaTentativa}/${CooperTokenJob.MAX_TENTATIVAS}): ${msg.slice(0, 350)}`,
            },
          });
          this.logger.warn(
            `[reconciliacao] [WARN] recibo=${recibo.numeroRecibo} tentativa ${novaTentativa}/${CooperTokenJob.MAX_TENTATIVAS} falhou — próxima em ${proximoMin}min. Motivo: ${msg.slice(0, 200)}`,
          );
        }
      }
    }

    const duracaoMs = Date.now() - inicio;
    this.logger.log(
      `[reconciliacao] Ciclo concluído em ${duracaoMs}ms — ${sucesso} sucesso, ${falha} falha, ${desistido} desistido (${pendentes.length} processado(s))`,
    );
  }

  // ════════════════════════════════════════════════════════════════════
  //  Sprint M52a Bloco D (23/06/2026) — D-novo-FAXINA-DELTA-COOPEREBR.
  //
  //  Cron diário 04:30 — varre TODOS os tenants e mede o invariante
  //  por cooperado.
  //
  //  INVARIANTE MESTRE (re-review orquestrador 23/06):
  //    saldoTotal == Σ(ledger)
  //    onde saldoTotal = saldoDisponivel + saldoPendente + saldoBloqueadoResgate
  //    e Σ(ledger) = Σ(creditos) − Σ(debitos) classificados explicitamente
  //                  por CooperTokenOperacao (switch exaustivo — sem `else`
  //                  cego que subtraía COMPRA_PARCEIRO/DOACAO_RECEBIDA).
  //
  //  Porque TOTAL e não saldoDisponivel: pendente e bloqueado SÃO passivo
  //  da coop. Versão anterior comparava só disponível e gerava falso-positivo
  //  em qualquer cooperado com pendente>0 ou bloqueado>0 (root-cause da
  //  reconciliação corrompida 23/06 que tocou AGOSTINHO/LEONARDO sem motivo).
  //
  //  Tolerância: 0.0001 (precisão Decimal(10,4)).
  //
  //  Não é cron de cura — só DIAGNÓSTICO. Detecta delta, emite alerta
  //  (AuditLog + evento) pra admin atuar manualmente via script
  //  reconciliacao-historica-faxina-d.ts (APPEND-ONLY, NUNCA tocar
  //  saldoDisponivel/Pendente/Bloqueado). Cron de cura criaria entradas sem
  //  revisão contábil — vetado.
  //
  //  Cron diário (não 30min) — invariante é lento; scan
  //  CooperTokenLedger inteiro é pesado. Diário cobre o ciclo
  //  de detecção sem custo. Trigger admin on-demand disponível.
  // ════════════════════════════════════════════════════════════════════
  @Cron('30 4 * * *')
  @AsPlatform()
  async reconciliarInvariantesSaldo(): Promise<ReconciliacaoInvarianteResultado> {
    const inicio = Date.now();
    this.logger.log('[invariante] Iniciando varredura saldoTotal × Σ ledger...');

    const tenants = await this.prisma.cooperativa.findMany({
      where: { ativo: true },
      select: { id: true, nome: true },
    });

    const tolerancia = new Prisma.Decimal('0.0001');

    const resumo: ReconciliacaoInvarianteResultado = {
      cooperativasVarridas: tenants.length,
      cooperadosAnomalos: 0,
      somaAbsDelta: 0,
      anomaliasPorTenant: [],
    };

    for (const tenant of tenants) {
      try {
        const saldos = await this.prisma.cooperTokenSaldo.findMany({
          where: { cooperativaId: tenant.id },
          select: {
            cooperadoId: true,
            saldoDisponivel: true,
            saldoPendente: true,
            saldoBloqueadoResgate: true,
          },
        });

        const cooperadosAnomalosTenant: ReconciliacaoInvarianteAnomalia[] = [];
        let somaAbsTenant = new Prisma.Decimal(0);

        for (const s of saldos) {
          // Fix re-review orquestrador 23/06: TOTAL (disponível + pendente +
          // bloqueado) — pendente/bloqueado também são passivo do cooperado.
          const saldoTotal = new Prisma.Decimal(s.saldoDisponivel)
            .plus(s.saldoPendente)
            .plus(s.saldoBloqueadoResgate);
          const somaLedger = await this.somarLedgerPorCooperado(
            s.cooperadoId,
            tenant.id,
          );
          const delta = saldoTotal.minus(somaLedger);

          if (delta.abs().lessThan(tolerancia)) continue;

          cooperadosAnomalosTenant.push({
            cooperadoId: s.cooperadoId,
            saldoDisponivel: saldoTotal.toFixed(4),
            somaLedger: somaLedger.toFixed(4),
            delta: delta.toFixed(4),
          });
          somaAbsTenant = somaAbsTenant.plus(delta.abs());
        }

        if (cooperadosAnomalosTenant.length === 0) continue;

        resumo.cooperadosAnomalos += cooperadosAnomalosTenant.length;
        resumo.somaAbsDelta += Number(somaAbsTenant);
        resumo.anomaliasPorTenant.push({
          cooperativaId: tenant.id,
          cooperativaNome: tenant.nome,
          cooperadosAnomalos: cooperadosAnomalosTenant.length,
          somaAbsDelta: somaAbsTenant.toFixed(4),
          topAnomalias: [...cooperadosAnomalosTenant]
            .sort((a, b) =>
              new Prisma.Decimal(b.delta).abs().comparedTo(new Prisma.Decimal(a.delta).abs()),
            )
            .slice(0, 5),
        });

        this.logger.warn(
          `[invariante] ${tenant.nome}: ${cooperadosAnomalosTenant.length} cooperado(s) com delta — Σ|delta|=${somaAbsTenant.toFixed(4)}`,
        );

        // AuditLog forense por tenant (cron não tem req — usar tabela direto).
        try {
          await this.prisma.auditLog.create({
            data: {
              cooperativaId: tenant.id,
              acao: 'cooper-token.invariante.delta-detectado',
              recurso: 'CooperTokenLedger',
              usuarioId: 'SYSTEM_CRON',
              usuarioPerfil: 'SYSTEM',
              metadata: {
                cooperadosAnomalos: cooperadosAnomalosTenant.length,
                somaAbsDelta: somaAbsTenant.toFixed(4),
                topAnomalias: cooperadosAnomalosTenant.slice(0, 10),
              } as any,
            },
          });
        } catch (errAudit) {
          this.logger.error(
            `[invariante] AuditLog falhou pra ${tenant.nome}: ${(errAudit as Error).message}`,
          );
        }

        if (this.eventEmitter) {
          this.eventEmitter.emit('cooper-token.invariante-quebrado', {
            cooperativaId: tenant.id,
            cooperativaNome: tenant.nome,
            cooperadosAnomalos: cooperadosAnomalosTenant.length,
            somaAbsDelta: Number(somaAbsTenant),
          });
        }
      } catch (err) {
        this.logger.error(
          `[invariante] Falha em ${tenant.nome}: ${err instanceof Error ? err.message : 'erro desconhecido'}`,
        );
      }
    }

    const duracaoMs = Date.now() - inicio;
    this.logger.log(
      `[invariante] Varredura concluída em ${duracaoMs}ms — ${resumo.cooperativasVarridas} tenants, ${resumo.cooperadosAnomalos} cooperado(s) anômalo(s), Σ|delta|=${resumo.somaAbsDelta.toFixed(4)}`,
    );
    return resumo;
  }

  // Fix re-review orquestrador 23/06 — financeiro-token P1 + code HIGH:
  // switch EXAUSTIVO sobre CooperTokenOperacao. Versão anterior tinha `else`
  // cego que subtraía cegamente operações de CRÉDITO (COMPRA_PARCEIRO,
  // DOACAO_RECEBIDA fora do `if`) — corrompia o invariante.
  //
  // Classificação canônica (sinal sobre o saldo do cooperado/parceiro):
  //   ENTRA (+): CREDITO, DOACAO_RECEBIDA, COMPRA_PARCEIRO
  //   SAI   (−): DEBITO, EXPIRACAO, DOACAO_ENVIADA, ABATIMENTO_ENERGIA,
  //               TRANSFERENCIA_PARCEIRO, RESGATE_CLUBE, OXIDACAO
  //
  // `quantidade` é SEMPRE positiva (fix estrutural M52a creditar/debitar
  // guard); a direção vem 100% da operacao via este switch.
  //
  // `cooperativaId` adicionado como parâmetro pra defense-in-depth M45
  // (não-functional necessário porque cooperadoId é globally unique CUID,
  // mas blinda refactors futuros que chamem isoladamente).
  private async somarLedgerPorCooperado(
    cooperadoId: string,
    cooperativaId: string,
  ): Promise<Prisma.Decimal> {
    const ledgers = await this.prisma.cooperTokenLedger.findMany({
      where: { cooperadoId, cooperativaId },
      select: { operacao: true, quantidade: true },
    });

    let total = new Prisma.Decimal(0);
    for (const l of ledgers) {
      const q = new Prisma.Decimal(l.quantidade).abs();
      const sinal = sinalDaOperacao(l.operacao);
      total = sinal === 1 ? total.plus(q) : total.minus(q);
    }
    return total;
  }
}

export interface ReconciliacaoInvarianteAnomalia {
  cooperadoId: string;
  saldoDisponivel: string;
  somaLedger: string;
  delta: string;
}

export interface ReconciliacaoInvarianteTenant {
  cooperativaId: string;
  cooperativaNome: string;
  cooperadosAnomalos: number;
  somaAbsDelta: string;
  topAnomalias: ReconciliacaoInvarianteAnomalia[];
}

export interface ReconciliacaoInvarianteResultado {
  cooperativasVarridas: number;
  cooperadosAnomalos: number;
  somaAbsDelta: number;
  anomaliasPorTenant: ReconciliacaoInvarianteTenant[];
}
