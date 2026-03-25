import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { FaturasService } from '../faturas/faturas.service';
import { MotorPropostaService } from '../motor-proposta/motor-proposta.service';
import { ConfigTenantService } from '../config-tenant/config-tenant.service';
import { IndicacoesService } from '../indicacoes/indicacoes.service';
import { WhatsappSenderService } from './whatsapp-sender.service';
import { ModeloMensagemService } from './modelo-mensagem.service';
import { WhatsappFluxoMotorService } from './whatsapp-fluxo-motor.service';

interface MensagemRecebida {
  telefone: string;
  tipo: 'texto' | 'imagem' | 'documento';
  corpo?: string;
  mediaBase64?: string;
  mimeType?: string;
}

@Injectable()
export class WhatsappBotService {
  private readonly logger = new Logger(WhatsappBotService.name);

  constructor(
    private prisma: PrismaService,
    private faturasService: FaturasService,
    private motorProposta: MotorPropostaService,
    private configTenant: ConfigTenantService,
    private indicacoes: IndicacoesService,
    private sender: WhatsappSenderService,
    private modelos: ModeloMensagemService,
    private fluxoMotor: WhatsappFluxoMotorService,
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

    if (['ajuda', 'duvida', 'dúvida', 'problema', 'erro', 'help'].includes(corpoLower)) {
      const texto = await this.msg('ajuda', {}, 'Estou aqui para ajudar! Para falar com nossa equipe, acesse: cooperebr.com.br\n\nOu envie a foto da sua conta de luz para gerar uma simulação gratuita! 📸');
      await this.sender.enviarMensagem(telefone, texto);
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
        case 'CONCLUIDO':
          await this.handleConcluido(msg);
          break;
        default:
          await this.handleInicial(msg, conversa);
      }
    } catch (err) {
      this.logger.error(`Erro ao processar mensagem de ${telefone}: ${err.message}`, err.stack);
      await this.sender.enviarMensagem(
        telefone,
        'Desculpe, ocorreu um erro ao processar sua mensagem. Tente novamente em alguns instantes ou envie outra foto da fatura. 😊',
      );
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
      const texto = await this.msg('boas_vindas', {}, '👋 Olá! Sou o assistente da *CoopereBR*.\n\nPara começar, envie uma *foto* ou *PDF* da sua conta de energia elétrica e eu faço uma simulação de economia para você! 📸');
      await this.sender.enviarMensagem(telefone, texto);
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

    if (corpo !== 'SIM') {
      await this.sender.enviarMensagem(
        telefone,
        'Responda *SIM* para receber a proposta em PDF, ou *cancelar* para recomeçar.',
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
    const titular = String(dadosTemp.titular ?? '');
    const endereco = String(dadosTemp.enderecoInstalacao ?? '');
    const cidade = String(dadosTemp.cidade ?? '');
    const estado = String(dadosTemp.estado ?? '');
    const documento = String(dadosTemp.documento ?? '');

    if (cooperado) {
      await this.prisma.cooperado.update({
        where: { id: cooperado.id },
        data: {
          nomeCompleto: titular || cooperado.nomeCompleto,
          documento: documento || cooperado.documento,
        },
      });
    } else {
      cooperado = await this.prisma.cooperado.create({
        data: {
          nomeCompleto: titular || `Lead WhatsApp ${telefoneNorm}`,
          cpf: documento || '',
          email: '',
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
