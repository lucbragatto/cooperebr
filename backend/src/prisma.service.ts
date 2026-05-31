import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { tenantLeakExtension } from './common/tenant-leak-detector';

/**
 * D-novo-BR F1.3 (31/05/2026) — PrismaService com Client Extension log-only.
 *
 * Aplica `tenantLeakExtension` (camada 3 de defesa em profundidade) que LOGA
 * warns quando uma query a model tenant-scoped roda sem filtro de cooperativaId
 * em contexto HTTP autenticado (ALS populado via main.ts middleware +
 * JwtStrategy). NUNCA bloqueia, NUNCA injeta.
 *
 * Por que via `Object.assign(this, this.$extends(...))`:
 * - PrismaService é declarado localmente em ~60 módulos (não @Global), então
 *   cada instância precisa aplicar a extensão própria.
 * - `$extends` retorna um cliente NOVO imutável — Object.assign mescla os
 *   delegates estendidos sobre `this`. Funciona em runtime; tipos preservados
 *   porque a extensão só HOOKa (não muda assinaturas).
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  constructor() {
    super();
    const extended = this.$extends(tenantLeakExtension);
    Object.assign(this, extended);
  }

  async onModuleInit() {
    await this.$connect();
  }
}
