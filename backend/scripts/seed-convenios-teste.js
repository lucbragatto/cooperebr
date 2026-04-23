/**
 * Seed — Convênio Hangar + Moradas da Enseada
 * Roda: cd backend && node scripts/seed-convenios-teste.js
 * Idempotente: verifica se já existe antes de criar.
 */
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
const COOPEREBR_ID = 'cmn0ho8bx0000uox8wu96u6fd';

// Gerar CPF válido com dígitos verificadores
function gerarCPF(seed) {
  const base = String(seed).padStart(9, '0').slice(0, 9);
  const d = base.split('').map(Number);
  let s = 0;
  for (let i = 0; i < 9; i++) s += d[i] * (10 - i);
  let d1 = 11 - (s % 11); if (d1 >= 10) d1 = 0;
  s = 0;
  for (let i = 0; i < 9; i++) s += d[i] * (11 - i);
  s += d1 * 2;
  let d2 = 11 - (s % 11); if (d2 >= 10) d2 = 0;
  return base + d1 + d2;
}

function gerarCNPJ(seed) {
  const base = String(seed).padStart(12, '0').slice(0, 12);
  const d = base.split('').map(Number);
  const p1 = [5,4,3,2,9,8,7,6,5,4,3,2];
  let s = 0;
  for (let i = 0; i < 12; i++) s += d[i] * p1[i];
  let d1 = s % 11 < 2 ? 0 : 11 - (s % 11);
  const p2 = [6,5,4,3,2,9,8,7,6,5,4,3,2];
  s = 0;
  for (let i = 0; i < 12; i++) s += d[i] * p2[i];
  s += d1 * p2[12];
  let d2 = s % 11 < 2 ? 0 : 11 - (s % 11);
  return base + d1 + d2;
}

const nomesProfessores = [
  'Carol Silva', 'Marcos Oliveira', 'Patricia Santos', 'Roberto Lima',
  'Fernanda Costa', 'Guilherme Souza', 'Juliana Ferreira', 'Anderson Pereira',
  'Luciana Martins', 'Felipe Rodrigues', 'Camila Almeida', 'Thiago Barbosa',
  'Vanessa Ribeiro', 'Diego Nascimento', 'Renata Cardoso',
];

const nomesAlunos = [];
const primeiros = ['Ana', 'Bruno', 'Carla', 'Daniel', 'Elena', 'Fabio', 'Gisele', 'Hugo', 'Iris', 'Joao', 'Karen', 'Lucas', 'Maria', 'Nelson', 'Olivia'];
const sobrenomes = ['Silva', 'Santos', 'Oliveira', 'Souza', 'Lima', 'Pereira', 'Costa', 'Ferreira', 'Rodrigues', 'Almeida'];
for (let i = 0; i < 150; i++) {
  nomesAlunos.push(primeiros[i % primeiros.length] + ' ' + sobrenomes[Math.floor(i / primeiros.length) % sobrenomes.length] + ' ' + (i + 1));
}

