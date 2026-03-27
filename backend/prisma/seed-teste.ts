import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Iniciando seed de dados fictícios...\n');

  // ─── Cooperativa ─────────────────────────────────────────────────────────────
  console.log('1. Criando Cooperativa...');
  const cooperativa = await prisma.cooperativa.upsert({
    where: { cnpj: '12.345.678/0001-99' },
    update: {},
    create: {
      nome: 'CoopereBR Teste',
      cnpj: '12.345.678/0001-99',
      email: 'contato@cooperebr.com.br',
      tipoParceiro: 'COOPERATIVA',
    },
  });
  console.log(`   ✅ Cooperativa criada: ${cooperativa.id}\n`);

  // ─── Config Clube de Vantagens ────────────────────────────────────────────────
  console.log('2. Configurando Clube de Vantagens...');
  await prisma.configClubeVantagens.upsert({
    where: { cooperativaId: cooperativa.id },
    update: {
      ativo: true,
      criterio: 'KWH_INDICADO_ACUMULADO',
      niveisConfig: [
        { nivel: 'BRONZE', minKwh: 0, maxKwh: 5000, beneficioPercentual: 2 },
        { nivel: 'PRATA', minKwh: 5001, maxKwh: 15000, beneficioPercentual: 4 },
        { nivel: 'OURO', minKwh: 15001, maxKwh: 50000, beneficioPercentual: 6 },
        { nivel: 'DIAMANTE', minKwh: 50001, maxKwh: null, beneficioPercentual: 10 },
      ],
    },
    create: {
      cooperativaId: cooperativa.id,
      ativo: true,
      criterio: 'KWH_INDICADO_ACUMULADO',
      niveisConfig: [
        { nivel: 'BRONZE', minKwh: 0, maxKwh: 5000, beneficioPercentual: 2 },
        { nivel: 'PRATA', minKwh: 5001, maxKwh: 15000, beneficioPercentual: 4 },
        { nivel: 'OURO', minKwh: 15001, maxKwh: 50000, beneficioPercentual: 6 },
        { nivel: 'DIAMANTE', minKwh: 50001, maxKwh: null, beneficioPercentual: 10 },
      ],
    },
  });
  console.log('   ✅ Config Clube de Vantagens criada\n');

  // ─── Administradora ───────────────────────────────────────────────────────────
  console.log('3. Criando Administradora...');
  let administradora = await prisma.administradora.findFirst({
    where: { cnpj: '98.765.432/0001-11', cooperativaId: cooperativa.id },
  });
  if (!administradora) {
    administradora = await prisma.administradora.create({
      data: {
        cooperativaId: cooperativa.id,
        razaoSocial: 'Gestão Predial Vitória Ltda',
        cnpj: '98.765.432/0001-11',
        email: 'contato@gestaopredial.com.br',
        telefone: '(27) 3344-5566',
        responsavelNome: 'Gestor Responsável',
      },
    });
  }
  console.log(`   ✅ Administradora criada: ${administradora.id}\n`);

  // ─── Condomínio ───────────────────────────────────────────────────────────────
  console.log('4. Criando Condomínio...');
  let condominio = await prisma.condominio.findFirst({
    where: { cnpj: '11.222.333/0001-44', cooperativaId: cooperativa.id },
  });
  if (!condominio) {
    condominio = await prisma.condominio.create({
      data: {
        cooperativaId: cooperativa.id,
        nome: 'Residencial Solar das Palmeiras',
        cnpj: '11.222.333/0001-44',
        endereco: 'Av. Leitão da Silva, 1000, Praia do Canto',
        cidade: 'Vitória',
        estado: 'ES',
        administradoraId: administradora.id,
        sindicoNome: 'Roberto Mendes',
        sindicoEmail: 'roberto.mendes@gmail.com',
        sindicoTelefone: '(27) 99887-6655',
        modeloRateio: 'PERSONALIZADO',
        excedentePolitica: 'PIX_MENSAL',
        excedentePixChave: '11.222.333/0001-44',
        excedentePixTipo: 'CNPJ',
        aliquotaIR: 1.5,
        aliquotaPIS: 0.65,
        aliquotaCOFINS: 3.0,
        taxaAdministrativa: 2.0,
      },
    });
  }
  console.log(`   ✅ Condomínio criado: ${condominio.id}\n`);

  // ─── Condôminos ───────────────────────────────────────────────────────────────
  console.log('5. Criando Condôminos...');

  const condominosData = [
    { numero: '101', bloco: 'A', nome: 'Maria Silva Santos', cpf: '111.222.333-44', email: 'maria.silva@gmail.com', telefone: '(27) 99111-2222', percentual: 10 },
    { numero: '102', bloco: 'A', nome: 'João Carlos Oliveira', cpf: '222.333.444-55', email: 'joao.oliveira@gmail.com', telefone: '(27) 99222-3333', percentual: 10 },
    { numero: '201', bloco: 'A', nome: 'Ana Paula Ferreira', cpf: '333.444.555-66', email: 'ana.ferreira@gmail.com', telefone: '(27) 99333-4444', percentual: 10 },
    { numero: '202', bloco: 'A', nome: 'Pedro Henrique Costa', cpf: '444.555.666-77', email: 'pedro.costa@gmail.com', telefone: '(27) 99444-5555', percentual: 10 },
    { numero: '301', bloco: 'A', nome: 'Carla Regina Souza', cpf: '555.666.777-88', email: 'carla.souza@gmail.com', telefone: '(27) 99555-6666', percentual: 10 },
    { numero: '101', bloco: 'B', nome: 'Marcos Antonio Lima', cpf: '666.777.888-99', email: 'marcos.lima@gmail.com', telefone: '(27) 99666-7777', percentual: 10 },
    { numero: '102', bloco: 'B', nome: 'Fernanda Cristina Rocha', cpf: '777.888.999-00', email: 'fernanda.rocha@gmail.com', telefone: '(27) 99777-8888', percentual: 10 },
    { numero: '201', bloco: 'B', nome: 'Ricardo Alves Neto', cpf: '888.999.000-11', email: 'ricardo.alves@gmail.com', telefone: '(27) 99888-9999', percentual: 10 },
    { numero: '202', bloco: 'B', nome: 'Patrícia Moura Dias', cpf: '999.000.111-22', email: 'patricia.moura@gmail.com', telefone: '(27) 99000-1111', percentual: 10 },
    { numero: '301', bloco: 'B', nome: 'Gustavo Torres Pinto', cpf: '000.111.222-33', email: 'gustavo.torres@gmail.com', telefone: '(27) 99111-3333', percentual: 10 },
  ];

  const condominoIds: { [key: string]: string } = {};

  for (const c of condominosData) {
    const cooperado = await prisma.cooperado.upsert({
      where: { cpf: c.cpf },
      update: {},
      create: {
        nomeCompleto: c.nome,
        cpf: c.cpf,
        email: c.email,
        telefone: c.telefone,
        status: 'ATIVO',
        cooperativaId: cooperativa.id,
        tipoPessoa: 'PF',
      },
    });

    condominoIds[c.email] = cooperado.id;

    // Criar ou vincular unidade no condomínio
    const numUnidade = `${c.numero}-${c.bloco}`;
    const existingUnidade = await prisma.unidadeCondominio.findFirst({
      where: { condominioId: condominio.id, numero: numUnidade },
    });
    if (!existingUnidade) {
      await prisma.unidadeCondominio.create({
        data: {
          condominioId: condominio.id,
          numero: numUnidade,
          cooperadoId: cooperado.id,
          percentualFixo: c.percentual,
        },
      });
    }

    console.log(`   ✅ Condômino: ${c.nome} (${numUnidade})`);
  }
  console.log();

  // ─── Progressão no Clube ──────────────────────────────────────────────────────
  console.log('6. Configurando Progressão no Clube de Vantagens...');

  const progressoes = [
    { email: 'maria.silva@gmail.com', kwhAcumulado: 3500, nivel: 'BRONZE' as const, indicadosAtivos: 2, beneficio: 2 },
    { email: 'joao.oliveira@gmail.com', kwhAcumulado: 8000, nivel: 'PRATA' as const, indicadosAtivos: 5, beneficio: 4 },
    { email: 'ana.ferreira@gmail.com', kwhAcumulado: 18000, nivel: 'OURO' as const, indicadosAtivos: 8, beneficio: 6 },
    { email: 'pedro.costa@gmail.com', kwhAcumulado: 55000, nivel: 'DIAMANTE' as const, indicadosAtivos: 15, beneficio: 10 },
  ];

  for (const p of progressoes) {
    const cooperadoId = condominoIds[p.email];
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
    console.log(`   ✅ Progressão: ${p.email} → ${p.nivel} (${p.kwhAcumulado} kWh)`);
  }
  console.log();

  // ─── Cobranças de Teste ───────────────────────────────────────────────────────
  // Para criar cobranças, precisamos de um contrato. Vamos criar cooperado "condomínio"
  // e usar as cobranças diretas do condomínio.
  // Como Cobranca requer contratoId, e contratos requerem cooperado+uc+usina,
  // vamos usar o cooperado representante do condomínio (síndico).
  // Por ora, criamos uma entrada de cooperado do tipo condomínio para fins de cobrança.
  // Alternativamente, criaremos as cobranças via parceiro cooperativo.
  
  console.log('7. Criando Cooperado-representante do Condomínio para Cobranças...');
  const cooperadoCondominio = await prisma.cooperado.upsert({
    where: { cpf: '111.222.333/0001-44' },
    update: {},
    create: {
      nomeCompleto: 'Residencial Solar das Palmeiras',
      cpf: '111.222.333/0001-44',
      email: 'solar.palmeiras@gmail.com',
      telefone: '(27) 99887-6655',
      status: 'ATIVO',
      cooperativaId: cooperativa.id,
      tipoPessoa: 'PJ',
      razaoSocial: 'Residencial Solar das Palmeiras',
    },
  });
  console.log(`   ✅ Cooperado-representante criado: ${cooperadoCondominio.id}\n`);

  // ─── Criar UC e Usina fictícias para viabilizar contratos ─────────────────────
  console.log('8. Criando estrutura UC + Usina + Plano + Contratos para Cobranças...');

  // Verificar se UC já existe
  let ucCondominio = await prisma.uc.findFirst({
    where: { numero: 'UC-SOLAR-PALMEIRAS-001' },
  });
  if (!ucCondominio) {
    ucCondominio = await prisma.uc.create({
      data: {
        numero: 'UC-SOLAR-PALMEIRAS-001',
        endereco: 'Av. Leitão da Silva, 1000',
        cidade: 'Vitória',
        estado: 'ES',
        cooperadoId: cooperadoCondominio.id,
        cooperativaId: cooperativa.id,
      },
    });
  }

  // Verificar se Usina já existe
  let usinaCondominio = await prisma.usina.findFirst({
    where: { nome: 'Usina Solar Palmeiras' },
  });
  if (!usinaCondominio) {
    usinaCondominio = await prisma.usina.create({
      data: {
        nome: 'Usina Solar Palmeiras',
        potenciaKwp: 100,
        cidade: 'Vitória',
        estado: 'ES',
        statusHomologacao: 'EM_PRODUCAO',
        cooperativaId: cooperativa.id,
      },
    });
  }

  // Verificar se Plano já existe
  let planoBasico = await prisma.plano.findFirst({
    where: { nome: 'Plano Condomínio Básico' },
  });
  if (!planoBasico) {
    planoBasico = await prisma.plano.create({
      data: {
        nome: 'Plano Condomínio Básico',
        modeloCobranca: 'FIXO_MENSAL',
        descontoBase: 20,
        cooperativaId: cooperativa.id,
      },
    });
  }

  // Contrato para condomínio
  let contratoCondominio = await prisma.contrato.findFirst({
    where: { numero: 'CONT-SOLAR-PALM-001' },
  });
  if (!contratoCondominio) {
    contratoCondominio = await prisma.contrato.create({
      data: {
        numero: 'CONT-SOLAR-PALM-001',
        cooperadoId: cooperadoCondominio.id,
        ucId: ucCondominio.id,
        usinaId: usinaCondominio.id,
        planoId: planoBasico.id,
        dataInicio: new Date('2025-01-01'),
        percentualDesconto: 20,
        status: 'ATIVO',
        cooperativaId: cooperativa.id,
      },
    });
  }

  // Contrato para Maria Silva
  const mariaSilvaId = condominoIds['maria.silva@gmail.com'];
  let ucMaria = await prisma.uc.findFirst({
    where: { numero: 'UC-MARIA-SILVA-101' },
  });
  if (!ucMaria) {
    ucMaria = await prisma.uc.create({
      data: {
        numero: 'UC-MARIA-SILVA-101',
        endereco: 'Av. Leitão da Silva, 1000, Apto 101-A',
        cidade: 'Vitória',
        estado: 'ES',
        cooperadoId: mariaSilvaId,
        cooperativaId: cooperativa.id,
      },
    });
  }

  let contratoMaria = await prisma.contrato.findFirst({
    where: { numero: 'CONT-MARIA-SILVA-001' },
  });
  if (!contratoMaria) {
    contratoMaria = await prisma.contrato.create({
      data: {
        numero: 'CONT-MARIA-SILVA-001',
        cooperadoId: mariaSilvaId,
        ucId: ucMaria.id,
        usinaId: usinaCondominio.id,
        planoId: planoBasico.id,
        dataInicio: new Date('2025-01-01'),
        percentualDesconto: 20,
        status: 'ATIVO',
        cooperativaId: cooperativa.id,
      },
    });
  }

  console.log('   ✅ UC, Usina, Plano e Contratos criados\n');

  // ─── Cobranças ────────────────────────────────────────────────────────────────
  console.log('9. Criando Cobranças de Teste...');

  const now = new Date();
  const mesAtual = now.getMonth() + 1;
  const anoAtual = now.getFullYear();

  // 3 cobranças para o condomínio
  const cobrancasCondominio = [
    {
      mesReferencia: mesAtual - 2 <= 0 ? mesAtual + 10 : mesAtual - 2,
      anoReferencia: mesAtual - 2 <= 0 ? anoAtual - 1 : anoAtual,
      valorBruto: 1500.00,
      status: 'PAGO' as const,
      dataVencimento: new Date(anoAtual, mesAtual - 3, 10),
      dataPagamento: new Date(anoAtual, mesAtual - 3, 8),
      valorPago: 1500.00,
    },
    {
      mesReferencia: mesAtual - 1 <= 0 ? 12 : mesAtual - 1,
      anoReferencia: mesAtual - 1 <= 0 ? anoAtual - 1 : anoAtual,
      valorBruto: 1500.00,
      status: 'PENDENTE' as const,
      dataVencimento: new Date(anoAtual, mesAtual - 1, 10),
    },
    {
      mesReferencia: mesAtual - 3 <= 0 ? mesAtual + 9 : mesAtual - 3,
      anoReferencia: mesAtual - 3 <= 0 ? anoAtual - 1 : anoAtual,
      valorBruto: 1500.00,
      status: 'VENCIDO' as const,
      dataVencimento: new Date(anoAtual, mesAtual - 4, 10),
    },
  ];

  for (const cb of cobrancasCondominio) {
    const existingCb = await prisma.cobranca.findFirst({
      where: {
        contratoId: contratoCondominio.id,
        mesReferencia: cb.mesReferencia,
        anoReferencia: cb.anoReferencia,
      },
    });
    if (!existingCb) {
      const valorDesconto = cb.valorBruto * 0.2;
      await prisma.cobranca.create({
        data: {
          contratoId: contratoCondominio.id,
          mesReferencia: cb.mesReferencia,
          anoReferencia: cb.anoReferencia,
          valorBruto: cb.valorBruto,
          percentualDesconto: 20,
          valorDesconto: valorDesconto,
          valorLiquido: cb.valorBruto - valorDesconto,
          status: cb.status,
          dataVencimento: cb.dataVencimento,
          dataPagamento: (cb as any).dataPagamento || null,
          valorPago: (cb as any).valorPago || null,
          cooperativaId: cooperativa.id,
        },
      });
    }
    console.log(`   ✅ Cobrança Condomínio: ${cb.status} - Mês ${cb.mesReferencia}/${cb.anoReferencia}`);
  }

  // 2 cobranças para Maria Silva
  const cobrancasMaria = [
    {
      mesReferencia: mesAtual - 1 <= 0 ? 12 : mesAtual - 1,
      anoReferencia: mesAtual - 1 <= 0 ? anoAtual - 1 : anoAtual,
      valorBruto: 120.00,
      status: 'PAGO' as const,
      dataVencimento: new Date(anoAtual, mesAtual - 2, 15),
      dataPagamento: new Date(anoAtual, mesAtual - 2, 14),
      valorPago: 120.00,
    },
    {
      mesReferencia: mesAtual,
      anoReferencia: anoAtual,
      valorBruto: 120.00,
      status: 'PENDENTE' as const,
      dataVencimento: new Date(anoAtual, mesAtual - 1, 15),
    },
  ];

  for (const cb of cobrancasMaria) {
    const existingCb = await prisma.cobranca.findFirst({
      where: {
        contratoId: contratoMaria.id,
        mesReferencia: cb.mesReferencia,
        anoReferencia: cb.anoReferencia,
      },
    });
    if (!existingCb) {
      const valorDesconto = cb.valorBruto * 0.2;
      await prisma.cobranca.create({
        data: {
          contratoId: contratoMaria.id,
          mesReferencia: cb.mesReferencia,
          anoReferencia: cb.anoReferencia,
          valorBruto: cb.valorBruto,
          percentualDesconto: 20,
          valorDesconto: valorDesconto,
          valorLiquido: cb.valorBruto - valorDesconto,
          status: cb.status,
          dataVencimento: cb.dataVencimento,
          dataPagamento: (cb as any).dataPagamento || null,
          valorPago: (cb as any).valorPago || null,
          cooperativaId: cooperativa.id,
        },
      });
    }
    console.log(`   ✅ Cobrança Maria Silva: ${cb.status} - Mês ${cb.mesReferencia}/${cb.anoReferencia}`);
  }

  console.log('\n✅ Seed concluído com sucesso!\n');
  console.log('IDs importantes:');
  console.log(`  Cooperativa: ${cooperativa.id}`);
  console.log(`  Condomínio:  ${condominio.id}`);
  console.log(`  Maria Silva: ${condominoIds['maria.silva@gmail.com']}`);
  console.log(`  Pedro Costa: ${condominoIds['pedro.costa@gmail.com']}`);

  // Salvar IDs em arquivo para uso nos testes
  const ids = {
    cooperativaId: cooperativa.id,
    condominioId: condominio.id,
    administradoraId: administradora.id,
    condominoIds,
  };
  
  const fs = require('fs');
  fs.writeFileSync('prisma/seed-ids.json', JSON.stringify(ids, null, 2));
  console.log('\n📄 IDs salvos em prisma/seed-ids.json');
}

main()
  .catch((e) => {
    console.error('❌ Erro no seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
