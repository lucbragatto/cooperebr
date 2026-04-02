'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { ArrowLeft, Pencil, ArrowRightLeft, Zap, Loader2, QrCode, Download } from 'lucide-react';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import DualListaConcessionaria from '@/components/DualListaConcessionaria';

const BADGE_TIPO: Record<string, { label: string; icone: string }> = {
  COOPERATIVA: { label: 'Cooperativa', icone: '🏢' },
  CONSORCIO: { label: 'Consórcio', icone: '🤝' },
  ASSOCIACAO: { label: 'Associação', icone: '🏛️' },
  CONDOMINIO: { label: 'Condomínio', icone: '🏘️' },
};

function Campo({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-gray-500 mb-0.5">{label}</p>
      <p className="text-sm font-medium text-gray-800">{value ?? '—'}</p>
    </div>
  );
}

interface Cooperativa {
  id: string;
  nome: string;
  cnpj: string;
  email: string | null;
  telefone: string | null;
  endereco: string | null;
  numero: string | null;
  bairro: string | null;
  cidade: string | null;
  estado: string | null;
  cep: string | null;
  ativo: boolean;
  tipoParceiro: string;
  tipoMembro: string;
  tipoMembroPlural: string;
  planoSaas?: { id: string; nome: string; mensalidadeBase: number } | null;
  statusSaas?: string;
  diaVencimentoSaas?: number;
  modulosAtivos?: string[];
  modalidadesAtivas?: Record<string, string>;
  usinas: any[];
  createdAt: string;
  updatedAt: string;
}

const MODULOS_LABELS: Record<string, string> = {
  usinas: 'Cadastro de Usinas',
  membros: 'Cadastro de Membros',
  ucs: 'Unidades Consumidoras',
  contratos: 'Contratos de Adesão',
  cobrancas: 'Cobranças e Financeiro',
  modelos_cobranca: 'Modelos de Cobrança',
  motor_proposta: 'Motor de Proposta',
  whatsapp: 'WhatsApp Messaging',
  indicacoes: 'Programa de Indicações',
  clube_vantagens: 'Clube de Vantagens',
  convenios: 'Convênios para Membros',
  relatorios: 'Relatórios Avançados',
  condominios: 'Condomínios e Administradoras',
  usuarios: 'Gerenciamento de Usuários',
  planos: 'Planos de Assinatura',
};

const TODOS_MODULOS = Object.keys(MODULOS_LABELS);

