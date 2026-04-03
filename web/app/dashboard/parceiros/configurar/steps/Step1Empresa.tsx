'use client';

import { useState } from 'react';

interface Step1Props {
  defaultValues: Record<string, string>;
  onSubmit: (dados: Record<string, string>) => void;
}

const cls = 'w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500';
const lbl = 'block text-xs font-medium text-neutral-600 mb-1';

function maskCnpj(v: string) {
  return v.replace(/\D/g, '').slice(0, 14)
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2');
}

function maskTelefone(v: string) {
  const d = v.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : '';
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

function maskCep(v: string) {
  return v.replace(/\D/g, '').slice(0, 8).replace(/(\d{5})(\d)/, '$1-$2');
}

export default function Step1Empresa({ defaultValues, onSubmit }: Step1Props) {
  const [form, setForm] = useState({
    nome: defaultValues?.nome || '',
    cnpj: defaultValues?.cnpj || '',
    email: defaultValues?.email || '',
    telefone: defaultValues?.telefone || '',
    nomeResponsavel: defaultValues?.nomeResponsavel || '',
    cep: defaultValues?.cep || '',
    endereco: defaultValues?.endereco || '',
    cidade: defaultValues?.cidade || '',
    estado: defaultValues?.estado || '',
    bairro: defaultValues?.bairro || '',
    numero: defaultValues?.numero || '',
  });
  const [erros, setErros] = useState<Record<string, string>>({});
  const [buscandoCep, setBuscandoCep] = useState(false);

  function set(campo: string, valor: string) {
    setForm((prev) => ({ ...prev, [campo]: valor }));
    if (erros[campo]) setErros((prev) => { const n = { ...prev }; delete n[campo]; return n; });
  }

  async function buscarCep(cep: string) {
    const digits = cep.replace(/\D/g, '');
    if (digits.length !== 8) return;
    setBuscandoCep(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
      const data = await res.json();
      if (!data.erro) {
        setForm((prev) => ({
          ...prev,
          endereco: data.logradouro || prev.endereco,
          bairro: data.bairro || prev.bairro,
          cidade: data.localidade || prev.cidade,
          estado: data.uf || prev.estado,
        }));
      }
    } catch {
      // silently fail
    } finally {
      setBuscandoCep(false);
    }
  }

  function validar() {
    const e: Record<string, string> = {};
    if (!form.nome.trim()) e.nome = 'Obrigatório';
    if (!form.cnpj.trim() || form.cnpj.replace(/\D/g, '').length < 14) e.cnpj = 'CNPJ inválido';
    if (!form.email.trim()) e.email = 'Obrigatório';
    setErros(e);
    return Object.keys(e).length === 0;
  }

  function handleSubmit() {
    if (validar()) onSubmit(form);
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-neutral-800">Dados da Empresa</h2>
      <p className="text-sm text-neutral-500">Revise e complete os dados da sua cooperativa.</p>

      <div>
        <label className={lbl}>Nome da organização *</label>
        <input className={cls} value={form.nome} onChange={(e) => set('nome', e.target.value)} />
        {erros.nome && <p className="text-xs text-red-500 mt-0.5">{erros.nome}</p>}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={lbl}>CNPJ *</label>
          <input className={cls} value={form.cnpj} onChange={(e) => set('cnpj', maskCnpj(e.target.value))} placeholder="00.000.000/0001-00" />
          {erros.cnpj && <p className="text-xs text-red-500 mt-0.5">{erros.cnpj}</p>}
        </div>
        <div>
          <label className={lbl}>Email de contato *</label>
          <input className={cls} type="email" value={form.email} onChange={(e) => set('email', e.target.value)} />
          {erros.email && <p className="text-xs text-red-500 mt-0.5">{erros.email}</p>}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={lbl}>Telefone</label>
          <input className={cls} value={form.telefone} onChange={(e) => set('telefone', maskTelefone(e.target.value))} placeholder="(27) 99999-0000" />
        </div>
        <div>
          <label className={lbl}>Nome do responsável</label>
          <input className={cls} value={form.nomeResponsavel} onChange={(e) => set('nomeResponsavel', e.target.value)} />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className={lbl}>CEP</label>
          <input
            className={cls}
            value={form.cep}
            onChange={(e) => {
              const masked = maskCep(e.target.value);
              set('cep', masked);
              if (masked.replace(/\D/g, '').length === 8) buscarCep(masked);
            }}
            placeholder="29000-000"
          />
          {buscandoCep && <p className="text-xs text-neutral-400 mt-0.5">Buscando...</p>}
        </div>
        <div className="col-span-2">
          <label className={lbl}>Endereço</label>
          <input className={cls} value={form.endereco} onChange={(e) => set('endereco', e.target.value)} />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className={lbl}>Bairro</label>
          <input className={cls} value={form.bairro} onChange={(e) => set('bairro', e.target.value)} />
        </div>
        <div>
          <label className={lbl}>Cidade</label>
          <input className={cls} value={form.cidade} onChange={(e) => set('cidade', e.target.value)} />
        </div>
        <div>
          <label className={lbl}>Estado</label>
          <input className={cls} value={form.estado} onChange={(e) => set('estado', e.target.value)} maxLength={2} />
        </div>
      </div>

      <div className="pt-2 flex justify-end">
        <button
          onClick={handleSubmit}
          className="px-5 py-2.5 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700"
        >
          Próximo
        </button>
      </div>
    </div>
  );
}
