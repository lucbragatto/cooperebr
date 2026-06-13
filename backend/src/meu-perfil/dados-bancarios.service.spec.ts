/**
 * Sprint Clube P1 — F6 Bloco C.0 (13/06/2026).
 *
 * Specs do DadosBancariosService — cadastro/atualização da chave PIX
 * pra resgate F6.
 *
 * Foco:
 *  - REFORÇO ANTI-FRAUDE: PIN obrigatório em TODO update.
 *  - Validação regex por pixTipo (CPF/CNPJ/EMAIL/TELEFONE/ALEATORIA).
 *  - AuditLog `cooperado.pix.atualizar` com chaves mascaradas (anti-PII).
 *  - Multi-tenant anti-IDOR (cross-tenant retorna NotFound).
 *  - pixUltimaAlteracaoEm gravado → status retorna `alteradaRecentemente`
 *    quando < 24h (chave do Dialog admin do C.3).
 *  - Cadastro inicial (sem chave prévia) NÃO dispara `alteradaRecentemente`
 *    no service — flag é só sobre pixUltimaAlteracaoEm, e cadastro inicial
 *    seta agora; é a UI que decide ignorar quando `cadastroInicial=true`.
 */
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { DadosBancariosService } from './dados-bancarios.service';
import { PixTipoEnum } from './dto/update-dados-bancarios.dto';

const COOP = 'coop-1';
const ESTAB = 'estab-1';
const USR = 'usr-admin-1';

function setup(opts: {
  cooperadoAtual?: any;
  pinResult?: any;
  updateManyResult?: { count: number };
} = {}) {
  const findFirst = jest.fn().mockResolvedValue(
    opts.cooperadoAtual === undefined
      ? { id: ESTAB, pixChave: null, pixTipo: null }
      : opts.cooperadoAtual,
  );
  // F6 C.4 P0-A: update virou updateMany pra incluir cooperativaId no where
  // (anti-IDOR de chave PIX — âncora financeira). Defesa em profundidade
  // sobre o Guard 1; race cooperado-troca-tenant retorna count=0 → 404.
  const updateMany = jest
    .fn()
    .mockResolvedValue(opts.updateManyResult ?? { count: 1 });
  const auditLog = jest.fn().mockResolvedValue(undefined);

  const prisma: any = {
    cooperado: { findFirst, updateMany },
  };
  const pinSvc: any = {
    validarPinComLockout: jest
      .fn()
      .mockResolvedValue(opts.pinResult ?? { ok: true }),
  };
  const auditSvc: any = { log: auditLog };

  const sut = new DadosBancariosService(prisma, pinSvc, auditSvc);
  return {
    sut,
    prisma,
    pinSvc,
    auditSvc,
    findFirst,
    updateMany,
    update: updateMany, // alias pros specs antigos que ainda chamam .update
    auditLog,
  };
}

const baseParams = (over: Partial<Parameters<DadosBancariosService['atualizar']>[0]> = {}) => ({
  cooperadoId: ESTAB,
  cooperativaId: COOP,
  pin: '123456',
  pixTipo: PixTipoEnum.TELEFONE,
  pixChave: '+5527981341348',
  usuarioId: USR,
  usuarioPerfil: 'COOPERADO',
  ip: '127.0.0.1',
  userAgent: 'jest',
  ...over,
});

// ═════════════════════════════════════════════════════════════════════
// mascarar
// ═════════════════════════════════════════════════════════════════════

describe('DadosBancariosService.mascarar', () => {
  it('chave longa: mantém 3 primeiros + 2 últimos com *** no meio', () => {
    expect(DadosBancariosService.mascarar('+5527981341348')).toBe('+55***48');
    expect(DadosBancariosService.mascarar('lucbragatto@gmail.com')).toBe('luc***om');
    expect(DadosBancariosService.mascarar('11122233344')).toBe('111***44');
  });

  it('chave curta (<=5): retorna *** puro pra não revelar quase tudo', () => {
    expect(DadosBancariosService.mascarar('123')).toBe('***');
    expect(DadosBancariosService.mascarar('12345')).toBe('***');
  });

  it('nula/vazia: retorna null', () => {
    expect(DadosBancariosService.mascarar(null)).toBeNull();
    expect(DadosBancariosService.mascarar(undefined)).toBeNull();
    expect(DadosBancariosService.mascarar('')).toBeNull();
    expect(DadosBancariosService.mascarar('   ')).toBeNull();
  });
});

