'use client';

import { ReactNode } from 'react';
import { Smile, Mic } from 'lucide-react';

interface PhoneFrameProps {
  children?: ReactNode;
  nomeContato?: string;
  subtitulo?: string;
}

export function PhoneFrame({
  children,
  nomeContato = 'Assis',
  subtitulo,
}: PhoneFrameProps) {
  const inicial = (nomeContato.trim().charAt(0) || 'A').toUpperCase();

  return (
    <div className="bg-gray-900 rounded-[2.5rem] p-3 shadow-2xl w-[280px] h-[560px]">
      {/* Notch / câmera */}
      <div className="flex justify-center mb-2">
        <div className="bg-gray-800 rounded-full w-16 h-5" />
      </div>

      {/* Tela interna */}
      <div className="bg-[#ECE5DD] rounded-[2rem] overflow-hidden flex flex-col h-[calc(100%-1.75rem)]">
        {/* Header WhatsApp */}
        <div className="bg-[#075E54] text-white px-3 py-2 flex items-center gap-2">
          <div className="bg-green-300 text-green-900 rounded-full w-8 h-8 flex items-center justify-center font-bold text-sm">
            {inicial}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium truncate">{nomeContato}</div>
            {subtitulo && (
              <div className="text-xs opacity-75 truncate">{subtitulo}</div>
            )}
          </div>
        </div>

        {/* Área de mensagens */}
        <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2">
          {children}
        </div>

        {/* Barra inferior decorativa (não funcional) */}
        <div className="bg-white px-2 py-1 flex items-center gap-1 text-gray-400 text-xs border-t border-gray-200">
          <Smile className="w-4 h-4" />
          <span className="flex-1 truncate">Mensagem</span>
          <Mic className="w-4 h-4" />
        </div>
      </div>
    </div>
  );
}
