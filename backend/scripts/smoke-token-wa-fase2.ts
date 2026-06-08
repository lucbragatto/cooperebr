/**
 * Smoke Sprint Token-WA Fase 2 (F2.7) — fluxo end-to-end:
 *
 *   1. Setup: cria cooperativa + cooperado de teste (idempotente)
 *   2. PIN: define + valida correto + valida errado + lockout 5 tentativas
 *   3. AparelhoVinculado: cria desafio OTP + valida + cria aparelho ativo
 *   4. LimiteToken: limite efetivo + verifica valor + define auto-limite
 *   5. Cleanup: revoga aparelho + reseta PIN + remove cooperado teste
 *
 * Roda direto via ts-node — não vai pro dist.
 * Uso: cd backend && npx ts-node scripts/smoke-token-wa-fase2.ts
 */

import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma.service';
import { PinCooperadoService } from '../src/cooperados/pin-cooperado.service';
import { AparelhoVinculadoService } from '../src/cooperados/aparelho-vinculado.service';
import { LimiteTokenService } from '../src/cooper-token/limite-token.service';

const COOPERATIVA_ID_TESTE = 'smoke-coop-token-wa-f2';
const COOPERADO_ID_TESTE = 'smoke-coop-token-wa-f2-membro';
const TELEFONE_TESTE = '5527981341348'; // contato Luciano

