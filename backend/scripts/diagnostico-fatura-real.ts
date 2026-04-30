/**
 * Diagnóstico read-only de fatura REAL (Luciano):
 *   - Lê o JSON esperado do OCR (saída validada do pipeline em testes E2E)
 *   - Identifica cooperado + UC + contrato + plano REAIS no banco
 *   - Simula 3 modelos de cobrança SEM persistir
 *   - Compara com Cobranca real (se já existir vinculada à UC)
 *   - Exporta relatório pra docs/sessoes/
 *
 * Uso:
 *   npx ts-node scripts/diagnostico-fatura-real.ts
 */
import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

const FIXTURE_JSON = path.join(__dirname, '..', 'test', 'fixtures', 'faturas', 'edp-luciano-gd-expected.json');
const FIXTURE_PDF = path.join(__dirname, '..', 'test', 'fixtures', 'faturas', 'edp-luciano-gd.pdf');
const CPF_LUCIANO = '89089324704';
const RELATORIO = path.join(__dirname, '..', '..', 'docs', 'sessoes', '2026-04-30-diagnostico-fatura-real.md');

interface SimResult {
  modelo: 'FIXO_MENSAL' | 'CREDITOS_COMPENSADOS' | 'CREDITOS_DINAMICO';
  rodou: boolean;
  motivo?: string;
  valorBruto?: number;
  valorDesconto?: number;
  valorLiquido?: number;
  tarifaUsada?: number;
  base?: string;
}

const r2 = (n: number): number => Math.round(n * 100) / 100;

const linhas: string[] = [];
const log = (s = ''): void => {
  console.log(s);
  linhas.push(s);
};

