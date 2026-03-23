'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { CheckCircle, FileText, Loader2, Send } from 'lucide-react';
import type { Step2Data } from './Step2Dados';
import type { Step3Data } from './Step3Simulacao';

export interface Step6Data {
  contratoGerado: boolean;
  assinaturaPresencial: boolean;
  statusAssinatura: 'pendente' | 'aguardando' | 'assinado';
}

interface Step6Props {
  data: Step6Data;
  dadosPessoais: Step2Data;
  simulacaoData: Step3Data;
  onChange: (partial: Partial<Step6Data>) => void;
  tipoMembro: string;
}

export default function Step6Contrato({ data, dadosPessoais, simulacaoData, onChange, tipoMembro }: Step6Props) {
  const { contratoGerado, assinaturaPresencial, statusAssinatura } = data;
  const { simulacao } = simulacaoData;
  const [enviando, setEnviando] = useState(false);

  function enviarParaAssinatura() {
    setEnviando(true);
    setTimeout(() => {
      onChange({ statusAssinatura: 'aguardando', contratoGerado: true });
      setEnviando(false);
    }, 1000);
  }

  function assinarPresencialmente() {
    onChange({ assinaturaPresencial: true, statusAssinatura: 'assinado', contratoGerado: true });
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-base font-semibold text-gray-800 mb-1">Contrato</h2>
        <p className="text-sm text-gray-500">Preview do contrato gerado com os dados do {tipoMembro.toLowerCase()}.</p>
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
              { BOLETO: 'Boleto', PIX: 'PIX', CARTAO_CREDITO: 'Cartão de crédito', DEBITO_CONTA: 'Débito em conta', DEBITO_FOLHA: 'Débito em folha', CONSIGNADO: 'Consignado' }[dadosPessoais.formaPagamento] ?? dadosPessoais.formaPagamento
            }</p>
          </div>

          <p className="text-xs text-gray-500 italic mt-4">
            Este contrato é gerado automaticamente com base nos dados informados. Vigência de 12 meses com renovação automática.
          </p>
        </div>
      </div>

      {/* Ações */}
      <div className="space-y-3">
        {statusAssinatura === 'pendente' && (
          <div className="flex gap-3">
            <Button onClick={enviarParaAssinatura} disabled={enviando} className="flex-1">
              {enviando ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
              Enviar para assinatura
            </Button>
            <Button onClick={assinarPresencialmente} variant="outline" className="flex-1">
              Assinar presencialmente
            </Button>
          </div>
        )}

        {statusAssinatura === 'aguardando' && (
          <div className="space-y-3">
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-800 flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Aguardando assinatura do {tipoMembro.toLowerCase()}...
            </div>
            <Button onClick={() => onChange({ statusAssinatura: 'assinado' })} size="sm" variant="outline">
              <CheckCircle className="h-4 w-4 mr-2" />
              Marcar como assinado
            </Button>
          </div>
        )}

        {statusAssinatura === 'assinado' && (
          <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-sm text-green-800 flex items-center gap-2">
            <CheckCircle className="h-4 w-4" />
            Contrato {assinaturaPresencial ? 'assinado presencialmente' : 'assinado digitalmente'} ✅
          </div>
        )}
      </div>
    </div>
  );
}
