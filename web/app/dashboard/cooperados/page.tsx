'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import api from '@/lib/api';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle, Plus, MoreVertical, Eye, FileText, CreditCard, MessageCircle, Building2, Search, Trash2, ArrowRightLeft, Zap, Loader2 } from 'lucide-react';
import AcoesLoteBar from '@/components/AcoesLoteBar';
import DualListaConcessionaria from '@/components/DualListaConcessionaria';
import Link from 'next/link';
import { useTipoParceiro } from '@/hooks/useTipoParceiro';
import { getUsuario } from '@/lib/auth';
import BadgeNivelClube from '@/components/BadgeNivelClube';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';

interface ChecklistItem {
  label: string;
  ok: boolean;
}

interface CooperadoLista {
  id: string;
  nomeCompleto: string;
  cpf: string;
  email: string;
  telefone: string | null;
  status: string;
  tipoCooperado: string;
  cotaKwhMensal: number | string | null;
  usinaVinculada: string | null;
  statusContrato: string | null;
  kwhContrato: number | null;
  checklist: string;
  checklistPronto: boolean;
  checklistItems: ChecklistItem[];
  progressaoClube?: {
    nivelAtual: string;
    indicadosAtivos: number;
    beneficioPercentualAtual: number;
  } | null;
  createdAt: string;
  nomeParceiro?: string;
  tipoParceiro?: string;
  cooperativaId?: string;
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  ATIVO_RECEBENDO_CREDITOS: { label: 'Ativo', color: 'bg-green-100 text-green-800 border-green-200' },
  ATIVO: { label: 'Ativo', color: 'bg-green-100 text-green-800 border-green-200' },
  AGUARDANDO_CONCESSIONARIA: { label: 'Aguard. Concess.', color: 'bg-blue-100 text-blue-800 border-blue-200' },
  PENDENTE_ATIVACAO: { label: 'Pend. Ativacao', color: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
  LISTA_ESPERA: { label: 'Lista de Espera', color: 'bg-gray-100 text-gray-600 border-gray-200' },
  PENDENTE: { label: 'Pendente', color: 'bg-gray-100 text-gray-600 border-gray-200' },
  PENDENTE_DOCUMENTOS: { label: 'Pend. Docs', color: 'bg-orange-100 text-orange-800 border-orange-200' },
  PENDENTE_VALIDACAO: { label: 'Pend. Validacao', color: 'bg-orange-100 text-orange-800 border-orange-200' },
  PROPOSTA_ENVIADA: { label: 'Proposta Enviada', color: 'bg-purple-100 text-purple-800 border-purple-200' },
  PROPOSTA_ACEITA: { label: 'Proposta Aceita', color: 'bg-purple-100 text-purple-800 border-purple-200' },
  APROVADO: { label: 'Aprovado', color: 'bg-green-100 text-green-700 border-green-200' },
  SUSPENSO: { label: 'Suspenso', color: 'bg-red-100 text-red-800 border-red-200' },
  ENCERRADO: { label: 'Encerrado', color: 'bg-red-100 text-red-800 border-red-200' },
};

const CONTRATO_CONFIG: Record<string, { label: string; color: string }> = {
  PENDENTE_ATIVACAO: { label: 'Pend. Ativacao', color: 'bg-yellow-100 text-yellow-800' },
  ATIVO: { label: 'Ativo', color: 'bg-green-100 text-green-800' },
  LISTA_ESPERA: { label: 'Lista Espera', color: 'bg-purple-100 text-purple-800' },
  SUSPENSO: { label: 'Suspenso', color: 'bg-red-100 text-red-800' },
  ENCERRADO: { label: 'Encerrado', color: 'bg-gray-100 text-gray-600' },
};

function AcoesDropdown({ cooperado, onExcluir, onMover, onAjustar }: { cooperado: CooperadoLista; onExcluir?: (id: string, nome: string) => void; onMover?: (c: CooperadoLista) => void; onAjustar?: (c: CooperadoLista) => void }) {
  const [aberto, setAberto] = useState(false);
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({});
  const ref = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setAberto(false);
    }
    if (aberto) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [aberto]);

  function toggleDropdown(e: React.MouseEvent) {
    e.stopPropagation();
    if (!aberto && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      const menuW = 192;
      const menuH = 180;
      const flipUp = rect.bottom + menuH > window.innerHeight;
      const flipLeft = rect.right > window.innerWidth - menuW;
      setMenuStyle({
        position: 'fixed',
        top: flipUp ? rect.top - menuH - 4 : rect.bottom + 4,
        left: flipLeft ? rect.right - menuW : rect.left,
        width: menuW,
        zIndex: 9999,
      });
    }
    setAberto(!aberto);
  }

  return (
    <div ref={ref}>
      <Button variant="ghost" size="sm" ref={btnRef} onMouseDown={(e) => e.preventDefault()} onClick={toggleDropdown}>
        <MoreVertical className="h-4 w-4" />
      </Button>
      {aberto && (
        <div style={menuStyle} className="bg-white border border-gray-200 rounded-md shadow-lg">
          <Link href={`/dashboard/cooperados/${cooperado.id}`} className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50" onClick={() => setAberto(false)}>
            <Eye className="h-4 w-4" /> Ver perfil
          </Link>
          <Link href={`/dashboard/cooperados/${cooperado.id}?aba=proposta`} className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50" onClick={() => setAberto(false)}>
            <FileText className="h-4 w-4" /> Nova proposta
          </Link>
          <Link href={`/dashboard/cooperados/${cooperado.id}?aba=cobranca`} className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50" onClick={() => setAberto(false)}>
            <CreditCard className="h-4 w-4" /> Gerar cobranca
          </Link>
          {cooperado.telefone && (
            <a
              href={`https://wa.me/55${cooperado.telefone.replace(/\D/g, '')}?text=${encodeURIComponent(`Ola ${cooperado.nomeCompleto}, tudo bem? Entramos em contato referente a sua participacao na cooperativa de energia solar.`)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
              onClick={() => setAberto(false)}
            >
              <MessageCircle className="h-4 w-4" /> Enviar WhatsApp
            </a>
          )}
          {onMover && (
            <button
              className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 w-full"
              onClick={() => { setAberto(false); onMover(cooperado); }}
            >
              <ArrowRightLeft className="h-4 w-4" /> Mover para outra usina
            </button>
          )}
          {onAjustar && (
            <button
              className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 w-full"
              onClick={() => { setAberto(false); onAjustar(cooperado); }}
            >
              <Zap className="h-4 w-4" /> Ajustar kWh / %
            </button>
          )}
          {onExcluir && (
            <button
              className="flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 w-full"
              onClick={() => { setAberto(false); onExcluir(cooperado.id, cooperado.nomeCompleto); }}
            >
              <Trash2 className="h-4 w-4" /> Excluir
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function ChecklistTooltip({ checklist, items }: { checklist: string; items?: ChecklistItem[] }) {
  const [mostrar, setMostrar] = useState(false);
  const pronto = items?.every(i => i.ok) ?? false;

  return (
    <div className="relative inline-block" onMouseEnter={() => setMostrar(true)} onMouseLeave={() => setMostrar(false)}>
      <div className="flex items-center gap-1.5 cursor-help">
        <span className={`text-sm font-mono ${pronto ? 'text-green-700 font-bold' : 'text-gray-500'}`}>
          {checklist}
        </span>
        {pronto && <CheckCircle className="h-4 w-4 text-green-600" />}
      </div>
      {mostrar && items && items.length > 0 && (
        <div className="absolute left-0 bottom-full mb-2 w-56 bg-gray-900 text-white text-xs rounded-md p-2 shadow-lg z-50">
          {items.map((item, i) => (
            <div key={i} className="flex items-center gap-1.5 py-0.5">
              <span>{item.ok ? '\u2705' : '\u274C'}</span>
              <span className={item.ok ? 'text-green-300' : 'text-gray-300'}>{item.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Tabela ───────────────────────────────────────────────────────────────────

function TabelaCooperados({
  cooperados,
  carregando,
  tipoMembro,
  selecionados,
  onToggle,
  onToggleAll,
  onExcluir,
  onStatusChange,
  onMover,
  onAjustar,
}: {
  cooperados: CooperadoLista[];
  carregando: boolean;
  tipoMembro: string;
  selecionados: string[];
  onToggle: (id: string) => void;
  onToggleAll: () => void;
  onExcluir: (id: string, nome: string) => void;
  onStatusChange: (id: string, status: string) => void;
  onMover: (c: CooperadoLista) => void;
  onAjustar: (c: CooperadoLista) => void;
}) {
  const todosIds = cooperados.map(c => c.id);
  const todosSelecionados = cooperados.length > 0 && todosIds.every(id => selecionados.includes(id));
  const [editandoStatus, setEditandoStatus] = useState<string | null>(null);
  const [salvandoStatus, setSalvandoStatus] = useState<string | null>(null);

  const STATUS_OPTIONS = ['PENDENTE', 'ATIVO', 'ATIVO_RECEBENDO_CREDITOS', 'SUSPENSO', 'ENCERRADO'] as const;

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-10">
            <input
              type="checkbox"
              checked={todosSelecionados}
              onChange={onToggleAll}
              className="rounded border-gray-300"
            />
          </TableHead>
          <TableHead>Nome</TableHead>
          <TableHead>CPF/CNPJ</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Usina</TableHead>
          <TableHead>Contrato</TableHead>
          <TableHead>Checklist</TableHead>
          <TableHead>Clube</TableHead>
          <TableHead className="text-right">Acoes</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {carregando ? (
          Array.from({ length: 5 }).map((_, i) => (
            <TableRow key={i}>
              {Array.from({ length: 9 }).map((_, j) => (
                <TableCell key={j}>
                  <div className="h-4 bg-gray-200 animate-pulse rounded w-3/4" />
                </TableCell>
              ))}
            </TableRow>
          ))
        ) : cooperados.length === 0 ? (
          <TableRow>
            <TableCell colSpan={9} className="text-center text-gray-400 py-8">
              Nenhum {tipoMembro.toLowerCase()} cadastrado
            </TableCell>
          </TableRow>
        ) : (
          cooperados.map((c) => {
            const st = STATUS_CONFIG[c.status];
            const ct = c.statusContrato ? CONTRATO_CONFIG[c.statusContrato] : null;
            const checked = selecionados.includes(c.id);
            return (
              <TableRow key={c.id} className={`${c.checklistPronto && c.status === 'PENDENTE' ? 'bg-green-50/50' : ''} ${checked ? 'bg-blue-50/50' : ''}`}>
                <TableCell>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => onToggle(c.id)}
                    className="rounded border-gray-300"
                  />
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <Link href={`/dashboard/cooperados/${c.id}`} className="font-medium text-blue-600 hover:underline">{c.nomeCompleto}</Link>
                    {c.tipoCooperado === 'SEM_UC' && (
                      <span className="ml-2 text-xs text-gray-400">(sem UC)</span>
                    )}
                    <button
                      title="Observar este membro"
                      className="ml-1 text-gray-400 hover:text-blue-600 transition-colors"
                      onClick={(e) => {
                        e.stopPropagation();
                        const fn = (window as any).__observadorAbrirModal;
                        if (fn) {
                          fn({ id: c.id, nomeCompleto: c.nomeCompleto, cpf: c.cpf, telefone: c.telefone, cooperativaId: c.cooperativaId });
                        } else {
                          window.location.href = `/dashboard/observador?userId=${c.id}&nome=${encodeURIComponent(c.nomeCompleto)}&telefone=${c.telefone || ''}`;
                        }
                      }}
                    >
                      <Eye className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </TableCell>
                <TableCell className="text-sm text-gray-600">{c.cpf}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    {editandoStatus === c.id ? (
                      <select
                        autoFocus
                        className="text-xs border border-gray-300 rounded px-1 py-0.5 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400"
                        defaultValue={c.status}
                        disabled={salvandoStatus === c.id}
                        onBlur={() => setEditandoStatus(null)}
                        onChange={async (e) => {
                          const novoStatus = e.target.value;
                          setSalvandoStatus(c.id);
                          setEditandoStatus(null);
                          await onStatusChange(c.id, novoStatus);
                          setSalvandoStatus(null);
                        }}
                      >
                        {STATUS_OPTIONS.map(s => (
                          <option key={s} value={s}>{STATUS_CONFIG[s]?.label ?? s}</option>
                        ))}
                      </select>
                    ) : (
                      <Badge
                        className={`cursor-pointer ${salvandoStatus === c.id ? 'opacity-50' : ''} ${st?.color ?? 'bg-gray-100 text-gray-600'}`}
                        onClick={() => setEditandoStatus(c.id)}
                      >
                        {salvandoStatus === c.id ? 'Salvando...' : (st?.label ?? c.status)}
                      </Badge>
                    )}
                    {(c as any).reajusteRecente && (
                      <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-[10px]">Reajustado</Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-sm">
                  {c.usinaVinculada ?? <span className="text-gray-400">&mdash;</span>}
                </TableCell>
                <TableCell>
                  {ct ? (
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ct.color}`}>
                      {ct.label}
                    </span>
                  ) : (
                    <span className="text-gray-400 text-sm">&mdash;</span>
                  )}
                </TableCell>
                <TableCell>
                  <ChecklistTooltip checklist={c.checklist} items={c.checklistItems} />
                </TableCell>
                <TableCell>
                  {c.progressaoClube ? (
                    <BadgeNivelClube
                      nivel={c.progressaoClube.nivelAtual}
                      beneficioAtivo={c.progressaoClube.beneficioPercentualAtual > 0}
                      indicados={c.progressaoClube.indicadosAtivos}
                      compact
                    />
                  ) : (
                    <span className="text-gray-400 text-sm">&mdash;</span>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <AcoesDropdown cooperado={c} onExcluir={onExcluir} onMover={onMover} onAjustar={onAjustar} />
                </TableCell>
              </TableRow>
            );
          })
        )}
      </TableBody>
    </Table>
  );
}

