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

export function logout(): void {
  Cookies.remove(TOKEN_KEY);
  Cookies.remove(USUARIO_KEY);
  window.location.href = '/login';
}

export function logoutPortal(): void {
  Cookies.remove(TOKEN_KEY);
  Cookies.remove(USUARIO_KEY);
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
