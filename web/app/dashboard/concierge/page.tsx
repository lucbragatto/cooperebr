'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import api from '@/lib/api';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ShieldCheck, AlertCircle, Search, FileText, ArrowRight } from 'lucide-react';

interface StatusResposta {
  cooperativaId: string;
  moduloConciergeAtivo: boolean;
}

interface CooperadoAuditavel {
  cooperadoId: string;
  nome: string;
  email: string | null;
  qtdFaturasProcessadas: number;
  ultimaFaturaMes: string | null;
}

interface ListaResposta {
  items: CooperadoAuditavel[];
  total: number;
}

export default function ConciergePage() {
  const [status, setStatus] = useState<StatusResposta | null>(null);
  const [auditaveis, setAuditaveis] = useState<CooperadoAuditavel[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [filtro, setFiltro] = useState('');

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const s = await api.get<StatusResposta>('/concierge/status');
        if (!mounted) return;
        setStatus(s.data);
        if (s.data.moduloConciergeAtivo) {
          const l = await api.get<ListaResposta>('/concierge/auditaveis');
          if (!mounted) return;
          setAuditaveis(l.data.items);
        }
      } catch (e: any) {
        if (!mounted) return;
        setErro(e?.response?.data?.message ?? e?.message ?? 'Erro ao carregar');
      } finally {
        if (mounted) setCarregando(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  if (carregando) {
    return <div className="p-6 text-gray-500">Carregando…</div>;
  }

  if (erro) {
    return (
      <div className="p-6">
        <Card className="p-4 bg-red-50 border-red-200 text-red-800">Erro: {erro}</Card>
      </div>
    );
  }

  // Banner upgrade quando modulo inativo
  if (!status?.moduloConciergeAtivo) {
    return (
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-2">
            <ShieldCheck className="w-8 h-8 text-emerald-600" /> Concierge Tributário
          </h1>
          <p className="text-sm text-gray-500">Auditor automático de fatura de energia</p>
        </div>

        <Card className="p-8 bg-gradient-to-br from-emerald-50 to-cyan-50 border-emerald-200">
          <div className="max-w-2xl mx-auto text-center space-y-4">
            <div className="inline-flex p-3 rounded-full bg-emerald-100">
              <ShieldCheck className="w-12 h-12 text-emerald-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-800">
              Módulo Concierge não está ativo para esta cooperativa
            </h2>
            <p className="text-gray-600">
              O Concierge audita automaticamente cada fatura de energia dos seus
              cooperados e identifica indébitos tributários (PIS/COFINS sobre
              SCEE, ICMS sobre TUSD-Geração, etc). Gera relatório individualizado
              + briefing pra advogado parceiro.
            </p>
            <div className="grid grid-cols-3 gap-4 my-6 text-sm">
              <div className="p-3 bg-white rounded-lg border">
                <div className="font-semibold text-emerald-700">3 detectores</div>
                <div className="text-gray-500 text-xs">Tema 69 + Tese 3 + Tese 2</div>
              </div>
              <div className="p-3 bg-white rounded-lg border">
                <div className="font-semibold text-emerald-700">EDP-ES + ELFSM</div>
                <div className="text-gray-500 text-xs">Adapters calibrados</div>
              </div>
              <div className="p-3 bg-white rounded-lg border">
                <div className="font-semibold text-emerald-700">60m + SELIC</div>
                <div className="text-gray-500 text-xs">Projeção retroativa</div>
              </div>
            </div>
            <div className="text-xs text-gray-500">
              Solicite ativação ao administrador SISGD (SUPER_ADMIN).
            </div>
          </div>
        </Card>
      </div>
    );
  }

  const lista = filtro
    ? auditaveis.filter(
        (a) =>
          a.nome.toLowerCase().includes(filtro.toLowerCase()) ||
          a.email?.toLowerCase().includes(filtro.toLowerCase()),
      )
    : auditaveis;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-2">
          <ShieldCheck className="w-8 h-8 text-emerald-600" /> Concierge Tributário
        </h1>
        <p className="text-sm text-gray-500">
          {auditaveis.length} cooperado(s) com fatura processada elegível pra auditoria
        </p>
      </div>

      <Card className="p-4">
        <div className="flex items-center gap-2 mb-4">
          <Search className="w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por nome ou email..."
            value={filtro}
            onChange={(e) => setFiltro(e.target.value)}
            className="flex-1 px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        {lista.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <FileText className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p>
              {filtro
                ? 'Nenhum cooperado bate com o filtro.'
                : 'Nenhum cooperado com fatura processada ainda.'}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {lista.map((c) => (
              <Link
                key={c.cooperadoId}
                href={`/dashboard/concierge/cooperado/${c.cooperadoId}`}
                className="block p-4 border rounded-lg hover:bg-emerald-50 hover:border-emerald-300 transition"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-gray-800">{c.nome}</div>
                    <div className="text-xs text-gray-500">{c.email ?? '—'}</div>
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    <div className="text-right">
                      <div className="font-medium text-gray-700">
                        {c.qtdFaturasProcessadas} fatura(s)
                      </div>
                      <div className="text-xs text-gray-500">
                        Última: {c.ultimaFaturaMes ?? '—'}
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-emerald-600" />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
