import { SetMetadata } from '@nestjs/common';

/**
 * D-novo-BR F1.1 (31/05/2026) — Decorator declarativo de posse de tenant.
 *
 * Opt-in: rota sem @TenantResource é ignorada pelo Guard (não-quebrante
 * pros ~38 endpoints já protegidos via fix manual D-48/Fase2/BQ/BR-F0
 * que mantêm defesa em profundidade).
 *
 * Exemplos:
 *   @TenantResource({ model: 'cobrancaBancaria' })                                   // posse direta
 *   @TenantResource({ model: 'documentoCooperado', via: 'cooperado.cooperativaId' }) // via relação
 *   @TenantResource({ model: 'modeloMensagem', globalOnlySuperAdmin: true })         // global=SA
 */
export const TENANT_RESOURCE_KEY = 'tenant_resource';

export interface TenantResourceOpts {
  /** Nome do model Prisma (camelCase). Ex: 'contrato', 'usina', 'documentoCooperado'. */
  model: string;
  /** Nome do @Param que contém o id do recurso. Default: 'id'. */
  idParam?: string;
  /**
   * Caminho da relação até cooperativaId quando o model não tem coluna direta.
   * Ex: 'cooperado.cooperativaId' resulta em `where: { cooperado: { cooperativaId } }`.
   * Quando omitido, assume `where: { cooperativaId }` direto no model.
   */
  via?: string;
  /**
   * Se `true` e o recurso encontrado tem `cooperativaId=null` (global compartilhado
   * entre tenants), bloqueia ADMIN com ForbiddenException. Somente SUPER_ADMIN
   * pode alterar globais. Ex: ModeloMensagem com null = template plataforma.
   */
  globalOnlySuperAdmin?: boolean;
}

export const TenantResource = (opts: TenantResourceOpts) =>
  SetMetadata(TENANT_RESOURCE_KEY, opts);

/**
 * Opt-out explícito — sinaliza que a rota não tem recurso por id ou
 * intencionalmente não exige posse (ex: rotas dev, health, agregações
 * cross-tenant legítimas). Ajuda o lint da F1.4 a não acusar.
 */
export const TENANT_EXEMPT_KEY = 'tenant_exempt';
export const TenantExempt = () => SetMetadata(TENANT_EXEMPT_KEY, true);
