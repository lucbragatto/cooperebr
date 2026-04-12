import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma.service';
import { CooperTokenService } from './cooper-token.service';
import { CooperTokenTipo } from '@prisma/client';

@Injectable()
export class CooperTokenJob {
  private readonly logger = new Logger(CooperTokenJob.name);

  constructor(
    private prisma: PrismaService,
    private cooperTokenService: CooperTokenService,
  ) {}

  /**
   * Diariamente Ã s 6h: apura excedentes de faturas processadas
   * em planos com cooperTokenAtivo=true
   */
  @Cron('0 6 * * *')
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
   * Todo dia 1Âº Ã s 2h: expira tokens vencidos
   */
  @Cron('0 2 1 * *')
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
}

