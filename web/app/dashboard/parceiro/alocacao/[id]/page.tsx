'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft, Loader2 } from 'lucide-react';

type ClasseGd = 'GD_I' | 'GD_II' | 'GD_III';

interface RealocacaoSugerida {
  contratoId: string;
  cooperadoId: string;
  cooperadoNome: string;
  ucId: string;
  ucNumero: string;
  kwhContrato: number;
  usinaAtualId: string | null;
  usinaAtualNome: string | null;
  usinaSugeridaId: string;
  usinaSugeridaNome: string;
  motivosMudanca: string[];
  economiaProjetadaProxy: number;
}

interface Snapshot {
  cooperativaId: string;
  contratosAvaliados: number;
  realocacoesSugeridas: number;
  realocacoes: RealocacaoSugerida[];
  custoTotalAntesProxy: number;
  custoTotalDepoisProxy: number;
  economiaTotalProxy: number;
  geradoEm: string;
}

interface Alocacao {
  id: string;
  status: 'SUGERIDA' | 'APROVADA_PARCIAL' | 'APROVADA_TOTAL' | 'DESCARTADA';
  calculadaEm: string;
  aplicadaEm: string | null;
  aprovadasContratoIds: string[];
  observacoes: string | null;
  snapshot: Snapshot;
}

const statusColors: Record<Alocacao['status'], string> = {
  SUGERIDA: 'bg-blue-100 text-blue-800',
  APROVADA_PARCIAL: 'bg-yellow-100 text-yellow-800',
  APROVADA_TOTAL: 'bg-green-100 text-green-800',
  DESCARTADA: 'bg-gray-200 text-gray-700',
};

