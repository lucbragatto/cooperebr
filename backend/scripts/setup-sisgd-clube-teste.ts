/**
 * Setup SISGD no clube (TAREFA 2 — 08/06/2026).
 *
 * Cria/garante:
 * 1. Cooperado PJ "SISGD" SEM_UC na CoopereBR (telefone Luciano = 5527981341348)
 * 2. ContratoConvenio CV-SISGD-TESTE-001 com pagador=EMPRESA, SISGD como pagador
 * 3. Crédito de tokens de TESTE no saldo do SISGD (referenciaId rastreável)
 *
 * IMPORTANTE: SISGD compartilha telefone com cooperado Luciano (PF). Bot
 * VERIFICAR_COOPERADO faz findMany.first → ambiguidade. Reportar pro Luciano.
 *
 * Idempotente — pode rodar várias vezes sem duplicar.
 */
import { PrismaClient, Prisma } from '@prisma/client';
import { CooperTokenService } from '../src/cooper-token/cooper-token.service';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma.service';

const TENANT_COOPEREBR = 'cmn0ho8bx0000uox8wu96u6fd';
const SISGD_CPF_TESTE = '11222333000181'; // CNPJ válido só pra teste (não real)
const SISGD_TELEFONE = '5527981341348'; // Luciano testa pelo WA
const SISGD_EMAIL = 'lucbragatto+sisgd@gmail.com'; // alias Gmail Luciano

