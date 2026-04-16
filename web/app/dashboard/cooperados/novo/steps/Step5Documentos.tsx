'use client';

import { useEffect, useState, useCallback } from 'react';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import {
  CheckCircle, Clock, XCircle, FileText, RefreshCw, Loader2, ExternalLink,
} from 'lucide-react';

export interface Step5Data {
  documentosConferidos: boolean;
}

interface DocRemoto {
  id: string;
  tipo: string;
  url: string;
  nomeArquivo: string | null;
  tamanhoBytes: number | null;
  status: string;
  motivoRejeicao: string | null;
  createdAt: string;
}

const TIPO_LABEL: Record<string, string> = {
  RG_FRENTE: 'RG (Frente)',
  RG_VERSO: 'RG (Verso)',
  CNH_FRENTE: 'CNH (Frente)',
  CNH_VERSO: 'CNH (Verso)',
  CONTRATO_SOCIAL: 'Contrato Social',
  OUTROS: 'Outros',
};

interface Step5Props {
  data: Step5Data;
  cooperadoId: string;
  onChange: (partial: Partial<Step5Data>) => void;
  tipoMembro: string;
}

export default function Step5Documentos({ data, cooperadoId, onChange, tipoMembro }: Step5Props) {
  const { documentosConferidos } = data;
  const [docs, setDocs] = useState<DocRemoto[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState('');
  const [aprovando, setAprovando] = useState<string | null>(null);
  const [reprovandoId, setReprovandoId] = useState<string | null>(null);
  const [motivoRejeicao, setMotivoRejeicao] = useState('');

  const buscarDocs = useCallback(async () => {
    if (!cooperadoId) return;
    setCarregando(true);
    setErro('');
    try {
      const { data: lista } = await api.get<DocRemoto[]>(`/documentos/cooperado/${cooperadoId}`);
      setDocs(lista);
    } catch {
      setErro('Erro ao carregar documentos.');
    } finally {
      setCarregando(false);
    }
  }, [cooperadoId]);

  useEffect(() => {
    buscarDocs();
  }, [buscarDocs]);

  async function aprovarDoc(docId: string) {
    setAprovando(docId);
    try {
      await api.patch(`/documentos/${docId}/aprovar`);
      await buscarDocs();
    } catch {
      setErro('Erro ao aprovar documento.');
    } finally {
      setAprovando(null);
    }
  }

  async function reprovarDoc() {
    if (!reprovandoId || !motivoRejeicao.trim()) return;
    setAprovando(reprovandoId);
    try {
      await api.patch(`/documentos/${reprovandoId}/reprovar`, { motivoRejeicao: motivoRejeicao.trim() });
      setReprovandoId(null);
      setMotivoRejeicao('');
      await buscarDocs();
    } catch {
      setErro('Erro ao reprovar documento.');
    } finally {
      setAprovando(null);
    }
  }

  const statusIcon = (status: string) => {
    if (status === 'APROVADO') return <CheckCircle className="h-4 w-4 text-green-600" />;
    if (status === 'REPROVADO') return <XCircle className="h-4 w-4 text-red-500" />;
    return <Clock className="h-4 w-4 text-amber-500" />;
  };

  const statusLabel = (status: string) => {
    if (status === 'APROVADO') return 'Aprovado';
    if (status === 'REPROVADO') return 'Reprovado';
    return 'Pendente análise';
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-base font-semibold text-gray-800 mb-1">Documentos recebidos</h2>
        <p className="text-sm text-gray-500">
          O {tipoMembro.toLowerCase()} foi notificado para enviar documentos pelo portal.
          Acompanhe o recebimento e analise cada documento abaixo.
        </p>
      </div>

      {/* Botão atualizar */}
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={buscarDocs} disabled={carregando}>
          {carregando ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
          Atualizar
        </Button>
      </div>

      {erro && <p className="text-sm text-red-600">{erro}</p>}

      {/* Lista de documentos */}
      {docs.length === 0 && !carregando && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center">
          <FileText className="h-8 w-8 text-gray-400 mx-auto mb-2" />
          <p className="text-sm text-gray-600 font-medium">Nenhum documento recebido ainda</p>
          <p className="text-xs text-gray-500 mt-1">
            O cooperado pode enviar pelo portal em /portal/documentos.
            Clique em &quot;Atualizar&quot; para verificar novos envios.
          </p>
        </div>
      )}

      {docs.length > 0 && (
        <div className="space-y-3">
          {docs.map(doc => (
            <div key={doc.id} className={`border rounded-lg p-4 flex items-center gap-4 ${
              doc.status === 'APROVADO' ? 'border-green-200 bg-green-50' :
              doc.status === 'REPROVADO' ? 'border-red-200 bg-red-50' :
              'border-gray-200'
            }`}>
              {/* Ícone + info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  {statusIcon(doc.status)}
                  <span className="text-sm font-medium text-gray-800">{TIPO_LABEL[doc.tipo] ?? doc.tipo}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    doc.status === 'APROVADO' ? 'bg-green-100 text-green-700' :
                    doc.status === 'REPROVADO' ? 'bg-red-100 text-red-700' :
                    'bg-amber-100 text-amber-700'
                  }`}>
                    {statusLabel(doc.status)}
                  </span>
                </div>
                <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                  {doc.nomeArquivo && <span className="truncate max-w-[200px]">{doc.nomeArquivo}</span>}
                  <span>{new Date(doc.createdAt).toLocaleDateString('pt-BR')}</span>
                  {doc.tamanhoBytes && <span>{Math.round(doc.tamanhoBytes / 1024)} KB</span>}
                </div>
                {doc.status === 'REPROVADO' && doc.motivoRejeicao && (
                  <p className="text-xs text-red-600 mt-1">Motivo: {doc.motivoRejeicao}</p>
                )}
              </div>

              {/* Ações */}
              <div className="flex items-center gap-2 shrink-0">
                <a href={doc.url} target="_blank" rel="noopener noreferrer"
                  className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                  <ExternalLink className="h-3 w-3" /> Ver
                </a>
                {doc.status === 'PENDENTE' && (
                  <>
                    <Button variant="outline" size="sm"
                      onClick={() => aprovarDoc(doc.id)}
                      disabled={aprovando === doc.id}
                      className="text-green-700 border-green-300 hover:bg-green-50">
                      {aprovando === doc.id ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Aprovar'}
                    </Button>
                    <Button variant="outline" size="sm"
                      onClick={() => { setReprovandoId(doc.id); setMotivoRejeicao(''); }}
                      className="text-red-700 border-red-300 hover:bg-red-50">
                      Reprovar
                    </Button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal de reprovação inline */}
      {reprovandoId && (
        <div className="border border-red-200 rounded-lg p-4 bg-red-50 space-y-3">
          <p className="text-sm font-medium text-red-800">Motivo da reprovação</p>
          <textarea
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
            rows={2}
            value={motivoRejeicao}
            onChange={e => setMotivoRejeicao(e.target.value)}
            placeholder="Descreva o motivo da reprovação..."
          />
          <div className="flex gap-2">
            <Button size="sm" variant="destructive" onClick={reprovarDoc}
              disabled={!motivoRejeicao.trim() || aprovando === reprovandoId}>
              {aprovando === reprovandoId ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
              Confirmar reprovação
            </Button>
            <Button size="sm" variant="outline" onClick={() => setReprovandoId(null)}>Cancelar</Button>
          </div>
        </div>
      )}

      {/* Confirmar documentação */}
      <div className="border-t border-gray-200 pt-4">
        {documentosConferidos ? (
          <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-600" />
            <span className="text-sm text-green-800 font-medium">Documentação conferida. Pode avançar para análise final.</span>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-xs text-gray-500">
              Quando estiver satisfeito com os documentos recebidos (ou se recebeu presencialmente), confirme para prosseguir.
            </p>
            <Button
              onClick={() => onChange({ documentosConferidos: true })}
              className="w-full bg-green-600 hover:bg-green-700 text-white"
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              Confirmar documentação recebida
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
