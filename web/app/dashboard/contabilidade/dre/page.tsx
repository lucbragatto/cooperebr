'use client';

/**
 * D-novo-BR-CT CT.6 (31/05/2026) — DREs Segregadas (4 visões).
 *
 * TabsCustom M34 — 4 abas: Geral / Próprio / Auxiliar / Não-Coop.
 * Badge GATE WALTER quando validadoContador=false.
 */

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { TabsCustom, TabContent } from '@/components/ui/tabs-custom';
import { Loader2, FileText, RefreshCw, Scale } from 'lucide-react';

type Linha = {
  tipo: 'header' | 'ingresso' | 'dispendio' | 'receita' | 'despesa' | 'subtotal' | 'tributo' | 'fundo' | 'sobra' | 'info';
  rotulo: string;
  valor: string;
  somaTotal: boolean;
};

type Dre = {
  cooperativaId: string;
  cooperativaNome: string;
  ano: number;
  mes: number;
  competencia: string;
  visao: 'geral' | 'proprio' | 'auxiliar' | 'nao-coop';
  titulo: string;
  fundamentoLegal: string;
  linhas: Linha[];
  totalRotulo: string;
  total: string;
  fonte: 'SNAPSHOT' | 'PREVIEW';
  snapshotId: string | null;
  validadoContador: boolean;
  validadoEm: string | null;
  avisoValidacao: string | null;
  fundamentoIsencao: string | null;
};

const hoje = new Date();
const VISOES = [
  { value: 'geral', label: 'Geral (consolidada)' },
  { value: 'proprio', label: 'Ato Próprio' },
  { value: 'auxiliar', label: 'Ato Auxiliar' },
  { value: 'nao-coop', label: 'Ato Não-Coop' },
];

export default function DresPage() {
  const [ano, setAno] = useState(hoje.getFullYear());
  const [mes, setMes] = useState(hoje.getMonth() + 1);
  const [tab, setTab] = useState<'geral' | 'proprio' | 'auxiliar' | 'nao-coop'>('geral');
  const [dres, setDres] = useState<Record<string, Dre | null>>({
    geral: null,
    proprio: null,
    auxiliar: null,
    'nao-coop': null,
  });
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');

  async function carregar() {
    setLoading(true);
    setErro('');
    try {
      const resultados = await Promise.all(
        VISOES.map((v) =>
          api.get<Dre>(`/contabilidade-tributaria/dre/${v.value}?ano=${ano}&mes=${mes}`).then(
            (r) => [v.value, r.data] as const,
            () => [v.value, null] as const,
          ),
        ),
      );
      const novo: Record<string, Dre | null> = {};
      for (const [k, v] of resultados) novo[k] = v;
      setDres(novo);
    } catch (err: any) {
      setErro(err?.response?.data?.message || 'Falha ao carregar DREs');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ano, mes]);

  const dreAtual = dres[tab];

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <Scale className="h-6 w-6 text-cyan-700" />
          DREs Segregadas
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Demonstração de Resultado do Exercício — visões cooperativista, auxiliar e não-cooperativa.
        </p>
      </div>

      <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded">
        <p className="text-xs text-blue-800">
          <strong>Terminologia NBC ITG 2004:</strong> ato próprio usa "ingressos / dispêndios" (NÃO "receitas / despesas"). A separação visual entre os 4 blocos é o que defende a isenção fiscal perante a fiscalização.
        </p>
      </div>

      {/* Seletor */}
      <Card>
        <CardContent className="flex items-end gap-3 pt-6">
          <div>
            <label className="block text-xs text-gray-600 mb-1">Ano</label>
            <input
              type="number"
              value={ano}
              onChange={(e) => setAno(Number(e.target.value))}
              min={2024}
              max={2099}
              className="border rounded px-2 py-1.5 w-24 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">Mês</label>
            <select
              value={mes}
              onChange={(e) => setMes(Number(e.target.value))}
              className="border rounded px-2 py-1.5 text-sm"
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <option key={m} value={m}>
                  {String(m).padStart(2, '0')}
                </option>
              ))}
            </select>
          </div>
          <Button variant="outline" size="sm" onClick={carregar} disabled={loading}>
            <RefreshCw className="h-3.5 w-3.5 mr-1" />
            Recarregar
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              window.open(
                `/api/contabilidade-tributaria/relatorios/demonstrativo-nao-lucratividade?ano=${ano}&mes=${mes}`,
                '_blank',
              )
            }
          >
            <FileText className="h-3.5 w-3.5 mr-1" />
            PDF não-lucratividade
          </Button>
        </CardContent>
      </Card>

      {erro && (
        <div className="bg-red-50 border-l-4 border-red-500 p-3 text-sm text-red-700 rounded">
          {erro}
        </div>
      )}

      {loading && (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-cyan-700" />
        </div>
      )}

      {!loading && dreAtual && (
        <>
          {/* Badge GATE WALTER */}
          {!dreAtual.validadoContador && (
            <div className="bg-amber-100 border-2 border-amber-500 p-3 rounded text-center">
              <Badge variant="outline" className="bg-amber-200 border-amber-700 text-amber-900">
                ⚠️ PENDENTE VALIDAÇÃO CONTADOR
              </Badge>
              <p className="text-xs text-amber-800 mt-1">{dreAtual.avisoValidacao}</p>
            </div>
          )}
          {dreAtual.validadoContador && (
            <div className="bg-emerald-50 border-2 border-emerald-500 p-3 rounded text-center">
              <Badge variant="outline" className="bg-emerald-100 border-emerald-700 text-emerald-900">
                ✅ VALIDADO PELO CONTADOR
                {dreAtual.validadoEm && ` em ${new Date(dreAtual.validadoEm).toLocaleString('pt-BR')}`}
              </Badge>
            </div>
          )}

          <TabsCustom
            tabs={VISOES}
            activeValue={tab}
            onChange={(v) => setTab(v as any)}
          >
            {VISOES.map((v) => (
              <TabContent key={v.value} value={v.value}>
                {dres[v.value] && <DreCard dre={dres[v.value]!} />}
              </TabContent>
            ))}
          </TabsCustom>
        </>
      )}
    </div>
  );
}

