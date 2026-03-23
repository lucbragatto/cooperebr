'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Loader2, RefreshCw } from 'lucide-react';

interface FaturaSaas {
  id: string;
  cooperativaId: string;
  cooperativa: { nome: string; cnpj: string };
  competencia: string;
  valorBase: number;
  valorReceita: number;
  valorTotal: number;
  status: string;
  dataVencimento: string;
  dataPagamento: string | null;
}

const STATUS_COLORS: Record<string, string> = {
  PENDENTE: 'bg-yellow-100 text-yellow-700',
  PAGO: 'bg-green-100 text-green-700',
  VENCIDO: 'bg-red-100 text-red-700',
  CANCELADO: 'bg-gray-100 text-gray-500',
};

export default function FaturasSaasPage() {
  const [faturas, setFaturas] = useState<FaturaSaas[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [gerando, setGerando] = useState(false);
  const [msg, setMsg] = useState('');

  async function carregar() {
    try {
      const { data } = await api.get('/saas/faturas');
      setFaturas(data);
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => { carregar(); }, []);

  async function gerarFaturas() {
    setGerando(true);
    setMsg('');
    try {
      const { data } = await api.post('/saas/faturas/gerar');
      setMsg(`${data.total} fatura(s) processada(s)`);
      carregar();
    } catch (e: any) {
      setMsg(e?.response?.data?.message || 'Erro ao gerar faturas');
    } finally {
      setGerando(false);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Faturas SaaS</h2>
        <Button onClick={gerarFaturas} disabled={gerando}>
          {gerando ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
          Gerar Faturas do Mês
        </Button>
      </div>

      {msg && <p className="text-sm text-blue-600 mb-4">{msg}</p>}

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-medium text-gray-600">
            {carregando ? 'Carregando...' : `${faturas.length} faturas`}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Parceiro</TableHead>
                <TableHead>Competência</TableHead>
                <TableHead>Valor Base</TableHead>
                <TableHead>% Receita</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Vencimento</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {faturas.length === 0 && !carregando ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-gray-400 py-8">
                    Nenhuma fatura SaaS
                  </TableCell>
                </TableRow>
              ) : (
                faturas.map((f) => (
                  <TableRow key={f.id}>
                    <TableCell className="font-medium">{f.cooperativa.nome}</TableCell>
                    <TableCell>{new Date(f.competencia).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}</TableCell>
                    <TableCell>R$ {Number(f.valorBase).toFixed(2)}</TableCell>
                    <TableCell>R$ {Number(f.valorReceita).toFixed(2)}</TableCell>
                    <TableCell className="font-medium">R$ {Number(f.valorTotal).toFixed(2)}</TableCell>
                    <TableCell>{new Date(f.dataVencimento).toLocaleDateString('pt-BR')}</TableCell>
                    <TableCell>
                      <Badge className={STATUS_COLORS[f.status] || 'bg-gray-100'}>
                        {f.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
