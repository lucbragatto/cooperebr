'use client';

/**
 * Sprint Portal Empresa 9.0 (04/06/2026) — Home do portal da empresa.
 * Lista os convênios onde o usuário é pagador. Se for 1 só, redireciona
 * pro dashboard direto. Senão, mostra cards.
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';
import { Building2, ArrowRight, Loader2, AlertTriangle } from 'lucide-react';
import { HelpBox } from '@/components/ui/help-box';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface ConvenioListItem {
  id: string;
  numero: string;
  empresaNome: string;
  empresaCnpj: string | null;
  naturezaAtoCooperativo: 'AUXILIAR' | 'PROPRIO' | 'NAO_COOPERATIVO' | null;
  baseCobrancaCusteio: 'CONSUMO_REAL' | 'ALOCACAO_FIXA' | null;
  kwhAlocadoMensal: number | null;
  status: string;
}

interface ConveniosResponse {
  data: ConvenioListItem[];
  total: number;
}

export default function ConveniadaHome() {
  const router = useRouter();
  const [convenios, setConvenios] = useState<ConvenioListItem[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;
    api
      .get<ConveniosResponse>('/portal/meus-convenios')
      .then((r) => {
        if (!ativo) return;
        const lista = r.data?.data ?? [];
        setConvenios(lista);
        if (lista.length === 1) {
          router.replace(`/conveniada/convenio/${lista[0].id}`);
        }
      })
      .catch((err) => {
        if (ativo) {
          setErro(
            err?.response?.data?.message ??
              err?.message ??
              'Erro ao carregar seus convênios',
          );
        }
      })
      .finally(() => {
        if (ativo) setCarregando(false);
      });
    return () => {
      ativo = false;
    };
  }, [router]);

  if (carregando) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-8 flex items-center gap-2 text-sm text-slate-600">
        <Loader2 className="h-4 w-4 animate-spin" /> Carregando seus convênios...
      </div>
    );
  }

  if (erro) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-900 flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <div>{erro}</div>
        </div>
      </div>
    );
  }

  if (convenios.length === 0) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-8">
        <HelpBox id="empresa-sem-convenios" titulo="Nenhum convênio vinculado">
          Sua empresa ainda não está vinculada a nenhum convênio ATIVO. Entre em contato com a
          CoopereBR pra ativar.
        </HelpBox>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-4">
      <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
        <Building2 className="h-5 w-5 text-orange-600" />
        Seus convênios ({convenios.length})
      </h2>
      <p className="text-sm text-slate-600">
        Escolha o convênio que você quer gerenciar.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {convenios.map((c) => (
          <Link key={c.id} href={`/conveniada/convenio/${c.id}`}>
            <Card className="hover:shadow-md hover:border-orange-300 cursor-pointer transition-all">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <div className="font-semibold text-slate-800">{c.empresaNome}</div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    {c.numero}
                    {c.empresaCnpj ? ` · CNPJ ${c.empresaCnpj}` : ''}
                  </div>
                  {c.naturezaAtoCooperativo && (
                    <Badge variant="outline" className="mt-2 bg-emerald-50 text-emerald-700 border-emerald-300 text-[10px]">
                      {c.naturezaAtoCooperativo === 'AUXILIAR'
                        ? 'Ato cooperativo Auxiliar'
                        : c.naturezaAtoCooperativo === 'PROPRIO'
                          ? 'Ato cooperativo Próprio'
                          : 'Não cooperativo'}
                    </Badge>
                  )}
                </div>
                <ArrowRight className="h-5 w-5 text-slate-400" />
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
