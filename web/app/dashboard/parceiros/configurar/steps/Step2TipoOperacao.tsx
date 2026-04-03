'use client';

import { useState } from 'react';
import { Sun, Building2, Briefcase, Zap } from 'lucide-react';
import type { TipoOperacao } from '../page';

interface Step2Props {
  tiposOperacao: TipoOperacao;
  onSubmit: (tipos: TipoOperacao) => void;
}

const TIPOS = [
  {
    key: 'usina' as const,
    label: 'Usina própria (GD)',
    desc: 'Geração distribuída com usinas solares. Cooperados recebem créditos de energia compensada na fatura.',
    icon: Sun,
    color: 'text-amber-600 bg-amber-50',
  },
  {
    key: 'condominio' as const,
    label: 'Condomínio (rateio)',
    desc: 'Rateio de energia entre unidades condominiais. Divisão proporcional da geração por unidade.',
    icon: Building2,
    color: 'text-blue-600 bg-blue-50',
  },
  {
    key: 'empresa' as const,
    label: 'Empresa (comercial)',
    desc: 'Comercialização de energia para clientes corporativos com contratos customizados.',
    icon: Briefcase,
    color: 'text-purple-600 bg-purple-50',
  },
  {
    key: 'ev' as const,
    label: 'Carregador veicular (EV)',
    desc: 'Pontos de recarga para veículos elétricos com tarifação por kWh ou tempo de uso.',
    icon: Zap,
    color: 'text-green-600 bg-green-50',
  },
];

export default function Step2TipoOperacao({ tiposOperacao, onSubmit }: Step2Props) {
  const [tipos, setTipos] = useState<TipoOperacao>({ ...tiposOperacao });
  const [erro, setErro] = useState('');

  function toggle(key: keyof TipoOperacao) {
    setTipos((prev) => ({ ...prev, [key]: !prev[key] }));
    setErro('');
  }

  function handleSubmit() {
    const algumSelecionado = Object.values(tipos).some(Boolean);
    if (!algumSelecionado) {
      setErro('Selecione pelo menos um tipo de operação.');
      return;
    }
    onSubmit(tipos);
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-neutral-800">Tipo de Operação</h2>
      <p className="text-sm text-neutral-500">
        Selecione um ou mais tipos de operação da sua cooperativa.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {TIPOS.map(({ key, label, desc, icon: Icon, color }) => {
          const selecionado = tipos[key];
          return (
            <button
              key={key}
              onClick={() => toggle(key)}
              className={`text-left p-4 rounded-lg border-2 transition relative ${
                selecionado
                  ? 'border-green-500 bg-green-50'
                  : 'border-neutral-200 hover:border-neutral-300'
              }`}
            >
              {selecionado && (
                <span className="absolute top-2 right-2 text-green-600 text-lg">&#10003;</span>
              )}
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-3 ${color}`}>
                <Icon className="w-5 h-5" />
              </div>
              <p className="font-medium text-sm text-neutral-800">{label}</p>
              <p className="text-xs text-neutral-500 mt-1">{desc}</p>
            </button>
          );
        })}
      </div>

      {erro && <p className="text-xs text-red-500">{erro}</p>}

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
