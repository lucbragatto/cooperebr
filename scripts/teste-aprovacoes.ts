/**
 * TESTE-APROVACOES.ts
 * Simula o admin aprovando documentos pendentes e ativando contratos
 *
 * Pré-requisitos:
 * - Backend rodando em http://localhost:3000
 * - Seed de dados executado
 * - Admin com credenciais válidas
 *
 * Uso: npx ts-node scripts/teste-aprovacoes.ts
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
  console.log('  TESTE DE APROVAÇÕES (Admin)');
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
    console.log('\n⚠️  Sem token admin, o teste não pode continuar.\n');
    return resultados;
  }

  // ─── 1. Listar cooperados para encontrar documentos ────────────────────────
  console.log('\n── Etapa 1: Listar documentos pendentes ──\n');

  // Buscar todos os cooperados
  const cooperados = await http('GET', '/cooperados?limit=50', undefined, adminToken);
  if (!cooperados.ok) {
    registrar('Listar cooperados', false, `Status: ${cooperados.status}`);
    return resultados;
  }

  const listaCooperados = cooperados.data?.data || cooperados.data || [];
  registrar('Listar cooperados', true, `${listaCooperados.length} cooperados encontrados`);

  // Buscar documentos pendentes de cada cooperado
  let docsPendentes: any[] = [];

  for (const coop of listaCooperados) {
    const docs = await http('GET', `/documentos/cooperado/${coop.id}`, undefined, adminToken);
    if (docs.ok && Array.isArray(docs.data)) {
      const pendentes = docs.data.filter((d: any) => d.status === 'PENDENTE');
      docsPendentes.push(...pendentes);
    }
  }

  if (docsPendentes.length > 0) {
    registrar('Documentos pendentes encontrados', true, `${docsPendentes.length} documentos pendentes`);
  } else {
    registrar('Documentos pendentes encontrados', true, 'Nenhum documento pendente no momento (seed pode não ter criado docs)');
  }

  // ─── 2. Aprovar documentos pendentes ───────────────────────────────────────
  console.log('\n── Etapa 2: Aprovar documentos pendentes ──\n');

  let docsAprovados = 0;
  for (const doc of docsPendentes) {
    const aprovar = await http('PATCH', `/documentos/${doc.id}/aprovar`, {}, adminToken);
    if (aprovar.ok) {
      docsAprovados++;
      registrar(`Aprovar doc ${doc.tipo}`, true,
        `Documento ${doc.id} (${doc.tipo}) aprovado — cooperado: ${doc.cooperadoId}`);
    } else {
      registrar(`Aprovar doc ${doc.tipo}`, false,
        `Falha ao aprovar ${doc.id}: ${aprovar.status} — ${JSON.stringify(aprovar.data)}`);
    }
  }

  if (docsPendentes.length === 0) {
    registrar('Aprovação de documentos', true, 'Nenhum documento pendente para aprovar (cenário limpo)');
  } else {
    registrar('Resumo aprovação docs', docsAprovados === docsPendentes.length,
      `${docsAprovados}/${docsPendentes.length} aprovados`);
  }

  // ─── 3. Verificar notificações WhatsApp ────────────────────────────────────
  console.log('\n── Etapa 3: Verificar notificações WhatsApp de aprovação ──\n');

  // Verificar histórico de mensagens recentes
  const historico = await http('GET', '/whatsapp/historico?limit=20', undefined, adminToken);
  if (historico.ok) {
    const msgs = historico.data?.data || historico.data || [];
    const msgsAprovacao = Array.isArray(msgs)
      ? msgs.filter((m: any) => m.conteudo?.includes('aprovado') || m.conteudo?.includes('Aprovado'))
      : [];
    registrar('Notificações WhatsApp', true,
      `${msgsAprovacao.length} mensagens de aprovação encontradas no histórico recente (total: ${Array.isArray(msgs) ? msgs.length : 0})`);
  } else {
    registrar('Notificações WhatsApp', false, `Erro ao buscar histórico: ${historico.status}`);
  }

  // ─── 4. Listar contratos pendentes ─────────────────────────────────────────
  console.log('\n── Etapa 4: Listar contratos pendentes ──\n');

  const contratos = await http('GET', '/contratos', undefined, adminToken);
  let contratosPendentes: any[] = [];

  if (contratos.ok) {
    const lista = Array.isArray(contratos.data) ? contratos.data : (contratos.data?.data || []);
    contratosPendentes = lista.filter((c: any) =>
      c.status === 'PENDENTE_ATIVACAO' || c.status === 'AGUARDANDO_ASSINATURA' || c.status === 'EM_APROVACAO',
    );
    registrar('Contratos pendentes', true,
      `${contratosPendentes.length} contratos pendentes de ${lista.length} total`);
  } else {
    registrar('Contratos pendentes', false, `Erro: ${contratos.status}`);
  }

  // ─── 5. Ativar contratos pendentes ─────────────────────────────────────────
  console.log('\n── Etapa 5: Ativar contratos pendentes ──\n');

  let contratosAtivados = 0;
  for (const contrato of contratosPendentes) {
    const ativar = await http(
      'POST',
      `/contratos/${contrato.id}/ativar`,
      {
        protocoloConcessionaria: `PROT-${Date.now()}-${contrato.id.slice(0, 6)}`,
        dataInicioCreditos: new Date().toISOString().slice(0, 10),
        observacoes: 'Ativação via teste automatizado',
      },
      adminToken,
    );

    if (ativar.ok) {
      contratosAtivados++;
      registrar(`Ativar contrato ${contrato.numero}`, true,
        `Contrato ${contrato.id} ativado com sucesso`);
    } else {
      registrar(`Ativar contrato ${contrato.numero}`, false,
        `Falha: ${ativar.status} — ${JSON.stringify(ativar.data)}`);
    }
  }

  if (contratosPendentes.length === 0) {
    registrar('Ativação de contratos', true, 'Nenhum contrato pendente para ativar');
  } else {
    registrar('Resumo ativação contratos', contratosAtivados === contratosPendentes.length,
      `${contratosAtivados}/${contratosPendentes.length} ativados`);
  }

  // ─── Resumo ─────────────────────────────────────────────────────────────────
  console.log('\n═══════════════════════════════════════════════');
  console.log('  RESUMO DO TESTE DE APROVAÇÕES');
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

export { main as testeAprovacoes, Resultado };
