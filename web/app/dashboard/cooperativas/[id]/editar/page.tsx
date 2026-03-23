'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft } from 'lucide-react';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';

const TIPOS = [
  { valor: 'COOPERATIVA', label: '🏢 Cooperativa' },
  { valor: 'CONSORCIO', label: '🤝 Consórcio' },
  { valor: 'ASSOCIACAO', label: '🏛️ Associação' },
  { valor: 'CONDOMINIO', label: '🏘️ Condomínio' },
];

export default function EditarCooperativaPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [form, setForm] = useState({
    nome: '', cnpj: '', telefone: '', email: '',
    endereco: '', numero: '', bairro: '', cidade: '', estado: '', cep: '',
    tipoParceiro: 'COOPERATIVA',
  });
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');

  useEffect(() => {
    api.get(`/cooperativas/${id}`).then((r) => {
      const c = r.data as any;
      setForm({
        nome: c.nome || '', cnpj: c.cnpj || '', telefone: c.telefone || '', email: c.email || '',
        endereco: c.endereco || '', numero: c.numero || '', bairro: c.bairro || '',
        cidade: c.cidade || '', estado: c.estado || '', cep: c.cep || '',
        tipoParceiro: c.tipoParceiro || 'COOPERATIVA',
      });
    }).catch(() => setErro('Parceiro não encontrado.'))
      .finally(() => setCarregando(false));
  }, [id]);

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
      await api.put(`/cooperativas/${id}`, form);
      setSucesso('Parceiro atualizado com sucesso!');
      setTimeout(() => router.push(`/dashboard/cooperativas/${id}`), 1000);
    } catch (e: any) {
      setErro(e?.response?.data?.message || 'Erro ao atualizar.');
    } finally {
      setSalvando(false);
    }
  }

  if (carregando) return <p className="text-gray-500">Carregando...</p>;

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          Voltar
        </Button>
        <h2 className="text-2xl font-bold text-gray-800">Editar Parceiro</h2>
      </div>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle className="text-base font-medium text-gray-600">Dados do parceiro</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Nome *</Label>
                <Input value={form.nome} onChange={(e) => set('nome', e.target.value)} required />
              </div>
              <div className="space-y-1">
                <Label>CNPJ *</Label>
                <Input value={form.cnpj} onChange={(e) => set('cnpj', e.target.value)} required />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Tipo de organização</Label>
                <Select value={form.tipoParceiro} onValueChange={(v) => set('tipoParceiro', v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIPOS.map((t) => (
                      <SelectItem key={t.valor} value={t.valor}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Telefone</Label>
                <Input value={form.telefone} onChange={(e) => set('telefone', e.target.value)} />
              </div>
            </div>

            <div className="space-y-1">
              <Label>Email</Label>
              <Input value={form.email} onChange={(e) => set('email', e.target.value)} type="email" />
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
                <Input value={form.estado} onChange={(e) => set('estado', e.target.value)} maxLength={2} />
              </div>
            </div>
            <div className="w-1/3 space-y-1">
              <Label>CEP</Label>
              <Input value={form.cep} onChange={(e) => set('cep', e.target.value)} />
            </div>

            {erro && <p className="text-sm text-red-600">{erro}</p>}
            {sucesso && <p className="text-sm text-green-600">{sucesso}</p>}

            <div className="flex gap-3 pt-2">
              <Button type="submit" disabled={salvando}>{salvando ? 'Salvando...' : 'Salvar'}</Button>
              <Button type="button" variant="outline" onClick={() => router.back()}>Cancelar</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
