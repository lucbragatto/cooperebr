/**
 * Bloco A — Sub-Fase B AMAGES — Fase 1 read-only.
 *
 * Investigações:
 *  1. Estado das cooperativas atuais (count, ativos)
 *  2. AMAGES já existe? Como? (cooperativa ou cooperado?)
 *  3. 4 pilotos Sub-Fase A: DIEGO, CAROLINA, ALMIR, THEOMAX — onde estão?
 *  4. Planos COMPENSADOS atuais (D-46.SEED — confirmar 3 publico=true)
 *  5. Flag BLOQUEIO_MODELOS_NAO_FIXO (env)
 *  6. UCs cadastradas em modelo CREDITOS_COMPENSADOS hoje
 *  7. Whitelist atual em backend/src/common/safety/whitelist-teste.ts
 *  8. Usina disponível pra AMAGES (capacidade livre)
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('═══════ Fase 1 read-only — Bloco A Sub-Fase B AMAGES ═══════\n');

  // 1. Cooperativas atuais
  const coops = await prisma.cooperativa.findMany({
    select: { id: true, nome: true, cnpj: true, ativo: true, tipoParceiro: true, planoSaasId: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  });
  console.log('1. Cooperativas atuais:');
  console.table(coops.map(c => ({
    id: c.id.slice(0, 12) + '...',
    nome: c.nome,
    cnpj: c.cnpj?.slice(0, 14) ?? '-',
    ativo: c.ativo,
    tipo: c.tipoParceiro,
    plano: c.planoSaasId ? c.planoSaasId.slice(0, 8) + '...' : '-',
  })));

  // 2. AMAGES — busca ampla
  console.log('\n2. AMAGES — busca ampla:');
  const amagesCoop = await prisma.cooperativa.findFirst({
    where: { nome: { contains: 'AMAGES', mode: 'insensitive' } },
    select: { id: true, nome: true, cnpj: true, ativo: true },
  });
  const amagesCoopByCNPJ = await prisma.cooperativa.findFirst({
    where: { cnpj: { contains: 'amages', mode: 'insensitive' } },
    select: { id: true, nome: true },
  });
  const amagesCooperado = await prisma.cooperado.findFirst({
    where: { nomeCompleto: { contains: 'AMAGES', mode: 'insensitive' } },
    select: { id: true, nomeCompleto: true, cpf: true, cooperativaId: true, status: true, ambienteTeste: true, tipoCooperado: true },
  });
  console.log('  Cooperativa AMAGES?', amagesCoop ? `SIM (id=${amagesCoop.id})` : 'NÃO');
  console.log('  Cooperado AMAGES?', amagesCooperado ? `SIM (id=${amagesCooperado.id}) ` + JSON.stringify(amagesCooperado) : 'NÃO');

  // 3. 4 pilotos Sub-Fase A
  console.log('\n3. 4 pilotos Sub-Fase A:');
  const apelidos = ['DIEGO', 'CAROLINA', 'ALMIR', 'THEOMAX'];
  for (const apelido of apelidos) {
    const p = await prisma.cooperado.findMany({
      where: { nomeCompleto: { contains: apelido, mode: 'insensitive' } },
      select: { id: true, nomeCompleto: true, cooperativaId: true, status: true, ambienteTeste: true, email: true, telefone: true },
      take: 3,
    });
    console.log(`  ${apelido}:`, p.length, 'hits');
    p.forEach(c => console.log(`    - ${c.id.slice(0,12)} | ${c.nomeCompleto} | ${c.status} | teste=${c.ambienteTeste} | ${c.email} | ${c.telefone}`));
  }

  // 4. Planos COMPENSADOS (D-46.SEED)
  console.log('\n4. Planos COMPENSADOS (D-46.SEED):');
  const planosComp = await prisma.plano.findMany({
    where: { modeloCobranca: 'CREDITOS_COMPENSADOS' as any },
    select: { id: true, nome: true, modeloCobranca: true, publico: true, ativo: true, cooperativaId: true },
  });
  console.table(planosComp.map(p => ({
    id: p.id.slice(0, 12),
    nome: p.nome,
    modelo: p.modeloCobranca,
    publico: p.publico,
    ativo: p.ativo,
    coop: p.cooperativaId?.slice(0, 8) ?? 'GLOBAL',
  })));

  // 5. BLOQUEIO_MODELOS_NAO_FIXO (env)
  console.log('\n5. ENV BLOQUEIO_MODELOS_NAO_FIXO =', process.env.BLOQUEIO_MODELOS_NAO_FIXO ?? '(unset; default true conforme .env.example)');

  // 6. UCs em CREDITOS_COMPENSADOS hoje (via Contrato.plano.modeloCobranca)
  console.log('\n6. Contratos em CREDITOS_COMPENSADOS hoje:');
  const ctrComp = await prisma.contrato.findMany({
    where: { plano: { modeloCobranca: 'CREDITOS_COMPENSADOS' as any } },
    select: { id: true, numero: true, status: true, cooperativaId: true, cooperadoId: true, planoId: true },
    take: 10,
  });
  console.log(`  Total visíveis: ${ctrComp.length}`);
  ctrComp.forEach(c => console.log(`  - ${c.numero} | ${c.status} | coop=${c.cooperativaId?.slice(0,8)}`));

  // 7. Usinas com capacidade livre
  console.log('\n7. Usinas CoopereBR (capacidade livre):');
  const coopBR = coops.find(c => c.nome.includes('CoopereBR') && !c.nome.includes('Teste'));
  if (coopBR) {
    const usinas = await prisma.usina.findMany({
      where: { cooperativaId: coopBR.id },
      select: { id: true, nome: true, capacidadeKwh: true, distribuidora: true },
    });
    for (const u of usinas) {
      const alocado = await prisma.contrato.aggregate({
        where: { usinaId: u.id, status: { in: ['ATIVO', 'PENDENTE_ATIVACAO'] } },
        _sum: { kwhContratoAnual: true },
      });
      console.log(`  - ${u.nome} | cap=${u.capacidadeKwh} | dist=${u.distribuidora} | alocado=${alocado._sum.kwhContratoAnual ?? 0}`);
    }
  }

  // 8. Sub-tipos UC (A4_VERDE, B3_COMERCIAL via modalidadeTarifaria + tipoFornecimento)
  console.log('\n8. UCs por modalidadeTarifaria + tipoFornecimento (sample distintos):');
  const modalidades = await prisma.uc.groupBy({
    by: ['modalidadeTarifaria', 'tipoFornecimento'],
    _count: { _all: true },
  });
  console.table(modalidades.map(m => ({ modalidade: m.modalidadeTarifaria, tipoForn: m.tipoFornecimento, count: m._count._all })));

  // 9. AsaasConfig CoopereBR
  console.log('\n9. AsaasConfig CoopereBR (status atual):');
  if (coopBR) {
    const cfg = await prisma.asaasConfig.findFirst({
      where: { cooperativaId: coopBR.id },
      select: { id: true, ambiente: true, updatedAt: true },
    });
    console.log('  ', cfg ?? 'NÃO existe');
  }

  // 10. PM2 status check (não disponível via prisma — só anotar)
  console.log('\n10. Pré-execução: confirmar pm2 list | grep cooperebr-backend (manualmente fora do script)');
}

main()
  .catch((err) => { console.error(err); process.exit(1); })
  .finally(() => prisma.$disconnect());
