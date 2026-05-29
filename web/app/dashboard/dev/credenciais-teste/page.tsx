'use client';

/**
 * D-novo-BM (29/05/2026) — Painel de credenciais de teste (Opção B login rápido).
 *
 * 🚨 BLOQUEADOR REMOÇÃO PRÉ-PRODUÇÃO 🚨
 *
 * Esta tela é gated em DUAS camadas:
 *   1. Backend: `/auth/dev/usuarios-teste` retorna 403 quando `AMBIENTE_REAL=true`
 *   2. Frontend: detecta o 403 e mostra alerta "Desabilitada em produção"
 *
 * Remoção quando primeiro parceiro real entrar em produção:
 *   - setar AMBIENTE_REAL=true no .env (já bloqueia)
 *   - DELETAR este arquivo
 *   - DELETAR backend/src/auth/auth-dev.controller.ts
 *   - Remover item sidebar "Credenciais teste"
 */

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  Building2,
  Crown,
  Loader2,
  LogIn,
  Sun,
  User,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import api from '@/lib/api';
import { aplicarSessaoImpersonate } from '@/lib/auth';
import type { Usuario } from '@/types';

interface UsuarioTeste {
  id: string;
  nome: string;
  email: string;
  perfil: string;
  cooperativaId: string | null;
  cooperativa: { id: string; nome: string } | null;
}

interface ImpersonateResponse {
  token: string;
  usuario: Usuario;
  expiresIn: string;
  impersonadoPor: string | null;
}

const PERFIL_BADGE: Record<string, string> = {
  SUPER_ADMIN: 'bg-purple-100 text-purple-800 border-purple-300',
  ADMIN: 'bg-blue-100 text-blue-800 border-blue-300',
  OPERADOR: 'bg-cyan-100 text-cyan-800 border-cyan-300',
  COOPERADO: 'bg-green-100 text-green-800 border-green-300',
  PROPRIETARIO: 'bg-amber-100 text-amber-800 border-amber-300',
  AGREGADOR: 'bg-pink-100 text-pink-800 border-pink-300',
};

function PerfilIcon({ perfil }: { perfil: string }) {
  if (perfil === 'SUPER_ADMIN') return <Crown className="h-4 w-4" />;
  if (perfil === 'PROPRIETARIO') return <Sun className="h-4 w-4" />;
  return <User className="h-4 w-4" />;
}