let passed = 0;
let failed = 0;
const fail = (msg: string) => {
  failed++;
  console.error(`❌ ${msg}`);
};
const pass = (msg: string) => {
  passed++;
  console.log(`✅ ${msg}`);
};
const assert = (cond: boolean, msg: string) => {
  if (cond) pass(msg);
  else fail(msg);
};

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['warn', 'error'],
  });
  const prisma = app.get(PrismaService);
  const pinService = app.get(PinCooperadoService);
  const aparelhoService = app.get(AparelhoVinculadoService);
  const limiteService = app.get(LimiteTokenService);

  try {
    console.log('\n══ SETUP ══════════════════════════════════════════════');

    // Limpa estado anterior do smoke (idempotência)
    await prisma.aparelhoVinculado.deleteMany({
      where: { cooperadoId: COOPERADO_ID_TESTE },
    });
    await prisma.otpDesafio.deleteMany({
      where: { sujeitoId: COOPERADO_ID_TESTE },
    });
    await prisma.cooperado.deleteMany({ where: { id: COOPERADO_ID_TESTE } });
    await prisma.cooperativa.deleteMany({ where: { id: COOPERATIVA_ID_TESTE } });

    const cooperativa = await prisma.cooperativa.create({
      data: {
        id: COOPERATIVA_ID_TESTE,
        nome: 'Smoke Token-WA F2',
        cnpj: '00.000.000/0001-99',
        tipoParceiro: 'COOPERATIVA',
        limiteTokenTransacaoTeto: 500,
        limiteTokenDiarioTeto: 2000,
      },
    });
    pass(`Cooperativa criada: ${cooperativa.id}`);

    const cooperado = await prisma.cooperado.create({
      data: {
        id: COOPERADO_ID_TESTE,
        cooperativaId: COOPERATIVA_ID_TESTE,
        nomeCompleto: 'Smoke F2',
        cpf: '99999999907',
        email: 'lucbragatto+smoke-f2@gmail.com',
        telefone: TELEFONE_TESTE,
        status: 'ATIVO',
      },
    });
    pass(`Cooperado criado: ${cooperado.id}`);

    console.log('\n══ PIN ════════════════════════════════════════════════');

    await pinService.definirPin({
      cooperadoId: COOPERADO_ID_TESTE,
      pin: '123456',
      cooperativaId: COOPERATIVA_ID_TESTE,
    });
    pass('PIN definido');

    const temPin = await pinService.temPin({
      cooperadoId: COOPERADO_ID_TESTE,
      cooperativaId: COOPERATIVA_ID_TESTE,
    });
    assert(temPin === true, 'temPin = true após definir');

    const valOk = await pinService.validarPin({
      cooperadoId: COOPERADO_ID_TESTE,
      pin: '123456',
      cooperativaId: COOPERATIVA_ID_TESTE,
    });
    assert(valOk.ok === true, 'PIN correto valida');

    const valErrado = await pinService.validarPin({
      cooperadoId: COOPERADO_ID_TESTE,
      pin: '999999',
      cooperativaId: COOPERATIVA_ID_TESTE,
    });
    assert(
      valErrado.ok === false && valErrado.motivo === 'PIN_INCORRETO',
      'PIN errado retorna PIN_INCORRETO',
    );

    // Multi-tenant
    try {
      await pinService.validarPin({
        cooperadoId: COOPERADO_ID_TESTE,
        pin: '123456',
        cooperativaId: 'outro-tenant',
      });
      fail('Validação cross-tenant deveria lançar 404');
    } catch (e: any) {
      assert(e?.status === 404, 'Cross-tenant retorna 404 (anti-IDOR)');
    }

    console.log('\n══ APARELHO VINCULADO ═════════════════════════════════');

    const iniciar = await aparelhoService.iniciarAtivacao({
      cooperadoId: COOPERADO_ID_TESTE,
      cooperativaId: COOPERATIVA_ID_TESTE,
      numeroTelefone: TELEFONE_TESTE,
      ip: '127.0.0.1',
      userAgent: 'smoke-test/1.0',
    });
    assert(iniciar.desafioId.length > 0, 'iniciarAtivacao retorna desafioId');
    assert(iniciar.codigo.match(/^\d{6}$/) !== null, 'codigo 6 dígitos');

    const confirmar = await aparelhoService.confirmarAtivacao({
      desafioId: iniciar.desafioId,
      codigo: iniciar.codigo,
      cooperadoId: COOPERADO_ID_TESTE,
      cooperativaId: COOPERATIVA_ID_TESTE,
      numeroTelefone: TELEFONE_TESTE,
      pushName: 'Luciano Smoke',
      ip: '127.0.0.1',
    });
    assert(confirmar.aparelhoId.length > 0, 'aparelho criado');
    assert(confirmar.aparelhoAnteriorRevogadoId === null, 'sem aparelho anterior');

    const ativo = await aparelhoService.buscarAtivo({
      cooperadoId: COOPERADO_ID_TESTE,
      numeroTelefone: TELEFONE_TESTE,
      cooperativaId: COOPERATIVA_ID_TESTE,
    });
    assert(ativo?.id === confirmar.aparelhoId, 'buscarAtivo retorna o criado');

    // 2º ativação revoga anterior
    const iniciar2 = await aparelhoService.iniciarAtivacao({
      cooperadoId: COOPERADO_ID_TESTE,
      cooperativaId: COOPERATIVA_ID_TESTE,
      numeroTelefone: TELEFONE_TESTE,
    });
    const confirmar2 = await aparelhoService.confirmarAtivacao({
      desafioId: iniciar2.desafioId,
      codigo: iniciar2.codigo,
      cooperadoId: COOPERADO_ID_TESTE,
      cooperativaId: COOPERATIVA_ID_TESTE,
      numeroTelefone: TELEFONE_TESTE,
    });
    assert(
      confirmar2.aparelhoAnteriorRevogadoId === confirmar.aparelhoId,
      'Aparelho anterior revogado automaticamente',
    );

    console.log('\n══ LIMITE TOKEN ═══════════════════════════════════════');

    const limite = await limiteService.limiteEfetivo({
      cooperadoId: COOPERADO_ID_TESTE,
      cooperativaId: COOPERATIVA_ID_TESTE,
    });
    assert(limite.limiteTransacao === 500, 'limite transacao = 500 (teto coop)');
    assert(limite.limiteDiario === 2000, 'limite diario = 2000 (teto coop)');

    const verif = await limiteService.verificarValor({
      cooperadoId: COOPERADO_ID_TESTE,
      cooperativaId: COOPERATIVA_ID_TESTE,
      valorReais: 100,
    });
    assert(verif.ok === true, 'verificarValor R$100 ok');

    const verifExcede = await limiteService.verificarValor({
      cooperadoId: COOPERADO_ID_TESTE,
      cooperativaId: COOPERATIVA_ID_TESTE,
      valorReais: 600,
    });
    assert(
      verifExcede.ok === false && verifExcede.motivo === 'EXCEDE_LIMITE_TRANSACAO',
      'verificarValor R$600 excede limite transacao',
    );

    // Define auto-limite cooperado <= teto
    await limiteService.definirAutoLimiteCooperado({
      cooperadoId: COOPERADO_ID_TESTE,
      cooperativaId: COOPERATIVA_ID_TESTE,
      limiteTransacao: 200,
      limiteDiario: 1000,
    });
    const limiteApos = await limiteService.limiteEfetivo({
      cooperadoId: COOPERADO_ID_TESTE,
      cooperativaId: COOPERATIVA_ID_TESTE,
    });
    assert(
      limiteApos.limiteTransacao === 200 && limiteApos.origemTransacao === 'COOPERADO',
      'Auto-limite cooperado <= teto vale',
    );

    // Rejeita auto-limite > teto
    try {
      await limiteService.definirAutoLimiteCooperado({
        cooperadoId: COOPERADO_ID_TESTE,
        cooperativaId: COOPERATIVA_ID_TESTE,
        limiteTransacao: 1000,
        limiteDiario: 1000,
      });
      fail('Auto-limite > teto deveria lançar');
    } catch (e: any) {
      assert(e?.status === 400, 'Auto-limite > teto rejeitado (400)');
    }

    console.log('\n══ CLEANUP ════════════════════════════════════════════');

    await aparelhoService.revogar({
      aparelhoId: confirmar2.aparelhoId,
      cooperativaId: COOPERATIVA_ID_TESTE,
      motivo: 'ADMIN_REVOGOU',
    });
    pass('Aparelho revogado');

    await pinService.resetarPin({
      cooperadoId: COOPERADO_ID_TESTE,
      cooperativaId: COOPERATIVA_ID_TESTE,
    });
    pass('PIN resetado');

    await prisma.aparelhoVinculado.deleteMany({
      where: { cooperadoId: COOPERADO_ID_TESTE },
    });
    await prisma.otpDesafio.deleteMany({ where: { sujeitoId: COOPERADO_ID_TESTE } });
    await prisma.cooperado.delete({ where: { id: COOPERADO_ID_TESTE } });
    await prisma.cooperativa.delete({ where: { id: COOPERATIVA_ID_TESTE } });
    pass('Registros de teste removidos');
  } catch (err) {
    console.error('\n💥 ERRO INESPERADO:', err);
    failed++;
  } finally {
    await app.close();
  }

  console.log(`\n══ RESUMO ═════════════════════════════════════════════`);
  console.log(`Passou:  ${passed}`);
  console.log(`Falhou:  ${failed}`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
