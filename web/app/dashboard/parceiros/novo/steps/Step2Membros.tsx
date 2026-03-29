'use client';

import { useState, useCallback } from 'react';
import api from '@/lib/api';
import { Search, Plus, X, User, Home } from 'lucide-react';

interface Step2MembrosProps {
  tipoParceiro: string;
  onSubmit: (dados: any) => void;
}

interface CooperadoResult {
  id: string;
  nomeCompleto: string;
  cpf: string;
  email?: string;
}

interface MembroSelecionado {
  id?: string;
  nomeCompleto: string;
  cpf: string;
  email: string;
  isNovo: boolean;
}

interface UnidadeCondominio {
  numero: string;
  condominoNome: string;
}

const cls = 'w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500';
const lbl = 'block text-xs font-medium text-neutral-600 mb-1';

function maskCpf(v: string) {
  return v.replace(/\D/g, '').slice(0, 11)
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
}

function MembrosCooperativa({ membros, setMembros }: {
  membros: MembroSelecionado[];
  setMembros: (m: MembroSelecionado[]) => void;
}) {
  const [busca, setBusca] = useState('');
  const [resultados, setResultados] = useState<CooperadoResult[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [mostrarNovo, setMostrarNovo] = useState(false);
  const [novo, setNovo] = useState({ nomeCompleto: '', cpf: '', email: '' });

  const pesquisar = useCallback(async (termo: string) => {
    if (termo.length < 3) {
      setResultados([]);
      return;
    }
    setBuscando(true);
    try {
      const { data } = await api.get(`/cooperados?search=${encodeURIComponent(termo)}&limit=10`);
      const lista = Array.isArray(data) ? data : data.data ?? [];
      setResultados(lista);
    } catch {
      setResultados([]);
    } finally {
      setBuscando(false);
    }
  }, []);

  function adicionarExistente(c: CooperadoResult) {
    if (membros.some((m) => m.id === c.id)) return;
    setMembros([...membros, { id: c.id, nomeCompleto: c.nomeCompleto, cpf: c.cpf, email: c.email || '', isNovo: false }]);
    setBusca('');
    setResultados([]);
  }

  function adicionarNovo() {
    if (!novo.nomeCompleto.trim() || !novo.cpf.trim()) return;
    setMembros([...membros, { ...novo, isNovo: true }]);
    setNovo({ nomeCompleto: '', cpf: '', email: '' });
    setMostrarNovo(false);
  }

  function remover(idx: number) {
    setMembros(membros.filter((_, i) => i !== idx));
  }

  return (
    <div className="space-y-4">
      {/* Search existing cooperados */}
      <div>
        <label className={lbl}>Buscar cooperado existente (CPF ou nome)</label>
        <div className="relative">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-neutral-400" />
          <input
            className={`${cls} pl-9`}
            value={busca}
            onChange={(e) => {
              setBusca(e.target.value);
              pesquisar(e.target.value);
            }}
            placeholder="Digite CPF ou nome..."
          />
        </div>
        {buscando && <p className="text-xs text-neutral-400 mt-1">Buscando...</p>}
        {resultados.length > 0 && (
          <div className="mt-1 border border-neutral-200 rounded-lg max-h-40 overflow-y-auto bg-white shadow-sm">
            {resultados.map((c) => (
              <button
                key={c.id}
                onClick={() => adicionarExistente(c)}
                className="w-full text-left px-3 py-2 text-sm hover:bg-green-50 flex items-center justify-between border-b border-neutral-100 last:border-0"
              >
                <span>{c.nomeCompleto}</span>
                <span className="text-xs text-neutral-400">{c.cpf}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Add new cooperado inline */}
      {!mostrarNovo ? (
        <button
          onClick={() => setMostrarNovo(true)}
          className="flex items-center gap-1.5 text-sm text-green-600 hover:text-green-700 font-medium"
        >
          <Plus className="w-4 h-4" /> Cadastrar novo membro
        </button>
      ) : (
        <div className="border border-green-200 rounded-lg p-4 bg-green-50/50 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-green-700">Novo membro</span>
            <button onClick={() => setMostrarNovo(false)} className="text-neutral-400 hover:text-neutral-600">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={lbl}>Nome completo *</label>
              <input className={cls} value={novo.nomeCompleto} onChange={(e) => setNovo({ ...novo, nomeCompleto: e.target.value })} />
            </div>
            <div>
              <label className={lbl}>CPF *</label>
              <input className={cls} value={novo.cpf} onChange={(e) => setNovo({ ...novo, cpf: maskCpf(e.target.value) })} placeholder="000.000.000-00" />
            </div>
            <div>
              <label className={lbl}>Email</label>
              <input className={cls} type="email" value={novo.email} onChange={(e) => setNovo({ ...novo, email: e.target.value })} />
            </div>
          </div>
          <button
            onClick={adicionarNovo}
            disabled={!novo.nomeCompleto.trim() || !novo.cpf.trim()}
            className="px-4 py-1.5 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Adicionar
          </button>
        </div>
      )}

      {/* Selected members list */}
      {membros.length > 0 && (
        <div>
          <label className={lbl}>Membros selecionados ({membros.length})</label>
          <div className="border border-neutral-200 rounded-lg divide-y divide-neutral-100">
            {membros.map((m, i) => (
              <div key={i} className="flex items-center justify-between px-3 py-2">
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-neutral-400" />
                  <span className="text-sm">{m.nomeCompleto}</span>
                  <span className="text-xs text-neutral-400">{m.cpf}</span>
                  {m.isNovo && <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-medium">Novo</span>}
                </div>
                <button onClick={() => remover(i)} className="text-neutral-400 hover:text-red-500">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function UnidadesCondominio({ unidades, setUnidades }: {
  unidades: UnidadeCondominio[];
  setUnidades: (u: UnidadeCondominio[]) => void;
}) {
  const [numero, setNumero] = useState('');
  const [condominoNome, setCondominoNome] = useState('');

  function adicionar() {
    if (!numero.trim()) return;
    if (unidades.some((u) => u.numero === numero.trim())) return;
    setUnidades([...unidades, { numero: numero.trim(), condominoNome: condominoNome.trim() }]);
    setNumero('');
    setCondominoNome('');
  }

  function remover(idx: number) {
    setUnidades(unidades.filter((_, i) => i !== idx));
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3 items-end">
        <div>
          <label className={lbl}>Número da unidade *</label>
          <input
            className={cls}
            value={numero}
            onChange={(e) => setNumero(e.target.value)}
            placeholder="Ex: 101, Bloco A-201"
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); adicionar(); } }}
          />
        </div>
        <div>
          <label className={lbl}>Condômino (opcional)</label>
          <input
            className={cls}
            value={condominoNome}
            onChange={(e) => setCondominoNome(e.target.value)}
            placeholder="Nome do condômino"
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); adicionar(); } }}
          />
        </div>
        <button
          onClick={adicionar}
          disabled={!numero.trim()}
          className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Plus className="w-4 h-4 inline mr-1" />
          Adicionar
        </button>
      </div>

      {unidades.length > 0 && (
        <div>
          <label className={lbl}>Unidades cadastradas ({unidades.length})</label>
          <div className="border border-neutral-200 rounded-lg divide-y divide-neutral-100">
            {unidades.map((u, i) => (
              <div key={i} className="flex items-center justify-between px-3 py-2">
                <div className="flex items-center gap-2">
                  <Home className="w-4 h-4 text-neutral-400" />
                  <span className="text-sm font-medium">{u.numero}</span>
                  {u.condominoNome && <span className="text-xs text-neutral-500">— {u.condominoNome}</span>}
                </div>
                <button onClick={() => remover(i)} className="text-neutral-400 hover:text-red-500">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function Step2Membros({ tipoParceiro, onSubmit }: Step2MembrosProps) {
  const [membros, setMembros] = useState<MembroSelecionado[]>([]);
  const [unidades, setUnidades] = useState<UnidadeCondominio[]>([]);

  const isCondominio = tipoParceiro === 'CONDOMINIO';
  const tipoLabel = isCondominio ? 'Unidades' : 'Membros';

  function handleSubmit() {
    if (isCondominio) {
      onSubmit({ tipo: 'unidades', unidades });
    } else {
      onSubmit({ tipo: 'membros', membros });
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-neutral-800">{tipoLabel}</h2>
        <p className="text-sm text-neutral-500 mt-1">
          {isCondominio
            ? 'Cadastre as unidades do condomínio. Você pode adicionar condôminos depois.'
            : 'Busque cooperados existentes ou cadastre novos membros. Este passo é opcional.'}
        </p>
      </div>

      {isCondominio ? (
        <UnidadesCondominio unidades={unidades} setUnidades={setUnidades} />
      ) : (
        <MembrosCooperativa membros={membros} setMembros={setMembros} />
      )}

      <div className="pt-2 flex justify-between items-center">
        <p className="text-xs text-neutral-400">
          {isCondominio
            ? unidades.length === 0 ? 'Nenhuma unidade adicionada (opcional)' : `${unidades.length} unidade(s)`
            : membros.length === 0 ? 'Nenhum membro adicionado (opcional)' : `${membros.length} membro(s)`}
        </p>
        <button
          onClick={handleSubmit}
          className="px-5 py-2.5 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700"
        >
          Próximo
        </button>
      </div>
    </div>
  );
}
