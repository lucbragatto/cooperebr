import { PrismaClient, StatusCooperado, StatusContrato, StatusCobranca, TipoOcorrencia, PrioridadeOcorrencia } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Iniciando seed...');

  // ─── Limpar dados existentes (ordem respeita FK) ───────────────────────────
  await prisma.ocorrencia.deleteMany();
  await prisma.cobranca.deleteMany();
  await prisma.contrato.deleteMany();
  await prisma.uc.deleteMany();
  await prisma.usina.deleteMany();
  await prisma.cooperado.deleteMany();
  console.log('🗑️  Dados anteriores removidos.');

  // ─── Cooperados ───────────────────────────────────────────────────────────
  const [maria, joao, ana, carlos, paula] = await Promise.all([
    prisma.cooperado.create({
      data: {
        nomeCompleto: 'Maria Silva',
        email: 'maria.silva@email.com',
        cpf: '111.111.111-11',
        telefone: '27999990001',
        status: StatusCooperado.ATIVO,
      },
    }),
    prisma.cooperado.create({
      data: {
        nomeCompleto: 'João Santos',
        email: 'joao.santos@email.com',
        cpf: '222.222.222-22',
        telefone: '27999990002',
        status: StatusCooperado.ATIVO,
      },
    }),
    prisma.cooperado.create({
      data: {
        nomeCompleto: 'Ana Oliveira',
        email: 'ana.oliveira@email.com',
        cpf: '333.333.333-33',
        telefone: '27999990003',
        status: StatusCooperado.ATIVO,
      },
    }),
    prisma.cooperado.create({
      data: {
        nomeCompleto: 'Carlos Pereira',
        email: 'carlos.pereira@email.com',
        cpf: '444.444.444-44',
        telefone: '27999990004',
        status: StatusCooperado.ATIVO,
      },
    }),
    prisma.cooperado.create({
      data: {
        nomeCompleto: 'Paula Costa',
        email: 'paula.costa@email.com',
        cpf: '555.555.555-55',
        telefone: '27999990005',
        status: StatusCooperado.ATIVO,
      },
    }),
  ]);
  console.log('✅ 5 cooperados criados.');

  // ─── Usinas ───────────────────────────────────────────────────────────────
  const [usinaNorte, usinaSul] = await Promise.all([
    prisma.usina.create({
      data: { nome: 'Usina Solar Norte', potenciaKwp: 150, cidade: 'Vitória', estado: 'ES' },
    }),
    prisma.usina.create({
      data: { nome: 'Usina Solar Sul', potenciaKwp: 200, cidade: 'Vila Velha', estado: 'ES' },
    }),
  ]);
  console.log('✅ 2 usinas criadas.');

  // ─── UCs ──────────────────────────────────────────────────────────────────
  const [ucMaria, ucJoao, ucAna, ucCarlos, ucPaula] = await Promise.all([
    prisma.uc.create({
      data: { numero: '001001', endereco: 'Rua das Flores, 100', cidade: 'Vitória', estado: 'ES', cooperadoId: maria.id },
    }),
    prisma.uc.create({
      data: { numero: '001002', endereco: 'Av. Central, 200', cidade: 'Vitória', estado: 'ES', cooperadoId: joao.id },
    }),
    prisma.uc.create({
      data: { numero: '001003', endereco: 'Rua das Palmeiras, 300', cidade: 'Serra', estado: 'ES', cooperadoId: ana.id },
    }),
    prisma.uc.create({
      data: { numero: '001004', endereco: 'Av. Litorânea, 400', cidade: 'Vila Velha', estado: 'ES', cooperadoId: carlos.id },
    }),
    prisma.uc.create({
      data: { numero: '001005', endereco: 'Rua do Sol, 500', cidade: 'Cariacica', estado: 'ES', cooperadoId: paula.id },
    }),
  ]);
  console.log('✅ 5 UCs criadas.');

  // ─── Contratos ────────────────────────────────────────────────────────────
  const contratos = await Promise.all([
    prisma.contrato.create({
      data: {
        numero: 'CTR-2025-001',
        cooperadoId: maria.id,
        ucId: ucMaria.id,
        usinaId: usinaNorte.id,
        percentualDesconto: 15,
        dataInicio: new Date('2025-01-01'),
        status: StatusContrato.ATIVO,
      },
    }),
    prisma.contrato.create({
      data: {
        numero: 'CTR-2025-002',
        cooperadoId: joao.id,
        ucId: ucJoao.id,
        usinaId: usinaNorte.id,
        percentualDesconto: 18,
        dataInicio: new Date('2025-02-01'),
        status: StatusContrato.ATIVO,
      },
    }),
    prisma.contrato.create({
      data: {
        numero: 'CTR-2025-003',
        cooperadoId: ana.id,
        ucId: ucAna.id,
        usinaId: usinaSul.id,
        percentualDesconto: 20,
        dataInicio: new Date('2025-03-01'),
        status: StatusContrato.ATIVO,
      },
    }),
    prisma.contrato.create({
      data: {
        numero: 'CTR-2025-004',
        cooperadoId: carlos.id,
        ucId: ucCarlos.id,
        usinaId: usinaSul.id,
        percentualDesconto: 12,
        dataInicio: new Date('2025-04-01'),
        status: StatusContrato.ATIVO,
      },
    }),
    prisma.contrato.create({
      data: {
        numero: 'CTR-2025-005',
        cooperadoId: paula.id,
        ucId: ucPaula.id,
        usinaId: usinaNorte.id,
        percentualDesconto: 16,
        dataInicio: new Date('2025-05-01'),
        status: StatusContrato.ATIVO,
      },
    }),
  ]);
  console.log('✅ 5 contratos criados.');

  // ─── Cobranças ────────────────────────────────────────────────────────────
  function calcCobranca(valorBruto: number, desconto: number) {
    const valorDesconto = +(valorBruto * desconto / 100).toFixed(2);
    const valorLiquido = +(valorBruto - valorDesconto).toFixed(2);
    return { valorBruto, percentualDesconto: desconto, valorDesconto, valorLiquido };
  }

  const [ctrMaria, ctrJoao, ctrAna, ctrCarlos, ctrPaula] = contratos;

  await Promise.all([
    // Maria — Jan/2025 PAGO, Fev/2025 PENDENTE
    prisma.cobranca.create({
      data: {
        contratoId: ctrMaria.id,
        mesReferencia: 1,
        anoReferencia: 2025,
        ...calcCobranca(250.00, 15),
        dataVencimento: new Date('2025-02-10'),
        dataPagamento: new Date('2025-02-08'),
        status: StatusCobranca.PAGO,
      },
    }),
    prisma.cobranca.create({
      data: {
        contratoId: ctrMaria.id,
        mesReferencia: 2,
        anoReferencia: 2025,
        ...calcCobranca(270.00, 15),
        dataVencimento: new Date('2025-03-10'),
        status: StatusCobranca.PENDENTE,
      },
    }),
    // João — Mar/2025 PAGO, Abr/2025 VENCIDO
    prisma.cobranca.create({
      data: {
        contratoId: ctrJoao.id,
        mesReferencia: 3,
        anoReferencia: 2025,
        ...calcCobranca(380.00, 18),
        dataVencimento: new Date('2025-04-10'),
        dataPagamento: new Date('2025-04-07'),
        status: StatusCobranca.PAGO,
      },
    }),
    prisma.cobranca.create({
      data: {
        contratoId: ctrJoao.id,
        mesReferencia: 4,
        anoReferencia: 2025,
        ...calcCobranca(350.00, 18),
        dataVencimento: new Date('2025-05-10'),
        status: StatusCobranca.VENCIDO,
      },
    }),
    // Ana — Mar/2025 PAGO, Mai/2025 PENDENTE
    prisma.cobranca.create({
      data: {
        contratoId: ctrAna.id,
        mesReferencia: 3,
        anoReferencia: 2025,
        ...calcCobranca(400.00, 20),
        dataVencimento: new Date('2025-04-15'),
        dataPagamento: new Date('2025-04-14'),
        status: StatusCobranca.PAGO,
      },
    }),
    prisma.cobranca.create({
      data: {
        contratoId: ctrAna.id,
        mesReferencia: 5,
        anoReferencia: 2025,
        ...calcCobranca(390.00, 20),
        dataVencimento: new Date('2025-06-15'),
        status: StatusCobranca.PENDENTE,
      },
    }),
    // Carlos — Abr/2025 PAGO, Mai/2025 VENCIDO
    prisma.cobranca.create({
      data: {
        contratoId: ctrCarlos.id,
        mesReferencia: 4,
        anoReferencia: 2025,
        ...calcCobranca(200.00, 12),
        dataVencimento: new Date('2025-05-10'),
        dataPagamento: new Date('2025-05-09'),
        status: StatusCobranca.PAGO,
      },
    }),
    prisma.cobranca.create({
      data: {
        contratoId: ctrCarlos.id,
        mesReferencia: 5,
        anoReferencia: 2025,
        ...calcCobranca(185.00, 12),
        dataVencimento: new Date('2025-06-10'),
        status: StatusCobranca.VENCIDO,
      },
    }),
    // Paula — Mai/2025 PENDENTE, Jun/2025 PENDENTE
    prisma.cobranca.create({
      data: {
        contratoId: ctrPaula.id,
        mesReferencia: 5,
        anoReferencia: 2025,
        ...calcCobranca(310.00, 16),
        dataVencimento: new Date('2025-06-10'),
        status: StatusCobranca.PENDENTE,
      },
    }),
    prisma.cobranca.create({
      data: {
        contratoId: ctrPaula.id,
        mesReferencia: 6,
        anoReferencia: 2025,
        ...calcCobranca(295.00, 16),
        dataVencimento: new Date('2025-07-10'),
        status: StatusCobranca.PENDENTE,
      },
    }),
  ]);
  console.log('✅ 10 cobranças criadas.');

  // ─── Ocorrências ──────────────────────────────────────────────────────────
  await Promise.all([
    prisma.ocorrencia.create({
      data: {
        cooperadoId: maria.id,
        ucId: ucMaria.id,
        tipo: TipoOcorrencia.FALTA_ENERGIA,
        prioridade: PrioridadeOcorrencia.ALTA,
        descricao: 'Inversor sem comunicação há 3 dias. Produção zerada.',
      },
    }),
    prisma.ocorrencia.create({
      data: {
        cooperadoId: joao.id,
        ucId: ucJoao.id,
        tipo: TipoOcorrencia.PROBLEMA_FATURA,
        prioridade: PrioridadeOcorrencia.MEDIA,
        descricao: 'Dúvida sobre desconto na fatura — valor cobrado diferente do contrato.',
      },
    }),
    prisma.ocorrencia.create({
      data: {
        cooperadoId: ana.id,
        ucId: ucAna.id,
        tipo: TipoOcorrencia.SOLICITACAO,
        prioridade: PrioridadeOcorrencia.BAIXA,
        descricao: 'Solicitação de segunda via de boleto referente ao mês de março/2025.',
      },
    }),
  ]);
  console.log('✅ 3 ocorrências criadas.');

  console.log('\n🎉 Seed concluído com sucesso!');
}

main()
  .catch((e) => {
    console.error('❌ Erro no seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
