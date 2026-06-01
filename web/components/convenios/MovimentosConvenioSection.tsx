'use client';

/**
 * D-novo-CT-CT.9 (01/06/2026) — Seção Movimentos do Convênio (Design A).
 *
 * Dialog "Registrar movimento" (Tipo C — AÇÃO, permitida por regra esclarecida
 * 01/06: confirmação/lançamento OK em Dialog; só cadastro/edição de entidade
 * vira página própria). SEM otimista — é dinheiro, aguarda confirmação do
 * backend antes de atualizar a lista.
 *
 * Texto neutro: "confira antes de uso fiscal real (DCTF/SPED)". Sem referências
 * a contador externo — quem valida é o admin (Luciano + orquestrador).
 */

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { HelpBox } from '@/components/ui/help-box';
import { Loader2, Plus, FileText, ArrowDownCircle, ArrowUpCircle, RotateCcw } from 'lucide-react';

interface Movimento {
  id: string;
  tipo: 'RECEITA' | 'DESPESA';
  descricao: string;
  valor: number;
  competencia: string;
  dataPagamento: string;
  status: string;
  naturezaAto: string;
  createdAt: string;
}

interface MovimentosConvenioSectionProps {
  convenioId: string;
  fluxoFinanceiro: string;
  nomeConvenio: string;
}

const FLUXO_LABEL: Record<string, { label: string; sentido: 'Entrada' | 'Saída'; cor: string }> = {
  INGRESSO_CUSTEIO_AUXILIAR: {
    label: 'Ingresso (custeio recebido pela cooperativa)',
    sentido: 'Entrada',
    cor: 'text-emerald-700',
  },
  REPASSE_PROVEDOR_EXTERNO: {
    label: 'Repasse (saída pra provedor externo)',
    sentido: 'Saída',
    cor: 'text-rose-700',
  },
  CUSTO_OPERACIONAL_INTERNO: {
    label: 'Custo operacional interno',
    sentido: 'Saída',
    cor: 'text-rose-700',
  },
};

