'use client';

/**
 * AcoesLoteBar — Barra de ações em lote para a tabela de cooperados.
 *
 * Exibe quando há itens selecionados e permite:
 *  - Enviar WhatsApp em massa
 *  - Aplicar reajuste percentual nos contratos
 *  - Aplicar benefício manual
 *  - Alterar status em lote
 */

import { useRef, useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Send, TrendingUp, Gift, RefreshCw, ChevronDown, X } from 'lucide-react';
import api from '@/lib/api';

const STATUS_LABELS: Record<string, string> = {
  ATIVO: 'Ativo',
  ATIVO_RECEBENDO_CREDITOS: 'Ativo (recebendo créditos)',
  AGUARDANDO_CONCESSIONARIA: 'Aguardando concessionária',
  PENDENTE_ATIVACAO: 'Pendente ativação',
  PENDENTE: 'Pendente',
  PENDENTE_DOCUMENTOS: 'Pendente documentos',
  PENDENTE_VALIDACAO: 'Pendente validação',
  PROPOSTA_ENVIADA: 'Proposta enviada',
  PROPOSTA_ACEITA: 'Proposta aceita',
  APROVADO: 'Aprovado',
  SUSPENSO: 'Suspenso',
  ENCERRADO: 'Encerrado',
  LISTA_ESPERA: 'Lista de espera',
};

interface AcoesLoteBarProps {
  /** IDs dos cooperados selecionados */
  selecionados: string[];
  /** Callback para limpar seleção */
  onLimpar: () => void;
  /** Callback após ação executada com sucesso (passa mensagem de feedback) */
  onSucesso?: (mensagem: string) => void;
}

type AcaoAtiva = 'whatsapp' | 'reajuste' | 'beneficio' | 'status' | null;

