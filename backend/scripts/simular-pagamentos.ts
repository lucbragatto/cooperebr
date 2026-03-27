/**
 * Script de simulação de pagamentos - rotina completa de teste
 * 
 * Fluxo:
 * 1. Busca cobranças PENDENTE/VENCIDO
 * 2. Simula: 1/3 paga agora, 1/3 recebe nova cobrança c/ multa+juros+PIX+boleto, 1/3 ignorado
 * 3. Para os que "pagam": dar baixa, verificar lancamento caixa, notificação WA
 * 4. Para nova cobrança: gerar msg atualizada c/ valor+PIX+barras
 * 5. Simula pagamento desse segundo lote via PIX e via boleto
 */

import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();

function fmtBRL(v: number) { return `R$ ${v.toFixed(2).replace('.', ',')}`; }
function hoje() { return new Date().toISOString().split('T')[0]; }

// Simula código PIX copia-e-cola (real viria do Asaas)
function gerarPixFake(cobrancaId: string, valor: number): string {
  return `00020126330014br.gov.bcb.pix0111${cobrancaId.slice(0,11)}5204000053039865802BR5913CoopereBR6009SAO PAULO62070503***630400000`;
}

// Simula linha digitável de boleto
function gerarBoletoCodBarrasFake(valor: number, vencimento: string): string {
  const v = Math.round(valor * 100).toString().padStart(10, '0');
  return `10499.82207 60000.000009 00000.401018 3 ${vencimento.replace(/-/g,'')}${v}`;
}

