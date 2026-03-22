'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import api from '@/lib/api';
import type { Usina, StatusUsina } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Download, Loader2, Pencil } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

function Campo({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-gray-500 mb-0.5">{label}</p>
      <p className="text-sm font-medium text-gray-800">{value ?? '—'}</p>
    </div>
  );
}

const inputClass =
  'w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-green-500';
const labelClass = 'text-xs text-gray-500 mb-0.5 block';
const selectClass =
  'w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-green-500 bg-white';

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

export default function UsinaDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [usina, setUsina] = useState<Usina | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [modoEdicao, setModoEdicao] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState('');
  const [form, setForm] = useState({
    nome: '',
    potenciaKwp: '',
    capacidadeKwh: '',
    producaoMensalKwh: '',
    cidade: '',
    estado: '',
    statusHomologacao: 'CADASTRADA' as StatusUsina,
    observacoes: '',
  });
  const [lista, setLista] = useState<any>(null);
  const [gerandoLista, setGerandoLista] = useState(false);

  useEffect(() => {
    api.get<Usina>(`/usinas/${id}`)
      .then((r) => {
        setUsina(r.data);
        setForm({
          nome: r.data.nome,
          potenciaKwp: String(r.data.potenciaKwp),
          capacidadeKwh: r.data.capacidadeKwh ? String(r.data.capacidadeKwh) : '',
          producaoMensalKwh: r.data.producaoMensalKwh ? String(r.data.producaoMensalKwh) : '',
          cidade: r.data.cidade,
          estado: r.data.estado,
          statusHomologacao: r.data.statusHomologacao || 'CADASTRADA',
          observacoes: r.data.observacoes || '',
        });
      })
      .catch(() => setErro('Usina não encontrada.'))
      .finally(() => setCarregando(false));
  }, [id]);

  function iniciarEdicao() {
    if (!usina) return;
    setForm({
      nome: usina.nome,
      potenciaKwp: String(usina.potenciaKwp),
      capacidadeKwh: usina.capacidadeKwh ? String(usina.capacidadeKwh) : '',
      producaoMensalKwh: usina.producaoMensalKwh ? String(usina.producaoMensalKwh) : '',
      cidade: usina.cidade,
      estado: usina.estado,
      statusHomologacao: usina.statusHomologacao || 'CADASTRADA',
      observacoes: usina.observacoes || '',
    });
    setMensagem('');
    setModoEdicao(true);
  }

  function cancelar() {
    setModoEdicao(false);
    setMensagem('');
  }

  async function salvar() {
    setSalvando(true);
    setMensagem('');
    try {
      const { data } = await api.put<Usina>(`/usinas/${id}`, {
        nome: form.nome,
        potenciaKwp: parseFloat(form.potenciaKwp),
        capacidadeKwh: form.capacidadeKwh ? parseFloat(form.capacidadeKwh) : null,
        producaoMensalKwh: form.producaoMensalKwh ? parseFloat(form.producaoMensalKwh) : null,
        cidade: form.cidade,
        estado: form.estado,
        statusHomologacao: form.statusHomologacao,
        observacoes: form.observacoes || null,
      });
      setUsina(data);
      setModoEdicao(false);
      setMensagem('Salvo com sucesso!');
    } catch (e: any) {
      const msg = e?.response?.data?.message || 'Erro ao salvar. Tente novamente.';
      setMensagem(typeof msg === 'string' ? msg : JSON.stringify(msg));
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
        {usina && !modoEdicao && (
          <Button size="sm" variant="outline" onClick={iniciarEdicao} className="ml-auto">
            <Pencil className="h-4 w-4 mr-2" />
            Editar
          </Button>
        )}
      </div>

      {carregando && <p className="text-gray-500">Carregando...</p>}
      {erro && <p className="text-red-500">{erro}</p>}
      {mensagem && (
        <p className={`mb-4 text-sm ${mensagem.startsWith('Erro') || mensagem.includes('inválid') ? 'text-red-500' : 'text-green-600'}`}>
          {mensagem}
        </p>
      )}

      {usina && !modoEdicao && (
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
              <Campo label="Cidade" value={usina.cidade} />
              <Campo label="Estado" value={usina.estado} />
              <Campo label="Status Homologacao" value={
                <span className={`text-xs px-2 py-1 rounded-full font-medium ${statusColors[status] ?? 'bg-gray-100'}`}>
                  {statusLabels[status] ?? status}
                </span>
              } />
              <Campo label="Data Homologacao" value={usina.dataHomologacao ? new Date(usina.dataHomologacao).toLocaleDateString('pt-BR') : '—'} />
              <Campo label="Inicio Producao" value={usina.dataInicioProducao ? new Date(usina.dataInicioProducao).toLocaleDateString('pt-BR') : '—'} />
              {usina.observacoes && <Campo label="Observacoes" value={usina.observacoes} />}
              <Campo label="Criado em" value={new Date(usina.createdAt).toLocaleString('pt-BR')} />
              <Campo label="Atualizado em" value={new Date(usina.updatedAt).toLocaleString('pt-BR')} />
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

      {usina && modoEdicao && (
        <Card>
          <CardHeader>
            <CardTitle>Editar Usina</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-6">
            <div>
              <label className={labelClass}>Nome</label>
              <input
                className={inputClass}
                value={form.nome}
                onChange={(e) => setForm({ ...form, nome: e.target.value })}
              />
            </div>
            <div>
              <label className={labelClass}>Potencia (kWp)</label>
              <input
                className={inputClass}
                type="number"
                step="0.01"
                value={form.potenciaKwp}
                onChange={(e) => setForm({ ...form, potenciaKwp: e.target.value })}
              />
            </div>
            <div>
              <label className={labelClass}>Capacidade (kWh/mes)</label>
              <input
                className={inputClass}
                type="number"
                step="0.01"
                value={form.capacidadeKwh}
                onChange={(e) => setForm({ ...form, capacidadeKwh: e.target.value })}
              />
            </div>
            <div>
              <label className={labelClass}>Producao Mensal (kWh)</label>
              <input
                className={inputClass}
                type="number"
                step="0.01"
                value={form.producaoMensalKwh}
                onChange={(e) => setForm({ ...form, producaoMensalKwh: e.target.value })}
              />
            </div>
            <div>
              <label className={labelClass}>Status Homologacao</label>
              <select
                className={selectClass}
                value={form.statusHomologacao}
                onChange={(e) => setForm({ ...form, statusHomologacao: e.target.value as StatusUsina })}
              >
                <option value="CADASTRADA">Cadastrada</option>
                <option value="AGUARDANDO_HOMOLOGACAO">Aguardando Homologacao</option>
                <option value="HOMOLOGADA">Homologada pela Concessionaria</option>
                <option value="EM_PRODUCAO">Em Producao</option>
                <option value="SUSPENSA">Suspensa</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>Cidade</label>
              <input
                className={inputClass}
                value={form.cidade}
                onChange={(e) => setForm({ ...form, cidade: e.target.value })}
              />
            </div>
            <div>
              <label className={labelClass}>Estado</label>
              <input
                className={inputClass}
                value={form.estado}
                onChange={(e) => setForm({ ...form, estado: e.target.value })}
              />
            </div>
            <div className="col-span-2">
              <label className={labelClass}>Observacoes</label>
              <textarea
                className={inputClass}
                rows={3}
                value={form.observacoes}
                onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
                placeholder="Notas sobre a usina, concessionaria, etc."
              />
            </div>
            <div className="col-span-2 flex gap-3 mt-2">
              <Button onClick={salvar} disabled={salvando}>
                {salvando ? 'Salvando...' : 'Salvar'}
              </Button>
              <Button variant="outline" onClick={cancelar} disabled={salvando}>
                Cancelar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
