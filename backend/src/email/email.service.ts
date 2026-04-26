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
import { podeEnviarEmDev } from '../common/safety/whitelist-teste';
import { EmailConfigService, SmtpConfig } from './email-config.service';

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
  // Cache de transporters por chave (cooperativaId|null=global). Evita
  // recriar nodemailer a cada envio. Invalidado em runtime se config mudar.
  private transporters = new Map<string, { transporter: nodemailer.Transporter; from: string; user: string; fonte: string }>();

  constructor(
    private prisma: PrismaService,
    private emailConfig: EmailConfigService,
  ) {}

  /**
   * Sprint 11 multi-parceiro: aceita `cooperativaId` opcional pra resolver
   * SMTP do tenant. Sem cooperativaId, usa SMTP global do .env.
   */
  async enviarEmail(
    to: string,
    subject: string,
    html: string,
    text?: string,
    cooperativaId?: string | null,
  ): Promise<boolean> {
    const tenant = await this.resolveTransporter(cooperativaId);
    if (!tenant.user) {
      this.logger.warn(`SMTP user não configurado (cooperativaId=${cooperativaId ?? 'global'}) — e-mail não enviado`);
      return false;
    }
    if (!podeEnviarEmDev(to, 'EMAIL')) {
      this.logger.log(`[DEV] E-mail para ${to} SKIPPED (não está na whitelist)`);
      return true;
    }
    try {
      await tenant.transporter.sendMail({ from: tenant.from, to, subject, html, text });
      this.logger.log(`E-mail enviado para ${to}: ${subject} [fonte=${tenant.fonte}]`);
      await this.registrarLog(to, subject, 'ENVIADO').catch(() => {});
      return true;
    } catch (err: any) {
      this.logger.error(`Falha ao enviar e-mail para ${to}: ${err.message}`);
      await this.registrarLog(to, subject, 'ERRO', err.message).catch(() => {});
      return false;
    }
  }

  /**
   * Invalida cache de transporters. Chamar após salvar nova config SMTP
   * (endpoint de configurações). Se cooperativaId vier, limpa só esse;
   * sem cooperativaId, limpa tudo.
   */
  invalidateTransporterCache(cooperativaId?: string | null): void {
    if (cooperativaId) {
      this.transporters.delete(cooperativaId);
    } else {
      this.transporters.clear();
    }
  }

  private async resolveTransporter(cooperativaId?: string | null): Promise<{
    transporter: nodemailer.Transporter; from: string; user: string; fonte: string;
  }> {
    const cacheKey = cooperativaId ?? '__global__';
    const cached = this.transporters.get(cacheKey);
    if (cached) return cached;

    const cfg: SmtpConfig = await this.emailConfig.getSmtpConfig(cooperativaId);
    const transporter = nodemailer.createTransport({
      host: cfg.host,
      port: cfg.port,
      secure: cfg.secure,
      auth: { user: cfg.user, pass: cfg.pass },
    });
    const entry = { transporter, from: cfg.from, user: cfg.user, fonte: cfg.fonte };
    this.transporters.set(cacheKey, entry);
    return entry;
  }

  async enviarBoasVindas(cooperado: CooperadoEmail): Promise<boolean> {
    if (!cooperado.email) return false;
    const html = templateBoasVindas(cooperado.nomeCompleto);
    return this.enviarEmail(cooperado.email, 'Bem-vindo à CoopereBR! ☀️', html, undefined, cooperado.cooperativaId);
  }

  async enviarCadastroAprovado(cooperado: CooperadoEmail): Promise<boolean> {
    if (!cooperado.email) return false;
    const html = templateCadastroAprovado(cooperado.nomeCompleto);
    return this.enviarEmail(cooperado.email, 'Seu cadastro foi aprovado! ✅', html, undefined, cooperado.cooperativaId);
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
    return this.enviarEmail(cooperado.email, `Fatura CoopereBR — ${mesRef}`, html, undefined, cooperado.cooperativaId);
  }

  async enviarConfirmacaoPagamento(cooperado: CooperadoEmail, cobranca: CobrancaEmail): Promise<boolean> {
    if (!cooperado.email) return false;
    const mesRef = `${String(cobranca.mesReferencia).padStart(2, '0')}/${cobranca.anoReferencia}`;
    const valor = Number(cobranca.valorPago ?? cobranca.valorLiquido);
    const agora = new Date();
    const dataHora = `${agora.toLocaleDateString('pt-BR')} ${agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
    const html = templateConfirmacaoPagamento(cooperado.nomeCompleto, valor, mesRef, dataHora);
    return this.enviarEmail(cooperado.email, `Pagamento Confirmado — ${mesRef}`, html, undefined, cooperado.cooperativaId);
  }

  async enviarDocumentoAprovado(cooperado: CooperadoEmail): Promise<boolean> {
    if (!cooperado.email) return false;
    const html = templateDocumentoAprovado(cooperado.nomeCompleto);
    return this.enviarEmail(cooperado.email, 'Seus documentos foram aprovados! ✅', html, undefined, cooperado.cooperativaId);
  }

  async enviarDocumentoReprovado(cooperado: CooperadoEmail, motivo: string): Promise<boolean> {
    if (!cooperado.email) return false;
    const html = templateDocumentoReprovado(cooperado.nomeCompleto, motivo);
    return this.enviarEmail(cooperado.email, 'Documentos — Correção necessária', html, undefined, cooperado.cooperativaId);
  }

  async enviarContratoGerado(cooperado: CooperadoEmail, linkContrato?: string): Promise<boolean> {
    if (!cooperado.email) return false;
    const html = templateContratoGerado(cooperado.nomeCompleto, linkContrato);
    return this.enviarEmail(cooperado.email, 'Seu contrato está pronto! 📄', html, undefined, cooperado.cooperativaId);
  }

  async enviarTeste(emailDestino: string, cooperativaId?: string | null): Promise<boolean> {
    const html = templateTeste();
    return this.enviarEmail(emailDestino, 'E-mail de Teste — CoopereBR', html, undefined, cooperativaId);
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
