'use client';

/**
 * D-novo-CT-CT.8 (01/06/2026) — Plano de Contas Segregado com classificação INLINE.
 *
 * Substitui a versão read-only anterior que tinha aviso enganoso mandando
 * "editar em /dashboard/configuracoes/financeiro" (Régua de Cobrança — nada
 * a ver). Agora: edição inline Tipo A célula-a-célula com select nativo
 * (regra `solucao_select_nativo_dentro_dialog_19_05`).
 *
 * MULTI-TIPO (P0-1 do relatório 2026-05-31-conformidade-contabil-multi-regime):
 * classificação cooperativa (Próprio/Auxiliar/Não-Coop, Arts. 79/86/88) é
 * EXCLUSIVA de parceiro COOPERATIVA. Consórcio/Associação/Condomínio têm
 * regime próprio — a coluna "Natureza Cooperativa" mostra "— não se aplica".
 *
 * Gating:
 *  - SUPER_ADMIN  → todas as contas editáveis (globais + tenant)
 *  - ADMIN        → editável só onde cooperativaId === user.cooperativaId
 *                   (globais → read-only, tooltip "classificadas pelo administrador
 *                   da plataforma")
 *  - OPERADOR     → read-only total
 */

import { useEffect, useState, useMemo } from 'react';
import api from '@/lib/api';
import { getUsuario } from '@/lib/auth';
import { useTipoParceiro } from '@/hooks/useTipoParceiro';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Library, Check, X as XIcon, AlertTriangle } from 'lucide-react';

type Conta = {
  id: string;
  codigo: string;
  nome: string;
  tipo: string;
  ativo: boolean;
  cooperativaId: string | null;
  naturezaContabil: string | null;
  naturezaCooperativa: string | null;
  fundamentoLegal: string | null;
};

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

const NATUREZA_COOPERATIVA_OPCOES = [
  { value: '', label: '— selecionar —' },
  { value: 'PROPRIO', label: 'PRÓPRIO (Art. 79)' },
  { value: 'AUXILIAR', label: 'AUXILIAR (Art. 88)' },
  { value: 'NAO_COOPERATIVO', label: 'NÃO-COOPERATIVO (Art. 86)' },
] as const;

const NATUREZA_CONTABIL_OPCOES = [
  { value: '', label: '— selecionar —' },
  { value: 'ATIVO', label: 'ATIVO' },
  { value: 'PASSIVO', label: 'PASSIVO' },
  { value: 'PATRIMONIO_LIQUIDO', label: 'PATRIMÔNIO LÍQUIDO' },
  { value: 'RECEITA_ATO_PROPRIO', label: 'Receita Ato Próprio' },
  { value: 'RECEITA_ATO_AUXILIAR', label: 'Receita Ato Auxiliar' },
  { value: 'RECEITA_NAO_COOPERATIVO', label: 'Receita Não-Coop' },
  { value: 'DESPESA_ATO_PROPRIO', label: 'Despesa Ato Próprio' },
  { value: 'DESPESA_ATO_AUXILIAR', label: 'Despesa Ato Auxiliar' },
  { value: 'DESPESA_NAO_COOPERATIVO', label: 'Despesa Não-Coop' },
  { value: 'FUNDOS_OBRIGATORIOS', label: 'Fundos Obrigatórios (FR/FATES)' },
  { value: 'SOBRAS_DISTRIBUIVEIS', label: 'Sobras Distribuíveis' },
  { value: 'RESULTADO_NAO_COOPERATIVO', label: 'Resultado Não-Coop' },
] as const;

const CORES_COOPERATIVA: Record<string, string> = {
  PROPRIO: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  AUXILIAR: 'bg-blue-100 text-blue-800 border-blue-300',
  NAO_COOPERATIVO: 'bg-rose-100 text-rose-800 border-rose-300',
};

