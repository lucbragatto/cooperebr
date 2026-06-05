'use client';

import { useCallback, useEffect, useState } from 'react';
import api from '@/lib/api';
import { getUsuario } from '@/lib/auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Gift, Users, Settings, BarChart3, Plus, Trash2, Download, Loader2, ChevronRight,
  Send, AlertTriangle, CheckCircle, UserPlus,
} from 'lucide-react';

// ─── Types ──────────────────────────────────────────────────────────────────

interface NivelConfig {
  nivel: number;
  percentual: number;
  reaisKwh: number;
}

interface Config {
  id?: string;
  ativo: boolean;
  maxNiveis: number;
  modalidade: string;
  niveisConfig: NivelConfig[];
}

type Tab = 'config' | 'rede' | 'relatorio';

// ─── Tab: Configuração ──────────────────────────────────────────────────────

function TabConfig({ config, setConfig, onSave, salvando }: {
  config: Config;
  setConfig: (c: Config) => void;
  onSave: () => void;
  salvando: boolean;
}) {
  function addNivel() {
    const next = config.niveisConfig.length + 1;
    setConfig({
      ...config,
      niveisConfig: [...config.niveisConfig, { nivel: next, percentual: 0, reaisKwh: 0 }],
    });
  }

  function removeNivel(idx: number) {
    const updated = config.niveisConfig
      .filter((_, i) => i !== idx)
      .map((n, i) => ({ ...n, nivel: i + 1 }));
    setConfig({ ...config, niveisConfig: updated });
  }

  function updateNivel(idx: number, field: string, value: number) {
    const updated = config.niveisConfig.map((n, i) =>
      i === idx ? { ...n, [field]: value } : n,
    );
    setConfig({ ...config, niveisConfig: updated });
  }

  const cls = 'w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500';

  return (
    <div className="space-y-6">
      {/* Ativo/Inativo */}
      <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
        <div>
          <p className="font-medium text-gray-800">Programa de Indicações</p>
          <p className="text-sm text-gray-500">Ative ou desative o programa de indicações em cascata</p>
        </div>
        <Switch
          checked={config.ativo}
          onCheckedChange={(v) => setConfig({ ...config, ativo: v })}
        />
      </div>

      {/* Máximo de níveis */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Máximo de níveis na cadeia</label>
        <select
          className={cls}
          value={config.maxNiveis}
          onChange={(e) => setConfig({ ...config, maxNiveis: Number(e.target.value) })}
        >
          {[1, 2, 3, 4, 5, 10, 99].map((n) => (
            <option key={n} value={n}>
              {n >= 99 ? 'Ilimitado' : `${n} ${n === 1 ? 'nível' : 'níveis'}`}
            </option>
          ))}
        </select>
      </div>

      {/* Modalidade */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Modalidade de benefício</label>
        <div className="grid grid-cols-3 gap-3">
          {[
            { value: 'PERCENTUAL_PRIMEIRA_FATURA', label: '% da 1ª Fatura', desc: 'Desconto percentual na fatura do indicador' },
            { value: 'REAIS_KWH_RECORRENTE', label: 'R$/kWh Recorrente', desc: 'Valor fixo por kWh durante permanência' },
            { value: 'AMBOS', label: 'Ambos', desc: 'Percentual + R$/kWh combinados' },
          ].map((m) => (
            <button
              key={m.value}
              onClick={() => setConfig({ ...config, modalidade: m.value })}
              className={`p-4 rounded-lg border-2 text-left transition-colors ${
                config.modalidade === m.value
                  ? 'border-green-600 bg-green-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <p className={`text-sm font-medium ${config.modalidade === m.value ? 'text-green-800' : 'text-gray-700'}`}>
                {m.label}
              </p>
              <p className="text-xs text-gray-500 mt-1">{m.desc}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Tabela de níveis */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium text-gray-700">Configuração por nível</label>
          <Button variant="outline" size="sm" onClick={addNivel}>
            <Plus className="h-3 w-3 mr-1" /> Adicionar nível
          </Button>
        </div>

        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left font-medium text-gray-600">Nível</th>
                {(config.modalidade === 'PERCENTUAL_PRIMEIRA_FATURA' || config.modalidade === 'AMBOS') && (
                  <th className="px-4 py-2 text-left font-medium text-gray-600">% da 1ª Fatura</th>
                )}
                {(config.modalidade === 'REAIS_KWH_RECORRENTE' || config.modalidade === 'AMBOS') && (
                  <th className="px-4 py-2 text-left font-medium text-gray-600">R$/kWh</th>
                )}
                <th className="px-4 py-2 w-10" />
              </tr>
            </thead>
            <tbody>
              {config.niveisConfig.map((n, i) => (
                <tr key={i} className="border-t">
                  <td className="px-4 py-2">
                    <Badge variant="outline">Nível {n.nivel}</Badge>
                    <span className="text-xs text-gray-400 ml-2">
                      {n.nivel === 1 ? '(indicação direta)' : `(${n.nivel}º na cadeia)`}
                    </span>
                  </td>
                  {(config.modalidade === 'PERCENTUAL_PRIMEIRA_FATURA' || config.modalidade === 'AMBOS') && (
                    <td className="px-4 py-2">
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        max="100"
                        className="w-24 border border-gray-300 rounded px-2 py-1 text-sm"
                        value={n.percentual}
                        onChange={(e) => updateNivel(i, 'percentual', Number(e.target.value))}
                      />
                      <span className="text-gray-500 ml-1">%</span>
                    </td>
                  )}
                  {(config.modalidade === 'REAIS_KWH_RECORRENTE' || config.modalidade === 'AMBOS') && (
                    <td className="px-4 py-2">
                      <span className="text-gray-500 mr-1">R$</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        className="w-24 border border-gray-300 rounded px-2 py-1 text-sm"
                        value={n.reaisKwh}
                        onChange={(e) => updateNivel(i, 'reaisKwh', Number(e.target.value))}
                      />
                      <span className="text-gray-500 ml-1">/kWh</span>
                    </td>
                  )}
                  <td className="px-4 py-2">
                    {config.niveisConfig.length > 1 && (
                      <button onClick={() => removeNivel(i)} className="text-red-400 hover:text-red-600">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Exemplo visual */}
      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
        <p className="text-sm font-medium text-green-800 mb-2">Exemplo de como funciona:</p>
        <div className="flex items-center gap-2 text-sm text-green-700">
          <span className="bg-white px-2 py-1 rounded font-medium">A</span>
          <span>indica</span>
          <span className="bg-white px-2 py-1 rounded font-medium">B</span>
          {config.niveisConfig[0] && (
            <span className="text-xs text-green-600">
              ({config.niveisConfig[0].percentual}%)
            </span>
          )}
          <ChevronRight className="h-4 w-4" />
          <span className="bg-white px-2 py-1 rounded font-medium">B</span>
          <span>indica</span>
          <span className="bg-white px-2 py-1 rounded font-medium">C</span>
          <ChevronRight className="h-4 w-4" />
          <span>A ganha</span>
          {config.niveisConfig[1] && (
            <span className="text-xs bg-white px-2 py-1 rounded font-medium text-green-600">
              {config.niveisConfig[1].percentual}%
            </span>
          )}
        </div>
      </div>

      <Button onClick={onSave} disabled={salvando} className="bg-green-600 hover:bg-green-700">
        {salvando ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
        Salvar configuração
      </Button>
    </div>
  );
}

// ─── Tab: Rede de Indicações ────────────────────────────────────────────────

function TabRede({ arvore, filtro, setFiltro }: {
  arvore: any[];
  filtro: string;
  setFiltro: (f: string) => void;
}) {
  const totalBeneficiosPagos = arvore.reduce((sum, node) =>
    sum + node.indicados.reduce((s: number, ind: any) =>
      s + ind.beneficios
        .filter((b: any) => b.status === 'APLICADO')
        .reduce((ss: number, b: any) => ss + Number(b.valorAplicado), 0)
    , 0)
  , 0);

  const totalBeneficiosPendentes = arvore.reduce((sum, node) =>
    sum + node.indicados.reduce((s: number, ind: any) =>
      s + ind.beneficios
        .filter((b: any) => b.status === 'PENDENTE' || b.status === 'PARCIAL')
        .reduce((ss: number, b: any) => ss + Number(b.valorCalculado) - Number(b.valorAplicado), 0)
    , 0)
  , 0);

  return (
    <div className="space-y-4">
      {/* Resumo */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-gray-500">Total indicadores</p>
            <p className="text-2xl font-bold text-gray-800">{arvore.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-gray-500">Benefícios pagos</p>
            <p className="text-2xl font-bold text-green-600">R$ {totalBeneficiosPagos.toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-gray-500">Benefícios pendentes</p>
            <p className="text-2xl font-bold text-amber-600">R$ {totalBeneficiosPendentes.toFixed(2)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filtro */}
      <div className="flex gap-2">
        {['TODOS', 'PENDENTE', 'PRIMEIRA_FATURA_PAGA'].map((f) => (
          <button
            key={f}
            onClick={() => setFiltro(f)}
            className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${
              filtro === f
                ? 'bg-green-100 text-green-800'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {f === 'TODOS' ? 'Todos' : f === 'PENDENTE' ? 'Pendentes' : 'Fatura Paga'}
          </button>
        ))}
      </div>

      {/* Árvore */}
      {arvore.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <Gift className="h-12 w-12 mx-auto mb-3 opacity-50" />
          <p>Nenhuma indicação registrada ainda.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {arvore.map((node: any, i: number) => (
            <Card key={i}>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 mb-3">
                  <Users className="h-4 w-4 text-green-600" />
                  <span className="font-medium text-gray-800">{node.indicador.nomeCompleto}</span>
                  <Badge variant="outline" className="text-xs">{node.indicador.codigoIndicacao}</Badge>
                </div>
                <div className="ml-6 space-y-2">
                  {node.indicados
                    .filter((ind: any) => filtro === 'TODOS' || ind.status === filtro)
                    .map((ind: any, j: number) => (
                    <div key={j} className="flex items-center justify-between py-1.5 border-b last:border-0">
                      <div className="flex items-center gap-2">
                        <ChevronRight className="h-3 w-3 text-gray-400" />
                        <span className="text-sm text-gray-700">{ind.indicado.nomeCompleto}</span>
                        <Badge variant="outline" className="text-xs">Nível {ind.nivel}</Badge>
                        <Badge
                          variant={ind.status === 'PRIMEIRA_FATURA_PAGA' ? 'default' : 'secondary'}
                          className={`text-xs ${ind.status === 'PRIMEIRA_FATURA_PAGA' ? 'bg-green-100 text-green-800' : ''}`}
                        >
                          {ind.status === 'PENDENTE' ? 'Pendente' : ind.status === 'PRIMEIRA_FATURA_PAGA' ? 'Ativa' : 'Cancelada'}
                        </Badge>
                      </div>
                      <div className="text-xs text-gray-500">
                        {ind.beneficios.map((b: any, k: number) => (
                          <span key={k} className="ml-2">
                            {b.tipo === 'PERCENTUAL_FATURA' ? `R$ ${Number(b.valorCalculado).toFixed(2)}` : `R$ ${Number(b.valorCalculado).toFixed(2)}/kWh`}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Tab: Relatório ─────────────────────────────────────────────────────────

function TabRelatorio({ relatorio }: { relatorio: any }) {
  if (!relatorio) return <p className="text-gray-400 text-center py-8">Carregando...</p>;

  function exportCSV() {
    const headers = ['Beneficiário', 'Indicado', 'Nível', 'Tipo', 'Valor Calculado', 'Valor Aplicado', 'Saldo', 'Status'];
    const rows = relatorio.beneficios.map((b: any) => [
      b.cooperado.nomeCompleto,
      b.indicacao.cooperadoIndicado.nomeCompleto,
      b.indicacao.nivel,
      b.tipo,
      Number(b.valorCalculado).toFixed(2),
      Number(b.valorAplicado).toFixed(2),
      Number(b.saldoRestante).toFixed(2),
      b.status,
    ]);
    const csv = [headers.join(','), ...rows.map((r: string[]) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `relatorio-indicacoes-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      {/* Resumo */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-gray-500">Total indicações</p>
            <p className="text-xl font-bold">{relatorio.totalIndicacoes}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-gray-500">Ativas</p>
            <p className="text-xl font-bold text-green-600">{relatorio.indicacoesAtivas}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-gray-500">Benefícios pagos</p>
            <p className="text-xl font-bold text-green-600">R$ {relatorio.totalBeneficiosPago.toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-gray-500">Benefícios pendentes</p>
            <p className="text-xl font-bold text-amber-600">R$ {relatorio.totalBeneficiosPendente.toFixed(2)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Export */}
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={exportCSV}>
          <Download className="h-4 w-4 mr-1" /> Exportar CSV
        </Button>
      </div>

      {/* Tabela */}
      <div className="border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left font-medium text-gray-600">Beneficiário</th>
              <th className="px-4 py-2 text-left font-medium text-gray-600">Indicado</th>
              <th className="px-4 py-2 text-left font-medium text-gray-600">Nível</th>
              <th className="px-4 py-2 text-left font-medium text-gray-600">Tipo</th>
              <th className="px-4 py-2 text-right font-medium text-gray-600">Calculado</th>
              <th className="px-4 py-2 text-right font-medium text-gray-600">Aplicado</th>
              <th className="px-4 py-2 text-right font-medium text-gray-600">Saldo</th>
              <th className="px-4 py-2 text-left font-medium text-gray-600">Status</th>
            </tr>
          </thead>
          <tbody>
            {relatorio.beneficios.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-center py-8 text-gray-400">Nenhum benefício registrado</td>
              </tr>
            ) : (
              relatorio.beneficios.map((b: any) => (
                <tr key={b.id} className="border-t hover:bg-gray-50">
                  <td className="px-4 py-2">{b.cooperado.nomeCompleto}</td>
                  <td className="px-4 py-2">{b.indicacao.cooperadoIndicado.nomeCompleto}</td>
                  <td className="px-4 py-2"><Badge variant="outline">Nível {b.indicacao.nivel}</Badge></td>
                  <td className="px-4 py-2 text-xs">
                    {b.tipo === 'PERCENTUAL_FATURA' ? '% Fatura' : 'R$/kWh'}
                  </td>
                  <td className="px-4 py-2 text-right">R$ {Number(b.valorCalculado).toFixed(2)}</td>
                  <td className="px-4 py-2 text-right">R$ {Number(b.valorAplicado).toFixed(2)}</td>
                  <td className="px-4 py-2 text-right">R$ {Number(b.saldoRestante).toFixed(2)}</td>
                  <td className="px-4 py-2">
                    <Badge
                      variant={b.status === 'APLICADO' ? 'default' : 'secondary'}
                      className={`text-xs ${
                        b.status === 'APLICADO' ? 'bg-green-100 text-green-800' :
                        b.status === 'PARCIAL' ? 'bg-amber-100 text-amber-800' :
                        b.status === 'CANCELADO' ? 'bg-red-100 text-red-800' : ''
                      }`}
                    >
                      {b.status}
                    </Badge>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────────────

export default function IndicacoesPage() {
  const [tab, setTab] = useState<Tab>('config');
  const [config, setConfig] = useState<Config>({
    ativo: true,
    maxNiveis: 2,
    modalidade: 'PERCENTUAL_PRIMEIRA_FATURA',
    niveisConfig: [
      { nivel: 1, percentual: 5, reaisKwh: 0 },
      { nivel: 2, percentual: 2, reaisKwh: 0 },
    ],
  });
  const [salvando, setSalvando] = useState(false);
  const [arvore, setArvore] = useState<any[]>([]);
  const [filtro, setFiltro] = useState('TODOS');
  const [relatorio, setRelatorio] = useState<any>(null);
  const [carregando, setCarregando] = useState(true);

  // Fatia F-G1 (05/06/2026) — Dialog Tipo C: convite de indicação pela web.
  // Admin convida funcionário/cliente em nome da cooperativa (indicador =
  // institucional fantasma). Decisão Luciano: ação simples → Dialog (padrão
  // UX 17/05). HelpBox 19/05 explicando o fluxo.
  // Ajuste pós-merge (05/06): SUPER_ADMIN escolhe a cooperativa via select
  // obrigatório; ADMIN usa a própria (sem seletor). Título + template WA
  // ficam dinâmicos (sem hardcode "CoopereBR" — SISGD é multi-tenant).
  const [conviteDialogOpen, setConviteDialogOpen] = useState(false);
  const [conviteNome, setConviteNome] = useState('');
  const [conviteTelefone, setConviteTelefone] = useState('');
  const [convidando, setConvidando] = useState(false);
  const [conviteErro, setConviteErro] = useState('');
  const [conviteSucesso, setConviteSucesso] = useState<
    | {
        tipo: 'criado';
        nomeConvidado: string;
        whatsappEnviado: boolean;
        /** D-novo-WA-DEV-FALSE-OK (05/06): motivo do skip do sender em DEV
         *  (whitelist-dev | numero-protegido | erro-runtime). Em PROD não vem. */
        whatsappMotivo?: string;
        cooperativaNome: string;
      }
    | { tipo: 'ja_cooperado'; cooperadoNome: string }
    | null
  >(null);

  // Perfil do user (pra branching SUPER_ADMIN × ADMIN no Dialog)
  const [perfilUser, setPerfilUser] = useState<string | null>(null);
  const [cooperativaUserNome, setCooperativaUserNome] = useState<string>('');
  const [cooperativaSelecionadaId, setCooperativaSelecionadaId] = useState<string>('');
  const [cooperativasDisponiveis, setCooperativasDisponiveis] = useState<
    Array<{ id: string; nome: string }>
  >([]);

  // Carrega perfil + cooperativas quando necessário
  useEffect(() => {
    const u = getUsuario();
    if (!u) return;
    setPerfilUser(u.perfil);
    if (u.perfil === 'SUPER_ADMIN') {
      // Lista todas cooperativas pra select
      api
        .get<Array<{ id: string; nome: string; ativo: boolean }>>('/cooperativas')
        .then((r) => {
          const ativas = (r.data ?? []).filter((c) => c.ativo).map((c) => ({ id: c.id, nome: c.nome }));
          setCooperativasDisponiveis(ativas);
        })
        .catch(() => setCooperativasDisponiveis([]));
    } else {
      // ADMIN/etc: pega o nome da própria cooperativa via /auth/me
      api
        .get<{ cooperativaId?: string | null; contextos?: Array<{ tipo: string; cooperativaNome?: string }> }>('/auth/me')
        .then((r) => {
          const adminCtx = r.data.contextos?.find((c) => c.tipo === 'admin_parceiro');
          if (adminCtx?.cooperativaNome) {
            setCooperativaUserNome(adminCtx.cooperativaNome);
          }
        })
        .catch(() => {});
    }
  }, []);

  async function enviarConvite() {
    setConviteErro('');
    if (conviteNome.trim().length < 2) {
      setConviteErro('Nome do convidado precisa de pelo menos 2 caracteres.');
      return;
    }
    const telLimpo = conviteTelefone.replace(/\D/g, '');
    if (telLimpo.length < 10) {
      setConviteErro('Telefone precisa de 10-11 dígitos (com DDD).');
      return;
    }
    // SUPER_ADMIN obrigado a selecionar cooperativa
    if (perfilUser === 'SUPER_ADMIN' && !cooperativaSelecionadaId) {
      setConviteErro('Selecione a cooperativa em nome de quem o convite será enviado.');
      return;
    }

    setConvidando(true);
    try {
      const payload: Record<string, unknown> = {
        nomeConvidado: conviteNome.trim(),
        telefone: telLimpo,
      };
      if (perfilUser === 'SUPER_ADMIN') {
        payload.cooperativaId = cooperativaSelecionadaId;
      }
      const { data } = await api.post('/convite-indicacao/admin', payload);
      if (data.jaCooperado) {
        setConviteSucesso({
          tipo: 'ja_cooperado',
          cooperadoNome: data.cooperado?.nomeCompleto ?? 'cooperado ativo',
        });
      } else {
        setConviteSucesso({
          tipo: 'criado',
          nomeConvidado: data.convite?.nomeConvidado ?? conviteNome.trim(),
          whatsappEnviado: !!data.whatsappEnviado,
          whatsappMotivo: data.whatsappMotivo,
          cooperativaNome: data.cooperativaNome ?? '',
        });
        // Limpa form pra próximo
        setConviteNome('');
        setConviteTelefone('');
      }
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ?? err?.message ?? 'Erro ao enviar convite.';
      setConviteErro(typeof msg === 'string' ? msg : 'Erro ao enviar convite.');
    } finally {
      setConvidando(false);
    }
  }

  // Nome da cooperativa a exibir no título (dinâmico, sem hardcode)
  const cooperativaNomeTitulo = (() => {
    if (perfilUser === 'SUPER_ADMIN') {
      return (
        cooperativasDisponiveis.find((c) => c.id === cooperativaSelecionadaId)?.nome ?? ''
      );
    }
    return cooperativaUserNome;
  })();

  function formatarTelefone(valor: string): string {
    const n = valor.replace(/\D/g, '').slice(0, 11);
    if (n.length <= 2) return n;
    if (n.length <= 7) return `(${n.slice(0, 2)}) ${n.slice(2)}`;
    return `(${n.slice(0, 2)}) ${n.slice(2, 7)}-${n.slice(7)}`;
  }

  const carregarConfig = useCallback(async () => {
    try {
      const { data } = await api.get('/indicacoes/config');
      if (data) {
        setConfig({
          ativo: data.ativo,
          maxNiveis: data.maxNiveis,
          modalidade: data.modalidade,
          niveisConfig: data.niveisConfig as NivelConfig[],
        });
      }
    } catch {
      // config não existe ainda — usa default
    }
  }, []);

  const carregarArvore = useCallback(async () => {
    try {
      const { data } = await api.get('/indicacoes/arvore');
      setArvore(data);
    } catch {
      // silently ignore
    }
  }, []);

  const carregarRelatorio = useCallback(async () => {
    try {
      const { data } = await api.get('/indicacoes/relatorio');
      setRelatorio(data);
    } catch {
      // silently ignore
    }
  }, []);

  useEffect(() => {
    Promise.all([carregarConfig(), carregarArvore(), carregarRelatorio()])
      .finally(() => setCarregando(false));
  }, [carregarConfig, carregarArvore, carregarRelatorio]);

  async function salvarConfig() {
    setSalvando(true);
    try {
      await api.put('/indicacoes/config', config);
    } catch (err) {
      console.error('Erro ao salvar config:', err);
    } finally {
      setSalvando(false);
    }
  }

  const tabs: { key: Tab; label: string; icon: any }[] = [
    { key: 'config', label: 'Configuração', icon: Settings },
    { key: 'rede', label: 'Rede de Indicações', icon: Users },
    { key: 'relatorio', label: 'Relatório', icon: BarChart3 },
  ];

  if (carregando) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-green-600" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center justify-between gap-3 mb-6 flex-wrap">
        <div className="flex items-center gap-3">
          <Gift className="h-6 w-6 text-green-600" />
          <h1 className="text-xl font-bold text-gray-800">Indicações em Cascata (MLM)</h1>
        </div>
        {/* Fatia F-G1 (05/06/2026) — botão pra Dialog Tipo C de convite */}
        <Button
          onClick={() => {
            setConviteErro('');
            setConviteSucesso(null);
            setConviteDialogOpen(true);
          }}
          className="bg-green-600 hover:bg-green-700 text-white gap-2"
        >
          <UserPlus className="h-4 w-4" />
          Convidar pessoa
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-100 p-1 rounded-lg w-fit">
        {tabs.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              tab === key
                ? 'bg-white text-green-700 shadow-sm'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
        {tab === 'config' && (
          <TabConfig config={config} setConfig={setConfig} onSave={salvarConfig} salvando={salvando} />
        )}
        {tab === 'rede' && (
          <TabRede arvore={arvore} filtro={filtro} setFiltro={setFiltro} />
        )}
        {tab === 'relatorio' && (
          <TabRelatorio relatorio={relatorio} />
        )}
      </div>

      {/* Fatia F-G1 (05/06/2026) — Dialog Tipo C: convite de indicação pela web */}
      <Dialog
        open={conviteDialogOpen}
        onOpenChange={(open) => {
          if (!convidando) {
            setConviteDialogOpen(open);
            if (!open) {
              setConviteSucesso(null);
              setConviteErro('');
            }
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-green-600" />
              {/* Título dinâmico (sem hardcode "CoopereBR" — SISGD multi-tenant) */}
              {cooperativaNomeTitulo
                ? `Convidar pessoa pra ${cooperativaNomeTitulo}`
                : 'Convidar pessoa'}
            </DialogTitle>
            <DialogDescription>
              A pessoa recebe um link por WhatsApp pra começar o cadastro.
            </DialogDescription>
          </DialogHeader>

          {/* HelpBox 19/05 — Como funciona */}
          <div className="bg-blue-50 border border-blue-200 rounded-md p-3 text-xs text-blue-900 space-y-1">
            <p className="font-semibold">💡 Como funciona</p>
            <p className="leading-relaxed">
              Você convida em nome da cooperativa (convite institucional —
              sem indicador-pessoa específico). A pessoa recebe um link no
              WhatsApp com o nome da cooperativa selecionada.
            </p>
            <p className="leading-relaxed">
              <strong>Quando ela paga a 1ª fatura:</strong> entra no sistema como
              cooperado normal, mas <strong>não gera bônus de indicação</strong>{' '}
              (não há indicador-pessoa pra premiar — é institucional).
            </p>
          </div>

          {/* Feedback de sucesso (D-novo-WA-DEV-FALSE-OK 05/06: status honesto).
              Mostra 3 estados distintos:
              - convite criado + WA enviado de fato → verde "✓ WhatsApp confirmado"
              - convite criado + WA bloqueado por whitelist DEV → amber "⚠ bloqueio teste/whitelist"
              - convite criado + WA falhou (runtime) → amber "WhatsApp não confirmou"  */}
          {conviteSucesso?.tipo === 'criado' && (() => {
            const ehWhitelistDev = conviteSucesso.whatsappMotivo === 'whitelist-dev';
            const ehProtegido = conviteSucesso.whatsappMotivo === 'numero-protegido';
            const cor = conviteSucesso.whatsappEnviado
              ? 'bg-green-50 border-green-300 text-green-900'
              : 'bg-amber-50 border-amber-300 text-amber-900';
            const Icon = conviteSucesso.whatsappEnviado ? CheckCircle : AlertTriangle;
            return (
              <div className={`border rounded-md p-3 text-sm flex items-start gap-2 ${cor}`}>
                <Icon className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-semibold">
                    {conviteSucesso.whatsappEnviado
                      ? 'Convite criado e WhatsApp enviado ✓'
                      : 'Convite criado · WhatsApp NÃO enviado'}
                  </p>
                  <p className="text-xs leading-relaxed mt-0.5">
                    {conviteSucesso.nomeConvidado} foi registrado
                    {conviteSucesso.cooperativaNome ? ` em nome de ${conviteSucesso.cooperativaNome}` : ''}.{' '}
                    {conviteSucesso.whatsappEnviado ? (
                      <>O link foi disparado via WhatsApp.</>
                    ) : ehWhitelistDev ? (
                      <>
                        <strong>Bloqueio de teste/whitelist (DEV):</strong> o número{' '}
                        <span className="font-mono">{conviteTelefone || '—'}</span> não está
                        na <code className="px-1 bg-amber-100 rounded">WHITELIST_TELEFONES_TESTE</code>.{' '}
                        Em produção (<code>AMBIENTE_REAL=true</code>) o envio ocorre normalmente.
                      </>
                    ) : ehProtegido ? (
                      <>
                        <strong>Número protegido</strong> (fake/anonimizado detectado).
                        Defense in depth — bloqueado em qualquer ambiente.
                      </>
                    ) : (
                      <>WhatsApp não confirmou (use "Reenviar" na aba Rede se a pessoa não receber).</>
                    )}
                  </p>
                </div>
              </div>
            );
          })()}
          {conviteSucesso?.tipo === 'ja_cooperado' && (
            <div className="bg-amber-50 border border-amber-300 rounded-md p-3 text-sm text-amber-900 flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-semibold">Esse número já é cooperado</p>
                <p className="text-xs leading-relaxed">
                  {conviteSucesso.cooperadoNome} já está cadastrado e ativo.
                  Nada foi enviado.
                </p>
              </div>
            </div>
          )}

          {/* Form */}
          <div className="space-y-3 py-2">
            {/* SUPER_ADMIN: seletor de cooperativa obrigatório.
                ADMIN: sem seletor — usa a própria cooperativa do JWT.
                Select NATIVO (regra 19/05 — Shadcn select tem z-index issue em Dialog). */}
            {perfilUser === 'SUPER_ADMIN' && (
              <div>
                <Label htmlFor="convite-coop">Cooperativa *</Label>
                <select
                  id="convite-coop"
                  value={cooperativaSelecionadaId}
                  onChange={(e) => setCooperativaSelecionadaId(e.target.value)}
                  disabled={convidando}
                  className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                >
                  <option value="">— selecione a cooperativa —</option>
                  {cooperativasDisponiveis.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nome}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  O convite e a mensagem do WhatsApp serão enviados em nome desta cooperativa.
                </p>
              </div>
            )}

            <div>
              <Label htmlFor="convite-nome">Nome do convidado *</Label>
              <Input
                id="convite-nome"
                value={conviteNome}
                onChange={(e) => setConviteNome(e.target.value)}
                placeholder="Ex: Dra. Ana Souza"
                disabled={convidando}
                maxLength={120}
              />
            </div>
            <div>
              <Label htmlFor="convite-tel">WhatsApp (com DDD) *</Label>
              <Input
                id="convite-tel"
                value={conviteTelefone}
                onChange={(e) => setConviteTelefone(formatarTelefone(e.target.value))}
                placeholder="(27) 99999-9999"
                disabled={convidando}
                inputMode="numeric"
              />
            </div>
            {conviteErro && (
              <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded p-2">
                {conviteErro}
              </p>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConviteDialogOpen(false)}
              disabled={convidando}
            >
              Fechar
            </Button>
            <Button
              onClick={enviarConvite}
              disabled={
                convidando ||
                !conviteNome.trim() ||
                conviteTelefone.replace(/\D/g, '').length < 10 ||
                (perfilUser === 'SUPER_ADMIN' && !cooperativaSelecionadaId)
              }
              className="bg-green-600 hover:bg-green-700 gap-1"
            >
              {convidando ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              Enviar convite
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
