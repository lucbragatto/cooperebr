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

// Emojis em unicode escape para evitar problemas de encoding no WhatsApp
const E = {
  oi: '\uD83D\uDC4B',        // 👋
  solar: '\u2600\uFE0F',     // ☀️
  bolt: '\u26A1',            // ⚡
  ok: '\u2705',              // ✅
  atendente: '\uD83E\uDDD1\u200D\uD83D\uDCBB', // 🧑‍💻
  link: '\uD83D\uDD17',      // 🔗
  dinheiro: '\uD83D\uDCB0',  // 💰
  estrela: '\u2B50',         // ⭐
  presente: '\uD83C\uDF81',  // 🎁
  aviso: '\u26A0\uFE0F',     // ⚠️
  relogio: '\u23F0',         // ⏰
  casa: '\uD83C\uDFE0',      // 🏠
  folha: '\uD83C\uDF3F',     // 🌿
  handshake: '\uD83E\uDD1D', // 🤝
  telefone: '\uD83D\uDCDE',  // 📞
  carta: '\uD83D\uDCE7',     // 📧
  sorriso: '\uD83D\uDE0A',   // 😊
  suor: '\uD83D\uDE05',      // 😅
  camera: '\uD83D\uDCF8',    // 📸
  clipe: '\uD83D\uDCCE',     // 📎
  seta: '\uD83D\uDC49',      // 👉
  prancheta: '\uD83D\uDCCB', // 📋
  pessoa: '\uD83D\uDC64',    // 👤
  engrenagem: '\uD83D\uDD27', // 🔧
  lupa: '\uD83D\uDD0D',      // 🔍
  doc: '\uD83D\uDCC4',       // 📄
  ciclo: '\uD83D\uDD04',     // 🔄
  pino: '\uD83D\uDCCC',      // 📌
  calendario: '\uD83D\uDCC5', // 📅
  grafico: '\uD83D\uDCCA',   // 📊
  muda: '\uD83C\uDF31',      // 🌱
  coracao: '\uD83D\uDC9A',   // 💚
  dolar: '\uD83D\uDCB5',     // 💵
  foguete: '\uD83D\uDE80',   // 🚀
  festa: '\uD83C\uDF89',     // 🎉
  orar: '\uD83D\uDE4F',      // 🙏
  pensar: '\uD83E\uDD14',    // 🤔
  lua: '\uD83C\uDF19',       // 🌙
  sino: '\uD83D\uDD14',      // 🔔
  sirene: '\uD83D\uDEA8',    // 🚨
  x: '\u274C',               // ❌
  ampulheta: '\u231B',       // ⌛
  hourglass: '\u23F3',       // ⏳
  lampada: '\uD83D\uDCA1',   // 💡
  globo: '\uD83C\uDF10',     // 🌐
  celular: '\uD83D\uDCF1',   // 📱
  pc: '\uD83D\uDCBB',        // 💻
  editar: '\u270F\uFE0F',    // ✏️
  setaCima: '\u2B06\uFE0F',  // ⬆️
  setaBaixo: '\u2B07\uFE0F', // ⬇️
  pausar: '\u23F8\uFE0F',    // ⏸️
  cartao: '\uD83D\uDCB3',    // 💳
  like: '\uD83D\uDC4D',      // 👍
  email: '\uD83D\uDCE7',     // 📧
  caixa: '\uD83D\uDCE8',     // 📨
  microfone: '\uD83C\uDFA4', // 🎤
  bateria: '\uD83D\uDD0B',   // 🔋
  pilha: '\uD83D\uDCDA',     // 📚
  amarelo: '\uD83D\uDFE1',   // 🟡
  verde: '\uD83D\uDFE2',     // 🟢
  vermelho: '\uD83D\uDD34',  // 🔴
  branco: '\u26AA',          // ⚪
  nota: '\uD83D\uDCDD',      // 📝
  enviar: '\uD83D\uDCE4',    // 📤
  cadeado: '\uD83D\uDD12',   // 🔒
  moeda: '\uD83D\uDCB8',     // 💸
  msgBox: '\uD83D\uDCEC',    // 📬
  confuso: '\uD83D\uDE15',   // 😕
  mapPin: '\uD83D\uDCCD',    // 📍
  plugue: '\uD83D\uDD0C',    // 🔌
};

interface MensagemRecebida {
  telefone: string;
  tipo: 'texto' | 'imagem' | 'documento' | 'audio' | 'video' | 'sticker' | 'location' | 'contato';
  corpo?: string;
  mediaBase64?: string;
  mimeType?: string;
  /** ID do botão clicado (buttonResponseMessage) ou rowId da lista selecionada */
  selectedButtonId?: string;
  /** Dados do contato compartilhado (contactMessage) */
  contatoNome?: string;
  contatoTelefone?: string;
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

    // Se mensagem chegou sem texto e sem mídia, ignorar silenciosamente
    if (!corpo && msg.tipo === 'texto') {
      this.logger.warn(`Mensagem sem conteúdo de ${telefone} - ignorada`);
      return;
    }

    // Buscar ou criar conversa (upsert atômico para evitar race condition)
    const conversa = await this.prisma.conversaWhatsapp.upsert({
      where: { telefone },
      update: {},
      create: { telefone, estado: 'INICIAL' },
    });

    // Fallback: palavras-chave especiais
    const corpoLower = corpo.toLowerCase();

    if (['duvida', 'd\u00favida', 'problema', 'erro'].includes(corpoLower)) {
      const texto = await this.msg('ajuda', {}, `Estou aqui para ajudar! Para falar com nossa equipe, acesse: cooperebr.com.br\n\nOu envie a foto da sua conta de luz para gerar uma simula\u00e7\u00e3o gratuita! ${E.camera}`);
      await this.sender.enviarMensagem(telefone, texto);
      return;
    }

