import { NextRequest, NextResponse } from 'next/server';

function parseUsuarioCookie(request: NextRequest): { perfil?: string } | null {
  const raw = request.cookies.get('usuario')?.value;
  if (!raw) return null;
  try {
    return JSON.parse(decodeURIComponent(raw));
  } catch {
    return null;
  }
}

export function middleware(request: NextRequest) {
  const token = request.cookies.get('token')?.value;
  const { pathname } = request.nextUrl;

  // --- Seleção de contexto (exige apenas token) ---
  if (pathname === '/selecionar-contexto') {
    if (!token) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
    return NextResponse.next();
  }

  // --- Portal do Cooperado ---
  if (pathname.startsWith('/portal')) {
    if (pathname === '/portal/login') {
      if (token) {
        return NextResponse.redirect(new URL('/selecionar-contexto', request.url));
      }
      return NextResponse.next();
    }

    if (!token) {
      return NextResponse.redirect(new URL('/portal/login', request.url));
    }
    return NextResponse.next();
  }

  // --- Área do Estabelecimento do Clube (Sprint Higiene Bloco B —
  //     14/06/2026, D2). Guard de ehEstabelecimento fica no layout
  //     pra mostrar empty-state em vez de 401. Aqui só protege token. ---
  if (pathname.startsWith('/estabelecimento')) {
    if (!token) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
    return NextResponse.next();
  }

  // NOTA: /parceiro/* foi DESCONTINUADO na Sprint Higiene 14/06 (Decisão D1).
  // Não há mais arquivos em /web/app/parceiro/. Acessos a /parceiro/<slug>
  // são capturados pelos 33 redirects 301 `permanent:true` em next.config.ts
  // e levados pra /dashboard/<slug> (ou /estabelecimento/* nos 3 casos).
  // Middleware não precisa mais do ramo /parceiro.

  // --- Área do Proprietário ---
  if (pathname.startsWith('/proprietario')) {
    if (!token) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
    return NextResponse.next();
  }

  // --- Dashboard admin ---
  if (pathname.startsWith('/dashboard') && !token) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  if (pathname === '/login' && token) {
    return NextResponse.redirect(new URL('/selecionar-contexto', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/login',
    '/portal/:path*',
    '/estabelecimento/:path*',
    '/proprietario/:path*',
    '/selecionar-contexto',
    // /parceiro/* removido — Sprint Higiene 14/06 D1. Redirects 301 no
    // next.config.ts cobrem deep-links legados.
  ],
};
