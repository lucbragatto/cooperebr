import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../prisma.service';
import { FaturasService } from '../faturas/faturas.service';
import { MotorPropostaService } from '../motor-proposta/motor-proposta.service';
import { ConfigTenantService } from '../config-tenant/config-tenant.service';
import { IndicacoesService } from '../indicacoes/indicacoes.service';
import { WhatsappSenderService, MenuInterativo } from './whatsapp-sender.service';
import { WhatsappCobrancaService } from './whatsapp-cobranca.service';
import { ModeloMensagemService } from './modelo-mensagem.service';
import { WhatsappFluxoMotorService } from './whatsapp-fluxo-motor.service';
import { WhatsappCicloVidaService } from './whatsapp-ciclo-vida.service';

interface MensagemRecebida {
  telefone: string;
  tipo: 'texto' | 'imagem' | 'documento' | 'audio' | 'video' | 'sticker' | 'location';
  corpo?: string;
  mediaBase64?: string;
  mimeType?: string;
  /** ID do botÃ£o clicado (buttonResponseMessage) ou rowId da lista selecionada */
  selectedButtonId?: string;
}

// Palavras imprÃ³prias (ofensas genÃ©ricas para detecÃ§Ã£o)
const PALAVRAS_IMPROPRIAS = [
  'porra', 'caralho', 'merda', 'foda', 'puta', 'fdp', 'cuzÃ£o', 'arrombado',
  'desgraÃ§a', 'buceta', 'viado', 'vagabund', 'safad', 'lixo', 'idiota', 'imbecil',
  'otÃ¡rio', 'bosta', 'cu ', 'vtnc', 'vsf', 'pqp', 'tnc',
];

@Injectable()
export class WhatsappBotService {
  private readonly logger = new Logger(WhatsappBotService.name);

  constructor(
    private prisma: PrismaService,
    private faturasService: FaturasService,
    private motorProposta: MotorPropostaService,
    private configTenant: ConfigTenantService,
    @Inject(forwardRef(() => IndicacoesService)) private indicacoes: IndicacoesService,
    private sender: WhatsappSenderService,
    private cobrancaService: WhatsappCobrancaService,
    private modelos: ModeloMensagemService,
    private fluxoMotor: WhatsappFluxoMotorService,
    private cicloVida: WhatsappCicloVidaService,
    private eventEmitter: EventEmitter2,
  ) {}

