'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowLeft, Loader2, Download, CheckCircle, AlertTriangle, FileText } from 'lucide-react';
import StatusEnvioBadge, { type StatusEnvio } from '@/components/envio-lista/StatusEnvioBadge';
import StatusCooperadoBadge, { type StatusCooperado } from '@/components/envio-lista/StatusCooperadoBadge';
import DialogMarcarEnviado from '@/components/envio-lista/DialogMarcarEnviado';
import DialogRegistrarProtocolo from '@/components/envio-lista/DialogRegistrarProtocolo';
import DialogRegistrarHomologacao from '@/components/envio-lista/DialogRegistrarHomologacao';
import DialogCancelar from '@/components/envio-lista/DialogCancelar';

interface CooperadoLinha {
  id: string;
  cooperadoId: string;
  ucNumero: string;
  kwhContratoSnapshot: string;
  percentualUsinaSnapshot: string;
  statusIndividual: StatusCooperado;
  dataHomologacao: string | null;
  observacaoIndividual: string | null;
  cooperado: { id: string; nomeCompleto: string; cpf: string; telefone?: string };
  contrato: { id: string; numero: string; status: string };
}

interface EnvioDetalhe {
  id: string;
  numeroInterno: string;
  status: StatusEnvio;
  cooperativa: { id: string; nome: string };
  usina: { id: string; nome: string; apelidoInterno: string | null; capacidadeKwh: string };
  geradaEm: string;
  validadaEm: string | null;
  validadaPor: { id: string; nome: string } | null;
  enviadaEm: string | null;
  enviadaPor: { id: string; nome: string } | null;
  canalEnvio: string | null;
  protocoloEm: string | null;
  numeroProtocoloConcessionaria: string | null;
  liberadaEm: string | null;
  observacoes: string | null;
  cooperados: CooperadoLinha[];
}

function fmtDateTime(s: string | null): string {
  if (!s) return '—';
  try {
    return new Date(s).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
  } catch {
    return '—';
  }
}

function fmtDate(s: string | null): string {
  if (!s) return '—';
  try {
    return new Date(s).toLocaleDateString('pt-BR');
  } catch {
    return '—';
  }
}

