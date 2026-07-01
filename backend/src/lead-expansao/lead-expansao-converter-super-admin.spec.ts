/**
 * Frente 2 Vitrines Mínimas do Funil (01/07/2026) — Bloco C item 6.
 *
 * Specs do fix multi-tenant SUPER_ADMIN no `converter()`:
 *  - ADMIN/OPERADOR mantêm comportamento pré-existente (cooperativaId JWT).
 *  - SUPER_ADMIN aceita `cooperativaIdAlvo` no body, validado contra
 *    Cooperativa ativa (findUnique anti-spoof M45).
 *  - SUPER_ADMIN sem cooperativaIdAlvo → BadRequest.
 *  - SUPER_ADMIN + cooperativaIdAlvo inexistente/inativo → NotFound.
 *  - SUPER_ADMIN + lead órfão (cooperativaId=null): adota, gravando
 *    cooperativaId no update do lead + no create do Cooperado.
 *  - SUPER_ADMIN NÃO pode roubar lead ativo de outro tenant (findFirst OR
 *    exige cooperativaId=null OU bater com o alvo).
 *  - ADMIN NÃO consegue passar cooperativaIdAlvo pelo body (destructure-discard).
 */
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { LeadExpansaoController } from './lead-expansao.controller';
import { LeadNaoEncontradoError } from './lead-expansao.service';

function setup() {
  const serviceConverter = jest.fn().mockResolvedValue({ cooperadoId: 'coop-novo', leadId: 'lead-1' });
  const cooperativaFindUnique = jest.fn();
  const prismaMock = {
    cooperativa: { findUnique: cooperativaFindUnique },
  } as any;
  const controller = new LeadExpansaoController(
    { converter: serviceConverter } as any,
    prismaMock,
  );
  return { controller, serviceConverter, cooperativaFindUnique };
}

const DADOS_BASE = {
  nomeCompleto: 'Fulano de Teste',
  cpf: '12345678900',
  email: 'fulano@example.com',
};

