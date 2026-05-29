/**
 * Bloco D (16/05/2026) — 3 crons proativos.
 *
 *  - CRON A: lembrete cooperado upload de docs pendentes (diária 10:00)
 *  - CRON B: alerta admin sobre cooperados com docs parados > N dias (diária 08:00)
 *  - CRON C: lembrete cooperado salvar email institucional no portal EDP
 *           (24h pós-criação UC + reforço 72h se admin marcou EDP-PENDENTE)
 *
 * Disciplina:
 *  - Whitelist LGPD em `email.service` e `whatsapp-sender.service` bloqueia
 *    envio real em dev (regra inegociável contatos teste).
 *  - Configs por tenant em ConfigTenant (sem migração schema).
 *  - Anti-spam via observacao livre em Cooperado.emailFaturasObservacao
 *    e DocumentoCooperado (createdAt do mais recente).
 */
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { ConfigTenantService } from '../config-tenant/config-tenant.service';
import { EmailService } from '../email/email.service';
import { WhatsappSenderService } from '../whatsapp/whatsapp-sender.service';
import { podeEnviarEmDev } from '../common/safety/whitelist-teste';

interface DocPendente {
  tipo: string;
  status: 'PENDENTE' | 'REPROVADO';
  motivo?: string | null;
}

interface CooperadoParado {
  nome: string;
  diasParado: number;
  docsPendentes: number;
}

@Injectable()
export class NotificacoesProativasService {
  private readonly logger = new Logger(NotificacoesProativasService.name);

  constructor(
    private prisma: PrismaService,
    private configTenant: ConfigTenantService,
    private emailService: EmailService,
    private whatsappSender: WhatsappSenderService,
  ) {}

  // ─── CRON A: lembrete cooperado ─────────────────────────────────

