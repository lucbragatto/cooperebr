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

export interface Gatilho {
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
    const corpo = (msg.corpo ?? '').trim();

    // Bloco 1.a — Comandos Universais de Navegacao (Sprint Bot Autoatendimento).
    // Camada que precede a avaliacao de gatilhos da etapa. Funciona em TODA
    // etapa ativa, inclusive futuras. Palavra exata e isolada (case-insensitive)
    // tem precedencia sobre gatilho normal. Wildcard "*" da etapa NAO captura
    // o comando porque a checagem acontece ANTES de avaliarGatilhos.
    const comandoUniversal = this.detectarComandoUniversal(corpo);
    if (comandoUniversal) {
      return this.executarComandoUniversalReal(comandoUniversal, msg, conversa);
    }

    const etapa = await this.buscarEtapa(conversa.estado, cooperativaId);
    if (!etapa) {
      this.logger.debug(`Nenhuma etapa dinamica para estado "${conversa.estado}" - fallback hardcoded`);
      return false;
    }

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
        const texto = this.anexarRodape(
          this.renderizarTemplate(modelo.conteudo, vars),
          proximaEtapa,
        );
        await this.sender.enviarMensagem(msg.telefone, texto);
        await this.modeloMensagem.incrementarUso(modelo.id);
      }
    }

    if (proximaEtapa?.acaoAutomatica) {
      // Passa a conversa inteira (inclui cooperativaId) pra acao poder fazer
      // queries multi-tenant. Regra do projeto: toda query Prisma filtra por
      // cooperativaId quando relacionada a entidade tenant-scoped.
      await this.executarAcao(proximaEtapa.acaoAutomatica, conversa, conversa.dadosTemp);
    }

    this.logger.log(`Motor dinamico: ${conversa.estado} -> ${proximoEstado} (telefone: ${msg.telefone}, tenant: ${cooperativaId ?? 'global'})`);
    return true;
  }

  /**
   * Bloco 1.a — Detecta se o corpo da mensagem e um comando universal de
   * navegacao (INICIO/SAIR/MENU). Comparacao por palavra exata e isolada,
   * case-insensitive. Retorna null se nao for comando universal — fluxo
   * normal continua e gatilhos da etapa sao avaliados.
   *
   * Sinonimos cobrem variacoes naturais que cooperados usam no WhatsApp.
   * Wildcard "*" da etapa NAO captura comando universal porque a checagem
   * acontece ANTES de avaliarGatilhos no fluxo principal.
   */
  detectarComandoUniversal(corpo: string): 'INICIO' | 'SAIR' | 'MENU' | null {
    if (!corpo) return null;
    const normalizado = corpo.trim().toUpperCase();

    const SINONIMOS_INICIO = ['INICIO', 'INÍCIO', 'COMECAR', 'COMEÇAR', 'MENU INICIAL'];
    const SINONIMOS_SAIR = ['SAIR', 'PARAR', 'ENCERRAR'];
    const SINONIMOS_MENU = ['MENU', 'VOLTAR'];

    if (SINONIMOS_INICIO.includes(normalizado)) return 'INICIO';
    if (SINONIMOS_SAIR.includes(normalizado)) return 'SAIR';
    if (SINONIMOS_MENU.includes(normalizado)) return 'MENU';
    return null;
  }

  /**
   * Bloco 1.a — Resolve qual estado-destino corresponde ao comando universal.
   * - INICIO -> 'INICIAL'
   * - MENU   -> 'MENU_COOPERADO' se conversa tem cooperadoId; senao 'INICIAL'
   * - SAIR   -> null (sinal especial de encerramento — caminho diferente)
   */
  resolverEstadoComandoUniversal(
    comando: 'INICIO' | 'SAIR' | 'MENU',
    conversa: { cooperadoId?: string | null },
  ): string | null {
    if (comando === 'INICIO') return 'INICIAL';
    if (comando === 'SAIR') return null;
    // MENU: contexto cooperado vs aquisicao
    return conversa.cooperadoId ? 'MENU_COOPERADO' : 'INICIAL';
  }

  /**
   * Bloco 1.a — Executa comando universal no bot REAL (processarComFluxoDinamico).
   * SAIR persiste estado=ENCERRADO + envia despedida. INICIO/MENU transicionam
   * pro estado destino, renderizam o modelo da etapa-destino (com rodape se for
   * menu) e disparam acaoAutomatica se houver.
   */
  private async executarComandoUniversalReal(
    comando: 'INICIO' | 'SAIR' | 'MENU',
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

    if (comando === 'SAIR') {
      await this.prisma.conversaWhatsapp.update({
        where: { id: conversa.id },
        data: { estado: 'ENCERRADO' },
      });
      await this.sender.enviarMensagem(
        msg.telefone,
        'Tchau! Quando quiser, e so me chamar de novo. 👋',
      );
      this.logger.log(`Comando universal SAIR: conversa ${conversa.id} encerrada (tenant: ${cooperativaId ?? 'global'})`);
      return true;
    }

    const proximoEstado = this.resolverEstadoComandoUniversal(comando, conversa);
    if (!proximoEstado) {
      this.logger.warn(`Comando ${comando} resolveu null fora de SAIR — nao deveria acontecer`);
      return false;
    }

    await this.prisma.conversaWhatsapp.update({
      where: { id: conversa.id },
      data: { estado: proximoEstado },
    });

    const etapaDestino = await this.buscarEtapa(proximoEstado, cooperativaId);
    if (etapaDestino?.modeloMensagemId) {
      const modelo = await this.prisma.modeloMensagem.findFirst({
        where: {
          id: etapaDestino.modeloMensagemId,
          ...this.filtroTenantSomenteLeitura(cooperativaId),
        },
      });
      if (modelo) {
        const cooperativa = await this.carregarContextoCooperativa(cooperativaId);
        const vars = this.extrairVariaveis(conversa, cooperativa);
        const texto = this.anexarRodape(
          this.renderizarTemplate(modelo.conteudo, vars),
          etapaDestino,
        );
        await this.sender.enviarMensagem(msg.telefone, texto);
        await this.modeloMensagem.incrementarUso(modelo.id);
      }
    }

    if (etapaDestino?.acaoAutomatica) {
      await this.executarAcao(etapaDestino.acaoAutomatica, conversa, conversa.dadosTemp);
    }

    this.logger.log(`Comando universal ${comando}: ${conversa.estado} -> ${proximoEstado} (conversa ${conversa.id})`);
    return true;
  }

  /**
   * Bloco 1.a — Anexa rodape "_A qualquer momento: digite MENU, INICIO ou SAIR._"
   * em TODA etapa renderizada (menu, terminal, coleta).
   *
   * Correcao 21/05: antes a heuristica "so em menu" deixava etapas terminais
   * (AGUARDANDO_ATENDENTE, AGUARDANDO_FOTO_FATURA) SEM rodape — justo onde o
   * cooperado fica preso e o escape mais importa. Agora sempre anexa.
   *
   * Parametro `etapa` mantido na assinatura por compatibilidade interna;
   * decisao futura pode reintroduzir filtragem por tipo de etapa.
   */
  anexarRodape(texto: string, _etapa?: FluxoEtapaComModelo): string {
    return `${texto}\n\n_A qualquer momento: digite MENU, INÍCIO ou SAIR._`;
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
    conversa: {
      id: string;
      telefone: string;
      cooperadoId?: string | null;
      cooperativaId?: string | null;
    },
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
        case 'ENVIAR_LINK_INDICACAO':
          await this.executarEnviarLinkIndicacao(conversa);
          break;
        default:
          this.logger.warn(`Acao desconhecida: ${acao}`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'erro desconhecido';
      this.logger.error(`Erro ao executar acao "${acao}": ${message}`);
    }
  }

  /**
   * R5 (20/05) — Acao ENVIAR_LINK_INDICACAO.
   * Cabea o fluxo "Convidar amigo" do bot dinamico (estado ENVIAR_CONVITE).
   * - Se a conversa nao tem cooperadoId, manda mensagem amigavel de cadastro.
   * - Se tem, busca cooperado FILTRANDO por cooperativaId tambem (regra dura
   *   multi-tenant) e gera codigoIndicacao de 8 chars se ainda nao existir
   *   (mesmo padrao do whatsapp-bot.service.ts:720).
   * - Envia 1 unica mensagem com link + chamada — modelo da etapa ENVIAR_CONVITE
   *   ja avisa "vou te enviar seu link 👇", entao a acao manda so o link + cta
   *   pra evitar redundancia.
   * - NAO injeta whatsapp-bot.service nem whatsapp-mlm.service — bot ja depende
   *   do motor, seria dependencia circular.
   * - simular() NAO chama executarAcao — esta acao roda apenas no bot real
   *   (processarComFluxoDinamico).
   */
  private async executarEnviarLinkIndicacao(
    conversa: {
      id: string;
      telefone: string;
      cooperadoId?: string | null;
      cooperativaId?: string | null;
    },
  ): Promise<void> {
    if (!conversa.cooperadoId) {
      await this.sender.enviarMensagem(
        conversa.telefone,
        'Para convidar amigos voce precisa ser cooperado. Faca seu cadastro pelo bot enviando uma foto da sua conta de luz, e em seguida volte aqui pra obter seu link personalizado!',
      );
      this.logger.log(
        `ENVIAR_LINK_INDICACAO: telefone ${conversa.telefone} nao e cooperado - mensagem de cadastro enviada`,
      );
      return;
    }

    // OBS 1 hardening multi-tenant: findFirst com filtro {id, cooperativaId}
    // quando cooperativaId conhecido. Defesa em profundidade — alem do bot ja
    // resolver cooperativaId via telefone, garantimos aqui que cooperado de
    // outro tenant nao seria encontrado mesmo num cenario de dadosTemp poluido.
    const where: { id: string; cooperativaId?: string } = { id: conversa.cooperadoId };
    if (conversa.cooperativaId) {
      where.cooperativaId = conversa.cooperativaId;
    }
    const cooperado = await this.prisma.cooperado.findFirst({
      where,
      select: { id: true, codigoIndicacao: true, nomeCompleto: true, cooperativaId: true },
    });
    if (!cooperado) {
      this.logger.warn(
        `ENVIAR_LINK_INDICACAO: cooperadoId ${conversa.cooperadoId} nao encontrado no banco (ou pertence a outro tenant)`,
      );
      return;
    }

    let codigo = cooperado.codigoIndicacao;
    if (!codigo) {
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
      codigo = Array.from(
        { length: 8 },
        () => chars[Math.floor(Math.random() * chars.length)],
      ).join('');
      await this.prisma.cooperado.update({
        where: { id: cooperado.id },
        data: { codigoIndicacao: codigo },
      });
      this.logger.log(
        `ENVIAR_LINK_INDICACAO: codigoIndicacao gerado para cooperado ${cooperado.id} -> ${codigo}`,
      );
    }

    const baseUrl = process.env.FRONTEND_URL ?? 'https://cooperebr.com.br';
    const link = `${baseUrl}/entrar?ref=${codigo}`;
    // OBS 2: mensagem unica e sucinta. Modelo da etapa ENVIAR_CONVITE ja avisou
    // "vou te enviar seu link 👇" — aqui mandamos so o link + 1 frase de CTA.
    await this.sender.enviarMensagem(
      conversa.telefone,
      `${link}\n\nCompartilhe com amigos, familiares e colegas! Quando seu indicado pagar a primeira fatura, voce recebe seu beneficio automaticamente.`,
    );
    this.logger.log(
      `ENVIAR_LINK_INDICACAO: link enviado para ${conversa.telefone} (codigo=${codigo}, tenant=${cooperado.cooperativaId ?? 'null'})`,
    );
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
    const estadoInicialDeclarado = input.estadoInicial ?? 'INICIAL';
    const corpo = (input.mensagem ?? '').trim();

    // Bloco 1.a: cooperadoId opcional via dadosTemp pra que comando MENU resolva
    // contexto cooperado vs aquisicao no simulador (cooperativaId vem separado).
    const conversaFake = {
      dadosTemp: input.dadosTemp ?? {},
      cooperadoId:
        (input.dadosTemp as { cooperadoId?: string | null } | undefined)?.cooperadoId ?? null,
    };

    // R3 — etapaIdForcado: quando o admin clica no botão ▶ de uma etapa especifica
    // (e nao no "Testar fluxo" geral), o frontend manda o id pra forcar essa etapa
    // exata como ponto de partida. Antes (e ainda no fallback), buscarEtapa() resolvia
    // por estado — o que fazia 2 etapas no mesmo estado abrirem identicas.
    // Seguranca: findFirst com OR [tenant|null] garante que ADMIN nao force etapa
    // de outro tenant.
    const etapaAtual = input.etapaIdForcado
      ? await this.buscarEtapaPorIdForcado(input.etapaIdForcado, cooperativaId)
      : await this.buscarEtapa(estadoInicialDeclarado, cooperativaId);

    // Estado inicial real apos resolucao: se forcou etapa, usa o estado dela; senao o declarado.
    const estadoInicial = etapaAtual?.estado ?? estadoInicialDeclarado;

    if (!etapaAtual) {
      return {
        estadoInicial,
        estadoFinal: estadoInicial,
        transicionou: false,
        gatilhoAvaliado: null,
        motivoFallback: input.etapaIdForcado
          ? 'Etapa forcada nao encontrada (id inexistente, inativa ou de outro tenant)'
          : 'Nenhuma etapa dinamica para o estado inicial - cairia no fallback hardcoded',
        mensagensEnviadas: [],
        acaoAutomatica: null,
        etapaAtual: null,
        etapaProxima: null,
        mensagemEtapaAtual: null,
        avisoTransicao: null,
        comandoUniversalAplicado: null,
      };
    }

    // Sub-debito UX simulador: o que o cooperado veria ao ENTRAR nesta etapa.
    // Renderiza ANTES de avaliar gatilhos pra que o painel sempre mostre, mesmo em fallback.
    const renderEtapaAtual = await this.renderizarMensagemDeEtapa(etapaAtual, cooperativaId, conversaFake);
    const mensagemEtapaAtual = renderEtapaAtual
      ? this.anexarRodape(renderEtapaAtual.texto, etapaAtual)
      : null;

    // Bloco 1.a — Comando universal de navegacao tem PRECEDENCIA sobre gatilho.
    // Ignora pings sinteticos do front (__simulador_ping__) — apenas o corpo
    // real do admin.
    const comandoUniversal =
      corpo === '__simulador_ping__' ? null : this.detectarComandoUniversal(corpo);
    if (comandoUniversal) {
      return this.executarComandoUniversalSimulado(
        comandoUniversal,
        etapaAtual,
        cooperativaId,
        conversaFake,
        estadoInicial,
        mensagemEtapaAtual,
      );
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
        mensagemEtapaAtual,
        avisoTransicao: null,
        comandoUniversalAplicado: null,
      };
    }

    // R3: transicoes SEGUINTES continuam por estado (buscarEtapa normal) — etapaIdForcado
    // so vale pra etapa inicial pra resolver duplicacao de estado. A partir daqui
    // o motor anda normalmente.
    const proximaEtapa = await this.buscarEtapa(proximoEstado, cooperativaId);
    const mensagensEnviadas: SimulacaoMensagem[] = [];

    if (proximaEtapa) {
      const renderProxima = await this.renderizarMensagemDeEtapa(proximaEtapa, cooperativaId, conversaFake);
      if (renderProxima) {
        mensagensEnviadas.push({
          modeloId: renderProxima.modeloId,
          modeloNome: renderProxima.modeloNome,
          texto: this.anexarRodape(renderProxima.texto, proximaEtapa),
          variaveisUsadas: renderProxima.vars,
        });
      }
    }

    // R4 — avisoTransicao: o motor transicionou mas o estado destino nao tem etapa
    // dinamica ativa. No WhatsApp real, isso cai no fluxo hardcoded (whatsapp-bot.service).
    // No simulador, sem essa flag o usuario ve o estado mudar mas nenhuma bolha nova —
    // parecendo "bot mudo". Avisa explicitamente.
    const avisoTransicao = proximaEtapa
      ? null
      : `Transicionou para ${proximoEstado} mas nao ha etapa dinamica ativa nesse estado — no WhatsApp real cairia no fluxo hardcoded.`;

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
      mensagemEtapaAtual,
      avisoTransicao,
      comandoUniversalAplicado: null,
    };
  }

  /**
   * Bloco 1.a — Executa comando universal no SIMULADOR (simular()). Zero
   * side-effect (nao persiste, nao envia WA). Retorna SimulacaoOutput preenchido
   * pra UI exibir o efeito do comando como se tivesse rodado no bot real.
   *
   * SAIR: retorna transicionou: true + estadoFinal sintetico 'ENCERRADO_VIA_SAIR'
   * + avisoTransicao explicativo. UI pode mostrar bolha sistema.
   *
   * INICIO/MENU: resolve etapa-destino, renderiza modelo com rodape (se for
   * menu), retorna como se tivesse transicionado. Se etapa-destino nao existe
   * (estado orfao), avisoTransicao explica.
   */
  private async executarComandoUniversalSimulado(
    comando: 'INICIO' | 'SAIR' | 'MENU',
    etapaAtual: FluxoEtapaComModelo,
    cooperativaId: string | undefined,
    conversaFake: { dadosTemp?: any; cooperadoId?: string | null },
    estadoInicial: string,
    mensagemEtapaAtual: string | null,
  ): Promise<SimulacaoOutput> {
    const etapaAtualResumo = this.resumoEtapa(etapaAtual);

    if (comando === 'SAIR') {
      return {
        estadoInicial,
        estadoFinal: 'ENCERRADO_VIA_SAIR',
        transicionou: true,
        gatilhoAvaliado: null,
        motivoFallback: null,
        mensagensEnviadas: [],
        acaoAutomatica: null,
        etapaAtual: etapaAtualResumo,
        etapaProxima: null,
        mensagemEtapaAtual,
        avisoTransicao:
          'Conversa encerrada via comando SAIR. No WhatsApp real, a sessao termina e o cooperado teria que mandar nova mensagem pra retomar.',
        comandoUniversalAplicado: 'SAIR',
      };
    }

    const proximoEstado = this.resolverEstadoComandoUniversal(comando, conversaFake);
    if (!proximoEstado) {
      // Defensivo — SAIR ja saiu acima; nao deveria cair aqui pra INICIO/MENU.
      return {
        estadoInicial,
        estadoFinal: estadoInicial,
        transicionou: false,
        gatilhoAvaliado: null,
        motivoFallback: null,
        mensagensEnviadas: [],
        acaoAutomatica: null,
        etapaAtual: etapaAtualResumo,
        etapaProxima: null,
        mensagemEtapaAtual,
        avisoTransicao: null,
        comandoUniversalAplicado: comando,
      };
    }

    const etapaDestino = await this.buscarEtapa(proximoEstado, cooperativaId);
    const mensagensEnviadas: SimulacaoMensagem[] = [];

    if (etapaDestino) {
      const renderDestino = await this.renderizarMensagemDeEtapa(etapaDestino, cooperativaId, conversaFake);
      if (renderDestino) {
        mensagensEnviadas.push({
          modeloId: renderDestino.modeloId,
          modeloNome: renderDestino.modeloNome,
          texto: this.anexarRodape(renderDestino.texto, etapaDestino),
          variaveisUsadas: renderDestino.vars,
        });
      }
    }

    const avisoTransicao = etapaDestino
      ? null
      : `Comando ${comando} apontou para ${proximoEstado} mas nao ha etapa dinamica ativa nesse estado — no WhatsApp real cairia no fluxo hardcoded.`;

    return {
      estadoInicial,
      estadoFinal: proximoEstado,
      transicionou: true,
      gatilhoAvaliado: null,
      motivoFallback: null,
      mensagensEnviadas,
      acaoAutomatica: etapaDestino?.acaoAutomatica ?? null,
      etapaAtual: etapaAtualResumo,
      etapaProxima: etapaDestino ? this.resumoEtapa(etapaDestino) : null,
      mensagemEtapaAtual,
      avisoTransicao,
      comandoUniversalAplicado: comando,
    };
  }

  /**
   * R3 — Resolve uma FluxoEtapa pelo id explicito, respeitando escopo tenant.
   * Usado quando o admin clica em "Testar a partir desta etapa" pra forcar uma
   * etapa especifica em vez de deixar buscarEtapa(estado) selecionar a primeira
   * encontrada. Retorna null se a etapa nao existe, nao esta ativa ou pertence
   * a outro tenant (defesa em profundidade — o controller ja resolve escopo).
   */
  private async buscarEtapaPorIdForcado(
    etapaId: string,
    cooperativaId: string | undefined,
  ): Promise<FluxoEtapaComModelo | null> {
    const etapa = await this.prisma.fluxoEtapa.findFirst({
      where: {
        id: etapaId,
        ativo: true,
        ...this.filtroTenantSomenteLeitura(cooperativaId),
      },
    });
    if (!etapa) return null;
    return {
      ...etapa,
      gatilhos: Array.isArray(etapa.gatilhos)
        ? (etapa.gatilhos as unknown as Gatilho[])
        : [],
    } as FluxoEtapaComModelo;
  }

  /**
   * Renderiza a mensagem de uma etapa (template do modelo associado) com as variaveis
   * do tenant. Usado por simular() em dois pontos: (1) etapaAtual = preview do que
   * o cooperado veria ao entrar na etapa, (2) proximaEtapa = mensagem que sera enviada
   * apos a transicao. Retorna null se a etapa nao tem modeloMensagemId ou se o modelo
   * for inacessivel pelo tenant.
   */
  private async renderizarMensagemDeEtapa(
    etapa: FluxoEtapaComModelo,
    cooperativaId: string | undefined,
    conversaFake: { dadosTemp?: any },
  ): Promise<{ texto: string; modeloId: string; modeloNome: string; vars: Record<string, string> } | null> {
    if (!etapa.modeloMensagemId) return null;
    const modelo = await this.prisma.modeloMensagem.findFirst({
      where: {
        id: etapa.modeloMensagemId,
        ...this.filtroTenantSomenteLeitura(cooperativaId),
      },
    });
    if (!modelo) return null;
    const cooperativa = await this.carregarContextoCooperativa(cooperativaId);
    const vars = this.extrairVariaveis(conversaFake, cooperativa);
    const texto = this.renderizarTemplate(modelo.conteudo, vars);
    return { texto, modeloId: modelo.id, modeloNome: modelo.nome, vars };
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
      // Sub-debito UX simulador: expoe gatilhos pra UI listar as respostas aceitas
      // + montar botoes de atalho. Wildcard "*" e tratado pelo cliente.
      gatilhos: etapa.gatilhos ?? [],
    };
  }

  // ==========================================================================
  // Fase C - Preview isolado de modelo (renderiza template sem fluxo)
  // ==========================================================================

  /**
   * Renderiza um modelo de mensagem com as variaveis do tenant logado,
   * sem disparar fluxo, sem persistir, sem enviar WA. Usado pelo botao
   * "Pre-visualizar" no Banco de Mensagens da tela /dashboard/whatsapp-config.
   *
   * Respeita escopo tenant: usuario so consegue ver modelos do proprio
   * tenant ou globais (cooperativaId=null).
   */
  async previewModelo(input: PreviewModeloInput): Promise<PreviewModeloOutput> {
    const cooperativaId = input.cooperativaId ?? undefined;

    const modelo = await this.prisma.modeloMensagem.findFirst({
      where: {
        id: input.modeloId,
        ...this.filtroTenantSomenteLeitura(cooperativaId),
      },
    });

    if (!modelo) {
      return {
        encontrado: false,
        modeloId: input.modeloId,
        modeloNome: null,
        categoria: null,
        texto: null,
        variaveisUsadas: {},
        escopo: null,
      };
    }

    const cooperativa = await this.carregarContextoCooperativa(cooperativaId);
    const conversaFake = { dadosTemp: input.dadosTemp ?? {} };
    const vars = this.extrairVariaveis(conversaFake, cooperativa);
    const texto = this.renderizarTemplate(modelo.conteudo, vars);

    return {
      encontrado: true,
      modeloId: modelo.id,
      modeloNome: modelo.nome,
      categoria: modelo.categoria,
      texto,
      variaveisUsadas: vars,
      escopo: modelo.cooperativaId === null ? 'GLOBAL' : 'TENANT',
    };
  }
}

