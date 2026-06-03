import { derivarStatusConvite } from './convites-convenio.service';

/**
 * Sprint Convite-Convênio Fatia 5 (03/06/2026) — Specs do status derivado.
 *
 * 9 estados possíveis cobertos. Tabela de decisão em ordem de prioridade
 * (ver doc na função). Garante que admin e empresa veem a MESMA string
 * coerente — o derivar é puro (sem prisma), determinístico.
 */
describe('derivarStatusConvite — Fatia 5', () => {
  const AGORA = new Date('2026-06-10T12:00:00Z');
  const ANTES = new Date('2026-06-01T12:00:00Z');
  const DEPOIS = new Date('2026-06-20T12:00:00Z');

  it('LINK_EXPIRADO — convite vivo expirou sem uso', () => {
    expect(
      derivarStatusConvite(
        {
          usedAt: null,
          expiresAt: ANTES,
          otpValidadoEm: null,
          membro: null,
        },
        AGORA,
      ),
    ).toBe('LINK_EXPIRADO');
  });

  it('LINK_EXPIRADO — mesmo se OTP foi validado, link expirou sem cadastro', () => {
    expect(
      derivarStatusConvite(
        {
          usedAt: null,
          expiresAt: ANTES,
          otpValidadoEm: ANTES,
          membro: null,
        },
        AGORA,
      ),
    ).toBe('LINK_EXPIRADO');
  });

  it('AGUARDANDO_OTP — convite vivo nunca solicitou OTP', () => {
    expect(
      derivarStatusConvite(
        {
          usedAt: null,
          expiresAt: DEPOIS,
          otpValidadoEm: null,
          membro: null,
        },
        AGORA,
      ),
    ).toBe('AGUARDANDO_OTP');
  });

  it('AGUARDANDO_CADASTRO — OTP validado mas convite ainda não usado', () => {
    expect(
      derivarStatusConvite(
        {
          usedAt: null,
          expiresAt: DEPOIS,
          otpValidadoEm: ANTES,
          membro: null,
        },
        AGORA,
      ),
    ).toBe('AGUARDANDO_CADASTRO');
  });

  it('PENDENTE_APROVACAO_EMPRESA — cadastrou, espera empresa', () => {
    expect(
      derivarStatusConvite(
        {
          usedAt: ANTES,
          expiresAt: DEPOIS,
          otpValidadoEm: ANTES,
          membro: { status: 'PENDENTE_APROVACAO_EMPRESA', documentacaoSolicitadaEm: null },
        },
        AGORA,
      ),
    ).toBe('PENDENTE_APROVACAO_EMPRESA');
  });

  it('PENDENTE_APROVACAO_ADMIN — empresa aprovou, espera admin', () => {
    expect(
      derivarStatusConvite(
        {
          usedAt: ANTES,
          expiresAt: DEPOIS,
          otpValidadoEm: ANTES,
          membro: { status: 'PENDENTE_APROVACAO_ADMIN', documentacaoSolicitadaEm: null },
        },
        AGORA,
      ),
    ).toBe('PENDENTE_APROVACAO_ADMIN');
  });

  it('AGUARDANDO_DOCS — admin solicitou documentação (sub-estado PENDENTE_ADMIN)', () => {
    expect(
      derivarStatusConvite(
        {
          usedAt: ANTES,
          expiresAt: DEPOIS,
          otpValidadoEm: ANTES,
          membro: {
            status: 'PENDENTE_APROVACAO_ADMIN',
            documentacaoSolicitadaEm: ANTES,
          },
        },
        AGORA,
      ),
    ).toBe('AGUARDANDO_DOCS');
  });

  it('ATIVO — admin aprovou, entra na consolidada', () => {
    expect(
      derivarStatusConvite(
        {
          usedAt: ANTES,
          expiresAt: DEPOIS,
          otpValidadoEm: ANTES,
          membro: { status: 'MEMBRO_ATIVO', documentacaoSolicitadaEm: null },
        },
        AGORA,
      ),
    ).toBe('ATIVO');
  });

  it('REJEITADO_EMPRESA — empresa recusou', () => {
    expect(
      derivarStatusConvite(
        {
          usedAt: ANTES,
          expiresAt: DEPOIS,
          otpValidadoEm: ANTES,
          membro: { status: 'MEMBRO_REJEITADO_EMPRESA', documentacaoSolicitadaEm: null },
        },
        AGORA,
      ),
    ).toBe('REJEITADO_EMPRESA');
  });

  it('REJEITADO_ADMIN — admin recusou', () => {
    expect(
      derivarStatusConvite(
        {
          usedAt: ANTES,
          expiresAt: DEPOIS,
          otpValidadoEm: ANTES,
          membro: { status: 'MEMBRO_REJEITADO_ADMIN', documentacaoSolicitadaEm: null },
        },
        AGORA,
      ),
    ).toBe('REJEITADO_ADMIN');
  });

  it('fallback defensivo — convite usado sem membro (inconsistente) → AGUARDANDO_OTP', () => {
    expect(
      derivarStatusConvite(
        {
          usedAt: ANTES,
          expiresAt: DEPOIS,
          otpValidadoEm: ANTES,
          membro: null,
        },
        AGORA,
      ),
    ).toBe('AGUARDANDO_OTP');
  });

  it('fallback — status desconhecido cai em PENDENTE_APROVACAO_ADMIN', () => {
    expect(
      derivarStatusConvite(
        {
          usedAt: ANTES,
          expiresAt: DEPOIS,
          otpValidadoEm: ANTES,
          membro: { status: 'STATUS_NOVO_FUTURO' as any, documentacaoSolicitadaEm: null },
        },
        AGORA,
      ),
    ).toBe('PENDENTE_APROVACAO_ADMIN');
  });
});