  async processarLembreteDocsCooperado(cooperativaId: string): Promise<{ enviados: number; pulados: number }> {
    const habilitado = await this.configTenant.get('cron_lembrete_doc_cooperado_ativo', cooperativaId);
    if (habilitado !== 'true') return { enviados: 0, pulados: 0 };

    const prazoHorasStr = await this.configTenant.get('cron_lembrete_doc_cooperado_horas', cooperativaId);
    const prazoHoras = prazoHorasStr ? Number(prazoHorasStr) : 48;
    if (!Number.isFinite(prazoHoras) || prazoHoras <= 0) return { enviados: 0, pulados: 0 };

    const maxTentStr = await this.configTenant.get('cron_lembrete_doc_cooperado_max_tentativas', cooperativaId);
    const maxTentativas = maxTentStr ? Number(maxTentStr) : 5;

    const cooperados = await this.prisma.cooperado.findMany({
      where: { cooperativaId, status: 'PENDENTE_DOCUMENTOS' },
      select: { id: true, nomeCompleto: true, email: true, telefone: true, cooperativaId: true },
    });

    let enviados = 0;
    let pulados = 0;

    for (const c of cooperados) {
      // Whitelist guard: se nem email nem WA puderem enviar agora, pular sem
      // gravar marker (em dev, marker false-positivo trava lembrete real depois)
      const podeEmail = c.email ? podeEnviarEmDev(c.email, 'EMAIL') : false;
      const podeWa = c.telefone ? podeEnviarEmDev(c.telefone, 'WA') : false;
      if (!podeEmail && !podeWa) {
        pulados++;
        continue;
      }

      const docs = await this.prisma.documentoCooperado.findMany({
        where: { cooperadoId: c.id },
        orderBy: { createdAt: 'desc' },
      });

      const ultimoEnviado = docs[0];
      const horasDesdeUltimo = ultimoEnviado
        ? (Date.now() - new Date(ultimoEnviado.createdAt).getTime()) / 36e5
        : Infinity;

      // Caso 1: cooperado nunca enviou docs (horasDesdeUltimo=Infinity) — lembra após prazo de criação do cooperado
      const horasDesdeCadastro = docs.length === 0
        ? (Date.now() - new Date((c as any).createdAt ?? Date.now()).getTime()) / 36e5
        : 0;
      const horasReferencia = docs.length === 0 ? horasDesdeCadastro : horasDesdeUltimo;
      if (horasReferencia < prazoHoras) {
        pulados++;
        continue;
      }

      // Filtrar docs pendentes/reprovados
      const docsPendentes: DocPendente[] = docs
        .filter(d => d.status === 'PENDENTE' || d.status === 'REPROVADO')
        .map(d => ({ tipo: d.tipo, status: d.status as 'PENDENTE' | 'REPROVADO', motivo: d.motivoRejeicao }));

      if (docsPendentes.length === 0 && docs.length > 0) {
        // tudo aprovado mas status=PENDENTE_DOCUMENTOS — situação estranha, pula
        pulados++;
        continue;
      }

      // Contador de tentativas via emailFaturasObservacao (overload temporário do campo livre)
      const obs = (c as any).emailFaturasObservacao ?? '';
      const tentMatch = /lembrete_doc:(\d+)/.exec(obs);
      const tentativaAtual = tentMatch ? Number(tentMatch[1]) + 1 : 1;
      if (tentativaAtual > maxTentativas) {
        pulados++;
        continue;
      }

      try {
        if (c.email) {
          await this.emailService.enviarLembreteDocsPendentes(
            { id: c.id, nomeCompleto: c.nomeCompleto, email: c.email, cooperativaId: c.cooperativaId },
            docsPendentes,
            tentativaAtual,
          );
        }
        if (c.telefone) {
          const texto = this.montarMsgWhatsappLembreteDoc(c.nomeCompleto, docsPendentes, tentativaAtual);
          await this.whatsappSender.enviarMensagem(c.telefone, texto, {
            tipoDisparo: 'LEMBRETE_DOC_COOPERADO',
            cooperadoId: c.id,
            cooperativaId: cooperativaId,
          });
        }

        // Persistir tentativa
        const novaObs = tentMatch
          ? obs.replace(/lembrete_doc:\d+/, `lembrete_doc:${tentativaAtual}`)
          : (obs ? `${obs};lembrete_doc:${tentativaAtual}` : `lembrete_doc:${tentativaAtual}`);
        await this.prisma.cooperado.update({
          where: { id: c.id },
          data: { emailFaturasObservacao: novaObs },
        });

        enviados++;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'erro desconhecido';
        this.logger.error(`Falha lembrete cooperado ${c.id}: ${msg}`);
      }
    }

    return { enviados, pulados };
  }

  private montarMsgWhatsappLembreteDoc(nome: string, docs: DocPendente[], tentativa: number): string {
    const linhas = docs
      .map(d => `${d.status === 'REPROVADO' ? '⚠️' : '🔴'} ${d.tipo}${d.motivo ? ` (${d.motivo})` : ''}`)
      .join('\n');
    const sufixo = tentativa > 1 ? ` (${tentativa}º lembrete)` : '';
    return [
      `Olá ${nome}, tudo bem? 👋${sufixo}`,
      '',
      'Pra finalizar seu cadastro na CoopereBR, faltam os documentos:',
      linhas,
      '',
      'Envie pelo portal: https://cooperebr.com.br/portal/documentos',
      'Dúvida? Responde aqui que o time te ajuda.',
    ].join('\n');
  }

  // ─── CRON B: alerta admin docs parados ──────────────────────────