export default function CooperadosPage() {
  const [cooperados, setCooperados] = useState<CooperadoLista[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [filtroParceiro, setFiltroParceiro] = useState<string | null>(null);
  const [busca, setBusca] = useState('');
  const [selecionados, setSelecionados] = useState<string[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { tipoMembro, tipoMembroPlural } = useTipoParceiro();

  const usuario = getUsuario();
  const isSuperAdmin = usuario?.perfil === 'SUPER_ADMIN';

  // Migração states
  const [usinasDisponiveis, setUsinasDisponiveis] = useState<any[]>([]);
  const [migrarAberto, setMigrarAberto] = useState(false);
  const [migrarCooperado, setMigrarCooperado] = useState<CooperadoLista | null>(null);
  const [migrarUsinaDestinoId, setMigrarUsinaDestinoId] = useState('');
  const [migrarModo, setMigrarModo] = useState<'kwh' | 'percent'>('kwh');
  const [migrarValor, setMigrarValor] = useState('');
  const [migrarMotivo, setMigrarMotivo] = useState('');
  const [migrarProcessando, setMigrarProcessando] = useState(false);
  const [migrarMsg, setMigrarMsg] = useState('');
  const [migrarSucesso, setMigrarSucesso] = useState<{ usinaOrigemId: string; usinaDestinoId: string } | null>(null);
  const [dualListaAberto, setDualListaAberto] = useState(false);

  // Ajustar states
  const [ajustarAberto, setAjustarAberto] = useState(false);
  const [ajustarCooperado, setAjustarCooperado] = useState<CooperadoLista | null>(null);
  const [ajustarModo, setAjustarModo] = useState<'kwh' | 'percent'>('kwh');
  const [ajustarValor, setAjustarValor] = useState('');
  const [ajustarMotivo, setAjustarMotivo] = useState('');
  const [ajustarProcessando, setAjustarProcessando] = useState(false);
  const [ajustarMsg, setAjustarMsg] = useState('');

  // Contratos do membro (para modais mover/ajustar com múltiplos contratos)
  const [contratosDoMembro, setContratosDoMembro] = useState<any[]>([]);
  const [contratosSelecionados, setContratosSelecionados] = useState<string[]>([]);
  const [selecionarTodos, setSelecionarTodos] = useState(true);
  const [carregandoContratos, setCarregandoContratos] = useState(false);

  const carregarCooperados = useCallback((search?: string) => {
    const params = search ? `?search=${encodeURIComponent(search)}` : '';
    api.get<CooperadoLista[]>(`/cooperados${params}`)
      .then((r) => setCooperados(r.data))
      .finally(() => setCarregando(false));
  }, []);

  useEffect(() => {
    carregarCooperados();
    api.get('/usinas').then((r) => setUsinasDisponiveis(r.data || [])).catch(() => {});
  }, [carregarCooperados]);

  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 5000);
      return () => clearTimeout(t);
    }
  }, [toast]);

  function handleBuscaChange(valor: string) {
    setBusca(valor);
    setSelecionados([]);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setCarregando(true);
      carregarCooperados(valor);
    }, 500);
  }

  // Agrupar por parceiro para SUPER_ADMIN
  const parceiros = isSuperAdmin
    ? Array.from(
        cooperados.reduce((map, c) => {
          const key = c.cooperativaId ?? 'sem-parceiro';
          if (!map.has(key)) {
            map.set(key, { nome: c.nomeParceiro ?? 'Sem parceiro', tipo: c.tipoParceiro ?? '', count: 0 });
          }
          map.get(key)!.count++;
          return map;
        }, new Map<string, { nome: string; tipo: string; count: number }>()),
      ).map(([id, info]) => ({ id, ...info }))
    : [];

  const cooperadosFiltrados = (filtroParceiro
    ? cooperados.filter(c => c.cooperativaId === filtroParceiro)
    : cooperados
  ).filter(c => {
    if (!busca.trim()) return true;
    const termo = busca.toLowerCase();
    return (
      c.nomeCompleto.toLowerCase().includes(termo) ||
      c.cpf.toLowerCase().includes(termo) ||
      c.email.toLowerCase().includes(termo) ||
      (c.telefone && c.telefone.toLowerCase().includes(termo))
    );
  });

  async function buscarContratosAtivos(cooperadoId: string) {
    setCarregandoContratos(true);
    try {
      const { data } = await api.get(`/contratos/cooperado/${cooperadoId}`);
      const lista = Array.isArray(data) ? data : [];
      const ativos = lista.filter((c: any) => c.status === 'ATIVO' || c.status === 'PENDENTE_ATIVACAO');
      setContratosDoMembro(ativos);
      setSelecionarTodos(true);
      setContratosSelecionados(ativos.map((c: any) => c.id));
    } catch {
      setContratosDoMembro([]);
      setContratosSelecionados([]);
    } finally {
      setCarregandoContratos(false);
    }
  }

  function abrirMover(c: CooperadoLista) {
    setMigrarCooperado(c);
    setMigrarUsinaDestinoId('');
    setMigrarModo('kwh');
    setMigrarValor('');
    setMigrarMotivo('');
    setMigrarMsg('');
    setMigrarSucesso(null);
    setMigrarAberto(true);
    buscarContratosAtivos(c.id);
  }

  function abrirAjustar(c: CooperadoLista) {
    setAjustarCooperado(c);
    setAjustarModo('kwh');
    setAjustarValor('');
    setAjustarMotivo('');
    setAjustarMsg('');
    setAjustarAberto(true);
    buscarContratosAtivos(c.id);
  }

  async function handleMigrar() {
    if (!migrarCooperado || contratosSelecionados.length === 0) return;
    setMigrarProcessando(true);
    setMigrarMsg('');
    try {
      for (const contratoId of contratosSelecionados) {
        const body: any = {
          cooperadoId: migrarCooperado.id,
          usinaDestinoId: migrarUsinaDestinoId,
          contratoId,
          motivo: migrarMotivo || undefined,
        };
        if (migrarValor) {
          if (migrarModo === 'kwh') body.kwhNovo = Number(migrarValor);
          else body.percentualNovo = Number(migrarValor);
        }
        await api.post('/migracoes-usina/cooperado', body);
      }
      setMigrarAberto(false);
      const origemUsina = cooperados.find(c => c.id === migrarCooperado.id);
      const origemId = (origemUsina as any)?.usinaId || '';
      setMigrarSucesso({ usinaOrigemId: origemId, usinaDestinoId: migrarUsinaDestinoId });
      setToast(`Migracao realizada com sucesso! (${contratosSelecionados.length} contrato${contratosSelecionados.length > 1 ? 's' : ''})`);
      setCarregando(true);
      carregarCooperados(busca || undefined);
    } catch (e: any) {
      const msg = e?.response?.data?.message || 'Erro ao migrar.';
      setMigrarMsg(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setMigrarProcessando(false);
    }
  }

  async function handleAjustar() {
    if (!ajustarCooperado || contratosSelecionados.length === 0) return;
    setAjustarProcessando(true);
    setAjustarMsg('');
    try {
      for (const contratoId of contratosSelecionados) {
        const body: any = {
          cooperadoId: ajustarCooperado.id,
          contratoId,
          motivo: ajustarMotivo || undefined,
        };
        if (ajustarModo === 'kwh') body.kwhNovo = Number(ajustarValor);
        else body.percentualNovo = Number(ajustarValor);
        await api.post('/migracoes-usina/ajustar-kwh', body);
      }
      setAjustarAberto(false);
      setToast(`Ajuste realizado com sucesso! (${contratosSelecionados.length} contrato${contratosSelecionados.length > 1 ? 's' : ''})`);
      setCarregando(true);
      carregarCooperados(busca || undefined);
    } catch (e: any) {
      const msg = e?.response?.data?.message || 'Erro ao ajustar.';
      setAjustarMsg(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setAjustarProcessando(false);
    }
  }

  async function handleExcluir(id: string, nome: string) {
    if (!confirm(`Tem certeza que deseja excluir '${nome}'? Esta ação não pode ser desfeita.`)) return;
    try {
      await api.delete(`/cooperados/${id}`);
      setToast('Excluído com sucesso');
      setCarregando(true);
      carregarCooperados(busca || undefined);
    } catch {
      setToast('Erro ao excluir');
    }
  }

  function toggleSelecionado(id: string) {
    setSelecionados(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }

  function toggleTodos() {
    const ids = cooperadosFiltrados.map(c => c.id);
    const todosSelecionados = ids.every(id => selecionados.includes(id));
    if (todosSelecionados) {
      setSelecionados(prev => prev.filter(x => !ids.includes(x)));
    } else {
      setSelecionados(prev => [...new Set([...prev, ...ids])]);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-800">{tipoMembroPlural}</h2>
        <Link href="/dashboard/cooperados/novo">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Novo {tipoMembro}
          </Button>
        </Link>
      </div>

      {/* Toast */}
      {toast && (
        <div className="mb-4 px-4 py-2 bg-green-50 border border-green-200 text-green-800 rounded-lg text-sm">
          {toast}
        </div>
      )}

      {/* Acoes em Lote */}
      {selecionados.length > 0 && (
        <AcoesLoteBar
          selecionados={selecionados}
          onLimpar={() => setSelecionados([])}
          onSucesso={(msg) => {
            setToast(msg);
            setCarregando(true);
            carregarCooperados(busca || undefined);
          }}
        />
      )}

      {/* SUPER_ADMIN: cards de resumo por parceiro */}
      {isSuperAdmin && !carregando && parceiros.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          <button
            onClick={() => { setFiltroParceiro(null); setSelecionados([]); }}
            className={`text-left rounded-lg border p-3 transition-colors ${
              filtroParceiro === null ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              <Building2 className="h-4 w-4 text-gray-500" />
              <span className="text-sm font-medium text-gray-700">Todos</span>
            </div>
            <span className="text-2xl font-bold text-gray-900">{cooperados.length}</span>
            <span className="text-xs text-gray-500 ml-1">membros</span>
          </button>
          {parceiros.map((p) => (
            <button
              key={p.id}
              onClick={() => { setFiltroParceiro(p.id); setSelecionados([]); }}
              className={`text-left rounded-lg border p-3 transition-colors ${
                filtroParceiro === p.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <Building2 className="h-4 w-4 text-gray-500" />
                <span className="text-sm font-medium text-gray-700">{p.nome}</span>
              </div>
              <span className="text-2xl font-bold text-gray-900">{p.count}</span>
              <span className="text-xs text-gray-500 ml-1">membros</span>
              <Badge className="ml-2 text-[10px] bg-gray-100 text-gray-500">{p.tipo}</Badge>
            </button>
          ))}
        </div>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <CardTitle className="text-base font-medium text-gray-600">
              {carregando ? 'Carregando...' : `${cooperadosFiltrados.length} registros`}
              {filtroParceiro && parceiros.find(p => p.id === filtroParceiro) && (
                <span className="ml-2 text-sm text-blue-600">
                  — {parceiros.find(p => p.id === filtroParceiro)!.nome}
                </span>
              )}
            </CardTitle>
            <div className="relative w-full max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Buscar por nome, CPF, email ou telefone..."
                value={busca}
                onChange={(e) => handleBuscaChange(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <TabelaCooperados
            cooperados={cooperadosFiltrados}
            carregando={carregando}
            tipoMembro={tipoMembro}
            selecionados={selecionados}
            onToggle={toggleSelecionado}
            onToggleAll={toggleTodos}
            onExcluir={handleExcluir}
            onMover={abrirMover}
            onAjustar={abrirAjustar}
            onStatusChange={async (id, status) => {
              try {
                await api.put(`/cooperados/${id}`, { status });
                setCooperados(prev => prev.map(c => c.id === id ? { ...c, status } : c));
                setToast('Status atualizado');
              } catch { setToast('Erro ao atualizar status'); }
            }}
          />
        </CardContent>
      </Card>

      {/* Banner de sucesso com botão para lista dual */}
      {migrarSucesso && migrarSucesso.usinaOrigemId && (
        <div className="fixed bottom-4 right-4 bg-green-50 border border-green-200 rounded-lg p-4 shadow-lg z-50 max-w-sm">
          <p className="text-sm text-green-800 font-medium mb-2">Migracao concluida com sucesso!</p>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => { setDualListaAberto(true); }}>
              Gerar listas para concessionaria
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setMigrarSucesso(null)}>Fechar</Button>
          </div>
        </div>
      )}

      {/* Dual Lista */}
      {dualListaAberto && migrarSucesso && (
        <DualListaConcessionaria
          usinaOrigemId={migrarSucesso.usinaOrigemId}
          usinaDestinoId={migrarSucesso.usinaDestinoId}
          onClose={() => { setDualListaAberto(false); setMigrarSucesso(null); }}
        />
      )}

      {/* Dialog — Mover para outra usina */}
      <Dialog open={migrarAberto} onOpenChange={setMigrarAberto}>
        <DialogContent>
          <DialogHeader><DialogTitle>Mover para outra usina</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-2">
            {migrarCooperado && (
              <p className="text-sm text-gray-600">Membro: <strong>{migrarCooperado.nomeCompleto}</strong> — Usina atual: {migrarCooperado.usinaVinculada || '—'}</p>
            )}
            {carregandoContratos ? (
              <div className="flex items-center gap-2 text-sm text-gray-500"><Loader2 className="h-4 w-4 animate-spin" /> Carregando contratos...</div>
            ) : contratosDoMembro.length > 1 ? (
              <div>
                <label className="text-xs text-gray-500 mb-2 block">Contratos a mover:</label>
                <div className="space-y-1 border rounded p-2 bg-gray-50">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input type="checkbox" checked={selecionarTodos} onChange={e => {
                      setSelecionarTodos(e.target.checked);
                      setContratosSelecionados(e.target.checked ? contratosDoMembro.map(c => c.id) : []);
                    }} />
                    <span className="font-medium">Todos os contratos ativos ({contratosDoMembro.length})</span>
                  </label>
                  {contratosDoMembro.map(c => (
                    <label key={c.id} className="flex items-center gap-2 text-sm cursor-pointer ml-4">
                      <input type="checkbox"
                        checked={contratosSelecionados.includes(c.id)}
                        onChange={e => {
                          const novo = e.target.checked
                            ? [...contratosSelecionados, c.id]
                            : contratosSelecionados.filter((id: string) => id !== c.id);
                          setContratosSelecionados(novo);
                          setSelecionarTodos(novo.length === contratosDoMembro.length);
                        }}
                      />
                      <span>{c.numero} — {c.usina?.nome ?? 'sem usina'} — {Number(c.kwhContrato ?? 0).toLocaleString('pt-BR')} kWh</span>
                    </label>
                  ))}
                </div>
              </div>
            ) : contratosDoMembro.length === 1 ? (
              <p className="text-xs text-gray-500">Contrato: {contratosDoMembro[0].numero} — {contratosDoMembro[0].usina?.nome ?? 'sem usina'} — {Number(contratosDoMembro[0].kwhContrato ?? 0).toLocaleString('pt-BR')} kWh</p>
            ) : null}
            <div>
              <label className="text-xs text-gray-500 mb-0.5 block">Usina Destino</label>
              <select className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-green-500" value={migrarUsinaDestinoId} onChange={(e) => setMigrarUsinaDestinoId(e.target.value)}>
                <option value="">Selecione...</option>
                {usinasDisponiveis.map((u: any) => (
                  <option key={u.id} value={u.id}>{u.nome} — {u.cidade}/{u.estado}</option>
                ))}
              </select>
            </div>
            <div>
              <div className="flex gap-2 mb-1">
                <button className={`text-xs px-2 py-0.5 rounded ${migrarModo === 'kwh' ? 'bg-blue-100 text-blue-800 font-medium' : 'text-gray-500 hover:bg-gray-100'}`} onClick={() => setMigrarModo('kwh')}>kWh</button>
                <button className={`text-xs px-2 py-0.5 rounded ${migrarModo === 'percent' ? 'bg-blue-100 text-blue-800 font-medium' : 'text-gray-500 hover:bg-gray-100'}`} onClick={() => setMigrarModo('percent')}>%</button>
              </div>
              <label className="text-xs text-gray-500 mb-0.5 block">{migrarModo === 'kwh' ? 'Novo kWh mensal' : 'Novo percentual (%)'}</label>
              <input className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" type="number" step="0.01" value={migrarValor} onChange={(e) => setMigrarValor(e.target.value)} placeholder="Manter atual se vazio" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-0.5 block">Motivo</label>
              <textarea className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" rows={2} value={migrarMotivo} onChange={(e) => setMigrarMotivo(e.target.value)} placeholder="Ex: Melhor distribuicao de creditos" />
            </div>
            {migrarMsg && <p className={`text-sm ${migrarMsg.toLowerCase().includes('erro') ? 'text-red-500' : 'text-green-600'}`}>{migrarMsg}</p>}
          </div>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setMigrarAberto(false)}>Cancelar</Button>
            <Button disabled={migrarProcessando || !migrarUsinaDestinoId || contratosSelecionados.length === 0} onClick={handleMigrar}>
              {migrarProcessando && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Confirmar{contratosSelecionados.length > 1 ? ` (${contratosSelecionados.length} contratos)` : ''}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog — Ajustar kWh / % */}
      <Dialog open={ajustarAberto} onOpenChange={setAjustarAberto}>
        <DialogContent>
          <DialogHeader><DialogTitle>Ajustar kWh / %</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-2">
            {ajustarCooperado && (
              <p className="text-sm text-gray-600">Membro: <strong>{ajustarCooperado.nomeCompleto}</strong></p>
            )}
            {carregandoContratos ? (
              <div className="flex items-center gap-2 text-sm text-gray-500"><Loader2 className="h-4 w-4 animate-spin" /> Carregando contratos...</div>
            ) : contratosDoMembro.length > 1 ? (
              <div>
                <label className="text-xs text-gray-500 mb-2 block">Contratos a ajustar:</label>
                <div className="space-y-1 border rounded p-2 bg-gray-50">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input type="checkbox" checked={selecionarTodos} onChange={e => {
                      setSelecionarTodos(e.target.checked);
                      setContratosSelecionados(e.target.checked ? contratosDoMembro.map(c => c.id) : []);
                    }} />
                    <span className="font-medium">Todos os contratos ativos ({contratosDoMembro.length})</span>
                  </label>
                  {contratosDoMembro.map(c => (
                    <label key={c.id} className="flex items-center gap-2 text-sm cursor-pointer ml-4">
                      <input type="checkbox"
                        checked={contratosSelecionados.includes(c.id)}
                        onChange={e => {
                          const novo = e.target.checked
                            ? [...contratosSelecionados, c.id]
                            : contratosSelecionados.filter((id: string) => id !== c.id);
                          setContratosSelecionados(novo);
                          setSelecionarTodos(novo.length === contratosDoMembro.length);
                        }}
                      />
                      <span>{c.numero} — {c.usina?.nome ?? 'sem usina'} — {Number(c.kwhContrato ?? 0).toLocaleString('pt-BR')} kWh</span>
                    </label>
                  ))}
                </div>
              </div>
            ) : contratosDoMembro.length === 1 ? (
              <p className="text-xs text-gray-500">Contrato: {contratosDoMembro[0].numero} — kWh atual: {Number(contratosDoMembro[0].kwhContrato ?? 0).toLocaleString('pt-BR')}</p>
            ) : null}
            <div>
              <div className="flex gap-2 mb-1">
                <button className={`text-xs px-2 py-0.5 rounded ${ajustarModo === 'kwh' ? 'bg-blue-100 text-blue-800 font-medium' : 'text-gray-500 hover:bg-gray-100'}`} onClick={() => setAjustarModo('kwh')}>kWh</button>
                <button className={`text-xs px-2 py-0.5 rounded ${ajustarModo === 'percent' ? 'bg-blue-100 text-blue-800 font-medium' : 'text-gray-500 hover:bg-gray-100'}`} onClick={() => setAjustarModo('percent')}>%</button>
              </div>
              <label className="text-xs text-gray-500 mb-0.5 block">{ajustarModo === 'kwh' ? 'Novo kWh mensal' : 'Novo percentual (%)'}</label>
              <input className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" type="number" step="0.01" value={ajustarValor} onChange={(e) => setAjustarValor(e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-0.5 block">Motivo</label>
              <textarea className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" rows={2} value={ajustarMotivo} onChange={(e) => setAjustarMotivo(e.target.value)} />
            </div>
            {ajustarMsg && <p className={`text-sm ${ajustarMsg.toLowerCase().includes('erro') ? 'text-red-500' : 'text-green-600'}`}>{ajustarMsg}</p>}
          </div>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setAjustarAberto(false)}>Cancelar</Button>
            <Button disabled={ajustarProcessando || !ajustarValor || contratosSelecionados.length === 0} onClick={handleAjustar}>
              {ajustarProcessando && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Ajustar{contratosSelecionados.length > 1 ? ` (${contratosSelecionados.length} contratos)` : ''}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
