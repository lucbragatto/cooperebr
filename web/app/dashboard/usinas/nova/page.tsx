'use client';

/**
 * /dashboard/usinas/nova — cadastro de nova usina.
 *
 * F.7b (M36, 28/05/2026): página refatorada pra usar UsinaForm compartilhado
 * (Padrão UX Dual 17/05 Tipo B). Componente vive em web/components/usinas/UsinaForm.tsx.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import {
  UsinaForm,
  VALORES_INICIAIS,
  montarPayloadUsina,
  type UsinaFormData,
} from '@/components/usinas/UsinaForm';

export default function NovaUsinaPage() {
  const router = useRouter();
  const [form, setForm] = useState<UsinaFormData>({ ...VALORES_INICIAIS });
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro('');
    setSucesso('');

    const { payload, erro: erroValidacao } = montarPayloadUsina(form);
    if (erroValidacao) {
      setErro(erroValidacao);
      return;
    }

    setSalvando(true);
    try {
      await api.post('/usinas', payload);
      setSucesso('Usina cadastrada com sucesso!');
      setTimeout(() => router.push('/dashboard/usinas'), 1000);
    } catch (e: any) {
      const msg = e?.response?.data?.message ?? 'Erro ao cadastrar usina.';
      setErro(typeof msg === 'string' ? msg : JSON.stringify(msg));
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

      <UsinaForm
        modo="criar"
        form={form}
        setForm={setForm}
        onSubmit={handleSubmit}
        onCancelar={() => router.push('/dashboard/usinas')}
        salvando={salvando}
        erro={erro}
        sucesso={sucesso}
      />
    </div>
  );
}
