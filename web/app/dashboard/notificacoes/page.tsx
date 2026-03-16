'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import type { Notificacao } from '@/types';
import { Bell, FileCheck, FileX, FilePlus, Info, CheckCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';

type Filtro = 'todas' | 'nao-lidas';

const POR_PAGINA = 15;

function tempoAtras(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'agora mesmo';
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h}h`;
  const d = Math.floor(h / 24);
  return `há ${d} dia${d > 1 ? 's' : ''}`;
}

function IconeNotificacao({ tipo }: { tipo: string }) {
  const cls = 'h-5 w-5 shrink-0';
  if (tipo === 'DOCUMENTO_APROVADO') return <FileCheck className={`${cls} text-green-600`} />;
  if (tipo === 'DOCUMENTO_REPROVADO') return <FileX className={`${cls} text-red-600`} />;
  if (tipo === 'DOCUMENTO_ENVIADO') return <FilePlus className={`${cls} text-blue-600`} />;
  return <Info className={`${cls} text-gray-500`} />;
}

export default function NotificacoesPage() {
  const router = useRouter();
  const [notificacoes, setNotificacoes] = useState<Notificacao[]>([]);
  const [filtro, setFiltro] = useState<Filtro>('todas');
  const [pagina, setPagina] = useState(1);
  const [carregando, setCarregando] = useState(true);

  const buscar = useCallback(async () => {
    setCarregando(true);
    try {
      const { data } = await api.get<Notificacao[]>('/notificacoes');
      setNotificacoes(data);
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => { buscar(); }, [buscar]);

  // Resetar paginação ao mudar filtro
  useEffect(() => { setPagina(1); }, [filtro]);

  async function marcarTodasComoLidas() {
    await api.patch('/notificacoes/ler-todas');
    setNotificacoes((prev) => prev.map((n) => ({ ...n, lida: true })));
  }

  async function handleClick(n: Notificacao) {
    if (!n.lida) {
      await api.patch(`/notificacoes/${n.id}/ler`);
      setNotificacoes((prev) =>
        prev.map((item) => (item.id === n.id ? { ...item, lida: true } : item)),
      );
    }
    if (n.link) router.push(n.link);
  }

  const filtradas = filtro === 'nao-lidas' ? notificacoes.filter((n) => !n.lida) : notificacoes;
  const totalPaginas = Math.max(1, Math.ceil(filtradas.length / POR_PAGINA));
  const paginaAtual = Math.min(pagina, totalPaginas);
  const visiveis = filtradas.slice((paginaAtual - 1) * POR_PAGINA, paginaAtual * POR_PAGINA);

  const naoLidasCount = notificacoes.filter((n) => !n.lida).length;

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Bell className="h-6 w-6 text-green-700" />
          <div>
            <h1 className="text-xl font-bold text-gray-900">Notificações</h1>
            {naoLidasCount > 0 && (
              <p className="text-xs text-gray-500">{naoLidasCount} não lida{naoLidasCount > 1 ? 's' : ''}</p>
            )}
          </div>
        </div>
        {naoLidasCount > 0 && (
          <Button variant="outline" size="sm" className="gap-2" onClick={marcarTodasComoLidas}>
            <CheckCheck className="h-4 w-4" />
            Marcar todas como lidas
          </Button>
        )}
      </div>

      {/* Filtros */}
      <div className="flex gap-2 mb-4">
        {(['todas', 'nao-lidas'] as Filtro[]).map((f) => (
          <button
            key={f}
            onClick={() => setFiltro(f)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
              filtro === f
                ? 'bg-green-700 text-white'
                : 'bg-white border text-gray-600 hover:bg-gray-50'
            }`}
          >
            {f === 'todas' ? 'Todas' : 'Não lidas'}
          </button>
        ))}
      </div>

      {/* Lista */}
      <div className="bg-white rounded-lg border divide-y">
        {carregando ? (
          <p className="text-sm text-gray-500 text-center py-10">Carregando...</p>
        ) : visiveis.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-10">
            {filtro === 'nao-lidas' ? 'Nenhuma notificação não lida.' : 'Nenhuma notificação.'}
          </p>
        ) : (
          visiveis.map((n) => (
            <button
              key={n.id}
              onClick={() => handleClick(n)}
              className={`w-full text-left flex gap-4 px-5 py-4 hover:bg-gray-50 transition-colors ${
                !n.lida ? 'bg-green-50' : ''
              }`}
            >
              <div className="pt-0.5">
                <IconeNotificacao tipo={n.tipo} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <p className={`text-sm font-medium ${!n.lida ? 'text-gray-900' : 'text-gray-700'}`}>
                    {n.titulo}
                  </p>
                  <span className="text-xs text-gray-400 whitespace-nowrap shrink-0">
                    {tempoAtras(n.createdAt)}
                  </span>
                </div>
                <p className="text-sm text-gray-500 mt-0.5">{n.mensagem}</p>
                {n.cooperado && (
                  <p className="text-xs text-gray-400 mt-0.5">{n.cooperado.nomeCompleto}</p>
                )}
              </div>
              {!n.lida && (
                <span className="mt-2 h-2 w-2 rounded-full bg-green-500 shrink-0" />
              )}
            </button>
          ))
        )}
      </div>

      {/* Paginação */}
      {totalPaginas > 1 && (
        <div className="flex items-center justify-center gap-2 mt-4">
          <Button
            variant="outline"
            size="sm"
            disabled={paginaAtual <= 1}
            onClick={() => setPagina((p) => p - 1)}
          >
            Anterior
          </Button>
          <span className="text-sm text-gray-600">
            {paginaAtual} / {totalPaginas}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={paginaAtual >= totalPaginas}
            onClick={() => setPagina((p) => p + 1)}
          >
            Próxima
          </Button>
        </div>
      )}
    </div>
  );
}
