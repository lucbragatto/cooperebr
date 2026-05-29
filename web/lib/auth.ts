import Cookies from 'js-cookie';
import api from './api';
import type { AuthResponse, Usuario } from '@/types';

const TOKEN_KEY = 'token';
const USUARIO_KEY = 'usuario';
const COOKIE_OPTS = { expires: 7, sameSite: 'lax' as const };

export async function login(identificador: string, senha: string): Promise<void> {
  const { data } = await api.post<AuthResponse>('/auth/login', { identificador, senha });
  Cookies.set(TOKEN_KEY, data.token, COOKIE_OPTS);
  Cookies.set(USUARIO_KEY, JSON.stringify(data.usuario), COOKIE_OPTS);
}

/**
 * D-novo-BM (29/05/2026) — Aplica sessão de um token + usuario recebidos do
 * endpoint `/auth/dev/impersonate`. NÃO chamar em código de produção.
 * O endpoint backend é gated por `isAmbienteReal()` + role SUPER_ADMIN.
 */
export function aplicarSessaoImpersonate(token: string, usuario: Usuario): void {
  Cookies.set(TOKEN_KEY, token, COOKIE_OPTS);
  Cookies.set(USUARIO_KEY, JSON.stringify(usuario), COOKIE_OPTS);
  localStorage.removeItem('contexto_ativo');
}

export function logout(): void {
  Cookies.remove(TOKEN_KEY);
  Cookies.remove(USUARIO_KEY);
  localStorage.removeItem('contexto_ativo');
  window.location.href = '/login';
}

export function logoutPortal(): void {
  Cookies.remove(TOKEN_KEY);
  Cookies.remove(USUARIO_KEY);
  localStorage.removeItem('contexto_ativo');
  window.location.href = '/portal/login';
}

export function getUsuario(): Usuario | null {
  const raw = Cookies.get(USUARIO_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Usuario;
  } catch {
    return null;
  }
}

export function isAutenticado(): boolean {
  return !!Cookies.get(TOKEN_KEY);
}
