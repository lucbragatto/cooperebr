import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { ModeloMensagemService } from './modelo-mensagem.service';
import { WhatsappSenderService } from './whatsapp-sender.service';

interface MensagemRecebida {
  telefone: string;
  tipo: 'texto' | 'imagem' | 'documento';
  corpo?: string;
  mediaBase64?: string;
  mimeType?: string;
}

interface Gatilho {
  resposta: string;
  proximoEstado: string;
}

interface FluxoEtapaComModelo {
  id: string;
  cooperativaId: string | null;
  nome: string;
  ordem: number;
  estado: string;
  modeloMensagemId: string | null;
  gatilhos: Gatilho[];
  timeoutHoras: number | null;
  modeloFollowupId: string | null;
  acaoAutomatica: string | null;
  ativo: boolean;
  modeloMensagem?: { id: string; conteudo: string; nome: string } | null;
}

@Injectable()
export class WhatsappFluxoMotorService {
  private readonly logger = new Logger(WhatsappFluxoMotorService.name);

  constructor(
    private prisma: PrismaService,
    private modeloMensagem: ModeloMensagemService,
    private sender: WhatsappSenderService,
  ) {}

  /**
   * Processar mensagem recebida usando fluxo dinâmico do banco.
   * Retorna true se processou, false se deve cair no bot hardcoded (fallback).
   */
  async processarComFluxoDinamico(
    msg: MensagemRecebida,
    conversa: { id: string; telefone: string; estado: string; cooperadoId?: string | null; dadosTemp?: any },
  ): Promise<boolean> {
    const etapa = await this.buscarEtapa(conversa.estado);
    if (!etapa) {
      this.logger.debug(`Nenhuma etapa dinâmica para estado "${conversa.estado}" — fallback hardcoded`);
      return false;
    }

    const corpo = (msg.corpo ?? '').trim();

    // Avaliar gatilhos
    const proximoEstado = this.avaliarGatilhos(corpo, etapa.gatilhos);

    if (!proximoEstado) {
      // Nenhum gatilho bateu — o motor não sabe processar, fallback
      this.logger.debug(`Nenhum gatilho bateu para estado "${conversa.estado}" com corpo "${corpo}" — fallback`);
      return false;
    }

    // Transicionar para próximo estado
    await this.prisma.conversaWhatsapp.update({
      where: { id: conversa.id },
      data: { estado: proximoEstado },
    });

    // Buscar etapa do próximo estado para enviar mensagem de entrada
    const proximaEtapa = await this.buscarEtapa(proximoEstado);
    if (proximaEtapa?.modeloMensagemId) {
      const modelo = await this.prisma.modeloMensagem.findUnique({
        where: { id: proximaEtapa.modeloMensagemId },
      });
      if (modelo) {
        const vars = this.extrairVariaveis(conversa);
        const texto = this.renderizarTemplate(modelo.conteudo, vars);
        await this.sender.enviarMensagem(msg.telefone, texto);
        await this.modeloMensagem.incrementarUso(modelo.id);
      }
    }

    // Executar ação automática da próxima etapa
    if (proximaEtapa?.acaoAutomatica) {
      await this.executarAcao(proximaEtapa.acaoAutomatica, conversa, conversa.dadosTemp);
    }

    this.logger.log(`Motor dinâmico: ${conversa.estado} → ${proximoEstado} (telefone: ${msg.telefone})`);
    return true;
  }

  /**
   * Buscar etapa ativa pelo estado atual.
   */
  private async buscarEtapa(estado: string, cooperativaId?: string): Promise<FluxoEtapaComModelo | null> {
    const where: any = { estado, ativo: true };
    if (cooperativaId) {
      where.OR = [{ cooperativaId }, { cooperativaId: null }];
    }

    const etapa = await this.prisma.fluxoEtapa.findFirst({
      where,
      orderBy: { ordem: 'asc' },
    });

    if (!etapa) return null;

    return {
      ...etapa,
      gatilhos: Array.isArray(etapa.gatilhos) ? (etapa.gatilhos as unknown as Gatilho[]) : [],
    } as FluxoEtapaComModelo;
  }

