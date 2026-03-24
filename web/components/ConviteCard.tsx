'use client';

import { useEffect, useState } from 'react';
import { Copy, MessageCircle, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import api from '@/lib/api';

interface ConviteCardProps {
  /** Se fornecido, usa esses dados em vez de buscar /indicacoes/meu-link */
  linkOverride?: string;
}

export default function ConviteCard({ linkOverride }: ConviteCardProps) {
  const [link, setLink] = useState(linkOverride ?? '');
  const [totalIndicados, setTotalIndicados] = useState(0);
  const [indicadosAtivos, setIndicadosAtivos] = useState(0);
  const [copiou, setCopiou] = useState<'link' | 'msg' | null>(null);

  useEffect(() => {
    if (linkOverride) return;
    api
      .get<{ codigoIndicacao: string; link: string; totalIndicados: number; indicadosAtivos: number }>(
        '/indicacoes/meu-link',
      )
      .then(({ data }) => {
        setLink(data.link);
        setTotalIndicados(data.totalIndicados);
        setIndicadosAtivos(data.indicadosAtivos);
      })
      .catch(() => {});
  }, [linkOverride]);

  const mensagemTexto =
    'Olá! Estou na CoopereBR e economizando na minha conta de luz com energia solar. ' +
    'Sem investimento, 100% digital! Você também pode participar 👉 ' +
    link;

  function copiar(tipo: 'link' | 'msg') {
    const texto = tipo === 'link' ? link : mensagemTexto;
    navigator.clipboard.writeText(texto);
    setCopiou(tipo);
    setTimeout(() => setCopiou(null), 2000);
  }

  function compartilharWhatsApp() {
    window.open(`https://wa.me/?text=${encodeURIComponent(mensagemTexto)}`, '_blank');
  }

  if (!link) return null;

  return (
    <div className="bg-white rounded-xl border shadow-sm p-6 space-y-4 max-w-lg w-full">
      <h3 className="font-semibold text-gray-800">Seu link de convite</h3>

      {/* Link com botão copiar */}
      <div className="flex items-center gap-2 bg-gray-50 rounded-lg p-3 border">
        <span className="flex-1 text-sm text-green-700 font-medium truncate">{link}</span>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => copiar('link')}
          className="shrink-0 gap-1 text-gray-500 hover:text-green-700"
        >
          {copiou === 'link' ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
          {copiou === 'link' ? 'Copiado!' : 'Copiar'}
        </Button>
      </div>

      {/* Mensagem pré-pronta */}
      <div className="bg-green-50 rounded-lg p-3 border border-green-200">
        <p className="text-sm text-gray-700 leading-relaxed">{mensagemTexto}</p>
      </div>

      {/* Ações */}
      <div className="flex gap-2">
        <Button
          onClick={compartilharWhatsApp}
          className="flex-1 bg-green-600 hover:bg-green-700 text-white gap-2"
        >
          <MessageCircle className="h-4 w-4" />
          Compartilhar pelo WhatsApp
        </Button>
        <Button
          variant="outline"
          onClick={() => copiar('msg')}
          className="gap-1 text-gray-600 border-gray-300"
        >
          {copiou === 'msg' ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
          {copiou === 'msg' ? 'Copiado!' : 'Copiar mensagem'}
        </Button>
      </div>

      {/* Contadores — só mostra se buscou do backend */}
      {!linkOverride && (
        <div className="flex gap-4 pt-2 border-t text-center">
          <div className="flex-1">
            <p className="text-2xl font-bold text-gray-800">{totalIndicados}</p>
            <p className="text-xs text-gray-500">Indicados</p>
          </div>
          <div className="flex-1">
            <p className="text-2xl font-bold text-green-600">{indicadosAtivos}</p>
            <p className="text-xs text-gray-500">Ativos</p>
          </div>
        </div>
      )}
    </div>
  );
}
