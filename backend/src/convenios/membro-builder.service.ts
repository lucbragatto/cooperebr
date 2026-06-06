import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { MotorPropostaService } from '../motor-proposta/motor-proposta.service';
import { ClubeVantagensService } from '../clube-vantagens/clube-vantagens.service';

/**
 * Sprint Onboarding Bloco 1 Fatia 1.3 (06/06/2026) — Aprovação CONSTRÓI o membro.
 *
 * Princípio arquitetural: NÃO alocar recurso (contrato, vaga em usina, contábil)
 * para membro NÃO-APROVADO. O membro é CONSTRUÍDO no gate final que vira
 * MEMBRO_ATIVO, não no cadastro.
 *
 * Helper ÚNICO ponto de entrada — usado por:
 *  - `ConvenioAprovacaoService.aprovarPorAdmin` (gate único MEMBRO_ATIVO)
 *  - Reconciliação manual de membros oco (Fatia 1.4 — script DRY-RUN do LEONARDO)
 *
 * Garantias:
 *  - Idempotência total (chamar 2× não duplica contrato nem progressão clube).
 *  - Degradação graciosa: motor estoura (cota=null/0, sem usina, etc.) → grava
 *    `pendenciaMotorMsg` mas NÃO propaga erro. Aprovação NUNCA falha por isso.
 *  - Anti-spoof: valida `cooperativaId` do Cooperado E do Convênio.
 *  - Tx Serializable só na parte de flip de status — motor abre sua própria tx
 *    interna (evita nested Serializable).
 */
