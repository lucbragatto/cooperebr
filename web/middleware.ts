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

  // --- Portal do Cooperado ---
  if (pathname.startsWith('/portal')) {
    // Login page do portal: se já autenticado como COOPERADO, redireciona para /portal
    if (pathname === '/portal/login') {
      if (token) {
        const usuario = parseUsuarioCookie(request);
        if (usuario?.perfil === 'COOPERADO') {
          return NextResponse.redirect(new URL('/portal', request.url));
        }
      }
      return NextResponse.next();
    }

    // Rotas protegidas do portal
    if (!token) {
      return NextResponse.redirect(new URL('/portal/login', request.url));
    }

    const usuario = parseUsuarioCookie(request);
    // Admins/operadores não acessam o portal — redirecionar para /dashboard
    if (usuario?.perfil && usuario.perfil !== 'COOPERADO') {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }

    return NextResponse.next();
  }

  // --- Dashboard admin ---
  if (pathname.startsWith('/dashboard') && !token) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  if (pathname === '/login' && token) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*', '/login', '/portal/:path*'],
};
