'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';
import type { Contrato } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ArrowLeft } from 'lucide-react';

export default function NovaCobrancaPage() {
  const router = useRouter();

  const [form, setForm] = useState({
    contratoId: '',
    mesReferencia: '',
    anoReferencia: '',
    valorBruto: '',
    dataVencimento: '',
  });
  const [contratos, setContratos] = useState<Contrato[]>([]);
  const [percentualDesconto, setPercentualDesconto] = useState(0);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');

  useEffect(() => {
    api.get<Contrato[]>('/contratos').then((r) => setContratos(r.data));
  }, []);

  function set(field: keyof typeof form, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function handleContratoChange(contratoId: string) {
    set('contratoId', contratoId);
    const contrato = contratos.find((c) => c.id === contratoId);
    setPercentualDesconto(contrato?.percentualDesconto ?? 0);
  }

  const valorBruto = parseFloat(form.valorBruto) || 0;
  const valorDesconto = (valorBruto * percentualDesconto) / 100;
  const valorLiquido = valorBruto - valorDesconto;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro('');
    setSucesso('');

    if (!form.contratoId || !form.mesReferencia || !form.anoReferencia ||
        !form.valorBruto || !form.dataVencimento) {
      setErro('Todos os campos são obrigatórios.');
      return;
    }

    const mes = parseInt(form.mesReferencia);
    if (isNaN(mes) || mes < 1 || mes > 12) {
      setErro('O mês de referência deve ser entre 1 e 12.');
      return;
    }

    if (valorBruto <= 0) {
      setErro('O valor bruto deve ser maior que zero.');
      return;
    }

    setSalvando(true);
    try {
      await api.post('/cobrancas', {
        contratoId: form.contratoId,
        mesReferencia: mes,
        anoReferencia: parseInt(form.anoReferencia),
        valorBruto,
        dataVencimento: form.dataVencimento,
      });
      setSucesso('Cobrança cadastrada com sucesso!');
      setTimeout(() => router.push('/dashboard/cobrancas'), 1000);
    } catch {
      setErro('Erro ao cadastrar cobrança.');
    } finally {
      setSalvando(false);
    }
  }

  function formatBRL(value: number) {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Link href="/dashboard/cobrancas">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Voltar
          </Button>
        </Link>
        <h2 className="text-2xl font-bold text-gray-800">Nova Cobrança</h2>
      </div>

      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle className="text-base font-medium text-gray-600">
            Dados da cobrança
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <Label>Contrato *</Label>
              <Select onValueChange={(v: string | null) => handleContratoChange(v ?? '')}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um contrato" />
                </SelectTrigger>
                <SelectContent>
                  {contratos.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.numero} — {c.cooperado?.nomeCompleto ?? c.cooperadoId}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="mesReferencia">Mês Referência *</Label>
                <Input
                  id="mesReferencia"
                  type="number"
                  min="1"
                  max="12"
                  value={form.mesReferencia}
                  onChange={(e) => set('mesReferencia', e.target.value)}
                  placeholder="1–12"
                  required
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="anoReferencia">Ano Referência *</Label>
                <Input
                  id="anoReferencia"
                  type="number"
                  min="2000"
                  value={form.anoReferencia}
                  onChange={(e) => set('anoReferencia', e.target.value)}
                  placeholder="2025"
                  required
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="valorBruto">Valor Bruto (R$) *</Label>
              <Input
                id="valorBruto"
                type="number"
                step="0.01"
                min="0"
                value={form.valorBruto}
                onChange={(e) => set('valorBruto', e.target.value)}
                placeholder="0.00"
                required
              />
            </div>

            {form.contratoId && valorBruto > 0 && (
              <div className="rounded-md bg-gray-50 border p-3 space-y-1 text-sm text-gray-700">
                <div className="flex justify-between">
                  <span>Desconto ({percentualDesconto}%)</span>
                  <span className="font-medium text-red-600">− {formatBRL(valorDesconto)}</span>
                </div>
                <div className="flex justify-between font-semibold border-t pt-1 mt-1">
                  <span>Valor Líquido</span>
                  <span className="text-green-700">{formatBRL(valorLiquido)}</span>
                </div>
              </div>
            )}

            <div className="space-y-1">
              <Label htmlFor="dataVencimento">Data de Vencimento *</Label>
              <Input
                id="dataVencimento"
                type="date"
                value={form.dataVencimento}
                onChange={(e) => set('dataVencimento', e.target.value)}
                required
              />
            </div>

            {erro && <p className="text-sm text-red-600">{erro}</p>}
            {sucesso && <p className="text-sm text-green-600">{sucesso}</p>}

            <div className="flex gap-3 pt-2">
              <Button type="submit" disabled={salvando}>
                {salvando ? 'Salvando...' : 'Salvar'}
              </Button>
              <Link href="/dashboard/cobrancas">
                <Button type="button" variant="outline">
                  Cancelar
                </Button>
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
