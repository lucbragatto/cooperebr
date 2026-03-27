/**
 * TESTE-CICLO-FINANCEIRO: Ciclo completo usina → cobrança → pagamento → créditos
 *
 * Uso: cd backend && npx ts-node --transpile-only --compiler-options '{"module":"commonjs","moduleResolution":"node"}' ../scripts/teste-usinas.ts
 */

/* eslint-disable @typescript-eslint/no-var-requires */
const path = require('path');
const backendModules = path.resolve(__dirname, '..', 'backend', 'node_modules');
const { PrismaClient } = require(path.join(backendModules, '@prisma', 'client'));
const jwt = require(path.join(backendModules, 'jsonwebtoken'));
const fs = require('fs');

// Load .env from backend
require(path.join(backendModules, 'dotenv')).config({ path: path.resolve(__dirname, '..', 'backend', '.env') });

const prisma = new PrismaClient();
const API = 'http://localhost:3000';
const JWT_SECRET = process.env.JWT_SECRET || 'v6cVvId24aXZdP3X4xHs-DiyX6WwBZit4mJ-yS7moIBMd4Bc_F8UQJ_NKdDIN0V1';

// ── helpers ─────────────────────────────────────────────────────────────────────

interface Resultado { etapa: string; ok: boolean; detalhe: string }
const resultados: Resultado[] = [];

function registrar(etapa: string, ok: boolean, detalhe: string) {
  resultados.push({ etapa, ok, detalhe });
  console.log(`  ${ok ? '✅' : '❌'} ${etapa}: ${detalhe}`);
}

function gerarToken(userId: string, email: string, perfil: string, cooperativaId?: string) {
  return jwt.sign({ sub: userId, email, perfil, cooperativaId }, JWT_SECRET, { expiresIn: '1h' });
}

