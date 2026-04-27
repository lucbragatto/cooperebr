'use client';

import { useEffect, useMemo, useState } from 'react';
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
  const [modoClube, setModoClube] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');

  useEffect(() => {
    api.get<Contrato[]>('/contratos').then((r) => setContratos(r.data));
  }, []);

  const contratosVisiveis = useMemo(() => {
    return contratos
      .filter((c) => c.status === 'ATIVO')
      .filter((c) => !c.cooperado || c.cooperado.status === 'ATIVO')
      .sort((a, b) => {
        const na = a.cooperado?.nomeCompleto ?? '';
        const nb = b.cooperado?.nomeCompleto ?? '';
        return na.localeCompare(nb, 'pt-BR');
      });
  }, [contratos]);

  function set(field: keyof typeof form, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function handleContratoChange(contratoId: string) {
    set('contratoId', contratoId);
    const contrato = contratos.find((c) => c.id === contratoId);
    setPercentualDesconto(contrato?.percentualDesconto ?? 0);
    setModoClube(contrato?.cooperado?.modoRemuneracao === 'CLUBE');
  }

  const valorBruto = parseFloat(form.valorBruto) || 0;
  const valorDesconto = Math.round(valorBruto * percentualDesconto) / 100;
  // Espec Clube: cooperado em modo CLUBE paga cheio + recebe tokens equivalentes ao desconto
  const valorLiquido = modoClube ? valorBruto : valorBruto - valorDesconto;
  const valorTokenReais = 0.20; // mesmo default do PDF (TODO: ler do plano via API)
  const tokensEstimados = modoClube && valorDesconto > 0
    ? Math.round((valorDesconto / valorTokenReais) * 100) / 100
    : 0;

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
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecione um contrato" />
                </SelectTrigger>
                <SelectContent className="z-[100] bg-white min-w-[420px] max-h-[320px] overflow-y-auto shadow-lg border border-gray-200">
                  {contratosVisiveis.map((c) => {
                    const nome = c.cooperado?.nomeCompleto ?? '(sem cooperado)';
                    const ehClube = c.cooperado?.modoRemuneracao === 'CLUBE';
                    return (
                      <SelectItem key={c.id} value={c.id} className="bg-white hover:bg-gray-100">
                        <span>
                          {nome} — {c.numero}
                          {ehClube && (
                            <span className="ml-2 inline-block rounded bg-blue-100 px-1.5 py-0.5 text-xs font-medium text-blue-700">
                              CLUBE
                            </span>
                          )}
                        </span>
                      </SelectItem>
                    );
                  })}
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
                {modoClube ? (
                  <>
                    <div className="flex justify-between">
                      <span>Modo CLUBE — paga cheio</span>
                      <span className="font-medium text-blue-700">{formatBRL(valorBruto)}</span>
                    </div>
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>Desconto não aplicado (vira tokens)</span>
                      <span>R$ {valorDesconto.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between font-semibold border-t pt-1 mt-1">
                      <span>Valor a cobrar</span>
                      <span className="text-green-700">{formatBRL(valorLiquido)}</span>
                    </div>
                    <div className="flex justify-between text-xs text-blue-600 mt-1">
                      <span>🪙 Tokens a emitir após pagamento</span>
                      <span>~{tokensEstimados}</span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex justify-between">
                      <span>Desconto ({percentualDesconto}%)</span>
                      <span className="font-medium text-red-600">− {formatBRL(valorDesconto)}</span>
                    </div>
                    <div className="flex justify-between font-semibold border-t pt-1 mt-1">
                      <span>Valor Líquido</span>
                      <span className="text-green-700">{formatBRL(valorLiquido)}</span>
                    </div>
                  </>
                )}
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
