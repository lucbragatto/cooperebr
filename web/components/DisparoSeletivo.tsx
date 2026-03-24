'use client';

import { useCallback, useEffect, useState } from 'react';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, X, Plus, Users, Building2 } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

const cls = 'w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500';
const lbl = 'block text-xs font-medium text-gray-600 mb-1';

type Modo = 'todos' | 'parceiro' | 'lista';

interface Parceiro {
  id: string;
  nome: string;
}

interface ResultadoDisparo {
  total: number;
  enviados: number;
  erros: number;
}

interface DisparoSeletivoProps {
  titulo: string;
  descricao?: string;
  icon: LucideIcon;
  isConnected: boolean;
  onDisparo: (params: { modo: Modo; parceiroId?: string; telefones?: string[] }) => Promise<ResultadoDisparo>;
  children?: React.ReactNode;
}

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
  };

  const podeDisparar =
    isConnected &&
    !loading &&
    (modo === 'todos' ||
      (modo === 'parceiro' && parceiroId) ||
      (modo === 'lista' && telefones.length > 0));

  const resumoAlvo = (): string => {
    if (modo === 'parceiro') {
      const p = parceiros.find((p) => p.id === parceiroId);
      return p ? `cooperados de "${p.nome}"` : 'cooperados do parceiro selecionado';
    }
    if (modo === 'lista') return `${telefones.length} telefone(s) selecionado(s)`;
    return 'todos os cooperados';
  };

  async function executar() {
    setLoading(true);
    setResultado(null);
    try {
      const res = await onDisparo({
        modo,
        parceiroId: modo === 'parceiro' ? parceiroId : undefined,
        telefones: modo === 'lista' ? telefones : undefined,
      });
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
                : 'bg-green-50 text-green-700'
            }`}
          >
            {resultado.erros === -1
              ? 'Erro ao disparar. Verifique os logs.'
              : `Resultado: ${resultado.enviados} enviados de ${resultado.total} | ${resultado.erros} erros`}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
