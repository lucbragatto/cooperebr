'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';
import type { Cooperado } from '@/types';
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

export default function NovaUcPage() {
  const router = useRouter();

  const [form, setForm] = useState({
    numero: '',
    endereco: '',
    cidade: '',
    estado: '',
    cooperadoId: '',
  });
  const [cooperados, setCooperados] = useState<Cooperado[]>([]);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');

  useEffect(() => {
    api.get<Cooperado[]>('/cooperados').then((r) => setCooperados(r.data));
  }, []);

  function set(field: keyof typeof form, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro('');
    setSucesso('');

    if (!form.numero.trim() || !form.endereco.trim() || !form.cidade.trim() ||
        !form.estado.trim() || !form.cooperadoId) {
      setErro('Todos os campos são obrigatórios.');
      return;
    }

    setSalvando(true);
    try {
      await api.post('/ucs', form);
      setSucesso('UC cadastrada com sucesso!');
      setTimeout(() => router.push('/dashboard/ucs'), 1000);
    } catch {
      const msg = 'Erro ao cadastrar UC.';
      setErro(msg);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Link href="/dashboard/ucs">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Voltar
          </Button>
        </Link>
        <h2 className="text-2xl font-bold text-gray-800">Nova UC</h2>
      </div>

      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle className="text-base font-medium text-gray-600">
            Dados da unidade consumidora
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="numero">Número da UC *</Label>
              <Input
                id="numero"
                value={form.numero}
                onChange={(e) => set('numero', e.target.value)}
                placeholder="3001234567"
                required
                autoFocus
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="endereco">Endereço *</Label>
              <Input
                id="endereco"
                value={form.endereco}
                onChange={(e) => set('endereco', e.target.value)}
                placeholder="Rua das Flores, 123"
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
                  placeholder="São Paulo"
                  required
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="estado">Estado *</Label>
                <Input
                  id="estado"
                  value={form.estado}
                  onChange={(e) => set('estado', e.target.value)}
                  placeholder="SP"
                  maxLength={2}
                  required
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label>Cooperado *</Label>
              <Select onValueChange={(v: string | null) => set('cooperadoId', v ?? '')}>
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

            {erro && <p className="text-sm text-red-600">{erro}</p>}
            {sucesso && <p className="text-sm text-green-600">{sucesso}</p>}

            <div className="flex gap-3 pt-2">
              <Button type="submit" disabled={salvando}>
                {salvando ? 'Salvando...' : 'Salvar'}
              </Button>
              <Link href="/dashboard/ucs">
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
