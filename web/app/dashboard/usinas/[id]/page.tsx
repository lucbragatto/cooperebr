'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import api from '@/lib/api';
import type { Usina, StatusUsina } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Download, Loader2, Pencil } from 'lucide-react';
import {
  Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle,
} from '@/components/ui/sheet';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';

function Campo({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-gray-500 mb-0.5">{label}</p>
      <p className="text-sm font-medium text-gray-800">{value ?? '—'}</p>
    </div>
  );
}

const cls = 'w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-green-500';
const lbl = 'text-xs text-gray-500 mb-0.5 block';
const selCls = `${cls} bg-white`;

const statusLabels: Record<StatusUsina, string> = {
  CADASTRADA: 'Cadastrada',
  AGUARDANDO_HOMOLOGACAO: 'Aguardando Homologacao',
  HOMOLOGADA: 'Homologada',
  EM_PRODUCAO: 'Em Producao',
  SUSPENSA: 'Suspensa',
};

const statusColors: Record<StatusUsina, string> = {
  CADASTRADA: 'bg-gray-100 text-gray-700',
  AGUARDANDO_HOMOLOGACAO: 'bg-yellow-100 text-yellow-800',
  HOMOLOGADA: 'bg-blue-100 text-blue-700',
  EM_PRODUCAO: 'bg-green-100 text-green-700',
  SUSPENSA: 'bg-red-100 text-red-700',
};

const usinaSchema = z.object({
  nome: z.string().min(1, 'Nome obrigatório'),
  potenciaKwp: z.coerce.number().positive('Deve ser maior que 0'),
  capacidadeKwh: z.coerce.number().positive('Deve ser maior que 0').nullable(),
  producaoMensalKwh: z.coerce.number().positive('Deve ser maior que 0').nullable(),
  cidade: z.string().min(1, 'Cidade obrigatória'),
  estado: z.string().min(2, 'Estado obrigatório'),
  statusHomologacao: z.enum(['CADASTRADA', 'AGUARDANDO_HOMOLOGACAO', 'HOMOLOGADA', 'EM_PRODUCAO', 'SUSPENSA']),
  distribuidora: z.string().nullable(),
  observacoes: z.string().nullable(),
  proprietarioNome: z.string().nullable(),
  proprietarioCpfCnpj: z.string().nullable(),
  proprietarioTelefone: z.string().nullable(),
  proprietarioEmail: z.string().nullable(),
  proprietarioTipo: z.enum(['PF', 'PJ']),
});

type UsinaFormData = z.infer<typeof usinaSchema>;