@Injectable()
export class MembroBuilderService {
  private readonly logger = new Logger(MembroBuilderService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => MotorPropostaService))
    private readonly motorProposta: MotorPropostaService,
    private readonly clubeVantagens: ClubeVantagensService,
  ) {}

  async construirMembroCompleto(input: {
    cooperadoId: string;
    convenioId: string;
    cooperativaId: string;
  }): Promise<{
    cooperadoAtivado: boolean;
    contratoCriado: boolean;
    contratoId: string | null;
    clubeMatriculado: boolean;
    pendenciaMotor: string | null;
  }> {
    const { cooperadoId, convenioId, cooperativaId } = input;

    const cooperado = await this.prisma.cooperado.findUnique({
      where: { id: cooperadoId },
      select: {
        id: true,
        cooperativaId: true,
        status: true,
        cotaKwhMensal: true,
        consumoStashOcr: true,
        contratos: {
          where: {
            status: { in: ['PENDENTE_ATIVACAO', 'ATIVO', 'LISTA_ESPERA'] },
          },
          select: { id: true },
          take: 1,
        },
      },
    });
    if (!cooperado) {
      throw new NotFoundException(`Cooperado ${cooperadoId} não encontrado`);
    }
    if (cooperado.cooperativaId !== cooperativaId) {
      throw new ForbiddenException(
        'Cooperado não pertence à cooperativa informada (anti-spoof).',
      );
    }

    const convenio = await this.prisma.contratoConvenio.findUnique({
      where: { id: convenioId },
      select: {
        id: true,
        cooperativaId: true,
        status: true,
        pagador: true,
        empresaNome: true,
      },
    });
    if (!convenio) {
      throw new NotFoundException(`Convenio ${convenioId} não encontrado`);
    }
    if (convenio.cooperativaId !== cooperativaId) {
      throw new ForbiddenException(
        'Convênio não pertence à cooperativa informada (anti-spoof).',
      );
    }

    const cotaMensal = Number(cooperado.cotaKwhMensal ?? 0);
    const jaTemContrato = cooperado.contratos.length > 0;
    let contratoId: string | null = jaTemContrato
      ? (cooperado.contratos[0]?.id ?? null)
      : null;
    let contratoCriado = false;
    let pendenciaMotor: string | null = null;

    // ETAPA 1: flipa Cooperado.status PENDENTE → ATIVO ANTES do motor.
    // Motivo: motor.aceitar chama `marcarPendenteDocumentos` que flipa
    // PENDENTE → PENDENTE_DOCUMENTOS — se rodasse antes, atropelaria nosso
    // updateMany e o cooperado ficaria preso em PENDENTE_DOCUMENTOS.
    // Como marcarPendenteDocumentos só transiciona de PENDENTE/PENDENTE_VALIDACAO,
    // flipando pra ATIVO primeiro garante no-op idempotente lá depois.
    const statusInicial = cooperado.status;
    const flipResult = await this.prisma.cooperado.updateMany({
      where: {
        id: cooperadoId,
        status: { in: ['PENDENTE', 'PENDENTE_VALIDACAO'] },
      },
      data: { status: 'ATIVO' },
    });
    const cooperadoAtivado = flipResult.count > 0 || statusInicial === 'ATIVO';

    const deveTentarMotor =
      !jaTemContrato && cotaMensal > 0 && convenio.pagador === 'EMPRESA';

    if (deveTentarMotor) {
      try {
        const stash = (cooperado.consumoStashOcr ?? null) as
          | {
              historicoConsumo?: Array<{
                mesAno: string;
                consumoKwh: number;
                valorRS: number;
              }>;
              valorUltimaFatura?: number;
              consumoMedioKwh?: number;
            }
          | null;

        const historicoStash = Array.isArray(stash?.historicoConsumo)
          ? stash!.historicoConsumo!
          : [];
        const consumoFallback = cotaMensal;
        const valorFallback = Number(stash?.valorUltimaFatura ?? 0);
        const mesRecente =
          historicoStash.length > 0
            ? historicoStash[historicoStash.length - 1]
            : null;
        const mesReferencia =
          mesRecente?.mesAno ?? new Date().toISOString().slice(0, 7);

        // Plano CUSTEADO global (cooperativaId=null + custeadoPorConvenio=true) —
        // mesma fonte que motor.aceitar usa via custeioContext (D-FISCAL-2.4.3).
        // Passando direto aqui evita motor.aceitar chamar adicionarMembro
        // (que estoura "Cooperado já vinculado" pois o membro JÁ está MEMBRO_ATIVO
        // pós-flip da aprovação). Idempotência sobre membro preservada.
        const planoCusteado = await this.prisma.plano.findFirst({
          where: {
            custeadoPorConvenio: true,
            cooperativaId: null,
            ativo: true,
          },
          select: { id: true },
        });
        if (!planoCusteado) {
          throw new BadRequestException(
            'Plano global "Custeado por convênio" não encontrado/ativo — motor não pôde rodar.',
          );
        }
        const primPlano = planoCusteado;

        const historicoMotor =
          historicoStash.length > 0
            ? historicoStash.map((h) => ({
                mesAno: h.mesAno,
                consumoKwh: Number(h.consumoKwh),
                valorRS: Number(h.valorRS),
              }))
            : [
                {
                  mesAno: mesReferencia,
                  consumoKwh: consumoFallback,
                  valorRS: valorFallback,
                },
              ];

        let resultado = await this.motorProposta.calcular({
          cooperadoId,
          planoId: primPlano.id,
          historico: historicoMotor,
          kwhMesRecente: Number(mesRecente?.consumoKwh ?? consumoFallback),
          valorMesRecente: Number(mesRecente?.valorRS ?? valorFallback),
          mesReferencia,
        });

        if (resultado.outlierDetectado && resultado.aguardandoEscolha) {
          this.logger.log(
            `[membro-builder] Outlier detectado cooperadoId=${cooperadoId} — ` +
              `recalcula com MEDIA_12M (fallback conservador, sem UI pra escolha).`,
          );
          resultado = await this.motorProposta.calcular({
            cooperadoId,
            planoId: primPlano.id,
            historico: historicoMotor,
            kwhMesRecente: Number(mesRecente?.consumoKwh ?? consumoFallback),
            valorMesRecente: Number(mesRecente?.valorRS ?? valorFallback),
            mesReferencia,
            opcaoEscolhida: 'MEDIA_12M',
          });
        }

        if (resultado.resultado) {
          // NÃO passa `convenioCusteioId` aqui — o membro JÁ está MEMBRO_ATIVO
          // pós-flip da aprovação. Passar convenioCusteioId acionaria
          // `adicionarMembro` que bloqueia ("Cooperado já vinculado a este
          // convênio"). Usa `planoId` direto do plano custeado global pra
          // gravar contrato com `plano.custeadoPorConvenio=true`.
          const aceite = await this.motorProposta.aceitar({
            cooperadoId,
            resultado: resultado.resultado,
            mesReferencia: resultado.resultado.mesReferencia,
            planoId: primPlano.id,
          });
          contratoId = aceite.contrato?.id ?? null;
          contratoCriado = !!contratoId;
        } else {
          pendenciaMotor =
            'Motor não retornou resultado calculável (sem outlier nem resultado).';
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'erro desconhecido';
        pendenciaMotor = msg.slice(0, 500);
        this.logger.warn(
          `[membro-builder] Motor falhou cooperadoId=${cooperadoId} ` +
            `convenioId=${convenioId}: ${msg}`,
        );
      }
    } else if (!jaTemContrato && cotaMensal <= 0) {
      pendenciaMotor =
        'Cota mensal não capturada no cadastro — contrato não criado automaticamente. ' +
        'Use reconciliação manual depois (Fatia 1.4) ou reupload da fatura.';
    }

    // ETAPA 3: persiste pendência conforme resultado do motor (etapa 1 já flipou status).
    if (contratoCriado || jaTemContrato) {
      await this.prisma.cooperado.update({
        where: { id: cooperadoId },
        data: { pendenciaMotorMsg: null, pendenciaMotorEm: null },
      });
    } else if (pendenciaMotor) {
      await this.prisma.cooperado.update({
        where: { id: cooperadoId },
        data: {
          pendenciaMotorMsg: pendenciaMotor,
          pendenciaMotorEm: new Date(),
        },
      });
    }

    // ETAPA 4: matrícula clube CONFIG-DEPENDENTE (Fatia 1.4).
    // Só matricula se ConfigClubeVantagens da cooperativa existe E está ativa.
    // Sem config (cooperativa sem clube configurado) ou desativada → pula sem falha.
    // Idempotente: criarOuObterProgressao já retorna a existente se houver.
    let clubeMatriculado = false;
    let clubePulado: string | null = null;
    try {
      const config = await this.prisma.configClubeVantagens.findUnique({
        where: { cooperativaId },
        select: { ativo: true },
      });
      if (!config) {
        clubePulado = 'cooperativa sem ConfigClubeVantagens — clube não ofertado';
      } else if (!config.ativo) {
        clubePulado = 'ConfigClubeVantagens.ativo=false — clube desativado nesta cooperativa';
      } else {
        await this.clubeVantagens.criarOuObterProgressao(cooperadoId);
        clubeMatriculado = true;
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'erro desconhecido';
      this.logger.warn(
        `[membro-builder] Falha matricular clube cooperadoId=${cooperadoId}: ${msg}`,
      );
    }
    if (clubePulado) {
      this.logger.log(
        `[membro-builder] Clube pulado cooperadoId=${cooperadoId}: ${clubePulado}`,
      );
    }

    this.logger.log(
      `[membro-builder] OK cooperadoId=${cooperadoId} convenioId=${convenioId} ` +
        `ativado=${cooperadoAtivado} contratoCriado=${contratoCriado} ` +
        `contratoId=${contratoId ?? 'null'} clube=${clubeMatriculado} ` +
        `pendencia=${pendenciaMotor ? 'sim' : 'não'}`,
    );

    return {
      cooperadoAtivado,
      contratoCriado,
      contratoId,
      clubeMatriculado,
      pendenciaMotor,
    };
  }
}
