'use client';

import { useState, useEffect } from 'react';
import api from '@/lib/api';

interface Step4Props {
  defaultValues: any;
  onSubmit: (dados: any) => void;
}

const cls = 'w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500';
const lbl = 'block text-xs font-medium text-neutral-600 mb-1';

export default function Step4PlanoSaas({ defaultValues, onSubmit }: Step4Props) {
  const [planos, setPlanos] = useState<any[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [planoId, setPlanoId] = useState(defaultValues?.id || '');
  const [diaVencimento, setDiaVencimento] = useState(defaultValues?.diaVencimento || 10);
  const [statusInicial, setStatusInicial] = useState<'TRIAL' | 'ATIVO'>(defaultValues?.statusInicial || 'TRIAL');

  useEffect(() => {
    api.get('/saas/planos')
      .then(({ data }) => setPlanos(Array.isArray(data) ? data : data.items || []))
      .catch(() => setPlanos([]))
      .finally(() => setCarregando(false));
  }, []);

  function handleSubmit() {
    const plano = planos.find((p) => p.id === planoId);
    onSubmit({
      id: planoId,
      nome: plano?.nome || '',
      valor: plano?.valor || 0,
      diaVencimento,
      statusInicial,
    });
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-neutral-800">Plano SaaS</h2>

      {carregando ? (
        <p className="text-sm text-neutral-400">Carregando planos...</p>
      ) : planos.length === 0 ? (
        <div className="p-6 text-center border-2 border-dashed border-neutral-200 rounded-lg">
          <p className="text-sm text-neutral-500">Nenhum plano SaaS cadastrado.</p>
          <p className="text-xs text-neutral-400 mt-1">Configure planos em Configurações &gt; SaaS antes de continuar.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {planos.map((p: any) => (
            <button
              key={p.id}
              onClick={() => setPlanoId(p.id)}
              className={`text-left p-4 rounded-lg border-2 transition ${
                planoId === p.id
                  ? 'border-green-500 bg-green-50'
                  : 'border-neutral-200 hover:border-neutral-300'
              }`}
            >
              <p className="font-medium text-sm text-neutral-800">{p.nome}</p>
              <p className="text-xs text-neutral-500 mt-1">{p.descricao || ''}</p>
              <p className="text-lg font-bold text-green-600 mt-2">
                R$ {Number(p.valor || 0).toFixed(2).replace('.', ',')}
                <span className="text-xs font-normal text-neutral-400">/mês</span>
              </p>
            </button>
          ))}
          <button
            onClick={() => setPlanoId('')}
            className={`text-left p-4 rounded-lg border-2 transition ${
              planoId === ''
                ? 'border-green-500 bg-green-50'
                : 'border-neutral-200 hover:border-neutral-300'
            }`}
          >
            <p className="font-medium text-sm text-neutral-500">Configurar depois</p>
            <p className="text-xs text-neutral-400 mt-1">Pular esta etapa por enquanto</p>
          </button>
        </div>
      )}

      {planoId && (
        <div className="grid grid-cols-2 gap-4 border-t border-neutral-100 pt-4">
          <div>
            <label className={lbl}>Dia de vencimento</label>
            <input
              className={cls}
              type="number"
              min={1}
              max={28}
              value={diaVencimento}
              onChange={(e) => setDiaVencimento(Math.min(28, Math.max(1, Number(e.target.value))))}
            />
          </div>
          <div>
            <label className={lbl}>Status inicial</label>
            <div className="flex gap-3 mt-1">
              {(['TRIAL', 'ATIVO'] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setStatusInicial(s)}
                  className={`px-4 py-2 text-sm rounded-lg border transition ${
                    statusInicial === s
                      ? 'bg-green-50 border-green-500 text-green-700 font-medium'
                      : 'border-neutral-300 text-neutral-600 hover:bg-neutral-50'
                  }`}
                >
                  {s === 'TRIAL' ? 'Trial 30 dias' : 'Ativo imediato'}
                </button>
              ))}
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
