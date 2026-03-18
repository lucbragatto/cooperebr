'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft } from 'lucide-react';

export default function NovaUsinaPage() {
  const router = useRouter();

  const [form, setForm] = useState({
    nome: '',
    potenciaKwp: '',
    capacidadeKwh: '',
    cidade: '',
    estado: '',
  });
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');

  function set(field: keyof typeof form, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro('');
    setSucesso('');

    if (!form.nome.trim() || !form.potenciaKwp || !form.capacidadeKwh || !form.cidade.trim() || !form.estado.trim()) {
      setErro('Todos os campos são obrigatórios.');
      return;
    }

    const potencia = parseFloat(form.potenciaKwp);
    if (isNaN(potencia) || potencia <= 0) {
      setErro('Potência deve ser um número positivo.');
      return;
    }

    const capacidade = parseFloat(form.capacidadeKwh);
    if (isNaN(capacidade) || capacidade <= 0) {
      setErro('Capacidade deve ser um número positivo.');
      return;
    }

    setSalvando(true);
    try {
      await api.post('/usinas', {
        nome: form.nome,
        potenciaKwp: potencia,
        capacidadeKwh: capacidade,
        cidade: form.cidade,
        estado: form.estado,
      });
      setSucesso('Usina cadastrada com sucesso!');
      setTimeout(() => router.push('/dashboard/usinas'), 1000);
    } catch {
      const msg = 'Erro ao cadastrar usina.';
      setErro(msg);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Link href="/dashboard/usinas">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Voltar
          </Button>
        </Link>
        <h2 className="text-2xl font-bold text-gray-800">Nova Usina</h2>
      </div>

      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle className="text-base font-medium text-gray-600">
            Dados da usina
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="nome">Nome *</Label>
              <Input
                id="nome"
                value={form.nome}
                onChange={(e) => set('nome', e.target.value)}
                placeholder="Usina Solar Norte"
                required
                autoFocus
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="potenciaKwp">Potência instalada (kWp) *</Label>
              <Input
                id="potenciaKwp"
                type="number"
                step="0.01"
                min="0"
                value={form.potenciaKwp}
                onChange={(e) => set('potenciaKwp', e.target.value)}
                placeholder="250.00"
                required
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="capacidadeKwh">Capacidade total (kWh/mês) *</Label>
              <Input
                id="capacidadeKwh"
                type="number"
                step="0.01"
                min="0"
                value={form.capacidadeKwh}
                onChange={(e) => set('capacidadeKwh', e.target.value)}
                placeholder="5000.00"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="cidade">Cidade *</Label>
                <Input
                  id="cidade"
                  value={form.cidade}
                  onChange={(e) => set('cidade', e.target.value)}
                  placeholder="Fortaleza"
                  required
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="estado">Estado *</Label>
                <Input
                  id="estado"
                  value={form.estado}
                  onChange={(e) => set('estado', e.target.value)}
                  placeholder="CE"
                  maxLength={2}
                  required
                />
              </div>
            </div>

            {erro && <p className="text-sm text-red-600">{erro}</p>}
            {sucesso && <p className="text-sm text-green-600">{sucesso}</p>}

            <div className="flex gap-3 pt-2">
              <Button type="submit" disabled={salvando}>
                {salvando ? 'Salvando...' : 'Salvar'}
              </Button>
              <Link href="/dashboard/usinas">
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
