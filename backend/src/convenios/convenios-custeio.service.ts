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

const PLANO_CONSOLIDADOR_NOME = 'Consolidador de Custeio';

type TxOrPrisma = Prisma.TransactionClient | PrismaService;

@Injectable()
export class ConveniosCusteioService {
  private readonly logger = new Logger(ConveniosCusteioService.name);

  constructor(
    private prisma: PrismaService,
    // D-FISCAL-2.4.4b: emissão da consolidada no gateway (boleto/PIX).
    // Optional pra não quebrar specs pré-2.4.4b que instanciam direto.
    @Optional() private gatewayPagamento?: GatewayPagamentoService,
  ) {}

  /**
   * Gera (ou pula, se já existe) a cobrança consolidada de um convênio
   * `pagador=EMPRESA` numa competência mensal.
   *
   * Idempotência garantida pelo `@@unique([contratoId, mesReferencia, anoReferencia])`
   * do model Cobranca — duas chamadas pra mesmo convênio/mês resultam em 1 cobrança.
   * Validação prévia explícita pra mensagem amigável (em vez de erro Prisma cru).
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

    // 4. Carregar membros custeados ATIVOS + UCs
    const membros = await this.prisma.convenioCooperado.findMany({
      where: { convenioId: convenio.id, ativo: true },
      include: {
        cooperado: {
          select: {
            id: true,
            nomeCompleto: true,
            ucs: {
              select: {
                id: true,
                numero: true,
                distribuidora: true,
              },
            },
          },
        },
      },
    });
    // D-FISCAL-2.4.4f — early-return SEM_MEMBROS movido PRA DENTRO do branch
    // CONSUMO_REAL. ALOCACAO_FIXA é pacote fixo (kwhAlocadoMensal) — funciona
    // sem membros (convênio "pré-pago"). CONSUMO_REAL ainda exige membros
    // (sem UCs = sem faturas = sem soma).

    // D-FISCAL-2.4.4a.1 — Empresa COM_UC: incluir UCs reais do pagadorCooperado
    // no total consolidado (gap descoberto pós-2.4.4a). UC sintética
    // CONSOLIDADOR-* é excluída via filtro (não tem fatura real).
    const ucsPagadorReais = await this.prisma.uc.findMany({
      where: {
        cooperadoId: convenio.pagadorCooperadoId!,
        NOT: { numero: { startsWith: 'CONSOLIDADOR-' } },
      },
      select: { id: true, numero: true, distribuidora: true },
    });

    // 5. Calcular kWh consolidado conforme base
    const base = convenio.baseCobrancaCusteio ?? 'CONSUMO_REAL';
    let kwhTotal = 0;
    let distribuidoraUsada: string | null = null;
    const detalhamento: Array<{ origem: string; kwh: number; ucNumero?: string; distribuidora?: string }> = [];

    if (base === 'CONSUMO_REAL') {
      // D-FISCAL-2.4.4f — em CONSUMO_REAL, sem membros = nada pra somar.
      // ALOCACAO_FIXA segue normal (pacote fixo independe de membros).
      if (membros.length === 0) {
        this.logger.warn(
          `[D-FISCAL-2.4.4a] Convênio ${convenio.empresaNome} (base=CONSUMO_REAL) ` +
            `sem membros ativos — consolidada não gerada.`,
        );
        return { status: 'SEM_MEMBROS', convenioId: convenio.id };
      }

      // D-FISCAL-2.4.4a.2 — INVARIANTE: UC entra no consolidado SE E SOMENTE SE
      // o contrato ATIVO dela usa plano custeadoPorConvenio=true.
      // Elimina risco de double-bill: nenhuma UC pode estar simultaneamente
      // em cobrança individual (contrato comum) E no consolidado.
      //
      // Como o GUARD da 2.4.2 só suprime cobrança individual de UCs com plano
      // custeado, fazer o consolidado depender do MESMO critério garante que
      // a relação custeado⟺consolidado é bijetiva (uma UC ou está em um, ou
      // está em outro, nunca em ambos, nunca em nenhum).
      //
      // Membros são custeados por construção (Wizard 2.4.3 força plano custeado
      // no aceite), mas filtramos TODAS uniformemente — defesa contra:
      //   (a) membro com contrato antigo NÃO migrado pro plano custeado
      //   (b) UC do pagador NÃO cadastrada como membro (sem plano custeado)
      //   (c) regressões futuras no fluxo de cadastro
      const mesRefStr = `${String(mesReferencia).padStart(2, '0')}/${anoReferencia}`;
      const ucIdToOrigem = new Map<string, { origem: string; numero: string; distribuidora: string }>();
      // Membros
      for (const membro of membros) {
        for (const uc of membro.cooperado.ucs) {
          if (!ucIdToOrigem.has(uc.id)) {
            ucIdToOrigem.set(uc.id, {
              origem: membro.cooperado.nomeCompleto,
              numero: uc.numero,
              distribuidora: uc.distribuidora,
            });
          }
        }
      }
      // UCs reais do pagador (defensivo — só entra no total se passar pelo
      // filtro custeado abaixo, garantindo invariante anti-double-bill)
      for (const uc of ucsPagadorReais) {
        if (!ucIdToOrigem.has(uc.id)) {
          ucIdToOrigem.set(uc.id, {
            origem: `${convenio.empresaNome} (pagador COM_UC)`,
            numero: uc.numero,
            distribuidora: uc.distribuidora,
          });
        }
      }

      const ucIdsCandidatos = [...ucIdToOrigem.keys()];
      if (ucIdsCandidatos.length === 0) {
        throw new BadRequestException(
          `Convênio "${convenio.empresaNome}" tem ${membros.length} membros mas ` +
            `nenhum tem UC cadastrada (nem o pagador). Cadastre UCs antes de gerar ` +
            `consolidada CONSUMO_REAL.`,
        );
      }

      // ⭐ FILTRO INVARIANTE: só UCs cujo contrato ATIVO usa plano custeado
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

      // Auditoria UX: UCs candidatas que foram EXCLUÍDAS (não-custeadas)
      const ucIdsExcluidas = ucIdsCandidatos.filter((id) => !ucIdsCusteados.has(id));
      if (ucIdsExcluidas.length > 0) {
        const detalhesExcluidos = ucIdsExcluidas
          .map((id) => {
            const meta = ucIdToOrigem.get(id);
            return `${meta?.numero ?? id} (${meta?.origem ?? '?'})`;
          })
          .join(', ');
        this.logger.log(
          `[D-FISCAL-2.4.4a.2] Convênio "${convenio.empresaNome}": ${ucIdsExcluidas.length} ` +
            `UC(s) candidata(s) EXCLUÍDA(s) do consolidado por NÃO terem contrato ATIVO ` +
            `com plano custeado: ${detalhesExcluidos}. ` +
            `Essas UCs seguem cobrança individual normal. ` +
            `Pra consolidá-las, cadastre o cooperado dono como membro custeado do convênio ` +
            `via /dashboard/cooperados/novo (toggle "custeado por convênio").`,
        );
      }

      const ucIds = [...ucIdsCusteados];
      if (ucIds.length === 0) {
        throw new BadRequestException(
          `Convênio "${convenio.empresaNome}": nenhuma das ${ucIdsCandidatos.length} UC(s) ` +
            `candidatas (membros + pagador) tem contrato ATIVO com plano custeado. ` +
            `Cadastre os membros como custeados via Wizard antes de gerar consolidada.`,
        );
      }

      const faturas = await this.prisma.faturaProcessada.findMany({
        where: {
          ucId: { in: ucIds },
          mesReferencia: mesRefStr,
          status: 'APROVADA',
        },
        select: { ucId: true, dadosExtraidos: true, mediaKwhCalculada: true },
      });
      // Soma direto por fatura (NÃO por membro) — garante 1 fatura = 1 contribuição
      const ucIdComConsumo = new Set<string>();
      for (const fatura of faturas) {
        if (!fatura.ucId || ucIdComConsumo.has(fatura.ucId)) continue;
        const dados = (fatura.dadosExtraidos as any) ?? {};
        const consumo =
          Number(dados.consumoAtualKwh ?? 0) ||
          Number(fatura.mediaKwhCalculada ?? 0);
        if (consumo > 0) {
          ucIdComConsumo.add(fatura.ucId);
          kwhTotal += consumo;
          const meta = ucIdToOrigem.get(fatura.ucId);
          detalhamento.push({
            origem: meta?.origem ?? '(UC sem origem mapeada)',
            kwh: consumo,
            ucNumero: meta?.numero,
            distribuidora: meta?.distribuidora,
          });
        }
      }
      if (kwhTotal === 0) {
        throw new BadRequestException(
          `Convênio "${convenio.empresaNome}": nenhuma fatura APROVADA encontrada ` +
            `em ${mesRefStr} pras ${ucIds.length} UC(s) custeada(s). ` +
            `Aguarde processamento das faturas ou troque a base pra ALOCACAO_FIXA.`,
        );
      }
      // Distribuidora predominante: a que aparece mais vezes nos detalhes
      distribuidoraUsada = this.predominante(
        detalhamento.map((d) => d.distribuidora).filter(Boolean) as string[],
      );
    } else {
      // ALOCACAO_FIXA: kwhAlocadoMensal único
      if (!convenio.kwhAlocadoMensal || convenio.kwhAlocadoMensal <= 0) {
        throw new BadRequestException(
          `Convênio "${convenio.empresaNome}" usa base ALOCACAO_FIXA mas não tem ` +
            `kwhAlocadoMensal definido. Configure no cadastro.`,
        );
      }
      kwhTotal = convenio.kwhAlocadoMensal;
      // D-FISCAL-2.4.4a.1 — Distribuidora predominante dos membros + UCs reais
      // do pagador (ambos podem ser beneficiárias). Fallback: UCs do pagador
      // com distribuidora != OUTRAS (mais específico).
      const distribuidorasMembros = membros.flatMap((m) =>
        m.cooperado.ucs.map((u) => u.distribuidora),
      );
      const distribuidorasPagador = ucsPagadorReais.map((u) => u.distribuidora);
      distribuidoraUsada = this.predominante(
        [...distribuidorasMembros, ...distribuidorasPagador].filter(
          (d) => d && d !== 'OUTRAS',
        ),
      ) ?? this.predominante(
        [...distribuidorasMembros, ...distribuidorasPagador],
      );
    }

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
            valorLiquido,
            dataVencimento,
            cooperativaId: convenio.cooperativaId!,
            convenioContabilCobrancaId: convenio.id, // hook Design B (2.4.4c roteia darBaixa)
          },
        });

        const mesRef = `${String(mesReferencia).padStart(2, '0')}/${anoReferencia}`;
        const competencia = `${anoReferencia}-${String(mesReferencia).padStart(2, '0')}`;
        await tx.lancamentoCaixa.create({
          data: {
            tipo: 'RECEITA',
            descricao: `Cobrança consolidada — ${convenio.empresaNome} — ${mesRef}`,
            valor: valorLiquido,
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

    this.logger.log(
      `[D-FISCAL-2.4.4a] Consolidada CRIADA convênio "${convenio.empresaNome}" ` +
        `${String(mesReferencia).padStart(2, '0')}/${anoReferencia}: ` +
        `${membros.length} membros · ${ucsPagadorReais.length} UC(s) pagador candidatas ` +
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
   * D-FISCAL-2.4.4b — Emite a cobrança consolidada no gateway (Asaas/Banestes).
   * Best-effort, NUNCA reverte a Cobranca criada.
   *
   * Guarda dupla:
   *  1. isAmbienteReal()=false → PULA totalmente (regra contatos teste 14/05).
   *  2. cooperado sem formaPagamento configurada → PULA com log INFO.
   *  3. Erro do adapter → log warn (não joga pra cima).
   *
   * Mesma filosofia do CobrancasService.tentarEmitirNoGateway:770-803.
   */
  private async emitirNoGateway(
    cobrancaId: string,
    cooperativaId: string,
    cooperadoId: string,
    valor: number,
    dataVencimento: Date,
    descricao: string,
  ): Promise<void> {
    if (!this.gatewayPagamento) {
      this.logger.debug(
        `[D-FISCAL-2.4.4b] GatewayPagamentoService não injetado — skip emissão da consolidada ${cobrancaId}.`,
      );
      return;
    }
    if (!isAmbienteReal()) {
      this.logger.log(
        `[D-FISCAL-2.4.4b] AMBIENTE_REAL=false — skip emissão real da consolidada ${cobrancaId} ` +
          `(regra contatos teste 14/05/2026 — fail-safe). ` +
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
          `[D-FISCAL-2.4.4b] Empresa pagadora ${cooperadoId} sem formaPagamento configurada ` +
            `(ou tipo inválido: ${tipo}). Skip emissão da consolidada ${cobrancaId} — ` +
            `admin deve cobrar manualmente.`,
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
      this.logger.log(
        `[D-FISCAL-2.4.4b] Consolidada ${cobrancaId} EMITIDA no gateway ${resultado.gateway} ` +
          `(gatewayId=${resultado.gatewayId}, status=${resultado.status}).`,
      );
    } catch (err) {
      this.logger.warn(
        `[D-FISCAL-2.4.4b] Falha ao emitir consolidada ${cobrancaId} no gateway: ` +
          `${(err as Error).message}. Cobrança ficou em PENDENTE — admin pode reenviar.`,
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
      },
      orderBy: [
        { anoReferencia: 'desc' },
        { mesReferencia: 'desc' },
      ],
    });
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