export default function PlanoContasSegregadoPage() {
  const [contas, setContas] = useState<Conta[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const [linhaSave, setLinhaSave] = useState<Record<string, SaveState>>({});
  const [linhaErro, setLinhaErro] = useState<Record<string, string>>({});
  const [perfil, setPerfil] = useState<string>('');
  const [coopIdUser, setCoopIdUser] = useState<string | null>(null);

  const { tipoParceiro } = useTipoParceiro();
  // null = SUPER_ADMIN sem tenant fixo. CoopereBR = COOPERATIVA.
  const isCoop = tipoParceiro === 'COOPERATIVA' || tipoParceiro === null;
  const ehSuperAdmin = perfil === 'SUPER_ADMIN';
  const podeEditar = perfil === 'ADMIN' || ehSuperAdmin;

  useEffect(() => {
    const u = getUsuario() as (typeof getUsuario extends () => infer R ? R : never) & {
      cooperativaId?: string | null;
    } | null;
    setPerfil(u?.perfil ?? '');
    setCoopIdUser(u?.cooperativaId ?? null);

    api
      .get<Conta[]>('/financeiro/plano-contas')
      .then((r) => setContas(r.data))
      .catch((err) => setErro(err?.response?.data?.message || 'Falha ao carregar'))
      .finally(() => setLoading(false));
  }, []);

  const total = contas.length;
  const segregadas = useMemo(
    () => contas.filter((c) => c.naturezaContabil).length,
    [contas],
  );
  const pendentes = total - segregadas;

  function podeEditarConta(c: Conta): boolean {
    if (!podeEditar) return false;
    if (ehSuperAdmin) return true;
    // ADMIN: só própria coop
    return c.cooperativaId !== null && c.cooperativaId === coopIdUser;
  }

  async function patchClassificacao(
    contaId: string,
    payload: { naturezaCooperativa?: string | null; naturezaContabil?: string | null; fundamentoLegal?: string | null },
    valorAnterior: Partial<Conta>,
  ) {
    setLinhaSave((s) => ({ ...s, [contaId]: 'saving' }));
    setLinhaErro((e) => ({ ...e, [contaId]: '' }));

    // Otimista: já atualiza UI
    setContas((lista) =>
      lista.map((c) =>
        c.id === contaId
          ? {
              ...c,
              ...('naturezaCooperativa' in payload
                ? { naturezaCooperativa: payload.naturezaCooperativa ?? null }
                : {}),
              ...('naturezaContabil' in payload
                ? { naturezaContabil: payload.naturezaContabil ?? null }
                : {}),
              ...('fundamentoLegal' in payload
                ? { fundamentoLegal: payload.fundamentoLegal ?? null }
                : {}),
            }
          : c,
      ),
    );

    try {
      await api.patch(`/financeiro/plano-contas/${contaId}/classificacao`, payload);
      setLinhaSave((s) => ({ ...s, [contaId]: 'saved' }));
      // Fade do ✓ após 1.5s
      setTimeout(() => {
        setLinhaSave((s) => {
          if (s[contaId] === 'saved') return { ...s, [contaId]: 'idle' };
          return s;
        });
      }, 1500);
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Falha ao salvar';
      setLinhaErro((e) => ({ ...e, [contaId]: String(msg) }));
      setLinhaSave((s) => ({ ...s, [contaId]: 'error' }));
      // Reverte valor
      setContas((lista) =>
        lista.map((c) => (c.id === contaId ? { ...c, ...valorAnterior } : c)),
      );
    }
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <Library className="h-6 w-6 text-cyan-700" />
          Plano de Contas Segregado
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Classificação cooperativa (Art. 79/86/88 Lei 5.764/71) — base da defesa fiscal
        </p>
      </div>

      {/* Aviso adaptado ao tipoParceiro (CT.8 — multi-tipo) */}
      {isCoop ? (
        <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded text-xs text-blue-800">
          <p>
            <strong>Classifique cada conta abaixo</strong> (Próprio / Auxiliar / Não-Coop +
            fundamento legal). A classificação cooperativa{' '}
            <span className="text-emerald-700 font-semibold">PRÓPRIO</span> é isenta (Art. 79),{' '}
            <span className="text-blue-700 font-semibold">AUXILIAR</span> neutra (Art. 88),{' '}
            <span className="text-rose-700 font-semibold">NÃO-COOP</span> tributada (Art. 86).
          </p>
          <p className="mt-2 bg-amber-50 border border-amber-300 rounded p-2 text-amber-800">
            ⚠️ Classificação <strong>SUGERIDA</strong> — valide com seu contador antes de uso fiscal real
            (DCTF/SPED). Gate Walter: enquanto não validado, números são pré-validação.
          </p>
        </div>
      ) : (
        <div className="bg-amber-50 border-l-4 border-amber-500 p-4 rounded text-xs text-amber-900">
          <p className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
            <span>
              Este parceiro é <strong>{tipoParceiro}</strong>. A classificação de ato cooperativo (Art. 79/86/88,
              Lei 5.764/71) <strong>NÃO se aplica</strong> — o regime tributário próprio será definido com seu
              contador. Você pode registrar <strong>natureza contábil</strong> e <strong>fundamento legal</strong>,
              mas a coluna "Natureza Cooperativa" fica indisponível.
            </span>
          </p>
        </div>
      )}

      {loading && (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-cyan-700" />
        </div>
      )}
      {erro && (
        <div className="bg-red-50 border-l-4 border-red-500 p-3 text-sm text-red-700 rounded">{erro}</div>
      )}

      {!loading && (
        <>
          <div className="grid grid-cols-3 gap-3">
            <Card>
              <CardContent className="pt-4">
                <div className="text-xs text-gray-500">Total de contas</div>
                <div className="text-2xl font-bold">{total}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="text-xs text-gray-500">Segregadas (CT.1)</div>
                <div className="text-2xl font-bold text-emerald-700">{segregadas}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="text-xs text-gray-500">Pendentes de classificação</div>
                <div className="text-2xl font-bold text-amber-700">{pendentes}</div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Contas</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs text-gray-500 border-b">
                    <tr>
                      <th className="text-left py-2 px-2 w-20">Código</th>
                      <th className="text-left py-2 px-2 min-w-[200px]">Nome</th>
                      <th className="text-left py-2 px-2 min-w-[220px]">Natureza Contábil</th>
                      {isCoop && (
                        <th className="text-left py-2 px-2 min-w-[180px]">Natureza Cooperativa</th>
                      )}
                      <th className="text-left py-2 px-2 min-w-[280px]">Fundamento Legal</th>
                      <th className="text-center py-2 px-2 w-16">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {contas.map((c) => {
                      const editavel = podeEditarConta(c);
                      const ehGlobal = c.cooperativaId === null;
                      const saveState = linhaSave[c.id] ?? 'idle';
                      const erroLinha = linhaErro[c.id];
                      return (
                        <tr
                          key={c.id}
                          className={`border-b hover:bg-gray-50 ${
                            saveState === 'error' ? 'bg-red-50' : ''
                          }`}
                        >
                          <td className="py-2 px-2 font-mono text-xs">{c.codigo}</td>
                          <td className="py-2 px-2">
                            <div>{c.nome}</div>
                            {ehGlobal && (
                              <div className="text-[10px] text-gray-400 italic">
                                Conta global (plataforma)
                                {!ehSuperAdmin && ' — só Super Admin classifica'}
                              </div>
                            )}
                          </td>
                          <td className="py-2 px-2">
                            {editavel ? (
                              <SelectInline
                                opcoes={NATUREZA_CONTABIL_OPCOES as any}
                                valor={c.naturezaContabil ?? ''}
                                onChange={(novo) =>
                                  patchClassificacao(
                                    c.id,
                                    { naturezaContabil: novo === '' ? null : novo },
                                    { naturezaContabil: c.naturezaContabil },
                                  )
                                }
                              />
                            ) : (
                              <ReadOnlyValor
                                valor={c.naturezaContabil}
                                tooltip={
                                  ehGlobal
                                    ? 'Conta global — só Super Admin classifica'
                                    : 'Sem permissão de edição'
                                }
                              />
                            )}
                          </td>
                          {isCoop && (
                            <td className="py-2 px-2">
                              {editavel ? (
                                <SelectInline
                                  opcoes={NATUREZA_COOPERATIVA_OPCOES as any}
                                  valor={c.naturezaCooperativa ?? ''}
                                  onChange={(novo) =>
                                    patchClassificacao(
                                      c.id,
                                      { naturezaCooperativa: novo === '' ? null : novo },
                                      { naturezaCooperativa: c.naturezaCooperativa },
                                    )
                                  }
                                  badgeCor={
                                    c.naturezaCooperativa
                                      ? CORES_COOPERATIVA[c.naturezaCooperativa]
                                      : undefined
                                  }
                                />
                              ) : (
                                <ReadOnlyValor
                                  valor={c.naturezaCooperativa}
                                  badgeCor={
                                    c.naturezaCooperativa
                                      ? CORES_COOPERATIVA[c.naturezaCooperativa]
                                      : undefined
                                  }
                                  tooltip={
                                    ehGlobal
                                      ? 'Conta global — só Super Admin classifica'
                                      : 'Sem permissão de edição'
                                  }
                                />
                              )}
                            </td>
                          )}
                          <td className="py-2 px-2">
                            {editavel ? (
                              <InputInline
                                valor={c.fundamentoLegal ?? ''}
                                onSave={(novo) =>
                                  patchClassificacao(
                                    c.id,
                                    {
                                      fundamentoLegal: novo.trim() === '' ? null : novo.trim(),
                                    },
                                    { fundamentoLegal: c.fundamentoLegal },
                                  )
                                }
                                placeholder='ex: "Art. 79 Lei 5.764/71 + STF Tema 536"'
                              />
                            ) : (
                              <span className="text-xs text-gray-600">
                                {c.fundamentoLegal ?? <em className="text-gray-400">—</em>}
                              </span>
                            )}
                          </td>
                          <td className="text-center py-2 px-2">
                            <EstadoSalvamento estado={saveState} erro={erroLinha} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

// ============================================================
// Componentes inline
// ============================================================

function SelectInline({
  opcoes,
  valor,
  onChange,
  badgeCor,
}: {
  opcoes: readonly { value: string; label: string }[];
  valor: string;
  onChange: (v: string) => void;
  badgeCor?: string;
}) {
  return (
    <select
      value={valor}
      onChange={(e) => onChange(e.target.value)}
      className={`w-full border rounded px-2 py-1 text-xs ${
        badgeCor ? badgeCor : 'bg-white'
      } ${valor === '' ? 'text-amber-700' : ''}`}
    >
      {opcoes.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

function ReadOnlyValor({
  valor,
  badgeCor,
  tooltip,
}: {
  valor: string | null;
  badgeCor?: string;
  tooltip?: string;
}) {
  if (!valor) {
    return (
      <span className="text-xs text-amber-600" title={tooltip}>
        — pendente
      </span>
    );
  }
  return (
    <Badge variant="outline" className={badgeCor ?? ''} title={tooltip}>
      {valor}
    </Badge>
  );
}

function InputInline({
  valor,
  onSave,
  placeholder,
}: {
  valor: string;
  onSave: (v: string) => void;
  placeholder?: string;
}) {
  const [v, setV] = useState(valor);

  useEffect(() => {
    setV(valor);
  }, [valor]);

  function handleBlur() {
    if (v !== valor) onSave(v);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      (e.target as HTMLInputElement).blur();
    } else if (e.key === 'Escape') {
      setV(valor);
      (e.target as HTMLInputElement).blur();
    }
  }

  return (
    <input
      type="text"
      value={v}
      onChange={(e) => setV(e.target.value)}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      placeholder={placeholder}
      maxLength={300}
      className="w-full border rounded px-2 py-1 text-xs"
    />
  );
}

function EstadoSalvamento({ estado, erro }: { estado: SaveState; erro?: string }) {
  if (estado === 'saving') {
    return <Loader2 className="h-3.5 w-3.5 animate-spin text-cyan-700 inline-block" />;
  }
  if (estado === 'saved') {
    return <Check className="h-3.5 w-3.5 text-emerald-600 inline-block" />;
  }
  if (estado === 'error') {
    return (
      <span title={erro ?? 'Erro ao salvar'} className="inline-flex items-center gap-1 text-rose-700">
        <XIcon className="h-3.5 w-3.5" />
        <span className="text-[10px]">erro</span>
      </span>
    );
  }
  return null;
}
