export enum PerfilUsuario {
  SUPER_ADMIN = 'SUPER_ADMIN',
  ADMIN = 'ADMIN',
  OPERADOR = 'OPERADOR',
  COOPERADO = 'COOPERADO',
  AGREGADOR = 'AGREGADOR',
  PROPRIETARIO = 'PROPRIETARIO', // Sub-Sprint F (M30, 2026-05-26) — dono de usina (E-Solares)
  /**
   * @deprecated Fatia F-G1 — Opção A (05/06/2026).
   *
   * Criado na Sprint Portal Empresa 9.0 (04/06) como perfil de auth pro
   * responsável de empresa pagadora de convênio. Aposentado em 05/06 com
   * a decisão COOPERADO-ONLY (04/06): empresa cooperada PJ tem perfil
   * COOPERADO; "empresa_conveniada" é apenas contexto derivado em
   * obterContextosUsuario (match `Cooperado.id === conv.pagadorCooperadoId`).
   * O enum value continua aqui pra compat com Usuarios legados — Pagador
   * CooperadoOnly guard aceita ambos (COOPERADO + EMPRESA_CONVENIADA).
   * Novos seeds/cadastros DEVEM usar COOPERADO. Não remover sem audit
   * destrutivo (CLAUDE.md migration rules).
   */
  EMPRESA_CONVENIADA = 'EMPRESA_CONVENIADA',
}
