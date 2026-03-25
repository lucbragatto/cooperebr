'use client';

import { useState, useEffect } from 'react';
import api from '@/lib/api';

interface Step3Props {
  cooperativaId?: string;
  usinaKwh?: number;
  onSubmit: (dados: any) => void;
}

export default function Step3Espera({ cooperativaId, usinaKwh, onSubmit }: Step3Props) {
  const [membros, setMembros] = useState<any[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [alocarAuto, setAlocarAuto] = useState(true);

  useEffect(() => {
    if (!cooperativaId) return;
    setCarregando(true);
    api.get('/lista-espera', { params: { cooperativaId } })
      .then(({ data }) => setMembros(Array.isArray(data) ? data : data.items || []))
      .catch(() => setMembros([]))
      .finally(() => setCarregando(false));
  }, [cooperativaId]);

  function handleSubmit() {
    onSubmit({ membros: membros.length, alocarAuto });
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-neutral-800">Lista de Espera</h2>

      {!cooperativaId ? (
        <div className="p-6 text-center border-2 border-dashed border-neutral-200 rounded-lg">
          <p className="text-sm text-neutral-400">Parceiro ainda não foi salvo. A lista de espera será configurada após a criação.</p>
          <p className="text-xs text-neutral-300 mt-2">Você pode avançar — esta etapa é opcional até o parceiro ser criado.</p>
        </div>
      ) : carregando ? (
        <p className="text-sm text-neutral-400">Carregando lista de espera...</p>
      ) : membros.length === 0 ? (
        <div className="p-6 text-center border-2 border-dashed border-neutral-200 rounded-lg">
          <p className="text-sm text-neutral-500">Nenhum membro na lista de espera.</p>
          <p className="text-xs text-neutral-400 mt-1">Membros poderão ser adicionados após a criação do parceiro.</p>
        </div>
      ) : (
        <div className="border border-neutral-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50">
              <tr>
                <th className="text-left px-4 py-2 text-xs font-medium text-neutral-500">#</th>
                <th className="text-left px-4 py-2 text-xs font-medium text-neutral-500">Nome</th>
                <th className="text-right px-4 py-2 text-xs font-medium text-neutral-500">kWh necessário</th>
              </tr>
            </thead>
            <tbody>
              {membros.map((m: any, i: number) => (
                <tr key={m.id || i} className="border-t border-neutral-100">
                  <td className="px-4 py-2 text-neutral-400">{i + 1}</td>
                  <td className="px-4 py-2 text-neutral-700">{m.nome || m.membro?.nome || '—'}</td>
                  <td className="px-4 py-2 text-right text-neutral-600">{m.kwhNecessario ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <label className="flex items-center gap-2 text-sm text-neutral-700 cursor-pointer">
        <input
          type="checkbox"
          checked={alocarAuto}
          onChange={(e) => setAlocarAuto(e.target.checked)}
          className="rounded border-neutral-300 text-green-600 focus:ring-green-500"
        />
        Alocar automaticamente ao salvar
      </label>

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