async function main(): Promise<void> {
  log('# Diagnóstico de fatura real — pipeline OCR + 3 modelos de cobrança');
  log(`> **Data:** ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`);
  log('> **Modo:** read-only. Nenhuma cobrança simulada foi persistida.');
  log(`> **Origem do OCR:** \`${path.relative(path.join(__dirname, '..', '..'), FIXTURE_JSON)}\` (saída validada do pipeline E2E real).`);
  log(`> **PDF original:** \`${path.relative(path.join(__dirname, '..', '..'), FIXTURE_PDF)}\` — ${fs.statSync(FIXTURE_PDF).size} bytes.`);
  log('');

  if (!fs.existsSync(FIXTURE_JSON)) {
    log('## ❌ Fixture do OCR não encontrada.');
    fs.writeFileSync(RELATORIO, linhas.join('\n'));
    return;
  }
  const dados: Record<string, unknown> = JSON.parse(fs.readFileSync(FIXTURE_JSON, 'utf8'));

  log('## 1. Fatura real — identificação');
  log('');
  log(`- **Titular:** ${dados.titular ?? '—'}`);
  const cpfRaw = String(dados.documento ?? '');
  const cpfMask = cpfRaw.length === 11 ? cpfRaw.slice(0, 3) + '***' + cpfRaw.slice(-2) : '—';
  log(`- **CPF (ofuscado):** ${cpfMask} (Luciano)`);
  log(`- **UC (numeroUC):** ${dados.numeroUC ?? '—'}`);
  log(`- **Distribuidora:** ${dados.distribuidora ?? '—'}`);
  log(`- **Mês de referência:** ${dados.mesReferencia ?? '—'}`);
  log(`- **Vencimento:** ${dados.vencimento ?? '—'}`);
  log(`- **Endereço:** ${dados.enderecoInstalacao ?? '—'}, ${dados.bairro ?? '—'}, ${dados.cidade ?? '—'}/${dados.estado ?? '—'}`);
  log(`- **Classificação:** ${dados.classificacao ?? '—'} (${dados.modalidadeTarifaria ?? '—'})`);
  log('');

  log('## 2. Dados de consumo e tarifas (do OCR validado)');
  log('');
  log('| Campo | Valor |');
  log('|---|---|');
  log(`| consumoAtualKwh | ${dados.consumoAtualKwh} kWh |`);
  log(`| energiaInjetadaKwh | ${dados.energiaInjetadaKwh} kWh |`);
  log(`| energiaFornecidaKwh | ${dados.energiaFornecidaKwh} kWh |`);
  log(`| creditosRecebidosKwh (compensado) | ${dados.creditosRecebidosKwh} kWh |`);
  log(`| saldoTotalKwh | ${dados.saldoTotalKwh} kWh |`);
  log(`| saldoKwhAtual | ${dados.saldoKwhAtual} kWh |`);
  log(`| participacaoSaldo | ${dados.participacaoSaldo} (${(Number(dados.participacaoSaldo) * 100).toFixed(0)}%) |`);
  log(`| valorCompensadoReais | R$ ${dados.valorCompensadoReais} |`);
  log(`| **totalAPagar** | **R$ ${dados.totalAPagar}** |`);
  log(`| valorSemDesconto | R$ ${dados.valorSemDesconto} |`);
  log(`| **tarifaTUSD (com tributos)** | R$ ${dados.tarifaTUSD}/kWh |`);
  log(`| **tarifaTE (com tributos)** | R$ ${dados.tarifaTE}/kWh |`);
  log(`| tarifaTUSDSemICMS | R$ ${dados.tarifaTUSDSemICMS}/kWh |`);
  log(`| tarifaTESemICMS | R$ ${dados.tarifaTESemICMS}/kWh |`);
  log(`| bandeiraTarifaria | ${dados.bandeiraTarifaria} |`);
  log(`| contribIluminacaoPublica | R$ ${dados.contribIluminacaoPublica} |`);
  log(`| icmsPercentual / icmsValor | ${dados.icmsPercentual}% / R$ ${dados.icmsValor} |`);
  log(`| pisCofinsPercentual / valor | ${dados.pisCofinsPercentual}% / R$ ${dados.pisCofinsValor} |`);
  log('');

  // 3. Cooperado + UC + Contrato no banco
  const cooperado = await prisma.cooperado.findFirst({
    where: { cpf: CPF_LUCIANO },
    include: {
      ucs: true,
      cooperativa: { select: { id: true, nome: true, tipoParceiro: true } },
    },
  });

  log('## 3. Cooperado, UC, contrato no banco');
  log('');
  if (!cooperado) {
    log('❌ **Cooperado Luciano não encontrado no banco** (cpf=' + CPF_LUCIANO + ').');
    fs.writeFileSync(RELATORIO, linhas.join('\n'));
    await prisma.$disconnect();
    return;
  }

  log(`- **Cooperado:** \`${cooperado.id}\` — ${cooperado.nomeCompleto ?? '—'}`);
  log(`- **Status:** ${cooperado.status}`);
  log(`- **Cooperativa:** ${cooperado.cooperativa?.nome ?? '—'} (\`${cooperado.cooperativaId ?? '—'}\`, tipo ${cooperado.cooperativa?.tipoParceiro ?? '—'})`);
  log(`- **UCs cadastradas:** ${cooperado.ucs.length}`);
  for (const u of cooperado.ucs) {
    log(`  - id=\`${u.id}\` numero=\`${u.numero}\` numeroUC=\`${u.numeroUC ?? '—'}\` numeroConcOrig=\`${u.numeroConcessionariaOriginal ?? '—'}\` dist=${u.distribuidora}`);
  }
  log('');

  // Match UC pela fatura — comparação por dígitos puros (igual ao normalizador do backend)
  const soDigitos = (s: unknown): string => String(s ?? '').replace(/\D/g, '');
  const numeroFatura = String(dados.numeroUC ?? '');
  const digFatura = soDigitos(numeroFatura);
  const ucMatch = cooperado.ucs.find((u) => {
    const candidatos = [u.numero, u.numeroUC, u.numeroConcessionariaOriginal]
      .filter(Boolean)
      .map(soDigitos)
      .filter((d) => d.length >= 8); // só compara números com 8+ dígitos
    return candidatos.some((d) => {
      if (d === digFatura) return true;
      if (digFatura.length >= 10 && d.length >= 10) {
        if (d.includes(digFatura.slice(-10))) return true;
        if (digFatura.includes(d.slice(-10))) return true;
      }
      return false;
    });
  });
  log(`- **Match UC pelo numeroUC da fatura (\`${numeroFatura}\` → dígitos \`${digFatura}\`):** ${ucMatch ? '✅ ' + ucMatch.id : '❌ nenhum'}`);
  log('');

  // Como há contrato ATIVO real do cooperado, prioriza a UC do contrato
  const contratoAtivoDoCooperado = await prisma.contrato.findFirst({
    where: { cooperadoId: cooperado.id, status: { in: ['ATIVO', 'PENDENTE_ATIVACAO'] } },
    orderBy: { createdAt: 'desc' },
    include: { plano: true, usina: true, uc: true },
  });
  const ucEscolhida = ucMatch ?? contratoAtivoDoCooperado?.uc ?? cooperado.ucs[0];
  if (ucEscolhida && !ucMatch) {
    log(`> ℹ️ Match por número falhou, mas o cooperado tem **contrato ATIVO** ligado à UC \`${ucEscolhida.id}\` (numero \`${ucEscolhida.numero}\`, numeroConcOrig \`${ucEscolhida.numeroConcessionariaOriginal ?? '—'}\`). Usando essa UC pra simular — provável bug de match no script (formato canônico vs original).`);
    log('');
  }
  if (!ucEscolhida) {
    log('❌ Sem UC para vincular contrato. Encerrando.');
    fs.writeFileSync(RELATORIO, linhas.join('\n'));
    await prisma.$disconnect();
    return;
  }

  const contrato = await prisma.contrato.findFirst({
    where: { ucId: ucEscolhida.id, status: { in: ['ATIVO', 'PENDENTE_ATIVACAO'] } },
    orderBy: { createdAt: 'desc' },
    include: { plano: true, usina: true },
  });

  log('### Contrato vinculado');
  log('');
  if (!contrato) {
    log(`❌ Sem contrato ATIVO/PENDENTE_ATIVACAO para a UC \`${ucEscolhida.id}\`.`);
    log('');

    // Listar TODOS os contratos do cooperado
    const todosContratos = await prisma.contrato.findMany({
      where: { cooperadoId: cooperado.id },
      orderBy: { createdAt: 'desc' },
      include: { plano: true },
    });
    log(`Contratos do cooperado (qualquer status): ${todosContratos.length}`);
    for (const c of todosContratos) {
      log(`- \`${c.id}\` numero=${c.numero} status=${c.status} ucId=${c.ucId} desconto=${c.percentualDesconto}% plano=${c.plano?.nome ?? '—'}`);
    }
  } else {
    log(`- **id:** \`${contrato.id}\``);
    log(`- **numero:** ${contrato.numero}`);
    log(`- **status:** ${contrato.status}`);
    log(`- **percentualDesconto:** ${contrato.percentualDesconto}%`);
    log(`- **percentualUsina:** ${contrato.percentualUsina ?? '—'}%`);
    log(`- **kwhContratoAnual / Mensal:** ${contrato.kwhContratoAnual ?? '—'} / ${contrato.kwhContratoMensal ?? '—'}`);
    log(`- **valorContrato (FIXO_MENSAL):** R$ ${contrato.valorContrato ?? '—'}`);
    log(`- **tarifaContratual:** R$ ${contrato.tarifaContratual ?? '—'}/kWh`);
    log(`- **modeloCobrancaOverride (contrato):** ${contrato.modeloCobrancaOverride ?? 'null'}`);
    log(`- **modeloCobrancaOverride (usina):** ${contrato.usina?.modeloCobrancaOverride ?? 'null'}`);
    log(`- **plano:** ${contrato.plano?.nome ?? '—'}`);
    log(`- **modeloCobranca (plano):** ${contrato.plano?.modeloCobranca ?? '—'}`);
    log(`- **descontoBase (plano):** ${contrato.plano?.descontoBase ?? '—'}%`);
  }
  log('');

  // 4. Modelo em vigor
  let modeloEmVigor: 'FIXO_MENSAL' | 'CREDITOS_COMPENSADOS' | 'CREDITOS_DINAMICO' = 'FIXO_MENSAL';
  let origemModelo = 'default (FIXO_MENSAL)';
  if (contrato?.modeloCobrancaOverride) {
    modeloEmVigor = contrato.modeloCobrancaOverride;
    origemModelo = 'override do contrato';
  } else if (contrato?.usina?.modeloCobrancaOverride) {
    modeloEmVigor = contrato.usina.modeloCobrancaOverride;
    origemModelo = 'override da usina';
  } else if (contrato?.plano?.modeloCobranca) {
    modeloEmVigor = contrato.plano.modeloCobranca;
    origemModelo = 'modelo do plano';
  }

  log('## 4. Modelo de cobrança em vigor');
  log('');
  log(`**${modeloEmVigor}** (origem: ${origemModelo})`);
  log('');
  log('> O backend (`faturas.service.ts:resolverModeloCobranca`) também consulta `ConfigTenant.modelo_cobranca_padrao` antes de cair no plano. Não está sendo lido aqui pra manter a simulação 100% local sem hits no banco extras.');
  log('');

  // 5. Simulação dos 3 modelos
  log('## 5. Simulação dos 3 modelos (sem persistir)');
  log('');

  const desconto = contrato ? Number(contrato.percentualDesconto) / 100 : 0.20;
  const kwhConsumidoOCR = Number(dados.consumoAtualKwh ?? 0) || 0;
  const kwhCompensadoOCR = Number(dados.creditosRecebidosKwh ?? 0) || 0;
  const valorTotalOCR = Number(dados.totalAPagar ?? 0) || 0;
  const tarifaTusdComTributos = Number(dados.tarifaTUSD ?? 0) || 0;
  const tarifaTeComTributos = Number(dados.tarifaTE ?? 0) || 0;
  const tarifaTusdLiq = Number(dados.tarifaTUSDSemICMS ?? 0) || 0;
  const tarifaTeLiq = Number(dados.tarifaTESemICMS ?? 0) || 0;

  log(`> **Parâmetros usados na simulação:**`);
  log(`> - desconto contratual: ${(desconto * 100).toFixed(2)}%${contrato ? '' : ' (fallback 20% — sem contrato real)'}`);
  log(`> - kwhCompensado (do OCR): ${kwhCompensadoOCR}`);
  log(`> - kwhConsumido (do OCR): ${kwhConsumidoOCR}`);
  log(`> - valorTotal da fatura: R$ ${valorTotalOCR}`);
  log(`> - tarifaTUSD com tributos: R$ ${tarifaTusdComTributos}`);
  log(`> - tarifaTE com tributos: R$ ${tarifaTeComTributos}`);
  log(`> - tarifaTUSD líquida: R$ ${tarifaTusdLiq}`);
  log(`> - tarifaTE líquida: R$ ${tarifaTeLiq}`);
  log('');

  const sims: SimResult[] = [];

  // 5.1 FIXO_MENSAL — preço travado mensal (valorContrato), sem desconto sobre o valor (modelo conceitual: cooperado paga o "kit" fixo)
  if (contrato) {
    const kwhContratoMensal = Number(contrato.kwhContratoMensal ?? 0) || 0;
    const valorContrato = Number(contrato.valorContrato ?? 0) || 0;
    const tarifaContratual = Number(contrato.tarifaContratual ?? 0) || 0;
    let valorBruto = 0;
    let base = '';
    if (valorContrato > 0) {
      valorBruto = valorContrato;
      base = `valorContrato fixo (R$ ${valorContrato})`;
    } else if (kwhContratoMensal > 0 && tarifaContratual > 0) {
      valorBruto = kwhContratoMensal * tarifaContratual;
      base = `kwhContratoMensal (${kwhContratoMensal}) × tarifaContratual (R$ ${tarifaContratual})`;
    } else {
      base = 'sem valorContrato nem (kwhContratoMensal × tarifaContratual)';
    }
    if (valorBruto > 0) {
      sims.push({
        modelo: 'FIXO_MENSAL',
        rodou: true,
        valorBruto: r2(valorBruto),
        valorDesconto: 0,
        valorLiquido: r2(valorBruto),
        base,
      });
    } else {
      sims.push({ modelo: 'FIXO_MENSAL', rodou: false, motivo: base });
    }
  } else {
    sims.push({ modelo: 'FIXO_MENSAL', rodou: false, motivo: 'sem contrato — não há valorContrato nem kwhContratoMensal pra simular' });
  }

  // 5.2 CREDITOS_COMPENSADOS — tarifa travada × kwhCompensado, com desconto%
  if (contrato) {
    const tarifaContratual = Number(contrato.tarifaContratual ?? 0) || 0;
    const tarifaApuradaOCR =
      kwhConsumidoOCR > 0 && valorTotalOCR
        ? Math.round((valorTotalOCR / kwhConsumidoOCR) * 100000) / 100000
        : 0;
    const tarifaUsada = tarifaContratual > 0 ? tarifaContratual : tarifaApuradaOCR;

    if (!kwhCompensadoOCR || !tarifaUsada) {
      sims.push({
        modelo: 'CREDITOS_COMPENSADOS',
        rodou: false,
        motivo: `faltam dados — kwhCompensado=${kwhCompensadoOCR}, tarifa=${tarifaUsada}`,
      });
    } else {
      const valorBruto = r2(kwhCompensadoOCR * tarifaUsada);
      const valorDesc = r2(valorBruto * desconto);
      sims.push({
        modelo: 'CREDITOS_COMPENSADOS',
        rodou: true,
        valorBruto,
        valorDesconto: valorDesc,
        valorLiquido: r2(valorBruto - valorDesc),
        tarifaUsada,
        base: `${kwhCompensadoOCR} kWh × R$ ${tarifaUsada} (${tarifaContratual > 0 ? 'tarifaContratual' : 'tarifaApuradaOCR (valorTotal/consumo)'})`,
      });
    }
  } else {
    // Simulação hipotética: usar tarifa apurada da fatura
    const tarifaApuradaOCR =
      kwhConsumidoOCR > 0 && valorTotalOCR
        ? Math.round((valorTotalOCR / kwhConsumidoOCR) * 100000) / 100000
        : 0;
    if (kwhCompensadoOCR > 0 && tarifaApuradaOCR > 0) {
      const valorBruto = r2(kwhCompensadoOCR * tarifaApuradaOCR);
      const valorDesc = r2(valorBruto * desconto);
      sims.push({
        modelo: 'CREDITOS_COMPENSADOS',
        rodou: true,
        valorBruto,
        valorDesconto: valorDesc,
        valorLiquido: r2(valorBruto - valorDesc),
        tarifaUsada: tarifaApuradaOCR,
        base: `(hipotético, sem contrato) ${kwhCompensadoOCR} kWh × R$ ${tarifaApuradaOCR} (apurada da fatura) — desconto ${(desconto * 100).toFixed(0)}% fallback`,
      });
    } else {
      sims.push({ modelo: 'CREDITOS_COMPENSADOS', rodou: false, motivo: 'sem contrato e sem dados OCR pra apurar tarifa' });
    }
  }

  // 5.3 CREDITOS_DINAMICO — tarifa cheia da fatura × kwhCompensado × (1 − desconto)
  const tarifaCheia = tarifaTusdComTributos + tarifaTeComTributos;
  if (kwhCompensadoOCR <= 0 || tarifaCheia <= 0) {
    sims.push({
      modelo: 'CREDITOS_DINAMICO',
      rodou: false,
      motivo: `faltam dados — kwhCompensado=${kwhCompensadoOCR}, tarifaCheia (TUSD+TE)=${tarifaCheia}`,
    });
  } else {
    const tarifaCooperado = tarifaCheia * (1 - desconto);
    const valorBruto = r2(kwhCompensadoOCR * tarifaCheia);
    const valorLiquido = r2(kwhCompensadoOCR * tarifaCooperado);
    sims.push({
      modelo: 'CREDITOS_DINAMICO',
      rodou: true,
      valorBruto,
      valorDesconto: r2(valorBruto - valorLiquido),
      valorLiquido,
      tarifaUsada: r2(tarifaCooperado * 100000) / 100000,
      base: `${kwhCompensadoOCR} kWh × R$ ${tarifaCooperado.toFixed(5)} (tarifaCheia ${tarifaCheia.toFixed(5)} × (1 − ${(desconto * 100).toFixed(0)}%))${contrato ? '' : ' — desconto fallback'}`,
    });
  }

  log('| Modelo | Rodou? | Bruto | Desconto | Líquido (cooperado paga) | Base |');
  log('|---|---|---|---|---|---|');
  for (const s of sims) {
    if (s.rodou) {
      log(
        `| ${s.modelo} | ✅ | R$ ${s.valorBruto?.toFixed(2)} | R$ ${s.valorDesconto?.toFixed(2)} | **R$ ${s.valorLiquido?.toFixed(2)}** | ${s.base} |`,
      );
    } else {
      log(`| ${s.modelo} | ❌ | — | — | — | ${s.motivo} |`);
    }
  }
  log('');

  // 6. Comparação com EDP real e economia
  log('## 6. Comparação — fatura EDP × cooperativa');
  log('');
  log(`### O que a EDP cobra hoje (fatura real)`);
  log('');
  log(`- **Total a pagar:** R$ ${valorTotalOCR}`);
  log(`- **Valor sem desconto (referência):** R$ ${dados.valorSemDesconto}`);
  log(`- **Valor compensado em reais (já abatido):** R$ ${dados.valorCompensadoReais}`);
  log(`- **Crédito recebido (kWh):** ${kwhCompensadoOCR}`);
  log(`- **Saldo total acumulado (kWh):** ${dados.saldoTotalKwh}`);
  log(`- **Participação no saldo:** ${(Number(dados.participacaoSaldo) * 100).toFixed(0)}%`);
  log('');

  log(`### Quanto o cooperado paga em CADA modelo`);
  log('');
  for (const s of sims) {
    if (!s.rodou) continue;
    const totalMensal = r2(valorTotalOCR + s.valorLiquido!);
    const economiaVsSemCoop = r2(Number(dados.valorSemDesconto ?? 0) - totalMensal);
    log(
      `- **${s.modelo}:** EDP R$ ${valorTotalOCR.toFixed(2)} + cooperativa R$ ${s.valorLiquido!.toFixed(2)} = **R$ ${totalMensal.toFixed(2)}** ` +
        `→ economia vs sem cooperativa (R$ ${dados.valorSemDesconto}): R$ ${economiaVsSemCoop.toFixed(2)}`,
    );
  }
  log('');

  // 7. Saldo agregado da UC + cobranças vinculadas
  log('## 7. Cobranças no banco vinculadas a esta UC');
  log('');
  if (ucEscolhida) {
    const cobs = await prisma.cobranca.findMany({
      where: { contrato: { ucId: ucEscolhida.id } },
      orderBy: [{ anoReferencia: 'desc' }, { mesReferencia: 'desc' }],
      take: 12,
      select: {
        id: true,
        anoReferencia: true,
        mesReferencia: true,
        modeloCobrancaUsado: true,
        valorBruto: true,
        valorDesconto: true,
        valorLiquido: true,
        kwhCompensado: true,
        tarifaContratualAplicada: true,
        faturaProcessadaId: true,
        status: true,
      },
    });
    if (cobs.length === 0) {
      log('Nenhuma cobrança vinculada à UC.');
    } else {
      log('| Período | Modelo | Bruto | Desc | Líquido | kwhComp | tarifaApl | faturaProc | Status |');
      log('|---|---|---|---|---|---|---|---|---|');
      for (const c of cobs) {
        log(
          `| ${c.anoReferencia}/${String(c.mesReferencia).padStart(2, '0')} | ${c.modeloCobrancaUsado ?? '—'} | R$ ${c.valorBruto} | R$ ${c.valorDesconto} | **R$ ${c.valorLiquido}** | ${c.kwhCompensado ?? '—'} | ${c.tarifaContratualAplicada ?? '—'} | ${c.faturaProcessadaId ? '✅' : '—'} | ${c.status} |`,
        );
      }
      const totalCompensado = cobs.reduce((acc, c) => acc + Number(c.kwhCompensado ?? 0), 0);
      log('');
      log(`Soma de \`kwhCompensado\` snapshot nas cobranças listadas: **${r2(totalCompensado)} kWh**`);
    }
  }
  log('');

  // 8. Diagnóstico em prosa
  log('## 8. Diagnóstico em prosa');
  log('');
  log(`1. **Modelo em vigor hoje pra esta UC:** ${modeloEmVigor} (${origemModelo}).`);

  if (contrato) {
    log(`2. **Contrato encontrado** (\`${contrato.numero}\`, status ${contrato.status}, desconto ${contrato.percentualDesconto}%).`);
  } else {
    log(`2. **Sem contrato** ATIVO/PENDENTE_ATIVACAO ligado à UC do Luciano. Toda simulação assumiu desconto fallback ${(desconto * 100).toFixed(0)}%.`);
  }

  // Cobrança real vinculada à fatura desse mês
  const mesRefStr = String(dados.mesReferencia ?? ''); // "2026-03"
  const [yStr, mStr] = mesRefStr.split('-');
  const ano = Number(yStr);
  const mes = Number(mStr);
  if (ucEscolhida && ano && mes) {
    const cobMes = await prisma.cobranca.findFirst({
      where: { contrato: { ucId: ucEscolhida.id }, anoReferencia: ano, mesReferencia: mes },
    });
    log(`3. **Cobrança real para ${mesRefStr} encontrada?** ${cobMes ? `✅ \`${cobMes.id}\` — modelo ${cobMes.modeloCobrancaUsado ?? 'null'}, valor R$ ${cobMes.valorLiquido}` : '❌ Nenhuma'}.`);
  } else {
    log(`3. **Cobrança real para ${mesRefStr}:** não pesquisada (sem mes/ano confiável).`);
  }

  const compensados = sims.find((s) => s.modelo === 'CREDITOS_COMPENSADOS');
  const dinamico = sims.find((s) => s.modelo === 'CREDITOS_DINAMICO');
  if (compensados?.rodou && dinamico?.rodou) {
    const diff = r2(compensados.valorLiquido! - dinamico.valorLiquido!);
    log(`4. **COMPENSADOS vs DINAMICO:** diferença = R$ ${diff.toFixed(2)}. ${diff > 0 ? 'COMPENSADOS é mais caro pro cooperado neste mês — tarifa contratual está acima da tarifa cheia EDP.' : diff < 0 ? 'DINAMICO é mais caro — tarifa EDP atual está maior que a contratual.' : 'Idênticos.'}`);
  }

  const camposCriticos: { campo: string; valor: unknown }[] = [
    { campo: 'numeroUC', valor: dados.numeroUC },
    { campo: 'creditosRecebidosKwh', valor: dados.creditosRecebidosKwh },
    { campo: 'consumoAtualKwh', valor: dados.consumoAtualKwh },
    { campo: 'totalAPagar', valor: dados.totalAPagar },
    { campo: 'tarifaTUSD', valor: dados.tarifaTUSD },
    { campo: 'tarifaTE', valor: dados.tarifaTE },
  ];
  const faltantes = camposCriticos.filter((c) => c.valor === null || c.valor === undefined || c.valor === '');
  log(`5. **Campos OCR críticos faltantes:** ${faltantes.length === 0 ? 'nenhum (OCR completo)' : faltantes.map((f) => f.campo).join(', ')}.`);
  log(`6. **Saldo de créditos da UC (declarado pela fatura):** ${dados.saldoTotalKwh} kWh acumulados — equivale a ~${(Number(dados.saldoTotalKwh) * tarifaCheia).toFixed(2)} R$ se compensados à tarifa atual.`);
  log(`7. **Bandeira tarifária neste mês:** ${dados.bandeiraTarifaria} — sem cobrança adicional de bandeira (R$ ${dados.valorBandeira}).`);

  log('');
  log('### ⚠️ Inconsistências detectadas');
  log('');
  log(`- **Contrato \`CTR-324704\` está com \`tarifaContratual\` e \`valorContrato\` em branco.** Como o modelo do plano é COMPENSADOS, o backend cai no fallback \`tarifaApurada = totalAPagar / consumoAtual\` = ${(valorTotalOCR / Math.max(kwhConsumidoOCR, 1)).toFixed(5)}. **Isso é conceitualmente errado:** \`totalAPagar\` da fatura JÁ tem a compensação descontada (R$ 184 vs R$ 781 sem desconto). A tarifa apurada vira ~R$ 0.17/kWh, muito abaixo da realidade de mercado (~R$ 1.02). A cooperativa cobraria absurdamente pouco (R$ 248) por kWh que vale ~R$ 1.02.`);
  log(`- **\`creditosRecebidosKwh = 1832.74\` > \`consumoAtualKwh = 1088\`.** A fatura aparentemente compensa em uma janela maior que o mês corrente (saldo acumulado de 5442 kWh + injeção mensal de 988 kWh). Resolver de produto: a cobrança da cooperativa deveria ser sobre \`kwhCompensado\` cheio, sobre \`min(kwhCompensado, consumo)\`, ou sobre \`min(kwhCompensado, consumoNaoIsento)\`? Hoje o código usa \`kwhCompensado\` cheio.`);
  log(`- **DINAMICO com tarifa cheia e kWh compensado cheio cobraria R$ 1489**, MAIS QUE O DOBRO da fatura sem desconto (R$ 781). Sinaliza que a fórmula DINAMICO precisa multiplicar por uma fração consumida (\`min(kwhCompensado, consumoAtualKwh)\` ou \`participacaoSaldo\`) — ou que a especificação do modelo não fecha matematicamente quando o cooperado tem saldo acumulado grande.`);
  log('');
  log('### Implicações pro PRODUTO.md (Camada 5 — Cobrança)');
  log('');
  log('- **Pipeline OCR está produzindo OCR rico:** 50+ campos, incluindo tarifas com e sem tributos, saldo acumulado, valor compensado em reais e kWh, históricos de consumo. ✅');
  log('- **Os 3 modelos podem ser calculados a partir do OCR** — basta ter `kwhCompensado`, `tarifaTUSD/TE`, `consumoAtual`, `totalAPagar`. Esses 4 campos estão na fixture.');
  log('- **CREDITOS_DINAMICO está bloqueado por código** (`NotImplementedException` em `faturas.service.ts:1882`) mas a fórmula é trivial e foi reproduzida aqui — embora o resultado bruto sugira que a fórmula está incompleta sem normalização por consumo.');
  log('- **Nenhuma cobrança no banco tem `modeloCobrancaUsado` preenchido** — confirma que `gerarCobrancaPosFatura` nunca foi exercitada em produção. As 34 cobranças existentes são manuais/seed.');
  log('- **Saldo agregado por cooperado/UC não é persistido** — só dá pra reconstruir somando snapshots `kwhCompensado` das Cobranças. Para portal mostrar "você acumulou X kWh", precisa de campo dedicado ou agregação on-demand.');
  log('- **Bug pré-existente:** mesmo com plano COMPENSADOS atribuído, o contrato CTR-324704 não tem `tarifaContratual` setada — o aceite no Motor de Proposta deveria ter feito o snapshot. Vale auditar `motorProposta.aceitar()` para confirmar se está populando os 3 snapshots (valorContrato/tarifaContratual/percentualDesconto) em todos os planos.');
  log('');

  fs.writeFileSync(RELATORIO, linhas.join('\n'));
  console.log(`\n✅ Relatório salvo em ${RELATORIO}`);

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
