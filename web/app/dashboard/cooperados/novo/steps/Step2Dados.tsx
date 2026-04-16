'use client';

import { useEffect, useState } from 'react';
import { User, Gift, Loader2, Check, AlertTriangle } from 'lucide-react';
import api from '@/lib/api';
import type { Step1Data } from './Step1Fatura';

export interface Step2Data {
  nomeCompleto: string;
  cpf: string;
  email: string;
  telefone: string;
  endereco: string;
  bairro: string;
  cidade: string;
  estado: string;
  cep: string;
  tipoPessoa: 'PF' | 'PJ';
  representanteLegalNome: string;
  representanteLegalCpf: string;
  representanteLegalCargo: string;
  formaPagamento: string;
  codigoIndicacao: string;
  cooperadoId: string;
  ucId: string;
}

interface Step2Props {
  data: Step2Data;
  faturaData: Step1Data;
  onChange: (partial: Partial<Step2Data>) => void;
  tipoMembro: string;
}

const cls = 'w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500';

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      {children}
    </div>
  );
}

function maskCPF(v: string) {
  const nums = v.replace(/\D/g, '').slice(0, 11);
  return nums.replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2');
}

function maskCNPJ(v: string) {
  const nums = v.replace(/\D/g, '').slice(0, 14);
  return nums.replace(/(\d{2})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1/$2').replace(/(\d{4})(\d{1,2})$/, '$1-$2');
}

function maskTelefone(v: string) {
  const nums = v.replace(/\D/g, '').slice(0, 11);
  if (nums.length <= 10) return nums.replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{4})(\d)/, '$1-$2');
  return nums.replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{5})(\d)/, '$1-$2');
}

