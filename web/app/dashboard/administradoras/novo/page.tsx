'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function NovaAdministradoraPage() {
  const router = useRouter();
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [form, setForm] = useState({
    razaoSocial: '',
    nomeFantasia: '',
    cnpj: '',
    email: '',
    telefone: '',
    responsavelNome: '',
    responsavelCpf: '',
    responsavelEmail: '',
    responsavelTelefone: '',
  });

  function setField(field: string, value: string) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  async function salvar() {
    if (!form.razaoSocial || !form.cnpj || !form.email || !form.telefone || !form.responsavelNome) {
      setErro('Preencha os campos obrigatorios.');
      return;
    }
    setSalvando(true);
    setErro('');
    try {
      await api.post('/administradoras', form);
      router.push('/dashboard/administradoras');
    } catch (err: any) {
      setErro(err?.response?.data?.message || 'Erro ao criar administradora');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Link href="/dashboard/administradoras">
          <Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4" /></Button>
        </Link>
        <h2 className="text-2xl font-bold text-gray-800">Nova Administradora</h2>
      </div>

      {erro && <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{erro}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-base">Dados da Empresa</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div>
              <label className="text-sm font-medium text-gray-700">Razao Social *</label>
              <Input value={form.razaoSocial} onChange={e => setField('razaoSocial', e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Nome Fantasia</label>
              <Input value={form.nomeFantasia} onChange={e => setField('nomeFantasia', e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">CNPJ *</label>
              <Input value={form.cnpj} onChange={e => setField('cnpj', e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Email *</label>
              <Input type="email" value={form.email} onChange={e => setField('email', e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Telefone *</label>
              <Input value={form.telefone} onChange={e => setField('telefone', e.target.value)} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Responsavel</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div>
              <label className="text-sm font-medium text-gray-700">Nome *</label>
              <Input value={form.responsavelNome} onChange={e => setField('responsavelNome', e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">CPF</label>
              <Input value={form.responsavelCpf} onChange={e => setField('responsavelCpf', e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Email</label>
              <Input type="email" value={form.responsavelEmail} onChange={e => setField('responsavelEmail', e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Telefone</label>
              <Input value={form.responsavelTelefone} onChange={e => setField('responsavelTelefone', e.target.value)} />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 flex justify-end">
        <Button onClick={salvar} disabled={salvando}>{salvando ? 'Salvando...' : 'Criar Administradora'}</Button>
      </div>
    </div>
  );
}
