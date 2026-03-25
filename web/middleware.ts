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

  // --- Área do Parceiro/Admin ---
  if (pathname.startsWith('/parceiro')) {
    if (!token) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
    return NextResponse.next();
  }

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
    '/parceiro/:path*',
    '/proprietario/:path*',
    '/selecionar-contexto',
  ],
};