  async processarAlertaAdminDocsParados(cooperativaId: string): Promise<{ alertado: boolean; cooperados: number }> {
    const habilitado = await this.configTenant.get('cron_alerta_admin_doc_ativo', cooperativaId);
    if (habilitado !== 'true') return { alertado: false, cooperados: 0 };

    const diasStr = await this.configTenant.get('cron_alerta_admin_doc_dias', cooperativaId);
    const diasLimite = diasStr ? Number(diasStr) : 7;
    if (!Number.isFinite(diasLimite) || diasLimite <= 0) return { alertado: false, cooperados: 0 };

    const emailAdmin = await this.configTenant.get('email_admin_alertas', cooperativaId);
    if (!emailAdmin) {
      this.logger.warn(`Tenant ${cooperativaId}: 'email_admin_alertas' não configurado, pulando CRON B`);
      return { alertado: false, cooperados: 0 };
    }

    const cooperativa = await this.prisma.cooperativa.findUnique({
      where: { id: cooperativaId },
      select: { nome: true },
    });
    if (!cooperativa) return { alertado: false, cooperados: 0 };

    const limiteData = new Date(Date.now() - diasLimite * 24 * 60 * 60 * 1000);
    const cooperados = await this.prisma.cooperado.findMany({
      where: {
        cooperativaId,
        status: 'PENDENTE_DOCUMENTOS',
        createdAt: { lt: limiteData },
      },
      select: { id: true, nomeCompleto: true, createdAt: true },
    });
    if (cooperados.length === 0) return { alertado: false, cooperados: 0 };

    const enriquecidos: CooperadoParado[] = await Promise.all(
      cooperados.map(async c => {
        const docs = await this.prisma.documentoCooperado.count({
          where: { cooperadoId: c.id, status: { in: ['PENDENTE', 'REPROVADO'] } },
        });
        const diasParado = Math.floor((Date.now() - new Date(c.createdAt).getTime()) / 86_400_000);
        return { nome: c.nomeCompleto, diasParado, docsPendentes: docs };
      }),
    );

    enriquecidos.sort((a, b) => b.diasParado - a.diasParado);

    try {
      await this.emailService.enviarAlertaAdminDocsParados(
        emailAdmin,
        cooperativa.nome,
        diasLimite,
        enriquecidos,
        cooperativaId,
      );
      return { alertado: true, cooperados: enriquecidos.length };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'erro desconhecido';
      this.logger.error(`Falha alerta admin tenant ${cooperativaId}: ${msg}`);
      return { alertado: false, cooperados: enriquecidos.length };
    }
  }

  // ─── CRON C: lembrete email EDP ─────────────────────────────────

