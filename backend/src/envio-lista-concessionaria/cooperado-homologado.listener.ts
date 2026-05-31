import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '../prisma.service';
import { EmailService } from '../email/email.service';
import { WhatsappSenderService } from '../whatsapp/whatsapp-sender.service';
import { isAmbienteReal } from '../common/safety/ambiente';
import { ehEmailFake, ehTelefoneFake } from '../common/safety/whitelist-teste';
import { ENVIO_LISTA_EVENTS } from './envio-lista-concessionaria.events';
import type { CooperadoHomologadoEvent } from './envio-lista-concessionaria.events';
import { AsPlatform } from '../common/tenant-context';

/**
 * Sub-Fase 1 Fase 4 (M12, 18/05/2026) — Listas Concessionária.
 *
 * Reage ao evento `envio-lista.cooperado-homologado` enviando confirmação
 * pro cooperado via WhatsApp + Email.
 *
 * ⚠️ REGRA CONTATOS TESTE IMPRETERÍVEL — defense in depth (3 camadas)
 * (memórias: `regra_contato_teste_impreterivel.md`, `falha_regra_contatos_teste_18_05.md`):
 *
 * **Camada 1** — `isAmbienteReal()` (flag explícita `AMBIENTE_REAL=true` no `.env`).
 * NUNCA usar `NODE_ENV` direto: PM2 força `NODE_ENV='production'` em dev local
 * pra rodar `dist/` compilado. Default ausente = dev (fail-safe).
 *
 * **Camada 2** — `cooperado.ambienteTeste === true` força override mesmo em
 * produção real, protegendo dados teste que vazaram pra base de produção.
 *
 * **Camada 3** — `ehEmailFake`/`ehTelefoneFake` detectam padrões fake clássicos
 * do projeto (.invalid, @removido, +5511000000000, 999999, etc) e bloqueiam
 * dispatch como salvaguarda final, mesmo em produção real.
 *
 * Override aplica:
 *   - Telefone: 27981341348 (celular Luciano)
 *   - Email: lucbragatto+homologado@gmail.com
 *
 * Log auditável `motivo:` indica qual camada decidiu (DEV_AMBIENTE /
 * COOPERADO_TESTE_FLAG / PROD_REAL / BLOQUEADO_FAKE_FINAL).
 */
@Injectable()
export class CooperadoHomologadoListener {
  private readonly logger = new Logger(CooperadoHomologadoListener.name);

