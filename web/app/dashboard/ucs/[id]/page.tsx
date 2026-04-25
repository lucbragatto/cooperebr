'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import api from '@/lib/api';
import type { UC } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Pencil } from 'lucide-react';
import Link from 'next/link';
import { useTipoParceiro } from '@/hooks/useTipoParceiro';

const DISTRIBUIDORAS = [
  { value: 'EDP_ES', label: 'EDP ES' },
  { value: 'EDP_SP', label: 'EDP SP' },
  { value: 'CEMIG', label: 'CEMIG' },
  { value: 'ENEL_SP', label: 'Enel SP' },
  { value: 'LIGHT_RJ', label: 'Light RJ' },
  { value: 'CELESC', label: 'Celesc' },
  { value: 'OUTRAS', label: 'Outras' },
] as const;

const DISTRIBUIDORA_LABEL: Record<string, string> = Object.fromEntries(
  DISTRIBUIDORAS.map((d) => [d.value, d.label]),
);

function Campo({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-gray-500 mb-0.5">{label}</p>
      <p className="text-sm font-medium text-gray-800">{value ?? '—'}</p>
    </div>
  );
}

const inputClass =
  'w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-green-500';
const labelClass = 'text-xs text-gray-500 mb-0.5 block';

export default function UCDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { tipoMembro } = useTipoParceiro();
  const [uc, setUc] = useState<UC | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [modoEdicao, setModoEdicao] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState('');
  const [form, setForm] = useState({
    numero: '',
    numeroUC: '',
    numeroConcessionariaOriginal: '',
    distribuidora: 'OUTRAS',
    endereco: '',
    cidade: '',
    estado: '',
  });

  useEffect(() => {
    api.get<UC>(`/ucs/${id}`)
      .then((r) => {
        setUc(r.data);
        setForm({
          numero: r.data.numero,
          numeroUC: (r.data as any).numeroUC ?? '',
          numeroConcessionariaOriginal: (r.data as any).numeroConcessionariaOriginal ?? '',
          distribuidora: (r.data as any).distribuidora ?? 'OUTRAS',
          endereco: r.data.endereco,
          cidade: r.data.cidade,
          estado: r.data.estado,
        });
      })
      .catch(() => setErro('UC não encontrada.'))
      .finally(() => setCarregando(false));
  }, [id]);

  function iniciarEdicao() {
    if (!uc) return;
    setForm({
      numero: uc.numero,
      numeroUC: (uc as any).numeroUC ?? '',
      numeroConcessionariaOriginal: (uc as any).numeroConcessionariaOriginal ?? '',
      distribuidora: (uc as any).distribuidora ?? 'OUTRAS',
      endereco: uc.endereco,
      cidade: uc.cidade,
      estado: uc.estado,
    });
    setMensagem('');
    setModoEdicao(true);
  }

  function cancelar() {
    setModoEdicao(false);
    setMensagem('');
  }

  async function salvar() {
    if (form.numero.replace(/\D/g, '').length > 10) {
      setMensagem('Erro: número canônico deve ter até 10 dígitos.');
      return;
    }
    if (form.numeroUC && form.numeroUC.replace(/\D/g, '').length > 9) {
      setMensagem('Erro: número legado (numeroUC) deve ter até 9 dígitos.');
      return;
    }
    if (form.numeroConcessionariaOriginal.length > 50) {
      setMensagem('Erro: número original na fatura deve ter até 50 caracteres.');
      return;
    }
    setSalvando(true);
    setMensagem('');
    try {
      const { data } = await api.put<UC>(`/ucs/${id}`, form);
      setUc(data);
      setModoEdicao(false);
      setMensagem('Salvo com sucesso!');
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Erro ao salvar. Tente novamente.';
      setMensagem(`Erro: ${typeof msg === 'string' ? msg : JSON.stringify(msg)}`);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div>
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar
        </Button>
        <h2 className="text-2xl font-bold text-gray-800">Detalhe da UC</h2>
        {uc && !modoEdicao && (
          <Button size="sm" variant="outline" onClick={iniciarEdicao} className="ml-auto">
            <Pencil className="h-4 w-4 mr-2" />
            Editar
          </Button>
        )}
      </div>

      {carregando && <p className="text-gray-500">Carregando...</p>}
      {erro && <p className="text-red-500">{erro}</p>}
      {mensagem && (
        <p className={`mb-4 text-sm ${mensagem.startsWith('Erro') ? 'text-red-500' : 'text-green-600'}`}>
          {mensagem}
        </p>
      )}

      {uc && !modoEdicao && (
        <Card>
          <CardHeader>
            <CardTitle>UC {uc.numero}</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-6">
            <Campo label="ID" value={uc.id} />
            <Campo label="Número canônico" value={uc.numero} />
            <Campo label="Número legado (numeroUC)" value={(uc as any).numeroUC || '—'} />
            <Campo label="Número original na fatura" value={(uc as any).numeroConcessionariaOriginal || '—'} />
            <Campo label="Distribuidora" value={DISTRIBUIDORA_LABEL[(uc as any).distribuidora] ?? (uc as any).distribuidora ?? '—'} />
            <Campo label="Endereço" value={uc.endereco} />
            <Campo label="Cidade" value={uc.cidade} />
            <Campo label="Estado" value={uc.estado} />
            <Campo label={tipoMembro} value={uc.cooperado ? <Link href={`/dashboard/cooperados/${uc.cooperadoId}`} className="text-blue-600 hover:underline font-medium">{uc.cooperado.nomeCompleto}</Link> : '—'} />
            <Campo label={`ID do ${tipoMembro}`} value={uc.cooperadoId} />
            <Campo label="Criado em" value={new Date(uc.createdAt).toLocaleString('pt-BR')} />
            <Campo label="Atualizado em" value={new Date(uc.updatedAt).toLocaleString('pt-BR')} />
          </CardContent>
        </Card>
      )}

      {uc && modoEdicao && (
        <Card>
          <CardHeader>
            <CardTitle>Editar UC</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-6">
            <div>
              <label className={labelClass}>Número canônico (até 10 dígitos)</label>
              <input
                className={inputClass}
                value={form.numero}
                onChange={(e) => setForm({ ...form, numero: e.target.value })}
              />
            </div>
            <div>
              <label className={labelClass}>Número legado / numeroUC (até 9 dígitos)</label>
              <input
                className={inputClass}
                value={form.numeroUC}
                onChange={(e) => setForm({ ...form, numeroUC: e.target.value })}
                placeholder="160085263"
              />
            </div>
            <div>
              <label className={labelClass}>Número original na fatura (até 50 chars, formato preservado)</label>
              <input
                className={inputClass}
                value={form.numeroConcessionariaOriginal}
                onChange={(e) => setForm({ ...form, numeroConcessionariaOriginal: e.target.value })}
                placeholder="0.000.512.828.054-91"
                maxLength={50}
              />
            </div>
            <div>
              <label className={labelClass}>Distribuidora *</label>
              <select
                className={inputClass}
                value={form.distribuidora}
                onChange={(e) => setForm({ ...form, distribuidora: e.target.value })}
              >
                {DISTRIBUIDORAS.map((d) => (
                  <option key={d.value} value={d.value}>{d.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Endereço</label>
              <input
                className={inputClass}
                value={form.endereco}
                onChange={(e) => setForm({ ...form, endereco: e.target.value })}
              />
            </div>
            <div>
              <label className={labelClass}>Cidade</label>
              <input
                className={inputClass}
                value={form.cidade}
                onChange={(e) => setForm({ ...form, cidade: e.target.value })}
              />
            </div>
            <div>
              <label className={labelClass}>Estado</label>
              <input
                className={inputClass}
                value={form.estado}
                onChange={(e) => setForm({ ...form, estado: e.target.value })}
              />
            </div>
            <div className="col-span-2 flex gap-3 mt-2">
              <Button onClick={salvar} disabled={salvando}>
                {salvando ? 'Salvando...' : 'Salvar'}
              </Button>
              <Button variant="outline" onClick={cancelar} disabled={salvando}>
                Cancelar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