async function main() {
  console.log('=== SEED CONVÊNIOS TESTE ===\n');

  // Verificar se já existe
  const hangarExiste = await p.contratoConvenio.findFirst({ where: { empresaNome: { contains: 'Hangar' } } });
  if (hangarExiste) {
    console.log('Hangar já existe (' + hangarExiste.id + '). Pulando seed.');
    await p.$disconnect();
    return;
  }

  // ═══ CONVÊNIO HANGAR ═══
  console.log('--- HANGAR ---');

  // 1. Cooperado conveniado (Hangar PJ)
  const hangarCoop = await p.cooperado.create({
    data: {
      nomeCompleto: 'ACADEMIA DE GINASTICA HANGAR LTDA',
      cpf: '36324580000110',
      email: 'contato@hangar.teste.coopere.br',
      telefone: '27999990001',
      status: 'ATIVO',
      tipoPessoa: 'PJ',
      modoRemuneracao: 'DESCONTO',
      cooperativaId: COOPEREBR_ID,
    },
  });
  console.log('Hangar cooperado: ' + hangarCoop.id);

  // 2. UCs do Hangar (dados reais das fixtures)
  const uc1 = await p.uc.create({
    data: {
      numero: '0000051282805491',
      endereco: 'Rua Hangar Loja 1',
      cidade: 'Vila Velha',
      estado: 'ES',
      distribuidora: 'EDP ES',
      classificacao: 'B3-COMERCIAL',
      cooperadoId: hangarCoop.id,
      cooperativaId: COOPEREBR_ID,
    },
  });
  const uc2 = await p.uc.create({
    data: {
      numero: '000051282905487',
      endereco: 'Rua Hangar Loja 2',
      cidade: 'Vila Velha',
      estado: 'ES',
      distribuidora: 'EDP ES',
      classificacao: 'B3-COMERCIAL',
      cooperadoId: hangarCoop.id,
      cooperativaId: COOPEREBR_ID,
    },
  });
  console.log('UCs: ' + uc1.numero + ', ' + uc2.numero);

  // 3. Convênio
  const numConvenio = 'CV-HANGAR-' + Date.now();
  const hangarConvenio = await p.contratoConvenio.create({
    data: {
      numero: numConvenio,
      empresaNome: 'Academia Hangar LTDA',
      empresaCnpj: '36324580000110',
      tipo: 'EMPRESA',
      modalidade: 'STANDALONE',
      status: 'ATIVO',
      cooperativaId: COOPEREBR_ID,
      conveniadoId: hangarCoop.id,
      registrarComoIndicacao: true,
      tipoBeneficioConveniado: 'DESCONTO',
      configBeneficio: {
        criterio: 'MEMBROS_ATIVOS',
        efeitoMudancaFaixa: 'SOMENTE_PROXIMAS',
        faixas: [
          { minMembros: 1, maxMembros: 10, descontoMembros: 3, descontoConveniado: 1 },
          { minMembros: 11, maxMembros: 50, descontoMembros: 5, descontoConveniado: 2.5 },
          { minMembros: 51, maxMembros: 100, descontoMembros: 8, descontoConveniado: 4 },
          { minMembros: 101, maxMembros: null, descontoMembros: 12, descontoConveniado: 6 },
        ],
      },
    },
  });
  console.log('Convênio: ' + hangarConvenio.numero);

  // 4. 15 Professores
  const professores = [];
  for (let i = 0; i < 15; i++) {
    const cpf = gerarCPF(700000000 + i);
    const modo = i < 7 ? 'DESCONTO' : 'CLUBE';
    const consumo = 300 + Math.floor(Math.random() * 500);
    const prof = await p.cooperado.create({
      data: {
        nomeCompleto: 'Prof. ' + nomesProfessores[i],
        cpf,
        email: 'prof.' + String(i + 1).padStart(2, '0') + '@hangar.teste.coopere.br',
        telefone: '2799' + String(7000000 + i),
        status: 'ATIVO',
        modoRemuneracao: modo,
        cooperativaId: COOPEREBR_ID,
      },
    });
    // UC
    await p.uc.create({
      data: {
        numero: '00009' + String(90000 + i).padStart(11, '0'),
        endereco: 'Rua Prof ' + (i + 1),
        cidade: 'Vila Velha',
        estado: 'ES',
        cooperadoId: prof.id,
        cooperativaId: COOPEREBR_ID,
      },
    });
    // Membro convênio
    await p.convenioCooperado.create({
      data: { convenioId: hangarConvenio.id, cooperadoId: prof.id, ativo: true },
    });
    professores.push(prof);
  }
  console.log('15 professores criados');

  // 5. 150 Alunos (10 por professor)
  let alunoCount = 0;
  for (let pi = 0; pi < 15; pi++) {
    for (let ai = 0; ai < 10; ai++) {
      const idx = pi * 10 + ai;
      const cpf = gerarCPF(800000000 + idx);
      const modo = idx < 75 ? 'DESCONTO' : 'CLUBE';
      const consumo = 150 + Math.floor(Math.random() * 350);
      const aluno = await p.cooperado.create({
        data: {
          nomeCompleto: nomesAlunos[idx],
          cpf,
          email: 'aluno.' + String(idx + 1).padStart(3, '0') + '@hangar.teste.coopere.br',
          telefone: '2798' + String(5000000 + idx),
          status: 'ATIVO',
          modoRemuneracao: modo,
          cooperativaId: COOPEREBR_ID,
        },
      });
      await p.uc.create({
        data: {
          numero: '00008' + String(80000 + idx).padStart(11, '0'),
          endereco: 'Rua Aluno ' + (idx + 1),
          cidade: 'Vila Velha',
          estado: 'ES',
          cooperadoId: aluno.id,
          cooperativaId: COOPEREBR_ID,
        },
      });
      await p.convenioCooperado.create({
        data: { convenioId: hangarConvenio.id, cooperadoId: aluno.id, ativo: true },
      });
      alunoCount++;
    }
    if ((pi + 1) % 5 === 0) console.log('  ' + ((pi + 1) * 10) + '/150 alunos...');
  }
  console.log(alunoCount + ' alunos criados');

  // ═══ CONVÊNIO MORADAS ═══
  console.log('\n--- MORADAS DA ENSEADA ---');

  const moradasCoop = await p.cooperado.create({
    data: {
      nomeCompleto: 'CONDOMINIO MORADAS DA ENSEADA',
      cpf: gerarCNPJ(553217180001),
      email: 'admin@moradas.teste.coopere.br',
      telefone: '27999880001',
      status: 'ATIVO',
      tipoPessoa: 'PJ',
      modoRemuneracao: 'DESCONTO',
      cooperativaId: COOPEREBR_ID,
    },
  });

  await p.uc.create({
    data: {
      numero: '000094422505457',
      endereco: 'Al das Gaivotas 71 - Areas Comuns',
      cidade: 'Guarapari',
      estado: 'ES',
      distribuidora: 'EDP ES',
      classificacao: 'B3-COMERCIAL',
      cooperadoId: moradasCoop.id,
      cooperativaId: COOPEREBR_ID,
    },
  });

  const moradasConvenio = await p.contratoConvenio.create({
    data: {
      numero: 'CV-MORADAS-' + Date.now(),
      empresaNome: 'Condomínio Moradas da Enseada',
      empresaCnpj: moradasCoop.cpf,
      tipo: 'CONDOMINIO',
      modalidade: 'STANDALONE',
      status: 'ATIVO',
      cooperativaId: COOPEREBR_ID,
      conveniadoId: moradasCoop.id,
      registrarComoIndicacao: false,
      tipoBeneficioConveniado: 'DESCONTO',
      configBeneficio: {
        criterio: 'MEMBROS_ATIVOS',
        efeitoMudancaFaixa: 'SOMENTE_PROXIMAS',
        faixas: [
          { minMembros: 1, maxMembros: 20, descontoMembros: 5, descontoConveniado: 2 },
          { minMembros: 21, maxMembros: 40, descontoMembros: 8, descontoConveniado: 3 },
          { minMembros: 41, maxMembros: null, descontoMembros: 12, descontoConveniado: 5 },
        ],
      },
    },
  });
  console.log('Convênio Moradas: ' + moradasConvenio.numero);

  // 50 Condôminos (10 andares × 5 aptos)
  for (let andar = 1; andar <= 10; andar++) {
    for (let apto = 1; apto <= 5; apto++) {
      const idx = (andar - 1) * 5 + apto;
      const numApto = andar * 100 + apto;
      const cpf = gerarCPF(900000000 + idx);
      const cond = await p.cooperado.create({
        data: {
          nomeCompleto: 'Morador Apto ' + numApto,
          cpf,
          email: 'apto.' + numApto + '@moradas.teste.coopere.br',
          telefone: '2798' + String(8000000 + idx),
          status: 'ATIVO',
          modoRemuneracao: 'DESCONTO',
          cooperativaId: COOPEREBR_ID,
        },
      });
      await p.uc.create({
        data: {
          numero: '00007' + String(70000 + idx).padStart(11, '0'),
          endereco: 'Al Gaivotas 71 Apto ' + numApto,
          cidade: 'Guarapari',
          estado: 'ES',
          cooperadoId: cond.id,
          cooperativaId: COOPEREBR_ID,
        },
      });
      await p.convenioCooperado.create({
        data: { convenioId: moradasConvenio.id, cooperadoId: cond.id, ativo: true },
      });
    }
    if (andar % 5 === 0) console.log('  ' + (andar * 5) + '/50 condôminos...');
  }
  console.log('50 condôminos criados');

  // ═══ TOTAIS ═══
  console.log('\n=== TOTAIS ===');
  const totalCoop = await p.cooperado.count({ where: { cooperativaId: COOPEREBR_ID } });
  const totalConvenios = await p.contratoConvenio.count({ where: { cooperativaId: COOPEREBR_ID } });
  const totalMembros = await p.convenioCooperado.count();
  console.log('Cooperados CoopereBR: ' + totalCoop);
  console.log('Convênios: ' + totalConvenios);
  console.log('Membros convênio: ' + totalMembros);

  await p.$disconnect();
  console.log('\nSeed concluído.');
}

main().catch(err => { console.error(err.message); process.exit(1); });