export default function CredenciaisTestePage() {
  const router = useRouter();
  const [usuarios, setUsuarios] = useState<UsuarioTeste[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [ambienteReal, setAmbienteReal] = useState(false);
  const [erro, setErro] = useState('');
  const [logandoUserId, setLogandoUserId] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<UsuarioTeste[]>('/auth/dev/usuarios-teste')
      .then((r) => setUsuarios(r.data))
      .catch((err) => {
        if (err?.response?.status === 403) {
          setAmbienteReal(true);
        } else {
          setErro(
            err?.response?.data?.message ?? 'Erro ao carregar usuários de teste.',
          );
        }
      })
      .finally(() => setCarregando(false));
  }, []);

  const grupos = useMemo(() => {
    const superAdmins = usuarios.filter((u) => u.perfil === 'SUPER_ADMIN');
    const porCooperativa = new Map<string, { coopId: string; nome: string; usuarios: UsuarioTeste[] }>();
    const semCoop: UsuarioTeste[] = [];

    for (const u of usuarios) {
      if (u.perfil === 'SUPER_ADMIN') continue;
      if (u.cooperativa) {
        const key = u.cooperativa.id;
        if (!porCooperativa.has(key)) {
          porCooperativa.set(key, {
            coopId: u.cooperativa.id,
            nome: u.cooperativa.nome,
            usuarios: [],
          });
        }
        porCooperativa.get(key)!.usuarios.push(u);
      } else {
        semCoop.push(u);
      }
    }

    return {
      superAdmins,
      porCooperativa: Array.from(porCooperativa.values()).sort((a, b) =>
        a.nome.localeCompare(b.nome),
      ),
      semCoop,
    };
  }, [usuarios]);

  async function impersonar(userId: string, destino: string) {
    setLogandoUserId(userId);
    try {
      const r = await api.post<ImpersonateResponse>('/auth/dev/impersonate', { userId });
      aplicarSessaoImpersonate(r.data.token, r.data.usuario);
      router.push(destino);
      // pequeno delay pra dar tempo do router começar a navegar antes do reload
      setTimeout(() => window.location.reload(), 100);
    } catch (e: any) {
      setErro(e?.response?.data?.message ?? 'Erro ao logar como esse usuário.');
      setLogandoUserId(null);
    }
  }

  function destinoPorPerfil(perfil: string): string {
    if (perfil === 'COOPERADO') return '/portal';
    if (perfil === 'PROPRIETARIO') return '/proprietario';
    return '/dashboard';
  }

  if (carregando) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-amber-600 animate-spin" />
      </div>
    );
  }

  if (ambienteReal) {
    return (
      <div className="max-w-2xl mx-auto py-12">
        <div className="bg-red-50 border-2 border-red-300 rounded-lg p-6 flex gap-3 items-start">
          <AlertTriangle className="w-6 h-6 text-red-600 shrink-0 mt-0.5" />
          <div>
            <h2 className="text-lg font-bold text-red-900">
              Esta tela está desabilitada em produção.
            </h2>
            <p className="text-sm text-red-800 mt-2">
              O painel de credenciais teste é uma ferramenta dev-only catalogada como{' '}
              <strong>D-novo-BM bloqueador remoção pré-prod</strong>. O backend confirmou
              <code className="mx-1 px-1 bg-red-100 rounded">AMBIENTE_REAL=true</code>
              e bloqueou o endpoint.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* BANNER VERMELHO GIGANTE */}
      <div className="bg-red-600 text-white p-6 rounded-lg border-4 border-red-800 shadow-lg">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-8 h-8 shrink-0 mt-1" />
          <div>
            <h1 className="text-3xl font-bold">⚠️ DEV ONLY — REMOVER ANTES DE PRODUÇÃO ⚠️</h1>
            <p className="text-base mt-2 text-red-50">
              Esta tela permite logar como qualquer usuário <strong>sem digitar senha</strong>.{' '}
              <strong>NUNCA</strong> pode estar disponível em produção. Catalogado como{' '}
              <strong className="underline">D-novo-BM bloqueador remoção pré-prod</strong> em
              <code className="mx-1 px-1 bg-red-800 rounded text-sm">docs/debitos-tecnicos.md</code>.
              Senhas reais NUNCA são expostas — o backend gera um JWT temporário (TTL 1h) via
              endpoint <code className="mx-1 px-1 bg-red-800 rounded text-sm">/auth/dev/impersonate</code>
              gated por <code className="mx-1 px-1 bg-red-800 rounded text-sm">AMBIENTE_REAL=false</code>.
            </p>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Credenciais de teste — login rápido</h2>
          <p className="text-sm text-gray-500 mt-1">
            {usuarios.length} usuário(s) ativo(s). Clique em "Logar como X" pra trocar de papel
            sem precisar fazer logout/login.
          </p>
        </div>
      </div>

      {erro && (
        <div className="bg-red-50 border border-red-200 rounded-md p-3 text-sm text-red-800">
          {erro}
        </div>
      )}

      {/* Super Admins */}
      {grupos.superAdmins.length > 0 && (
        <SecaoGrupo
          titulo="🔱 Super Admins SISGD"
          subtitulo="Acesso global cross-tenant"
          usuarios={grupos.superAdmins}
          logandoUserId={logandoUserId}
          onLogar={(id, perfil) => impersonar(id, destinoPorPerfil(perfil))}
        />
      )}

      {/* Por cooperativa */}
      {grupos.porCooperativa.map((g) => (
        <SecaoGrupo
          key={g.coopId}
          titulo={`🏢 ${g.nome}`}
          subtitulo={`${g.usuarios.length} usuário(s)`}
          usuarios={g.usuarios}
          logandoUserId={logandoUserId}
          onLogar={(id, perfil) => impersonar(id, destinoPorPerfil(perfil))}
        />
      ))}

      {/* Sem cooperativa (PROPRIETARIO sem coop, etc) */}
      {grupos.semCoop.length > 0 && (
        <SecaoGrupo
          titulo="👤 Outros usuários (sem cooperativa vinculada)"
          subtitulo=""
          usuarios={grupos.semCoop}
          logandoUserId={logandoUserId}
          onLogar={(id, perfil) => impersonar(id, destinoPorPerfil(perfil))}
        />
      )}
    </div>
  );
}

function SecaoGrupo({
  titulo,
  subtitulo,
  usuarios,
  logandoUserId,
  onLogar,
}: {
  titulo: string;
  subtitulo: string;
  usuarios: UsuarioTeste[];
  logandoUserId: string | null;
  onLogar: (id: string, perfil: string) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-baseline gap-2 border-b border-gray-200 pb-2">
        <h3 className="text-lg font-semibold text-gray-900">{titulo}</h3>
        {subtitulo && <span className="text-xs text-gray-500">— {subtitulo}</span>}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {usuarios.map((u) => {
          const logando = logandoUserId === u.id;
          return (
            <Card key={u.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-sm flex items-center gap-1.5">
                    <PerfilIcon perfil={u.perfil} />
                    {u.nome}
                  </CardTitle>
                  <Badge className={PERFIL_BADGE[u.perfil] ?? 'bg-gray-100 text-gray-700'}>
                    {u.perfil}
                  </Badge>
                </div>
                <p className="text-xs text-gray-500 mt-1 truncate">{u.email}</p>
              </CardHeader>
              <CardContent className="pt-0">
                <Button
                  onClick={() => onLogar(u.id, u.perfil)}
                  disabled={logando || logandoUserId !== null}
                  className="w-full"
                  size="sm"
                >
                  {logando ? (
                    <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                  ) : (
                    <LogIn className="w-3.5 h-3.5 mr-1.5" />
                  )}
                  Logar como {u.nome.split(' ')[0]}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