export interface SimulacaoInput {
  mensagem: string;
  cooperativaId?: string | null;
  estadoInicial?: string;
  dadosTemp?: Record<string, unknown>;
  /**
   * R3 — Forca uma etapa especifica como ponto de partida em vez de deixar
   * buscarEtapa(estado) escolher. Usado pelo botao ▶ de uma etapa especifica
   * na lista — resolve o caso de 2+ etapas no mesmo estado abrindo identicas.
   * Seguranca: motor faz findFirst com OR [tenant|null], outro tenant nao
   * consegue forcar. Aplica APENAS a 1a resolucao; transicoes seguintes
   * continuam por estado.
   */
  etapaIdForcado?: string | null;
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
  /** Gatilhos da etapa - usados pela UI pra listar "respostas aceitas" + botoes de atalho. */
  gatilhos: Gatilho[];
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
  /**
   * Mensagem renderizada da etapa atual - o que o cooperado veria ao ENTRAR neste
   * estado. Null quando etapaAtual=null ou quando etapa nao tem modeloMensagemId.
   * Usado pela UI pra mostrar bolha inicial do bot no simulador.
   */
  mensagemEtapaAtual: string | null;
  /**
   * R4 — Aviso quando transicionou: true MAS proximaEtapa: null (estado destino
   * existe nos gatilhos mas nao tem etapa dinamica ativa). No WhatsApp real isso
   * cairia no fluxo hardcoded — no simulador, sem aviso, o usuario ve "estado mudou
   * mas bot nao respondeu" e fica confuso. UI mostra como bolha sistema.
   */
  avisoTransicao: string | null;
  /**
   * Bloco 1.a — Indica se a transicao foi disparada por comando universal
   * (INICIO/SAIR/MENU) em vez de gatilho da etapa. UI pode usar pra exibir
   * bolha sistema explicativa (ex: "Voce digitou SAIR — conversa encerrada").
   * null = transicao normal por gatilho ou nao-transicao.
   */
  comandoUniversalAplicado: 'INICIO' | 'SAIR' | 'MENU' | null;
}

// Fase C - Preview de modelo de mensagem (sem fluxo)
export interface PreviewModeloInput {
  modeloId: string;
  cooperativaId?: string | null;
  dadosTemp?: Record<string, unknown>;
}

export interface PreviewModeloOutput {
  encontrado: boolean;
  modeloId: string;
  modeloNome: string | null;
  categoria: string | null;
  texto: string | null;
  variaveisUsadas: Record<string, string>;
  /** Escopo derivado: TENANT se cooperativaId != null, GLOBAL se null. */
  escopo: 'TENANT' | 'GLOBAL' | null;
}
