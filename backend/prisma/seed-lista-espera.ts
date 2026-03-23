import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();
const BASE_URL = 'http://localhost:3000';

async function login(): Promise<string> {
  const credentials = [
    { identificador: 'teste@cooperebr.com', senha: 'Coopere@123' },
    { identificador: 'admin@cooperebr.com.br', senha: 'Coopere@123' },
  ];

  for (const cred of credentials) {
    try {
      const res = await fetch(`${BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cred),
      });
      if (res.ok) {
        const data = await res.json();
        console.log(`Login OK com ${cred.identificador}`);
        return data.token;
      }
    } catch {
      // try next
    }
  }
  throw new Error('Falha no login com todas as credenciais');
}

async function apiGet(url: string, token: string) {
  const res = await fetch(`${BASE_URL}${url}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`GET ${url} → ${res.status}`);
  return res.json();
}

async function apiPost(url: string, body: any, token: string) {
  const res = await fetch(`${BASE_URL}${url}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`POST ${url} → ${res.status}: ${text}`);
  }
  return res.json();
}

async function main() {
  console.log('=== Seed Lista de Espera ===\n');

  // 1. Login
  const token = await login();

  // 2. Carregar seed-data.json para valorPlano lookup
  const seedPath = path.join(__dirname, 'seed-data.json');
  const seedData = JSON.parse(fs.readFileSync(seedPath, 'utf-8'));
  const seedByCpf = new Map<string, { valorPlano: string }>(
    seedData.cooperados.map((c: any) => [c.cpf, c]),
  );

  // 3. Buscar cooperativa principal
  const cooperativa = await prisma.cooperativa.findFirst({ orderBy: { createdAt: 'asc' } });
  if (!cooperativa) throw new Error('Nenhuma cooperativa encontrada');
  console.log(`Cooperativa: ${cooperativa.nome} (${cooperativa.id})`);

  // 4. Buscar cooperados sem contrato e sem entrada na lista de espera
  const candidatos = await prisma.cooperado.findMany({
    where: {
      contratos: { none: {} },
      listaEspera: { none: {} },
    },
    select: { id: true, cpf: true, nomeCompleto: true, cotaKwhMensal: true },
  });

  console.log(`Cooperados sem contrato e sem lista de espera: ${candidatos.length}\n`);

  if (candidatos.length === 0) {
    console.log('Nenhum cooperado elegível para a lista de espera.');
    return;
  }

  // 5. Inserir na lista de espera
  let posicaoAtual = await prisma.listaEspera.count({ where: { status: 'AGUARDANDO' } });
  let criados = 0;
  let erros = 0;

  for (const cand of candidatos) {
    try {
      // Calcular kWh necessário: do seed-data se disponível, senão da cota, senão padrão
      const seedInfo = seedByCpf.get(cand.cpf);
      let kwhNecessario: number;

      if (seedInfo) {
        const valorPlano = parseFloat(seedInfo.valorPlano) || 0;
        kwhNecessario = Math.max(valorPlano / 0.90, 30);
      } else if (cand.cotaKwhMensal) {
        kwhNecessario = Math.max(Number(cand.cotaKwhMensal), 30);
      } else {
        // Valor padrão estimado entre 200-600 kWh
        kwhNecessario = 200 + Math.floor(Math.random() * 400);
      }

      posicaoAtual++;
      await prisma.listaEspera.create({
        data: {
          cooperadoId: cand.id,
          kwhNecessario,
          posicao: posicaoAtual,
          status: 'AGUARDANDO',
          cooperativaId: cooperativa.id,
        },
      });

      // Atualizar status para PENDENTE (aguardando alocação na usina)
      await prisma.cooperado.update({
        where: { id: cand.id },
        data: { status: 'PENDENTE' },
      });

      criados++;
      console.log(`  ✓ [${posicaoAtual}] ${cand.nomeCompleto} (${cand.cpf}) — ${kwhNecessario.toFixed(1)} kWh`);
    } catch (err: any) {
      erros++;
      console.log(`  ✗ ${cand.nomeCompleto} (${cand.cpf}) — ${err.message}`);
    }
  }

  console.log(`\n--- Resumo criação ---`);
  console.log(`  Inseridos na lista de espera: ${criados}`);
  console.log(`  Erros: ${erros}`);

  // 6. Verificar espera em todas as usinas
  console.log(`\n--- Verificando lista de espera nas usinas ---`);
  const usinas = await apiGet('/usinas', token);
  let promovidos = 0;

  for (const usina of usinas) {
    try {
      const result = await apiPost(`/usinas/${usina.id}/verificar-espera`, {}, token);
      const qtd = result?.alocados?.length || result?.alocados || 0;
      if (qtd > 0) {
        promovidos += typeof qtd === 'number' ? qtd : 0;
        console.log(`  Usina ${usina.nome}: ${JSON.stringify(result)}`);
      } else {
        console.log(`  Usina ${usina.nome}: sem promoções`);
      }
    } catch (err: any) {
      console.log(`  Usina ${usina.nome}: ${err.message}`);
    }
  }

  console.log(`\n=== Resultado Final ===`);
  console.log(`  Cooperados inseridos (lista espera): ${criados}`);
  console.log(`  Promovidos da fila: ${promovidos}`);
  console.log(`  Erros: ${erros}`);
}

main()
  .catch((e) => {
    console.error('Erro fatal:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