function validarCPF(cpf: string): boolean {
  const nums = cpf.replace(/\D/g, '');
  if (nums.length !== 11 || /^(\d)\1+$/.test(nums)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(nums[i]) * (10 - i);
  let rest = (sum * 10) % 11; if (rest === 10) rest = 0;
  if (rest !== parseInt(nums[9])) return false;
  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(nums[i]) * (11 - i);
  rest = (sum * 10) % 11; if (rest === 10) rest = 0;
  return rest === parseInt(nums[10]);
}

function validarCNPJ(cnpj: string): boolean {
  const nums = cnpj.replace(/\D/g, '');
  if (nums.length !== 14 || /^(\d)\1+$/.test(nums)) return false;
  const pesos1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const pesos2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += parseInt(nums[i]) * pesos1[i];
  let rest = sum % 11; const d1 = rest < 2 ? 0 : 11 - rest;
  if (parseInt(nums[12]) !== d1) return false;
  sum = 0;
  for (let i = 0; i < 13; i++) sum += parseInt(nums[i]) * pesos2[i];
  rest = sum % 11; const d2 = rest < 2 ? 0 : 11 - rest;
  return parseInt(nums[13]) === d2;
}

export default function Step2Dados({ data, faturaData, onChange, tipoMembro }: Step2Props) {
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [cpfDuplicado, setCpfDuplicado] = useState<{ id: string; nomeCompleto: string; email: string } | null>(null);

  // Pré-preencher código de indicação do localStorage (vindo do ?ref= na landing page)
  useEffect(() => {
    if (!data.codigoIndicacao) {
      const ref = typeof window !== 'undefined' ? localStorage.getItem('codigoIndicacao') : null;
      if (ref) onChange({ codigoIndicacao: ref });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const isPJ = data.tipoPessoa === 'PJ';
  const docNums = data.cpf.replace(/\D/g, '');
  const docValido = isPJ ? (docNums.length < 14 || validarCNPJ(data.cpf)) : (docNums.length < 11 || validarCPF(data.cpf));
  const jaSalvo = !!data.cooperadoId;

  function handleDoc(v: string) {
    const nums = v.replace(/\D/g, '');
    if (isPJ) onChange({ cpf: maskCNPJ(v) });
    else if (nums.length > 11) onChange({ cpf: maskCNPJ(v), tipoPessoa: 'PJ' });
    else onChange({ cpf: maskCPF(v) });
  }

  async function usarCooperadoExistente(cooperadoId: string) {
    setCpfDuplicado(null);
    setErro('');
    setSalvando(true);
    try {
      // Buscar UCs do cooperado existente
      const { data: ucs } = await api.get<Array<{ id: string }>>(`/ucs?cooperadoId=${cooperadoId}`);
      const ucId = ucs.length > 0 ? ucs[0].id : '';
      if (!ucId && faturaData.ocr) {
        // Cooperado existe mas sem UC — criar
        const ucPayload = {
          numero: faturaData.ocr.numeroUC || 'UC-' + Date.now(),
          endereco: data.endereco,
          cidade: data.cidade,
          estado: data.estado,
          cooperadoId,
          cep: data.cep.replace(/\D/g, '') || undefined,
          bairro: data.bairro || undefined,
          distribuidora: faturaData.ocr.distribuidora || undefined,
        };
        const { data: ucCriada } = await api.post<{ id: string }>('/ucs', ucPayload);
        onChange({ cooperadoId, ucId: ucCriada.id });
      } else {
        onChange({ cooperadoId, ucId });
      }
    } catch {
      setErro('Erro ao carregar cooperado existente. Tente novamente.');
    } finally {
      setSalvando(false);
    }
  }

  async function salvarCooperado() {
    setErro('');
    setCpfDuplicado(null);
    setSalvando(true);
    try {
      // 1. Criar cooperado
      const cpfLimpo = data.cpf.replace(/\D/g, '');
      const payload: Record<string, unknown> = {
        nomeCompleto: data.nomeCompleto.trim(),
        cpf: cpfLimpo,
        email: data.email.trim(),
        telefone: data.telefone.replace(/\D/g, '') || undefined,
        status: 'PENDENTE',
        tipoPessoa: data.tipoPessoa,
        preferenciaCobranca: data.formaPagamento,
      };
      if (isPJ) {
        payload.representanteLegalNome = data.representanteLegalNome || undefined;
        payload.representanteLegalCpf = data.representanteLegalCpf?.replace(/\D/g, '') || undefined;
        payload.representanteLegalCargo = data.representanteLegalCargo || undefined;
      }

      let cooperadoId: string;
      try {
        const { data: cooperado } = await api.post<{ id: string }>('/cooperados', payload);
        cooperadoId = cooperado.id;
      } catch (err: unknown) {
        const resp = (err as { response?: { status?: number; data?: { message?: string } } })?.response;
        if (resp?.status === 409) {
          const msg = resp.data?.message ?? '';
          if (msg.includes('Email')) {
            setErro('Email já cadastrado para outro cooperado. Verifique o email informado.');
            return;
          }
          const cpfBusca = cpfLimpo;
          const { data: lista } = await api.get<Array<{ id: string; nomeCompleto: string; email: string; cpf: string }>>(`/cooperados?search=${cpfBusca}&limit=5`);
          const existente = lista.find((c) => c.cpf?.replace(/\D/g, '') === cpfBusca);
          if (existente) {
            setCpfDuplicado({ id: existente.id, nomeCompleto: existente.nomeCompleto, email: existente.email });
          } else {
            setErro('CPF já cadastrado mas não foi possível localizar o registro. Verifique no painel de cooperados.');
          }
          return;
        }
        throw err;
      }

      // 2. Criar UC com dados do OCR
      let ucId = '';
      if (faturaData.ocr) {
        const ucPayload = {
          numero: faturaData.ocr.numeroUC || 'UC-' + Date.now(),
          endereco: data.endereco,
          cidade: data.cidade,
          estado: data.estado,
          cooperadoId,
          cep: data.cep.replace(/\D/g, '') || undefined,
          bairro: data.bairro || undefined,
          distribuidora: faturaData.ocr.distribuidora || undefined,
        };
        const { data: ucCriada } = await api.post<{ id: string }>('/ucs', ucPayload);
        ucId = ucCriada.id;
      }

      onChange({ cooperadoId, ucId });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro ao salvar cooperado.';
      setErro(message);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 mb-1">
        <User className="h-4 w-4 text-green-700" />
        <h2 className="text-base font-semibold text-gray-800">Dados do {tipoMembro.toLowerCase()}</h2>
        <span className="ml-auto text-xs text-gray-400">Pré-preenchidos pela fatura</span>
      </div>

      {/* Tipo de membro (informativo) */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-sm text-blue-800">
        Este membro será cadastrado como: <span className="font-semibold">{tipoMembro}</span>
      </div>

      {/* Tipo pessoa */}
      <div className="flex gap-2">
        {(['PF', 'PJ'] as const).map(t => (
          <button key={t} onClick={() => onChange({ tipoPessoa: t })}
            className={`flex-1 text-sm px-3 py-2 rounded-lg border-2 transition-colors ${data.tipoPessoa === t ? 'border-green-600 bg-green-50 text-green-800 font-medium' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>
            {t === 'PF' ? 'Pessoa Física' : 'Pessoa Jurídica'}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <Campo label="Nome completo *">
            <input className={cls} value={data.nomeCompleto} onChange={e => onChange({ nomeCompleto: e.target.value })} />
          </Campo>
        </div>
        <Campo label={isPJ ? 'CNPJ *' : 'CPF *'}>
          <input className={`${cls} ${!docValido ? 'border-red-400 focus:ring-red-500' : ''}`}
            value={data.cpf} onChange={e => handleDoc(e.target.value)}
            placeholder={isPJ ? '00.000.000/0000-00' : '000.000.000-00'} />
          {!docValido && <p className="text-xs text-red-500 mt-1">{isPJ ? 'CNPJ' : 'CPF'} inválido</p>}
        </Campo>
        <Campo label="Email *">
          <input className={cls} type="email" value={data.email} onChange={e => onChange({ email: e.target.value })} placeholder="email@exemplo.com" />
        </Campo>
        <Campo label="Telefone/WhatsApp *">
          <input className={cls} value={data.telefone} onChange={e => onChange({ telefone: maskTelefone(e.target.value) })} placeholder="(00) 00000-0000" />
        </Campo>
        <div className="col-span-2">
          <Campo label="Endereço completo">
            <input className={cls} value={data.endereco} onChange={e => onChange({ endereco: e.target.value })} />
          </Campo>
        </div>
        <Campo label="Bairro">
          <input className={cls} value={data.bairro} onChange={e => onChange({ bairro: e.target.value })} />
        </Campo>
        <Campo label="CEP">
          <input className={cls} value={data.cep} onChange={e => onChange({ cep: e.target.value })} />
        </Campo>
        <Campo label="Cidade">
          <input className={cls} value={data.cidade} onChange={e => onChange({ cidade: e.target.value })} />
        </Campo>
        <Campo label="Estado (UF)">
          <input className={cls} value={data.estado} onChange={e => onChange({ estado: e.target.value })} maxLength={2} />
        </Campo>
      </div>

      {/* PJ: representante legal */}
      {isPJ && (
        <div className="border border-gray-200 rounded-lg p-4 space-y-3">
          <h3 className="text-sm font-semibold text-gray-700">Representante Legal</h3>
          <div className="grid grid-cols-3 gap-3">
            <Campo label="Nome">
              <input className={cls} value={data.representanteLegalNome} onChange={e => onChange({ representanteLegalNome: e.target.value })} />
            </Campo>
            <Campo label="CPF">
              <input className={cls} value={data.representanteLegalCpf} onChange={e => onChange({ representanteLegalCpf: maskCPF(e.target.value) })} placeholder="000.000.000-00" />
            </Campo>
            <Campo label="Cargo">
              <input className={cls} value={data.representanteLegalCargo} onChange={e => onChange({ representanteLegalCargo: e.target.value })} placeholder="Sócio-administrador" />
            </Campo>
          </div>
        </div>
      )}

      {/* Forma de pagamento */}
      <Campo label="Forma de pagamento preferida">
        <select className={cls} value={data.formaPagamento} onChange={e => onChange({ formaPagamento: e.target.value })}>
          <option value="BOLETO">Boleto bancário</option>
          <option value="PIX">PIX</option>
          <option value="CARTAO_CREDITO">Cartão de crédito</option>
          <option value="DEBITO_CONTA">Débito em conta</option>
          <option value="DEBITO_FOLHA">Débito em folha</option>
          <option value="CONSIGNADO">Consignado</option>
        </select>
      </Campo>

      {/* Código de indicação */}
      <div className="border border-green-200 rounded-lg p-4 bg-green-50/50">
        <div className="flex items-center gap-2 mb-2">
          <Gift className="h-4 w-4 text-green-600" />
          <span className="text-sm font-medium text-green-800">Indicação</span>
        </div>
        <Campo label="Código de indicação (opcional)">
          <input
            className={cls}
            value={data.codigoIndicacao}
            onChange={e => onChange({ codigoIndicacao: e.target.value })}
            placeholder="Ex: clxxxxxxxxxxxxxxxxxx"
          />
          <p className="text-xs text-gray-500 mt-1">Se este membro foi indicado, insira o código do indicador</p>
        </Campo>
      </div>

      {/* CPF duplicado — dialog de confirmação */}
      {cpfDuplicado && (
        <div className="border-2 border-amber-400 rounded-lg p-4 bg-amber-50 space-y-3">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-amber-800">CPF já cadastrado</p>
              <p className="text-sm text-amber-700 mt-1">
                Encontrado: <strong>{cpfDuplicado.nomeCompleto}</strong> ({cpfDuplicado.email})
              </p>
              <p className="text-xs text-amber-600 mt-1">Deseja continuar com o cadastro existente?</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => usarCooperadoExistente(cpfDuplicado.id)}
              disabled={salvando}
              className="flex-1 bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium py-2 px-4 rounded-lg transition-colors disabled:opacity-50"
            >
              {salvando ? 'Carregando...' : 'Usar cadastro existente'}
            </button>
            <button
              onClick={() => setCpfDuplicado(null)}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 border border-gray-300 rounded-lg transition-colors"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Erro */}
      {erro && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
          {erro}
        </div>
      )}

      {/* Salvar membro + UC */}
      {jaSalvo ? (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-2">
          <Check className="h-5 w-5 text-green-600" />
          <span className="text-sm text-green-800 font-medium">
            {tipoMembro} salvo. Pode avançar para simulação.
          </span>
        </div>
      ) : (
        <button
          onClick={salvarCooperado}
          disabled={salvando || !data.nomeCompleto.trim() || !data.cpf.trim() || !data.email.trim()}
          className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-medium py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
        >
          {salvando ? (
            <><Loader2 className="h-4 w-4 animate-spin" /> Salvando...</>
          ) : (
            `Salvar ${tipoMembro.toLowerCase()} e continuar`
          )}
        </button>
      )}
    </div>
  );
}
