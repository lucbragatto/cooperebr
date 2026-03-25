'use client';

import { useEffect, useState } from 'react';
import { Loader2, Sun, Zap, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import api from '@/lib/api';

const statusCores: Record<string, string> = {
  CADASTRADA: 'bg-gray-100 text-gray-600',
  AGUARDANDO_HOMOLOGACAO: 'bg-yellow-100 text-yellow-700',
  HOMOLOGADA: 'bg-blue-100 text-blue-700',
  EM_PRODUCAO: 'bg-green-100 text-green-700',
  SUSPENSA: 'bg-red-100 text-red-700',
};

export default function ParceiroUsinasPage() {
  const [usinas, setUsinas] = useState<any[]>([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    async function carregar() {
      try {
        const { data } = await api.get('/usinas');
        setUsinas(Array.isArray(data) ? data : data?.data ?? []);
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
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Usinas</h1>
        <p className="text-sm text-gray-500 mt-1">{usinas.length} usina(s) vinculada(s)</p>
      </div>

      {usinas.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12 text-gray-500 text-sm">
            Nenhuma usina vinculada ao seu parceiro.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {usinas.map((u: any) => (
            <Card key={u.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Sun className="w-5 h-5 text-amber-500" />
                    {u.nome}
                  </CardTitle>
                  <Badge className={statusCores[u.statusHomologacao] ?? 'bg-gray-100 text-gray-500'}>
                    {u.statusHomologacao?.replace(/_/g, ' ')}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Potência</span>
                  <span className="font-medium">{Number(u.potenciaKwp).toLocaleString('pt-BR')} kWp</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Capacidade</span>
                  <span className="font-medium">
                    {u.capacidadeKwh ? `${Number(u.capacidadeKwh).toLocaleString('pt-BR')} kWh` : 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Produção Mensal</span>
                  <span className="font-medium">
                    {u.producaoMensalKwh ? `${Number(u.producaoMensalKwh).toLocaleString('pt-BR')} kWh` : 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Localização</span>
                  <span>{u.cidade}/{u.estado}</span>
                </div>
                {u.proprietarioNome && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Proprietário</span>
                    <span>{u.proprietarioNome}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
