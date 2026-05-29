'use client';

/**
 * D-novo-BH BH.3.1 (M37, 29/05/2026) — Componente de upload nativo de comprovante.
 *
 * Aceita JPG/PNG/PDF max 5MB. Upload imediato no onChange do input (não espera
 * submit do form). Backend storage local servido via /uploads/.
 *
 * Drag-drop + clique pra abrir file picker + preview + remover.
 *
 * onChange recebe URL relativa (`/uploads/comprovantes/coop/ano/mes/nome.jpg`) OR
 * undefined quando removido.
 */

import { useState, useRef } from 'react';
import { Upload, FileText, Image as ImageIcon, X, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import api from '@/lib/api';

const MAX_BYTES = 5 * 1024 * 1024;
const ACCEPT = 'image/jpeg,image/png,application/pdf';
const ACCEPT_EXT = '.jpg,.jpeg,.png,.pdf';

interface UploadComprovanteProps {
  valor?: string;
  onChange: (url: string | undefined) => void;
  disabled?: boolean;
  /**
   * Endpoint backend. Default: `/contas-pagar/upload-comprovante` (BH.3.1).
   * AN.3 (M42, 30/05/2026): repasses passam `/repasses/upload-comprovante`
   * pra storage em `/uploads/repasses/...` sem misturar com comprovantes
   * de despesas operacionais.
   */
  endpoint?: string;
}

function isImagem(url: string): boolean {
  return /\.(jpe?g|png)$/i.test(url);
}

function isPdf(url: string): boolean {
  return /\.pdf$/i.test(url);
}

function nomeArquivoDeUrl(url: string): string {
  try {
    const partes = url.split('/');
    return partes[partes.length - 1] ?? url;
  } catch {
    return url;
  }
}

export function UploadComprovante({ valor, onChange, disabled, endpoint }: UploadComprovanteProps) {
  const uploadEndpoint = endpoint ?? '/contas-pagar/upload-comprovante';
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');
  const [arrastando, setArrastando] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function validar(file: File): string | null {
    const ext = file.name.toLowerCase().split('.').pop();
    if (!['jpg', 'jpeg', 'png', 'pdf'].includes(ext ?? '')) {
      return 'Tipo inválido. Aceitos: JPG, PNG, PDF.';
    }
    if (file.size > MAX_BYTES) {
      return `Arquivo grande demais (${(file.size / 1024 / 1024).toFixed(1)} MB). Máximo: 5 MB.`;
    }
    return null;
  }

  async function enviar(file: File) {
    setErro('');
    const erroValidacao = validar(file);
    if (erroValidacao) {
      setErro(erroValidacao);
      return;
    }

    setEnviando(true);
    try {
      const fd = new FormData();
      fd.append('arquivo', file);
      const r = await api.post<{ url: string; tamanho: number; mimetype: string }>(
        uploadEndpoint,
        fd,
      );
      onChange(r.data.url);
    } catch (e: any) {
      const msg = e?.response?.data?.message ?? 'Falha ao enviar.';
      setErro(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setEnviando(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) enviar(f);
  }

  function onDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setArrastando(false);
    if (disabled || enviando) return;
    const f = e.dataTransfer.files?.[0];
    if (f) enviar(f);
  }

  function removerComprovante() {
    onChange(undefined);
    setErro('');
  }

  // ── Preview do arquivo carregado ──
  if (valor) {
    return (
      <div className="space-y-2">
        <div className="border border-green-300 bg-green-50/50 rounded-md p-3 flex items-center gap-3">
          {isImagem(valor) ? (
            <a href={valor} target="_blank" rel="noopener noreferrer" className="shrink-0">
              <img
                src={valor}
                alt="Comprovante"
                className="w-16 h-16 object-cover rounded border border-gray-200"
              />
            </a>
          ) : isPdf(valor) ? (
            <a href={valor} target="_blank" rel="noopener noreferrer" className="shrink-0">
              <div className="w-16 h-16 bg-red-50 border border-red-200 rounded flex items-center justify-center">
                <FileText className="w-7 h-7 text-red-600" />
              </div>
            </a>
          ) : (
            <div className="w-16 h-16 bg-gray-50 border rounded flex items-center justify-center">
              <ImageIcon className="w-7 h-7 text-gray-400" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-green-800 truncate">
              {nomeArquivoDeUrl(valor)}
            </p>
            <a
              href={valor}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-green-700 hover:underline"
            >
              Visualizar →
            </a>
          </div>
          {!disabled && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={removerComprovante}
              className="border-red-300 text-red-700 hover:bg-red-50 shrink-0"
            >
              <X className="w-3 h-3 mr-1" />
              Remover
            </Button>
          )}
        </div>
      </div>
    );
  }

  // ── Dropzone vazio ──
  return (
    <div className="space-y-2">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled && !enviando) setArrastando(true);
        }}
        onDragLeave={() => setArrastando(false)}
        onDrop={onDrop}
        onClick={() => !disabled && !enviando && inputRef.current?.click()}
        className={[
          'border-2 border-dashed rounded-md p-4 text-center transition-colors',
          disabled || enviando ? 'cursor-wait bg-gray-50' : 'cursor-pointer',
          arrastando ? 'border-amber-500 bg-amber-50' : 'border-gray-300 hover:border-amber-400 hover:bg-amber-50/30',
        ].join(' ')}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT_EXT}
          onChange={onFileChange}
          disabled={disabled || enviando}
          className="hidden"
        />
        {enviando ? (
          <div className="flex items-center justify-center gap-2 text-amber-700">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-sm">Enviando...</span>
          </div>
        ) : (
          <>
            <Upload className="w-6 h-6 text-gray-400 mx-auto mb-1" />
            <p className="text-sm text-gray-700">
              <span className="text-amber-700 font-medium">Clique pra escolher</span> ou arraste o arquivo aqui
            </p>
            <p className="text-xs text-gray-500 mt-1">JPG, PNG ou PDF · Máximo 5 MB</p>
          </>
        )}
      </div>

      {erro && (
        <div className="flex items-start gap-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded p-2">
          <AlertCircle className="w-3 h-3 shrink-0 mt-0.5" />
          {erro}
        </div>
      )}
    </div>
  );
}
