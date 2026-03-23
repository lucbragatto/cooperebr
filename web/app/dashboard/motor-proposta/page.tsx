'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { BarChart3, CheckCircle, FileSignature, Mail, MessageSquare, Printer, Send, Settings, TrendingUp, UserCheck } from 'lucide-react';

interface DashStats {
  mediaCooperativaKwh: number;
  propostasPendentes: number;
  propostasAceitasNoMes: number;
  tarifaVigente: number | null;
  ultimasPropostas: Array<{
    id: string;
    status: string;
    mesReferencia: string;
    kwhContrato: number;
    economiaMensal: number;
    createdAt: string;
    cooperado: { nomeCompleto: string };
    plano: { nome: string } | null;
    tokenAprovacao?: string | null;
    aprovadoEm?: string | null;
    modoAprovacao?: string | null;
    termoAdesaoAssinadoEm?: string | null;
    procuracaoAssinadaEm?: string | null;
  }>;
}

const statusColors: Record<string, string> = {
  PENDENTE: 'bg-yellow-100 text-yellow-800',
  ACEITA: 'bg-green-100 text-green-800',
  RECUSADA: 'bg-red-100 text-red-800',
  EXPIRADA: 'bg-gray-100 text-gray-800',
  CANCELADA: 'bg-gray-100 text-gray-600',
};

function fmt5(v: number | undefined | null) {
  if (v == null) return '—';
  return Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 5, maximumFractionDigits: 5 });
}

