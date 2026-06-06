'use client';

/**
 * Sprint Onboarding Bloco 0 Fatia 0.1 (06/06/2026).
 *
 * Lista PlanosClube da cooperativa. Botão "Novo" + linhas com link pra edição.
 * SUPER_ADMIN: precisa de seletor de cooperativa (Fatia 0.2 — por ora hint
 * via ?cooperativaId=). ADMIN: usa próprio JWT.
 */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Gift, Plus, Edit2, AlertCircle } from 'lucide-react';
import api from '@/lib/api';

interface PlanoClube {
  id: string;
  nome: string;
  descricao: string | null;
  valorMensal: string;
  cobra: boolean;
  ativo: boolean;
  tierMinimo: string | null;
}

function formatBRL(v: number | string) {
  const n = typeof v === 'string' ? Number(v) : v;
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export default function PlanosClubePage() {
  const [planos, setPlanos] = useState<PlanoClube[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [incluirInativos, setIncluirInativos] = useState(false);

  useEffect(() => {
    setLoading(true);
    api
      .get<PlanoClube[]>(`/plano-clube?incluirInativos=${incluirInativos}`)
      .then((r) => setPlanos(r.data))
      .catch((e) => setErro(e?.response?.data?.message ?? e?.message ?? 'Erro ao carregar'))
      .finally(() => setLoading(false));
  }, [incluirInativos]);

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <Gift className="w-6 h-6 text-amber-600" />
            Planos do Clube
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Defina os planos de adesão ao Clube de Vantagens. Cada plano tem uma mensalidade — você escolhe se cobra ou se o clube é grátis.
          </p>
        </div>
        <Link href="/dashboard/clube/planos/novo">
          <Button className="gap-2">
            <Plus className="w-4 h-4" />
            Novo plano
          </Button>
        </Link>
      </div>

      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="p-4 text-sm text-blue-900">
          <p className="font-medium mb-1">Como funciona</p>
          <ul className="list-disc list-inside space-y-1 text-blue-800">
            <li><strong>Cobra = sim</strong>: gera linha de mensalidade na cobrança do cooperado (ou da empresa, em convênio).</li>
            <li><strong>Cobra = não</strong>: clube é grátis — matricula sem cobrar.</li>
            <li>A mensalidade é somada <strong>depois</strong> do desconto de energia, separada e discriminada.</li>
            <li>Em convênio, a empresa paga: <em>nº de membros × mensalidade</em> entra na cobrança consolidada.</li>
          </ul>
        </CardContent>
      </Card>

      <div className="flex items-center gap-3 text-sm">
        <input
          id="incluir-inativos"
          type="checkbox"
          checked={incluirInativos}
          onChange={(e) => setIncluirInativos(e.target.checked)}
          className="accent-amber-600"
        />
        <label htmlFor="incluir-inativos" className="text-gray-700 cursor-pointer">
          Mostrar planos inativos
        </label>
      </div>

      {erro && (
        <Card className="bg-red-50 border-red-200">
          <CardContent className="p-4 text-red-800 flex items-start gap-2">
            <AlertCircle className="w-5 h-5 mt-0.5" />
            <div>
              <p className="font-medium">Erro ao carregar</p>
              <p className="text-sm">{erro}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <p className="text-gray-500">Carregando planos…</p>
      ) : planos.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-gray-500">
            Nenhum plano cadastrado. Clique em <strong>Novo plano</strong> pra começar.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {planos.map((p) => (
            <Link key={p.id} href={`/dashboard/clube/planos/${p.id}`} className="block">
              <Card className="hover:bg-amber-50 transition-colors cursor-pointer">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      {p.nome}
                      {!p.ativo && <Badge variant="outline" className="text-gray-500">Inativo</Badge>}
                      {p.cobra ? (
                        <Badge className="bg-amber-100 text-amber-800 border-amber-300">Pago</Badge>
                      ) : (
                        <Badge className="bg-green-100 text-green-800 border-green-300">Grátis</Badge>
                      )}
                      {p.tierMinimo && (
                        <Badge variant="outline" className="text-purple-700 border-purple-300">
                          Mín: {p.tierMinimo}
                        </Badge>
                      )}
                    </span>
                    <Edit2 className="w-4 h-4 text-gray-400" />
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0 text-sm">
                  <p className="text-2xl font-semibold text-gray-800">
                    {formatBRL(p.valorMensal)} <span className="text-sm font-normal text-gray-500">/ mês</span>
                  </p>
                  {p.descricao && <p className="text-gray-600 mt-1">{p.descricao}</p>}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
