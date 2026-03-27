import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ImapFlow } from 'imapflow';
import { PrismaService } from '../prisma.service';

@Injectable()
export class EmailRecebimentoService {
  private readonly logger = new Logger(EmailRecebimentoService.name);
  private processando = false;

  constructor(private prisma: PrismaService) {}

  private criarCliente(): ImapFlow {
    return new ImapFlow({
      host: process.env.IMAP_HOST || 'imap.gmail.com',
      port: Number(process.env.IMAP_PORT) || 993,
      secure: true,
      auth: {
        user: process.env.IMAP_USER || '',
        pass: process.env.IMAP_PASS || '',
      },
      logger: false,
    });
  }

  @Cron(CronExpression.EVERY_5_MINUTES)
  async verificarEmailsRecebidos() {
    if (!process.env.IMAP_USER) {
      return;
    }
    if (this.processando) {
      this.logger.debug('Já processando e-mails — pulando ciclo');
      return;
    }
    this.processando = true;
    const client = this.criarCliente();

    try {
      await client.connect();
      const lock = await client.getMailboxLock('INBOX');

      try {
        const msgs = client.fetch({ seen: false }, { envelope: true, source: true });

        for await (const msg of msgs) {
          try {
            const envelope = msg.envelope;
            if (!envelope) continue;
            const remetente = envelope.from?.[0]?.address || 'desconhecido';
            const nomeRemetente = envelope.from?.[0]?.name || '';
            const assunto = envelope.subject || '(sem assunto)';
            const data = envelope.date || new Date();

            const ehComprovante = this.identificarComprovante(assunto);

            // Extrair corpo (texto simples do source)
            const sourceStr = msg.source?.toString('utf-8') || '';
            const valorExtraido = this.extrairValor(sourceStr);

            // Tentar identificar cooperado pelo e-mail do remetente
            let cooperadoId: string | null = null;
            const cooperado = await this.prisma.cooperado.findFirst({
              where: { email: remetente },
              select: { id: true, nomeCompleto: true },
            });
            if (cooperado) {
              cooperadoId = cooperado.id;
            }

            await this.prisma.emailLog.create({
              data: {
                destinatario: remetente,
                assunto,
                status: 'RECEBIDO',
                tipo: ehComprovante ? 'COMPROVANTE' : 'GERAL',
                cooperadoId,
                valorExtraido,
                nomeRemetente,
                dataEmail: new Date(data),
              },
            });

            if (ehComprovante) {
              this.logger.log(
                `Comprovante recebido de ${nomeRemetente} <${remetente}> — valor extraído: ${valorExtraido ?? 'N/A'}`,
              );
            }

            // Marcar como lido
            await client.messageFlagsAdd(msg.seq, ['\\Seen'], { uid: false });
          } catch (err) {
            this.logger.warn(`Erro ao processar mensagem: ${err.message}`);
          }
        }
      } finally {
        lock.release();
      }
      await client.logout();
    } catch (err) {
      this.logger.error(`Erro ao verificar e-mails IMAP: ${err.message}`);
    } finally {
      this.processando = false;
    }
  }

  private identificarComprovante(assunto: string): boolean {
    const termos = ['comprovante', 'pagamento', 'pix', 'transferência', 'recibo', 'deposito', 'depósito'];
    const lower = assunto.toLowerCase();
    return termos.some((t) => lower.includes(t));
  }

  private extrairValor(texto: string): number | null {
    // Padrão: R$ 1.234,56 ou R$1234,56
    const match = texto.match(/R\$\s*([\d.]+,\d{2})/);
    if (match) {
      const numStr = match[1].replace(/\./g, '').replace(',', '.');
      const num = parseFloat(numStr);
      return isNaN(num) ? null : num;
    }
    return null;
  }
}
