'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users } from 'lucide-react';
import { useContexto } from '@/hooks/useContexto';

export default function AgregadorDashboard() {
  const { contextoObj } = useContexto();
  const [totalMembros, setTotalMembros] = useState<number | null>(null);

  useEffect(() => {
    if (!contextoObj?.agregadorId) return;
    api.get(`/cooperados?administradoraId=${contextoObj.agregadorId}&limit=0`)
      .then(r => {
        const data = r.data;
        setTotalMembros(Array.isArray(data) ? data.length : (data.total ?? 0));
      })
      .catch(() => setTotalMembros(0));
  }, [contextoObj?.agregadorId]);

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-800 mb-6">Dashboard</h2>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Membros</CardTitle>
            <Users className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {totalMembros === null ? '...' : totalMembros}
            </div>
            <p className="text-xs text-gray-500 mt-1">Total de membros vinculados</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
