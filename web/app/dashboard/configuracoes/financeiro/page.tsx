'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { getUsuario } from '@/lib/auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';

export default function ConfigFinanceiroPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [erro, setErro] = useState('');
  const [cooperativaId, setCooperativaId] = useState('');

  const [multaAtraso, setMultaAtraso] = useState('2');
  const [jurosDiarios, setJurosDiarios] = useState('0.033');
  const [diasCarencia, setDiasCarencia] = useState('3');

  useEffect(() => {
    async function load() {
      try {
        // Buscar a primeira cooperativa do usuário
        const { data: cooperativas } = await api.get('/cooperativas');
        if (cooperativas.length > 0) {
          const id = cooperativas[0].id;
          setCooperativaId(id);
          const { data } = await api.get(`/cooperativas/financeiro/${id}`);
          setMultaAtraso(String(data.multaAtraso));
          setJurosDiarios(String(data.jurosDiarios));
          setDiasCarencia(String(data.diasCarencia));
        }
      } catch {
        // defaults
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  async function handleSave() {
    if (!cooperativaId) {
      setErro('Nenhum parceiro encontrado');
      return;
    }
    setSaving(true);
    setMsg('');
    setErro('');
    try {
      await api.patch(`/cooperativas/financeiro/${cooperativaId}`, {
        multaAtraso: Number(multaAtraso),
        jurosDiarios: Number(jurosDiarios),
        diasCarencia: Number(diasCarencia),
      });
      setMsg('Configuração salva com sucesso!');
    } catch (err: any) {
      setErro(err.response?.data?.message || 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-green-600" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Configurações Financeiras</h1>
        <p className="text-sm text-gray-500 mt-1">
          Configure multa, juros e carência para cobranças vencidas.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Régua de Cobrança</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="multa">Multa por atraso (%)</Label>
            <Input
              id="multa"
              type="number"
              step="0.01"
              min="0"
              max="100"
              value={multaAtraso}
              onChange={(e) => setMultaAtraso(e.target.value)}
            />
            <p className="text-xs text-gray-500">Percentual de multa aplicado sobre o valor da cobrança após o período de carência. Padrão: 2%</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="juros">Juros diários (%)</Label>
            <Input
              id="juros"
              type="number"
              step="0.001"
              min="0"
              max="10"
              value={jurosDiarios}
              onChange={(e) => setJurosDiarios(e.target.value)}
            />
            <p className="text-xs text-gray-500">Percentual de juros aplicado por dia de atraso (após carência). 0,033%/dia equivale a 1%/mês</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="carencia">Dias de carência</Label>
            <Input
              id="carencia"
              type="number"
              step="1"
              min="0"
              max="30"
              value={diasCarencia}
              onChange={(e) => setDiasCarencia(e.target.value)}
            />
            <p className="text-xs text-gray-500">Dias após o vencimento antes de aplicar multa e juros. Padrão: 3 dias</p>
          </div>

          {msg && <p className="text-sm text-green-600 font-medium">{msg}</p>}
          {erro && <p className="text-sm text-red-600 font-medium">{erro}</p>}

          <div className="pt-2">
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Salvar
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
