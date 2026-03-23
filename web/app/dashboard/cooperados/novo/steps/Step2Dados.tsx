'use client';

import { useEffect } from 'react';
import { User, Gift } from 'lucide-react';

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
}

interface Step2Props {
  data: Step2Data;
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

export default function Step2Dados({ data, onChange, tipoMembro }: Step2Props) {
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

  function handleDoc(v: string) {
    const nums = v.replace(/\D/g, '');
    if (isPJ) onChange({ cpf: maskCNPJ(v) });
    else if (nums.length > 11) onChange({ cpf: maskCNPJ(v), tipoPessoa: 'PJ' });
    else onChange({ cpf: maskCPF(v) });
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 mb-1">
        <User className="h-4 w-4 text-green-700" />
        <h2 className="text-base font-semibold text-gray-800">Dados do {tipoMembro.toLowerCase()}</h2>
        <span className="ml-auto text-xs text-gray-400">Pré-preenchidos pela fatura</span>
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
    </div>
  );
}
