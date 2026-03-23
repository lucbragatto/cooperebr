import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma.service';
import { SungrowService } from './sungrow.service';
import { OcorrenciasService } from '../ocorrencias/ocorrencias.service';

@Injectable()
export class MonitoramentoUsinasService {
  private readonly logger = new Logger(MonitoramentoUsinasService.name);
  private ultimaVerificacao = new Map<string, Date>();

  constructor(
    private prisma: PrismaService,
    private sungrow: SungrowService,
    private ocorrencias: OcorrenciasService,
  ) {}

  @Cron('* * * * *')
  async handleCron() {
    const configs = await this.prisma.usinaMonitoramentoConfig.findMany({
      where: { habilitado: true },
      include: { usina: true },
    });

    for (const config of configs) {
      const ultima = this.ultimaVerificacao.get(config.usinaId);
      const agora = new Date();
      if (ultima) {
        const diffMin = (agora.getTime() - ultima.getTime()) / 60000;
        if (diffMin < config.intervaloMinutos) continue;
      }

      this.ultimaVerificacao.set(config.usinaId, agora);

      try {
        await this.verificarUsina(config);
      } catch (err) {
        this.logger.error(`Erro ao verificar usina ${config.usina.nome}: ${err.message}`);
      }
    }
  }

  async verificarUsina(config: any) {
    const { usinaId } = config;

    if (!config.sungrowUsuario || !config.sungrowSenha || !config.sungrowAppKey || !config.sungrowPlantId) {
      this.logger.warn(`Usina ${config.usina.nome}: credenciais Sungrow incompletas, pulando`);
      return;
    }

    const status = await this.sungrow.getUsinaStatus({
      sungrowUsuario: config.sungrowUsuario,
      sungrowSenha: config.sungrowSenha,
      sungrowAppKey: config.sungrowAppKey,
      sungrowPlantId: config.sungrowPlantId,
    });

    const leitura = await this.prisma.usinaLeitura.create({
      data: {
        usinaId,
        statusOnline: status?.online ?? false,
        potenciaAtualKw: status?.potenciaKw ?? null,
        energiaHojeKwh: status?.energiaHojeKwh ?? null,
        energiaMesKwh: status?.energiaMesKwh ?? null,
        energiaTotalKwh: status?.energiaTotalKwh ?? null,
        rawData: status?.rawData ?? null,
        erro: status ? null : 'Falha ao obter dados da Sungrow',
      },
    });

    const potenciaKwp = Number(config.usina.potenciaKwp) || 0;
    const potenciaMinKw = (potenciaKwp * config.potenciaMinimaPct) / 100;
    const temProblema = !status || !status.online || (status.potenciaKw !== null && status.potenciaKw < potenciaMinKw);

    if (temProblema) {
      await this.tratarProblema(config, leitura);
    } else {
      await this.resolverAlertas(usinaId);
    }

    this.logger.log(
      `Usina ${config.usina.nome}: online=${status?.online ?? false}, potência=${status?.potenciaKw ?? 0}kW`,
    );
  }