function fmtBRL(v: number | undefined | null) {
  if (v == null) return '—';
  return Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export default function MotorPropostaPage() {
  const [stats, setStats] = useState<DashStats | null>(null);
  const [loading, setLoading] = useState(true);

  // Sheet enviar aprovação
  const [sheetOpen, setSheetOpen] = useState(false);
  const [selectedProposta, setSelectedProposta] = useState<DashStats['ultimasPropostas'][0] | null>(null);
  const [canal, setCanal] = useState<'whatsapp' | 'email'>('whatsapp');
  const [destino, setDestino] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [linkGerado, setLinkGerado] = useState('');

  // Toast
  const [toast, setToast] = useState<{ msg: string; tipo: 'sucesso' | 'erro' } | null>(null);

  const carregar = useCallback(() => {
    setLoading(true);
    api.get<DashStats>('/motor-proposta').then(r => setStats(r.data)).finally(() => setLoading(false));
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 4000);
      return () => clearTimeout(t);
    }
  }, [toast]);

  const abrirSheetEnvio = (p: DashStats['ultimasPropostas'][0]) => {
    setSelectedProposta(p);
    setCanal('whatsapp');
    setDestino('');
    setLinkGerado('');
    setSheetOpen(true);
  };

  const enviarAprovacao = async () => {
    if (!selectedProposta || !destino.trim()) return;
    setEnviando(true);
    try {
      const r = await api.post(`/motor-proposta/proposta/${selectedProposta.id}/enviar-aprovacao`, {
        canal,
        destino: destino.trim(),
      });
      setLinkGerado(r.data.link);
      setToast({ msg: 'Link de aprovação gerado com sucesso!', tipo: 'sucesso' });
      carregar();
    } catch {
      setToast({ msg: 'Erro ao enviar aprovação', tipo: 'erro' });
    } finally {
      setEnviando(false);
    }
  };

  const aprovarPresencial = async (propostaId: string) => {
    if (!confirm('Aprovar esta proposta presencialmente?')) return;
    try {
      await api.post(`/motor-proposta/proposta/${propostaId}/aprovar-presencial`);
      setToast({ msg: 'Proposta aprovada presencialmente!', tipo: 'sucesso' });
      carregar();
    } catch {
      setToast({ msg: 'Erro ao aprovar proposta', tipo: 'erro' });
    }
  };

  const enviarAssinatura = async (propostaId: string) => {
    try {
      const r = await api.post(`/motor-proposta/proposta/${propostaId}/enviar-assinatura`);
      const link = r.data.link;
      await navigator.clipboard.writeText(link).catch(() => {});
      setToast({ msg: `Link de assinatura gerado: ${link}`, tipo: 'sucesso' });
      carregar();
    } catch {
      setToast({ msg: 'Erro ao gerar link de assinatura', tipo: 'erro' });
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg text-sm font-medium max-w-md ${
          toast.tipo === 'sucesso' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
        }`}>
          {toast.msg}
        </div>
      )}

      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-800">Motor de Proposta</h2>
        <div className="flex gap-2">
          <Link href="/dashboard/motor-proposta/tarifas"><Button variant="outline" size="sm"><TrendingUp className="h-4 w-4 mr-2" />Tarifas</Button></Link>
          <Link href="/dashboard/motor-proposta/reajustes"><Button variant="outline" size="sm"><BarChart3 className="h-4 w-4 mr-2" />Reajustes</Button></Link>
          <Link href="/dashboard/motor-proposta/configuracao"><Button variant="outline" size="sm"><Settings className="h-4 w-4 mr-2" />Configuração</Button></Link>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs text-gray-500 font-medium uppercase tracking-wide">Média cooperativa</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold text-gray-900">{loading ? '...' : `R$ ${fmt5(stats?.mediaCooperativaKwh)}`}</p><p className="text-xs text-gray-400 mt-1">por kWh</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs text-gray-500 font-medium uppercase tracking-wide">Propostas pendentes</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold text-yellow-700">{loading ? '...' : stats?.propostasPendentes ?? 0}</p><p className="text-xs text-gray-400 mt-1">aguardando aceite</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs text-gray-500 font-medium uppercase tracking-wide">Aceitas no mês</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold text-green-700">{loading ? '...' : stats?.propostasAceitasNoMes ?? 0}</p><p className="text-xs text-gray-400 mt-1">este mês</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs text-gray-500 font-medium uppercase tracking-wide">Tarifa vigente</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold text-gray-900">{loading ? '...' : stats?.tarifaVigente ? `R$ ${fmt5(stats.tarifaVigente)}` : '—'}</p><p className="text-xs text-gray-400 mt-1">TUSD + TE (R$/kWh)</p></CardContent>
        </Card>
      </div>

      {/* Últimas propostas */}
      <Card>
        <CardHeader><CardTitle className="text-sm font-semibold text-gray-700">Últimas propostas geradas</CardTitle></CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-gray-400 text-sm">Carregando...</div>
          ) : !stats?.ultimasPropostas?.length ? (
            <div className="p-8 text-center text-gray-400 text-sm">Nenhuma proposta gerada ainda.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">Cooperado</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">Referência</th>
                  <th className="text-right px-4 py-2.5 text-xs font-medium text-gray-500">kWh contrato</th>
                  <th className="text-right px-4 py-2.5 text-xs font-medium text-gray-500">Economia/mês</th>
                  <th className="text-center px-4 py-2.5 text-xs font-medium text-gray-500">Status</th>
                  <th className="text-right px-4 py-2.5 text-xs font-medium text-gray-500">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {stats.ultimasPropostas.map(p => (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">{p.cooperado.nomeCompleto}</td>
                    <td className="px-4 py-3 text-gray-500">{p.mesReferencia}</td>
                    <td className="px-4 py-3 text-right">{fmt5(p.kwhContrato)}</td>
                    <td className="px-4 py-3 text-right text-green-700 font-medium">{fmtBRL(p.economiaMensal)}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColors[p.status] ?? 'bg-gray-100 text-gray-600'}`}>{p.status}</span>
                      {p.modoAprovacao && (
                        <span className="block text-[10px] text-gray-400 mt-0.5">{p.modoAprovacao.replace(/_/g, ' ')}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1 flex-wrap">
                        {/* Ver/Imprimir */}
                        <Button variant="ghost" size="sm" onClick={async () => {
                          try {
                            const r = await api.get(`/motor-proposta/proposta/${p.id}/html`, { responseType: 'text' });
                            const blob = new Blob([r.data], { type: 'text/html' });
                            const url = URL.createObjectURL(blob);
                            window.open(url, '_blank');
                          } catch { alert('Erro ao carregar proposta'); }
                        }}>
                          <Printer className="h-3.5 w-3.5 mr-1" />Ver
                        </Button>

                        {/* Enviar para aprovação (quando PENDENTE) */}
                        {p.status === 'PENDENTE' && (
                          <>
                            <Button variant="outline" size="sm" className="text-blue-600 border-blue-200" onClick={() => abrirSheetEnvio(p)}>
                              <Send className="h-3.5 w-3.5 mr-1" />Enviar aprovação
                            </Button>
                            <Button variant="outline" size="sm" className="text-green-600 border-green-200" onClick={() => aprovarPresencial(p.id)}>
                              <UserCheck className="h-3.5 w-3.5 mr-1" />Presencial
                            </Button>
                          </>
                        )}

                        {/* Enviar para assinatura (quando ACEITA) */}
                        {p.status === 'ACEITA' && (
                          <Button variant="outline" size="sm" className="text-purple-600 border-purple-200" onClick={() => enviarAssinatura(p.id)}>
                            <FileSignature className="h-3.5 w-3.5 mr-1" />Enviar assinatura
                          </Button>
                        )}

                        {/* Indicadores de assinatura */}
                        {p.termoAdesaoAssinadoEm && (
                          <span className="text-[10px] bg-purple-50 text-purple-600 px-1.5 py-0.5 rounded">Termo assinado</span>
                        )}
                        {p.procuracaoAssinadaEm && (
                          <span className="text-[10px] bg-purple-50 text-purple-600 px-1.5 py-0.5 rounded">Procuração assinada</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {/* Sheet enviar para aprovação */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Enviar proposta para aprovação</SheetTitle>
          </SheetHeader>
          <div className="py-4 space-y-4">
            {selectedProposta && (
              <div className="bg-gray-50 rounded-lg p-3 text-sm">
                <p className="font-medium">{selectedProposta.cooperado.nomeCompleto}</p>
                <p className="text-gray-500">Economia: {fmtBRL(selectedProposta.economiaMensal)}/mês</p>
              </div>
            )}

            <div>
              <Label>Canal de envio</Label>
              <div className="flex gap-2 mt-1">
                <Button
                  variant={canal === 'whatsapp' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setCanal('whatsapp')}
                  className={canal === 'whatsapp' ? 'bg-green-600 hover:bg-green-700' : ''}
                >
                  <MessageSquare className="h-4 w-4 mr-1" />WhatsApp
                </Button>
                <Button
                  variant={canal === 'email' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setCanal('email')}
                  className={canal === 'email' ? 'bg-blue-600 hover:bg-blue-700' : ''}
                >
                  <Mail className="h-4 w-4 mr-1" />Email
                </Button>
              </div>
            </div>

            <div>
              <Label>{canal === 'whatsapp' ? 'Telefone' : 'Email'}</Label>
              <Input
                value={destino}
                onChange={(e) => setDestino(e.target.value)}
                placeholder={canal === 'whatsapp' ? '(11) 99999-9999' : 'email@exemplo.com'}
                className="mt-1"
              />
            </div>

            {linkGerado && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                <p className="text-xs font-medium text-green-700 mb-1">Link gerado com sucesso!</p>
                <p className="text-xs text-green-600 break-all font-mono">{linkGerado}</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2 text-green-600"
                  onClick={() => { navigator.clipboard.writeText(linkGerado); setToast({ msg: 'Link copiado!', tipo: 'sucesso' }); }}
                >
                  Copiar link
                </Button>
              </div>
            )}
          </div>
          <SheetFooter>
            <Button onClick={enviarAprovacao} disabled={enviando || !destino.trim()}>
              {enviando ? 'Enviando...' : 'Gerar link de aprovação'}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}