export function MovimentosConvenioSection({
  convenioId,
  fluxoFinanceiro,
  nomeConvenio,
}: MovimentosConvenioSectionProps) {
  const [movimentos, setMovimentos] = useState<Movimento[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erroForm, setErroForm] = useState('');
  // CT.9.1 BUG 2: estorno
  const [estornarId, setEstornarId] = useState<string | null>(null);
  const [motivoEstorno, setMotivoEstorno] = useState('');
  const [estornando, setEstornando] = useState(false);
  const [erroEstorno, setErroEstorno] = useState('');

  // CT.9.1 BUG 1: hoje em LOCAL (não UTC) — toISOString joga pra UTC e em
  // GMT-3 vira "ontem" depois das 21h. Constrói manual:
  const _hojeDate = new Date();
  const hoje = `${_hojeDate.getFullYear()}-${String(_hojeDate.getMonth() + 1).padStart(2, '0')}-${String(_hojeDate.getDate()).padStart(2, '0')}`;
  const [valor, setValor] = useState('');
  const [dataMovimento, setDataMovimento] = useState(hoje);
  const [descricao, setDescricao] = useState('');

  const fluxoInfo = FLUXO_LABEL[fluxoFinanceiro] ?? {
    label: fluxoFinanceiro,
    sentido: 'Saída' as const,
    cor: 'text-gray-700',
  };

  async function carregar() {
    setLoading(true);
    setErro('');
    try {
      const { data } = await api.get<Movimento[]>(
        `/contabilidade-tributaria/convenios/${convenioId}/movimentos`,
      );
      setMovimentos(data);
    } catch (e: any) {
      setErro(e?.response?.data?.message ?? 'Falha ao carregar movimentos');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [convenioId]);

  function abrirDialog() {
    setValor('');
    setDataMovimento(hoje);
    setDescricao('');
    setErroForm('');
    setDialogOpen(true);
  }

  async function estornar() {
    if (!estornarId) return;
    setEstornando(true);
    setErroEstorno('');
    try {
      await api.delete(
        `/contabilidade-tributaria/convenios/${convenioId}/movimentos/${estornarId}`,
        { data: { motivo: motivoEstorno.trim() || undefined } },
      );
      setEstornarId(null);
      setMotivoEstorno('');
      await carregar();
    } catch (e: any) {
      const msg = e?.response?.data?.message ?? e?.message ?? 'Falha ao estornar';
      setErroEstorno(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setEstornando(false);
    }
  }

  async function submeter() {
    setErroForm('');
    const valorNum = Number(valor.replace(',', '.'));
    if (!isFinite(valorNum) || valorNum <= 0) {
      setErroForm('Valor deve ser maior que zero (ex: 1500.00)');
      return;
    }
    if (!dataMovimento) {
      setErroForm('Data do movimento é obrigatória');
      return;
    }

    setSalvando(true);
    try {
      await api.post(
        `/contabilidade-tributaria/convenios/${convenioId}/movimentos`,
        {
          valor: valorNum,
          dataMovimento,
          descricao: descricao.trim() || undefined,
        },
      );
      setDialogOpen(false);
      await carregar();
    } catch (e: any) {
      const msg = e?.response?.data?.message ?? e?.message ?? 'Falha ao registrar movimento';
      setErroForm(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <section className="space-y-4 mt-8 pt-6 border-t">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
            <FileText className="h-5 w-5 text-cyan-700" />
            Movimentos (lançamentos Auxiliar)
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">Histórico financeiro deste convênio</p>
        </div>
        <Button
          onClick={abrirDialog}
          className="bg-cyan-700 hover:bg-cyan-800"
          size="sm"
        >
          <Plus className="h-4 w-4 mr-1" />
          Registrar movimento
        </Button>
      </div>

      <HelpBox
        id={`convenios-movimentos-${convenioId}`}
        titulo="Como funciona um movimento de convênio"
        variante="info"
      >
        <p>
          Registrar movimento gera um <strong>lançamento Auxiliar</strong> (Art. 88 — soma zero:
          ingresso e dispêndio se anulam, <strong>não tributado</strong>).
        </p>
        <p>
          Este convênio é <strong className={fluxoInfo.cor}>{fluxoInfo.label}</strong> → cada movimento será
          registrado como <strong>{fluxoInfo.sentido}</strong>.
        </p>
        <p className="bg-amber-50 border border-amber-300 rounded p-2 text-amber-800 mt-2">
          ⚠️ Classificação <strong>SUGERIDA</strong> — confira antes de uso fiscal real (DCTF/SPED).
        </p>
      </HelpBox>

      {erro && (
        <div className="bg-red-50 border-l-4 border-red-500 p-3 text-sm text-red-700 rounded">
          {erro}
        </div>
      )}

      {loading && (
        <div className="flex justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-cyan-700" />
        </div>
      )}

      {!loading && movimentos.length === 0 && (
        <p className="text-sm text-gray-500 text-center py-6 italic">
          Nenhum movimento registrado neste convênio. Clique em "Registrar movimento" para começar.
        </p>
      )}

      {!loading && movimentos.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-gray-500 border-b">
              <tr>
                <th className="text-left py-2 px-2">Data</th>
                <th className="text-left py-2 px-2">Sentido</th>
                <th className="text-right py-2 px-2">Valor</th>
                <th className="text-left py-2 px-2">Descrição</th>
                <th className="text-center py-2 px-2">Natureza</th>
                <th className="text-left py-2 px-2 text-xs">Competência</th>
                <th className="text-right py-2 px-2 w-20">Ações</th>
              </tr>
            </thead>
            <tbody>
              {movimentos.map((m) => (
                <tr key={m.id} className="border-b hover:bg-gray-50">
                  <td className="py-2 px-2 text-xs">
                    {/* CT.9.1 BUG 1: dataPagamento vem ISO UTC; em GMT-3 a meia-noite UTC vira dia anterior local.
                        Solução: extrai YYYY-MM-DD da string e formata sem reparse. */}
                    {formatarDataIso(m.dataPagamento)}
                  </td>
                  <td className="py-2 px-2">
                    {m.tipo === 'RECEITA' ? (
                      <span className="inline-flex items-center gap-1 text-emerald-700">
                        <ArrowDownCircle className="h-3.5 w-3.5" />
                        Entrada
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-rose-700">
                        <ArrowUpCircle className="h-3.5 w-3.5" />
                        Saída
                      </span>
                    )}
                  </td>
                  <td
                    className={`text-right py-2 px-2 tabular-nums font-medium ${
                      m.tipo === 'RECEITA' ? 'text-emerald-700' : 'text-rose-700'
                    }`}
                  >
                    R${' '}
                    {m.valor.toLocaleString('pt-BR', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </td>
                  <td className="py-2 px-2 text-xs">{m.descricao}</td>
                  <td className="text-center py-2 px-2">
                    <Badge
                      variant="outline"
                      className="bg-blue-100 text-blue-800 border-blue-300"
                    >
                      {m.naturezaAto}
                    </Badge>
                  </td>
                  <td className="py-2 px-2 font-mono text-xs">{m.competencia}</td>
                  <td className="text-right py-2 px-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setEstornarId(m.id);
                        setMotivoEstorno('');
                        setErroEstorno('');
                      }}
                      className="text-amber-700 hover:bg-amber-50 h-7 px-2"
                      title="Estornar movimento"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Dialog Registrar movimento — ação OK em Dialog (regra 01/06) */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar movimento</DialogTitle>
            <DialogDescription>
              <p className="mb-2">
                Convênio <strong>{nomeConvenio}</strong>
              </p>
              <div className="bg-blue-50 border border-blue-300 rounded p-2 text-xs text-blue-800">
                Este convênio é <strong className={fluxoInfo.cor}>{fluxoInfo.label}</strong> → o movimento
                será registrado como <strong>{fluxoInfo.sentido}</strong> classificada{' '}
                <strong>AUXILIAR (Art. 88)</strong>.
              </div>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 mt-2">
            <div>
              <Label htmlFor="valor">Valor (R$) *</Label>
              <Input
                id="valor"
                type="text"
                inputMode="decimal"
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                placeholder="Ex: 1500.00"
                required
              />
            </div>
            <div>
              <Label htmlFor="dataMovimento">Data do movimento *</Label>
              <Input
                id="dataMovimento"
                type="date"
                value={dataMovimento}
                onChange={(e) => setDataMovimento(e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="descricao">Descrição (opcional)</Label>
              <Input
                id="descricao"
                type="text"
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                placeholder="Ex: Aporte EDP custeio convênio jun/26"
                maxLength={300}
              />
            </div>
          </div>

          {erroForm && (
            <div className="bg-red-50 border-l-4 border-red-500 p-3 text-sm text-red-700 rounded mt-3">
              {erroForm}
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={salvando}
            >
              Cancelar
            </Button>
            <Button
              onClick={submeter}
              disabled={salvando}
              className="bg-cyan-700 hover:bg-cyan-800"
            >
              {salvando && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              Registrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Estornar — CT.9.1 BUG 2: contábil não se edita, se estorna */}
      <Dialog
        open={!!estornarId}
        onOpenChange={(o) => {
          if (!o) {
            setEstornarId(null);
            setMotivoEstorno('');
            setErroEstorno('');
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RotateCcw className="h-4 w-4 text-amber-700" />
              Estornar movimento de convênio
            </DialogTitle>
            <DialogDescription>
              <p className="mb-2">
                O lançamento contábil <strong>será deletado</strong>. Se houver erro nos dados,
                estorne e re-registre o movimento corrigido — contábil não se edita.
              </p>
              <p className="bg-amber-50 border border-amber-300 rounded p-2 text-xs text-amber-800">
                ⚠️ Se o mês deste lançamento estiver com apuração <strong>FECHADA</strong>, o estorno é
                bloqueado — reabra primeiro (Super Admin).
              </p>
            </DialogDescription>
          </DialogHeader>

          <div className="mt-2">
            <Label htmlFor="motivoEstorno">Motivo (opcional)</Label>
            <Input
              id="motivoEstorno"
              type="text"
              value={motivoEstorno}
              onChange={(e) => setMotivoEstorno(e.target.value)}
              placeholder="Ex: data digitada errada — re-registrar"
              maxLength={300}
            />
          </div>

          {erroEstorno && (
            <div className="bg-red-50 border-l-4 border-red-500 p-3 text-sm text-red-700 rounded mt-3">
              {erroEstorno}
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEstornarId(null)}
              disabled={estornando}
            >
              Cancelar
            </Button>
            <Button
              onClick={estornar}
              disabled={estornando}
              className="bg-amber-700 hover:bg-amber-800"
            >
              {estornando && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              Confirmar estorno
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

/**
 * CT.9.1: formata data ISO YYYY-MM-DDTHH:mm:ssZ sem TZ shift. Extrai os 10
 * primeiros chars (YYYY-MM-DD) e converte pra DD/MM/YYYY direto da string.
 */
function formatarDataIso(iso: string): string {
  if (!iso || iso.length < 10) return '—';
  const [ano, mes, dia] = iso.substring(0, 10).split('-');
  return `${dia}/${mes}/${ano}`;
}
