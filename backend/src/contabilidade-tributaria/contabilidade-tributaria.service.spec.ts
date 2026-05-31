import { NotFoundException } from '@nestjs/common';
import { NaturezaCooperativa, TipoRegimeContabil } from '@prisma/client';
import { ContabilidadeTributariaService } from './contabilidade-tributaria.service';
import { RegimeContabilFactory } from './regimes/regime.factory';

/**
 * D-novo-BR-CT CT.2 — Service nuclear consulta a Cooperativa, resolve
 * regime via factory e delega classificação.
 */
describe('ContabilidadeTributariaService.classificarLancamento', () => {
  const coopFindUnique = jest.fn();
  const prismaMock = { cooperativa: { findUnique: coopFindUnique } } as any;
  const factory = new RegimeContabilFactory();
  const service = new ContabilidadeTributariaService(prismaMock, factory);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('cooperativa COOPERATIVO + Cobranca cooperado COM_UC → PROPRIO', async () => {
    coopFindUnique.mockResolvedValueOnce({ id: 'c1', regimeContabil: TipoRegimeContabil.COOPERATIVO });
    const r = await service.classificarLancamento('c1', { tipo: 'COBRANCA', cooperadoTipoCooperado: 'COM_UC' });
    expect(r).toBe(NaturezaCooperativa.PROPRIO);
  });

  it('cooperativa CONSORCIO → throw (stub bloqueia P0-1)', async () => {
    coopFindUnique.mockResolvedValueOnce({ id: 'c1', regimeContabil: TipoRegimeContabil.CONSORCIO_PROPORCIONAL });
    await expect(
      service.classificarLancamento('c1', { tipo: 'COBRANCA', cooperadoTipoCooperado: 'COM_UC' }),
    ).rejects.toThrow(/CONSORCIO_PROPORCIONAL/);
  });

  it('cooperativa inexistente → NotFoundException', async () => {
    coopFindUnique.mockResolvedValueOnce(null);
    await expect(
      service.classificarLancamento('inex', { tipo: 'COBRANCA', cooperadoTipoCooperado: 'COM_UC' }),
    ).rejects.toThrow(NotFoundException);
  });

  it('Repasse com formaAquisicao=ALUGUEL em COOPERATIVO → NAO_COOPERATIVO', async () => {
    coopFindUnique.mockResolvedValueOnce({ id: 'c1', regimeContabil: TipoRegimeContabil.COOPERATIVO });
    const r = await service.classificarLancamento('c1', {
      tipo: 'REPASSE_PROPRIETARIO',
      usinaFormaAquisicao: 'ALUGUEL',
    });
    expect(r).toBe(NaturezaCooperativa.NAO_COOPERATIVO);
  });

  it('Convenio em COOPERATIVO → AUXILIAR', async () => {
    coopFindUnique.mockResolvedValueOnce({ id: 'c1', regimeContabil: TipoRegimeContabil.COOPERATIVO });
    const r = await service.classificarLancamento('c1', { tipo: 'CONVENIO' });
    expect(r).toBe(NaturezaCooperativa.AUXILIAR);
  });
});
