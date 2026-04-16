'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle, Clock } from 'lucide-react';

const PRAZO_OPTIONS = [
  { value: '12', label: '12 horas' },
  { value: '24', label: '24 horas' },
  { value: '48', label: '48 horas' },
  { value: '72', label: '72 horas' },
];

export default function ConfigDocumentosPage() {
  const [habilitado, setHabilitado] = useState(false);
  const [prazo, setPrazo] = useState('24');
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [salvo, setSalvo] = useState(false);
  const [erro, setErro] = useState('');

  useEffect(() => {
    Promise.all([
      api.get<string | null>('/config-tenant/aprovacao_documentos_automatica').catch(() => ({ data: null })),
      api.get<string | null>('/config-tenant/prazo_aprovacao_auto_horas').catch(() => ({ data: null })),
    ]).then(([habRes, prazoRes]) => {
      const habValor = typeof habRes.data === 'object' && habRes.data !== null
        ? (habRes.data as { valor?: string }).valor
        : habRes.data;
      const prazoValor = typeof prazoRes.data === 'object' && prazoRes.data !== null
        ? (prazoRes.data as { valor?: string }).valor
        : prazoRes.data;
      if (habValor === 'true') setHabilitado(true);
      if (prazoValor && PRAZO_OPTIONS.some(p => p.value === prazoValor)) setPrazo(prazoValor);
    }).finally(() => setCarregando(false));
  }, []);

  async function salvar() {
    setSalvando(true);
    setErro('');
    setSalvo(false);
    try {
      await Promise.all([
        api.put('/config-tenant/aprovacao_documentos_automatica', {
          valor: habilitado ? 'true' : 'false',
          descricao: 'Aprovação automática de documentos após prazo configurado',
        }),
        api.put('/config-tenant/prazo_aprovacao_auto_horas', {
          valor: prazo,
          descricao: 'Prazo em horas para aprovação automática de documentos',
        }),
      ]);
      setSalvo(true);
      setTimeout(() => setSalvo(false), 3000);
    } catch {
      setErro('Erro ao salvar configuração. Tente novamente.');
    } finally {
      setSalvando(false);
    }
  }

  if (carregando) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 text-green-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-800">Configurações de documentos</h1>
        <p className="text-sm text-gray-500 mt-1">
          Configure a aprovação automática de documentos do cooperado.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
            Aprovação automática
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-800">Habilitar aprovação automática</p>
              <p className="text-xs text-gray-500 mt-0.5">
                Após o prazo configurado, documentos sem reprovação manual serão aprovados automaticamente.
                O admin pode reprovar dentro do prazo normalmente.
              </p>
            </div>
            <button
              onClick={() => setHabilitado(!habilitado)}
              className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${habilitado ? 'bg-green-600' : 'bg-gray-300'}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${habilitado ? 'translate-x-5' : ''}`} />
            </button>
          </div>

          {habilitado && (
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                <Clock className="h-4 w-4 inline mr-1" />
                Prazo para aprovação automática
              </label>
              <select
                value={prazo}
                onChange={e => setPrazo(e.target.value)}
                className="w-full h-9 px-3 rounded-lg border border-gray-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                {PRAZO_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
              <p className="text-xs text-gray-500">
                Contado a partir do envio do último documento pelo cooperado.
                Se nenhum documento for reprovado manualmente dentro desse prazo, todos serão aprovados
                e o sistema envia o link de assinatura automaticamente.
              </p>
            </div>
          )}

          {erro && <p className="text-sm text-red-600">{erro}</p>}

          <div className="flex items-center gap-3">
            <Button onClick={salvar} disabled={salvando} className="bg-green-600 hover:bg-green-700 text-white">
              {salvando ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Salvar
            </Button>
            {salvo && (
              <span className="flex items-center gap-1 text-sm text-green-600">
                <CheckCircle className="h-4 w-4" /> Salvo
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {!habilitado && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-sm text-gray-600">
          Com a aprovação automática desabilitada, todos os documentos precisam ser analisados manualmente
          pelo admin no wizard de cadastro (Step 5 e Step 6).
        </div>
      )}
    </div>
  );
}
