'use client';

import { useEffect, useState } from 'react';
import { Loader2, FileText, Calendar, Building2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import api from '@/lib/api';
import type { MeResponse } from '@/types';

const statusCores: Record<string, string> = {
  ATIVO: 'bg-green-100 text-green-700',
  PENDENTE_ATIVACAO: 'bg-yellow-100 text-yellow-700',
  EM_APROVACAO: 'bg-blue-100 text-blue-700',
  ENCERRADO: 'bg-gray-100 text-gray-500',
  SUSPENSO: 'bg-red-100 text-red-700',
};

export default function ProprietarioContratosPage() {
  const [contratos, setContratos] = useState<any[]>([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    async function carregar() {
      try {
        const { data: me } = await api.get<MeResponse>('/auth/me');
        if (me.usinasProprietario.length > 0) {
          // Buscar contratos de uso das usinas do proprietário
          const usinaIds = me.usinasProprietario.map((u) => u.id);
          try {
            const { data } = await api.get('/contratos');
            const arr = Array.isArray(data) ? data : data?.data ?? [];
            setContratos(arr.filter((c: any) => usinaIds.includes(c.usinaId)));
          } catch {
            // ignore
          }
        }
      } catch {
        // ignore
      } finally {
        setCarregando(false);
      }
    }
    carregar();
  }, []);

  if (carregando) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-amber-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Contratos</h1>
        <p className="text-sm text-gray-500 mt-1">Contratos de uso das suas usinas</p>
      </div>

      {contratos.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 text-sm">Nenhum contrato encontrado.</p>
            <p className="text-gray-400 text-xs mt-1">
              Contratos de uso das usinas aparecerão aqui.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {contratos.map((c: any) => (
            <Card key={c.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <FileText className="w-4 h-4 text-gray-400" />
                      <span className="font-medium text-sm">
                        Contrato {c.numero ?? c.id.slice(0, 8)}
                      </span>
                      <Badge className={statusCores[c.status] ?? 'bg-gray-100 text-gray-500'}>
                        {c.status?.replace(/_/g, ' ')}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                      <div>
                        <p className="text-gray-500 text-xs">Cooperado</p>
                        <p className="font-medium">{c.cooperado?.nomeCompleto ?? '-'}</p>
                      </div>
                      <div>
                        <p className="text-gray-500 text-xs">Usina</p>
                        <p className="font-medium">{c.usina?.nome ?? '-'}</p>
                      </div>
                      <div>
                        <p className="text-gray-500 text-xs flex items-center gap-1">
                          <Calendar className="w-3 h-3" /> Início
                        </p>
                        <p className="font-medium">
                          {c.dataInicio ? new Date(c.dataInicio).toLocaleDateString('pt-BR') : '-'}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-500 text-xs">Desconto</p>
                        <p className="font-medium">{c.percentualDesconto}%</p>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
