'use client';

import { useEffect, useState } from 'react';
import { Loader2, Sun, MapPin, Zap, Calendar } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import api from '@/lib/api';
import type { MeResponse } from '@/types';

const statusCores: Record<string, string> = {
  CADASTRADA: 'bg-gray-100 text-gray-600',
  AGUARDANDO_HOMOLOGACAO: 'bg-yellow-100 text-yellow-700',
  HOMOLOGADA: 'bg-blue-100 text-blue-700',
  EM_PRODUCAO: 'bg-green-100 text-green-700',
  SUSPENSA: 'bg-red-100 text-red-700',
};

export default function ProprietarioUsinasPage() {
  const [usinas, setUsinas] = useState<any[]>([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    async function carregar() {
      try {
        const { data: me } = await api.get<MeResponse>('/auth/me');
        if (me.usinasProprietario.length > 0) {
          const ids = me.usinasProprietario.map((u) => u.id);
          const { data: allUsinas } = await api.get('/usinas');
          const arr = Array.isArray(allUsinas) ? allUsinas : allUsinas?.data ?? [];
          setUsinas(arr.filter((u: any) => ids.includes(u.id)));
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
        <h1 className="text-2xl font-bold text-gray-900">Minhas Usinas</h1>
        <p className="text-sm text-gray-500 mt-1">{usinas.length} usina(s)</p>
      </div>

      {usinas.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12 text-gray-500 text-sm">
            Nenhuma usina vinculada ao seu nome.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {usinas.map((u: any) => (
            <Card key={u.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Sun className="w-5 h-5 text-amber-500" />
                    {u.nome}
                  </CardTitle>
                  <Badge className={statusCores[u.statusHomologacao] ?? 'bg-gray-100 text-gray-500'}>
                    {u.statusHomologacao?.replace(/_/g, ' ')}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <p className="text-gray-500 flex items-center gap-1 mb-1">
                      <Zap className="w-3 h-3" /> Potência
                    </p>
                    <p className="font-semibold">{Number(u.potenciaKwp).toLocaleString('pt-BR')} kWp</p>
                  </div>
                  <div>
                    <p className="text-gray-500 flex items-center gap-1 mb-1">
                      <Zap className="w-3 h-3" /> Capacidade
                    </p>
                    <p className="font-semibold">
                      {u.capacidadeKwh ? `${Number(u.capacidadeKwh).toLocaleString('pt-BR')} kWh` : 'N/A'}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-500 flex items-center gap-1 mb-1">
                      <MapPin className="w-3 h-3" /> Localização
                    </p>
                    <p className="font-semibold">{u.cidade}/{u.estado}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 flex items-center gap-1 mb-1">
                      <Calendar className="w-3 h-3" /> Início Produção
                    </p>
                    <p className="font-semibold">
                      {u.dataInicioProducao
                        ? new Date(u.dataInicioProducao).toLocaleDateString('pt-BR')
                        : 'Não iniciada'}
                    </p>
                  </div>
                </div>
                {u.distribuidora && (
                  <p className="text-xs text-gray-500 mt-3">Distribuidora: {u.distribuidora}</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