  /** Busca texto do banco de mensagens ou usa fallback hardcoded */
  private async msg(nome: string, variaveis: Record<string, string> = {}, fallback: string): Promise<string> {
    try {
      const modelo = await this.modelos.findByNome(nome);
      if (modelo) {
        this.modelos.incrementarUso(modelo.id);
        return this.modelos.renderizar(modelo, variaveis);
      }
    } catch (err) {
      this.logger.warn(`Fallback para mensagem '${nome}': ${err.message}`);
    }
    // Fallback: substituir variÃ¡veis manualmente no texto hardcoded
    let texto = fallback;
    for (const [k, v] of Object.entries(variaveis)) {
      texto = texto.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), v);
    }
    return texto;
  }

  async processarMensagem(msg: MensagemRecebida): Promise<void> {
    const { telefone } = msg;
    const corpo = (msg.corpo ?? '').trim();

    // Registrar mensagem recebida
    try {
      await this.prisma.mensagemWhatsapp.create({
        data: {
          telefone,
          direcao: 'ENTRADA',
          tipo: msg.tipo ?? 'texto',
          conteudo: corpo || null,
          status: 'RECEBIDA',
        },
      });
    } catch (err) {
      this.logger.warn(`Falha ao registrar mensagem recebida: ${err.message}`);
    }

    // Espelhar para observadores ativos (Modo Observador) via evento
    this.eventEmitter.emit('whatsapp.mensagem.recebida', {
      telefone,
      texto: corpo || '[mÃ­dia]',
      direcao: 'RECEBIDA' as const,
    });

    // Se mensagem chegou sem texto e sem mÃ­dia, ignorar silenciosamente
    if (!corpo && msg.tipo === 'texto') {
      this.logger.warn(`Mensagem sem conteÃºdo de ${telefone} â€” ignorada`);
      return;
    }

    // Buscar ou criar conversa (upsert atÃ´mico para evitar race condition)
    const conversa = await this.prisma.conversaWhatsapp.upsert({
      where: { telefone },
      update: {},
      create: { telefone, estado: 'INICIAL' },
    });

    // Fallback: palavras-chave especiais
    const corpoLower = corpo.toLowerCase();
    if (['cancelar', 'cancel'].includes(corpoLower)) {
      await this.resetarConversa(telefone);
      const texto = await this.msg('cancelar', {}, 'Tudo bem! Se quiser comeÃ§ar novamente, Ã© sÃ³ mandar a foto da sua conta de luz. ðŸ˜Š');
      await this.sender.enviarMensagem(telefone, texto);
      return;
    }

    if (['ajuda', 'duvida', 'dÃºvida', 'problema', 'erro', 'help', 'menu'].includes(corpoLower)) {
      if (corpoLower === 'menu' || corpoLower === 'ajuda' || corpoLower === 'help') {
        await this.handleMenuPrincipalInicio(msg, conversa);
        return;
      }
      const texto = await this.msg('ajuda', {}, 'Estou aqui para ajudar! Para falar com nossa equipe, acesse: cooperebr.com.br\n\nOu envie a foto da sua conta de luz para gerar uma simulaÃ§Ã£o gratuita! ðŸ“¸');
      await this.sender.enviarMensagem(telefone, texto);
      return;
    }

    // â”€â”€â”€ Ãudio â†’ sÃ³ aceita texto â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    if (msg.tipo === 'audio') {
      await this.sender.enviarMensagem(
        telefone,
        'ðŸŽ¤ Desculpe, no momento sÃ³ consigo processar mensagens de *texto*.\n\nPor favor, digite sua mensagem. Se preferir, envie *menu* para ver as opÃ§Ãµes disponÃ­veis.',
      );
      return;
    }

    // â”€â”€â”€ Foto/documento fora de contexto (sticker, vÃ­deo, location) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    if (['video', 'sticker', 'location'].includes(msg.tipo)) {
      await this.sender.enviarMensagem(
        telefone,
        'ðŸ“Ž Este tipo de mÃ­dia nÃ£o Ã© suportado.\n\nPara enviar documentos, acesse o *Portal do Cooperado*:\nðŸ‘‰ cooperebr.com.br/portal\n\nOu digite *menu* para ver as opÃ§Ãµes.',
      );
      return;
    }

    // â”€â”€â”€ Linguagem inapropriada â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    if (corpo && PALAVRAS_IMPROPRIAS.some(p => corpoLower.includes(p))) {
      await this.sender.enviarMensagem(
        telefone,
        'ðŸ™ Entendo sua frustraÃ§Ã£o. Estamos aqui para ajudar da melhor forma possÃ­vel.\n\nPor favor, nos diga como podemos resolver sua questÃ£o. Se preferir, posso encaminhÃ¡-lo para um atendente humano.\n\nDigite *3* para falar com um atendente.',
      );
      return;
    }

    // â”€â”€â”€ Pedido de cancelamento/desligamento â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    if (
      corpoLower.includes('cancelar assinatura') ||
      corpoLower.includes('desligamento') ||
      corpoLower.includes('quero sair') ||
      corpoLower.includes('quero cancelar meu') ||
      corpoLower.includes('encerrar contrato') ||
      corpoLower.includes('desligar da cooperativa')
    ) {
      await this.sender.enviarMensagem(
        telefone,
        'âš ï¸ *SolicitaÃ§Ã£o de desligamento*\n\n' +
        'Sentimos muito que queira nos deixar. Para solicitar o desligamento:\n\n' +
        '1ï¸âƒ£ Acesse o portal: cooperebr.com.br/portal/desligamento\n' +
        '2ï¸âƒ£ Preencha o formulÃ¡rio de desligamento\n' +
        '3ï¸âƒ£ Nossa equipe processarÃ¡ em atÃ© 30 dias\n\n' +
        'Se quiser conversar sobre isso antes, digite *3* para falar com um atendente.',
      );
      return;
    }

    // â”€â”€â”€ Perguntas sobre tarifa/preÃ§o â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    if (
      corpoLower.includes('tarifa') ||
      corpoLower.includes('preÃ§o') ||
      corpoLower.includes('preco') ||
      corpoLower.includes('quanto custa') ||
      corpoLower.includes('valor da') ||
      corpoLower.includes('tabela de preÃ§o') ||
      corpoLower.includes('quanto pago') ||
      corpoLower.includes('qual o valor')
    ) {
      await this.sender.enviarMensagem(
        telefone,
        'ðŸ’° *BenefÃ­cios CoopereBR:*\n\n' +
        'ðŸŒ± Desconto de atÃ© *20%* na conta de energia\n' +
        'â˜€ï¸ Energia 100% solar e sustentÃ¡vel\n' +
        'ðŸ“Š Sem investimento inicial\n' +
        'ðŸ“‹ Sem obras ou instalaÃ§Ã£o\n' +
        'ðŸ”„ Cancelamento sem multa\n\n' +
        'ðŸ“¸ Quer saber exatamente quanto vai economizar?\n' +
        'Envie a *foto da sua conta de luz* e faÃ§o uma simulaÃ§Ã£o personalizada!\n\n' +
        'Ou digite *2* para iniciar seu cadastro.',
      );
      return;
    }

    // â”€â”€â”€ NÃºmero de protocolo â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const protocoloMatch = corpo.match(/^(?:protocolo\s*)?(?:#?\s*)?(PROT-[\w-]+|[A-Z]{2,4}-\d{4,}[-\w]*)/i);
    if (protocoloMatch) {
      const protocolo = protocoloMatch[1].toUpperCase();
      // Buscar contrato pelo protocolo
      const contrato = await this.prisma.contrato.findFirst({
        where: {
          OR: [
            { numero: protocolo },
            { numero: { contains: protocolo } },
          ],
        },
        include: { cooperado: { select: { nomeCompleto: true } } },
      });

      if (contrato) {
        const statusLabel: Record<string, string> = {
          PENDENTE_ATIVACAO: 'ðŸŸ¡ Pendente de ativaÃ§Ã£o',
          EM_APROVACAO: 'ðŸŸ¡ Em aprovaÃ§Ã£o',
          ATIVO: 'ðŸŸ¢ Ativo',
          SUSPENSO: 'ðŸ”´ Suspenso',
          ENCERRADO: 'âšª Encerrado',
        };
        await this.sender.enviarMensagem(
          telefone,
          `ðŸ“‹ *Status do protocolo ${protocolo}:*\n\n` +
          `ðŸ‘¤ ${contrato.cooperado?.nomeCompleto ?? 'N/A'}\n` +
          `ðŸ“Š Status: ${statusLabel[contrato.status] ?? contrato.status}\n` +
          `ðŸ“… InÃ­cio: ${new Date(contrato.dataInicio).toLocaleDateString('pt-BR')}\n\n` +
          `Para mais detalhes, acesse o portal ou digite *menu*.`,
        );
      } else {
        await this.sender.enviarMensagem(
          telefone,
          `ðŸ” Protocolo *${protocolo}* nÃ£o encontrado.\n\nVerifique o nÃºmero e tente novamente, ou digite *3* para falar com um atendente.`,
        );
      }
      return;
    }

    // â”€â”€â”€ Verificar horÃ¡rio de atendimento (20h-8h) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const agora = new Date();
    // Converter para horÃ¡rio de BrasÃ­lia (UTC-3)
    const horaBrasilia = new Date(agora.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
    const hora = horaBrasilia.getHours();
    if (hora >= 20 || hora < 8) {
      // Fora do expediente â€” ainda processa a mensagem mas avisa sobre atraso
      await this.sender.enviarMensagem(
        telefone,
        'ðŸŒ™ *Atendimento fora do horÃ¡rio comercial*\n\n' +
        'Nosso horÃ¡rio de atendimento humano Ã© de *segunda a sexta, das 8h Ã s 20h*.\n\n' +
        'Sua mensagem foi registrada e serÃ¡ respondida no prÃ³ximo dia Ãºtil.\n\n' +
        'Enquanto isso, vocÃª pode:\n' +
        'ðŸ“¸ Enviar foto da fatura para simulaÃ§Ã£o automÃ¡tica\n' +
        'ðŸŒ Acessar o portal: cooperebr.com.br/portal\n\n' +
        'Ou digite *menu* para ver as opÃ§Ãµes do bot.',
      );
      // NÃ£o faz return â€” continua processando normalmente (simulaÃ§Ã£o funciona 24h)
    }

    // â”€â”€â”€ Verificar timeout de sessÃ£o (30min sem atividade) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    if (conversa.updatedAt) {
      const ultimaAtividade = new Date(conversa.updatedAt);
      const diffMs = agora.getTime() - ultimaAtividade.getTime();
      const diffMin = diffMs / (1000 * 60);
      if (diffMin > 30 && conversa.estado !== 'INICIAL' && conversa.estado !== 'CONCLUIDO') {
        await this.prisma.conversaWhatsapp.update({
          where: { id: conversa.id },
          data: { estado: 'INICIAL', contadorFallback: 0 },
        });
        await this.sender.enviarMensagem(
          telefone,
          'â° Sua sessÃ£o anterior expirou por inatividade.\n\n' +
          'Vamos recomeÃ§ar? Digite *menu* para ver as opÃ§Ãµes ou envie a *foto da sua fatura* para simular.',
        );
        return;
      }
    }

    // â”€â”€â”€ Foto/documento em estados de menu â†’ instruir portal â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    if (
      (msg.tipo === 'imagem' || msg.tipo === 'documento') &&
      msg.mediaBase64 &&
      ['MENU_PRINCIPAL', 'MENU_COOPERADO', 'MENU_CLIENTE', 'MENU_CONVITE', 'AGUARDANDO_ATENDENTE'].includes(conversa.estado)
    ) {
      // Se estÃ¡ em menu, redireciona para fluxo de fatura
      await this.prisma.conversaWhatsapp.update({
        where: { id: conversa.id },
        data: { estado: 'INICIAL' },
      });
      const conversaAtualizada = await this.prisma.conversaWhatsapp.findUnique({ where: { telefone } });
      await this.handleInicial(msg, conversaAtualizada);
      return;
    }

    // â”€â”€â”€ Palavras-chave de fatura/boleto â†’ MENU_FATURA â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    // SÃ³ redireciona se nÃ£o houver fluxo ativo em andamento (WA-BOT-01)
    const ESTADOS_FLUXO_ATIVO = [
      'AGUARDANDO_CPF', 'AGUARDANDO_NOME', 'AGUARDANDO_EMAIL',
      'AGUARDANDO_CONFIRMACAO_DADOS', 'AGUARDANDO_CONFIRMACAO_PROPOSTA',
      'AGUARDANDO_CONFIRMACAO_CADASTRO', 'AGUARDANDO_FOTO_FATURA',
      'AGUARDANDO_COMPROVANTE_PAGAMENTO', 'AGUARDANDO_DISPOSITIVO_EMAIL',
      'AGUARDANDO_DISTRIBUIDORA', 'AGUARDANDO_VALOR_FATURA',
      'AGUARDANDO_NOVO_NOME', 'AGUARDANDO_NOVO_EMAIL',
      'AGUARDANDO_NOVO_TELEFONE', 'AGUARDANDO_NOVO_CEP', 'AGUARDANDO_NOVO_KWH',
      'AGUARDANDO_FATURA_PROXY', 'AGUARDANDO_ATENDENTE',
      'CADASTRO_EXPRESS_NOME', 'CADASTRO_EXPRESS_CPF', 'CADASTRO_EXPRESS_EMAIL',
      'CADASTRO_EXPRESS_VALOR_FATURA', 'CADASTRO_PROXY_NOME', 'CADASTRO_PROXY_TELEFONE',
      'NEGOCIACAO_PARCELAMENTO', 'CONFIRMAR_ENCERRAMENTO',
    ];
    if (['fatura', 'faturas', 'boleto', '2a via', '2Âª via', 'segunda via', 'pix', 'pagar'].includes(corpoLower)) {
      if (ESTADOS_FLUXO_ATIVO.includes(conversa.estado)) {
        await this.sender.enviarMensagem(
          telefone,
          'â³ VocÃª estÃ¡ no meio de um processo. Por favor, conclua a etapa atual ou digite *cancelar* para recomeÃ§ar.',
        );
        return;
      }
      await this.prisma.conversaWhatsapp.upsert({
        where: { telefone },
        update: { estado: 'MENU_FATURA' },
        create: { telefone, estado: 'MENU_FATURA' },
      });
      const conversaAtualizada = await this.prisma.conversaWhatsapp.findUnique({ where: { telefone } });
      await this.handleMenuFatura({ ...msg, corpo: '' }, conversaAtualizada!);
      return;
    }

    // Motor dinÃ¢mico â€” processa apenas a etapa atual e aguarda prÃ³xima resposta (WA-15)
    try {
      const processou = await this.fluxoMotor.processarComFluxoDinamico(msg as any, conversa);
      if (processou) return;
    } catch (err) {
      this.logger.warn(`Erro no motor dinÃ¢mico, fallback hardcoded: ${err.message}`);
    }

    try {
      switch (conversa.estado) {
        case 'INICIAL':
          await this.handleInicial(msg, conversa);
          break;
        case 'AGUARDANDO_CONFIRMACAO_DADOS':
          await this.handleConfirmacaoDados(msg, conversa);
          break;
        case 'AGUARDANDO_CONFIRMACAO_PROPOSTA':
          await this.handleConfirmacaoProposta(msg, conversa);
          break;
        case 'AGUARDANDO_CONFIRMACAO_CADASTRO':
          await this.handleConfirmacaoCadastro(msg, conversa);
          break;
        case 'MENU_FATURA':
          await this.handleRespostaMenuFatura(msg, conversa);
          break;
        case 'AGUARDANDO_COMPROVANTE_PAGAMENTO':
          await this.handleComprovantePagamento(msg, conversa);
          break;
        case 'CONCLUIDO':
          await this.handleConcluido(msg);
          break;
        // â”€â”€â”€ Fluxo convite por indicaÃ§Ã£o â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        case 'MENU_CONVITE':
          await this.handleMenuConvite(msg, conversa);
          break;
        case 'AGUARDANDO_FOTO_FATURA':
          await this.handleAguardandoFotoFatura(msg, conversa);
          break;
        case 'AGUARDANDO_NOME':
          await this.handleAguardandoNome(msg, conversa);
          break;
        case 'AGUARDANDO_CPF':
          await this.handleAguardandoCpf(msg, conversa);
          break;
        case 'AGUARDANDO_EMAIL':
          await this.handleAguardandoEmail(msg, conversa);
          break;
        // â”€â”€â”€ Menu conversacional completo â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        case 'MENU_PRINCIPAL':
          await this.handleMenuPrincipal(msg, conversa);
          break;
        case 'MENU_COOPERADO':
          await this.handleMenuCooperado(msg, conversa);
          break;
        case 'MENU_SEM_FATURA':
          await this.handleMenuSemFatura(msg, conversa);
          break;
        case 'AGUARDANDO_DISPOSITIVO_EMAIL':
          await this.handleAguardandoDispositivoEmail(msg, conversa);
          break;
        case 'AGUARDANDO_DISTRIBUIDORA':
          await this.handleAguardandoDistribuidora(msg, conversa);
          break;
        case 'MENU_CLIENTE':
          await this.handleMenuCliente(msg, conversa);
          break;
        case 'AGUARDANDO_ATENDENTE':
          await this.handleAguardandoAtendente(msg, conversa);
          break;
        // â”€â”€â”€ Rotina 1: QR Code / Propaganda â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        case 'MENU_QR_PROPAGANDA':
          await this.handleMenuQrPropaganda(msg, conversa);
          break;
        case 'AGUARDANDO_VALOR_FATURA':
          await this.handleAguardandoValorFatura(msg, conversa);
          break;
        case 'RESULTADO_SIMULACAO_RAPIDA':
          await this.handleResultadoSimulacaoRapida(msg, conversa);
          break;
        // â”€â”€â”€ Rotina 2: Inadimplente â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        case 'MENU_INADIMPLENTE':
          await this.handleMenuInadimplente(msg, conversa);
          break;
        case 'NEGOCIACAO_PARCELAMENTO':
          await this.handleNegociacaoParcelamento(msg, conversa);
          break;
        // â”€â”€â”€ Rotina 3: Convite indicaÃ§Ã£o melhorado â”€â”€â”€â”€â”€â”€
        case 'MENU_CONVITE_INDICACAO':
          await this.handleMenuConviteIndicacao(msg, conversa);
          break;
        case 'CADASTRO_EXPRESS_NOME':
          await this.handleCadastroExpressNome(msg, conversa);
          break;
        case 'CADASTRO_EXPRESS_CPF':
          await this.handleCadastroExpressCpf(msg, conversa);
          break;
        case 'CADASTRO_EXPRESS_EMAIL':
          await this.handleCadastroExpressEmail(msg, conversa);
          break;
        case 'CADASTRO_EXPRESS_VALOR_FATURA':
          await this.handleCadastroExpressValorFatura(msg, conversa);
          break;
        case 'LEAD_FORA_AREA':
          await this.handleLeadForaArea(msg, conversa);
          break;
        // â”€â”€â”€ AtualizaÃ§Ã£o de cadastro/contrato â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        case 'ATUALIZACAO_CADASTRO':
          await this.handleAtualizacaoCadastro(msg, conversa);
          break;
        case 'AGUARDANDO_NOVO_NOME':
          await this.handleAguardandoNovoNome(msg, conversa);
          break;
        case 'AGUARDANDO_NOVO_EMAIL':
          await this.handleAguardandoNovoEmail(msg, conversa);
          break;
        case 'AGUARDANDO_NOVO_TELEFONE':
          await this.handleAguardandoNovoTelefone(msg, conversa);
          break;
        case 'AGUARDANDO_NOVO_CEP':
          await this.handleAguardandoNovoCep(msg, conversa);
          break;
        case 'ATUALIZACAO_CONTRATO':
          await this.handleAtualizacaoContrato(msg, conversa);
          break;
        case 'AGUARDANDO_NOVO_KWH':
          await this.handleAguardandoNovoKwh(msg, conversa);
          break;
        case 'CONFIRMAR_ENCERRAMENTO':
          await this.handleConfirmarEncerramento(msg, conversa);
          break;
        // â”€â”€â”€ Cadastro por Proxy â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        case 'MENU_CONVIDAR_AMIGO':
          await this.handleMenuConvidarAmigo(msg, conversa);
          break;
        case 'CADASTRO_PROXY_NOME':
          await this.handleCadastroProxyNome(msg, conversa);
          break;
        case 'CADASTRO_PROXY_TELEFONE':
          await this.handleCadastroProxyTelefone(msg, conversa);
          break;
        case 'AGUARDANDO_FATURA_PROXY':
          await this.handleAguardandoFaturaProxy(msg, conversa);
          break;
        case 'CONFIRMAR_PROXY':
          await this.handleConfirmarProxy(msg, conversa);
          break;
        case 'NPS_AGUARDANDO_NOTA':
          await this.handleNpsNota(msg, conversa);
          break;
        default:
          await this.handleMenuPrincipalInicio(msg, conversa);
      }
    } catch (err) {
      this.logger.error(`Erro ao processar mensagem de ${telefone}: ${err.message}`, err.stack);
      await this.sender.enviarMensagem(
        telefone,
        'Desculpe, ocorreu um erro ao processar sua mensagem. Tente novamente em alguns instantes ou envie outra foto da fatura. ðŸ˜Š',
      );
    }
  }

  /** Extrai o ID efetivo: prioriza selectedButtonId (botÃ£o/lista), senÃ£o usa texto */
  private respostaEfetiva(msg: MensagemRecebida): string {
    return msg.selectedButtonId?.trim() || (msg.corpo ?? '').trim();
  }

  // â”€â”€â”€ MENU PRINCIPAL â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  private async handleMenuPrincipalInicio(msg: MensagemRecebida, conversa: any): Promise<void> {
    const { telefone } = msg;
    await this.prisma.conversaWhatsapp.update({
      where: { id: conversa.id },
      data: { estado: 'MENU_PRINCIPAL', contadorFallback: 0 },
    });
    await this.sender.enviarMenuComBotoes(telefone, {
      titulo: 'Menu Principal',
      corpo: 'ðŸ‘‹ OlÃ¡! Sou o assistente da *CoopereBR* â€” energia solar para todos.\n\nComo posso ajudar?',
      opcoes: [
        { id: '1', texto: 'ðŸ“‹ JÃ¡ sou cooperado' },
        { id: '2', texto: 'âš¡ Quero ser cooperado' },
        { id: '3', texto: 'ðŸ‘¤ Falar com atendente' },
        { id: '4', texto: 'ðŸŽ Convidar um amigo', descricao: 'Compartilhe seu link' },
      ],
    });
  }

  private async handleMenuPrincipal(msg: MensagemRecebida, conversa: any): Promise<void> {
    const { telefone } = msg;
    const resposta = this.respostaEfetiva(msg);
    const corpo = resposta;

    if (corpo === '1' || corpo.toLowerCase().includes('sou cooperado') || corpo.toLowerCase().includes('jÃ¡ sou')) {
      // Verificar se Ã© cooperado
      const telefoneNorm = telefone.replace(/\D/g, '');
      const telefoneSemPais = telefoneNorm.replace(/^55/, '');
      const cooperado = await this.prisma.cooperado.findFirst({
        where: {
          OR: [{ telefone: telefoneNorm }, { telefone: telefoneSemPais }, { telefone: `55${telefoneSemPais}` }],
          status: { in: ['ATIVO', 'AGUARDANDO_CONCESSIONARIA', 'AGUARDANDO_DOCUMENTOS'] as any[] },
        },
        select: { id: true, nomeCompleto: true, status: true },
      });

      if (!cooperado) {
        await this.sender.enviarMensagem(telefone, 'âš ï¸ NÃ£o encontrei seu cadastro ativo.\n\nSe vocÃª se cadastrou recentemente, aguarde nosso contato. Ou:\n\n1ï¸âƒ£ Iniciar novo cadastro\n2ï¸âƒ£ Falar com atendente');
        await this.prisma.conversaWhatsapp.update({ where: { id: conversa.id }, data: { estado: 'MENU_CLIENTE', contadorFallback: 0 } });
        return;
      }

      await this.prisma.conversaWhatsapp.update({
        where: { id: conversa.id },
        data: { estado: 'MENU_COOPERADO', cooperadoId: cooperado.id, contadorFallback: 0 },
      });
      await this.sender.enviarMenuComBotoes(telefone, {
        titulo: 'Menu do Cooperado',
        corpo: `âœ… OlÃ¡, *${cooperado.nomeCompleto || 'Cooperado'}*! O que vocÃª precisa?`,
        opcoes: [
          { id: '1', texto: 'âš¡ Ver saldo de crÃ©ditos', descricao: 'Seus kWh contratados' },
          { id: '2', texto: 'ðŸ“„ Ver prÃ³xima fatura', descricao: 'Valor e vencimento' },
          { id: '3', texto: 'âœï¸ Atualizar meu cadastro', descricao: 'Nome, email, telefone, endereÃ§o' },
          { id: '4', texto: 'ðŸ”„ Atualizar meu contrato', descricao: 'kWh, suspensÃ£o, encerramento' },
          { id: '5', texto: 'ðŸŽ Indicar um amigo', descricao: 'Ganhe desconto na fatura' },
          { id: '6', texto: 'ðŸ”§ Suporte / OcorrÃªncia', descricao: 'Abrir chamado' },
          { id: '7', texto: 'ðŸ‘¤ Falar com atendente', descricao: 'Atendimento humano' },
        ],
      });
      return;
    }

    if (corpo === '2' || corpo.toLowerCase().includes('quero ser') || corpo.toLowerCase().includes('quero aderir')) {
      await this.prisma.conversaWhatsapp.update({
        where: { id: conversa.id },
        data: { estado: 'MENU_SEM_FATURA', contadorFallback: 0 },
      });
      await this.sender.enviarMenuComBotoes(telefone, {
        titulo: 'SimulaÃ§Ã£o gratuita',
        corpo: 'âš¡ Ã“timo! Para gerar sua simulaÃ§Ã£o gratuita, preciso da sua *conta de energia elÃ©trica*.\n\nComo prefere proceder?',
        opcoes: [
          { id: '1', texto: 'ðŸ“Ž Enviar agora', descricao: 'JÃ¡ tenho a fatura (foto ou PDF)' },
          { id: '2', texto: 'ðŸ“§ EstÃ¡ no meu email', descricao: 'Vou buscar e enviar' },
          { id: '3', texto: 'ðŸ’» Baixar do site', descricao: 'Te ajudo passo a passo' },
        ],
      });
      return;
    }

    if (corpo === '3' || corpo.toLowerCase().includes('atendente') || corpo.toLowerCase().includes('humano')) {
      await this.encaminharAtendente(telefone, conversa.id, 'Solicitou atendente no menu principal');
      return;
    }

    if (corpo === '4' || corpo.toLowerCase().includes('convidar') || corpo.toLowerCase().includes('indicar amigo')) {
      // Verificar se Ã© cooperado pelo telefone para buscar o link personalizado
      const telefoneNorm = telefone.replace(/\D/g, '');
      const telefoneSemPais = telefoneNorm.replace(/^55/, '');
      const cooperado = await this.prisma.cooperado.findFirst({
        where: {
          OR: [{ telefone: telefoneNorm }, { telefone: telefoneSemPais }, { telefone: `55${telefoneSemPais}` }],
        },
        select: { id: true, nomeCompleto: true, codigoIndicacao: true, cooperativaId: true },
      });

      if (cooperado) {
        // Cooperado: oferecer sub-menu com opÃ§Ã£o de proxy
        let codigo = cooperado.codigoIndicacao;
        if (!codigo) {
          const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
          codigo = Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
          await this.prisma.cooperado.update({ where: { id: cooperado.id }, data: { codigoIndicacao: codigo } });
        }
        await this.prisma.conversaWhatsapp.update({
          where: { id: conversa.id },
          data: {
            estado: 'MENU_CONVIDAR_AMIGO',
            dadosTemp: { indicadorId: cooperado.id, indicadorNome: cooperado.nomeCompleto, cooperativaId: cooperado.cooperativaId, codigoIndicacao: codigo } as any,
            contadorFallback: 0,
          },
        });
        await this.sender.enviarMensagem(telefone,
          `ðŸŽ *Convidar um amigo:*\n\n` +
          `1ï¸âƒ£ Enviar meu link de indicaÃ§Ã£o\n` +
          `2ï¸âƒ£ Cadastrar meu amigo (tenho a fatura dele)\n\n` +
          `_Responda 1 ou 2_`
        );
      } else {
        // NÃ£o Ã© cooperado â€” link genÃ©rico da CoopereBR
        const baseUrl = process.env.FRONTEND_URL ?? 'https://cooperebr.com.br';
        await this.sender.enviarMensagem(telefone,
          `ðŸŽ *Convide seus amigos para economizar na conta de luz!*\n\n` +
          `Compartilhe o link da CoopereBR:\n${baseUrl}\n\n` +
          `â˜€ï¸ Energia solar sem investimento, com atÃ© 20% de desconto na conta de luz.\n\n` +
          `_Quer ter seu link personalizado com benefÃ­cios? Digite *2* para se cadastrar!_`
        );
      }
      return;
    }

    // Fallback com contador
    await this.incrementarFallback(conversa, telefone,
      'Responda *1* (cooperado), *2* (quero ser cooperado), *3* (atendente) ou *4* (convidar amigo).',
    );
  }

  private async handleMenuCooperado(msg: MensagemRecebida, conversa: any): Promise<void> {
    const { telefone } = msg;
    const resposta = this.respostaEfetiva(msg);
    const corpo = resposta;
    const cooperadoId = conversa.cooperadoId;

    if (!cooperadoId) {
      await this.handleMenuPrincipalInicio(msg, conversa);
      return;
    }

    if (corpo === '1' || corpo.toLowerCase().includes('saldo') || corpo.toLowerCase().includes('crÃ©dito')) {
      const contratos = await this.prisma.contrato.findMany({
        where: { cooperadoId, status: 'ATIVO' as any },
        include: { uc: { select: { numero: true } } },
        orderBy: { createdAt: 'desc' },
        take: 3,
      });
      if (contratos.length === 0) {
        await this.sender.enviarMensagem(telefone, 'âš ï¸ Nenhum contrato ativo encontrado. Fale com nossa equipe.');
        return;
      }
      let texto = 'âš¡ *Seus crÃ©ditos:*\n\n';
      for (const c of contratos) {
        texto += `UC ${c.uc?.numero ?? 'N/A'}: ${c.kwhContratoMensal ?? 0} kWh/mÃªs\n`;
      }
      texto += '\n_Acesse o portal para mais detalhes._';
      await this.sender.enviarMensagem(telefone, texto);
      return;
    }

    if (corpo === '2' || corpo.toLowerCase().includes('fatura') || corpo.toLowerCase().includes('cobranÃ§a')) {
      const cobranca = await this.prisma.cobranca.findFirst({
        where: { contrato: { cooperadoId }, status: { in: ['PENDENTE', 'VENCIDO'] as any[] } },
        orderBy: { dataVencimento: 'asc' },
      });
      if (!cobranca) {
        await this.sender.enviarMensagem(telefone, 'âœ… VocÃª nÃ£o tem faturas pendentes no momento!');
        return;
      }
      const fmt = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
      await this.sender.enviarMensagem(
        telefone,
        `ðŸ“„ *PrÃ³xima fatura:*\n\n` +
        `ðŸ’° Valor: R$ ${fmt(Number(cobranca.valorLiquido ?? cobranca.valorBruto))}\n` +
        `ðŸ“… Vencimento: ${new Date(cobranca.dataVencimento).toLocaleDateString('pt-BR')}\n` +
        `Status: ${cobranca.status}\n\n` +
        `Para pagar, acesse seu portal ou aguarde o link de pagamento.`,
      );
      return;
    }

    if (corpo === '3' || corpo.toLowerCase().includes('atualizar cadastro') || corpo.toLowerCase().includes('meu cadastro')) {
      await this.prisma.conversaWhatsapp.update({
        where: { id: conversa.id },
        data: { estado: 'ATUALIZACAO_CADASTRO', contadorFallback: 0 },
      });
      await this.sender.enviarMenuComBotoes(telefone, {
        titulo: 'Atualizar Cadastro',
        corpo: 'âœï¸ *O que deseja atualizar?*',
        opcoes: [
          { id: '1', texto: 'ðŸ“ Nome' },
          { id: '2', texto: 'ðŸ“§ Email' },
          { id: '3', texto: 'ðŸ“± Telefone' },
          { id: '4', texto: 'ðŸ“ EndereÃ§o (CEP)' },
        ],
      });
      return;
    }

    if (corpo === '4' || corpo.toLowerCase().includes('atualizar contrato') || corpo.toLowerCase().includes('meu contrato')) {
      await this.prisma.conversaWhatsapp.update({
        where: { id: conversa.id },
        data: { estado: 'ATUALIZACAO_CONTRATO', contadorFallback: 0 },
      });
      await this.sender.enviarMenuComBotoes(telefone, {
        titulo: 'Atualizar Contrato',
        corpo: 'ðŸ”„ *O que deseja fazer com seu contrato?*',
        opcoes: [
          { id: '1', texto: 'â¬†ï¸ Aumentar meus kWh' },
          { id: '2', texto: 'â¬‡ï¸ Diminuir meus kWh' },
          { id: '3', texto: 'â¸ï¸ Suspender temporariamente' },
          { id: '4', texto: 'âŒ Encerrar contrato' },
        ],
      });
      return;
    }

    if (corpo === '5' || corpo.toLowerCase().includes('indicar') || corpo.toLowerCase().includes('amigo')) {
      if (!cooperadoId) {
        await this.sender.enviarMensagem(telefone, 'âš ï¸ NÃ£o conseguimos identificar seu cadastro. Tente novamente ou fale com o suporte.');
        return;
      }
      try {
        const result = await this.indicacoes.getMeuLink(cooperadoId);
        if (!result?.link) {
          await this.sender.enviarMensagem(telefone, 'âš ï¸ NÃ£o foi possÃ­vel gerar seu link de indicaÃ§Ã£o no momento. Tente novamente mais tarde.');
          return;
        }
        const { link, totalIndicados, indicadosAtivos } = result;
        await this.sender.enviarMensagem(telefone,
          `ðŸŽ *Seu link de indicaÃ§Ã£o:*\n\n` +
          `${link}\n\n` +
          `ðŸ“Š Total indicados: ${totalIndicados ?? 0}\n` +
          `âœ… Ativos (com benefÃ­cio): ${indicadosAtivos ?? 0}\n\n` +
          `_Compartilhe! Quando seu indicado pagar a 1Âª fatura, vocÃª ganha seu benefÃ­cio._`,
        );
      } catch (err) {
        this.logger.warn(`Erro ao buscar link de indicaÃ§Ã£o para ${cooperadoId}: ${err?.message}`);
        await this.sender.enviarMensagem(telefone, 'âš ï¸ NÃ£o foi possÃ­vel gerar seu link de indicaÃ§Ã£o no momento. Tente novamente mais tarde.');
      }
      return;
    }

    if (corpo === '6' || corpo.toLowerCase().includes('suporte') || corpo.toLowerCase().includes('ocorrÃªncia')) {
      await this.prisma.conversaWhatsapp.update({
        where: { id: conversa.id },
        data: { estado: 'AGUARDANDO_ATENDENTE', contadorFallback: 0 },
      });
      await this.sender.enviarMensagem(
        telefone,
        'ðŸ”§ *Suporte tÃ©cnico:*\n\nDescreva o problema e nossa equipe responderÃ¡ em breve.\n\nOu escolha:\n1ï¸âƒ£ Problema na fatura\n2ï¸âƒ£ CrÃ©ditos nÃ£o creditados\n3ï¸âƒ£ Outro',
      );
      return;
    }

    if (corpo === '7' || corpo.toLowerCase().includes('atendente')) {
      await this.encaminharAtendente(telefone, conversa.id, 'Cooperado solicitou atendente no menu cooperado');
      return;
    }

    await this.incrementarFallback(conversa, telefone,
      'Responda *1* (crÃ©ditos), *2* (fatura), *3* (cadastro), *4* (contrato), *5* (indicar), *6* (suporte) ou *7* (atendente).',
    );
  }

  private async handleMenuSemFatura(msg: MensagemRecebida, conversa: any): Promise<void> {
    const { telefone } = msg;
    const resposta = this.respostaEfetiva(msg);
    const corpo = resposta;

    if (corpo === '1' || corpo.toLowerCase().includes('enviar agora') || corpo.toLowerCase().includes('jÃ¡ tenho')) {
      await this.prisma.conversaWhatsapp.update({
        where: { id: conversa.id },
        data: { estado: 'AGUARDANDO_FOTO_FATURA', contadorFallback: 0 },
      });
      await this.sender.enviarMensagem(telefone,
        'ðŸ“Ž Perfeito! Envie agora a *foto* ou o *PDF* da sua conta de energia.\n\n_Dica: tire uma foto clara da frente completa da fatura, com todos os dados visÃ­veis._'
      );
      return;
    }

    if (corpo === '2' || corpo.toLowerCase().includes('email') || corpo.toLowerCase().includes('buscar')) {
      await this.prisma.conversaWhatsapp.update({
        where: { id: conversa.id },
        data: { estado: 'AGUARDANDO_DISPOSITIVO_EMAIL', contadorFallback: 0 },
      });
      await this.sender.enviarMenuComBotoes(telefone, {
        titulo: 'Onde estÃ¡ acessando?',
        corpo: 'ðŸ“§ Ã“timo! Vou te ajudar a baixar a fatura do seu email.\n\nVocÃª estÃ¡ usando:',
        opcoes: [
          { id: 'CEL', texto: 'ðŸ“± Celular', descricao: 'Vou te guiar pelo app' },
          { id: 'PC', texto: 'ðŸ’» Computador', descricao: 'Vou te guiar pelo navegador' },
        ],
      });
      return;
    }

    if (corpo === '3' || corpo.toLowerCase().includes('baixar') || corpo.toLowerCase().includes('site') || corpo.toLowerCase().includes('passo a passo')) {
      await this.prisma.conversaWhatsapp.update({
        where: { id: conversa.id },
        data: { estado: 'AGUARDANDO_DISTRIBUIDORA', contadorFallback: 0 },
      });
      await this.sender.enviarMenuComBotoes(telefone, {
        titulo: 'Qual sua distribuidora?',
        corpo: 'ðŸ’» Vou te ajudar a baixar sua fatura!\n\nQual Ã© a sua distribuidora de energia?',
        opcoes: [
          { id: '1', texto: '1️⃣ EDP Espírito Santo' },
          { id: '2', texto: '2️⃣ CEMIG (MG)' },
          { id: '3', texto: '3️⃣ COPEL (PR)' },
          { id: '4', texto: '4️⃣ LIGHT (RJ)' },
          { id: '5', texto: '5️⃣ Outra distribuidora' },
        ],
      });
      return;
    }

    await this.incrementarFallback(conversa, telefone,
      'Responda *1* (enviar agora), *2* (buscar no email) ou *3* (baixar do site).'
    );
  }

  private async handleAguardandoDispositivoEmail(msg: MensagemRecebida, conversa: any): Promise<void> {
    const { telefone } = msg;
    const resposta = this.respostaEfetiva(msg);

    const isCelular = resposta === 'CEL' || resposta.toLowerCase().includes('celular') || resposta.toLowerCase().includes('cel');
    const isPC = resposta === 'PC' || resposta.toLowerCase().includes('computador') || resposta.toLowerCase().includes('pc') || resposta.toLowerCase().includes('notebook');

    if (isCelular) {
      await this.prisma.conversaWhatsapp.update({
        where: { id: conversa.id },
        data: { estado: 'AGUARDANDO_FOTO_FATURA', contadorFallback: 0 },
      });
      await this.sender.enviarMensagem(telefone,
        'ðŸ“± *Baixar a fatura pelo celular:*\n\n' +
        '1ï¸âƒ£ Abra o app do seu email (Gmail, Outlook, etc.)\n' +
        '2ï¸âƒ£ Procure uma mensagem da sua distribuidora (EDP, CEMIG, etc.) com assunto *"Conta de energia"* ou *"Sua fatura"*\n' +
        '3ï¸âƒ£ Abra o email e toque no *anexo PDF*\n' +
        '4ï¸âƒ£ Toque em *"Baixar"* ou *"Salvar"*\n' +
        '5ï¸âƒ£ Volte aqui e toque no ðŸ“Ž (clipe) para enviar o arquivo\n\n' +
        'ðŸ’¡ *Dica:* Se nÃ£o encontrar o email, verifique a pasta *Spam* ou *PromoÃ§Ãµes*.\n\n' +
        'â³ Aguardo sua fatura!'
      );
    } else if (isPC) {
      await this.prisma.conversaWhatsapp.update({
        where: { id: conversa.id },
        data: { estado: 'AGUARDANDO_FOTO_FATURA', contadorFallback: 0 },
      });
      await this.sender.enviarMensagem(telefone,
        'ðŸ’» *Baixar a fatura pelo computador:*\n\n' +
        '1ï¸âƒ£ Abra seu email no navegador (gmail.com, outlook.com, etc.)\n' +
        '2ï¸âƒ£ Procure uma mensagem da distribuidora com assunto *"Conta de energia"* ou *"Sua fatura"*\n' +
        '3ï¸âƒ£ Abra o email e clique no *anexo PDF*\n' +
        '4ï¸âƒ£ Clique em *"Baixar"* â€” o arquivo vai para a pasta *Downloads*\n' +
        '5ï¸âƒ£ Volte aqui no WhatsApp Web, clique no ðŸ“Ž (clipe) e selecione o arquivo baixado\n\n' +
        'ðŸ’¡ *Dica:* NÃ£o precisa imprimir! Pode enviar direto o PDF.\n\n' +
        'â³ Aguardo sua fatura!'
      );
    } else {
      await this.incrementarFallback(conversa, telefone, 'Responda *1* para celular ou *2* para computador.');
    }
  }

  private async handleAguardandoDistribuidora(msg: MensagemRecebida, conversa: any): Promise<void> {
    const { telefone } = msg;
    const resposta = this.respostaEfetiva(msg);

    const DISTRIBUIDORAS: Record<string, { nome: string; link: string; passos: string }> = {
      'EDP-ES': {
        nome: 'EDP EspÃ­rito Santo',
        link: 'https://www.edp.com.br/espirito-santo/para-voce/segunda-via-de-conta',
        passos: '1ï¸âƒ£ Acesse o link acima\n2ï¸âƒ£ Clique em *"Acessar"* ou *"Entrar"*\n3ï¸âƒ£ Informe seu CPF e senha\n4ï¸âƒ£ VÃ¡ em *"Faturas"* â†’ *"2Âª Via"*\n5ï¸âƒ£ Baixe o PDF da fatura mais recente\n6ï¸âƒ£ Envie aqui para mim ðŸ“Ž',
      },
      'CEMIG': {
        nome: 'CEMIG',
        link: 'https://atende.cemig.com.br',
        passos: '1ï¸âƒ£ Acesse o link acima\n2ï¸âƒ£ FaÃ§a login com CPF e senha\n3ï¸âƒ£ Clique em *"Faturas"*\n4ï¸âƒ£ Selecione a Ãºltima fatura\n5ï¸âƒ£ Baixe o PDF\n6ï¸âƒ£ Envie aqui para mim ðŸ“Ž',
      },
      'COPEL': {
        nome: 'COPEL',
        link: 'https://www.copel.com/hpcweb/portal-atendimento',
        passos: '1ï¸âƒ£ Acesse o link acima\n2ï¸âƒ£ FaÃ§a login na AgÃªncia Virtual\n3ï¸âƒ£ Clique em *"2Âª Via de Conta"*\n4ï¸âƒ£ Baixe o PDF\n5ï¸âƒ£ Envie aqui para mim ðŸ“Ž',
      },
      'LIGHT': {
        nome: 'LIGHT',
        link: 'https://www.light.com.br/para-voce/segunda-via',
        passos: '1ï¸âƒ£ Acesse o link acima\n2ï¸âƒ£ Informe seu CPF\n3ï¸âƒ£ Selecione a fatura\n4ï¸âƒ£ Baixe o PDF\n5ï¸âƒ£ Envie aqui para mim ðŸ“Ž',
      },
    };

    // Mapeamento por nÃºmero (fallback texto: usuÃ¡rio digita 1, 2, 3, 4, 5)
    const NUMERO_PARA_ID: Record<string, string> = {
      '1': 'EDP-ES', '2': 'CEMIG', '3': 'COPEL', '4': 'LIGHT', '5': 'OUTRA',
    };
    const respostaNorm = resposta.trim().toUpperCase();
    const resolvedKey = NUMERO_PARA_ID[respostaNorm] || respostaNorm;
    const dist = DISTRIBUIDORAS[resolvedKey] ||
      // Busca por nome parcial (ex: "edp", "cemig")
      Object.entries(DISTRIBUIDORAS).find(([, v]) =>
        v.nome.toLowerCase().includes(resposta.toLowerCase())
      )?.[1];

    if (dist) {
      await this.prisma.conversaWhatsapp.update({
        where: { id: conversa.id },
        data: { estado: 'AGUARDANDO_FOTO_FATURA', contadorFallback: 0 },
      });
      await this.sender.enviarMensagem(telefone,
        `ðŸ’» *${dist.nome} â€” Como baixar sua fatura:*\n\n` +
        `ðŸ”— ${dist.link}\n\n` +
        `${dist.passos}\n\n` +
        `ðŸ’¡ *Dica extra:* Aproveite o acesso e cadastre nosso email *faturas@cooperebr.com.br* como 2Âº destinatÃ¡rio para receber sua fatura automaticamente todo mÃªs!\n\n` +
        `â³ Quando tiver o PDF, envie aqui!`
      );
    } else {
      // Distribuidora nÃ£o mapeada
      await this.prisma.conversaWhatsapp.update({
        where: { id: conversa.id },
        data: { estado: 'AGUARDANDO_FOTO_FATURA', contadorFallback: 0 },
      });
      await this.sender.enviarMensagem(telefone,
        `ðŸ’» Para baixar sua fatura:\n\n` +
        `1ï¸âƒ£ Acesse o site ou app da sua distribuidora\n` +
        `2ï¸âƒ£ FaÃ§a login na Ãrea do Cliente\n` +
        `3ï¸âƒ£ Busque por *"2Âª Via"* ou *"Faturas"*\n` +
        `4ï¸âƒ£ Baixe o PDF da fatura mais recente\n` +
        `5ï¸âƒ£ Envie aqui para mim ðŸ“Ž\n\n` +
        `Precisa de ajuda especÃ­fica? Digite o nome da sua distribuidora.`
      );
    }
  }

  private async handleMenuCliente(msg: MensagemRecebida, conversa: any): Promise<void> {
    const { telefone } = msg;
    const resposta = this.respostaEfetiva(msg);
    const corpo = resposta;

    if (corpo === '1' || corpo.toLowerCase().includes('cadastro') || corpo.toLowerCase().includes('aderir')) {
      await this.prisma.conversaWhatsapp.update({
        where: { id: conversa.id },
        data: { estado: 'AGUARDANDO_FOTO_FATURA', contadorFallback: 0 },
      });
      await this.sender.enviarMensagem(telefone, 'ðŸ“¸ Envie uma foto ou PDF da sua conta de energia para iniciarmos sua simulaÃ§Ã£o!');
      return;
    }

    if (corpo === '2' || corpo.toLowerCase().includes('atendente')) {
      await this.encaminharAtendente(telefone, conversa.id, 'Lead sem cadastro solicitou atendente');
      return;
    }

    await this.incrementarFallback(conversa, telefone, 'Responda *1* para iniciar cadastro ou *2* para falar com atendente.');
  }

  private async handleAguardandoAtendente(msg: MensagemRecebida, conversa: any): Promise<void> {
    const { telefone } = msg;
    const corpo = (msg.corpo ?? '').trim();

    // Registrar a mensagem de suporte
    this.logger.log(`Mensagem de suporte de ${telefone}: ${corpo}`);

    const telefoneSuporte = await this.configTenant.get('suporte_telefone') || process.env.SUPORTE_TELEFONE || '';
    const complementoSuporte = telefoneSuporte ? `\n\nSe for urgente, ligue: ${telefoneSuporte}` : '';
    await this.sender.enviarMensagem(
      telefone,
      `ðŸ“¬ Sua mensagem foi recebida! Nossa equipe entrarÃ¡ em contato em breve.${complementoSuporte}`,
    );

    // Notificar admin da cooperativa
    if (conversa.cooperativaId) {
      const admin = await this.prisma.usuario.findFirst({
        where: { cooperativaId: conversa.cooperativaId, perfil: 'ADMIN' },
        select: { telefone: true },
      });
      if (admin?.telefone) {
        await this.sender.enviarMensagem(
          admin.telefone,
          `ðŸ”” SolicitaÃ§Ã£o de suporte via WhatsApp:\nTelefone: ${telefone}\nMensagem: ${corpo}`,
        ).catch(() => {});
      }
    }
  }

  private async encaminharAtendente(telefone: string, conversaId: string, motivo: string): Promise<void> {
    await this.prisma.conversaWhatsapp.update({
      where: { id: conversaId },
      data: { estado: 'AGUARDANDO_ATENDENTE', contadorFallback: 0 },
    });
    await this.sender.enviarMensagem(
      telefone,
      'ðŸ‘¤ *Encaminhando para atendente humano...*\n\nUm de nossos especialistas responderÃ¡ em breve. HorÃ¡rio de atendimento: Segâ€“Sex 8hâ€“18h.\n\nDescreva sua dÃºvida ou aguarde.',
    );
    this.logger.log(`[Atendente] ${telefone}: ${motivo}`);
  }

  private async incrementarFallback(conversa: any, telefone: string, dica: string): Promise<void> {
    const novoContador = (conversa.contadorFallback ?? 0) + 1;
    await this.prisma.conversaWhatsapp.update({
      where: { id: conversa.id },
      data: { contadorFallback: novoContador },
    });

    if (novoContador >= 3) {
      // ApÃ³s 3 mensagens nÃ£o compreendidas â†’ encaminhar para atendente
      await this.prisma.conversaWhatsapp.update({
        where: { id: conversa.id },
        data: { estado: 'AGUARDANDO_ATENDENTE', contadorFallback: 0 },
      });
      await this.sender.enviarMensagem(
        telefone,
        'ðŸ¤” Parece que estou com dificuldade em entender. Vou te conectar com um atendente humano!\n\nðŸ‘¤ Aguarde, um especialista responderÃ¡ em breve.',
      );
    } else {
      await this.sender.enviarMensagem(telefone, `NÃ£o entendi ðŸ˜… ${dica}`);
    }
  }

  // â”€â”€â”€ PASSO 1: Recebe fatura (imagem/PDF) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  private async handleInicial(msg: MensagemRecebida, conversa: any): Promise<void> {
    const { telefone, tipo, mediaBase64, mimeType } = msg;

    const isMidia =
      (tipo === 'imagem' || tipo === 'documento') &&
      mediaBase64 &&
      mimeType &&
      ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'].includes(mimeType);

    if (!isMidia) {
      // Redirecionar para menu principal em vez de mostrar apenas mensagem de fatura
      await this.handleMenuPrincipalInicio(msg, conversa);
      return;
    }

    const textoProcessando = await this.msg('processando_fatura', {}, 'ðŸ“„ Recebi sua fatura! Analisando os dados... Aguarde um momento. â³');
    await this.sender.enviarMensagem(telefone, textoProcessando);

    // OCR
    const tipoArquivo = mimeType === 'application/pdf' ? 'pdf' : 'imagem';
    let dadosExtraidos: Record<string, unknown>;
    try {
      dadosExtraidos = await this.faturasService.extrairOcr(mediaBase64!, tipoArquivo) as unknown as Record<string, unknown>;
    } catch {
      await this.sender.enviarMensagem(
        telefone,
        'NÃ£o consegui identificar os dados da sua fatura. Por favor, envie uma foto mais nÃ­tida ou o PDF da fatura de energia. ðŸ“¸',
      );
      return;
    }

    // Validar dados mÃ­nimos
    const titular = String(dadosExtraidos.titular ?? '');
    const consumoAtualKwh = Number(dadosExtraidos.consumoAtualKwh ?? 0);
    const distribuidora = String(dadosExtraidos.distribuidora ?? '');

    if (!titular && consumoAtualKwh <= 0 && !distribuidora) {
      await this.sender.enviarMensagem(
        telefone,
        'O arquivo enviado nÃ£o parece ser uma fatura de energia. Por favor, envie a fatura da concessionÃ¡ria (PDF ou foto legÃ­vel). ðŸ“„',
      );
      return;
    }

    // Salvar dados na conversa
    await this.prisma.conversaWhatsapp.update({
      where: { id: conversa.id },
      data: {
        estado: 'AGUARDANDO_CONFIRMACAO_DADOS',
        dadosTemp: dadosExtraidos as any,
      },
    });

    // Montar mensagem de confirmaÃ§Ã£o
    const historico = (dadosExtraidos.historicoConsumo as Array<{ mesAno: string; consumoKwh: number; valorRS: number }>) ?? [];
    const endereco = String(dadosExtraidos.enderecoInstalacao ?? '');
    const numeroUC = String(dadosExtraidos.numeroUC ?? 'â€”');
    const tipoFornecimento = String(dadosExtraidos.tipoFornecimento ?? '');
    const tensao = String(dadosExtraidos.tensaoNominal ?? '');

    let msg_confirmacao = `ðŸ“Š *Dados extraÃ­dos da sua fatura:*\n\n`;
    msg_confirmacao += `ðŸ‘¤ ${titular}\n`;
    if (endereco) msg_confirmacao += `ðŸ“ ${endereco}\n`;
    msg_confirmacao += `ðŸ”Œ UC: ${numeroUC}\n`;
    if (tipoFornecimento) msg_confirmacao += `âš¡ ${tipoFornecimento}${tensao ? ` (${tensao})` : ''}\n`;

    if (historico.length > 0) {
      msg_confirmacao += `\nðŸ“… *HistÃ³rico de consumo:*\n`;
      for (const h of historico) {
        const valor = Number(h.valorRS);
        const valorStr = valor > 0 ? ` â€” R$ ${valor.toFixed(2).replace('.', ',')}` : '';
        msg_confirmacao += `${h.mesAno}: ${h.consumoKwh} kWh${valorStr}\n`;
      }
    }

    msg_confirmacao += `\n_Algum dado incorreto? Corrija no formato:_\n`;
    msg_confirmacao += `_02/26 350 kwh R$ 287,50_\n\n`;
    msg_confirmacao += `_Tudo certo? Responda *OK*_`;

    await this.sender.enviarMensagem(telefone, msg_confirmacao);
  }

  // â”€â”€â”€ PASSO 2: ConfirmaÃ§Ã£o dos dados â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  private async handleConfirmacaoDados(msg: MensagemRecebida, conversa: any): Promise<void> {
    const { telefone } = msg;
    const corpo = (msg.corpo ?? '').trim();
    const corpoUpper = corpo.toUpperCase();
    const dadosTemp = conversa.dadosTemp as Record<string, unknown>;

    // Se mandou nova imagem/PDF, reprocessar
    if ((msg.tipo === 'imagem' || msg.tipo === 'documento') && msg.mediaBase64) {
      await this.resetarConversa(telefone);
      await this.handleInicial(msg, { ...conversa, estado: 'INICIAL' });
      return;
    }

    if (corpoUpper === 'OK') {
      // Verificar se distribuidora tem usinas disponÃ­veis
      const distribuidoraOCR = String(dadosTemp.distribuidora ?? '');
      if (distribuidoraOCR) {
        const usinasNaArea = await this.prisma.usina.count({
          where: {
            distribuidora: { contains: distribuidoraOCR, mode: 'insensitive' },
            statusHomologacao: { in: ['HOMOLOGADA', 'EM_PRODUCAO'] },
          },
        });

        if (usinasNaArea === 0) {
          const valorFatura = Number(dadosTemp.totalAPagar ?? 0);
          const economiaEstimada = Math.round(valorFatura * 0.18 * 100) / 100;
          const economiaAnual = Math.round(economiaEstimada * 12 * 100) / 100;

          await this.prisma.conversaWhatsapp.update({
            where: { id: conversa.id },
            data: {
              estado: 'LEAD_FORA_AREA',
              dadosTemp: { ...dadosTemp, economiaEstimada, distribuidora: distribuidoraOCR } as any,
            },
          });

          const fmt = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
          await this.sender.enviarMensagem(
            telefone,
            `â˜€ï¸ Fizemos sua simulaÃ§Ã£o!\n\n` +
            `ðŸ“Š Sua fatura atual: R$ ${fmt(valorFatura)}\n` +
            `ðŸ’š Economia estimada com CoopereBR: *R$ ${fmt(economiaEstimada)}/mÃªs*\n` +
            `ðŸ—“ï¸ Economia anual: *R$ ${fmt(economiaAnual)}*\n\n` +
            `Ainda nÃ£o temos parceiro na Ã¡rea da *${distribuidoraOCR}*, mas estamos expandindo!\n\n` +
            `Quer que te avisemos quando chegarmos na sua regiÃ£o?\n` +
            `1ï¸âƒ£ Sim, quero!\n2ï¸âƒ£ NÃ£o por enquanto`,
          );
          return;
        }
      }

      // Calcular simulaÃ§Ã£o
      const historico = (dadosTemp.historicoConsumo as Array<{ mesAno: string; consumoKwh: number; valorRS: number }>) ?? [];
      const consumoAtualKwh = Number(dadosTemp.consumoAtualKwh ?? 0);
      const valorMesRecente = Number(dadosTemp.totalAPagar ?? 0);
      const tipoFornecimento = String(dadosTemp.tipoFornecimento ?? 'TRIFASICO');

      const kwhs = historico.map(h => h.consumoKwh).filter(v => v > 0);
      const kwhMedio = kwhs.length > 0 ? kwhs.reduce((a, b) => a + b, 0) / kwhs.length : consumoAtualKwh;
      const valores = historico.map(h => h.valorRS).filter(v => v > 0);
      const valorMedio = valores.length > 0 ? valores.reduce((a, b) => a + b, 0) / valores.length : valorMesRecente;

      let resultado;
      try {
        const calcResult = await this.motorProposta.calcular({
          cooperadoId: conversa.cooperadoId || 'temp',
          historico: historico.map(h => ({ mesAno: h.mesAno, consumoKwh: h.consumoKwh, valorRS: h.valorRS })),
          kwhMesRecente: consumoAtualKwh || kwhMedio,
          valorMesRecente: valorMesRecente || valorMedio,
          mesReferencia: String(dadosTemp.mesReferencia ?? ''),
          tipoFornecimento: tipoFornecimento as 'MONOFASICO' | 'BIFASICO' | 'TRIFASICO',
        });
        resultado = calcResult.resultado;
      } catch (err) {
        this.logger.error(`Erro ao calcular proposta: ${err.message}`);
        await this.sender.enviarMensagem(
          telefone,
          'Houve um erro ao calcular sua simulaÃ§Ã£o. Tente novamente ou entre em contato conosco. ðŸ˜Š',
        );
        return;
      }

      if (!resultado) {
        await this.sender.enviarMensagem(
          telefone,
          'NÃ£o foi possÃ­vel gerar uma simulaÃ§Ã£o com os dados extraÃ­dos. Tente enviar outra fatura. ðŸ“„',
        );
        return;
      }

      const valorFaturaMedia = valorMedio;
      const descontoPercentual = resultado.descontoPercentual;
      const valorComDesconto = valorFaturaMedia * (1 - descontoPercentual / 100);
      const economiaMensal = resultado.economiaMensal;
      const economiaAnual = economiaMensal * 12;
      const mesesEconomia = valorFaturaMedia > 0 ? Math.round(economiaAnual / valorFaturaMedia * 10) / 10 : 0;

      const fmt = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

      // Salvar resultado no dadosTemp
      await this.prisma.conversaWhatsapp.update({
        where: { id: conversa.id },
        data: {
          estado: 'AGUARDANDO_CONFIRMACAO_PROPOSTA',
          dadosTemp: { ...dadosTemp, resultado } as any,
        },
      });

      let resposta = `ðŸŒ± *Sua simulaÃ§Ã£o CoopereBR:*\n\n`;
      resposta += `ðŸ“Š Fatura mÃ©dia atual: R$ ${fmt(valorFaturaMedia)}\n`;
      resposta += `ðŸ’š Com a CoopereBR: R$ ${fmt(valorComDesconto)} (-${descontoPercentual.toFixed(0)}%)\n`;
      resposta += `ðŸ’µ Economia mensal: R$ ${fmt(economiaMensal)}\n`;
      resposta += `ðŸ“… Economia anual: R$ ${fmt(economiaAnual)}\n`;
      if (mesesEconomia > 0) {
        resposta += `ðŸŽ Equivale a ${mesesEconomia.toFixed(1).replace('.', ',')} meses de energia grÃ¡tis!\n`;
      }
      resposta += `\nQuer receber a proposta completa em PDF?\nResponda *SIM*`;

      await this.sender.enviarMensagem(telefone, resposta);
      return;
    }

    // Tentar corrigir dado do histÃ³rico via regex
    const regexCorrecao = /^(\d{2})[\/\-](\d{2,4})\s+(\d+)\s*kwh\s+R?\$?\s*([\d.,]+)/i;
    const match = corpo.match(regexCorrecao);

    if (match) {
      const [, mes, ano, kwhStr, valorStr] = match;
      const anoCompleto = ano.length === 2 ? `20${ano}` : ano;
      const mesAno = `${mes}/${anoCompleto}`;
      const kwh = parseInt(kwhStr);
      const valor = parseFloat(valorStr.replace('.', '').replace(',', '.'));

      const historico = (dadosTemp.historicoConsumo as Array<{ mesAno: string; consumoKwh: number; valorRS: number }>) ?? [];
      const idx = historico.findIndex(h => h.mesAno === mesAno || h.mesAno === `${mes}/${ano}`);

      if (idx >= 0) {
        historico[idx] = { mesAno, consumoKwh: kwh, valorRS: valor };
      } else {
        historico.push({ mesAno, consumoKwh: kwh, valorRS: valor });
      }

      await this.prisma.conversaWhatsapp.update({
        where: { id: conversa.id },
        data: { dadosTemp: { ...dadosTemp, historicoConsumo: historico } as any },
      });

      await this.sender.enviarMensagem(
        telefone,
        `âœ… MÃªs ${mesAno} atualizado: ${kwh} kWh â€” R$ ${valor.toFixed(2).replace('.', ',')}\n\nOutro dado a corrigir? Ou responda *OK* para gerar a simulaÃ§Ã£o.`,
      );
      return;
    }

    // NÃ£o entendeu
    await this.sender.enviarMensagem(
      telefone,
      `NÃ£o entendi ðŸ˜…\n\nResponda *OK* se estiver tudo certo, ou corrija no formato:\n_02/26 350 kwh R$ 287,50_`,
    );
  }

  // â”€â”€â”€ PASSO 3: ConfirmaÃ§Ã£o da proposta â†’ envia PDF â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  private async handleConfirmacaoProposta(msg: MensagemRecebida, conversa: any): Promise<void> {
    const { telefone } = msg;
    const corpo = (msg.corpo ?? '').trim().toUpperCase();
    const dadosTempCheck = (conversa.dadosTemp ?? {}) as Record<string, unknown>;

    // Fluxo convite: se veio de indicaÃ§Ã£o, "1" ou "SIM" leva para coleta de dados
    if (dadosTempCheck.codigoIndicacao && (corpo === '1' || corpo === 'SIM')) {
      await this.prisma.conversaWhatsapp.update({
        where: { id: conversa.id },
        data: { estado: 'AGUARDANDO_NOME' },
      });
      await this.sender.enviarMensagem(telefone, 'Otimo! Vamos fazer seu cadastro. Qual e seu nome completo?');
      return;
    }

    // Fluxo convite: "2" ou "NAO" â†’ encerrar
    if (dadosTempCheck.codigoIndicacao && (corpo === '2' || corpo.includes('NAO') || corpo.includes('NÃƒO'))) {
      await this.finalizarConversa(conversa.id);
      await this.sender.enviarMensagem(telefone, 'Tudo bem! Se mudar de ideia, estamos aqui. ðŸ˜Š');
      return;
    }

    if (corpo !== 'SIM' && corpo !== '1') {
      await this.sender.enviarMensagem(
        telefone,
        dadosTempCheck.codigoIndicacao
          ? 'Responda 1ï¸âƒ£ para continuar ou 2ï¸âƒ£ para nao.'
          : 'Responda *SIM* para receber a proposta em PDF, ou *cancelar* para recomeÃ§ar.',
      );
      return;
    }

    const dadosTemp = conversa.dadosTemp as Record<string, unknown>;

    // Gerar PDF da proposta via motor-proposta (aceitar cria proposta + PDF)
    const titular = String(dadosTemp.titular ?? '');
    const endereco = String(dadosTemp.enderecoInstalacao ?? '');
    const numeroUC = String(dadosTemp.numeroUC ?? 'â€”');

    await this.sender.enviarMensagem(telefone, 'ðŸ“„ Gerando sua proposta em PDF... Aguarde um momento. â³');

    // Tentar gerar e enviar PDF via motor-proposta
    try {
      const historico = (dadosTemp.historicoConsumo as Array<{ mesAno: string; consumoKwh: number; valorRS: number }>) ?? [];
      const resultado = dadosTemp.resultado as any;

      // Buscar ou criar cooperado lead
      const telefoneNorm = telefone.replace(/\D/g, '');
      // Buscar por telefone completo normalizado (sem prefixo paÃ­s variÃ¡vel)
      const telefoneSemPais = telefoneNorm.replace(/^55/, '');
      let cooperado = await this.prisma.cooperado.findFirst({
        where: {
          OR: [
            { telefone: telefoneNorm },
            { telefone: telefoneSemPais },
            { telefone: `55${telefoneSemPais}` },
          ],
        },
      });
      if (!cooperado) {
        cooperado = await this.prisma.cooperado.create({
          data: {
            nomeCompleto: titular || `Lead WhatsApp ${telefoneNorm}`,
            cpf: '',
            email: '',
            telefone: telefoneNorm,
            status: 'PENDENTE' as any,
            tipoCooperado: 'COM_UC' as any,
          },
        });
      }

      // Salvar cooperadoId na conversa
      await this.prisma.conversaWhatsapp.update({
        where: { id: conversa.id },
        data: { cooperadoId: cooperado.id },
      });

      // Criar proposta no motor
      const propostaResult = await this.motorProposta.calcular({
        cooperadoId: cooperado.id,
        historico: historico.map(h => ({ mesAno: h.mesAno, consumoKwh: h.consumoKwh, valorRS: h.valorRS })),
        kwhMesRecente: Number(dadosTemp.consumoAtualKwh ?? 0),
        valorMesRecente: Number(dadosTemp.totalAPagar ?? 0),
        mesReferencia: String(dadosTemp.mesReferencia ?? ''),
        tipoFornecimento: String(dadosTemp.tipoFornecimento ?? 'TRIFASICO') as any,
      });

      if (propostaResult.resultado) {
        // Enviar mensagem com dados da simulaÃ§Ã£o como "PDF resumo"
        const fmt = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        const r = propostaResult.resultado;

        let pdfTexto = `ðŸ“‹ *PROPOSTA COOPEREBR*\n`;
        pdfTexto += `â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”\n\n`;
        pdfTexto += `ðŸ‘¤ *${titular}*\n`;
        if (endereco) pdfTexto += `ðŸ“ ${endereco}\n`;
        pdfTexto += `ðŸ”Œ UC: ${numeroUC}\n\n`;
        pdfTexto += `ðŸ“Š *Dados da simulaÃ§Ã£o:*\n`;
        pdfTexto += `â€¢ Consumo considerado: ${Math.round(r.kwhContrato)} kWh/mÃªs\n`;
        pdfTexto += `â€¢ Desconto: ${r.descontoPercentual.toFixed(1)}%\n`;
        pdfTexto += `â€¢ Economia mensal: R$ ${fmt(r.economiaMensal)}\n`;
        pdfTexto += `â€¢ Economia anual: R$ ${fmt(r.economiaAnual)}\n\n`;
        pdfTexto += `â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”\n`;
        pdfTexto += `_Proposta vÃ¡lida por 30 dias_`;

        await this.sender.enviarMensagem(telefone, pdfTexto);
      }
    } catch (err) {
      this.logger.error(`Erro ao gerar proposta: ${err.message}`);
      await this.sender.enviarMensagem(
        telefone,
        'Houve um erro ao gerar a proposta. Nossa equipe entrarÃ¡ em contato. ðŸ˜Š',
      );
    }

    // ConfirmaÃ§Ã£o de dados para cadastro
    let dadosCadastro = `âœ… *Seus dados para cadastro:*\n\n`;
    dadosCadastro += `ðŸ‘¤ ${titular}\n`;
    if (endereco) dadosCadastro += `ðŸ“ ${endereco}\n`;
    dadosCadastro += `ðŸ”Œ UC: ${numeroUC}\n\n`;
    dadosCadastro += `EstÃ¡ correto? Responda *CONFIRMO* para prosseguir\n`;
    dadosCadastro += `ou me diga o que precisa corrigir.`;

    await this.prisma.conversaWhatsapp.update({
      where: { id: conversa.id },
      data: { estado: 'AGUARDANDO_CONFIRMACAO_CADASTRO' },
    });

    await this.sender.enviarMensagem(telefone, dadosCadastro);
  }

  // â”€â”€â”€ PASSO 4: ConfirmaÃ§Ã£o do cadastro â†’ cria cooperado â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  private async handleConfirmacaoCadastro(msg: MensagemRecebida, conversa: any): Promise<void> {
    const { telefone } = msg;
    const corpo = (msg.corpo ?? '').trim().toUpperCase();

    if (corpo !== 'CONFIRMO') {
      await this.sender.enviarMensagem(
        telefone,
        'Responda *CONFIRMO* para prosseguir com o cadastro, ou me diga o que precisa corrigir.',
      );
      return;
    }

    const dadosTemp = conversa.dadosTemp as Record<string, unknown>;
    const telefoneNorm = telefone.replace(/\D/g, '');

    // Verificar se jÃ¡ existe cooperado (busca por telefone completo normalizado)
    const telefoneSemPais = telefoneNorm.replace(/^55/, '');
    let cooperado = await this.prisma.cooperado.findFirst({
      where: {
        OR: [
          { telefone: telefoneNorm },
          { telefone: telefoneSemPais },
          { telefone: `55${telefoneSemPais}` },
        ],
      },
    });

    if (cooperado && cooperado.status !== 'PENDENTE') {
      await this.sender.enviarMensagem(
        telefone,
        'VocÃª jÃ¡ estÃ¡ em nosso sistema! Nossa equipe entrarÃ¡ em contato em breve. ðŸ˜Š',
      );
      await this.finalizarConversa(conversa.id);
      return;
    }

    // Criar ou atualizar cooperado como LEAD
    const titular = String(dadosTemp.nomeInformado ?? dadosTemp.titular ?? '');
    const endereco = String(dadosTemp.enderecoInstalacao ?? '');
    const cidade = String(dadosTemp.cidade ?? '');
    const estado = String(dadosTemp.estado ?? '');
    const documento = String(dadosTemp.cpfInformado ?? dadosTemp.documento ?? '');
    const emailInformado = String(dadosTemp.emailInformado ?? '');

    if (cooperado) {
      await this.prisma.cooperado.update({
        where: { id: cooperado.id },
        data: {
          nomeCompleto: titular || cooperado.nomeCompleto,
          documento: documento || cooperado.documento,
          ...(emailInformado ? { email: emailInformado } : {}),
          ...(documento ? { cpf: documento } : {}),
        },
      });
    } else {
      cooperado = await this.prisma.cooperado.create({
        data: {
          nomeCompleto: titular || `Lead WhatsApp ${telefoneNorm}`,
          cpf: documento || '',
          email: emailInformado || '',
          telefone: telefoneNorm,
          status: 'PENDENTE' as any,
          tipoCooperado: 'COM_UC' as any,
        },
      });
    }

    // Criar UC se tiver dados
    const numeroUC = String(dadosTemp.numeroUC ?? '');
    if (numeroUC && numeroUC !== 'â€”') {
      const ucExistente = await this.prisma.uc.findFirst({
        where: { numero: numeroUC },
      });
      if (!ucExistente) {
        try {
          await this.prisma.uc.create({
            data: {
              numero: numeroUC,
              numeroUC: numeroUC,
              endereco: endereco || '',
              cidade: cidade || '',
              estado: estado || '',
              cooperadoId: cooperado.id,
              distribuidora: String(dadosTemp.distribuidora ?? ''),
              tipoFornecimento: String(dadosTemp.tipoFornecimento ?? 'TRIFASICO'),
            },
          });
        } catch (err) {
          this.logger.warn(`NÃ£o foi possÃ­vel criar UC: ${err.message}`);
        }
      }
    }

    // Verificar indicaÃ§Ã£o (cÃ³digo salvo no dadosTemp pelo fluxo MLM)
    const codigoRef = dadosTemp.codigoIndicacao as string | undefined;
    if (codigoRef && cooperado) {
      try {
        await this.indicacoes.registrarIndicacao(cooperado.id, codigoRef);
        this.logger.log(`IndicaÃ§Ã£o registrada para ${cooperado.id} via cÃ³digo ${codigoRef}`);

        // Notificar o indicador
        const indicador = await this.prisma.cooperado.findUnique({
          where: { codigoIndicacao: codigoRef },
          select: { telefone: true, nomeCompleto: true, cooperativaId: true },
        });
        if (indicador?.telefone) {
          const nomeIndicado = cooperado.nomeCompleto || titular || 'Novo membro';
          await this.sender.enviarMensagem(
            indicador.telefone,
            `ðŸŽ‰ Boa notÃ­cia! ${nomeIndicado} acabou de completar o cadastro atravÃ©s do seu convite! Quando ele pagar a primeira fatura, vocÃª receberÃ¡ seu benefÃ­cio automaticamente. Obrigado por indicar! ðŸ™`,
          ).catch(() => {});

          // Notificar admin da cooperativa
          if (indicador.cooperativaId) {
            const admin = await this.prisma.usuario.findFirst({
              where: { cooperativaId: indicador.cooperativaId, perfil: 'ADMIN' },
              select: { telefone: true },
            });
            if (admin?.telefone) {
              await this.sender.enviarMensagem(
                admin.telefone,
                `ðŸ“‹ Novo cadastro via indicaÃ§Ã£o: ${nomeIndicado} | Tel: ${telefoneNorm} | Indicado por: ${indicador.nomeCompleto?.trim() || 'Cooperado'}. Acompanhe o processo no painel.`,
              ).catch(() => {});
            }
          }
        }
      } catch (err) {
        this.logger.warn(`NÃ£o foi possÃ­vel registrar indicaÃ§Ã£o: ${err.message}`);
      }
    }

    await this.finalizarConversa(conversa.id);

    const textoSucesso = await this.msg('cadastro_sucesso', {}, 'ðŸŽ‰ Perfeito! Seu prÃ©-cadastro foi criado com sucesso!\n\nNossa equipe entrarÃ¡ em contato em breve para finalizar. Qualquer dÃºvida Ã© sÃ³ perguntar! ðŸ’š');
    await this.sender.enviarMensagem(telefone, textoSucesso);

    // NPS: agendar pesquisa apÃ³s 1 hora
    this.agendarNps(telefone, conversa.id);
  }

  // â”€â”€â”€ Estado CONCLUIDO â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  private async handleConcluido(msg: MensagemRecebida): Promise<void> {
    const { telefone, tipo, mediaBase64 } = msg;

    // Se mandou nova fatura, reiniciar fluxo
    if ((tipo === 'imagem' || tipo === 'documento') && mediaBase64) {
      await this.resetarConversa(telefone);
      const conversa = await this.prisma.conversaWhatsapp.findUnique({ where: { telefone } });
      await this.handleInicial(msg, conversa);
      return;
    }

    await this.sender.enviarMensagem(
      telefone,
      'Seu cadastro jÃ¡ foi recebido! ðŸ˜Š Nossa equipe entrarÃ¡ em contato em breve.\n\nSe quiser fazer uma nova simulaÃ§Ã£o, envie outra conta de luz. ðŸ“¸',
    );
  }

  // â”€â”€â”€ Fluxo Convite (indicaÃ§Ã£o) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  /**
   * Inicia o fluxo de convite quando um lead chega via referÃªncia de indicaÃ§Ã£o.
   * Chamado externamente (ex: MLM service) para iniciar a conversa.
   */
  async iniciarFluxoConvite(telefone: string, indicadorNome: string, codigoIndicacao: string): Promise<void> {
    // Redireciona para o fluxo de convite melhorado com botÃµes interativos
    await this.iniciarFluxoConviteIndicacao(telefone, indicadorNome, codigoIndicacao);
  }

  private async handleMenuConvite(msg: MensagemRecebida, conversa: any): Promise<void> {
    const { telefone } = msg;
    const resposta = this.respostaEfetiva(msg);
    const corpo = resposta;

    if (corpo === '1' || corpo.toLowerCase().includes('sim')) {
      await this.prisma.conversaWhatsapp.update({
        where: { id: conversa.id },
        data: { estado: 'AGUARDANDO_FOTO_FATURA' },
      });
      await this.sender.enviarMensagem(telefone, 'Otimo! Envie uma foto da sua conta de luz (frente completa) ðŸ“¸');
      return;
    }

    if (corpo === '2' || corpo.toLowerCase().includes('nao') || corpo.toLowerCase().includes('nÃ£o')) {
      await this.finalizarConversa(conversa.id);
      await this.sender.enviarMensagem(telefone, 'Tudo bem! Se mudar de ideia, estamos aqui. ðŸ˜Š');
      return;
    }

    await this.sender.enviarMensagem(telefone, 'Responda 1ï¸âƒ£ para saber mais ou 2ï¸âƒ£ se nao tem interesse.');
  }

  private async handleAguardandoFotoFatura(msg: MensagemRecebida, conversa: any): Promise<void> {
    const { telefone, tipo, mediaBase64, mimeType } = msg;
    const dadosTemp = (conversa.dadosTemp ?? {}) as Record<string, unknown>;

    const isMidia =
      (tipo === 'imagem' || tipo === 'documento') &&
      mediaBase64 &&
      mimeType &&
      ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'].includes(mimeType);

    if (!isMidia) {
      await this.sender.enviarMensagem(telefone, 'Por favor, envie uma *foto* ou *PDF* da sua conta de energia eletrica. ðŸ“¸');
      return;
    }

    await this.sender.enviarMensagem(telefone, 'ðŸ“„ Recebi! Analisando os dados... Aguarde um momento. â³');

    // OCR
    const tipoArquivo = mimeType === 'application/pdf' ? 'pdf' : 'imagem';
    let dadosExtraidos: Record<string, unknown>;
    try {
      dadosExtraidos = await this.faturasService.extrairOcr(mediaBase64!, tipoArquivo) as unknown as Record<string, unknown>;
    } catch {
      await this.sender.enviarMensagem(telefone, 'Nao consegui identificar os dados. Envie uma foto mais nitida ou o PDF da fatura. ðŸ“¸');
      return;
    }

    const consumoAtualKwh = Number(dadosExtraidos.consumoAtualKwh ?? 0);
    if (consumoAtualKwh <= 0) {
      await this.sender.enviarMensagem(telefone, 'O arquivo nao parece ser uma fatura de energia. Tente novamente. ðŸ“„');
      return;
    }

    // Calcular proposta rapida
    const historico = (dadosExtraidos.historicoConsumo as Array<{ mesAno: string; consumoKwh: number; valorRS: number }>) ?? [];
    const valorMesRecente = Number(dadosExtraidos.totalAPagar ?? 0);
    const kwhs = historico.map(h => h.consumoKwh).filter(v => v > 0);
    const kwhMedio = kwhs.length > 0 ? kwhs.reduce((a, b) => a + b, 0) / kwhs.length : consumoAtualKwh;
    const valores = historico.map(h => h.valorRS).filter(v => v > 0);
    const valorMedio = valores.length > 0 ? valores.reduce((a, b) => a + b, 0) / valores.length : valorMesRecente;

    let resultado: any = null;
    try {
      const calcResult = await this.motorProposta.calcular({
        cooperadoId: 'temp',
        historico: historico.map(h => ({ mesAno: h.mesAno, consumoKwh: h.consumoKwh, valorRS: h.valorRS })),
        kwhMesRecente: consumoAtualKwh || kwhMedio,
        valorMesRecente: valorMesRecente || valorMedio,
        mesReferencia: String(dadosExtraidos.mesReferencia ?? ''),
        tipoFornecimento: String(dadosExtraidos.tipoFornecimento ?? 'TRIFASICO') as any,
      });
      resultado = calcResult.resultado;
    } catch (err) {
      this.logger.warn(`Erro ao calcular proposta convite: ${err.message}`);
    }

    // Salvar dados
    await this.prisma.conversaWhatsapp.update({
      where: { id: conversa.id },
      data: {
        estado: 'AGUARDANDO_CONFIRMACAO_PROPOSTA',
        dadosTemp: { ...dadosTemp, ...dadosExtraidos, resultado } as any,
      },
    });

    if (resultado) {
      const fmt = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      const economiaMensal = resultado.economiaMensal;
      const descontoPercentual = resultado.descontoPercentual;
      const valorComDesconto = valorMedio * (1 - descontoPercentual / 100);

      let resposta = `ðŸŒ± *Simulacao de economia:*\n\n`;
      resposta += `ðŸ“Š Fatura media: R$ ${fmt(valorMedio)}\n`;
      resposta += `ðŸ’š Com a CoopereBR: R$ ${fmt(valorComDesconto)} (-${descontoPercentual.toFixed(0)}%)\n`;
      resposta += `ðŸ’µ Economia mensal: R$ ${fmt(economiaMensal)}\n\n`;
      resposta += `Quer continuar?\n1ï¸âƒ£ Sim\n2ï¸âƒ£ Nao`;

      await this.sender.enviarMensagem(telefone, resposta);
    } else {
      await this.sender.enviarMensagem(telefone, 'Recebi sua fatura! Quer prosseguir com o cadastro?\n1ï¸âƒ£ Sim\n2ï¸âƒ£ Nao');
    }

    // Notificar indicador sobre avanco
    const indicadorNome = dadosTemp.indicadorNome as string | undefined;
    const codigoRef = dadosTemp.codigoIndicacao as string | undefined;
    if (codigoRef) {
      const indicador = await this.prisma.cooperado.findUnique({
        where: { codigoIndicacao: codigoRef },
        select: { telefone: true, nomeCompleto: true },
      });
      if (indicador?.telefone) {
        await this.sender.enviarMensagem(
          indicador.telefone,
          `ðŸ“‹ Seu indicado enviou a fatura e esta analisando a proposta. Acompanhe!`,
        ).catch(() => {});
      }
    }
  }

  /**
   * Quando no fluxo convite, confirmacao da proposta leva para coleta de dados.
   * O handler existente handleConfirmacaoProposta trata "SIM", aqui tratamos
   * o caso de voltar do fluxo convite para coletar nome/CPF/email.
   */
  private async handleAguardandoNome(msg: MensagemRecebida, conversa: any): Promise<void> {
    const { telefone } = msg;
    const corpo = (msg.corpo ?? '').trim();

    if (!corpo || corpo.length < 3) {
      await this.sender.enviarMensagem(telefone, 'Por favor, informe seu nome completo:');
      return;
    }

    const dadosTemp = (conversa.dadosTemp ?? {}) as Record<string, unknown>;
    await this.prisma.conversaWhatsapp.update({
      where: { id: conversa.id },
      data: {
        estado: 'AGUARDANDO_CPF',
        dadosTemp: { ...dadosTemp, nomeInformado: corpo } as any,
      },
    });

    await this.sender.enviarMensagem(telefone, `Obrigado, ${corpo}! Agora informe seu CPF:`);
  }

  private async handleAguardandoCpf(msg: MensagemRecebida, conversa: any): Promise<void> {
    const { telefone } = msg;
    const corpo = (msg.corpo ?? '').trim().replace(/\D/g, '');

    if (corpo.length !== 11) {
      await this.sender.enviarMensagem(telefone, 'CPF invalido. Informe os 11 digitos do seu CPF:');
      return;
    }

    const dadosTemp = (conversa.dadosTemp ?? {}) as Record<string, unknown>;
    await this.prisma.conversaWhatsapp.update({
      where: { id: conversa.id },
      data: {
        estado: 'AGUARDANDO_EMAIL',
        dadosTemp: { ...dadosTemp, cpfInformado: corpo } as any,
      },
    });

    await this.sender.enviarMensagem(telefone, 'Agora informe seu email:');
  }

  private async handleAguardandoEmail(msg: MensagemRecebida, conversa: any): Promise<void> {
    const { telefone } = msg;
    const corpo = (msg.corpo ?? '').trim().toLowerCase();

    if (!corpo.includes('@')) {
      await this.sender.enviarMensagem(telefone, 'Email invalido. Informe um email valido:');
      return;
    }

    const dadosTemp = (conversa.dadosTemp ?? {}) as Record<string, unknown>;
    const nome = String(dadosTemp.nomeInformado ?? dadosTemp.titular ?? '');
    const cpf = String(dadosTemp.cpfInformado ?? '');

    await this.prisma.conversaWhatsapp.update({
      where: { id: conversa.id },
      data: {
        estado: 'AGUARDANDO_CONFIRMACAO_CADASTRO',
        dadosTemp: { ...dadosTemp, emailInformado: corpo } as any,
      },
    });

    let confirmacao = `âœ… *Confirme seus dados:*\n\n`;
    confirmacao += `ðŸ‘¤ ${nome}\n`;
    confirmacao += `ðŸ“„ CPF: ${cpf}\n`;
    confirmacao += `ðŸ“§ ${corpo}\n\n`;
    confirmacao += `Tudo certo? Responda *CONFIRMO*`;

    await this.sender.enviarMensagem(telefone, confirmacao);
  }

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // ROTINA 1: Cadastro via QR Code / Propaganda
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

  /**
   * Inicia fluxo QR Code/Propaganda para contato espontÃ¢neo sem indicaÃ§Ã£o.
   * Chamado quando nÃ£o hÃ¡ codigoRef na conversa e Ã© primeira interaÃ§Ã£o de texto.
   */
  async iniciarFluxoQrPropaganda(telefone: string): Promise<void> {
    await this.prisma.conversaWhatsapp.upsert({
      where: { telefone },
      update: { estado: 'MENU_QR_PROPAGANDA', contadorFallback: 0 },
      create: { telefone, estado: 'MENU_QR_PROPAGANDA' },
    });

    await this.sender.enviarMenuComBotoes(telefone, {
      titulo: 'Bem-vindo Ã  CoopereBR',
      corpo: 'ðŸ‘‹ OlÃ¡! Bem-vindo Ã  *CoopereBR* â€” energia solar compartilhada!\n\nEconomize atÃ© 20% na conta de luz sem investimento e sem obras.',
      opcoes: [
        { id: '1', texto: 'ðŸŒ± Conhecer a CoopereBR', descricao: 'Saiba como funciona' },
        { id: '2', texto: 'ðŸ’° Simular minha economia', descricao: 'Calcule quanto vai economizar' },
        { id: '3', texto: 'ðŸ‘¤ Falar com consultor', descricao: 'Atendimento personalizado' },
      ],
    });
  }

  private async handleMenuQrPropaganda(msg: MensagemRecebida, conversa: any): Promise<void> {
    const { telefone } = msg;
    const corpo = this.respostaEfetiva(msg);

    if (corpo === '1' || corpo.toLowerCase().includes('conhecer')) {
      await this.sender.enviarMensagem(
        telefone,
        'ðŸŒ± *Como funciona a CoopereBR:*\n\n' +
        'â˜€ï¸ Somos uma cooperativa de energia solar compartilhada\n' +
        'ðŸ’¡ VocÃª recebe crÃ©ditos de energia solar na sua conta de luz\n' +
        'ðŸ’° Economia de atÃ© *20%* todo mÃªs â€” sem investimento\n' +
        'ðŸ“‹ Sem obras, sem instalaÃ§Ã£o, sem burocracia\n' +
        'ðŸ”„ Cancelamento sem multa a qualquer momento\n' +
        'ðŸŒ Energia 100% limpa e sustentÃ¡vel\n\n' +
        'Quer saber exatamente quanto vocÃª vai economizar?',
      );

      await this.sender.enviarMenuComBotoes(telefone, {
        titulo: 'PrÃ³ximo passo',
        corpo: 'O que deseja fazer?',
        opcoes: [
          { id: '2', texto: 'ðŸ’° Simular minha economia' },
          { id: '4', texto: 'ðŸ“¸ Enviar minha fatura', descricao: 'SimulaÃ§Ã£o detalhada com OCR' },
          { id: '3', texto: 'ðŸ‘¤ Falar com consultor' },
        ],
      });
      return;
    }

    if (corpo === '2' || corpo.toLowerCase().includes('simul')) {
      await this.prisma.conversaWhatsapp.update({
        where: { id: conversa.id },
        data: { estado: 'AGUARDANDO_VALOR_FATURA', contadorFallback: 0 },
      });
      await this.sender.enviarMensagem(
        telefone,
        'ðŸ’° Vamos simular sua economia!\n\nQual o *valor mÃ©dio* da sua conta de luz? (ex: 350)',
      );
      return;
    }

    if (corpo === '3' || corpo.toLowerCase().includes('consultor') || corpo.toLowerCase().includes('atendente')) {
      await this.encaminharAtendente(telefone, conversa.id, 'Lead via QR/propaganda solicitou consultor');
      return;
    }

    if (corpo === '4' || corpo.toLowerCase().includes('fatura') || corpo.toLowerCase().includes('foto')) {
      await this.prisma.conversaWhatsapp.update({
        where: { id: conversa.id },
        data: { estado: 'AGUARDANDO_FOTO_FATURA', contadorFallback: 0 },
      });
      await this.sender.enviarMensagem(telefone, 'ðŸ“¸ Envie uma *foto* ou *PDF* da sua conta de energia para uma simulaÃ§Ã£o detalhada!');
      return;
    }

    await this.incrementarFallback(conversa, telefone,
      'Responda *1* (conhecer), *2* (simular economia) ou *3* (falar com consultor).',
    );
  }

  private async handleAguardandoValorFatura(msg: MensagemRecebida, conversa: any): Promise<void> {
    const { telefone } = msg;
    const corpo = (msg.corpo ?? '').trim();

    // Extrair valor numÃ©rico
    const valorStr = corpo.replace(/[^\d.,]/g, '').replace(',', '.');
    const valor = parseFloat(valorStr);

    if (isNaN(valor) || valor <= 0 || valor > 50000) {
      await this.sender.enviarMensagem(
        telefone,
        'Por favor, informe o valor da sua conta de luz em reais (apenas o nÃºmero).\nExemplo: *350* ou *280,50*',
      );
      return;
    }

    // Calcular economia estimada com 20% de desconto
    const descontoPercentual = 20;
    const economiaMensal = valor * (descontoPercentual / 100);
    const economiaAnual = economiaMensal * 12;

    const fmt = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    await this.prisma.conversaWhatsapp.update({
      where: { id: conversa.id },
      data: {
        estado: 'RESULTADO_SIMULACAO_RAPIDA',
        dadosTemp: { ...(conversa.dadosTemp as any ?? {}), valorFaturaInformado: valor } as any,
        contadorFallback: 0,
      },
    });

    await this.sender.enviarMensagem(
      telefone,
      `ðŸŒ± *Resultado da sua simulaÃ§Ã£o:*\n\n` +
      `ðŸ“Š Conta atual: R$ ${fmt(valor)}\n` +
      `ðŸ’š Com a CoopereBR: R$ ${fmt(valor - economiaMensal)} (-${descontoPercentual}%)\n` +
      `ðŸ’µ *Economia mensal: R$ ${fmt(economiaMensal)}*\n` +
      `ðŸ“… *Economia anual: R$ ${fmt(economiaAnual)}*\n\n` +
      `Com sua conta de R$ ${fmt(valor)}, vocÃª economizaria cerca de *R$ ${fmt(economiaMensal)} por mÃªs* (R$ ${fmt(economiaAnual)} por ano)! ðŸŽ‰`,
    );

    await this.sender.enviarMenuComBotoes(telefone, {
      titulo: 'PrÃ³ximo passo',
      corpo: 'O que deseja fazer agora?',
      opcoes: [
        { id: '1', texto: 'âœ… Quero me cadastrar' },
        { id: '2', texto: 'ðŸ“‹ Receber mais informaÃ§Ãµes' },
        { id: '3', texto: 'âŒ NÃ£o tenho interesse' },
      ],
    });
  }

  private async handleResultadoSimulacaoRapida(msg: MensagemRecebida, conversa: any): Promise<void> {
    const { telefone } = msg;
    const corpo = this.respostaEfetiva(msg);

    if (corpo === '1' || corpo.toLowerCase().includes('cadastr')) {
      // Iniciar fluxo de cadastro normal
      await this.prisma.conversaWhatsapp.update({
        where: { id: conversa.id },
        data: { estado: 'AGUARDANDO_FOTO_FATURA', contadorFallback: 0 },
      });
      await this.sender.enviarMensagem(
        telefone,
        'ðŸŽ‰ Ã“timo! Para finalizar seu cadastro, envie uma *foto* ou *PDF* da sua conta de energia.\n\nIsso nos ajuda a calcular os crÃ©ditos ideais para vocÃª! ðŸ“¸',
      );
      return;
    }

    if (corpo === '2' || corpo.toLowerCase().includes('informaÃ§') || corpo.toLowerCase().includes('informac')) {
      const baseUrl = process.env.FRONTEND_URL ?? 'http://localhost:3001';
      await this.sender.enviarMensagem(
        telefone,
        'ðŸ“‹ *BenefÃ­cios da CoopereBR:*\n\n' +
        'âœ… Desconto de atÃ© 20% na conta de luz\n' +
        'âœ… Energia 100% solar e renovÃ¡vel\n' +
        'âœ… Sem investimento inicial\n' +
        'âœ… Sem obras ou instalaÃ§Ã£o\n' +
        'âœ… Cancelamento sem multa\n' +
        'âœ… CrÃ©ditos aplicados direto na sua conta\n' +
        'âœ… Acompanhe tudo pelo portal\n\n' +
        `ðŸŒ Acesse nosso portal: ${baseUrl}\n\n` +
        'Quando estiver pronto, digite *cadastro* para iniciar! ðŸ˜Š',
      );
      await this.prisma.conversaWhatsapp.update({
        where: { id: conversa.id },
        data: { estado: 'MENU_QR_PROPAGANDA', contadorFallback: 0 },
      });
      return;
    }

    if (corpo === '3' || corpo.toLowerCase().includes('interesse') || corpo.toLowerCase().includes('nÃ£o') || corpo.toLowerCase().includes('nao')) {
      await this.finalizarConversa(conversa.id);
      await this.sender.enviarMensagem(
        telefone,
        'Tudo bem! Se mudar de ideia, Ã© sÃ³ nos mandar uma mensagem. Obrigado pelo interesse! ðŸ’š',
      );
      return;
    }

    await this.incrementarFallback(conversa, telefone,
      'Responda *1* (cadastrar), *2* (mais informaÃ§Ãµes) ou *3* (sem interesse).',
    );
  }

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // ROTINA 2: Cooperado inadimplente abordado pelo sistema
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

  /**
   * Inicia abordagem proativa para cooperado com cobranÃ§a vencida.
   * Chamado pelo cron de cobranÃ§a vencida.
   */
  async iniciarFluxoInadimplente(
    telefone: string,
    cobrancaId: string,
    nomeCooperado: string,
    valor: number,
    dataVencimento: Date,
    pixCopiaECola?: string,
    linkPagamento?: string,
  ): Promise<void> {
    const fmt = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const dataFmt = dataVencimento.toLocaleDateString('pt-BR');
    const nome = nomeCooperado.split(' ')[0];

    await this.prisma.conversaWhatsapp.upsert({
      where: { telefone },
      update: {
        estado: 'MENU_INADIMPLENTE',
        dadosTemp: { cobrancaId, valor, dataVencimento: dataFmt, pixCopiaECola, linkPagamento, nomeCooperado } as any,
        contadorFallback: 0,
      },
      create: {
        telefone,
        estado: 'MENU_INADIMPLENTE',
        dadosTemp: { cobrancaId, valor, dataVencimento: dataFmt, pixCopiaECola, linkPagamento, nomeCooperado } as any,
      },
    });

    await this.sender.enviarMensagem(
      telefone,
      `OlÃ¡, ${nome}! ðŸ’š\n\n` +
      `Notamos que sua fatura no valor de *R$ ${fmt(valor)}* com vencimento em *${dataFmt}* estÃ¡ em aberto.\n\n` +
      `Sabemos que imprevistos acontecem â€” estamos aqui para ajudar! ðŸ¤`,
    );

    await this.sender.enviarMenuComBotoes(telefone, {
      titulo: 'Fatura em aberto',
      corpo: 'Como posso ajudar?',
      opcoes: [
        { id: '1', texto: 'ðŸ“‹ Ver detalhes da fatura' },
        { id: '2', texto: 'ðŸ’³ Negociar parcelamento' },
        { id: '3', texto: 'âœ… JÃ¡ paguei' },
      ],
    });
  }

  private async handleMenuInadimplente(msg: MensagemRecebida, conversa: any): Promise<void> {
    const { telefone } = msg;
    const corpo = this.respostaEfetiva(msg);
    const dadosTemp = (conversa.dadosTemp ?? {}) as Record<string, any>;

    if (corpo === '1' || corpo.toLowerCase().includes('detalhe')) {
      const fmt = (v: number) => Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      let detalhes = `ðŸ“‹ *Detalhes da fatura:*\n\n`;
      detalhes += `ðŸ’° Valor: R$ ${fmt(dadosTemp.valor)}\n`;
      detalhes += `ðŸ“… Vencimento: ${dadosTemp.dataVencimento}\n`;

      if (dadosTemp.pixCopiaECola) {
        detalhes += `\n*Pague via PIX â€” Copia e Cola:*\n${dadosTemp.pixCopiaECola}\n`;
      }
      if (dadosTemp.linkPagamento) {
        detalhes += `\nðŸ”— Link de pagamento: ${dadosTemp.linkPagamento}\n`;
      }

      detalhes += `\n_DÃºvidas? Responda esta mensagem._`;
      await this.sender.enviarMensagem(telefone, detalhes);

      await this.sender.enviarMenuComBotoes(telefone, {
        titulo: 'O que deseja?',
        corpo: 'Posso ajudar com mais alguma coisa?',
        opcoes: [
          { id: '2', texto: 'ðŸ’³ Negociar parcelamento' },
          { id: '3', texto: 'âœ… JÃ¡ paguei' },
        ],
      });
      return;
    }

    if (corpo === '2' || corpo.toLowerCase().includes('negoci') || corpo.toLowerCase().includes('parcel')) {
      await this.prisma.conversaWhatsapp.update({
        where: { id: conversa.id },
        data: { estado: 'NEGOCIACAO_PARCELAMENTO', contadorFallback: 0 },
      });

      const fmt = (v: number) => Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      const valorParcela2x = dadosTemp.valor / 2;
      const valorParcela3x = dadosTemp.valor / 3;

      await this.sender.enviarMensagem(
        telefone,
        `ðŸ’³ *OpÃ§Ãµes de parcelamento:*\n\n` +
        `Podemos parcelar seu dÃ©bito de R$ ${fmt(dadosTemp.valor)} sem juros:\n\n` +
        `â€¢ 2x de R$ ${fmt(valorParcela2x)}\n` +
        `â€¢ 3x de R$ ${fmt(valorParcela3x)}\n`,
      );

      await this.sender.enviarMenuComBotoes(telefone, {
        titulo: 'Parcelamento',
        corpo: 'Deseja prosseguir com o parcelamento?',
        opcoes: [
          { id: '1', texto: 'âœ… Sim, quero parcelar' },
          { id: '2', texto: 'ðŸ’° Prefiro pagar Ã  vista' },
        ],
      });
      return;
    }

    if (corpo === '3' || corpo.toLowerCase().includes('paguei') || corpo.toLowerCase().includes('jÃ¡ paguei')) {
      await this.finalizarConversa(conversa.id);
      await this.sender.enviarMensagem(
        telefone,
        'âœ… Ã“timo! Verificaremos o pagamento em atÃ© 24h.\n\n' +
        'Caso precise de algo, entre em contato. Obrigado! ðŸ’š',
      );
      return;
    }

    await this.incrementarFallback(conversa, telefone,
      'Responda *1* (ver detalhes), *2* (negociar parcelamento) ou *3* (jÃ¡ paguei).',
    );
  }

  private async handleNegociacaoParcelamento(msg: MensagemRecebida, conversa: any): Promise<void> {
    const { telefone } = msg;
    const corpo = this.respostaEfetiva(msg);
    const dadosTemp = (conversa.dadosTemp ?? {}) as Record<string, any>;

    if (corpo === '1' || corpo.toLowerCase().includes('sim') || corpo.toLowerCase().includes('parcel')) {
      // Gerar acordo de parcelamento
      const fmt = (v: number) => Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      const valorParcela = dadosTemp.valor / 3;

      // Atualizar cobranÃ§a com flag de negociaÃ§Ã£o
      if (dadosTemp.cobrancaId) {
        try {
          await this.prisma.cobranca.update({
            where: { id: dadosTemp.cobrancaId },
            data: { motivoCancelamento: `Parcelamento 3x negociado via WhatsApp em ${new Date().toLocaleDateString('pt-BR')}` },
          });
        } catch (err) {
          this.logger.warn(`Erro ao atualizar cobranÃ§a com parcelamento: ${err.message}`);
        }
      }

      await this.finalizarConversa(conversa.id);
      await this.sender.enviarMensagem(
        telefone,
        `âœ… *Acordo de parcelamento gerado!*\n\n` +
        `ðŸ“‹ Valor total: R$ ${fmt(dadosTemp.valor)}\n` +
        `ðŸ’³ Parcelamento: 3x de R$ ${fmt(valorParcela)} sem juros\n\n` +
        `Nossa equipe enviarÃ¡ os boletos/PIX de cada parcela nos prÃ³ximos dias.\n\n` +
        `Obrigado pela confianÃ§a! ðŸ’š`,
      );
      return;
    }

    if (corpo === '2' || corpo.toLowerCase().includes('vista') || corpo.toLowerCase().includes('pagar')) {
      await this.prisma.conversaWhatsapp.update({
        where: { id: conversa.id },
        data: { estado: 'MENU_INADIMPLENTE', contadorFallback: 0 },
      });

      const fmt = (v: number) => Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      let texto = `ðŸ’° Para pagar Ã  vista (R$ ${fmt(dadosTemp.valor)}):\n`;
      if (dadosTemp.pixCopiaECola) {
        texto += `\n*PIX Copia e Cola:*\n${dadosTemp.pixCopiaECola}\n`;
      }
      if (dadosTemp.linkPagamento) {
        texto += `\nðŸ”— Link: ${dadosTemp.linkPagamento}\n`;
      }
      texto += `\nApÃ³s o pagamento, ele serÃ¡ confirmado em atÃ© 24h. ðŸ’š`;
      await this.sender.enviarMensagem(telefone, texto);

      await this.finalizarConversa(conversa.id);
      return;
    }

    await this.incrementarFallback(conversa, telefone,
      'Responda *1* (sim, quero parcelar) ou *2* (prefiro pagar Ã  vista).',
    );
  }

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // ROTINA 3: Novo membro indicado (fluxo de convite melhorado)
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

  /**
   * Inicia fluxo de convite com botÃµes interativos para novo indicado.
   * SubstituiÃ§Ã£o melhorada do iniciarFluxoConvite existente.
   */
  async iniciarFluxoConviteIndicacao(telefone: string, indicadorNome: string, codigoIndicacao: string): Promise<void> {
    await this.prisma.conversaWhatsapp.upsert({
      where: { telefone },
      update: {
        estado: 'MENU_CONVITE_INDICACAO',
        dadosTemp: { codigoIndicacao, indicadorNome } as any,
        contadorFallback: 0,
      },
      create: {
        telefone,
        estado: 'MENU_CONVITE_INDICACAO',
        dadosTemp: { codigoIndicacao, indicadorNome } as any,
      },
    });

    await this.sender.enviarMensagem(
      telefone,
      `ðŸ‘‹ OlÃ¡! VocÃª foi indicado por *${indicadorNome}* para conhecer a *CoopereBR*!\n\n` +
      `ðŸŒ± Economize na conta de luz com energia solar compartilhada â€” sem investimento e sem obras.`,
    );

    await this.sender.enviarMenuComBotoes(telefone, {
      titulo: 'IndicaÃ§Ã£o CoopereBR',
      corpo: 'O que deseja fazer?',
      opcoes: [
        { id: '1', texto: 'ðŸŒ± Conhecer os benefÃ­cios', descricao: 'Saiba como funciona' },
        { id: '2', texto: 'ðŸ’° Simular minha economia', descricao: 'Veja quanto vai economizar' },
        { id: '3', texto: 'ðŸš€ Iniciar cadastro agora', descricao: 'Cadastro rÃ¡pido express' },
      ],
    });
  }

  private async handleMenuConviteIndicacao(msg: MensagemRecebida, conversa: any): Promise<void> {
    const { telefone } = msg;
    const corpo = this.respostaEfetiva(msg);
    const dadosTemp = (conversa.dadosTemp ?? {}) as Record<string, any>;

    if (corpo === '1' || corpo.toLowerCase().includes('benefÃ­cio') || corpo.toLowerCase().includes('beneficio') || corpo.toLowerCase().includes('conhecer')) {
      await this.sender.enviarMensagem(
        telefone,
        'ðŸŒ± *BenefÃ­cios da CoopereBR:*\n\n' +
        'â˜€ï¸ Energia 100% solar e renovÃ¡vel\n' +
        'ðŸ’° Economia de atÃ© *20%* na conta de luz\n' +
        'ðŸ“‹ Sem investimento inicial\n' +
        'ðŸ”§ Sem obras ou instalaÃ§Ã£o\n' +
        'ðŸ”„ Cancelamento sem multa\n' +
        'ðŸ“Š Acompanhe seus crÃ©ditos pelo portal\n\n' +
        `Como vocÃª foi indicado por *${dadosTemp.indicadorNome}*, terÃ¡ atendimento prioritÃ¡rio! ðŸŽ‰`,
      );

      await this.sender.enviarMenuComBotoes(telefone, {
        titulo: 'PrÃ³ximo passo',
        corpo: 'Deseja continuar?',
        opcoes: [
          { id: '2', texto: 'ðŸ’° Simular minha economia' },
          { id: '3', texto: 'ðŸš€ Iniciar cadastro agora' },
        ],
      });
      return;
    }

    if (corpo === '2' || corpo.toLowerCase().includes('simul')) {
      await this.prisma.conversaWhatsapp.update({
        where: { id: conversa.id },
        data: { estado: 'AGUARDANDO_VALOR_FATURA', contadorFallback: 0 },
      });
      await this.sender.enviarMensagem(
        telefone,
        'ðŸ’° Vamos simular sua economia!\n\nQual o *valor mÃ©dio* da sua conta de luz? (ex: 350)',
      );
      return;
    }

    if (corpo === '3' || corpo.toLowerCase().includes('cadastro') || corpo.toLowerCase().includes('iniciar')) {
      // Cadastro express: pede nome, CPF, telefone (jÃ¡ tem), email, valor fatura
      await this.prisma.conversaWhatsapp.update({
        where: { id: conversa.id },
        data: { estado: 'CADASTRO_EXPRESS_NOME', contadorFallback: 0 },
      });
      await this.sender.enviarMensagem(
        telefone,
        'ðŸš€ *Cadastro Express!*\n\nVamos precisar de poucos dados. Qual Ã© o seu *nome completo*?',
      );
      return;
    }

    await this.incrementarFallback(conversa, telefone,
      'Responda *1* (benefÃ­cios), *2* (simular economia) ou *3* (iniciar cadastro).',
    );
  }

  private async handleCadastroExpressNome(msg: MensagemRecebida, conversa: any): Promise<void> {
    const { telefone } = msg;
    const corpo = (msg.corpo ?? '').trim();

    if (!corpo || corpo.length < 3) {
      await this.sender.enviarMensagem(telefone, 'Por favor, informe seu *nome completo*:');
      return;
    }

    const dadosTemp = (conversa.dadosTemp ?? {}) as Record<string, unknown>;
    await this.prisma.conversaWhatsapp.update({
      where: { id: conversa.id },
      data: {
        estado: 'CADASTRO_EXPRESS_CPF',
        dadosTemp: { ...dadosTemp, nomeInformado: corpo } as any,
      },
    });
    await this.sender.enviarMensagem(telefone, `Obrigado, *${corpo}*! Agora informe seu *CPF* (apenas nÃºmeros):`);
  }

  private async handleCadastroExpressCpf(msg: MensagemRecebida, conversa: any): Promise<void> {
    const { telefone } = msg;
    const corpo = (msg.corpo ?? '').trim().replace(/\D/g, '');

    if (corpo.length !== 11) {
      await this.sender.enviarMensagem(telefone, 'CPF invÃ¡lido. Informe os *11 dÃ­gitos* do seu CPF:');
      return;
    }

    const dadosTemp = (conversa.dadosTemp ?? {}) as Record<string, unknown>;
    await this.prisma.conversaWhatsapp.update({
      where: { id: conversa.id },
      data: {
        estado: 'CADASTRO_EXPRESS_EMAIL',
        dadosTemp: { ...dadosTemp, cpfInformado: corpo } as any,
      },
    });
    await this.sender.enviarMensagem(telefone, 'Agora informe seu *e-mail*:');
  }

  private async handleCadastroExpressEmail(msg: MensagemRecebida, conversa: any): Promise<void> {
    const { telefone } = msg;
    const corpo = (msg.corpo ?? '').trim().toLowerCase();

    if (!corpo.includes('@')) {
      await this.sender.enviarMensagem(telefone, 'E-mail invÃ¡lido. Informe um *e-mail vÃ¡lido*:');
      return;
    }

    const dadosTemp = (conversa.dadosTemp ?? {}) as Record<string, unknown>;
    await this.prisma.conversaWhatsapp.update({
      where: { id: conversa.id },
      data: {
        estado: 'CADASTRO_EXPRESS_VALOR_FATURA',
        dadosTemp: { ...dadosTemp, emailInformado: corpo } as any,
      },
    });
    await this.sender.enviarMensagem(telefone, 'Quase lÃ¡! Qual o *valor mÃ©dio* da sua conta de luz? (ex: 350)');
  }

  private async handleCadastroExpressValorFatura(msg: MensagemRecebida, conversa: any): Promise<void> {
    const { telefone } = msg;
    const corpo = (msg.corpo ?? '').trim();

    const valorStr = corpo.replace(/[^\d.,]/g, '').replace(',', '.');
    const valor = parseFloat(valorStr);

    if (isNaN(valor) || valor <= 0) {
      await this.sender.enviarMensagem(telefone, 'Informe o valor em reais (apenas o nÃºmero). Ex: *350*');
      return;
    }

    const dadosTemp = (conversa.dadosTemp ?? {}) as Record<string, any>;
    const nome = String(dadosTemp.nomeInformado ?? '');
    const cpf = String(dadosTemp.cpfInformado ?? '');
    const email = String(dadosTemp.emailInformado ?? '');
    const codigoRef = dadosTemp.codigoIndicacao as string | undefined;
    const indicadorNome = dadosTemp.indicadorNome as string | undefined;

    // Criar cooperado lead
    const telefoneNorm = telefone.replace(/\D/g, '');
    const telefoneSemPais = telefoneNorm.replace(/^55/, '');
    let cooperado = await this.prisma.cooperado.findFirst({
      where: {
        OR: [
          { telefone: telefoneNorm },
          { telefone: telefoneSemPais },
          { telefone: `55${telefoneSemPais}` },
        ],
      },
    });

    if (!cooperado) {
      cooperado = await this.prisma.cooperado.create({
        data: {
          nomeCompleto: nome,
          cpf,
          email,
          telefone: telefoneNorm,
          status: 'PENDENTE' as any,
          tipoCooperado: 'COM_UC' as any,
        },
      });
    } else {
      await this.prisma.cooperado.update({
        where: { id: cooperado.id },
        data: {
          nomeCompleto: nome || cooperado.nomeCompleto,
          ...(cpf ? { cpf } : {}),
          ...(email ? { email } : {}),
        },
      });
    }

    // Registrar indicaÃ§Ã£o
    if (codigoRef) {
      try {
        await this.indicacoes.registrarIndicacao(cooperado.id, codigoRef);
        this.logger.log(`IndicaÃ§Ã£o express registrada para ${cooperado.id} via cÃ³digo ${codigoRef}`);
      } catch (err) {
        this.logger.warn(`Erro ao registrar indicaÃ§Ã£o express: ${err.message}`);
      }
    }

    await this.prisma.conversaWhatsapp.update({
      where: { id: conversa.id },
      data: { cooperadoId: cooperado.id },
    });

    await this.finalizarConversa(conversa.id);

    const economiaMensal = valor * 0.2;
    const fmt = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    let msgFinal = `ðŸŽ‰ *Perfeito! Seu cadastro estÃ¡ em anÃ¡lise.*\n\n`;
    msgFinal += `ðŸ‘¤ ${nome}\n`;
    msgFinal += `ðŸ“§ ${email}\n`;
    msgFinal += `ðŸ’° Economia estimada: R$ ${fmt(economiaMensal)}/mÃªs\n\n`;
    if (indicadorNome) {
      msgFinal += `*${indicadorNome}* serÃ¡ notificado quando vocÃª for aprovado! ðŸŽ‰\n\n`;
    }
    msgFinal += `Nossa equipe entrarÃ¡ em contato em breve. Obrigado! ðŸ’š`;

    await this.sender.enviarMensagem(telefone, msgFinal);

    // Notificar indicador
    if (codigoRef) {
      const indicador = await this.prisma.cooperado.findUnique({
        where: { codigoIndicacao: codigoRef },
        select: { telefone: true, nomeCompleto: true, cooperativaId: true },
      });
      if (indicador?.telefone) {
        await this.sender.enviarMensagem(
          indicador.telefone,
          `ðŸŽ‰ Boa notÃ­cia! *${nome}* acabou de completar o cadastro express atravÃ©s do seu convite!\n\n` +
          `Quando ele for aprovado e pagar a primeira fatura, vocÃª receberÃ¡ seu benefÃ­cio automaticamente. Obrigado por indicar! ðŸ™`,
        ).catch(() => {});

        // Notificar admin
        if (indicador.cooperativaId) {
          const admin = await this.prisma.usuario.findFirst({
            where: { cooperativaId: indicador.cooperativaId, perfil: 'ADMIN' },
            select: { telefone: true },
          });
          if (admin?.telefone) {
            await this.sender.enviarMensagem(
              admin.telefone,
              `ðŸ“‹ Novo cadastro express via indicaÃ§Ã£o:\n${nome} | Tel: ${telefoneNorm} | Email: ${email}\nIndicado por: ${indicador.nomeCompleto?.trim() || 'Cooperado'}`,
            ).catch(() => {});
          }
        }
      }
    }
  }

  // â”€â”€â”€ LEAD FORA DA ÃREA: captura intenÃ§Ã£o â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  private async handleLeadForaArea(msg: MensagemRecebida, conversa: any): Promise<void> {
    const { telefone } = msg;
    const corpo = (msg.corpo ?? '').trim();
    const dadosTemp = (conversa.dadosTemp ?? {}) as Record<string, any>;
    const distribuidora = String(dadosTemp.distribuidora ?? '');
    const economiaEstimada = Number(dadosTemp.economiaEstimada ?? 0);
    const valorFatura = Number(dadosTemp.totalAPagar ?? 0);
    const titular = String(dadosTemp.titular ?? '');
    const numeroUC = String(dadosTemp.numeroUC ?? '');
    const endereco = String(dadosTemp.enderecoInstalacao ?? '');

    // Extrair cidade/estado do endereÃ§o (melhor esforÃ§o)
    const partes = endereco.split(/[-â€“,]/);
    const cidade = partes.length >= 2 ? partes[partes.length - 2]?.trim() : undefined;
    const estado = partes.length >= 1 ? partes[partes.length - 1]?.trim()?.substring(0, 2)?.toUpperCase() : undefined;

    if (corpo === '1') {
      // Salvar lead com intenÃ§Ã£o confirmada
      await this.prisma.leadExpansao.create({
        data: {
          telefone: telefone.replace(/\D/g, ''),
          nomeCompleto: titular || undefined,
          distribuidora,
          cidade,
          estado: estado && estado.length === 2 ? estado : undefined,
          numeroUC: numeroUC || undefined,
          valorFatura: valorFatura > 0 ? valorFatura : undefined,
          economiaEstimada: economiaEstimada > 0 ? economiaEstimada : undefined,
          intencaoConfirmada: true,
        },
      });

      await this.finalizarConversa(conversa.id);
      await this.sender.enviarMensagem(
        telefone,
        `âœ… *Pronto! VocÃª serÃ¡ avisado assim que chegarmos na regiÃ£o da ${distribuidora}.*\n\n` +
        `Enquanto isso, que tal indicar amigos e vizinhos? Quanto mais demanda, mais rÃ¡pido chegamos! ðŸš€\n\n` +
        `Obrigado pelo interesse na CoopereBR! ðŸ’š`,
      );
      return;
    }

    if (corpo === '2') {
      // Salvar lead sem intenÃ§Ã£o (registro passivo)
      await this.prisma.leadExpansao.create({
        data: {
          telefone: telefone.replace(/\D/g, ''),
          nomeCompleto: titular || undefined,
          distribuidora,
          cidade,
          estado: estado && estado.length === 2 ? estado : undefined,
          numeroUC: numeroUC || undefined,
          valorFatura: valorFatura > 0 ? valorFatura : undefined,
          economiaEstimada: economiaEstimada > 0 ? economiaEstimada : undefined,
          intencaoConfirmada: false,
        },
      });

      await this.finalizarConversa(conversa.id);
      await this.sender.enviarMensagem(
        telefone,
        `Tudo bem! Se mudar de ideia, Ã© sÃ³ enviar outra fatura. ðŸ˜Š\n\nObrigado pelo interesse na CoopereBR! ðŸ’š`,
      );
      return;
    }

    // NÃ£o entendeu
    await this.sender.enviarMensagem(
      telefone,
      'Por favor, responda:\n1ï¸âƒ£ Sim, quero ser avisado\n2ï¸âƒ£ NÃ£o por enquanto',
    );
  }

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // CADASTRO POR PROXY: cooperado cadastra um amigo pelo WhatsApp
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

  private async handleMenuConvidarAmigo(msg: MensagemRecebida, conversa: any): Promise<void> {
    const { telefone } = msg;
    const corpo = this.respostaEfetiva(msg);
    const dadosTemp = (conversa.dadosTemp ?? {}) as Record<string, any>;

    if (corpo === '1') {
      // Enviar link de indicaÃ§Ã£o
      const baseUrl = process.env.FRONTEND_URL ?? 'https://cooperebr.com.br';
      const link = `${baseUrl}/entrar?ref=${dadosTemp.codigoIndicacao}`;
      await this.sender.enviarMensagem(telefone,
        `ðŸŽ *Seu link de indicaÃ§Ã£o personalizado:*\n\n${link}\n\n` +
        `ðŸ“² Compartilhe com amigos, familiares e colegas!\n\n` +
        `Quando seu indicado pagar a primeira fatura, vocÃª recebe seu benefÃ­cio automaticamente. ðŸ’š`
      );
      await this.resetarConversa(telefone);
      return;
    }

    if (corpo === '2') {
      // Iniciar cadastro por proxy
      await this.prisma.conversaWhatsapp.update({
        where: { id: conversa.id },
        data: { estado: 'CADASTRO_PROXY_NOME', contadorFallback: 0 },
      });
      await this.sender.enviarMensagem(telefone, 'Qual o *nome completo* do seu amigo?');
      return;
    }

    await this.incrementarFallback(conversa, telefone,
      'Responda *1* (enviar link) ou *2* (cadastrar meu amigo).',
    );
  }

  private async handleCadastroProxyNome(msg: MensagemRecebida, conversa: any): Promise<void> {
    const { telefone } = msg;
    const corpo = (msg.corpo ?? '').trim();

    if (!corpo || corpo.length < 3) {
      await this.sender.enviarMensagem(telefone, 'Por favor, informe o *nome completo* do seu amigo:');
      return;
    }

    const dadosTemp = (conversa.dadosTemp ?? {}) as Record<string, unknown>;
    await this.prisma.conversaWhatsapp.update({
      where: { id: conversa.id },
      data: {
        estado: 'CADASTRO_PROXY_TELEFONE',
        dadosTemp: { ...dadosTemp, proxyNome: corpo } as any,
      },
    });
    await this.sender.enviarMensagem(telefone, `Qual o celular de *${corpo}*? (com DDD, ex: 27999991234)`);
  }

  private async handleCadastroProxyTelefone(msg: MensagemRecebida, conversa: any): Promise<void> {
    const { telefone } = msg;
    const corpo = (msg.corpo ?? '').trim().replace(/\D/g, '');

    if (corpo.length < 10 || corpo.length > 13) {
      await this.sender.enviarMensagem(telefone, 'NÃºmero invÃ¡lido. Informe com DDD (ex: 27999991234):');
      return;
    }

    const dadosTemp = (conversa.dadosTemp ?? {}) as Record<string, unknown>;
    const proxyTelefone = corpo.startsWith('55') ? corpo : `55${corpo}`;
    await this.prisma.conversaWhatsapp.update({
      where: { id: conversa.id },
      data: {
        estado: 'AGUARDANDO_FATURA_PROXY',
        dadosTemp: { ...dadosTemp, proxyTelefone } as any,
      },
    });
    const nome = dadosTemp.proxyNome as string;
    await this.sender.enviarMensagem(telefone, `Agora envie a foto ou PDF da conta de luz de *${nome}* ðŸ“Ž`);
  }

  private async handleAguardandoFaturaProxy(msg: MensagemRecebida, conversa: any): Promise<void> {
    const { telefone, tipo, mediaBase64, mimeType } = msg;
    const dadosTemp = (conversa.dadosTemp ?? {}) as Record<string, any>;

    const isMidia =
      (tipo === 'imagem' || tipo === 'documento') &&
      mediaBase64 &&
      mimeType &&
      ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'].includes(mimeType);

    if (!isMidia) {
      await this.sender.enviarMensagem(telefone, 'Por favor, envie uma *foto* ou *PDF* da conta de energia do seu amigo. ðŸ“¸');
      return;
    }

    await this.sender.enviarMensagem(telefone, 'ðŸ“„ Recebi! Analisando os dados... Aguarde um momento. â³');

    const tipoArquivo = mimeType === 'application/pdf' ? 'pdf' : 'imagem';
    let dadosExtraidos: Record<string, unknown>;
    try {
      dadosExtraidos = await this.faturasService.extrairOcr(mediaBase64!, tipoArquivo) as unknown as Record<string, unknown>;
    } catch {
      await this.sender.enviarMensagem(telefone, 'NÃ£o consegui identificar os dados. Envie uma foto mais nÃ­tida ou o PDF da fatura. ðŸ“¸');
      return;
    }

    const consumoAtualKwh = Number(dadosExtraidos.consumoAtualKwh ?? 0);
    if (consumoAtualKwh <= 0) {
      await this.sender.enviarMensagem(telefone, 'O arquivo nÃ£o parece ser uma fatura de energia. Tente novamente. ðŸ“„');
      return;
    }

    // Calcular proposta
    const historico = (dadosExtraidos.historicoConsumo as Array<{ mesAno: string; consumoKwh: number; valorRS: number }>) ?? [];
    const valorMesRecente = Number(dadosExtraidos.totalAPagar ?? 0);
    const kwhs = historico.map(h => h.consumoKwh).filter(v => v > 0);
    const kwhMedio = kwhs.length > 0 ? kwhs.reduce((a, b) => a + b, 0) / kwhs.length : consumoAtualKwh;
    const valores = historico.map(h => h.valorRS).filter(v => v > 0);
    const valorMedio = valores.length > 0 ? valores.reduce((a, b) => a + b, 0) / valores.length : valorMesRecente;

    let resultado: any = null;
    try {
      const calcResult = await this.motorProposta.calcular({
        cooperadoId: 'temp',
        historico: historico.map(h => ({ mesAno: h.mesAno, consumoKwh: h.consumoKwh, valorRS: h.valorRS })),
        kwhMesRecente: consumoAtualKwh || kwhMedio,
        valorMesRecente: valorMesRecente || valorMedio,
        mesReferencia: String(dadosExtraidos.mesReferencia ?? ''),
        tipoFornecimento: String(dadosExtraidos.tipoFornecimento ?? 'TRIFASICO') as any,
      });
      resultado = calcResult.resultado;
    } catch (err) {
      this.logger.warn(`Erro ao calcular proposta proxy: ${err.message}`);
    }

    const economiaMensal = resultado?.economiaMensal ?? 0;
    const distribuidora = String(dadosExtraidos.distribuidora ?? '');
    const numeroUC = String(dadosExtraidos.numeroUC ?? '');
    const proxyNome = dadosTemp.proxyNome as string;

    await this.prisma.conversaWhatsapp.update({
      where: { id: conversa.id },
      data: {
        estado: 'CONFIRMAR_PROXY',
        dadosTemp: {
          ...dadosTemp,
          ...dadosExtraidos,
          resultado,
          economiaMensal,
          distribuidora,
          numeroUC,
        } as any,
      },
    });

    const fmt = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    let resposta = `*${proxyNome}* economizaria `;
    if (economiaMensal > 0) {
      resposta += `*R$ ${fmt(economiaMensal)}/mÃªs* â˜€ï¸\n\n`;
    } else {
      resposta += `com energia solar! â˜€ï¸\n\n`;
    }
    resposta += `Confirma o cadastro?\n1ï¸âƒ£ Sim, cadastrar\n2ï¸âƒ£ NÃ£o por enquanto`;

    await this.sender.enviarMensagem(telefone, resposta);
  }

  private async handleConfirmarProxy(msg: MensagemRecebida, conversa: any): Promise<void> {
    const { telefone } = msg;
    const corpo = this.respostaEfetiva(msg);
    const dadosTemp = (conversa.dadosTemp ?? {}) as Record<string, any>;

    if (corpo === '1' || corpo.toLowerCase().includes('sim')) {
      const proxyNome = dadosTemp.proxyNome as string;
      const proxyTelefone = dadosTemp.proxyTelefone as string;
      const indicadorId = dadosTemp.indicadorId as string;
      const cooperativaId = dadosTemp.cooperativaId as string;
      const economiaMensal = Number(dadosTemp.economiaMensal ?? 0);
      const distribuidora = dadosTemp.distribuidora as string | undefined;
      const numeroUC = dadosTemp.numeroUC as string | undefined;

      try {
        // Chamar endpoint de prÃ©-cadastro internamente
        const cooperado = await this.prisma.cooperado.create({
          data: {
            nomeCompleto: proxyNome,
            cpf: `PROXY_${Date.now()}`,
            email: `proxy_${Date.now()}@pendente.cooperebr`,
            telefone: proxyTelefone,
            status: 'PENDENTE_ASSINATURA',
            cooperadoIndicadorId: indicadorId,
            cooperativaId,
          },
        });

        // Gerar token JWT
        const jwt = require('jsonwebtoken');
        const secret = process.env.JWT_SECRET;
        const token = jwt.sign(
          { cooperadoId: cooperado.id, tipo: 'assinatura' },
          secret,
          { expiresIn: '7d' },
        );
        const expiraEm = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
        await this.prisma.cooperado.update({
          where: { id: cooperado.id },
          data: { tokenAssinatura: token, tokenAssinaturaExp: expiraEm },
        });

        const baseUrl = process.env.FRONTEND_URL ?? 'https://cooperebr.com.br';
        const link = `${baseUrl}/portal/assinar/${token}`;

        const indicadorNome = dadosTemp.indicadorNome as string;
        const fmt = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

        // Enviar mensagem para o amigo
        let msgAmigo = `${indicadorNome} te cadastrou na *CoopereBR*! â˜€ï¸\n\n`;
        if (economiaMensal > 0) {
          msgAmigo += `Sua economia estimada Ã© de *R$ ${fmt(economiaMensal)}/mÃªs*.\n\n`;
        }
        msgAmigo += `Para confirmar, acesse:\n${link}\n\n`;
        msgAmigo += `O link Ã© vÃ¡lido por 7 dias.`;

        await this.sender.enviarMensagem(proxyTelefone, msgAmigo).catch(err => {
          this.logger.warn(`Erro ao enviar WA para amigo proxy ${proxyTelefone}: ${err.message}`);
        });

        // Notificar cooperado
        await this.sender.enviarMensagem(telefone,
          `âœ… Pronto! Enviei o link para *${proxyNome}* confirmar.\n` +
          `Quando ele assinar, vocÃª receberÃ¡ seu benefÃ­cio!`
        );
      } catch (err) {
        this.logger.error(`Erro no cadastro proxy: ${err.message}`);
        await this.sender.enviarMensagem(telefone, 'âŒ Ocorreu um erro ao cadastrar. Tente novamente mais tarde.');
      }

      await this.resetarConversa(telefone);
      return;
    }

    if (corpo === '2' || corpo.toLowerCase().includes('nÃ£o') || corpo.toLowerCase().includes('nao')) {
      await this.sender.enviarMensagem(telefone, 'Tudo bem! Se quiser tentar depois, Ã© sÃ³ me avisar.');
      await this.resetarConversa(telefone);
      return;
    }

    await this.incrementarFallback(conversa, telefone,
      'Responda *1* (sim, cadastrar) ou *2* (nÃ£o por enquanto).',
    );
  }

  // â”€â”€â”€ MENU FATURA: lista cobranÃ§as pendentes â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  private async handleMenuFatura(msg: MensagemRecebida, conversa: any): Promise<void> {
    const { telefone } = msg;

    const telefoneNorm = telefone.replace(/\D/g, '');
    const telefoneSemPais = telefoneNorm.replace(/^55/, '');
    const cooperado = await this.prisma.cooperado.findFirst({
      where: {
        OR: [
          { telefone: telefoneNorm },
          { telefone: telefoneSemPais },
          { telefone: '55' + telefoneSemPais },
        ],
        status: { in: ['ATIVO', 'AGUARDANDO_CONCESSIONARIA'] as any[] },
      },
      select: { id: true, nomeCompleto: true, cooperativaId: true },
    });
    if (!cooperado) {
      await this.sender.enviarMensagem(
        telefone,
        'NÃ£o encontramos um cadastro vinculado a este nÃºmero. ðŸ˜•\n\nSe vocÃª Ã© cooperado, entre em contato pelo site cooperebr.com.br para atualizar seu telefone.',
      );
      await this.resetarConversa(telefone);
      return;
    }
    const cobrancas = await this.prisma.cobranca.findMany({
      where: { contrato: { cooperadoId: cooperado.id }, status: { in: ['A_VENCER', 'VENCIDO', 'PENDENTE'] as any[] } },
      include: { asaasCobrancas: true },
      orderBy: { dataVencimento: 'asc' },
      take: 5,
    });

    if (cobrancas.length === 0) {
      await this.sender.enviarMensagem(
        telefone,
        `OlÃ¡, ${(cooperado.nomeCompleto?.trim() || 'Cooperado').split(' ')[0]}! ðŸ˜Š\n\nVocÃª nÃ£o tem faturas pendentes no momento. EstÃ¡ tudo em dia! âœ…`,
      );
      await this.resetarConversa(telefone);
      return;
    }

    // Pegar cobranÃ§a mais recente (A_VENCER ou VENCIDO â€” jÃ¡ filtrado pelo service)
    const cobranca = cobrancas[0];
    const nome = (cooperado.nomeCompleto?.trim() || 'Cooperado').split(' ')[0];
    const mesStr = String(cobranca.mesReferencia).padStart(2, '0');
    const ano = cobranca.anoReferencia;
    const valor = Number(cobranca.valorLiquido).toFixed(2).replace('.', ',');
    const dataVenc = new Date(cobranca.dataVencimento);
    const dataVencStr = dataVenc.toLocaleDateString('pt-BR');

    // Calcular dias para vencer
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const vencDate = new Date(dataVenc);
    vencDate.setHours(0, 0, 0, 0);
    const diasParaVencer = Math.ceil((vencDate.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));

    // RÃ©gua de urgÃªncia
    let cabecalho: string;
    if (diasParaVencer > 5) {
      cabecalho = `âœ… Sua fatura vence em ${diasParaVencer} dias`;
    } else if (diasParaVencer >= 2) {
      cabecalho = `âš ï¸ AtenÃ§Ã£o! Sua fatura vence em ${diasParaVencer} dias`;
    } else if (diasParaVencer === 1) {
      cabecalho = `ðŸ”” Sua fatura vence *amanhÃ£*!`;
    } else if (diasParaVencer === 0) {
      cabecalho = `ðŸš¨ Sua fatura vence *hoje*!`;
    } else {
      cabecalho = `âŒ Sua fatura estÃ¡ *vencida* hÃ¡ ${Math.abs(diasParaVencer)} dia(s)!`;
    }

    const statusLabel = cobranca.status === 'VENCIDO' ? 'âš ï¸ VENCIDA' : 'ðŸ“… A vencer';

    let texto = `ðŸ’š *CoopereBR â€” Fatura ${mesStr}/${ano}*\n\n`;
    texto += `OlÃ¡, ${nome}! ðŸ‘‹\n\n`;
    texto += `${cabecalho}\n\n`;
    texto += `${statusLabel}\n`;
    texto += `ðŸ‘¤ ${cooperado.nomeCompleto?.trim() || 'Cooperado'}\n`;
    texto += `ðŸ“† CompetÃªncia: ${mesStr}/${ano}\n`;
    texto += `ðŸ’° Valor: *R$ ${valor}*\n`;
    texto += `ðŸ“… Vencimento: ${dataVencStr}\n`;

    await this.sender.enviarMensagem(telefone, texto);

    // Enviar menu com botÃµes
    await this.sender.enviarMenuComBotoes(telefone, {
      titulo: 'OpÃ§Ãµes de pagamento',
      corpo: 'Como deseja pagar ou consultar?',
      opcoes: [
        { id: 'pix', texto: 'Pagar com PIX' },
        { id: 'boleto', texto: 'CÃ³digo de barras' },
        { id: 'portal', texto: 'Ver fatura' },
      ],
    });

    // Salvar cobrancaId no dadosTemp para uso no handleRespostaMenuFatura
    await this.prisma.conversaWhatsapp.update({
      where: { id: conversa.id },
      data: {
        estado: 'MENU_FATURA',
        dadosTemp: { cobrancaId: cobranca.id },
      },
    });
  }

  // â”€â”€â”€ RESPOSTA MENU FATURA: usuÃ¡rio escolheu opÃ§Ã£o do menu â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  private async handleRespostaMenuFatura(msg: MensagemRecebida, conversa: any): Promise<void> {
    const { telefone } = msg;
    const corpo = (msg.corpo ?? '').trim().toLowerCase();

    if (['voltar', 'sair', 'menu'].includes(corpo)) {
      await this.resetarConversa(telefone);
      const texto = await this.msg('boas_vindas', {}, 'ðŸ‘‹ OlÃ¡! Sou o assistente da *CoopereBR*.\n\nPara comeÃ§ar, envie uma *foto* ou *PDF* da sua conta de energia elÃ©trica e eu faÃ§o uma simulaÃ§Ã£o de economia para vocÃª! ðŸ“¸');
      await this.sender.enviarMensagem(telefone, texto);
      return;
    }

    // Buscar cobranÃ§a do cooperado
    const telefoneNorm2 = telefone.replace(/\D/g, '');
    const telefoneSemPais2 = telefoneNorm2.replace(/^55/, '');
    const cooperado = await this.prisma.cooperado.findFirst({
      where: {
        OR: [
          { telefone: telefoneNorm2 },
          { telefone: telefoneSemPais2 },
          { telefone: '55' + telefoneSemPais2 },
        ],
        status: { in: ['ATIVO', 'AGUARDANDO_CONCESSIONARIA'] as any[] },
      },
      select: { id: true, nomeCompleto: true, cooperativaId: true },
    });
    const cobrancas = cooperado ? await this.prisma.cobranca.findMany({
      where: { contrato: { cooperadoId: cooperado.id }, status: { in: ['A_VENCER', 'VENCIDO', 'PENDENTE'] as any[] } },
      include: { asaasCobrancas: true },
      orderBy: { dataVencimento: 'asc' },
      take: 5,
    }) : [];
    if (!cooperado || cobrancas.length === 0) {
      await this.sender.enviarMensagem(telefone, 'NÃ£o encontrei faturas pendentes. Digite *voltar* para retornar.');
      await this.resetarConversa(telefone);
      return;
    }

    const cobranca = cobrancas[0];
    const asaas = cobranca.asaasCobrancas?.[0];

    if (corpo.includes('pix') || corpo === '1') {
      const pixCopiaECola = asaas?.pixCopiaECola;
      if (pixCopiaECola) {
        await this.sender.enviarMensagem(
          telefone,
          `ðŸ’³ *PIX Copia e Cola:*\n\n\`${pixCopiaECola}\`\n\n_Copie o cÃ³digo acima e cole no app do seu banco._`,
        );
      } else {
        const portalUrl = process.env.PORTAL_URL || 'https://app.cooperebr.com.br';
        await this.sender.enviarMensagem(
          telefone,
          `PIX nÃ£o disponÃ­vel no momento. Acesse o portal para pagar:\n${portalUrl}`,
        );
      }
    } else if (corpo.includes('boleto') || corpo.includes('codigo') || corpo.includes('cÃ³digo') || corpo.includes('barra') || corpo === '2') {
      const boletoUrl = asaas?.boletoUrl;
      if (boletoUrl) {
        await this.sender.enviarMensagem(
          telefone,
          `ðŸ“„ *Boleto bancÃ¡rio:*\n\nðŸ”— ${boletoUrl}\n\n_Acesse o link para visualizar e pagar._`,
        );
      } else {
        const portalUrl = process.env.PORTAL_URL || 'https://app.cooperebr.com.br';
        await this.sender.enviarMensagem(
          telefone,
          `CÃ³digo de barras nÃ£o disponÃ­vel. Acesse o portal:\n${portalUrl}`,
        );
      }
    } else if (corpo.includes('portal') || corpo.includes('ver fatura') || corpo === '3') {
      const portalUrl = process.env.PORTAL_URL || 'https://app.cooperebr.com.br';
      await this.sender.enviarMensagem(
        telefone,
        `ðŸ”— Acesse sua fatura no portal:\n${portalUrl}\n\n_FaÃ§a login com seu CPF e senha._`,
      );
    } else if (corpo.includes('extrato')) {
      const valorLiquido = Number(cobranca.valorLiquido).toFixed(2).replace('.', ',');
      const valorMulta = Number((cobranca as any).valorMulta ?? 0).toFixed(2).replace('.', ',');
      const valorJuros = Number((cobranca as any).valorJuros ?? 0).toFixed(2).replace('.', ',');
      const diasAtraso = Number((cobranca as any).diasAtraso ?? 0);
      const valorAtualizado = Number((cobranca as any).valorAtualizado ?? cobranca.valorLiquido).toFixed(2).replace('.', ',');

      let extrato = `ðŸ“Š *Extrato da Fatura*\n\n`;
      extrato += `ðŸ’° Valor original: R$ ${valorLiquido}\n`;
      if (diasAtraso > 0) {
        extrato += `ðŸ“… Dias em atraso: ${diasAtraso}\n`;
        extrato += `ðŸ’¸ Multa: R$ ${valorMulta}\n`;
        extrato += `ðŸ’¸ Juros: R$ ${valorJuros}\n`;
        extrato += `ðŸ’° *Valor atualizado: R$ ${valorAtualizado}*\n`;
      }
      await this.sender.enviarMensagem(telefone, extrato);
    } else if (corpo.includes('comprovante') || corpo.includes('paguei') || corpo.includes('jÃ¡ paguei')) {
      await this.prisma.conversaWhatsapp.update({
        where: { id: conversa.id },
        data: { estado: 'AGUARDANDO_COMPROVANTE_PAGAMENTO' },
      });
      await this.sender.enviarMensagem(
        telefone,
        'ðŸ“¸ Por favor, envie a *foto* ou *PDF* do comprovante de pagamento para confirmarmos.',
      );
      return;
    } else {
      // OpÃ§Ã£o nÃ£o reconhecida â€” reenviar menu
      await this.sender.enviarMenuComBotoes(telefone, {
        titulo: 'OpÃ§Ãµes de pagamento',
        corpo: 'NÃ£o entendi sua resposta. Escolha uma opÃ§Ã£o:',
        opcoes: [
          { id: 'pix', texto: 'Pagar com PIX' },
          { id: 'boleto', texto: 'CÃ³digo de barras' },
          { id: 'portal', texto: 'Ver fatura' },
        ],
      });
      return;
    }

    // ApÃ³s responder, reenviar menu para nova consulta
    await this.sender.enviarMenuComBotoes(telefone, {
      titulo: 'OpÃ§Ãµes de pagamento',
      corpo: 'Precisa de mais alguma coisa?',
      opcoes: [
        { id: 'pix', texto: 'Pagar com PIX' },
        { id: 'boleto', texto: 'CÃ³digo de barras' },
        { id: 'portal', texto: 'Ver fatura' },
      ],
    });
  }

  // â”€â”€â”€ COMPROVANTE DE PAGAMENTO â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  private async handleComprovantePagamento(msg: MensagemRecebida, conversa: any): Promise<void> {
    const { telefone, tipo } = msg;

    const isMidia = tipo === 'imagem' || tipo === 'documento';

    if (!isMidia) {
      await this.sender.enviarMensagem(
        telefone,
        'Por favor, envie a *foto* ou *PDF* do comprovante de pagamento. ðŸ“¸',
      );
      return;
    }

    // Notificar SUPER_ADMIN
    const superAdminPhone = process.env.SUPER_ADMIN_PHONE;
    if (superAdminPhone) {
      const telefoneNorm3 = telefone.replace(/\D/g, '');
      const telefoneSemPais3 = telefoneNorm3.replace(/^55/, '');
      const cooperadoComp = await this.prisma.cooperado.findFirst({
        where: {
          OR: [
            { telefone: telefoneNorm3 },
            { telefone: telefoneSemPais3 },
            { telefone: '55' + telefoneSemPais3 },
          ],
          status: { in: ['ATIVO', 'AGUARDANDO_CONCESSIONARIA'] as any[] },
        },
        select: { id: true, nomeCompleto: true, cooperativaId: true },
      });
      const nomeCooperado = cooperadoComp?.nomeCompleto ?? telefone;
      await this.sender.enviarMensagem(
        superAdminPhone,
        `ðŸ“‹ *Comprovante de pagamento recebido*\n\nðŸ‘¤ ${nomeCooperado}\nðŸ“± ${telefone}\n\n_Verifique o comprovante e dÃª baixa na fatura._`,
      ).catch((err) => this.logger.warn(`Falha ao notificar admin: ${err.message}`));
    }

    // Confirmar ao cooperado
    await this.sender.enviarMensagem(
      telefone,
      'âœ… Comprovante recebido! Nossa equipe vai conferir e confirmar o pagamento. Obrigado! ðŸ™',
    );

    // Voltar ao estado inicial
    await this.prisma.conversaWhatsapp.update({
      where: { id: conversa.id },
      data: { estado: 'INICIAL' },
    });
  }

  // â”€â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  private async resetarConversa(telefone: string): Promise<void> {
    await this.prisma.conversaWhatsapp.upsert({
      where: { telefone },
      update: { estado: 'INICIAL', dadosTemp: undefined },
      create: { telefone, estado: 'INICIAL' },
    });
  }

  // â”€â”€â”€ AtualizaÃ§Ã£o de Cadastro â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  private async handleAtualizacaoCadastro(msg: MensagemRecebida, conversa: any): Promise<void> {
    const { telefone } = msg;
    const corpo = this.respostaEfetiva(msg);
    const cooperadoId = conversa.cooperadoId;

    if (corpo === '1' || corpo.toLowerCase().includes('nome')) {
      await this.prisma.conversaWhatsapp.update({
        where: { id: conversa.id },
        data: { estado: 'AGUARDANDO_NOVO_NOME', contadorFallback: 0 },
      });
      await this.sender.enviarMensagem(telefone, 'ðŸ“ Digite seu *novo nome completo*:');
      return;
    }
    if (corpo === '2' || corpo.toLowerCase().includes('email')) {
      await this.prisma.conversaWhatsapp.update({
        where: { id: conversa.id },
        data: { estado: 'AGUARDANDO_NOVO_EMAIL', contadorFallback: 0 },
      });
      await this.sender.enviarMensagem(telefone, 'ðŸ“§ Digite seu *novo email*:');
      return;
    }
    if (corpo === '3' || corpo.toLowerCase().includes('telefone')) {
      await this.prisma.conversaWhatsapp.update({
        where: { id: conversa.id },
        data: { estado: 'AGUARDANDO_NOVO_TELEFONE', contadorFallback: 0 },
      });
      await this.sender.enviarMensagem(telefone, 'ðŸ“± Digite seu *novo nÃºmero de telefone* (com DDD):');
      return;
    }
    if (corpo === '4' || corpo.toLowerCase().includes('endereÃ§o') || corpo.toLowerCase().includes('cep')) {
      await this.prisma.conversaWhatsapp.update({
        where: { id: conversa.id },
        data: { estado: 'AGUARDANDO_NOVO_CEP', contadorFallback: 0 },
      });
      await this.sender.enviarMensagem(telefone, 'ðŸ“ Digite seu *novo CEP* (apenas nÃºmeros):');
      return;
    }

    await this.incrementarFallback(conversa, telefone, 'Responda *1* (nome), *2* (email), *3* (telefone) ou *4* (endereÃ§o).');
  }

  private async handleAguardandoNovoNome(msg: MensagemRecebida, conversa: any): Promise<void> {
    const { telefone } = msg;
    const novoNome = this.respostaEfetiva(msg).trim();
    if (novoNome.length < 3) {
      await this.sender.enviarMensagem(telefone, 'âš ï¸ Nome muito curto. Digite o nome completo:');
      return;
    }
    await this.prisma.cooperado.update({
      where: { id: conversa.cooperadoId },
      data: { nomeCompleto: novoNome },
    });
    await this.sender.enviarMensagem(telefone, `âœ… *Nome* atualizado com sucesso para *${novoNome}*!`);
    await this.prisma.conversaWhatsapp.update({ where: { id: conversa.id }, data: { estado: 'MENU_COOPERADO' } });
  }

  private async handleAguardandoNovoEmail(msg: MensagemRecebida, conversa: any): Promise<void> {
    const { telefone } = msg;
    const novoEmail = this.respostaEfetiva(msg).trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(novoEmail)) {
      await this.sender.enviarMensagem(telefone, 'âš ï¸ Email invÃ¡lido. Digite um email vÃ¡lido (ex: nome@email.com):');
      return;
    }
    await this.prisma.cooperado.update({
      where: { id: conversa.cooperadoId },
      data: { email: novoEmail },
    });
    await this.sender.enviarMensagem(telefone, `âœ… *Email* atualizado com sucesso para *${novoEmail}*!`);
    await this.prisma.conversaWhatsapp.update({ where: { id: conversa.id }, data: { estado: 'MENU_COOPERADO' } });
  }

  private async handleAguardandoNovoTelefone(msg: MensagemRecebida, conversa: any): Promise<void> {
    const { telefone } = msg;
    const novoTelefone = this.respostaEfetiva(msg).replace(/\D/g, '');
    if (novoTelefone.length < 10 || novoTelefone.length > 13) {
      await this.sender.enviarMensagem(telefone, 'âš ï¸ Telefone invÃ¡lido. Digite com DDD (ex: 11999998888):');
      return;
    }
    await this.prisma.cooperado.update({
      where: { id: conversa.cooperadoId },
      data: { telefone: novoTelefone },
    });
    await this.sender.enviarMensagem(telefone, `âœ… *Telefone* atualizado com sucesso para *${novoTelefone}*!`);
    await this.prisma.conversaWhatsapp.update({ where: { id: conversa.id }, data: { estado: 'MENU_COOPERADO' } });
  }

  private async handleAguardandoNovoCep(msg: MensagemRecebida, conversa: any): Promise<void> {
    const { telefone } = msg;
    const novoCep = this.respostaEfetiva(msg).replace(/\D/g, '');
    if (novoCep.length !== 8) {
      await this.sender.enviarMensagem(telefone, 'âš ï¸ CEP invÃ¡lido. Digite 8 dÃ­gitos (ex: 01310100):');
      return;
    }
    await this.prisma.cooperado.update({
      where: { id: conversa.cooperadoId },
      data: { cep: novoCep },
    });
    await this.sender.enviarMensagem(telefone, `âœ… *EndereÃ§o (CEP)* atualizado com sucesso para *${novoCep}*!`);
    await this.prisma.conversaWhatsapp.update({ where: { id: conversa.id }, data: { estado: 'MENU_COOPERADO' } });
  }

  // â”€â”€â”€ AtualizaÃ§Ã£o de Contrato â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  private async handleAtualizacaoContrato(msg: MensagemRecebida, conversa: any): Promise<void> {
    const { telefone } = msg;
    const corpo = this.respostaEfetiva(msg);
    const cooperadoId = conversa.cooperadoId;

    const contrato = await this.prisma.contrato.findFirst({
      where: { cooperadoId, status: 'ATIVO' as any },
      orderBy: { createdAt: 'desc' },
    });

    if (!contrato) {
      await this.sender.enviarMensagem(telefone, 'âš ï¸ Nenhum contrato ativo encontrado.');
      await this.prisma.conversaWhatsapp.update({ where: { id: conversa.id }, data: { estado: 'MENU_COOPERADO' } });
      return;
    }

    if (corpo === '1' || corpo.toLowerCase().includes('aumentar')) {
      await this.prisma.conversaWhatsapp.update({
        where: { id: conversa.id },
        data: { estado: 'AGUARDANDO_NOVO_KWH', dadosTemp: { contratoId: contrato.id, acao: 'aumentar' }, contadorFallback: 0 },
      });
      await this.sender.enviarMensagem(telefone,
        `ðŸ“Š Seu contrato atual: *${contrato.kwhContratoMensal ?? 0} kWh/mÃªs*\n\n` +
        `â¬†ï¸ Digite o *novo valor em kWh* que deseja contratar (maior que o atual):`,
      );
      return;
    }

    if (corpo === '2' || corpo.toLowerCase().includes('diminuir')) {
      await this.prisma.conversaWhatsapp.update({
        where: { id: conversa.id },
        data: { estado: 'AGUARDANDO_NOVO_KWH', dadosTemp: { contratoId: contrato.id, acao: 'diminuir' }, contadorFallback: 0 },
      });
      await this.sender.enviarMensagem(telefone,
        `ðŸ“Š Seu contrato atual: *${contrato.kwhContratoMensal ?? 0} kWh/mÃªs*\n\n` +
        `â¬‡ï¸ Digite o *novo valor em kWh* que deseja contratar (menor que o atual):`,
      );
      return;
    }

    if (corpo === '3' || corpo.toLowerCase().includes('suspender')) {
      await this.prisma.contrato.update({
        where: { id: contrato.id },
        data: { status: 'SUSPENSO' as any },
      });
      // Notificar equipe
      const superPhone = process.env.SUPER_ADMIN_PHONE;
      if (superPhone) {
        const cooperado = await this.prisma.cooperado.findUnique({ where: { id: cooperadoId }, select: { nomeCompleto: true } });
        await this.sender.enviarMensagem(superPhone,
          `â¸ï¸ *Contrato suspenso via WhatsApp*\nCooperado: ${cooperado?.nomeCompleto?.trim() || 'Cooperado'}\nTelefone: ${telefone}\nContrato: ${contrato.id}`,
          { tipoDisparo: 'BOT_RESPOSTA' },
        );
      }
      await this.sender.enviarMensagem(telefone, 'â¸ï¸ Seu contrato foi *suspenso temporariamente*.\n\nPara reativar, entre em contato com nossa equipe.');
      await this.prisma.conversaWhatsapp.update({ where: { id: conversa.id }, data: { estado: 'MENU_COOPERADO' } });
      return;
    }

    if (corpo === '4' || corpo.toLowerCase().includes('encerrar')) {
      await this.prisma.conversaWhatsapp.update({
        where: { id: conversa.id },
        data: { estado: 'CONFIRMAR_ENCERRAMENTO', dadosTemp: { contratoId: contrato.id }, contadorFallback: 0 },
      });
      await this.sender.enviarMensagem(telefone,
        'âŒ *Tem certeza que deseja encerrar seu contrato?*\n\n' +
        'Esta aÃ§Ã£o nÃ£o pode ser desfeita facilmente.\n\n' +
        '1ï¸âƒ£ Sim, encerrar\n2ï¸âƒ£ NÃ£o, voltar ao menu',
      );
      return;
    }

    await this.incrementarFallback(conversa, telefone, 'Responda *1* (aumentar kWh), *2* (diminuir kWh), *3* (suspender) ou *4* (encerrar).');
  }

  private async handleAguardandoNovoKwh(msg: MensagemRecebida, conversa: any): Promise<void> {
    const { telefone } = msg;
    const corpo = this.respostaEfetiva(msg);
    const valor = parseInt(corpo.replace(/\D/g, ''), 10);

    if (!valor || valor < 50) {
      await this.sender.enviarMensagem(telefone, 'âš ï¸ Valor invÃ¡lido. Digite um nÃºmero vÃ¡lido de kWh (mÃ­nimo 50):');
      return;
    }

    const dados = conversa.dadosTemp as any;
    const contratoId = dados?.contratoId;

    await this.prisma.contrato.update({
      where: { id: contratoId },
      data: { kwhContratoMensal: valor },
    });

    // Notificar equipe
    const superPhone = process.env.SUPER_ADMIN_PHONE;
    if (superPhone) {
      const cooperado = await this.prisma.cooperado.findUnique({ where: { id: conversa.cooperadoId }, select: { nomeCompleto: true } });
      await this.sender.enviarMensagem(superPhone,
        `ðŸ”„ *Ajuste de kWh via WhatsApp*\nCooperado: ${cooperado?.nomeCompleto?.trim() || 'Cooperado'}\nAÃ§Ã£o: ${dados?.acao}\nNovo valor: ${valor} kWh\nContrato: ${contratoId}`,
        { tipoDisparo: 'BOT_RESPOSTA' },
      );
    }

    await this.sender.enviarMensagem(telefone, `âœ… Contrato atualizado para *${valor} kWh/mÃªs*!\n\n_A alteraÃ§Ã£o serÃ¡ refletida na prÃ³xima fatura._`);
    await this.prisma.conversaWhatsapp.update({ where: { id: conversa.id }, data: { estado: 'MENU_COOPERADO', dadosTemp: undefined } });
  }

  private async handleConfirmarEncerramento(msg: MensagemRecebida, conversa: any): Promise<void> {
    const { telefone } = msg;
    const corpo = this.respostaEfetiva(msg);

    if (corpo === '1' || corpo.toLowerCase().includes('sim')) {
      const dados = conversa.dadosTemp as any;
      await this.prisma.contrato.update({
        where: { id: dados?.contratoId },
        data: { status: 'ENCERRADO' as any },
      });
      // Notificar equipe
      const superPhone = process.env.SUPER_ADMIN_PHONE;
      if (superPhone) {
        const cooperado = await this.prisma.cooperado.findUnique({ where: { id: conversa.cooperadoId }, select: { nomeCompleto: true } });
        await this.sender.enviarMensagem(superPhone,
          `âŒ *Contrato encerrado via WhatsApp*\nCooperado: ${cooperado?.nomeCompleto?.trim() || 'Cooperado'}\nTelefone: ${telefone}\nContrato: ${dados?.contratoId}`,
          { tipoDisparo: 'BOT_RESPOSTA' },
        );
      }
      await this.sender.enviarMensagem(telefone, 'âŒ Seu contrato foi *encerrado*.\n\nAgradecemos por ter sido cooperado! Caso mude de ideia, entre em contato conosco.');
      await this.prisma.conversaWhatsapp.update({ where: { id: conversa.id }, data: { estado: 'CONCLUIDO', dadosTemp: undefined } });
      return;
    }

    if (corpo === '2' || corpo.toLowerCase().includes('nÃ£o') || corpo.toLowerCase().includes('voltar')) {
      await this.sender.enviarMensagem(telefone, 'ðŸ‘ Ok, seu contrato continua ativo!');
      await this.prisma.conversaWhatsapp.update({ where: { id: conversa.id }, data: { estado: 'MENU_COOPERADO', dadosTemp: undefined } });
      return;
    }

    await this.incrementarFallback(conversa, telefone, 'Responda *1* para confirmar encerramento ou *2* para voltar.');
  }

  // â”€â”€â”€ NPS automÃ¡tico pÃ³s-cadastro â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  private agendarNps(telefone: string, conversaId: string): void {
    setTimeout(async () => {
      try {
        const conversa = await this.prisma.conversaWhatsapp.findUnique({ where: { id: conversaId } });
        if (!conversa || conversa.estado !== 'CONCLUIDO') return;

        await this.prisma.conversaWhatsapp.update({
          where: { id: conversaId },
          data: { estado: 'NPS_AGUARDANDO_NOTA' },
        });

        await this.sender.enviarMensagem(
          telefone,
          'ðŸ˜Š OlÃ¡! Sua solicitaÃ§Ã£o de adesÃ£o Ã  CoopereBR foi recebida!\n\n' +
          'De 0 a 10, quanto vocÃª indicaria a CoopereBR para um amigo?\n' +
          '(Digite apenas o nÃºmero)',
        );
      } catch (err) {
        this.logger.warn(`Erro ao enviar NPS para ${telefone}: ${err.message}`);
      }
    }, 60 * 60 * 1000); // 1 hora
  }

  private async handleNpsNota(msg: MensagemRecebida, conversa: any): Promise<void> {
    const { telefone } = msg;
    const corpo = (msg.corpo ?? '').trim();
    const nota = parseInt(corpo, 10);

    if (isNaN(nota) || nota < 0 || nota > 10) {
      await this.sender.enviarMensagem(telefone, 'Por favor, digite um nÃºmero de 0 a 10.');
      return;
    }

    await this.prisma.npsResposta.create({
      data: {
        cooperadoId: conversa.cooperadoId || undefined,
        telefone,
        nota,
        canal: 'WHATSAPP',
      },
    });

    await this.sender.enviarMensagem(telefone, 'Obrigado pelo feedback! ðŸ’š Isso nos ajuda a melhorar.');
    await this.finalizarConversa(conversa.id);
  }

  private async finalizarConversa(id: string): Promise<void> {
    await this.prisma.conversaWhatsapp.update({
      where: { id },
      data: { estado: 'CONCLUIDO' },
    });
  }
}
