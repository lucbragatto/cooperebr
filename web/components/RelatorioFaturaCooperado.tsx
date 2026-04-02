'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Sun, Zap, TrendingDown, DollarSign, BarChart3 } from 'lucide-react';

interface RelatorioMensal {
  cooperado: { nome: string; uc: string; distribuidora: string; endereco: string };
  periodo: { mes: number; ano: number; mesLabel: string };
  faturaConcessionaria: {
    totalPago: number; consumoKwh: number; kwhCompensado: number; kwhInjetado: number;
    saldoAnterior: number; saldoAtual: number; tarifaTUSD: number; tarifaTE: number;
    bandeira: string; impostos: { icms: number; pisCofins: number; cip: number };
  };
  faturaCoopereBR: {
    valorCobrado: number; kwhUtilizados: number; beneficiosAplicados: number;
    totalDesconto: number; valorLiquido: number;
  };
  economia: {
    valorSemGD: number; valorComGD: number; economiaReais: number;
    economiaPercentual: number; economiaAcumuladaAno: number;
  };
  historico: { mes: string; kwhCompensado: number; valorCobrado: number; economia: number }[];
  mensagem: string;
}

function formatBRL(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export default function RelatorioFaturaCooperado({ relatorio }: { relatorio: RelatorioMensal }) {
  const r = relatorio;
  const maxKwh = Math.max(...r.historico.map(h => h.kwhCompensado), 1);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-gradient-to-r from-green-600 to-green-700 rounded-xl p-6 text-white">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Sun className="h-5 w-5" />
            <span className="font-bold text-lg">SISGD</span>
          </div>
          <Badge className="bg-white/20 text-white border-0 text-xs">
            Energia Solar Compartilhada
          </Badge>
        </div>
        <p className="font-semibold text-lg">{r.cooperado.nome}</p>
        <p className="text-green-100 text-sm">UC: {r.cooperado.uc} | {r.cooperado.distribuidora}</p>
        <p className="text-green-200 text-sm mt-1">{r.periodo.mesLabel}</p>
      </div>

      {/* Economia destaque */}
      <Card className="border-2 border-green-200 bg-green-50">
        <CardContent className="pt-6 pb-6 text-center">
          <TrendingDown className="h-8 w-8 text-green-600 mx-auto mb-2" />
          <p className="text-sm text-gray-600 mb-1">Sua economia este mês</p>
          <p className="text-3xl font-bold text-green-700">{formatBRL(r.economia.economiaReais)}</p>
          <p className="text-lg font-semibold text-green-600">{r.economia.economiaPercentual.toFixed(0)}% de economia</p>

          {/* Barra de progresso */}
          <div className="mt-4 max-w-xs mx-auto">
            <div className="flex justify-between text-xs text-gray-500 mb-1">
              <span>Sem GD: {formatBRL(r.economia.valorSemGD)}</span>
              <span>Com GD: {formatBRL(r.economia.valorComGD)}</span>
            </div>
            <div className="h-3 bg-red-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-green-500 rounded-full transition-all"
                style={{ width: `${Math.min(100, r.economia.valorSemGD > 0 ? (r.economia.valorComGD / r.economia.valorSemGD) * 100 : 100)}%` }}
              />
            </div>
          </div>

          <p className="text-xs text-gray-500 mt-3">
            Economia acumulada no ano: <span className="font-semibold text-green-700">{formatBRL(r.economia.economiaAcumuladaAno)}</span>
          </p>
        </CardContent>
      </Card>

      {/* Créditos */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Zap className="h-4 w-4 text-yellow-500" />Seus créditos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="text-xs text-gray-500">kWh Injetados</p>
              <p className="text-lg font-bold text-gray-800">{r.faturaConcessionaria.kwhInjetado}</p>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="text-xs text-gray-500">kWh Compensados</p>
              <p className="text-lg font-bold text-gray-800">{r.faturaConcessionaria.kwhCompensado}</p>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="text-xs text-gray-500">Saldo Atual</p>
              <p className="text-lg font-bold text-green-700">{r.faturaConcessionaria.saldoAtual} kWh</p>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="text-xs text-gray-500">Consumo</p>
              <p className="text-lg font-bold text-gray-800">{r.faturaConcessionaria.consumoKwh} kWh</p>
            </div>
          </div>

          {/* Mini gráfico de barras */}
          {r.historico.length > 0 && (
            <div className="mt-4">
              <p className="text-xs text-gray-500 mb-2">Histórico (últimos meses)</p>
              <div className="flex items-end gap-1 h-20">
                {r.historico.map((h, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1">
                    <div
                      className="w-full bg-green-400 rounded-t"
                      style={{ height: `${Math.max(4, (h.kwhCompensado / maxKwh) * 64)}px` }}
                      title={`${h.mes}: ${h.kwhCompensado} kWh`}
                    />
                    <span className="text-[9px] text-gray-400 truncate w-full text-center">
                      {h.mes ? h.mes.slice(0, 7) : ''}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Fatura concessionária */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />Fatura Concessionária
          </CardTitle>
        </CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <tbody>
              <tr className="border-b"><td className="py-1.5 text-gray-600">Consumo</td><td className="py-1.5 text-right font-medium">{r.faturaConcessionaria.consumoKwh} kWh</td></tr>
              <tr className="border-b"><td className="py-1.5 text-gray-600">TUSD</td><td className="py-1.5 text-right font-medium">{formatBRL(r.faturaConcessionaria.tarifaTUSD * r.faturaConcessionaria.consumoKwh)}</td></tr>
              <tr className="border-b"><td className="py-1.5 text-gray-600">TE</td><td className="py-1.5 text-right font-medium">{formatBRL(r.faturaConcessionaria.tarifaTE * r.faturaConcessionaria.consumoKwh)}</td></tr>
              <tr className="border-b"><td className="py-1.5 text-gray-600">Bandeira: {r.faturaConcessionaria.bandeira}</td><td className="py-1.5 text-right">—</td></tr>
              <tr className="border-b"><td className="py-1.5 text-gray-600">ICMS</td><td className="py-1.5 text-right font-medium">{formatBRL(r.faturaConcessionaria.impostos.icms)}</td></tr>
              <tr className="border-b"><td className="py-1.5 text-gray-600">PIS/COFINS</td><td className="py-1.5 text-right font-medium">{formatBRL(r.faturaConcessionaria.impostos.pisCofins)}</td></tr>
              <tr className="border-b"><td className="py-1.5 text-gray-600">CIP</td><td className="py-1.5 text-right font-medium">{formatBRL(r.faturaConcessionaria.impostos.cip)}</td></tr>
              <tr className="bg-gray-50 font-bold"><td className="py-2">Total pago</td><td className="py-2 text-right">{formatBRL(r.faturaConcessionaria.totalPago)}</td></tr>
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Fatura CoopereBR */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-green-600" />Fatura CoopereBR
          </CardTitle>
        </CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <tbody>
              <tr className="border-b"><td className="py-1.5 text-gray-600">Valor base</td><td className="py-1.5 text-right font-medium">{formatBRL(r.faturaCoopereBR.valorCobrado + r.faturaCoopereBR.totalDesconto)}</td></tr>
              {r.faturaCoopereBR.beneficiosAplicados > 0 && (
                <tr className="border-b"><td className="py-1.5 text-green-600">Benefícios de indicação</td><td className="py-1.5 text-right font-medium text-green-600">- {formatBRL(r.faturaCoopereBR.beneficiosAplicados)}</td></tr>
              )}
              <tr className="bg-green-50 font-bold"><td className="py-2">Total a pagar</td><td className="py-2 text-right text-green-700">{formatBRL(r.faturaCoopereBR.valorLiquido)}</td></tr>
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Footer */}
      <div className="text-center text-xs text-gray-400 pt-2 pb-4">
        <p>Dúvidas? Fale conosco via WhatsApp</p>
        <p className="mt-1">Acesse seu portal do cooperado</p>
      </div>
    </div>
  );
}