// ═════════════════════════════════════════════════════════════════════
// getStatus
// ═════════════════════════════════════════════════════════════════════

describe('DadosBancariosService.getStatus', () => {
  it('sem PIX cadastrado: retorna temPix=false + tudo null', async () => {
    const { sut, findFirst } = setup({
      cooperadoAtual: { id: ESTAB, pixChave: null, pixTipo: null, pixUltimaAlteracaoEm: null },
    });
    const r = await sut.getStatus({ cooperadoId: ESTAB, cooperativaId: COOP });
    expect(r).toEqual({
      temPixCadastrado: false,
      pixChaveMascarada: null,
      pixTipo: null,
      pixUltimaAlteracaoEm: null,
      alteradaRecentemente: false,
    });
    expect(findFirst).toHaveBeenCalledWith({
      where: { id: ESTAB, cooperativaId: COOP },
      select: { pixChave: true, pixTipo: true, pixUltimaAlteracaoEm: true },
    });
  });

  it('PIX cadastrado há > 24h: mostra mascarada + alteradaRecentemente=false', async () => {
    const onTemUmaSemana = new Date(Date.now() - 7 * 24 * 3600 * 1000);
    const { sut } = setup({
      cooperadoAtual: {
        id: ESTAB,
        pixChave: '+5527981341348',
        pixTipo: 'TELEFONE',
        pixUltimaAlteracaoEm: onTemUmaSemana,
      },
    });
    const r = await sut.getStatus({ cooperadoId: ESTAB, cooperativaId: COOP });
    expect(r.temPixCadastrado).toBe(true);
    expect(r.pixChaveMascarada).toBe('+55***48');
    expect(r.pixTipo).toBe('TELEFONE');
    expect(r.alteradaRecentemente).toBe(false);
  });

  it('PIX cadastrado há < 24h: alteradaRecentemente=true (banner amber no C.3)', async () => {
    const haTresHoras = new Date(Date.now() - 3 * 3600 * 1000);
    const { sut } = setup({
      cooperadoAtual: {
        id: ESTAB,
        pixChave: 'lucbragatto@gmail.com',
        pixTipo: 'EMAIL',
        pixUltimaAlteracaoEm: haTresHoras,
      },
    });
    const r = await sut.getStatus({ cooperadoId: ESTAB, cooperativaId: COOP });
    expect(r.alteradaRecentemente).toBe(true);
    expect(r.pixChaveMascarada).toBe('luc***om');
  });

  it('cross-tenant → NotFound (anti-IDOR)', async () => {
    const { sut } = setup({ cooperadoAtual: null });
    await expect(
      sut.getStatus({ cooperadoId: ESTAB, cooperativaId: COOP }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

// ═════════════════════════════════════════════════════════════════════
// atualizar — guards
// ═════════════════════════════════════════════════════════════════════

describe('DadosBancariosService.atualizar — guards', () => {
  it('cross-tenant → NotFound (anti-IDOR)', async () => {
    const { sut, update } = setup({ cooperadoAtual: null });
    await expect(sut.atualizar(baseParams())).rejects.toBeInstanceOf(NotFoundException);
    expect(update).not.toHaveBeenCalled();
  });

  it('CPF inválido (com formatação) → BadRequest sem chamar PIN', async () => {
    const { sut, pinSvc, update } = setup();
    await expect(
      sut.atualizar(baseParams({ pixTipo: PixTipoEnum.CPF, pixChave: '111.222.333-44' })),
    ).rejects.toThrow(/CPF inválido/);
    expect(pinSvc.validarPinComLockout).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  it('CPF válido (11 dígitos) passa do regex', async () => {
    const { sut, update } = setup();
    await sut.atualizar(
      baseParams({ pixTipo: PixTipoEnum.CPF, pixChave: '11122233344' }),
    );
    expect(update).toHaveBeenCalled();
  });

  it('CNPJ inválido → BadRequest', async () => {
    const { sut } = setup();
    await expect(
      sut.atualizar(baseParams({ pixTipo: PixTipoEnum.CNPJ, pixChave: '12345' })),
    ).rejects.toThrow(/CNPJ inválido/);
  });

  it('EMAIL inválido (sem @) → BadRequest', async () => {
    const { sut } = setup();
    await expect(
      sut.atualizar(baseParams({ pixTipo: PixTipoEnum.EMAIL, pixChave: 'lucnotemail' })),
    ).rejects.toThrow(/Email inválido/);
  });

  it('TELEFONE sem + (não-E.164) → BadRequest', async () => {
    const { sut } = setup();
    await expect(
      sut.atualizar(baseParams({ pixTipo: PixTipoEnum.TELEFONE, pixChave: '27981341348' })),
    ).rejects.toThrow(/E\.164/);
  });

  it('ALEATORIA com formato fora de UUID → BadRequest', async () => {
    const { sut } = setup();
    await expect(
      sut.atualizar(baseParams({ pixTipo: PixTipoEnum.ALEATORIA, pixChave: 'nao-eh-uuid' })),
    ).rejects.toThrow(/UUID v4/);
  });

  it('ALEATORIA UUID válido passa', async () => {
    const { sut, update } = setup();
    await sut.atualizar(
      baseParams({
        pixTipo: PixTipoEnum.ALEATORIA,
        pixChave: 'a1b2c3d4-e5f6-7890-abcd-ef0123456789',
      }),
    );
    expect(update).toHaveBeenCalled();
  });
});

// ═════════════════════════════════════════════════════════════════════
// atualizar — PIN (REFORÇO ANTI-FRAUDE)
// ═════════════════════════════════════════════════════════════════════

describe('DadosBancariosService.atualizar — PIN (REFORÇO ANTI-FRAUDE)', () => {
  it('PIN_NAO_DEFINIDO → BadRequest com CTA pra /portal/seguranca/definir-pin', async () => {
    const { sut, update } = setup({
      pinResult: { ok: false, motivo: 'PIN_NAO_DEFINIDO' },
    });
    await expect(sut.atualizar(baseParams())).rejects.toThrow(
      /PIN não foi definido.*definir-pin/,
    );
    expect(update).not.toHaveBeenCalled();
  });

  it('PIN_BLOQUEADO → Forbidden com ISO date', async () => {
    const desbloqueia = new Date('2026-06-13T18:00:00Z');
    const { sut, update } = setup({
      pinResult: { ok: false, motivo: 'PIN_BLOQUEADO', desbloqueiaEm: desbloqueia },
    });
    await expect(sut.atualizar(baseParams())).rejects.toThrow(
      /bloqueado.*2026-06-13T18:00:00/,
    );
    expect(update).not.toHaveBeenCalled();
  });

  it('PIN_INCORRETO → Forbidden sem CTA (retry)', async () => {
    const { sut, update } = setup({ pinResult: { ok: false, motivo: 'PIN_INCORRETO' } });
    await expect(sut.atualizar(baseParams())).rejects.toBeInstanceOf(ForbiddenException);
    expect(update).not.toHaveBeenCalled();
  });

  it('PIN validado com lockout (mesmo padrão F6 solicitarResgate)', async () => {
    const { sut, pinSvc } = setup();
    await sut.atualizar(baseParams());
    expect(pinSvc.validarPinComLockout).toHaveBeenCalledWith({
      cooperadoId: ESTAB,
      cooperativaId: COOP,
      pin: '123456',
    });
  });
});

// ═════════════════════════════════════════════════════════════════════
// atualizar — happy path + AuditLog
// ═════════════════════════════════════════════════════════════════════

describe('DadosBancariosService.atualizar — happy path + AuditLog', () => {
  it('cadastro inicial (sem chave prévia): update + AuditLog com cadastroInicial=true', async () => {
    const { sut, update, auditLog } = setup({
      cooperadoAtual: { id: ESTAB, pixChave: null, pixTipo: null },
    });
    const r = await sut.atualizar(baseParams());
    expect(r.sucesso).toBe(true);
    expect(r.pixUltimaAlteracaoEm).toBeInstanceOf(Date);
    // F6 C.4 P0-A: updateMany com cooperativaId no where (anti-IDOR)
    expect(update).toHaveBeenCalledWith({
      where: { id: ESTAB, cooperativaId: COOP },
      data: expect.objectContaining({
        pixChave: '+5527981341348',
        pixTipo: PixTipoEnum.TELEFONE,
        pixUltimaAlteracaoEm: expect.any(Date),
      }),
    });
    expect(auditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        usuarioId: USR,
        acao: 'cooperado.pix.atualizar',
        recurso: 'Cooperado',
        recursoId: ESTAB,
        cooperativaId: COOP,
        ip: '127.0.0.1',
        userAgent: 'jest',
        metadata: expect.objectContaining({
          antes: { pixChave: null, pixTipo: null },
          depois: { pixChave: '+55***48', pixTipo: PixTipoEnum.TELEFONE },
          cadastroInicial: true,
        }),
      }),
    );
  });

  it('alteração (chave prévia existia): AuditLog com antes mascarado + cadastroInicial=false', async () => {
    const { sut, auditLog } = setup({
      cooperadoAtual: {
        id: ESTAB,
        pixChave: 'antiga@gmail.com',
        pixTipo: 'EMAIL',
      },
    });
    await sut.atualizar(
      baseParams({
        pixTipo: PixTipoEnum.TELEFONE,
        pixChave: '+5527981341348',
      }),
    );
    expect(auditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          antes: { pixChave: 'ant***om', pixTipo: 'EMAIL' },
          depois: { pixChave: '+55***48', pixTipo: PixTipoEnum.TELEFONE },
          cadastroInicial: false,
        }),
      }),
    );
  });

  it('AuditLog NUNCA grava chave em claro nos metadados (PII)', async () => {
    const { sut, auditLog } = setup({
      cooperadoAtual: { id: ESTAB, pixChave: 'antiga@gmail.com', pixTipo: 'EMAIL' },
    });
    await sut.atualizar(baseParams({
      pixTipo: PixTipoEnum.EMAIL,
      pixChave: 'nova-completa@gmail.com',
    }));
    const call = auditLog.mock.calls[0][0];
    const stringified = JSON.stringify(call.metadata);
    expect(stringified).not.toContain('nova-completa@gmail.com');
    expect(stringified).not.toContain('antiga@gmail.com');
  });

  it('chave com whitespace é trimada antes de salvar + AuditLog', async () => {
    const { sut, update } = setup();
    await sut.atualizar(
      baseParams({ pixTipo: PixTipoEnum.EMAIL, pixChave: '  lucbragatto@gmail.com  ' }),
    );
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ pixChave: 'lucbragatto@gmail.com' }),
      }),
    );
  });
});

// ═════════════════════════════════════════════════════════════════════
// F6 C.4 P0-A — IDOR chave PIX (review pesada 13/06)
// ═════════════════════════════════════════════════════════════════════

describe('DadosBancariosService.atualizar — P0-A IDOR de chave PIX', () => {
  it('updateMany inclui cooperativaId no where (anti-IDOR — defesa em profundidade)', async () => {
    const { sut, updateMany } = setup();
    await sut.atualizar(baseParams());
    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: ESTAB, cooperativaId: COOP },
      }),
    );
  });

  it('count=0 (race: cooperado mudou de tenant entre read+write) → NotFound + NÃO grava AuditLog', async () => {
    const { sut, auditLog } = setup({ updateManyResult: { count: 0 } });
    await expect(sut.atualizar(baseParams())).rejects.toBeInstanceOf(NotFoundException);
    expect(auditLog).not.toHaveBeenCalled();
  });

  it('count=1 (happy path) → grava AuditLog', async () => {
    const { sut, auditLog } = setup({ updateManyResult: { count: 1 } });
    await sut.atualizar(baseParams());
    expect(auditLog).toHaveBeenCalledWith(
      expect.objectContaining({ acao: 'cooperado.pix.atualizar' }),
    );
  });
});
