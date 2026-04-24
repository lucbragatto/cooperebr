/**
 * Smoke test: envio SMTP + WhatsApp reais pro admin (Luciano).
 * Usa a whitelist existente (lucbragatto@gmail.com, +5527981341348).
 */
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { EmailService } from '../src/email/email.service';
import { WhatsappSenderService } from '../src/whatsapp/whatsapp-sender.service';
import { PrismaService } from '../src/prisma.service';

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['log', 'warn', 'error'] });
  const email = app.get(EmailService);
  const wa = app.get(WhatsappSenderService);
  const prisma = app.get(PrismaService);

  const destinoEmail = 'lucbragatto@gmail.com';
  const destinoTel = '+5527981341348';
  const quando = new Date().toISOString();

  // === SMTP ===
  console.log(`\n[SMTP] Enviando email para ${destinoEmail}...`);
  const assunto = 'SISGD SMTP test 25/04/2026';
  const html = `<p>Se você está recebendo isso, SMTP funcionou.</p>` +
               `<p>Primeiro email enviado com sucesso na história do SISGD.</p>` +
               `<p><small>Enviado em: ${quando}</small></p>`;
  const text = 'Se você está recebendo isso, SMTP funcionou. Primeiro email enviado com sucesso na história do SISGD.';

  const okEmail = await email.enviarEmail(destinoEmail, assunto, html, text);
  console.log(`[SMTP] Retorno enviarEmail: ${okEmail}`);

  // Checa email_logs
  const ultimoEmail: any = await prisma.$queryRawUnsafe(
    `SELECT destinatario, status, erro, "criadoEm" FROM email_logs WHERE destinatario = $1 ORDER BY "criadoEm" DESC LIMIT 1`,
    destinoEmail,
  );
  if (ultimoEmail.length > 0) {
    const r = ultimoEmail[0];
    console.log(`[SMTP] Último log: status=${r.status} em=${r.criadoEm.toISOString()} erro=${r.erro ?? '-'}`);
  } else {
    console.log(`[SMTP] Sem entrada em email_logs (pode ter sido SKIPPED pela whitelist)`);
  }

  // === WhatsApp ===
  console.log(`\n[WA] Enviando mensagem para ${destinoTel}...`);
  const mensagem = `SISGD WhatsApp test 25/04/2026\n\nSe você está recebendo isso, WhatsApp funcionou.\nEnviado em: ${quando}`;

  try {
    await wa.enviarMensagem(destinoTel, mensagem, { tipoDisparo: 'SMOKE_TEST' });
    console.log(`[WA] enviarMensagem retornou sem erro`);
  } catch (err: any) {
    console.error(`[WA] Erro: ${err.message}`);
  }

  // Checa mensagens_whatsapp
  const ultimaMsg: any = await prisma.$queryRawUnsafe(
    `SELECT telefone, status, "createdAt" FROM mensagens_whatsapp WHERE "tipoDisparo" = 'SMOKE_TEST' ORDER BY "createdAt" DESC LIMIT 1`,
  );
  if (ultimaMsg.length > 0) {
    const r = ultimaMsg[0];
    console.log(`[WA] Último log: status=${r.status} tel=${r.telefone} em=${r.createdAt.toISOString()}`);
  } else {
    console.log(`[WA] Sem entrada em mensagens_whatsapp (SKIPPED ou não registrou)`);
  }

  await app.close();
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
