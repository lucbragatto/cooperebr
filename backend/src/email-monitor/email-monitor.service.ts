import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import { PrismaService } from '../prisma.service';
import { FaturasService } from '../faturas/faturas.service';
import { WhatsappSenderService } from '../whatsapp/whatsapp-sender.service';

interface AnexoPdf {
  filename: string;
  content: Buffer;
}

interface EmailProcessado {
  remetente: string;
  assunto: string;
  anexos: AnexoPdf[];
  textoCorpo: string;
}

@Injectable()
export class EmailMonitorService {
  private readonly logger = new Logger(EmailMonitorService.name);
  private processando = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly faturasService: FaturasService,
    private readonly whatsappSender: WhatsappSenderService,
  ) {}

  // ── Config helpers (com isolamento por tenant) ─────────────────────

  async getConfigValue(chave: string, cooperativaId: string): Promise<string | null> {
    return this.getConfigFromDb(chave, cooperativaId);
  }

  private async getConfigFromDb(chave: string, cooperativaId: string): Promise<string | null> {
    const config = await this.prisma.configTenant.findFirst({
      where: { chave, cooperativaId },
    });
    return config?.valor ?? null;
  }

  // ── Buscar cooperativas com monitor de e-mail ativo ────────────────

  private async getCooperativasComMonitorAtivo(): Promise<string[]> {
    const configs = await this.prisma.configTenant.findMany({
      where: { chave: 'email.monitor.ativo', valor: 'true' },
      select: { cooperativaId: true },
    });
    return configs.map((c) => c.cooperativaId).filter(Boolean) as string[];
  }

  private async criarClientePorCooperativa(cooperativaId: string): Promise<ImapFlow> {
    const hostDb = await this.getConfigFromDb('email.monitor.host', cooperativaId);
    const portDb = await this.getConfigFromDb('email.monitor.port', cooperativaId);
    const userDb = await this.getConfigFromDb('email.monitor.user', cooperativaId);
    const passDb = await this.getConfigFromDb('email.monitor.pass', cooperativaId);

    const host = hostDb || process.env.EMAIL_IMAP_HOST || 'imap.gmail.com';
    const port = Number(portDb || process.env.EMAIL_IMAP_PORT || '993');
    const user = userDb || process.env.EMAIL_IMAP_USER || '';

    let pass = process.env.EMAIL_IMAP_PASS || '';
    if (passDb) {
      pass = Buffer.from(passDb, 'base64').toString('utf-8');
    }

    return new ImapFlow({
      host,
      port,
      secure: true,
      auth: { user, pass },
      logger: false,
    });
  }

  // ── Cron: verifica e-mails a cada 30 min para cada tenant ativo ────

  @Cron('0 0 6 * * *') // 1x por dia às 6h (pode ser acionado manualmente via POST /email-monitor/processar)
  async verificarEmailsFaturas() {
    if (this.processando) {
      this.logger.debug('Já processando e-mails de faturas — pulando ciclo');
      return;
    }

    const cooperativas = await this.getCooperativasComMonitorAtivo();
    if (cooperativas.length === 0) return;

    for (const cooperativaId of cooperativas) {
      await this.processarCaixaDeEntrada(cooperativaId);
    }
  }

  // ── Trigger manual: POST /email-monitor/processar ─────────────────

  async processarManual(cooperativaId: string): Promise<{ processados: number; pendentes: number; erros: number }> {
    if (this.processando) {
      return { processados: 0, pendentes: 0, erros: 0 };
    }
    return this.processarCaixaDeEntrada(cooperativaId);
  }

  private async processarCaixaDeEntrada(
    cooperativaId: string,
  ): Promise<{ processados: number; pendentes: number; erros: number }> {
    this.processando = true;
    const resultado = { processados: 0, pendentes: 0, erros: 0 };
    const client = await this.criarClientePorCooperativa(cooperativaId);

    try {
      await client.connect();

      await this.garantirPasta(client, 'Processados');
      await this.garantirPasta(client, 'Pendentes');

      const lock = await client.getMailboxLock('INBOX');

      try {
        const msgs = client.fetch({ seen: false }, { envelope: true, source: true, uid: true });

        for await (const msg of msgs) {
          try {
            const email = await this.extrairEmail(msg);
            if (!email) continue;

            if (email.anexos.length === 0) continue;
            if (!this.pareceSerFaturaConcessionaria(email)) continue;

            // Tentar identificar cooperado por e-mail do remetente ou UC no corpo
            let cooperado = await this.identificarCooperado(email, cooperativaId);

            if (cooperado) {
              // Cooperado identificado pré-OCR → fluxo padrão via uploadConcessionaria
              for (const anexo of email.anexos) {
                try {
                  const base64 = anexo.content.toString('base64');
                  const resultUpload = await this.faturasService.uploadConcessionaria({
                    cooperadoId: cooperado.id,
                    arquivoBase64: base64,
                    tipoArquivo: 'pdf',
                    mesReferencia: this.extrairMesReferencia(email),
                  });
                  resultado.processados++;

                  // Ativar emailFaturasAtivo + notificar cooperado na primeira fatura
                  await this.ativarEmailFaturas(cooperado.id, cooperado.nomeCompleto, cooperativaId);

                  // Notificar admin via WhatsApp
                  const ucNum = (resultUpload.fatura?.dadosExtraidos as Record<string, unknown>)?.numeroUC || 'N/A';
                  await this.notificarAdminWhatsApp(
                    cooperativaId,
                    `📄 Nova fatura recebida via e-mail\n\n👤 Cooperado: ${cooperado.nomeCompleto}\n🔌 UC: ${ucNum}\n📅 Ref: ${this.extrairMesReferencia(email)}\n📊 Status: aguardando aprovação`,
                  );

                  this.logger.log(
                    `Fatura processada: ${anexo.filename} → cooperado ${cooperado.nomeCompleto} [coop: ${cooperativaId}]`,
                  );
                } catch (err) {
                  this.logger.warn(
                    `Erro ao processar anexo ${anexo.filename}: ${(err as Error).message}`,
                  );
                  resultado.erros++;
                }
              }
              await client.messageMove(msg.uid, 'Processados', { uid: true });
            } else {
              // Cooperado NÃO identificado pré-OCR → tentar via OCR (UC/CPF extraídos)
              for (const anexo of email.anexos) {
                try {
                  const base64 = anexo.content.toString('base64');
                  const dadosOcr = await this.faturasService.extrairOcr(base64, 'pdf') as unknown as { numeroUC?: string; documento?: string; mesReferencia?: string; historicoConsumo?: unknown[]; [key: string]: unknown };

                  // Tentar identificar por UC extraída do OCR
                  cooperado = await this.identificarPorOcr(dadosOcr, cooperativaId);

                  if (cooperado) {
                    // Encontrado via OCR → processar normalmente
                    const resultUpload = await this.faturasService.uploadConcessionaria({
                      cooperadoId: cooperado.id,
                      arquivoBase64: base64,
                      tipoArquivo: 'pdf',
                      mesReferencia: this.extrairMesReferencia(email),
                    });
                    resultado.processados++;

                    // Ativar emailFaturasAtivo + notificar cooperado na primeira fatura
                    await this.ativarEmailFaturas(cooperado.id, cooperado.nomeCompleto, cooperativaId);

                    const ucNum = dadosOcr.numeroUC || 'N/A';
                    await this.notificarAdminWhatsApp(
                      cooperativaId,
                      `📄 Nova fatura recebida via e-mail (identificada por OCR)\n\n👤 Cooperado: ${cooperado.nomeCompleto}\n🔌 UC: ${ucNum}\n📅 Ref: ${this.extrairMesReferencia(email)}\n📊 Status: aguardando aprovação`,
                    );

                    this.logger.log(
                      `Fatura processada (via OCR): ${anexo.filename} → cooperado ${cooperado.nomeCompleto} [coop: ${cooperativaId}]`,
                    );
                  } else {
                    // Não identificado nem por OCR → salvar como não identificada
                    await this.criarFaturaNaoIdentificada(dadosOcr, base64, email, cooperativaId);
                    resultado.pendentes++;

                    const ucNum = dadosOcr.numeroUC || 'desconhecida';
                    await this.notificarAdminWhatsApp(
                      cooperativaId,
                      `⚠️ Fatura recebida por e-mail NÃO IDENTIFICADA\n\n📧 Remetente: ${email.remetente}\n🔌 UC (OCR): ${ucNum}\n📄 CPF/CNPJ (OCR): ${dadosOcr.documento || 'não extraído'}\n📅 Ref: ${dadosOcr.mesReferencia || 'N/A'}\n\n🔍 Revisão manual necessária na Central de Faturas`,
                    );

                    this.logger.warn(
                      `Cooperado não identificado (pós-OCR) para e-mail de ${email.remetente} [coop: ${cooperativaId}]`,
                    );
                  }
                } catch (err) {
                  this.logger.warn(
                    `Erro ao processar anexo não identificado ${anexo.filename}: ${(err as Error).message}`,
                  );
                  resultado.erros++;
                }
              }

              if (cooperado) {
                await client.messageMove(msg.uid, 'Processados', { uid: true });
              } else {
                await client.messageMove(msg.uid, 'Pendentes', { uid: true });
              }
            }
          } catch (err) {
            this.logger.warn(`Erro ao processar mensagem: ${(err as Error).message}`);
            resultado.erros++;
          }
        }
      } finally {
        lock.release();
      }

      await client.logout();
    } catch (err) {
      this.logger.error(
        `Erro ao verificar e-mails IMAP [coop: ${cooperativaId}]: ${(err as Error).message}`,
      );
    } finally {
      this.processando = false;
    }

    if (resultado.processados > 0 || resultado.pendentes > 0) {
      this.logger.log(
        `[coop: ${cooperativaId}] Email Monitor: ${resultado.processados} processado(s), ${resultado.pendentes} pendente(s), ${resultado.erros} erro(s)`,
      );
    }

    return resultado;
  }

  // ── Identificação pós-OCR: UC e CPF/CNPJ ──────────────────────────

  private async identificarPorOcr(
    dadosOcr: { numeroUC?: string; documento?: string; [key: string]: unknown },
    cooperativaId: string,
  ): Promise<{ id: string; nomeCompleto: string; cooperativaId: string | null } | null> {
    // 1. Match por número da UC extraído pelo OCR
    const numeroUC = dadosOcr.numeroUC;
    if (numeroUC) {
      const uc = await this.prisma.uc.findFirst({
        where: { numeroUC, cooperado: { cooperativaId } },
        include: {
          cooperado: {
            select: { id: true, nomeCompleto: true, cooperativaId: true },
          },
        },
      });
      if (uc?.cooperado) return uc.cooperado;
    }

    // 2. Match por CPF/CNPJ extraído pelo OCR
    const documento = dadosOcr.documento;
    if (documento) {
      const cpfLimpo = documento.replace(/\D/g, '');
      if (cpfLimpo.length >= 11) {
        const cooperado = await this.prisma.cooperado.findFirst({
          where: { cpf: cpfLimpo, cooperativaId },
          select: { id: true, nomeCompleto: true, cooperativaId: true },
        });
        if (cooperado) return cooperado;
      }
    }

    return null;
  }

  // ── Criar FaturaProcessada para faturas não identificadas ──────────

  private async criarFaturaNaoIdentificada(
    dadosOcr: { numeroUC?: string; documento?: string; mesReferencia?: string; historicoConsumo?: unknown[]; [key: string]: unknown },
    base64: string,
    email: EmailProcessado,
    cooperativaId: string,
  ): Promise<void> {
    try {
      const historicoConsumo = dadosOcr.historicoConsumo ?? [];

      await this.prisma.faturaProcessada.create({
        data: {
          cooperadoId: null,
          ucId: null,
          arquivoUrl: null,
          dadosExtraidos: {
            ...(dadosOcr as object),
            emailRemetente: email.remetente,
            emailAssunto: email.assunto,
          },
          historicoConsumo: historicoConsumo as object,
          mesesUtilizados: 0,
          mesesDescartados: 0,
          mediaKwhCalculada: 0,
          thresholdUtilizado: 0,
          status: 'PENDENTE',
          cooperativaId,
          mesReferencia: dadosOcr.mesReferencia || null,
          statusRevisao: 'NAO_IDENTIFICADA',
        },
      });

      // Criar notificação no sistema também
      await this.prisma.notificacao.create({
        data: {
          titulo: 'Fatura por e-mail não identificada',
          mensagem: `E-mail de ${email.remetente} com assunto "${email.assunto}". UC (OCR): ${dadosOcr.numeroUC || 'N/A'}, CPF (OCR): ${dadosOcr.documento || 'N/A'}. Verifique na Central de Faturas.`,
          tipo: 'ALERTA',
          lida: false,
          cooperativaId,
        },
      });
    } catch (err) {
      this.logger.warn(`Falha ao criar fatura não identificada: ${(err as Error).message}`);
    }
  }

  // ── Notificar admin via WhatsApp ───────────────────────────────────

  private async notificarAdminWhatsApp(cooperativaId: string, mensagem: string): Promise<void> {
    try {
      const adminPhone =
        (await this.getConfigFromDb('admin_phone', cooperativaId)) ||
        (await this.getConfigFromDb('suporte_telefone', cooperativaId)) ||
        process.env.ADMIN_WHATSAPP_NUMBER ||
        process.env.ADMIN_PHONE ||
        null;

      if (!adminPhone) {
        this.logger.warn(`[coop: ${cooperativaId}] Sem telefone admin configurado para notificação WhatsApp`);
        return;
      }

      await this.whatsappSender.enviarMensagem(adminPhone, mensagem, {
        tipoDisparo: 'SISTEMA',
        cooperativaId,
      });
    } catch (err) {
      this.logger.warn(`Falha ao notificar admin via WhatsApp: ${(err as Error).message}`);
    }
  }

  // ── Ativar emailFaturasAtivo + notificar cooperado na primeira fatura ──

  private async ativarEmailFaturas(
    cooperadoId: string,
    nomeCompleto: string,
    cooperativaId: string,
  ): Promise<void> {
    try {
      const cooperado = await this.prisma.cooperado.findUnique({
        where: { id: cooperadoId },
        select: { emailFaturasAtivo: true, telefone: true },
      });
      if (!cooperado) return;

      // Sempre atualizar o timestamp da última fatura recebida
      await this.prisma.cooperado.update({
        where: { id: cooperadoId },
        data: {
          emailFaturasAtivo: true,
          emailFaturasAtivoEm: new Date(),
        },
      });

      // Se é a primeira vez, notificar cooperado via WhatsApp
      if (!cooperado.emailFaturasAtivo && cooperado.telefone) {
        await this.whatsappSender.enviarMensagem(
          cooperado.telefone,
          `Boa notícia, ${nomeCompleto.split(' ')[0]}! Recebemos sua primeira fatura da EDP automaticamente. Seu sistema de monitoramento está ativo! 🎉`,
          { tipoDisparo: 'SISTEMA', cooperativaId },
        );
      }
    } catch (err) {
      this.logger.warn(`Falha ao ativar emailFaturas para cooperado ${cooperadoId}: ${(err as Error).message}`);
    }
  }

  // ── Helpers ────────────────────────────────────────────────────────

  private async extrairEmail(msg: unknown): Promise<EmailProcessado | null> {
    const msgTyped = msg as { source?: Buffer };
    if (!msgTyped.source) return null;

    const parsed = await simpleParser(msgTyped.source);
    const remetente = parsed.from?.value?.[0]?.address || '';
    const assunto = parsed.subject || '';
    const textoCorpo = parsed.text || '';

    const anexos: AnexoPdf[] = [];
    if (parsed.attachments) {
      for (const att of parsed.attachments) {
        const isPdf =
          att.contentType === 'application/pdf' ||
          att.filename?.toLowerCase().endsWith('.pdf');
        if (isPdf && att.content) {
          anexos.push({
            filename: att.filename || 'fatura.pdf',
            content: att.content,
          });
        }
      }
    }

    return { remetente, assunto, anexos, textoCorpo };
  }

  private pareceSerFaturaConcessionaria(email: EmailProcessado): boolean {
    const termos = [
      'fatura', 'conta de energia', 'conta de luz', 'energia elétrica',
      'edp', 'cemig', 'copel', 'celpe', 'coelba', 'energisa', 'cpfl',
      'enel', 'light', 'equatorial', 'neoenergia', 'celesc',
      'demonstrativo', 'consumo', 'kwh', 'unidade consumidora',
    ];
    const textoCompleto = `${email.remetente} ${email.assunto} ${email.textoCorpo}`.toLowerCase();
    return termos.some((t) => textoCompleto.includes(t));
  }

  private async identificarCooperado(
    email: EmailProcessado,
    cooperativaId: string,
  ): Promise<{ id: string; nomeCompleto: string; cooperativaId: string | null } | null> {
    // 1. Match por e-mail do remetente, filtrado por cooperativaId
    if (email.remetente) {
      const cooperado = await this.prisma.cooperado.findFirst({
        where: { email: email.remetente, cooperativaId },
        select: { id: true, nomeCompleto: true, cooperativaId: true },
      });
      if (cooperado) return cooperado;
    }

    // 2. Match por número da UC extraído do corpo/assunto
    const ucNumeros = this.extrairNumerosUC(email.textoCorpo + ' ' + email.assunto);
    for (const numero of ucNumeros) {
      const uc = await this.prisma.uc.findFirst({
        where: { numeroUC: numero, cooperado: { cooperativaId } },
        include: {
          cooperado: {
            select: { id: true, nomeCompleto: true, cooperativaId: true },
          },
        },
      });
      if (uc?.cooperado) return uc.cooperado;
    }

    return null;
  }

  private extrairNumerosUC(texto: string): string[] {
    const numeros: string[] = [];

    const ucRegex = /(?:UC|unidade\s*consumidora)[:\s]*(\d{6,15})/gi;
    let match: RegExpExecArray | null;
    while ((match = ucRegex.exec(texto)) !== null) {
      numeros.push(match[1]);
    }

    const instRegex = /instala[çc][ãa]o[:\s]*(\d{6,15})/gi;
    while ((match = instRegex.exec(texto)) !== null) {
      numeros.push(match[1]);
    }

    return [...new Set(numeros)];
  }

  private extrairMesReferencia(email: EmailProcessado): string {
    const texto = `${email.assunto} ${email.textoCorpo}`;

    const matchBarra = texto.match(/(\d{2})\/(\d{4})/);
    if (matchBarra) return `${matchBarra[2]}-${matchBarra[1]}`;

    const matchHifen = texto.match(/(\d{4})-(\d{2})/);
    if (matchHifen) return `${matchHifen[1]}-${matchHifen[2]}`;

    const meses: Record<string, string> = {
      janeiro: '01', fevereiro: '02', março: '03', marco: '03',
      abril: '04', maio: '05', junho: '06', julho: '07',
      agosto: '08', setembro: '09', outubro: '10',
      novembro: '11', dezembro: '12',
    };
    for (const [nome, num] of Object.entries(meses)) {
      const regex = new RegExp(`${nome}[\\s/]*(?:de\\s*)?(\\d{4})`, 'i');
      const m = texto.match(regex);
      if (m) return `${m[1]}-${num}`;
    }

    const hoje = new Date();
    const mesAnterior = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1);
    return `${mesAnterior.getFullYear()}-${String(mesAnterior.getMonth() + 1).padStart(2, '0')}`;
  }

  private async garantirPasta(client: ImapFlow, nome: string): Promise<void> {
    try {
      await client.mailboxCreate(nome);
    } catch {
      // Pasta já existe — ignorar
    }
  }
}