function DreCard({ dre }: { dre: Dre }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{dre.titulo}</CardTitle>
        <p className="text-xs text-gray-500">
          Competência {dre.competencia} · Fonte:{' '}
          <span className={dre.fonte === 'SNAPSHOT' ? 'text-emerald-700' : 'text-amber-700'}>
            {dre.fonte === 'SNAPSHOT' ? 'snapshot fechado (imutável)' : 'preview on-the-fly'}
          </span>
        </p>
      </CardHeader>
      <CardContent>
        <div className="space-y-1 text-sm">
          {dre.linhas.map((l, i) => (
            <LinhaDre key={i} l={l} />
          ))}
          <div className="border-t mt-3 pt-3 flex justify-between items-center font-bold bg-cyan-50 p-2 rounded">
            <span>{dre.totalRotulo}</span>
            <span className="tabular-nums text-cyan-800">R$ {fmtNum(dre.total)}</span>
          </div>
        </div>
        <p className="text-xs text-gray-500 mt-4 border-t pt-3">
          <strong>Fundamento legal:</strong> {dre.fundamentoLegal}
        </p>
      </CardContent>
    </Card>
  );
}

function LinhaDre({ l }: { l: Linha }) {
  const v = Number(l.valor);
  switch (l.tipo) {
    case 'header':
      return (
        <div className="text-xs font-semibold text-cyan-800 bg-cyan-50 px-2 py-1 mt-3 rounded">
          {l.rotulo}
        </div>
      );
    case 'info':
      return <div className="text-xs text-gray-600 italic px-2">{l.rotulo}</div>;
    case 'subtotal':
      return (
        <div className="flex justify-between border-t pt-1 font-semibold text-gray-800">
          <span>{l.rotulo}</span>
          <span className="tabular-nums">R$ {fmtNum(l.valor)}</span>
        </div>
      );
    case 'sobra':
      return (
        <div className="flex justify-between font-semibold text-emerald-800 bg-emerald-50 px-2 py-1 rounded">
          <span>{l.rotulo}</span>
          <span className="tabular-nums">R$ {fmtNum(l.valor)}</span>
        </div>
      );
    case 'fundo':
      return (
        <div className="flex justify-between text-purple-800 px-2">
          <span>{l.rotulo}</span>
          <span className="tabular-nums">R$ {fmtNum(l.valor)}</span>
        </div>
      );
    case 'tributo':
      return (
        <div className="flex justify-between text-rose-700 px-2">
          <span>{l.rotulo}</span>
          <span className="tabular-nums">R$ {fmtNum(l.valor)}</span>
        </div>
      );
    default:
      return (
        <div className="flex justify-between px-2">
          <span className={v < 0 ? 'text-rose-700' : ''}>{l.rotulo}</span>
          <span className={`tabular-nums ${v < 0 ? 'text-rose-700' : ''}`}>R$ {fmtNum(l.valor)}</span>
        </div>
      );
  }
}

function fmtNum(s: string): string {
  const n = Number(s);
  if (Number.isNaN(n)) return s;
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