  /**
   * Avaliar gatilhos da etapa contra a mensagem recebida.
   * Retorna próximo estado ou null se nenhum gatilho bateu.
   */
  avaliarGatilhos(corpo: string, gatilhos: Gatilho[]): string | null {
    if (!gatilhos || gatilhos.length === 0) return null;

    const corpoUpper = corpo.toUpperCase().trim();

    for (const gatilho of gatilhos) {
      const resposta = (gatilho.resposta ?? '').toUpperCase().trim();
      if (resposta === '*') {
        // Wildcard — qualquer resposta de texto
        if (corpoUpper.length > 0) return gatilho.proximoEstado;
      } else if (corpoUpper === resposta) {
        return gatilho.proximoEstado;
      }
    }

    return null;
  }

  /**
   * Renderizar template substituindo variáveis {{chave}}.
   */
  renderizarTemplate(template: string, vars: Record<string, string>): string {
    let texto = template;
    for (const [chave, valor] of Object.entries(vars)) {
      texto = texto.replace(new RegExp(`\\{\\{${chave}\\}\\}`, 'g'), valor);
    }
    return texto;
  }

  /**
   * Executar ação automática.
   */
  private async executarAcao(
    acao: string,
    conversa: { id: string; telefone: string; cooperadoId?: string | null },
    dados: any,
  ): Promise<void> {
    try {
      switch (acao) {
        case 'CRIAR_LEAD':
          this.logger.log(`Ação CRIAR_LEAD para conversa ${conversa.id}`);
          // Lead é criado pelo bot hardcoded no handleConfirmacaoProposta
          break;

        case 'GERAR_PROPOSTA':
          this.logger.log(`Ação GERAR_PROPOSTA para conversa ${conversa.id}`);
          // Proposta é gerada pelo bot hardcoded no handleConfirmacaoDados
          break;

        case 'NOTIFICAR_EQUIPE':
          this.logger.log(`Ação NOTIFICAR_EQUIPE para conversa ${conversa.id} — telefone: ${conversa.telefone}`);
          // TODO: integrar com notificação (email, Slack, etc.)
          break;

        default:
          this.logger.warn(`Ação desconhecida: ${acao}`);
      }
    } catch (err) {
      this.logger.error(`Erro ao executar ação "${acao}": ${err.message}`);
    }
  }

  /**
   * Extrair variáveis da conversa para substituição em templates.
   */
  private extrairVariaveis(conversa: { dadosTemp?: any }): Record<string, string> {
    const dados = conversa.dadosTemp ?? {};
    const fmt = (v: number) =>
      v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    const resultado = dados.resultado ?? {};

    return {
      nome: String(dados.titular ?? ''),
      titular: String(dados.titular ?? ''),
      endereco: String(dados.enderecoInstalacao ?? ''),
      uc: String(dados.numeroUC ?? '—'),
      distribuidora: String(dados.distribuidora ?? ''),
      economia: resultado.economiaMensal ? `R$ ${fmt(resultado.economiaMensal)}` : '',
      economiaMensal: resultado.economiaMensal ? fmt(resultado.economiaMensal) : '',
      economiaAnual: resultado.economiaAnual ? fmt(resultado.economiaAnual) : '',
      desconto: resultado.descontoPercentual ? resultado.descontoPercentual.toFixed(0) : '',
      kwhContrato: resultado.kwhContrato ? Math.round(resultado.kwhContrato).toString() : '',
      valorFaturaMedia: dados.valorFaturaMedia ? fmt(dados.valorFaturaMedia) : '',
      valorComDesconto: dados.valorComDesconto ? fmt(dados.valorComDesconto) : '',
      mes: dados.mesReferencia ?? '',
      link: '',
      link_pagamento: '',
      percentual: '',
    };
  }
}
