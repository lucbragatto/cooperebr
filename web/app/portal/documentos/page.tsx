'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  FileText,
  Upload,
  CheckCircle,
  Clock,
  XCircle,
  Download,
  RefreshCw,
  X,
  AlertTriangle,
} from 'lucide-react';

interface Documento {
  id: string;
  tipo: string;
  url: string;
  nomeArquivo: string | null;
  status: string;
  motivoRejeicao: string | null;
  createdAt: string;
}

interface ContratoItem {
  id: string;
  numero: string;
  status: string;
  dataInicio: string;
  uc: { numero: string; endereco: string } | null;
  usina: { nome: string } | null;
  plano: { nome: string } | null;
}

const TIPO_LABEL: Record<string, string> = {
  RG_FRENTE: 'RG (Frente)',
  RG_VERSO: 'RG (Verso)',
  CNH_FRENTE: 'CNH (Frente)',
  CNH_VERSO: 'CNH (Verso)',
  CONTRATO_SOCIAL: 'Contrato Social',
  OUTROS: 'Outro documento',
};

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof CheckCircle }> = {
  APROVADO: { label: 'Aprovado', color: 'text-green-600', icon: CheckCircle },
  PENDENTE: { label: 'Pendente', color: 'text-yellow-600', icon: Clock },
  REPROVADO: { label: 'Reprovado', color: 'text-red-600', icon: XCircle },
};