async function main() {
  const hoje_dt = new Date();
  hoje_dt.setHours(0,0,0,0);

  // === BUSCAR TODAS AS COBRANÇAS PENDENTES/VENCIDAS ===
  const cobrancas = await p.cobranca.findMany({
    where: { status: { in: ['PENDENTE', 'VENCIDO'] } },
    include: {
      contrato: {
        include: {
          cooperado: { select: { id: true, nomeCompleto: true, telefone: true, cooperativaId: true } },
        },
      },
    },
    orderBy: { dataVencimento: 'asc' },
  });

  console.log(`\nTotal de cobranças PENDENTE/VENCIDO: ${cobrancas.length}`);
  if (cobrancas.length === 0) { console.log('Nenhuma cobrança para simular.'); return; }

  // Dividir em 3 grupos
  const n = cobrancas.length;
  const tamGrupo = Math.ceil(n / 3);
  const grupo1 = cobrancas.slice(0, tamGrupo);          // pagam agora
  const grupo2 = cobrancas.slice(tamGrupo, tamGrupo*2); // recebem nova cobrança c/ atualização
  const grupo3 = cobrancas.slice(tamGrupo*2);           // ignorados

  console.log(`\nGrupo 1 (pagam agora): ${grupo1.length}`);
  console.log(`Grupo 2 (nova cobrança atualizada): ${grupo2.length}`);
  console.log(`Grupo 3 (ignorados): ${grupo3.length}`);

  // === GRUPO 1: PAGAM AGORA ===
  console.log('\n' + '='.repeat(60));
  console.log('GRUPO 1 — SIMULANDO PAGAMENTOS (DAR BAIXA)');
  console.log('='.repeat(60));

  for (const cob of grupo1) {
    const cooperado = cob.contrato?.cooperado;
    const nome = cooperado?.nomeCompleto ?? 'Cooperado';
    const valorPago = Number(cob.valorAtualizado ?? cob.valorLiquido);
    
    // Verificar multa/juros aplicados
    const multa = cob.valorMulta ? Number(cob.valorMulta) : 0;
    const juros = cob.valorJuros ? Number(cob.valorJuros) : 0;
    const valorOriginal = Number(cob.valorLiquido);

    console.log(`\n[PAGAMENTO] ${nome} — ${cob.status}`);
    console.log(`  Valor original: ${fmtBRL(valorOriginal)}`);
    if (multa > 0 || juros > 0) {
      console.log(`  Multa 2%: ${fmtBRL(multa)}`);
      console.log(`  Juros 0,033%/dia: ${fmtBRL(juros)}`);
      console.log(`  Total atualizado: ${fmtBRL(valorPago)}`);
    }

    // 1. DAR BAIXA
    try {
      const updated = await p.cobranca.update({
        where: { id: cob.id },
        data: {
          status: 'PAGO',
          dataPagamento: hoje_dt,
          valorPago: valorPago,
        },
      });
      console.log(`  ✅ Baixa registrada (status: PAGO, valorPago: ${fmtBRL(valorPago)})`);

      // 2. LANÇAMENTO NO LIVRO CAIXA
      const mesRef = `${String(cob.mesReferencia).padStart(2,'0')}/${cob.anoReferencia}`;
      const competencia = `${cob.anoReferencia}-${String(cob.mesReferencia).padStart(2,'0')}`;
      const lancamento = await p.lancamentoCaixa.create({
        data: {
          tipo: 'RECEITA',
          descricao: `Recebimento mensalidade - ${nome} - ${mesRef}`,
          valor: valorPago,
          competencia,
          dataPagamento: hoje_dt,
          status: 'REALIZADO',
          cooperativaId: cob.cooperativaId ?? cob.contrato?.cooperativaId ?? undefined,
          cooperadoId: cob.contrato?.cooperado?.id ?? undefined,
          observacoes: `Ref. cobrança ${cob.id} | Simulação rotina pagamento`,
        } as any,
      });
      console.log(`  ✅ Lançamento caixa criado: ${lancamento.id}`);

      // 3. VERIFICAR SE MULTA/JUROS ESTÃO CORRETOS
      if (cob.status === 'VENCIDO') {
        const venc = new Date(cob.dataVencimento);
        venc.setHours(0,0,0,0);
        const diasAtraso = Math.floor((hoje_dt.getTime() - venc.getTime()) / 86400000);
        const diasCarencia = 3;
        const diasEfetivos = Math.max(0, diasAtraso - diasCarencia);
        const multaCalc = valorOriginal * 0.02;
        const jurosCalc = valorOriginal * 0.00033 * diasEfetivos;
        const totalCalc = valorOriginal + multaCalc + jurosCalc;
        
        console.log(`  📐 Verificação multa/juros:`);
        console.log(`     Dias atraso: ${diasAtraso} | Dias efetivos (após carência): ${diasEfetivos}`);
        console.log(`     Multa 2%: ${fmtBRL(multaCalc)} ${Math.abs(multaCalc - multa) < 0.01 ? '✅' : `❌ (DB: ${fmtBRL(multa)})`}`);
        console.log(`     Juros ${diasEfetivos}×0,033%: ${fmtBRL(jurosCalc)} ${Math.abs(jurosCalc - juros) < 0.01 ? '✅' : `❌ (DB: ${fmtBRL(juros)})`}`);
        console.log(`     Total: ${fmtBRL(totalCalc)} ${Math.abs(totalCalc - valorPago) < 0.02 ? '✅' : `❌ (pago: ${fmtBRL(valorPago)})`}`);
      }

      // 4. SIMULAR CONFIRMAÇÃO WA
      const metodo = grupo1.indexOf(cob) % 2 === 0 ? 'PIX' : 'BOLETO';
      console.log(`  📱 WA confirmação (simulado via ${metodo}): "Pagamento de ${fmtBRL(valorPago)} confirmado! Obrigado, ${nome.split(' ')[0]}! 🎉"`);

    } catch (e: any) {
      console.log(`  ❌ ERRO: ${e.message}`);
    }
  }

  // === GRUPO 2: NOVA COBRANÇA ATUALIZADA ===
  console.log('\n' + '='.repeat(60));
  console.log('GRUPO 2 — NOVA MENSAGEM DE COBRANÇA C/ VALOR ATUALIZADO');
  console.log('='.repeat(60));

  const novasMsgs: { cobrancaId: string; nome: string; telefone: string; valor: number; pix: string; boleto: string }[] = [];

  for (const cob of grupo2) {
    const cooperado = cob.contrato?.cooperado;
    const nome = cooperado?.nomeCompleto ?? 'Cooperado';
    const telefone = cooperado?.telefone ?? '';
    const valorOriginal = Number(cob.valorLiquido);
    const multa = cob.valorMulta ? Number(cob.valorMulta) : 0;
    const juros = cob.valorJuros ? Number(cob.valorJuros) : 0;
    const valorAtualizado = cob.valorAtualizado ? Number(cob.valorAtualizado) : (valorOriginal + multa + juros);
    
    // Calcular se não tiver no banco ainda
    let multaFinal = multa;
    let jurosFinal = juros;
    let totalFinal = valorAtualizado;

    if (cob.status === 'VENCIDO' && multa === 0) {
      const venc = new Date(cob.dataVencimento);
      venc.setHours(0,0,0,0);
      const diasAtraso = Math.floor((hoje_dt.getTime() - venc.getTime()) / 86400000);
      const diasEfetivos = Math.max(0, diasAtraso - 3);
      multaFinal = valorOriginal * 0.02;
      jurosFinal = valorOriginal * 0.00033 * diasEfetivos;
      totalFinal = valorOriginal + multaFinal + jurosFinal;

      // Atualizar no banco
      await p.cobranca.update({
        where: { id: cob.id },
        data: { valorMulta: multaFinal, valorJuros: jurosFinal, valorAtualizado: totalFinal },
      });
    }

    // Gerar PIX e boleto
    const pixCode = gerarPixFake(cob.id, totalFinal);
    const boletoCode = gerarBoletoCodBarrasFake(totalFinal, hoje()); 
    
    novasMsgs.push({ cobrancaId: cob.id, nome, telefone, valor: totalFinal, pix: pixCode, boleto: boletoCode });

    const mesRef = `${String(cob.mesReferencia).padStart(2,'0')}/${cob.anoReferencia}`;
    const primeiroNome = nome.split(' ')[0];

    console.log(`\n[NOVA COBRANÇA] ${nome} — ${cob.status}`);
    console.log(`  Valor original: ${fmtBRL(valorOriginal)}`);
    console.log(`  Multa 2%: ${fmtBRL(multaFinal)}`);
    console.log(`  Juros: ${fmtBRL(jurosFinal)}`);
    console.log(`  TOTAL ATUALIZADO: ${fmtBRL(totalFinal)}`);
    console.log(`\n  📱 Mensagem WA (simulada para ${telefone ?? 'sem tel'}):`);
    console.log(`  ┌────────────────────────────────────────`);
    console.log(`  │ ⚠️ *CoopereBR — Fatura em Atraso* (${mesRef})`);
    console.log(`  │`);
    console.log(`  │ Olá, ${primeiroNome}! Identificamos que sua fatura ainda não foi quitada.`);
    console.log(`  │`);
    console.log(`  │ 💰 Valor atualizado: *${fmtBRL(totalFinal)}*`);
    console.log(`  │    (inclui multa de 2% + juros de 0,033%/dia)`);
    console.log(`  │`);
    console.log(`  │ 📲 *PIX — Copia e Cola:*`);
    console.log(`  │ ${pixCode.slice(0,60)}...`);
    console.log(`  │`);
    console.log(`  │ 🏦 *Código de Barras (Boleto):*`);
    console.log(`  │ ${boletoCode}`);
    console.log(`  │`);
    console.log(`  │ Após o pagamento, envie o comprovante aqui.`);
    console.log(`  └────────────────────────────────────────`);

    // Marcar como notificado (segunda vez)
    await p.cobranca.update({
      where: { id: cob.id },
      data: { notificadoVencimento: true },
    });
  }

  // === SIMULAR PAGAMENTOS DO GRUPO 2 ===
  console.log('\n' + '='.repeat(60));
  console.log('GRUPO 2 — SIMULANDO PAGAMENTOS APÓS NOVA COBRANÇA');
  console.log('='.repeat(60));

  for (let i = 0; i < novasMsgs.length; i++) {
    const msg = novasMsgs[i];
    const metodo = i % 2 === 0 ? 'PIX' : 'BOLETO';
    const cob = grupo2[i];
    const cooperado = cob.contrato?.cooperado;
    const nome = cooperado?.nomeCompleto ?? 'Cooperado';

    console.log(`\n[PAGAMENTO G2] ${nome} via ${metodo}`);
    console.log(`  Valor: ${fmtBRL(msg.valor)}`);

    try {
      // Dar baixa
      await p.cobranca.update({
        where: { id: cob.id },
        data: {
          status: 'PAGO',
          dataPagamento: hoje_dt,
          valorPago: msg.valor,
        },
      });
      console.log(`  ✅ Baixa registrada`);

      // Lançamento caixa
      const mesRef = `${String(cob.mesReferencia).padStart(2,'0')}/${cob.anoReferencia}`;
      const competencia = `${cob.anoReferencia}-${String(cob.mesReferencia).padStart(2,'0')}`;
      const lancamento = await p.lancamentoCaixa.create({
        data: {
          tipo: 'RECEITA',
          descricao: `Recebimento mensalidade (${metodo}) - ${nome} - ${mesRef}`,
          valor: msg.valor,
          competencia,
          dataPagamento: hoje_dt,
          status: 'REALIZADO',
          cooperativaId: cob.cooperativaId ?? cob.contrato?.cooperativaId ?? undefined,
          cooperadoId: cob.contrato?.cooperado?.id ?? undefined,
          observacoes: `Ref. cobrança ${cob.id} | Pago via ${metodo} | Simulação`,
        } as any,
      });
      console.log(`  ✅ Lançamento caixa: ${lancamento.id}`);
      console.log(`  📱 WA confirmação: "Recebemos seu pagamento de ${fmtBRL(msg.valor)} via ${metodo}. Obrigado, ${msg.nome.split(' ')[0]}! ✅"`);

    } catch (e: any) {
      console.log(`  ❌ ERRO: ${e.message}`);
    }
  }

  // === RELATÓRIO FINAL ===
  console.log('\n' + '='.repeat(60));
  console.log('RELATÓRIO FINAL');
  console.log('='.repeat(60));

  const stats = await p.cobranca.groupBy({ by: ['status'], _count: true });
  console.log('\nCobranças por status após simulação:');
  stats.forEach(s => console.log(`  ${s.status}: ${s._count}`));

  const lancamentos = await p.lancamentoCaixa.count({ where: { observacoes: { contains: 'Simulação' } } });
  console.log(`\nLançamentos criados nesta simulação: ${lancamentos}`);

  const totalReceita = await p.lancamentoCaixa.aggregate({
    where: { observacoes: { contains: 'Simulação' }, tipo: 'RECEITA' },
    _sum: { valor: true },
  });
  console.log(`Total recebido (simulado): ${fmtBRL(Number(totalReceita._sum.valor ?? 0))}`);

  console.log('\n✅ Simulação concluída. Verifique logs acima para identificar bugs.');
}

main().then(() => p.$disconnect()).catch(e => { console.error('ERRO FATAL:', e.message, e.stack); p.$disconnect(); });
