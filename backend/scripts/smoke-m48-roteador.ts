/**
 * Smoke E2E programático — Sprint Funil M48 (22/06/2026) Camada 1 Motor.
 *
 * Decisão Q5 orquestrador: motor é SILENCIOSO (não dispara WA/email/Asaas),
 * então NÃO se aplica D-novo-WA-DEV-FALSE-OK. Valida APENAS que
 * Cooperado.roteamentoCaminho é gravado correto nos 3 cenários:
 *
 *   1. C_NOVO: jaRecebeCreditosGd=false → segue cadastro normal.
 *   2. A_MIGRACAO: jaRecebeCreditosGd=true + fornecedor='Soluna' (concorrente).
 *   3. B_REDIRECT_PARCEIRO: jaRecebeCreditosGd=true + fornecedor='CoopereBR'
 *      (mas tenantAlvo deve ser o MESMO da CoopereBR — vira C_NOVO porque
 *      cadastro é na própria CoopereBR; pra simular B real precisaria de
 *      outra cooperativa SISGD. Vou validar B usando alias hipotético OU
 *      criar cooperativa-teste).
 *
 * Cleanup idempotente.
 */
import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
import * as path from 'node:path';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { RoteamentoCadastroService } from '../src/roteamento-cadastro/roteamento-cadastro.service';

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

if (process.env.NODE_ENV === 'production' && process.env.SMOKE_FORCE_PROD !== 'true') {
  console.error('[ABORT] Smoke não roda em produção sem SMOKE_FORCE_PROD=true');
  process.exit(1);
}

const COOPEREBR_ID = 'cmn0ho8bx0000uox8wu96u6fd';
const COOPEREBR_TESTE_ID = 'cmn7qygzg0000uoawdtfvokt5'; // CoopereBR Teste
const CPFS = {
  C: '99988877701',
  A: '99988877702',
  B: '99988877703',
};

