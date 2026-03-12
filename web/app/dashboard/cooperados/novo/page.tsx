'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';
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

export default function NovoCooperadoPage() {
  const router = useRouter();

  const [form, setForm] = useState({
    nomeCompleto: '',
    email: '',
    cpf: '',
    telefone: '',
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

    if (!form.nomeCompleto.trim() || !form.email.trim()) {
      setErro('Nome completo e email são obrigatórios.');
      return;
    }

    setSalvando(true);
    try {
      await api.post('/cooperados', {
        nomeCompleto: form.nomeCompleto,
        email: form.email,
        cpf: form.cpf || undefined,
        telefone: form.telefone || undefined,
      });
      setSucesso('Cooperado cadastrado com sucesso!');
      setTimeout(() => router.push('/dashboard/cooperados'), 1000);
    } catch {
      const msg = 'Erro ao cadastrar cooperado.';
      setErro(msg);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Link href="/dashboard/cooperados">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Voltar
          </Button>
        </Link>
        <h2 className="text-2xl font-bold text-gray-800">Novo Cooperado</h2>
      </div>

      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle className="text-base font-medium text-gray-600">
            Dados do cooperado
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="nomeCompleto">Nome completo *</Label>
              <Input
                id="nomeCompleto"
                value={form.nomeCompleto}
                onChange={(e) => set('nomeCompleto', e.target.value)}
                placeholder="João da Silva"
                required
                autoFocus
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                value={form.email}
                onChange={(e) => set('email', e.target.value)}
                placeholder="joao@email.com"
                required
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="cpf">CPF</Label>
              <Input
                id="cpf"
                value={form.cpf}
                onChange={(e) => set('cpf', e.target.value)}
                placeholder="000.000.000-00"
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="telefone">Telefone</Label>
              <Input
                id="telefone"
                value={form.telefone}
                onChange={(e) => set('telefone', e.target.value)}
                placeholder="(00) 00000-0000"
              />
            </div>

            {erro && <p className="text-sm text-red-600">{erro}</p>}
            {sucesso && <p className="text-sm text-green-600">{sucesso}</p>}

            <div className="flex gap-3 pt-2">
              <Button type="submit" disabled={salvando}>
                {salvando ? 'Salvando...' : 'Salvar'}
              </Button>
              <Link href="/dashboard/cooperados">
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
