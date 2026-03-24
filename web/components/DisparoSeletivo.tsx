'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, X, Plus, Users, Building2, ChevronDown, ChevronUp, Search, AlertTriangle } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

const cls = 'w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500';
const lbl = 'block text-xs font-medium text-gray-600 mb-1';

type Modo = 'todos' | 'parceiro' | 'lista' | 'cooperados';

interface Parceiro {
  id: string;
  nome: string;
}

interface CooperadoDisparo {
  id: string;
  nomeCompleto: string;
  telefone: string;
  status: string;
  parceiro: { id: string; nome: string } | null;
}

interface ResultadoDisparo {
  total: number;
  enviados: number;
  erros: number;
  limitado?: boolean;
  totalNaoEnviados?: number;
}

interface DisparoSeletivoProps {
  titulo: string;
  descricao?: string;
  icon: LucideIcon;
  isConnected: boolean;
  onDisparo: (params: { modo: Modo; parceiroId?: string; telefones?: string[]; limiteEnvios?: number }) => Promise<ResultadoDisparo>;
  children?: React.ReactNode;
}

const STATUS_BADGE: Record<string, string> = {
  ATIVO: 'bg-green-100 text-green-800',
  PENDENTE: 'bg-yellow-100 text-yellow-800',
  SEM_CONTRATO: 'bg-gray-100 text-gray-600',
  INATIVO: 'bg-red-100 text-red-800',
};

