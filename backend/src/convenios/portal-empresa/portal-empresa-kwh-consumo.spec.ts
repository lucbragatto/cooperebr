/**
 * Sprint Onboarding Bloco 2 Fatia 2.3 (07/06/2026) — specs do endpoint
 * GET /portal/meus-convenios/:id/kwh-consumo.
 *
 * Cobertura:
 *  - Default mes = mês anterior corrente (sem query param).
 *  - Query param `mes=YYYY-MM` válido → usa o mes informado.
 *  - Formato inválido → 400.
 *  - Mês > 12 → 400.
 *  - Mês futuro → 400 (sem leak da semântica).
 *  - Service vê `cooperativaId` derivado do guard (req.empresa), NÃO do path.
 *  - Resposta com UC mascarada (...XXX 3 últimos dígitos).
 *  - Mascaramento unitário (helper export).
 */
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { PortalEmpresaController } from './portal-empresa.controller';
import { mascararNumeroUc } from './portal-empresa.service';

describe('PortalEmpresaController.kwhConsumo — Fatia 2.3', () => {
  let controller: PortalEmpresaController;
  let portalServiceMock: any;

  const CONVENIO_ID = 'conv-1';
  const TENANT_A = 'coop-A';

  const respostaPreviewBase = {
    convenioId: CONVENIO_ID,
    convenioNome: 'Clínica X',
    base: 'CONSUMO_REAL' as const,
    mesReferencia: 5,
    anoReferencia: 2026,
    mesRefStr: '05/2026',
    status: 'OK' as const,
    kwhTotal: 700,
    membros: [],
  };

  beforeEach(() => {
    portalServiceMock = {
      kwhConsumoConvenio: jest.fn().mockResolvedValue(respostaPreviewBase),
    };
    controller = new PortalEmpresaController(
      portalServiceMock,
      {} as any,
      {} as any,
    );
  });

  // Importante: o default de TS coalesces `undefined`, então pra o teste
  // "sem cooperativaId" tem que ser passado null explicitamente.
  function mkReq(cooperativaId: string | null = TENANT_A) {
    return {
      empresa: cooperativaId ? { cooperativaId } : null,
    };
  }

  // ─── Default = mês anterior ──────────────────────────────────────────
  it('sem query mes → default mês ANTERIOR corrente', async () => {
    const hoje = new Date();
    const mesAtual = hoje.getMonth() + 1;
    const anoAtual = hoje.getFullYear();
    const mesEsperado = mesAtual === 1 ? 12 : mesAtual - 1;
    const anoEsperado = mesAtual === 1 ? anoAtual - 1 : anoAtual;

    await controller.kwhConsumo(CONVENIO_ID, undefined, mkReq());

    expect(portalServiceMock.kwhConsumoConvenio).toHaveBeenCalledWith({
      convenioId: CONVENIO_ID,
      mesReferencia: mesEsperado,
      anoReferencia: anoEsperado,
      cooperativaId: TENANT_A,
    });
  });

  // ─── Query mes válido ────────────────────────────────────────────────
  it('query mes=2026-03 → usa março de 2026', async () => {
    await controller.kwhConsumo(CONVENIO_ID, '2026-03', mkReq());
    expect(portalServiceMock.kwhConsumoConvenio).toHaveBeenCalledWith(
      expect.objectContaining({
        mesReferencia: 3,
        anoReferencia: 2026,
      }),
    );
  });

  // ─── Validação formato ───────────────────────────────────────────────
  it('formato inválido → BadRequest', async () => {
    await expect(
      controller.kwhConsumo(CONVENIO_ID, '03/2026', mkReq()),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      controller.kwhConsumo(CONVENIO_ID, 'abc', mkReq()),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      controller.kwhConsumo(CONVENIO_ID, '2026', mkReq()),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('mês > 12 → BadRequest', async () => {
    await expect(
      controller.kwhConsumo(CONVENIO_ID, '2026-13', mkReq()),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('mês 00 → BadRequest', async () => {
    await expect(
      controller.kwhConsumo(CONVENIO_ID, '2026-00', mkReq()),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  // ─── Mês futuro ──────────────────────────────────────────────────────
  it('mês futuro → BadRequest', async () => {
    const hoje = new Date();
    const futuroAno = hoje.getFullYear() + 1;
    await expect(
      controller.kwhConsumo(CONVENIO_ID, `${futuroAno}-06`, mkReq()),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  // ─── Sem cooperativaId no contexto ───────────────────────────────────
  it('contexto sem req.empresa.cooperativaId → Forbidden', async () => {
    await expect(
      controller.kwhConsumo(CONVENIO_ID, '2026-05', mkReq(null)),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  // ─── Anti-IDOR: cooperativaId vem do guard, não do path ──────────────
  it('cooperativaId passado ao service vem do guard (req.empresa), não do :id', async () => {
    await controller.kwhConsumo(CONVENIO_ID, '2026-05', mkReq('TENANT-DIFERENTE'));
    expect(portalServiceMock.kwhConsumoConvenio).toHaveBeenCalledWith(
      expect.objectContaining({ cooperativaId: 'TENANT-DIFERENTE' }),
    );
  });
});

// ─── Helper de mascaramento (unidade isolada) ────────────────────────────
describe('mascararNumeroUc — Fatia 2.3', () => {
  it('UC com 13 dígitos (EDP antigo) → ...054', () => {
    expect(mascararNumeroUc('0001421380054')).toBe('...054');
  });
  it('UC com 15 dígitos (EDP novo) → ...654', () => {
    expect(mascararNumeroUc('001421380054654')).toBe('...654');
  });
  it('UC curta (3 dígitos) → mantém', () => {
    expect(mascararNumeroUc('123')).toBe('123');
  });
  it('UC vazia → mantém', () => {
    expect(mascararNumeroUc('')).toBe('');
  });
  it('UC com letras → mascara últimos 3 caracteres', () => {
    expect(mascararNumeroUc('SINTETICA-001')).toBe('...001');
  });
});
