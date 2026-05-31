'use client';

/**
 * D-novo-BR-CT CT.6 (31/05/2026) — Plano de Contas Segregado.
 *
 * Visualização das contas com naturezaContabil + naturezaCooperativa +
 * fundamentoLegal (campos CT.1). Read-only — CRUD continua em
 * /dashboard/configuracoes/financeiro pra ADMIN financeiro.
 */

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Library } from 'lucide-react';

type Conta = {
  id: string;
  codigo: string;
  nome: string;
  tipo: string;
  ativo: boolean;
  naturezaContabil: string | null;
  naturezaCooperativa: string | null;
  fundamentoLegal: string | null;
};

const CORES_COOPERATIVA: Record<string, string> = {
  PROPRIO: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  AUXILIAR: 'bg-blue-100 text-blue-800 border-blue-300',
  NAO_COOPERATIVO: 'bg-rose-100 text-rose-800 border-rose-300',
};

const CORES_CONTABIL: Record<string, string> = {
  ATIVO: 'bg-gray-100 text-gray-700',
  PASSIVO: 'bg-gray-100 text-gray-700',
  PATRIMONIO_LIQUIDO: 'bg-gray-100 text-gray-700',
  RECEITA_ATO_PROPRIO: 'bg-emerald-50 text-emerald-700',
  RECEITA_ATO_AUXILIAR: 'bg-blue-50 text-blue-700',
  RECEITA_NAO_COOPERATIVO: 'bg-rose-50 text-rose-700',
  DESPESA_ATO_PROPRIO: 'bg-emerald-50 text-emerald-700',
  DESPESA_ATO_AUXILIAR: 'bg-blue-50 text-blue-700',
  DESPESA_NAO_COOPERATIVO: 'bg-rose-50 text-rose-700',
  FUNDOS_OBRIGATORIOS: 'bg-purple-50 text-purple-700',
  SOBRAS_DISTRIBUIVEIS: 'bg-amber-50 text-amber-700',
  RESULTADO_NAO_COOPERATIVO: 'bg-rose-50 text-rose-700',
};

export default function PlanoContasSegregadoPage() {
  const [contas, setContas] = useState<Conta[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');

  useEffect(() => {
    api
      .get<Conta[]>('/financeiro/plano-contas')
      .then((r) => setContas(r.data))
      .catch((err) => setErro(err?.response?.data?.message || 'Falha ao carregar'))
      .finally(() => setLoading(false));
  }, []);

  // Estatísticas
  const total = contas.length;
  const segregadas = contas.filter((c) => c.naturezaContabil).length;
  const semClass = contas.filter((c) => !c.naturezaContabil).length;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <Library className="h-6 w-6 text-cyan-700" />
          Plano de Contas Segregado
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Contas contábeis com classificação cooperativa (Art. 79/86/88 Lei 5.764/71)
        </p>
      </div>

      <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded text-xs text-blue-800">
        <p>
          Esta tela mostra a <strong>classificação cooperativa</strong> de cada conta — fundamental
          pra defesa fiscal. Contas <span className="text-emerald-700 font-semibold">PRÓPRIO</span> são
          isentas (Art. 79), <span className="text-blue-700 font-semibold">AUXILIAR</span> são neutras
          (Art. 88), <span className="text-rose-700 font-semibold">NÃO-COOP</span> são tributadas (Art. 86).
        </p>
        <p className="mt-2">
          Pra editar contas, use <strong>/dashboard/configuracoes/financeiro</strong>. Esta visão é read-only
          pra auditoria + defesa contábil.
        </p>
      </div>

      {loading && (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-cyan-700" />
        </div>
      )}
      {erro && (
        <div className="bg-red-50 border-l-4 border-red-500 p-3 text-sm text-red-700 rounded">{erro}</div>
      )}

      {!loading && (
        <>
          <div className="grid grid-cols-3 gap-3">
            <Card>
              <CardContent className="pt-4">
                <div className="text-xs text-gray-500">Total de contas</div>
                <div className="text-2xl font-bold">{total}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="text-xs text-gray-500">Segregadas (CT.1)</div>
                <div className="text-2xl font-bold text-emerald-700">{segregadas}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="text-xs text-gray-500">Pendentes de classificação</div>
                <div className="text-2xl font-bold text-amber-700">{semClass}</div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Contas</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs text-gray-500 border-b">
                    <tr>
                      <th className="text-left py-2 px-2">Código</th>
                      <th className="text-left py-2 px-2">Nome</th>
                      <th className="text-left py-2 px-2">Natureza Contábil</th>
                      <th className="text-left py-2 px-2">Natureza Cooperativa</th>
                      <th className="text-left py-2 px-2">Fundamento Legal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {contas.map((c) => (
                      <tr key={c.id} className="border-b hover:bg-gray-50">
                        <td className="py-2 px-2 font-mono text-xs">{c.codigo}</td>
                        <td className="py-2 px-2">{c.nome}</td>
                        <td className="py-2 px-2">
                          {c.naturezaContabil ? (
                            <span
                              className={`text-[10px] px-2 py-0.5 rounded ${CORES_CONTABIL[c.naturezaContabil] ?? 'bg-gray-100'}`}
                            >
                              {c.naturezaContabil}
                            </span>
                          ) : (
                            <span className="text-xs text-amber-600">— pendente</span>
                          )}
                        </td>
                        <td className="py-2 px-2">
                          {c.naturezaCooperativa ? (
                            <Badge
                              variant="outline"
                              className={CORES_COOPERATIVA[c.naturezaCooperativa] ?? ''}
                            >
                              {c.naturezaCooperativa}
                            </Badge>
                          ) : (
                            <span className="text-xs text-gray-400">—</span>
                          )}
                        </td>
                        <td className="py-2 px-2 text-xs text-gray-600">
                          {c.fundamentoLegal ?? <em className="text-gray-400">—</em>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
