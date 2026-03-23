'use client';

import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { CheckCircle, FileText, Loader2, Upload, X } from 'lucide-react';

type DocStatus = 'pendente' | 'enviado' | 'aprovado';

export interface DocItem {
  tipo: string;
  label: string;
  arquivo: File | null;
  preview: string | null;
  status: DocStatus;
}

export interface Step5Data {
  documentos: DocItem[];
}

interface Step5Props {
  data: Step5Data;
  isPJ: boolean;
  onChange: (partial: Partial<Step5Data>) => void;
  tipoMembro: string;
}

const docsPF: { tipo: string; label: string }[] = [
  { tipo: 'RG_FRENTE', label: 'RG Frente' },
  { tipo: 'RG_VERSO', label: 'RG Verso' },
  { tipo: 'CNH_FRENTE', label: 'CNH Frente' },
  { tipo: 'CNH_VERSO', label: 'CNH Verso' },
];

const docsPJ: { tipo: string; label: string }[] = [
  { tipo: 'CONTRATO_SOCIAL', label: 'Contrato Social' },
  { tipo: 'CNH_FRENTE', label: 'RG/CNH Representante (Frente)' },
  { tipo: 'CNH_VERSO', label: 'RG/CNH Representante (Verso)' },
];

export default function Step5Documentos({ data, isPJ, onChange, tipoMembro }: Step5Props) {
  const { documentos } = data;
  const tiposEsperados = isPJ ? docsPJ : docsPF;

  function setDocFile(tipo: string, file: File | null) {
    let preview: string | null = null;
    if (file && file.type.startsWith('image/')) {
      preview = URL.createObjectURL(file);
    }
    const updated = documentos.map(d => d.tipo === tipo ? { ...d, arquivo: file, preview, status: file ? 'enviado' as DocStatus : 'pendente' as DocStatus } : d);
    // Se o tipo não existe, adicionar
    if (!updated.find(d => d.tipo === tipo)) {
      const label = tiposEsperados.find(t => t.tipo === tipo)?.label ?? tipo;
      updated.push({ tipo, label, arquivo: file, preview, status: file ? 'enviado' : 'pendente' });
    }
    onChange({ documentos: updated });
  }

  function aprovarDoc(tipo: string) {
    onChange({ documentos: documentos.map(d => d.tipo === tipo ? { ...d, status: 'aprovado' as DocStatus } : d) });
  }

  function removerDoc(tipo: string) {
    onChange({ documentos: documentos.map(d => d.tipo === tipo ? { ...d, arquivo: null, preview: null, status: 'pendente' as DocStatus } : d) });
  }

  const temDocs = documentos.some(d => d.arquivo);

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-base font-semibold text-gray-800 mb-1">Documentos</h2>
        <p className="text-sm text-gray-500">
          {isPJ
            ? 'Envie o contrato social e RG/CNH do representante legal.'
            : `Envie RG (frente + verso) OU CNH (frente + verso) do ${tipoMembro.toLowerCase()}.`}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {tiposEsperados.map(({ tipo, label }) => {
          const doc = documentos.find(d => d.tipo === tipo);
          const hasFile = !!doc?.arquivo;
          const isAprovado = doc?.status === 'aprovado';

          return (
            <div key={tipo} className={`border-2 border-dashed rounded-xl p-4 text-center transition-colors ${
              isAprovado ? 'border-green-400 bg-green-50' : hasFile ? 'border-green-300 bg-green-50' : 'border-gray-300 hover:border-green-400 hover:bg-green-50'
            }`}>
              {doc?.preview && (
                <div className="mb-2 relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={doc.preview} alt={label} className="max-h-24 mx-auto rounded-md object-contain" />
                  {!isAprovado && (
                    <button onClick={() => removerDoc(tipo)} className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5">
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </div>
              )}

              {!hasFile && (
                <label className="cursor-pointer block">
                  <input type="file" accept="image/*,.pdf" className="hidden"
                    onChange={e => setDocFile(tipo, e.target.files?.[0] ?? null)} />
                  <Upload className="h-6 w-6 text-gray-400 mx-auto mb-2" />
                  <p className="text-xs font-medium text-gray-700">{label}</p>
                  <p className="text-xs text-gray-400 mt-1">Arraste ou clique</p>
                </label>
              )}

              {hasFile && !doc?.preview && (
                <div className="space-y-1">
                  <FileText className="h-6 w-6 text-green-600 mx-auto" />
                  <p className="text-xs font-medium text-green-800 truncate">{doc?.arquivo?.name}</p>
                  {!isAprovado && (
                    <button onClick={() => removerDoc(tipo)} className="text-xs text-red-500 hover:underline">Remover</button>
                  )}
                </div>
              )}

              {/* Status badge */}
              <div className="mt-2">
                {isAprovado ? (
                  <span className="inline-flex items-center gap-1 text-xs text-green-700 font-medium"><CheckCircle className="h-3 w-3" /> Aprovado</span>
                ) : hasFile ? (
                  <div className="flex items-center justify-center gap-2">
                    <span className="text-xs text-blue-600 font-medium">Enviado</span>
                    <button onClick={() => aprovarDoc(tipo)} className="text-xs text-green-700 hover:underline">Aprovar</button>
                  </div>
                ) : (
                  <span className="text-xs text-gray-400">Pendente</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {temDocs && (
        <div className="flex justify-end">
          <Button
            onClick={() => onChange({ documentos: documentos.map(d => d.arquivo ? { ...d, status: 'aprovado' } : d) })}
            size="sm"
            disabled={documentos.every(d => !d.arquivo || d.status === 'aprovado')}
          >
            <CheckCircle className="h-4 w-4 mr-2" />
            Aprovar todos os documentos
          </Button>
        </div>
      )}
    </div>
  );
}
