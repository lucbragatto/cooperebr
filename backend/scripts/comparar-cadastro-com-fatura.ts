/**
 * FASE 1 — Relatório de divergências entre cadastro e dados extraídos das faturas.
 *
 * ⚠️ READ-ONLY: este script NÃO escreve no banco. Gera apenas XLSX comparativo
 * pra o Luciano revisar antes de qualquer enriquecimento (Fase 2).
 *
 * Pra cada FaturaProcessada da CoopereBR:
 *   - Lê `dadosExtraidos` (JSON do OCR Claude)
 *   - Compara com o Cooperado vinculado
 *   - Compara com a Uc vinculada
 *   - Classifica cada campo em 3 buckets:
 *       (a) banco VAZIO + fatura tem valor → seguro pra preencher (Aba 1)
 *       (b) banco tem A, fatura tem B → divergente, requer revisão (Aba 2)
 *       (c) banco tem A, fatura tem A → ok (só métrica de qualidade)
 *
 * REGRA INEGOCIÁVEL (decisão Luciano 14/06/2026):
 *   - Multi-tenant: SEMPRE filtrar por cooperativaId
 *   - LGPD: XLSX salvo na máquina do Luciano (workspace CoopereBR/), NUNCA
 *     em local público do repo (docs/concierge/ commitado leva CPF/endereço)
 *   - NÃO sobrescrever cadastro automaticamente — Fase 2 trata aplicação
 *
 * Executar:
 *   cd C:\Users\Luciano\cooperebr\backend
 *   npx ts-node scripts/comparar-cadastro-com-fatura.ts
 *
 * Saída:
 *   C:\Users\Luciano\OneDrive\Documentos\Claude\Projects\CoopereBR\
 *     comparacao-cadastro-fatura-YYYY-MM-DD.xlsx
 */

import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma.service';
import * as fs from 'fs';
import * as path from 'path';
// eslint-disable-next-line @typescript-eslint/no-var-requires
import * as ExcelJS from 'exceljs';

interface DadosExtraidos {
  titular?: string;
  documento?: string;
  tipoDocumento?: 'CPF' | 'CNPJ';
  enderecoInstalacao?: string;
  bairro?: string;
  cidade?: string;
  estado?: string;
  cep?: string;
  numero?: string;
  numeroUC?: string;
  numeroConcessionariaOriginal?: string;
  codigoMedidor?: string;
  distribuidora?: string;
  classificacao?: string;
  modalidadeTarifaria?: string;
  tensaoNominal?: string;
  tipoFornecimento?: string;
  temCreditosInjetados?: boolean;
  // kWh / SCEE
  consumoAtualKwh?: number;
  energiaFornecidaKwh?: number;
  energiaInjetadaKwh?: number;
  creditosRecebidosKwh?: number;
  saldoTotalKwh?: number;
  saldoKwhAnterior?: number;
  saldoKwhAtual?: number;
  participacaoSaldo?: number;
  valorCompensadoReais?: number;
  totalAPagar?: number;
}

interface Divergencia {
  cooperadoId: string;
  cooperadoNome: string;
  faturaId: string;
  mesReferencia: string | null;
  entidade: 'Cooperado' | 'Uc';
  campo: string;
  valorBanco: string | null;
  valorFatura: string | null;
  classificacao: 'VAZIO_BANCO' | 'DIVERGENTE' | 'IGUAL';
}

function norm(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  if (s === '' || s === '0' || s === 'null' || s === 'undefined') return null;
  return s;
}

function compararCampo(
  base: { entidade: 'Cooperado' | 'Uc'; campo: string; cooperadoId: string; cooperadoNome: string; faturaId: string; mesReferencia: string | null },
  valorBanco: unknown,
  valorFatura: unknown,
): Divergencia {
  const b = norm(valorBanco);
  const f = norm(valorFatura);
  let classificacao: Divergencia['classificacao'];
  if (b === null && f !== null) classificacao = 'VAZIO_BANCO';
  else if (b !== null && f !== null && b.toLowerCase() !== f.toLowerCase()) classificacao = 'DIVERGENTE';
  else classificacao = 'IGUAL';
  return { ...base, valorBanco: b, valorFatura: f, classificacao };
}

