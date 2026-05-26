import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { EmailService } from '../email/email.service';

/**
 * Sub-Sprint F Sessao 2 F.3 Etapa D (M31, 2026-05-26).
 *
 * Envio de email pro convite proprietario. Reusa EmailService existente
 * (tenant-aware via cooperativaId) + template HTML inline (sem dependencia
 * Handlebars).
 *
 * Whitelist dev: EmailService.enviarEmail ja respeita podeEnviarEmDev()
 * (usa contatos teste em sandbox). Sem precisar duplicar logica aqui.
 */
@Injectable()
export class ConviteEmailService {
  private readonly logger = new Logger(ConviteEmailService.name);

  constructor(
    private readonly emailService: EmailService,
    private readonly prisma: PrismaService,
  ) {}

  async enviarConvite(input: {
    email: string;
    link: string;
    usinaId: string;
    cooperativaId: string;
    criadoPor: string;
    reenvio?: boolean;
  }): Promise<boolean> {
    const { email, link, usinaId, cooperativaId, criadoPor, reenvio } = input;

    // Busca nome da usina + cooperativa pra personalizar template
    const usina = await this.prisma.usina.findUnique({
      where: { id: usinaId },
      include: { cooperativa: { select: { nome: true } } },
    });

    const usinaNome = usina?.nome ?? 'sua usina';
    const cooperativaNome = usina?.cooperativa?.nome ?? 'a cooperativa';

    const subject = reenvio
      ? `📧 Convite reenviado — acesse o painel da ${usinaNome}`
      : `📧 Você foi convidado para acessar o painel da ${usinaNome}`;

    const html = this.montarHtml({
      email,
      link,
      usinaNome,
      cooperativaNome,
      criadoPor,
      reenvio: !!reenvio,
    });

    return this.emailService.enviarEmail(email, subject, html, undefined, cooperativaId);
  }

  private montarHtml(dados: {
    email: string;
    link: string;
    usinaNome: string;
    cooperativaNome: string;
    criadoPor: string;
    reenvio: boolean;
  }): string {
    const { link, usinaNome, cooperativaNome, criadoPor, reenvio } = dados;
    return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>Convite Portal Proprietario — ${escapeHtml(usinaNome)}</title>
<style>
  body { font-family: -apple-system, sans-serif; color: #333; padding: 20px; max-width: 600px; margin: auto; }
  h1 { color: #d97706; }
  .button { display: inline-block; background: #d97706; color: white !important; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 600; margin: 16px 0; }
  .info { background: #fef3c7; border-left: 4px solid #d97706; padding: 12px; margin: 16px 0; font-size: 14px; }
  .footer { margin-top: 32px; padding-top: 16px; border-top: 1px solid #eee; font-size: 12px; color: #888; }
  .link-fallback { word-break: break-all; font-size: 11px; color: #666; background: #f5f5f5; padding: 8px; border-radius: 4px; }
</style>
</head>
<body>

<h1>☀️ Bem-vindo ao Portal Proprietário</h1>

${reenvio ? '<p><strong>Este é um reenvio do convite.</strong> Se você ainda não havia aceitado, o link abaixo está atualizado.</p>' : ''}

<p>Olá!</p>

<p>${escapeHtml(criadoPor)} (administrador da <strong>${escapeHtml(cooperativaNome)}</strong>) te convidou para acessar
o painel da usina <strong>${escapeHtml(usinaNome)}</strong>.</p>

<p>No painel você acompanha:</p>
<ul>
  <li>📊 Geração mensal da usina (kWh)</li>
  <li>💰 Repasse previsto conforme contrato</li>
  <li>📄 Despesas operacionais que você paga</li>
  <li>📑 Contratos vinculados (cooperados anonimizados — LGPD)</li>
  <li>📥 Relatório PDF mensal pra download</li>
</ul>

<div style="text-align:center">
  <a href="${escapeHtml(link)}" class="button">Aceitar convite e definir senha</a>
</div>

<div class="info">
  <strong>⏰ Este link expira em 7 dias.</strong><br>
  Depois disso, peça ao administrador para enviar um novo convite.
</div>

<p style="font-size: 12px; color: #666;">Se o botão não funcionar, copie e cole este link no navegador:</p>
<div class="link-fallback">${escapeHtml(link)}</div>

<div class="footer">
  <p><strong>SISGD / CoopereBR</strong> — Sistema de Gestão de Geração Distribuída</p>
  <p>Se você não esperava este convite, ignore este email. Nada será criado.</p>
  <p>Dúvidas? Responda este email ou contate o administrador da cooperativa.</p>
</div>

</body>
</html>`;
  }
}

function escapeHtml(s: string | null | undefined): string {
  if (s === null || s === undefined) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
