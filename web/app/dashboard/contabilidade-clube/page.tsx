'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Coins, Download, AlertTriangle } from 'lucide-react';

interface RelatorioClube {
  competencia: string;
  emitido: { valor_reais: number; eventos: number };
  abatido: { valor_reais: number; eventos: number };
  expirado: { valor_reais: number; eventos: number };
  transferido: { valor_reais: number; eventos: number };
  saldo_em_circulacao: { valor_reais: number; observacao: string };
}

export default function ContabilidadeClubePage() {
  const [competencia, setCompetencia] = useState(new Date().toISOString().slice(0, 7));
  const [relatorio, setRelatorio] = useState<RelatorioClube | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => { carregar(); }, [competencia]);

  async function carregar() {
    setLoading(true);
    try {
      const { data } = await api.get<RelatorioClube>(`/contabilidade-clube/relatorio?competencia=${competencia}`);
      setRelatorio(data);
    } catch { setRelatorio(null); }
    finally { setLoading(false); }
  }

  function exportarCsv() {
    if (!relatorio) return;
    const r = relatorio;
    const lines = [
      'Categoria,Valor R$,Eventos',
      `Emitido,${r.emitido.valor_reais},${r.emitido.eventos}`,
      `Abatido,${r.abatido.valor_reais},${r.abatido.eventos}`,
      `Expirado,${r.expirado.valor_reais},${r.expirado.eventos}`,
      `Transferido,${r.transferido.valor_reais},${r.transferido.eventos}`,
      `Saldo em Circulação,${r.saldo_em_circulacao.valor_reais},—`,
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `contabilidade-clube-${competencia}.csv`;
    a.click();
  }

  const fmt = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Coins className="h-6 w-6" /> Contabilidade do Clube
        </h1>
        <div className="flex items-center gap-3">
          <input
            type="month"
            value={competencia}
            onChange={(e) => setCompetencia(e.target.value)}
            className="border rounded-md px-3 py-1.5 text-sm"
          />
          <Button variant="outline" size="sm" onClick={exportarCsv} disabled={!relatorio}>
            <Download className="h-4 w-4 mr-1" /> CSV
          </Button>
        </div>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3">
        <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
        <div className="text-sm text-amber-800">
          <strong>Modo preparatório.</strong> Classificação contábil definitiva será definida após consultoria com contador.
          Valores PROVISIONAL servem como base pra análise.
        </div>
      </div>

      {loading ? (
        <p className="text-center text-gray-500 py-8">Carregando...</p>
      ) : relatorio ? (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm text-gray-500">Emitido</CardTitle></CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-green-600">R$ {fmt(relatorio.emitido.valor_reais)}</p>
              <p className="text-xs text-gray-500">{relatorio.emitido.eventos} eventos</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm text-gray-500">Abatido</CardTitle></CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-blue-600">R$ {fmt(relatorio.abatido.valor_reais)}</p>
              <p className="text-xs text-gray-500">{relatorio.abatido.eventos} eventos</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm text-gray-500">Expirado</CardTitle></CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-orange-600">R$ {fmt(relatorio.expirado.valor_reais)}</p>
              <p className="text-xs text-gray-500">{relatorio.expirado.eventos} eventos</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm text-gray-500">Transferido</CardTitle></CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-purple-600">R$ {fmt(relatorio.transferido.valor_reais)}</p>
              <p className="text-xs text-gray-500">{relatorio.transferido.eventos} eventos</p>
            </CardContent>
          </Card>
          <Card className="col-span-2">
            <CardHeader className="pb-2"><CardTitle className="text-sm text-gray-500">Saldo em Circulação (Passivo)</CardTitle></CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-red-600">R$ {fmt(relatorio.saldo_em_circulacao.valor_reais)}</p>
              <p className="text-xs text-gray-500 mt-1">{relatorio.saldo_em_circulacao.observacao}</p>
            </CardContent>
          </Card>
        </div>
      ) : (
        <p className="text-center text-gray-500 py-8">Sem dados pra competência selecionada.</p>
      )}
    </div>
  );
}