export default function CooperativaDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [coop, setCoop] = useState<Cooperativa | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [membros, setMembros] = useState<any[]>([]);

  // Migração / Ajuste states
  const [usinasDisponiveis, setUsinasDisponiveis] = useState<any[]>([]);
  const [migrarAberto, setMigrarAberto] = useState(false);
  const [migrarMembro, setMigrarMembro] = useState<any>(null);
  const [migrarUsinaDestinoId, setMigrarUsinaDestinoId] = useState('');
  const [migrarModo, setMigrarModo] = useState<'kwh' | 'percent'>('kwh');
  const [migrarValor, setMigrarValor] = useState('');
  const [migrarMotivo, setMigrarMotivo] = useState('');
  const [migrarProcessando, setMigrarProcessando] = useState(false);
  const [migrarMsg, setMigrarMsg] = useState('');
  const [migrarSucesso, setMigrarSucesso] = useState<{ usinaOrigemId: string; usinaDestinoId: string } | null>(null);
  const [dualListaAberto, setDualListaAberto] = useState(false);

  const [qrAberto, setQrAberto] = useState(false);
  const [qrData, setQrData] = useState<{ qrCode: string; url: string } | null>(null);
  const [qrCarregando, setQrCarregando] = useState(false);

  const [ajustarAberto, setAjustarAberto] = useState(false);
  const [ajustarMembro, setAjustarMembro] = useState<any>(null);
  const [ajustarModo, setAjustarModo] = useState<'kwh' | 'percent'>('kwh');
  const [ajustarValor, setAjustarValor] = useState('');
  const [ajustarMotivo, setAjustarMotivo] = useState('');
  const [ajustarProcessando, setAjustarProcessando] = useState(false);
  const [ajustarMsg, setAjustarMsg] = useState('');

  // Planos SaaS e Faturas
  const [planosSaas, setPlanosSaas] = useState<any[]>([]);
  const [faturasSaas, setFaturasSaas] = useState<any[]>([]);
  const [trocandoPlano, setTrocandoPlano] = useState(false);

  // Contratos do membro (múltiplos contratos)
  const [contratosDoMembro, setContratosDoMembro] = useState<any[]>([]);
  const [contratosSelecionados, setContratosSelecionados] = useState<string[]>([]);
  const [selecionarTodos, setSelecionarTodos] = useState(true);
  const [carregandoContratos, setCarregandoContratos] = useState(false);

  useEffect(() => {
    api.get<Cooperativa>(`/cooperativas/${id}`)
      .then((r) => setCoop(r.data))
      .catch(() => setErro('Parceiro não encontrado.'))
      .finally(() => setCarregando(false));

    api.get(`/cooperados?cooperativaId=${id}`)
      .then((r) => setMembros(Array.isArray(r.data) ? r.data : r.data.data ?? []))
      .catch(() => {});

    api.get('/usinas').then((r) => setUsinasDisponiveis(r.data || [])).catch(() => {});

    api.get('/saas/planos').then((r) => setPlanosSaas(r.data || [])).catch(() => {});
    api.get(`/saas/faturas?cooperativaId=${id}`).then((r) => setFaturasSaas(Array.isArray(r.data) ? r.data.filter((f: any) => f.cooperativaId === id) : [])).catch(() => {});
  }, [id]);

  function recarregarMembros() {
    api.get(`/cooperados?cooperativaId=${id}`)
      .then((r) => setMembros(Array.isArray(r.data) ? r.data : r.data.data ?? []))
      .catch(() => {});
  }

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

  async function handleMigrar() {
    if (!migrarMembro || contratosSelecionados.length === 0) return;
    setMigrarProcessando(true);
    setMigrarMsg('');
    try {
      for (const contratoId of contratosSelecionados) {
        const body: any = {
          cooperadoId: migrarMembro.id,
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
      setMigrarSucesso({ usinaOrigemId: (migrarMembro as any).usinaId || '', usinaDestinoId: migrarUsinaDestinoId });
      recarregarMembros();
    } catch (e: any) {
      const msg = e?.response?.data?.message || 'Erro ao migrar.';
      setMigrarMsg(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setMigrarProcessando(false);
    }
  }

  async function handleAjustar() {
    if (!ajustarMembro || contratosSelecionados.length === 0) return;
    setAjustarProcessando(true);
    setAjustarMsg('');
    try {
      for (const contratoId of contratosSelecionados) {
        const body: any = {
          cooperadoId: ajustarMembro.id,
          contratoId,
          motivo: ajustarMotivo || undefined,
        };
        if (ajustarModo === 'kwh') body.kwhNovo = Number(ajustarValor);
        else body.percentualNovo = Number(ajustarValor);
        await api.post('/migracoes-usina/ajustar-kwh', body);
      }
      setAjustarAberto(false);
      recarregarMembros();
    } catch (e: any) {
      const msg = e?.response?.data?.message || 'Erro ao ajustar.';
      setAjustarMsg(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setAjustarProcessando(false);
    }
  }

  const badge = coop ? (BADGE_TIPO[coop.tipoParceiro] || { label: coop.tipoParceiro, icone: '👤' }) : null;

  return (
    <div>
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar
        </Button>
        <h2 className="text-2xl font-bold text-gray-800">Detalhe do Parceiro</h2>
        {coop && (
          <div className="ml-auto flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={async () => {
                setQrCarregando(true);
                try {
                  const res = await api.get(`/cooperativas/${id}/qrcode`);
                  setQrData(res.data);
                  setQrAberto(true);
                } catch {
                  alert('Erro ao gerar QR Code.');
                } finally {
                  setQrCarregando(false);
                }
              }}
              disabled={qrCarregando}
            >
              {qrCarregando ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <QrCode className="h-4 w-4 mr-2" />}
              Gerar QR Code
            </Button>
            <Link href={`/dashboard/cooperativas/${id}/editar`}>
              <Button size="sm" variant="outline">
                <Pencil className="h-4 w-4 mr-2" />
                Editar
              </Button>
            </Link>
          </div>
        )}
      </div>

      {carregando && <p className="text-gray-500">Carregando...</p>}
      {erro && <p className="text-red-500">{erro}</p>}

      {coop && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-3">
                {coop.nome}
                <Badge className={coop.ativo ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}>
                  {coop.ativo ? 'Ativo' : 'Inativo'}
                </Badge>
                {badge && (
                  <Badge variant="outline" className="gap-1">
                    <span>{badge.icone}</span> {badge.label}
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-6">
              <Campo label="CNPJ" value={coop.cnpj} />
              <Campo label="Email" value={coop.email} />
              <Campo label="Telefone" value={coop.telefone} />
              <Campo label="Endereço" value={
                [coop.endereco, coop.numero].filter(Boolean).join(', ') || '—'
              } />
              <Campo label="Bairro" value={coop.bairro} />
              <Campo label="Cidade/UF" value={coop.cidade ? `${coop.cidade}/${coop.estado}` : '—'} />
              <Campo label="CEP" value={coop.cep} />
              <Campo label="Criado em" value={new Date(coop.createdAt).toLocaleString('pt-BR')} />
            </CardContent>
          </Card>

          {/* Plano SaaS + Troca de Plano */}
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="text-base">Plano SaaS</CardTitle>
            </CardHeader>
            <CardContent>
              {coop.planoSaas ? (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-4">
                  <Campo label="Plano" value={coop.planoSaas.nome} />
                  <Campo label="Mensalidade" value={`R$ ${Number(coop.planoSaas.mensalidadeBase).toFixed(2)}`} />
                  <Campo label="Dia Vencimento" value={coop.diaVencimentoSaas ?? 10} />
                  <Campo label="Status SaaS" value={
                    <Badge variant="outline" className={
                      coop.statusSaas === 'ATIVO' ? 'bg-green-50 text-green-700' :
                      coop.statusSaas === 'INADIMPLENTE' ? 'bg-red-50 text-red-700' :
                      'bg-yellow-50 text-yellow-700'
                    }>
                      {coop.statusSaas}
                    </Badge>
                  } />
                </div>
              ) : (
                <p className="text-sm text-gray-400 mb-4">Nenhum plano vinculado</p>
              )}
              <div className="flex items-center gap-3">
                <select
                  className="border border-gray-300 rounded-md px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={coop.planoSaas?.id ?? ''}
                  onChange={async (e) => {
                    const planoId = e.target.value || null;
                    setTrocandoPlano(true);
                    try {
                      await api.post('/saas/planos/vincular', { cooperativaId: id, planoSaasId: planoId });
                      const { data } = await api.get<Cooperativa>(`/cooperativas/${id}`);
                      setCoop(data);
                    } catch (err: any) {
                      alert(err?.response?.data?.message || 'Erro ao trocar plano');
                    } finally {
                      setTrocandoPlano(false);
                    }
                  }}
                  disabled={trocandoPlano}
                >
                  <option value="">Sem plano</option>
                  {planosSaas.filter((p: any) => p.ativo).map((p: any) => (
                    <option key={p.id} value={p.id}>{p.nome} — R$ {Number(p.mensalidadeBase).toFixed(2)}/mes</option>
                  ))}
                </select>
                {trocandoPlano && <Loader2 className="h-4 w-4 animate-spin text-blue-600" />}
              </div>
            </CardContent>
          </Card>

          {/* Preview dos Modulos */}
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="text-base">Modulos do Sistema</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {TODOS_MODULOS.map((key) => {
                  const ativo = coop.modulosAtivos?.includes(key);
                  const modalidade = (coop.modalidadesAtivas as any)?.[key];
                  return (
                    <div key={key} className={`flex items-center gap-2 text-sm px-3 py-2 rounded-md ${ativo ? 'bg-green-50 text-green-800' : 'bg-gray-50 text-gray-400'}`}>
                      <span>{ativo ? '\u2705' : '\u274C'}</span>
                      <span>{MODULOS_LABELS[key]}</span>
                      {ativo && modalidade && modalidade !== 'STANDALONE' && (
                        <Badge variant="outline" className="ml-auto text-xs">{modalidade}</Badge>
                      )}
                    </div>
                  );
                })}
              </div>
              {(!coop.modulosAtivos || coop.modulosAtivos.length === 0) && (
                <p className="text-xs text-gray-400 mt-2">Nenhum modulo habilitado. Vincule um plano para ativar modulos.</p>
              )}
            </CardContent>
          </Card>

          {/* Historico de Faturas SaaS */}
          {faturasSaas.length > 0 && (
            <Card className="mt-6">
              <CardHeader>
                <CardTitle className="text-base">Faturas SaaS ({faturasSaas.length})</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Competencia</TableHead>
                      <TableHead>Valor Base</TableHead>
                      <TableHead>% Receita</TableHead>
                      <TableHead>Total</TableHead>
                      <TableHead>Vencimento</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {faturasSaas.map((f: any) => (
                      <TableRow key={f.id}>
                        <TableCell>{new Date(f.competencia).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}</TableCell>
                        <TableCell>R$ {Number(f.valorBase).toFixed(2)}</TableCell>
                        <TableCell>R$ {Number(f.valorReceita).toFixed(2)}</TableCell>
                        <TableCell className="font-medium">R$ {Number(f.valorTotal).toFixed(2)}</TableCell>
                        <TableCell>{new Date(f.dataVencimento).toLocaleDateString('pt-BR')}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={
                            f.status === 'PAGO' ? 'bg-green-50 text-green-700' :
                            f.status === 'VENCIDO' ? 'bg-red-50 text-red-700' :
                            f.status === 'CANCELADO' ? 'bg-gray-50 text-gray-500' :
                            'bg-yellow-50 text-yellow-700'
                          }>
                            {f.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="text-base">Usinas Vinculadas ({coop.usinas?.length ?? 0})</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Potência (kWp)</TableHead>
                    <TableHead>Cidade/UF</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(!coop.usinas || coop.usinas.length === 0) ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-gray-400 py-6">
                        Nenhuma usina vinculada
                      </TableCell>
                    </TableRow>
                  ) : (
                    coop.usinas.map((u: any) => (
                      <TableRow key={u.id}>
                        <TableCell className="font-medium">
                          <Link href={`/dashboard/usinas/${u.id}`} className="text-blue-600 hover:underline font-medium">
                            {u.nome}
                          </Link>
                        </TableCell>
                        <TableCell>{Number(u.potenciaKwp).toFixed(2)}</TableCell>
                        <TableCell>{u.cidade}/{u.estado}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{u.statusHomologacao}</Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Membros */}
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="text-base">{coop.tipoMembroPlural ?? 'Membros'} ({membros.length})</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>CPF/CNPJ</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Acoes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {membros.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-gray-400 py-6">
                        Nenhum membro vinculado
                      </TableCell>
                    </TableRow>
                  ) : (
                    membros.map((m: any) => (
                      <TableRow key={m.id}>
                        <TableCell className="font-medium">
                          <Link href={`/dashboard/cooperados/${m.id}`} className="text-blue-600 hover:underline font-medium">
                            {m.nomeCompleto}
                          </Link>
                        </TableCell>
                        <TableCell>{m.cpf}</TableCell>
                        <TableCell>{m.email}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{m.status}</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 px-2"
                              title="Mover para outra usina"
                              onClick={() => {
                                setMigrarMembro(m);
                                setMigrarUsinaDestinoId('');
                                setMigrarModo('kwh');
                                setMigrarValor('');
                                setMigrarMotivo('');
                                setMigrarMsg('');
                                setMigrarSucesso(null);
                                setMigrarAberto(true);
                                buscarContratosAtivos(m.id);
                              }}
                            >
                              <ArrowRightLeft className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 px-2"
                              title="Ajustar kWh / %"
                              onClick={() => {
                                setAjustarMembro(m);
                                setAjustarModo('kwh');
                                setAjustarValor('');
                                setAjustarMotivo('');
                                setAjustarMsg('');
                                setAjustarAberto(true);
                                buscarContratosAtivos(m.id);
                              }}
                            >
                              <Zap className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}

      {/* Banner de sucesso com botão para lista dual */}
      {migrarSucesso && migrarSucesso.usinaOrigemId && (
        <div className="fixed bottom-4 right-4 bg-green-50 border border-green-200 rounded-lg p-4 shadow-lg z-50 max-w-sm">
          <p className="text-sm text-green-800 font-medium mb-2">Migracao concluida com sucesso!</p>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => setDualListaAberto(true)}>Gerar listas para concessionaria</Button>
            <Button size="sm" variant="ghost" onClick={() => setMigrarSucesso(null)}>Fechar</Button>
          </div>
        </div>
      )}

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
            {migrarMembro && (
              <p className="text-sm text-gray-600">Membro: <strong>{migrarMembro.nomeCompleto}</strong></p>
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
                            : contratosSelecionados.filter((cid: string) => cid !== c.id);
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
              <textarea className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" rows={2} value={migrarMotivo} onChange={(e) => setMigrarMotivo(e.target.value)} />
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

      {/* Dialog — QR Code */}
      <Dialog open={qrAberto} onOpenChange={setQrAberto}>
        <DialogContent>
          <DialogHeader><DialogTitle>QR Code — {coop?.nome}</DialogTitle></DialogHeader>
          {qrData && (
            <div className="flex flex-col items-center gap-4 mt-2">
              <img src={qrData.qrCode} alt="QR Code" className="w-64 h-64" />
              <p className="text-xs text-gray-500 text-center break-all">{qrData.url}</p>
              <p className="text-sm text-gray-600 text-center">
                Este QR Code identifica sua cooperativa. Imprima e distribua!
              </p>
              <Button
                onClick={() => {
                  const link = document.createElement('a');
                  link.href = qrData.qrCode;
                  link.download = `qrcode-${coop?.nome?.replace(/\s+/g, '-').toLowerCase() || 'cooperativa'}.png`;
                  link.click();
                }}
              >
                <Download className="h-4 w-4 mr-2" />
                Baixar QR Code
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog — Ajustar kWh / % */}
      <Dialog open={ajustarAberto} onOpenChange={setAjustarAberto}>
        <DialogContent>
          <DialogHeader><DialogTitle>Ajustar kWh / %</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-2">
            {ajustarMembro && (
              <p className="text-sm text-gray-600">Membro: <strong>{ajustarMembro.nomeCompleto}</strong></p>
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
                            : contratosSelecionados.filter((cid: string) => cid !== c.id);
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