async function main() {
  const prisma = new PrismaClient();
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  const roteador = app.get(RoteamentoCadastroService);

  let passou = false;
  let ids: string[] = [];

  try {
    // Pre-cleanup
    await prisma.cooperado.deleteMany({
      where: { cpf: { in: Object.values(CPFS) } },
    });

    // ─── Cenário 1: C_NOVO (jaRecebeCreditosGd=false) ───
    console.log('[C1] C_NOVO — jaRecebeCreditosGd=false');
    const decC = await roteador.decidirCaminho({
      jaRecebeCreditosGd: false,
      cooperativaIdSugerida: COOPEREBR_ID,
    });
    if (decC.caminho !== 'C_NOVO') {
      console.error(`  ✗ Esperado C_NOVO, recebido ${decC.caminho}`);
      process.exit(1);
    }
    const coopC = await prisma.cooperado.create({
      data: {
        nomeCompleto: 'SMOKE M48 C',
        cpf: CPFS.C,
        email: 'lucbragatto+smoke-m48-c@gmail.com',
        cooperativaId: COOPEREBR_ID,
        status: 'PENDENTE',
        roteamentoCaminho: decC.caminho,
        roteamentoTenantAlvo: decC.tenantAlvo ?? null,
        roteamentoRazao: decC.razao,
        roteamentoDecididoEm: new Date(),
      },
    });
    ids.push(coopC.id);
    const checkC = await prisma.cooperado.findUnique({
      where: { id: coopC.id },
      select: { roteamentoCaminho: true, roteamentoTenantAlvo: true, roteamentoRazao: true },
    });
    if (checkC?.roteamentoCaminho !== 'C_NOVO' || checkC.roteamentoTenantAlvo !== null) {
      console.error(`  ✗ Banco inconsistente:`, checkC);
      process.exit(1);
    }
    console.log(`  ✓ Cooperado ${coopC.id} gravado com roteamentoCaminho='C_NOVO'`);
    console.log(`    razao: ${checkC.roteamentoRazao?.slice(0, 80)}`);

    // ─── Cenário 2: A_MIGRACAO (fornecedor concorrente fora-SISGD) ───
    console.log('\n[C2] A_MIGRACAO — fornecedor concorrente');
    const decA = await roteador.decidirCaminho({
      jaRecebeCreditosGd: true,
      fornecedorGdAtual: 'Soluna Energia Solar',
      cooperativaIdSugerida: COOPEREBR_ID,
    });
    if (decA.caminho !== 'A_MIGRACAO') {
      console.error(`  ✗ Esperado A_MIGRACAO, recebido ${decA.caminho}`);
      process.exit(1);
    }
    const coopA = await prisma.cooperado.create({
      data: {
        nomeCompleto: 'SMOKE M48 A',
        cpf: CPFS.A,
        email: 'lucbragatto+smoke-m48-a@gmail.com',
        cooperativaId: COOPEREBR_ID,
        status: 'PENDENTE',
        jaRecebeCreditosGd: true,
        fornecedorGdAtual: 'Soluna Energia Solar',
        roteamentoCaminho: decA.caminho,
        roteamentoTenantAlvo: decA.tenantAlvo ?? null,
        roteamentoRazao: decA.razao,
        roteamentoDecididoEm: new Date(),
      },
    });
    ids.push(coopA.id);
    const checkA = await prisma.cooperado.findUnique({
      where: { id: coopA.id },
      select: { roteamentoCaminho: true, roteamentoTenantAlvo: true, roteamentoRazao: true },
    });
    if (checkA?.roteamentoCaminho !== 'A_MIGRACAO') {
      console.error(`  ✗ Banco inconsistente:`, checkA);
      process.exit(1);
    }
    console.log(`  ✓ Cooperado ${coopA.id} gravado com roteamentoCaminho='A_MIGRACAO'`);
    console.log(`    razao: ${checkA.roteamentoRazao?.slice(0, 80)}`);

    // ─── Cenário 3: B_REDIRECT_PARCEIRO ───
    //
    // O alias 'CoopereBR' pertence ao tenant COOPEREBR_ID. Pra simular B,
    // o cadastro precisa acontecer em OUTRO tenant SISGD (CoopereBR Teste)
    // tentando criar um cliente que declara "CoopereBR" como fornecedor —
    // anti-canibalização redireciona pra CoopereBR.
    console.log('\n[C3] B_REDIRECT_PARCEIRO — alias bate com outro parceiro SISGD');
    const decB = await roteador.decidirCaminho({
      jaRecebeCreditosGd: true,
      fornecedorGdAtual: 'CoopereBR',
      cooperativaIdSugerida: COOPEREBR_TESTE_ID, // tentando cadastrar na Teste
    });
    if (decB.caminho !== 'B_REDIRECT_PARCEIRO') {
      console.error(`  ✗ Esperado B_REDIRECT_PARCEIRO, recebido ${decB.caminho}`);
      console.error(`    razao: ${decB.razao}`);
      process.exit(1);
    }
    if (decB.tenantAlvo !== COOPEREBR_ID) {
      console.error(`  ✗ tenantAlvo esperado ${COOPEREBR_ID}, recebido ${decB.tenantAlvo}`);
      process.exit(1);
    }
    const coopB = await prisma.cooperado.create({
      data: {
        nomeCompleto: 'SMOKE M48 B',
        cpf: CPFS.B,
        email: 'lucbragatto+smoke-m48-b@gmail.com',
        cooperativaId: COOPEREBR_TESTE_ID,
        status: 'PENDENTE',
        jaRecebeCreditosGd: true,
        fornecedorGdAtual: 'CoopereBR',
        roteamentoCaminho: decB.caminho,
        roteamentoTenantAlvo: decB.tenantAlvo ?? null,
        roteamentoRazao: decB.razao,
        roteamentoDecididoEm: new Date(),
      },
    });
    ids.push(coopB.id);
    const checkB = await prisma.cooperado.findUnique({
      where: { id: coopB.id },
      select: { roteamentoCaminho: true, roteamentoTenantAlvo: true, roteamentoRazao: true },
    });
    if (checkB?.roteamentoCaminho !== 'B_REDIRECT_PARCEIRO' || checkB.roteamentoTenantAlvo !== COOPEREBR_ID) {
      console.error(`  ✗ Banco inconsistente:`, checkB);
      process.exit(1);
    }
    console.log(`  ✓ Cooperado ${coopB.id} gravado com roteamentoCaminho='B_REDIRECT_PARCEIRO'`);
    console.log(`    tenantAlvo: ${checkB.roteamentoTenantAlvo} (CoopereBR)`);
    console.log(`    razao: ${checkB.roteamentoRazao?.slice(0, 80)}`);

    console.log('\n✓ SMOKE M48 PASSOU — 3 cenários C/A/B validados (motor advisory silencioso)');
    passou = true;
  } catch (err) {
    console.error('[FATAL]', err);
  } finally {
    console.log('\n[CLEANUP]');
    if (ids.length) {
      await prisma.cooperado.deleteMany({ where: { id: { in: ids } } });
    }
    await prisma.$disconnect();
    await app.close();
    process.exit(passou ? 0 : 1);
  }
}

main();
