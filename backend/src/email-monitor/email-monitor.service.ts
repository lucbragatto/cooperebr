import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import { PrismaService } from '../prisma.service';
import { FaturasService } from '../faturas/faturas.service';

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
  ) {}

  async getConfigValue(chave: string): Promise<string | null> {
    return this.getConfigFromDb(chave);
  }

  private async getConfigFromDb(chave: string): Promise<string | null> {
    const config = await this.prisma.configTenant.findFirst({
      where: { chave },
    });
    return config?.valor ?? null;
  }

  private async criarCliente(): Promise<ImapFlow> {
    const hostDb = await this.getConfigFromDb('email.monitor.host');
    const portDb = await this.getConfigFromDb('email.monitor.port');
    const userDb = await this.getConfigFromDb('email.monitor.user');
    const passDb = await this.getConfigFromDb('email.monitor.pass');

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

  private async isMonitorAtivo(): Promise<boolean> {
    const ativo = await this.getConfigFromDb('email.monitor.ativo');
    if (ativo === 'false') return false;
    // Se não tem config no banco, verificar ENV
    const userDb = await this.getConfigFromDb('email.monitor.user');
    return !!(userDb || process.env.EMAIL_IMAP_USER);
  }

  /**
   * Job agendado: verifica e-mails com PDFs de faturas concessionária a cada 30 minutos.
   */
  @Cron('0 */30 * * * *')
  async verificarEmailsFaturas() {
    const ativo = await this.isMonitorAtivo();
    if (!ativo) {
      return;
    }
    if (this.processando) {
      this.logger.debug('Já processando e-mails de faturas — pulando ciclo');
      return;
    }
    await this.processarCaixaDeEntrada();
  }

  /**
   * Trigger manual: POST /email-monitor/processar
   */
  async processarManual(): Promise<{ processados: number; pendentes: number; erros: number }> {
    if (this.processando) {
      return { processados: 0, pendentes: 0, erros: 0 };
    }
    return this.processarCaixaDeEntrada();
  }

  private async processarCaixaDeEntrada(): Promise<{ processados: number; pendentes: number; erros: number }> {
    this.processando = true;
    const resultado = { processados: 0, pendentes: 0, erros: 0 };
    const client = await this.criarCliente();

    try {
      await client.connect();

      // Garantir que as pastas de destino existam
      await this.garantirPasta(client, 'Processados');
      await this.garantirPasta(client, 'Pendentes');

      const lock = await client.getMailboxLock('INBOX');

      try {
        const msgs = client.fetch({ seen: false }, { envelope: true, source: true, uid: true });

        for await (const msg of msgs) {
          try {
            const email = await this.extrairEmail(msg);
            if (!email) continue;

            // Filtrar apenas e-mails com PDF anexado
            if (email.anexos.length === 0) continue;

            // Verificar se parece fatura de concessionária
            if (!this.pareceSerFaturaConcessionaria(email)) continue;

            // Tentar identificar cooperado
            const cooperado = await this.identificarCooperado(email);

            if (cooperado) {
              // Processar cada PDF anexo
              for (const anexo of email.anexos) {
                try {
                  const base64 = anexo.content.toString('base64');
                  await this.faturasService.uploadConcessionaria({
                    cooperadoId: cooperado.id,
                    arquivoBase64: base64,
                    tipoArquivo: 'pdf',
                    mesReferencia: this.extrairMesReferencia(email),
                  });
                  resultado.processados++;
                  this.logger.log(
                    `Fatura processada: ${anexo.filename} → cooperado ${cooperado.nomeCompleto}`,
                  );
                } catch (err) {
                  this.logger.warn(
                    `Erro ao processar anexo ${anexo.filename}: ${(err as Error).message}`,
                  );
                  resultado.erros++;
                }
              }

              // Mover para Processados
              await client.messageMove(msg.uid, 'Processados', { uid: true });
            } else {
              // Cooperado não encontrado — mover para Pendentes e criar notificação
              await client.messageMove(msg.uid, 'Pendentes', { uid: true });
              await this.criarNotificacaoPendente(email);
              resultado.pendentes++;
              this.logger.warn(
                `Cooperado não identificado para e-mail de ${email.remetente} — movido para Pendentes`,
              );
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
      this.logger.error(`Erro ao verificar e-mails IMAP (monitor faturas): ${(err as Error).message}`);
    } finally {
      this.processando = false;
    }

    if (resultado.processados > 0 || resultado.pendentes > 0) {
      this.logger.log(
        `Email Monitor: ${resultado.processados} processado(s), ${resultado.pendentes} pendente(s), ${resultado.erros} erro(s)`,
      );
    }

    return resultado;
  }

  private async extrairEmail(msg: any): Promise<EmailProcessado | null> {
    if (!msg.source) return null;

    const parsed = await simpleParser(msg.source);
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

  /**
   * Heurística para detectar se o e-mail contém uma fatura de concessionária.
   * Verifica remetente e assunto por padrões de distribuidoras conhecidas.
   */
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

  /**
   * Tenta identificar cooperado pelo e-mail do remetente ou pelo número da UC no corpo.
   */
  private async identificarCooperado(
    email: EmailProcessado,
  ): Promise<{ id: string; nomeCompleto: string; cooperativaId: string | null } | null> {
    // 1. Match por e-mail do remetente
    if (email.remetente) {
      const cooperado = await this.prisma.cooperado.findFirst({
        where: { email: email.remetente },
        select: { id: true, nomeCompleto: true, cooperativaId: true },
      });
      if (cooperado) return cooperado;
    }

    // 2. Match por número da UC extraído do corpo/assunto
    const ucNumeros = this.extrairNumerosUC(email.textoCorpo + ' ' + email.assunto);
    for (const numero of ucNumeros) {
      const uc = await this.prisma.uc.findFirst({
        where: { numeroUC: numero },
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

  /**
   * Extrai possíveis números de UC do texto usando padrões comuns de concessionárias.
   */
  private extrairNumerosUC(texto: string): string[] {
    const numeros: string[] = [];

    // Padrão: "UC" ou "Unidade Consumidora" seguido de número
    const ucRegex = /(?:UC|unidade\s*consumidora)[:\s]*(\d{6,15})/gi;
    let match: RegExpExecArray | null;
    while ((match = ucRegex.exec(texto)) !== null) {
      numeros.push(match[1]);
    }

    // Padrão: "Instalação" seguido de número
    const instRegex = /instala[çc][ãa]o[:\s]*(\d{6,15})/gi;
    while ((match = instRegex.exec(texto)) !== null) {
      numeros.push(match[1]);
    }

    return [...new Set(numeros)];
  }

  /**
   * Tenta extrair o mês de referência do e-mail. Fallback: mês anterior.
   */
  private extrairMesReferencia(email: EmailProcessado): string {
    const texto = `${email.assunto} ${email.textoCorpo}`;

    // Padrão: MM/YYYY ou YYYY-MM
    const matchBarra = texto.match(/(\d{2})\/(\d{4})/);
    if (matchBarra) {
      return `${matchBarra[2]}-${matchBarra[1]}`;
    }
    const matchHifen = texto.match(/(\d{4})-(\d{2})/);
    if (matchHifen) {
      return `${matchHifen[1]}-${matchHifen[2]}`;
    }

    // Meses por extenso
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

    // Fallback: mês anterior
    const hoje = new Date();
    const mesAnterior = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1);
    return `${mesAnterior.getFullYear()}-${String(mesAnterior.getMonth() + 1).padStart(2, '0')}`;
  }

  /**
   * Cria notificação para o admin sobre e-mail não identificado.
   */
  private async criarNotificacaoPendente(email: EmailProcessado): Promise<void> {
    try {
      await this.prisma.notificacao.create({
        data: {
          titulo: 'Fatura por e-mail não identificada',
          mensagem: `E-mail de ${email.remetente} com assunto "${email.assunto}" contém PDF de fatura mas o cooperado não foi identificado. Verifique a pasta Pendentes do e-mail.`,
          tipo: 'ALERTA',
          lida: false,
        },
      });
    } catch (err) {
      this.logger.warn(`Falha ao criar notificação pendente: ${(err as Error).message}`);
    }
  }

  private async garantirPasta(client: ImapFlow, nome: string): Promise<void> {
    try {
      await client.mailboxCreate(nome);
    } catch {
      // Pasta já existe — ignorar
    }
  }
}
