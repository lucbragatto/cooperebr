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
  /** ID do botão clicado (buttonResponseMessage) ou rowId da lista selecionada */
  selectedButtonId?: string;
}

// Palavras impróprias (ofensas genéricas para detecção)
const PALAVRAS_IMPROPRIAS = [
  'porra', 'caralho', 'merda', 'foda', 'puta', 'fdp', 'cuzão', 'arrombado',
  'desgraça', 'buceta', 'viado', 'vagabund', 'safad', 'lixo', 'idiota', 'imbecil',
  'otário', 'bosta', 'cu ', 'vtnc', 'vsf', 'pqp', 'tnc',
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
    // Fallback: substituir variáveis manualmente no texto hardcoded
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
      texto: corpo || '[mídia]',
      direcao: 'RECEBIDA' as const,
    });

    // Buscar ou criar conversa (upsert atômico para evitar race condition)
    const conversa = await this.prisma.conversaWhatsapp.upsert({
      where: { telefone },
      update: {},
      create: { telefone, estado: 'INICIAL' },
    });

    // Fallback: palavras-chave especiais
    const corpoLower = corpo.toLowerCase();
    if (['cancelar', 'cancel'].includes(corpoLower)) {
      await this.resetarConversa(telefone);
      const texto = await this.msg('cancelar', {}, 'Tudo bem! Se quiser começar novamente, é só mandar a foto da sua conta de luz. 😊');
      await this.sender.enviarMensagem(telefone, texto);
      return;
    }

    if (['ajuda', 'duvida', 'dúvida', 'problema', 'erro', 'help', 'menu'].includes(corpoLower)) {
      if (corpoLower === 'menu' || corpoLower === 'ajuda' || corpoLower === 'help') {
        await this.handleMenuPrincipalInicio(msg, conversa);
        return;
      }
      const texto = await this.msg('ajuda', {}, 'Estou aqui para ajudar! Para falar com nossa equipe, acesse: cooperebr.com.br\n\nOu envie a foto da sua conta de luz para gerar uma simulação gratuita! 📸');
      await this.sender.enviarMensagem(telefone, texto);
      return;
    }

    // ─── Áudio → só aceita texto ──────────────────────────────────────────────
    if (msg.tipo === 'audio') {
      await this.sender.enviarMensagem(
        telefone,
        '🎤 Desculpe, no momento só consigo processar mensagens de *texto*.\n\nPor favor, digite sua mensagem. Se preferir, envie *menu* para ver as opções disponíveis.',
      );
      return;
    }

    // ─── Foto/documento fora de contexto (sticker, vídeo, location) ───────────
    if (['video', 'sticker', 'location'].includes(msg.tipo)) {
      await this.sender.enviarMensagem(
        telefone,
        '📎 Este tipo de mídia não é suportado.\n\nPara enviar documentos, acesse o *Portal do Cooperado*:\n👉 cooperebr.com.br/portal\n\nOu digite *menu* para ver as opções.',
      );
      return;
    }

    // ─── Linguagem inapropriada ───────────────────────────────────────────────
    if (corpo && PALAVRAS_IMPROPRIAS.some(p => corpoLower.includes(p))) {
      await this.sender.enviarMensagem(
        telefone,
        '🙏 Entendo sua frustração. Estamos aqui para ajudar da melhor forma possível.\n\nPor favor, nos diga como podemos resolver sua questão. Se preferir, posso encaminhá-lo para um atendente humano.\n\nDigite *3* para falar com um atendente.',
      );
      return;
    }

    // ─── Pedido de cancelamento/desligamento ──────────────────────────────────
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
        '⚠️ *Solicitação de desligamento*\n\n' +
        'Sentimos muito que queira nos deixar. Para solicitar o desligamento:\n\n' +
        '1️⃣ Acesse o portal: cooperebr.com.br/portal/desligamento\n' +
        '2️⃣ Preencha o formulário de desligamento\n' +
        '3️⃣ Nossa equipe processará em até 30 dias\n\n' +
        'Se quiser conversar sobre isso antes, digite *3* para falar com um atendente.',
      );
      return;
    }

    // ─── Perguntas sobre tarifa/preço ─────────────────────────────────────────
    if (
      corpoLower.includes('tarifa') ||
      corpoLower.includes('preço') ||
      corpoLower.includes('preco') ||
      corpoLower.includes('quanto custa') ||
      corpoLower.includes('valor da') ||
      corpoLower.includes('tabela de preço') ||
      corpoLower.includes('quanto pago') ||
      corpoLower.includes('qual o valor')
    ) {
      await this.sender.enviarMensagem(
        telefone,
        '💰 *Benefícios CoopereBR:*\n\n' +
        '🌱 Desconto de até *20%* na conta de energia\n' +
        '☀️ Energia 100% solar e sustentável\n' +
        '📊 Sem investimento inicial\n' +
        '📋 Sem obras ou instalação\n' +
        '🔄 Cancelamento sem multa\n\n' +
        '📸 Quer saber exatamente quanto vai economizar?\n' +
        'Envie a *foto da sua conta de luz* e faço uma simulação personalizada!\n\n' +
        'Ou digite *2* para iniciar seu cadastro.',
      );
      return;
    }

    // ─── Número de protocolo ──────────────────────────────────────────────────
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
          PENDENTE_ATIVACAO: '🟡 Pendente de ativação',
          EM_APROVACAO: '🟡 Em aprovação',
          ATIVO: '🟢 Ativo',
          SUSPENSO: '🔴 Suspenso',
          ENCERRADO: '⚪ Encerrado',
        };
        await this.sender.enviarMensagem(
          telefone,
          `📋 *Status do protocolo ${protocolo}:*\n\n` +
          `👤 ${contrato.cooperado?.nomeCompleto ?? 'N/A'}\n` +
          `📊 Status: ${statusLabel[contrato.status] ?? contrato.status}\n` +
          `📅 Início: ${new Date(contrato.dataInicio).toLocaleDateString('pt-BR')}\n\n` +
          `Para mais detalhes, acesse o portal ou digite *menu*.`,
        );
      } else {
        await this.sender.enviarMensagem(
          telefone,
          `🔍 Protocolo *${protocolo}* não encontrado.\n\nVerifique o número e tente novamente, ou digite *3* para falar com um atendente.`,
        );
      }
      return;
    }

    // ─── Verificar horário de atendimento (20h-8h) ───────────────────────────
    const agora = new Date();
    // Converter para horário de Brasília (UTC-3)
    const horaBrasilia = new Date(agora.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
    const hora = horaBrasilia.getHours();
    if (hora >= 20 || hora < 8) {
      // Fora do expediente — ainda processa a mensagem mas avisa sobre atraso
      await this.sender.enviarMensagem(
        telefone,
        '🌙 *Atendimento fora do horário comercial*\n\n' +
        'Nosso horário de atendimento humano é de *segunda a sexta, das 8h às 20h*.\n\n' +
        'Sua mensagem foi registrada e será respondida no próximo dia útil.\n\n' +
        'Enquanto isso, você pode:\n' +
        '📸 Enviar foto da fatura para simulação automática\n' +
        '🌐 Acessar o portal: cooperebr.com.br/portal\n\n' +
        'Ou digite *menu* para ver as opções do bot.',
      );
      // Não faz return — continua processando normalmente (simulação funciona 24h)
    }

    // ─── Verificar timeout de sessão (30min sem atividade) ────────────────────
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
          '⏰ Sua sessão anterior expirou por inatividade.\n\n' +
          'Vamos recomeçar? Digite *menu* para ver as opções ou envie a *foto da sua fatura* para simular.',
        );
        return;
      }
    }

    // ─── Foto/documento em estados de menu → instruir portal ────────────────
    if (
      (msg.tipo === 'imagem' || msg.tipo === 'documento') &&
      msg.mediaBase64 &&
      ['MENU_PRINCIPAL', 'MENU_COOPERADO', 'MENU_CLIENTE', 'MENU_CONVITE', 'AGUARDANDO_ATENDENTE'].includes(conversa.estado)
    ) {
      // Se está em menu, redireciona para fluxo de fatura
      await this.prisma.conversaWhatsapp.update({
        where: { id: conversa.id },
        data: { estado: 'INICIAL' },
      });
      const conversaAtualizada = await this.prisma.conversaWhatsapp.findUnique({ where: { telefone } });
      await this.handleInicial(msg, conversaAtualizada);
      return;
    }

    // ─── Palavras-chave de fatura/boleto → MENU_FATURA ─────────────────────
    if (['fatura', 'faturas', 'boleto', '2a via', '2ª via', 'segunda via', 'pix', 'pagar'].includes(corpoLower)) {
      await this.prisma.conversaWhatsapp.upsert({
        where: { telefone },
        update: { estado: 'MENU_FATURA' },
        create: { telefone, estado: 'MENU_FATURA' },
      });
      const conversaAtualizada = await this.prisma.conversaWhatsapp.findUnique({ where: { telefone } });
      await this.handleMenuFatura({ ...msg, corpo: '' }, conversaAtualizada!);
      return;
    }

    // TODO: reativar quando motor dinâmico for corrigido para processar apenas etapa atual
    // Motor dinâmico desativado — enviava todas as mensagens de uma vez sem esperar resposta
    // try {
    //   const processou = await this.fluxoMotor.processarComFluxoDinamico(msg, conversa);
    //   if (processou) return;
    // } catch (err) {
    //   this.logger.warn(`Erro no motor dinâmico, fallback hardcoded: ${err.message}`);
    // }

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
        // ─── Fluxo convite por indicação ──────────────
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
        // ─── Menu conversacional completo ─────────────
        case 'MENU_PRINCIPAL':
          await this.handleMenuPrincipal(msg, conversa);
          break;
        case 'MENU_COOPERADO':
          await this.handleMenuCooperado(msg, conversa);
          break;
        case 'MENU_CLIENTE':
          await this.handleMenuCliente(msg, conversa);
          break;
        case 'AGUARDANDO_ATENDENTE':
          await this.handleAguardandoAtendente(msg, conversa);
          break;
        // ─── Rotina 1: QR Code / Propaganda ──────────────
        case 'MENU_QR_PROPAGANDA':
          await this.handleMenuQrPropaganda(msg, conversa);
          break;
        case 'AGUARDANDO_VALOR_FATURA':
          await this.handleAguardandoValorFatura(msg, conversa);
          break;
        case 'RESULTADO_SIMULACAO_RAPIDA':
          await this.handleResultadoSimulacaoRapida(msg, conversa);
          break;
        // ─── Rotina 2: Inadimplente ─────────────────────
        case 'MENU_INADIMPLENTE':
          await this.handleMenuInadimplente(msg, conversa);
          break;
        case 'NEGOCIACAO_PARCELAMENTO':
          await this.handleNegociacaoParcelamento(msg, conversa);
          break;
        // ─── Rotina 3: Convite indicação melhorado ──────
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
        default:
          await this.handleMenuPrincipalInicio(msg, conversa);
      }
    } catch (err) {
      this.logger.error(`Erro ao processar mensagem de ${telefone}: ${err.message}`, err.stack);
      await this.sender.enviarMensagem(
        telefone,
        'Desculpe, ocorreu um erro ao processar sua mensagem. Tente novamente em alguns instantes ou envie outra foto da fatura. 😊',
      );
    }
  }

  /** Extrai o ID efetivo: prioriza selectedButtonId (botão/lista), senão usa texto */
  private respostaEfetiva(msg: MensagemRecebida): string {
    return msg.selectedButtonId?.trim() || (msg.corpo ?? '').trim();
  }

  // ─── MENU PRINCIPAL ──────────────────────────────────────────────────────

  private async handleMenuPrincipalInicio(msg: MensagemRecebida, conversa: any): Promise<void> {
    const { telefone } = msg;
    await this.prisma.conversaWhatsapp.update({
      where: { id: conversa.id },
      data: { estado: 'MENU_PRINCIPAL', contadorFallback: 0 },
    });
    await this.sender.enviarMenuComBotoes(telefone, {
      titulo: 'Menu Principal',
      corpo: '👋 Olá! Sou o assistente da *CoopereBR* — energia solar para todos.\n\nComo posso ajudar?',
      opcoes: [
        { id: '1', texto: '📋 Já sou cooperado' },
        { id: '2', texto: '⚡ Quero ser cooperado' },
        { id: '3', texto: '👤 Falar com atendente' },
      ],
    });
  }

  private async handleMenuPrincipal(msg: MensagemRecebida, conversa: any): Promise<void> {
    const { telefone } = msg;
    const resposta = this.respostaEfetiva(msg);
    const corpo = resposta;

    if (corpo === '1' || corpo.toLowerCase().includes('sou cooperado') || corpo.toLowerCase().includes('já sou')) {
      // Verificar se é cooperado
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
        await this.sender.enviarMensagem(telefone, '⚠️ Não encontrei seu cadastro ativo.\n\nSe você se cadastrou recentemente, aguarde nosso contato. Ou:\n\n1️⃣ Iniciar novo cadastro\n2️⃣ Falar com atendente');
        await this.prisma.conversaWhatsapp.update({ where: { id: conversa.id }, data: { estado: 'MENU_CLIENTE', contadorFallback: 0 } });
        return;
      }

      await this.prisma.conversaWhatsapp.update({
        where: { id: conversa.id },
        data: { estado: 'MENU_COOPERADO', cooperadoId: cooperado.id, contadorFallback: 0 },
      });
      await this.sender.enviarMenuComBotoes(telefone, {
        titulo: 'Menu do Cooperado',
        corpo: `✅ Olá, *${cooperado.nomeCompleto}*! O que você precisa?`,
        opcoes: [
          { id: '1', texto: '⚡ Ver saldo de créditos', descricao: 'Seus kWh contratados' },
          { id: '2', texto: '📄 Ver próxima fatura', descricao: 'Valor e vencimento' },
          { id: '3', texto: '📊 Simular economia', descricao: 'Nova simulação' },
          { id: '4', texto: '🔧 Suporte / Ocorrência', descricao: 'Abrir chamado' },
          { id: '5', texto: '👤 Falar com atendente', descricao: 'Atendimento humano' },
        ],
      });
      return;
    }

    if (corpo === '2' || corpo.toLowerCase().includes('quero ser') || corpo.toLowerCase().includes('quero aderir')) {
      await this.prisma.conversaWhatsapp.update({
        where: { id: conversa.id },
        data: { estado: 'AGUARDANDO_FOTO_FATURA', contadorFallback: 0 },
      });
      await this.sender.enviarMensagem(
        telefone,
        '📸 Ótimo! Para gerar sua simulação gratuita, envie uma *foto* ou *PDF* da sua conta de energia elétrica.',
      );
      return;
    }

    if (corpo === '3' || corpo.toLowerCase().includes('atendente') || corpo.toLowerCase().includes('humano')) {
      await this.encaminharAtendente(telefone, conversa.id, 'Solicitou atendente no menu principal');
      return;
    }

    // Fallback com contador
    await this.incrementarFallback(conversa, telefone,
      'Responda *1* (cooperado), *2* (quero ser cooperado) ou *3* (atendente).',
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

    if (corpo === '1' || corpo.toLowerCase().includes('saldo') || corpo.toLowerCase().includes('crédito')) {
      const contratos = await this.prisma.contrato.findMany({
        where: { cooperadoId, status: 'ATIVO' as any },
        include: { uc: { select: { numero: true } } },
        orderBy: { createdAt: 'desc' },
        take: 3,
      });
      if (contratos.length === 0) {
        await this.sender.enviarMensagem(telefone, '⚠️ Nenhum contrato ativo encontrado. Fale com nossa equipe.');
        return;
      }
      let texto = '⚡ *Seus créditos:*\n\n';
      for (const c of contratos) {
        texto += `UC ${c.uc?.numero ?? 'N/A'}: ${c.kwhContratoMensal ?? 0} kWh/mês\n`;
      }
      texto += '\n_Acesse o portal para mais detalhes._';
      await this.sender.enviarMensagem(telefone, texto);
      return;
    }

    if (corpo === '2' || corpo.toLowerCase().includes('fatura') || corpo.toLowerCase().includes('cobrança')) {
      const cobranca = await this.prisma.cobranca.findFirst({
        where: { contrato: { cooperadoId }, status: { in: ['PENDENTE', 'VENCIDO'] as any[] } },
        orderBy: { dataVencimento: 'asc' },
      });
      if (!cobranca) {
        await this.sender.enviarMensagem(telefone, '✅ Você não tem faturas pendentes no momento!');
        return;
      }
      const fmt = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
      await this.sender.enviarMensagem(
        telefone,
        `📄 *Próxima fatura:*\n\n` +
        `💰 Valor: R$ ${fmt(Number(cobranca.valorLiquido ?? cobranca.valorBruto))}\n` +
        `📅 Vencimento: ${new Date(cobranca.dataVencimento).toLocaleDateString('pt-BR')}\n` +
        `Status: ${cobranca.status}\n\n` +
        `Para pagar, acesse seu portal ou aguarde o link de pagamento.`,
      );
      return;
    }

    if (corpo === '3' || corpo.toLowerCase().includes('simul')) {
      await this.prisma.conversaWhatsapp.update({
        where: { id: conversa.id },
        data: { estado: 'AGUARDANDO_FOTO_FATURA', contadorFallback: 0 },
      });
      await this.sender.enviarMensagem(telefone, '📸 Envie a foto ou PDF da sua fatura de energia para simularmos.');
      return;
    }

    if (corpo === '4' || corpo.toLowerCase().includes('suporte') || corpo.toLowerCase().includes('ocorrência')) {
      await this.prisma.conversaWhatsapp.update({
        where: { id: conversa.id },
        data: { estado: 'AGUARDANDO_ATENDENTE', contadorFallback: 0 },
      });
      await this.sender.enviarMensagem(
        telefone,
        '🔧 *Suporte técnico:*\n\nDescreva o problema e nossa equipe responderá em breve.\n\nOu escolha:\n1️⃣ Problema na fatura\n2️⃣ Créditos não creditados\n3️⃣ Outro',
      );
      return;
    }

    if (corpo === '5' || corpo.toLowerCase().includes('atendente')) {
      await this.encaminharAtendente(telefone, conversa.id, 'Cooperado solicitou atendente no menu cooperado');
      return;
    }

    await this.incrementarFallback(conversa, telefone,
      'Responda *1* (créditos), *2* (fatura), *3* (simular), *4* (suporte) ou *5* (atendente).',
    );
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
      await this.sender.enviarMensagem(telefone, '📸 Envie uma foto ou PDF da sua conta de energia para iniciarmos sua simulação!');
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
      `📬 Sua mensagem foi recebida! Nossa equipe entrará em contato em breve.${complementoSuporte}`,
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
          `🔔 Solicitação de suporte via WhatsApp:\nTelefone: ${telefone}\nMensagem: ${corpo}`,
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
      '👤 *Encaminhando para atendente humano...*\n\nUm de nossos especialistas responderá em breve. Horário de atendimento: Seg–Sex 8h–18h.\n\nDescreva sua dúvida ou aguarde.',
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
      // Após 3 mensagens não compreendidas → encaminhar para atendente
      await this.prisma.conversaWhatsapp.update({
        where: { id: conversa.id },
        data: { estado: 'AGUARDANDO_ATENDENTE', contadorFallback: 0 },
      });
      await this.sender.enviarMensagem(
        telefone,
        '🤔 Parece que estou com dificuldade em entender. Vou te conectar com um atendente humano!\n\n👤 Aguarde, um especialista responderá em breve.',
      );
    } else {
      await this.sender.enviarMensagem(telefone, `Não entendi 😅 ${dica}`);
    }
  }

  // ─── PASSO 1: Recebe fatura (imagem/PDF) ─────────────────────────────────

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

    const textoProcessando = await this.msg('processando_fatura', {}, '📄 Recebi sua fatura! Analisando os dados... Aguarde um momento. ⏳');
    await this.sender.enviarMensagem(telefone, textoProcessando);

    // OCR
    const tipoArquivo = mimeType === 'application/pdf' ? 'pdf' : 'imagem';
    let dadosExtraidos: Record<string, unknown>;
    try {
      dadosExtraidos = await this.faturasService.extrairOcr(mediaBase64!, tipoArquivo) as unknown as Record<string, unknown>;
    } catch {
      await this.sender.enviarMensagem(
        telefone,
        'Não consegui identificar os dados da sua fatura. Por favor, envie uma foto mais nítida ou o PDF da fatura de energia. 📸',
      );
      return;
    }

    // Validar dados mínimos
    const titular = String(dadosExtraidos.titular ?? '');
    const consumoAtualKwh = Number(dadosExtraidos.consumoAtualKwh ?? 0);
    const distribuidora = String(dadosExtraidos.distribuidora ?? '');

    if (!titular && consumoAtualKwh <= 0 && !distribuidora) {
      await this.sender.enviarMensagem(
        telefone,
        'O arquivo enviado não parece ser uma fatura de energia. Por favor, envie a fatura da concessionária (PDF ou foto legível). 📄',
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

    // Montar mensagem de confirmação
    const historico = (dadosExtraidos.historicoConsumo as Array<{ mesAno: string; consumoKwh: number; valorRS: number }>) ?? [];
    const endereco = String(dadosExtraidos.enderecoInstalacao ?? '');
    const numeroUC = String(dadosExtraidos.numeroUC ?? '—');
    const tipoFornecimento = String(dadosExtraidos.tipoFornecimento ?? '');
    const tensao = String(dadosExtraidos.tensaoNominal ?? '');

    let msg_confirmacao = `📊 *Dados extraídos da sua fatura:*\n\n`;
    msg_confirmacao += `👤 ${titular}\n`;
    if (endereco) msg_confirmacao += `📍 ${endereco}\n`;
    msg_confirmacao += `🔌 UC: ${numeroUC}\n`;
    if (tipoFornecimento) msg_confirmacao += `⚡ ${tipoFornecimento}${tensao ? ` (${tensao})` : ''}\n`;

    if (historico.length > 0) {
      msg_confirmacao += `\n📅 *Histórico de consumo:*\n`;
      for (const h of historico) {
        const valor = Number(h.valorRS);
        const valorStr = valor > 0 ? ` — R$ ${valor.toFixed(2).replace('.', ',')}` : '';
        msg_confirmacao += `${h.mesAno}: ${h.consumoKwh} kWh${valorStr}\n`;
      }
    }

    msg_confirmacao += `\n_Algum dado incorreto? Corrija no formato:_\n`;
    msg_confirmacao += `_02/26 350 kwh R$ 287,50_\n\n`;
    msg_confirmacao += `_Tudo certo? Responda *OK*_`;

    await this.sender.enviarMensagem(telefone, msg_confirmacao);
  }

  // ─── PASSO 2: Confirmação dos dados ──────────────────────────────────────

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
      // Calcular simulação
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
          'Houve um erro ao calcular sua simulação. Tente novamente ou entre em contato conosco. 😊',
        );
        return;
      }

      if (!resultado) {
        await this.sender.enviarMensagem(
          telefone,
          'Não foi possível gerar uma simulação com os dados extraídos. Tente enviar outra fatura. 📄',
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

      let resposta = `🌱 *Sua simulação CoopereBR:*\n\n`;
      resposta += `📊 Fatura média atual: R$ ${fmt(valorFaturaMedia)}\n`;
      resposta += `💚 Com a CoopereBR: R$ ${fmt(valorComDesconto)} (-${descontoPercentual.toFixed(0)}%)\n`;
      resposta += `💵 Economia mensal: R$ ${fmt(economiaMensal)}\n`;
      resposta += `📅 Economia anual: R$ ${fmt(economiaAnual)}\n`;
      if (mesesEconomia > 0) {
        resposta += `🎁 Equivale a ${mesesEconomia.toFixed(1).replace('.', ',')} meses de energia grátis!\n`;
      }
      resposta += `\nQuer receber a proposta completa em PDF?\nResponda *SIM*`;

      await this.sender.enviarMensagem(telefone, resposta);
      return;
    }

    // Tentar corrigir dado do histórico via regex
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
        `✅ Mês ${mesAno} atualizado: ${kwh} kWh — R$ ${valor.toFixed(2).replace('.', ',')}\n\nOutro dado a corrigir? Ou responda *OK* para gerar a simulação.`,
      );
      return;
    }

    // Não entendeu
    await this.sender.enviarMensagem(
      telefone,
      `Não entendi 😅\n\nResponda *OK* se estiver tudo certo, ou corrija no formato:\n_02/26 350 kwh R$ 287,50_`,
    );
  }

  // ─── PASSO 3: Confirmação da proposta → envia PDF ────────────────────────

  private async handleConfirmacaoProposta(msg: MensagemRecebida, conversa: any): Promise<void> {
    const { telefone } = msg;
    const corpo = (msg.corpo ?? '').trim().toUpperCase();
    const dadosTempCheck = (conversa.dadosTemp ?? {}) as Record<string, unknown>;

    // Fluxo convite: se veio de indicação, "1" ou "SIM" leva para coleta de dados
    if (dadosTempCheck.codigoIndicacao && (corpo === '1' || corpo === 'SIM')) {
      await this.prisma.conversaWhatsapp.update({
        where: { id: conversa.id },
        data: { estado: 'AGUARDANDO_NOME' },
      });
      await this.sender.enviarMensagem(telefone, 'Otimo! Vamos fazer seu cadastro. Qual e seu nome completo?');
      return;
    }

    // Fluxo convite: "2" ou "NAO" → encerrar
    if (dadosTempCheck.codigoIndicacao && (corpo === '2' || corpo.includes('NAO') || corpo.includes('NÃO'))) {
      await this.finalizarConversa(conversa.id);
      await this.sender.enviarMensagem(telefone, 'Tudo bem! Se mudar de ideia, estamos aqui. 😊');
      return;
    }

    if (corpo !== 'SIM' && corpo !== '1') {
      await this.sender.enviarMensagem(
        telefone,
        dadosTempCheck.codigoIndicacao
          ? 'Responda 1️⃣ para continuar ou 2️⃣ para nao.'
          : 'Responda *SIM* para receber a proposta em PDF, ou *cancelar* para recomeçar.',
      );
      return;
    }

    const dadosTemp = conversa.dadosTemp as Record<string, unknown>;

    // Gerar PDF da proposta via motor-proposta (aceitar cria proposta + PDF)
    const titular = String(dadosTemp.titular ?? '');
    const endereco = String(dadosTemp.enderecoInstalacao ?? '');
    const numeroUC = String(dadosTemp.numeroUC ?? '—');

    await this.sender.enviarMensagem(telefone, '📄 Gerando sua proposta em PDF... Aguarde um momento. ⏳');

    // Tentar gerar e enviar PDF via motor-proposta
    try {
      const historico = (dadosTemp.historicoConsumo as Array<{ mesAno: string; consumoKwh: number; valorRS: number }>) ?? [];
      const resultado = dadosTemp.resultado as any;

      // Buscar ou criar cooperado lead
      const telefoneNorm = telefone.replace(/\D/g, '');
      // Buscar por telefone completo normalizado (sem prefixo país variável)
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
        // Enviar mensagem com dados da simulação como "PDF resumo"
        const fmt = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        const r = propostaResult.resultado;

        let pdfTexto = `📋 *PROPOSTA COOPEREBR*\n`;
        pdfTexto += `━━━━━━━━━━━━━━━━━━━━\n\n`;
        pdfTexto += `👤 *${titular}*\n`;
        if (endereco) pdfTexto += `📍 ${endereco}\n`;
        pdfTexto += `🔌 UC: ${numeroUC}\n\n`;
        pdfTexto += `📊 *Dados da simulação:*\n`;
        pdfTexto += `• Consumo considerado: ${Math.round(r.kwhContrato)} kWh/mês\n`;
        pdfTexto += `• Desconto: ${r.descontoPercentual.toFixed(1)}%\n`;
        pdfTexto += `• Economia mensal: R$ ${fmt(r.economiaMensal)}\n`;
        pdfTexto += `• Economia anual: R$ ${fmt(r.economiaAnual)}\n\n`;
        pdfTexto += `━━━━━━━━━━━━━━━━━━━━\n`;
        pdfTexto += `_Proposta válida por 30 dias_`;

        await this.sender.enviarMensagem(telefone, pdfTexto);
      }
    } catch (err) {
      this.logger.error(`Erro ao gerar proposta: ${err.message}`);
      await this.sender.enviarMensagem(
        telefone,
        'Houve um erro ao gerar a proposta. Nossa equipe entrará em contato. 😊',
      );
    }

    // Confirmação de dados para cadastro
    let dadosCadastro = `✅ *Seus dados para cadastro:*\n\n`;
    dadosCadastro += `👤 ${titular}\n`;
    if (endereco) dadosCadastro += `📍 ${endereco}\n`;
    dadosCadastro += `🔌 UC: ${numeroUC}\n\n`;
    dadosCadastro += `Está correto? Responda *CONFIRMO* para prosseguir\n`;
    dadosCadastro += `ou me diga o que precisa corrigir.`;

    await this.prisma.conversaWhatsapp.update({
      where: { id: conversa.id },
      data: { estado: 'AGUARDANDO_CONFIRMACAO_CADASTRO' },
    });

    await this.sender.enviarMensagem(telefone, dadosCadastro);
  }

  // ─── PASSO 4: Confirmação do cadastro → cria cooperado ───────────────────

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

    // Verificar se já existe cooperado (busca por telefone completo normalizado)
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
        'Você já está em nosso sistema! Nossa equipe entrará em contato em breve. 😊',
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
    if (numeroUC && numeroUC !== '—') {
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
          this.logger.warn(`Não foi possível criar UC: ${err.message}`);
        }
      }
    }

    // Verificar indicação (código salvo no dadosTemp pelo fluxo MLM)
    const codigoRef = dadosTemp.codigoIndicacao as string | undefined;
    if (codigoRef && cooperado) {
      try {
        await this.indicacoes.registrarIndicacao(cooperado.id, codigoRef);
        this.logger.log(`Indicação registrada para ${cooperado.id} via código ${codigoRef}`);

        // Notificar o indicador
        const indicador = await this.prisma.cooperado.findUnique({
          where: { codigoIndicacao: codigoRef },
          select: { telefone: true, nomeCompleto: true, cooperativaId: true },
        });
        if (indicador?.telefone) {
          const nomeIndicado = cooperado.nomeCompleto || titular || 'Novo membro';
          await this.sender.enviarMensagem(
            indicador.telefone,
            `🎉 Boa notícia! ${nomeIndicado} acabou de completar o cadastro através do seu convite! Quando ele pagar a primeira fatura, você receberá seu benefício automaticamente. Obrigado por indicar! 🙏`,
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
                `📋 Novo cadastro via indicação: ${nomeIndicado} | Tel: ${telefoneNorm} | Indicado por: ${indicador.nomeCompleto}. Acompanhe o processo no painel.`,
              ).catch(() => {});
            }
          }
        }
      } catch (err) {
        this.logger.warn(`Não foi possível registrar indicação: ${err.message}`);
      }
    }

    await this.finalizarConversa(conversa.id);

    const textoSucesso = await this.msg('cadastro_sucesso', {}, '🎉 Perfeito! Seu pré-cadastro foi criado com sucesso!\n\nNossa equipe entrará em contato em breve para finalizar. Qualquer dúvida é só perguntar! 💚');
    await this.sender.enviarMensagem(telefone, textoSucesso);
  }

  // ─── Estado CONCLUIDO ────────────────────────────────────────────────────

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
      'Seu cadastro já foi recebido! 😊 Nossa equipe entrará em contato em breve.\n\nSe quiser fazer uma nova simulação, envie outra conta de luz. 📸',
    );
  }

  // ─── Fluxo Convite (indicação) ──────────────────────────────────────────

  /**
   * Inicia o fluxo de convite quando um lead chega via referência de indicação.
   * Chamado externamente (ex: MLM service) para iniciar a conversa.
   */
  async iniciarFluxoConvite(telefone: string, indicadorNome: string, codigoIndicacao: string): Promise<void> {
    // Redireciona para o fluxo de convite melhorado com botões interativos
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
      await this.sender.enviarMensagem(telefone, 'Otimo! Envie uma foto da sua conta de luz (frente completa) 📸');
      return;
    }

    if (corpo === '2' || corpo.toLowerCase().includes('nao') || corpo.toLowerCase().includes('não')) {
      await this.finalizarConversa(conversa.id);
      await this.sender.enviarMensagem(telefone, 'Tudo bem! Se mudar de ideia, estamos aqui. 😊');
      return;
    }

    await this.sender.enviarMensagem(telefone, 'Responda 1️⃣ para saber mais ou 2️⃣ se nao tem interesse.');
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
      await this.sender.enviarMensagem(telefone, 'Por favor, envie uma *foto* ou *PDF* da sua conta de energia eletrica. 📸');
      return;
    }

    await this.sender.enviarMensagem(telefone, '📄 Recebi! Analisando os dados... Aguarde um momento. ⏳');

    // OCR
    const tipoArquivo = mimeType === 'application/pdf' ? 'pdf' : 'imagem';
    let dadosExtraidos: Record<string, unknown>;
    try {
      dadosExtraidos = await this.faturasService.extrairOcr(mediaBase64!, tipoArquivo) as unknown as Record<string, unknown>;
    } catch {
      await this.sender.enviarMensagem(telefone, 'Nao consegui identificar os dados. Envie uma foto mais nitida ou o PDF da fatura. 📸');
      return;
    }

    const consumoAtualKwh = Number(dadosExtraidos.consumoAtualKwh ?? 0);
    if (consumoAtualKwh <= 0) {
      await this.sender.enviarMensagem(telefone, 'O arquivo nao parece ser uma fatura de energia. Tente novamente. 📄');
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

      let resposta = `🌱 *Simulacao de economia:*\n\n`;
      resposta += `📊 Fatura media: R$ ${fmt(valorMedio)}\n`;
      resposta += `💚 Com a CoopereBR: R$ ${fmt(valorComDesconto)} (-${descontoPercentual.toFixed(0)}%)\n`;
      resposta += `💵 Economia mensal: R$ ${fmt(economiaMensal)}\n\n`;
      resposta += `Quer continuar?\n1️⃣ Sim\n2️⃣ Nao`;

      await this.sender.enviarMensagem(telefone, resposta);
    } else {
      await this.sender.enviarMensagem(telefone, 'Recebi sua fatura! Quer prosseguir com o cadastro?\n1️⃣ Sim\n2️⃣ Nao');
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
          `📋 Seu indicado enviou a fatura e esta analisando a proposta. Acompanhe!`,
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

    let confirmacao = `✅ *Confirme seus dados:*\n\n`;
    confirmacao += `👤 ${nome}\n`;
    confirmacao += `📄 CPF: ${cpf}\n`;
    confirmacao += `📧 ${corpo}\n\n`;
    confirmacao += `Tudo certo? Responda *CONFIRMO*`;

    await this.sender.enviarMensagem(telefone, confirmacao);
  }

  // ═══════════════════════════════════════════════════════════════════════
  // ROTINA 1: Cadastro via QR Code / Propaganda
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Inicia fluxo QR Code/Propaganda para contato espontâneo sem indicação.
   * Chamado quando não há codigoRef na conversa e é primeira interação de texto.
   */
  async iniciarFluxoQrPropaganda(telefone: string): Promise<void> {
    await this.prisma.conversaWhatsapp.upsert({
      where: { telefone },
      update: { estado: 'MENU_QR_PROPAGANDA', contadorFallback: 0 },
      create: { telefone, estado: 'MENU_QR_PROPAGANDA' },
    });

    await this.sender.enviarMenuComBotoes(telefone, {
      titulo: 'Bem-vindo à CoopereBR',
      corpo: '👋 Olá! Bem-vindo à *CoopereBR* — energia solar compartilhada!\n\nEconomize até 20% na conta de luz sem investimento e sem obras.',
      opcoes: [
        { id: '1', texto: '🌱 Conhecer a CoopereBR', descricao: 'Saiba como funciona' },
        { id: '2', texto: '💰 Simular minha economia', descricao: 'Calcule quanto vai economizar' },
        { id: '3', texto: '👤 Falar com consultor', descricao: 'Atendimento personalizado' },
      ],
    });
  }

  private async handleMenuQrPropaganda(msg: MensagemRecebida, conversa: any): Promise<void> {
    const { telefone } = msg;
    const corpo = this.respostaEfetiva(msg);

    if (corpo === '1' || corpo.toLowerCase().includes('conhecer')) {
      await this.sender.enviarMensagem(
        telefone,
        '🌱 *Como funciona a CoopereBR:*\n\n' +
        '☀️ Somos uma cooperativa de energia solar compartilhada\n' +
        '💡 Você recebe créditos de energia solar na sua conta de luz\n' +
        '💰 Economia de até *20%* todo mês — sem investimento\n' +
        '📋 Sem obras, sem instalação, sem burocracia\n' +
        '🔄 Cancelamento sem multa a qualquer momento\n' +
        '🌍 Energia 100% limpa e sustentável\n\n' +
        'Quer saber exatamente quanto você vai economizar?',
      );

      await this.sender.enviarMenuComBotoes(telefone, {
        titulo: 'Próximo passo',
        corpo: 'O que deseja fazer?',
        opcoes: [
          { id: '2', texto: '💰 Simular minha economia' },
          { id: '4', texto: '📸 Enviar minha fatura', descricao: 'Simulação detalhada com OCR' },
          { id: '3', texto: '👤 Falar com consultor' },
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
        '💰 Vamos simular sua economia!\n\nQual o *valor médio* da sua conta de luz? (ex: 350)',
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
      await this.sender.enviarMensagem(telefone, '📸 Envie uma *foto* ou *PDF* da sua conta de energia para uma simulação detalhada!');
      return;
    }

    await this.incrementarFallback(conversa, telefone,
      'Responda *1* (conhecer), *2* (simular economia) ou *3* (falar com consultor).',
    );
  }

  private async handleAguardandoValorFatura(msg: MensagemRecebida, conversa: any): Promise<void> {
    const { telefone } = msg;
    const corpo = (msg.corpo ?? '').trim();

    // Extrair valor numérico
    const valorStr = corpo.replace(/[^\d.,]/g, '').replace(',', '.');
    const valor = parseFloat(valorStr);

    if (isNaN(valor) || valor <= 0 || valor > 50000) {
      await this.sender.enviarMensagem(
        telefone,
        'Por favor, informe o valor da sua conta de luz em reais (apenas o número).\nExemplo: *350* ou *280,50*',
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
      `🌱 *Resultado da sua simulação:*\n\n` +
      `📊 Conta atual: R$ ${fmt(valor)}\n` +
      `💚 Com a CoopereBR: R$ ${fmt(valor - economiaMensal)} (-${descontoPercentual}%)\n` +
      `💵 *Economia mensal: R$ ${fmt(economiaMensal)}*\n` +
      `📅 *Economia anual: R$ ${fmt(economiaAnual)}*\n\n` +
      `Com sua conta de R$ ${fmt(valor)}, você economizaria cerca de *R$ ${fmt(economiaMensal)} por mês* (R$ ${fmt(economiaAnual)} por ano)! 🎉`,
    );

    await this.sender.enviarMenuComBotoes(telefone, {
      titulo: 'Próximo passo',
      corpo: 'O que deseja fazer agora?',
      opcoes: [
        { id: '1', texto: '✅ Quero me cadastrar' },
        { id: '2', texto: '📋 Receber mais informações' },
        { id: '3', texto: '❌ Não tenho interesse' },
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
        '🎉 Ótimo! Para finalizar seu cadastro, envie uma *foto* ou *PDF* da sua conta de energia.\n\nIsso nos ajuda a calcular os créditos ideais para você! 📸',
      );
      return;
    }

    if (corpo === '2' || corpo.toLowerCase().includes('informaç') || corpo.toLowerCase().includes('informac')) {
      const baseUrl = process.env.FRONTEND_URL ?? 'http://localhost:3001';
      await this.sender.enviarMensagem(
        telefone,
        '📋 *Benefícios da CoopereBR:*\n\n' +
        '✅ Desconto de até 20% na conta de luz\n' +
        '✅ Energia 100% solar e renovável\n' +
        '✅ Sem investimento inicial\n' +
        '✅ Sem obras ou instalação\n' +
        '✅ Cancelamento sem multa\n' +
        '✅ Créditos aplicados direto na sua conta\n' +
        '✅ Acompanhe tudo pelo portal\n\n' +
        `🌐 Acesse nosso portal: ${baseUrl}\n\n` +
        'Quando estiver pronto, digite *cadastro* para iniciar! 😊',
      );
      await this.prisma.conversaWhatsapp.update({
        where: { id: conversa.id },
        data: { estado: 'MENU_QR_PROPAGANDA', contadorFallback: 0 },
      });
      return;
    }

    if (corpo === '3' || corpo.toLowerCase().includes('interesse') || corpo.toLowerCase().includes('não') || corpo.toLowerCase().includes('nao')) {
      await this.finalizarConversa(conversa.id);
      await this.sender.enviarMensagem(
        telefone,
        'Tudo bem! Se mudar de ideia, é só nos mandar uma mensagem. Obrigado pelo interesse! 💚',
      );
      return;
    }

    await this.incrementarFallback(conversa, telefone,
      'Responda *1* (cadastrar), *2* (mais informações) ou *3* (sem interesse).',
    );
  }

  // ═══════════════════════════════════════════════════════════════════════
  // ROTINA 2: Cooperado inadimplente abordado pelo sistema
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Inicia abordagem proativa para cooperado com cobrança vencida.
   * Chamado pelo cron de cobrança vencida.
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
      `Olá, ${nome}! 💚\n\n` +
      `Notamos que sua fatura no valor de *R$ ${fmt(valor)}* com vencimento em *${dataFmt}* está em aberto.\n\n` +
      `Sabemos que imprevistos acontecem — estamos aqui para ajudar! 🤝`,
    );

    await this.sender.enviarMenuComBotoes(telefone, {
      titulo: 'Fatura em aberto',
      corpo: 'Como posso ajudar?',
      opcoes: [
        { id: '1', texto: '📋 Ver detalhes da fatura' },
        { id: '2', texto: '💳 Negociar parcelamento' },
        { id: '3', texto: '✅ Já paguei' },
      ],
    });
  }

  private async handleMenuInadimplente(msg: MensagemRecebida, conversa: any): Promise<void> {
    const { telefone } = msg;
    const corpo = this.respostaEfetiva(msg);
    const dadosTemp = (conversa.dadosTemp ?? {}) as Record<string, any>;

    if (corpo === '1' || corpo.toLowerCase().includes('detalhe')) {
      const fmt = (v: number) => Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      let detalhes = `📋 *Detalhes da fatura:*\n\n`;
      detalhes += `💰 Valor: R$ ${fmt(dadosTemp.valor)}\n`;
      detalhes += `📅 Vencimento: ${dadosTemp.dataVencimento}\n`;

      if (dadosTemp.pixCopiaECola) {
        detalhes += `\n*Pague via PIX — Copia e Cola:*\n${dadosTemp.pixCopiaECola}\n`;
      }
      if (dadosTemp.linkPagamento) {
        detalhes += `\n🔗 Link de pagamento: ${dadosTemp.linkPagamento}\n`;
      }

      detalhes += `\n_Dúvidas? Responda esta mensagem._`;
      await this.sender.enviarMensagem(telefone, detalhes);

      await this.sender.enviarMenuComBotoes(telefone, {
        titulo: 'O que deseja?',
        corpo: 'Posso ajudar com mais alguma coisa?',
        opcoes: [
          { id: '2', texto: '💳 Negociar parcelamento' },
          { id: '3', texto: '✅ Já paguei' },
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
        `💳 *Opções de parcelamento:*\n\n` +
        `Podemos parcelar seu débito de R$ ${fmt(dadosTemp.valor)} sem juros:\n\n` +
        `• 2x de R$ ${fmt(valorParcela2x)}\n` +
        `• 3x de R$ ${fmt(valorParcela3x)}\n`,
      );

      await this.sender.enviarMenuComBotoes(telefone, {
        titulo: 'Parcelamento',
        corpo: 'Deseja prosseguir com o parcelamento?',
        opcoes: [
          { id: '1', texto: '✅ Sim, quero parcelar' },
          { id: '2', texto: '💰 Prefiro pagar à vista' },
        ],
      });
      return;
    }

    if (corpo === '3' || corpo.toLowerCase().includes('paguei') || corpo.toLowerCase().includes('já paguei')) {
      await this.finalizarConversa(conversa.id);
      await this.sender.enviarMensagem(
        telefone,
        '✅ Ótimo! Verificaremos o pagamento em até 24h.\n\n' +
        'Caso precise de algo, entre em contato. Obrigado! 💚',
      );
      return;
    }

    await this.incrementarFallback(conversa, telefone,
      'Responda *1* (ver detalhes), *2* (negociar parcelamento) ou *3* (já paguei).',
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

      // Atualizar cobrança com flag de negociação
      if (dadosTemp.cobrancaId) {
        try {
          await this.prisma.cobranca.update({
            where: { id: dadosTemp.cobrancaId },
            data: { motivoCancelamento: `Parcelamento 3x negociado via WhatsApp em ${new Date().toLocaleDateString('pt-BR')}` },
          });
        } catch (err) {
          this.logger.warn(`Erro ao atualizar cobrança com parcelamento: ${err.message}`);
        }
      }

      await this.finalizarConversa(conversa.id);
      await this.sender.enviarMensagem(
        telefone,
        `✅ *Acordo de parcelamento gerado!*\n\n` +
        `📋 Valor total: R$ ${fmt(dadosTemp.valor)}\n` +
        `💳 Parcelamento: 3x de R$ ${fmt(valorParcela)} sem juros\n\n` +
        `Nossa equipe enviará os boletos/PIX de cada parcela nos próximos dias.\n\n` +
        `Obrigado pela confiança! 💚`,
      );
      return;
    }

    if (corpo === '2' || corpo.toLowerCase().includes('vista') || corpo.toLowerCase().includes('pagar')) {
      await this.prisma.conversaWhatsapp.update({
        where: { id: conversa.id },
        data: { estado: 'MENU_INADIMPLENTE', contadorFallback: 0 },
      });

      const fmt = (v: number) => Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      let texto = `💰 Para pagar à vista (R$ ${fmt(dadosTemp.valor)}):\n`;
      if (dadosTemp.pixCopiaECola) {
        texto += `\n*PIX Copia e Cola:*\n${dadosTemp.pixCopiaECola}\n`;
      }
      if (dadosTemp.linkPagamento) {
        texto += `\n🔗 Link: ${dadosTemp.linkPagamento}\n`;
      }
      texto += `\nApós o pagamento, ele será confirmado em até 24h. 💚`;
      await this.sender.enviarMensagem(telefone, texto);

      await this.finalizarConversa(conversa.id);
      return;
    }

    await this.incrementarFallback(conversa, telefone,
      'Responda *1* (sim, quero parcelar) ou *2* (prefiro pagar à vista).',
    );
  }

  // ═══════════════════════════════════════════════════════════════════════
  // ROTINA 3: Novo membro indicado (fluxo de convite melhorado)
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Inicia fluxo de convite com botões interativos para novo indicado.
   * Substituição melhorada do iniciarFluxoConvite existente.
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
      `👋 Olá! Você foi indicado por *${indicadorNome}* para conhecer a *CoopereBR*!\n\n` +
      `🌱 Economize na conta de luz com energia solar compartilhada — sem investimento e sem obras.`,
    );

    await this.sender.enviarMenuComBotoes(telefone, {
      titulo: 'Indicação CoopereBR',
      corpo: 'O que deseja fazer?',
      opcoes: [
        { id: '1', texto: '🌱 Conhecer os benefícios', descricao: 'Saiba como funciona' },
        { id: '2', texto: '💰 Simular minha economia', descricao: 'Veja quanto vai economizar' },
        { id: '3', texto: '🚀 Iniciar cadastro agora', descricao: 'Cadastro rápido express' },
      ],
    });
  }

  private async handleMenuConviteIndicacao(msg: MensagemRecebida, conversa: any): Promise<void> {
    const { telefone } = msg;
    const corpo = this.respostaEfetiva(msg);
    const dadosTemp = (conversa.dadosTemp ?? {}) as Record<string, any>;

    if (corpo === '1' || corpo.toLowerCase().includes('benefício') || corpo.toLowerCase().includes('beneficio') || corpo.toLowerCase().includes('conhecer')) {
      await this.sender.enviarMensagem(
        telefone,
        '🌱 *Benefícios da CoopereBR:*\n\n' +
        '☀️ Energia 100% solar e renovável\n' +
        '💰 Economia de até *20%* na conta de luz\n' +
        '📋 Sem investimento inicial\n' +
        '🔧 Sem obras ou instalação\n' +
        '🔄 Cancelamento sem multa\n' +
        '📊 Acompanhe seus créditos pelo portal\n\n' +
        `Como você foi indicado por *${dadosTemp.indicadorNome}*, terá atendimento prioritário! 🎉`,
      );

      await this.sender.enviarMenuComBotoes(telefone, {
        titulo: 'Próximo passo',
        corpo: 'Deseja continuar?',
        opcoes: [
          { id: '2', texto: '💰 Simular minha economia' },
          { id: '3', texto: '🚀 Iniciar cadastro agora' },
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
        '💰 Vamos simular sua economia!\n\nQual o *valor médio* da sua conta de luz? (ex: 350)',
      );
      return;
    }

    if (corpo === '3' || corpo.toLowerCase().includes('cadastro') || corpo.toLowerCase().includes('iniciar')) {
      // Cadastro express: pede nome, CPF, telefone (já tem), email, valor fatura
      await this.prisma.conversaWhatsapp.update({
        where: { id: conversa.id },
        data: { estado: 'CADASTRO_EXPRESS_NOME', contadorFallback: 0 },
      });
      await this.sender.enviarMensagem(
        telefone,
        '🚀 *Cadastro Express!*\n\nVamos precisar de poucos dados. Qual é o seu *nome completo*?',
      );
      return;
    }

    await this.incrementarFallback(conversa, telefone,
      'Responda *1* (benefícios), *2* (simular economia) ou *3* (iniciar cadastro).',
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
    await this.sender.enviarMensagem(telefone, `Obrigado, *${corpo}*! Agora informe seu *CPF* (apenas números):`);
  }

  private async handleCadastroExpressCpf(msg: MensagemRecebida, conversa: any): Promise<void> {
    const { telefone } = msg;
    const corpo = (msg.corpo ?? '').trim().replace(/\D/g, '');

    if (corpo.length !== 11) {
      await this.sender.enviarMensagem(telefone, 'CPF inválido. Informe os *11 dígitos* do seu CPF:');
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
      await this.sender.enviarMensagem(telefone, 'E-mail inválido. Informe um *e-mail válido*:');
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
    await this.sender.enviarMensagem(telefone, 'Quase lá! Qual o *valor médio* da sua conta de luz? (ex: 350)');
  }

  private async handleCadastroExpressValorFatura(msg: MensagemRecebida, conversa: any): Promise<void> {
    const { telefone } = msg;
    const corpo = (msg.corpo ?? '').trim();

    const valorStr = corpo.replace(/[^\d.,]/g, '').replace(',', '.');
    const valor = parseFloat(valorStr);

    if (isNaN(valor) || valor <= 0) {
      await this.sender.enviarMensagem(telefone, 'Informe o valor em reais (apenas o número). Ex: *350*');
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

    // Registrar indicação
    if (codigoRef) {
      try {
        await this.indicacoes.registrarIndicacao(cooperado.id, codigoRef);
        this.logger.log(`Indicação express registrada para ${cooperado.id} via código ${codigoRef}`);
      } catch (err) {
        this.logger.warn(`Erro ao registrar indicação express: ${err.message}`);
      }
    }

    await this.prisma.conversaWhatsapp.update({
      where: { id: conversa.id },
      data: { cooperadoId: cooperado.id },
    });

    await this.finalizarConversa(conversa.id);

    const economiaMensal = valor * 0.2;
    const fmt = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    let msgFinal = `🎉 *Perfeito! Seu cadastro está em análise.*\n\n`;
    msgFinal += `👤 ${nome}\n`;
    msgFinal += `📧 ${email}\n`;
    msgFinal += `💰 Economia estimada: R$ ${fmt(economiaMensal)}/mês\n\n`;
    if (indicadorNome) {
      msgFinal += `*${indicadorNome}* será notificado quando você for aprovado! 🎉\n\n`;
    }
    msgFinal += `Nossa equipe entrará em contato em breve. Obrigado! 💚`;

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
          `🎉 Boa notícia! *${nome}* acabou de completar o cadastro express através do seu convite!\n\n` +
          `Quando ele for aprovado e pagar a primeira fatura, você receberá seu benefício automaticamente. Obrigado por indicar! 🙏`,
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
              `📋 Novo cadastro express via indicação:\n${nome} | Tel: ${telefoneNorm} | Email: ${email}\nIndicado por: ${indicador.nomeCompleto}`,
            ).catch(() => {});
          }
        }
      }
    }
  }

  // ─── MENU FATURA: lista cobranças pendentes ─────────────────────────────

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
        'Não encontramos um cadastro vinculado a este número. 😕\n\nSe você é cooperado, entre em contato pelo site cooperebr.com.br para atualizar seu telefone.',
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
        `Olá, ${cooperado.nomeCompleto.split(' ')[0]}! 😊\n\nVocê não tem faturas pendentes no momento. Está tudo em dia! ✅`,
      );
      await this.resetarConversa(telefone);
      return;
    }

    // Pegar cobrança mais recente (A_VENCER ou VENCIDO — já filtrado pelo service)
    const cobranca = cobrancas[0];
    const nome = cooperado.nomeCompleto.split(' ')[0];
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

    // Régua de urgência
    let cabecalho: string;
    if (diasParaVencer > 5) {
      cabecalho = `✅ Sua fatura vence em ${diasParaVencer} dias`;
    } else if (diasParaVencer >= 2) {
      cabecalho = `⚠️ Atenção! Sua fatura vence em ${diasParaVencer} dias`;
    } else if (diasParaVencer === 1) {
      cabecalho = `🔔 Sua fatura vence *amanhã*!`;
    } else if (diasParaVencer === 0) {
      cabecalho = `🚨 Sua fatura vence *hoje*!`;
    } else {
      cabecalho = `❌ Sua fatura está *vencida* há ${Math.abs(diasParaVencer)} dia(s)!`;
    }

    const statusLabel = cobranca.status === 'VENCIDO' ? '⚠️ VENCIDA' : '📅 A vencer';

    let texto = `💚 *CoopereBR — Fatura ${mesStr}/${ano}*\n\n`;
    texto += `Olá, ${nome}! 👋\n\n`;
    texto += `${cabecalho}\n\n`;
    texto += `${statusLabel}\n`;
    texto += `👤 ${cooperado.nomeCompleto}\n`;
    texto += `📆 Competência: ${mesStr}/${ano}\n`;
    texto += `💰 Valor: *R$ ${valor}*\n`;
    texto += `📅 Vencimento: ${dataVencStr}\n`;

    await this.sender.enviarMensagem(telefone, texto);

    // Enviar menu com botões
    await this.sender.enviarMenuComBotoes(telefone, {
      titulo: 'Opções de pagamento',
      corpo: 'Como deseja pagar ou consultar?',
      opcoes: [
        { id: 'pix', texto: 'Pagar com PIX' },
        { id: 'boleto', texto: 'Código de barras' },
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

  // ─── RESPOSTA MENU FATURA: usuário escolheu opção do menu ─────────────

  private async handleRespostaMenuFatura(msg: MensagemRecebida, conversa: any): Promise<void> {
    const { telefone } = msg;
    const corpo = (msg.corpo ?? '').trim().toLowerCase();

    if (['voltar', 'sair', 'menu'].includes(corpo)) {
      await this.resetarConversa(telefone);
      const texto = await this.msg('boas_vindas', {}, '👋 Olá! Sou o assistente da *CoopereBR*.\n\nPara começar, envie uma *foto* ou *PDF* da sua conta de energia elétrica e eu faço uma simulação de economia para você! 📸');
      await this.sender.enviarMensagem(telefone, texto);
      return;
    }

    // Buscar cobrança do cooperado
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
      await this.sender.enviarMensagem(telefone, 'Não encontrei faturas pendentes. Digite *voltar* para retornar.');
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
          `💳 *PIX Copia e Cola:*\n\n\`${pixCopiaECola}\`\n\n_Copie o código acima e cole no app do seu banco._`,
        );
      } else {
        const portalUrl = process.env.PORTAL_URL || 'https://app.cooperebr.com.br';
        await this.sender.enviarMensagem(
          telefone,
          `PIX não disponível no momento. Acesse o portal para pagar:\n${portalUrl}`,
        );
      }
    } else if (corpo.includes('boleto') || corpo.includes('codigo') || corpo.includes('código') || corpo.includes('barra') || corpo === '2') {
      const boletoUrl = asaas?.boletoUrl;
      if (boletoUrl) {
        await this.sender.enviarMensagem(
          telefone,
          `📄 *Boleto bancário:*\n\n🔗 ${boletoUrl}\n\n_Acesse o link para visualizar e pagar._`,
        );
      } else {
        const portalUrl = process.env.PORTAL_URL || 'https://app.cooperebr.com.br';
        await this.sender.enviarMensagem(
          telefone,
          `Código de barras não disponível. Acesse o portal:\n${portalUrl}`,
        );
      }
    } else if (corpo.includes('portal') || corpo.includes('ver fatura') || corpo === '3') {
      const portalUrl = process.env.PORTAL_URL || 'https://app.cooperebr.com.br';
      await this.sender.enviarMensagem(
        telefone,
        `🔗 Acesse sua fatura no portal:\n${portalUrl}\n\n_Faça login com seu CPF e senha._`,
      );
    } else if (corpo.includes('extrato')) {
      const valorLiquido = Number(cobranca.valorLiquido).toFixed(2).replace('.', ',');
      const valorMulta = Number((cobranca as any).valorMulta ?? 0).toFixed(2).replace('.', ',');
      const valorJuros = Number((cobranca as any).valorJuros ?? 0).toFixed(2).replace('.', ',');
      const diasAtraso = Number((cobranca as any).diasAtraso ?? 0);
      const valorAtualizado = Number((cobranca as any).valorAtualizado ?? cobranca.valorLiquido).toFixed(2).replace('.', ',');

      let extrato = `📊 *Extrato da Fatura*\n\n`;
      extrato += `💰 Valor original: R$ ${valorLiquido}\n`;
      if (diasAtraso > 0) {
        extrato += `📅 Dias em atraso: ${diasAtraso}\n`;
        extrato += `💸 Multa: R$ ${valorMulta}\n`;
        extrato += `💸 Juros: R$ ${valorJuros}\n`;
        extrato += `💰 *Valor atualizado: R$ ${valorAtualizado}*\n`;
      }
      await this.sender.enviarMensagem(telefone, extrato);
    } else if (corpo.includes('comprovante') || corpo.includes('paguei') || corpo.includes('já paguei')) {
      await this.prisma.conversaWhatsapp.update({
        where: { id: conversa.id },
        data: { estado: 'AGUARDANDO_COMPROVANTE_PAGAMENTO' },
      });
      await this.sender.enviarMensagem(
        telefone,
        '📸 Por favor, envie a *foto* ou *PDF* do comprovante de pagamento para confirmarmos.',
      );
      return;
    } else {
      // Opção não reconhecida — reenviar menu
      await this.sender.enviarMenuComBotoes(telefone, {
        titulo: 'Opções de pagamento',
        corpo: 'Não entendi sua resposta. Escolha uma opção:',
        opcoes: [
          { id: 'pix', texto: 'Pagar com PIX' },
          { id: 'boleto', texto: 'Código de barras' },
          { id: 'portal', texto: 'Ver fatura' },
        ],
      });
      return;
    }

    // Após responder, reenviar menu para nova consulta
    await this.sender.enviarMenuComBotoes(telefone, {
      titulo: 'Opções de pagamento',
      corpo: 'Precisa de mais alguma coisa?',
      opcoes: [
        { id: 'pix', texto: 'Pagar com PIX' },
        { id: 'boleto', texto: 'Código de barras' },
        { id: 'portal', texto: 'Ver fatura' },
      ],
    });
  }

  // ─── COMPROVANTE DE PAGAMENTO ─────────────────────────────────────────

  private async handleComprovantePagamento(msg: MensagemRecebida, conversa: any): Promise<void> {
    const { telefone, tipo } = msg;

    const isMidia = tipo === 'imagem' || tipo === 'documento';

    if (!isMidia) {
      await this.sender.enviarMensagem(
        telefone,
        'Por favor, envie a *foto* ou *PDF* do comprovante de pagamento. 📸',
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
        `📋 *Comprovante de pagamento recebido*\n\n👤 ${nomeCooperado}\n📱 ${telefone}\n\n_Verifique o comprovante e dê baixa na fatura._`,
      ).catch((err) => this.logger.warn(`Falha ao notificar admin: ${err.message}`));
    }

    // Confirmar ao cooperado
    await this.sender.enviarMensagem(
      telefone,
      '✅ Comprovante recebido! Nossa equipe vai conferir e confirmar o pagamento. Obrigado! 🙏',
    );

    // Voltar ao estado inicial
    await this.prisma.conversaWhatsapp.update({
      where: { id: conversa.id },
      data: { estado: 'INICIAL' },
    });
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────

  private async resetarConversa(telefone: string): Promise<void> {
    await this.prisma.conversaWhatsapp.upsert({
      where: { telefone },
      update: { estado: 'INICIAL', dadosTemp: undefined },
      create: { telefone, estado: 'INICIAL' },
    });
  }

  private async finalizarConversa(id: string): Promise<void> {
    await this.prisma.conversaWhatsapp.update({
      where: { id },
      data: { estado: 'CONCLUIDO' },
    });
  }
}