export default function AcoesLoteBar({ selecionados, onLimpar, onSucesso }: AcoesLoteBarProps) {
  const [dropdown, setDropdown] = useState(false);
  const [acao, setAcao] = useState<AcaoAtiva>(null);
  const [loading, setLoading] = useState(false);

  // Campos de formulário
  const [mensagemWhatsapp, setMensagemWhatsapp] = useState('');
  const [percentualReajuste, setPercentualReajuste] = useState('');
  const [motivoReajuste, setMotivoReajuste] = useState('');
  const [valorBeneficio, setValorBeneficio] = useState('');
  const [novoStatus, setNovoStatus] = useState('');

  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fechar dropdown ao clicar fora
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdown(false);
      }
    }
    if (dropdown) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [dropdown]);

  function selecionarAcao(a: AcaoAtiva) {
    setAcao(a);
    setDropdown(false);
  }

  function limpar() {
    setAcao(null);
    setMensagemWhatsapp('');
    setPercentualReajuste('');
    setMotivoReajuste('');
    setValorBeneficio('');
    setNovoStatus('');
    onLimpar();
  }

  async function executar() {
    if (!acao) return;
    setLoading(true);
    try {
      if (acao === 'whatsapp') {
        const { data } = await api.post('/cooperados/batch/whatsapp', {
          cooperadoIds: selecionados,
          mensagem: mensagemWhatsapp,
        });
        onSucesso?.(`WhatsApp enviado: ${data.enviados}/${data.total} (${data.erros} erro(s))`);
      } else if (acao === 'reajuste') {
        const { data } = await api.post('/cooperados/batch/reajuste', {
          cooperadoIds: selecionados,
          percentual: Number(percentualReajuste),
          motivo: motivoReajuste,
        });
        onSucesso?.(`Reajuste aplicado em ${data.atualizados} contrato(s)`);
      } else if (acao === 'beneficio') {
        const mesRef = new Date().toISOString().slice(0, 7);
        const { data } = await api.post('/cooperados/batch/beneficio', {
          cooperadoIds: selecionados,
          valor: Number(valorBeneficio),
          tipo: 'MANUAL',
          mesReferencia: mesRef,
        });
        onSucesso?.(`Benefício criado para ${data.criados} cooperado(s)`);
      } else if (acao === 'status') {
        const { data } = await api.post('/cooperados/batch/status', {
          cooperadoIds: selecionados,
          status: novoStatus,
        });
        onSucesso?.(`Status alterado para ${data.atualizados} cooperado(s)`);
      }
      setAcao(null);
      onLimpar();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      alert(msg || 'Erro ao executar ação em lote');
    } finally {
      setLoading(false);
    }
  }

  const canExecute = () => {
    if (loading) return false;
    if (acao === 'whatsapp') return !!mensagemWhatsapp.trim();
    if (acao === 'reajuste') return !!percentualReajuste && !!motivoReajuste.trim();
    if (acao === 'beneficio') return !!valorBeneficio && Number(valorBeneficio) > 0;
    if (acao === 'status') return !!novoStatus;
    return false;
  };

  return (
    <div className="flex flex-wrap items-center gap-3 bg-blue-50 border border-blue-200 rounded-lg px-4 py-2 mb-4">
      {/* Contador */}
      <span className="text-sm font-medium text-blue-800 whitespace-nowrap">
        {selecionados.length} selecionado(s)
      </span>

      {/* Dropdown de ações */}
      <div className="relative" ref={dropdownRef}>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setDropdown(!dropdown)}
          className="gap-1"
        >
          Ações <ChevronDown className="h-3 w-3" />
        </Button>
        {dropdown && (
          <div className="absolute left-0 top-full mt-1 w-56 bg-white border border-gray-200 rounded-md shadow-lg z-50">
            <button
              onClick={() => selecionarAcao('whatsapp')}
              className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              <Send className="h-4 w-4 text-green-600" /> Enviar WhatsApp
            </button>
            <button
              onClick={() => selecionarAcao('reajuste')}
              className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              <TrendingUp className="h-4 w-4 text-blue-600" /> Aplicar Reajuste
            </button>
            <button
              onClick={() => selecionarAcao('beneficio')}
              className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              <Gift className="h-4 w-4 text-purple-600" /> Benefício Manual
            </button>
            <button
              onClick={() => selecionarAcao('status')}
              className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              <RefreshCw className="h-4 w-4 text-orange-500" /> Alterar Status
            </button>
          </div>
        )}
      </div>

      {/* Formulário contextual da ação */}
      {acao === 'whatsapp' && (
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Input
            placeholder="Mensagem para enviar a todos selecionados..."
            value={mensagemWhatsapp}
            onChange={(e) => setMensagemWhatsapp(e.target.value)}
            className="flex-1"
          />
          <Button size="sm" onClick={executar} disabled={!canExecute()}>
            {loading ? 'Enviando...' : 'Enviar'}
          </Button>
        </div>
      )}

      {acao === 'reajuste' && (
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Input
            type="number"
            placeholder="% reajuste"
            value={percentualReajuste}
            onChange={(e) => setPercentualReajuste(e.target.value)}
            className="w-28"
          />
          <Input
            placeholder="Motivo"
            value={motivoReajuste}
            onChange={(e) => setMotivoReajuste(e.target.value)}
            className="flex-1"
          />
          <Button size="sm" onClick={executar} disabled={!canExecute()}>
            {loading ? 'Aplicando...' : 'Aplicar'}
          </Button>
        </div>
      )}

      {acao === 'beneficio' && (
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Input
            type="number"
            placeholder="Valor R$"
            value={valorBeneficio}
            onChange={(e) => setValorBeneficio(e.target.value)}
            className="w-32"
          />
          <Button size="sm" onClick={executar} disabled={!canExecute()}>
            {loading ? 'Criando...' : 'Criar'}
          </Button>
        </div>
      )}

      {acao === 'status' && (
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <select
            value={novoStatus}
            onChange={(e) => setNovoStatus(e.target.value)}
            className="border rounded-md px-3 py-1.5 text-sm flex-1"
          >
            <option value="">Selecionar novo status...</option>
            {Object.entries(STATUS_LABELS).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
          <Button size="sm" onClick={executar} disabled={!canExecute()}>
            {loading ? 'Alterando...' : 'Alterar'}
          </Button>
        </div>
      )}

      {/* Botão limpar */}
      <Button
        variant="ghost"
        size="sm"
        onClick={limpar}
        className="text-gray-500 ml-auto"
        title="Limpar seleção"
      >
        <X className="h-4 w-4 mr-1" /> Limpar
      </Button>
    </div>
  );
}