export default function DisparoSeletivo({
  titulo,
  descricao,
  icon: Icon,
  isConnected,
  onDisparo,
  children,
}: DisparoSeletivoProps) {
  const [modo, setModo] = useState<Modo>('todos');
  const [parceiros, setParceiros] = useState<Parceiro[]>([]);
  const [parceiroId, setParceiroId] = useState('');
  const [telefoneInput, setTelefoneInput] = useState('');
  const [telefones, setTelefones] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [resultado, setResultado] = useState<ResultadoDisparo | null>(null);
  const [loadingParceiros, setLoadingParceiros] = useState(false);

  // Cooperados mode state
  const [cooperados, setCooperados] = useState<CooperadoDisparo[]>([]);
  const [loadingCooperados, setLoadingCooperados] = useState(false);
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [buscaCooperado, setBuscaCooperado] = useState('');

  // Advanced settings
  const [mostrarAvancado, setMostrarAvancado] = useState(false);
  const [limiteEnvios, setLimiteEnvios] = useState(30);

  // Buscar parceiros quando modo = 'parceiro'
  useEffect(() => {
    if (modo === 'parceiro' && parceiros.length === 0) {
      setLoadingParceiros(true);
      api.get<Parceiro[]>('/cooperativas')
        .then(({ data }) => setParceiros(data))
        .catch(() => setParceiros([]))
        .finally(() => setLoadingParceiros(false));
    }
  }, [modo, parceiros.length]);

  // Buscar cooperados quando modo = 'cooperados'
  useEffect(() => {
    if (modo === 'cooperados' && cooperados.length === 0) {
      setLoadingCooperados(true);
      api.get<CooperadoDisparo[]>('/whatsapp/cooperados-para-disparo')
        .then(({ data }) => setCooperados(data))
        .catch(() => setCooperados([]))
        .finally(() => setLoadingCooperados(false));
    }
  }, [modo, cooperados.length]);

  const cooperadosFiltrados = useMemo(() => {
    if (!buscaCooperado.trim()) return cooperados;
    const termo = buscaCooperado.toLowerCase();
    return cooperados.filter(
      (c) => c.nomeCompleto.toLowerCase().includes(termo) || c.telefone.includes(termo),
    );
  }, [cooperados, buscaCooperado]);

  const toggleCooperado = useCallback((id: string) => {
    setSelecionados((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleTodos = useCallback(() => {
    if (selecionados.size === cooperadosFiltrados.length) {
      setSelecionados(new Set());
    } else {
      setSelecionados(new Set(cooperadosFiltrados.map((c) => c.id)));
    }
  }, [cooperadosFiltrados, selecionados.size]);

  const adicionarTelefone = useCallback(() => {
    const tel = telefoneInput.replace(/\D/g, '').trim();
    if (tel.length >= 10 && !telefones.includes(tel)) {
      setTelefones((prev) => [...prev, tel]);
      setTelefoneInput('');
    }
  }, [telefoneInput, telefones]);

  const removerTelefone = useCallback((tel: string) => {
    setTelefones((prev) => prev.filter((t) => t !== tel));
  }, []);

  const modoLabel: Record<Modo, string> = {
    todos: 'Todos os cooperados',
    parceiro: 'Por parceiro/cooperativa',
    lista: 'Por telefone (lista manual)',
    cooperados: 'Selecionar cooperados',
  };

  const podeDisparar =
    isConnected &&
    !loading &&
    (modo === 'todos' ||
      (modo === 'parceiro' && parceiroId) ||
      (modo === 'lista' && telefones.length > 0) ||
      (modo === 'cooperados' && selecionados.size > 0));

  const resumoAlvo = (): string => {
    if (modo === 'parceiro') {
      const p = parceiros.find((p) => p.id === parceiroId);
      return p ? `cooperados de "${p.nome}"` : 'cooperados do parceiro selecionado';
    }
    if (modo === 'lista') return `${telefones.length} telefone(s) selecionado(s)`;
    if (modo === 'cooperados') return `${selecionados.size} cooperado(s) selecionado(s)`;
    return 'todos os cooperados';
  };

  async function executar() {
    setLoading(true);
    setResultado(null);
    try {
      let params: { modo: Modo; parceiroId?: string; telefones?: string[]; limiteEnvios?: number };

      if (modo === 'cooperados') {
        // Converter selecionados em lista de telefones
        const tels = cooperados
          .filter((c) => selecionados.has(c.id))
          .map((c) => c.telefone);
        params = { modo: 'lista', telefones: tels, limiteEnvios };
      } else {
        params = {
          modo,
          parceiroId: modo === 'parceiro' ? parceiroId : undefined,
          telefones: modo === 'lista' ? telefones : undefined,
          limiteEnvios,
        };
      }

      const res = await onDisparo(params);
      setResultado(res);
    } catch {
      setResultado({ total: 0, enviados: 0, erros: -1 });
    } finally {
      setLoading(false);
      setConfirm(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-semibold text-gray-700 flex items-center gap-2">
          <Icon className="h-4 w-4" /> {titulo}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {descricao && <p className="text-xs text-gray-500">{descricao}</p>}

        {/* Conteúdo extra (ex: campo mesReferencia) */}
        {children}

        {/* Seletor de modo */}
        <div>
          <label className={lbl}>Destinatários</label>
          <select
            className={cls}
            value={modo}
            onChange={(e) => {
              setModo(e.target.value as Modo);
              setConfirm(false);
              setResultado(null);
            }}
          >
            {(Object.keys(modoLabel) as Modo[]).map((m) => (
              <option key={m} value={m}>{modoLabel[m]}</option>
            ))}
          </select>
        </div>

        {/* Parceiro select */}
        {modo === 'parceiro' && (
          <div>
            <label className={lbl}>Parceiro / Cooperativa</label>
            {loadingParceiros ? (
              <div className="flex items-center gap-2 text-xs text-gray-400 py-2">
                <Loader2 className="h-3 w-3 animate-spin" /> Carregando parceiros...
              </div>
            ) : (
              <select
                className={cls}
                value={parceiroId}
                onChange={(e) => setParceiroId(e.target.value)}
              >
                <option value="">Selecione um parceiro</option>
                {parceiros.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nome}
                  </option>
                ))}
              </select>
            )}
          </div>
        )}

        {/* Lista de telefones */}
        {modo === 'lista' && (
          <div>
            <label className={lbl}>Telefones</label>
            <div className="flex gap-2">
              <input
                className={cls}
                value={telefoneInput}
                onChange={(e) => setTelefoneInput(e.target.value)}
                placeholder="(27) 99999-0000"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    adicionarTelefone();
                  }
                }}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={adicionarTelefone}
                disabled={telefoneInput.replace(/\D/g, '').length < 10}
                className="shrink-0"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            {telefones.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {telefones.map((tel) => (
                  <span
                    key={tel}
                    className="inline-flex items-center gap-1 bg-green-50 text-green-700 text-xs px-2 py-1 rounded-full border border-green-200"
                  >
                    {tel.replace(/(\d{2})(\d{2})(\d{5})(\d{4})/, '+$1 ($2) $3-$4')}
                    <button
                      type="button"
                      onClick={() => removerTelefone(tel)}
                      className="text-green-500 hover:text-red-500 transition-colors"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Seleção de cooperados */}
        {modo === 'cooperados' && (
          <div>
            {loadingCooperados ? (
              <div className="flex items-center gap-2 text-xs text-gray-400 py-4">
                <Loader2 className="h-3 w-3 animate-spin" /> Carregando cooperados...
              </div>
            ) : (
              <div className="space-y-2">
                {/* Busca */}
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-gray-400" />
                  <input
                    className={`${cls} pl-8`}
                    value={buscaCooperado}
                    onChange={(e) => setBuscaCooperado(e.target.value)}
                    placeholder="Buscar por nome ou telefone..."
                  />
                </div>

                {/* Selecionar/Desmarcar todos + contador */}
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={toggleTodos}
                    className="text-xs text-green-700 hover:text-green-900 font-medium"
                  >
                    {selecionados.size === cooperadosFiltrados.length && cooperadosFiltrados.length > 0
                      ? 'Desmarcar todos'
                      : 'Selecionar todos'}
                  </button>
                  <span className="text-xs text-gray-500">
                    {selecionados.size} selecionado{selecionados.size !== 1 ? 's' : ''}
                  </span>
                </div>

                {/* Aviso se muitos selecionados */}
                {selecionados.size > 30 && (
                  <div className="flex items-start gap-2 bg-yellow-50 border border-yellow-200 rounded-md p-2 text-xs text-yellow-800">
                    <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                    <span>Muitas mensagens de uma vez podem gerar bloqueio. Recomendamos no máximo 30 por hora.</span>
                  </div>
                )}

                {/* Lista de cooperados */}
                <div className="max-h-56 overflow-y-auto border border-gray-200 rounded-md divide-y divide-gray-100">
                  {cooperadosFiltrados.length === 0 ? (
                    <div className="text-xs text-gray-400 text-center py-4">Nenhum cooperado encontrado</div>
                  ) : (
                    cooperadosFiltrados.map((c) => (
                      <label
                        key={c.id}
                        className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 cursor-pointer text-sm"
                      >
                        <input
                          type="checkbox"
                          checked={selecionados.has(c.id)}
                          onChange={() => toggleCooperado(c.id)}
                          className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                        />
                        <span className="flex-1 truncate">
                          {c.nomeCompleto}{' '}
                          <span className="text-gray-400 text-xs">({c.telefone})</span>
                        </span>
                        <span className={`text-xs px-1.5 py-0.5 rounded-full ${STATUS_BADGE[c.status] ?? 'bg-gray-100 text-gray-600'}`}>
                          {c.status}
                        </span>
                      </label>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Configurações avançadas */}
        <div>
          <button
            type="button"
            onClick={() => setMostrarAvancado(!mostrarAvancado)}
            className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700"
          >
            {mostrarAvancado ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            Configurações avançadas
          </button>
          {mostrarAvancado && (
            <div className="mt-2 p-3 bg-gray-50 rounded-md border border-gray-200 space-y-2">
              <label className={lbl}>Limite de envios por sessão</label>
              <input
                type="number"
                className={cls}
                value={limiteEnvios}
                onChange={(e) => {
                  const v = parseInt(e.target.value) || 1;
                  setLimiteEnvios(Math.max(1, Math.min(100, v)));
                }}
                min={1}
                max={100}
              />
              <p className="text-xs text-gray-400">Limite recomendado: 30/hora para evitar bloqueio pelo WhatsApp</p>
            </div>
          )}
        </div>

        {/* Botão / Confirmação */}
        {!confirm ? (
          <Button
            onClick={() => setConfirm(true)}
            disabled={!podeDisparar}
            className="w-full"
            variant="outline"
          >
            <Icon className="h-4 w-4 mr-2" />
            {titulo}
          </Button>
        ) : (
          <div className="space-y-2">
            <p className="text-xs text-orange-600 font-medium">
              Tem certeza? Isso enviará mensagens para {resumoAlvo()}.
            </p>
            <div className="flex gap-2">
              <Button
                onClick={executar}
                disabled={loading}
                className="flex-1"
                variant="default"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  'Confirmar envio'
                )}
              </Button>
              <Button
                onClick={() => setConfirm(false)}
                variant="ghost"
                className="flex-1"
              >
                Cancelar
              </Button>
            </div>
          </div>
        )}

        {/* Resultado */}
        {resultado && (
          <div
            className={`text-xs p-2 rounded ${
              resultado.erros === -1
                ? 'bg-red-50 text-red-600'
                : resultado.limitado
                  ? 'bg-yellow-50 text-yellow-800'
                  : 'bg-green-50 text-green-700'
            }`}
          >
            {resultado.erros === -1
              ? 'Erro ao disparar. Verifique os logs.'
              : resultado.limitado
                ? `Envio limitado: ${resultado.enviados} mensagens enviadas. Restam ${resultado.totalNaoEnviados ?? 0}. Aguarde antes de enviar novamente.`
                : `Resultado: ${resultado.enviados} enviados de ${resultado.total} | ${resultado.erros} erros`}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
