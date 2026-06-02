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
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { buscarTarifaPorDistribuidora } from '../common/tarifa-helper';

const PLANO_CONSOLIDADOR_NOME = 'Consolidador de Custeio';

type TxOrPrisma = Prisma.TransactionClient | PrismaService;

@Injectable()
export class ConveniosCusteioService {
  private readonly logger = new Logger(ConveniosCusteioService.name);

  constructor(private prisma: PrismaService) {}

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
    if (membros.length === 0) {
      this.logger.warn(
        `[D-FISCAL-2.4.4a] Convênio ${convenio.empresaNome} sem membros ativos — ` +
          `consolidada não gerada.`,
      );
      return { status: 'SEM_MEMBROS', convenioId: convenio.id };
    }

    // D-FISCAL-2.4.4a.1 — Empresa COM_UC: incluir UCs reais do pagadorCooperado
    // no total consolidado (gap descoberto pós-2.4.4a). A empresa pagadora é
    // beneficiária quando tem instalação própria, então o consumo dela ENTRA
    // no que ela paga. Dedup defensivo via Set<ucId> evita double-count se a
    // empresa também estiver em ConvenioCooperado (caminho a — ideal). UC
    // sintética CONSOLIDADOR-* é excluída via filtro (não tem fatura real).
    //
    // Empresa SEM_UC: query retorna [] → contribui 0 (correto, só pagadora).
    //
    // Caminho ideal (a): admin cadastra empresa COM_UC como ConvenioCooperado
    // membro do próprio convênio (Wizard 2.4.3 toggle "custeado") → UC dela
    // ganha plano custeado → GUARDs 2.4.2 suprimem cobrança individual da UC
    // dela → entra UMA vez no consolidado (via membership).
    //
    // Caminho defensivo (b): se admin esquecer (a), a busca abaixo inclui
    // a UC mesmo assim. ⚠️ Mas o GUARD 2.4.2 NÃO dispara (contrato sem plano
    // custeado) → cobrança individual da UC ainda é gerada → DOUBLE-BILL real.
    // Logger.warn alerta o admin.
    const ucsPagadorReais = await this.prisma.uc.findMany({
      where: {
        cooperadoId: convenio.pagadorCooperadoId!,
        NOT: { numero: { startsWith: 'CONSOLIDADOR-' } },
      },
      select: { id: true, numero: true, distribuidora: true },
    });
    const pagadorEMembro = membros.some(
      (m) => m.cooperado.id === convenio.pagadorCooperadoId,
    );
    if (ucsPagadorReais.length > 0 && !pagadorEMembro) {
      this.logger.warn(
        `[D-FISCAL-2.4.4a.1] Convênio "${convenio.empresaNome}": pagadorCooperadoId ` +
          `tem ${ucsPagadorReais.length} UC(s) real(is) mas NÃO está em ConvenioCooperado. ` +
          `UCs serão incluídas no consolidado (defesa em profundidade), MAS a cobrança ` +
          `individual delas pode ainda disparar (GUARDs 2.4.2 dependem do plano custeado ` +
          `no contrato). Recomendação: cadastrar empresa como membro custeado do próprio ` +
          `convênio via Wizard /dashboard/cooperados/novo.`,
      );
    }

    // 5. Calcular kWh consolidado conforme base
    const base = convenio.baseCobrancaCusteio ?? 'CONSUMO_REAL';
    let kwhTotal = 0;
    let distribuidoraUsada: string | null = null;
    const detalhamento: Array<{ origem: string; kwh: number; ucNumero?: string; distribuidora?: string }> = [];

    if (base === 'CONSUMO_REAL') {
      // Soma kWh real via FaturaProcessada — dedup por ucId (Set) cobre o caso
      // em que empresa pagadora também é membro (UC aparece em ambos os
      // caminhos). Mapa ucId → fonte humana pra log/auditoria.
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
      // UCs reais do pagador (caminho b defensivo)
      for (const uc of ucsPagadorReais) {
        if (!ucIdToOrigem.has(uc.id)) {
          ucIdToOrigem.set(uc.id, {
            origem: `${convenio.empresaNome} (pagador COM_UC)`,
            numero: uc.numero,
            distribuidora: uc.distribuidora,
          });
        }
      }

      const ucIds = [...ucIdToOrigem.keys()];
      if (ucIds.length === 0) {
        throw new BadRequestException(
          `Convênio "${convenio.empresaNome}" tem ${membros.length} membros mas ` +
            `nenhum tem UC cadastrada (nem o pagador). Cadastre UCs antes de gerar ` +
            `consolidada CONSUMO_REAL.`,
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
            `em ${mesRefStr} pras UCs dos ${membros.length} membros` +
            (ucsPagadorReais.length > 0 ? ` + ${ucsPagadorReais.length} UC(s) do pagador` : '') +
            `. Aguarde processamento das faturas ou troque a base pra ALOCACAO_FIXA.`,
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

    // 6. Resolver tarifa (THROW se ausente — decisão Luciano)
    const tarifaInfo = await buscarTarifaPorDistribuidora(
      this.prisma,
      distribuidoraUsada,
      { throwIfNotFound: true },
    );

    // 7. Calcular valores (Math.round monetário obrigatório)
    const descontoPct = Number(convenio.descontoKwhCusteio ?? 0);
    const valorBruto = Math.round(kwhTotal * tarifaInfo.tarifaKwh * 100) / 100;
    const valorLiquido =
      Math.round(valorBruto * (1 - descontoPct / 100) * 100) / 100;
    const valorDesconto = Math.round((valorBruto - valorLiquido) * 100) / 100;

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
        `${membros.length} membros + ${ucsPagadorReais.length} UC(s) reais do pagador ` +
        `· base=${base} · kWh=${kwhTotal} · ` +
        `tarifa=R$ ${tarifaInfo.tarifaKwh.toFixed(5)}/kWh (${distribuidoraUsada}) · ` +
        `bruto=R$ ${valorBruto.toFixed(2)} · líquido=R$ ${valorLiquido.toFixed(2)} ` +
        `(desconto ${descontoPct}%) · cobrancaId=${cobranca.id}`,
    );

    return {
      status: 'CRIADA',
      cobrancaId: cobranca.id,
      valorBruto,
      valorLiquido,
    };
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
