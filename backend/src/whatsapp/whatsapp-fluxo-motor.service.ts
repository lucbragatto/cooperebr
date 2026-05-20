import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { ModeloMensagemService } from './modelo-mensagem.service';
import { WhatsappSenderService } from './whatsapp-sender.service';
import { getLabelMembro } from '../cooperativas/tipo-parceiro.helper';

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

interface ContextoCooperativa {
  nome: string;
  email: string | null;
  telefone: string | null;
  cidade: string | null;
  estado: string | null;
  tipoParceiro: string;
}

@Injectable()
export class WhatsappFluxoMotorService {
  private readonly logger = new Logger(WhatsappFluxoMotorService.name);

  constructor(
    private prisma: PrismaService,
    private modeloMensagem: ModeloMensagemService,
    private sender: WhatsappSenderService,
  ) {}

  async processarComFluxoDinamico(
    msg: MensagemRecebida,
    conversa: {
      id: string;
      telefone: string;
      estado: string;
      cooperadoId?: string | null;
      cooperativaId?: string | null;
      dadosTemp?: any;
    },
  ): Promise<boolean> {
    const cooperativaId = conversa.cooperativaId ?? undefined;

    const etapa = await this.buscarEtapa(conversa.estado, cooperativaId);
    if (!etapa) {
      this.logger.debug(`Nenhuma etapa dinamica para estado "${conversa.estado}" - fallback hardcoded`);
      return false;
    }

    const corpo = (msg.corpo ?? '').trim();
    const proximoEstado = this.avaliarGatilhos(corpo, etapa.gatilhos);

    if (!proximoEstado) {
      this.logger.debug(`Nenhum gatilho bateu para estado "${conversa.estado}" com corpo "${corpo}" - fallback`);
      return false;
    }

    await this.prisma.conversaWhatsapp.update({
      where: { id: conversa.id },
      data: { estado: proximoEstado },
    });

    const proximaEtapa = await this.buscarEtapa(proximoEstado, cooperativaId);
    if (proximaEtapa?.modeloMensagemId) {
      const modelo = await this.prisma.modeloMensagem.findFirst({
        where: {
          id: proximaEtapa.modeloMensagemId,
          ...this.filtroTenantSomenteLeitura(cooperativaId),
        },
      });
      if (modelo) {
        const cooperativa = await this.carregarContextoCooperativa(cooperativaId);
        const vars = this.extrairVariaveis(conversa, cooperativa);
        const texto = this.renderizarTemplate(modelo.conteudo, vars);
        await this.sender.enviarMensagem(msg.telefone, texto);
        await this.modeloMensagem.incrementarUso(modelo.id);
      }
    }

    if (proximaEtapa?.acaoAutomatica) {
      await this.executarAcao(proximaEtapa.acaoAutomatica, conversa, conversa.dadosTemp);
    }

    this.logger.log(`Motor dinamico: ${conversa.estado} -> ${proximoEstado} (telefone: ${msg.telefone}, tenant: ${cooperativaId ?? 'global'})`);
    return true;
  }

  private async buscarEtapa(estado: string, cooperativaId?: string): Promise<FluxoEtapaComModelo | null> {
    // Tenant prevalece sobre global: customizacao do parceiro sempre vence o template padrao.
    // Antes (bug D-novo-Q): findFirst com OR { tenant OR global } + orderBy ordem asc fazia o template
    // global vencer quando tinha ordem menor que a etapa do tenant. Em producao isso significou que
    // "Entrada Dinamica" do CoopereBR (ordem 28) nunca venceu "Receber fatura" global (ordem baixa).
    if (cooperativaId) {
      const etapaTenant = await this.prisma.fluxoEtapa.findFirst({
        where: { estado, ativo: true, cooperativaId },
        orderBy: { ordem: 'asc' },
      });
      if (etapaTenant) {
        return {
          ...etapaTenant,
          gatilhos: Array.isArray(etapaTenant.gatilhos)
            ? (etapaTenant.gatilhos as unknown as Gatilho[])
            : [],
        } as FluxoEtapaComModelo;
      }
    }

    const etapaGlobal = await this.prisma.fluxoEtapa.findFirst({
      where: { estado, ativo: true, cooperativaId: null },
      orderBy: { ordem: 'asc' },
    });

    if (!etapaGlobal) return null;

    return {
      ...etapaGlobal,
      gatilhos: Array.isArray(etapaGlobal.gatilhos)
        ? (etapaGlobal.gatilhos as unknown as Gatilho[])
        : [],
    } as FluxoEtapaComModelo;
  }