export default function PortalDocumentosPage() {
  const [documentos, setDocumentos] = useState<Documento[]>([]);
  const [contratos, setContratos] = useState<ContratoItem[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [uploadModal, setUploadModal] = useState(false);
  const [uploadTipoInicial, setUploadTipoInicial] = useState('RG_FRENTE');

  function abrirUpload(tipoPreSelecionado?: string) {
    setUploadTipoInicial(tipoPreSelecionado ?? 'RG_FRENTE');
    setUploadModal(true);
  }

  const carregarDados = () => {
    setCarregando(true);
    Promise.all([
      api.get('/cooperados/meu-perfil/documentos'),
      api.get('/cooperados/meu-perfil/contratos'),
    ])
      .then(([docsRes, contratosRes]) => {
        setDocumentos(docsRes.data);
        setContratos(contratosRes.data);
      })
      .catch(() => {})
      .finally(() => setCarregando(false));
  };

  useEffect(() => { carregarDados(); }, []);

  if (carregando) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-20 bg-gray-200 animate-pulse rounded-xl" />
        ))}
      </div>
    );
  }

  // Separar docs pessoais de "outros"
  const docsPessoais = documentos.filter((d) =>
    ['RG_FRENTE', 'RG_VERSO', 'CNH_FRENTE', 'CNH_VERSO'].includes(d.tipo),
  );
  const docsOutros = documentos.filter((d) =>
    ['CONTRATO_SOCIAL', 'OUTROS'].includes(d.tipo),
  );

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-gray-800">Documentos</h1>
        <Button
          size="sm"
          className="bg-green-600 hover:bg-green-700 text-white"
          onClick={() => abrirUpload()}
        >
          <Upload className="w-4 h-4 mr-1" />
          Enviar
        </Button>
      </div>

      {/* Banner de docs reprovados */}
      {documentos.some((d) => d.status === 'REPROVADO') && (
        <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
          <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
          <p className="text-sm text-amber-800">
            Alguns documentos foram reprovados e precisam ser reenviados. Clique em <RefreshCw className="w-3 h-3 inline" /> no documento para reenviar.
          </p>
        </div>
      )}

      {/* Documentos Pessoais */}
      <section>
        <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-2">
          Documentos Pessoais
        </h2>
        {docsPessoais.length === 0 ? (
          <Card>
            <CardContent className="pt-4 pb-4 text-center text-sm text-gray-500">
              Nenhum documento pessoal enviado.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {docsPessoais.map((doc) => (
              <DocCard key={doc.id} doc={doc} onReenviar={() => abrirUpload(doc.tipo)} />
            ))}
          </div>
        )}
      </section>

      {/* Contratos */}
      <section>
        <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-2">
          Contratos
        </h2>
        {contratos.length === 0 ? (
          <Card>
            <CardContent className="pt-4 pb-4 text-center text-sm text-gray-500">
              Nenhum contrato encontrado.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {contratos.map((c) => (
              <Card key={c.id}>
                <CardContent className="pt-3 pb-3">
                  <div className="flex items-center justify-between">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">
                        Contrato {c.numero}
                      </p>
                      <p className="text-xs text-gray-500">
                        {c.plano?.nome ?? 'Sem plano'} &middot;{' '}
                        {c.uc ? `UC ${c.uc.numero}` : ''}{' '}
                        {c.usina ? `· ${c.usina.nome}` : ''}
                      </p>
                    </div>
                    <span
                      className={`text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${
                        c.status === 'ATIVO'
                          ? 'bg-green-100 text-green-700'
                          : c.status === 'ENCERRADO'
                            ? 'bg-gray-100 text-gray-500'
                            : 'bg-yellow-100 text-yellow-700'
                      }`}
                    >
                      {c.status === 'ATIVO'
                        ? 'Ativo'
                        : c.status === 'ENCERRADO'
                          ? 'Encerrado'
                          : 'Pendente'}
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* Outros documentos */}
      {docsOutros.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-2">
            Outros
          </h2>
          <div className="space-y-2">
            {docsOutros.map((doc) => (
              <DocCard key={doc.id} doc={doc} onReenviar={() => abrirUpload(doc.tipo)} />
            ))}
          </div>
        </section>
      )}

      {/* Upload Modal */}
      {uploadModal && (
        <UploadModal
          tipoInicial={uploadTipoInicial}
          onClose={() => setUploadModal(false)}
          onSuccess={() => {
            setUploadModal(false);
            carregarDados();
          }}
        />
      )}
    </div>
  );
}

function DocCard({ doc, onReenviar }: { doc: Documento; onReenviar: () => void }) {
  const cfg = STATUS_CONFIG[doc.status] ?? STATUS_CONFIG.PENDENTE;
  const StatusIcon = cfg.icon;

  return (
    <Card>
      <CardContent className="pt-3 pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <FileText className="w-4 h-4 text-gray-400 flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-800 truncate">
                {TIPO_LABEL[doc.tipo] ?? doc.tipo}
              </p>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1">
                  <StatusIcon className={`w-3 h-3 ${cfg.color}`} />
                  <span className={`text-xs ${cfg.color}`}>{cfg.label}</span>
                </div>
                <span className="text-xs text-gray-400">
                  {new Date(doc.createdAt).toLocaleDateString('pt-BR')}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            {doc.url && (
              <a
                href={doc.url}
                target="_blank"
                rel="noopener noreferrer"
                className="p-1.5 text-gray-400 hover:text-green-600 transition-colors"
                title="Visualizar"
              >
                <Download className="w-4 h-4" />
              </a>
            )}
            {doc.status === 'REPROVADO' && (
              <button
                onClick={onReenviar}
                className="p-1.5 text-gray-400 hover:text-blue-600 transition-colors"
                title="Reenviar"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
        {doc.status === 'REPROVADO' && doc.motivoRejeicao && (
          <div className="flex items-start gap-2 mt-2 bg-red-50 border border-red-100 rounded-md px-3 py-2">
            <AlertTriangle className="w-3 h-3 text-red-500 mt-0.5 shrink-0" />
            <p className="text-xs text-red-600">{doc.motivoRejeicao}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function UploadModal({
  tipoInicial,
  onClose,
  onSuccess,
}: {
  tipoInicial: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [tipo, setTipo] = useState(tipoInicial);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');
  const [dragOver, setDragOver] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!arquivo) {
      setErro('Selecione um arquivo.');
      return;
    }
    setEnviando(true);
    setErro('');
    try {
      const formData = new FormData();
      formData.append('file', arquivo);
      formData.append('tipo', tipo);
      await api.post('/cooperados/meu-perfil/documentos', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      onSuccess();
    } catch {
      setErro('Erro ao enviar documento. Tente novamente.');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-md p-5 relative">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
          <X className="w-5 h-5" />
        </button>
        <h2 className="text-lg font-bold text-gray-800 mb-4">Enviar documento</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">
              Tipo de documento
            </label>
            <select
              value={tipo}
              onChange={(e) => setTipo(e.target.value)}
              className="w-full h-9 px-3 rounded-lg border border-gray-300 text-sm bg-white"
            >
              {Object.entries(TIPO_LABEL).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
          <div
            className={`flex items-center justify-center w-full h-24 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${
              dragOver ? 'border-green-400 bg-green-50' : 'border-gray-300 hover:border-green-400'
            }`}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              const f = e.dataTransfer.files[0];
              if (f) setArquivo(f);
            }}
            onClick={() => document.getElementById('doc-upload')?.click()}
          >
            <div className="text-center">
              <Upload className="w-6 h-6 text-gray-400 mx-auto mb-1" />
              <p className="text-sm text-gray-500">
                {arquivo ? arquivo.name : 'Arraste ou clique para selecionar'}
              </p>
            </div>
          </div>
          <input
            id="doc-upload"
            type="file"
            accept="image/*,.pdf"
            className="hidden"
            onChange={(e) => setArquivo(e.target.files?.[0] ?? null)}
          />
          {arquivo && (
            <p className="text-xs text-gray-500">
              {(arquivo.size / 1024).toFixed(0)} KB
            </p>
          )}
          {erro && (
            <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{erro}</p>
          )}
          <Button
            type="submit"
            disabled={enviando}
            className="w-full bg-green-600 hover:bg-green-700 text-white"
          >
            {enviando ? 'Enviando...' : 'Enviar documento'}
          </Button>
        </form>
      </div>
    </div>
  );
}
