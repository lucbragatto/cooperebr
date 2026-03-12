'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';
import type { Cooperado, UC, Usina } from '@/types';
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

export default function NovoContratoPage() {
  const router = useRouter();

  const [form, setForm] = useState({
    cooperadoId: '',
    ucId: '',
    usinaId: '',
    percentualDesconto: '',
    dataInicio: '',
    dataFim: '',
  });
  const [cooperados, setCooperados] = useState<Cooperado[]>([]);
  const [ucs, setUcs] = useState<UC[]>([]);
  const [usinas, setUsinas] = useState<Usina[]>([]);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');

  useEffect(() => {
    api.get<Cooperado[]>('/cooperados').then((r) => setCooperados(r.data));
    api.get<Usina[]>('/usinas').then((r) => setUsinas(r.data));
  }, []);

  function set(field: keyof typeof form, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function handleCooperadoChange(cooperadoId: string) {
    set('cooperadoId', cooperadoId);
    set('ucId', '');
    setUcs([]);
    if (cooperadoId) {
      api.get<UC[]>(`/ucs/cooperado/${cooperadoId}`).then((r) => setUcs(r.data));
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro('');
    setSucesso('');

    if (!form.cooperadoId || !form.ucId || !form.usinaId ||
        !form.percentualDesconto || !form.dataInicio) {
      setErro('Todos os campos obrigatórios devem ser preenchidos.');
      return;
    }

    const desconto = parseFloat(form.percentualDesconto);
    if (isNaN(desconto) || desconto < 0 || desconto > 100) {
      setErro('O percentual de desconto deve ser entre 0 e 100.');
      return;
    }

    setSalvando(true);
    try {
      await api.post('/contratos', {
        cooperadoId: form.cooperadoId,
        ucId: form.ucId,
        usinaId: form.usinaId,
        percentualDesconto: desconto,
        dataInicio: form.dataInicio,
        dataFim: form.dataFim || null,
      });
      setSucesso('Contrato cadastrado com sucesso!');
      setTimeout(() => router.push('/dashboard/contratos'), 1000);
    } catch {
      setErro('Erro ao cadastrar contrato.');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Link href="/dashboard/contratos">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Voltar
          </Button>
        </Link>
        <h2 className="text-2xl font-bold text-gray-800">Novo Contrato</h2>
      </div>

      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle className="text-base font-medium text-gray-600">
            Dados do contrato
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <Label>Cooperado *</Label>
              <Select onValueChange={(v: string | null) => handleCooperadoChange(v ?? '')}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um cooperado" />
                </SelectTrigger>
                <SelectContent>
                  {cooperados.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nomeCompleto} — {c.cpf}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label>UC *</Label>
              <Select
                onValueChange={(v: string | null) => set('ucId', v ?? '')}
                disabled={!form.cooperadoId}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      form.cooperadoId
                        ? ucs.length === 0
                          ? 'Nenhuma UC encontrada'
                          : 'Selecione uma UC'
                        : 'Selecione um cooperado primeiro'
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {ucs.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.numero} — {u.endereco}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label>Usina *</Label>
              <Select onValueChange={(v: string | null) => set('usinaId', v ?? '')}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma usina" />
                </SelectTrigger>
                <SelectContent>
                  {usinas.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.nome} — {u.potenciaKwp.toFixed(2)} kWp
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label htmlFor="percentualDesconto">Percentual de Desconto (%) *</Label>
              <Input
                id="percentualDesconto"
                type="number"
                step="0.01"
                min="0"
                max="100"
                value={form.percentualDesconto}
                onChange={(e) => set('percentualDesconto', e.target.value)}
                placeholder="10.00"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="dataInicio">Data de Início *</Label>
                <Input
                  id="dataInicio"
                  type="date"
                  value={form.dataInicio}
                  onChange={(e) => set('dataInicio', e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="dataFim">Data de Fim</Label>
                <Input
                  id="dataFim"
                  type="date"
                  value={form.dataFim}
                  onChange={(e) => set('dataFim', e.target.value)}
                />
              </div>
            </div>

            {erro && <p className="text-sm text-red-600">{erro}</p>}
            {sucesso && <p className="text-sm text-green-600">{sucesso}</p>}

            <div className="flex gap-3 pt-2">
              <Button type="submit" disabled={salvando}>
                {salvando ? 'Salvando...' : 'Salvar'}
              </Button>
              <Link href="/dashboard/contratos">
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
