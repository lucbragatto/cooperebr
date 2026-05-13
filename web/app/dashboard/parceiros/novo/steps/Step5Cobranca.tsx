'use client';

import { useState } from 'react';

interface Step5Props {
  defaultValues: any;
  onSubmit: (dados: any) => void;
}

const MODELOS = [
  {
    value: 'FIXO_MENSAL',
    label: 'Fixo',
    desc: 'Valor fixo mensal por membro, independente do consumo.',
    bloqueado: false,
  },
  {
    value: 'CREDITOS_COMPENSADOS',
    label: 'Créditos Compensados',
    desc: 'Engine implementada (Fase B). Runtime aguardando canário CoopereBR + flag BLOQUEIO_MODELOS_NAO_FIXO=false.',
    bloqueado: true,
  },
  {
    value: 'CREDITOS_DINAMICO',
    label: 'Dinâmico',
    desc: 'Engine implementada (Fase B). Runtime aguardando canário CoopereBR + flag BLOQUEIO_MODELOS_NAO_FIXO=false.',
    bloqueado: true,
  },
];

const cls = 'w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500';
const lbl = 'block text-xs font-medium text-neutral-600 mb-1';

export default function Step5Cobranca({ defaultValues, onSubmit }: Step5Props) {
  const [tipo, setTipo] = useState(defaultValues?.tipo || '');
  const [valorFixo, setValorFixo] = useState(defaultValues?.valorFixo || '');
  const [valorKwh, setValorKwh] = useState(defaultValues?.valorKwh || '');
  const [percentualDesconto, setPercentualDesconto] = useState(defaultValues?.percentualDesconto || '');
  const [descontoPadrao, setDescontoPadrao] = useState(defaultValues?.descontoPadrao || '');
  const [multaAtraso, setMultaAtraso] = useState(defaultValues?.multaAtraso ?? '2');
  const [jurosDiarios, setJurosDiarios] = useState(defaultValues?.jurosDiarios ?? '0.033');

  function handleSubmit() {
    onSubmit({
      tipo,
      valorFixo: tipo === 'FIXO_MENSAL' ? valorFixo : undefined,
      valorKwh: tipo === 'CREDITOS_COMPENSADOS' ? valorKwh : undefined,
      percentualDesconto: tipo === 'CREDITOS_DINAMICO' ? percentualDesconto : undefined,
      descontoPadrao,
      multaAtraso,
      jurosDiarios,
    });
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-neutral-800">Modelo de Cobrança</h2>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {MODELOS.map((m) => (
          <button
            key={m.value}
            onClick={() => !m.bloqueado && setTipo(m.value)}
            disabled={m.bloqueado}
            className={`text-left p-4 rounded-lg border-2 transition ${
              m.bloqueado
                ? 'border-neutral-100 bg-neutral-50 opacity-50 cursor-not-allowed'
                : tipo === m.value
                  ? 'border-green-500 bg-green-50'
                  : 'border-neutral-200 hover:border-neutral-300'
            }`}
          >
            <p className="font-medium text-sm text-neutral-800">{m.label}</p>
            <p className="text-xs text-neutral-500 mt-1">{m.desc}</p>
          </button>
        ))}
      </div>

      {tipo && (
        <div className="space-y-4 border-t border-neutral-100 pt-4">
          {tipo === 'FIXO_MENSAL' && (
            <div>
              <label className={lbl}>Valor mensal (R$)</label>
              <input className={cls} type="number" step="0.01" value={valorFixo} onChange={(e) => setValorFixo(e.target.value)} placeholder="0,00" />
            </div>
          )}

          {tipo === 'CREDITOS_COMPENSADOS' && (
            <div>
              <label className={lbl}>Valor por kWh (R$)</label>
              <input className={cls} type="number" step="0.001" value={valorKwh} onChange={(e) => setValorKwh(e.target.value)} placeholder="0,000" />
            </div>
          )}

          {tipo === 'CREDITOS_DINAMICO' && (
            <div>
              <label className={lbl}>Percentual de desconto (%)</label>
              <input className={cls} type="number" step="0.1" value={percentualDesconto} onChange={(e) => setPercentualDesconto(e.target.value)} placeholder="15" />
            </div>
          )}

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className={lbl}>Desconto padrão (%)</label>
              <input className={cls} type="number" step="0.1" value={descontoPadrao} onChange={(e) => setDescontoPadrao(e.target.value)} />
            </div>
            <div>
              <label className={lbl}>Multa atraso (%)</label>
              <input className={cls} type="number" step="0.01" value={multaAtraso} onChange={(e) => setMultaAtraso(e.target.value)} />
            </div>
            <div>
              <label className={lbl}>Juros diários (%)</label>
              <input className={cls} type="number" step="0.001" value={jurosDiarios} onChange={(e) => setJurosDiarios(e.target.value)} />
            </div>
          </div>
        </div>
      )}

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
