/**
 * Sprint Convênio MIGRAÇÃO M47 (21/06/2026) — Fatia B MUST-FIX.
 *
 * Specs do guard de billing que bloqueia cobrança individual quando
 * cooperado está em PENDENTE_MIGRACAO ou DESLIGADO.
 *
 * Cobertura:
 *  1. Cooperado ATIVO → cobrança procede (regressão).
 *  2. Cooperado PENDENTE_MIGRACAO → BadRequestException + mensagem clara.
 *  3. Cooperado DESLIGADO → BadRequestException.
 *  4. Cooperado SUSPENSO → procede (lista bloqueia apenas os 2 novos M47;
 *     SUSPENSO é tratado pelos guards já existentes do contrato).
 */
import { BadRequestException } from '@nestjs/common';
import { CobrancasService } from './cobrancas.service';

describe('CobrancasService.create — MUST-FIX M47 guard double-charge', () => {
  const cobrancaFindFirst = jest.fn();
  const contratoFindUnique = jest.fn();

  const prismaMock = {
    cobranca: { findFirst: cobrancaFindFirst },
    contrato: { findUnique: contratoFindUnique },
  } as any;

  const service = new CobrancasService(
    prismaMock, {} as any, {} as any, {} as any, {} as any, {} as any, {} as any,
    {} as any, {} as any, {} as any, {} as any,
  );

  const baseData = {
    contratoId: 'contrato-1',
    mesReferencia: 6,
    anoReferencia: 2026,
    valorBruto: 100,
    dataVencimento: new Date('2026-07-10'),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    cobrancaFindFirst.mockResolvedValue(null);
  });

  it('1) Cooperado ATIVO → procede (não lança M47 guard)', async () => {
    contratoFindUnique.mockResolvedValue({
      id: 'contrato-1',
      cooperativaId: 'tenant-A',
      cooperado: { id: 'coop-1', status: 'ATIVO' },
      plano: { custeadoPorConvenio: false, nome: 'Padrão' },
    });
    // Sem outros mocks completos a operação vai falhar depois — mas o guard M47
    // não dispara, que é o foco.
    await expect(service.create(baseData)).rejects.not.toThrow(
      /status.*PENDENTE_MIGRACAO|DESLIGADO/,
    );
  });

  it('2) Cooperado PENDENTE_MIGRACAO → BadRequestException com mensagem M47', async () => {
    contratoFindUnique.mockResolvedValue({
      id: 'contrato-1',
      cooperativaId: 'tenant-A',
      cooperado: { id: 'coop-1', status: 'PENDENTE_MIGRACAO' },
      plano: { custeadoPorConvenio: false },
    });

    await expect(service.create(baseData)).rejects.toThrow(BadRequestException);
    await expect(service.create(baseData)).rejects.toThrow(/PENDENTE_MIGRACAO/);
    await expect(service.create(baseData)).rejects.toThrow(/migrar\/concluir/);
  });

  it('3) Cooperado DESLIGADO → BadRequestException com mensagem M47', async () => {
    contratoFindUnique.mockResolvedValue({
      id: 'contrato-1',
      cooperativaId: 'tenant-A',
      cooperado: { id: 'coop-1', status: 'DESLIGADO' },
      plano: { custeadoPorConvenio: false },
    });

    await expect(service.create(baseData)).rejects.toThrow(BadRequestException);
    await expect(service.create(baseData)).rejects.toThrow(/DESLIGADO/);
  });

  it('4) Cooperado SUSPENSO → M47 guard NÃO dispara (status não está na lista bloqueada M47)', async () => {
    contratoFindUnique.mockResolvedValue({
      id: 'contrato-1',
      cooperativaId: 'tenant-A',
      cooperado: { id: 'coop-1', status: 'SUSPENSO' },
      plano: { custeadoPorConvenio: false, nome: 'Padrão' },
    });

    // O guard M47 não bloqueia SUSPENSO — se houver outro guard upstream
    // que bloqueia, dispara, mas NÃO com a mensagem M47.
    await expect(service.create(baseData)).rejects.not.toThrow(/PENDENTE_MIGRACAO/);
    await expect(service.create(baseData)).rejects.not.toThrow(/migrar\/concluir/);
  });
});
