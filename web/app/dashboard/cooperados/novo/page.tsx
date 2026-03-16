'use client';

import { useCallback, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  ArrowLeft, CheckCircle, ChevronRight, FileUp, Loader2,
  Upload, User, Zap,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface DadosOcr {
  titular: string;
  documento: string;
  tipoDocumento: string;
  enderecoInstalacao: string;
  bairro: string;
  cidade: string;
  estado: string;
  cep: string;
  numeroUC: string;
  codigoMedidor: string;
  distribuidora: string;
  classificacao: string;
  modalidadeTarifaria: string;
  tensaoNominal: string;
  tipoFornecimento: string;
  consumoAtualKwh: number;
}

type Etapa = 1 | 2 | 3 | 4;

// ─── CSS helpers ─────────────────────────────────────────────────────────────

const cls = 'w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500';
const lbl = 'block text-xs font-medium text-gray-600 mb-1';

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className={lbl}>{label}</label>
      {children}
    </div>
  );
}

// ─── Stepper indicator ────────────────────────────────────────────────────────

const stepLabels = ['Upload fatura', 'Revisar dados', 'Sucesso', 'Cobrança'];

function Stepper({ etapa }: { etapa: Etapa }) {
  const steps = [1, 2, 4, 3] as const; // display order
  const labels = ['Upload fatura', 'Revisar dados', 'Sucesso', 'Preferência'];
  return (
    <div className="flex items-center gap-2 mb-8">
      {[1, 2, 4, 3].map((s, i) => {
        const num = i + 1;
        const active = etapa === s;
        const done = (etapa === 2 && s === 1) || (etapa === 4 && (s === 1 || s === 2)) || (etapa === 3 && (s === 1 || s === 2 || s === 4));
        return (
          <div key={s} className="flex items-center gap-2">
            <div className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold border-2 transition-all ${done ? 'bg-green-600 border-green-600 text-white' : active ? 'border-green-600 text-green-700 bg-green-50' : 'border-gray-300 text-gray-400'}`}>
              {done ? <CheckCircle className="h-3.5 w-3.5" /> : num}
            </div>
            <span className={`text-xs font-medium hidden sm:block ${active ? 'text-green-700' : done ? 'text-green-600' : 'text-gray-400'}`}>
              {labels[i]}
            </span>
            {i < 3 && <ChevronRight className="h-4 w-4 text-gray-300 shrink-0" />}
          </div>
        );
      })}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function NovoCooperadoPage() {
  const router = useRouter();

  const [etapa, setEtapa] = useState<Etapa>(1);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');

  // OCR
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [drag, setDrag] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // OCR result → feed into form
  const [ocr, setOcr] = useState<DadosOcr | null>(null);

  // Cooperado form
  const [formCoop, setFormCoop] = useState({
    nomeCompleto: '', cpf: '', email: '', telefone: '', status: 'PENDENTE',
  });

  // UC form
  const [formUC, setFormUC] = useState({
    endereco: '', cidade: '', estado: '', cep: '',
    numeroUC: '', distribuidora: '', classificacao: '',
    codigoMedidor: '', bairro: '',
  });

  // After creation
  const [cooperadoId, setCooperadoId] = useState<string | null>(null);
  const [ucsCount, setUcsCount] = useState(0);
  const [ultimaUC, setUltimaUC] = useState<{ endereco: string; distribuidora: string; consumo: number } | null>(null);

  // Step 3 preference
  const [preferencia, setPreferencia] = useState<'CONSOLIDADA' | 'SEPARADA' | ''>('');

  // ── File handling ──────────────────────────────────────────────────────────

  function handleFile(file: File) {
    setArquivo(file);
    setErro('');
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDrag(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }

  function toBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        resolve(result.split(',')[1]); // strip data: prefix
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  // ── Step 1 → 2: OCR ───────────────────────────────────────────────────────

  async function analisarFatura() {
    if (!arquivo) { setErro('Selecione um arquivo primeiro.'); return; }
    setErro('');
    setLoading(true);
    try {
      const arquivoBase64 = await toBase64(arquivo);
      const tipoArquivo = arquivo.type === 'application/pdf' ? 'pdf' : 'imagem';
      const { data } = await api.post<DadosOcr>('/faturas/extrair', { arquivoBase64, tipoArquivo });
      setOcr(data);
      setFormCoop(prev => ({
        ...prev,
        nomeCompleto: data.titular || '',
        cpf: data.documento || '',
      }));
      setFormUC({
        endereco: data.enderecoInstalacao || '',
        cidade: data.cidade || '',
        estado: data.estado || '',
        cep: data.cep || '',
        bairro: data.bairro || '',
        numeroUC: data.numeroUC || '',
        distribuidora: data.distribuidora || '',
        classificacao: data.classificacao || '',
        codigoMedidor: data.codigoMedidor || '',
      });
      setEtapa(2);
    } catch {
      setErro('Erro ao processar fatura. Verifique o arquivo e tente novamente.');
    } finally {
      setLoading(false);
    }
  }

  // ── Step 2 → 4: criar cooperado + UC ──────────────────────────────────────

  async function confirmarCadastro() {
    if (!formCoop.nomeCompleto.trim() || !formCoop.email.trim() || !formCoop.cpf.trim()) {
      setErro('Nome, CPF e email são obrigatórios.');
      return;
    }
    setErro('');
    setLoading(true);
    try {
      let cid = cooperadoId;

      // Só cria cooperado na primeira UC
      if (!cid) {
        const { data: novoCooperado } = await api.post<{ id: string }>('/cooperados', {
          nomeCompleto: formCoop.nomeCompleto,
          cpf: formCoop.cpf,
          email: formCoop.email,
          telefone: formCoop.telefone || undefined,
          status: formCoop.status,
        });
        cid = novoCooperado.id;
        setCooperadoId(cid);
      }

      // Cria UC
      const ucNumero = formUC.numeroUC || `UC-${Date.now()}`;
      await api.post('/ucs', {
        numero: ucNumero,
        endereco: formUC.endereco,
        cidade: formUC.cidade,
        estado: formUC.estado,
        cep: formUC.cep || undefined,
        bairro: formUC.bairro || undefined,
        numeroUC: formUC.numeroUC || undefined,
        distribuidora: formUC.distribuidora || undefined,
        classificacao: formUC.classificacao || undefined,
        codigoMedidor: formUC.codigoMedidor || undefined,
        cooperadoId: cid,
      });

      const novaQtd = ucsCount + 1;
      setUcsCount(novaQtd);
      setUltimaUC({
        endereco: formUC.endereco,
        distribuidora: formUC.distribuidora,
        consumo: ocr?.consumoAtualKwh ?? 0,
      });
      setEtapa(4);
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setErro(msg || 'Erro ao cadastrar. Verifique os dados e tente novamente.');
    } finally {
      setLoading(false);
    }
  }

  // ── Step 4: adicionar outra UC ─────────────────────────────────────────────

  function adicionarOutraUC() {
    setArquivo(null);
    setOcr(null);
    setFormUC({ endereco: '', cidade: '', estado: '', cep: '', bairro: '', numeroUC: '', distribuidora: '', classificacao: '', codigoMedidor: '' });
    setErro('');
    setEtapa(1);
  }

  function finalizar() {
    if (ucsCount >= 2) {
      setEtapa(3);
    } else {
      router.push(`/dashboard/cooperados/${cooperadoId}`);
    }
  }

  // ── Step 3: salvar preferência ─────────────────────────────────────────────

  async function salvarPreferencia() {
    if (!preferencia) { setErro('Selecione uma opção.'); return; }
    if (!cooperadoId) return;
    setLoading(true);
    try {
      await api.put(`/cooperados/${cooperadoId}`, { preferenciaCobranca: preferencia });
      router.push(`/dashboard/cooperados/${cooperadoId}`);
    } catch {
      setErro('Erro ao salvar preferência.');
    } finally {
      setLoading(false);
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-2xl">

      {/* Back */}
      <Link href="/dashboard/cooperados" className="inline-flex items-center text-sm text-gray-500 hover:text-gray-800 mb-6 transition-colors">
        <ArrowLeft className="h-4 w-4 mr-1" />Cooperados
      </Link>

      <h1 className="text-2xl font-bold text-gray-900 mb-6">Novo cooperado</h1>

      <Stepper etapa={etapa} />

      {/* ── ETAPA 1: Upload ─────────────────────────────────────────────────── */}
      {etapa === 1 && (
        <Card>
          <CardContent className="pt-6 space-y-5">
            <div>
              <h2 className="text-base font-semibold text-gray-800 mb-1">Upload da fatura de energia</h2>
              <p className="text-sm text-gray-500">Faça o upload da fatura do cooperado. A IA vai extrair os dados automaticamente.</p>
            </div>

            {/* Drop zone */}
            <div
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
              onDragLeave={() => setDrag(false)}
              onDrop={onDrop}
              className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors ${drag ? 'border-green-500 bg-green-50' : arquivo ? 'border-green-400 bg-green-50' : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'}`}
            >
              <input
                ref={fileRef}
                type="file"
                accept=".pdf,image/*"
                className="hidden"
                onChange={(e) => { if (e.target.files?.[0]) handleFile(e.target.files[0]); }}
              />
              {arquivo ? (
                <div className="space-y-2">
                  <FileUp className="h-10 w-10 text-green-600 mx-auto" />
                  <p className="text-sm font-medium text-green-800">{arquivo.name}</p>
                  <p className="text-xs text-green-600">{(arquivo.size / 1024).toFixed(0)} KB — clique para trocar</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <Upload className="h-10 w-10 text-gray-400 mx-auto" />
                  <p className="text-sm text-gray-600">Arraste o arquivo aqui ou <span className="text-green-700 font-medium">clique para selecionar</span></p>
                  <p className="text-xs text-gray-400">PDF ou imagem (JPG, PNG)</p>
                </div>
              )}
            </div>

            {erro && <p className="text-sm text-red-600">{erro}</p>}

            <Button onClick={analisarFatura} disabled={!arquivo || loading} className="w-full">
              {loading ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Extraindo dados da fatura com IA...</>
              ) : (
                'Analisar fatura'
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* ── ETAPA 2: Revisar dados ───────────────────────────────────────────── */}
      {etapa === 2 && (
        <div className="space-y-5">
          {/* Dados do cooperado */}
          <Card>
            <CardContent className="pt-6 space-y-4">
              <div className="flex items-center gap-2 mb-1">
                <User className="h-4 w-4 text-green-700" />
                <h2 className="text-sm font-semibold text-gray-800">Dados do cooperado</h2>
                {!cooperadoId && <span className="ml-auto text-xs text-gray-400">Preencha email e telefone</span>}
                {cooperadoId && <span className="ml-auto text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">Cooperado já criado</span>}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <Campo label="Nome completo *">
                    <input className={cls} value={formCoop.nomeCompleto} onChange={e => setFormCoop(p => ({ ...p, nomeCompleto: e.target.value }))} disabled={!!cooperadoId} />
                  </Campo>
                </div>
                <Campo label="CPF *">
                  <input className={cls} value={formCoop.cpf} onChange={e => setFormCoop(p => ({ ...p, cpf: e.target.value }))} disabled={!!cooperadoId} placeholder="000.000.000-00" />
                </Campo>
                <Campo label="Status">
                  <select className={cls} value={formCoop.status} onChange={e => setFormCoop(p => ({ ...p, status: e.target.value }))} disabled={!!cooperadoId}>
                    <option value="PENDENTE">Pendente</option>
                    <option value="ATIVO">Ativo</option>
                    <option value="SUSPENSO">Suspenso</option>
                    <option value="ENCERRADO">Encerrado</option>
                  </select>
                </Campo>
                <Campo label="Email *">
                  <input className={cls} type="email" value={formCoop.email} onChange={e => setFormCoop(p => ({ ...p, email: e.target.value }))} disabled={!!cooperadoId} placeholder="email@exemplo.com" />
                </Campo>
                <Campo label="Telefone">
                  <input className={cls} value={formCoop.telefone} onChange={e => setFormCoop(p => ({ ...p, telefone: e.target.value }))} disabled={!!cooperadoId} placeholder="(00) 00000-0000" />
                </Campo>
              </div>
            </CardContent>
          </Card>

          {/* Dados da UC */}
          <Card>
            <CardContent className="pt-6 space-y-4">
              <div className="flex items-center gap-2 mb-1">
                <Zap className="h-4 w-4 text-green-700" />
                <h2 className="text-sm font-semibold text-gray-800">
                  Dados da UC {ucsCount > 0 && <span className="text-gray-400 font-normal">({ucsCount + 1}ª unidade)</span>}
                </h2>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Campo label="Número UC">
                  <input className={cls} value={formUC.numeroUC} onChange={e => setFormUC(p => ({ ...p, numeroUC: e.target.value }))} />
                </Campo>
                <Campo label="Distribuidora">
                  <input className={cls} value={formUC.distribuidora} onChange={e => setFormUC(p => ({ ...p, distribuidora: e.target.value }))} />
                </Campo>
                <div className="col-span-2">
                  <Campo label="Endereço de instalação">
                    <input className={cls} value={formUC.endereco} onChange={e => setFormUC(p => ({ ...p, endereco: e.target.value }))} />
                  </Campo>
                </div>
                <Campo label="Bairro">
                  <input className={cls} value={formUC.bairro} onChange={e => setFormUC(p => ({ ...p, bairro: e.target.value }))} />
                </Campo>
                <Campo label="CEP">
                  <input className={cls} value={formUC.cep} onChange={e => setFormUC(p => ({ ...p, cep: e.target.value }))} />
                </Campo>
                <Campo label="Cidade">
                  <input className={cls} value={formUC.cidade} onChange={e => setFormUC(p => ({ ...p, cidade: e.target.value }))} />
                </Campo>
                <Campo label="Estado (UF)">
                  <input className={cls} value={formUC.estado} onChange={e => setFormUC(p => ({ ...p, estado: e.target.value }))} maxLength={2} />
                </Campo>
                <Campo label="Classificação">
                  <input className={cls} value={formUC.classificacao} onChange={e => setFormUC(p => ({ ...p, classificacao: e.target.value }))} placeholder="Residencial, Comercial..." />
                </Campo>
                <Campo label="Cód. medidor">
                  <input className={cls} value={formUC.codigoMedidor} onChange={e => setFormUC(p => ({ ...p, codigoMedidor: e.target.value }))} />
                </Campo>
              </div>

              {ocr && (
                <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-sm text-green-800">
                  <span className="font-medium">Consumo atual extraído:</span> {ocr.consumoAtualKwh?.toLocaleString('pt-BR')} kWh
                </div>
              )}
            </CardContent>
          </Card>

          {erro && <p className="text-sm text-red-600">{erro}</p>}

          <div className="flex gap-3">
            <Button variant="outline" onClick={() => { setEtapa(1); setErro(''); }}>Voltar</Button>
            <Button onClick={confirmarCadastro} disabled={loading} className="flex-1">
              {loading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Salvando...</> : 'Confirmar e cadastrar'}
            </Button>
          </div>
        </div>
      )}

      {/* ── ETAPA 4: Sucesso ─────────────────────────────────────────────────── */}
      {etapa === 4 && (
        <Card>
          <CardContent className="pt-8 pb-8 space-y-6">
            <div className="text-center space-y-2">
              <div className="flex justify-center">
                <div className="bg-green-100 rounded-full p-4">
                  <CheckCircle className="h-10 w-10 text-green-600" />
                </div>
              </div>
              <h2 className="text-lg font-bold text-gray-900">
                {ucsCount === 1 ? 'Cooperado cadastrado com sucesso!' : `${ucsCount}ª UC cadastrada com sucesso!`}
              </h2>
              <p className="text-sm text-gray-500">{formCoop.nomeCompleto}</p>
            </div>

            {/* Resumo UC */}
            {ultimaUC && (
              <div className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-4 space-y-2 text-sm">
                <div className="flex justify-between text-gray-600">
                  <span>Endereço</span>
                  <span className="font-medium text-gray-900 text-right max-w-xs">{ultimaUC.endereco}</span>
                </div>
                {ultimaUC.distribuidora && (
                  <div className="flex justify-between text-gray-600">
                    <span>Distribuidora</span>
                    <span className="font-medium text-gray-900">{ultimaUC.distribuidora}</span>
                  </div>
                )}
                {ultimaUC.consumo > 0 && (
                  <div className="flex justify-between text-gray-600">
                    <span>Consumo atual</span>
                    <span className="font-medium text-gray-900">{ultimaUC.consumo.toLocaleString('pt-BR')} kWh</span>
                  </div>
                )}
                <div className="flex justify-between text-gray-600">
                  <span>UCs cadastradas</span>
                  <span className="font-medium text-green-700">{ucsCount}</span>
                </div>
              </div>
            )}

            <div className="border-t pt-5 space-y-3">
              <p className="text-sm font-medium text-gray-700 text-center">
                Este cooperado possui outro endereço com energia solar?
              </p>
              <div className="flex gap-3">
                <Button variant="outline" className="flex-1" onClick={adicionarOutraUC}>
                  Sim, cadastrar outra UC
                </Button>
                <Button className="flex-1" onClick={finalizar}>
                  Não, finalizar
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── ETAPA 3: Preferência de cobrança ─────────────────────────────────── */}
      {etapa === 3 && (
        <Card>
          <CardContent className="pt-6 space-y-6">
            <div>
              <h2 className="text-base font-semibold text-gray-800 mb-1">Como deseja receber as cobranças?</h2>
              <p className="text-sm text-gray-500">Este cooperado possui {ucsCount} unidades cadastradas.</p>
            </div>

            <div className="space-y-3">
              <button
                onClick={() => setPreferencia('CONSOLIDADA')}
                className={`w-full text-left border-2 rounded-xl p-4 transition-colors ${preferencia === 'CONSOLIDADA' ? 'border-green-600 bg-green-50' : 'border-gray-200 hover:border-gray-300'}`}
              >
                <div className="flex items-start gap-3">
                  <div className={`mt-0.5 w-4 h-4 rounded-full border-2 shrink-0 ${preferencia === 'CONSOLIDADA' ? 'border-green-600 bg-green-600' : 'border-gray-400'}`} />
                  <div>
                    <p className="text-sm font-semibold text-gray-800">Fatura única consolidada</p>
                    <p className="text-xs text-gray-500 mt-0.5">Uma cobrança por mês com a soma de todas as UCs</p>
                  </div>
                </div>
              </button>

              <button
                onClick={() => setPreferencia('SEPARADA')}
                className={`w-full text-left border-2 rounded-xl p-4 transition-colors ${preferencia === 'SEPARADA' ? 'border-green-600 bg-green-50' : 'border-gray-200 hover:border-gray-300'}`}
              >
                <div className="flex items-start gap-3">
                  <div className={`mt-0.5 w-4 h-4 rounded-full border-2 shrink-0 ${preferencia === 'SEPARADA' ? 'border-green-600 bg-green-600' : 'border-gray-400'}`} />
                  <div>
                    <p className="text-sm font-semibold text-gray-800">Faturas separadas por UC</p>
                    <p className="text-xs text-gray-500 mt-0.5">Uma cobrança por endereço a cada mês</p>
                  </div>
                </div>
              </button>
            </div>

            {erro && <p className="text-sm text-red-600">{erro}</p>}

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => router.push(`/dashboard/cooperados/${cooperadoId}`)}>
                Pular
              </Button>
              <Button onClick={salvarPreferencia} disabled={!preferencia || loading} className="flex-1">
                {loading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Salvando...</> : 'Salvar e finalizar'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

    </div>
  );
}