async function main() {
  console.log('═══ Setup SISGD Clube — TAREFA 2 (08/06/2026) ═══\n');

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['warn', 'error'],
  });
  const prisma = app.get(PrismaService);
  const cooperToken = app.get(CooperTokenService);

  try {
    // (0) Confirma tenant CoopereBR existe
    const tenant = await prisma.cooperativa.findUnique({
      where: { id: TENANT_COOPEREBR },
      select: { id: true, nome: true },
    });
    if (!tenant) {
      console.error(`❌ Tenant CoopereBR (${TENANT_COOPEREBR}) NÃO encontrado.`);
      process.exit(1);
    }
    console.log(`✅ Tenant confirmado: ${tenant.nome} (${tenant.id})\n`);

    // (1) Cooperado SISGD PJ SEM_UC
    console.log('── (1) Cooperado SISGD PJ SEM_UC ──');
    const existente = await prisma.cooperado.findFirst({
      where: { cpf: SISGD_CPF_TESTE, cooperativaId: TENANT_COOPEREBR },
    });
    let sisgd;
    if (existente) {
      sisgd = await prisma.cooperado.update({
        where: { id: existente.id },
        data: {
          status: 'ATIVO',
          telefone: SISGD_TELEFONE,
          email: SISGD_EMAIL,
          tipoCooperado: 'SEM_UC',
          tipoPessoa: 'PJ',
          razaoSocial: 'SISGDSOLAR SISTEMAS LTDA',
          ambienteTeste: true,
        },
      });
      console.log(`  🔄 ATUALIZADO id=${sisgd.id}`);
    } else {
      sisgd = await prisma.cooperado.create({
        data: {
          cooperativaId: TENANT_COOPEREBR,
          nomeCompleto: 'SISGDSOLAR SISTEMAS LTDA',
          razaoSocial: 'SISGDSOLAR SISTEMAS LTDA',
          tipoPessoa: 'PJ',
          cpf: SISGD_CPF_TESTE,
          email: SISGD_EMAIL,
          telefone: SISGD_TELEFONE,
          status: 'ATIVO',
          tipoCooperado: 'SEM_UC',
          ambienteTeste: true,
          termoAdesaoAceito: true,
          termoAdesaoAceitoEm: new Date(),
        },
      });
      console.log(`  ✅ CRIADO id=${sisgd.id}`);
    }
    console.log(`  Nome: ${sisgd.nomeCompleto} | CPF/CNPJ: ${sisgd.cpf} | Status: ${sisgd.status}`);

    // (2) ContratoConvenio CV-SISGD-TESTE-001 EMPRESA-pagador
    console.log('\n── (2) ContratoConvenio EMPRESA-pagador ──');
    const numero = 'CV-SISGD-TESTE-001';
    const existenteConv = await prisma.contratoConvenio.findUnique({ where: { numero } });
    let convenio;
    if (existenteConv) {
      convenio = await prisma.contratoConvenio.update({
        where: { id: existenteConv.id },
        data: {
          pagador: 'EMPRESA',
          pagadorCooperadoId: sisgd.id,
          empresaNome: 'SISGDSOLAR SISTEMAS LTDA',
          empresaCnpj: SISGD_CPF_TESTE,
          empresaEmail: SISGD_EMAIL,
          empresaTelefone: SISGD_TELEFONE,
          status: 'ATIVO',
          cooperativaId: TENANT_COOPEREBR,
        },
      });
      console.log(`  🔄 ATUALIZADO id=${convenio.id} numero=${convenio.numero}`);
    } else {
      convenio = await prisma.contratoConvenio.create({
        data: {
          numero,
          empresaNome: 'SISGDSOLAR SISTEMAS LTDA',
          empresaCnpj: SISGD_CPF_TESTE,
          empresaEmail: SISGD_EMAIL,
          empresaTelefone: SISGD_TELEFONE,
          status: 'ATIVO',
          cooperativaId: TENANT_COOPEREBR,
          tipo: 'OUTRO',
          pagador: 'EMPRESA',
          pagadorCooperadoId: sisgd.id,
        },
      });
      console.log(`  ✅ CRIADO id=${convenio.id} numero=${convenio.numero}`);
    }
    console.log(`  Pagador: ${convenio.pagador} | PagadorCooperadoId: ${convenio.pagadorCooperadoId}`);

    // (3) Creditar tokens de TESTE
    console.log('\n── (3) Creditar tokens TESTE ──');
    const referenciaId = `TESTE-F2-SETUP-SISGD-2026-06-08`;
    const quantidade = 500; // 500 tokens brutos (490 líquidos após taxa 2%)

    const credito = await (cooperToken as any).creditar({
      cooperadoId: sisgd.id,
      cooperativaId: TENANT_COOPEREBR,
      tipo: 'BONUS_INDICACAO', // valor do enum CooperTokenTipo — usado pra crédito manual de teste
      quantidade,
      valorEmissao: new Prisma.Decimal(0.10), // R$ 0,10 por token (referência)
      referenciaId,
      referenciaTabela: 'TESTE_MANUAL',
      expiracaoMeses: 24,
      forcarDisponivel: true, // pula regra "primeira fatura paga" pra teste
    });

    if (!credito) {
      console.log('  ⚠️ Crédito retornou null — verificar logs do CooperTokenService.');
    } else {
      console.log(`  ✅ CooperTokenLedger criado id=${credito.id}`);
      console.log(`     Quantidade bruta: ${quantidade} | Líquida (após taxa 2%): ${(quantidade * 0.98).toFixed(2)}`);
      console.log(`     ReferenciaId: ${referenciaId}`);
    }

    // (4) Reconfirma saldo via getSaldo
    console.log('\n── (4) Reconfirma saldo SISGD ──');
    const saldo = await (cooperToken as any).getSaldo(sisgd.id, TENANT_COOPEREBR);
    console.log(`  Saldo: ${JSON.stringify(saldo, null, 2)}`);

    // (5) Ambiguidade de telefone — reportar
    console.log('\n── (5) ⚠️ ATENÇÃO: ambiguidade de telefone ──');
    const conflitos = await prisma.cooperado.findMany({
      where: { telefone: SISGD_TELEFONE, status: 'ATIVO' },
      select: { id: true, nomeCompleto: true, tipoPessoa: true, cooperativaId: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    });
    console.log(`  Cooperados ATIVOS com telefone='${SISGD_TELEFONE}': ${conflitos.length}`);
    for (const c of conflitos) {
      console.log(`    - ${c.id} | ${c.nomeCompleto} | ${c.tipoPessoa ?? '?'} | created=${c.createdAt.toISOString()}`);
    }
    console.log('\n  Bot VERIFICAR_COOPERADO pega o PRIMEIRO match do findMany (sem orderBy explícito).');
    console.log('  Cooperado vencedor: provavelmente Luciano PF (mais antigo).');
    console.log('  Pra Luciano ver saldo do SISGD pelo WA, precisaria: (a) usar telefone diferente,');
    console.log('  (b) bot oferecer "qual cadastro?" se múltiplos matches, OU (c) priorizar PJ>PF.');
  } finally {
    await app.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
