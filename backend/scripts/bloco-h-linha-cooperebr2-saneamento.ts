/**
 * Bloco H' — H'.5 (Cooperebr2) + H'.4 (saneamento Exfishes) + H'.6 (apelidoInterno cooperebr1).
 * Idempotente: cada passo skipa se já feito.
 */
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  console.log('═══ H linha.5 + H linha.4 + H linha.6 ═══\n');

  const coopBR = await prisma.cooperativa.findFirst({
    where: { nome: 'CoopereBR' },
    select: { id: true, nome: true },
  });
  if (!coopBR) throw new Error('CoopereBR não encontrada');
  console.log(`CoopereBR id=${coopBR.id}`);

  // ─── H linha.5: Cadastrar Cooperebr2 ──────────────────────────────
  console.log('\n[H linha.5] Cadastrar Cooperebr2 (Linhares 2)');
  let cooperebr2 = await prisma.usina.findFirst({
    where: { apelidoInterno: 'cooperebr2' },
  });
  if (cooperebr2) {
    console.log(`  → já existe id=${cooperebr2.id} (skip)`);
  } else {
    cooperebr2 = await prisma.usina.create({
      data: {
        nome: 'COOPERE BR - Usina Linhares 2',
        apelidoInterno: 'cooperebr2',
        potenciaKwp: 1000,
        capacidadeKwh: 157000,
        producaoMensalKwh: 157000,
        cidade: 'Linhares',
        estado: 'ES',
        enderecoLogradouro: 'Estrada Linhares X Povoação',
        enderecoNumero: 'SN',
        enderecoBairro: 'Área Rural',
        enderecoCep: '29900-001',
        distribuidora: 'EDP_ES',
        cooperativaId: coopBR.id,
        statusHomologacao: 'HOMOLOGADA',
        dataInicioProducao: new Date('2026-02-15'),
        cnpjUsina: '41604843000184',
        formaAquisicao: 'ALUGUEL',
        formaPagamentoDono: 'PERCENTUAL',
        numeroContratoEdp: 'EDP-ES-04123/2025 + EDP-ES-04124/2025',
        dataContratoEdp: new Date('2025-04-14'),
        observacoes:
          'Bloco H linha (16/05/2026) — cadastro inicial. formaAquisicao=ALUGUEL e formaPagamentoDono=PERCENTUAL ' +
          'aplicados como default provisório (CLAUDE.md cita "3 usinas arrendadas"; nota técnica Exfishes ' +
          'cita "usinas locadas, arrendadas"). Confirmar valores reais com Luciano após dossiê judicial. ' +
          'CNPJ titular EDP = 41.604.843/0001-84 (mesmo CNPJ CoopereBR — titularidade contratual CUSD/CCER, ' +
          'não significa propriedade do ativo solar). CUSD EDP-ES-04123/2025 assinado 14/04/2025, vigência 16/09/2025.',
      },
    });
    console.log(`  ✅ Criada id=${cooperebr2.id}`);
  }
  console.log({
    id: cooperebr2.id,
    nome: cooperebr2.nome,
    apelido: cooperebr2.apelidoInterno,
    kwp: cooperebr2.potenciaKwp?.toString(),
    cap: cooperebr2.capacidadeKwh?.toString(),
    dist: cooperebr2.distribuidora,
    cnpj: cooperebr2.cnpjUsina,
    contratoEdp: cooperebr2.numeroContratoEdp,
    forma: cooperebr2.formaAquisicao,
    pagDono: cooperebr2.formaPagamentoDono,
    dataCusd: cooperebr2.dataContratoEdp,
  });

  // ─── H linha.4: Saneamento CTR-000134 Exfishes ───────────────────
  console.log('\n[H linha.4] Saneamento CTR-000134 Exfishes');
  const exfishesCtrAntes = await prisma.contrato.findUnique({
    where: { id: 'cmn0ds7w0003cuolsty25olf8' },
    select: { id: true, numero: true, status: true, usinaId: true, kwhContratoAnual: true, kwhContratoMensal: true, percentualUsina: true,
      usina: { select: { nome: true, apelidoInterno: true } },
    },
  });
  console.log('ANTES:', JSON.stringify(exfishesCtrAntes, null, 2));

  const exfishesCtrDepois = await prisma.contrato.update({
    where: { id: 'cmn0ds7w0003cuolsty25olf8' },
    data: {
      usinaId: cooperebr2.id,
      kwhContratoAnual: 720000,
      kwhContratoMensal: 60000,
      percentualUsina: 8,
    },
    select: { id: true, numero: true, status: true, usinaId: true, kwhContratoAnual: true, kwhContratoMensal: true, percentualUsina: true,
      usina: { select: { nome: true, apelidoInterno: true } },
    },
  });
  console.log('\nDEPOIS:', JSON.stringify(exfishesCtrDepois, null, 2));

  // ─── H linha.6: Apelido cooperebr1 ───────────────────────────────
  console.log('\n[H linha.6] Apelidar Cooperebr1 (Linhares 1)');
  const linharesAntes = await prisma.usina.findUnique({
    where: { id: 'usina-linhares' },
    select: { id: true, nome: true, apelidoInterno: true, distribuidora: true, cooperativaId: true },
  });
  console.log('ANTES:', linharesAntes);

  if (linharesAntes?.apelidoInterno === 'cooperebr1') {
    console.log('  → já apelidada (skip)');
  } else {
    const linharesDepois = await prisma.usina.update({
      where: { id: 'usina-linhares' },
      data: { apelidoInterno: 'cooperebr1' },
      select: { id: true, nome: true, apelidoInterno: true },
    });
    console.log('  ✅ DEPOIS:', linharesDepois);
  }

  // ─── Resumo final ────────────────────────────────────────────────
  console.log('\n═══ Resumo ═══');
  const todasUsinas = await prisma.usina.findMany({
    where: { cooperativaId: coopBR.id },
    select: { id: true, nome: true, apelidoInterno: true, distribuidora: true },
    orderBy: { createdAt: 'asc' },
  });
  console.table(todasUsinas.map(u => ({
    id: u.id.length > 18 ? u.id.slice(0, 18) + '...' : u.id,
    nome: u.nome,
    apelido: u.apelidoInterno ?? '-',
    dist: u.distribuidora ?? '-',
  })));
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
