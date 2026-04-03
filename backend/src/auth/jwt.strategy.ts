import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../prisma.service';
import { getJwtSecret } from './jwt-secret';

interface CacheEntry {
  user: any;
  exp: number;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  // Cache em memória por 60 segundos — evita ir ao banco em cada request
  // Fix para P2024: connection pool esgotado por findUnique em toda request autenticada
  private readonly cache = new Map<string, CacheEntry>();
  private readonly CACHE_TTL_MS = 60_000; // 60 segundos

  constructor(private prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: getJwtSecret(),
    });
  }

  async validate(payload: { sub: string; email: string; cooperadoId?: string; cooperativaId?: string; administradoraId?: string }) {
    const now = Date.now();

    // Verificar cache primeiro
    const cached = this.cache.get(payload.sub);
    if (cached && cached.exp > now) {
      return cached.user;
    }

    // Cache miss — buscar no banco
    const usuario = await this.prisma.usuario.findUnique({
      where: { id: payload.sub },
    });
    if (!usuario) return null;

    const user = {
      ...usuario,
      cooperadoId: payload.cooperadoId ?? undefined,
      cooperativaId: payload.cooperativaId ?? usuario.cooperativaId,
      administradoraId: payload.administradoraId ?? (usuario as any).administradoraId,
    };

    // Salvar no cache
    this.cache.set(payload.sub, { user, exp: now + this.CACHE_TTL_MS });

    // Limpar entradas expiradas a cada 100 novos caches (evitar memory leak)
    if (this.cache.size % 100 === 0) {
      for (const [key, entry] of this.cache.entries()) {
        if (entry.exp <= now) this.cache.delete(key);
      }
    }

    return user;
  }
}
