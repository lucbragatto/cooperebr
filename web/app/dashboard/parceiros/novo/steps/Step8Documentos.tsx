'use client';

import { useState, useEffect } from 'react';
import api from '@/lib/api';
import { Badge } from '@/components/ui/badge';

interface ModeloPadrao {
  id: string;
  tipo: string;
  nome: string;
  variaveis: string[];
  preview: string;
  conteudo?: string;
}

interface DocumentosData {
  temModeloProprio: boolean | null;
  modeloContratoId: string;
  modeloProcuracaoId: string;
  modeloContratoNome: string;
  modeloProcuracaoNome: string;
  modeloContratoVariaveis: string[];
  modeloProcuracaoVariaveis: string[];
}

interface Step8Props {
  data: DocumentosData;
  onChange: (data: Partial<DocumentosData>) => void;
}

const lbl = 'block text-xs font-medium text-neutral-600 mb-1';

export default function Step8Documentos({ data, onChange }: Step8Props) {
  const [modelosPadrao, setModelosPadrao] = useState<ModeloPadrao[]>([]);
  const [uploading, setUploading] = useState<{ contrato: boolean; procuracao: boolean }>({ contrato: false, procuracao: false });
  const [uploadStatus, setUploadStatus] = useState<{ contrato: string; procuracao: string }>({ contrato: '', procuracao: '' });
  const [previewModal, setPreviewModal] = useState<ModeloPadrao | null>(null);

  useEffect(() => {
    if (data.temModeloProprio === false) {
      api.get('/motor-proposta/modelos-padrao').then(({ data: modelos }) => {
        setModelosPadrao(modelos);
      }).catch(() => {
        alert('Erro ao carregar modelos de documento. Tente recarregar a página.');
      });
    }
  }, [data.temModeloProprio]);

  async function uploadModelo(tipo: 'CONTRATO' | 'PROCURACAO', file: File) {
    const key = tipo === 'CONTRATO' ? 'contrato' : 'procuracao';
    setUploading((prev) => ({ ...prev, [key]: true }));
    setUploadStatus((prev) => ({ ...prev, [key]: '' }));

    try {
      const formData = new FormData();
      formData.append('arquivo', file);
      formData.append('tipo', tipo);
      formData.append('nome', `${tipo === 'CONTRATO' ? 'Contrato' : 'Procuracao'} - ${file.name}`);

      const { data: res } = await api.post('/motor-proposta/upload-modelo', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      if (tipo === 'CONTRATO') {
        onChange({
          modeloContratoId: res.id,
          modeloContratoNome: file.name,
          modeloContratoVariaveis: res.variaveis,
        });
      } else {
        onChange({
          modeloProcuracaoId: res.id,
          modeloProcuracaoNome: file.name,
          modeloProcuracaoVariaveis: res.variaveis,
        });
      }
      setUploadStatus((prev) => ({ ...prev, [key]: 'Modelo salvo e pronto para uso' }));
    } catch {
      setUploadStatus((prev) => ({ ...prev, [key]: 'Erro ao fazer upload' }));
    } finally {
      setUploading((prev) => ({ ...prev, [key]: false }));
    }
  }

  function selecionarPadrao(modelo: ModeloPadrao) {
    if (modelo.tipo === 'CONTRATO') {
      onChange({
        modeloContratoId: modelo.id,
        modeloContratoNome: modelo.nome,
        modeloContratoVariaveis: modelo.variaveis,
      });
    } else {
      onChange({
        modeloProcuracaoId: modelo.id,
        modeloProcuracaoNome: modelo.nome,
        modeloProcuracaoVariaveis: modelo.variaveis,
      });
    }
  }

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-neutral-800">Modelos de Documento</h2>
      <p className="text-sm text-neutral-500">
        Este parceiro possui modelos proprios de contrato e procuracao?
      </p>

      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => onChange({ temModeloProprio: true })}
          className={`px-4 py-2 rounded-lg text-sm font-medium border transition ${
            data.temModeloProprio === true
              ? 'bg-green-600 text-white border-green-600'
              : 'bg-white text-neutral-700 border-neutral-300 hover:border-green-400'
          }`}
        >
          Sim, tenho modelos proprios
        </button>
        <button
          type="button"
          onClick={() => onChange({ temModeloProprio: false })}
          className={`px-4 py-2 rounded-lg text-sm font-medium border transition ${
            data.temModeloProprio === false
              ? 'bg-green-600 text-white border-green-600'
              : 'bg-white text-neutral-700 border-neutral-300 hover:border-green-400'
          }`}
        >
          Nao, usar modelos padrao
        </button>
      </div>

      {data.temModeloProprio === true && (
        <div className="space-y-4">
          {(['CONTRATO', 'PROCURACAO'] as const).map((tipo) => {
            const key = tipo === 'CONTRATO' ? 'contrato' : 'procuracao';
            const nomeField = tipo === 'CONTRATO' ? 'modeloContratoNome' : 'modeloProcuracaoNome';
            const variaveisField = tipo === 'CONTRATO' ? 'modeloContratoVariaveis' : 'modeloProcuracaoVariaveis';
            const variaveis = data[variaveisField];
            const nome = data[nomeField];

            return (
              <div key={tipo} className="p-4 bg-neutral-50 rounded-lg border border-neutral-200 space-y-3">
                <label className={lbl}>Modelo de {tipo === 'CONTRATO' ? 'Contrato' : 'Procuracao'} (PDF/DOCX)</label>
                <input
                  type="file"
                  accept=".pdf,.docx,.doc,.txt"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) uploadModelo(tipo, file);
                  }}
                  disabled={uploading[key]}
                  className="w-full text-sm text-neutral-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-green-50 file:text-green-700 hover:file:bg-green-100"
                />
                {uploading[key] && <p className="text-xs text-blue-600">Enviando e processando...</p>}
                {uploadStatus[key] && (
                  <Badge variant={uploadStatus[key].includes('Erro') ? 'destructive' : 'default'}>
                    {uploadStatus[key]}
                  </Badge>
                )}
                {nome && variaveis.length > 0 && (
                  <div className="mt-2">
                    <p className="text-xs font-medium text-neutral-600 mb-1">Variaveis encontradas:</p>
                    <div className="flex flex-wrap gap-1">
                      {variaveis.map((v) => (
                        <span key={v} className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs font-mono">
                          {`{{${v}}}`}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {data.temModeloProprio === false && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {modelosPadrao.length > 0 ? (
              modelosPadrao.map((modelo) => {
                const selecionado =
                  (modelo.tipo === 'CONTRATO' && data.modeloContratoId === modelo.id) ||
                  (modelo.tipo === 'PROCURACAO' && data.modeloProcuracaoId === modelo.id);

                return (
                  <div
                    key={modelo.id}
                    className={`p-4 rounded-lg border-2 transition ${
                      selecionado ? 'border-green-500 bg-green-50' : 'border-neutral-200 bg-white'
                    }`}
                  >
                    <h3 className="text-sm font-semibold text-neutral-800">{modelo.nome}</h3>
                    <p className="text-xs text-neutral-500 mt-1 line-clamp-3">{modelo.preview}</p>
                    <div className="flex gap-2 mt-3">
                      <button
                        type="button"
                        onClick={() => setPreviewModal(modelo)}
                        className="px-3 py-1.5 text-xs bg-white border border-neutral-300 rounded-lg hover:bg-neutral-50"
                      >
                        Visualizar
                      </button>
                      <button
                        type="button"
                        onClick={() => selecionarPadrao(modelo)}
                        className={`px-3 py-1.5 text-xs rounded-lg font-medium ${
                          selecionado
                            ? 'bg-green-600 text-white'
                            : 'bg-green-50 text-green-700 border border-green-300 hover:bg-green-100'
                        }`}
                      >
                        {selecionado ? 'Selecionado' : 'Usar este modelo'}
                      </button>
                    </div>
                  </div>
                );
              })
            ) : (
              <>
                <div className="p-4 rounded-lg border border-neutral-200 bg-white animate-pulse">
                  <div className="h-4 bg-neutral-200 rounded w-3/4 mb-2" />
                  <div className="h-3 bg-neutral-100 rounded w-full" />
                </div>
                <div className="p-4 rounded-lg border border-neutral-200 bg-white animate-pulse">
                  <div className="h-4 bg-neutral-200 rounded w-3/4 mb-2" />
                  <div className="h-3 bg-neutral-100 rounded w-full" />
                </div>
              </>
            )}
          </div>
          <p className="text-xs text-neutral-500">
            Voce podera editar o texto do modelo depois em Configuracoes &rarr; Documentos
          </p>
        </div>
      )}

      {/* Modal de preview */}
      {previewModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">{previewModal.nome}</h3>
              <button
                onClick={() => setPreviewModal(null)}
                className="text-neutral-400 hover:text-neutral-600 text-xl"
              >
                &times;
              </button>
            </div>
            <pre className="text-xs text-neutral-600 whitespace-pre-wrap font-mono bg-neutral-50 p-4 rounded-lg">
              {previewModal.conteudo || previewModal.preview}
            </pre>
            <div>
              <p className="text-xs font-medium text-neutral-600 mb-1">Variaveis:</p>
              <div className="flex flex-wrap gap-1">
                {previewModal.variaveis.map((v) => (
                  <span key={v} className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs font-mono">
                    {`{{${v}}}`}
                  </span>
                ))}
              </div>
            </div>
            <button
              onClick={() => {
                selecionarPadrao(previewModal);
                setPreviewModal(null);
              }}
              className="w-full py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700"
            >
              Usar este modelo
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
