'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Loader2, ArrowLeft, Save, Info, Sun, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import api from '@/lib/api';

const STATUS_OPERACIONAL_OPCOES = [
  { value: 'OPERANDO', label: 'Operando (normal)' },
  { value: 'MANUTENCAO_PLANEJADA', label: 'Manutenção planejada' },
  { value: 'MANUTENCAO_EMERGENCIAL', label: 'Manutenção emergencial' },
  { value: 'DESLIGADA', label: 'Desligada (permanente)' },
  { value: 'OFFLINE', label: 'Offline (sem comunicação)' },
];

const CATEGORIAS_DESPESA = [
  'CUSD',
  'MANUTENCAO_PREVENTIVA',
  'MANUTENCAO_CORRETIVA',
  'ROCADA',
  'VIGILANCIA',
  'SEGURO',
  'IPTU_ITR',
  'CONSUMO_AUXILIAR',
  'INTERNET',
  'ACOMPANHAMENTO_TECNICO',
  'EQUIPAMENTOS',
  'ARRENDAMENTO_USINA',
  'MANUTENCAO',
  'SALARIO',
  'OUTRO',
];

const RESPONSAVEIS = [
  { value: '', label: '— (não definido)' },
  { value: 'PARCEIRO', label: 'Parceiro (cooperativa)' },
  { value: 'PROPRIETARIO', label: 'Proprietário (dono)' },
  { value: 'COMPARTILHADO', label: 'Compartilhado' },
];