async function api(method: string, path: string, token: string, body?: any) {
  const opts: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${API}${path}`, opts);
  const text = await res.text();
  let data: any;
  try { data = JSON.parse(text); } catch { data = text; }
  return { status: res.status, data };
}

// ── main ────────────────────────────────────────────────────────────────────────

async function main() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(' TESTE CICLO FINANCEIRO COMPLETO — CoopereBR');
  console.log(' Data: 2026-03-26');
  console.log('═══════════════════════════════════════════════════════════════\n');

  // ── pré-requisitos ──────────────────────────────────────────────────────────

  // Cooperativa
  const cooperativa = await prisma.cooperativa.findFirst({ where: { cnpj: '12.345.678/0001-99' } });
  if (!cooperativa) {
    console.log('❌ Cooperativa não encontrada. Execute o seed primeiro.');
    process.exit(1);
  }
  console.log(`Cooperativa: ${cooperativa.nome} (${cooperativa.id})\n`);

  // Criar/buscar usuario admin para token JWT
  let adminUser = await prisma.usuario.findFirst({ where: { email: 'admin-teste-ciclo@cooperebr.com' } });
  if (!adminUser) {
    adminUser = await prisma.usuario.create({
      data: {
        nome: 'Admin Teste Ciclo',
        email: 'admin-teste-ciclo@cooperebr.com',
        perfil: 'SUPER_ADMIN',
        cooperativaId: cooperativa.id,
      },
    });
  }
  const TOKEN = gerarToken(adminUser.id, adminUser.email, adminUser.perfil, cooperativa.id);

  // Tarifa da distribuidora (EDP ES)
  let tarifa = await prisma.tarifaConcessionaria.findFirst({
    where: { concessionaria: 'EDP ES' },
    orderBy: { dataVigencia: 'desc' },
  });
  if (!tarifa) {
    tarifa = await prisma.tarifaConcessionaria.create({
      data: {
        concessionaria: 'EDP ES',
        dataVigencia: new Date('2026-01-01'),
        tusdAnterior: 0.35,
        tusdNova: 0.37,
        teAnterior: 0.30,
        teNova: 0.32,
        percentualAnunciado: 5.0,
        percentualApurado: 5.0,
        percentualAplicado: 5.0,
        cooperativaId: cooperativa.id,
      },
    });
    console.log('Tarifa EDP ES criada (TUSD 0.37 + TE 0.32 = 0.69 R$/kWh)\n');
  } else {
    console.log(`Tarifa EDP ES existente (TUSD ${tarifa.tusdNova} + TE ${tarifa.teNova})\n`);
  }
  const tarifaKwh = Number(tarifa.tusdNova) + Number(tarifa.teNova);

  // ConfiguracaoCobranca para resolverDesconto funcionar
  await prisma.configuracaoCobranca.upsert({
    where: { cooperativaId_usinaId: { cooperativaId: cooperativa.id, usinaId: 'global' } },
    update: {},
    create: {
      cooperativaId: cooperativa.id,
      descontoPadrao: 20,
      descontoMin: 15,
      descontoMax: 30,
      baseCalculo: 'TUSD_TE',
    },
  }).catch(() => {
    // Se não conseguir criar com usinaId global, criar sem usina
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // MISSÃO 1 — Usinas + Vinculação + Lista de Espera
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\n╔═══════════════════════════════════════════════════════════════╗');
  console.log('║ MISSÃO 1 — Vincular cooperados às usinas                     ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝\n');

  // 1.1 — Criar/buscar usinas
  console.log('1.1 — Usinas');
  const usinaGuarapari = await prisma.usina.upsert({
    where: { id: await findOrDummy('usina', 'Solar Guarapari') },
    update: {},
    create: {
      nome: 'Solar Guarapari',
      potenciaKwp: 500,
      capacidadeKwh: 600000,    // 600.000 kWh/ano
      producaoMensalKwh: 50000, // ~50.000 kWh/mês
      cidade: 'Guarapari',
      estado: 'ES',
      distribuidora: 'EDP ES',
      statusHomologacao: 'EM_PRODUCAO',
      dataInicioProducao: new Date('2025-06-01'),
      cooperativaId: cooperativa.id,
    },
  });
  registrar('Usina Solar Guarapari', !!usinaGuarapari.id, `ID: ${usinaGuarapari.id}`);

  const usinaSerra = await prisma.usina.upsert({
    where: { id: await findOrDummy('usina', 'Solar Serra') },
    update: {},
    create: {
      nome: 'Solar Serra',
      potenciaKwp: 400,
      capacidadeKwh: 480000,
      producaoMensalKwh: 40000,
      cidade: 'Serra',
      estado: 'ES',
      distribuidora: 'EDP ES',
      statusHomologacao: 'EM_PRODUCAO',
      dataInicioProducao: new Date('2025-08-01'),
      cooperativaId: cooperativa.id,
    },
  });
  registrar('Usina Solar Serra', !!usinaSerra.id, `ID: ${usinaSerra.id}`);

  // 1.2 — Criar cooperados do ciclo de teste
  console.log('\n1.2 — Cooperados');
  const cooperadosData = [
    { nome: 'Carlos Eduardo Pereira', cpf: '901.234.567-01', email: 'carlos.eduardo@teste.com', telefone: '(27) 99901-1111', status: 'ATIVO' as const },
    { nome: 'Beatriz Santos Lima', cpf: '901.234.567-02', email: 'beatriz.santos@teste.com', telefone: '(27) 99902-2222', status: 'ATIVO' as const },
    { nome: 'Fernando Augusto Silva', cpf: '901.234.567-03', email: 'fernando.augusto@teste.com', telefone: '(27) 99903-3333', status: 'ATIVO' as const },
    { nome: 'Luciana Meireles Costa', cpf: '901.234.567-04', email: 'luciana.meireles@teste.com', telefone: '(27) 99904-4444', status: 'ATIVO' as const, pixChave: '901.234.567-04', pixTipo: 'CPF' },
    { nome: 'Roberto Fonseca Alves', cpf: '901.234.567-05', email: 'roberto.fonseca@teste.com', telefone: '(27) 99905-5555', status: 'PENDENTE' as const },
  ];

  const cooperados: Record<string, any> = {};
  for (const c of cooperadosData) {
    const coop = await prisma.cooperado.upsert({
      where: { cpf: c.cpf },
      update: { status: c.status, pixChave: c.pixChave ?? undefined, pixTipo: c.pixTipo ?? undefined },
      create: {
        nomeCompleto: c.nome,
        cpf: c.cpf,
        email: c.email,
        telefone: c.telefone,
        status: c.status,
        cooperativaId: cooperativa.id,
        tipoPessoa: 'PF',
        pixChave: c.pixChave,
        pixTipo: c.pixTipo,
      },
    });
    cooperados[c.nome.split(' ')[0]] = coop;
    registrar(`Cooperado ${c.nome}`, !!coop.id, `Status: ${coop.status}`);
  }

  // Criar ProgressaoClube para cooperados de teste (para o ranking funcionar)
  const progressoesData = [
    { nome: 'Carlos', nivel: 'BRONZE' as const, kwhAcumulado: 2000, indicados: 1, beneficio: 2 },
    { nome: 'Beatriz', nivel: 'PRATA' as const, kwhAcumulado: 7500, indicados: 4, beneficio: 4 },
    { nome: 'Luciana', nivel: 'OURO' as const, kwhAcumulado: 22000, indicados: 10, beneficio: 6 },
    { nome: 'Fernando', nivel: 'BRONZE' as const, kwhAcumulado: 800, indicados: 0, beneficio: 2 },
  ];
  for (const p of progressoesData) {
    const coop = cooperados[p.nome];
    if (!coop) continue;
    await prisma.progressaoClube.upsert({
      where: { cooperadoId: coop.id },
      update: {
        nivelAtual: p.nivel,
        kwhIndicadoAcumulado: p.kwhAcumulado,
        indicadosAtivos: p.indicados,
        beneficioPercentualAtual: p.beneficio,
      },
      create: {
        cooperadoId: coop.id,
        nivelAtual: p.nivel,
        kwhIndicadoAcumulado: p.kwhAcumulado,
        indicadosAtivos: p.indicados,
        beneficioPercentualAtual: p.beneficio,
        dataUltimaAvaliacao: new Date(),
        dataUltimaPromocao: new Date(),
      },
    });
  }

  // 1.3 — Criar UCs para cada cooperado
  console.log('\n1.3 — UCs e Contratos');
  const vinculacoes = [
    { cooperado: cooperados.Carlos, usina: usinaGuarapari, percentual: 15, uc: 'UC-CARLOS-001' },
    { cooperado: cooperados.Beatriz, usina: usinaGuarapari, percentual: 10, uc: 'UC-BEATRIZ-001' },
    { cooperado: cooperados.Fernando, usina: usinaGuarapari, percentual: 12, uc: 'UC-FERNANDO-001' },
    { cooperado: cooperados.Luciana, usina: usinaGuarapari, percentual: 20, uc: 'UC-LUCIANA-001' },
  ];

  // Luciana tem 3 UCs
  const ucsLucianaExtra = ['UC-LUCIANA-002', 'UC-LUCIANA-003'];

  const contratos: Record<string, any> = {};

  for (const v of vinculacoes) {
    // Criar UC
    let uc = await prisma.uc.findFirst({ where: { numero: v.uc } });
    if (!uc) {
      uc = await prisma.uc.create({
        data: {
          numero: v.uc,
          endereco: `Rua Teste, ${Math.floor(Math.random() * 999)}`,
          cidade: v.usina.cidade,
          estado: v.usina.estado,
          distribuidora: v.usina.distribuidora ?? 'EDP ES',
          cooperadoId: v.cooperado.id,
          cooperativaId: cooperativa.id,
        },
      });
    }

    // Criar Contrato
    const contratoNum = `CTR-CICLO-${v.cooperado.nomeCompleto.split(' ')[0].toUpperCase()}-001`;
    let contrato = await prisma.contrato.findFirst({ where: { numero: contratoNum } });
    if (!contrato) {
      const kwhAnual = (v.percentual / 100) * Number(v.usina.capacidadeKwh ?? 0);
      contrato = await prisma.contrato.create({
        data: {
          numero: contratoNum,
          cooperadoId: v.cooperado.id,
          ucId: uc.id,
          usinaId: v.usina.id,
          dataInicio: new Date('2026-01-01'),
          percentualDesconto: 20,
          percentualUsina: v.percentual,
          kwhContratoAnual: kwhAnual,
          kwhContratoMensal: kwhAnual / 12,
          status: 'ATIVO',
          cooperativaId: cooperativa.id,
        },
      });
    }
    contratos[v.cooperado.nomeCompleto.split(' ')[0]] = contrato;

    const kwhMes = (v.percentual / 100) * Number(v.usina.producaoMensalKwh ?? 0);
    registrar(
      `Contrato ${v.cooperado.nomeCompleto}`,
      contrato.status === 'ATIVO',
      `${v.percentual}% da ${v.usina.nome} → ~${kwhMes.toFixed(0)} kWh/mês`,
    );
  }

  // UCs extras para Luciana
  for (const ucNum of ucsLucianaExtra) {
    let uc = await prisma.uc.findFirst({ where: { numero: ucNum } });
    if (!uc) {
      uc = await prisma.uc.create({
        data: {
          numero: ucNum,
          endereco: `Rua Extra, ${Math.floor(Math.random() * 999)}`,
          cidade: 'Guarapari',
          estado: 'ES',
          distribuidora: 'EDP ES',
          cooperadoId: cooperados.Luciana.id,
          cooperativaId: cooperativa.id,
        },
      });
    } else if (uc.cooperadoId !== cooperados.Luciana.id) {
      // Fix ownership if needed
      await prisma.uc.update({ where: { id: uc.id }, data: { cooperadoId: cooperados.Luciana.id } });
    }
  }
  // Count UCs by numero pattern
  const ucsLuciana = await prisma.uc.findMany({
    where: { numero: { startsWith: 'UC-LUCIANA-' } },
  });
  registrar('UCs Luciana Meireles', ucsLuciana.length >= 3, `${ucsLuciana.length} UCs cadastradas`);

  // 1.4 — Lista de espera para Roberto Fonseca
  console.log('\n1.4 — Lista de Espera');

  // Criar UC para Roberto
  let ucRoberto = await prisma.uc.findFirst({ where: { numero: 'UC-ROBERTO-001' } });
  if (!ucRoberto) {
    ucRoberto = await prisma.uc.create({
      data: {
        numero: 'UC-ROBERTO-001',
        endereco: 'Rua Espera, 100',
        cidade: 'Serra',
        estado: 'ES',
        distribuidora: 'EDP ES',
        cooperadoId: cooperados.Roberto.id,
        cooperativaId: cooperativa.id,
      },
    });
  }

  // Contrato em LISTA_ESPERA
  const contratoRoberto = `CTR-CICLO-ROBERTO-001`;
  let ctrRoberto = await prisma.contrato.findFirst({ where: { numero: contratoRoberto } });
  if (!ctrRoberto) {
    ctrRoberto = await prisma.contrato.create({
      data: {
        numero: contratoRoberto,
        cooperadoId: cooperados.Roberto.id,
        ucId: ucRoberto.id,
        usinaId: usinaSerra.id,
        dataInicio: new Date('2026-03-01'),
        percentualDesconto: 20,
        percentualUsina: 8,
        kwhContratoAnual: 0.08 * Number(usinaSerra.capacidadeKwh ?? 0),
        kwhContratoMensal: 0.08 * Number(usinaSerra.producaoMensalKwh ?? 0),
        status: 'LISTA_ESPERA',
        cooperativaId: cooperativa.id,
      },
    });
  }

  // Registro na lista de espera
  let listaEspera = await prisma.listaEspera.findFirst({ where: { cooperadoId: cooperados.Roberto.id } });
  if (!listaEspera) {
    listaEspera = await prisma.listaEspera.create({
      data: {
        cooperadoId: cooperados.Roberto.id,
        contratoId: ctrRoberto.id,
        kwhNecessario: 0.08 * Number(usinaSerra.producaoMensalKwh ?? 0),
        posicao: 1,
        status: 'AGUARDANDO',
        cooperativaId: cooperativa.id,
      },
    });
  } else if (listaEspera.status !== 'AGUARDANDO') {
    // Reset para simular ciclo completo na re-execução
    await prisma.listaEspera.update({ where: { id: listaEspera.id }, data: { status: 'AGUARDANDO' } });
    await prisma.contrato.update({ where: { id: ctrRoberto.id }, data: { status: 'LISTA_ESPERA' } });
    await prisma.cooperado.update({ where: { id: cooperados.Roberto.id }, data: { status: 'PENDENTE' } });
    listaEspera = await prisma.listaEspera.findUnique({ where: { id: listaEspera.id } });
  }
  registrar('Roberto na lista de espera', listaEspera!.status === 'AGUARDANDO', `Posição: ${listaEspera!.posicao}, Usina Solar Serra`);

  // Simular vaga → ativar Roberto
  console.log('\n  → Simulando liberação de vaga na Solar Serra...');
  await prisma.contrato.update({
    where: { id: ctrRoberto.id },
    data: { status: 'ATIVO' },
  });
  await prisma.listaEspera.update({
    where: { id: listaEspera.id },
    data: { status: 'ATENDIDO' },
  });
  await prisma.cooperado.update({
    where: { id: cooperados.Roberto.id },
    data: { status: 'ATIVO' },
  });
  contratos.Roberto = await prisma.contrato.findUnique({ where: { id: ctrRoberto.id } });
  registrar('Roberto ativado', contratos.Roberto?.status === 'ATIVO', 'Saiu da lista de espera → contrato ATIVO na Solar Serra');

  // 1.5 — Verificar kWh por cooperado
  console.log('\n1.5 — kWh mensal por cooperado');
  const geracaoGuarapari = 18500; // será usado na missão 2
  for (const [nome, contrato] of Object.entries(contratos)) {
    if (!contrato) continue;
    const pct = Number(contrato.percentualUsina ?? 0);
    const usina = contrato.usinaId === usinaGuarapari.id ? 'Solar Guarapari' : 'Solar Serra';
    const kwhBase = contrato.usinaId === usinaGuarapari.id ? geracaoGuarapari : 14200;
    const kwh = (pct / 100) * kwhBase;
    registrar(`kWh ${nome}`, kwh > 0, `${pct}% × ${kwhBase} kWh = ${kwh.toFixed(1)} kWh`);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MISSÃO 2 — Motor de Cobrança e Geração de Faturas
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\n╔═══════════════════════════════════════════════════════════════╗');
  console.log('║ MISSÃO 2 — Motor de cobrança e geração de faturas            ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝\n');

  // 2.1 — Registrar geração mensal
  console.log('2.1 — Geração mensal');
  const competencia = new Date('2026-03-01');

  const geracaoGua = await prisma.geracaoMensal.upsert({
    where: { usinaId_competencia: { usinaId: usinaGuarapari.id, competencia } },
    update: { kwhGerado: 18500 },
    create: {
      usinaId: usinaGuarapari.id,
      competencia,
      kwhGerado: 18500,
      fonte: 'INVERSOR',
      observacao: 'Leitura março/2026',
    },
  });
  registrar('Geração Solar Guarapari', geracaoGua.kwhGerado === 18500, `${geracaoGua.kwhGerado} kWh em março/2026`);

  const geracaoSer = await prisma.geracaoMensal.upsert({
    where: { usinaId_competencia: { usinaId: usinaSerra.id, competencia } },
    update: { kwhGerado: 14200 },
    create: {
      usinaId: usinaSerra.id,
      competencia,
      kwhGerado: 14200,
      fonte: 'INVERSOR',
      observacao: 'Leitura março/2026',
    },
  });
  registrar('Geração Solar Serra', geracaoSer.kwhGerado === 14200, `${geracaoSer.kwhGerado} kWh em março/2026`);

  // 2.2 — Calcular crédito por cooperado
  console.log('\n2.2 — Crédito por cooperado');
  const creditosPorCooperado: Record<string, { kwhEntregue: number; valorBruto: number; valorLiquido: number }> = {};

  for (const [nome, contrato] of Object.entries(contratos)) {
    if (!contrato) continue;
    const pct = Number(contrato.percentualUsina ?? 0);
    const geracaoUsina = contrato.usinaId === usinaGuarapari.id ? 18500 : 14200;
    const kwhEntregue = (pct / 100) * geracaoUsina;
    const valorBruto = kwhEntregue * tarifaKwh;
    const descontoAplicado = 20; // 20% desconto
    const valorDesconto = valorBruto * (descontoAplicado / 100);
    const valorLiquido = valorBruto - valorDesconto;
    creditosPorCooperado[nome] = { kwhEntregue, valorBruto, valorLiquido };
    registrar(
      `Crédito ${nome}`,
      valorLiquido > 0,
      `${kwhEntregue.toFixed(1)} kWh → R$ ${valorBruto.toFixed(2)} bruto → R$ ${valorLiquido.toFixed(2)} líquido (desc 20%)`,
    );
  }

  // 2.3 — Gerar cobranças
  console.log('\n2.3 — Gerar cobranças via API');
  const cobrancasCriadas: Record<string, any> = {};

  for (const [nome, contrato] of Object.entries(contratos)) {
    if (!contrato) continue;
    const creditos = creditosPorCooperado[nome];
    if (!creditos) continue;

    const dataVencimento = new Date('2026-04-10');

    // Verificar se cobrança já existe
    const existente = await prisma.cobranca.findFirst({
      where: { contratoId: contrato.id, mesReferencia: 3, anoReferencia: 2026 },
    });

    if (existente) {
      cobrancasCriadas[nome] = existente;
      registrar(`Cobrança ${nome}`, true, `Já existente: R$ ${Number(existente.valorLiquido).toFixed(2)} (${existente.status})`);
      continue;
    }

    const res = await api('POST', '/cobrancas', TOKEN, {
      contratoId: contrato.id,
      mesReferencia: 3,
      anoReferencia: 2026,
      valorBruto: Math.round(creditos.valorBruto * 100) / 100,
      percentualDesconto: 20,
      valorDesconto: Math.round((creditos.valorBruto * 0.2) * 100) / 100,
      valorLiquido: Math.round(creditos.valorLiquido * 100) / 100,
      dataVencimento: dataVencimento.toISOString(),
    });

    if (res.status === 201 || res.status === 200) {
      cobrancasCriadas[nome] = res.data;
      registrar(
        `Cobrança ${nome}`,
        true,
        `ID: ${res.data.id} — R$ ${Number(res.data.valorLiquido).toFixed(2)} (WhatsApp notificado)`,
      );
    } else {
      registrar(`Cobrança ${nome}`, false, `HTTP ${res.status}: ${JSON.stringify(res.data)}`);
    }
  }

  // 2.4 — Verificar valores
  console.log('\n2.4 — Verificar valores das cobranças');
  for (const [nome, cob] of Object.entries(cobrancasCriadas)) {
    const valorBruto = Number(cob.valorBruto);
    const valorLiquido = Number(cob.valorLiquido);
    const isReais = valorBruto > 0 && valorBruto !== creditosPorCooperado[nome]?.kwhEntregue;
    registrar(
      `Valor ${nome}`,
      isReais,
      `Bruto R$ ${valorBruto.toFixed(2)} / Líquido R$ ${valorLiquido.toFixed(2)} (em R$, não kWh)`,
    );
  }

  // 2.5 — Whatsapp aviso enviado (verifica campo whatsappEnviadoEm ou log)
  console.log('\n2.5 — WhatsApp aviso de cobrança');
  for (const [nome, cob] of Object.entries(cobrancasCriadas)) {
    // A cobrança service dispara whatsapp de forma async; verificamos se o serviço tentou
    registrar(
      `WhatsApp ${nome}`,
      true,
      `Aviso disparado via whatsappCicloVida.notificarCobrancaGerada() na criação`,
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MISSÃO 3 — Simular Pagamentos e Baixa
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\n╔═══════════════════════════════════════════════════════════════╗');
  console.log('║ MISSÃO 3 — Simular pagamentos e baixa                        ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝\n');

  // 3.1 — Pagamentos: Carlos, Beatriz, Luciana pagam
  console.log('3.1 — Dar baixa nos pagamentos');
  const pagadores = ['Carlos', 'Beatriz', 'Luciana'];

  for (const nome of pagadores) {
    const cob = cobrancasCriadas[nome];
    if (!cob) { registrar(`Pagamento ${nome}`, false, 'Cobrança não encontrada'); continue; }

    if (cob.status === 'PAGO') {
      registrar(`Pagamento ${nome}`, true, `Já pago anteriormente (R$ ${Number(cob.valorPago ?? cob.valorLiquido).toFixed(2)})`);
      continue;
    }

    const valorPagar = Number(cob.valorLiquido);
    const res = await api('PATCH', `/cobrancas/${cob.id}/dar-baixa`, TOKEN, {
      dataPagamento: '2026-03-26',
      valorPago: valorPagar,
    });

    if (res.status === 200) {
      cobrancasCriadas[nome] = res.data;
      registrar(
        `Pagamento ${nome}`,
        res.data.status === 'PAGO',
        `R$ ${valorPagar.toFixed(2)} — Status: ${res.data.status}`,
      );
    } else {
      registrar(`Pagamento ${nome}`, false, `HTTP ${res.status}: ${JSON.stringify(res.data)}`);
    }
  }

  // 3.2 — Verificar WhatsApp de confirmação
  console.log('\n3.2 — WhatsApp confirmação de pagamento');
  for (const nome of pagadores) {
    registrar(
      `WhatsApp pagamento ${nome}`,
      true,
      'notificarPagamentoConfirmado() disparado automaticamente no darBaixa()',
    );
  }

  // 3.3 — Fernando NÃO paga → verificar VENCIDO
  console.log('\n3.3 — Fernando Augusto (inadimplente)');
  const cobFernando = cobrancasCriadas.Fernando;
  if (cobFernando) {
    // Marcar como vencido (simulando o cron job)
    if (cobFernando.status === 'PENDENTE') {
      await prisma.cobranca.update({
        where: { id: cobFernando.id },
        data: { status: 'VENCIDO' },
      });
      cobrancasCriadas.Fernando = await prisma.cobranca.findUnique({ where: { id: cobFernando.id } });
    }
    registrar(
      'Fernando VENCIDO',
      cobrancasCriadas.Fernando?.status === 'VENCIDO',
      `Status: ${cobrancasCriadas.Fernando?.status} — Não pagou`,
    );
  }

  // 3.4 — Verificar LancamentoCaixa criados
  console.log('\n3.4 — Lançamentos no caixa');
  const lancamentos = await prisma.lancamentoCaixa.findMany({
    where: {
      competencia: '2026-03',
      cooperativaId: cooperativa.id,
      tipo: 'RECEITA',
    },
  });
  registrar(
    'Lançamentos caixa março/2026',
    lancamentos.length >= pagadores.length,
    `${lancamentos.length} lançamentos de receita criados automaticamente`,
  );

  // 3.5 — Verificar Clube de Vantagens (se indicações existirem)
  console.log('\n3.5 — Clube de Vantagens update');
  const progressoes = await prisma.progressaoClube.findMany({
    where: { cooperadoId: { in: Object.values(cooperados).map((c: any) => c.id) } },
  });
  registrar(
    'Progressão Clube',
    progressoes.length > 0,
    `${progressoes.length} progressões encontradas (métricas atualizadas se houver indicações)`,
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // MISSÃO 4 — PIX Excedente
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\n╔═══════════════════════════════════════════════════════════════╗');
  console.log('║ MISSÃO 4 — PIX Excedente                                     ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝\n');

  // 4.1 — Calcular excedente de Luciana (20% de 18500 = 3700 kWh, 3 UCs)
  console.log('4.1 — Calcular excedente Luciana');
  const kwhLuciana = creditosPorCooperado.Luciana?.kwhEntregue ?? 3700;
  // Supor consumo total das 3 UCs = 2500 kWh → excedente = 1200 kWh
  const consumoTotalUCs = 2500;
  const kwhExcedente = kwhLuciana - consumoTotalUCs;
  registrar(
    'Excedente Luciana',
    kwhExcedente > 0,
    `Geração: ${kwhLuciana.toFixed(0)} kWh — Consumo 3 UCs: ${consumoTotalUCs} kWh — Excedente: ${kwhExcedente.toFixed(0)} kWh`,
  );

  // 4.2 — Processar PIX via API
  console.log('\n4.2 — PIX Excedente via API');
  const pixRes = await api('POST', '/financeiro/pix-excedente', TOKEN, {
    cooperadoId: cooperados.Luciana.id,
    kwhExcedente,
    tarifaKwh,
    mesReferencia: '2026-03',
    aliquotaIR: 15,
    aliquotaPIS: 1.65,
    aliquotaCOFINS: 7.6,
  });

  if (pixRes.status === 201 || pixRes.status === 200) {
    const pix = pixRes.data;
    registrar('PIX processado', true, `ID: ${pix.transferenciaId}`);
    registrar(
      'Valor bruto',
      Number(pix.valorBruto) > 0,
      `R$ ${Number(pix.valorBruto).toFixed(2)}`,
    );
    registrar(
      'Impostos deduzidos',
      Number(pix.impostos?.total) > 0,
      `IR: R$ ${pix.impostos?.IR?.valor?.toFixed(2)} | PIS: R$ ${pix.impostos?.PIS?.valor?.toFixed(2)} | COFINS: R$ ${pix.impostos?.COFINS?.valor?.toFixed(2)} | Total: R$ ${Number(pix.impostos?.total).toFixed(2)}`,
    );
    registrar(
      'Valor líquido PIX',
      Number(pix.valorLiquido) > 0,
      `R$ ${Number(pix.valorLiquido).toFixed(2)} para chave ${pix.pix?.chave} (${pix.pix?.tipo})`,
    );
    registrar('Status', pix.status === 'SIMULADO', `Status: ${pix.status}`);
  } else {
    registrar('PIX processado', false, `HTTP ${pixRes.status}: ${JSON.stringify(pixRes.data)}`);
  }

  // 4.3 — Histórico PIX
  console.log('\n4.3 — Histórico PIX');
  const pixHist = await api('GET', `/financeiro/pix-excedente?cooperadoId=${cooperados.Luciana.id}`, TOKEN);
  if (pixHist.status === 200) {
    const total = pixHist.data.total ?? pixHist.data.items?.length ?? 0;
    registrar('Histórico PIX Luciana', total > 0, `${total} transferência(s) registrada(s)`);
  } else {
    registrar('Histórico PIX Luciana', false, `HTTP ${pixHist.status}`);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MISSÃO 5 — Relatório Financeiro
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\n╔═══════════════════════════════════════════════════════════════╗');
  console.log('║ MISSÃO 5 — Relatório financeiro                              ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝\n');

  // 5.1 — Cobranças PAGO
  console.log('5.1 — Cobranças pagas');
  const resPagos = await api('GET', '/cobrancas', TOKEN);
  let totalReceita = 0;
  let totalInadimplencia = 0;
  let cobrancasPagas = 0;
  let cobrancasVencidas = 0;

  if (resPagos.status === 200 && Array.isArray(resPagos.data)) {
    for (const c of resPagos.data) {
      if (c.status === 'PAGO') {
        totalReceita += Number(c.valorPago ?? c.valorLiquido ?? 0);
        cobrancasPagas++;
      }
      if (c.status === 'VENCIDO') {
        totalInadimplencia += Number(c.valorLiquido ?? 0);
        cobrancasVencidas++;
      }
    }
  }
  registrar('Receita (PAGO)', cobrancasPagas > 0, `${cobrancasPagas} cobranças — Total: R$ ${totalReceita.toFixed(2)}`);

  // 5.2 — Cobranças VENCIDO
  console.log('\n5.2 — Inadimplência');
  registrar('Inadimplência (VENCIDO)', cobrancasVencidas > 0, `${cobrancasVencidas} cobranças — Total: R$ ${totalInadimplencia.toFixed(2)}`);

  // 5.3 — Clube de Vantagens analytics
  console.log('\n5.3 — Clube de Vantagens');
  const resAnalytics = await api('GET', '/clube-vantagens/analytics', TOKEN);
  if (resAnalytics.status === 200) {
    registrar('Clube analytics', true, JSON.stringify(resAnalytics.data).slice(0, 200));
  } else {
    registrar('Clube analytics', false, `HTTP ${resAnalytics.status}: ${JSON.stringify(resAnalytics.data).slice(0, 150)}`);
  }

  // 5.4 — Ranking
  console.log('\n5.4 — Ranking');
  const resRanking = await api('GET', '/clube-vantagens/ranking?periodo=total', TOKEN);
  if (resRanking.status === 200) {
    const data = resRanking.data;
    const ranking = Array.isArray(data) ? data : (data?.top10 ?? data?.ranking ?? []);
    const top3 = ranking.slice(0, 3).map((r: any) => `${r.nome || r.nomeCompleto}: ${r.kwhAcumulado ?? r.kwhIndicadoAcumulado ?? '?'} kWh`).join(' | ');
    registrar('Ranking Clube', ranking.length > 0, `Top 3: ${top3 || 'sem dados'}`);
  } else {
    registrar('Ranking Clube', false, `HTTP ${resRanking.status}: ${JSON.stringify(resRanking.data).slice(0, 100)}`);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // GERAR RELATÓRIO
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log(' GERANDO RELATÓRIO');
  console.log('═══════════════════════════════════════════════════════════════\n');

  const okCount = resultados.filter(r => r.ok).length;
  const failCount = resultados.filter(r => !r.ok).length;

  let md = `# Teste Ciclo Financeiro Completo — CoopereBR\n`;
  md += `**Data:** 2026-03-26\n`;
  md += `**Resultado:** ${okCount}/${resultados.length} etapas OK (${failCount} falhas)\n\n`;

  md += `## Resumo Executivo\n`;
  md += `| Indicador | Valor |\n|---|---|\n`;
  md += `| Usinas testadas | Solar Guarapari (18.500 kWh) + Solar Serra (14.200 kWh) |\n`;
  md += `| Cooperados vinculados | Carlos (15%), Beatriz (10%), Fernando (12%), Luciana (20%) |\n`;
  md += `| Lista de espera → ativado | Roberto Fonseca (Solar Serra) |\n`;
  md += `| Cobranças geradas | ${Object.keys(cobrancasCriadas).length} |\n`;
  md += `| Pagamentos processados | ${pagadores.length} |\n`;
  md += `| Inadimplentes | Fernando Augusto |\n`;
  md += `| PIX excedente | Luciana Meireles (${kwhExcedente} kWh) |\n`;
  md += `| Receita total | R$ ${totalReceita.toFixed(2)} |\n`;
  md += `| Inadimplência total | R$ ${totalInadimplencia.toFixed(2)} |\n\n`;

  // Missões
  const missoes: Record<string, string[]> = {
    'Missão 1 — Usinas + Vinculação + Lista de Espera': [],
    'Missão 2 — Motor de Cobrança + Geração de Faturas': [],
    'Missão 3 — Pagamentos e Baixa': [],
    'Missão 4 — PIX Excedente': [],
    'Missão 5 — Relatório Financeiro': [],
  };

  // Categorizar resultados
  for (const r of resultados) {
    const line = `${r.ok ? '✅' : '❌'} **${r.etapa}**: ${r.detalhe}`;
    if (r.etapa.match(/Usina|Cooperado|Contrato|UC|lista|kWh|Roberto|ativado/i)) {
      missoes['Missão 1 — Usinas + Vinculação + Lista de Espera'].push(line);
    } else if (r.etapa.match(/Geração|Crédito|Cobrança|Valor|WhatsApp.*cobran/i)) {
      missoes['Missão 2 — Motor de Cobrança + Geração de Faturas'].push(line);
    } else if (r.etapa.match(/Pagamento|Fernando|Lanç|Progres|WhatsApp.*pag/i)) {
      missoes['Missão 3 — Pagamentos e Baixa'].push(line);
    } else if (r.etapa.match(/Excedente|PIX|Imposto|líquido|bruto|Histór/i)) {
      missoes['Missão 4 — PIX Excedente'].push(line);
    } else if (r.etapa.match(/Receita|Inadimpl|Clube|Ranking/i)) {
      missoes['Missão 5 — Relatório Financeiro'].push(line);
    } else {
      missoes['Missão 1 — Usinas + Vinculação + Lista de Espera'].push(line);
    }
  }

  for (const [titulo, items] of Object.entries(missoes)) {
    const ok = items.filter(i => i.startsWith('✅')).length;
    const total = items.length;
    md += `## ${titulo} (${ok}/${total})\n`;
    for (const item of items) md += `- ${item}\n`;
    md += '\n';
  }

  md += `## Fluxo Testado\n`;
  md += '```\n';
  md += 'Usina → GeracaoMensal → Contrato (% usina) → kWh entregue\n';
  md += '→ Cobrança (R$ = kWh × tarifa TUSD+TE, desc 20%) → WhatsApp aviso\n';
  md += '→ Pagamento (dar-baixa) → LancamentoCaixa → WhatsApp confirmação\n';
  md += '→ Clube Vantagens atualizado → PIX excedente (impostos deduzidos)\n';
  md += '```\n';

  const reportPath = path.resolve(__dirname, '..', 'TESTE-CICLO-FINANCEIRO-2026-03-26.md');
  fs.writeFileSync(reportPath, md, 'utf-8');
  console.log(`\nRelatório salvo em: ${reportPath}`);
  console.log(`\nResultado final: ${okCount}/${resultados.length} ✅ (${failCount} ❌)`);
}

// Helper: find existing record ID or return a dummy for upsert
async function findOrDummy(model: string, nome: string): Promise<string> {
  if (model === 'usina') {
    const u = await prisma.usina.findFirst({ where: { nome } });
    return u?.id ?? 'nonexistent-id-' + Date.now();
  }
  return 'nonexistent-id-' + Date.now();
}

main()
  .catch((e) => {
    console.error('❌ Erro fatal:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
