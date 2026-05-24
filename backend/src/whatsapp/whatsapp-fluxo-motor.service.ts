import { Injectable, Logger } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import { PrismaService } from '../prisma.service';
import { ModeloMensagemService } from './modelo-mensagem.service';
import { WhatsappSenderService } from './whatsapp-sender.service';
import { CepService } from '../common/cep/cep.service';
import { FaturasService } from '../faturas/faturas.service';
import { NotificacoesService } from '../notificacoes/notificacoes.service';
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
  /**
   * Etapa A Bloco 4 (22/05): acao opcional disparada quando o gatilho casa.
   * Quando presente, motor DELEGA controle total pra acao em executarAcao()
   * (nao transiciona automatico, nao renderiza modelo destino, nao dispara
   * acaoAutomatica). Acao cuida de validar/atualizar/responder/transicionar.
   * Fundacional pros Blocos 4 a 8 (fluxos de 2 turnos).
   */
  acao?: string | null;
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
    private cepService: CepService,
    private faturasService: FaturasService,
    private notificacoes: NotificacoesService,
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

    // Bloco 6 Etapa B (23/05): detecta midia na mensagem pra propagar pro
    // motor + executarAcao. avaliarGatilhoMatch usa temMidia pra wildcard
    // casar mesmo com corpo vazio (caso AGUARDANDO_FATURA_PROXY).
    const temMidia =
      (msg.tipo === 'imagem' || msg.tipo === 'documento') &&
      !!msg.mediaBase64 &&
      !!msg.mimeType;
    const media = temMidia
      ? { base64: msg.mediaBase64 as string, mimeType: msg.mimeType as string }
      : undefined;

    const gatilhoMatch = this.avaliarGatilhoMatch(corpo, etapa.gatilhos, temMidia);

    if (!gatilhoMatch) {
      this.logger.debug(`Nenhum gatilho bateu para estado "${conversa.estado}" com corpo "${corpo}" - fallback`);
      return false;
    }

    // Etapa A Bloco 4 (22/05): se o gatilho tem `acao`, motor delega CONTROLE
    // TOTAL pra acao em executarAcao(). NAO transiciona estado, NAO renderiza
    // modelo destino, NAO dispara acaoAutomatica. A acao cuida de:
    //   - validar input (corpo digitado pelo cooperado)
    //   - atualizar entidade no banco (multi-tenant com cooperativaId)
    //   - enviar mensagem de confirmacao ou erro
    //   - transicionar conversa.estado pro estado final (ou manter pra retry)
    // Fundacional pros Blocos 4 a 8 (fluxos de 2 turnos onde a acao precisa do
    // texto livre do cooperado).
    //
    // Bloco 6 Etapa B (23/05): acoes que aceitam midia recebem 5o param
    // `media` quando a mensagem trouxe arquivo (imagem/PDF).
    if (gatilhoMatch.acao) {
      await this.executarAcao(gatilhoMatch.acao, conversa, conversa.dadosTemp, corpo, media);
      this.logger.log(
        `Motor dinamico: gatilho.acao "${gatilhoMatch.acao}" disparado em estado "${conversa.estado}" (telefone: ${msg.telefone}, tenant: ${cooperativaId ?? 'global'}${temMidia ? ', com midia ' + msg.mimeType : ''})`,
      );
      return true;
    }

    const proximoEstado = gatilhoMatch.proximoEstado;

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
      // Etapa A Bloco 4: passa tambem o corpo (texto digitado pelo cooperado)
      // como 4o parametro. Acoes de Bloco 3 ignoram (assinatura compativel).
      // Bloco 6 Etapa B: passa media tambem (5o param) — undefined se sem midia.
      await this.executarAcao(proximaEtapa.acaoAutomatica, conversa, conversa.dadosTemp, corpo, media);
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
  detectarComandoUniversal(
    corpo: string,
  ): 'INICIO' | 'SAIR' | 'MENU' | 'CHAMAR_DEPOIS' | null {
    if (!corpo) return null;
    const normalizado = corpo.trim().toUpperCase();

    const SINONIMOS_INICIO = ['INICIO', 'INÍCIO', 'COMECAR', 'COMEÇAR', 'MENU INICIAL'];
    const SINONIMOS_SAIR = ['SAIR', 'PARAR', 'ENCERRAR'];
    const SINONIMOS_MENU = ['MENU', 'VOLTAR'];
    // Bloco 1.b (22/05): 4o comando "me chame depois". NAO inclui "DEPOIS"
    // sozinho — evita falso positivo dentro de fluxos onde cooperado digita
    // "depois" como resposta a outra pergunta.
    const SINONIMOS_CHAMAR_DEPOIS = [
      'ME CHAME DEPOIS',
      'CHAME DEPOIS',
      'ME LIGA DEPOIS',
      'VOLTAR DEPOIS',
      'OUTRA HORA',
      'MAIS TARDE',
    ];

    if (SINONIMOS_INICIO.includes(normalizado)) return 'INICIO';
    if (SINONIMOS_SAIR.includes(normalizado)) return 'SAIR';
    if (SINONIMOS_MENU.includes(normalizado)) return 'MENU';
    if (SINONIMOS_CHAMAR_DEPOIS.includes(normalizado)) return 'CHAMAR_DEPOIS';
    return null;
  }

  /**
   * Bloco 1.a — Resolve qual estado-destino corresponde ao comando universal.
   * - INICIO -> 'INICIAL'
   * - MENU   -> 'MENU_COOPERADO' se conversa tem cooperadoId; senao 'INICIAL'
   * - SAIR   -> null (sinal especial de encerramento — caminho diferente)
   */
  resolverEstadoComandoUniversal(
    comando: 'INICIO' | 'SAIR' | 'MENU' | 'CHAMAR_DEPOIS',
    conversa: { cooperadoId?: string | null },
  ): string | null {
    if (comando === 'INICIO') return 'INICIAL';
    if (comando === 'SAIR') return null;
    // Bloco 1.b: CHAMAR_DEPOIS tem caminho proprio em executarComandoUniversal*
    // (similar ao SAIR — estado quase-terminal AGENDADO_RETORNO). Retorna null
    // pra sinalizar "nao siga o fluxo padrao de transicao".
    if (comando === 'CHAMAR_DEPOIS') return null;
    // MENU: contexto cooperado vs aquisicao
    return conversa.cooperadoId ? 'MENU_COOPERADO' : 'INICIAL';
  }

  /**
   * Bloco 1.b (22/05) — Calcula timestamp de retorno pra "ME CHAME DEPOIS".
   *
   * Decisao Luciano 22/05:
   *  1. +24h fixo a partir de agora (sem sub-menu de prazos).
   *  2. Postergacao pra horario comercial 08-18h: se +24h cair fora desse
   *     intervalo, posterga pra 08:00 do dia coerente.
   *     - hora < 8 (ex: 02:00): posterga pra 08:00 do mesmo dia.
   *     - hora >= 18 (ex: 19:00): posterga pra 08:00 do dia seguinte.
   *
   * Nao trata fim de semana — decisao Luciano: sabado/domingo aceitos
   * (filtro 08-18h cobre hora do dia, nao dia da semana).
   */
  private calcularRetornarEm(): Date {
    const agora = new Date();
    const retornarEm = new Date(agora.getTime() + 24 * 60 * 60 * 1000);
    const hora = retornarEm.getHours();
    if (hora < 8) {
      retornarEm.setHours(8, 0, 0, 0);
    } else if (hora >= 18) {
      retornarEm.setDate(retornarEm.getDate() + 1);
      retornarEm.setHours(8, 0, 0, 0);
    }
    return retornarEm;
  }

  /**
   * Bloco 1.a — Executa comando universal no bot REAL (processarComFluxoDinamico).
   * SAIR persiste estado=ENCERRADO + envia despedida. INICIO/MENU transicionam
   * pro estado destino, renderizam o modelo da etapa-destino (com rodape se for
   * menu) e disparam acaoAutomatica se houver.
   */
  private async executarComandoUniversalReal(
    comando: 'INICIO' | 'SAIR' | 'MENU' | 'CHAMAR_DEPOIS',
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

    // Bloco 1.b (22/05) — CHAMAR_DEPOIS: estado quase-terminal AGENDADO_RETORNO.
    // Persiste dadosTemp.retornarEm (ISO) + envia confirmacao curta. O retorno
    // em si fica a cargo do WhatsappConversaJob.processarRetornosAgendados()
    // (Etapa B) que roda @Cron EVERY_HOUR.
    //
    // Decisao Luciano: NAO persiste estadoAnterior (retorno volta pro
    // MENU_COOPERADO, contexto de 24h+ ja esfriou).
    if (comando === 'CHAMAR_DEPOIS') {
      const retornarEm = this.calcularRetornarEm();
      const dadosAtuais = (conversa.dadosTemp ?? {}) as Record<string, unknown>;
      const dadosTempNovo = { ...dadosAtuais, retornarEm: retornarEm.toISOString() };
      await this.prisma.conversaWhatsapp.update({
        where: { id: conversa.id },
        data: {
          estado: 'AGENDADO_RETORNO',
          dadosTemp: dadosTempNovo as any,
        },
      });
      await this.sender.enviarMensagem(
        msg.telefone,
        'Beleza! Volto a te chamar amanhã neste horário. 👋',
      );
      this.logger.log(
        `Comando universal CHAMAR_DEPOIS: conversa ${conversa.id} agendada pra ${retornarEm.toISOString()} (tenant: ${cooperativaId ?? 'global'})`,
      );
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
      // Etapa A Bloco 4: passa corpo vazio - comando universal nao tem texto
      // livre relevante (eh palavra reservada INICIO/MENU/SAIR).
      // Bloco 6 Etapa B: passa media undefined - comando universal nao trafega midia.
      await this.executarAcao(etapaDestino.acaoAutomatica, conversa, conversa.dadosTemp, '', undefined);
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
    return this.avaliarGatilhoMatch(corpo, gatilhos)?.proximoEstado ?? null;
  }

  /**
   * Etapa A Bloco 4 (22/05): retorna o Gatilho completo (com `acao` resolvida)
   * que casou, ou null. Substitui `avaliarGatilhos` no fluxo principal
   * (`processarComFluxoDinamico` + `simular`) pra que o motor possa processar
   * `gatilho.acao` quando definida.
   *
   * Bloco 6 Etapa B (23/05): 3o parametro opcional `temMidia` permite que
   * wildcard '*' case mesmo com corpo vazio se a mensagem trouxe imagem/PDF.
   * Sem `temMidia` (ou false), wildcard mantem semantica antiga (exige texto
   * nao-vazio). Permite que etapas tipo AGUARDANDO_FATURA_PROXY recebam mídia
   * via gatilho wildcard + acao PROCESSAR_OCR_*.
   *
   * `avaliarGatilhos` continua disponivel devolvendo so `proximoEstado` pra
   * preservar API publica (testes legacy + UI).
   */
  avaliarGatilhoMatch(
    corpo: string,
    gatilhos: Gatilho[],
    temMidia?: boolean,
  ): Gatilho | null {
    if (!gatilhos || gatilhos.length === 0) return null;

    const corpoUpper = corpo.toUpperCase().trim();

    for (const gatilho of gatilhos) {
      const resposta = (gatilho.resposta ?? '').toUpperCase().trim();
      // Wildcard casa se corpo nao-vazio OU midia presente (Bloco 6 Etapa B).
      const matched =
        resposta === '*'
          ? corpoUpper.length > 0 || temMidia === true
          : corpoUpper === resposta;
      if (matched) {
        // Normaliza `acao` pra null quando nao definida (ou undefined). Assim
        // chamadores podem comparar com `if (gatilho.acao)` sem dor.
        return { ...gatilho, acao: gatilho.acao ?? null };
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
    corpo: string,
    // Bloco 6 Etapa B (23/05): 5o parametro pra acoes que recebem midia
    // (imagem/PDF). undefined quando mensagem nao traz midia. Acoes que
    // ignoram midia (Blocos 3/4/7) sao compativeis — parametro opcional.
    media?: { base64: string; mimeType: string; nomeArquivo?: string },
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
        case 'CONSULTAR_SALDO_CREDITOS':
          await this.executarConsultarSaldoCreditos(conversa);
          break;
        case 'CONSULTAR_PROXIMA_FATURA':
          await this.executarConsultarProximaFatura(conversa);
          break;
        // Etapa C Bloco 4 (22/05): 3 acoes ATUALIZAR_*_COOPERADO disparadas via
        // gatilho.acao (wildcard nas etapas AGUARDANDO_NOVO_*). Recebem o
        // `corpo` digitado pelo cooperado e cuidam de validar/atualizar/responder/
        // transicionar. Telefone NAO entra (decisao Luciano: risco operacional).
        case 'ATUALIZAR_NOME_COOPERADO':
          await this.executarAtualizarNomeCooperado(conversa, corpo);
          break;
        case 'ATUALIZAR_EMAIL_COOPERADO':
          await this.executarAtualizarEmailCooperado(conversa, corpo);
          break;
        case 'ATUALIZAR_CEP_COOPERADO':
          await this.executarAtualizarCepCooperado(conversa, corpo);
          break;
        // Bloco 7 Etapa B (23/05): acao REGISTRAR_NPS via gatilho wildcard
        // na etapa NPS_AGUARDANDO_NOTA. Valida parseInt 0-10, persiste em
        // NpsResposta com cooperativaId, transiciona pra MENU_COOPERADO.
        case 'REGISTRAR_NPS':
          await this.executarRegistrarNps(conversa, corpo);
          break;
        // Bloco 6 Etapa C (23/05): 4 acoes do fluxo Cadastro Proxy.
        case 'SALVAR_PROXY_NOME':
          await this.executarSalvarProxyNome(conversa, corpo);
          break;
        case 'SALVAR_PROXY_TELEFONE':
          await this.executarSalvarProxyTelefone(conversa, corpo);
          break;
        case 'PROCESSAR_OCR_PROXY':
          await this.executarProcessarOcrProxy(conversa, media);
          break;
        case 'CRIAR_COOPERADO_PROXY':
          await this.executarCriarCooperadoProxy(conversa);
          break;
        // Bloco 5 Etapa B1 (24/05): 3 acoes do fluxo Atualizar Contrato (KWH).
        // Decisao Luciano modelo (B): bot NAO altera contrato direto, cria
        // SolicitacaoAlteracaoContrato PENDENTE pra equipe aprovar.
        case 'INICIAR_SOLICITACAO_AUMENTAR_KWH':
          await this.executarIniciarSolicitacaoKwh(conversa, 'AUMENTAR_KWH');
          break;
        case 'INICIAR_SOLICITACAO_DIMINUIR_KWH':
          await this.executarIniciarSolicitacaoKwh(conversa, 'DIMINUIR_KWH');
          break;
        case 'SALVAR_SOLICITACAO_KWH':
          await this.executarSalvarSolicitacaoKwh(conversa, corpo);
          break;
        // Bloco 5 Etapa B2 (24/05): 4 acoes do fluxo Atualizar Contrato (SUSPENDER + ENCERRAR).
        // Decisao Luciano 2: Suspender = pausa INDEFINIDA + motivo obrigatorio.
        // Decisao Luciano 5: Encerrar = motivo opcional ("PULAR" → null).
        // Decisao Luciano 4: Pre-valida cobranca em aberto antes de criar solicitacao.
        case 'INICIAR_SOLICITACAO_SUSPENDER':
          await this.executarIniciarSolicitacaoSuspender(conversa);
          break;
        case 'SALVAR_SOLICITACAO_SUSPENDER':
          await this.executarSalvarSolicitacaoSuspender(conversa, corpo);
          break;
        case 'INICIAR_SOLICITACAO_ENCERRAR':
          await this.executarIniciarSolicitacaoEncerrar(conversa);
          break;
        case 'SALVAR_SOLICITACAO_ENCERRAR':
          await this.executarSalvarSolicitacaoEncerrar(conversa, corpo);
          break;
        // Bloco 8 (24/05): ultimo bloco do Sprint Bot Autoatendimento.
        // 5 acoes do fluxo Menu Fatura:
        //  - VER_FATURA_ATUAL: cache local asaasCobrancas, sem chamar gateway
        //  - VER_HISTORICO_PAGAMENTOS: ultimas 6 cobrancas
        //  - SOLICITAR_CONFIRMACAO_PAGAMENTO / SALVAR_CONFIRMACAO_PAGAMENTO:
        //    "ja paguei" no padrao Bloco 5 — cria solicitacao PENDENTE
        //  - SOLICITAR_NEGOCIACAO_HUMANA: link humano via Notificacoes
        case 'VER_FATURA_ATUAL':
          await this.executarVerFaturaAtual(conversa);
          break;
        case 'VER_HISTORICO_PAGAMENTOS':
          await this.executarVerHistoricoPagamentos(conversa);
          break;
        case 'SOLICITAR_CONFIRMACAO_PAGAMENTO':
          await this.executarSolicitarConfirmacaoPagamento(conversa);
          break;
        case 'SALVAR_CONFIRMACAO_PAGAMENTO':
          await this.executarSalvarConfirmacaoPagamento(conversa, corpo);
          break;
        case 'SOLICITAR_NEGOCIACAO_HUMANA':
          await this.executarSolicitarNegociacaoHumana(conversa);
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

  /**
   * Bloco 3 (21/05) — Acao CONSULTAR_SALDO_CREDITOS.
   * Responde "1 Ver saldo de creditos" do MENU_COOPERADO (Opcao C aprovada
   * 21/05): mostra PLANO contratado (Contrato.kwhContratoMensal somado dos
   * contratos ATIVOS) + SALDO da distribuidora (FaturaProcessada.saldoKwhAtual
   * da mais recente APROVADA) com rotulos separados e claros pra nao confundir
   * os 2 conceitos.
   *
   * Fallback (regra Luciano 21/05): linha do saldo some se null/zero, linha da
   * validade some se null. Sem dado nenhum -> CTA pra enviar fatura.
   *
   * Multi-tenant: queries Contrato + FaturaProcessada filtradas por
   * cooperativaId tambem quando conhecida (defesa em profundidade, igual
   * executarEnviarLinkIndicacao).
   *
   * NAO chamada por simular() — executarAcao() roda so no bot real.
   */
  private async executarConsultarSaldoCreditos(
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
        'Para consultar seu saldo voce precisa ser cooperado. Faca seu cadastro pelo bot enviando uma foto da sua conta de luz, e em seguida volte aqui pra ver suas informacoes!',
      );
      this.logger.log(
        `CONSULTAR_SALDO_CREDITOS: telefone ${conversa.telefone} nao e cooperado - mensagem de cadastro enviada`,
      );
      return;
    }

    const cooperativaId = conversa.cooperativaId ?? undefined;

    // Plano contratado: soma kwhContratoMensal dos contratos ATIVOS do cooperado.
    // Multi-tenant: filtra por cooperativaId tambem quando conhecida.
    const whereContrato: { cooperadoId: string; status: 'ATIVO'; cooperativaId?: string } = {
      cooperadoId: conversa.cooperadoId,
      status: 'ATIVO',
    };
    if (cooperativaId) whereContrato.cooperativaId = cooperativaId;
    const contratos = await this.prisma.contrato.findMany({
      where: whereContrato as never,
      select: { kwhContratoMensal: true },
    });
    const kwhContratoTotal = contratos.reduce(
      (acc, c) => acc + Number(c.kwhContratoMensal ?? 0),
      0,
    );

    // Saldo da distribuidora: fatura processada mais recente APROVADA.
    const whereFatura: {
      cooperadoId: string;
      status: 'APROVADA';
      cooperativaId?: string;
    } = { cooperadoId: conversa.cooperadoId, status: 'APROVADA' };
    if (cooperativaId) whereFatura.cooperativaId = cooperativaId;
    const ultimaFatura = await this.prisma.faturaProcessada.findFirst({
      where: whereFatura as never,
      orderBy: { createdAt: 'desc' },
      select: {
        saldoKwhAtual: true,
        validadeCreditos: true,
        mesReferencia: true,
        createdAt: true,
      },
    });

    const modelo = await this.prisma.modeloMensagem.findFirst({
      where: {
        nome: 'saldo_creditos_resultado',
        ...this.filtroTenantSomenteLeitura(cooperativaId),
      },
    });
    if (!modelo) {
      this.logger.warn(
        `CONSULTAR_SALDO_CREDITOS: modelo "saldo_creditos_resultado" nao encontrado (tenant=${cooperativaId ?? 'global'}) - acao abortada`,
      );
      return;
    }

    // Monta variaveis com fallback: linhas que somem quando dado ausente.
    const saldoKwhNum = Number(ultimaFatura?.saldoKwhAtual ?? 0);
    const linhaSaldo =
      saldoKwhNum > 0
        ? `💡 Saldo na distribuidora: ${this.formatarKwh(saldoKwhNum)} kWh\n`
        : '';
    const linhaValidade = ultimaFatura?.validadeCreditos
      ? `📅 Validade dos créditos: ${this.formatarMesAno(ultimaFatura.validadeCreditos)}\n`
      : '';
    const linhaUltimaFatura = ultimaFatura
      ? `📊 Última fatura registrada: ${ultimaFatura.mesReferencia ?? this.formatarMesAno(ultimaFatura.createdAt)}`
      : '📊 Nenhuma fatura registrada ainda — envie a sua pelo bot pra calcular seu saldo.';

    const vars: Record<string, string> = {
      kwhContratoMensal: this.formatarKwh(kwhContratoTotal),
      linha_saldo: linhaSaldo,
      linha_validade: linhaValidade,
      linha_ultima_fatura: linhaUltimaFatura,
    };
    const texto = this.anexarRodape(this.renderizarTemplate(modelo.conteudo, vars));
    await this.sender.enviarMensagem(conversa.telefone, texto);
    await this.modeloMensagem.incrementarUso(modelo.id);
    this.logger.log(
      `CONSULTAR_SALDO_CREDITOS: enviado para ${conversa.telefone} (cooperado=${conversa.cooperadoId}, kwhContrato=${kwhContratoTotal}, saldoKwh=${saldoKwhNum}, tenant=${cooperativaId ?? 'global'})`,
    );
  }

  /**
   * Bloco 3 (21/05) — Acao CONSULTAR_PROXIMA_FATURA.
   * Responde "2 Ver proxima fatura" do MENU_COOPERADO: mostra valor + vencimento
   * + status da cobranca pendente mais antiga + link de pagamento Asaas
   * (PIX/boleto) quando AsaasCobranca tem linkPagamento.
   *
   * STATUS CORRETOS (Decisao 14, descoberta Fase 1 21/05): cobrancas vao pra
   * 'A_VENCER' (NAO 'PENDENTE' — enum tem PENDENTE mas nada usa). Handler
   * hardcoded whatsapp-bot.service.ts:791-794 usa ['PENDENTE','VENCIDO'] e
   * responde "sem faturas" mesmo quando ha A_VENCER — D-novo-U cataloga.
   *
   * Multi-tenant: query Cobranca filtrada por contrato.cooperadoId AND
   * contrato.cooperativaId (defesa em profundidade).
   *
   * Link Asaas: so exibe se AsaasCobranca tem linkPagamento (NAO inventa link).
   */
  private async executarConsultarProximaFatura(
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
        'Para consultar sua fatura voce precisa ser cooperado. Faca seu cadastro pelo bot enviando uma foto da sua conta de luz, e em seguida volte aqui pra ver suas informacoes!',
      );
      this.logger.log(
        `CONSULTAR_PROXIMA_FATURA: telefone ${conversa.telefone} nao e cooperado - mensagem de cadastro enviada`,
      );
      return;
    }

    const cooperativaId = conversa.cooperativaId ?? undefined;

    const contratoFilter: { cooperadoId: string; cooperativaId?: string } = {
      cooperadoId: conversa.cooperadoId,
    };
    if (cooperativaId) contratoFilter.cooperativaId = cooperativaId;

    const cobranca = await this.prisma.cobranca.findFirst({
      where: {
        contrato: contratoFilter,
        status: { in: ['A_VENCER', 'VENCIDO'] },
      } as never,
      orderBy: { dataVencimento: 'asc' },
      select: {
        id: true,
        status: true,
        valorLiquido: true,
        valorBruto: true,
        dataVencimento: true,
        mesReferencia: true,
        anoReferencia: true,
      },
    });

    const modelo = await this.prisma.modeloMensagem.findFirst({
      where: {
        nome: 'proxima_fatura_resultado',
        ...this.filtroTenantSomenteLeitura(cooperativaId),
      },
    });
    if (!modelo) {
      this.logger.warn(
        `CONSULTAR_PROXIMA_FATURA: modelo "proxima_fatura_resultado" nao encontrado (tenant=${cooperativaId ?? 'global'}) - acao abortada`,
      );
      return;
    }

    if (!cobranca) {
      // Caso "tudo em dia": modelo renderizado com bloco vazio + linha de boas
      // novas. Mantemos 1 unico modelo no banco com placeholders consistentes.
      const vars: Record<string, string> = {
        bloco_fatura: '✅ Voce nao tem faturas em aberto no momento!',
        link_pagamento: '',
      };
      const texto = this.anexarRodape(this.renderizarTemplate(modelo.conteudo, vars));
      await this.sender.enviarMensagem(conversa.telefone, texto);
      await this.modeloMensagem.incrementarUso(modelo.id);
      this.logger.log(
        `CONSULTAR_PROXIMA_FATURA: nenhuma fatura A_VENCER/VENCIDO para cooperado ${conversa.cooperadoId} (tenant=${cooperativaId ?? 'global'})`,
      );
      return;
    }

    // Link Asaas: so se AsaasCobranca tem linkPagamento. Nao inventa.
    const asaasCob = await this.prisma.asaasCobranca.findFirst({
      where: { cobrancaId: cobranca.id },
      orderBy: { createdAt: 'desc' },
      select: { linkPagamento: true, pixCopiaECola: true },
    });
    const linkPagamento = asaasCob?.linkPagamento
      ? `\n🔗 Pague aqui: ${asaasCob.linkPagamento}`
      : '';

    const valor = Number(cobranca.valorLiquido ?? cobranca.valorBruto ?? 0);
    const statusLabel = this.formatarStatusCobranca(cobranca.status);
    const blocoFatura =
      `💰 Valor: R$ ${this.formatarMoeda(valor)}\n` +
      `📅 Vencimento: ${this.formatarData(cobranca.dataVencimento)}\n` +
      `📊 Status: ${statusLabel}`;

    const vars: Record<string, string> = {
      bloco_fatura: blocoFatura,
      link_pagamento: linkPagamento,
    };
    const texto = this.anexarRodape(this.renderizarTemplate(modelo.conteudo, vars));
    await this.sender.enviarMensagem(conversa.telefone, texto);
    await this.modeloMensagem.incrementarUso(modelo.id);
    this.logger.log(
      `CONSULTAR_PROXIMA_FATURA: enviado para ${conversa.telefone} (cobranca=${cobranca.id}, status=${cobranca.status}, valor=${valor}, comLink=${!!asaasCob?.linkPagamento}, tenant=${cooperativaId ?? 'global'})`,
    );
  }

  // ── Helpers de formatacao usados pelas acoes do Bloco 3 ──

  private formatarKwh(v: number): string {
    return v.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  }

  private formatarMoeda(v: number): string {
    return v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  private formatarData(d: Date): string {
    return new Date(d).toLocaleDateString('pt-BR');
  }

  private formatarMesAno(d: Date): string {
    const date = new Date(d);
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const yyyy = date.getFullYear();
    return `${mm}/${yyyy}`;
  }

  private formatarStatusCobranca(status: string): string {
    switch (status) {
      case 'A_VENCER':
        return 'A vencer';
      case 'VENCIDO':
        return 'Vencida';
      case 'PENDENTE':
        return 'Pendente';
      case 'PAGO':
        return 'Paga';
      case 'CANCELADO':
        return 'Cancelada';
      default:
        return status;
    }
  }

  // ============================================================
  // Etapa C Bloco 4 (22/05): acoes ATUALIZAR_*_COOPERADO
  // Disparadas via gatilho.acao nas etapas AGUARDANDO_NOVO_*.
  // Padrao: guard cooperadoId -> validar input -> updateMany defense in depth
  // multi-tenant -> mensagem hardcoded -> transiciona ou mantem (retry).
  // Reusa validacoes do bot hardcoded (whatsapp-bot.service.ts:3793-3852).
  // Mensagem de cadastro reaproveitada pra falta de cooperadoId.
  // ============================================================
  private readonly MSG_PRECISA_CADASTRO =
    'Para atualizar seu cadastro voce precisa ser cooperado. Faca seu cadastro pelo bot enviando uma foto da sua conta de luz, e em seguida volte aqui!';

  private async executarAtualizarNomeCooperado(
    conversa: {
      id: string;
      telefone: string;
      cooperadoId?: string | null;
      cooperativaId?: string | null;
    },
    corpo: string,
  ): Promise<void> {
    if (!conversa.cooperadoId) {
      await this.sender.enviarMensagem(conversa.telefone, this.MSG_PRECISA_CADASTRO);
      this.logger.log(
        `ATUALIZAR_NOME_COOPERADO: telefone ${conversa.telefone} nao e cooperado - mensagem de cadastro enviada`,
      );
      return;
    }

    const novoNome = (corpo ?? '').trim();
    if (novoNome.length < 3) {
      await this.sender.enviarMensagem(
        conversa.telefone,
        '⚠️ Nome muito curto. Digite seu *nome completo* (mínimo 3 caracteres):',
      );
      return;
    }

    const cooperativaId = conversa.cooperativaId ?? undefined;
    const where: { id: string; cooperativaId?: string } = { id: conversa.cooperadoId };
    if (cooperativaId) where.cooperativaId = cooperativaId;

    try {
      const { count } = await this.prisma.cooperado.updateMany({
        where,
        data: { nomeCompleto: novoNome },
      });
      if (count === 0) {
        this.logger.warn(
          `ATUALIZAR_NOME_COOPERADO: cooperado ${conversa.cooperadoId} nao encontrado no tenant ${cooperativaId ?? 'global'} (defense in depth bloqueou)`,
        );
        await this.sender.enviarMensagem(
          conversa.telefone,
          '⚠️ Não consegui atualizar agora. Tente de novo em alguns minutos ou fale com a equipe.',
        );
        return;
      }
    } catch (err) {
      this.logger.error(
        `ATUALIZAR_NOME_COOPERADO falhou: ${(err as Error)?.message ?? 'erro desconhecido'}`,
      );
      await this.sender.enviarMensagem(
        conversa.telefone,
        '⚠️ Não consegui atualizar agora. Tente de novo em alguns minutos ou fale com a equipe.',
      );
      return;
    }

    await this.sender.enviarMensagem(
      conversa.telefone,
      `✅ Nome atualizado para *${novoNome}*!`,
    );
    await this.prisma.conversaWhatsapp.update({
      where: { id: conversa.id },
      data: { estado: 'MENU_COOPERADO' },
    });

    this.logger.log(
      `ATUALIZAR_NOME_COOPERADO: cooperado ${conversa.cooperadoId} -> "${novoNome}" (tenant=${cooperativaId ?? 'global'})`,
    );
  }

  private async executarAtualizarEmailCooperado(
    conversa: {
      id: string;
      telefone: string;
      cooperadoId?: string | null;
      cooperativaId?: string | null;
    },
    corpo: string,
  ): Promise<void> {
    if (!conversa.cooperadoId) {
      await this.sender.enviarMensagem(conversa.telefone, this.MSG_PRECISA_CADASTRO);
      this.logger.log(
        `ATUALIZAR_EMAIL_COOPERADO: telefone ${conversa.telefone} nao e cooperado - mensagem de cadastro enviada`,
      );
      return;
    }

    const novoEmail = (corpo ?? '').trim().toLowerCase();
    // Mesma regex do hardcoded (whatsapp-bot.service.ts:3811).
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(novoEmail)) {
      await this.sender.enviarMensagem(
        conversa.telefone,
        '⚠️ Email inválido. Digite um email no formato *nome@dominio.com*:',
      );
      return;
    }

    const cooperativaId = conversa.cooperativaId ?? undefined;
    const where: { id: string; cooperativaId?: string } = { id: conversa.cooperadoId };
    if (cooperativaId) where.cooperativaId = cooperativaId;

    try {
      const { count } = await this.prisma.cooperado.updateMany({
        where,
        data: { email: novoEmail },
      });
      if (count === 0) {
        this.logger.warn(
          `ATUALIZAR_EMAIL_COOPERADO: cooperado ${conversa.cooperadoId} nao encontrado no tenant ${cooperativaId ?? 'global'}`,
        );
        await this.sender.enviarMensagem(
          conversa.telefone,
          '⚠️ Não consegui atualizar agora. Tente de novo em alguns minutos ou fale com a equipe.',
        );
        return;
      }
    } catch (err) {
      // P2002 = unique constraint violation (email ja em uso por outro cadastro).
      // Decisao Luciano 22/05: sugerir padrao +suffix do Gmail e PEDIR DE NOVO
      // (mantem estado AGUARDANDO_NOVO_EMAIL, cooperado tenta outro).
      if ((err as { code?: string })?.code === 'P2002') {
        await this.sender.enviarMensagem(
          conversa.telefone,
          '⚠️ Esse email já está em uso por outro cadastro. Tente outro endereço, ou use o padrão *seunome+CoopereBR@gmail.com* (o Gmail entrega na mesma caixa). Digite outro email:',
        );
        this.logger.warn(
          `ATUALIZAR_EMAIL_COOPERADO: P2002 unique violation para "${novoEmail}" (cooperado=${conversa.cooperadoId}, tenant=${cooperativaId ?? 'global'})`,
        );
        return;
      }
      this.logger.error(
        `ATUALIZAR_EMAIL_COOPERADO falhou: ${(err as Error)?.message ?? 'erro desconhecido'}`,
      );
      await this.sender.enviarMensagem(
        conversa.telefone,
        '⚠️ Não consegui atualizar agora. Tente de novo em alguns minutos ou fale com a equipe.',
      );
      return;
    }

    await this.sender.enviarMensagem(
      conversa.telefone,
      `✅ Email atualizado para *${novoEmail}*!`,
    );
    await this.prisma.conversaWhatsapp.update({
      where: { id: conversa.id },
      data: { estado: 'MENU_COOPERADO' },
    });

    this.logger.log(
      `ATUALIZAR_EMAIL_COOPERADO: cooperado ${conversa.cooperadoId} -> "${novoEmail}" (tenant=${cooperativaId ?? 'global'})`,
    );
  }

  private async executarAtualizarCepCooperado(
    conversa: {
      id: string;
      telefone: string;
      cooperadoId?: string | null;
      cooperativaId?: string | null;
    },
    corpo: string,
  ): Promise<void> {
    if (!conversa.cooperadoId) {
      await this.sender.enviarMensagem(conversa.telefone, this.MSG_PRECISA_CADASTRO);
      this.logger.log(
        `ATUALIZAR_CEP_COOPERADO: telefone ${conversa.telefone} nao e cooperado - mensagem de cadastro enviada`,
      );
      return;
    }

    // CepService valida formato + chama ViaCEP + classifica resultado.
    const resultado = await this.cepService.consultar(corpo);

    if (resultado.status === 'CEP_INVALIDO') {
      await this.sender.enviarMensagem(
        conversa.telefone,
        '⚠️ CEP inválido. Digite 8 dígitos (ex: *01310-100*):',
      );
      return;
    }

    if (resultado.status === 'NAO_ENCONTRADO') {
      await this.sender.enviarMensagem(
        conversa.telefone,
        '⚠️ CEP não encontrado. Verifique e digite de novo:',
      );
      return;
    }

    const cooperativaId = conversa.cooperativaId ?? undefined;
    const where: { id: string; cooperativaId?: string } = { id: conversa.cooperadoId };
    if (cooperativaId) where.cooperativaId = cooperativaId;

    // FORA_DO_AR: degradacao graciosa — salva so o CEP digitado normalizado,
    // NAO mexe em logradouro/bairro/cidade/estado (preserva o que ja existia).
    // Decisao Luciano 22/05: nao trava o cooperado.
    if (resultado.status === 'FORA_DO_AR') {
      const cepLimpo = (corpo ?? '').replace(/\D/g, '');
      const cepFormatado = `${cepLimpo.slice(0, 5)}-${cepLimpo.slice(5)}`;
      try {
        const { count } = await this.prisma.cooperado.updateMany({
          where,
          data: { cep: cepFormatado },
        });
        if (count === 0) {
          this.logger.warn(
            `ATUALIZAR_CEP_COOPERADO (FORA_DO_AR): cooperado ${conversa.cooperadoId} nao encontrado no tenant ${cooperativaId ?? 'global'}`,
          );
          await this.sender.enviarMensagem(
            conversa.telefone,
            '⚠️ Não consegui atualizar agora. Tente de novo em alguns minutos ou fale com a equipe.',
          );
          return;
        }
      } catch (err) {
        this.logger.error(
          `ATUALIZAR_CEP_COOPERADO (FORA_DO_AR) falhou: ${(err as Error)?.message ?? 'erro desconhecido'}`,
        );
        await this.sender.enviarMensagem(
          conversa.telefone,
          '⚠️ Não consegui atualizar agora. Tente de novo em alguns minutos ou fale com a equipe.',
        );
        return;
      }

      await this.sender.enviarMensagem(
        conversa.telefone,
        `✅ CEP atualizado para *${cepFormatado}*.\n_Não consegui consultar o endereço completo agora — só o CEP foi gravado._`,
      );
      await this.prisma.conversaWhatsapp.update({
        where: { id: conversa.id },
        data: { estado: 'MENU_COOPERADO' },
      });
      this.logger.log(
        `ATUALIZAR_CEP_COOPERADO (FORA_DO_AR): cooperado ${conversa.cooperadoId} -> cep="${cepFormatado}" (tenant=${cooperativaId ?? 'global'})`,
      );
      return;
    }

    // ENCONTRADO: autopopula cep + logradouro + bairro + cidade + estado.
    // Numero/complemento NAO mexem (cooperado preenche via portal/admin).
    const { endereco } = resultado;
    try {
      const { count } = await this.prisma.cooperado.updateMany({
        where,
        data: {
          cep: endereco.cep,
          logradouro: endereco.logradouro,
          bairro: endereco.bairro,
          cidade: endereco.cidade,
          estado: endereco.estado,
        },
      });
      if (count === 0) {
        this.logger.warn(
          `ATUALIZAR_CEP_COOPERADO (ENCONTRADO): cooperado ${conversa.cooperadoId} nao encontrado no tenant ${cooperativaId ?? 'global'}`,
        );
        await this.sender.enviarMensagem(
          conversa.telefone,
          '⚠️ Não consegui atualizar agora. Tente de novo em alguns minutos ou fale com a equipe.',
        );
        return;
      }
    } catch (err) {
      this.logger.error(
        `ATUALIZAR_CEP_COOPERADO (ENCONTRADO) falhou: ${(err as Error)?.message ?? 'erro desconhecido'}`,
      );
      await this.sender.enviarMensagem(
        conversa.telefone,
        '⚠️ Não consegui atualizar agora. Tente de novo em alguns minutos ou fale com a equipe.',
      );
      return;
    }

    // Mensagem com partes que existem (logradouro/bairro podem ser vazios pra
    // CEPs de cidade).
    const partesPrincipal = [endereco.logradouro, endereco.bairro]
      .filter((s) => s && s.trim().length > 0)
      .join(', ');
    const enderecoFmt = partesPrincipal
      ? `${partesPrincipal} — ${endereco.cidade}-${endereco.estado}`
      : `${endereco.cidade}-${endereco.estado}`;

    await this.sender.enviarMensagem(
      conversa.telefone,
      `✅ Endereço atualizado: *${enderecoFmt}* (CEP ${endereco.cep})!`,
    );
    await this.prisma.conversaWhatsapp.update({
      where: { id: conversa.id },
      data: { estado: 'MENU_COOPERADO' },
    });
    this.logger.log(
      `ATUALIZAR_CEP_COOPERADO (ENCONTRADO): cooperado ${conversa.cooperadoId} -> cep="${endereco.cep}" cidade="${endereco.cidade}-${endereco.estado}" (tenant=${cooperativaId ?? 'global'})`,
    );
  }

  // ============================================================
  // Bloco 7 Etapa B (23/05) — acao REGISTRAR_NPS
  // Disparada via gatilho wildcard '*' na etapa NPS_AGUARDANDO_NOTA.
  // Padrao Bloco 4: guard cooperadoId + validar parseInt 0-10 + persistir
  // em NpsResposta com cooperativaId + renderizar modelo nps_recebido +
  // transicionar pra MENU_COOPERADO. Retry inline se nota invalida (mantem
  // em NPS_AGUARDANDO_NOTA).
  //
  // Decisoes Luciano 23/05:
  //  - cooperativaId vem da sessao (multi-tenant defensivo)
  //  - comentario sempre null neste bloco (campo aditivo no schema, sprint
  //    futuro popula)
  //  - estado pos-NPS = MENU_COOPERADO (consistente Blocos 4/1.b)
  //  - hardcoded handleNpsNota preservado como fallback (debt catalogado:
  //    hardcoded transiciona pra CONCLUIDO, motor pra MENU_COOPERADO)
  // ============================================================
  private async executarRegistrarNps(
    conversa: {
      id: string;
      telefone: string;
      cooperadoId?: string | null;
      cooperativaId?: string | null;
    },
    corpo: string,
  ): Promise<void> {
    if (!conversa.cooperadoId) {
      await this.sender.enviarMensagem(
        conversa.telefone,
        'Para avaliar voce precisa ser cooperado. Faca seu cadastro pelo bot enviando uma foto da sua conta de luz, e em seguida volte aqui!',
      );
      this.logger.log(
        `REGISTRAR_NPS: telefone ${conversa.telefone} nao e cooperado - mensagem de cadastro enviada`,
      );
      return;
    }

    // Valida parseInt 0-10 (espelha hardcoded handleNpsNota:4018)
    const nota = parseInt((corpo ?? '').trim(), 10);
    if (Number.isNaN(nota) || nota < 0 || nota > 10) {
      await this.sender.enviarMensagem(
        conversa.telefone,
        '⚠️ Nota inválida. Digite um número de 0 a 10:',
      );
      // NAO transiciona — cooperado tenta de novo no estado NPS_AGUARDANDO_NOTA
      return;
    }

    const cooperativaId = conversa.cooperativaId ?? undefined;

    // Persiste NPS — defensive try/catch (cooperativaId pode ser null pra lead
    // sem tenant ainda). comentario sempre null neste bloco.
    try {
      await this.prisma.npsResposta.create({
        data: {
          cooperadoId: conversa.cooperadoId,
          cooperativaId: conversa.cooperativaId ?? null,
          telefone: conversa.telefone,
          nota,
          comentario: null,
          canal: 'WHATSAPP',
        },
      });
    } catch (err) {
      this.logger.error(
        `REGISTRAR_NPS falhou: ${(err as Error)?.message ?? 'erro desconhecido'}`,
      );
      await this.sender.enviarMensagem(
        conversa.telefone,
        '⚠️ Não consegui registrar agora. Tente de novo em alguns minutos ou fale com a equipe.',
      );
      return;
    }

    // Renderiza modelo nps_recebido do banco (multi-tenant via
    // filtroTenantSomenteLeitura). Se modelo nao existe no tenant, fallback
    // hardcoded curto — mas o NPS ja foi registrado (prioridade).
    const modelo = await this.prisma.modeloMensagem.findFirst({
      where: {
        nome: 'nps_recebido',
        ...this.filtroTenantSomenteLeitura(cooperativaId),
      },
    });
    if (modelo) {
      // Vars manuais (padrao Bloco 3/4 — extrairVariaveis exige dadosTemp na
      // assinatura, que esta acao nao precisa). Modelo nps_recebido usa
      // apenas {{parceiro}} hoje.
      const cooperativa = await this.carregarContextoCooperativa(cooperativaId);
      const vars: Record<string, string> = {
        parceiro: cooperativa?.nome ?? 'CoopereBR',
      };
      const texto = this.anexarRodape(this.renderizarTemplate(modelo.conteudo, vars));
      await this.sender.enviarMensagem(conversa.telefone, texto);
      await this.modeloMensagem.incrementarUso(modelo.id);
    } else {
      this.logger.warn(
        `REGISTRAR_NPS: modelo "nps_recebido" nao encontrado (tenant=${cooperativaId ?? 'global'}) - usando fallback hardcoded`,
      );
      await this.sender.enviarMensagem(
        conversa.telefone,
        'Obrigado pelo feedback! 💚',
      );
    }

    // Transiciona pra MENU_COOPERADO (decisao 4 X — consistente Blocos 4/1.b)
    await this.prisma.conversaWhatsapp.update({
      where: { id: conversa.id },
      data: { estado: 'MENU_COOPERADO' },
    });

    this.logger.log(
      `REGISTRAR_NPS: cooperado ${conversa.cooperadoId} -> nota=${nota} (tenant=${cooperativaId ?? 'global'})`,
    );
  }

  // ============================================================
  // Bloco 6 Etapa C (23/05) — 4 acoes do fluxo Cadastro Proxy
  // (cooperado cadastra um amigo via WhatsApp).
  //
  // Padrao Bloco 4/7: cada acao recebe (conversa, corpo[, media]) e:
  //  - valida input
  //  - persiste em dadosTemp ou cria entidade
  //  - transiciona estado ou retry inline
  //
  // Decisoes Luciano 23/05:
  //  - cooperativaId herda do indicador (sempre via dadosTemp.cooperativaId,
  //    populado quando cooperado entra via "4 convidar" no MENU_PRINCIPAL)
  //  - Indicacao formal criada no momento do cadastro (NAO so listener)
  //  - Modelo proxy_confirmar mapeia {{titular}}/{{telefone}} na renderizacao
  //  - Replica hardcoded handleConfirmarProxy + adiciona Indicacao formal
  //
  // Hardcoded handleCadastroProxy* preservado como fallback.
  // ============================================================
  private async executarSalvarProxyNome(
    conversa: {
      id: string;
      telefone: string;
      cooperadoId?: string | null;
      cooperativaId?: string | null;
      dadosTemp?: any;
    },
    corpo: string,
  ): Promise<void> {
    const nome = (corpo ?? '').trim();
    if (nome.length < 3) {
      await this.sender.enviarMensagem(
        conversa.telefone,
        'Por favor, informe o *nome completo* do seu amigo (mínimo 3 caracteres):',
      );
      return;
    }

    const dadosAtuais = (conversa.dadosTemp ?? {}) as Record<string, unknown>;
    const dadosNovo = { ...dadosAtuais, proxyNome: nome };

    await this.prisma.conversaWhatsapp.update({
      where: { id: conversa.id },
      data: {
        estado: 'CADASTRO_PROXY_TELEFONE',
        dadosTemp: dadosNovo as any,
      },
    });

    await this.sender.enviarMensagem(
      conversa.telefone,
      `Anotado! E qual o *WhatsApp* de *${nome}*? (com DDD — ex: 27 99999-9999)`,
    );

    this.logger.log(
      `SALVAR_PROXY_NOME: dadosTemp.proxyNome="${nome}" (conversa=${conversa.id})`,
    );
  }

  private async executarSalvarProxyTelefone(
    conversa: {
      id: string;
      telefone: string;
      cooperadoId?: string | null;
      cooperativaId?: string | null;
      dadosTemp?: any;
    },
    corpo: string,
  ): Promise<void> {
    const digitos = (corpo ?? '').replace(/\D/g, '');
    if (digitos.length < 10 || digitos.length > 13) {
      await this.sender.enviarMensagem(
        conversa.telefone,
        '⚠️ Número inválido. Informe com DDD (ex: 27 99999-9999):',
      );
      return;
    }

    const proxyTelefone = digitos.startsWith('55') ? digitos : `55${digitos}`;
    const dadosAtuais = (conversa.dadosTemp ?? {}) as Record<string, unknown>;
    const dadosNovo = { ...dadosAtuais, proxyTelefone };

    await this.prisma.conversaWhatsapp.update({
      where: { id: conversa.id },
      data: {
        estado: 'AGUARDANDO_FATURA_PROXY',
        dadosTemp: dadosNovo as any,
      },
    });

    const nome = (dadosAtuais.proxyNome as string | undefined) ?? 'seu amigo';
    await this.sender.enviarMensagem(
      conversa.telefone,
      `Perfeito! 📸 Agora me envie uma *foto* ou *PDF* da conta de luz de *${nome}* — assim já calculo quanto vai economizar.`,
    );

    this.logger.log(
      `SALVAR_PROXY_TELEFONE: dadosTemp.proxyTelefone="${proxyTelefone}" (conversa=${conversa.id})`,
    );
  }

  private async executarProcessarOcrProxy(
    conversa: {
      id: string;
      telefone: string;
      cooperadoId?: string | null;
      cooperativaId?: string | null;
      dadosTemp?: any;
    },
    media?: { base64: string; mimeType: string; nomeArquivo?: string },
  ): Promise<void> {
    // Valida que mensagem trouxe midia
    if (!media || !media.base64 || !media.mimeType) {
      await this.sender.enviarMensagem(
        conversa.telefone,
        'Por favor, envie uma *foto* ou *PDF* da conta de energia do seu amigo. 📸',
      );
      return;
    }

    // Valida mimeType permitido pelo pipeline OCR (espelha hardcoded)
    const mimesValidos = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
    if (!mimesValidos.includes(media.mimeType)) {
      await this.sender.enviarMensagem(
        conversa.telefone,
        '⚠️ Formato não suportado. Envie uma *foto* (JPG/PNG) ou *PDF* da fatura.',
      );
      return;
    }

    // UX: cooperado vai esperar 5-30s, sinalizar
    await this.sender.enviarMensagem(
      conversa.telefone,
      '📄 Recebi! Analisando os dados... ⏳',
    );

    const tipoArquivo: 'pdf' | 'imagem' =
      media.mimeType === 'application/pdf' ? 'pdf' : 'imagem';

    let dadosExtraidos: Record<string, unknown>;
    try {
      dadosExtraidos = (await this.faturasService.extrairOcr(
        media.base64,
        tipoArquivo,
      )) as unknown as Record<string, unknown>;
    } catch (err) {
      this.logger.warn(
        `PROCESSAR_OCR_PROXY: extrairOcr falhou — ${(err as Error)?.message ?? 'erro desconhecido'}`,
      );
      await this.sender.enviarMensagem(
        conversa.telefone,
        'Não consegui identificar os dados. Envie uma foto mais nítida ou o PDF da fatura. 📸',
      );
      return;
    }

    const consumoAtualKwh = Number(dadosExtraidos.consumoAtualKwh ?? 0);
    if (consumoAtualKwh <= 0) {
      await this.sender.enviarMensagem(
        conversa.telefone,
        'O arquivo não parece ser uma fatura de energia. Tente novamente. 📄',
      );
      return;
    }

    // Persiste dados extraidos em dadosTemp (pra possivel uso futuro / debug)
    const dadosAtuais = (conversa.dadosTemp ?? {}) as Record<string, unknown>;
    const proxyNome = (dadosAtuais.proxyNome as string | undefined) ?? 'seu amigo';
    const proxyTelefone =
      (dadosAtuais.proxyTelefone as string | undefined) ?? '';

    const dadosNovo = {
      ...dadosAtuais,
      ...dadosExtraidos,
    };

    // Renderiza modelo proxy_confirmar do banco com vars {{titular}}/{{telefone}}
    // (decisao tecnica orquestrador: mapear na acao, nao renomear modelo).
    const cooperativaId = conversa.cooperativaId ?? undefined;
    const modelo = await this.prisma.modeloMensagem.findFirst({
      where: {
        nome: 'proxy_confirmar',
        ...this.filtroTenantSomenteLeitura(cooperativaId),
      },
    });

    await this.prisma.conversaWhatsapp.update({
      where: { id: conversa.id },
      data: {
        estado: 'CONFIRMAR_PROXY',
        dadosTemp: dadosNovo as any,
      },
    });

    if (modelo) {
      const vars: Record<string, string> = {
        titular: proxyNome,
        telefone: proxyTelefone,
      };
      const texto = this.anexarRodape(
        this.renderizarTemplate(modelo.conteudo, vars),
      );
      await this.sender.enviarMensagem(conversa.telefone, texto);
      await this.modeloMensagem.incrementarUso(modelo.id);
    } else {
      this.logger.warn(
        `PROCESSAR_OCR_PROXY: modelo "proxy_confirmar" nao encontrado (tenant=${cooperativaId ?? 'global'}) - usando fallback hardcoded`,
      );
      await this.sender.enviarMensagem(
        conversa.telefone,
        `Confere os dados:\n👤 ${proxyNome}\n📱 ${proxyTelefone}\n\n1️⃣ Cadastrar\n2️⃣ Corrigir`,
      );
    }

    this.logger.log(
      `PROCESSAR_OCR_PROXY: cooperadoId=${conversa.cooperadoId} proxyNome="${proxyNome}" consumoKwh=${consumoAtualKwh} -> CONFIRMAR_PROXY`,
    );
  }

  private async executarCriarCooperadoProxy(
    conversa: {
      id: string;
      telefone: string;
      cooperadoId?: string | null;
      cooperativaId?: string | null;
      dadosTemp?: any;
    },
  ): Promise<void> {
    const dados = (conversa.dadosTemp ?? {}) as Record<string, unknown>;
    const proxyNome = dados.proxyNome as string | undefined;
    const proxyTelefone = dados.proxyTelefone as string | undefined;
    const indicadorId = dados.indicadorId as string | undefined;
    const indicadorNome = (dados.indicadorNome as string | undefined) ?? 'Seu amigo';
    const cooperativaId = dados.cooperativaId as string | undefined;

    if (!indicadorId || !proxyNome || !proxyTelefone || !cooperativaId) {
      this.logger.error(
        `CRIAR_COOPERADO_PROXY: dadosTemp incompleto (indicadorId=${!!indicadorId}, proxyNome=${!!proxyNome}, proxyTelefone=${!!proxyTelefone}, cooperativaId=${!!cooperativaId})`,
      );
      await this.sender.enviarMensagem(
        conversa.telefone,
        '⚠️ Ocorreu um erro ao cadastrar. Tente novamente mais tarde.',
      );
      return;
    }

    // 1. Cria Cooperado novo PENDENTE_ASSINATURA
    let novoCooperado: { id: string; nomeCompleto: string };
    try {
      const ts = Date.now();
      novoCooperado = await this.prisma.cooperado.create({
        data: {
          nomeCompleto: proxyNome,
          cpf: `PROXY_${ts}`,
          email: `proxy_${ts}@pendente.cooperebr`,
          telefone: proxyTelefone,
          status: 'PENDENTE_ASSINATURA' as any,
          cooperadoIndicadorId: indicadorId,
          cooperativaId,
        },
      });
    } catch (err) {
      this.logger.error(
        `CRIAR_COOPERADO_PROXY: cooperado.create falhou — ${(err as Error)?.message ?? 'erro desconhecido'}`,
      );
      await this.sender.enviarMensagem(
        conversa.telefone,
        '⚠️ Ocorreu um erro ao cadastrar. Tente novamente mais tarde.',
      );
      return;
    }

    // 2. Cria Indicacao formal (status PENDENTE) — decisao Luciano #2 = (b)
    try {
      await this.prisma.indicacao.create({
        data: {
          cooperativaId,
          cooperadoIndicadorId: indicadorId,
          cooperadoIndicadoId: novoCooperado.id,
          status: 'PENDENTE',
        },
      });
    } catch (err) {
      // Indicacao formal falhou mas Cooperado ja criado — log e segue (defense
      // in depth: cooperadoIndicadorId no Cooperado ainda registra o vinculo).
      this.logger.error(
        `CRIAR_COOPERADO_PROXY: indicacao.create falhou — ${(err as Error)?.message ?? 'erro desconhecido'} (cooperado novo ja criado, vinculo via cooperadoIndicadorId)`,
      );
    }

    // 3. Gera JWT 7 dias + persiste no Cooperado
    const secret = process.env.JWT_SECRET ?? 'fallback-dev-secret';
    const token = jwt.sign(
      { cooperadoId: novoCooperado.id, tipo: 'assinatura' },
      secret,
      { expiresIn: '7d' },
    );
    const expiraEm = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await this.prisma.cooperado.update({
      where: { id: novoCooperado.id },
      data: { tokenAssinatura: token, tokenAssinaturaExp: expiraEm },
    });

    // 4. Envia mensagem pro AMIGO com link de assinatura
    const baseUrl = process.env.FRONTEND_URL ?? 'https://cooperebr.com.br';
    const link = `${baseUrl}/portal/assinar/${token}`;
    const msgAmigo =
      `${indicadorNome} te cadastrou na *CoopereBR*! 🌞\n\n` +
      `Para confirmar, acesse:\n${link}\n\n` +
      `O link é válido por 7 dias.`;
    try {
      await this.sender.enviarMensagem(proxyTelefone, msgAmigo);
    } catch (err) {
      // WhatsappSenderService ja tem camadas de protecao (isAmbienteReal).
      // Falha aqui pode ser numero invalido ou bloqueio — log warn e segue.
      this.logger.warn(
        `CRIAR_COOPERADO_PROXY: erro ao enviar WA pro amigo (${proxyTelefone}) — ${(err as Error)?.message ?? 'erro desconhecido'}`,
      );
    }

    // 5. Notifica cooperado-indicador (sempre, mesmo se WA pro amigo falhou)
    try {
      await this.sender.enviarMensagem(
        conversa.telefone,
        `✅ Pronto! Enviei o link pra *${proxyNome}* confirmar.\nQuando ele assinar, você recebe seu benefício!`,
      );
    } catch (err) {
      this.logger.warn(
        `CRIAR_COOPERADO_PROXY: erro ao notificar indicador — ${(err as Error)?.message ?? 'erro desconhecido'}`,
      );
    }

    // 6. Transiciona pra MENU_COOPERADO
    await this.prisma.conversaWhatsapp.update({
      where: { id: conversa.id },
      data: { estado: 'MENU_COOPERADO' },
    });

    this.logger.log(
      `CRIAR_COOPERADO_PROXY: cooperado novo ${novoCooperado.id} (indicador ${indicadorId}, tenant ${cooperativaId}) -> Indicacao PENDENTE + JWT 7d + WA amigo + notificacao indicador`,
    );
  }

  // ============================================================
  // Bloco 5 Etapa B1 (24/05) — Acoes do fluxo Atualizar Contrato (KWH).
  //
  // Decisao Luciano modelo (B): bot NUNCA altera contrato direto; cria
  // SolicitacaoAlteracaoContrato status PENDENTE; equipe aprova pela tela
  // /dashboard/super-admin/solicitacoes (Etapa E) que dispara
  // contratosService.update.
  //
  // 3 acoes desta parte:
  //  - INICIAR_SOLICITACAO_AUMENTAR_KWH (gatilho '1' do ATUALIZACAO_CONTRATO)
  //  - INICIAR_SOLICITACAO_DIMINUIR_KWH (gatilho '2')
  //  - SALVAR_SOLICITACAO_KWH (wildcard em AGUARDANDO_NOVO_KWH)
  //
  // Pre-validacao decisao 4: AUMENTAR consulta Usina.capacidadeKwh + soma
  // Contrato.kwhContratoMensal ATIVOS da mesma usina; recusa antes de
  // criar se delta excederia capacidade.
  // ============================================================
  private async executarIniciarSolicitacaoKwh(
    conversa: {
      id: string;
      telefone: string;
      cooperadoId?: string | null;
      cooperativaId?: string | null;
    },
    tipoAlteracao: 'AUMENTAR_KWH' | 'DIMINUIR_KWH',
  ): Promise<void> {
    if (!conversa.cooperadoId) {
      await this.sender.enviarMensagem(
        conversa.telefone,
        'Para alterar seu contrato voce precisa ser cooperado. Faca seu cadastro pelo bot enviando uma foto da sua conta de luz.',
      );
      this.logger.log(
        `${tipoAlteracao}: telefone ${conversa.telefone} nao e cooperado - mensagem enviada`,
      );
      return;
    }

    const cooperativaId = conversa.cooperativaId ?? undefined;
    const whereContrato: { cooperadoId: string; status: 'ATIVO'; cooperativaId?: string } = {
      cooperadoId: conversa.cooperadoId,
      status: 'ATIVO',
    };
    if (cooperativaId) whereContrato.cooperativaId = cooperativaId;

    const contrato = await this.prisma.contrato.findFirst({
      where: whereContrato as never,
      select: {
        id: true,
        kwhContratoMensal: true,
        usinaId: true,
      },
    });

    if (!contrato) {
      await this.sender.enviarMensagem(
        conversa.telefone,
        '⚠️ Nenhum contrato ativo encontrado. Fale com nossa equipe.',
      );
      await this.prisma.conversaWhatsapp.update({
        where: { id: conversa.id },
        data: { estado: 'MENU_COOPERADO' },
      });
      return;
    }

    const kwhAtual = Number(contrato.kwhContratoMensal ?? 0);
    const dadosAtuais = (((conversa as any).dadosTemp) ?? {}) as Record<string, unknown>;
    const dadosNovo = {
      ...dadosAtuais,
      contratoId: contrato.id,
      tipoAlteracao,
      kwhAtual,
      usinaId: contrato.usinaId,
    };

    await this.prisma.conversaWhatsapp.update({
      where: { id: conversa.id },
      data: {
        estado: 'AGUARDANDO_NOVO_KWH',
        dadosTemp: dadosNovo as any,
      },
    });

    const direcao = tipoAlteracao === 'AUMENTAR_KWH' ? 'maior' : 'menor';
    await this.sender.enviarMensagem(
      conversa.telefone,
      `📊 Seu contrato atual: *${kwhAtual} kWh/mês*\n\nDigite o *novo valor em kWh* (${direcao} que ${kwhAtual}):`,
    );

    this.logger.log(
      `${tipoAlteracao}: cooperado ${conversa.cooperadoId} contrato ${contrato.id} kwhAtual=${kwhAtual} (tenant=${cooperativaId ?? 'global'})`,
    );
  }

  private async executarSalvarSolicitacaoKwh(
    conversa: {
      id: string;
      telefone: string;
      cooperadoId?: string | null;
      cooperativaId?: string | null;
      dadosTemp?: any;
    },
    corpo: string,
  ): Promise<void> {
    const dados = (((conversa as any).dadosTemp) ?? {}) as Record<string, unknown>;
    const contratoId = dados.contratoId as string | undefined;
    const tipoAlteracao = dados.tipoAlteracao as 'AUMENTAR_KWH' | 'DIMINUIR_KWH' | undefined;
    const kwhAtual = Number(dados.kwhAtual ?? 0);
    const usinaId = dados.usinaId as string | null | undefined;

    if (!contratoId || !tipoAlteracao || kwhAtual <= 0) {
      this.logger.error(
        `SALVAR_SOLICITACAO_KWH: dadosTemp incompleto (contratoId=${!!contratoId}, tipoAlteracao=${tipoAlteracao}, kwhAtual=${kwhAtual})`,
      );
      await this.sender.enviarMensagem(
        conversa.telefone,
        '⚠️ Sessao incompleta. Volte ao menu e tente de novo.',
      );
      return;
    }

    // Validacao do valor
    const valor = parseInt((corpo ?? '').replace(/\D/g, ''), 10);
    if (!valor || valor <= 0) {
      await this.sender.enviarMensagem(
        conversa.telefone,
        '⚠️ Valor invalido. Digite apenas numeros (kWh/mes):',
      );
      return;
    }

    if (tipoAlteracao === 'AUMENTAR_KWH' && valor <= kwhAtual) {
      await this.sender.enviarMensagem(
        conversa.telefone,
        `⚠️ Valor deve ser *maior* que ${kwhAtual} kWh. Digite outro:`,
      );
      return;
    }
    if (tipoAlteracao === 'DIMINUIR_KWH' && valor >= kwhAtual) {
      await this.sender.enviarMensagem(
        conversa.telefone,
        `⚠️ Valor deve ser *menor* que ${kwhAtual} kWh. Digite outro:`,
      );
      return;
    }

    // Pre-validacao decisao 4: capacidade da usina (so pra AUMENTAR)
    if (tipoAlteracao === 'AUMENTAR_KWH' && usinaId) {
      try {
        const usina = await this.prisma.usina.findUnique({
          where: { id: usinaId },
          select: { capacidadeKwh: true },
        });
        if (usina?.capacidadeKwh) {
          const capacidade = Number(usina.capacidadeKwh);
          const ocupado = await this.prisma.contrato.aggregate({
            where: { usinaId, status: 'ATIVO' as any },
            _sum: { kwhContratoMensal: true },
          });
          const totalOcupado = Number(ocupado._sum?.kwhContratoMensal ?? 0);
          const delta = valor - kwhAtual; // diferenca que o cooperado ta pedindo
          const totalSeAprovado = totalOcupado + delta;
          if (totalSeAprovado > capacidade) {
            const disponivel = Math.max(0, capacidade - totalOcupado);
            await this.sender.enviarMensagem(
              conversa.telefone,
              `⚠️ Sua usina tem ${capacidade} kWh/mês de capacidade, ja ocupada em ${totalOcupado} kWh. O aumento de ${delta} kWh excederia o disponivel (${disponivel} kWh). Procure a equipe pra avaliar outras opcoes.`,
            );
            this.logger.log(
              `SALVAR_SOLICITACAO_KWH AUMENTAR recusado: capacidade ${capacidade}, ocupado ${totalOcupado}, delta ${delta}, total ${totalSeAprovado}`,
            );
            return;
          }
        }
      } catch (err) {
        this.logger.warn(
          `SALVAR_SOLICITACAO_KWH: erro consultando capacidade usina ${usinaId} — ${(err as Error)?.message ?? 'desconhecido'} (segue sem pre-validar)`,
        );
      }
    }

    // Cria solicitacao + notifica + WA cooperado
    const cooperativaId = conversa.cooperativaId;
    if (!conversa.cooperadoId || !cooperativaId) {
      await this.sender.enviarMensagem(
        conversa.telefone,
        '⚠️ Sessao incompleta. Volte ao menu e tente de novo.',
      );
      return;
    }

    let solicitacaoId: string;
    try {
      const sol = await this.prisma.solicitacaoAlteracaoContrato.create({
        data: {
          cooperadoId: conversa.cooperadoId,
          cooperativaId,
          contratoId,
          tipoAlteracao: tipoAlteracao as any,
          valorPropostoKwh: valor,
          status: 'PENDENTE' as any,
        },
      });
      solicitacaoId = sol.id;
    } catch (err) {
      this.logger.error(
        `SALVAR_SOLICITACAO_KWH: solicitacao.create falhou — ${(err as Error)?.message ?? 'desconhecido'}`,
      );
      await this.sender.enviarMensagem(
        conversa.telefone,
        '⚠️ Nao consegui registrar agora. Tente de novo em alguns minutos ou fale com a equipe.',
      );
      return;
    }

    // Notifica equipe (NotificacoesService — persiste pra painel admin)
    try {
      const direcaoTxt = tipoAlteracao === 'AUMENTAR_KWH' ? 'aumentar' : 'diminuir';
      await this.notificacoes.criar({
        tipo: 'SOLICITACAO_ALTERACAO_CONTRATO',
        titulo: `Solicitacao: ${direcaoTxt} kWh`,
        mensagem: `Cooperado pediu ${direcaoTxt} kWh: ${kwhAtual} -> ${valor} kWh/mes.`,
        cooperadoId: conversa.cooperadoId,
        cooperativaId,
        link: `/dashboard/super-admin/solicitacoes/${solicitacaoId}`,
      });
    } catch (err) {
      this.logger.warn(
        `SALVAR_SOLICITACAO_KWH: notificacoes.criar falhou — ${(err as Error)?.message ?? 'desconhecido'} (segue)`,
      );
    }

    // Envia WA `solicitacao_contrato_criada` ao cooperado
    const modelo = await this.prisma.modeloMensagem.findFirst({
      where: {
        nome: 'solicitacao_contrato_criada',
        ...this.filtroTenantSomenteLeitura(cooperativaId),
      },
    });
    const tipoTxt = tipoAlteracao === 'AUMENTAR_KWH' ? 'aumentar kWh' : 'diminuir kWh';
    if (modelo) {
      const vars: Record<string, string> = { tipo: tipoTxt };
      const texto = this.anexarRodape(this.renderizarTemplate(modelo.conteudo, vars));
      await this.sender.enviarMensagem(conversa.telefone, texto);
      await this.modeloMensagem.incrementarUso(modelo.id);
    } else {
      await this.sender.enviarMensagem(
        conversa.telefone,
        `✅ Recebemos sua solicitacao de *${tipoTxt}*. Nossa equipe vai analisar e te avisa em ate 2 dias uteis.`,
      );
    }

    await this.prisma.conversaWhatsapp.update({
      where: { id: conversa.id },
      data: { estado: 'MENU_COOPERADO' },
    });

    this.logger.log(
      `SALVAR_SOLICITACAO_KWH: solicitacao ${solicitacaoId} criada (cooperado=${conversa.cooperadoId}, contrato=${contratoId}, ${tipoAlteracao} ${kwhAtual}->${valor}, tenant=${cooperativaId})`,
    );
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Bloco 5 Etapa B2 (24/05): SUSPENDER + ENCERRAR.
  // Padrao: pre-valida cobranca em aberto (decisao 4) → persiste dadosTemp →
  // transiciona pra etapa intermediaria (motivo). SALVAR cria solicitacao
  // PENDENTE + NotificacoesService + WA cooperado + MENU.
  // ────────────────────────────────────────────────────────────────────────────

  private async executarIniciarSolicitacaoSuspender(
    conversa: {
      id: string;
      telefone: string;
      cooperadoId?: string | null;
      cooperativaId?: string | null;
    },
  ): Promise<void> {
    await this.executarIniciarSolicitacaoBloqueante(conversa, 'SUSPENDER');
  }

  private async executarIniciarSolicitacaoEncerrar(
    conversa: {
      id: string;
      telefone: string;
      cooperadoId?: string | null;
      cooperativaId?: string | null;
    },
  ): Promise<void> {
    await this.executarIniciarSolicitacaoBloqueante(conversa, 'ENCERRAR');
  }

  private async executarIniciarSolicitacaoBloqueante(
    conversa: {
      id: string;
      telefone: string;
      cooperadoId?: string | null;
      cooperativaId?: string | null;
    },
    tipoAlteracao: 'SUSPENDER' | 'ENCERRAR',
  ): Promise<void> {
    if (!conversa.cooperadoId) {
      await this.sender.enviarMensagem(
        conversa.telefone,
        'Para alterar seu contrato voce precisa ser cooperado. Faca seu cadastro pelo bot enviando uma foto da sua conta de luz.',
      );
      this.logger.log(
        `${tipoAlteracao}: telefone ${conversa.telefone} nao e cooperado - mensagem enviada`,
      );
      return;
    }

    const cooperativaId = conversa.cooperativaId ?? undefined;
    const whereContrato: { cooperadoId: string; status: 'ATIVO'; cooperativaId?: string } = {
      cooperadoId: conversa.cooperadoId,
      status: 'ATIVO',
    };
    if (cooperativaId) whereContrato.cooperativaId = cooperativaId;

    const contrato = await this.prisma.contrato.findFirst({
      where: whereContrato as never,
      select: { id: true, kwhContratoMensal: true },
    });

    if (!contrato) {
      await this.sender.enviarMensagem(
        conversa.telefone,
        '⚠️ Nenhum contrato ativo encontrado. Fale com nossa equipe.',
      );
      await this.prisma.conversaWhatsapp.update({
        where: { id: conversa.id },
        data: { estado: 'MENU_COOPERADO' },
      });
      return;
    }

    // Decisao 4: pre-valida cobranca em aberto antes de permitir SUSPENDER/ENCERRAR
    let abertas = 0;
    try {
      abertas = await this.prisma.cobranca.count({
        where: {
          contrato: { cooperadoId: conversa.cooperadoId },
          status: { in: ['A_VENCER', 'VENCIDO'] as any },
          ...(cooperativaId ? { cooperativaId } : {}),
        } as never,
      });
    } catch (err) {
      this.logger.warn(
        `${tipoAlteracao}: erro consultando cobranca em aberto — ${(err as Error)?.message ?? 'desconhecido'} (segue assumindo zero)`,
      );
    }

    if (abertas > 0) {
      const verbo = tipoAlteracao === 'SUSPENDER' ? 'suspender' : 'encerrar';
      await this.sender.enviarMensagem(
        conversa.telefone,
        `⚠️ Voce tem ${abertas} fatura(s) em aberto. Quitar antes de pedir pra ${verbo} o contrato. Volte ao menu pra ver suas faturas.`,
      );
      await this.prisma.conversaWhatsapp.update({
        where: { id: conversa.id },
        data: { estado: 'MENU_COOPERADO' },
      });
      this.logger.log(
        `${tipoAlteracao} recusado: ${abertas} cobrancas em aberto (cooperado=${conversa.cooperadoId}, tenant=${cooperativaId ?? 'global'})`,
      );
      return;
    }

    const dadosAtuais = (((conversa as any).dadosTemp) ?? {}) as Record<string, unknown>;
    const dadosNovo = {
      ...dadosAtuais,
      contratoId: contrato.id,
      tipoAlteracao,
    };

    const estadoNovo =
      tipoAlteracao === 'SUSPENDER' ? 'AGUARDANDO_MOTIVO_SUSPENSAO' : 'CONFIRMAR_ENCERRAMENTO';

    await this.prisma.conversaWhatsapp.update({
      where: { id: conversa.id },
      data: {
        estado: estadoNovo,
        dadosTemp: dadosNovo as any,
      },
    });

    const mensagem =
      tipoAlteracao === 'SUSPENDER'
        ? '📝 Conte o *motivo* da suspensao (ex: "viagem 3 meses", "obra em casa"):'
        : '⚠️ Encerrar o contrato *nao pode ser desfeito*. Tem certeza? Digite o motivo (ou "PULAR" pra nao informar):';

    await this.sender.enviarMensagem(conversa.telefone, mensagem);

    this.logger.log(
      `${tipoAlteracao}: cooperado ${conversa.cooperadoId} contrato ${contrato.id} (tenant=${cooperativaId ?? 'global'})`,
    );
  }

  private async executarSalvarSolicitacaoSuspender(
    conversa: {
      id: string;
      telefone: string;
      cooperadoId?: string | null;
      cooperativaId?: string | null;
      dadosTemp?: any;
    },
    corpo: string,
  ): Promise<void> {
    const motivo = (corpo ?? '').trim() || null;
    await this.executarSalvarSolicitacaoBloqueante(conversa, 'SUSPENDER', motivo);
  }

  private async executarSalvarSolicitacaoEncerrar(
    conversa: {
      id: string;
      telefone: string;
      cooperadoId?: string | null;
      cooperativaId?: string | null;
      dadosTemp?: any;
    },
    corpo: string,
  ): Promise<void> {
    // Decisao 5: "PULAR" (case insensitive) → motivo null
    const limpo = (corpo ?? '').trim();
    const motivo = !limpo || limpo.toUpperCase() === 'PULAR' ? null : limpo;
    await this.executarSalvarSolicitacaoBloqueante(conversa, 'ENCERRAR', motivo);
  }

  private async executarSalvarSolicitacaoBloqueante(
    conversa: {
      id: string;
      telefone: string;
      cooperadoId?: string | null;
      cooperativaId?: string | null;
      dadosTemp?: any;
    },
    tipoAlteracao: 'SUSPENDER' | 'ENCERRAR',
    motivo: string | null,
  ): Promise<void> {
    const dados = (((conversa as any).dadosTemp) ?? {}) as Record<string, unknown>;
    const contratoId = dados.contratoId as string | undefined;
    const cooperativaId = conversa.cooperativaId;

    if (!contratoId || !conversa.cooperadoId || !cooperativaId) {
      this.logger.error(
        `SALVAR_SOLICITACAO_${tipoAlteracao}: sessao incompleta (contratoId=${!!contratoId}, cooperadoId=${!!conversa.cooperadoId}, cooperativaId=${!!cooperativaId})`,
      );
      await this.sender.enviarMensagem(
        conversa.telefone,
        '⚠️ Sessao incompleta. Volte ao menu e tente de novo.',
      );
      return;
    }

    let solicitacaoId: string;
    try {
      const sol = await this.prisma.solicitacaoAlteracaoContrato.create({
        data: {
          cooperadoId: conversa.cooperadoId,
          cooperativaId,
          contratoId,
          tipoAlteracao: tipoAlteracao as any,
          motivo,
          status: 'PENDENTE' as any,
        },
      });
      solicitacaoId = sol.id;
    } catch (err) {
      this.logger.error(
        `SALVAR_SOLICITACAO_${tipoAlteracao}: solicitacao.create falhou — ${(err as Error)?.message ?? 'desconhecido'}`,
      );
      await this.sender.enviarMensagem(
        conversa.telefone,
        '⚠️ Nao consegui registrar agora. Tente de novo em alguns minutos ou fale com a equipe.',
      );
      return;
    }

    // Notifica equipe
    try {
      const acaoTxt = tipoAlteracao === 'SUSPENDER' ? 'suspender' : 'encerrar';
      await this.notificacoes.criar({
        tipo: 'SOLICITACAO_ALTERACAO_CONTRATO',
        titulo: `Solicitacao: ${acaoTxt} contrato`,
        mensagem: motivo
          ? `Cooperado pediu pra ${acaoTxt} contrato. Motivo: ${motivo}`
          : `Cooperado pediu pra ${acaoTxt} contrato (sem motivo informado).`,
        cooperadoId: conversa.cooperadoId,
        cooperativaId,
        link: `/dashboard/super-admin/solicitacoes/${solicitacaoId}`,
      });
    } catch (err) {
      this.logger.warn(
        `SALVAR_SOLICITACAO_${tipoAlteracao}: notificacoes.criar falhou — ${(err as Error)?.message ?? 'desconhecido'} (segue)`,
      );
    }

    // Envia WA cooperado
    const modelo = await this.prisma.modeloMensagem.findFirst({
      where: {
        nome: 'solicitacao_contrato_criada',
        ...this.filtroTenantSomenteLeitura(cooperativaId),
      },
    });
    const tipoTxt = tipoAlteracao === 'SUSPENDER' ? 'suspender contrato' : 'encerrar contrato';
    if (modelo) {
      const vars: Record<string, string> = { tipo: tipoTxt };
      const texto = this.anexarRodape(this.renderizarTemplate(modelo.conteudo, vars));
      await this.sender.enviarMensagem(conversa.telefone, texto);
      await this.modeloMensagem.incrementarUso(modelo.id);
    } else {
      await this.sender.enviarMensagem(
        conversa.telefone,
        `✅ Recebemos sua solicitacao de *${tipoTxt}*. Nossa equipe vai analisar e te avisa em ate 2 dias uteis.`,
      );
    }

    await this.prisma.conversaWhatsapp.update({
      where: { id: conversa.id },
      data: { estado: 'MENU_COOPERADO' },
    });

    this.logger.log(
      `SALVAR_SOLICITACAO_${tipoAlteracao}: solicitacao ${solicitacaoId} criada (cooperado=${conversa.cooperadoId}, contrato=${contratoId}, motivo=${motivo ? 'sim' : 'nao'}, tenant=${cooperativaId})`,
    );
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Bloco 8 (24/05): Menu Fatura — ultimo bloco do Sprint Bot Autoatendimento.
  // VER_FATURA_ATUAL + VER_HISTORICO_PAGAMENTOS = leitura simples.
  // SOLICITAR/SALVAR_CONFIRMACAO_PAGAMENTO = "ja paguei" padrao Bloco 5.
  // SOLICITAR_NEGOCIACAO_HUMANA = link humano via Notificacoes.
  // ────────────────────────────────────────────────────────────────────────────

  private async executarVerFaturaAtual(
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
        'Para consultar sua fatura voce precisa ser cooperado. Faca seu cadastro pelo bot enviando uma foto da sua conta de luz.',
      );
      return;
    }

    const cooperativaId = conversa.cooperativaId ?? undefined;
    const contratoFilter: { cooperadoId: string; cooperativaId?: string } = {
      cooperadoId: conversa.cooperadoId,
    };
    if (cooperativaId) contratoFilter.cooperativaId = cooperativaId;

    const cobranca = await this.prisma.cobranca.findFirst({
      where: {
        contrato: contratoFilter,
        status: { in: ['A_VENCER', 'VENCIDO'] },
      } as never,
      orderBy: { dataVencimento: 'asc' },
      select: {
        id: true,
        status: true,
        valorLiquido: true,
        valorBruto: true,
        dataVencimento: true,
        mesReferencia: true,
        anoReferencia: true,
      },
    });

    if (!cobranca) {
      await this.sender.enviarMensagem(
        conversa.telefone,
        '✅ Voce nao tem nenhuma fatura em aberto no momento. Esta tudo em dia! 💚',
      );
      return;
    }

    const asaas = await this.prisma.asaasCobranca.findFirst({
      where: { cobrancaId: cobranca.id },
      orderBy: { createdAt: 'desc' },
      select: { pixCopiaECola: true, linkPagamento: true, boletoUrl: true },
    });

    const valor = Number(cobranca.valorLiquido ?? cobranca.valorBruto ?? 0).toFixed(2).replace('.', ',');
    const venc = new Date(cobranca.dataVencimento).toLocaleDateString('pt-BR');
    const mesStr = String(cobranca.mesReferencia).padStart(2, '0');
    const statusTxt = cobranca.status === 'VENCIDO' ? '⚠️ VENCIDA' : '📅 A vencer';

    let texto = `📄 *Fatura ${mesStr}/${cobranca.anoReferencia}*\n`;
    texto += `${statusTxt}\n`;
    texto += `💰 Valor: *R$ ${valor}*\n`;
    texto += `📅 Vencimento: ${venc}`;

    if (asaas?.pixCopiaECola) {
      texto += `\n\n*PIX copia-e-cola:*\n\`${asaas.pixCopiaECola}\``;
    }
    if (asaas?.boletoUrl) {
      texto += `\n\n🧾 Boleto: ${asaas.boletoUrl}`;
    }
    if (asaas?.linkPagamento) {
      texto += `\n🔗 Link de pagamento: ${asaas.linkPagamento}`;
    }

    await this.sender.enviarMensagem(conversa.telefone, texto);

    this.logger.log(
      `VER_FATURA_ATUAL: enviado pra ${conversa.telefone} (cooperado=${conversa.cooperadoId}, cobranca=${cobranca.id}, tenant=${cooperativaId ?? 'global'})`,
    );
  }

  private async executarVerHistoricoPagamentos(
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
        'Para consultar seu historico voce precisa ser cooperado. Faca seu cadastro pelo bot enviando uma foto da sua conta de luz.',
      );
      return;
    }

    const cooperativaId = conversa.cooperativaId ?? undefined;
    const contratoFilter: { cooperadoId: string; cooperativaId?: string } = {
      cooperadoId: conversa.cooperadoId,
    };
    if (cooperativaId) contratoFilter.cooperativaId = cooperativaId;

    const cobrancas = await this.prisma.cobranca.findMany({
      where: { contrato: contratoFilter } as never,
      orderBy: { dataVencimento: 'desc' },
      take: 6,
      select: {
        id: true,
        valorLiquido: true,
        status: true,
        dataVencimento: true,
        mesReferencia: true,
        anoReferencia: true,
      },
    });

    if (cobrancas.length === 0) {
      await this.sender.enviarMensagem(
        conversa.telefone,
        'Voce ainda nao tem nenhuma cobranca registrada. 💛',
      );
      return;
    }

    const statusLabel = (s: string): string => {
      switch (s) {
        case 'PAGO':
          return '✅ Pago';
        case 'A_VENCER':
          return '📅 A vencer';
        case 'VENCIDO':
          return '⚠️ Vencido';
        case 'CANCELADO':
          return '❌ Cancelado';
        case 'PENDENTE':
          return '⏳ Pendente';
        default:
          return s;
      }
    };

    let texto = `📜 *Seu historico (ultimas ${cobrancas.length}):*\n\n`;
    for (const c of cobrancas) {
      const mes = String(c.mesReferencia).padStart(2, '0');
      const valor = Number(c.valorLiquido ?? 0).toFixed(2).replace('.', ',');
      const venc = new Date(c.dataVencimento).toLocaleDateString('pt-BR');
      texto += `• ${mes}/${c.anoReferencia} — R$ ${valor} — ${statusLabel(c.status)} (venc. ${venc})\n`;
    }
    texto += '\n_Para detalhes de cada fatura, acesse o portal._';

    await this.sender.enviarMensagem(conversa.telefone, texto);

    this.logger.log(
      `VER_HISTORICO_PAGAMENTOS: ${cobrancas.length} cobrancas enviadas pra ${conversa.telefone} (cooperado=${conversa.cooperadoId}, tenant=${cooperativaId ?? 'global'})`,
    );
  }

  private async executarSolicitarConfirmacaoPagamento(
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
        'Para confirmar pagamento voce precisa ser cooperado. Faca seu cadastro pelo bot.',
      );
      await this.prisma.conversaWhatsapp.update({
        where: { id: conversa.id },
        data: { estado: 'MENU_COOPERADO' },
      });
      return;
    }

    const cooperativaId = conversa.cooperativaId ?? undefined;
    const contratoFilter: { cooperadoId: string; cooperativaId?: string } = {
      cooperadoId: conversa.cooperadoId,
    };
    if (cooperativaId) contratoFilter.cooperativaId = cooperativaId;

    const cobranca = await this.prisma.cobranca.findFirst({
      where: {
        contrato: contratoFilter,
        status: { in: ['A_VENCER', 'VENCIDO'] },
      } as never,
      orderBy: { dataVencimento: 'asc' },
      select: { id: true },
    });

    if (!cobranca) {
      await this.sender.enviarMensagem(
        conversa.telefone,
        '✅ Nao encontramos nenhuma fatura em aberto pra confirmar. Voce esta em dia! 💚',
      );
      await this.prisma.conversaWhatsapp.update({
        where: { id: conversa.id },
        data: { estado: 'MENU_COOPERADO' },
      });
      return;
    }

    const dadosAtuais = (((conversa as any).dadosTemp) ?? {}) as Record<string, unknown>;
    const dadosNovo = {
      ...dadosAtuais,
      cobrancaId: cobranca.id,
    };

    await this.prisma.conversaWhatsapp.update({
      where: { id: conversa.id },
      data: {
        estado: 'AGUARDANDO_FORMA_PAGAMENTO',
        dadosTemp: dadosNovo as any,
      },
    });

    await this.sender.enviarMensagem(
      conversa.telefone,
      '💰 Otimo! Como voce *fez o pagamento*? (ex: "PIX direto", "transferencia", "deposito", "boleto"):',
    );

    this.logger.log(
      `SOLICITAR_CONFIRMACAO_PAGAMENTO: cooperado ${conversa.cooperadoId} cobranca ${cobranca.id} (tenant=${cooperativaId ?? 'global'})`,
    );
  }

  private async executarSalvarConfirmacaoPagamento(
    conversa: {
      id: string;
      telefone: string;
      cooperadoId?: string | null;
      cooperativaId?: string | null;
      dadosTemp?: any;
    },
    corpo: string,
  ): Promise<void> {
    const dados = (((conversa as any).dadosTemp) ?? {}) as Record<string, unknown>;
    const cobrancaId = dados.cobrancaId as string | undefined;
    const cooperativaId = conversa.cooperativaId;
    const formaPagamento = (corpo ?? '').trim();

    if (!cobrancaId || !conversa.cooperadoId || !cooperativaId) {
      this.logger.error(
        `SALVAR_CONFIRMACAO_PAGAMENTO: sessao incompleta (cobrancaId=${!!cobrancaId}, cooperadoId=${!!conversa.cooperadoId}, cooperativaId=${!!cooperativaId})`,
      );
      await this.sender.enviarMensagem(
        conversa.telefone,
        '⚠️ Sessao incompleta. Volte ao menu e tente de novo.',
      );
      return;
    }

    if (!formaPagamento) {
      await this.sender.enviarMensagem(
        conversa.telefone,
        '⚠️ Digite como voce fez o pagamento (ex: "PIX", "transferencia", "deposito"):',
      );
      return;
    }

    let solicitacaoId: string;
    try {
      const sol = await this.prisma.solicitacaoConfirmacaoPagamento.create({
        data: {
          cooperadoId: conversa.cooperadoId,
          cooperativaId,
          cobrancaId,
          formaPagamentoReclamada: formaPagamento,
          status: 'PENDENTE' as any,
        },
      });
      solicitacaoId = sol.id;
    } catch (err) {
      this.logger.error(
        `SALVAR_CONFIRMACAO_PAGAMENTO: create falhou — ${(err as Error)?.message ?? 'desconhecido'}`,
      );
      await this.sender.enviarMensagem(
        conversa.telefone,
        '⚠️ Nao conseguimos registrar agora. Tente de novo em alguns minutos ou fale com a equipe.',
      );
      return;
    }

    try {
      await this.notificacoes.criar({
        tipo: 'SOLICITACAO_CONFIRMACAO_PAGAMENTO',
        titulo: 'Cooperado avisou pagamento',
        mensagem: `Cooperado avisou que pagou. Forma: ${formaPagamento}.`,
        cooperadoId: conversa.cooperadoId,
        cooperativaId,
        link: `/dashboard/super-admin/solicitacoes/${solicitacaoId}`,
      });
    } catch (err) {
      this.logger.warn(
        `SALVAR_CONFIRMACAO_PAGAMENTO: notificacoes.criar falhou — ${(err as Error)?.message ?? 'desconhecido'} (segue)`,
      );
    }

    await this.sender.enviarMensagem(
      conversa.telefone,
      '✅ Recebemos sua *confirmacao de pagamento*. Nossa equipe vai conferir com o banco/gateway e te avisa em ate 2 dias uteis. Obrigado! 💚',
    );

    await this.prisma.conversaWhatsapp.update({
      where: { id: conversa.id },
      data: { estado: 'MENU_COOPERADO' },
    });

    this.logger.log(
      `SALVAR_CONFIRMACAO_PAGAMENTO: solicitacao ${solicitacaoId} criada (cooperado=${conversa.cooperadoId}, cobranca=${cobrancaId}, forma=${formaPagamento}, tenant=${cooperativaId})`,
    );
  }

  private async executarSolicitarNegociacaoHumana(
    conversa: {
      id: string;
      telefone: string;
      cooperadoId?: string | null;
      cooperativaId?: string | null;
    },
  ): Promise<void> {
    const cooperativaId = conversa.cooperativaId;

    if (conversa.cooperadoId && cooperativaId) {
      try {
        await this.notificacoes.criar({
          tipo: 'NEGOCIACAO_HUMANA',
          titulo: 'Cooperado quer negociar',
          mensagem:
            'Cooperado pediu pra negociar / pedir mais prazo na fatura. Entre em contato em ate 1 dia util.',
          cooperadoId: conversa.cooperadoId,
          cooperativaId,
          link: `/dashboard/cooperados/${conversa.cooperadoId}`,
        });
      } catch (err) {
        this.logger.warn(
          `SOLICITAR_NEGOCIACAO_HUMANA: notificacoes.criar falhou — ${(err as Error)?.message ?? 'desconhecido'} (segue)`,
        );
      }
    }

    await this.sender.enviarMensagem(
      conversa.telefone,
      '💛 Entendi! Vou *te conectar com a equipe*. Em ate 1 dia util alguem entra em contato pra negociar prazo/parcelamento. Obrigado pela confianca!',
    );

    await this.prisma.conversaWhatsapp.update({
      where: { id: conversa.id },
      data: { estado: 'MENU_COOPERADO' },
    });

    this.logger.log(
      `SOLICITAR_NEGOCIACAO_HUMANA: cooperado ${conversa.cooperadoId ?? 'sem-cooperado'} (tenant=${cooperativaId ?? 'global'})`,
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
      // Bloco 2 (21/05): {{telefone}} usado em proxy_confirmar (telefone do
      // indicado/amigo). Bot Bloco 6 (Cadastro Proxy) salvara dadosTemp.telefone
      // ao chegar no estado CONFIRMAR_PROXY. Vazio quando ausente.
      telefone: String(dados.telefone ?? ''),
      // Bloco 0 v2 (21/05): {{historico}} formatado igual ao bot hardcoded
      // (whatsapp-bot.service.ts:1543-1550). Fonte: dadosTemp.historicoConsumo
      // (array salvo pelo OCR em whatsapp-fatura.service.ts e propagado em
      // dadosTemp via spread no bot). Vazio em simulacao sem OCR.
      historico: this.formatarHistoricoConsumo(dados.historicoConsumo),
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

  /**
   * Bloco 0 v2 (21/05) — Formata `dadosTemp.historicoConsumo` (array do OCR) em
   * string multilinha igual ao bot hardcoded (whatsapp-bot.service.ts:1543-1550).
   * Formato por linha: "MM/AA: NNN kWh - R$ X,XX". Retorna '' quando array
   * ausente ou vazio (caso comum no simulador sem OCR).
   */
  private formatarHistoricoConsumo(
    raw: unknown,
  ): string {
    if (!Array.isArray(raw) || raw.length === 0) return '';
    const linhas: string[] = [];
    for (const item of raw) {
      if (!item || typeof item !== 'object') continue;
      const h = item as { mesAno?: unknown; consumoKwh?: unknown; valorRS?: unknown };
      const mesAno = String(h.mesAno ?? '');
      const consumoKwh = Number(h.consumoKwh ?? 0);
      const valorRS = Number(h.valorRS ?? 0);
      if (!mesAno || consumoKwh <= 0) continue;
      const valorStr = valorRS > 0 ? ` - R$ ${valorRS.toFixed(2).replace('.', ',')}` : '';
      linhas.push(`${mesAno}: ${consumoKwh} kWh${valorStr}`);
    }
    return linhas.join('\n');
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
    comando: 'INICIO' | 'SAIR' | 'MENU' | 'CHAMAR_DEPOIS',
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

    // Bloco 1.b (22/05) — CHAMAR_DEPOIS no simulador: zero side-effect. Mostra
    // que a conversa iria pra AGENDADO_RETORNO e o bot voltaria a chamar em
    // ~24h (postergado pra 08:00 se cair fora de 08-18h).
    if (comando === 'CHAMAR_DEPOIS') {
      return {
        estadoInicial,
        estadoFinal: 'AGENDADO_RETORNO',
        transicionou: true,
        gatilhoAvaliado: null,
        motivoFallback: null,
        mensagensEnviadas: [],
        acaoAutomatica: null,
        etapaAtual: etapaAtualResumo,
        etapaProxima: null,
        mensagemEtapaAtual,
        avisoTransicao:
          'Conversa pausada via "ME CHAME DEPOIS". No WhatsApp real, o bot voltaria a chamar em ~24h (postergado pra 08:00 se cair fora do horario comercial 08-18h).',
        comandoUniversalAplicado: 'CHAMAR_DEPOIS',
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
  comandoUniversalAplicado: 'INICIO' | 'SAIR' | 'MENU' | 'CHAMAR_DEPOIS' | null;
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