export default function UsinaProprietarioConfigPage() {
  const params = useParams();
  const router = useRouter();
  const usinaId = params?.id as string;

  const [usina, setUsina] = useState<any>(null);
  const [statusOperacional, setStatusOperacional] = useState<string>('OPERANDO');
  const [valorKwhPadrao, setValorKwhPadrao] = useState<string>('');
  const [matriz, setMatriz] = useState<Record<string, string>>({});
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [msg, setMsg] = useState('');
  const [erro, setErro] = useState('');

  useEffect(() => {
    if (!usinaId) return;
    api
      .get(`/usinas/${usinaId}`)
      .then((r) => {
        const u = r.data;
        setUsina(u);
        setStatusOperacional(u.statusOperacional ?? 'OPERANDO');
        setValorKwhPadrao(u.valorKwhPadrao != null ? String(u.valorKwhPadrao) : '');
        setMatriz((u.responsabilidadeDespesas ?? {}) as Record<string, string>);
      })
      .catch(() => setErro('Falha ao carregar usina.'))
      .finally(() => setCarregando(false));
  }, [usinaId]);

  function setResponsavel(categoria: string, valor: string) {
    setMatriz((m) => {
      const novo = { ...m };
      if (!valor) delete novo[categoria];
      else novo[categoria] = valor;
      return novo;
    });
  }

  async function handleSalvar() {
    setSalvando(true);
    setMsg('');
    setErro('');
    try {
      const payload: any = {
        statusOperacional,
        responsabilidadeDespesas: matriz,
      };
      if (valorKwhPadrao.trim() !== '') {
        const n = Number(valorKwhPadrao.replace(',', '.'));
        if (Number.isNaN(n) || n <= 0) {
          setErro('valorKwhPadrao deve ser número > 0 (ex: 0,80).');
          setSalvando(false);
          return;
        }
        payload.valorKwhPadrao = n;
      } else {
        payload.valorKwhPadrao = null;
      }
      await api.put(`/usinas/${usinaId}`, payload);
      setMsg('Configuração salva com sucesso.');
    } catch (e: any) {
      setErro(e?.response?.data?.message ?? 'Falha ao salvar.');
    } finally {
      setSalvando(false);
    }
  }

  if (carregando) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-amber-600 animate-spin" />
      </div>
    );
  }

  if (erro && !usina) {
    return (
      <Card>
        <CardContent className="text-center py-12">
          <AlertTriangle className="w-12 h-12 text-red-400 mx-auto mb-3" />
          <p className="text-red-600 text-sm">{erro}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <Link href={`/dashboard/usinas/${usinaId}`} className="text-sm text-amber-600 hover:underline inline-flex items-center gap-1">
          <ArrowLeft className="w-3 h-3" /> Voltar pra usina
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 mt-2 flex items-center gap-2">
          <Sun className="w-6 h-6 text-amber-500" />
          Configuração Proprietário — {usina?.nome}
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Status operacional, override de tarifa pro cálculo de repasse e matriz de responsabilidade de despesas
        </p>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-md p-3 flex gap-2">
        <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
        <div className="text-sm text-blue-800">
          <strong>Como usar:</strong> esses campos alimentam o <Link href={`/proprietario/usinas/${usinaId}`} className="underline">Portal Proprietário</Link>.
          O status operacional aparece como badge colorido; valorKwhPadrao substitui a tarifa da distribuidora no cálculo PERCENTUAL;
          a matriz define quem paga cada categoria de despesa cadastrada em Contas a Pagar.
        </div>
      </div>

      {/* Status operacional */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Status Operacional</CardTitle>
        </CardHeader>
        <CardContent>
          <Label htmlFor="statusOp">Status atual</Label>
          <select
            id="statusOp"
            value={statusOperacional}
            onChange={(e) => setStatusOperacional(e.target.value)}
            className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
          >
            {STATUS_OPERACIONAL_OPCOES.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <p className="text-xs text-gray-500 mt-2">
            Cron Sungrow atualiza automaticamente (OPERANDO ↔ OFFLINE) quando credenciais habilitadas.
            Override manual aqui sempre prevalece até admin marcar OPERANDO de volta.
          </p>
        </CardContent>
      </Card>

      {/* valorKwhPadrao */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tarifa de Referência (R$/kWh)</CardTitle>
        </CardHeader>
        <CardContent>
          <Label htmlFor="valorKwh">valorKwhPadrao (override fórmula PERCENTUAL/HIBRIDO)</Label>
          <Input
            id="valorKwh"
            type="text"
            placeholder="Ex: 0,80 (vazio = usa TarifaConcessionaria por distribuidora)"
            value={valorKwhPadrao}
            onChange={(e) => setValorKwhPadrao(e.target.value)}
          />
          <p className="text-xs text-gray-500 mt-2">
            Se preenchido, o cálculo de repasse PERCENTUAL/HIBRIDO usa este valor.
            Se vazio, busca a TarifaConcessionaria vigente pra <strong>{usina?.distribuidora ?? '—'}</strong> (TUSD + TE).
          </p>
        </CardContent>
      </Card>

      {/* Matriz responsabilidade */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Matriz de Responsabilidade de Despesas</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-gray-500 mb-3">
            Defina quem paga cada categoria de despesa desta usina conforme contrato bilateral. Categorias
            sem responsável definido ficam visíveis só pro admin (não aparecem no portal do proprietário).
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {CATEGORIAS_DESPESA.map((cat) => (
              <div key={cat} className="flex items-center justify-between gap-2 p-2 border rounded-md">
                <span className="text-sm font-medium">{cat.replace(/_/g, ' ')}</span>
                <select
                  value={matriz[cat] ?? ''}
                  onChange={(e) => setResponsavel(cat, e.target.value)}
                  className="px-2 py-1 border rounded text-xs"
                >
                  {RESPONSAVEIS.map((r) => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Mensagens + botão salvar */}
      {msg && <p className="text-sm text-green-600 font-medium">{msg}</p>}
      {erro && <p className="text-sm text-red-600 font-medium">{erro}</p>}

      <div className="flex gap-3">
        <Button onClick={handleSalvar} disabled={salvando}>
          {salvando && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
          <Save className="w-4 h-4 mr-2" /> Salvar configuração
        </Button>
        <Button variant="outline" onClick={() => router.back()}>Cancelar</Button>
      </div>
    </div>
  );
}
