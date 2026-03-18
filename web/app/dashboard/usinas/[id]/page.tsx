'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import api from '@/lib/api';
import type { Usina } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Pencil } from 'lucide-react';

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

export default function UsinaDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [usina, setUsina] = useState<Usina | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [modoEdicao, setModoEdicao] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState('');
  const [form, setForm] = useState({
    nome: '',
    potenciaKwp: '',
    capacidadeKwh: '',
    cidade: '',
    estado: '',
  });

  useEffect(() => {
    api.get<Usina>(`/usinas/${id}`)
      .then((r) => {
        setUsina(r.data);
        setForm({
          nome: r.data.nome,
          potenciaKwp: String(r.data.potenciaKwp),
          capacidadeKwh: r.data.capacidadeKwh ? String(r.data.capacidadeKwh) : '',
          cidade: r.data.cidade,
          estado: r.data.estado,
        });
      })
      .catch(() => setErro('Usina não encontrada.'))
      .finally(() => setCarregando(false));
  }, [id]);

  function iniciarEdicao() {
    if (!usina) return;
    setForm({
      nome: usina.nome,
      potenciaKwp: String(usina.potenciaKwp),
      capacidadeKwh: usina.capacidadeKwh ? String(usina.capacidadeKwh) : '',
      cidade: usina.cidade,
      estado: usina.estado,
    });
    setMensagem('');
    setModoEdicao(true);
  }

  function cancelar() {
    setModoEdicao(false);
    setMensagem('');
  }

  async function salvar() {
    setSalvando(true);
    setMensagem('');
    try {
      const { data } = await api.put<Usina>(`/usinas/${id}`, {
        ...form,
        potenciaKwp: parseFloat(form.potenciaKwp),
        capacidadeKwh: form.capacidadeKwh ? parseFloat(form.capacidadeKwh) : null,
      });
      setUsina(data);
      setModoEdicao(false);
      setMensagem('Salvo com sucesso!');
    } catch {
      setMensagem('Erro ao salvar. Tente novamente.');
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
        <h2 className="text-2xl font-bold text-gray-800">Detalhe da Usina</h2>
        {usina && !modoEdicao && (
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

      {usina && !modoEdicao && (
        <Card>
          <CardHeader>
            <CardTitle>{usina.nome}</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-6">
            <Campo label="ID" value={usina.id} />
            <Campo label="Nome" value={usina.nome} />
            <Campo label="Potência (kWp)" value={Number(usina.potenciaKwp).toFixed(2)} />
            <Campo label="Capacidade (kWh/mês)" value={usina.capacidadeKwh ? Number(usina.capacidadeKwh).toFixed(2) : '—'} />
            <Campo label="Cidade" value={usina.cidade} />
            <Campo label="Estado" value={usina.estado} />
            <Campo label="Criado em" value={new Date(usina.createdAt).toLocaleString('pt-BR')} />
            <Campo label="Atualizado em" value={new Date(usina.updatedAt).toLocaleString('pt-BR')} />
          </CardContent>
        </Card>
      )}

      {usina && modoEdicao && (
        <Card>
          <CardHeader>
            <CardTitle>Editar Usina</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-6">
            <div>
              <label className={labelClass}>Nome</label>
              <input
                className={inputClass}
                value={form.nome}
                onChange={(e) => setForm({ ...form, nome: e.target.value })}
              />
            </div>
            <div>
              <label className={labelClass}>Potência (kWp)</label>
              <input
                className={inputClass}
                type="number"
                step="0.01"
                value={form.potenciaKwp}
                onChange={(e) => setForm({ ...form, potenciaKwp: e.target.value })}
              />
            </div>
            <div>
              <label className={labelClass}>Capacidade (kWh/mês)</label>
              <input
                className={inputClass}
                type="number"
                step="0.01"
                value={form.capacidadeKwh}
                onChange={(e) => setForm({ ...form, capacidadeKwh: e.target.value })}
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
