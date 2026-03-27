'use client';

import { useEffect, useState, useCallback } from 'react';
import api from '@/lib/api';
import { getUsuario } from '@/lib/auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Eye, EyeOff, Plus, X, Search, Clock } from 'lucide-react';

interface Observacao {
  id: string;
  observadoId: string | null;
  observadoTelefone: string | null;
  observadorTelefone: string;
  ativo: boolean;
  escopo: string;
  criadoEm: string;
  expiresAt: string | null;
  motivo: string | null;
  observador?: { id: string; nome: string; telefone: string };
}

interface CooperadoBusca {
  id: string;
  nomeCompleto: string;
  cpf: string;
  telefone: string | null;
  cooperativaId: string;
}

const ESCOPO_OPTIONS = [
  { value: 'WHATSAPP_ENVIADO', label: 'WhatsApp Enviado' },
  { value: 'WHATSAPP_RECEBIDO', label: 'WhatsApp Recebido' },
  { value: 'WHATSAPP_TOTAL', label: 'WhatsApp Total' },
  { value: 'ACOES_PLATAFORMA', label: 'Ações na Plataforma' },
  { value: 'TUDO', label: 'Tudo' },
];

const EXPIRACAO_OPTIONS = [
  { value: 1, label: '1 hora' },
  { value: 4, label: '4 horas' },
  { value: 24, label: '24 horas' },
  { value: 0, label: 'Sem expiração' },
];

function tempoRestante(expiresAt: string | null): string {
  if (!expiresAt) return 'Sem expiração';
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (diff <= 0) return 'Expirado';
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  return h > 0 ? `${h}h ${m}min` : `${m}min`;
}