  private filtroTenantSomenteLeitura(cooperativaId?: string): Record<string, unknown> {
    if (cooperativaId) {
      return { OR: [{ cooperativaId }, { cooperativaId: null }] };
    }
    return { cooperativaId: null };
  }

  avaliarGatilhos(corpo: string, gatilhos: Gatilho[]): string | null {
    if (!gatilhos || gatilhos.length === 0) return null;

    const corpoUpper = corpo.toUpperCase().trim();

    for (const gatilho of gatilhos) {
      const resposta = (gatilho.resposta ?? '').toUpperCase().trim();
      if (resposta === '*') {
        if (corpoUpper.length > 0) return gatilho.proximoEstado;
      } else if (corpoUpper === resposta) {
        return gatilho.proximoEstado;
      }
    }

    return null;
  }

  renderizarTemplate(template: string, vars: Record<string, string>): string {
    let texto = template;
    for (const [chave, valor] of Object.entries(vars)) {
      texto = texto.replace(new RegExp(`\\{\\{${chave}\\}\\}`, 'g'), valor);
    }
    return texto;
  }

  private async executarAcao(
    acao: string,
    conversa: { id: string; telefone: string; cooperadoId?: string | null },
    _dados: any,
  ): Promise<void> {
    try {
      switch (acao) {
        case 'CRIAR_LEAD':
          this.logger.log(`Acao CRIAR_LEAD para conversa ${conversa.id}`);
          break;
        case 'GERAR_PROPOSTA':
          this.logger.log(`Acao GERAR_PROPOSTA para conversa ${conversa.id}`);
          break;
        case 'NOTIFICAR_EQUIPE':
          this.logger.log(`Acao NOTIFICAR_EQUIPE para conversa ${conversa.id} - telefone: ${conversa.telefone}`);
          break;
        default:
          this.logger.warn(`Acao desconhecida: ${acao}`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'erro desconhecido';
      this.logger.error(`Erro ao executar acao "${acao}": ${message}`);
    }
  }

  private async carregarContextoCooperativa(
    cooperativaId: string | undefined,
  ): Promise<ContextoCooperativa | null> {
    if (!cooperativaId) return null;

    try {
      const coop = await this.prisma.cooperativa.findUnique({
        where: { id: cooperativaId },
        select: {
          nome: true,
          email: true,
          telefone: true,
          cidade: true,
          estado: true,
          tipoParceiro: true,
        },
      });
      return coop ?? null;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'erro desconhecido';
      this.logger.warn(`Falha ao carregar contexto da cooperativa ${cooperativaId}: ${message}`);
      return null;
    }
  }

  extrairVariaveis(
    conversa: { dadosTemp?: any },
    cooperativa?: ContextoCooperativa | null,
  ): Record<string, string> {
    const dados = conversa.dadosTemp ?? {};
    const fmt = (v: number): string =>
      v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    const resultado = dados.resultado ?? {};
    const coop = cooperativa ?? null;
    const labelMembro = getLabelMembro(coop?.tipoParceiro);

    return {
      nome: String(dados.titular ?? ''),
      titular: String(dados.titular ?? ''),
      endereco: String(dados.enderecoInstalacao ?? ''),
      uc: String(dados.numeroUC ?? '-'),
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
      parceiro: coop?.nome ?? '',
      cooperativa: coop?.nome ?? '',
      cidade: coop?.cidade ?? '',
      estado_parceiro: coop?.estado ?? '',
      email_suporte: coop?.email ?? '',
      telefone_suporte: coop?.telefone ?? '',
      tipo_parceiro: coop?.tipoParceiro ?? '',
      // Fase 6 - tipo_membro / tipo_membro_plural lowercased via helper.
      // Fallback "membro" / "membros" quando tenant ausente ou tipo desconhecido.
      tipo_membro: labelMembro.singular.toLowerCase(),
      tipo_membro_plural: labelMembro.plural.toLowerCase(),
      site: '',
    };
  }

  // ==========================================================================
  // Fase 3 - Simulacao in-memory (preview de fluxo sem disparar Baileys)
  // ==========================================================================

  async simular(input: SimulacaoInput): Promise<SimulacaoOutput> {
    const cooperativaId = input.cooperativaId ?? undefined;
    const estadoInicial = input.estadoInicial ?? 'INICIAL';
    const corpo = (input.mensagem ?? '').trim();

    const conversaFake = {
      dadosTemp: input.dadosTemp ?? {},
    };

    const etapaAtual = await this.buscarEtapa(estadoInicial, cooperativaId);
    if (!etapaAtual) {
      return {
        estadoInicial,
        estadoFinal: estadoInicial,
        transicionou: false,
        gatilhoAvaliado: null,
        motivoFallback: 'Nenhuma etapa dinamica para o estado inicial - cairia no fallback hardcoded',
        mensagensEnviadas: [],
        acaoAutomatica: null,
        etapaAtual: null,
        etapaProxima: null,
      };
    }

    const proximoEstado = this.avaliarGatilhos(corpo, etapaAtual.gatilhos);
    if (!proximoEstado) {
      return {
        estadoInicial,
        estadoFinal: estadoInicial,
        transicionou: false,
        gatilhoAvaliado: null,
        motivoFallback: 'Nenhum gatilho da etapa atual bateu - cairia no fallback hardcoded',
        mensagensEnviadas: [],
        acaoAutomatica: null,
        etapaAtual: this.resumoEtapa(etapaAtual),
        etapaProxima: null,
      };
    }

    const proximaEtapa = await this.buscarEtapa(proximoEstado, cooperativaId);
    const mensagensEnviadas: SimulacaoMensagem[] = [];

    if (proximaEtapa?.modeloMensagemId) {
      const modelo = await this.prisma.modeloMensagem.findFirst({
        where: {
          id: proximaEtapa.modeloMensagemId,
          ...this.filtroTenantSomenteLeitura(cooperativaId),
        },
      });
      if (modelo) {
        const cooperativa = await this.carregarContextoCooperativa(cooperativaId);
        const vars = this.extrairVariaveis(conversaFake, cooperativa);
        const texto = this.renderizarTemplate(modelo.conteudo, vars);
        mensagensEnviadas.push({
          modeloId: modelo.id,
          modeloNome: modelo.nome,
          texto,
          variaveisUsadas: vars,
        });
      }
    }

    return {
      estadoInicial,
      estadoFinal: proximoEstado,
      transicionou: true,
      gatilhoAvaliado: corpo,
      motivoFallback: null,
      mensagensEnviadas,
      acaoAutomatica: proximaEtapa?.acaoAutomatica ?? null,
      etapaAtual: this.resumoEtapa(etapaAtual),
      etapaProxima: proximaEtapa ? this.resumoEtapa(proximaEtapa) : null,
    };
  }

  /**
   * Reduz uma FluxoEtapaComModelo ao payload publico que a UI consome no painel
   * do simulador. Expoe escopo derivado (TENANT/GLOBAL) sem vazar o cooperativaId
   * para clientes que nao precisam dele.
   */
  private resumoEtapa(etapa: FluxoEtapaComModelo): SimulacaoEtapaResumo {
    return {
      id: etapa.id,
      nome: etapa.nome,
      estado: etapa.estado,
      escopo: etapa.cooperativaId === null ? 'GLOBAL' : 'TENANT',
      modeloMensagemId: etapa.modeloMensagemId,
      acaoAutomatica: etapa.acaoAutomatica,
    };
  }
}

export interface SimulacaoInput {
  mensagem: string;
  cooperativaId?: string | null;
  estadoInicial?: string;
  dadosTemp?: Record<string, unknown>;
}

export interface SimulacaoMensagem {
  modeloId: string;
  modeloNome: string;
  texto: string;
  variaveisUsadas: Record<string, string>;
}

export interface SimulacaoEtapaResumo {
  id: string;
  nome: string;
  estado: string;
  escopo: 'TENANT' | 'GLOBAL';
  modeloMensagemId: string | null;
  acaoAutomatica: string | null;
}

export interface SimulacaoOutput {
  estadoInicial: string;
  estadoFinal: string;
  transicionou: boolean;
  gatilhoAvaliado: string | null;
  motivoFallback: string | null;
  mensagensEnviadas: SimulacaoMensagem[];
  acaoAutomatica: string | null;
  /** Etapa que o motor selecionou para o estado inicial (null = nenhuma encontrada). */
  etapaAtual: SimulacaoEtapaResumo | null;
  /** Etapa para a qual o motor transicionaria (null = nao transicionou ou nao tem etapa). */
  etapaProxima: SimulacaoEtapaResumo | null;
}
