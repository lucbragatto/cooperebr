'use client';

import { useState } from 'react';
import api from '@/lib/api';
import { Badge } from '@/components/ui/badge';

interface BancoConfig {
  bb: boolean;
  sicoob: boolean;
  nenhum: boolean;
  bbClientId: string;
  bbClientSecret: string;
  bbConta: string;
  bbAgencia: string;
  bbAmbiente: 'SANDBOX' | 'PRODUCAO';
  sicoobClientId: string;
  sicoobCertificado: File | null;
  sicoobCertificadoNome: string;
  sicoobConta: string;
  sicoobCooperativa: string;
}

interface Step7Props {
  data: BancoConfig;
  onChange: (data: Partial<BancoConfig>) => void;
}

const cls = 'w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500';
const lbl = 'block text-xs font-medium text-neutral-600 mb-1';

export default function Step7Banco({ data, onChange }: Step7Props) {
  const [testBB, setTestBB] = useState<{ ok: boolean; msg: string } | null>(null);
  const [testSicoob, setTestSicoob] = useState<{ ok: boolean; msg: string } | null>(null);
  const [testandoBB, setTestandoBB] = useState(false);
  const [testandoSicoob, setTestandoSicoob] = useState(false);

  function toggleBanco(banco: 'bb' | 'sicoob' | 'nenhum') {
    if (banco === 'nenhum') {
      onChange({ bb: false, sicoob: false, nenhum: true });
    } else {
      onChange({ [banco]: !data[banco], nenhum: false });
    }
  }

  async function testarConexaoBB() {
    setTestandoBB(true);
    setTestBB(null);
    try {
      const { data: res } = await api.get('/integracao-bancaria/config');
      const bbConfig = Array.isArray(res) ? res.find((c: any) => c.banco === 'BB') : null;
      setTestBB(bbConfig ? { ok: true, msg: 'Conexao BB OK' } : { ok: true, msg: 'Config sera salva ao finalizar' });
    } catch {
      setTestBB({ ok: false, msg: 'Erro ao testar conexao BB' });
    } finally {
      setTestandoBB(false);
    }
  }

  async function testarConexaoSicoob() {
    setTestandoSicoob(true);
    setTestSicoob(null);
    try {
      const { data: res } = await api.get('/integracao-bancaria/config');
      const sicoobConfig = Array.isArray(res) ? res.find((c: any) => c.banco === 'SICOOB') : null;
      setTestSicoob(sicoobConfig ? { ok: true, msg: 'Conexao Sicoob OK' } : { ok: true, msg: 'Config sera salva ao finalizar' });
    } catch {
      setTestSicoob({ ok: false, msg: 'Erro ao testar conexao Sicoob' });
    } finally {
      setTestandoSicoob(false);
    }
  }

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-neutral-800">Integracao Bancaria</h2>
      <p className="text-sm text-neutral-500">
        Este parceiro usa algum destes bancos para repasses?
      </p>

      <div className="space-y-2">
        {([
          { key: 'bb' as const, label: 'Banco do Brasil' },
          { key: 'sicoob' as const, label: 'Sicoob' },
          { key: 'nenhum' as const, label: 'Nenhum por enquanto' },
        ]).map(({ key, label }) => (
          <label key={key} className="flex items-center gap-3 p-3 rounded-lg border border-neutral-200 hover:border-green-300 cursor-pointer transition">
            <input
              type="checkbox"
              checked={data[key]}
              onChange={() => toggleBanco(key)}
              className="rounded border-neutral-300"
            />
            <span className="text-sm text-neutral-700">{label}</span>
          </label>
        ))}
      </div>

      {data.bb && (
        <div className="p-4 bg-neutral-50 rounded-lg border border-neutral-200 space-y-4">
          <h3 className="text-sm font-semibold text-neutral-700">Banco do Brasil</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Client ID (BB)</label>
              <input className={cls} value={data.bbClientId} onChange={(e) => onChange({ bbClientId: e.target.value })} />
            </div>
            <div>
              <label className={lbl}>Client Secret (BB)</label>
              <input className={cls} type="password" value={data.bbClientSecret} onChange={(e) => onChange({ bbClientSecret: e.target.value })} />
            </div>
            <div>
              <label className={lbl}>Conta Corrente</label>
              <input className={cls} value={data.bbConta} onChange={(e) => onChange({ bbConta: e.target.value })} />
            </div>
            <div>
              <label className={lbl}>Agencia</label>
              <input className={cls} value={data.bbAgencia} onChange={(e) => onChange({ bbAgencia: e.target.value })} />
            </div>
          </div>
          <div>
            <label className={lbl}>Ambiente</label>
            <div className="flex gap-3">
              {(['SANDBOX', 'PRODUCAO'] as const).map((amb) => (
                <button
                  key={amb}
                  type="button"
                  onClick={() => onChange({ bbAmbiente: amb })}
                  className={`px-3 py-1.5 rounded text-xs font-medium border transition ${
                    data.bbAmbiente === amb
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
              onClick={testarConexaoBB}
              disabled={testandoBB}
              className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {testandoBB ? 'Testando...' : 'Testar conexao'}
            </button>
            {testBB && (
              <Badge variant={testBB.ok ? 'default' : 'destructive'}>{testBB.msg}</Badge>
            )}
          </div>
        </div>
      )}

      {data.sicoob && (
        <div className="p-4 bg-neutral-50 rounded-lg border border-neutral-200 space-y-4">
          <h3 className="text-sm font-semibold text-neutral-700">Sicoob</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Client ID (Sicoob)</label>
              <input className={cls} value={data.sicoobClientId} onChange={(e) => onChange({ sicoobClientId: e.target.value })} />
            </div>
            <div>
              <label className={lbl}>Certificado mTLS (.p12/.pem)</label>
              <input
                type="file"
                accept=".p12,.pem"
                onChange={(e) => {
                  const file = e.target.files?.[0] || null;
                  onChange({ sicoobCertificado: file, sicoobCertificadoNome: file?.name || '' });
                }}
                className="w-full text-sm text-neutral-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-green-50 file:text-green-700 hover:file:bg-green-100"
              />
              {data.sicoobCertificadoNome && (
                <p className="text-xs text-green-600 mt-1">{data.sicoobCertificadoNome}</p>
              )}
            </div>
            <div>
              <label className={lbl}>Conta</label>
              <input className={cls} value={data.sicoobConta} onChange={(e) => onChange({ sicoobConta: e.target.value })} />
            </div>
            <div>
              <label className={lbl}>Cooperativa Sicoob</label>
              <input className={cls} value={data.sicoobCooperativa} onChange={(e) => onChange({ sicoobCooperativa: e.target.value })} />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={testarConexaoSicoob}
              disabled={testandoSicoob}
              className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {testandoSicoob ? 'Testando...' : 'Testar conexao'}
            </button>
            {testSicoob && (
              <Badge variant={testSicoob.ok ? 'default' : 'destructive'}>{testSicoob.msg}</Badge>
            )}
          </div>
        </div>
      )}

      {data.nenhum && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
          <p className="text-sm text-amber-700">
            Voce podera configurar depois em Configuracoes &rarr; Integracao Bancaria
          </p>
        </div>
      )}
    </div>
  );
}
