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

export default function NovaCooperativaPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    nome: '', cnpj: '', telefone: '', email: '',
    endereco: '', numero: '', bairro: '', cidade: '', estado: '', cep: '',
  });
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');

  function set(field: keyof typeof form, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro(''); setSucesso('');

    if (!form.nome.trim() || !form.cnpj.trim()) {
      setErro('Nome e CNPJ são obrigatórios.');
      return;
    }

    setSalvando(true);
    try {
      await api.post('/cooperativas', form);
      setSucesso('Cooperativa cadastrada com sucesso!');
      setTimeout(() => router.push('/dashboard/cooperativas'), 1000);
    } catch (e: any) {
      setErro(e?.response?.data?.message || 'Erro ao cadastrar cooperativa.');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Link href="/dashboard/cooperativas">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Voltar
          </Button>
        </Link>
        <h2 className="text-2xl font-bold text-gray-800">Nova Cooperativa</h2>
      </div>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle className="text-base font-medium text-gray-600">Dados da cooperativa</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Nome *</Label>
                <Input value={form.nome} onChange={(e) => set('nome', e.target.value)} placeholder="CoopereBR" required />
              </div>
              <div className="space-y-1">
                <Label>CNPJ *</Label>
                <Input value={form.cnpj} onChange={(e) => set('cnpj', e.target.value)} placeholder="00.000.000/0001-00" required />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Telefone</Label>
                <Input value={form.telefone} onChange={(e) => set('telefone', e.target.value)} placeholder="(27) 99999-0000" />
              </div>
              <div className="space-y-1">
                <Label>Email</Label>
                <Input value={form.email} onChange={(e) => set('email', e.target.value)} placeholder="contato@cooperebr.com.br" type="email" />
              </div>
            </div>

            <hr className="my-2" />
            <p className="text-sm font-medium text-gray-600">Endereço</p>

            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2 space-y-1">
                <Label>Rua</Label>
                <Input value={form.endereco} onChange={(e) => set('endereco', e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Número</Label>
                <Input value={form.numero} onChange={(e) => set('numero', e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label>Bairro</Label>
                <Input value={form.bairro} onChange={(e) => set('bairro', e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Cidade</Label>
                <Input value={form.cidade} onChange={(e) => set('cidade', e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Estado</Label>
                <Input value={form.estado} onChange={(e) => set('estado', e.target.value)} maxLength={2} placeholder="ES" />
              </div>
            </div>
            <div className="w-1/3 space-y-1">
              <Label>CEP</Label>
              <Input value={form.cep} onChange={(e) => set('cep', e.target.value)} placeholder="29000-000" />
            </div>

            {erro && <p className="text-sm text-red-600">{erro}</p>}
            {sucesso && <p className="text-sm text-green-600">{sucesso}</p>}

            <div className="flex gap-3 pt-2">
              <Button type="submit" disabled={salvando}>{salvando ? 'Salvando...' : 'Salvar'}</Button>
              <Link href="/dashboard/cooperativas">
                <Button type="button" variant="outline">Cancelar</Button>
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
