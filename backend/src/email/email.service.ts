import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import {
  templateBoasVindas,
  templateCadastroAprovado,
  templateFatura,
  templateConfirmacaoPagamento,
  templateDocumentoAprovado,
  templateDocumentoReprovado,
  templateContratoGerado,
  templateTeste,
} from './email-templates';
import { PrismaService } from '../prisma.service';

interface CooperadoEmail {
  id: string;
  nomeCompleto: string;
  email?: string | null;
  cooperativaId?: string | null;
}

interface CobrancaEmail {
  id: string;
  mesReferencia: number;
  anoReferencia: number;
  valorLiquido: any;
  dataVencimento: Date | string;
  valorPago?: any;
  dataPagamento?: Date | string | null;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter;
  private readonly from: string;

  constructor(private prisma: PrismaService) {
    this.from = process.env.EMAIL_FROM || 'CoopereBR <contato@cooperebr.com.br>';
    const port = Number(process.env.EMAIL_PORT) || 465;
    this.transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST || 'smtp.gmail.com',
      port,
      secure: process.env.EMAIL_SECURE === 'true' || port === 465,
      auth: {
        user: process.env.EMAIL_USER || '',
        pass: process.env.EMAIL_PASS || '',
      },
    });
  }

  async enviarEmail(to: string, subject: string, html: string, text?: string): Promise<boolean> {
    if (!process.env.EMAIL_USER) {
      this.logger.warn('EMAIL_USER não configurado — e-mail não enviado');
      return false;
    }
    try {
      await this.transporter.sendMail({ from: this.from, to, subject, html, text });
      this.logger.log(`E-mail enviado para ${to}: ${subject}`);

      // Log no banco
      await this.registrarLog(to, subject, 'ENVIADO').catch(() => {});
      return true;
    } catch (err) {
      this.logger.error(`Falha ao enviar e-mail para ${to}: ${err.message}`);
      await this.registrarLog(to, subject, 'ERRO', err.message).catch(() => {});
      return false;
    }
  }

  async enviarBoasVindas(cooperado: CooperadoEmail): Promise<boolean> {
    if (!cooperado.email) return false;
    const html = templateBoasVindas(cooperado.nomeCompleto);
    return this.enviarEmail(cooperado.email, 'Bem-vindo à CoopereBR! ☀️', html);
  }

  async enviarCadastroAprovado(cooperado: CooperadoEmail): Promise<boolean> {
    if (!cooperado.email) return false;
    const html = templateCadastroAprovado(cooperado.nomeCompleto);
    return this.enviarEmail(cooperado.email, 'Seu cadastro foi aprovado! ✅', html);
  }

  async enviarFatura(
    cooperado: CooperadoEmail,
    cobranca: CobrancaEmail,
    extras?: { pixCopiaECola?: string | null; boletoUrl?: string | null; linhaDigitavel?: string | null },
  ): Promise<boolean> {
    if (!cooperado.email) return false;
    const mesRef = `${String(cobranca.mesReferencia).padStart(2, '0')}/${cobranca.anoReferencia}`;
    const valor = Number(cobranca.valorLiquido);
    const vencimento = new Date(cobranca.dataVencimento).toLocaleDateString('pt-BR');
    const html = templateFatura(
      cooperado.nomeCompleto,
      mesRef,
      valor,
      vencimento,
      extras?.pixCopiaECola,
      extras?.boletoUrl,
      extras?.linhaDigitavel,
    );
    return this.enviarEmail(cooperado.email, `Fatura CoopereBR — ${mesRef}`, html);
  }

  async enviarConfirmacaoPagamento(cooperado: CooperadoEmail, cobranca: CobrancaEmail): Promise<boolean> {
    if (!cooperado.email) return false;
    const mesRef = `${String(cobranca.mesReferencia).padStart(2, '0')}/${cobranca.anoReferencia}`;
    const valor = Number(cobranca.valorPago ?? cobranca.valorLiquido);
    const agora = new Date();
    const dataHora = `${agora.toLocaleDateString('pt-BR')} ${agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
    const html = templateConfirmacaoPagamento(cooperado.nomeCompleto, valor, mesRef, dataHora);
    return this.enviarEmail(cooperado.email, `Pagamento Confirmado — ${mesRef}`, html);
  }

  async enviarDocumentoAprovado(cooperado: CooperadoEmail): Promise<boolean> {
    if (!cooperado.email) return false;
    const html = templateDocumentoAprovado(cooperado.nomeCompleto);
    return this.enviarEmail(cooperado.email, 'Seus documentos foram aprovados! ✅', html);
  }

  async enviarDocumentoReprovado(cooperado: CooperadoEmail, motivo: string): Promise<boolean> {
    if (!cooperado.email) return false;
    const html = templateDocumentoReprovado(cooperado.nomeCompleto, motivo);
    return this.enviarEmail(cooperado.email, 'Documentos — Correção necessária', html);
  }

  async enviarContratoGerado(cooperado: CooperadoEmail, linkContrato?: string): Promise<boolean> {
    if (!cooperado.email) return false;
    const html = templateContratoGerado(cooperado.nomeCompleto, linkContrato);
    return this.enviarEmail(cooperado.email, 'Seu contrato está pronto! 📄', html);
  }

  async enviarTeste(emailDestino: string): Promise<boolean> {
    const html = templateTeste();
    return this.enviarEmail(emailDestino, 'E-mail de Teste — CoopereBR', html);
  }

  async buscarLogs(page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [logs, total] = await Promise.all([
      this.prisma.emailLog.findMany({
        orderBy: { criadoEm: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.emailLog.count(),
    ]);
    return { logs, total, page, limit, pages: Math.ceil(total / limit) };
  }

  private async registrarLog(destinatario: string, assunto: string, status: string, erro?: string) {
    await this.prisma.emailLog.create({
      data: { destinatario, assunto, status, erro },
    });
  }
}
