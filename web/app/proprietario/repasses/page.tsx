'use client';

import { useEffect, useState } from 'react';
import { Loader2, DollarSign, Download } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import api from '@/lib/api';
import type { MeResponse } from '@/types';

export default function ProprietarioRepassesPage() {
  const [repasses, setRepasses] = useState<any[]>([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    async function carregar() {
      try {
        // Tentar buscar repasses do proprietário
        const { data: me } = await api.get<MeResponse>('/auth/me');
        if (me.cooperadoId) {
          try {
            const { data } = await api.get('/financeiro/repasses', {
              params: { cooperadoId: me.cooperadoId },
            });
            setRepasses(Array.isArray(data) ? data : data?.data ?? []);
          } catch {
            // endpoint pode não existir ainda
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
        <h1 className="text-2xl font-bold text-gray-900">Repasses</h1>
        <p className="text-sm text-gray-500 mt-1">Histórico de repasses recebidos</p>
      </div>

      {repasses.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <DollarSign className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 text-sm">Nenhum repasse registrado ainda.</p>
            <p className="text-gray-400 text-xs mt-1">
              Os repasses aparecerão aqui conforme forem processados.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Histórico</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-gray-500">
                    <th className="py-2 pr-4">Período</th>
                    <th className="py-2 pr-4">Usina</th>
                    <th className="py-2 pr-4">Valor</th>
                    <th className="py-2 pr-4">Status</th>
                    <th className="py-2">PDF</th>
                  </tr>
                </thead>
                <tbody>
                  {repasses.map((r: any) => (
                    <tr key={r.id} className="border-b last:border-0 hover:bg-gray-50">
                      <td className="py-2 pr-4">{r.mesReferencia}/{r.anoReferencia}</td>
                      <td className="py-2 pr-4">{r.usina?.nome ?? '-'}</td>
                      <td className="py-2 pr-4 font-medium">
                        R$ {Number(r.valor ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-2 pr-4">
                        <Badge className={
                          r.status === 'PAGO' ? 'bg-green-100 text-green-700' :
                          'bg-yellow-100 text-yellow-700'
                        }>
                          {r.status ?? 'PENDENTE'}
                        </Badge>
                      </td>
                      <td className="py-2">
                        {r.pdfUrl && (
                          <Button variant="ghost" size="sm" asChild>
                            <a href={r.pdfUrl} target="_blank" rel="noopener noreferrer">
                              <Download className="w-4 h-4" />
                            </a>
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
