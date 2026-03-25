'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  AlertTriangle,
  CheckCircle,
  XCircle,
  ShieldAlert,
} from 'lucide-react';

const MOTIVOS = [
  'Mudança de endereço',
  'Insatisfação com o serviço',
  'Não uso mais energia solar',
  'Motivo financeiro',
  'Mudança para concorrente',
  'Outro',
];

interface Checklist {
  semFaturasAberto: boolean;
  semGeracaoAtiva: boolean;
}

export default function PortalDesligamentoPage() {
  const [checklist, setChecklist] = useState<Checklist | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [motivo, setMotivo] = useState('');
  const [observacao, setObservacao] = useState('');
  const [confirmado, setConfirmado] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [protocolo, setProtocolo] = useState<string | null>(null);
  const [erro, setErro] = useState('');

  useEffect(() => {
    api
      .get('/cooperados/meu-perfil/cobrancas')
      .then((res) => {
        const cobrancas = res.data as any[];
        const pendentes = cobrancas.filter(
          (c: any) => c.status === 'PENDENTE' || c.status === 'VENCIDO',
        );
        // Check for active generation in current month
        const agora = new Date();
        const mesAtual = agora.getMonth() + 1;
        const anoAtual = agora.getFullYear();
        const geracaoAtiva = cobrancas.some(
          (c: any) =>
            c.mesReferencia === mesAtual &&
            c.anoReferencia === anoAtual &&
            (c.kwhEntregue ?? 0) > 0,
        );
        setChecklist({
          semFaturasAberto: pendentes.length === 0,
          semGeracaoAtiva: !geracaoAtiva,
        });
      })
      .catch(() => {
        setChecklist({ semFaturasAberto: true, semGeracaoAtiva: true });
      })
      .finally(() => setCarregando(false));
  }, []);

  const podeDesligar = checklist?.semFaturasAberto && checklist?.semGeracaoAtiva;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!motivo) {
      setErro('Selecione o motivo do desligamento.');
      return;
    }
    if (!confirmado) {
      setErro('Confirme que deseja prosseguir com o desligamento.');
      return;
    }
    setEnviando(true);
    setErro('');
    try {
      const res = await api.post('/cooperados/meu-perfil/solicitar-desligamento', {
        motivo,
        observacao: observacao || undefined,
      });
      setProtocolo(res.data.protocolo);
    } catch (err: any) {
      setErro(
        err?.response?.data?.message ?? 'Erro ao enviar solicitação. Tente novamente.',
      );
    } finally {
      setEnviando(false);
    }
  };

  if (carregando) {
    return (
      <div className="space-y-4">
        {[1, 2].map((i) => (
          <div key={i} className="h-24 bg-gray-200 animate-pulse rounded-xl" />
        ))}
      </div>
    );
  }

  // Success state
  if (protocolo) {
    return (
      <div className="space-y-4">
        <Card className="ring-green-200">
          <CardContent className="pt-6 pb-6 text-center">
            <CheckCircle className="w-12 h-12 text-green-600 mx-auto mb-3" />
            <h2 className="text-lg font-bold text-gray-800 mb-2">
              Solicitação registrada
            </h2>
            <p className="text-sm text-gray-600 mb-4">
              Sua solicitação de desligamento foi recebida e será analisada pela
              equipe. Você receberá um retorno em breve.
            </p>
            <div className="bg-gray-50 rounded-lg px-4 py-3 inline-block">
              <p className="text-xs text-gray-500">Protocolo</p>
              <p className="text-sm font-mono font-bold text-gray-800">
                {protocolo}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-bold text-gray-800">Solicitar desligamento</h1>

      {/* Aviso */}
      <Card className="ring-yellow-200 bg-yellow-50/50">
        <CardContent className="pt-4 pb-4">
          <div className="flex gap-3">
            <ShieldAlert className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-yellow-800">
              <p className="font-semibold mb-1">Atenção</p>
              <ul className="space-y-1 text-xs">
                <li>
                  O desligamento requer aviso prévio de 30 dias conforme contrato.
                </li>
                <li>Pendências financeiras devem ser quitadas antes da solicitação.</li>
                <li>
                  Após o processamento, seus créditos de geração serão encerrados.
                </li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Checklist */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <p className="text-sm font-semibold text-gray-700 mb-3">
            Checklist de requisitos
          </p>
          <div className="space-y-2">
            <ChecklistItem
              ok={checklist?.semFaturasAberto ?? false}
              label="Sem faturas em aberto"
            />
            <ChecklistItem
              ok={checklist?.semGeracaoAtiva ?? false}
              label="Sem geração ativa no mês corrente"
            />
          </div>
        </CardContent>
      </Card>

      {/* Formulário */}
      <form onSubmit={handleSubmit}>
        <Card>
          <CardContent className="pt-4 pb-4 space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">
                Motivo do desligamento
              </label>
              <select
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                className="w-full h-9 px-3 rounded-lg border border-gray-300 text-sm bg-white"
              >
                <option value="">Selecione...</option>
                {MOTIVOS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">
                Observações (opcional)
              </label>
              <textarea
                value={observacao}
                onChange={(e) => setObservacao(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm resize-none"
                placeholder="Conte-nos mais sobre o motivo..."
              />
            </div>
            <label className="flex items-start gap-2">
              <input
                type="checkbox"
                checked={confirmado}
                onChange={(e) => setConfirmado(e.target.checked)}
                className="mt-1 rounded border-gray-300"
              />
              <span className="text-xs text-gray-600">
                Confirmo que desejo solicitar o desligamento da cooperativa e
                estou ciente das regras e prazos envolvidos.
              </span>
            </label>
            {erro && (
              <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">
                {erro}
              </p>
            )}
            <Button
              type="submit"
              disabled={enviando || !podeDesligar}
              className="w-full bg-red-600 hover:bg-red-700 text-white disabled:opacity-50"
            >
              {enviando ? 'Enviando...' : 'Solicitar desligamento'}
            </Button>
            {!podeDesligar && (
              <p className="text-xs text-red-500 text-center">
                Resolva as pendências acima antes de solicitar o desligamento.
              </p>
            )}
          </CardContent>
        </Card>
      </form>
    </div>
  );
}

function ChecklistItem({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2">
      {ok ? (
        <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
      ) : (
        <XCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
      )}
      <span className={`text-sm ${ok ? 'text-gray-700' : 'text-red-600'}`}>
        {label}
      </span>
    </div>
  );
}
