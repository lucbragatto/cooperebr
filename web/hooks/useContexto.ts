'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ContextoUsuario, MeResponse, TipoContexto } from '@/types';
import api from '@/lib/api';
import Cookies from 'js-cookie';

const CONTEXTO_KEY = 'contexto_ativo';
// Revisao multi-tenant 09/06/2026 — quando ha mais de 1 cadastro 'cooperado'
// do mesmo dono (PF + PJ), `tipo` sozinho nao identifica o cadastro escolhido.
// Persistimos tambem o id (cooperadoId quando tipo='cooperado').
const CONTEXTO_ID_KEY = 'contexto_ativo_id';

export function getContextoAtivo(): TipoContexto | null {
  if (typeof window === 'undefined') return null;
  return (localStorage.getItem(CONTEXTO_KEY) as TipoContexto) ?? null;
}

export function getContextoAtivoId(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(CONTEXTO_ID_KEY);
}

export function setContextoAtivo(tipo: TipoContexto, id?: string): void {
  localStorage.setItem(CONTEXTO_KEY, tipo);
  if (id) {
    localStorage.setItem(CONTEXTO_ID_KEY, id);
  } else {
    localStorage.removeItem(CONTEXTO_ID_KEY);
  }
}

export function limparContexto(): void {
  localStorage.removeItem(CONTEXTO_KEY);
  localStorage.removeItem(CONTEXTO_ID_KEY);
}

export function useContexto() {
  const [meData, setMeData] = useState<MeResponse | null>(null);
  const [contextoAtivo, _setContextoAtivo] = useState<TipoContexto | null>(null);
  const [contextoAtivoId, _setContextoAtivoId] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);

  const carregar = useCallback(async () => {
    try {
      const { data } = await api.get<MeResponse>('/auth/me');
      setMeData(data);

      // Restaurar contexto salvo ou auto-selecionar
      const salvo = getContextoAtivo();
      const salvoId = getContextoAtivoId();
      const tipos = data.contextos.map((c) => c.tipo);

      if (salvo && tipos.includes(salvo)) {
        _setContextoAtivo(salvo);
        _setContextoAtivoId(salvoId);
      } else if (tipos.length === 1) {
        const unico = data.contextos[0];
        _setContextoAtivo(unico.tipo);
        _setContextoAtivoId(unico.id ?? null);
        setContextoAtivo(unico.tipo, unico.id);
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
    (tipo: TipoContexto, id?: string) => {
      setContextoAtivo(tipo, id);
      _setContextoAtivo(tipo);
      _setContextoAtivoId(id ?? null);
    },
    [],
  );

  const contextos = useMemo(() => meData?.contextos ?? [], [meData]);

  // Revisao 09/06/2026 — pra contexto 'cooperado' com multiplos cadastros do
  // mesmo dono, distinguir pelo id persistido. Caso contrario find por tipo
  // pode resolver pro cooperado errado.
  const contextoObj = useMemo<ContextoUsuario | null>(
    () => {
      if (!contextoAtivo) return null;
      if (contextoAtivo === 'cooperado' && contextoAtivoId) {
        const match = contextos.find((c) => c.tipo === 'cooperado' && c.id === contextoAtivoId);
        if (match) return match;
      }
      return contextos.find((c) => c.tipo === contextoAtivo) ?? null;
    },
    [contextos, contextoAtivo, contextoAtivoId],
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

/** Retorna a rota home para cada tipo de contexto.
 *
 * Sprint Higiene de Rotas (14/06/2026) — Decisão Luciano D1: convergir
 * /parceiro → /dashboard. SUPER_ADMIN e ADMIN-do-parceiro agora usam
 * a mesma área `/dashboard`. /dashboard/layout.tsx diferencia visual
 * (título "Painel Administrativo — {nomeCooperativa}" pra admin_parceiro;
 * seção "Gestão Global" só pra SUPER_ADMIN).
 */
export function rotaPorContexto(tipo: TipoContexto): string {
  switch (tipo) {
    case 'super_admin':
      return '/dashboard';
    case 'admin_parceiro':
      return '/dashboard';
    case 'cooperado':
      return '/portal';
    case 'proprietario_usina':
      return '/proprietario';
    case 'admin_agregador':
      return '/agregador';
    case 'empresa_conveniada':
      // Sprint Portal Empresa 9.0 (04/06/2026)
      return '/conveniada';
  }
}
