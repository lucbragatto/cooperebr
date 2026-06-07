/**
 * D-FISCAL-2.4.4a (02/06/2026) — Motor de cobrança consolidada de custeio.
 *
 * Caso 1 (empresa cooperada paga total): a empresa pagadora recebe UMA
 * cobrança consolidada por convênio por competência mensal, ancorada num
 * Contrato consolidador SEM_UC do `pagadorCooperado`. Membros custeados
 * não recebem cobrança individual (já bloqueado pelos 3 GUARDs da 2.4.2).
 *
 * Decisões aprovadas Luciano 02/06 (Fase 1 read-only D-FISCAL-2.4.4):
 *  1. UC sintética por convênio (numero = "CONSOLIDADOR-{convenioId}",
 *     distribuidora=OUTRAS) — sem schema delta. Nunca recebe fatura real.
 *  2. Plano novo "Consolidador de Custeio" (seed 2.4.4a em planos.service)
 *     — custeadoPorConvenio=FALSE (senão GUARDs 2.4.2 suprimem a consolidada).
 *  3. Tarifa ALOCACAO_FIXA: distribuidora predominante dos membros, fallback
 *     UC do pagador.
 *  4. Geração: método dedicado aqui → chama cobrancas.create passando
 *     convenioContabilCobrancaId (idempotência via @@unique do schema).
 *  5. Cron mês FECHADO anterior (não corrente). Implementação na 2.4.4b.
 *  6. Cron em convenios.job.ts (2.4.4b).
 *  7. buscarTarifaPorDistribuidora extraído pra helper compartilhado.
 *  8. Botão admin "Gerar agora" + tela admin: 2.4.4d.
 * 10. AuditLog inativo (D-30N) → Logger por enquanto.
 *  +. Tarifa ausente → throw explícito (NUNCA fallback 0.5 silencioso).
 */

import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  Optional,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { buscarTarifaPorDistribuidora } from '../common/tarifa-helper';
import { GatewayPagamentoService } from '../gateway-pagamento/gateway-pagamento.service';
import { isAmbienteReal } from '../common/safety/ambiente';
// Sprint Onboarding Bloco 0 Fatia 0.4 (06/06/2026)
import { PlanoClubeService } from '../plano-clube/plano-clube.service';

const PLANO_CONSOLIDADOR_NOME = 'Consolidador de Custeio';

type TxOrPrisma = Prisma.TransactionClient | PrismaService;

// ─── Sprint Onboarding Bloco 2 Fatia 2.1 (07/06/2026) — preview kWh read-only ───
//
// Tipos públicos exportados pro portal-empresa.controller (Fatia 2.3) e o
// service de breakdown UI (Fatia 2.4). `previewKwhConsolidado` é a FONTE
// ÚNICA DA VERDADE: tanto a UI quanto a `gerarCobrancaConsolidada` chamam
// esse método pra obter `kwhTotal` + breakdown — preview NUNCA pode divergir
// da cobrança real (se divergir, empresa contesta a fatura).

export type PreviewKwhFonte = 'fatura' | 'rateio' | 'sem-dado';

export type PreviewKwhStatus =
  | 'OK'                    // tem dados — UI renderiza tabela
  | 'SEM_MEMBROS'           // CONSUMO_REAL com 0 membros ativos
  | 'SEM_UCS_CUSTEADAS'     // CONSUMO_REAL com membros mas nenhuma UC com plano custeado
  | 'SEM_FATURAS_NO_MES';   // CONSUMO_REAL com UCs custeadas mas 0 faturas APROVADAS

export interface PreviewKwhMembroDetalhe {
  cooperadoId: string;
  nome: string;
  ucs: Array<{ numero: string; distribuidora: string }>;
  kwh: number;          // 2 casas decimais
  fonte: PreviewKwhFonte;
  percentual: number;   // 0-100 com 2 casas (kwh × 100 / kwhTotal)
  semFaturaNoMes?: boolean; // true só em CONSUMO_REAL quando membro não tem fatura aprovada
  /** true quando a entrada é a empresa pagadora COM_UC (não é "funcionário" — UI pode separar). */
  isPagador?: boolean;
}

export interface PreviewKwhConsolidadoResult {
  convenioId: string;
  convenioNome: string;
  base: 'CONSUMO_REAL' | 'ALOCACAO_FIXA';
  mesReferencia: number;        // 1-12
  anoReferencia: number;
  mesRefStr: string;            // "MM/YYYY"
  status: PreviewKwhStatus;
  kwhTotal: number;             // 2 casas
  membros: PreviewKwhMembroDetalhe[];
  distribuidoraUsada: string | null;
  /** ALOCACAO_FIXA: nenhum membro tem cotaKwhMensal → rateio caiu pra igualitário (aproximado). */
  warningRateioIgualitario?: boolean;
}

@Injectable()
export class ConveniosCusteioService {
  private readonly logger = new Logger(ConveniosCusteioService.name);

  constructor(
    private prisma: PrismaService,
    // D-FISCAL-2.4.4b: emissão da consolidada no gateway (boleto/PIX).
    // Optional pra não quebrar specs pré-2.4.4b que instanciam direto.
    @Optional() private gatewayPagamento?: GatewayPagamentoService,
    // Sprint Onboarding Bloco 0 Fatia 0.4 — resolve PlanoClube vinculado
    // ao convênio pra somar mensalidade × nº membros na consolidada.
    @Optional() private planoClubeService?: PlanoClubeService,
  ) {}

