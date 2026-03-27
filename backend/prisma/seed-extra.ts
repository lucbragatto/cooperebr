import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Cooperativa real (do admin logado)
const COOPERATIVA_ID = 'cmn0ho8bx0000uox8wu96u6fd';

async function main() {
  console.log('🌱 Seed Extra — Dados fictícios realistas\n');

  // ─── Verificar cooperativa ──────────────────────────────────────────────────
  const cooperativa = await prisma.cooperativa.findUnique({ where: { id: COOPERATIVA_ID } });
  if (!cooperativa) {
    // Fallback: buscar qualquer cooperativa existente
    const any = await prisma.cooperativa.findFirst();
    if (!any) throw new Error('Nenhuma cooperativa encontrada. Rode o seed principal primeiro.');
    console.log(`⚠️  Cooperativa ${COOPERATIVA_ID} não encontrada, usando ${any.id} (${any.nome})`);
    // Atualizar a constante não é possível, mas continuamos com o ID encontrado
  }
  const coopId = cooperativa ? COOPERATIVA_ID : (await prisma.cooperativa.findFirst())!.id;
  console.log(`📌 Cooperativa: ${coopId}\n`);

  // ─── 2 Usinas ───────────────────────────────────────────────────────────────
  console.log('1. Criando Usinas...');

  let usinaGuarapari = await prisma.usina.findFirst({ where: { nome: 'Usina Solar Guarapari' } });
  if (!usinaGuarapari) {
    usinaGuarapari = await prisma.usina.create({
      data: {
        nome: 'Usina Solar Guarapari',
        potenciaKwp: 250,
        capacidadeKwh: 37500,
        producaoMensalKwh: 31250,
        cidade: 'Guarapari',
        estado: 'ES',
        statusHomologacao: 'EM_PRODUCAO',
        dataHomologacao: new Date('2025-06-15'),
        dataInicioProducao: new Date('2025-07-01'),
        proprietarioNome: 'Energia Verde Ltda',
        proprietarioCpfCnpj: '11.111.111/0001-11',
        proprietarioTipo: 'PJ',
        proprietarioEmail: 'contato@energiaverde.com.br',
        proprietarioTelefone: '(27) 3200-1100',
        cooperativaId: coopId,
      },
    });
  }
  console.log(`   ✅ ${usinaGuarapari.nome} (${usinaGuarapari.id})`);

  let usinaSerra = await prisma.usina.findFirst({ where: { nome: 'Usina Solar Serra' } });
  if (!usinaSerra) {
    usinaSerra = await prisma.usina.create({
      data: {
        nome: 'Usina Solar Serra',
        potenciaKwp: 180,
        capacidadeKwh: 27000,
        producaoMensalKwh: 22500,
        cidade: 'Serra',
        estado: 'ES',
        statusHomologacao: 'EM_PRODUCAO',
        dataHomologacao: new Date('2025-09-01'),
        dataInicioProducao: new Date('2025-10-01'),
        proprietarioNome: 'Solar Serrana SA',
        proprietarioCpfCnpj: '22.222.222/0001-22',
        proprietarioTipo: 'PJ',
        proprietarioEmail: 'contato@solarserrana.com.br',
        proprietarioTelefone: '(27) 3200-2200',
        cooperativaId: coopId,
      },
    });
  }
  console.log(`   ✅ ${usinaSerra.nome} (${usinaSerra.id})\n`);

  // ─── Plano para individuais ─────────────────────────────────────────────────
  let planoIndividual = await prisma.plano.findFirst({ where: { nome: 'Plano Individual Residencial' } });
  if (!planoIndividual) {
    planoIndividual = await prisma.plano.create({
      data: {
        nome: 'Plano Individual Residencial',
        descricao: 'Plano para cooperados individuais com desconto fixo na fatura',
        modeloCobranca: 'FIXO_MENSAL',
        descontoBase: 18,
        cooperativaId: coopId,
      },
    });
  }
  console.log(`📋 Plano: ${planoIndividual.nome} (${planoIndividual.id})\n`);

  // ─── 5 Cooperados individuais ───────────────────────────────────────────────
  console.log('2. Criando 5 cooperados individuais...');

  const cooperadosData = [
    {
      nome: 'Carlos Eduardo Prata',
      cpf: '123.456.789-01',
      email: 'carlos.prata@gmail.com',
      telefone: '(27) 99100-0001',
      status: 'ATIVO' as const,
      ucs: [
        { numero: 'UC-CARLOS-001', endereco: 'Rua das Flores, 100, Jardim Camburi', cidade: 'Vitória', estado: 'ES' },
        { numero: 'UC-CARLOS-002', endereco: 'Av. Dante Michelini, 500, Praia de Camburi', cidade: 'Vitória', estado: 'ES' },
      ],
    },
    {
      nome: 'Beatriz Santos',
      cpf: '234.567.890-12',
      email: 'beatriz.santos@gmail.com',
      telefone: '(27) 99100-0002',
      status: 'ATIVO' as const,
      ucs: [
        { numero: 'UC-BEATRIZ-001', endereco: 'Rua Sete de Setembro, 45, Centro', cidade: 'Vila Velha', estado: 'ES' },
      ],
    },
    {
      nome: 'Fernando Augusto',
      cpf: '345.678.901-23',
      email: 'fernando.augusto@gmail.com',
      telefone: '(27) 99100-0003',
      status: 'ATIVO' as const,
      ucs: [
        { numero: 'UC-FERNANDO-001', endereco: 'Rua Amazonas, 220, Itapuã', cidade: 'Vila Velha', estado: 'ES' },
      ],
    },
    {
      nome: 'Luciana Meireles',
      cpf: '456.789.012-34',
      email: 'luciana.meireles@gmail.com',
      telefone: '(27) 99100-0004',
      status: 'ATIVO' as const,
      ucs: [
        { numero: 'UC-LUCIANA-001', endereco: 'Rua Goiás, 80, Praia da Costa', cidade: 'Vila Velha', estado: 'ES' },
        { numero: 'UC-LUCIANA-002', endereco: 'Av. Champagnat, 300, Praia da Costa', cidade: 'Vila Velha', estado: 'ES' },
        { numero: 'UC-LUCIANA-003', endereco: 'Rua Minas Gerais, 150, Praia da Costa', cidade: 'Vila Velha', estado: 'ES' },
      ],
    },
    {
      nome: 'Roberto Fonseca',
      cpf: '567.890.123-45',
      email: 'roberto.fonseca@gmail.com',
      telefone: '(27) 99100-0005',
      status: 'ATIVO' as const,
      ucs: [
        { numero: 'UC-ROBERTO-001', endereco: 'Rua São Paulo, 400, Laranjeiras', cidade: 'Serra', estado: 'ES' },
      ],
    },
  ];

  const cooperadoIds: Record<string, string> = {};
  const ucIds: Record<string, string[]> = {};
  const contratoIds: Record<string, string[]> = {};

  for (const c of cooperadosData) {
    const cooperado = await prisma.cooperado.upsert({
      where: { cpf: c.cpf },
      update: {},
      create: {
        nomeCompleto: c.nome,
        cpf: c.cpf,
        email: c.email,
        telefone: c.telefone,
        status: c.status,
        cooperativaId: coopId,
        tipoPessoa: 'PF',
        cotaKwhMensal: 300,
        pixChave: c.cpf,
        pixTipo: 'CPF',
      },
    });
    cooperadoIds[c.email] = cooperado.id;
    ucIds[c.email] = [];
    contratoIds[c.email] = [];

    for (const uc of c.ucs) {
      let ucRecord = await prisma.uc.findFirst({ where: { numero: uc.numero } });
      if (!ucRecord) {
        ucRecord = await prisma.uc.create({
          data: {
            numero: uc.numero,
            endereco: uc.endereco,
            cidade: uc.cidade,
            estado: uc.estado,
            cooperadoId: cooperado.id,
            cooperativaId: coopId,
          },
        });
      }
      ucIds[c.email].push(ucRecord.id);

      // Criar contrato (Roberto Fonseca não tem usina — lista de espera)
      if (c.cpf !== '567.890.123-45') {
        const contratoNum = `CONT-${uc.numero}`;
        let contrato = await prisma.contrato.findFirst({ where: { numero: contratoNum } });
        if (!contrato) {
          const usina = c.nome.includes('Luciana') ? usinaSerra : usinaGuarapari;
          contrato = await prisma.contrato.create({
            data: {
              numero: contratoNum,
              cooperadoId: cooperado.id,
              ucId: ucRecord.id,
              usinaId: usina.id,
              planoId: planoIndividual.id,
              dataInicio: new Date('2025-04-01'),
              percentualDesconto: 18,
              status: 'ATIVO',
              cooperativaId: coopId,
            },
          });
        }
        contratoIds[c.email].push(contrato.id);
      }
    }

    console.log(`   ✅ ${c.nome} — ${c.ucs.length} UC(s), ${contratoIds[c.email].length} contrato(s)`);
  }
  console.log();

  // ─── Cobranças Carlos Eduardo (12 meses) ────────────────────────────────────
  console.log('3. Criando cobranças para Carlos Eduardo (12 meses)...');

  const carlosContratoId = contratoIds['carlos.prata@gmail.com'][0];
  if (carlosContratoId) {
    for (let i = 0; i < 12; i++) {
      const mesRef = ((3 - i + 24) % 12) || 12; // março 2026 para trás
      const anoRef = i < 3 ? 2026 : 2025;
      const vencimento = new Date(anoRef, mesRef - 1, 10);

      let status: 'PAGO' | 'PENDENTE' | 'VENCIDO';
      if (i < 3) status = i < 1 ? 'PENDENTE' : (i < 2 ? 'PENDENTE' : 'PENDENTE');
      // 6 pagas (meses antigos), 3 pendentes (recentes), 3 vencidas (intermediários)
      if (i >= 6) status = 'PAGO';
      else if (i >= 3) status = 'VENCIDO';
      else status = 'PENDENTE';

      const valorBruto = 180 + Math.random() * 40; // R$180-220

      const existing = await prisma.cobranca.findFirst({
        where: { contratoId: carlosContratoId, mesReferencia: mesRef, anoReferencia: anoRef },
      });
      if (!existing) {
        const valorDesconto = valorBruto * 0.18;
        await prisma.cobranca.create({
          data: {
            contratoId: carlosContratoId,
            mesReferencia: mesRef,
            anoReferencia: anoRef,
            valorBruto: Math.round(valorBruto * 100) / 100,
            percentualDesconto: 18,
            valorDesconto: Math.round(valorDesconto * 100) / 100,
            valorLiquido: Math.round((valorBruto - valorDesconto) * 100) / 100,
            status,
            dataVencimento: vencimento,
            dataPagamento: status === 'PAGO' ? new Date(vencimento.getTime() - 2 * 86400000) : null,
            valorPago: status === 'PAGO' ? Math.round((valorBruto - valorDesconto) * 100) / 100 : null,
            kwhEntregue: 280 + Math.random() * 40,
            cooperativaId: coopId,
          },
        });
      }
    }
    console.log('   ✅ 12 cobranças criadas (6 PAGO, 3 PENDENTE, 3 VENCIDO)\n');
  }

  // ─── Cobranças Beatriz (6 meses) ────────────────────────────────────────────
  console.log('4. Criando cobranças para Beatriz Santos (6 meses)...');

  const beatrizContratoId = contratoIds['beatriz.santos@gmail.com'][0];
  if (beatrizContratoId) {
    for (let i = 0; i < 6; i++) {
      const mesRef = ((3 - i + 24) % 12) || 12;
      const anoRef = i < 3 ? 2026 : 2025;
      const vencimento = new Date(anoRef, mesRef - 1, 15);

      // 4 pagas, 2 pendentes
      const status: 'PAGO' | 'PENDENTE' = i >= 2 ? 'PAGO' : 'PENDENTE';
      const valorBruto = 130 + Math.random() * 30;

      const existing = await prisma.cobranca.findFirst({
        where: { contratoId: beatrizContratoId, mesReferencia: mesRef, anoReferencia: anoRef },
      });
      if (!existing) {
        const valorDesconto = valorBruto * 0.18;
        await prisma.cobranca.create({
          data: {
            contratoId: beatrizContratoId,
            mesReferencia: mesRef,
            anoReferencia: anoRef,
            valorBruto: Math.round(valorBruto * 100) / 100,
            percentualDesconto: 18,
            valorDesconto: Math.round(valorDesconto * 100) / 100,
            valorLiquido: Math.round((valorBruto - valorDesconto) * 100) / 100,
            status,
            dataVencimento: vencimento,
            dataPagamento: status === 'PAGO' ? new Date(vencimento.getTime() - 86400000) : null,
            valorPago: status === 'PAGO' ? Math.round((valorBruto - valorDesconto) * 100) / 100 : null,
            kwhEntregue: 200 + Math.random() * 30,
            cooperativaId: coopId,
          },
        });
      }
    }
    console.log('   ✅ 6 cobranças criadas (4 PAGO, 2 PENDENTE)\n');
  }

  // ─── Cobranças Fernando (inadimplente — 2 faturas vencidas) ──────────────────
  console.log('5. Criando cobranças para Fernando Augusto (inadimplente)...');

  const fernandoContratoId = contratoIds['fernando.augusto@gmail.com'][0];
  if (fernandoContratoId) {
    const fernandoCobr = [
      { mesRef: 1, anoRef: 2026, status: 'VENCIDO' as const, venc: new Date(2026, 0, 10) },
      { mesRef: 2, anoRef: 2026, status: 'VENCIDO' as const, venc: new Date(2026, 1, 10) },
      { mesRef: 3, anoRef: 2026, status: 'PENDENTE' as const, venc: new Date(2026, 2, 10) },
    ];
    for (const cb of fernandoCobr) {
      const existing = await prisma.cobranca.findFirst({
        where: { contratoId: fernandoContratoId, mesReferencia: cb.mesRef, anoReferencia: cb.anoRef },
      });
      if (!existing) {
        const valorBruto = 160;
        const valorDesconto = valorBruto * 0.18;
        await prisma.cobranca.create({
          data: {
            contratoId: fernandoContratoId,
            mesReferencia: cb.mesRef,
            anoReferencia: cb.anoRef,
            valorBruto,
            percentualDesconto: 18,
            valorDesconto: Math.round(valorDesconto * 100) / 100,
            valorLiquido: Math.round((valorBruto - valorDesconto) * 100) / 100,
            status: cb.status,
            dataVencimento: cb.venc,
            kwhEntregue: 250,
            cooperativaId: coopId,
          },
        });
      }
    }
    console.log('   ✅ 3 cobranças (2 VENCIDO, 1 PENDENTE)\n');
  }

  // ─── Cobranças Luciana (mês atual) ──────────────────────────────────────────
  console.log('6. Criando cobranças para Luciana Meireles...');

  for (const ctId of contratoIds['luciana.meireles@gmail.com']) {
    const existing = await prisma.cobranca.findFirst({
      where: { contratoId: ctId, mesReferencia: 3, anoReferencia: 2026 },
    });
    if (!existing) {
      const valorBruto = 200;
      const valorDesconto = valorBruto * 0.18;
      await prisma.cobranca.create({
        data: {
          contratoId: ctId,
          mesReferencia: 3,
          anoReferencia: 2026,
          valorBruto,
          percentualDesconto: 18,
          valorDesconto: Math.round(valorDesconto * 100) / 100,
          valorLiquido: Math.round((valorBruto - valorDesconto) * 100) / 100,
          status: 'PENDENTE',
          dataVencimento: new Date(2026, 2, 15),
          kwhEntregue: 300,
          cooperativaId: coopId,
        },
      });
    }
  }
  console.log(`   ✅ ${contratoIds['luciana.meireles@gmail.com'].length} cobranças do mês atual\n`);

  // ─── Lista de Espera ────────────────────────────────────────────────────────
  console.log('7. Criando lista de espera...');

  const robertoId = cooperadoIds['roberto.fonseca@gmail.com'];

  // Prospects adicionais (3 novos cooperados aguardando)
  const prospects = [
    { nome: 'Thiago Barros', cpf: '678.901.234-56', email: 'thiago.barros@gmail.com', telefone: '(27) 99100-0006' },
    { nome: 'Camila Ribeiro', cpf: '789.012.345-67', email: 'camila.ribeiro@gmail.com', telefone: '(27) 99100-0007' },
    { nome: 'Diego Mendonça', cpf: '890.123.456-78', email: 'diego.mendonca@gmail.com', telefone: '(27) 99100-0008' },
  ];

  const listaEsperaIds: string[] = [robertoId];

  for (const p of prospects) {
    const cooperado = await prisma.cooperado.upsert({
      where: { cpf: p.cpf },
      update: {},
      create: {
        nomeCompleto: p.nome,
        cpf: p.cpf,
        email: p.email,
        telefone: p.telefone,
        status: 'PENDENTE',
        cooperativaId: coopId,
        tipoPessoa: 'PF',
      },
    });
    listaEsperaIds.push(cooperado.id);
  }

  for (let i = 0; i < listaEsperaIds.length; i++) {
    const existing = await prisma.listaEspera.findFirst({
      where: { cooperadoId: listaEsperaIds[i] },
    });
    if (!existing) {
      const diasAtras = i === 0 ? 45 : 30 - i * 5;
      await prisma.listaEspera.create({
        data: {
          cooperadoId: listaEsperaIds[i],
          kwhNecessario: 250 + i * 50,
          posicao: i + 1,
          status: 'AGUARDANDO',
          cooperativaId: coopId,
          createdAt: new Date(Date.now() - diasAtras * 86400000),
        },
      });
    }
    const nome = i === 0 ? 'Roberto Fonseca' : prospects[i - 1].nome;
    console.log(`   ✅ Posição ${i + 1}: ${nome}`);
  }
  console.log();

  // ─── Progressão no Clube para cooperados individuais ────────────────────────
  console.log('8. Configurando Progressão no Clube de Vantagens...');

  const progressoes = [
    { email: 'carlos.prata@gmail.com', kwhAcumulado: 12000, nivel: 'PRATA' as const, indicadosAtivos: 3, beneficio: 4 },
    { email: 'beatriz.santos@gmail.com', kwhAcumulado: 2500, nivel: 'BRONZE' as const, indicadosAtivos: 1, beneficio: 2 },
    { email: 'luciana.meireles@gmail.com', kwhAcumulado: 25000, nivel: 'OURO' as const, indicadosAtivos: 6, beneficio: 6 },
  ];

  for (const p of progressoes) {
    const cooperadoId = cooperadoIds[p.email];
    if (!cooperadoId) continue;

    await prisma.progressaoClube.upsert({
      where: { cooperadoId },
      update: {
        nivelAtual: p.nivel,
        kwhIndicadoAcumulado: p.kwhAcumulado,
        indicadosAtivos: p.indicadosAtivos,
        beneficioPercentualAtual: p.beneficio,
        dataUltimaAvaliacao: new Date(),
        dataUltimaPromocao: new Date(),
      },
      create: {
        cooperadoId,
        nivelAtual: p.nivel,
        kwhIndicadoAcumulado: p.kwhAcumulado,
        indicadosAtivos: p.indicadosAtivos,
        beneficioPercentualAtual: p.beneficio,
        dataUltimaAvaliacao: new Date(),
        dataUltimaPromocao: new Date(),
      },
    });
    console.log(`   ✅ ${p.email} → ${p.nivel} (${p.kwhAcumulado} kWh, ${p.indicadosAtivos} indicados)`);
  }
  console.log();

  // ─── Indicações ─────────────────────────────────────────────────────────────
  console.log('9. Criando indicações...');

  // Carlos indicou 3 pessoas (Beatriz, Fernando, Luciana)
  const carlosId = cooperadoIds['carlos.prata@gmail.com'];
  const indicacoesCarlos = [
    cooperadoIds['beatriz.santos@gmail.com'],
    cooperadoIds['fernando.augusto@gmail.com'],
    cooperadoIds['luciana.meireles@gmail.com'],
  ];

  for (const indicadoId of indicacoesCarlos) {
    if (!indicadoId) continue;
    const existing = await prisma.indicacao.findFirst({
      where: { cooperadoIndicadorId: carlosId, cooperadoIndicadoId: indicadoId },
    });
    if (!existing) {
      await prisma.indicacao.create({
        data: {
          cooperativaId: coopId,
          cooperadoIndicadorId: carlosId,
          cooperadoIndicadoId: indicadoId,
          nivel: 1,
          status: 'PRIMEIRA_FATURA_PAGA',
          primeiraFaturaPagaEm: new Date('2025-06-15'),
        },
      });
    }
  }
  console.log('   ✅ Carlos Eduardo: 3 indicações');

  // Beatriz indicou 1 (Fernando)
  const beatrizId = cooperadoIds['beatriz.santos@gmail.com'];
  const existInd = await prisma.indicacao.findFirst({
    where: { cooperadoIndicadorId: beatrizId, cooperadoIndicadoId: cooperadoIds['fernando.augusto@gmail.com'] },
  });
  if (!existInd) {
    await prisma.indicacao.create({
      data: {
        cooperativaId: coopId,
        cooperadoIndicadorId: beatrizId,
        cooperadoIndicadoId: cooperadoIds['fernando.augusto@gmail.com'],
        nivel: 1,
        status: 'PRIMEIRA_FATURA_PAGA',
        primeiraFaturaPagaEm: new Date('2025-08-20'),
      },
    });
  }
  console.log('   ✅ Beatriz Santos: 1 indicação');

  // Luciana indicou 6 (Carlos, Beatriz, Fernando, Roberto + 2 prospects)
  const lucianaId = cooperadoIds['luciana.meireles@gmail.com'];
  const indicacoesLuciana = [
    carlosId,
    beatrizId,
    cooperadoIds['fernando.augusto@gmail.com'],
    cooperadoIds['roberto.fonseca@gmail.com'],
  ];

  // Adicionar os 2 primeiros prospects
  for (const p of prospects.slice(0, 2)) {
    const coop = await prisma.cooperado.findFirst({ where: { cpf: p.cpf } });
    if (coop) indicacoesLuciana.push(coop.id);
  }

  for (const indicadoId of indicacoesLuciana) {
    if (!indicadoId || indicadoId === lucianaId) continue;
    const existing = await prisma.indicacao.findFirst({
      where: { cooperadoIndicadorId: lucianaId, cooperadoIndicadoId: indicadoId },
    });
    if (!existing) {
      await prisma.indicacao.create({
        data: {
          cooperativaId: coopId,
          cooperadoIndicadorId: lucianaId,
          cooperadoIndicadoId: indicadoId,
          nivel: 1,
          status: indicadoId === cooperadoIds['roberto.fonseca@gmail.com'] ? 'PENDENTE' : 'PRIMEIRA_FATURA_PAGA',
          primeiraFaturaPagaEm: indicadoId === cooperadoIds['roberto.fonseca@gmail.com'] ? null : new Date('2025-07-10'),
        },
      });
    }
  }
  console.log('   ✅ Luciana Meireles: 6 indicações\n');

  // ─── Resumo Final ───────────────────────────────────────────────────────────
  const totalCooperados = await prisma.cooperado.count({ where: { cooperativaId: coopId } });
  const totalContratos = await prisma.contrato.count({ where: { cooperativaId: coopId } });
  const totalCobrancas = await prisma.cobranca.count({ where: { cooperativaId: coopId } });
  const totalUsinas = await prisma.usina.count({ where: { cooperativaId: coopId } });
  const totalListaEspera = await prisma.listaEspera.count({ where: { cooperativaId: coopId } });
  const totalIndicacoes = await prisma.indicacao.count({ where: { cooperativaId: coopId } });
  const totalProgressao = await prisma.progressaoClube.count();

  console.log('═══════════════════════════════════════════');
  console.log('           RESUMO SEED EXTRA              ');
  console.log('═══════════════════════════════════════════');
  console.log(`  Cooperados total:     ${totalCooperados}`);
  console.log(`  Contratos total:      ${totalContratos}`);
  console.log(`  Cobranças total:      ${totalCobrancas}`);
  console.log(`  Usinas total:         ${totalUsinas}`);
  console.log(`  Lista de espera:      ${totalListaEspera}`);
  console.log(`  Indicações:           ${totalIndicacoes}`);
  console.log(`  Progressão Clube:     ${totalProgressao}`);
  console.log('═══════════════════════════════════════════');
  console.log('\n✅ Seed Extra concluído com sucesso!');
}

main()
  .catch((e) => {
    console.error('❌ Erro no seed-extra:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