export default function UsinaDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [usina, setUsina] = useState<Usina | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [sheetAberto, setSheetAberto] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState('');
  const [lista, setLista] = useState<any>(null);
  const [gerandoLista, setGerandoLista] = useState(false);
  const [cooperadosAlocados, setCooperadosAlocados] = useState<any[]>([]);
  const [capacidadeInfo, setCapacidadeInfo] = useState<{usado: number; total: number} | null>(null);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<UsinaFormData>({
    resolver: zodResolver(usinaSchema) as any,
  });

  useEffect(() => {
    api.get<Usina & { distribuidora?: string | null }>(`/usinas/${id}`)
      .then((r) => setUsina(r.data))
      .catch(() => setErro('Usina não encontrada.'))
      .finally(() => setCarregando(false));
  }, [id]);

  useEffect(() => {
    if (!usina) return;
    api.get(`/usinas/${id}/lista-concessionaria`)
      .then((r) => {
        setCooperadosAlocados(r.data.cooperados || []);
        const total = Number(r.data.usina?.capacidadeKwh || 0);
        const usado = (r.data.cooperados || []).reduce((acc: number, c: any) => acc + Number(c.kwhContratado || 0), 0);
        setCapacidadeInfo({ usado, total });
      })
      .catch(() => { /* silently ignore */ });
  }, [usina, id]);

  function abrirSheet() {
    if (!usina) return;
    reset({
      nome: usina.nome,
      potenciaKwp: Number(usina.potenciaKwp),
      capacidadeKwh: usina.capacidadeKwh ? Number(usina.capacidadeKwh) : null,
      producaoMensalKwh: usina.producaoMensalKwh ? Number(usina.producaoMensalKwh) : null,
      cidade: usina.cidade,
      estado: usina.estado,
      statusHomologacao: usina.statusHomologacao || 'CADASTRADA',
      distribuidora: (usina as any).distribuidora ?? null,
      observacoes: usina.observacoes || null,
      proprietarioNome: (usina as any).proprietarioNome ?? null,
      proprietarioCpfCnpj: (usina as any).proprietarioCpfCnpj ?? null,
      proprietarioTelefone: (usina as any).proprietarioTelefone ?? null,
      proprietarioEmail: (usina as any).proprietarioEmail ?? null,
      proprietarioTipo: (usina as any).proprietarioTipo ?? 'PF',
    });
    setMensagem('');
    setSheetAberto(true);
  }

  async function onSubmit(data: UsinaFormData) {
    setSalvando(true);
    setMensagem('');
    try {
      const { data: res } = await api.put<Usina>(`/usinas/${id}`, {
        ...data,
        capacidadeKwh: data.capacidadeKwh || null,
        producaoMensalKwh: data.producaoMensalKwh || null,
        observacoes: data.observacoes || null,
        distribuidora: data.distribuidora || null,
        proprietarioNome: data.proprietarioNome || null,
        proprietarioCpfCnpj: data.proprietarioCpfCnpj || null,
        proprietarioTelefone: data.proprietarioTelefone || null,
        proprietarioEmail: data.proprietarioEmail || null,
        proprietarioTipo: data.proprietarioTipo,
      });
      setUsina(res);
      setSheetAberto(false);
      setMensagem('Salvo com sucesso!');
    } catch (e: any) {
      const msg = e?.response?.data?.message || 'Erro ao salvar.';
      setMensagem(typeof msg === 'string' ? `Erro: ${msg}` : `Erro: ${JSON.stringify(msg)}`);
    } finally {
      setSalvando(false);
    }
  }

  const status = usina?.statusHomologacao as StatusUsina;

  return (
    <div>
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar
        </Button>
        <h2 className="text-2xl font-bold text-gray-800">Detalhe da Usina</h2>
        {usina && (
          <Button size="sm" variant="outline" onClick={abrirSheet} className="ml-auto">
            <Pencil className="h-4 w-4 mr-2" />
            Editar
          </Button>
        )}
      </div>

      {carregando && <p className="text-gray-500">Carregando...</p>}
      {erro && <p className="text-red-500">{erro}</p>}
      {mensagem && (
        <p className={`mb-4 text-sm ${mensagem.startsWith('Erro') ? 'text-red-500' : 'text-green-600'}`}>
          {mensagem}
        </p>
      )}

      {usina && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-3">
                {usina.nome}
                {status && (
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${statusColors[status] ?? 'bg-gray-100 text-gray-600'}`}>
                    {statusLabels[status] ?? status}
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-6">
              <Campo label="ID" value={usina.id} />
              <Campo label="Nome" value={usina.nome} />
              <Campo label="Potencia (kWp)" value={Number(usina.potenciaKwp).toFixed(2)} />
              <Campo label="Capacidade (kWh/mes)" value={usina.capacidadeKwh ? Number(usina.capacidadeKwh).toFixed(2) : '—'} />
              <Campo label="Producao Mensal (kWh)" value={usina.producaoMensalKwh ? Number(usina.producaoMensalKwh).toFixed(2) : '—'} />
              <Campo label="Distribuidora" value={(usina as any).distribuidora ?? '—'} />
              <Campo label="Cidade" value={usina.cidade} />
              <Campo label="Estado" value={usina.estado} />
              <Campo label="Status Homologacao" value={
                <span className={`text-xs px-2 py-1 rounded-full font-medium ${statusColors[status] ?? 'bg-gray-100'}`}>
                  {statusLabels[status] ?? status}
                </span>
              } />
              <Campo label="Data Homologacao" value={usina.dataHomologacao ? new Date(usina.dataHomologacao).toLocaleDateString('pt-BR') : '—'} />
              <Campo label="Inicio Producao" value={usina.dataInicioProducao ? new Date(usina.dataInicioProducao).toLocaleDateString('pt-BR') : '—'} />
              {(usina as any).proprietarioNome && (
                <>
                  <Campo label="Proprietário" value={(usina as any).proprietarioNome} />
                  <Campo label="CPF/CNPJ Proprietário" value={(usina as any).proprietarioCpfCnpj} />
                  <Campo label="Tipo" value={(usina as any).proprietarioTipo === 'PJ' ? 'Pessoa Jurídica' : 'Pessoa Física'} />
                </>
              )}
              {usina.observacoes && <Campo label="Observacoes" value={usina.observacoes} />}
              <Campo label="Criado em" value={new Date(usina.createdAt).toLocaleString('pt-BR')} />
              <Campo label="Atualizado em" value={new Date(usina.updatedAt).toLocaleString('pt-BR')} />
            </CardContent>
          </Card>

          {/* Cooperados Alocados */}
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="text-base">Cooperados Alocados</CardTitle>
              {capacidadeInfo && capacidadeInfo.total > 0 && (
                <div className="mt-2">
                  <div className="flex justify-between text-xs text-gray-500 mb-1">
                    <span>Capacidade utilizada</span>
                    <span>{capacidadeInfo.usado.toFixed(0)} / {capacidadeInfo.total.toFixed(0)} kWh ({capacidadeInfo.total > 0 ? ((capacidadeInfo.usado / capacidadeInfo.total) * 100).toFixed(1) : 0}%)</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2.5">
                    <div
                      className="bg-green-600 h-2.5 rounded-full transition-all"
                      style={{ width: `${Math.min((capacidadeInfo.usado / capacidadeInfo.total) * 100, 100)}%` }}
                    />
                  </div>
                </div>
              )}
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>UC</TableHead>
                    <TableHead>kWh Contratado</TableHead>
                    <TableHead>% Usina</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Data Adesão</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cooperadosAlocados.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-gray-400 py-6">
                        Nenhum cooperado alocado nesta usina
                      </TableCell>
                    </TableRow>
                  ) : (
                    cooperadosAlocados.map((c: any, i: number) => (
                      <TableRow key={i}>
                        <TableCell className="font-medium">{c.nomeCompleto}</TableCell>
                        <TableCell>{c.numeroUC}</TableCell>
                        <TableCell>{c.kwhContratado}</TableCell>
                        <TableCell>{c.percentualUsina}%</TableCell>
                        <TableCell>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${c.statusContrato === 'ATIVO' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                            {c.statusContrato === 'ATIVO' ? 'Ativo' : 'Pend. Ativacao'}
                          </span>
                        </TableCell>
                        <TableCell>{new Date(c.dataAdesao).toLocaleDateString('pt-BR')}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Lista para concessionaria */}
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Lista para Concessionaria</span>
                <div className="flex gap-2">
                  {lista && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        const header = 'Nome,CPF,Numero UC,kWh Contratado,% Usina,Data Adesao,Distribuidora,Contrato';
                        const rows = lista.cooperados.map((c: any) =>
                          `"${c.nomeCompleto}","${c.cpf}","${c.numeroUC}",${c.kwhContratado},${c.percentualUsina},"${new Date(c.dataAdesao).toLocaleDateString('pt-BR')}","${c.distribuidora}","${c.contrato}"`
                        );
                        const csv = [header, ...rows].join('\n');
                        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        const nomeArquivo = `lista-concessionaria-${usina.nome.replace(/\s+/g, '-').toLowerCase()}-${new Date().toISOString().slice(0, 7)}.csv`;
                        a.href = url;
                        a.download = nomeArquivo;
                        a.click();
                        URL.revokeObjectURL(url);
                      }}
                    >
                      <Download className="h-4 w-4 mr-1" />
                      CSV
                    </Button>
                  )}
                  <Button
                    size="sm"
                    disabled={gerandoLista}
                    onClick={async () => {
                      setGerandoLista(true);
                      try {
                        const { data } = await api.get(`/usinas/${id}/lista-concessionaria`);
                        setLista(data);
                      } catch {
                        setMensagem('Erro ao gerar lista.');
                      } finally {
                        setGerandoLista(false);
                      }
                    }}
                  >
                    {gerandoLista ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
                    {lista ? 'Atualizar' : 'Gerar lista'}
                  </Button>
                </div>
              </CardTitle>
            </CardHeader>
            {lista && (
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>CPF</TableHead>
                      <TableHead>UC</TableHead>
                      <TableHead>kWh</TableHead>
                      <TableHead>% Usina</TableHead>
                      <TableHead>Adesao</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lista.cooperados.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-gray-400 py-6">
                          Nenhum cooperado ativo nesta usina
                        </TableCell>
                      </TableRow>
                    ) : (
                      lista.cooperados.map((c: any, i: number) => (
                        <TableRow key={i}>
                          <TableCell className="font-medium">{c.nomeCompleto}</TableCell>
                          <TableCell>{c.cpf}</TableCell>
                          <TableCell>{c.numeroUC}</TableCell>
                          <TableCell>{c.kwhContratado}</TableCell>
                          <TableCell>{c.percentualUsina}%</TableCell>
                          <TableCell>{new Date(c.dataAdesao).toLocaleDateString('pt-BR')}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            )}
          </Card>
        </>
      )}

      {/* Sheet — Editar Usina */}
      <Sheet open={sheetAberto} onOpenChange={setSheetAberto}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader><SheetTitle>Editar Usina</SheetTitle></SheetHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4">
            <div>
              <label className={lbl}>Nome *</label>
              <input className={cls} {...register('nome')} />
              {errors.nome && <p className="text-xs text-red-500 mt-1">{errors.nome.message}</p>}
            </div>
            <div>
              <label className={lbl}>Potencia (kWp) *</label>
              <input className={cls} type="number" step="0.01" {...register('potenciaKwp')} />
              {errors.potenciaKwp && <p className="text-xs text-red-500 mt-1">{errors.potenciaKwp.message}</p>}
            </div>
            <div>
              <label className={lbl}>Capacidade (kWh/mes)</label>
              <input className={cls} type="number" step="0.01" {...register('capacidadeKwh')} />
              {errors.capacidadeKwh && <p className="text-xs text-red-500 mt-1">{errors.capacidadeKwh.message}</p>}
            </div>
            <div>
              <label className={lbl}>Producao Mensal (kWh)</label>
              <input className={cls} type="number" step="0.01" {...register('producaoMensalKwh')} />
            </div>
            <div>
              <label className={lbl}>Distribuidora</label>
              <input className={cls} {...register('distribuidora')} placeholder="Ex: CEMIG, CPFL, Enel" />
            </div>
            <div>
              <label className={lbl}>Status Homologacao *</label>
              <select className={selCls} {...register('statusHomologacao')}>
                <option value="CADASTRADA">Cadastrada</option>
                <option value="AGUARDANDO_HOMOLOGACAO">Aguardando Homologacao</option>
                <option value="HOMOLOGADA">Homologada pela Concessionaria</option>
                <option value="EM_PRODUCAO">Em Producao</option>
                <option value="SUSPENSA">Suspensa</option>
              </select>
            </div>
            <div>
              <label className={lbl}>Cidade *</label>
              <input className={cls} {...register('cidade')} />
              {errors.cidade && <p className="text-xs text-red-500 mt-1">{errors.cidade.message}</p>}
            </div>
            <div>
              <label className={lbl}>Estado *</label>
              <input className={cls} {...register('estado')} />
              {errors.estado && <p className="text-xs text-red-500 mt-1">{errors.estado.message}</p>}
            </div>
            <div>
              <label className={lbl}>Observacoes</label>
              <textarea className={cls} rows={3} {...register('observacoes')} placeholder="Notas sobre a usina" />
            </div>
            <hr className="my-2" />
            <p className="text-xs font-semibold text-gray-600">Proprietário</p>
            <div>
              <label className={lbl}>Tipo</label>
              <select className={selCls} {...register('proprietarioTipo')}>
                <option value="PF">Pessoa Física</option>
                <option value="PJ">Pessoa Jurídica</option>
              </select>
            </div>
            <div>
              <label className={lbl}>Nome</label>
              <input className={cls} {...register('proprietarioNome')} />
            </div>
            <div>
              <label className={lbl}>CPF/CNPJ</label>
              <input className={cls} {...register('proprietarioCpfCnpj')} />
            </div>
            <div>
              <label className={lbl}>Telefone</label>
              <input className={cls} {...register('proprietarioTelefone')} />
            </div>
            <div>
              <label className={lbl}>Email</label>
              <input className={cls} {...register('proprietarioEmail')} />
            </div>
            {mensagem && mensagem.startsWith('Erro') && (
              <p className="text-sm text-red-500">{mensagem}</p>
            )}
            <SheetFooter className="flex gap-2">
              <Button type="submit" disabled={salvando} className="flex-1">
                {salvando ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Salvar
              </Button>
              <Button type="button" variant="outline" onClick={() => setSheetAberto(false)}>Cancelar</Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>
    </div>
  );
}