  /**
   * Sprint Onboarding Bloco 2 Fatia 2.1 (07/06/2026) — preview kWh read-only.
   *
   * FONTE ÚNICA DA VERDADE do kWh consolidado do convênio numa competência.
   * Usado pelo portal-empresa (UI da Fatia 2.4) E internamente pelo
   * `gerarCobrancaConsolidada` (mesma fonte = preview e cobrança real
   * NUNCA divergem). 0 efeitos colaterais — não cria nada, só lê.
   *
   * Estados NÃO-OK (sem throw — caller decide como tratar):
   *  - SEM_MEMBROS: CONSUMO_REAL com 0 membros ativos
   *  - SEM_UCS_CUSTEADAS: membros mas nenhuma UC com plano custeadoPorConvenio=true
   *  - SEM_FATURAS_NO_MES: UCs custeadas mas 0 faturas APROVADAS no mês
   *  - ALOCACAO_FIXA sem `kwhAlocadoMensal` → THROW BadRequest (config errada — caller corrige)
   *
   * Anti-IDOR: exige `cooperativaId` no input + verifica match com o
   * convênio. Portal-empresa controller deve passar o `cooperativaId` derivado
   * do guard `@PagadorCooperadoOnly` (NUNCA do query string).
   */
  async previewKwhConsolidado(opts: {
    convenioId: string;
    mesReferencia: number;
    anoReferencia: number;
    cooperativaId: string;
  }): Promise<PreviewKwhConsolidadoResult> {
    const { convenioId, mesReferencia, anoReferencia, cooperativaId } = opts;

    if (mesReferencia < 1 || mesReferencia > 12) {
      throw new BadRequestException(`mesReferencia inválido: ${mesReferencia}`);
    }
    if (anoReferencia < 2000 || anoReferencia > 2100) {
      throw new BadRequestException(`anoReferencia inválido: ${anoReferencia}`);
    }

    // Anti-IDOR: convênio precisa pertencer ao tenant informado
    const convenio = await this.prisma.contratoConvenio.findFirst({
      where: { id: convenioId, cooperativaId },
      select: {
        id: true,
        empresaNome: true,
        status: true,
        pagador: true,
        cooperativaId: true,
        pagadorCooperadoId: true,
        baseCobrancaCusteio: true,
        kwhAlocadoMensal: true,
      },
    });
    if (!convenio) {
      throw new NotFoundException(
        `Convênio ${convenioId} não encontrado neste tenant`,
      );
    }
    if (convenio.status !== 'ATIVO') {
      throw new BadRequestException(
        `Convênio "${convenio.empresaNome}" não está ATIVO (status=${convenio.status})`,
      );
    }
    if (convenio.pagador !== 'EMPRESA') {
      throw new BadRequestException(
        `Convênio "${convenio.empresaNome}" tem pagador=${convenio.pagador}; ` +
          `preview kWh consolidado exige pagador=EMPRESA (Caso 1).`,
      );
    }

    const base = (convenio.baseCobrancaCusteio ?? 'CONSUMO_REAL') as
      | 'CONSUMO_REAL'
      | 'ALOCACAO_FIXA';
    const mesRefStr = `${String(mesReferencia).padStart(2, '0')}/${anoReferencia}`;

    // Carrega membros ativos + UCs (single source)
    const membros = await this.prisma.convenioCooperado.findMany({
      where: { convenioId, ativo: true },
      include: {
        cooperado: {
          select: {
            id: true,
            nomeCompleto: true,
            cotaKwhMensal: true,
            ucs: { select: { id: true, numero: true, distribuidora: true } },
          },
        },
      },
    });

    // UCs reais do pagador (empresa COM_UC). Entram no consolidado como
    // entrada virtual (preserva paridade com gerarCobrancaConsolidada que
    // já agregava UCs do pagador no total — fonte única exige).
    const ucsPagadorReais = await this.prisma.uc.findMany({
      where: {
        cooperadoId: convenio.pagadorCooperadoId!,
        NOT: { numero: { startsWith: 'CONSOLIDADOR-' } },
      },
      select: { id: true, numero: true, distribuidora: true },
    });
    const PAGADOR_ENTRY_ID = `__pagador__${convenio.pagadorCooperadoId}`;
    const PAGADOR_ENTRY_NOME = `${convenio.empresaNome} (pagador COM_UC)`;

    if (base === 'CONSUMO_REAL') {
      if (membros.length === 0 && ucsPagadorReais.length === 0) {
        return {
          convenioId: convenio.id,
          convenioNome: convenio.empresaNome,
          base,
          mesReferencia,
          anoReferencia,
          mesRefStr,
          status: 'SEM_MEMBROS',
          kwhTotal: 0,
          membros: [],
          distribuidoraUsada: null,
        };
      }

      // Filtro INVARIANTE (D-FISCAL-2.4.4a.2): UC entra só se tem contrato ATIVO + plano custeado.
      // Mapeia ucId → entryId (cooperadoId do membro OU PAGADOR_ENTRY_ID).
      const ucIdToEntryId = new Map<string, string>();
      const ucIdToInfo = new Map<string, { numero: string; distribuidora: string }>();
      for (const membro of membros) {
        for (const uc of membro.cooperado.ucs) {
          if (!ucIdToEntryId.has(uc.id)) {
            ucIdToEntryId.set(uc.id, membro.cooperado.id);
            ucIdToInfo.set(uc.id, { numero: uc.numero, distribuidora: uc.distribuidora });
          }
        }
      }
      for (const uc of ucsPagadorReais) {
        if (!ucIdToEntryId.has(uc.id)) {
          ucIdToEntryId.set(uc.id, PAGADOR_ENTRY_ID);
          ucIdToInfo.set(uc.id, { numero: uc.numero, distribuidora: uc.distribuidora });
        }
      }

      const buildEntriesSemDados = (
        ucIdsVisiveis: Set<string> | null,
      ): PreviewKwhMembroDetalhe[] => {
        const entries: PreviewKwhMembroDetalhe[] = membros.map((m) => ({
          cooperadoId: m.cooperado.id,
          nome: m.cooperado.nomeCompleto,
          ucs: m.cooperado.ucs
            .filter((u) => !ucIdsVisiveis || ucIdsVisiveis.has(u.id))
            .map((u) => ({ numero: u.numero, distribuidora: u.distribuidora })),
          kwh: 0,
          fonte: 'sem-dado' as const,
          percentual: 0,
          semFaturaNoMes: true,
        }));
        const ucsPagadorVisiveis = ucsPagadorReais.filter(
          (u) => !ucIdsVisiveis || ucIdsVisiveis.has(u.id),
        );
        if (ucsPagadorVisiveis.length > 0) {
          entries.push({
            cooperadoId: PAGADOR_ENTRY_ID,
            nome: PAGADOR_ENTRY_NOME,
            ucs: ucsPagadorVisiveis.map((u) => ({
              numero: u.numero,
              distribuidora: u.distribuidora,
            })),
            kwh: 0,
            fonte: 'sem-dado' as const,
            percentual: 0,
            semFaturaNoMes: true,
            isPagador: true,
          });
        }
        return entries;
      };

      const ucIdsCandidatos = [...ucIdToEntryId.keys()];
      if (ucIdsCandidatos.length === 0) {
        return {
          convenioId: convenio.id,
          convenioNome: convenio.empresaNome,
          base,
          mesReferencia,
          anoReferencia,
          mesRefStr,
          status: 'SEM_UCS_CUSTEADAS',
          kwhTotal: 0,
          membros: buildEntriesSemDados(null),
          distribuidoraUsada: null,
        };
      }

      const contratosCusteadosNasUCs = await this.prisma.contrato.findMany({
        where: {
          ucId: { in: ucIdsCandidatos },
          status: 'ATIVO',
          plano: { custeadoPorConvenio: true },
        },
        select: { ucId: true },
      });
      const ucIdsCusteados = new Set(
        contratosCusteadosNasUCs.map((c) => c.ucId).filter(Boolean) as string[],
      );

      if (ucIdsCusteados.size === 0) {
        return {
          convenioId: convenio.id,
          convenioNome: convenio.empresaNome,
          base,
          mesReferencia,
          anoReferencia,
          mesRefStr,
          status: 'SEM_UCS_CUSTEADAS',
          kwhTotal: 0,
          membros: buildEntriesSemDados(null),
          distribuidoraUsada: null,
        };
      }

      // Carrega faturas APROVADAS dessas UCs no mês
      const faturas = await this.prisma.faturaProcessada.findMany({
        where: {
          ucId: { in: [...ucIdsCusteados] },
          mesReferencia: mesRefStr,
          status: 'APROVADA',
        },
        select: { ucId: true, dadosExtraidos: true, mediaKwhCalculada: true },
      });

      // Soma kWh por entry (1 fatura por UC; dedup por Set)
      const kwhPorEntry = new Map<string, number>();
      const ucComConsumo = new Set<string>();
      const distribuidorasUsadas: string[] = [];
      for (const fatura of faturas) {
        if (!fatura.ucId || ucComConsumo.has(fatura.ucId)) continue;
        if (!ucIdsCusteados.has(fatura.ucId)) continue;
        const dados = (fatura.dadosExtraidos as any) ?? {};
        const consumo =
          Number(dados.consumoAtualKwh ?? 0) ||
          Number(fatura.mediaKwhCalculada ?? 0);
        if (consumo > 0) {
          ucComConsumo.add(fatura.ucId);
          const entryId = ucIdToEntryId.get(fatura.ucId)!;
          kwhPorEntry.set(entryId, (kwhPorEntry.get(entryId) ?? 0) + consumo);
          const info = ucIdToInfo.get(fatura.ucId);
          if (info?.distribuidora) distribuidorasUsadas.push(info.distribuidora);
        }
      }

      const kwhTotalRaw = [...kwhPorEntry.values()].reduce((acc, v) => acc + v, 0);
      const kwhTotal = Math.round(kwhTotalRaw * 100) / 100;

      if (kwhTotal === 0) {
        return {
          convenioId: convenio.id,
          convenioNome: convenio.empresaNome,
          base,
          mesReferencia,
          anoReferencia,
          mesRefStr,
          status: 'SEM_FATURAS_NO_MES',
          kwhTotal: 0,
          membros: buildEntriesSemDados(ucIdsCusteados),
          distribuidoraUsada: null,
        };
      }

      const distribuidoraUsada = this.predominante(distribuidorasUsadas);

      const membrosDetalhe: PreviewKwhMembroDetalhe[] = membros.map((m) => {
        const kwhMembro =
          Math.round((kwhPorEntry.get(m.cooperado.id) ?? 0) * 100) / 100;
        const ucsDoMembro = m.cooperado.ucs.filter((u) => ucIdsCusteados.has(u.id));
        return {
          cooperadoId: m.cooperado.id,
          nome: m.cooperado.nomeCompleto,
          ucs: ucsDoMembro.map((u) => ({
            numero: u.numero,
            distribuidora: u.distribuidora,
          })),
          kwh: kwhMembro,
          fonte: kwhMembro > 0 ? ('fatura' as const) : ('sem-dado' as const),
          percentual:
            kwhTotal > 0
              ? Math.round((kwhMembro * 100 * 100) / kwhTotal) / 100
              : 0,
          ...(kwhMembro === 0 ? { semFaturaNoMes: true } : {}),
        };
      });

      // Entrada virtual do pagador (se tem UCs custeadas com consumo)
      const ucsPagadorCusteadasComInfo = ucsPagadorReais.filter((u) =>
        ucIdsCusteados.has(u.id),
      );
      if (ucsPagadorCusteadasComInfo.length > 0) {
        const kwhPagador =
          Math.round((kwhPorEntry.get(PAGADOR_ENTRY_ID) ?? 0) * 100) / 100;
        membrosDetalhe.push({
          cooperadoId: PAGADOR_ENTRY_ID,
          nome: PAGADOR_ENTRY_NOME,
          ucs: ucsPagadorCusteadasComInfo.map((u) => ({
            numero: u.numero,
            distribuidora: u.distribuidora,
          })),
          kwh: kwhPagador,
          fonte: kwhPagador > 0 ? ('fatura' as const) : ('sem-dado' as const),
          percentual:
            kwhTotal > 0
              ? Math.round((kwhPagador * 100 * 100) / kwhTotal) / 100
              : 0,
          ...(kwhPagador === 0 ? { semFaturaNoMes: true } : {}),
          isPagador: true,
        });
      }

      return {
        convenioId: convenio.id,
        convenioNome: convenio.empresaNome,
        base,
        mesReferencia,
        anoReferencia,
        mesRefStr,
        status: 'OK',
        kwhTotal,
        membros: membrosDetalhe,
        distribuidoraUsada,
      };
    }

    // ── ALOCACAO_FIXA: pacote fixo (kwhAlocadoMensal) rateado por cotaKwhMensal ──
    if (!convenio.kwhAlocadoMensal || convenio.kwhAlocadoMensal <= 0) {
      throw new BadRequestException(
        `Convênio "${convenio.empresaNome}" usa base ALOCACAO_FIXA mas não tem ` +
          `kwhAlocadoMensal definido. Configure no cadastro.`,
      );
    }
    const kwhTotal = Math.round(convenio.kwhAlocadoMensal * 100) / 100;

    // Sem membros: pacote fixo segue, breakdown vazio (cobrança real faz o
    // mesmo — empresa "pré-pago" um pacote sem ter funcionários cadastrados).
    if (membros.length === 0) {
      const distribuidorasPagador = await this.distribuidorasPagador(
        convenio.pagadorCooperadoId!,
      );
      const distribuidoraUsada =
        this.predominante(distribuidorasPagador.filter((d) => d !== 'OUTRAS')) ??
        this.predominante(distribuidorasPagador);
      return {
        convenioId: convenio.id,
        convenioNome: convenio.empresaNome,
        base,
        mesReferencia,
        anoReferencia,
        mesRefStr,
        status: 'OK',
        kwhTotal,
        membros: [],
        distribuidoraUsada,
      };
    }

    // Rateio proporcional ao cotaKwhMensal (porte da fórmula condominios.calcularRateio
    // PROPORCIONAL_CONSUMO — vai virar helper standalone na Fatia 2.2).
    // Fallback IGUALITARIO se totalCota === 0 (nenhum membro tem cota capturada).
    const cotasPorMembro = membros.map((m) => Number(m.cooperado.cotaKwhMensal ?? 0));
    const totalCota = cotasPorMembro.reduce((acc, v) => acc + v, 0);
    const warningRateioIgualitario = totalCota === 0;
    const membrosDetalhe: PreviewKwhMembroDetalhe[] = membros.map((m, idx) => {
      const cota = cotasPorMembro[idx]!;
      const kwhAlocado = warningRateioIgualitario
        ? Math.round((kwhTotal / membros.length) * 100) / 100
        : Math.round(kwhTotal * (cota / totalCota) * 100) / 100;
      return {
        cooperadoId: m.cooperado.id,
        nome: m.cooperado.nomeCompleto,
        ucs: m.cooperado.ucs.map((u) => ({
          numero: u.numero,
          distribuidora: u.distribuidora,
        })),
        kwh: kwhAlocado,
        fonte: 'rateio' as const,
        percentual:
          kwhTotal > 0
            ? Math.round((kwhAlocado * 100 * 100) / kwhTotal) / 100
            : 0,
      };
    });

    // Distribuidora predominante: membros + UCs do pagador
    const distribuidorasMembros = membros.flatMap((m) =>
      m.cooperado.ucs.map((u) => u.distribuidora),
    );
    const distribuidorasPagador = await this.distribuidorasPagador(
      convenio.pagadorCooperadoId!,
    );
    const distribuidoraUsada =
      this.predominante(
        [...distribuidorasMembros, ...distribuidorasPagador].filter(
          (d) => d && d !== 'OUTRAS',
        ),
      ) ??
      this.predominante([...distribuidorasMembros, ...distribuidorasPagador]);

    return {
      convenioId: convenio.id,
      convenioNome: convenio.empresaNome,
      base,
      mesReferencia,
      anoReferencia,
      mesRefStr,
      status: 'OK',
      kwhTotal,
      membros: membrosDetalhe,
      distribuidoraUsada,
      ...(warningRateioIgualitario ? { warningRateioIgualitario: true } : {}),
    };
  }

