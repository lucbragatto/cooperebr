'use client';

import { useState } from 'react';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { CheckCircle, FileText, Loader2, Send, Copy, Check, AlertTriangle } from 'lucide-react';
import type { Step2Data } from './Step2Dados';
import type { Step3Data } from './Step3Simulacao';

export interface Step6Data {
  contratoGerado: boolean;
  statusAssinatura: 'pendente' | 'aguardando' | 'assinado';
}

interface Step6Props {
  data: Step6Data;
  propostaId: string;
  dadosPessoais: Step2Data;
  simulacaoData: Step3Data;
  onChange: (partial: Partial<Step6Data>) => void;
  tipoMembro: string;
}

export default function Step6Contrato({ data, propostaId, dadosPessoais, simulacaoData, onChange, tipoMembro }: Step6Props) {
  const { contratoGerado, statusAssinatura } = data;
  const { simulacao } = simulacaoData;
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');
  const [linkAssinatura, setLinkAssinatura] = useState('');
  const [copiado, setCopiado] = useState(false);
  const [decisao, setDecisao] = useState<'PENDENTE' | 'REPROVADO' | null>(null);
  const [motivo, setMotivo] = useState('');

  async function aprovarDocumentacao() {
    setEnviando(true);
    setErro('');
    try {
      const { data: resp } = await api.post<{ sucesso: boolean; link?: string }>(
        `/motor-proposta/proposta/${propostaId}/documentos/status`,
        { resultado: 'APROVADO' },
      );
      if (resp.link) setLinkAssinatura(resp.link);
      onChange({ contratoGerado: true, statusAssinatura: 'aguardando' });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro ao aprovar documentação.';
      setErro(message);
    } finally {
      setEnviando(false);
    }
  }

  async function enviarDecisao() {
    if (!decisao) return;
    if (decisao === 'REPROVADO' && !motivo.trim()) return;
    setEnviando(true);
    setErro('');
    try {
      await api.post(`/motor-proposta/proposta/${propostaId}/documentos/status`, {
        resultado: decisao,
        motivo: motivo.trim() || undefined,
      });
      setDecisao(null);
      setMotivo('');
      setErro('');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro ao enviar decisão.';
      setErro(message);
    } finally {
      setEnviando(false);
    }
  }

  function copiarLink() {
    navigator.clipboard.writeText(linkAssinatura).then(() => {
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    }).catch(() => {});
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-base font-semibold text-gray-800 mb-1">Análise final e contrato</h2>
        <p className="text-sm text-gray-500">
          Revise os dados, aprove a documentação e envie o contrato para assinatura do {tipoMembro.toLowerCase()}.
        </p>
      </div>

      {/* Preview do contrato */}
      <div className="border border-gray-200 rounded-lg p-5 space-y-4 bg-gray-50">
        <div className="flex items-center gap-2 border-b border-gray-200 pb-3">
          <FileText className="h-5 w-5 text-green-700" />
          <h3 className="text-sm font-bold text-gray-800">CONTRATO DE ADESÃO</h3>
        </div>
        <div className="text-sm text-gray-700 space-y-2">
          <p><b>Contratante:</b> {dadosPessoais.nomeCompleto}</p>
          <p><b>{dadosPessoais.tipoPessoa === 'PJ' ? 'CNPJ' : 'CPF'}:</b> {dadosPessoais.cpf}</p>
          <p><b>Endereço:</b> {dadosPessoais.endereco}, {dadosPessoais.bairro}, {dadosPessoais.cidade}/{dadosPessoais.estado} - {dadosPessoais.cep}</p>
          <p><b>Email:</b> {dadosPessoais.email}</p>
          <p><b>Telefone:</b> {dadosPessoais.telefone}</p>
          {dadosPessoais.tipoPessoa === 'PJ' && dadosPessoais.representanteLegalNome && (
            <p><b>Representante Legal:</b> {dadosPessoais.representanteLegalNome} (CPF: {dadosPessoais.representanteLegalCpf})</p>
          )}
          <div className="border-t border-gray-200 pt-2 mt-3">
            <p><b>Desconto contratado:</b> {simulacao?.desconto ?? 0}%</p>
            <p><b>Economia mensal estimada:</b> {simulacao?.economiaMensal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
            <p><b>Forma de pagamento:</b> {
              ({ BOLETO: 'Boleto', PIX: 'PIX', CARTAO_CREDITO: 'Cartão de crédito', DEBITO_CONTA: 'Débito em conta', DEBITO_FOLHA: 'Débito em folha', CONSIGNADO: 'Consignado' } as Record<string, string>)[dadosPessoais.formaPagamento] ?? dadosPessoais.formaPagamento
            }</p>
          </div>
          <p className="text-xs text-gray-500 italic mt-4">
            Este contrato é gerado automaticamente com base nos dados informados. Vigência de 12 meses com renovação automática.
          </p>
        </div>
      </div>

      {erro && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">{erro}</div>
      )}

      {/* Decisão sobre documentação — antes de aprovar */}
      {statusAssinatura === 'pendente' && !decisao && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-gray-800">Decisão sobre a documentação</h3>
          <p className="text-xs text-gray-500">
            Ao aprovar, o sistema gera os PDFs (contrato + procuração) e envia o link de assinatura ao cooperado via WA e email.
          </p>
          <div className="flex gap-3">
            <Button onClick={aprovarDocumentacao} disabled={enviando || !propostaId}
              className="flex-1 bg-green-600 hover:bg-green-700 text-white">
              {enviando ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
              Aprovar e enviar para assinatura
            </Button>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" size="sm" className="flex-1 text-amber-700 border-amber-300 hover:bg-amber-50"
              onClick={() => setDecisao('PENDENTE')}>
              Solicitar correções
            </Button>
            <Button variant="outline" size="sm" className="flex-1 text-red-700 border-red-300 hover:bg-red-50"
              onClick={() => setDecisao('REPROVADO')}>
              Reprovar documentação
            </Button>
          </div>
        </div>
      )}

      {/* Modal inline PENDENTE/REPROVADO com motivo */}
      {decisao && (
        <div className={`border rounded-lg p-4 space-y-3 ${
          decisao === 'REPROVADO' ? 'border-red-200 bg-red-50' : 'border-amber-200 bg-amber-50'
        }`}>
          <p className="text-sm font-medium" style={{ color: decisao === 'REPROVADO' ? '#991b1b' : '#92400e' }}>
            {decisao === 'REPROVADO' ? 'Motivo da reprovação (obrigatório)' : 'Mensagem para o cooperado (opcional)'}
          </p>
          <textarea
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
            rows={2}
            value={motivo}
            onChange={e => setMotivo(e.target.value)}
            placeholder={decisao === 'REPROVADO' ? 'Descreva o motivo da reprovação...' : 'Ex: precisamos do verso do RG...'}
          />
          <div className="flex gap-2">
            <Button size="sm"
              variant={decisao === 'REPROVADO' ? 'destructive' : 'default'}
              onClick={enviarDecisao}
              disabled={enviando || (decisao === 'REPROVADO' && !motivo.trim())}>
              {enviando ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
              {decisao === 'REPROVADO' ? 'Confirmar reprovação' : 'Enviar solicitação'}
            </Button>
            <Button size="sm" variant="outline" onClick={() => { setDecisao(null); setMotivo(''); }}>
              Cancelar
            </Button>
          </div>
        </div>
      )}

      {/* Aguardando assinatura */}
      {statusAssinatura === 'aguardando' && (
        <div className="space-y-3">
          <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-800 flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            Aguardando assinatura do {tipoMembro.toLowerCase()}...
          </div>

          {/* Link copiável */}
          {linkAssinatura && (
            <div className="border border-gray-200 rounded-lg p-3 space-y-2">
              <p className="text-xs text-gray-500">Link de assinatura (para envio manual por outro canal):</p>
              <div className="flex gap-2">
                <input
                  readOnly
                  value={linkAssinatura}
                  className="flex-1 bg-gray-50 border border-gray-300 rounded-md px-3 py-2 text-xs text-gray-700 font-mono"
                />
                <Button variant="outline" size="sm" onClick={copiarLink}>
                  {copiado ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          )}

          <Button onClick={() => onChange({ statusAssinatura: 'assinado' })} size="sm" variant="outline">
            <CheckCircle className="h-4 w-4 mr-2" />
            Marcar como assinado (presencial)
          </Button>
        </div>
      )}

      {/* Assinado */}
      {statusAssinatura === 'assinado' && (
        <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-sm text-green-800 flex items-center gap-2">
          <CheckCircle className="h-4 w-4" />
          Contrato assinado. Pode avançar para alocação.
        </div>
      )}
    </div>
  );
}