  async processarLembreteEmailEdp(cooperativaId: string): Promise<{ enviados: number; pulados: number }> {
    const habilitado = await this.configTenant.get('cron_lembrete_email_edp_ativo', cooperativaId);
    if (habilitado !== 'true') return { enviados: 0, pulados: 0 };

    const horasStr = await this.configTenant.get('cron_lembrete_email_edp_horas', cooperativaId);
    const horasPrimario = horasStr ? Number(horasStr) : 24;
    const horasReforco = 72;
    const emailInstStr = await this.configTenant.get('email_institucional_parceiro', cooperativaId);
    const emailInstitucional = emailInstStr || process.env.EMAIL_USER || 'contato@cooperebr.com.br';

    // Buscar contratos ATIVOS criados há ≥ N horas com cooperado.emailFaturasAtivo=false
    const cutoffPrimario = new Date(Date.now() - horasPrimario * 3600_000);
    const cutoffReforco = new Date(Date.now() - horasReforco * 3600_000);

    const contratos = await this.prisma.contrato.findMany({
      where: {
        cooperativaId,
        status: 'ATIVO',
        createdAt: { lt: cutoffPrimario },
        cooperado: { emailFaturasAtivo: false },
      },
      select: {
        createdAt: true,
        cooperado: {
          select: { id: true, nomeCompleto: true, email: true, telefone: true, cooperativaId: true, emailFaturasObservacao: true },
        },
      },
    });

    let enviados = 0;
    let pulados = 0;
    for (const ctr of contratos) {
      const c = ctr.cooperado;
      // Whitelist guard (idem CRON A): não gravar marker false-positivo
      const podeEmail = c.email ? podeEnviarEmDev(c.email, 'EMAIL') : false;
      const podeWa = c.telefone ? podeEnviarEmDev(c.telefone, 'WA') : false;
      if (!podeEmail && !podeWa) {
        pulados++;
        continue;
      }

      const obs = c.emailFaturasObservacao ?? '';
      const jaEnviouPrimario = /lembrete_edp:1/.test(obs);
      const jaEnviouReforco = /lembrete_edp:2/.test(obs);

      // Reforço só dispara se obs == 'EDP-PENDENTE' E já passou 72h desde criação do contrato
      const passou72h = new Date(ctr.createdAt) < cutoffReforco;
      const adminMarcouPendente = obs.includes('EDP-PENDENTE');

      let tentativaNova: 1 | 2 | null = null;
      if (!jaEnviouPrimario) tentativaNova = 1;
      else if (jaEnviouPrimario && !jaEnviouReforco && passou72h && adminMarcouPendente) tentativaNova = 2;
      if (tentativaNova === null) {
        pulados++;
        continue;
      }

      try {
        if (c.email) {
          await this.emailService.enviarLembreteEmailEdp(
            { id: c.id, nomeCompleto: c.nomeCompleto, email: c.email, cooperativaId: c.cooperativaId },
            emailInstitucional,
            tentativaNova === 2,
          );
        }
        if (c.telefone) {
          const texto = this.montarMsgWhatsappLembreteEdp(c.nomeCompleto, emailInstitucional, tentativaNova === 2);
          await this.whatsappSender.enviarMensagem(c.telefone, texto, {
            tipoDisparo: 'LEMBRETE_EMAIL_EDP',
            cooperadoId: c.id,
            cooperativaId: cooperativaId,
          });
        }
        const marker = `lembrete_edp:${tentativaNova}`;
        const novaObs = obs.includes('lembrete_edp:1')
          ? obs.replace('lembrete_edp:1', marker)
          : (obs ? `${obs};${marker}` : marker);
        await this.prisma.cooperado.update({
          where: { id: c.id },
          data: { emailFaturasObservacao: novaObs },
        });
        enviados++;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'erro desconhecido';
        this.logger.error(`Falha lembrete EDP cooperado ${c.id}: ${msg}`);
      }
    }

    return { enviados, pulados };
  }

  private montarMsgWhatsappLembreteEdp(nome: string, emailInst: string, reforco: boolean): string {
    const prefixo = reforco ? '🔔 *[Reforço]* ' : '';
    return [
      `${prefixo}Olá ${nome}! ⚡`,
      '',
      'Pra você economizar na conta de luz com a CoopereBR, precisamos receber sua fatura EDP todo mês. Em *2 minutos* você cadastra:',
      '',
      '1. Acesse edponline.com.br',
      '2. Entre com seu CPF/CNPJ',
      '3. Menu "Minha conta" → "Email para envio de fatura"',
      `4. Digite: *${emailInst}*`,
      '5. Salve. 🎉',
      '',
      '⚠️ Sem esse passo, o desconto pode atrasar.',
      reforco ? 'Esse é o último lembrete automático — qualquer dúvida, responde aqui.' : 'Dúvida? Responde aqui que ajudo.',
    ].join('\n');
  }

  // ─── D-novo-BH (M37, 29/05/2026) — Despesas operacionais ────────
  //
  // 3 disparos async (fire-and-forget). Falha de envio NÃO bloqueia
  // operação principal. Whitelist LGPD em dev já protege contatos reais.

