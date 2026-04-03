'use client';

import { useState, useEffect } from 'react';
import api from '@/lib/api';

interface Step2Props {
  defaultValues: Record<string, unknown>;
  onSubmit: (dados: Record<string, unknown>) => void;
}

type OpcaoUsina = 'sim' | 'nao' | 'depois' | null;
type ModoUsina = 'existente' | 'nova' | null;

const DISTRIBUIDORAS = ['EDP ES', 'CEMIG', 'CELESC', 'ENEL', 'CPFL', 'Outra'];
const STATUS_OPTIONS = [
  { value: 'EM_PRODUCAO', label: 'Em produção' },
  { value: 'EM_IMPLANTACAO', label: 'Em implantação' },
  { value: 'AGUARDANDO_HOMOLOGACAO', label: 'Aguardando homologação' },
];

const cls = 'w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500';
const lbl = 'block text-xs font-medium text-neutral-600 mb-1';

export default function Step2Usina({ defaultValues, onSubmit }: Step2Props) {
  const defaultOpcao: OpcaoUsina = defaultValues?.modo
    ? 'sim'
    : defaultValues?.opcaoUsina === 'nao'
    ? 'nao'
    : defaultValues?.opcaoUsina === 'depois'
    ? 'depois'
    : null;

  const [opcao, setOpcao] = useState<OpcaoUsina>(defaultOpcao);
  const [modo, setModo] = useState<ModoUsina>(
    (defaultValues?.modo as ModoUsina) || null
  );
  const [usinaId, setUsinaId] = useState((defaultValues?.usinaId as string) || '');
  const [usinas, setUsinas] = useState<Array<Record<string, unknown>>>([]);
  const [carregando, setCarregando] = useState(false);

  const [form, setForm] = useState({
    nome: (defaultValues?.nome as string) || '',
    potenciaKwp: (defaultValues?.potenciaKwp as string) || '',
    cidade: (defaultValues?.cidade as string) || '',
    estado: (defaultValues?.estado as string) || '',
    distribuidora: (defaultValues?.distribuidora as string) || '',
    statusHomologacao: (defaultValues?.statusHomologacao as string) || 'EM_PRODUCAO',
    proprietarioProprio: (defaultValues?.proprietarioProprio as boolean) ?? true,
    proprietarioNome: (defaultValues?.proprietarioNome as string) || '',
    proprietarioCpf: (defaultValues?.proprietarioCpf as string) || '',
    proprietarioTelefone: (defaultValues?.proprietarioTelefone as string) || '',
  });

  function set(campo: string, valor: string | boolean) {
    setForm((prev) => ({ ...prev, [campo]: valor }));
  }

  useEffect(() => {
    if (modo === 'existente') {
      setCarregando(true);
      api.get('/usinas')
        .then(({ data }) => {
          const lista = (Array.isArray(data) ? data : []).map((u: Record<string, unknown>) => {
            const contratos = (u.contratos as Array<Record<string, unknown>>) || [];
            const somaContratos = contratos.reduce(
              (acc: number, c: Record<string, unknown>) => acc + (Number(c.percentualUsina) || 0),
              0,
            );
            return { ...u, percentualOcupado: somaContratos, percentualLivre: 100 - somaContratos };
          });
          setUsinas(lista);
        })
        .catch(() => setUsinas([]))
        .finally(() => setCarregando(false));
    }
  }, [modo]);

  function handleSubmit() {
    if (opcao === 'nao' || opcao === 'depois') {
      onSubmit({ modo: null, opcaoUsina: opcao });
      return;
    }
    if (modo === 'existente') {
      onSubmit({ modo: 'existente', usinaId, opcaoUsina: 'sim' });
    } else if (modo === 'nova') {
      onSubmit({ modo: 'nova', ...form, opcaoUsina: 'sim' });
    } else {
      onSubmit({ modo: null, opcaoUsina: opcao });
    }
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-neutral-800">Usina Solar</h2>
      <p className="text-sm text-neutral-500">Este parceiro possui usinas solares?</p>

      {/* Top-level choice: Sim / Não / Adicionar depois */}
      <div className="flex gap-3">
        {([
          { value: 'sim' as const, label: 'Sim', desc: 'Cadastrar ou vincular usina agora' },
          { value: 'nao' as const, label: 'Não', desc: 'Parceiro não possui usinas' },
          { value: 'depois' as const, label: 'Adicionar depois', desc: 'Configurar em outro momento' },
        ]).map((opt) => (
          <button
            key={opt.value}
            onClick={() => {
              setOpcao(opt.value);
              if (opt.value !== 'sim') setModo(null);
            }}
            className={`flex-1 text-left p-4 rounded-lg border-2 transition ${
              opcao === opt.value
                ? 'border-green-500 bg-green-50'
                : 'border-neutral-200 hover:border-neutral-300'
            }`}
          >
            <p className="font-medium text-sm text-neutral-800">{opt.label}</p>
            <p className="text-xs text-neutral-500 mt-1">{opt.desc}</p>
          </button>
        ))}
      </div>

      {/* If Sim: show existing/nova selector */}
      {opcao === 'sim' && (
        <div className="space-y-4 border-t border-neutral-100 pt-4">
          <div>
            <label className={lbl}>Como deseja configurar?</label>
            <div className="flex gap-3 mt-1">
              {(['existente', 'nova'] as const).map((opt) => (
                <button
                  key={opt}
                  onClick={() => setModo(opt)}
                  className={`px-4 py-2 text-sm rounded-lg border transition ${
                    modo === opt
                      ? 'bg-green-50 border-green-500 text-green-700 font-medium'
                      : 'border-neutral-300 text-neutral-600 hover:bg-neutral-50'
                  }`}
                >
                  {opt === 'existente' ? 'Selecionar existente' : 'Cadastrar nova'}
                </button>
              ))}
            </div>
          </div>

          {modo === 'existente' && (
            <div>
              {carregando ? (
                <p className="text-sm text-neutral-400">Carregando usinas...</p>
              ) : usinas.length === 0 ? (
                <p className="text-sm text-neutral-500">Nenhuma usina cadastrada.</p>
              ) : (
                <div>
                  <label className={lbl}>Selecione a usina</label>
                  <div className="space-y-2">
                    {usinas.map((u) => (
                      <div
                        key={u.id as string}
                        onClick={() => setUsinaId(u.id as string)}
                        className={`cursor-pointer border rounded-lg p-3 transition ${
                          usinaId === u.id
                            ? 'border-green-500 bg-green-50 ring-1 ring-green-400'
                            : 'border-neutral-200 hover:border-neutral-300'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="text-sm font-medium">{u.nome as string}</span>
                            <span className="text-xs text-neutral-400 ml-2">
                              {u.potenciaKwp as number} kWp{u.cidade ? ` — ${u.cidade}/${u.estado}` : ''}
                            </span>
                          </div>
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                            (u.percentualLivre as number) > 50
                              ? 'bg-green-100 text-green-700'
                              : (u.percentualLivre as number) > 0
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-red-100 text-red-700'
                          }`}>
                            {(u.percentualLivre as number).toFixed(1)}% livre
                          </span>
                        </div>
                        <div className="mt-1.5 w-full bg-neutral-200 rounded-full h-1.5">
                          <div
                            className={`h-1.5 rounded-full transition-all ${
                              (u.percentualLivre as number) > 50 ? 'bg-green-500' : (u.percentualLivre as number) > 0 ? 'bg-amber-500' : 'bg-red-500'
                            }`}
                            style={{ width: `${Math.max(0, u.percentualLivre as number)}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {modo === 'nova' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={lbl}>Nome da usina</label>
                  <input className={cls} value={form.nome} onChange={(e) => set('nome', e.target.value)} />
                </div>
                <div>
                  <label className={lbl}>Potência (kWp)</label>
                  <input className={cls} type="number" step="0.01" value={form.potenciaKwp} onChange={(e) => set('potenciaKwp', e.target.value)} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={lbl}>Cidade</label>
                  <input className={cls} value={form.cidade} onChange={(e) => set('cidade', e.target.value)} />
                </div>
                <div>
                  <label className={lbl}>Estado</label>
                  <input className={cls} value={form.estado} onChange={(e) => set('estado', e.target.value)} maxLength={2} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={lbl}>Distribuidora</label>
                  <select className={cls} value={form.distribuidora} onChange={(e) => set('distribuidora', e.target.value)}>
                    <option value="">Selecione...</option>
                    {DISTRIBUIDORAS.map((d) => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div>
                  <label className={lbl}>Status</label>
                  <select className={cls} value={form.statusHomologacao} onChange={(e) => set('statusHomologacao', e.target.value)}>
                    {STATUS_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </div>
              </div>

              <div className="border-t border-neutral-100 pt-4">
                <label className="flex items-center gap-2 text-sm text-neutral-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.proprietarioProprio}
                    onChange={(e) => set('proprietarioProprio', e.target.checked)}
                    className="rounded border-neutral-300 text-green-600 focus:ring-green-500"
                  />
                  O proprietário é o próprio parceiro
                </label>
              </div>

              {!form.proprietarioProprio && (
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className={lbl}>Nome do proprietário</label>
                    <input className={cls} value={form.proprietarioNome} onChange={(e) => set('proprietarioNome', e.target.value)} />
                  </div>
                  <div>
                    <label className={lbl}>CPF</label>
                    <input className={cls} value={form.proprietarioCpf} onChange={(e) => set('proprietarioCpf', e.target.value)} />
                  </div>
                  <div>
                    <label className={lbl}>Telefone</label>
                    <input className={cls} value={form.proprietarioTelefone} onChange={(e) => set('proprietarioTelefone', e.target.value)} />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Feedback for Não / Depois */}
      {opcao === 'nao' && (
        <div className="p-4 bg-neutral-50 border border-neutral-200 rounded-lg">
          <p className="text-sm text-neutral-600">
            Tudo bem! O parceiro poderá cadastrar usinas depois no painel de administração.
          </p>
        </div>
      )}

      {opcao === 'depois' && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
          <p className="text-sm text-amber-700">
            A usina poderá ser adicionada a qualquer momento em Configurações &rarr; Usinas.
          </p>
        </div>
      )}

      {opcao && (
        <div className="pt-2 flex justify-end">
          <button
            onClick={handleSubmit}
            className="px-5 py-2.5 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700"
          >
            Próximo
          </button>
        </div>
      )}
    </div>
  );
}
