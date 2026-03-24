'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';
import type { Cooperado, UC } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ArrowLeft } from 'lucide-react';
import { useTipoParceiro } from '@/hooks/useTipoParceiro';

const TIPOS = [
  { value: 'FALTA_ENERGIA', label: 'Falta de Energia' },
  { value: 'MEDICAO_INCORRETA', label: 'Medição Incorreta' },
  { value: 'PROBLEMA_FATURA', label: 'Problema na Fatura' },
  { value: 'SOLICITACAO', label: 'Solicitação' },
  { value: 'OUTROS', label: 'Outros' },
];

const PRIORIDADES = [
  { value: 'ALTA', label: 'Alta' },
  { value: 'MEDIA', label: 'Média' },
  { value: 'BAIXA', label: 'Baixa' },
];

export default function NovaOcorrenciaPage() {
  const { tipoMembro } = useTipoParceiro();
  const router = useRouter();

  const [form, setForm] = useState({
    cooperadoId: '',
    ucId: '',
    tipo: '',
    prioridade: '',
    descricao: '',
  });
  const [cooperados, setCooperados] = useState<Cooperado[]>([]);
  const [ucs, setUcs] = useState<UC[]>([]);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');

  useEffect(() => {
    api.get<Cooperado[]>('/cooperados').then((r) => setCooperados(r.data));
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

    if (!form.cooperadoId || !form.tipo || !form.prioridade || !form.descricao.trim()) {
      setErro(`${tipoMembro}, tipo, prioridade e descrição são obrigatórios.`);
      return;
    }

    setSalvando(true);
    try {
      await api.post('/ocorrencias', {
        cooperadoId: form.cooperadoId,
        ucId: form.ucId || null,
        tipo: form.tipo,
        prioridade: form.prioridade,
        descricao: form.descricao,
      });
      setSucesso('Ocorrência cadastrada com sucesso!');
      setTimeout(() => router.push('/dashboard/ocorrencias'), 1000);
    } catch {
      setErro('Erro ao cadastrar ocorrência.');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Link href="/dashboard/ocorrencias">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Voltar
          </Button>
        </Link>
        <h2 className="text-2xl font-bold text-gray-800">Nova Ocorrência</h2>
      </div>

      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle className="text-base font-medium text-gray-600">
            Dados da ocorrência
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <Label>{tipoMembro} *</Label>
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
              <Label>UC</Label>
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
                          : 'Selecione uma UC (opcional)'
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

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Tipo *</Label>
                <Select onValueChange={(v: string | null) => set('tipo', v ?? '')}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {TIPOS.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Prioridade *</Label>
                <Select onValueChange={(v: string | null) => set('prioridade', v ?? '')}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {PRIORIDADES.map((p) => (
                      <SelectItem key={p.value} value={p.value}>
                        {p.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="descricao">Descrição *</Label>
              <Textarea
                id="descricao"
                value={form.descricao}
                onChange={(e) => set('descricao', e.target.value)}
                placeholder="Descreva a ocorrência..."
                rows={4}
                required
              />
            </div>

            {erro && <p className="text-sm text-red-600">{erro}</p>}
            {sucesso && <p className="text-sm text-green-600">{sucesso}</p>}

            <div className="flex gap-3 pt-2">
              <Button type="submit" disabled={salvando}>
                {salvando ? 'Salvando...' : 'Salvar'}
              </Button>
              <Link href="/dashboard/ocorrencias">
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