export default function DetalheEnvioPage() {
  const params = useParams();
  const router = useRouter();
  const envioId = params?.envioId as string;

  const [envio, setEnvio] = useState<EnvioDetalhe | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [acaoEmAndamento, setAcaoEmAndamento] = useState(false);
  const [erro, setErro] = useState('');
  const [toast, setToast] = useState<{ tipo: 'success' | 'error'; msg: string } | null>(null);

  const [dlgMarcarEnviado, setDlgMarcarEnviado] = useState(false);
  const [dlgProtocolo, setDlgProtocolo] = useState(false);
  const [dlgCancelar, setDlgCancelar] = useState(false);
  const [dlgHomologar, setDlgHomologar] = useState<{ cooperadoId: string; nome: string } | null>(null);

  const recarregar = useCallback(async () => {
    setCarregando(true);
    setErro('');
    try {
      const { data } = await api.get(`/envios-lista/${envioId}`);
      setEnvio(data);
    } catch (e: any) {
      setErro(e?.response?.data?.message || 'Erro ao carregar envio.');
    } finally {
      setCarregando(false);
    }
  }, [envioId]);

  useEffect(() => {
    if (envioId) recarregar();
  }, [envioId, recarregar]);

  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 5000);
      return () => clearTimeout(t);
    }
  }, [toast]);

  async function validar() {
    if (!envio) return;
    if (!confirm(`Validar ${envio.numeroInterno}? Snapshot ficará imutável a partir daqui.`)) return;
    setAcaoEmAndamento(true);
    try {
      await api.patch(`/envios-lista/${envio.id}/validar`);
      setToast({ tipo: 'success', msg: 'Envio validado.' });
      recarregar();
    } catch (e: any) {
      setToast({ tipo: 'error', msg: e?.response?.data?.message || 'Erro ao validar.' });
    } finally {
      setAcaoEmAndamento(false);
    }
  }

  async function marcarProntoPraEnvio() {
    if (!envio) return;
    setAcaoEmAndamento(true);
    try {
      await api.patch(`/envios-lista/${envio.id}/marcar-pra-envio`);
      setToast({ tipo: 'success', msg: 'Envio pronto para envio.' });
      recarregar();
    } catch (e: any) {
      setToast({ tipo: 'error', msg: e?.response?.data?.message || 'Erro.' });
    } finally {
      setAcaoEmAndamento(false);
    }
  }

  async function baixarCsv() {
    if (!envio) return;
    try {
      const { data } = await api.get(`/envios-lista/${envio.id}/csv`);
      const blob = new Blob([data.csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = data.filename || `${envio.numeroInterno}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setToast({ tipo: 'error', msg: 'Erro ao baixar CSV.' });
    }
  }

  if (carregando && !envio) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (erro && !envio) {
    return (
      <div>
        <Button variant="ghost" size="sm" onClick={() => router.back()}><ArrowLeft className="h-4 w-4 mr-2" />Voltar</Button>
        <p className="text-red-500 mt-4">{erro}</p>
      </div>
    );
  }

  if (!envio) return null;

  const podeValidar = envio.status === 'RASCUNHO';
  const podeMarcarProntoPraEnvio = envio.status === 'VALIDADA';
  const podeMarcarEnviado = envio.status === 'PRONTA_PARA_ENVIO';
  const podeRegistrarProtocolo = envio.status === 'ENVIADA';
  const podeRegistrarHomologacao = ['PROTOCOLADA', 'HOMOLOGADO_PARCIAL'].includes(envio.status);
  const podeCancelar = !['HOMOLOGADO_TOTAL', 'REJEITADA', 'CANCELADA'].includes(envio.status);
  const ehFinal = ['HOMOLOGADO_TOTAL', 'REJEITADA', 'CANCELADA'].includes(envio.status);

  const totalCooperados = envio.cooperados.length;
  const homologados = envio.cooperados.filter((c) => c.statusIndividual === 'HOMOLOGADO').length;
  const pendentes = envio.cooperados.filter((c) => c.statusIndividual === 'PENDENTE').length;
  const rejeitados = envio.cooperados.filter((c) => c.statusIndividual === 'REJEITADO').length;

  return (
    <div>
      <div className="flex items-center gap-2 mb-6">
        <Button variant="ghost" size="sm" onClick={() => router.push('/dashboard/usinas/listas?tab=envios')}>
          <ArrowLeft className="h-4 w-4 mr-2" />Voltar
        </Button>
        <h2 className="text-2xl font-bold text-gray-800">Envio {envio.numeroInterno}</h2>
        <StatusEnvioBadge status={envio.status} size="lg" />
      </div>

      {toast && (
        <div className={`mb-4 px-4 py-2 rounded-lg text-sm border ${toast.tipo === 'success' ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-700'}`}>
          {toast.msg}
        </div>
      )}

      {/* HEADER */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Dados do envio</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div>
            <p className="text-xs text-gray-500">Usina</p>
            <p className="font-medium">{envio.usina.nome} {envio.usina.apelidoInterno && <span className="text-xs text-gray-400">({envio.usina.apelidoInterno})</span>}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Cooperativa</p>
            <p className="font-medium">{envio.cooperativa.nome}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Capacidade usina</p>
            <p className="font-medium">{Number(envio.usina.capacidadeKwh).toLocaleString('pt-BR')} kWh</p>
          </div>

          <div>
            <p className="text-xs text-gray-500">Gerada em</p>
            <p>{fmtDateTime(envio.geradaEm)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Validada em</p>
            <p>{fmtDateTime(envio.validadaEm)} {envio.validadaPor && <span className="text-xs text-gray-400">por {envio.validadaPor.nome}</span>}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Enviada em</p>
            <p>{fmtDateTime(envio.enviadaEm)} {envio.enviadaPor && <span className="text-xs text-gray-400">por {envio.enviadaPor.nome} via {envio.canalEnvio}</span>}</p>
          </div>

          <div>
            <p className="text-xs text-gray-500">Protocolada em</p>
            <p>{fmtDateTime(envio.protocoloEm)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Nº Protocolo Concessionária</p>
            <p className="font-mono text-sm">{envio.numeroProtocoloConcessionaria || '—'}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Liberada em</p>
            <p>{fmtDateTime(envio.liberadaEm)}</p>
          </div>
        </CardContent>
      </Card>

      {/* AÇÕES DISPONÍVEIS */}
      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="text-base">Ações disponíveis</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {podeValidar && (
            <Button size="sm" onClick={validar} disabled={acaoEmAndamento}>
              {acaoEmAndamento ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <CheckCircle className="h-4 w-4 mr-1" />}
              Validar
            </Button>
          )}
          {podeMarcarProntoPraEnvio && (
            <Button size="sm" onClick={marcarProntoPraEnvio} disabled={acaoEmAndamento}>
              {acaoEmAndamento && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              Marcar pronto p/ envio
            </Button>
          )}
          {podeMarcarEnviado && (
            <Button size="sm" onClick={() => setDlgMarcarEnviado(true)}>
              Marcar como enviado
            </Button>
          )}
          {podeRegistrarProtocolo && (
            <Button size="sm" onClick={() => setDlgProtocolo(true)}>
              Registrar protocolo
            </Button>
          )}
          {podeRegistrarHomologacao && (
            <span className="text-xs text-gray-500 self-center">
              Use os botões da tabela abaixo para registrar a homologação de cada cooperado.
            </span>
          )}
          {ehFinal && (
            <span className="text-xs text-gray-500 self-center">
              Envio em estado final. Disponível apenas para consulta.
            </span>
          )}

          <div className="ml-auto flex gap-2">
            <Button size="sm" variant="outline" onClick={baixarCsv}>
              <Download className="h-4 w-4 mr-1" />CSV
            </Button>
            {podeCancelar && (
              <Button size="sm" variant="outline" className="text-red-600 hover:text-red-700" onClick={() => setDlgCancelar(true)}>
                Cancelar envio
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* COOPERADOS */}
      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-3">
            Cooperados no envio
            <span className="text-xs font-normal text-gray-500">
              {homologados}/{totalCooperados} homologados
              {pendentes > 0 && ` · ${pendentes} pendente${pendentes > 1 ? 's' : ''}`}
              {rejeitados > 0 && ` · ${rejeitados} rejeitado${rejeitados > 1 ? 's' : ''}`}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>UC</TableHead>
                <TableHead>kWh (snapshot)</TableHead>
                <TableHead>% (snapshot)</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Data homologação</TableHead>
                <TableHead>Observação</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {envio.cooperados.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.cooperado.nomeCompleto}</TableCell>
                  <TableCell>{c.ucNumero || '—'}</TableCell>
                  <TableCell>{Number(c.kwhContratoSnapshot).toLocaleString('pt-BR')}</TableCell>
                  <TableCell>{Number(c.percentualUsinaSnapshot).toFixed(2)}%</TableCell>
                  <TableCell><StatusCooperadoBadge status={c.statusIndividual} /></TableCell>
                  <TableCell className="text-xs">{fmtDate(c.dataHomologacao)}</TableCell>
                  <TableCell className="text-xs max-w-[180px] truncate" title={c.observacaoIndividual || ''}>
                    {c.observacaoIndividual || '—'}
                  </TableCell>
                  <TableCell className="text-right">
                    {podeRegistrarHomologacao && c.statusIndividual === 'PENDENTE' ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setDlgHomologar({ cooperadoId: c.cooperadoId, nome: c.cooperado.nomeCompleto })}
                      >
                        Registrar
                      </Button>
                    ) : (
                      <span className="text-xs text-gray-400">—</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* OBSERVAÇÕES histórico */}
      {envio.observacoes && (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4" />Observações
            </CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="text-xs text-gray-700 whitespace-pre-wrap font-sans">{envio.observacoes}</pre>
          </CardContent>
        </Card>
      )}

      {/* Dialogs */}
      <DialogMarcarEnviado
        aberto={dlgMarcarEnviado}
        onClose={() => setDlgMarcarEnviado(false)}
        envioId={envio.id}
        numeroInterno={envio.numeroInterno}
        onSuccess={() => { setToast({ tipo: 'success', msg: 'Envio marcado como enviado.' }); recarregar(); }}
      />
      <DialogRegistrarProtocolo
        aberto={dlgProtocolo}
        onClose={() => setDlgProtocolo(false)}
        envioId={envio.id}
        numeroInterno={envio.numeroInterno}
        onSuccess={() => { setToast({ tipo: 'success', msg: 'Protocolo registrado.' }); recarregar(); }}
      />
      <DialogCancelar
        aberto={dlgCancelar}
        onClose={() => setDlgCancelar(false)}
        envioId={envio.id}
        numeroInterno={envio.numeroInterno}
        onSuccess={() => { setToast({ tipo: 'success', msg: 'Envio cancelado.' }); recarregar(); }}
      />
      {dlgHomologar && (
        <DialogRegistrarHomologacao
          aberto={!!dlgHomologar}
          onClose={() => setDlgHomologar(null)}
          envioId={envio.id}
          cooperadoId={dlgHomologar.cooperadoId}
          cooperadoNome={dlgHomologar.nome}
          onSuccess={() => {
            setToast({ tipo: 'success', msg: 'Homologação registrada.' });
            recarregar();
          }}
        />
      )}
    </div>
  );
}
