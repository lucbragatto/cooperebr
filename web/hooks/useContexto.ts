'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ContextoUsuario, MeResponse, TipoContexto } from '@/types';
import api from '@/lib/api';
import Cookies from 'js-cookie';

const CONTEXTO_KEY = 'contexto_ativo';

export function getContextoAtivo(): TipoContexto | null {
  if (typeof window === 'undefined') return null;
  return (localStorage.getItem(CONTEXTO_KEY) as TipoContexto) ?? null;
}

export function setContextoAtivo(tipo: TipoContexto): void {
  localStorage.setItem(CONTEXTO_KEY, tipo);
}

export function limparContexto(): void {
  localStorage.removeItem(CONTEXTO_KEY);
}

export function useContexto() {
  const [meData, setMeData] = useState<MeResponse | null>(null);
  const [contextoAtivo, _setContextoAtivo] = useState<TipoContexto | null>(null);
  const [carregando, setCarregando] = useState(true);

  const carregar = useCallback(async () => {
    try {
      const { data } = await api.get<MeResponse>('/auth/me');
      setMeData(data);

      // Restaurar contexto salvo ou auto-selecionar
      const salvo = getContextoAtivo();
      const tipos = data.contextos.map((c) => c.tipo);

      if (salvo && tipos.includes(salvo)) {
        _setContextoAtivo(salvo);
      } else if (tipos.length === 1) {
        _setContextoAtivo(tipos[0]);
        setContextoAtivo(tipos[0]);
      }
      // Se > 1 e nenhum salvo, fica null (mostra tela de seleção)
    } catch {
      // Token inválido — api interceptor redireciona
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const trocarContexto = useCallback(
    (tipo: TipoContexto) => {
      setContextoAtivo(tipo);
      _setContextoAtivo(tipo);
    },
    [],
  );

  const contextos = useMemo(() => meData?.contextos ?? [], [meData]);

  const contextoObj = useMemo<ContextoUsuario | null>(
    () => contextos.find((c) => c.tipo === contextoAtivo) ?? null,
    [contextos, contextoAtivo],
  );

  return {
    meData,
    contextos,
    contextoAtivo,
    contextoObj,
    trocarContexto,
    carregando,
    recarregar: carregar,
  };
}

/** Retorna a rota home para cada tipo de contexto */
export function rotaPorContexto(tipo: TipoContexto): string {
  switch (tipo) {
    case 'super_admin':
      return '/dashboard';
    case 'admin_parceiro':
      return '/parceiro';
    case 'cooperado':
      return '/portal';
    case 'proprietario_usina':
      return '/proprietario';
    case 'admin_agregador':
      return '/agregador';
  }
}
