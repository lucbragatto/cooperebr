import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma.service';
import { CooperTokenService } from './cooper-token.service';
import { CooperTokenTipo } from '@prisma/client';
import { AsPlatform } from '../common/tenant-context';
// Sprint Clube P1 — Fase 1.5 Bloco 3 (10/06/2026): gate juridico da oxidacao.
import { isAmbienteReal } from '../common/safety/ambiente';


@Injectable()
export class CooperTokenJob {
  private readonly logger = new Logger(CooperTokenJob.name);

  constructor(
    private prisma: PrismaService,
    private cooperTokenService: CooperTokenService,
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
}