  private async tratarProblema(config: any, leitura: any) {
    const alertaExistente = await this.prisma.usinaAlerta.findFirst({
      where: {
        usinaId: config.usinaId,
        estado: { in: ['SUSPEITO', 'CONFIRMADO'] },
        resolvidoEm: null,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!alertaExistente) {
      await this.prisma.usinaAlerta.create({
        data: {
          usinaId: config.usinaId,
          estado: 'SUSPEITO',
          tipo: leitura.statusOnline ? 'BAIXA_GERACAO' : 'OFFLINE',
          descricao: leitura.statusOnline
            ? `Geração abaixo do mínimo: ${leitura.potenciaAtualKw}kW`
            : 'Usina offline - sem comunicação ou geração zero',
          primeiraLeitura: leitura.timestamp,
          cooperativaId: config.cooperativaId,
        },
      });
      this.logger.warn(`Alerta SUSPEITO criado para usina ${config.usina.nome}`);
      return;
    }

    if (alertaExistente.estado === 'SUSPEITO') {
      const diffMin =
        (new Date().getTime() - new Date(alertaExistente.primeiraLeitura).getTime()) / 60000;
      if (diffMin >= config.reCheckMinutos) {
        const alerta = await this.prisma.usinaAlerta.update({
          where: { id: alertaExistente.id },
          data: { estado: 'CONFIRMADO', confirmadoEm: new Date() },
        });
        this.logger.warn(`Alerta CONFIRMADO para usina ${config.usina.nome}`);
        await this.criarOcorrencia(alerta, config, leitura);
      }
    }
  }

  private async resolverAlertas(usinaId: string) {
    const alertas = await this.prisma.usinaAlerta.findMany({
      where: {
        usinaId,
        estado: { in: ['SUSPEITO', 'CONFIRMADO'] },
        resolvidoEm: null,
      },
    });

    for (const alerta of alertas) {
      await this.prisma.usinaAlerta.update({
        where: { id: alerta.id },
        data: { estado: 'RESOLVIDO', resolvidoEm: new Date() },
      });
    }

    if (alertas.length > 0) {
      this.logger.log(`${alertas.length} alerta(s) resolvido(s) para usina ${usinaId}`);
    }
  }

  private async criarOcorrencia(alerta: any, config: any, leitura: any) {
    const contrato = await this.prisma.contrato.findFirst({
      where: { usinaId: config.usinaId, status: 'ATIVO' },
      include: { cooperado: true },
    });

    if (!contrato) {
      this.logger.warn(`Nenhum contrato ativo para usina ${config.usina.nome}, ocorrência não criada`);
      return;
    }

    const descricao = [
      `Falha detectada na usina ${config.usina.nome}.`,
      `Tipo: ${alerta.tipo}`,
      `Status online: ${leitura.statusOnline ? 'Sim' : 'Não'}`,
      `Potência atual: ${leitura.potenciaAtualKw ?? 'N/A'} kW`,
      `Energia hoje: ${leitura.energiaHojeKwh ?? 'N/A'} kWh`,
      `Primeira detecção: ${new Date(alerta.primeiraLeitura).toLocaleString('pt-BR')}`,
      `Confirmado em: ${new Date(alerta.confirmadoEm).toLocaleString('pt-BR')}`,
    ].join('\n');

    const ocorrencia = await this.ocorrencias.create({
      cooperadoId: contrato.cooperadoId,
      tipo: 'FALHA_USINA',
      descricao,
      prioridade: config.prioridadeAlerta as any,
    });

    if (config.prestadorPadraoId) {
      await this.prisma.ocorrencia.update({
        where: { id: ocorrencia.id },
        data: { prestadorId: config.prestadorPadraoId },
      });
    }

    await this.prisma.usinaAlerta.update({
      where: { id: alerta.id },
      data: { ocorrenciaId: ocorrencia.id },
    });

    this.logger.log(`Ocorrência ${ocorrencia.id} criada para alerta ${alerta.id}`);
  }

  async getStatusAtual() {
    const configs = await this.prisma.usinaMonitoramentoConfig.findMany({
      where: { habilitado: true },
      include: { usina: true },
    });

    const resultado = [];
    for (const config of configs) {
      const ultimaLeitura = await this.prisma.usinaLeitura.findFirst({
        where: { usinaId: config.usinaId },
        orderBy: { timestamp: 'desc' },
      });

      const alertaAtivo = await this.prisma.usinaAlerta.findFirst({
        where: {
          usinaId: config.usinaId,
          resolvidoEm: null,
        },
        orderBy: { createdAt: 'desc' },
      });

      resultado.push({
        usinaId: config.usinaId,
        usinaNome: config.usina.nome,
        ultimaLeitura,
        alertaAtivo,
      });
    }

    return resultado;
  }

  async getHistorico(usinaId: string, horas: number) {
    const desde = new Date(Date.now() - horas * 3600 * 1000);
    return this.prisma.usinaLeitura.findMany({
      where: { usinaId, timestamp: { gte: desde } },
      orderBy: { timestamp: 'desc' },
    });
  }

  async getAlertas(usinaId: string) {
    return this.prisma.usinaAlerta.findMany({
      where: { usinaId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getConfig(usinaId: string) {
    return this.prisma.usinaMonitoramentoConfig.findUnique({
      where: { usinaId },
    });
  }

  async createConfig(usinaId: string, data: any) {
    return this.prisma.usinaMonitoramentoConfig.create({
      data: { usinaId, ...data },
    });
  }

  async updateConfig(usinaId: string, data: any) {
    return this.prisma.usinaMonitoramentoConfig.update({
      where: { usinaId },
      data,
    });
  }

  async verificarAgora(usinaId: string) {
    const config = await this.prisma.usinaMonitoramentoConfig.findUnique({
      where: { usinaId },
      include: { usina: true },
    });

    if (!config) {
      throw new Error('Configuração de monitoramento não encontrada');
    }

    await this.verificarUsina(config);
    return { message: 'Verificação executada' };
  }
}
