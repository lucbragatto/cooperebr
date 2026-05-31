'use client';

/**
 * D-novo-BR-CT CT.6 (31/05/2026) — CRUD Convênios CT.2 (Art. 88 Lei 5.764/71).
 *
 * Conecta no endpoint /contabilidade-tributaria/convenios (model novo,
 * diferente de ContratoConvenio legado). Select nativo dentro Dialog
 * (regra 19/05). Padrão Dual: lista inline + Dialog Tipo C para ações.
 */

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Plus, FileCheck, Trash2 } from 'lucide-react';

type Convenio = {
  id: string;
  nome: string;
  descricao: string | null;
  tipoBeneficio: string;
  fluxoFinanceiro: string;
  classificacaoFiscal: string;
  vigenciaInicio: string;
  vigenciaFim: string | null;
  ativo: boolean;
};

const FLUXOS = [
  { value: 'INGRESSO_CUSTEIO_AUXILIAR', label: 'Ingresso (custeio recebido)' },
  { value: 'REPASSE_PROVEDOR_EXTERNO', label: 'Repasse (saída pra provedor)' },
  { value: 'CUSTO_OPERACIONAL_INTERNO', label: 'Custo operacional interno' },
];

export default function ConveniosCtPage() {
  const [convenios, setConvenios] = useState<Convenio[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const [novoOpen, setNovoOpen] = useState(false);
  const [removerId, setRemoverId] = useState<string | null>(null);

  const [form, setForm] = useState({
    nome: '',
    descricao: '',
    fluxoFinanceiro: 'INGRESSO_CUSTEIO_AUXILIAR',
    classificacaoFiscal: 'Ato Auxiliar Art. 88 Lei 5.764/71 + STF Tema 536',
    vigenciaInicio: new Date().toISOString().slice(0, 10),
    vigenciaFim: '',
  });
  const [salvando, setSalvando] = useState(false);

  async function carregar() {
    setLoading(true);
    setErro('');
    try {
      const { data } = await api.get<Convenio[]>('/contabilidade-tributaria/convenios');
      setConvenios(data);
    } catch (err: any) {
      setErro(err?.response?.data?.message || 'Falha ao carregar');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    carregar();
  }, []);

  async function criar() {
    if (!form.nome || !form.fluxoFinanceiro || !form.classificacaoFiscal) {
      setErro('Preencha nome, fluxo e classificação fiscal');
      return;
    }
    setSalvando(true);
    setErro('');
    try {
      await api.post('/contabilidade-tributaria/convenios', {
        nome: form.nome,
        descricao: form.descricao || undefined,
        fluxoFinanceiro: form.fluxoFinanceiro,
        classificacaoFiscal: form.classificacaoFiscal,
        vigenciaInicio: form.vigenciaInicio,
        vigenciaFim: form.vigenciaFim || undefined,
      });
      setNovoOpen(false);
      setForm({
        nome: '',
        descricao: '',
        fluxoFinanceiro: 'INGRESSO_CUSTEIO_AUXILIAR',
        classificacaoFiscal: 'Ato Auxiliar Art. 88 Lei 5.764/71 + STF Tema 536',
        vigenciaInicio: new Date().toISOString().slice(0, 10),
        vigenciaFim: '',
      });
      await carregar();
    } catch (err: any) {
      setErro(err?.response?.data?.message || 'Falha ao criar');
    } finally {
      setSalvando(false);
    }
  }

  async function remover(id: string) {
    try {
      await api.delete(`/contabilidade-tributaria/convenios/${id}`);
      setRemoverId(null);
      await carregar();
    } catch (err: any) {
      setErro(err?.response?.data?.message || 'Falha ao remover');
    }
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <FileCheck className="h-6 w-6 text-cyan-700" />
            Convênios — Art. 88 Lei 5.764/71
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Convênios pra consecução do objeto social (ato cooperativo auxiliar)
          </p>
        </div>
        <Button onClick={() => setNovoOpen(true)} className="bg-cyan-700 hover:bg-cyan-800">
          <Plus className="h-4 w-4 mr-1" /> Novo convênio
        </Button>
      </div>

      <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded text-xs text-blue-800">
        <p>
          <strong>Diferente de ContratoConvenio legado:</strong> este model é da contabilidade tributária CT.2.
          Aqui você cataloga convênios formais com provedores/cooperados pra que o motor de classificação
          marque os lançamentos como <Badge variant="outline" className="bg-blue-100 text-blue-800 border-blue-300">AUXILIAR</Badge>
          (não tributado — fluxo entrada=saída sem retenção).
        </p>
      </div>

      {erro && (
        <div className="bg-red-50 border-l-4 border-red-500 p-3 text-sm text-red-700 rounded">{erro}</div>
      )}

      {loading && (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-cyan-700" />
        </div>
      )}

      {!loading && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {convenios.length} convênio(s) cadastrado(s)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {convenios.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-8">
                Nenhum convênio cadastrado. Clique em "Novo convênio" para começar.
              </p>
            ) : (
              <table className="w-full text-sm">
                <thead className="text-xs text-gray-500 border-b">
                  <tr>
                    <th className="text-left py-2">Nome</th>
                    <th className="text-left py-2">Fluxo</th>
                    <th className="text-left py-2">Classificação Fiscal</th>
                    <th className="text-left py-2">Vigência</th>
                    <th className="text-center py-2">Status</th>
                    <th className="text-right py-2">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {convenios.map((c) => (
                    <tr key={c.id} className="border-b hover:bg-gray-50">
                      <td className="py-2">
                        <div className="font-medium">{c.nome}</div>
                        {c.descricao && (
                          <div className="text-xs text-gray-500">{c.descricao}</div>
                        )}
                      </td>
                      <td className="py-2 text-xs">{c.fluxoFinanceiro}</td>
                      <td className="py-2 text-xs text-gray-600">{c.classificacaoFiscal}</td>
                      <td className="py-2 text-xs">
                        {new Date(c.vigenciaInicio).toLocaleDateString('pt-BR')}
                        {c.vigenciaFim && (
                          <> → {new Date(c.vigenciaFim).toLocaleDateString('pt-BR')}</>
                        )}
                      </td>
                      <td className="text-center py-2">
                        {c.ativo ? (
                          <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-300">
                            Ativo
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-gray-100 text-gray-600">
                            Inativo
                          </Badge>
                        )}
                      </td>
                      <td className="text-right py-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setRemoverId(c.id)}
                          className="text-rose-700 hover:bg-rose-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      )}

      {/* Dialog Novo — select nativo (regra 19/05) */}
      <Dialog open={novoOpen} onOpenChange={setNovoOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo Convênio</DialogTitle>
            <DialogDescription>
              Cadastre o convênio com classificação fiscal pra defender ato auxiliar perante a fisco.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nome *</Label>
              <Input
                value={form.nome}
                onChange={(e) => setForm({ ...form, nome: e.target.value })}
                placeholder="Ex: Convênio EDP ES Custeio Solar 2026"
              />
            </div>
            <div>
              <Label>Descrição</Label>
              <Input
                value={form.descricao}
                onChange={(e) => setForm({ ...form, descricao: e.target.value })}
                placeholder="Detalhes do convênio (opcional)"
              />
            </div>
            <div>
              <Label>Fluxo financeiro *</Label>
              <select
                value={form.fluxoFinanceiro}
                onChange={(e) => setForm({ ...form, fluxoFinanceiro: e.target.value })}
                className="w-full border rounded px-2 py-1.5 text-sm"
              >
                {FLUXOS.map((f) => (
                  <option key={f.value} value={f.value}>
                    {f.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label>Classificação fiscal *</Label>
              <Input
                value={form.classificacaoFiscal}
                onChange={(e) => setForm({ ...form, classificacaoFiscal: e.target.value })}
              />
              <p className="text-xs text-gray-500 mt-1">
                Texto livre citando fundamento legal — ex: "Ato Auxiliar Art. 88 Lei 5.764/71 + STF Tema 536"
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Vigência início *</Label>
                <Input
                  type="date"
                  value={form.vigenciaInicio}
                  onChange={(e) => setForm({ ...form, vigenciaInicio: e.target.value })}
                />
              </div>
              <div>
                <Label>Vigência fim</Label>
                <Input
                  type="date"
                  value={form.vigenciaFim}
                  onChange={(e) => setForm({ ...form, vigenciaFim: e.target.value })}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNovoOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={criar} disabled={salvando} className="bg-cyan-700 hover:bg-cyan-800">
              {salvando && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              Criar convênio
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Remover */}
      <Dialog open={!!removerId} onOpenChange={(o) => !o && setRemoverId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remover convênio?</DialogTitle>
            <DialogDescription>
              Esta ação é irreversível. Lançamentos passados que referenciam este convênio mantêm a classificação histórica.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRemoverId(null)}>
              Cancelar
            </Button>
            <Button onClick={() => removerId && remover(removerId)} className="bg-rose-700 hover:bg-rose-800">
              Remover
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