  /**
   * Avisa quem pode aprovar a despesa proposta.
   *
   * BH.3.2 (29/05): com workflow double-check universal, TODO mundo propõe
   * PROPOSTA. Notifica:
   *   - Admins do PARCEIRO (cooperativaId scope) EXCETO o propositor
   *   - Super Admins SISGD (escape valve pro cenário "1 admin só")
   *
   * Próprio propositor NUNCA recebe a notificação dele mesmo (mesmo que seja SA).
   *
   * Disparado por ContasPagarService.proporDespesa.
   */
  async notificarDespesaProposta(despesaId: string): Promise<void> {
    const d = await this.prisma.contaAPagar.findUnique({
      where: { id: despesaId },
      include: {
        usina: { select: { id: true, nome: true, apelidoInterno: true } },
        propostoPor: { select: { id: true, nome: true, email: true } },
      },
    });
    if (!d) return;

    // Admins do parceiro EXCETO propositor + Super Admins globais EXCETO propositor.
    // Distinct via Map(id) cobre o caso de SA também ser admin do parceiro.
    const [adminsParceiro, superAdmins] = await Promise.all([
      this.prisma.usuario.findMany({
        where: {
          cooperativaId: d.cooperativaId,
          perfil: 'ADMIN',
          id: { not: d.propostoPorUsuarioId ?? undefined },
        },
        select: { id: true, email: true, telefone: true, nome: true },
      }),
      this.prisma.usuario.findMany({
        where: {
          perfil: 'SUPER_ADMIN',
          id: { not: d.propostoPorUsuarioId ?? undefined },
        },
        select: { id: true, email: true, telefone: true, nome: true },
      }),
    ]);
    const dedup = new Map<string, typeof adminsParceiro[number]>();
    for (const u of [...adminsParceiro, ...superAdmins]) dedup.set(u.id, u);
    const admins = Array.from(dedup.values());

    const subj = `Nova despesa proposta — ${d.usina?.nome ?? 'usina'}`;
    const valorFmt = `R$ ${Number(d.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
    const html = [
      `<p>Olá,</p>`,
      `<p><strong>${d.propostoPor?.nome ?? 'Proprietário'}</strong> propôs uma despesa operacional:</p>`,
      `<ul>`,
      `<li><strong>Usina:</strong> ${d.usina?.nome} ${d.usina?.apelidoInterno ? `(${d.usina.apelidoInterno})` : ''}</li>`,
      `<li><strong>Categoria:</strong> ${d.categoria}</li>`,
      `<li><strong>Valor:</strong> ${valorFmt}</li>`,
      `<li><strong>Tratamento sugerido:</strong> ${d.tratamento}</li>`,
      `<li><strong>Descrição:</strong> ${d.descricao}</li>`,
      `</ul>`,
      `<p><a href="${process.env.FRONTEND_URL ?? ''}/dashboard/usinas/${d.usinaId}/despesas">Acesse o painel pra aprovar ou rejeitar</a>.</p>`,
    ].join('\n');
    const waText = `📋 Nova despesa proposta em *${d.usina?.nome ?? 'usina'}*: ${d.categoria} ${valorFmt}. Acesse o painel pra aprovar/rejeitar.`;

    for (const a of admins) {
      if (a.email) {
        await this.emailService.enviarEmail(a.email, subj, html, undefined, d.cooperativaId)
          .catch((err) => this.logger.error(`Email despesa-proposta falha admin=${a.id}: ${err.message}`));
      }
      if (a.telefone) {
        await this.whatsappSender.enviarMensagem(a.telefone, waText, { tipoDisparo: 'DESPESA_PROPOSTA', disparoId: despesaId, cooperativaId: d.cooperativaId })
          .catch((err) => this.logger.error(`WA despesa-proposta falha admin=${a.id}: ${err.message}`));
      }
    }
  }

  /**
   * Avisa proprietário que despesa foi aprovada.
   * Disparado por ContasPagarService.aprovarDespesa.
   */
  async notificarDespesaAprovada(despesaId: string): Promise<void> {
    const d = await this.prisma.contaAPagar.findUnique({
      where: { id: despesaId },
      include: {
        usina: { select: { id: true, nome: true } },
        propostoPor: { select: { id: true, nome: true, email: true, telefone: true } },
      },
    });
    if (!d || !d.propostoPor) return;

    const subj = `Despesa aprovada — ${d.usina?.nome ?? 'usina'}`;
    const valorFmt = `R$ ${Number(d.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
    const impacto = d.tratamento === 'DESCONTO_NO_REPASSE'
      ? 'O valor será abatido no próximo repasse mensal.'
      : d.tratamento === 'REEMBOLSO'
        ? 'O reembolso será processado conforme o acordo.'
        : 'Tratamento ASSUMIDO confirmado — sem reembolso ou desconto.';
    const html = [
      `<p>Olá ${d.propostoPor.nome},</p>`,
      `<p>A despesa que você propôs foi <strong>aprovada</strong>:</p>`,
      `<ul>`,
      `<li><strong>Usina:</strong> ${d.usina?.nome}</li>`,
      `<li><strong>Categoria:</strong> ${d.categoria}</li>`,
      `<li><strong>Valor:</strong> ${valorFmt}</li>`,
      `<li><strong>Tratamento:</strong> ${d.tratamento}</li>`,
      `</ul>`,
      `<p>${impacto}</p>`,
    ].join('\n');
    const waText = `✅ Despesa aprovada em *${d.usina?.nome ?? 'usina'}*: ${d.categoria} ${valorFmt}. ${impacto}`;

    if (d.propostoPor.email) {
      await this.emailService.enviarEmail(d.propostoPor.email, subj, html, undefined, d.cooperativaId)
        .catch((err) => this.logger.error(`Email despesa-aprovada falha prop=${d.propostoPor!.id}: ${err.message}`));
    }
    if (d.propostoPor.telefone) {
      await this.whatsappSender.enviarMensagem(d.propostoPor.telefone, waText, { tipoDisparo: 'DESPESA_APROVADA', disparoId: despesaId, cooperativaId: d.cooperativaId })
        .catch((err) => this.logger.error(`WA despesa-aprovada falha prop=${d.propostoPor!.id}: ${err.message}`));
    }
  }

  /**
   * Avisa proprietário que despesa foi rejeitada (com motivo).
   * Disparado por ContasPagarService.rejeitarDespesa.
   */
  async notificarDespesaRejeitada(despesaId: string): Promise<void> {
    const d = await this.prisma.contaAPagar.findUnique({
      where: { id: despesaId },
      include: {
        usina: { select: { id: true, nome: true } },
        propostoPor: { select: { id: true, nome: true, email: true, telefone: true } },
      },
    });
    if (!d || !d.propostoPor) return;

    const subj = `Despesa rejeitada — ${d.usina?.nome ?? 'usina'}`;
    const valorFmt = `R$ ${Number(d.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
    const motivo = d.rejeitadoMotivo ?? 'Motivo não informado.';
    const html = [
      `<p>Olá ${d.propostoPor.nome},</p>`,
      `<p>A despesa que você propôs foi <strong>rejeitada</strong>:</p>`,
      `<ul>`,
      `<li><strong>Usina:</strong> ${d.usina?.nome}</li>`,
      `<li><strong>Categoria:</strong> ${d.categoria}</li>`,
      `<li><strong>Valor:</strong> ${valorFmt}</li>`,
      `</ul>`,
      `<p><strong>Motivo:</strong> ${motivo}</p>`,
      `<p>Se quiser, ajuste e proponha novamente pelo painel.</p>`,
    ].join('\n');
    const waText = `❌ Despesa rejeitada em *${d.usina?.nome ?? 'usina'}*: ${d.categoria} ${valorFmt}.\n\nMotivo: ${motivo}`;

    if (d.propostoPor.email) {
      await this.emailService.enviarEmail(d.propostoPor.email, subj, html, undefined, d.cooperativaId)
        .catch((err) => this.logger.error(`Email despesa-rejeitada falha prop=${d.propostoPor!.id}: ${err.message}`));
    }
    if (d.propostoPor.telefone) {
      await this.whatsappSender.enviarMensagem(d.propostoPor.telefone, waText, { tipoDisparo: 'DESPESA_REJEITADA', disparoId: despesaId, cooperativaId: d.cooperativaId })
        .catch((err) => this.logger.error(`WA despesa-rejeitada falha prop=${d.propostoPor!.id}: ${err.message}`));
    }
  }
}
