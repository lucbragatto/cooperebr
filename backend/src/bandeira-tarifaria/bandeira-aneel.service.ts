import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma.service';

const CSV_ACIONAMENTO =
  'https://dadosabertos.aneel.gov.br/dataset/7f43a020-6dc5-44b8-80b4-d97eaa94436c/resource/0591b8f6-fe54-437b-b72b-1aa2efd46e42/download/bandeira-tarifaria-acionamento.csv';

/** Mapeia nome ANEEL → enum interno */
const NOME_PARA_TIPO: Record<string, string> = {
  'Verde': 'VERDE',
  'Amarela': 'AMARELA',
  'Vermelha P1': 'VERMELHA_P1',
  'Vermelha P2': 'VERMELHA_P2',
  'Escassez Hídrica': 'VERMELHA_P2',
};

export interface BandeiraANEEL {
  tipo: string;
  valorPor100Kwh: number;
  competencia: Date;
  fonte: string;
}

@Injectable()
export class BandeiraAneelService {
  private readonly logger = new Logger(BandeiraAneelService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Busca bandeira vigente para um mês/ano no CSV de dados abertos da ANEEL.
   * O CSV usa formato: DatGeracaoConjuntoDados;DatCompetencia;NomBandeiraAcionada;VlrAdicionalBandeira
   * O valor está em R$/MWh (dividir por 10 para R$/100kWh).
   */
  async buscarBandeiraVigente(ano?: number, mes?: number): Promise<BandeiraANEEL | null> {
    const agora = new Date();
    const anoRef = ano ?? agora.getFullYear();
    const mesRef = mes ?? agora.getMonth() + 1;
    const competenciaStr = `${anoRef}-${String(mesRef).padStart(2, '0')}-01`;

    const response = await fetch(CSV_ACIONAMENTO);
    if (!response.ok) {
      this.logger.error(`Falha ao buscar CSV ANEEL: HTTP ${response.status}`);
      return null;
    }

    const texto = await response.text();
    const linhas = texto.split('\n').filter(l => l.trim());

    // Buscar linha com DatCompetencia = competenciaStr
    for (let i = linhas.length - 1; i >= 1; i--) {
      const cols = linhas[i].split(';');
      if (cols.length < 4) continue;

      const datCompetencia = cols[1]?.trim();
      if (datCompetencia !== competenciaStr) continue;

      const nomeAneel = cols[2]?.trim();
      const valorStr = cols[3]?.trim().replace(',', '.');
      const valorMwh = parseFloat(valorStr) || 0;

      const tipo = NOME_PARA_TIPO[nomeAneel] ?? 'VERDE';
      // CSV traz R$/MWh → converter para R$/100kWh (dividir por 10)
      const valorPor100Kwh = Math.round(valorMwh / 10 * 10000) / 10000;

      return {
        tipo,
        valorPor100Kwh,
        competencia: new Date(anoRef, mesRef - 1, 1),
        fonte: `Dados Abertos ANEEL - ${nomeAneel} ${competenciaStr}`,
      };
    }

    this.logger.warn(`Bandeira não encontrada para ${competenciaStr} no CSV ANEEL`);
    return null;
  }

  /**
   * Sincroniza bandeira ANEEL para uma cooperativa/mês.
   * Retorna a bandeira criada ou null se já existe ou não encontrada.
   */
  async sincronizar(cooperativaId: string, ano?: number, mes?: number) {
    const bandeira = await this.buscarBandeiraVigente(ano, mes);
    if (!bandeira) return null;

    const mesInicio = bandeira.competencia;
    const mesFim = new Date(mesInicio.getFullYear(), mesInicio.getMonth() + 1, 0); // último dia do mês

    // Verificar se já existe bandeira para este período
    const existente = await this.prisma.bandeiraTarifaria.findFirst({
      where: {
        cooperativaId,
        dataInicio: { lte: mesInicio },
        dataFim: { gte: mesInicio },
      },
    });

    if (existente) {
      this.logger.log(
        `Bandeira já existe para ${cooperativaId} em ${mesInicio.toISOString().slice(0, 7)}: ${existente.tipo}`,
      );
      return { existente: true, bandeira: existente };
    }

    const criada = await this.prisma.bandeiraTarifaria.create({
      data: {
        cooperativaId,
        tipo: bandeira.tipo,
        valorPor100Kwh: bandeira.valorPor100Kwh,
        dataInicio: mesInicio,
        dataFim: mesFim,
        observacao: bandeira.fonte,
      },
    });

    this.logger.log(
      `Bandeira ${bandeira.tipo} (R$ ${bandeira.valorPor100Kwh}/100kWh) criada para ${cooperativaId} — ${mesInicio.toISOString().slice(0, 7)}`,
    );
    return { existente: false, bandeira: criada };
  }

  /**
   * Job mensal: sincroniza bandeira ANEEL para todas as cooperativas ativas.
   * Roda no dia 1 de cada mês às 6h.
   */
  @Cron('0 6 1 * *')
  async sincronizarAutomatico() {
    this.logger.log('Sincronização automática de bandeira ANEEL iniciada');

    const cooperativas = await this.prisma.cooperativa.findMany({
      where: { ativo: true },
      select: { id: true, nome: true },
    });

    let criadas = 0;
    let existentes = 0;
    let erros = 0;

    for (const coop of cooperativas) {
      try {
        const resultado = await this.sincronizar(coop.id);
        if (!resultado) {
          erros++;
        } else if (resultado.existente) {
          existentes++;
        } else {
          criadas++;
        }
      } catch (err) {
        this.logger.error(`Erro ao sincronizar bandeira para ${coop.nome}: ${(err as Error).message}`);
        erros++;
      }
    }

    this.logger.log(
      `Sincronização ANEEL concluída: ${criadas} criada(s), ${existentes} já existente(s), ${erros} erro(s)`,
    );
  }
}