    // â”€â”€â”€ Áudio â†’ só aceita texto â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    if (msg.tipo === 'audio') {
      await this.sender.enviarMensagem(
        telefone,
        `${E.microfone} Desculpe, no momento só consigo processar mensagens de *texto*.\n\nPor favor, digite sua mensagem. Se preferir, envie *menu* para ver as opções disponíveis.`,
      );
      return;
    }

    // â”€â”€â”€ Foto/documento fora de contexto (sticker, vídeo, location) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    if (['video', 'sticker', 'location'].includes(msg.tipo)) {
      await this.sender.enviarMensagem(
        telefone,
        `${E.clipe} Este tipo de mídia não é suportado.\n\nPara enviar documentos, acesse o *Portal do Cooperado*:\n${E.seta} cooperebr.com.br/portal\n\nOu digite *menu* para ver as opções.`,
      );
      return;
    }

    // â”€â”€â”€ Linguagem inapropriada â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    if (corpo && PALAVRAS_IMPROPRIAS.some(p => corpoLower.includes(p))) {
      await this.sender.enviarMensagem(
        telefone,
        `${E.orar} Entendo sua frustração. Estamos aqui para ajudar da melhor forma possível.\n\nPor favor, nos diga como podemos resolver sua questão. Se preferir, posso encaminhá-lo para um atendente humano.\n\nDigite *3* para falar com um atendente.`,
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
        `${E.aviso} *Solicitação de desligamento*\n\n` +
        'Sentimos muito que queira nos deixar. Para solicitar o desligamento:\n\n' +
        '1️⃣ Acesse o portal: cooperebr.com.br/portal/desligamento\n' +
        '2️⃣ Preencha o formulário de desligamento\n' +
        '3️⃣ Nossa equipe processará em até 30 dias\n\n' +
        'Se quiser conversar sobre isso antes, digite *3* para falar com um atendente.',
      );
      return;
    }

    // â”€â”€â”€ Perguntas sobre tarifa/preço â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
        `${E.dinheiro} *Benefícios CoopereBR:*\n\n` +
        `${E.muda} Desconto de até *20%* na conta de energia\n` +
        `${E.solar} Energia 100% solar e sustentável\n` +
        `${E.grafico} Sem investimento inicial\n` +
        `${E.prancheta} Sem obras ou instalação\n` +
        `${E.ciclo} Cancelamento sem multa\n\n` +
        `${E.camera} Quer saber exatamente quanto vai economizar?\n` +
        'Envie a *foto da sua conta de luz* e faço uma simulação personalizada!\n\n' +
        'Ou digite *2* para iniciar seu cadastro.',
      );
      return;
    }

    // â”€â”€â”€ Número de protocolo â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
          PENDENTE_ATIVACAO: `${E.amarelo} Pendente de ativação`,
          EM_APROVACAO: `${E.amarelo} Em aprovação`,
          ATIVO: `${E.verde} Ativo`,
          SUSPENSO: `${E.vermelho} Suspenso`,
          ENCERRADO: `${E.branco} Encerrado`,
        };
        await this.sender.enviarMensagem(
          telefone,
          `${E.prancheta} *Status do protocolo ${protocolo}:*\n\n` +
          `${E.pessoa} ${contrato.cooperado?.nomeCompleto ?? 'N/A'}\n` +
          `${E.grafico} Status: ${statusLabel[contrato.status] ?? contrato.status}\n` +
          `${E.calendario} Início: ${new Date(contrato.dataInicio).toLocaleDateString('pt-BR')}\n\n` +
          `Para mais detalhes, acesse o portal ou digite *menu*.`,
        );
      } else {
        await this.sender.enviarMensagem(
          telefone,
          `${E.lupa} Protocolo *${protocolo}* não encontrado.\n\nVerifique o número e tente novamente, ou digite *3* para falar com um atendente.`,
        );
      }
      return;
    }

    // â”€â”€â”€ Verificar horário de atendimento (20h-8h) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const agora = new Date();
    // Converter para horário de Brasília (UTC-3)
    const horaBrasilia = new Date(agora.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
    const hora = horaBrasilia.getHours();
    if (hora >= 20 || hora < 8) {
      // Fora do expediente - ainda processa a mensagem mas avisa sobre atraso
      await this.sender.enviarMensagem(
        telefone,
        `${E.lua} *Atendimento fora do horário comercial*\n\n` +
        'Nosso horário de atendimento humano é de *segunda a sexta, das 8h às 20h*.\n\n' +
        'Sua mensagem foi registrada e será respondida no próximo dia útil.\n\n' +
        'Enquanto isso, você pode:\n' +
        `${E.camera} Enviar foto da fatura para simulação automática\n` +
        `${E.globo} Acessar o portal: cooperebr.com.br/portal\n\n` +
        'Ou digite *menu* para ver as opções do bot.',
      );
      // Não faz return - continua processando normalmente (simulação funciona 24h)
    }

    // â”€â”€â”€ Verificar timeout de sessão (30min sem atividade) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
          `${E.relogio} Sua sessão anterior expirou por inatividade.\n\n` +
          'Vamos recomeçar? Digite *menu* para ver as opções ou envie a *foto da sua fatura* para simular.',
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
      // Se está em menu, redireciona para fluxo de fatura
      await this.prisma.conversaWhatsapp.update({
        where: { id: conversa.id },
        data: { estado: 'INICIAL' },
      });
      const conversaAtualizada = await this.prisma.conversaWhatsapp.findUnique({ where: { telefone } });
      await this.handleInicial(msg, conversaAtualizada);
      return;
    }

    // â”€â”€â”€ Palavras-chave de fatura/boleto â†’ MENU_FATURA â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    // Só redireciona se não houver fluxo ativo em andamento (WA-BOT-01)
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
      'AGUARDANDO_PROPRIETARIO_FATURA', 'AGUARDANDO_CONFIRMACAO_OCR',
      'AGUARDANDO_NOME_TERCEIRO', 'AGUARDANDO_TELEFONE_TERCEIRO',
      'AGUARDANDO_CONFIRMACAO_CELULAR', 'AGUARDANDO_CELULAR_CORRETO', 'AGUARDANDO_INDICACAO', 'RECEBENDO_CONTATOS',
    ];
    if (['fatura', 'faturas', 'boleto', '2a via', '2Âª via', 'segunda via', 'pix', 'pagar'].includes(corpoLower)) {
      if (ESTADOS_FLUXO_ATIVO.includes(conversa.estado)) {
        await this.sender.enviarMensagem(
          telefone,
          `${E.hourglass} Você está no meio de um processo. Por favor, conclua a etapa atual ou digite *cancelar* para recomeçar.`,
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

    // Motor dinâmico - processa apenas a etapa atual e aguarda próxima resposta (WA-15)
    try {
      const processou = await this.fluxoMotor.processarComFluxoDinamico(msg as any, conversa);
      if (processou) return;
    } catch (err) {
      this.logger.warn(`Erro no motor dinâmico, fallback hardcoded: ${err.message}`);
    }

    // ═══ Navegação global - palavras reservadas ═══
    const corpoNav = corpo.toLowerCase().trim();
    const palavrasSair = ['sair', 'cancelar', 'tchau', 'encerrar', 'fim', 'finalizar'];
    const palavrasMenu = ['menu', '0', 'voltar', 'inicio', 'oi', 'ola', 'bom dia', 'boa tarde', 'boa noite', 'oie', 'hey'];

    if (palavrasSair.includes(corpoNav) && conversa.estado !== 'INICIAL' && conversa.estado !== 'CONCLUIDO') {
      await this.sender.enviarMensagem(telefone, 'Ate logo! Se precisar, e so chamar. ' + E.oi);
      await this.resetarConversa(telefone);
      return;
    }

    if (palavrasMenu.includes(corpoNav) && conversa.estado !== 'INICIAL') {
      await this.resetarConversa(telefone);
      await this.handleMenuPrincipalInicio(msg, conversa);
      return;
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
        // â”€â”€â”€ Fluxo convite por indicação â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        case 'MENU_CONVITE':
          await this.handleMenuConvite(msg, conversa);
          break;
        case 'AGUARDANDO_FOTO_FATURA':
          await this.handleAguardandoFotoFatura(msg, conversa);
          break;
        case 'AGUARDANDO_NOME_TERCEIRO':
          await this.handleAguardandoNomeTerceiro(msg, conversa);
          break;
        case 'AGUARDANDO_TELEFONE_TERCEIRO':
          await this.handleAguardandoTelefoneTerceiro(msg, conversa);
          break;
        case 'AGUARDANDO_PROPRIETARIO_FATURA':
          await this.handleAguardandoProprietarioFatura(msg, conversa);
          break;
        case 'AGUARDANDO_CONFIRMACAO_OCR':
          await this.handleAguardandoConfirmacaoOcr(msg, conversa);
          break;
        case 'AGUARDANDO_CONFIRMACAO_CELULAR':
          await this.handleAguardandoConfirmacaoCelular(msg, conversa);
          break;
        case 'AGUARDANDO_CELULAR_CORRETO':
          await this.handleAguardandoCelularCorreto(msg, conversa);
          break;
        case 'AGUARDANDO_INDICACAO':
          await this.handleAguardandoIndicacao(msg, conversa);
          break;
        case 'RECEBENDO_CONTATOS':
          await this.handleRecebendoContatos(msg, conversa);
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
        // â”€â”€â”€ Rotina 3: Convite indicação melhorado â”€â”€â”€â”€â”€â”€
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
        // â”€â”€â”€ Atualização de cadastro/contrato â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
        `Desculpe, ocorreu um erro ao processar sua mensagem. Tente novamente em alguns instantes ou envie outra foto da fatura. ${E.sorriso}`,
      );
    }
  }

  /** Extrai o ID efetivo: prioriza selectedButtonId (botão/lista), senão usa texto */
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
      corpo: `${E.oi} Olá! Sou o assistente da *CoopereBR* - energia solar para todos.\n\nComo posso ajudar?`,
      opcoes: [
        { id: '1', texto: `${E.prancheta} Já sou cooperado` },
        { id: '2', texto: `${E.bolt} Quero ser cooperado` },
        { id: '3', texto: `${E.pessoa} Falar com atendente` },
        { id: '4', texto: `${E.presente} Convidar um amigo`, descricao: 'Compartilhe seu link' },
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
        await this.sender.enviarMensagem(telefone, `${E.aviso} Não encontrei seu cadastro ativo.\n\nSe você se cadastrou recentemente, aguarde nosso contato. Ou:\n\n1️⃣ Iniciar novo cadastro\n2️⃣ Falar com atendente`);
        await this.prisma.conversaWhatsapp.update({ where: { id: conversa.id }, data: { estado: 'MENU_CLIENTE', contadorFallback: 0 } });
        return;
      }

      await this.prisma.conversaWhatsapp.update({
        where: { id: conversa.id },
        data: { estado: 'MENU_COOPERADO', cooperadoId: cooperado.id, contadorFallback: 0 },
      });
      await this.sender.enviarMenuComBotoes(telefone, {
        titulo: 'Menu do Cooperado',
        corpo: `${E.ok} Olá, *${cooperado.nomeCompleto || 'Cooperado'}*! O que você precisa?`,
        opcoes: [
          { id: '1', texto: `${E.bolt} Ver saldo de créditos`, descricao: 'Seus kWh contratados' },
          { id: '2', texto: `${E.doc} Ver próxima fatura`, descricao: 'Valor e vencimento' },
          { id: '3', texto: `${E.editar} Atualizar meu cadastro`, descricao: 'Nome, email, telefone, endereço' },
          { id: '4', texto: `${E.ciclo} Atualizar meu contrato`, descricao: 'kWh, suspensão, encerramento' },
          { id: '5', texto: `${E.presente} Indicar um amigo`, descricao: 'Ganhe desconto na fatura' },
          { id: '6', texto: `${E.engrenagem} Suporte / Ocorrência`, descricao: 'Abrir chamado' },
          { id: '7', texto: `${E.pessoa} Falar com atendente`, descricao: 'Atendimento humano' },
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
        titulo: 'Simulação gratuita',
        corpo: `${E.bolt} Ã“timo! Para gerar sua simulação gratuita, preciso da sua *conta de energia elétrica*.\n\nComo prefere proceder?`,
        opcoes: [
          { id: '1', texto: `${E.clipe} Enviar agora`, descricao: 'Já tenho a fatura (foto ou PDF)' },
          { id: '2', texto: `${E.email} Está no meu email`, descricao: 'Vou buscar e enviar' },
          { id: '3', texto: `${E.pc} Baixar do site`, descricao: 'Te ajudo passo a passo' },
        ],
      });
      return;
    }

    if (corpo === '3' || corpo.toLowerCase().includes('atendente') || corpo.toLowerCase().includes('humano')) {
      await this.encaminharAtendente(telefone, conversa.id, 'Solicitou atendente no menu principal');
      return;
    }

    if (corpo === '4' || corpo.toLowerCase().includes('convidar') || corpo.toLowerCase().includes('indicar amigo')) {
      // Verificar se é cooperado pelo telefone para buscar o link personalizado
      const telefoneNorm = telefone.replace(/\D/g, '');
      const telefoneSemPais = telefoneNorm.replace(/^55/, '');
      const cooperado = await this.prisma.cooperado.findFirst({
        where: {
          OR: [{ telefone: telefoneNorm }, { telefone: telefoneSemPais }, { telefone: `55${telefoneSemPais}` }],
        },
        select: { id: true, nomeCompleto: true, codigoIndicacao: true, cooperativaId: true },
      });

      if (cooperado) {
        // Cooperado: oferecer sub-menu com opção de proxy
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
          `${E.presente} *Convidar um amigo:*\n\n` +
          `1️⃣ Enviar meu link de indicação\n` +
          `2️⃣ Cadastrar meu amigo (tenho a fatura dele)\n\n` +
          `_Responda 1 ou 2_`
        );
      } else {
        // Não é cooperado - link genérico da CoopereBR
        const baseUrl = process.env.FRONTEND_URL ?? 'https://cooperebr.com.br';
        await this.sender.enviarMensagem(telefone,
          `${E.presente} *Convide seus amigos para economizar na conta de luz!*\n\n` +
          `Compartilhe o link da CoopereBR:\n${baseUrl}\n\n` +
          `${E.solar} Energia solar sem investimento, com até 20% de desconto na conta de luz.\n\n` +
          `_Quer ter seu link personalizado com benefícios? Digite *2* para se cadastrar!_`
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

    if (corpo === '1' || corpo.toLowerCase().includes('saldo') || corpo.toLowerCase().includes('crédito')) {
      const contratos = await this.prisma.contrato.findMany({
        where: { cooperadoId, status: 'ATIVO' as any },
        include: { uc: { select: { numero: true } } },
        orderBy: { createdAt: 'desc' },
        take: 3,
      });
      if (contratos.length === 0) {
        await this.sender.enviarMensagem(telefone, `${E.aviso} Nenhum contrato ativo encontrado. Fale com nossa equipe.`);
        return;
      }
      let texto = `${E.bolt} *Seus créditos:*\n\n`;
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
        await this.sender.enviarMensagem(telefone, `${E.ok} Você não tem faturas pendentes no momento!`);
        return;
      }
      const fmt = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
      await this.sender.enviarMensagem(
        telefone,
        `${E.doc} *Próxima fatura:*\n\n` +
        `${E.dinheiro} Valor: R$ ${fmt(Number(cobranca.valorLiquido ?? cobranca.valorBruto))}\n` +
        `${E.calendario} Vencimento: ${new Date(cobranca.dataVencimento).toLocaleDateString('pt-BR')}\n` +
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
        corpo: `${E.editar} *O que deseja atualizar?*`,
        opcoes: [
          { id: '1', texto: `${E.nota} Nome` },
          { id: '2', texto: `${E.email} Email` },
          { id: '3', texto: `${E.celular} Telefone` },
          { id: '4', texto: `${E.mapPin} Endereço (CEP)` },
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
        corpo: `${E.ciclo} *O que deseja fazer com seu contrato?*`,
        opcoes: [
          { id: '1', texto: `${E.setaCima} Aumentar meus kWh` },
          { id: '2', texto: `${E.setaBaixo} Diminuir meus kWh` },
          { id: '3', texto: `${E.pausar} Suspender temporariamente` },
          { id: '4', texto: `${E.x} Encerrar contrato` },
        ],
      });
      return;
    }

    if (corpo === '5' || corpo.toLowerCase().includes('indicar') || corpo.toLowerCase().includes('amigo')) {
      if (!cooperadoId) {
        await this.sender.enviarMensagem(telefone, `${E.aviso} Não conseguimos identificar seu cadastro. Tente novamente ou fale com o suporte.`);
        return;
      }
      try {
        const result = await this.indicacoes.getMeuLink(cooperadoId);
        if (!result?.link) {
          await this.sender.enviarMensagem(telefone, `${E.aviso} Não foi possível gerar seu link de indicação no momento. Tente novamente mais tarde.`);
          return;
        }
        const { link, totalIndicados, indicadosAtivos } = result;
        await this.sender.enviarMensagem(telefone,
          `${E.presente} *Seu link de indicação:*\n\n` +
          `${link}\n\n` +
          `${E.grafico} Total indicados: ${totalIndicados ?? 0}\n` +
          `${E.ok} Ativos (com benefício): ${indicadosAtivos ?? 0}\n\n` +
          `_Compartilhe! Quando seu indicado pagar a 1Âª fatura, você ganha seu benefício._`,
        );
      } catch (err) {
        this.logger.warn(`Erro ao buscar link de indicação para ${cooperadoId}: ${err?.message}`);
        await this.sender.enviarMensagem(telefone, `${E.aviso} Não foi possível gerar seu link de indicação no momento. Tente novamente mais tarde.`);
      }
      return;
    }

    if (corpo === '6' || corpo.toLowerCase().includes('suporte') || corpo.toLowerCase().includes('ocorrência')) {
      await this.prisma.conversaWhatsapp.update({
        where: { id: conversa.id },
        data: { estado: 'AGUARDANDO_ATENDENTE', contadorFallback: 0 },
      });
      await this.sender.enviarMensagem(
        telefone,
        `${E.engrenagem} *Suporte técnico:*\n\nDescreva o problema e nossa equipe responderá em breve.\n\nOu escolha:\n1️⃣ Problema na fatura\n2️⃣ Créditos não creditados\n3️⃣ Outro`,
      );
      return;
    }

    if (corpo === '7' || corpo.toLowerCase().includes('atendente')) {
      await this.encaminharAtendente(telefone, conversa.id, 'Cooperado solicitou atendente no menu cooperado');
      return;
    }

    await this.incrementarFallback(conversa, telefone,
      'Responda *1* (créditos), *2* (fatura), *3* (cadastro), *4* (contrato), *5* (indicar), *6* (suporte) ou *7* (atendente).',
    );
  }

  private async handleMenuSemFatura(msg: MensagemRecebida, conversa: any): Promise<void> {
    const { telefone } = msg;
    const resposta = this.respostaEfetiva(msg);
    const corpo = resposta;

    if (corpo === '1' || corpo.toLowerCase().includes('enviar agora') || corpo.toLowerCase().includes('já tenho')) {
      await this.prisma.conversaWhatsapp.update({
        where: { id: conversa.id },
        data: { estado: 'AGUARDANDO_FOTO_FATURA', contadorFallback: 0 },
      });
      await this.sender.enviarMensagem(telefone,
        `${E.clipe} Perfeito! Envie agora a *foto* ou o *PDF* da sua conta de energia.\n\n_Dica: tire uma foto clara da frente completa da fatura, com todos os dados visíveis._`
      );
      return;
    }

    if (corpo === '2' || corpo.toLowerCase().includes('email') || corpo.toLowerCase().includes('buscar')) {
      await this.prisma.conversaWhatsapp.update({
        where: { id: conversa.id },
        data: { estado: 'AGUARDANDO_DISPOSITIVO_EMAIL', contadorFallback: 0 },
      });
      await this.sender.enviarMenuComBotoes(telefone, {
        titulo: 'Onde está acessando?',
        corpo: `${E.email} Ã“timo! Vou te ajudar a baixar a fatura do seu email.\n\nVocê está usando:`,
        opcoes: [
          { id: 'CEL', texto: `${E.celular} Celular`, descricao: 'Vou te guiar pelo app' },
          { id: 'PC', texto: `${E.pc} Computador`, descricao: 'Vou te guiar pelo navegador' },
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
        corpo: `${E.pc} Vou te ajudar a baixar sua fatura!\n\nQual é a sua distribuidora de energia?`,
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
        `${E.celular} *Baixar a fatura pelo celular:*\n\n` +
        '1️⃣ Abra o app do seu email (Gmail, Outlook, etc.)\n' +
        '2️⃣ Procure uma mensagem da sua distribuidora (EDP, CEMIG, etc.) com assunto *"Conta de energia"* ou *"Sua fatura"*\n' +
        '3️⃣ Abra o email e toque no *anexo PDF*\n' +
        '4️⃣ Toque em *"Baixar"* ou *"Salvar"*\n' +
        `5️⃣ Volte aqui e toque no ${E.clipe} (clipe) para enviar o arquivo\n\n` +
        `${E.lampada} *Dica:* Se não encontrar o email, verifique a pasta *Spam* ou *Promoções*.\n\n` +
        `${E.hourglass} Aguardo sua fatura!`
      );
    } else if (isPC) {
      await this.prisma.conversaWhatsapp.update({
        where: { id: conversa.id },
        data: { estado: 'AGUARDANDO_FOTO_FATURA', contadorFallback: 0 },
      });
      await this.sender.enviarMensagem(telefone,
        `${E.pc} *Baixar a fatura pelo computador:*\n\n` +
        '1️⃣ Abra seu email no navegador (gmail.com, outlook.com, etc.)\n' +
        '2️⃣ Procure uma mensagem da distribuidora com assunto *"Conta de energia"* ou *"Sua fatura"*\n' +
        '3️⃣ Abra o email e clique no *anexo PDF*\n' +
        '4️⃣ Clique em *"Baixar"* - o arquivo vai para a pasta *Downloads*\n' +
        `5️⃣ Volte aqui no WhatsApp Web, clique no ${E.clipe} (clipe) e selecione o arquivo baixado\n\n` +
        `${E.lampada} *Dica:* Não precisa imprimir! Pode enviar direto o PDF.\n\n` +
        `${E.hourglass} Aguardo sua fatura!`
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
        nome: 'EDP Espírito Santo',
        link: 'https://www.edp.com.br/espirito-santo/para-voce/segunda-via-de-conta',
        passos: `1️⃣ Acesse o link acima\n2️⃣ Clique em *"Acessar"* ou *"Entrar"*\n3️⃣ Informe seu CPF e senha\n4️⃣ Vá em *"Faturas"* â†’ *"2Âª Via"*\n5️⃣ Baixe o PDF da fatura mais recente\n6️⃣ Envie aqui para mim ${E.clipe}`,
      },
      'CEMIG': {
        nome: 'CEMIG',
        link: 'https://atende.cemig.com.br',
        passos: `1️⃣ Acesse o link acima\n2️⃣ Faça login com CPF e senha\n3️⃣ Clique em *"Faturas"*\n4️⃣ Selecione a última fatura\n5️⃣ Baixe o PDF\n6️⃣ Envie aqui para mim ${E.clipe}`,
      },
      'COPEL': {
        nome: 'COPEL',
        link: 'https://www.copel.com/hpcweb/portal-atendimento',
        passos: `1️⃣ Acesse o link acima\n2️⃣ Faça login na Agência Virtual\n3️⃣ Clique em *"2Âª Via de Conta"*\n4️⃣ Baixe o PDF\n5️⃣ Envie aqui para mim ${E.clipe}`,
      },
      'LIGHT': {
        nome: 'LIGHT',
        link: 'https://www.light.com.br/para-voce/segunda-via',
        passos: `1️⃣ Acesse o link acima\n2️⃣ Informe seu CPF\n3️⃣ Selecione a fatura\n4️⃣ Baixe o PDF\n5️⃣ Envie aqui para mim ${E.clipe}`,
      },
    };

    // Mapeamento por número (fallback texto: usuário digita 1, 2, 3, 4, 5)
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
        `${E.pc} *${dist.nome} - Como baixar sua fatura:*\n\n` +
        `${E.link} ${dist.link}\n\n` +
        `${dist.passos}\n\n` +
        `${E.lampada} *Dica extra:* Aproveite o acesso e cadastre nosso email *faturas@cooperebr.com.br* como 2Âº destinatário para receber sua fatura automaticamente todo mês!\n\n` +
        `${E.hourglass} Quando tiver o PDF, envie aqui!`
      );
    } else {
      // Distribuidora não mapeada
      await this.prisma.conversaWhatsapp.update({
        where: { id: conversa.id },
        data: { estado: 'AGUARDANDO_FOTO_FATURA', contadorFallback: 0 },
      });
      await this.sender.enviarMensagem(telefone,
        `${E.pc} Para baixar sua fatura:\n\n` +
        `1️⃣ Acesse o site ou app da sua distribuidora\n` +
        `2️⃣ Faça login na Área do Cliente\n` +
        `3️⃣ Busque por *"2Âª Via"* ou *"Faturas"*\n` +
        `4️⃣ Baixe o PDF da fatura mais recente\n` +
        `5️⃣ Envie aqui para mim ${E.clipe}\n\n` +
        `Precisa de ajuda específica? Digite o nome da sua distribuidora.`
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
      await this.sender.enviarMensagem(telefone, `${E.camera} Envie uma foto ou PDF da sua conta de energia para iniciarmos sua simulação!`);
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
      `${E.msgBox} Sua mensagem foi recebida! Nossa equipe entrará em contato em breve.${complementoSuporte}`,
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
          `${E.sino} Solicitação de suporte via WhatsApp:\nTelefone: ${telefone}\nMensagem: ${corpo}`,
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
      `${E.pessoa} *Encaminhando para atendente humano...*\n\nUm de nossos especialistas responderá em breve. Horário de atendimento: Seg-Sex 8h-18h.\n\nDescreva sua dúvida ou aguarde.`,
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
      // Após 3 mensagens não compreendidas â†’ encaminhar para atendente
      await this.prisma.conversaWhatsapp.update({
        where: { id: conversa.id },
        data: { estado: 'AGUARDANDO_ATENDENTE', contadorFallback: 0 },
      });
      await this.sender.enviarMensagem(
        telefone,
        `${E.pensar} Parece que estou com dificuldade em entender. Vou te conectar com um atendente humano!\n\n${E.pessoa} Aguarde, um especialista responderá em breve.`,
      );
    } else {
      await this.sender.enviarMensagem(telefone, `Não entendi. ${E.aviso} Responda com o numero da opcao ou digite *menu* para voltar ao inicio.`);
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

    // Armazenar midia e perguntar proprietario da fatura antes do OCR
    await this.prisma.conversaWhatsapp.update({
      where: { id: conversa.id },
      data: {
        estado: 'AGUARDANDO_PROPRIETARIO_FATURA',
        dadosTemp: { mediaBase64, mimeType } as any,
      },
    });

    await this.sender.enviarMensagem(
      telefone,
      `${E.doc} Recebi sua fatura!\n\nEssa conta de energia e:\n1\uFE0F\u20E3 Minha (quero me cadastrar)\n2\uFE0F\u20E3 De outra pessoa (quero cadastrar um amigo)`,
    );
  }

  // --- Proprietario da fatura ---------------------------

  private async handleAguardandoProprietarioFatura(msg: MensagemRecebida, conversa: any): Promise<void> {
    const { telefone } = msg;
    const corpo = (msg.corpo ?? '').trim();
    const dadosTemp = (conversa.dadosTemp ?? {}) as Record<string, unknown>;

    if (corpo === '1') {
      // Fatura propria - processar OCR
      await this.processarOcrFatura(telefone, conversa, dadosTemp);
      return;
    }

    if (corpo === '2') {
      // Fatura de outra pessoa - pedir nome + telefone
      await this.prisma.conversaWhatsapp.update({
        where: { id: conversa.id },
        data: {
          estado: 'AGUARDANDO_NOME_TERCEIRO',
          dadosTemp: { ...dadosTemp, faturaParaTerceiro: true } as any,
        },
      });
      await this.sender.enviarMensagem(
        telefone,
        `${E.pessoa} Qual o *nome completo* da pessoa que voce quer cadastrar?`,
      );
      return;
    }

    await this.incrementarFallback(conversa, telefone,
      'Responda *1* (minha conta) ou *2* (de outra pessoa).',
    );
  }

  private async handleAguardandoNomeTerceiro(msg: MensagemRecebida, conversa: any): Promise<void> {
    const { telefone } = msg;
    const corpo = (msg.corpo ?? '').trim();
    const dadosTemp = (conversa.dadosTemp ?? {}) as Record<string, unknown>;

    if (!corpo || corpo.length < 3) {
      await this.sender.enviarMensagem(telefone, 'Por favor, informe o nome completo da pessoa:');
      return;
    }

    await this.prisma.conversaWhatsapp.update({
      where: { id: conversa.id },
      data: {
        estado: 'AGUARDANDO_TELEFONE_TERCEIRO',
        dadosTemp: { ...dadosTemp, nomeTerceiro: corpo } as any,
      },
    });
    await this.sender.enviarMensagem(telefone, `${E.telefone} Qual o telefone dessa pessoa? (com DDD, ex: 11999998888)`);
  }

  private async handleAguardandoTelefoneTerceiro(msg: MensagemRecebida, conversa: any): Promise<void> {
    const { telefone } = msg;
    const corpo = (msg.corpo ?? '').trim().replace(/\D/g, '');
    const dadosTemp = (conversa.dadosTemp ?? {}) as Record<string, unknown>;

    if (corpo.length < 10 || corpo.length > 13) {
      await this.sender.enviarMensagem(telefone, 'Telefone invalido. Informe com DDD (ex: 11999998888):');
      return;
    }

    // Salvar dados do terceiro e processar OCR
    const dadosAtualizados = { ...dadosTemp, telefoneTerceiro: corpo };
    await this.prisma.conversaWhatsapp.update({
      where: { id: conversa.id },
      data: { dadosTemp: dadosAtualizados as any },
    });
    await this.processarOcrFatura(telefone, conversa, dadosAtualizados);
  }

  /**
   * Processa OCR da fatura armazenada em dadosTemp e mostra dados para confirmacao.
   * Usado tanto para fatura propria quanto de terceiro.
   */
  private async processarOcrFatura(
    telefone: string,
    conversa: any,
    dadosTemp: Record<string, unknown>,
  ): Promise<void> {
    const mediaB64 = String(dadosTemp.mediaBase64 ?? '');
    const mime = String(dadosTemp.mimeType ?? '');

    await this.sender.enviarMensagem(telefone, `${E.doc} Analisando os dados da fatura... Aguarde um momento. ${E.hourglass}`);

    const tipoArquivo = mime === 'application/pdf' ? 'pdf' : 'imagem';
    let dadosExtraidos: Record<string, unknown>;
    try {
      dadosExtraidos = await this.faturasService.extrairOcr(mediaB64, tipoArquivo) as unknown as Record<string, unknown>;
    } catch {
      await this.sender.enviarMensagem(
        telefone,
        `Não consegui identificar os dados da sua fatura. Por favor, envie uma foto mais nítida ou o PDF da fatura de energia. ${E.camera}`,
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
        `O arquivo enviado não parece ser uma fatura de energia. Por favor, envie a fatura da concessionária (PDF ou foto legível). ${E.doc}`,
      );
      return;
    }

    // Salvar dados na conversa
    await this.prisma.conversaWhatsapp.update({
      where: { id: conversa.id },
      data: {
        estado: 'AGUARDANDO_CONFIRMACAO_OCR',
        dadosTemp: { ...dadosExtraidos, ...(dadosTemp.faturaParaTerceiro ? { faturaParaTerceiro: true, nomeTerceiro: dadosTemp.nomeTerceiro, telefoneTerceiro: dadosTemp.telefoneTerceiro } : {}) } as any,
      },
    });

    // Montar mensagem de confirmação
    const historico = (dadosExtraidos.historicoConsumo as Array<{ mesAno: string; consumoKwh: number; valorRS: number }>) ?? [];
    const endereco = String(dadosExtraidos.enderecoInstalacao ?? '');
    const numeroUC = String(dadosExtraidos.numeroUC ?? '-');
    const tipoFornecimento = String(dadosExtraidos.tipoFornecimento ?? '');
    const tensao = String(dadosExtraidos.tensaoNominal ?? '');

    let msg_confirmacao = `${E.grafico} *Dados extraídos da sua fatura:*\n\n`;
    msg_confirmacao += `${E.pessoa} ${titular}\n`;
    if (endereco) msg_confirmacao += `${E.mapPin} ${endereco}\n`;
    msg_confirmacao += `${E.plugue} UC: ${numeroUC}\n`;
    if (tipoFornecimento) msg_confirmacao += `${E.bolt} ${tipoFornecimento}${tensao ? ` (${tensao})` : ''}\n`;

    if (historico.length > 0) {
      msg_confirmacao += `\n${E.calendario} *Histórico de consumo:*\n`;
      for (const h of historico) {
        const valor = Number(h.valorRS);
        const valorStr = valor > 0 ? ` - R$ ${valor.toFixed(2).replace('.', ',')}` : '';
        msg_confirmacao += `${h.mesAno}: ${h.consumoKwh} kWh${valorStr}\n`;
      }
    }

    // Calcular media
    const kwhs = historico.map(h => h.consumoKwh).filter(v => v > 0);
    const mediaKwh = kwhs.length > 0 ? Math.round(kwhs.reduce((a, b) => a + b, 0) / kwhs.length) : Number(dadosExtraidos.consumoAtualKwh ?? 0);
    msg_confirmacao += `\n${E.grafico} Media: *${mediaKwh} kWh/mes*\n`;

    msg_confirmacao += `\nEsta correto?\n1\uFE0F\u20E3 Sim, pode simular\n2\uFE0F\u20E3 Algum dado esta errado`;

    await this.sender.enviarMensagem(telefone, msg_confirmacao);
  }

  // ─── AGUARDANDO_CONFIRMACAO_OCR: confirmar dados extraidos antes de simular ───

  private async handleAguardandoConfirmacaoOcr(msg: MensagemRecebida, conversa: any): Promise<void> {
    const { telefone } = msg;
    const corpo = (msg.corpo ?? '').trim();
    const dadosTemp = conversa.dadosTemp as Record<string, unknown>;

    // Se mandou nova imagem/PDF, reprocessar
    if ((msg.tipo === 'imagem' || msg.tipo === 'documento') && msg.mediaBase64) {
      await this.prisma.conversaWhatsapp.update({
        where: { id: conversa.id },
        data: {
          estado: 'AGUARDANDO_PROPRIETARIO_FATURA',
          dadosTemp: { mediaBase64: msg.mediaBase64, mimeType: msg.mimeType } as any,
        },
      });
      await this.sender.enviarMensagem(
        telefone,
        `${E.doc} Nova fatura recebida!

Essa conta de energia e:
1️⃣ Minha (quero me cadastrar)
2️⃣ De outra pessoa (quero cadastrar um amigo)`,
      );
      return;
    }

    if (corpo === '1') {
      // Dados corretos - ir para simulacao
      await this.prisma.conversaWhatsapp.update({
        where: { id: conversa.id },
        data: { estado: 'AGUARDANDO_CONFIRMACAO_DADOS', dadosTemp: dadosTemp as any },
      });
      await this.handleConfirmacaoDados({ ...msg, corpo: 'OK' }, { ...conversa, estado: 'AGUARDANDO_CONFIRMACAO_DADOS', dadosTemp });
      return;
    }

    if (corpo === '2') {
      await this.prisma.conversaWhatsapp.update({
        where: { id: conversa.id },
        data: { estado: 'AGUARDANDO_FOTO_FATURA', contadorFallback: 0 },
      });
      await this.sender.enviarMensagem(
        telefone,
        `${E.camera} Por favor, envie novamente a foto da sua fatura de energia com melhor qualidade, ou envie o PDF.`,
      );
      return;
    }

    await this.incrementarFallback(conversa, telefone,
      'Responda *1* (dados corretos) ou *2* (dados errados).',
    );
  }

  // â”€â”€â”€ PASSO 2: Confirmação dos dados â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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
      // Verificar se distribuidora tem usinas disponíveis
      const distribuidoraOCR = String(dadosTemp.distribuidora ?? '');
      if (distribuidoraOCR) {
        const todasUsinas = await this.prisma.usina.findMany({
          where: { statusHomologacao: { in: ['HOMOLOGADA', 'EM_PRODUCAO'] } },
          select: { distribuidora: true },
        });
        const distribNorm = distribuidoraOCR.toLowerCase().replace(/[^a-z0-9]/g, ' ').trim();
        const distribTokens = distribNorm.split(/\s+/).filter((t: string) => t.length > 2);
        this.logger.log(`[BOT] Distribuidora OCR: "${distribuidoraOCR}" | tokens: ${distribTokens.join(',')}`);
        const usinasNaArea = todasUsinas.filter((u: { distribuidora: string | null }) => {
          if (!u.distribuidora) return false;
          const uNorm = u.distribuidora.toLowerCase().replace(/[^a-z0-9]/g, ' ').trim();
          return distribTokens.some((t: string) => uNorm.includes(t)) || uNorm.split(/\s+/).some((t: string) => t.length > 2 && distribNorm.includes(t));
        }).length;

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
            `${E.solar} Fizemos sua simulação!\n\n` +
            `${E.grafico} Sua fatura atual: R$ ${fmt(valorFatura)}\n` +
            `${E.coracao} Economia estimada com CoopereBR: *R$ ${fmt(economiaEstimada)}/mês*\n` +
            `${E.calendario} Economia anual: *R$ ${fmt(economiaAnual)}*\n\n` +
            `Ainda não temos parceiro na área da *${distribuidoraOCR}*, mas estamos expandindo!\n\n` +
            `Quer que te avisemos quando chegarmos na sua região?\n` +
            `1️⃣ Sim, quero!\n2️⃣ Não por enquanto`,
          );
          return;
        }
      }

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
          `Houve um erro ao calcular sua simulação. Tente novamente ou entre em contato conosco. ${E.sorriso}`,
        );
        return;
      }

      if (!resultado) {
        await this.sender.enviarMensagem(
          telefone,
          `Não foi possível gerar uma simulação com os dados extraídos. Tente enviar outra fatura. ${E.doc}`,
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

      let resposta = `${E.muda} *Sua simulação CoopereBR:*\n\n`;
      resposta += `${E.grafico} Fatura média atual: R$ ${fmt(valorFaturaMedia)}\n`;
      resposta += `${E.coracao} Com a CoopereBR: R$ ${fmt(valorComDesconto)} (-${descontoPercentual.toFixed(0)}%)\n`;
      resposta += `${E.dolar} Economia mensal: R$ ${fmt(economiaMensal)}\n`;
      resposta += `${E.calendario} Economia anual: R$ ${fmt(economiaAnual)}\n`;
      if (mesesEconomia > 0) {
        resposta += `${E.presente} Equivale a ${mesesEconomia.toFixed(1).replace('.', ',')} meses de energia grátis!\n`;
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
        `${E.ok} Mês ${mesAno} atualizado: ${kwh} kWh - R$ ${valor.toFixed(2).replace('.', ',')}\n\nOutro dado a corrigir? Ou responda *OK* para gerar a simulação.`,
      );
      return;
    }

    // Não entendeu
    await this.sender.enviarMensagem(
      telefone,
      `Não entendi. ${E.aviso} Responda *OK* se estiver tudo certo, ou corrija no formato:\n_02/26 350 kwh R$ 287,50_`,
    );
  }

  // â”€â”€â”€ PASSO 3: Confirmação da proposta â†’ envia PDF â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

    // Fluxo convite: "2" ou "NAO" â†’ encerrar
    if (dadosTempCheck.codigoIndicacao && (corpo === '2' || corpo.includes('NAO') || corpo.includes('NÃƒO'))) {
      await this.finalizarConversa(conversa.id);
      await this.sender.enviarMensagem(telefone, `Tudo bem! Se mudar de ideia, estamos aqui. ${E.sorriso}`);
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
    const numeroUC = String(dadosTemp.numeroUC ?? '-');

    await this.sender.enviarMensagem(telefone, `${E.doc} Gerando sua proposta em PDF... Aguarde um momento. ${E.hourglass}`);

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

        let pdfTexto = `${E.prancheta} *PROPOSTA COOPEREBR*\n`;
        pdfTexto += `â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”\n\n`;
        pdfTexto += `${E.pessoa} *${titular}*\n`;
        if (endereco) pdfTexto += `${E.mapPin} ${endereco}\n`;
        pdfTexto += `${E.plugue} UC: ${numeroUC}\n\n`;
        pdfTexto += `${E.grafico} *Dados da simulação:*\n`;
        pdfTexto += `• Consumo considerado: ${Math.round(r.kwhContrato)} kWh/mês\n`;
        pdfTexto += `• Desconto: ${r.descontoPercentual.toFixed(1)}%\n`;
        pdfTexto += `• Economia mensal: R$ ${fmt(r.economiaMensal)}\n`;
        pdfTexto += `• Economia anual: R$ ${fmt(r.economiaAnual)}\n\n`;
        pdfTexto += `â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”\n`;
        pdfTexto += `_Proposta válida por 30 dias_`;

        await this.sender.enviarMensagem(telefone, pdfTexto);
      }
    } catch (err) {
      this.logger.error(`Erro ao gerar proposta: ${err.message}`);
      await this.sender.enviarMensagem(
        telefone,
        `Houve um erro ao gerar a proposta. Nossa equipe entrará em contato. ${E.sorriso}`,
      );
    }

    // Confirmação de dados para cadastro
    let dadosCadastro = `${E.ok} *Seus dados para cadastro:*\n\n`;
    dadosCadastro += `${E.pessoa} ${titular}\n`;
    if (endereco) dadosCadastro += `${E.mapPin} ${endereco}\n`;
    dadosCadastro += `${E.plugue} UC: ${numeroUC}\n\n`;
    dadosCadastro += `Está correto? Responda *CONFIRMO* para prosseguir\n`;
    dadosCadastro += `ou me diga o que precisa corrigir.`;

    await this.prisma.conversaWhatsapp.update({
      where: { id: conversa.id },
      data: { estado: 'AGUARDANDO_CONFIRMACAO_CADASTRO' },
    });

    await this.sender.enviarMensagem(telefone, dadosCadastro);
  }

  // â”€â”€â”€ PASSO 4: Confirmação do cadastro â†’ cria cooperado â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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
        `Você já está em nosso sistema! Nossa equipe entrará em contato em breve. ${E.sorriso}`,
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

    // Notificar equipe sobre novo lead
    this.notificarEquipeNovoLead({
      nome: titular || cooperado.nomeCompleto,
      telefone: telefoneNorm,
      email: emailInformado,
      valorFatura: dadosTemp.valorFatura as number | undefined,
      economiaMensal: dadosTemp.economiaMensal as number | undefined,
    }).catch(() => {});

    // Criar UC se tiver dados
    const numeroUC = String(dadosTemp.numeroUC ?? '');
    if (numeroUC && numeroUC !== '-') {
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
            `${E.festa} Boa notícia! ${nomeIndicado} acabou de completar o cadastro através do seu convite! Quando ele pagar a primeira fatura, você receberá seu benefício automaticamente. Obrigado por indicar! ${E.orar}`,
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
                `${E.prancheta} Novo cadastro via indicação: ${nomeIndicado} | Tel: ${telefoneNorm} | Indicado por: ${indicador.nomeCompleto?.trim() || 'Cooperado'}. Acompanhe o processo no painel.`,
              ).catch(() => {});
            }
          }
        }
      } catch (err) {
        this.logger.warn(`Não foi possível registrar indicação: ${err.message}`);
      }
    }

    // Pre-cadastro concluido - perguntar sobre indicacao
    await this.prisma.conversaWhatsapp.update({
      where: { id: conversa.id },
      data: { estado: 'AGUARDANDO_INDICACAO' },
    });

    await this.sender.enviarMensagem(
      telefone,
      `${E.festa} Pre-cadastro realizado! A equipe CoopereBR entrara em contato em breve.\n\nVoce gostaria de indicar um amigo agora?\n1\uFE0F\u20E3 Sim, quero indicar\n2\uFE0F\u20E3 Nao, obrigado`,
    );
  }


  // ─── Notificacao equipe novo lead ────────────────────────────────

  private async notificarEquipeNovoLead(dados: {
    nome: string;
    telefone: string;
    email?: string;
    valorFatura?: number;
    economiaMensal?: number;
  }): Promise<void> {
    const numerosEquipe = (process.env.NUMEROS_EQUIPE ?? '').split(',').filter(Boolean);
    if (numerosEquipe.length === 0) return;

    const linhas = [
      `*Novo lead CoopereBR!* ${E.festa}`,
      `Nome: ${dados.nome}`,
      `Telefone: ${dados.telefone}`,
    ];
    if (dados.email) linhas.push(`Email: ${dados.email}`);
    if (dados.valorFatura) linhas.push(`Valor fatura: R$ ${Number(dados.valorFatura).toFixed(2)}`);
    if (dados.economiaMensal) linhas.push(`Economia estimada: R$ ${Number(dados.economiaMensal).toFixed(2)}/mes`);
    linhas.push('Origem: Bot WhatsApp');

    const texto = linhas.join('\n');

    for (const numero of numerosEquipe) {
      await this.sender.enviarMensagem(numero.trim(), texto).catch((err) => {
        this.logger.warn(`Erro ao notificar equipe ${numero}: ${err.message}`);
      });
    }
  }

  // ─── Indicacao pos-cadastro ──────────────────────────────────────

  private async handleAguardandoIndicacao(msg: MensagemRecebida, conversa: any): Promise<void> {
    const { telefone } = msg;
    const corpo = (msg.corpo ?? '').trim();

    if (corpo === '1') {
      await this.prisma.conversaWhatsapp.update({
        where: { id: conversa.id },
        data: { estado: 'RECEBENDO_CONTATOS', dadosTemp: { ...(conversa.dadosTemp ?? {}), contatosSalvos: 0 } as any },
      });
      await this.sender.enviarMensagem(
        telefone,
        `${E.handshake} Que otimo! Abra seus contatos, segure o nome do amigo e toque em *Compartilhar*. Mande o contato aqui.\n\nPode enviar varios! Quando terminar, digite *pronto*.`,
      );
      return;
    }

    if (corpo === '2') {
      await this.finalizarConversa(conversa.id);
      await this.sender.enviarMensagem(
        telefone,
        `Tudo bem! Quando quiser indicar, e so digitar *indicar* aqui. Ate logo! ${E.oi}`,
      );
      return;
    }

    await this.incrementarFallback(conversa, telefone,
      'Responda *1* (sim, quero indicar) ou *2* (nao, obrigado).',
    );
  }

  private async handleRecebendoContatos(msg: MensagemRecebida, conversa: any): Promise<void> {
    const { telefone } = msg;
    const corpo = (msg.corpo ?? '').trim().toLowerCase();
    const dadosTemp = (conversa.dadosTemp ?? {}) as Record<string, unknown>;
    let contatosSalvos = Number(dadosTemp.contatosSalvos ?? 0);

    // Se digitou 'pronto', encerrar
    if (corpo === 'pronto') {
      await this.finalizarConversa(conversa.id);
      if (contatosSalvos > 0) {
        await this.sender.enviarMensagem(
          telefone,
          `${E.festa} ${contatosSalvos} contato(s) salvo(s)! Vamos enviar um convite para cada um. Obrigado por indicar! ${E.coracao}`,
        );
      } else {
        await this.sender.enviarMensagem(
          telefone,
          `Tudo bem! Quando quiser indicar, e so digitar *indicar* aqui. Ate logo! ${E.oi}`,
        );
      }
      return;
    }

    // Processar contato compartilhado
    if (msg.tipo === 'contato' && msg.contatoNome && msg.contatoTelefone) {
      const nomeContato = msg.contatoNome;
      const telContato = msg.contatoTelefone.replace(/\D/g, '');

      // Salvar como lead na LeadExpansao
      try {
        await this.prisma.leadExpansao.create({
          data: {
            telefone: telContato,
            nomeCompleto: nomeContato,
            distribuidora: 'INDICACAO_WHATSAPP',
            status: 'AGUARDANDO',
          },
        });
      } catch (err) {
        this.logger.warn(`Erro ao salvar lead indicacao: ${err.message}`);
      }

      contatosSalvos++;
      await this.prisma.conversaWhatsapp.update({
        where: { id: conversa.id },
        data: { dadosTemp: { ...dadosTemp, contatosSalvos } as any },
      });

      await this.sender.enviarMensagem(
        telefone,
        `${E.ok} ${nomeContato} salvo! Envie mais contatos ou digite *pronto* para finalizar.`,
      );

      // Disparar mensagem de convite para o contato
      const nomeIndicador = String(dadosTemp.nomeInformado ?? dadosTemp.titular ?? 'Um amigo');
      await this.sender.enviarMensagem(
        telContato,
        `${E.oi} Ola ${nomeContato}! ${nomeIndicador} te convidou para conhecer a CoopereBR.\n\nCom a CoopereBR voce economiza ate 20% na conta de luz todo mes, sem investimento.\n\nQuer ver quanto economizaria? So manda a foto da sua conta de energia! ${E.bolt}`,
      ).catch(() => {});

      return;
    }

    // Se enviou texto que nao e 'pronto', tentar interpretar como nome+telefone manual
    await this.sender.enviarMensagem(
      telefone,
      `${E.seta} Compartilhe um contato do seu celular ou digite *pronto* para finalizar.`,
    );
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
      `Seu cadastro já foi recebido! ${E.sorriso} Nossa equipe entrará em contato em breve.\n\nSe quiser fazer uma nova simulação, envie outra conta de luz. ${E.camera}`,
    );
  }

  // â”€â”€â”€ Fluxo Convite (indicação) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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
      await this.sender.enviarMensagem(telefone, `Otimo! Envie uma foto da sua conta de luz (frente completa) ${E.camera}`);
      return;
    }

    if (corpo === '2' || corpo.toLowerCase().includes('nao') || corpo.toLowerCase().includes('não')) {
      await this.finalizarConversa(conversa.id);
      await this.sender.enviarMensagem(telefone, `Tudo bem! Se mudar de ideia, estamos aqui. ${E.sorriso}`);
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
      await this.sender.enviarMensagem(telefone, `Por favor, envie uma *foto* ou *PDF* da sua conta de energia eletrica. ${E.camera}`);
      return;
    }

    // Armazenar midia e perguntar proprietario da fatura antes do OCR
    await this.prisma.conversaWhatsapp.update({
      where: { id: conversa.id },
      data: {
        estado: 'AGUARDANDO_PROPRIETARIO_FATURA',
        dadosTemp: { ...dadosTemp, mediaBase64, mimeType } as any,
      },
    });

    await this.sender.enviarMensagem(
      telefone,
      `${E.doc} Recebi sua fatura!\n\nEssa conta de energia e:\n1\uFE0F\u20E3 Minha (quero me cadastrar)\n2\uFE0F\u20E3 De outra pessoa (quero cadastrar um amigo)`,
    );
  }

  // ─── Confirmacao de celular ───────────────────────────

  private async handleAguardandoConfirmacaoCelular(msg: MensagemRecebida, conversa: any): Promise<void> {
    const { telefone } = msg;
    const corpo = (msg.corpo ?? '').trim();
    const dadosTemp = (conversa.dadosTemp ?? {}) as Record<string, unknown>;

    if (corpo === '1') {
      // Celular correto - salvar e ir para confirmacao final
      const nome = String(dadosTemp.nomeInformado ?? dadosTemp.titular ?? '');
      const cpf = String(dadosTemp.cpfInformado ?? '');
      const emailInfo = String(dadosTemp.emailInformado ?? '');

      await this.prisma.conversaWhatsapp.update({
        where: { id: conversa.id },
        data: {
          estado: 'AGUARDANDO_CONFIRMACAO_CADASTRO',
          dadosTemp: { ...dadosTemp, celularConfirmado: telefone } as any,
        },
      });

      let confirmacao = `${E.ok} *Confirme seus dados:*\n\n`;
      confirmacao += `${E.pessoa} ${nome}\n`;
      confirmacao += `${E.doc} CPF: ${cpf}\n`;
      confirmacao += `${E.email} ${emailInfo}\n`;
      confirmacao += `${E.celular} ${telefone}\n\n`;
      confirmacao += `Tudo certo? Responda *CONFIRMO*`;

      await this.sender.enviarMensagem(telefone, confirmacao);
      return;
    }

    if (corpo === '2') {
      // Quer corrigir o celular
      await this.prisma.conversaWhatsapp.update({
        where: { id: conversa.id },
        data: {
          estado: 'AGUARDANDO_CELULAR_CORRETO',
          dadosTemp: dadosTemp as any,
        },
      });
      await this.sender.enviarMensagem(telefone, `${E.celular} Informe o numero correto com DDD (ex: 11999998888):`);
      return;
    }

    await this.incrementarFallback(conversa, telefone,
      'Responda *1* (celular correto) ou *2* (corrigir).',
    );
  }

  private async handleAguardandoCelularCorreto(msg: MensagemRecebida, conversa: any): Promise<void> {
    const { telefone } = msg;
    const corpo = (msg.corpo ?? '').trim().replace(/\D/g, '');
    const dadosTemp = (conversa.dadosTemp ?? {}) as Record<string, unknown>;

    if (corpo.length < 10 || corpo.length > 13) {
      await this.sender.enviarMensagem(telefone, 'Numero invalido. Informe com DDD (ex: 11999998888):');
      return;
    }

    const nome = String(dadosTemp.nomeInformado ?? dadosTemp.titular ?? '');
    const cpf = String(dadosTemp.cpfInformado ?? '');
    const emailInfo = String(dadosTemp.emailInformado ?? '');

    await this.prisma.conversaWhatsapp.update({
      where: { id: conversa.id },
      data: {
        estado: 'AGUARDANDO_CONFIRMACAO_CADASTRO',
        dadosTemp: { ...dadosTemp, celularConfirmado: corpo } as any,
      },
    });

    let confirmacao = `${E.ok} *Confirme seus dados:*\n\n`;
    confirmacao += `${E.pessoa} ${nome}\n`;
    confirmacao += `${E.doc} CPF: ${cpf}\n`;
    confirmacao += `${E.email} ${emailInfo}\n`;
    confirmacao += `${E.celular} ${corpo}\n\n`;
    confirmacao += `Tudo certo? Responda *CONFIRMO*`;

    await this.sender.enviarMensagem(telefone, confirmacao);
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

    await this.sender.enviarMensagem(telefone, `Obrigado, ${corpo}! ${E.doc} Qual o seu CPF? (apenas numeros, ex: 12345678900)`);
  }

  private async handleAguardandoCpf(msg: MensagemRecebida, conversa: any): Promise<void> {
    const { telefone } = msg;
    const corpo = (msg.corpo ?? '').trim().replace(/\D/g, '');

    if (corpo.length !== 11) {
      await this.sender.enviarMensagem(telefone, 'CPF invalido. Informe apenas numeros, 11 digitos (ex: 12345678900):');
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

    await this.sender.enviarMensagem(telefone, `${E.email} Qual o seu melhor email?`);
  }

  private async handleAguardandoEmail(msg: MensagemRecebida, conversa: any): Promise<void> {
    const { telefone } = msg;
    const corpo = (msg.corpo ?? '').trim().toLowerCase();

    if (!corpo.includes('@') || !corpo.includes('.')) {
      await this.sender.enviarMensagem(telefone, 'Email invalido. Informe um email valido (deve conter @ e .):');
      return;
    }

    const dadosTemp = (conversa.dadosTemp ?? {}) as Record<string, unknown>;
    const nome = String(dadosTemp.nomeInformado ?? dadosTemp.titular ?? '');
    const cpf = String(dadosTemp.cpfInformado ?? '');

    await this.prisma.conversaWhatsapp.update({
      where: { id: conversa.id },
      data: {
        estado: 'AGUARDANDO_CONFIRMACAO_CELULAR',
        dadosTemp: { ...dadosTemp, emailInformado: corpo } as any,
      },
    });

    await this.sender.enviarMensagem(
      telefone,
      `${E.celular} Confirmo seu celular como *${telefone}*?\n1\uFE0F\u20E3 Sim, esta correto\n2\uFE0F\u20E3 Nao, quero corrigir`,
    );
  }

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // ROTINA 1: Cadastro via QR Code / Propaganda
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

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
      corpo: `${E.oi} Olá! Bem-vindo à *CoopereBR* - energia solar compartilhada!\n\nEconomize até 20% na conta de luz sem investimento e sem obras.`,
      opcoes: [
        { id: '1', texto: `${E.muda} Conhecer a CoopereBR`, descricao: 'Saiba como funciona' },
        { id: '2', texto: `${E.dinheiro} Simular minha economia`, descricao: 'Calcule quanto vai economizar' },
        { id: '3', texto: `${E.pessoa} Falar com consultor`, descricao: 'Atendimento personalizado' },
      ],
    });
  }

  private async handleMenuQrPropaganda(msg: MensagemRecebida, conversa: any): Promise<void> {
    const { telefone } = msg;
    const corpo = this.respostaEfetiva(msg);

    if (corpo === '1' || corpo.toLowerCase().includes('conhecer')) {
      await this.sender.enviarMensagem(
        telefone,
        `${E.muda} *Como funciona a CoopereBR:*\n\n` +
        `${E.solar} Somos uma cooperativa de energia solar compartilhada\n` +
        `${E.lampada} Você recebe créditos de energia solar na sua conta de luz\n` +
        `${E.dinheiro} Economia de até *20%* todo mês - sem investimento\n` +
        `${E.prancheta} Sem obras, sem instalação, sem burocracia\n` +
        `${E.ciclo} Cancelamento sem multa a qualquer momento\n` +
        `${E.globo} Energia 100% limpa e sustentável\n\n` +
        'Quer saber exatamente quanto você vai economizar?',
      );

      await this.sender.enviarMenuComBotoes(telefone, {
        titulo: 'Próximo passo',
        corpo: 'O que deseja fazer?',
        opcoes: [
          { id: '2', texto: `${E.dinheiro} Simular minha economia` },
          { id: '4', texto: `${E.camera} Enviar minha fatura`, descricao: 'Simulação detalhada com OCR' },
          { id: '3', texto: `${E.pessoa} Falar com consultor` },
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
        `${E.dinheiro} Vamos simular sua economia!\n\nQual o *valor médio* da sua conta de luz? (ex: 350)`,
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
      await this.sender.enviarMensagem(telefone, `${E.camera} Envie uma *foto* ou *PDF* da sua conta de energia para uma simulação detalhada!`);
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
      `${E.muda} *Resultado da sua simulação:*\n\n` +
      `${E.grafico} Conta atual: R$ ${fmt(valor)}\n` +
      `${E.coracao} Com a CoopereBR: R$ ${fmt(valor - economiaMensal)} (-${descontoPercentual}%)\n` +
      `${E.dolar} *Economia mensal: R$ ${fmt(economiaMensal)}*\n` +
      `${E.calendario} *Economia anual: R$ ${fmt(economiaAnual)}*\n\n` +
      `Com sua conta de R$ ${fmt(valor)}, você economizaria cerca de *R$ ${fmt(economiaMensal)} por mês* (R$ ${fmt(economiaAnual)} por ano)! ${E.festa}`,
    );

    await this.sender.enviarMenuComBotoes(telefone, {
      titulo: 'Próximo passo',
      corpo: 'O que deseja fazer agora?',
      opcoes: [
        { id: '1', texto: `${E.ok} Quero me cadastrar` },
        { id: '2', texto: `${E.prancheta} Receber mais informações` },
        { id: '3', texto: `${E.x} Não tenho interesse` },
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
        `${E.festa} Ã“timo! Para finalizar seu cadastro, envie uma *foto* ou *PDF* da sua conta de energia.\n\nIsso nos ajuda a calcular os créditos ideais para você! ${E.camera}`,
      );
      return;
    }

    if (corpo === '2' || corpo.toLowerCase().includes('informaç') || corpo.toLowerCase().includes('informac')) {
      const baseUrl = process.env.FRONTEND_URL ?? 'http://localhost:3001';
      await this.sender.enviarMensagem(
        telefone,
        `${E.prancheta} *Benefícios da CoopereBR:*\n\n` +
        `${E.ok} Desconto de até 20% na conta de luz\n` +
        `${E.ok} Energia 100% solar e renovável\n` +
        `${E.ok} Sem investimento inicial\n` +
        `${E.ok} Sem obras ou instalação\n` +
        `${E.ok} Cancelamento sem multa\n` +
        `${E.ok} Créditos aplicados direto na sua conta\n` +
        `${E.ok} Acompanhe tudo pelo portal\n\n` +
        `${E.globo} Acesse nosso portal: ${baseUrl}\n\n` +
        `Quando estiver pronto, digite *cadastro* para iniciar! ${E.sorriso}`,
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
        `Tudo bem! Se mudar de ideia, é só nos mandar uma mensagem. Obrigado pelo interesse! ${E.coracao}`,
      );
      return;
    }

    await this.incrementarFallback(conversa, telefone,
      'Responda *1* (cadastrar), *2* (mais informações) ou *3* (sem interesse).',
    );
  }

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // ROTINA 2: Cooperado inadimplente abordado pelo sistema
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

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
      `Olá, ${nome}! ${E.coracao}\n\n` +
      `Notamos que sua fatura no valor de *R$ ${fmt(valor)}* com vencimento em *${dataFmt}* está em aberto.\n\n` +
      `Sabemos que imprevistos acontecem - estamos aqui para ajudar! ${E.handshake}`,
    );

    await this.sender.enviarMenuComBotoes(telefone, {
      titulo: 'Fatura em aberto',
      corpo: 'Como posso ajudar?',
      opcoes: [
        { id: '1', texto: `${E.prancheta} Ver detalhes da fatura` },
        { id: '2', texto: `${E.cartao} Negociar parcelamento` },
        { id: '3', texto: `${E.ok} Já paguei` },
      ],
    });
  }

  private async handleMenuInadimplente(msg: MensagemRecebida, conversa: any): Promise<void> {
    const { telefone } = msg;
    const corpo = this.respostaEfetiva(msg);
    const dadosTemp = (conversa.dadosTemp ?? {}) as Record<string, any>;

    if (corpo === '1' || corpo.toLowerCase().includes('detalhe')) {
      const fmt = (v: number) => Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      let detalhes = `${E.prancheta} *Detalhes da fatura:*\n\n`;
      detalhes += `${E.dinheiro} Valor: R$ ${fmt(dadosTemp.valor)}\n`;
      detalhes += `${E.calendario} Vencimento: ${dadosTemp.dataVencimento}\n`;

      if (dadosTemp.pixCopiaECola) {
        detalhes += `\n*Pague via PIX - Copia e Cola:*\n${dadosTemp.pixCopiaECola}\n`;
      }
      if (dadosTemp.linkPagamento) {
        detalhes += `\n${E.link} Link de pagamento: ${dadosTemp.linkPagamento}\n`;
      }

      detalhes += `\n_Dúvidas? Responda esta mensagem._`;
      await this.sender.enviarMensagem(telefone, detalhes);

      await this.sender.enviarMenuComBotoes(telefone, {
        titulo: 'O que deseja?',
        corpo: 'Posso ajudar com mais alguma coisa?',
        opcoes: [
          { id: '2', texto: `${E.cartao} Negociar parcelamento` },
          { id: '3', texto: `${E.ok} Já paguei` },
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
        `${E.cartao} *Opções de parcelamento:*\n\n` +
        `Podemos parcelar seu débito de R$ ${fmt(dadosTemp.valor)} sem juros:\n\n` +
        `• 2x de R$ ${fmt(valorParcela2x)}\n` +
        `• 3x de R$ ${fmt(valorParcela3x)}\n`,
      );

      await this.sender.enviarMenuComBotoes(telefone, {
        titulo: 'Parcelamento',
        corpo: 'Deseja prosseguir com o parcelamento?',
        opcoes: [
          { id: '1', texto: `${E.ok} Sim, quero parcelar` },
          { id: '2', texto: `${E.dinheiro} Prefiro pagar à vista` },
        ],
      });
      return;
    }

    if (corpo === '3' || corpo.toLowerCase().includes('paguei') || corpo.toLowerCase().includes('já paguei')) {
      await this.finalizarConversa(conversa.id);
      await this.sender.enviarMensagem(
        telefone,
        `${E.ok} Ã“timo! Verificaremos o pagamento em até 24h.\n\n` +
        `Caso precise de algo, entre em contato. Obrigado! ${E.coracao}`,
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
            data: { observacoesNegociacao: `Parcelamento 3x negociado via WhatsApp em ${new Date().toLocaleDateString('pt-BR')}` },
          });
        } catch (err) {
          this.logger.warn(`Erro ao atualizar cobrança com parcelamento: ${err.message}`);
        }
      }

      await this.finalizarConversa(conversa.id);
      await this.sender.enviarMensagem(
        telefone,
        `${E.ok} *Acordo de parcelamento gerado!*\n\n` +
        `${E.prancheta} Valor total: R$ ${fmt(dadosTemp.valor)}\n` +
        `${E.cartao} Parcelamento: 3x de R$ ${fmt(valorParcela)} sem juros\n\n` +
        `Nossa equipe enviará os boletos/PIX de cada parcela nos próximos dias.\n\n` +
        `Obrigado pela confiança! ${E.coracao}`,
      );
      return;
    }

    if (corpo === '2' || corpo.toLowerCase().includes('vista') || corpo.toLowerCase().includes('pagar')) {
      await this.prisma.conversaWhatsapp.update({
        where: { id: conversa.id },
        data: { estado: 'MENU_INADIMPLENTE', contadorFallback: 0 },
      });

      const fmt = (v: number) => Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      let texto = `${E.dinheiro} Para pagar à vista (R$ ${fmt(dadosTemp.valor)}):\n`;
      if (dadosTemp.pixCopiaECola) {
        texto += `\n*PIX Copia e Cola:*\n${dadosTemp.pixCopiaECola}\n`;
      }
      if (dadosTemp.linkPagamento) {
        texto += `\n${E.link} Link: ${dadosTemp.linkPagamento}\n`;
      }
      texto += `\nApós o pagamento, ele será confirmado em até 24h. ${E.coracao}`;
      await this.sender.enviarMensagem(telefone, texto);

      await this.finalizarConversa(conversa.id);
      return;
    }

    await this.incrementarFallback(conversa, telefone,
      'Responda *1* (sim, quero parcelar) ou *2* (prefiro pagar à vista).',
    );
  }

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // ROTINA 3: Novo membro indicado (fluxo de convite melhorado)
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

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
      `${E.oi} Olá! Você foi indicado por *${indicadorNome}* para conhecer a *CoopereBR*!\n\n` +
      `${E.muda} Economize na conta de luz com energia solar compartilhada - sem investimento e sem obras.`,
    );

    await this.sender.enviarMenuComBotoes(telefone, {
      titulo: 'Indicação CoopereBR',
      corpo: 'O que deseja fazer?',
      opcoes: [
        { id: '1', texto: `${E.muda} Conhecer os benefícios`, descricao: 'Saiba como funciona' },
        { id: '2', texto: `${E.dinheiro} Simular minha economia`, descricao: 'Veja quanto vai economizar' },
        { id: '3', texto: `${E.foguete} Iniciar cadastro agora`, descricao: 'Cadastro rápido express' },
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
        `${E.muda} *Benefícios da CoopereBR:*\n\n` +
        `${E.solar} Energia 100% solar e renovável\n` +
        `${E.dinheiro} Economia de até *20%* na conta de luz\n` +
        `${E.prancheta} Sem investimento inicial\n` +
        `${E.engrenagem} Sem obras ou instalação\n` +
        `${E.ciclo} Cancelamento sem multa\n` +
        `${E.grafico} Acompanhe seus créditos pelo portal\n\n` +
        `Como você foi indicado por *${dadosTemp.indicadorNome}*, terá atendimento prioritário! ${E.festa}`,
      );

      await this.sender.enviarMenuComBotoes(telefone, {
        titulo: 'Próximo passo',
        corpo: 'Deseja continuar?',
        opcoes: [
          { id: '2', texto: `${E.dinheiro} Simular minha economia` },
          { id: '3', texto: `${E.foguete} Iniciar cadastro agora` },
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
        `${E.dinheiro} Vamos simular sua economia!\n\nQual o *valor médio* da sua conta de luz? (ex: 350)`,
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
        `${E.foguete} *Cadastro Express!*\n\nVamos precisar de poucos dados. Qual é o seu *nome completo*?`,
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

    let msgFinal = `${E.festa} *Perfeito! Seu cadastro está em análise.*\n\n`;
    msgFinal += `${E.pessoa} ${nome}\n`;
    msgFinal += `${E.email} ${email}\n`;
    msgFinal += `${E.dinheiro} Economia estimada: R$ ${fmt(economiaMensal)}/mês\n\n`;
    if (indicadorNome) {
      msgFinal += `*${indicadorNome}* será notificado quando você for aprovado! ${E.festa}\n\n`;
    }
    msgFinal += `Nossa equipe entrará em contato em breve. Obrigado! ${E.coracao}`;

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
          `${E.festa} Boa notícia! *${nome}* acabou de completar o cadastro express através do seu convite!\n\n` +
          `Quando ele for aprovado e pagar a primeira fatura, você receberá seu benefício automaticamente. Obrigado por indicar! ${E.orar}`,
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
              `${E.prancheta} Novo cadastro express via indicação:\n${nome} | Tel: ${telefoneNorm} | Email: ${email}\nIndicado por: ${indicador.nomeCompleto?.trim() || 'Cooperado'}`,
            ).catch(() => {});
          }
        }
      }
    }
  }

  // â”€â”€â”€ LEAD FORA DA ÁREA: captura intenção â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

    // Extrair cidade/estado do endereço (melhor esforço)
    const partes = endereco.split(/[,-]/);
    const cidade = partes.length >= 2 ? partes[partes.length - 2]?.trim() : undefined;
    const estado = partes.length >= 1 ? partes[partes.length - 1]?.trim()?.substring(0, 2)?.toUpperCase() : undefined;

    if (corpo === '1') {
      // Salvar lead com intenção confirmada
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
        `${E.ok} *Pronto! Você será avisado assim que chegarmos na região da ${distribuidora}.*\n\n` +
        `Enquanto isso, que tal indicar amigos e vizinhos? Quanto mais demanda, mais rápido chegamos! ${E.foguete}\n\n` +
        `Obrigado pelo interesse na CoopereBR! ${E.coracao}`,
      );
      return;
    }

    if (corpo === '2') {
      // Salvar lead sem intenção (registro passivo)
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
        `Tudo bem! Se mudar de ideia, é só enviar outra fatura. ${E.sorriso}\n\nObrigado pelo interesse na CoopereBR! ${E.coracao}`,
      );
      return;
    }

    // Não entendeu
    await this.sender.enviarMensagem(
      telefone,
      'Por favor, responda:\n1️⃣ Sim, quero ser avisado\n2️⃣ Não por enquanto',
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
      // Enviar link de indicação
      const baseUrl = process.env.FRONTEND_URL ?? 'https://cooperebr.com.br';
      const link = `${baseUrl}/entrar?ref=${dadosTemp.codigoIndicacao}`;
      await this.sender.enviarMensagem(telefone,
        `${E.presente} *Seu link de indicação personalizado:*\n\n${link}\n\n` +
        `${E.celular} Compartilhe com amigos, familiares e colegas!\n\n` +
        `Quando seu indicado pagar a primeira fatura, você recebe seu benefício automaticamente. ${E.coracao}`
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
      await this.sender.enviarMensagem(telefone, 'Número inválido. Informe com DDD (ex: 27999991234):');
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
    await this.sender.enviarMensagem(telefone, `Agora envie a foto ou PDF da conta de luz de *${nome}* ${E.clipe}`);
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
      await this.sender.enviarMensagem(telefone, `Por favor, envie uma *foto* ou *PDF* da conta de energia do seu amigo. ${E.camera}`);
      return;
    }

    await this.sender.enviarMensagem(telefone, `${E.doc} Recebi! Analisando os dados... Aguarde um momento. ${E.hourglass}`);

    const tipoArquivo = mimeType === 'application/pdf' ? 'pdf' : 'imagem';
    let dadosExtraidos: Record<string, unknown>;
    try {
      dadosExtraidos = await this.faturasService.extrairOcr(mediaBase64!, tipoArquivo) as unknown as Record<string, unknown>;
    } catch {
      await this.sender.enviarMensagem(telefone, `Não consegui identificar os dados. Envie uma foto mais nítida ou o PDF da fatura. ${E.camera}`);
      return;
    }

    const consumoAtualKwh = Number(dadosExtraidos.consumoAtualKwh ?? 0);
    if (consumoAtualKwh <= 0) {
      await this.sender.enviarMensagem(telefone, `O arquivo não parece ser uma fatura de energia. Tente novamente. ${E.doc}`);
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
      resposta += `*R$ ${fmt(economiaMensal)}/mês* ${E.solar}\n\n`;
    } else {
      resposta += `com energia solar! ${E.solar}\n\n`;
    }
    resposta += `Confirma o cadastro?\n1️⃣ Sim, cadastrar\n2️⃣ Não por enquanto`;

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
        // Chamar endpoint de pré-cadastro internamente
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
        let msgAmigo = `${indicadorNome} te cadastrou na *CoopereBR*! ${E.solar}\n\n`;
        if (economiaMensal > 0) {
          msgAmigo += `Sua economia estimada é de *R$ ${fmt(economiaMensal)}/mês*.\n\n`;
        }
        msgAmigo += `Para confirmar, acesse:\n${link}\n\n`;
        msgAmigo += `O link é válido por 7 dias.`;

        await this.sender.enviarMensagem(proxyTelefone, msgAmigo).catch(err => {
          this.logger.warn(`Erro ao enviar WA para amigo proxy ${proxyTelefone}: ${err.message}`);
        });

        // Notificar cooperado
        await this.sender.enviarMensagem(telefone,
          `${E.ok} Pronto! Enviei o link para *${proxyNome}* confirmar.\n` +
          `Quando ele assinar, você receberá seu benefício!`
        );
      } catch (err) {
        this.logger.error(`Erro no cadastro proxy: ${err.message}`);
        await this.sender.enviarMensagem(telefone, `${E.x} Ocorreu um erro ao cadastrar. Tente novamente mais tarde.`);
      }

      await this.resetarConversa(telefone);
      return;
    }

    if (corpo === '2' || corpo.toLowerCase().includes('não') || corpo.toLowerCase().includes('nao')) {
      await this.sender.enviarMensagem(telefone, 'Tudo bem! Se quiser tentar depois, é só me avisar.');
      await this.resetarConversa(telefone);
      return;
    }

    await this.incrementarFallback(conversa, telefone,
      'Responda *1* (sim, cadastrar) ou *2* (não por enquanto).',
    );
  }

  // â”€â”€â”€ MENU FATURA: lista cobranças pendentes â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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
        `Não encontramos um cadastro vinculado a este número. ${E.confuso}\n\nSe você é cooperado, entre em contato pelo site cooperebr.com.br para atualizar seu telefone.`,
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
        `Olá, ${(cooperado.nomeCompleto?.trim() || 'Cooperado').split(' ')[0]}! ${E.sorriso}\n\nVocê não tem faturas pendentes no momento. Está tudo em dia! ${E.ok}`,
      );
      await this.resetarConversa(telefone);
      return;
    }

    // Pegar cobrança mais recente (A_VENCER ou VENCIDO - já filtrado pelo service)
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

    // Régua de urgência
    let cabecalho: string;
    if (diasParaVencer > 5) {
      cabecalho = `${E.ok} Sua fatura vence em ${diasParaVencer} dias`;
    } else if (diasParaVencer >= 2) {
      cabecalho = `${E.aviso} Atenção! Sua fatura vence em ${diasParaVencer} dias`;
    } else if (diasParaVencer === 1) {
      cabecalho = `${E.sino} Sua fatura vence *amanhã*!`;
    } else if (diasParaVencer === 0) {
      cabecalho = `${E.sirene} Sua fatura vence *hoje*!`;
    } else {
      cabecalho = `${E.x} Sua fatura está *vencida* há ${Math.abs(diasParaVencer)} dia(s)!`;
    }

    const statusLabel = cobranca.status === 'VENCIDO' ? `${E.aviso} VENCIDA` : `${E.calendario} A vencer`;

    let texto = `${E.coracao} *CoopereBR - Fatura ${mesStr}/${ano}*\n\n`;
    texto += `Olá, ${nome}! ${E.oi}\n\n`;
    texto += `${cabecalho}\n\n`;
    texto += `${statusLabel}\n`;
    texto += `${E.pessoa} ${cooperado.nomeCompleto?.trim() || 'Cooperado'}\n`;
    texto += `${E.calendario} Competência: ${mesStr}/${ano}\n`;
    texto += `${E.dinheiro} Valor: *R$ ${valor}*\n`;
    texto += `${E.calendario} Vencimento: ${dataVencStr}\n`;

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

  // â”€â”€â”€ RESPOSTA MENU FATURA: usuário escolheu opção do menu â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  private async handleRespostaMenuFatura(msg: MensagemRecebida, conversa: any): Promise<void> {
    const { telefone } = msg;
    const corpo = (msg.corpo ?? '').trim().toLowerCase();

    if (['voltar', 'sair', 'menu'].includes(corpo)) {
      await this.resetarConversa(telefone);
      const texto = await this.msg('boas_vindas', {}, `${E.oi} Olá! Sou o assistente da *CoopereBR*.\n\nPara começar, envie uma *foto* ou *PDF* da sua conta de energia elétrica e eu faço uma simulação de economia para você! ${E.camera}`);
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
          `${E.cartao} *PIX Copia e Cola:*\n\n\`${pixCopiaECola}\`\n\n_Copie o código acima e cole no app do seu banco._`,
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
          `${E.doc} *Boleto bancário:*\n\n${E.link} ${boletoUrl}\n\n_Acesse o link para visualizar e pagar._`,
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
        `${E.link} Acesse sua fatura no portal:\n${portalUrl}\n\n_Faça login com seu CPF e senha._`,
      );
    } else if (corpo.includes('extrato')) {
      const valorLiquido = Number(cobranca.valorLiquido).toFixed(2).replace('.', ',');
      const valorMulta = Number((cobranca as any).valorMulta ?? 0).toFixed(2).replace('.', ',');
      const valorJuros = Number((cobranca as any).valorJuros ?? 0).toFixed(2).replace('.', ',');
      const diasAtraso = Number((cobranca as any).diasAtraso ?? 0);
      const valorAtualizado = Number((cobranca as any).valorAtualizado ?? cobranca.valorLiquido).toFixed(2).replace('.', ',');

      let extrato = `${E.grafico} *Extrato da Fatura*\n\n`;
      extrato += `${E.dinheiro} Valor original: R$ ${valorLiquido}\n`;
      if (diasAtraso > 0) {
        extrato += `${E.calendario} Dias em atraso: ${diasAtraso}\n`;
        extrato += `${E.moeda} Multa: R$ ${valorMulta}\n`;
        extrato += `${E.moeda} Juros: R$ ${valorJuros}\n`;
        extrato += `${E.dinheiro} *Valor atualizado: R$ ${valorAtualizado}*\n`;
      }
      await this.sender.enviarMensagem(telefone, extrato);
    } else if (corpo.includes('comprovante') || corpo.includes('paguei') || corpo.includes('já paguei')) {
      await this.prisma.conversaWhatsapp.update({
        where: { id: conversa.id },
        data: { estado: 'AGUARDANDO_COMPROVANTE_PAGAMENTO' },
      });
      await this.sender.enviarMensagem(
        telefone,
        `${E.camera} Por favor, envie a *foto* ou *PDF* do comprovante de pagamento para confirmarmos.`,
      );
      return;
    } else {
      // Opção não reconhecida - reenviar menu
      await this.sender.enviarMenuComBotoes(telefone, {
        titulo: 'Opções de pagamento',
        corpo: `Nao entendi. ${E.aviso} Responda com o numero da opcao ou digite *menu* para voltar ao inicio.`,
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

  // â”€â”€â”€ COMPROVANTE DE PAGAMENTO â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  private async handleComprovantePagamento(msg: MensagemRecebida, conversa: any): Promise<void> {
    const { telefone, tipo } = msg;

    const isMidia = tipo === 'imagem' || tipo === 'documento';

    if (!isMidia) {
      await this.sender.enviarMensagem(
        telefone,
        `Por favor, envie a *foto* ou *PDF* do comprovante de pagamento. ${E.camera}`,
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
        `${E.prancheta} *Comprovante de pagamento recebido*\n\n${E.pessoa} ${nomeCooperado}\n${E.celular} ${telefone}\n\n_Verifique o comprovante e dê baixa na fatura._`,
      ).catch((err) => this.logger.warn(`Falha ao notificar admin: ${err.message}`));
    }

    // Confirmar ao cooperado
    await this.sender.enviarMensagem(
      telefone,
      `${E.ok} Comprovante recebido! Nossa equipe vai conferir e confirmar o pagamento. Obrigado! ${E.orar}`,
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

  // â”€â”€â”€ Atualização de Cadastro â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  private async handleAtualizacaoCadastro(msg: MensagemRecebida, conversa: any): Promise<void> {
    const { telefone } = msg;
    const corpo = this.respostaEfetiva(msg);
    const cooperadoId = conversa.cooperadoId;

    if (corpo === '1' || corpo.toLowerCase().includes('nome')) {
      await this.prisma.conversaWhatsapp.update({
        where: { id: conversa.id },
        data: { estado: 'AGUARDANDO_NOVO_NOME', contadorFallback: 0 },
      });
      await this.sender.enviarMensagem(telefone, `${E.nota} Digite seu *novo nome completo*:`);
      return;
    }
    if (corpo === '2' || corpo.toLowerCase().includes('email')) {
      await this.prisma.conversaWhatsapp.update({
        where: { id: conversa.id },
        data: { estado: 'AGUARDANDO_NOVO_EMAIL', contadorFallback: 0 },
      });
      await this.sender.enviarMensagem(telefone, `${E.email} Digite seu *novo email*:`);
      return;
    }
    if (corpo === '3' || corpo.toLowerCase().includes('telefone')) {
      await this.prisma.conversaWhatsapp.update({
        where: { id: conversa.id },
        data: { estado: 'AGUARDANDO_NOVO_TELEFONE', contadorFallback: 0 },
      });
      await this.sender.enviarMensagem(telefone, `${E.celular} Digite seu *novo número de telefone* (com DDD):`);
      return;
    }
    if (corpo === '4' || corpo.toLowerCase().includes('endereço') || corpo.toLowerCase().includes('cep')) {
      await this.prisma.conversaWhatsapp.update({
        where: { id: conversa.id },
        data: { estado: 'AGUARDANDO_NOVO_CEP', contadorFallback: 0 },
      });
      await this.sender.enviarMensagem(telefone, `${E.mapPin} Digite seu *novo CEP* (apenas números):`);
      return;
    }

    await this.incrementarFallback(conversa, telefone, 'Responda *1* (nome), *2* (email), *3* (telefone) ou *4* (endereço).');
  }

  private async handleAguardandoNovoNome(msg: MensagemRecebida, conversa: any): Promise<void> {
    const { telefone } = msg;
    const novoNome = this.respostaEfetiva(msg).trim();
    if (novoNome.length < 3) {
      await this.sender.enviarMensagem(telefone, `${E.aviso} Nome muito curto. Digite o nome completo:`);
      return;
    }
    await this.prisma.cooperado.update({
      where: { id: conversa.cooperadoId },
      data: { nomeCompleto: novoNome },
    });
    await this.sender.enviarMensagem(telefone, `${E.ok} *Nome* atualizado com sucesso para *${novoNome}*!`);
    await this.prisma.conversaWhatsapp.update({ where: { id: conversa.id }, data: { estado: 'MENU_COOPERADO' } });
  }

  private async handleAguardandoNovoEmail(msg: MensagemRecebida, conversa: any): Promise<void> {
    const { telefone } = msg;
    const novoEmail = this.respostaEfetiva(msg).trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(novoEmail)) {
      await this.sender.enviarMensagem(telefone, `${E.aviso} Email inválido. Digite um email válido (ex: nome@email.com):`);
      return;
    }
    await this.prisma.cooperado.update({
      where: { id: conversa.cooperadoId },
      data: { email: novoEmail },
    });
    await this.sender.enviarMensagem(telefone, `${E.ok} *Email* atualizado com sucesso para *${novoEmail}*!`);
    await this.prisma.conversaWhatsapp.update({ where: { id: conversa.id }, data: { estado: 'MENU_COOPERADO' } });
  }

  private async handleAguardandoNovoTelefone(msg: MensagemRecebida, conversa: any): Promise<void> {
    const { telefone } = msg;
    const novoTelefone = this.respostaEfetiva(msg).replace(/\D/g, '');
    if (novoTelefone.length < 10 || novoTelefone.length > 13) {
      await this.sender.enviarMensagem(telefone, `${E.aviso} Telefone inválido. Digite com DDD (ex: 11999998888):`);
      return;
    }
    await this.prisma.cooperado.update({
      where: { id: conversa.cooperadoId },
      data: { telefone: novoTelefone },
    });
    await this.sender.enviarMensagem(telefone, `${E.ok} *Telefone* atualizado com sucesso para *${novoTelefone}*!`);
    await this.prisma.conversaWhatsapp.update({ where: { id: conversa.id }, data: { estado: 'MENU_COOPERADO' } });
  }

  private async handleAguardandoNovoCep(msg: MensagemRecebida, conversa: any): Promise<void> {
    const { telefone } = msg;
    const novoCep = this.respostaEfetiva(msg).replace(/\D/g, '');
    if (novoCep.length !== 8) {
      await this.sender.enviarMensagem(telefone, `${E.aviso} CEP inválido. Digite 8 dígitos (ex: 01310100):`);
      return;
    }
    await this.prisma.cooperado.update({
      where: { id: conversa.cooperadoId },
      data: { cep: novoCep },
    });
    await this.sender.enviarMensagem(telefone, `${E.ok} *Endereço (CEP)* atualizado com sucesso para *${novoCep}*!`);
    await this.prisma.conversaWhatsapp.update({ where: { id: conversa.id }, data: { estado: 'MENU_COOPERADO' } });
  }

  // â”€â”€â”€ Atualização de Contrato â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  private async handleAtualizacaoContrato(msg: MensagemRecebida, conversa: any): Promise<void> {
    const { telefone } = msg;
    const corpo = this.respostaEfetiva(msg);
    const cooperadoId = conversa.cooperadoId;

    const contrato = await this.prisma.contrato.findFirst({
      where: { cooperadoId, status: 'ATIVO' as any },
      orderBy: { createdAt: 'desc' },
    });

    if (!contrato) {
      await this.sender.enviarMensagem(telefone, `${E.aviso} Nenhum contrato ativo encontrado.`);
      await this.prisma.conversaWhatsapp.update({ where: { id: conversa.id }, data: { estado: 'MENU_COOPERADO' } });
      return;
    }

    if (corpo === '1' || corpo.toLowerCase().includes('aumentar')) {
      await this.prisma.conversaWhatsapp.update({
        where: { id: conversa.id },
        data: { estado: 'AGUARDANDO_NOVO_KWH', dadosTemp: { contratoId: contrato.id, acao: 'aumentar' }, contadorFallback: 0 },
      });
      await this.sender.enviarMensagem(telefone,
        `${E.grafico} Seu contrato atual: *${contrato.kwhContratoMensal ?? 0} kWh/mês*\n\n` +
        `${E.setaCima} Digite o *novo valor em kWh* que deseja contratar (maior que o atual):`,
      );
      return;
    }

    if (corpo === '2' || corpo.toLowerCase().includes('diminuir')) {
      await this.prisma.conversaWhatsapp.update({
        where: { id: conversa.id },
        data: { estado: 'AGUARDANDO_NOVO_KWH', dadosTemp: { contratoId: contrato.id, acao: 'diminuir' }, contadorFallback: 0 },
      });
      await this.sender.enviarMensagem(telefone,
        `${E.grafico} Seu contrato atual: *${contrato.kwhContratoMensal ?? 0} kWh/mês*\n\n` +
        `${E.setaBaixo} Digite o *novo valor em kWh* que deseja contratar (menor que o atual):`,
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
          `${E.pausar} *Contrato suspenso via WhatsApp*\nCooperado: ${cooperado?.nomeCompleto?.trim() || 'Cooperado'}\nTelefone: ${telefone}\nContrato: ${contrato.id}`,
          { tipoDisparo: 'BOT_RESPOSTA' },
        );
      }
      await this.sender.enviarMensagem(telefone, `${E.pausar} Seu contrato foi *suspenso temporariamente*.\n\nPara reativar, entre em contato com nossa equipe.`);
      await this.prisma.conversaWhatsapp.update({ where: { id: conversa.id }, data: { estado: 'MENU_COOPERADO' } });
      return;
    }

    if (corpo === '4' || corpo.toLowerCase().includes('encerrar')) {
      await this.prisma.conversaWhatsapp.update({
        where: { id: conversa.id },
        data: { estado: 'CONFIRMAR_ENCERRAMENTO', dadosTemp: { contratoId: contrato.id }, contadorFallback: 0 },
      });
      await this.sender.enviarMensagem(telefone,
        `${E.x} *Tem certeza que deseja encerrar seu contrato?*\n\n` +
        'Esta ação não pode ser desfeita facilmente.\n\n' +
        '1️⃣ Sim, encerrar\n2️⃣ Não, voltar ao menu',
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
      await this.sender.enviarMensagem(telefone, `${E.aviso} Valor inválido. Digite um número válido de kWh (mínimo 50):`);
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
        `${E.ciclo} *Ajuste de kWh via WhatsApp*\nCooperado: ${cooperado?.nomeCompleto?.trim() || 'Cooperado'}\nAção: ${dados?.acao}\nNovo valor: ${valor} kWh\nContrato: ${contratoId}`,
        { tipoDisparo: 'BOT_RESPOSTA' },
      );
    }

    await this.sender.enviarMensagem(telefone, `${E.ok} Contrato atualizado para *${valor} kWh/mês*!\n\n_A alteração será refletida na próxima fatura._`);
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
          `${E.x} *Contrato encerrado via WhatsApp*\nCooperado: ${cooperado?.nomeCompleto?.trim() || 'Cooperado'}\nTelefone: ${telefone}\nContrato: ${dados?.contratoId}`,
          { tipoDisparo: 'BOT_RESPOSTA' },
        );
      }
      await this.sender.enviarMensagem(telefone, `${E.x} Seu contrato foi *encerrado*.\n\nAgradecemos por ter sido cooperado! Caso mude de ideia, entre em contato conosco.`);
      await this.prisma.conversaWhatsapp.update({ where: { id: conversa.id }, data: { estado: 'CONCLUIDO', dadosTemp: undefined } });
      return;
    }

    if (corpo === '2' || corpo.toLowerCase().includes('não') || corpo.toLowerCase().includes('voltar')) {
      await this.sender.enviarMensagem(telefone, `${E.like} Ok, seu contrato continua ativo!`);
      await this.prisma.conversaWhatsapp.update({ where: { id: conversa.id }, data: { estado: 'MENU_COOPERADO', dadosTemp: undefined } });
      return;
    }

    await this.incrementarFallback(conversa, telefone, 'Responda *1* para confirmar encerramento ou *2* para voltar.');
  }

  // â”€â”€â”€ NPS automático pós-cadastro â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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
          `${E.sorriso} Olá! Sua solicitação de adesão à CoopereBR foi recebida!\n\n` +
          'De 0 a 10, quanto você indicaria a CoopereBR para um amigo?\n' +
          '(Digite apenas o número)',
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
      await this.sender.enviarMensagem(telefone, 'Por favor, digite um número de 0 a 10.');
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

    await this.sender.enviarMensagem(telefone, `Obrigado pelo feedback! ${E.coracao} Isso nos ajuda a melhorar.`);
    await this.finalizarConversa(conversa.id);
  }

  private async finalizarConversa(id: string): Promise<void> {
    await this.prisma.conversaWhatsapp.update({
      where: { id },
      data: { estado: 'CONCLUIDO' },
    });
  }
}
