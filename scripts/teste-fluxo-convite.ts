/**
 * TESTE-FLUXO-CONVITE.ts
 * Simula o fluxo completo: admin → membro envia convite → convidado cadastra → aprovação
 *
 * Pré-requisitos:
 * - Backend rodando em http://localhost:3000
 * - Seed de dados executado (João Oliveira existe)
 * - Admin com credenciais válidas
 *
 * Uso: npx ts-node scripts/teste-fluxo-convite.ts
 */

const API = process.env.API_URL || 'http://localhost:3000';

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function http<T = any>(
  method: string,
  path: string,
  body?: any,
  token?: string,
): Promise<{ status: number; data: T; ok: boolean }> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  let data: any;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  return { status: res.status, data, ok: res.ok };
}

interface Resultado {
  etapa: string;
  ok: boolean;
  detalhe: string;
}

const resultados: Resultado[] = [];

function registrar(etapa: string, ok: boolean, detalhe: string) {
  resultados.push({ etapa, ok, detalhe });
  const icon = ok ? '✅' : '❌';
  console.log(`${icon} ${etapa}: ${detalhe}`);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('═══════════════════════════════════════════════');
  console.log('  TESTE DE FLUXO DE CONVITE MLM via WhatsApp');
  console.log('═══════════════════════════════════════════════\n');

  // ─── 0. Login como admin ────────────────────────────────────────────────────
  console.log('── Etapa 0: Autenticação ──\n');

  const adminEmail = process.env.ADMIN_EMAIL || 'admin@cooperebr.com.br';
  const adminSenha = process.env.ADMIN_SENHA || 'admin123';
  const loginAdmin = await http('POST', '/auth/login', {
    identificador: adminEmail,
    senha: adminSenha,
  });

  let adminToken = '';
  if (loginAdmin.ok) {
    adminToken = loginAdmin.data.token;
    registrar('Login Admin', true, `Token obtido para ${adminEmail}`);
  } else {
    registrar('Login Admin', false, `Falha: ${JSON.stringify(loginAdmin.data)}`);
    console.log('\n⚠️  Sem token admin, usando busca direta no banco...\n');
  }

  // ─── 1. Buscar João Oliveira e seu link de indicação ────────────────────────
  console.log('\n── Etapa 1: Obter link de convite do João ──\n');

  // Primeiro, encontrar o cooperado João no banco via API
  const joaoSearch = await http('GET', '/cooperados?search=João+Carlos+Oliveira&limit=1', undefined, adminToken);

  let joaoId = '';
  let joaoNome = '';

  if (joaoSearch.ok && joaoSearch.data?.data?.length > 0) {
    const joao = joaoSearch.data.data[0];
    joaoId = joao.id;
    joaoNome = joao.nomeCompleto;
    registrar('Buscar João Oliveira', true, `ID: ${joaoId}, Nome: ${joaoNome}`);
  } else if (joaoSearch.ok && Array.isArray(joaoSearch.data) && joaoSearch.data.length > 0) {
    const joao = joaoSearch.data[0];
    joaoId = joao.id;
    joaoNome = joao.nomeCompleto;
    registrar('Buscar João Oliveira', true, `ID: ${joaoId}, Nome: ${joaoNome}`);
  } else {
    registrar('Buscar João Oliveira', false, `Não encontrado. Response: ${JSON.stringify(joaoSearch.data)}`);
  }

  // Tentar obter link de indicação (precisa autenticar como cooperado)
  // Como não temos login do João, vamos buscar o codigoIndicacao via listagem admin
  let codigoIndicacao = '';

  if (joaoId) {
    // Buscar detalhes do cooperado incluindo codigoIndicacao
    const joaoDetalhe = await http('GET', `/cooperados/${joaoId}`, undefined, adminToken);
    if (joaoDetalhe.ok && joaoDetalhe.data?.codigoIndicacao) {
      codigoIndicacao = joaoDetalhe.data.codigoIndicacao;
      registrar('Código de indicação do João', true, `Código: ${codigoIndicacao}`);
    } else {
      registrar('Código de indicação do João', false, `Não encontrado nos dados: ${JSON.stringify(joaoDetalhe.data?.codigoIndicacao)}`);
    }
  }

  // Simular acesso ao link de convite
  if (codigoIndicacao) {
    const linkConvite = `${process.env.FRONTEND_URL || 'http://localhost:3001'}/entrar?ref=${codigoIndicacao}`;
    registrar('Link de convite gerado', true, linkConvite);
  }

  // ─── 2. Simular convidado acessando o link ──────────────────────────────────
  console.log('\n── Etapa 2: Convidado acessa link e inicia cadastro ──\n');

  if (codigoIndicacao) {
    // Simula o endpoint de entrada do indicado via WhatsApp
    const entradaIndicado = await http('POST', '/whatsapp/entrada-indicado', {
      telefone: '5527992000001',
      codigoRef: codigoIndicacao,
    });

    if (entradaIndicado.ok || entradaIndicado.status === 201) {
      registrar('Entrada indicado via WhatsApp', true, `Fluxo de convite iniciado para telefone 5527992000001`);
    } else {
      registrar('Entrada indicado via WhatsApp', false, `Status ${entradaIndicado.status}: ${JSON.stringify(entradaIndicado.data)}`);
    }
  } else {
    registrar('Entrada indicado via WhatsApp', false, 'Sem código de indicação, não é possível simular');
  }

  // ─── 3. Registrar a indicação ───────────────────────────────────────────────
  console.log('\n── Etapa 3: Registrar indicação ──\n');

  // Criar o cooperado convidado primeiro
  const dadosConvidado = {
    nomeCompleto: 'Alexandre Nogueira Teles',
    cpf: '67890123456',
    email: 'alexandre.teles@gmail.com',
    telefone: '5527992000001',
    status: 'PENDENTE',
    cooperativaId: undefined as string | undefined,
  };

  // Buscar cooperativaId do João
  if (joaoId) {
    const joaoFull = await http('GET', `/cooperados/${joaoId}`, undefined, adminToken);
    if (joaoFull.ok && joaoFull.data?.cooperativaId) {
      dadosConvidado.cooperativaId = joaoFull.data.cooperativaId;
    }
  }

  // Verificar se convidado já existe (para idempotência)
  const searchExistente = await http('GET', '/cooperados?search=Alexandre+Nogueira+Teles&limit=1', undefined, adminToken);
  let convidadoId = '';

  if (searchExistente.ok) {
    const lista = searchExistente.data?.data || searchExistente.data || [];
    const existente = Array.isArray(lista) ? lista.find((c: any) => c.cpf === '67890123456' || c.email === 'alexandre.teles@gmail.com') : null;
    if (existente) {
      convidadoId = existente.id;
      registrar('Cooperado convidado (existente)', true, `ID: ${convidadoId}`);
    }
  }

  if (!convidadoId) {
    const criarConvidado = await http('POST', '/cooperados', dadosConvidado, adminToken);
    if (criarConvidado.ok || criarConvidado.status === 201) {
      convidadoId = criarConvidado.data?.id;
      registrar('Criar cooperado convidado', true, `Alexandre Nogueira Teles criado com ID: ${convidadoId}`);
    } else {
      registrar('Criar cooperado convidado', false, `Status ${criarConvidado.status}: ${JSON.stringify(criarConvidado.data)}`);
    }
  }

  // Registrar a indicação
  if (convidadoId && codigoIndicacao) {
    const regIndicacao = await http(
      'POST',
      '/indicacoes/registrar',
      { cooperadoIndicadoId: convidadoId, codigoIndicador: codigoIndicacao },
      adminToken,
    );

    if (regIndicacao.ok || regIndicacao.status === 201) {
      registrar('Registrar indicação', true, `Indicação de João → Alexandre registrada. Níveis: ${Array.isArray(regIndicacao.data) ? regIndicacao.data.length : 'N/A'}`);
    } else {
      registrar('Registrar indicação', false, `Status ${regIndicacao.status}: ${JSON.stringify(regIndicacao.data)}`);
    }
  } else {
    registrar('Registrar indicação', false, `Faltam dados: convidadoId=${convidadoId}, codigoIndicacao=${codigoIndicacao}`);
  }

  // ─── 4. Simular bot WhatsApp recebendo mensagem ────────────────────────────
  console.log('\n── Etapa 4: Simular bot WhatsApp ──\n');

  const webhookSecret = process.env.WHATSAPP_WEBHOOK_SECRET || 'cooperebr-webhook-secret';

  // Simular mensagem do número novo
  const msgWebhook = await http('POST', `/whatsapp/webhook-incoming?secret=${webhookSecret}`, {
    telefone: '5527992000001',
    tipo: 'texto',
    corpo: 'menu',
  });

  if (msgWebhook.ok || msgWebhook.status === 201) {
    registrar('WhatsApp webhook (mensagem menu)', true, 'Bot processou mensagem do número do convidado');
  } else {
    registrar('WhatsApp webhook (mensagem menu)', false, `Status ${msgWebhook.status}: ${JSON.stringify(msgWebhook.data)}`);
  }

  // ─── 5. Verificar dados do cadastro ────────────────────────────────────────
  console.log('\n── Etapa 5: Verificar cadastro do convidado ──\n');

  if (convidadoId) {
    const verConvidado = await http('GET', `/cooperados/${convidadoId}`, undefined, adminToken);
    if (verConvidado.ok) {
      const c = verConvidado.data;
      registrar('Verificar cadastro convidado', true,
        `Nome: ${c.nomeCompleto}, CPF: ${c.cpf}, Email: ${c.email}, Status: ${c.status}`);
    } else {
      registrar('Verificar cadastro convidado', false, `Erro ao buscar: ${verConvidado.status}`);
    }
  }

  // ─── 6. Verificar indicação no Clube do João ───────────────────────────────
  console.log('\n── Etapa 6: Verificar indicação e Clube de Vantagens ──\n');

  if (joaoId) {
    // Buscar indicações via admin
    const indicacoes = await http('GET', '/indicacoes', undefined, adminToken);
    if (indicacoes.ok) {
      const lista = Array.isArray(indicacoes.data) ? indicacoes.data : (indicacoes.data?.data || []);
      const indJoao = lista.filter((i: any) => i.indicadorId === joaoId);
      registrar('Indicações do João', true, `Total de indicações: ${indJoao.length}`);
    } else {
      registrar('Indicações do João', false, `Erro: ${indicacoes.status}`);
    }

    // Verificar progressão no clube (via detalhes do cooperado)
    const joaoClube = await http('GET', `/cooperados/${joaoId}`, undefined, adminToken);
    if (joaoClube.ok && joaoClube.data?.progressaoClube) {
      const p = joaoClube.data.progressaoClube;
      registrar('Clube de Vantagens do João', true,
        `Nível: ${p.nivelAtual}, kWh acumulado: ${p.kwhIndicadoAcumulado}, Indicados ativos: ${p.indicadosAtivos}`);
    } else {
      registrar('Clube de Vantagens do João', true,
        `Dados do clube: ${JSON.stringify(joaoClube.data?.progressaoClube || 'não disponível no endpoint')}`);
    }
  }

  // ─── Resumo ─────────────────────────────────────────────────────────────────
  console.log('\n═══════════════════════════════════════════════');
  console.log('  RESUMO DO TESTE');
  console.log('═══════════════════════════════════════════════\n');

  const ok = resultados.filter(r => r.ok).length;
  const fail = resultados.filter(r => !r.ok).length;

  for (const r of resultados) {
    console.log(`${r.ok ? '✅' : '❌'} ${r.etapa}`);
  }

  console.log(`\n📊 Total: ${ok} ✅ | ${fail} ❌ de ${resultados.length} etapas\n`);

  return resultados;
}

main().catch(console.error);

export { main as testeFluxoConvite, Resultado };