describe('LeadExpansaoController.converter — Frente 2 SUPER_ADMIN + órfão (01/07)', () => {
  // ─── ADMIN/OPERADOR — comportamento pré-existente ────────────────

  it('ADMIN com cooperativaId no JWT → usa JWT, não aceita cooperativaIdAlvo do body', async () => {
    const { controller, serviceConverter } = setup();
    await controller.converter(
      'lead-1',
      { ...DADOS_BASE, cooperativaIdAlvo: 'TENANT-FORJADO' } as any,
      { user: { perfil: 'ADMIN', cooperativaId: 'tenant-A' } },
    );
    // Chamada usa tenant-A (JWT), permitirAdotarLeadOrfao=false.
    expect(serviceConverter).toHaveBeenCalledWith(
      'lead-1',
      'tenant-A',
      expect.not.objectContaining({ cooperativaIdAlvo: expect.anything() }),
      { permitirAdotarLeadOrfao: false },
    );
  });

  it('ADMIN sem cooperativaId no JWT → 403', async () => {
    const { controller } = setup();
    await expect(
      controller.converter('lead-1', DADOS_BASE, { user: { perfil: 'ADMIN' } }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('OPERADOR sem cooperativaId no JWT → 403', async () => {
    const { controller } = setup();
    await expect(
      controller.converter('lead-1', DADOS_BASE, { user: { perfil: 'OPERADOR' } }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  // ─── SUPER_ADMIN — extensão Frente 2 ─────────────────────────────

  it('SUPER_ADMIN sem cooperativaIdAlvo no body → BadRequest', async () => {
    const { controller } = setup();
    await expect(
      controller.converter('lead-1', DADOS_BASE, { user: { perfil: 'SUPER_ADMIN' } }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('SUPER_ADMIN com cooperativaIdAlvo em string vazia → BadRequest', async () => {
    const { controller } = setup();
    await expect(
      controller.converter(
        'lead-1',
        { ...DADOS_BASE, cooperativaIdAlvo: '   ' } as any,
        { user: { perfil: 'SUPER_ADMIN' } },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('SUPER_ADMIN com cooperativaIdAlvo inexistente → NotFound (anti-enumeração)', async () => {
    const { controller, cooperativaFindUnique } = setup();
    cooperativaFindUnique.mockResolvedValue(null);
    await expect(
      controller.converter(
        'lead-1',
        { ...DADOS_BASE, cooperativaIdAlvo: 'TENANT-FAKE' } as any,
        { user: { perfil: 'SUPER_ADMIN' } },
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('SUPER_ADMIN com cooperativaIdAlvo INATIVO → NotFound', async () => {
    const { controller, cooperativaFindUnique } = setup();
    cooperativaFindUnique.mockResolvedValue({ id: 'TENANT-X', ativo: false });
    await expect(
      controller.converter(
        'lead-1',
        { ...DADOS_BASE, cooperativaIdAlvo: 'TENANT-X' } as any,
        { user: { perfil: 'SUPER_ADMIN' } },
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('SUPER_ADMIN com cooperativaIdAlvo válido → passa permitirAdotarLeadOrfao=true pro service', async () => {
    const { controller, serviceConverter, cooperativaFindUnique } = setup();
    cooperativaFindUnique.mockResolvedValue({ id: 'TENANT-ALVO', ativo: true });
    await controller.converter(
      'lead-1',
      { ...DADOS_BASE, cooperativaIdAlvo: 'TENANT-ALVO' } as any,
      { user: { perfil: 'SUPER_ADMIN' } },
    );
    expect(serviceConverter).toHaveBeenCalledWith(
      'lead-1',
      'TENANT-ALVO',
      expect.objectContaining({ nomeCompleto: 'Fulano de Teste' }),
      { permitirAdotarLeadOrfao: true },
    );
  });

  // ─── Validações de payload — comuns aos 2 caminhos ───────────────

  it('body sem nomeCompleto → BadRequest (mesmo pra SUPER_ADMIN)', async () => {
    const { controller } = setup();
    await expect(
      controller.converter(
        'lead-1',
        { cpf: '12345', email: 'x@y.com', cooperativaIdAlvo: 'TENANT-ALVO' } as any,
        { user: { perfil: 'SUPER_ADMIN' } },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  // ─── Propagação de erros do service (mantida) ────────────────────

  it('LeadNaoEncontradoError do service → NotFound', async () => {
    const { controller, serviceConverter } = setup();
    serviceConverter.mockRejectedValueOnce(new LeadNaoEncontradoError('não encontrado'));
    await expect(
      controller.converter('lead-1', DADOS_BASE, {
        user: { perfil: 'ADMIN', cooperativaId: 'tenant-A' },
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// Specs do SERVICE — camada de adoção do lead órfão
// ═══════════════════════════════════════════════════════════════════════

import { LeadExpansaoService } from './lead-expansao.service';

describe('LeadExpansaoService.converter — Frente 2 adoção de lead órfão (01/07)', () => {
  const leadFindFirst = jest.fn();
  const leadUpdate = jest.fn();
  const cooperadoCreate = jest.fn();
  const transaction = jest.fn();

  const prismaMock = {
    leadExpansao: { findFirst: leadFindFirst, update: leadUpdate },
    cooperado: { create: cooperadoCreate },
    $transaction: transaction,
  } as any;

  const service = new LeadExpansaoService(prismaMock);

  beforeEach(() => {
    jest.clearAllMocks();
    cooperadoCreate.mockResolvedValue({ id: 'coop-novo' });
    leadUpdate.mockResolvedValue({});
    transaction.mockImplementation(async (fn: any) =>
      fn({
        cooperado: { create: cooperadoCreate },
        leadExpansao: { update: leadUpdate },
      }),
    );
  });

  const dados = { nomeCompleto: 'X', cpf: '12345678900', email: 'x@y.com' };

  it('adoção: lead órfão (cooperativaId=null) + permitirAdotarLeadOrfao → grava cooperativaId no lead+cooperado', async () => {
    leadFindFirst.mockResolvedValue({
      id: 'lead-1',
      telefone: '5527999998888',
      status: 'AGUARDANDO',
      distribuidora: 'EDP_ES',
      cooperativaId: null,
    });

    await service.converter('lead-1', 'TENANT-ADOTADO', dados, {
      permitirAdotarLeadOrfao: true,
    });

    // findFirst com OR — aceita órfão OU no tenant
    expect(leadFindFirst).toHaveBeenCalledWith({
      where: {
        id: 'lead-1',
        OR: [{ cooperativaId: null }, { cooperativaId: 'TENANT-ADOTADO' }],
      },
      select: expect.any(Object),
    });

    // Cooperado criado no tenant adotado
    expect(cooperadoCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ cooperativaId: 'TENANT-ADOTADO' }),
    });

    // Lead ganha cooperativaId + status=CONVERTIDO (encerra estado órfão)
    expect(leadUpdate).toHaveBeenCalledWith({
      where: { id: 'lead-1' },
      data: { status: 'CONVERTIDO', cooperativaId: 'TENANT-ADOTADO' },
    });
  });

  it('SUPER_ADMIN NÃO pode roubar lead ativo de outro tenant (findFirst OR bloqueia)', async () => {
    // findFirst com OR não encontra o lead (porque lead.cooperativaId é
    // "outro-tenant", não bate nem com null nem com TENANT-ALVO).
    leadFindFirst.mockResolvedValue(null);
    await expect(
      service.converter('lead-1', 'TENANT-ALVO', dados, { permitirAdotarLeadOrfao: true }),
    ).rejects.toThrow(/não encontrado/);
    expect(transaction).not.toHaveBeenCalled();
  });

  it('modo pré-existente (opts vazio) mantém where estrito por cooperativaId', async () => {
    leadFindFirst.mockResolvedValue({
      id: 'lead-1',
      telefone: '5527999998888',
      status: 'AGUARDANDO',
      distribuidora: 'EDP_ES',
      cooperativaId: 'tenant-A',
    });

    await service.converter('lead-1', 'tenant-A', dados);

    expect(leadFindFirst).toHaveBeenCalledWith({
      where: { id: 'lead-1', cooperativaId: 'tenant-A' },
      select: expect.any(Object),
    });
    // Update NÃO tenta re-gravar cooperativaId (lead já pertence ao tenant).
    expect(leadUpdate).toHaveBeenCalledWith({
      where: { id: 'lead-1', cooperativaId: 'tenant-A' },
      data: { status: 'CONVERTIDO' },
    });
  });

  it('modo adoção mas lead JÁ pertence ao tenant alvo → update mantém where estrito', async () => {
    leadFindFirst.mockResolvedValue({
      id: 'lead-1',
      telefone: '5527999998888',
      status: 'AGUARDANDO',
      distribuidora: 'EDP_ES',
      cooperativaId: 'TENANT-ALVO', // já pertence, não é adoção
    });

    await service.converter('lead-1', 'TENANT-ALVO', dados, {
      permitirAdotarLeadOrfao: true,
    });

    // Update usa where estrito porque não é adoção real (lead já era do tenant).
    expect(leadUpdate).toHaveBeenCalledWith({
      where: { id: 'lead-1', cooperativaId: 'TENANT-ALVO' },
      data: { status: 'CONVERTIDO' },
    });
  });
});
