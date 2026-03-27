import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma.service';
import { WhatsappCicloVidaService } from '../whatsapp/whatsapp-ciclo-vida.service';

@Injectable()
export class ClubeVantagensJob {
  private readonly logger = new Logger(ClubeVantagensJob.name);

  constructor(
    private prisma: PrismaService,
    private whatsappCicloVida: WhatsappCicloVidaService,
  ) {}

  @Cron('0 9 1 * *') // Dia 1 de cada mês às 9h
  async enviarResumosMensais() {
    this.logger.log('Iniciando envio de resumos mensais do Clube de Vantagens...');

    const progressoes = await this.prisma.progressaoClube.findMany({
      where: { indicadosAtivos: { gt: 0 } },
      include: {
        cooperado: {
          select: {
            id: true,
            nomeCompleto: true,
            telefone: true,
            cooperativaId: true,
            codigoIndicacao: true,
          },
        },
      },
    });

    let enviados = 0;
    let erros = 0;

    for (const p of progressoes) {
      const cooperado = p.cooperado;
      if (!cooperado?.telefone) continue;

      try {
        // Calcular benefício do mês e total
        const mesAtual = new Date().toISOString().slice(0, 7);
        const [beneficiosMes, beneficiosTotal] = await Promise.all([
          this.prisma.beneficioIndicacao.aggregate({
            where: { cooperadoId: cooperado.id, mesReferencia: mesAtual, status: 'APLICADO' },
            _sum: { valorAplicado: true },
          }),
          this.prisma.beneficioIndicacao.aggregate({
            where: { cooperadoId: cooperado.id, status: 'APLICADO' },
            _sum: { valorAplicado: true },
          }),
        ]);

        const baseUrl = process.env.FRONTEND_URL ?? 'http://localhost:3001';
        const linkIndicacao = `${baseUrl}/entrar?ref=${cooperado.codigoIndicacao ?? ''}`;

        await this.whatsappCicloVida.notificarResumoMensal(cooperado, {
          nivelAtual: p.nivelAtual,
          indicadosAtivos: p.indicadosAtivos,
          beneficioMes: Number(beneficiosMes._sum.valorAplicado ?? 0),
          beneficioTotal: Number(beneficiosTotal._sum.valorAplicado ?? 0),
          kwhAcumulado: p.kwhIndicadoAcumulado,
          linkIndicacao,
        });

        enviados++;
      } catch (err) {
        this.logger.warn(`Falha ao enviar resumo para ${cooperado.nomeCompleto}: ${err.message}`);
        erros++;
      }

      // Delay entre envios
      await new Promise(r => setTimeout(r, 3000 + Math.random() * 2000));
    }

    this.logger.log(`Resumos mensais: ${enviados} enviados, ${erros} erros de ${progressoes.length} total`);
  }
}
