'use client';

import { useState } from 'react';
import api from '@/lib/api';
import { Badge } from '@/components/ui/badge';

interface Step6Props {
  data: {
    temAsaas: boolean | null;
    asaasApiKey: string;
    asaasAmbiente: 'SANDBOX' | 'PRODUCAO';
    asaasConfigurarDepois: boolean;
  };
  onChange: (data: Partial<Step6Props['data']>) => void;
}

const cls = 'w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500';
const lbl = 'block text-xs font-medium text-neutral-600 mb-1';

export default function Step6Asaas({ data, onChange }: Step6Props) {
  const [testando, setTestando] = useState(false);
  const [resultado, setResultado] = useState<{ ok: boolean; msg: string } | null>(null);

  async function testarConexao() {
    if (!data.asaasApiKey) return;
    setTestando(true);
    setResultado(null);
    try {
      const { data: res } = await api.get('/asaas/testar-conexao');
      if (res.ok) {
        setResultado({ ok: true, msg: `Conexao OK (${res.totalCustomers} clientes)` });
      } else {
        setResultado({ ok: false, msg: res.erro || 'Falha na conexao' });
      }
    } catch (err: any) {
      setResultado({ ok: false, msg: err.response?.data?.message || 'Erro ao testar conexao' });
    } finally {
      setTestando(false);
    }
  }

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-neutral-800">Integracao Asaas</h2>
      <p className="text-sm text-neutral-500">
        O Asaas e o gateway de pagamentos para receber mensalidades dos membros.
      </p>

      <div className="space-y-3">
        <label className={lbl}>Este parceiro ja possui conta no Asaas?</label>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => onChange({ temAsaas: true, asaasConfigurarDepois: false })}
            className={`px-4 py-2 rounded-lg text-sm font-medium border transition ${
              data.temAsaas === true
                ? 'bg-green-600 text-white border-green-600'
                : 'bg-white text-neutral-700 border-neutral-300 hover:border-green-400'
            }`}
          >
            Sim
          </button>
          <button
            type="button"
            onClick={() => {
              onChange({ temAsaas: false, asaasApiKey: '', asaasConfigurarDepois: false });
              setResultado(null);
            }}
            className={`px-4 py-2 rounded-lg text-sm font-medium border transition ${
              data.temAsaas === false
                ? 'bg-green-600 text-white border-green-600'
                : 'bg-white text-neutral-700 border-neutral-300 hover:border-green-400'
            }`}
          >
            Nao
          </button>
        </div>
      </div>

      {data.temAsaas === true && (
        <div className="space-y-4 p-4 bg-neutral-50 rounded-lg border border-neutral-200">
          <div>
            <label className={lbl}>API Key do Asaas</label>
            <input
              className={cls}
              type="password"
              placeholder="$aas_..."
              value={data.asaasApiKey}
              onChange={(e) => onChange({ asaasApiKey: e.target.value })}
            />
          </div>

          <div>
            <label className={lbl}>Ambiente</label>
            <div className="flex gap-3">
              {(['SANDBOX', 'PRODUCAO'] as const).map((amb) => (
                <button
                  key={amb}
                  type="button"
                  onClick={() => onChange({ asaasAmbiente: amb })}
                  className={`px-3 py-1.5 rounded text-xs font-medium border transition ${
                    data.asaasAmbiente === amb
                      ? 'bg-green-600 text-white border-green-600'
                      : 'bg-white text-neutral-600 border-neutral-300'
                  }`}
                >
                  {amb === 'SANDBOX' ? 'Sandbox' : 'Producao'}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={testarConexao}
              disabled={!data.asaasApiKey || testando}
              className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {testando ? 'Testando...' : 'Testar conexao'}
            </button>
            {resultado && (
              <Badge variant={resultado.ok ? 'default' : 'destructive'}>
                {resultado.ok ? 'Conexao OK' : resultado.msg}
              </Badge>
            )}
          </div>
        </div>
      )}

      {data.temAsaas === false && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg space-y-3">
          <p className="text-sm text-amber-800 font-medium">
            O Asaas e o gateway de pagamentos para receber mensalidades dos membros.
          </p>
          <a
            href="https://app.asaas.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-blue-600 hover:underline inline-block"
          >
            Criar conta gratuita em app.asaas.com &rarr;
          </a>
          <p className="text-xs text-amber-600">
            Voce podera configurar depois em Configuracoes &rarr; Asaas
          </p>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={data.asaasConfigurarDepois}
              onChange={(e) => onChange({ asaasConfigurarDepois: e.target.checked })}
              className="rounded border-neutral-300"
            />
            <span className="text-sm text-neutral-700">Configurar depois</span>
          </label>
        </div>
      )}
    </div>
  );
}
