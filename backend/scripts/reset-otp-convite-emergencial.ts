/**
 * Script efêmero — reset emergencial de OTP/bloqueio/reenvios/validação do
 * convite informado pra destravar smoke E2E do Luciano (05/06/2026).
 *
 * Zera TUDO do ciclo OTP atual:
 * - tentativas, reenvios, bloqueio, último envio
 * - código atual (hash + salt + expiração)
 * - validação (janela de 30min pro /auto-inscrever)
 *
 * NÃO toca em: usedAt (consume-once), expiresAt (validade do convite).
 *
 * Uso (qualquer):
 *   ts-node backend/scripts/reset-otp-convite-emergencial.ts <token>
 *   ts-node backend/scripts/reset-otp-convite-emergencial.ts --id <conviteId>
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const args = process.argv.slice(2);
  const useId = args[0] === '--id';
  const valor = useId ? args[1] : args[0];

  if (!valor) {
    console.error('Uso: <token> OU --id <conviteId>');
    process.exit(2);
  }

  const where = useId ? { id: valor } : { token: valor };

  const antes = await prisma.conviteConvenioMembro.findUnique({
    where: where as any,
    select: {
      id: true,
      token: true,
      nomeConvidado: true,
      telefone: true,
      expiresAt: true,
      usedAt: true,
      otpTentativas: true,
      otpReenvios: true,
      otpUltimoEnvioEm: true,
      otpBloqueadoAte: true,
      otpValidadoEm: true,
    },
  });

  if (!antes) {
    console.error('❌ Convite não encontrado.');
    process.exit(2);
  }

  console.log('=== ANTES ===');
  console.log(JSON.stringify(antes, null, 2));

  if (antes.usedAt) {
    console.warn('⚠️  Convite já foi USADO (usedAt preenchido). Reset não habilita reuso.');
  }
  if (antes.expiresAt <= new Date()) {
    console.warn('⚠️  Convite EXPIRADO. Reset não estende validade.');
  }

  const depois = await prisma.conviteConvenioMembro.update({
    where: where as any,
    data: {
      otpTentativas: 0,
      otpReenvios: 0,
      otpUltimoEnvioEm: null,
      otpBloqueadoAte: null,
      otpCodigoHash: null,
      otpSalt: null,
      otpExpiresAt: null,
      otpValidadoEm: null,
    },
    select: {
      id: true,
      token: true,
      telefone: true,
      nomeConvidado: true,
      otpTentativas: true,
      otpReenvios: true,
      otpUltimoEnvioEm: true,
      otpBloqueadoAte: true,
      otpValidadoEm: true,
    },
  });

  console.log('\n=== DEPOIS ===');
  console.log(JSON.stringify(depois, null, 2));
  console.log('\n✅ Reset aplicado. Próximos passos:');
  console.log('   1. Luciano clica "Enviar código" UMA vez no /cadastro?conv=<token>');
  console.log('   2. OTP chega no', depois.telefone, '(whitelisted)');
  console.log('   3. Cola código → valida → preenche wizard → submit');
  console.log('\nToken atual (cola na URL após /cadastro?conv=):');
  console.log('   ' + depois.token);
}

main()
  .catch((e) => {
    console.error('Erro no reset:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