  /** Helper privado — UCs reais do pagador (exclui CONSOLIDADOR-*). */
  private async distribuidorasPagador(pagadorCooperadoId: string): Promise<string[]> {
    const ucs = await this.prisma.uc.findMany({
      where: {
        cooperadoId: pagadorCooperadoId,
        NOT: { numero: { startsWith: 'CONSOLIDADOR-' } },
      },
      select: { distribuidora: true },
    });
    return ucs.map((u) => u.distribuidora).filter(Boolean) as string[];
  }

  /**
   * Gera (ou pula, se já existe) a cobrança consolidada de um convênio
   * `pagador=EMPRESA` numa competência mensal.
   *
   * Idempotência garantida pelo `@@unique([contratoId, mesReferencia, anoReferencia])`
   * do model Cobranca — duas chamadas pra mesmo convênio/mês resultam em 1 cobrança.
   * Validação prévia explícita pra mensagem amigável (em vez de erro Prisma cru).
   *
   * Fatia 2.1 (07/06/2026): kwhTotal + breakdown vêm de `previewKwhConsolidado`
   * (mesma fonte que o portal-empresa usa pra mostrar a empresa o que ela paga).
   * Preview e cobrança real NUNCA divergem por construção.
   */
  async gerarCobrancaConsolidada(opts: {
    convenioId: string;
    mesReferencia: number; // 1-12
    anoReferencia: number; // ex: 2026
    cooperativaId: string;
    dataVencimento?: Date; // default: dia 10 do próximo mês
    skipIfExists?: boolean; // default true — idempotência soft
  }): Promise<
    | { status: 'CRIADA'; cobrancaId: string; valorBruto: number; valorLiquido: number }
    | { status: 'JA_EXISTE'; cobrancaId: string }
    | { status: 'SEM_MEMBROS'; convenioId: string }
  > {
    const { convenioId, mesReferencia, anoReferencia, cooperativaId } = opts;
    const skipIfExists = opts.skipIfExists ?? true;

    if (mesReferencia < 1 || mesReferencia > 12) {
      throw new BadRequestException(`mesReferencia inválido: ${mesReferencia}`);
    }
    if (anoReferencia < 2000 || anoReferencia > 2100) {
      throw new BadRequestException(`anoReferencia inválido: ${anoReferencia}`);
    }

    // 1. Carregar convênio + validar (multi-tenant + pagador=EMPRESA + ATIVO)
    const convenio = await this.prisma.contratoConvenio.findFirst({
      where: { id: convenioId, cooperativaId },
      select: {
        id: true,
        empresaNome: true,
        status: true,
        pagador: true,
        cooperativaId: true,
        pagadorCooperadoId: true,
        baseCobrancaCusteio: true,
        kwhAlocadoMensal: true,
        descontoKwhCusteio: true,
        contratoConsolidadorId: true,
        // D-novo-CT-TARIFA-FIXA-EMPRESA (02/06/2026)
        tipoTarifaEmpresa: true,
        tarifaFixaKwhEmpresa: true,
        // Sprint Onboarding Bloco 0 Fatia 0.4 (06/06/2026)
        planoClubeId: true,
      },
    });
    if (!convenio) {
      throw new NotFoundException(
        `Convênio ${convenioId} não encontrado neste tenant`,
      );
    }
    if (convenio.status !== 'ATIVO') {
      throw new BadRequestException(
        `Convênio "${convenio.empresaNome}" não está ATIVO (status=${convenio.status})`,
      );
    }
    if (convenio.pagador !== 'EMPRESA') {
      throw new BadRequestException(
        `Convênio "${convenio.empresaNome}" tem pagador=${convenio.pagador}; ` +
          `cobrança consolidada de custeio exige pagador=EMPRESA (Caso 1).`,
      );
    }
    if (!convenio.pagadorCooperadoId) {
      throw new BadRequestException(
        `Convênio "${convenio.empresaNome}" sem pagadorCooperadoId — configure ` +
          `a empresa pagadora antes de gerar consolidada.`,
      );
    }

    // 2. Garantir o Contrato consolidador (lazy create) + plano correto
    const contratoConsolidadorId = await this.criarOuRecuperarContratoConsolidador(
      convenio.id,
      convenio.pagadorCooperadoId,
      convenio.cooperativaId!,
    );

    // 3. Idempotência soft — checa se já existe cobrança nessa competência
    const existente = await this.prisma.cobranca.findFirst({
      where: {
        contratoId: contratoConsolidadorId,
        mesReferencia,
        anoReferencia,
      },
      select: { id: true },
    });
    if (existente) {
      if (skipIfExists) {
        this.logger.log(
          `[D-FISCAL-2.4.4a] Cobrança consolidada já existe pro convênio ` +
            `${convenio.empresaNome} em ${String(mesReferencia).padStart(2, '0')}/${anoReferencia} ` +
            `(id=${existente.id}). Skip.`,
        );
        return { status: 'JA_EXISTE', cobrancaId: existente.id };
      }
      throw new BadRequestException(
        `Cobrança consolidada já existe pro convênio "${convenio.empresaNome}" ` +
          `em ${String(mesReferencia).padStart(2, '0')}/${anoReferencia} (id=${existente.id}). ` +
          `Cancele a existente antes de gerar nova.`,
      );
    }

    // Fatia 2.1 (07/06/2026) — DELEGA pro previewKwhConsolidado (fonte única).
    // Preview retorna estado + kwhTotal + breakdown. Aqui traduzimos estados
    // pros mesmos throws/returns que o fluxo legado fazia inline — comportamento
    // externo preservado pra callers (cron, UI 2.4.4d, smokes).
    const preview = await this.previewKwhConsolidado({
      convenioId: convenio.id,
      mesReferencia,
      anoReferencia,
      cooperativaId,
    });

    if (preview.status === 'SEM_MEMBROS') {
      this.logger.warn(
        `[D-FISCAL-2.4.4a] Convênio ${convenio.empresaNome} (base=CONSUMO_REAL) ` +
          `sem membros ativos — consolidada não gerada.`,
      );
      return { status: 'SEM_MEMBROS', convenioId: convenio.id };
    }
    if (preview.status === 'SEM_UCS_CUSTEADAS') {
      throw new BadRequestException(
        `Convênio "${convenio.empresaNome}": nenhuma UC custeada ` +
          `(membros + pagador) tem contrato ATIVO com plano custeado. ` +
          `Cadastre os membros como custeados via Wizard antes de gerar consolidada.`,
      );
    }
    if (preview.status === 'SEM_FATURAS_NO_MES') {
      throw new BadRequestException(
        `Convênio "${convenio.empresaNome}": nenhuma fatura APROVADA encontrada ` +
          `em ${preview.mesRefStr}. Aguarde processamento das faturas ou troque ` +
          `a base pra ALOCACAO_FIXA.`,
      );
    }

    // OK — temos kwhTotal + breakdown + distribuidora. Reconstrói shape antigo pro log.
    const kwhTotal = preview.kwhTotal;
    const distribuidoraUsada = preview.distribuidoraUsada;
    const base = preview.base;
    const detalhamento = preview.membros
      .filter((m) => m.kwh > 0)
      .map((m) => ({
        origem: m.nome,
        kwh: m.kwh,
        ucNumero: m.ucs[0]?.numero,
        distribuidora: m.ucs[0]?.distribuidora,
      }));

    // Conta membros pra cálculo do clube (apenas length é necessário).
    const membrosCount = await this.prisma.convenioCooperado.count({
      where: { convenioId: convenio.id, ativo: true },
    });

    // 6. Resolver tarifa + calcular valores (Math.round monetário obrigatório).
    // D-novo-CT-TARIFA-FIXA-EMPRESA (02/06/2026) — 2 ramos:
    //   PERCENTUAL_DESCONTO (atual, default): kWh × tarifa_concessionária × (1-desconto%).
    //   VALOR_FIXO: kWh × tarifaFixaKwhEmpresa (preço negociado, IGNORA concessionária).
    const tipoTarifa = convenio.tipoTarifaEmpresa ?? 'PERCENTUAL_DESCONTO';
    let valorBruto: number;
    let valorLiquido: number;
    let valorDesconto: number;
    let descontoPct: number;
    let tarifaUsada: number; // R$/kWh efetivo aplicado — vai pro log

    if (tipoTarifa === 'VALOR_FIXO') {
      const tarifaFixa = Number(convenio.tarifaFixaKwhEmpresa ?? 0);
      if (tarifaFixa <= 0) {
        throw new BadRequestException(
          `Convênio "${convenio.empresaNome}" tipoTarifaEmpresa=VALOR_FIXO mas ` +
            `tarifaFixaKwhEmpresa não está definida (>0). Configure no cadastro.`,
        );
      }
      // VALOR_FIXO: tarifa negociada R$/kWh — sem desconto, sem consultar concessionária.
      tarifaUsada = tarifaFixa;
      descontoPct = 0;
      valorBruto = Math.round(kwhTotal * tarifaFixa * 100) / 100;
      valorLiquido = valorBruto;
      valorDesconto = 0;
    } else {
      // PERCENTUAL_DESCONTO (atual): tarifa concessionária × (1 - desconto%).
      // THROW se tarifa ausente (decisão Luciano — NUNCA fallback 0.5 silencioso).
      const tarifaInfo = await buscarTarifaPorDistribuidora(
        this.prisma,
        distribuidoraUsada,
        { throwIfNotFound: true },
      );
      tarifaUsada = tarifaInfo.tarifaKwh;
      descontoPct = Number(convenio.descontoKwhCusteio ?? 0);
      valorBruto = Math.round(kwhTotal * tarifaInfo.tarifaKwh * 100) / 100;
      valorLiquido = Math.round(valorBruto * (1 - descontoPct / 100) * 100) / 100;
      valorDesconto = Math.round((valorBruto - valorLiquido) * 100) / 100;
    }

    // 8. Data de vencimento (default: dia 10 do próximo mês)
    const dataVencimento =
      opts.dataVencimento ??
      new Date(
        anoReferencia + (mesReferencia === 12 ? 1 : 0),
        mesReferencia % 12,
        10,
      );

    // 8.1 Sprint Onboarding Bloco 0 Fatia 0.4 (06/06/2026) — componente CLUBE.
    // Quando convenio.planoClubeId vinculado E plano.cobra=true, soma
    // membros.length × planoClube.valorMensal. Funcionário de conveniado é
    // OBRIGATÓRIO no clube — não filtramos "quem aderiu" (adesão compulsória).
    //
    // INVARIANTE: valorLiquido = energia_liquida + (membros × mensalidade).
    //   - Caso clube grátis (cobra=false), helper retorna null → soma 0.
    //   - Caso ALOCACAO_FIXA + 0 membros: helper poderia somar 0 — early-return
    //     SEM_MEMBROS já barra CONSUMO_REAL; ALOCACAO_FIXA segue normal.
    //   - resolverParaCobranca filtra ativo + tenant — defesa cross-tenant.
    let valorMensalidadeClubeConsolidada = 0;
    let planoClubeIdConsolidado: string | null = null;
    if (this.planoClubeService && (convenio as any).planoClubeId) {
      const snap = await this.planoClubeService.resolverParaCobranca(
        (convenio as any).planoClubeId,
        convenio.cooperativaId!,
      );
      if (snap && snap.cobra && snap.valorMensal > 0 && membrosCount > 0) {
        valorMensalidadeClubeConsolidada =
          Math.round(membrosCount * snap.valorMensal * 100) / 100;
        planoClubeIdConsolidado = snap.id;
      }
    }
    const valorLiquidoComClube =
      Math.round((valorLiquido + valorMensalidadeClubeConsolidada) * 100) / 100;

    // 9. Criar Cobrança + LancamentoCaixa PREVISTO em transação serializável.
    // NÃO chama cobrancas.service.create (evita ciclo de módulos
    // Convenios↔Cobrancas↔Whatsapp↔MotorProposta). A lógica reproduzida aqui
    // é o subset relevante pro caso consolidado:
    //   - idempotência (já checada acima)
    //   - multi-tenant (cooperativaId vem do convênio)
    //   - LancamentoCaixa PREVISTO (replica cobrancas.service.ts:519-532)
    //   - SKIP de CooperToken/Asaas/WA — plano consolidador é técnico, não
    //     dispara tokens nem notifica cooperado (empresa é notificada via 2.4.4d)
    const cobranca = await this.prisma.$transaction(
      async (tx) => {
        const c = await tx.cobranca.create({
          data: {
            contratoId: contratoConsolidadorId,
            mesReferencia,
            anoReferencia,
            valorBruto,
            percentualDesconto: descontoPct,
            valorDesconto,
            valorLiquido: valorLiquidoComClube,
            dataVencimento,
            cooperativaId: convenio.cooperativaId!,
            convenioContabilCobrancaId: convenio.id, // hook Design B (2.4.4c roteia darBaixa)
            // Sprint Financeiro F1 (04/06/2026) — desacopla emissão do status.
            // Cobrança nasce AGUARDANDO_EMISSAO; emitirNoGateway abaixo (FORA
            // do tx) atualiza pra EMITIDO ou incrementa tentativas. Job retry
            // varre AGUARDANDO_EMISSAO com tentativas < 5 (back-off 30min).
            statusEmissao: 'AGUARDANDO_EMISSAO',
            // Fatia 0.4 — componente clube discriminado (carve-out).
            ...(valorMensalidadeClubeConsolidada > 0
              ? { valorMensalidadeClube: valorMensalidadeClubeConsolidada }
              : {}),
            ...(planoClubeIdConsolidado
              ? { planoClubeId: planoClubeIdConsolidado }
              : {}),
          },
        });

        const mesRef = `${String(mesReferencia).padStart(2, '0')}/${anoReferencia}`;
        const competencia = `${anoReferencia}-${String(mesReferencia).padStart(2, '0')}`;
        await tx.lancamentoCaixa.create({
          data: {
            tipo: 'RECEITA',
            descricao: `Cobrança consolidada — ${convenio.empresaNome} — ${mesRef}`,
            valor: valorLiquidoComClube,
            competencia,
            status: 'PREVISTO',
            cooperativaId: convenio.cooperativaId!,
            cooperadoId: convenio.pagadorCooperadoId,
            observacoes: `Ref. cobrança ${c.id} | Convênio ${convenio.id} (consolidada custeio)`,
          },
        });

        return c;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    const entradasPagador = preview.membros.filter((m) => m.isPagador).length;
    this.logger.log(
      `[D-FISCAL-2.4.4a] Consolidada CRIADA convênio "${convenio.empresaNome}" ` +
        `${String(mesReferencia).padStart(2, '0')}/${anoReferencia}: ` +
        `${membrosCount} membros · ${entradasPagador} entrada(s) pagador COM_UC ` +
        `· ${detalhamento.length} UC(s) custeada(s) consolidada(s) · base=${base} · kWh=${kwhTotal} · ` +
        `tarifa=R$ ${tarifaUsada.toFixed(5)}/kWh (${tipoTarifa === 'VALOR_FIXO' ? 'FIXA negociada' : distribuidoraUsada}) · ` +
        `bruto=R$ ${valorBruto.toFixed(2)} · líquido=R$ ${valorLiquido.toFixed(2)} ` +
        `(desconto ${descontoPct}%) · cobrancaId=${cobranca.id}`,
    );

    // D-FISCAL-2.4.4b — Emissão no gateway (Asaas/Banestes) FORA da tx.
    // Best-effort (não bloqueia retorno se falhar — log warn).
    // Regra contatos teste (14/05/2026): só emite real em ambiente real
    // (AMBIENTE_REAL=true). Em dev (default), PULA emissão pra não disparar
    // boleto real pra empresa pagadora real. Solução fail-safe e simples —
    // sem mexer em dados do Cooperado pagador.
    await this.emitirNoGateway(
      cobranca.id,
      convenio.cooperativaId!,
      convenio.pagadorCooperadoId!,
      valorLiquido,
      dataVencimento,
      `Cobrança consolidada — ${convenio.empresaNome} — ${String(mesReferencia).padStart(2, '0')}/${anoReferencia}`,
    );

    return {
      status: 'CRIADA',
      cobrancaId: cobranca.id,
      valorBruto,
      valorLiquido,
    };
  }

  /**
   * D-FISCAL-2.4.4b + Sprint Financeiro F1 (04/06/2026) — Emite a cobrança
   * consolidada no gateway (Asaas/Banestes). Best-effort, NUNCA reverte a
   * Cobranca criada (já está commitada).
   *
   * Sprint F1 mudou:
   *  - statusEmissao agora reflete o resultado (AGUARDANDO_EMISSAO → EMITIDO
   *    ou tentativasEmissao++).
   *  - Skip propositais (gateway nulo / !isAmbienteReal / sem formaPagamento)
   *    NÃO incrementam tentativas — job filtra esses por `isAmbienteReal()`.
   *  - Falha real do adapter (HTTP / 4xx / 5xx) incrementa tentativas +
   *    grava ultimoErroEmissao + ultimaTentativaEmissaoEm. Job retry roda
   *    a cada 30min, cap 5 tentativas → FALHA_EMISSAO + notif admin.
   *
   * Visível: este método NÃO altera statusEmissao no skip por gateway nulo /
   * !isAmbienteReal — fica AGUARDANDO_EMISSAO permanentemente em dev (admin
   * sabe pelo banco que precisa ligar AMBIENTE_REAL=true).
   */
  async emitirNoGateway(
    cobrancaId: string,
    cooperativaId: string,
    cooperadoId: string,
    valor: number,
    dataVencimento: Date,
    descricao: string,
  ): Promise<void> {
    if (!this.gatewayPagamento) {
      this.logger.debug(
        `[F1] GatewayPagamentoService não injetado — skip emissão da consolidada ${cobrancaId}. ` +
          `statusEmissao mantém AGUARDANDO_EMISSAO (sem incrementar tentativas).`,
      );
      return;
    }
    if (!isAmbienteReal()) {
      this.logger.log(
        `[F1] AMBIENTE_REAL=false — skip emissão real da consolidada ${cobrancaId} ` +
          `(regra contatos teste 14/05/2026 — fail-safe). ` +
          `statusEmissao mantém AGUARDANDO_EMISSAO. ` +
          `Pra emitir em dev, configure AMBIENTE_REAL=true no .env.`,
      );
      return;
    }
    try {
      const formaPagamento = await this.prisma.formaPagamentoCooperado.findUnique({
        where: { cooperadoId },
      });
      const formasValidas = ['BOLETO', 'PIX', 'CARTAO_CREDITO', 'CREDIT_CARD'];
      const tipo = formaPagamento?.tipo;
      if (!tipo || !formasValidas.includes(tipo)) {
        this.logger.log(
          `[F1] Empresa pagadora ${cooperadoId} sem formaPagamento configurada ` +
            `(ou tipo inválido: ${tipo}). Skip emissão da consolidada ${cobrancaId}. ` +
            `statusEmissao mantém AGUARDANDO_EMISSAO (não conta tentativa — gate operacional).`,
        );
        return;
      }
      const resultado = await this.gatewayPagamento.emitirCobranca(
        cooperadoId,
        cooperativaId,
        {
          valor,
          vencimento: dataVencimento.toISOString().split('T')[0],
          descricao,
          formaPagamento: tipo as 'BOLETO' | 'PIX' | 'CREDIT_CARD',
          cobrancaId,
        },
      );
      // SUCESSO — marca EMITIDO (Sprint F1)
      await this.prisma.cobranca.update({
        where: { id: cobrancaId },
        data: {
          statusEmissao: 'EMITIDO',
          ultimoErroEmissao: null, // limpa erro anterior se foi retry
        },
      });
      this.logger.log(
        `[F1] Consolidada ${cobrancaId} EMITIDA no gateway ${resultado.gateway} ` +
          `(gatewayId=${resultado.gatewayId}, status=${resultado.status}). statusEmissao=EMITIDO.`,
      );
    } catch (err) {
      // FALHA REAL — incrementa tentativas, salva erro, mantém AGUARDANDO_EMISSAO.
      // Job retry ou endpoint admin podem retomar.
      const erroMsg = (err as Error).message?.slice(0, 500) ?? 'erro desconhecido';
      try {
        await this.prisma.cobranca.update({
          where: { id: cobrancaId },
          data: {
            tentativasEmissao: { increment: 1 },
            ultimoErroEmissao: erroMsg,
            ultimaTentativaEmissaoEm: new Date(),
            // Mantém statusEmissao=AGUARDANDO_EMISSAO. Decisão de FALHA_EMISSAO
            // fica com o job (que sabe se atingiu o cap 5).
          },
        });
      } catch (updateErr) {
        this.logger.error(
          `[F1] Falha ao gravar tentativasEmissao na cobrança ${cobrancaId}: ${(updateErr as Error).message}`,
        );
      }
      this.logger.warn(
        `[F1] Falha ao emitir consolidada ${cobrancaId} no gateway: ${erroMsg}. ` +
          `statusEmissao=AGUARDANDO_EMISSAO; tentativasEmissao++; job retry tenta de novo em 30min.`,
      );
    }
  }

  /**
   * Cria (ou recupera) o Contrato consolidador SEM_UC do convênio.
   * Lazy idempotente: chama na 1ª geração de consolidada, grava o id em
   * `ContratoConvenio.contratoConsolidadorId` (campo @unique do schema 2.4.1).
   *
   * Decisão Luciano #1 da Fase 1: UC SINTÉTICA por convênio (numero=
   * "CONSOLIDADOR-{convenioId}"). Não cria schema delta em Contrato.ucId.
   * Decisão Luciano #2: Plano "Consolidador de Custeio" (custeadoPorConvenio=false).
   */
  async criarOuRecuperarContratoConsolidador(
    convenioId: string,
    pagadorCooperadoId: string,
    cooperativaId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<string> {
    const db: TxOrPrisma = tx ?? this.prisma;

    // 1. Checa se já existe (idempotência)
    const convenio = await db.contratoConvenio.findFirst({
      where: { id: convenioId, cooperativaId },
      select: { id: true, contratoConsolidadorId: true, empresaNome: true },
    });
    if (!convenio) {
      throw new NotFoundException(
        `Convênio ${convenioId} não encontrado neste tenant`,
      );
    }
    if (convenio.contratoConsolidadorId) {
      // Valida que o contrato ainda existe + plano correto (auto-cura)
      const contrato = await db.contrato.findUnique({
        where: { id: convenio.contratoConsolidadorId },
        select: { id: true, plano: { select: { custeadoPorConvenio: true, nome: true } } },
      });
      if (contrato) {
        if (contrato.plano?.custeadoPorConvenio === true) {
          throw new BadRequestException(
            `Contrato consolidador ${contrato.id} do convênio ${convenio.empresaNome} ` +
              `está vinculado ao plano "${contrato.plano.nome}" (custeado!) — ` +
              `os GUARDs da 2.4.2 vão suprimir as cobranças consolidadas. ` +
              `Corrija pra plano "Consolidador de Custeio" antes de seguir.`,
          );
        }
        return contrato.id;
      }
      // FK orfão → recria
      this.logger.warn(
        `[D-FISCAL-2.4.4a] contratoConsolidadorId=${convenio.contratoConsolidadorId} ` +
          `do convênio ${convenio.empresaNome} aponta pra contrato inexistente. Recriando.`,
      );
    }

    // 2. Resolver plano "Consolidador de Custeio" (seed 2.4.4a)
    const plano = await db.plano.findFirst({
      where: {
        nome: PLANO_CONSOLIDADOR_NOME,
        cooperativaId: null,
        ativo: true,
      },
      select: { id: true, custeadoPorConvenio: true },
    });
    if (!plano) {
      throw new BadRequestException(
        `Plano global "${PLANO_CONSOLIDADOR_NOME}" não encontrado/ativo. ` +
          `Reinicie o backend pra disparar o seed (D-FISCAL-2.4.4a).`,
      );
    }
    if (plano.custeadoPorConvenio === true) {
      // Defesa em profundidade — seed errado seria sabotagem
      throw new BadRequestException(
        `Plano "${PLANO_CONSOLIDADOR_NOME}" está marcado como custeado. ` +
          `Corrija o seed (D-FISCAL-2.4.4a) — senão GUARDs 2.4.2 suprimem a consolidada.`,
      );
    }

    // 3. Criar UC sintética por convênio (idempotente via numero @unique)
    const ucNumero = `CONSOLIDADOR-${convenioId}`;
    let uc = await db.uc.findUnique({
      where: { numero: ucNumero },
      select: { id: true },
    });
    if (!uc) {
      uc = await db.uc.create({
        data: {
          numero: ucNumero,
          endereco: 'UC sintética — Contrato consolidador de custeio (sem UC física)',
          cidade: '—',
          estado: '—',
          distribuidora: 'OUTRAS', // enum DistribuidoraEnum default
          cooperadoId: pagadorCooperadoId,
          cooperativaId,
        },
        select: { id: true },
      });
      this.logger.log(
        `[D-FISCAL-2.4.4a] UC sintética criada: ${ucNumero} (id=${uc.id}) ` +
          `pra convênio ${convenio.empresaNome}`,
      );
    }

    // 4. Gerar número de contrato
    // Reusa pattern: prefixo CONS- pra distinguir de contratos normais
    const numero = `CONS-${convenioId.slice(-8).toUpperCase()}`;

    // 5. Criar contrato consolidador
    const contrato = await db.contrato.create({
      data: {
        numero,
        cooperadoId: pagadorCooperadoId,
        cooperativaId,
        ucId: uc.id,
        planoId: plano.id,
        dataInicio: new Date(),
        percentualDesconto: 0, // desconto é por convenio.descontoKwhCusteio, não por contrato
        kwhContrato: 0, // contrato consolidador não tem kWh fixo — varia por mês
        status: 'ATIVO',
        baseCalculoAplicado: 'KWH_CHEIO',
        tipoDescontoAplicado: 'APLICAR_SOBRE_BASE',
      },
      select: { id: true },
    });

    // 6. Vincular no ContratoConvenio
    await db.contratoConvenio.update({
      where: { id: convenioId },
      data: { contratoConsolidadorId: contrato.id },
    });

    this.logger.log(
      `[D-FISCAL-2.4.4a] Contrato consolidador criado: numero=${numero} ` +
        `(id=${contrato.id}) pra convênio ${convenio.empresaNome} ` +
        `(pagadorCooperadoId=${pagadorCooperadoId})`,
    );

    return contrato.id;
  }

  /**
   * D-FISCAL-2.4.4b — Lista cobranças consolidadas de um convênio (tenant-scoped).
   * Filtra Cobranca por convenioContabilCobrancaId. Usada pelo endpoint
   * GET /convenios/:id/cobrancas-consolidadas (alimenta a tela 2.4.4d).
   */
  async listarConsolidadasDoConvenio(convenioId: string, cooperativaId: string) {
    // Cross-check tenant primeiro (defesa em profundidade — controller já tem @TenantResource)
    const convenio = await this.prisma.contratoConvenio.findFirst({
      where: { id: convenioId, cooperativaId },
      select: { id: true, empresaNome: true },
    });
    if (!convenio) {
      throw new NotFoundException(
        `Convênio ${convenioId} não encontrado neste tenant`,
      );
    }

    return this.prisma.cobranca.findMany({
      where: {
        convenioContabilCobrancaId: convenioId,
        cooperativaId, // dupla camada multi-tenant
      },
      select: {
        id: true,
        mesReferencia: true,
        anoReferencia: true,
        valorBruto: true,
        valorDesconto: true,
        valorLiquido: true,
        valorPago: true,
        status: true,
        dataVencimento: true,
        dataPagamento: true,
        createdAt: true,
        // Sprint Financeiro F1 (04/06/2026) — estado da emissão no gateway
        // (admin precisa enxergar AGUARDANDO_EMISSAO / EMITIDO / FALHA_EMISSAO
        // + tentativas + último erro pra decidir se reemite).
        statusEmissao: true,
        tentativasEmissao: true,
        ultimoErroEmissao: true,
        ultimaTentativaEmissaoEm: true,
      },
      orderBy: [
        { anoReferencia: 'desc' },
        { mesReferencia: 'desc' },
      ],
    });
  }

  /**
   * Sprint Financeiro F1 (04/06/2026) — Admin tenta reemitir consolidada que
   * está em FALHA_EMISSAO (ou em AGUARDANDO_EMISSAO travada). Reseta o
   * contador de tentativas, volta pra AGUARDANDO_EMISSAO e chama
   * emitirNoGateway imediatamente (não espera o cron).
   *
   * Multi-tenant: valida posse via convenioId+cooperativaId.
   *
   * Pré-condições:
   *  - Cobrança deve ser consolidada (convenioContabilCobrancaId set).
   *  - Cobrança deve estar EMITIDO=false (não tem por que reemitir EMITIDO).
   */
  async reemitirCobrancaConsolidada(opts: {
    convenioId: string;
    cobrancaId: string;
    cooperativaId: string;
  }): Promise<{
    cobrancaId: string;
    statusEmissao: 'AGUARDANDO_EMISSAO' | 'EMITIDO' | 'FALHA_EMISSAO';
    tentativasEmissao: number;
    ultimoErroEmissao: string | null;
  }> {
    const { convenioId, cobrancaId, cooperativaId } = opts;

    // 1. Carrega + valida posse multi-tenant + vínculo ao convênio
    const cobranca = await this.prisma.cobranca.findFirst({
      where: {
        id: cobrancaId,
        cooperativaId,
        convenioContabilCobrancaId: convenioId,
      },
      select: {
        id: true,
        valorLiquido: true,
        dataVencimento: true,
        mesReferencia: true,
        anoReferencia: true,
        statusEmissao: true,
        convenioContabilCobranca: {
          select: {
            empresaNome: true,
            pagadorCooperadoId: true,
            cooperativaId: true,
          },
        },
      },
    });
    if (!cobranca || !cobranca.convenioContabilCobranca) {
      throw new NotFoundException(
        `Cobrança consolidada ${cobrancaId} não encontrada neste convênio/tenant`,
      );
    }
    if (cobranca.statusEmissao === 'EMITIDO') {
      throw new BadRequestException(
        `Cobrança ${cobrancaId} já está EMITIDA — nada a reemitir`,
      );
    }
    const pagadorCooperadoId = cobranca.convenioContabilCobranca.pagadorCooperadoId;
    if (!pagadorCooperadoId) {
      throw new BadRequestException(
        `Convênio ${convenioId} sem pagadorCooperadoId — configure antes de reemitir`,
      );
    }

    // 2. Reset: AGUARDANDO + tentativas=0 + limpa erro/timestamp
    await this.prisma.cobranca.update({
      where: { id: cobrancaId },
      data: {
        statusEmissao: 'AGUARDANDO_EMISSAO',
        tentativasEmissao: 0,
        ultimoErroEmissao: null,
        ultimaTentativaEmissaoEm: null,
      },
    });

    this.logger.log(
      `[F1 reemitir] Admin acionou reemissão da consolidada ${cobrancaId} ` +
        `(${cobranca.convenioContabilCobranca.empresaNome}). Reset tentativas → tentando agora.`,
    );

    // 3. Tenta emitir imediatamente (não espera cron 30min)
    const descricao = `Cobrança consolidada — ${cobranca.convenioContabilCobranca.empresaNome} — ${String(cobranca.mesReferencia).padStart(2, '0')}/${cobranca.anoReferencia}`;
    await this.emitirNoGateway(
      cobranca.id,
      cooperativaId,
      pagadorCooperadoId,
      Number(cobranca.valorLiquido),
      cobranca.dataVencimento,
      descricao,
    );

    // 4. Retorna estado atualizado
    const atual = await this.prisma.cobranca.findUnique({
      where: { id: cobrancaId },
      select: {
        statusEmissao: true,
        tentativasEmissao: true,
        ultimoErroEmissao: true,
      },
    });

    return {
      cobrancaId,
      statusEmissao: atual?.statusEmissao ?? 'AGUARDANDO_EMISSAO',
      tentativasEmissao: atual?.tentativasEmissao ?? 0,
      ultimoErroEmissao: atual?.ultimoErroEmissao ?? null,
    };
  }

  /**
   * D-FISCAL-2.4.4b — Cron varre todos os convênios EMPRESA+ATIVO e gera a
   * consolidada do MÊS FECHADO ANTERIOR pros que têm `diaEnvioRelatorio == hoje`.
   * Idempotência soft via skipIfExists=true (constraint @@unique na cobrança
   * faz idempotência hard se a soft falhar).
   *
   * Decisão Luciano #5 da Fase 1 (D-FISCAL-2.4.4): mês FECHADO anterior — não o
   * corrente — porque faturas dos membros do mês corrente ainda não chegaram.
   *
   * Roda no AsPlatform context (cron mensal por tenant — cooperativaId vem do
   * convênio). Erros por convênio não derrubam os outros.
   */
  async cronGerarConsolidadasDoMesFechado(hoje = new Date()): Promise<{
    processados: number;
    criados: number;
    jaExistem: number;
    falhas: number;
  }> {
    const diaHoje = hoje.getDate();
    // Mês FECHADO anterior: se hoje é 02/06, gera 05/2026
    const mesAnterior = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1);
    const mesReferencia = mesAnterior.getMonth() + 1;
    const anoReferencia = mesAnterior.getFullYear();

    const convenios = await this.prisma.contratoConvenio.findMany({
      where: {
        pagador: 'EMPRESA',
        status: 'ATIVO',
        diaEnvioRelatorio: diaHoje,
      },
      select: {
        id: true,
        empresaNome: true,
        cooperativaId: true,
      },
    });

    if (convenios.length === 0) {
      return { processados: 0, criados: 0, jaExistem: 0, falhas: 0 };
    }

    this.logger.log(
      `[D-FISCAL-2.4.4b cron] ${convenios.length} convênio(s) EMPRESA com ` +
        `diaEnvioRelatorio=${diaHoje} — gerando consolidadas pra ${String(mesReferencia).padStart(2, '0')}/${anoReferencia}.`,
    );

    let criados = 0;
    let jaExistem = 0;
    let falhas = 0;
    for (const conv of convenios) {
      if (!conv.cooperativaId) {
        this.logger.warn(
          `[D-FISCAL-2.4.4b cron] Convênio ${conv.id} (${conv.empresaNome}) sem ` +
            `cooperativaId — skip.`,
        );
        falhas++;
        continue;
      }
      try {
        const r = await this.gerarCobrancaConsolidada({
          convenioId: conv.id,
          mesReferencia,
          anoReferencia,
          cooperativaId: conv.cooperativaId,
          skipIfExists: true,
        });
        if (r.status === 'CRIADA') {
          criados++;
        } else if (r.status === 'JA_EXISTE') {
          jaExistem++;
        }
      } catch (err) {
        // CONSUMO_REAL pode lançar se kWh=0 (faturas dos membros não chegaram).
        // Log warn — admin pode rodar manual depois via POST.
        this.logger.warn(
          `[D-FISCAL-2.4.4b cron] Falha em convênio ${conv.id} (${conv.empresaNome}): ` +
            `${(err as Error).message}. Admin pode tentar manual via UI 2.4.4d.`,
        );
        falhas++;
      }
    }

    this.logger.log(
      `[D-FISCAL-2.4.4b cron] Concluído: processados=${convenios.length}, ` +
        `criados=${criados}, jaExistem=${jaExistem}, falhas=${falhas}.`,
    );
    return { processados: convenios.length, criados, jaExistem, falhas };
  }

  /**
   * D-FISCAL-2.4.4d — Estorna uma cobrança consolidada de custeio.
   *
   * Regras:
   *  1. Posse tenant validada (cobrança deve ter convenioContabilCobrancaId
   *     set + pertencer ao tenant).
   *  2. Gate apuração FECHADA: bloqueia se mês da competência já foi fechado
   *     contabilmente (busca direta em apuracaoMensalSegregada — evita ciclo
   *     com ApuracaoService).
   *  3. Atômico via $transaction:
   *     - Se PAGO: reverte status pra A_VENCER, zera dataPagamento/valorPago,
   *       deleta LancamentoCaixa OPERACIONAL (caixa REALIZADO com
   *       observacoes contém cobrancaId) e LancamentoCaixa FISCAL CONVENIO
   *       (origemTipo=CONVENIO + convenioContratoId match + descricao contém
   *       cobrancaId — depende do fix 2.4.4d em cobrancas.service.ts:587).
   *     - Se A_VENCER/PENDENTE/VENCIDO: marca CANCELADO + motivoCancelamento +
   *       cancela LancamentoCaixa PREVISTO operacional.
   *  4. Logger (AuditLog inativo — D-30N).
   */
  async estornarCobrancaConsolidada(opts: {
    convenioId: string;
    cobrancaId: string;
    cooperativaId: string;
    motivo?: string;
    usuarioId?: string;
  }): Promise<{ cobrancaId: string; statusAnterior: string; statusNovo: string }> {
    // 1. Carrega cobrança + valida posse tenant + vínculo ao convênio
    const cobranca = await this.prisma.cobranca.findFirst({
      where: {
        id: opts.cobrancaId,
        cooperativaId: opts.cooperativaId,
        convenioContabilCobrancaId: opts.convenioId,
      },
      select: {
        id: true,
        status: true,
        mesReferencia: true,
        anoReferencia: true,
        cooperativaId: true,
        convenioContabilCobrancaId: true,
      },
    });
    if (!cobranca) {
      throw new NotFoundException(
        `Cobrança consolidada ${opts.cobrancaId} não encontrada no convênio ` +
          `${opts.convenioId} deste tenant`,
      );
    }
    if (cobranca.status === 'CANCELADO') {
      throw new BadRequestException(
        `Cobrança consolidada ${opts.cobrancaId} já está CANCELADA`,
      );
    }

    const competencia = `${cobranca.anoReferencia}-${String(cobranca.mesReferencia).padStart(2, '0')}`;

    // 2. Gate apuração FECHADA — busca direta (evita ciclo com ApuracaoService)
    // Schema: @@unique([cooperativaId, ano, mes]) — usa findFirst pra simplicidade.
    const apuracao = await this.prisma.apuracaoMensalSegregada.findFirst({
      where: {
        cooperativaId: opts.cooperativaId,
        ano: cobranca.anoReferencia,
        mes: cobranca.mesReferencia,
      },
      select: { status: true },
    });
    if (apuracao && apuracao.status === 'FECHADA') {
      throw new BadRequestException(
        `Apuração mensal de ${competencia} está FECHADA — estorno bloqueado. ` +
          `Reabra a apuração antes de estornar a consolidada.`,
      );
    }

    const statusAnterior = cobranca.status;

    // 3. Estorno atômico
    const result = await this.prisma.$transaction(
      async (tx) => {
        if (statusAnterior === 'PAGO') {
          // Reverte pagamento — status volta pra A_VENCER + zera campos de pagamento
          await tx.cobranca.update({
            where: { id: cobranca.id },
            data: {
              status: 'A_VENCER',
              dataPagamento: null,
              valorPago: null,
              motivoCancelamento: null,
            },
          });
          // Deleta LancamentoCaixa OPERACIONAL (REALIZADO com observacoes contém cobrancaId)
          const lancsOperacionais = await tx.lancamentoCaixa.findMany({
            where: {
              cooperativaId: opts.cooperativaId,
              observacoes: { contains: `Ref. cobrança ${cobranca.id}` },
            },
            select: { id: true },
          });
          if (lancsOperacionais.length > 0) {
            await tx.lancamentoCaixa.deleteMany({
              where: { id: { in: lancsOperacionais.map((l) => l.id) } },
            });
          }
          // Deleta LancamentoCaixa FISCAL CONVENIO (origemTipo=CONVENIO +
          // convenioId=FK ContratoConvenio + descricao contém cobrancaId).
          // criarLancamentoConvenioContrato (contabilidade-tributaria.service:626)
          // grava convenioId. NÃO confundir com convenioContabilId (modelo Convenio CT).
          const lancsFiscais = await tx.lancamentoCaixa.findMany({
            where: {
              cooperativaId: opts.cooperativaId,
              origemTipo: 'CONVENIO',
              convenioId: opts.convenioId,
              descricao: { contains: cobranca.id },
            },
            select: { id: true },
          });
          if (lancsFiscais.length > 0) {
            await tx.lancamentoCaixa.deleteMany({
              where: { id: { in: lancsFiscais.map((l) => l.id) } },
            });
          }
          return {
            cobrancaId: cobranca.id,
            statusAnterior,
            statusNovo: 'A_VENCER',
            lancsOperacionaisDeleted: lancsOperacionais.length,
            lancsFiscaisDeleted: lancsFiscais.length,
          };
        }
        // A_VENCER / PENDENTE / VENCIDO → cancela
        await tx.cobranca.update({
          where: { id: cobranca.id },
          data: {
            status: 'CANCELADO',
            motivoCancelamento: opts.motivo ?? 'Estorno consolidada',
          },
        });
        // Cancela LancamentoCaixa PREVISTO operacional
        const lancsPrevistos = await tx.lancamentoCaixa.findMany({
          where: {
            cooperativaId: opts.cooperativaId,
            observacoes: { contains: `Ref. cobrança ${cobranca.id}` },
            status: 'PREVISTO',
          },
          select: { id: true },
        });
        if (lancsPrevistos.length > 0) {
          await tx.lancamentoCaixa.updateMany({
            where: { id: { in: lancsPrevistos.map((l) => l.id) } },
            data: { status: 'CANCELADO' },
          });
        }
        return {
          cobrancaId: cobranca.id,
          statusAnterior,
          statusNovo: 'CANCELADO',
          lancsPrevistosCanceled: lancsPrevistos.length,
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    this.logger.log(
      `[D-FISCAL-2.4.4d] Consolidada ${cobranca.id} ESTORNADA: ` +
        `${statusAnterior} → ${result.statusNovo} · convenio=${opts.convenioId} ` +
        `· competencia=${competencia} · usuario=${opts.usuarioId ?? '?'} ` +
        `· motivo="${opts.motivo ?? '(sem motivo)'}" · ${JSON.stringify(result)}`,
    );

    return result;
  }

  /** Retorna o elemento que aparece mais vezes na lista (ou null). */
  private predominante<T extends string>(arr: T[]): T | null {
    if (arr.length === 0) return null;
    const count = new Map<T, number>();
    for (const v of arr) count.set(v, (count.get(v) ?? 0) + 1);
    let best: T | null = null;
    let bestN = 0;
    for (const [k, n] of count) {
      if (n > bestN) {
        best = k;
        bestN = n;
      }
    }
    return best;
  }
}
