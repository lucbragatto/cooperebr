'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { useTipoParceiro } from '@/hooks/useTipoParceiro';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { AlertTriangle, Download, Loader2 } from 'lucide-react';

interface UsinaResumo {
  id: string;
  nome: string;
  cidade: string;
  estado: string;
  capacidadeKwh: number;
  totalAlocado: number;
  totalCooperados: number;
  excedida: boolean;
}

export default function ListasConcessionariaPage() {
  const { tipoMembroPlural } = useTipoParceiro();
  const [usinas, setUsinas] = useState<UsinaResumo[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [baixando, setBaixando] = useState<string | null>(null);

  useEffect(() => {
    carregarUsinas();
  }, []);

  async function carregarUsinas() {
    setCarregando(true);
    try {
      const { data: listaUsinas } = await api.get('/usinas');
      const resumos: UsinaResumo[] = [];

      for (const u of listaUsinas) {
        try {
          const { data } = await api.get(`/migracoes-usina/lista-concessionaria/${u.id}`);
          const cap = Number(u.capacidadeKwh ?? 0);
          resumos.push({
            id: u.id,
            nome: u.nome,
            cidade: u.cidade,
            estado: u.estado,
            capacidadeKwh: cap,
            totalAlocado: data.totalKwh ?? 0,
            totalCooperados: data.totalCooperados ?? 0,
            excedida: cap > 0 && (data.totalKwh ?? 0) > cap,
          });
        } catch {
          resumos.push({
            id: u.id,
            nome: u.nome,
            cidade: u.cidade ?? '',
            estado: u.estado ?? '',
            capacidadeKwh: Number(u.capacidadeKwh ?? 0),
            totalAlocado: 0,
            totalCooperados: 0,
            excedida: false,
          });
        }
      }

      setUsinas(resumos);
    } catch {
      // silently ignore
    } finally {
      setCarregando(false);
    }
  }

  async function baixarCSV(usinaId: string, nomeUsina: string) {
    setBaixando(usinaId);
    try {
      const { data } = await api.get(`/migracoes-usina/lista-concessionaria/${usinaId}`);
      const csv = data.csv as string;
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `lista-${nomeUsina.replace(/\s+/g, '-').toLowerCase()}-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert('Erro ao baixar lista.');
    } finally {
      setBaixando(null);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Listas para Concessionária</h2>
        <Button size="sm" variant="outline" onClick={carregarUsinas} disabled={carregando}>
          {carregando ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
          Atualizar
        </Button>
      </div>

      {carregando && <p className="text-gray-500">Carregando usinas...</p>}

      {!carregando && usinas.length === 0 && (
        <p className="text-gray-400">Nenhuma usina cadastrada.</p>
      )}

      {/* Alertas de capacidade excedida */}
      {usinas.filter((u) => u.excedida).length > 0 && (
        <div className="mb-4 space-y-2">
          {usinas.filter((u) => u.excedida).map((u) => (
            <div key={u.id} className="flex items-start gap-2 p-3 rounded-lg text-sm bg-red-50 text-red-800 border border-red-200">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>
                <strong>{u.nome}</strong>: capacidade excedida — {u.totalAlocado.toLocaleString('pt-BR')} kWh alocados de {u.capacidadeKwh.toLocaleString('pt-BR')} kWh disponíveis.
              </span>
            </div>
          ))}
        </div>
      )}

      {!carregando && usinas.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Todas as Usinas</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Usina</TableHead>
                  <TableHead>Cidade/UF</TableHead>
                  <TableHead>Capacidade (kWh)</TableHead>
                  <TableHead>Alocado (kWh)</TableHead>
                  <TableHead>% Uso</TableHead>
                  <TableHead>{tipoMembroPlural}</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {usinas.map((u) => {
                  const pct = u.capacidadeKwh > 0
                    ? Math.round((u.totalAlocado / u.capacidadeKwh) * 1000) / 10
                    : 0;
                  return (
                    <TableRow key={u.id}>
                      <TableCell className="font-medium">{u.nome}</TableCell>
                      <TableCell>{u.cidade}/{u.estado}</TableCell>
                      <TableCell>{u.capacidadeKwh.toLocaleString('pt-BR')}</TableCell>
                      <TableCell>{u.totalAlocado.toLocaleString('pt-BR')}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="w-16 bg-gray-200 rounded-full h-1.5">
                            <div
                              className={`h-1.5 rounded-full ${pct > 100 ? 'bg-red-600' : pct > 80 ? 'bg-yellow-500' : 'bg-green-600'}`}
                              style={{ width: `${Math.min(pct, 100)}%` }}
                            />
                          </div>
                          <span className="text-xs">{pct.toFixed(1)}%</span>
                        </div>
                      </TableCell>
                      <TableCell>{u.totalCooperados}</TableCell>
                      <TableCell>
                        {u.excedida ? (
                          <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-red-100 text-red-800">Excedida</span>
                        ) : pct > 80 ? (
                          <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-yellow-100 text-yellow-800">Alta ocupação</span>
                        ) : (
                          <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-green-100 text-green-800">OK</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={baixando === u.id}
                          onClick={() => baixarCSV(u.id, u.nome)}
                        >
                          {baixando === u.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Download className="h-4 w-4" />
                          )}
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