export default function ObservadorPage() {
  const [observacoes, setObservacoes] = useState<Observacao[]>([]);
  const [historico, setHistorico] = useState<Observacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [tab, setTab] = useState<'ativas' | 'historico'>('ativas');

  // Modal state
  const [busca, setBusca] = useState('');
  const [resultados, setResultados] = useState<CooperadoBusca[]>([]);
  const [selecionado, setSelecionado] = useState<CooperadoBusca | null>(null);
  const [escopo, setEscopo] = useState('WHATSAPP_TOTAL');
  const [expiracao, setExpiracao] = useState(4);
  const [telefoneManual, setTelefoneManual] = useState('');
  const [motivo, setMotivo] = useState('');
  const [enviando, setEnviando] = useState(false);

  // Pre-filled from quick icon
  const [prefilledUser, setPrefilledUser] = useState<CooperadoBusca | null>(null);

  const carregar = useCallback(async () => {
    try {
      const [ativas, hist] = await Promise.all([
        api.get('/observador').then(r => r.data),
        api.get('/observador/historico').then(r => r.data),
      ]);
      setObservacoes(ativas);
      setHistorico(hist);
    } catch (err) {
      console.error('Erro ao carregar observações', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  // Auto-refresh every 30s
  useEffect(() => {
    const interval = setInterval(carregar, 30000);
    return () => clearInterval(interval);
  }, [carregar]);

  const buscarUsuarios = async (q: string) => {
    setBusca(q);
    if (q.length < 2) { setResultados([]); return; }
    try {
      const { data } = await api.get('/observador/buscar-usuarios', { params: { q } });
      setResultados(data);
    } catch { setResultados([]); }
  };

  const ativarObservacao = async () => {
    setEnviando(true);
    try {
      const user = getUsuario();
      const expiresAt = expiracao > 0
        ? new Date(Date.now() + expiracao * 3600000).toISOString()
        : undefined;

      await api.post('/observador', {
        observadoId: selecionado?.id || null,
        observadoTelefone: selecionado?.telefone?.replace(/\D/g, '') || telefoneManual.replace(/\D/g, ''),
        observadorTelefone: user?.telefone || '',
        escopo,
        expiresAt,
        motivo: motivo || undefined,
      });

      setShowModal(false);
      resetModal();
      carregar();
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Erro ao ativar observação');
    } finally {
      setEnviando(false);
    }
  };

  const encerrar = async (id: string) => {
    if (!confirm('Encerrar esta observação?')) return;
    try {
      await api.delete(`/observador/${id}`);
      carregar();
    } catch (err) {
      alert('Erro ao encerrar observação');
    }
  };

  const resetModal = () => {
    setBusca('');
    setResultados([]);
    setSelecionado(null);
    setEscopo('WHATSAPP_TOTAL');
    setExpiracao(4);
    setTelefoneManual('');
    setMotivo('');
    setPrefilledUser(null);
  };

  const abrirModal = (user?: CooperadoBusca) => {
    resetModal();
    if (user) {
      setSelecionado(user);
      setPrefilledUser(user);
    }
    setShowModal(true);
  };

  // Expose abrirModal globally for quick-icon usage
  useEffect(() => {
    (window as any).__observadorAbrirModal = abrirModal;
    return () => { delete (window as any).__observadorAbrirModal; };
  }, []);

  if (loading) return <div className="p-6">Carregando...</div>;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Eye className="h-6 w-6" /> Modo Observador
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Monitore conversas e ações em tempo real
          </p>
        </div>
        <Button onClick={() => abrirModal()} className="gap-2">
          <Plus className="h-4 w-4" /> Nova Observação
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        <Button
          variant={tab === 'ativas' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setTab('ativas')}
        >
          Ativas ({observacoes.length})
        </Button>
        <Button
          variant={tab === 'historico' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setTab('historico')}
        >
          Histórico 24h ({historico.length})
        </Button>
      </div>

      {/* Lista */}
      <div className="grid gap-3">
        {(tab === 'ativas' ? observacoes : historico).length === 0 && (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              {tab === 'ativas' ? 'Nenhuma observação ativa' : 'Nenhuma observação nas últimas 24h'}
            </CardContent>
          </Card>
        )}

        {(tab === 'ativas' ? observacoes : historico).map((obs) => (
          <Card key={obs.id} className={obs.ativo ? 'border-green-200' : 'border-gray-200'}>
            <CardContent className="py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${obs.ativo ? 'bg-green-500' : 'bg-gray-400'}`} />
                  <div>
                    <div className="font-medium">
                      {obs.observadoTelefone || obs.observadoId || 'Todos'}
                    </div>
                    <div className="text-sm text-muted-foreground flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        {ESCOPO_OPTIONS.find(e => e.value === obs.escopo)?.label || obs.escopo}
                      </Badge>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {tempoRestante(obs.expiresAt)}
                      </span>
                      {obs.observador && (
                        <span>por {obs.observador.nome}</span>
                      )}
                    </div>
                    {obs.motivo && (
                      <div className="text-xs text-muted-foreground mt-1">Motivo: {obs.motivo}</div>
                    )}
                  </div>
                </div>
                {obs.ativo && (
                  <Button variant="outline" size="sm" onClick={() => encerrar(obs.id)} className="gap-1">
                    <EyeOff className="h-4 w-4" /> Encerrar
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">Nova Observação</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-500 hover:text-gray-800">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Busca */}
            {!selecionado ? (
              <div>
                <label className="text-sm font-medium">Buscar por nome, CPF ou telefone</label>
                <div className="relative mt-1">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Digite para buscar..."
                    value={busca}
                    onChange={(e) => buscarUsuarios(e.target.value)}
                    className="pl-9"
                  />
                </div>
                {resultados.length > 0 && (
                  <div className="mt-2 border rounded max-h-40 overflow-y-auto">
                    {resultados.map((r) => (
                      <button
                        key={r.id}
                        className="w-full text-left px-3 py-2 hover:bg-gray-100 text-sm border-b last:border-0"
                        onClick={() => { setSelecionado(r); setResultados([]); setBusca(''); }}
                      >
                        <div className="font-medium">{r.nomeCompleto}</div>
                        <div className="text-xs text-muted-foreground">{r.cpf} | {r.telefone || 'Sem tel.'}</div>
                      </button>
                    ))}
                  </div>
                )}
                <div className="mt-3">
                  <label className="text-sm font-medium">Ou informe telefone diretamente</label>
                  <Input
                    placeholder="5527999999999"
                    value={telefoneManual}
                    onChange={(e) => setTelefoneManual(e.target.value)}
                    className="mt-1"
                  />
                </div>
              </div>
            ) : (
              <div className="bg-gray-50 rounded p-3 flex items-center justify-between">
                <div>
                  <div className="font-medium">{selecionado.nomeCompleto}</div>
                  <div className="text-sm text-muted-foreground">{selecionado.telefone || 'Sem telefone'}</div>
                </div>
                <button onClick={() => setSelecionado(null)} className="text-red-500 hover:text-red-700">
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}

            {/* Escopo */}
            <div>
              <label className="text-sm font-medium">Escopo</label>
              <select
                value={escopo}
                onChange={(e) => setEscopo(e.target.value)}
                className="w-full mt-1 border rounded px-3 py-2 text-sm"
              >
                {ESCOPO_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>

            {/* Expiração */}
            <div>
              <label className="text-sm font-medium">Expiração</label>
              <div className="flex gap-2 mt-1">
                {EXPIRACAO_OPTIONS.map((o) => (
                  <button
                    key={o.value}
                    className={`px-3 py-1.5 rounded text-sm border ${expiracao === o.value ? 'bg-black text-white border-black' : 'hover:bg-gray-100'}`}
                    onClick={() => setExpiracao(o.value)}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Motivo */}
            <div>
              <label className="text-sm font-medium">Motivo (opcional)</label>
              <Input
                placeholder="Ex: Treinamento de novo operador"
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                className="mt-1"
              />
            </div>

            <Button
              onClick={ativarObservacao}
              disabled={enviando || (!selecionado && !telefoneManual)}
              className="w-full"
            >
              {enviando ? 'Ativando...' : 'Ativar Observação'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