export default function AlocacaoDetalhePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params?.id ?? '';

  const [alocacao, setAlocacao] = useState<Alocacao | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [aplicando, setAplicando] = useState(false);
  const [descartando, setDescartando] = useState(false);
  const [erro, setErro] = useState('');
  const [confirmarAplicar, setConfirmarAplicar] = useState(false);
  const [confirmarDescartar, setConfirmarDescartar] = useState(false);
  const [motivoDescarte, setMotivoDescarte] = useState('');

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const { data } = await api.get(`/alocacao/${id}`);
      setAlocacao(data);
    } catch (err: any) {
      setErro(err.response?.data?.message ?? 'Falha ao carregar alocação.');
    } finally {
      setCarregando(false);
    }
  }, [id]);

  useEffect(() => {
    if (id) carregar();
  }, [id, carregar]);

  const realocacoesElegiveis = useMemo(() => {
    if (!alocacao) return [] as RealocacaoSugerida[];
    return alocacao.snapshot.realocacoes.filter(
      (r) => !alocacao.aprovadasContratoIds.includes(r.contratoId),
    );
  }, [alocacao]);

  function toggleSelecionado(contratoId: string) {
    setSelecionados((prev) => {
      const novo = new Set(prev);
      if (novo.has(contratoId)) novo.delete(contratoId);
      else novo.add(contratoId);
      return novo;
    });
  }

  function selecionarTodas() {
    setSelecionados(new Set(realocacoesElegiveis.map((r) => r.contratoId)));
  }

  async function aplicar() {
    if (selecionados.size === 0) return;
    setAplicando(true);
    try {
      await api.post(`/alocacao/${id}/aplicar`, {
        contratoIds: Array.from(selecionados),
      });
      setSelecionados(new Set());
      setConfirmarAplicar(false);
      await carregar();
    } catch (err: any) {
      setErro(err.response?.data?.message ?? 'Falha ao aplicar.');
    } finally {
      setAplicando(false);
    }
  }

  async function descartar() {
    setDescartando(true);
    try {
      await api.post(`/alocacao/${id}/descartar`, { motivo: motivoDescarte || undefined });
      setConfirmarDescartar(false);
      setMotivoDescarte('');
      await carregar();
    } catch (err: any) {
      setErro(err.response?.data?.message ?? 'Falha ao descartar.');
    } finally {
      setDescartando(false);
    }
  }

  if (carregando) {
    return (
      <div className="p-12 flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (!alocacao) {
    return (
      <div className="p-6 text-red-600">
        Alocação não encontrada. {erro && `(${erro})`}
      </div>
    );
  }

  const estadoFinal = alocacao.status === 'APROVADA_TOTAL' || alocacao.status === 'DESCARTADA';

  return (
    <div className="container mx-auto py-6 space-y-4">
      <Link
        href="/dashboard/parceiro/alocacao?tab=sugestoes"
        className="inline-flex items-center text-sm text-blue-600 hover:underline"
      >
        <ArrowLeft className="h-4 w-4 mr-1" />
        Voltar para sugestões
      </Link>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Sugestão de realocação</CardTitle>
              <p className="text-sm text-gray-500 mt-1">
                Calculada em {new Date(alocacao.calculadaEm).toLocaleString('pt-BR')}
              </p>
            </div>
            <span
              className={`px-3 py-1 rounded text-sm font-medium ${statusColors[alocacao.status]}`}
            >
              {alocacao.status.replace('_', ' ')}
            </span>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-4 mb-6 text-sm">
            <Metric label="Contratos avaliados" value={alocacao.snapshot.contratosAvaliados} />
            <Metric label="Realocações sugeridas" value={alocacao.snapshot.realocacoesSugeridas} />
            <Metric
              label="Custo antes (proxy)"
              value={alocacao.snapshot.custoTotalAntesProxy.toLocaleString('pt-BR')}
            />
            <Metric
              label="Economia projetada"
              value={alocacao.snapshot.economiaTotalProxy.toLocaleString('pt-BR')}
              highlight
            />
          </div>

          {erro && (
            <div className="mb-4 p-3 rounded bg-red-50 text-red-700 text-sm">{erro}</div>
          )}

          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-sm">Realocações</h3>
            {!estadoFinal && realocacoesElegiveis.length > 0 && (
              <button
                onClick={selecionarTodas}
                className="text-xs text-blue-600 hover:underline"
              >
                Selecionar todas ({realocacoesElegiveis.length})
              </button>
            )}
          </div>

          {alocacao.snapshot.realocacoes.length === 0 ? (
            <p className="text-gray-500 py-8 text-center text-sm">
              Nenhuma realocação sugerida — todos os contratos já estão em usina compatível com a política.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  {!estadoFinal && <TableHead></TableHead>}
                  <TableHead>Cooperado</TableHead>
                  <TableHead>UC</TableHead>
                  <TableHead className="text-right">kWh/mês</TableHead>
                  <TableHead>Usina atual</TableHead>
                  <TableHead>Usina sugerida</TableHead>
                  <TableHead>Motivos</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {alocacao.snapshot.realocacoes.map((r) => {
                  const jaAprovada = alocacao.aprovadasContratoIds.includes(r.contratoId);
                  return (
                    <TableRow
                      key={r.contratoId}
                      className={jaAprovada ? 'bg-green-50' : undefined}
                    >
                      {!estadoFinal && (
                        <TableCell>
                          {jaAprovada ? (
                            <span className="text-green-700 text-xs font-semibold">✓ aprov.</span>
                          ) : (
                            <Checkbox
                              checked={selecionados.has(r.contratoId)}
                              onCheckedChange={() => toggleSelecionado(r.contratoId)}
                            />
                          )}
                        </TableCell>
                      )}
                      <TableCell className="font-medium">{r.cooperadoNome}</TableCell>
                      <TableCell className="text-gray-500">{r.ucNumero}</TableCell>
                      <TableCell className="text-right">{r.kwhContrato.toLocaleString('pt-BR')}</TableCell>
                      <TableCell>{r.usinaAtualNome ?? '—'}</TableCell>
                      <TableCell className="font-medium">{r.usinaSugeridaNome}</TableCell>
                      <TableCell className="text-xs text-gray-600">
                        {r.motivosMudanca.join(' • ')}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}

          {!estadoFinal && (
            <div className="mt-6 flex gap-3 justify-end">
              <Button
                variant="outline"
                onClick={() => setConfirmarDescartar(true)}
                disabled={descartando}
              >
                Descartar
              </Button>
              <Button
                onClick={() => setConfirmarAplicar(true)}
                disabled={selecionados.size === 0 || aplicando}
              >
                {aplicando ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : null}
                Aplicar selecionadas ({selecionados.size})
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Confirma aplicar */}
      <AlertDialog open={confirmarAplicar} onOpenChange={setConfirmarAplicar}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Aplicar realocações?</AlertDialogTitle>
            <AlertDialogDescription>
              Vou alterar {selecionados.size} contrato(s) para as usinas sugeridas. Esta ação é
              registrada no AuditLog e pode ser revertida manualmente via editor de contrato.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={aplicar} disabled={aplicando}>
              Aplicar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirma descartar */}
      <AlertDialog open={confirmarDescartar} onOpenChange={setConfirmarDescartar}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Descartar sugestão?</AlertDialogTitle>
            <AlertDialogDescription>
              A sugestão será marcada como descartada. Não afeta contratos. Pode informar motivo
              (opcional) pra histórico.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea
            value={motivoDescarte}
            onChange={(e) => setMotivoDescarte(e.target.value)}
            placeholder="Motivo (opcional)"
            className="mt-2"
          />
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={descartar} disabled={descartando}>
              Descartar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Metric({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string | number;
  highlight?: boolean;
}) {
  return (
    <div className="space-y-1">
      <p className="text-xs text-gray-500 uppercase">{label}</p>
      <p className={`text-lg font-semibold ${highlight ? 'text-green-700' : ''}`}>{value}</p>
    </div>
  );
}