async function main(): Promise<void> {
  console.log('\n=== FASE 1: Comparação Cadastro vs Fatura ===\n');

  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  const prisma = app.get(PrismaService);

  // CoopereBR REAL (maior tenant)
  const candidatas = await prisma.cooperativa.findMany({
    where: { nome: { contains: 'CoopereBR', mode: 'insensitive' } },
    select: { id: true, nome: true, _count: { select: { cooperados: true } } },
  });
  const coop = candidatas.reduce((max, atual) =>
    atual._count.cooperados > max._count.cooperados ? atual : max,
  );
  console.log(`Cooperativa: ${coop.nome} (id=${coop.id})`);

  // Buscar todas FaturaProcessada da CoopereBR — JOIN com Cooperado + Uc
  const faturas = await prisma.faturaProcessada.findMany({
    where: { cooperado: { cooperativaId: coop.id } },
    select: {
      id: true,
      mesReferencia: true,
      dadosExtraidos: true,
      cooperado: {
        select: {
          id: true,
          nomeCompleto: true,
          cpf: true,
          documento: true,
          logradouro: true,
          bairro: true,
          cidade: true,
          estado: true,
          cep: true,
          cotaKwhMensal: true,
        },
      },
      uc: {
        select: {
          id: true,
          numero: true,
          numeroUC: true,
          numeroConcessionariaOriginal: true,
          codigoMedidor: true,
          distribuidora: true,
          classificacao: true,
          tipoFornecimento: true,
          endereco: true,
        },
      },
    },
  });

  console.log(`FaturaProcessada encontradas: ${faturas.length}`);
  if (faturas.length === 0) {
    console.log('Nada a comparar — rode dispara-email-monitor.ts primeiro.');
    await app.close();
    return;
  }

  const divergencias: Divergencia[] = [];
  for (const f of faturas) {
    if (!f.cooperado) continue;
    const dados = (f.dadosExtraidos as DadosExtraidos) ?? {};
    const base = {
      cooperadoId: f.cooperado.id,
      cooperadoNome: f.cooperado.nomeCompleto,
      faturaId: f.id,
      mesReferencia: f.mesReferencia,
    };

    // ── Comparar campos do Cooperado ──
    // Documento real do cooperado: prefere `documento` (CPF ou CNPJ) sobre `cpf` legado
    const documentoBanco = f.cooperado.documento ?? f.cooperado.cpf;
    divergencias.push(compararCampo({ ...base, entidade: 'Cooperado', campo: 'nomeCompleto' }, f.cooperado.nomeCompleto, dados.titular));
    divergencias.push(compararCampo({ ...base, entidade: 'Cooperado', campo: 'documento (cpf/cnpj)' }, documentoBanco, dados.documento));
    divergencias.push(compararCampo({ ...base, entidade: 'Cooperado', campo: 'logradouro' }, f.cooperado.logradouro, dados.enderecoInstalacao));
    divergencias.push(compararCampo({ ...base, entidade: 'Cooperado', campo: 'bairro' }, f.cooperado.bairro, dados.bairro));
    divergencias.push(compararCampo({ ...base, entidade: 'Cooperado', campo: 'cidade' }, f.cooperado.cidade, dados.cidade));
    divergencias.push(compararCampo({ ...base, entidade: 'Cooperado', campo: 'estado' }, f.cooperado.estado, dados.estado));
    divergencias.push(compararCampo({ ...base, entidade: 'Cooperado', campo: 'cep' }, f.cooperado.cep, dados.cep));

    // ── Comparar campos da Uc (se houver UC vinculada) ──
    if (f.uc) {
      const baseUc = { ...base };
      divergencias.push(compararCampo({ ...baseUc, entidade: 'Uc', campo: 'numero' }, f.uc.numero, dados.numero));
      divergencias.push(compararCampo({ ...baseUc, entidade: 'Uc', campo: 'numeroUC' }, f.uc.numeroUC, dados.numeroUC));
      divergencias.push(compararCampo({ ...baseUc, entidade: 'Uc', campo: 'numeroConcessionariaOriginal' }, f.uc.numeroConcessionariaOriginal, dados.numeroConcessionariaOriginal));
      divergencias.push(compararCampo({ ...baseUc, entidade: 'Uc', campo: 'codigoMedidor' }, f.uc.codigoMedidor, dados.codigoMedidor));
      divergencias.push(compararCampo({ ...baseUc, entidade: 'Uc', campo: 'distribuidora' }, f.uc.distribuidora, dados.distribuidora));
      divergencias.push(compararCampo({ ...baseUc, entidade: 'Uc', campo: 'classificacao' }, f.uc.classificacao, dados.classificacao));
      divergencias.push(compararCampo({ ...baseUc, entidade: 'Uc', campo: 'tipoFornecimento' }, f.uc.tipoFornecimento, dados.tipoFornecimento));
      divergencias.push(compararCampo({ ...baseUc, entidade: 'Uc', campo: 'endereco' }, f.uc.endereco, dados.enderecoInstalacao));
    }
  }

  // ── Resumo por classificação ──
  const vazios = divergencias.filter((d) => d.classificacao === 'VAZIO_BANCO');
  const divergentes = divergencias.filter((d) => d.classificacao === 'DIVERGENTE');
  const iguais = divergencias.filter((d) => d.classificacao === 'IGUAL');

  console.log(`\nResultado:`);
  console.log(`  Campos VAZIOS no banco + fatura tem valor: ${vazios.length} (seguros pra preencher)`);
  console.log(`  Campos DIVERGENTES (banco ≠ fatura):       ${divergentes.length} (revisar)`);
  console.log(`  Campos IGUAIS:                             ${iguais.length}`);

  // ── Gerar XLSX ──
  const wb = new ExcelJS.Workbook();
  wb.creator = 'CoopereBR Concierge — Fase 1';
  wb.created = new Date();

  const headers = ['Cooperado', 'Fatura mês', 'Entidade', 'Campo', 'Valor no banco', 'Valor na fatura', 'CooperadoId', 'FaturaId'];

  // Aba 1: VAZIOS (seguros)
  const ws1 = wb.addWorksheet('1 - Vazios (seguros)', { properties: { tabColor: { argb: 'FF22C55E' } } });
  ws1.columns = headers.map((h, i) => ({ header: h, key: `c${i}`, width: i === 4 || i === 5 ? 30 : 18 }));
  ws1.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  ws1.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF15803D' } };
  for (const d of vazios) {
    ws1.addRow({ c0: d.cooperadoNome, c1: d.mesReferencia ?? '-', c2: d.entidade, c3: d.campo, c4: '(vazio)', c5: d.valorFatura, c6: d.cooperadoId, c7: d.faturaId });
  }

  // Aba 2: DIVERGENTES (revisar manualmente)
  const ws2 = wb.addWorksheet('2 - Divergentes (revisar)', { properties: { tabColor: { argb: 'FFEF4444' } } });
  ws2.columns = headers.map((h, i) => ({ header: h, key: `c${i}`, width: i === 4 || i === 5 ? 30 : 18 }));
  ws2.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  ws2.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFB91C1C' } };
  for (const d of divergentes) {
    ws2.addRow({ c0: d.cooperadoNome, c1: d.mesReferencia ?? '-', c2: d.entidade, c3: d.campo, c4: d.valorBanco, c5: d.valorFatura, c6: d.cooperadoId, c7: d.faturaId });
  }

  // Aba 3: Resumo qualidade por campo
  const ws3 = wb.addWorksheet('3 - Qualidade por campo', { properties: { tabColor: { argb: 'FF3B82F6' } } });
  ws3.columns = [
    { header: 'Entidade', key: 'ent', width: 14 },
    { header: 'Campo', key: 'campo', width: 30 },
    { header: 'Total comparações', key: 'total', width: 18 },
    { header: 'Vazios banco', key: 'vazios', width: 14 },
    { header: 'Divergentes', key: 'div', width: 14 },
    { header: 'Iguais', key: 'iguais', width: 12 },
    { header: '% qualidade', key: 'pct', width: 14 },
  ];
  ws3.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  ws3.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1D4ED8' } };

  const porCampo = new Map<string, { total: number; vazios: number; div: number; iguais: number }>();
  for (const d of divergencias) {
    const key = `${d.entidade}|${d.campo}`;
    const stat = porCampo.get(key) ?? { total: 0, vazios: 0, div: 0, iguais: 0 };
    stat.total++;
    if (d.classificacao === 'VAZIO_BANCO') stat.vazios++;
    else if (d.classificacao === 'DIVERGENTE') stat.div++;
    else stat.iguais++;
    porCampo.set(key, stat);
  }
  for (const [key, stat] of porCampo) {
    const [ent, campo] = key.split('|');
    const pct = stat.total > 0 ? ((stat.iguais / stat.total) * 100).toFixed(1) + '%' : '-';
    ws3.addRow({ ent, campo, total: stat.total, vazios: stat.vazios, div: stat.div, iguais: stat.iguais, pct });
  }

  // ── Aba 4: kWh por cooperado (cota cadastrada x consumido x injetado x compensado) ──
  const ws4 = wb.addWorksheet('4 - kWh por cooperado', { properties: { tabColor: { argb: 'FFA855F7' } } });
  ws4.columns = [
    { header: 'Cooperado', key: 'nome', width: 32 },
    { header: 'Mês', key: 'mes', width: 10 },
    { header: 'Cota contratada (cadastro)', key: 'cota', width: 18 },
    { header: 'Consumo atual (fatura)', key: 'consumo', width: 18 },
    { header: 'Energia fornecida bruta', key: 'fornecida', width: 18 },
    { header: 'Energia injetada SCEE', key: 'injetada', width: 18 },
    { header: 'Créditos recebidos', key: 'creditos', width: 16 },
    { header: 'Saldo total kWh', key: 'saldo', width: 14 },
    { header: 'Valor compensado R$', key: 'compensado', width: 18 },
    { header: 'Total a pagar R$', key: 'pagar', width: 14 },
    { header: '% consumo / cota', key: 'pctCota', width: 14 },
    { header: 'CooperadoId', key: 'cid', width: 18 },
  ];
  ws4.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  ws4.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF7E22CE' } };

  const totaisAgregado = {
    qtdComCota: 0,
    cotaTotal: 0,
    consumoTotal: 0,
    fornecidoTotal: 0,
    injetadoTotal: 0,
    creditosTotal: 0,
    saldoTotal: 0,
    valorCompensadoTotal: 0,
    totalAPagarTotal: 0,
    qtdComSCEE: 0,
    qtdComConsumo: 0,
  };

  for (const f of faturas) {
    if (!f.cooperado) continue;
    const d = (f.dadosExtraidos as DadosExtraidos) ?? {};
    const cota = f.cooperado.cotaKwhMensal ? Number(f.cooperado.cotaKwhMensal) : null;
    const consumo = Number(d.consumoAtualKwh ?? 0);
    const fornecida = Number(d.energiaFornecidaKwh ?? 0);
    const injetada = Number(d.energiaInjetadaKwh ?? 0);
    const creditos = Number(d.creditosRecebidosKwh ?? 0);
    const saldo = Number(d.saldoTotalKwh ?? 0);
    const compensado = Number(d.valorCompensadoReais ?? 0);
    const totalPagar = Number(d.totalAPagar ?? 0);
    const pctCota = cota && cota > 0 && consumo > 0 ? `${((consumo / cota) * 100).toFixed(1)}%` : '-';

    ws4.addRow({
      nome: f.cooperado.nomeCompleto,
      mes: f.mesReferencia ?? '-',
      cota: cota ?? '(vazio)',
      consumo,
      fornecida,
      injetada,
      creditos,
      saldo,
      compensado,
      pagar: totalPagar,
      pctCota,
      cid: f.cooperado.id,
    });

    if (cota) { totaisAgregado.qtdComCota++; totaisAgregado.cotaTotal += cota; }
    if (consumo > 0) totaisAgregado.qtdComConsumo++;
    totaisAgregado.consumoTotal += consumo;
    totaisAgregado.fornecidoTotal += fornecida;
    totaisAgregado.injetadoTotal += injetada;
    totaisAgregado.creditosTotal += creditos;
    totaisAgregado.saldoTotal += saldo;
    totaisAgregado.valorCompensadoTotal += compensado;
    totaisAgregado.totalAPagarTotal += totalPagar;
    if (injetada > 0 || creditos > 0 || d.temCreditosInjetados) totaisAgregado.qtdComSCEE++;
  }

  // ── Aba 5: Resumo agregado da cooperativa ──
  const ws5 = wb.addWorksheet('5 - Resumo agregado kWh', { properties: { tabColor: { argb: 'FFF59E0B' } } });
  ws5.columns = [
    { header: 'Métrica', key: 'metrica', width: 50 },
    { header: 'Valor', key: 'valor', width: 22 },
    { header: 'Observação', key: 'obs', width: 50 },
  ];
  ws5.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  ws5.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFB45309' } };

  const linhas = [
    ['Total faturas processadas analisadas', faturas.length, ''],
    ['Cooperados com cota contratada cadastrada', totaisAgregado.qtdComCota, 'Cooperado.cotaKwhMensal preenchido'],
    ['Cooperados com SCEE ativo (creditos/injecao)', totaisAgregado.qtdComSCEE, 'Universo Concierge (Tese 3 + Tese 6)'],
    ['', '', ''],
    ['COTA TOTAL contratada (kWh/mês)', totaisAgregado.cotaTotal.toFixed(2), 'Soma de cotaKwhMensal'],
    ['CONSUMO TOTAL no mês (kWh)', totaisAgregado.consumoTotal.toFixed(2), 'Soma de consumoAtualKwh das faturas'],
    ['ENERGIA FORNECIDA BRUTA total (kWh)', totaisAgregado.fornecidoTotal.toFixed(2), 'Antes da compensação SCEE'],
    ['ENERGIA INJETADA SCEE total (kWh)', totaisAgregado.injetadoTotal.toFixed(2), 'Geração própria/cooperativa'],
    ['CRÉDITOS RECEBIDOS total (kWh)', totaisAgregado.creditosTotal.toFixed(2), 'Compensação via SCEE'],
    ['SALDO total acumulado (kWh)', totaisAgregado.saldoTotal.toFixed(2), 'Créditos pendentes'],
    ['', '', ''],
    ['VALOR COMPENSADO R$ total no mês', `R$ ${totaisAgregado.valorCompensadoTotal.toFixed(2)}`, 'Economia direta via SCEE'],
    ['TOTAL A PAGAR R$ total no mês', `R$ ${totaisAgregado.totalAPagarTotal.toFixed(2)}`, 'Faturamento bruto consolidado'],
    ['', '', ''],
    ['% consumo / cota (eficiência uso)', totaisAgregado.cotaTotal > 0
      ? `${((totaisAgregado.consumoTotal / totaisAgregado.cotaTotal) * 100).toFixed(1)}%`
      : '-', 'Se > 100%, cooperados consomem além da cota'],
    ['% SCEE / consumo (cobertura GD)', totaisAgregado.consumoTotal > 0
      ? `${((totaisAgregado.creditosTotal / totaisAgregado.consumoTotal) * 100).toFixed(1)}%`
      : '-', 'Quanto da demanda é coberta por geração própria'],
  ];

  for (const [m, v, o] of linhas) {
    ws5.addRow({ metrica: m, valor: v, obs: o });
  }
  // Destacar primeira coluna em negrito
  for (let i = 2; i <= ws5.rowCount; i++) {
    ws5.getRow(i).getCell('metrica').font = { bold: true };
  }

  // ── Salvar no workspace do Luciano (PII protegida, fora do repo Git) ──
  const outDir = path.resolve('C:/Users/Luciano/OneDrive/Documentos/Claude/Projects/CoopereBR');
  fs.mkdirSync(outDir, { recursive: true });
  const stamp = new Date().toISOString().slice(0, 10);
  const outFile = path.join(outDir, `comparacao-cadastro-fatura-${stamp}.xlsx`);
  await wb.xlsx.writeFile(outFile);

  console.log(`\n✓ XLSX salvo: ${outFile}`);
  console.log(`  Arquivo NÃO commitado no repo (contem PII de cooperados).`);
  console.log(`  Aba 1 (verde):   campos vazios — seguro aplicar na Fase 2`);
  console.log(`  Aba 2 (vermelho): divergências cadastrais — revisar caso a caso`);
  console.log(`  Aba 3 (azul):    qualidade dos dados por campo`);
  console.log(`  Aba 4 (roxo):    kWh por cooperado (cota x consumo x injetado x compensado)`);
  console.log(`  Aba 5 (laranja): resumo agregado kWh da cooperativa\n`);

  // Print resumo no terminal também
  console.log(`Resumo agregado preview:`);
  console.log(`  Faturas analisadas: ${faturas.length}`);
  console.log(`  Cooperados com SCEE ativo: ${totaisAgregado.qtdComSCEE}`);
  console.log(`  Consumo total no mês: ${totaisAgregado.consumoTotal.toFixed(0)} kWh`);
  console.log(`  Energia injetada total: ${totaisAgregado.injetadoTotal.toFixed(0)} kWh`);
  console.log(`  Valor compensado R$: ${totaisAgregado.valorCompensadoTotal.toFixed(2)}\n`);

  await app.close();
}

main().then(() => process.exit(0)).catch((err) => { console.error(err); process.exit(1); });