  private static readonly TELEFONE_OVERRIDE = '27981341348';
  private static readonly EMAIL_OVERRIDE = 'lucbragatto+homologado@gmail.com';

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
    private readonly whatsappSender: WhatsappSenderService,
  ) {}

  @OnEvent(ENVIO_LISTA_EVENTS.COOPERADO_HOMOLOGADO)

  @AsPlatform()
  async handleCooperadoHomologado(event: CooperadoHomologadoEvent): Promise<void> {
    // Só notifica quando o trigger efetivamente ativou o contrato.
    // Reenvios em contrato já ATIVO não disparam comunicação duplicada.
    if (!event.contratoAtivadoAgora) {
      this.logger.log(
        `[cooperado-homologado] Contrato ${event.contratoId} já estava ATIVO — notificação SKIPPED.`,
      );
      return;
    }

    const [cooperado, cooperativa, usina] = await Promise.all([
      this.prisma.cooperado.findUnique({
        where: { id: event.cooperadoId },
        select: { id: true, nomeCompleto: true, email: true, telefone: true, ambienteTeste: true },
      }),
      this.prisma.cooperativa.findUnique({
        where: { id: event.cooperativaId },
        select: { id: true, nome: true },
      }),
      this.prisma.usina.findUnique({
        where: { id: event.usinaId },
        select: { id: true, nome: true },
      }),
    ]);

    if (!cooperado || !cooperativa || !usina) {
      this.logger.warn(
        `[cooperado-homologado] Dados ausentes (cooperado=${!!cooperado}, cooperativa=${!!cooperativa}, usina=${!!usina}) — abortando notificação. event=${JSON.stringify(event)}`,
      );
      return;
    }

    // ⚠️ REGRA CONTATOS TESTE — 3 camadas defense in depth
    const ambienteReal = isAmbienteReal();
    const cooperadoTeste = cooperado.ambienteTeste === true;
    // Override quando: dev (não-real) OU cooperado marcado como teste
    const deveOverride = !ambienteReal || cooperadoTeste;

    const telefoneEnvio = deveOverride
      ? CooperadoHomologadoListener.TELEFONE_OVERRIDE
      : cooperado.telefone;
    const emailEnvio = deveOverride
      ? CooperadoHomologadoListener.EMAIL_OVERRIDE
      : cooperado.email;

    const motivo = !ambienteReal
      ? 'DEV_AMBIENTE'
      : cooperadoTeste
      ? 'COOPERADO_TESTE_FLAG'
      : 'PROD_REAL';

    // Log auditável EXPLÍCITO (rastreabilidade LGPD + investigação futura)
    this.logger.log(
      `[cooperado-homologado] ${JSON.stringify({
        cooperadoId: cooperado.id,
        cooperadoNome: cooperado.nomeCompleto,
        ambienteReal,
        cooperadoTeste,
        deveOverride,
        motivo,
        contatoOriginal: { telefone: cooperado.telefone, email: cooperado.email },
        contatoEnvio: { telefone: telefoneEnvio, email: emailEnvio },
        envioListaId: event.envioListaId,
        usina: usina.nome,
        cooperativa: cooperativa.nome,
      })}`,
    );

    // Camada 3 — salvaguarda final pré-dispatch.
    // Mesmo após overrides, se o contato resultante for pattern fake, BLOQUEIA.
    // Protege contra config errada (ex: AMBIENTE_REAL=true em dev por engano).
    if (telefoneEnvio && ehTelefoneFake(telefoneEnvio)) {
      this.logger.error(
        `[cooperado-homologado] CAMADA 3 BLOQUEOU telefone fake pós-override: ${telefoneEnvio} (cooperadoId=${cooperado.id}). WhatsApp NÃO enviado.`,
      );
    }
    if (emailEnvio && ehEmailFake(emailEnvio)) {
      this.logger.error(
        `[cooperado-homologado] CAMADA 3 BLOQUEOU email fake pós-override: ${emailEnvio} (cooperadoId=${cooperado.id}). Email NÃO enviado.`,
      );
    }
    const telefoneDispatch = telefoneEnvio && !ehTelefoneFake(telefoneEnvio) ? telefoneEnvio : null;
    const emailDispatch = emailEnvio && !ehEmailFake(emailEnvio) ? emailEnvio : null;

    // WhatsApp (best-effort, falha não bloqueia email) — usa telefoneDispatch (pós-Camada 3)
    if (telefoneDispatch) {
      try {
        const mensagem =
          `Olá ${cooperado.nomeCompleto}! 🎉\n\n` +
          `Sua adesão à ${cooperativa.nome} foi *homologada* pela concessionária.\n\n` +
          `Sua participação na usina *${usina.nome}* está ativa. ` +
          `Você passará a receber créditos na próxima fatura.\n\n` +
          `Equipe ${cooperativa.nome} ☀️`;
        await this.whatsappSender.enviarMensagem(telefoneDispatch, mensagem, {
          tipoDisparo: 'cooperado_homologado',
          disparoId: event.envioListaCooperadoId,
          cooperadoId: cooperado.id,
          cooperativaId: cooperativa.id,
        });
      } catch (err) {
        this.logger.warn(
          `[cooperado-homologado] Falha envio WhatsApp pra ${telefoneDispatch}: ${(err as Error).message}`,
        );
      }
    } else if (!telefoneEnvio) {
      this.logger.log(
        `[cooperado-homologado] Sem telefone pra envio (cooperado=${cooperado.id}) — WhatsApp SKIPPED.`,
      );
    }

    // Email (best-effort) — usa emailDispatch (pós-Camada 3)
    if (emailDispatch) {
      try {
        await this.emailService.enviarCooperadoHomologado(
          emailDispatch,
          {
            nomeCooperado: cooperado.nomeCompleto,
            nomeCooperativa: cooperativa.nome,
            nomeUsina: usina.nome,
            dataHomologacao: event.dataHomologacao,
            numeroProtocolo: event.numeroProtocolo,
          },
          cooperativa.id,
        );
      } catch (err) {
        this.logger.warn(
          `[cooperado-homologado] Falha envio email pra ${emailDispatch}: ${(err as Error).message}`,
        );
      }
    } else if (!emailEnvio) {
      this.logger.log(
        `[cooperado-homologado] Sem email pra envio (cooperado=${cooperado.id}) — Email SKIPPED.`,
      );
    }
  }
}
