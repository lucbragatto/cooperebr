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

function Tooltip({ text }: { text: string }) {
  return (
    <span className="relative inline-flex items-center group ml-1">
      <span className="inline-flex items-center justify-center w-4 h-4 text-[10px] font-bold text-gray-500 bg-gray-200 rounded-full cursor-help group-hover:bg-gray-300">?</span>
      <span role="tooltip" className="pointer-events-none absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-72 px-3 py-2 rounded-md bg-gray-800 text-white text-xs leading-relaxed opacity-0 group-hover:opacity-100 transition-opacity z-50 shadow-lg">
        {text}
        <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-800" />
      </span>
    </span>
  );
}

export default function NovaUcPage() {
  const router = useRouter();
  const { tipoMembro } = useTipoParceiro();

  const [form, setForm] = useState({
    numero: '',
    numeroUC: '',
    numeroConcessionariaOriginal: '',
    distribuidora: '',
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

  function validarFormulario(): string | null {
    if (!form.numero.trim()) return 'Número canônico é obrigatório.';
    const digitosNumero = form.numero.replace(/\D/g, '');
    if (digitosNumero.length === 0 || digitosNumero.length > 10) {
      return 'Número canônico deve ter até 10 dígitos.';
    }
    if (form.numeroUC.trim()) {
      const digitosUC = form.numeroUC.replace(/\D/g, '');
      if (digitosUC.length === 0 || digitosUC.length > 9) {
        return 'Número legado (numeroUC) deve ter até 9 dígitos.';
      }
    }
    if (form.numeroConcessionariaOriginal.length > 50) {
      return 'Número original na fatura deve ter até 50 caracteres.';
    }
    if (!form.distribuidora) return 'Selecione a distribuidora.';
    if (!form.endereco.trim()) return 'Endereço é obrigatório.';
    if (!form.cidade.trim()) return 'Cidade é obrigatória.';
    if (!form.estado.trim()) return 'Estado é obrigatório.';
    if (!form.cooperadoId) return `${tipoMembro} é obrigatório.`;
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro('');
    setSucesso('');

    const erroValidacao = validarFormulario();
    if (erroValidacao) {
      setErro(erroValidacao);
      return;
    }

    setSalvando(true);
    try {
      await api.post('/ucs', form);
      setSucesso('UC cadastrada com sucesso!');
      setTimeout(() => router.push('/dashboard/ucs'), 1000);
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Erro ao cadastrar UC.';
      setErro(typeof msg === 'string' ? msg : JSON.stringify(msg));
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
              <Label htmlFor="numero" className="flex items-center gap-1">
                Número canônico (UC) *
                <Tooltip text="Número canônico SISGD com até 10 dígitos. Encontrado na parte superior da fatura. Único na cooperativa." />
              </Label>
              <Input
                id="numero"
                value={form.numero}
                onChange={(e) => set('numero', e.target.value)}
                placeholder="0400702214"
                required
                autoFocus
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="numeroUC" className="flex items-center gap-1">
                Número legado (numeroUC)
                <Tooltip text="Número legado de 9 dígitos da concessionária. Recomendado preencher — necessário para listas de compensação B2B enviadas à EDP." />
              </Label>
              <Input
                id="numeroUC"
                value={form.numeroUC}
                onChange={(e) => set('numeroUC', e.target.value)}
                placeholder="160085263"
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="numeroConcessionariaOriginal" className="flex items-center gap-1">
                Número original na fatura
                <Tooltip text="Número como aparece exatamente na fatura da concessionária. Ex: 0.000.512.828.054-91. Mantenha pontos e traços. Não normalize." />
              </Label>
              <Input
                id="numeroConcessionariaOriginal"
                value={form.numeroConcessionariaOriginal}
                onChange={(e) => set('numeroConcessionariaOriginal', e.target.value)}
                placeholder="0.000.512.828.054-91"
                maxLength={50}
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="distribuidora" className="flex items-center gap-1">
                Distribuidora *
                <Tooltip text="Concessionária que atende esta UC. Determina formato dos números e regras de match com faturas." />
              </Label>
              <Select value={form.distribuidora} onValueChange={(v: string | null) => set('distribuidora', v ?? '')}>
                <SelectTrigger id="distribuidora">
                  <SelectValue placeholder="Selecione a distribuidora" />
                </SelectTrigger>
                <SelectContent>
                  {DISTRIBUIDORAS.map((d) => (
                    <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
                  placeholder="Vitória"
                  required
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="estado">Estado *</Label>
                <Input
                  id="estado"
                  value={form.estado}
                  onChange={(e) => set('estado', e.target.value)}
                  placeholder="ES"
                  maxLength={2}
                  required
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label>{tipoMembro} *</Label>
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
