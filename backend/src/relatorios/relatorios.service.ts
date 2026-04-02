import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class RelatoriosService {
  constructor(private prisma: PrismaService) {}

  /* ───────── FRENTE 3 — Inadimplência estratificada ───────── */
  async inadimplencia(filtros: {
    usinaId?: string;
    cooperativaId?: string;
    tipoCooperado?: string;
  }) {
    const where: any = { status: 'VENCIDO' };
    if (filtros.usinaId) where.contrato = { ...where.contrato, usinaId: filtros.usinaId };
    if (filtros.cooperativaId) where.cooperativaId = filtros.cooperativaId;

    const cobrancas = await this.prisma.cobranca.findMany({
      where,
      include: {
        contrato: {
          include: {
            usina: { select: { id: true, nome: true } },
            cooperado: { select: { id: true, nomeCompleto: true, tipoCooperado: true } },
          },
        },
      },
    });

    // Filtro opcional por tipoCooperado (feito em memória pois é aninhado)
    const filtradas = filtros.tipoCooperado
      ? cobrancas.filter((c) => c.contrato.cooperado.tipoCooperado === filtros.tipoCooperado)
      : cobrancas;

    const totalValor = filtradas.reduce((s, c) => s + Number(c.valorLiquido), 0);

    // Breakdown por usina
    const porUsina: Record<string, { usinaId: string; usinaNome: string; valor: number; qtd: number }> = {};
    for (const c of filtradas) {
      const uid = c.contrato.usinaId ?? 'sem-usina';
      if (!porUsina[uid]) {
        porUsina[uid] = {
          usinaId: uid,
          usinaNome: c.contrato.usina?.nome ?? 'Sem usina',
          valor: 0,
          qtd: 0,
        };
      }
      porUsina[uid].valor += Number(c.valorLiquido);
      porUsina[uid].qtd += 1;
    }

    // Breakdown por tipo cooperado
    const porTipo: Record<string, { tipo: string; valor: number; qtd: number }> = {};
    for (const c of filtradas) {
      const t = c.contrato.cooperado.tipoCooperado;
      if (!porTipo[t]) porTipo[t] = { tipo: t, valor: 0, qtd: 0 };
      porTipo[t].valor += Number(c.valorLiquido);
      porTipo[t].qtd += 1;
    }

    // Breakdown por faixa de kWh contratado
    const faixas = [
      { label: '<100', min: 0, max: 100 },
      { label: '100-300', min: 100, max: 300 },
      { label: '300-600', min: 300, max: 600 },
      { label: '>600', min: 600, max: Infinity },
    ];
    const porFaixa = faixas.map((f) => ({ faixa: f.label, valor: 0, qtd: 0 }));
    for (const c of filtradas) {
      const kwh = Number(c.contrato.cooperado ? c.kwhEntregue ?? 0 : 0);
      const kwhContrato = Number(c.contrato.kwhContratoMensal ?? c.contrato.kwhContrato ?? 0);
      const val = kwhContrato || kwh;
      const idx = faixas.findIndex((f) => val >= f.min && val < f.max);
      if (idx >= 0) {
        porFaixa[idx].valor += Number(c.valorLiquido);
        porFaixa[idx].qtd += 1;
      }
    }

    // Top 10 maiores inadimplentes (agrupado por cooperado)
    const porCooperado: Record<string, { cooperadoId: string; nome: string; valor: number; qtdCobrancas: number }> = {};
    const now = new Date();
    for (const c of filtradas) {
      const cid = c.contrato.cooperadoId;
      if (!porCooperado[cid]) {
        porCooperado[cid] = {
          cooperadoId: cid,
          nome: c.contrato.cooperado.nomeCompleto,
          valor: 0,
          qtdCobrancas: 0,
        };
      }
      porCooperado[cid].valor += Number(c.valorLiquido);
      porCooperado[cid].qtdCobrancas += 1;
    }
    const top10 = Object.values(porCooperado)
      .sort((a, b) => b.valor - a.valor)
      .slice(0, 10)
      .map((c) => ({ ...c, valor: +c.valor.toFixed(2) }));

    return {
      totalValor: +totalValor.toFixed(2),
      totalQtd: filtradas.length,
      porUsina: Object.values(porUsina)
        .map((u) => ({ ...u, valor: +u.valor.toFixed(2) }))
        .sort((a, b) => b.valor - a.valor),
      porTipoCooperado: Object.values(porTipo)
        .map((t) => ({ ...t, valor: +t.valor.toFixed(2) }))
        .sort((a, b) => b.valor - a.valor),
      porFaixaKwh: porFaixa.map((f) => ({ ...f, valor: +f.valor.toFixed(2) })),
      top10Inadimplentes: top10,
    };
  }

  /* ───────── FRENTE 4 — Projeção de receita ───────── */
  async projecaoReceita(meses: number = 6, cooperativaId?: string) {
    // Média de geração dos últimos 6 meses por usina
    const seisAtras = new Date();
    seisAtras.setMonth(seisAtras.getMonth() - 6);

    const geracaoWhere: any = { competencia: { gte: seisAtras } };
    if (cooperativaId) geracaoWhere.usina = { cooperativaId };

    const geracoes = await this.prisma.geracaoMensal.findMany({
      where: geracaoWhere,
    });

    // Agrupar por usina
    const mediaGeracaoPorUsina: Record<string, { usinaId: string; mediaKwh: number; totalMeses: number }> = {};
    for (const g of geracoes) {
      if (!mediaGeracaoPorUsina[g.usinaId]) {
        mediaGeracaoPorUsina[g.usinaId] = { usinaId: g.usinaId, mediaKwh: 0, totalMeses: 0 };
      }
      mediaGeracaoPorUsina[g.usinaId].mediaKwh += g.kwhGerado;
      mediaGeracaoPorUsina[g.usinaId].totalMeses += 1;
    }
    for (const k of Object.keys(mediaGeracaoPorUsina)) {
      const m = mediaGeracaoPorUsina[k];
      m.mediaKwh = m.totalMeses > 0 ? m.mediaKwh / m.totalMeses : 0;
    }

    // Contratos ativos
    const contratoWhere: any = { status: 'ATIVO', usinaId: { not: null } };
    if (cooperativaId) contratoWhere.cooperativaId = cooperativaId;

    const contratos = await this.prisma.contrato.findMany({
      where: contratoWhere,
      include: {
        usina: { select: { id: true, nome: true, capacidadeKwh: true, distribuidora: true } },
      },
    });

    // Buscar tarifas vigentes por distribuidora das usinas
    const distribuidoras = [...new Set(contratos.map(c => c.usina?.distribuidora).filter(Boolean))] as string[];
    const todasTarifas = await this.prisma.tarifaConcessionaria.findMany({
      orderBy: { dataVigencia: 'desc' },
    });
    const tarifaPorDistrib = new Map<string, number>();
    for (const d of distribuidoras) {
      const normD = d.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
      const t = todasTarifas.find(t => {
        const normC = t.concessionaria.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
        return normC.includes(normD) || normD.includes(normC);
      });
      if (t) tarifaPorDistrib.set(d, Number(t.tusdNova) + Number(t.teNova));
    }
    const tarifaFallback = todasTarifas.length > 0
      ? Number(todasTarifas[0].tusdNova) + Number(todasTarifas[0].teNova)
      : 0.80;

    const now = new Date();
    const projecaoMensal: {
      mes: number;
      anoReferencia: number;
      receitaProjetada: number;
      kwhProjetado: number;
      qtdContratos: number;
    }[] = [];

    const breakdownUsina: Record<
      string,
      { usinaId: string; usinaNome: string; receitaTotal: number; kwhTotal: number; qtdContratos: number }
    > = {};

    for (let i = 1; i <= meses; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const mes = d.getMonth() + 1;
      const ano = d.getFullYear();

      let receitaMes = 0;
      let kwhMes = 0;
      let qtd = 0;

      for (const contrato of contratos) {
        const uid = contrato.usinaId!;
        const media = mediaGeracaoPorUsina[uid];
        if (!media) continue;

        const pctUsina = Number(contrato.percentualUsina ?? 0);
        const kwhContrato = (pctUsina / 100) * media.mediaKwh;
        const desconto = Number(contrato.percentualDesconto ?? 0);
        // Receita = kWh projetado * (1 - desconto/100) * tarifa da distribuidora
        const distribUsina = contrato.usina?.distribuidora;
        const tarifaEstimada = distribUsina ? (tarifaPorDistrib.get(distribUsina) ?? tarifaFallback) : tarifaFallback;
        const receita = kwhContrato * (1 - desconto / 100) * tarifaEstimada;

        kwhMes += kwhContrato;
        receitaMes += receita;
        qtd += 1;

        // Breakdown por usina
        if (!breakdownUsina[uid]) {
          breakdownUsina[uid] = {
            usinaId: uid,
            usinaNome: contrato.usina?.nome ?? 'Desconhecida',
            receitaTotal: 0,
            kwhTotal: 0,
            qtdContratos: 0,
          };
        }
        breakdownUsina[uid].receitaTotal += receita;
        breakdownUsina[uid].kwhTotal += kwhContrato;
      }

      // Contar contratos distintos (apenas uma vez por usina-contrato)
      projecaoMensal.push({
        mes,
        anoReferencia: ano,
        receitaProjetada: +receitaMes.toFixed(2),
        kwhProjetado: +kwhMes.toFixed(2),
        qtdContratos: qtd,
      });
    }

    // Contar qtd contratos por usina (única vez)
    for (const c of contratos) {
      const uid = c.usinaId!;
      if (breakdownUsina[uid]) {
        breakdownUsina[uid].qtdContratos = contratos.filter((x) => x.usinaId === uid).length;
      }
    }

    return {
      mesesProjetados: meses,
      projecao: projecaoMensal,
      porUsina: Object.values(breakdownUsina)
        .map((u) => ({
          ...u,
          receitaTotal: +u.receitaTotal.toFixed(2),
          kwhTotal: +u.kwhTotal.toFixed(2),
        }))
        .sort((a, b) => b.receitaTotal - a.receitaTotal),
    };
  }
}
