/**
 * Sprint Hardening Lateral (23/06/2026) — Condição 1 do re-review.
 *
 * Fix F2: `preCadastroProxy` (@Public, anônimo) agora valida service-side
 * que `indicadorId` pertence ao MESMO `cooperativaId` resolvido pelo
 * `?tenant=`. Rejeita com NotFoundException quando mismatch (anti-enumeração).
 */
import { NotFoundException } from '@nestjs/common';
import { CooperadosService } from './cooperados.service';

function setup() {
  const findFirstIndicador = jest.fn();
  const createCooperado = jest.fn().mockResolvedValue({ id: 'novo-cooperado-1' });
  const updateCooperado = jest.fn().mockResolvedValue({});
  const prisma = {
    cooperado: {
      findFirst: findFirstIndicador,
      create: createCooperado,
      update: updateCooperado,
    },
  } as any;

  // Injetar dependências mínimas que o constructor exige (passa undefined
  // pras que não são exercidas pelo preCadastroProxy).
  const service = new (CooperadosService as any)(
    prisma,
    undefined, // jwtService
    undefined, // configService
  );

  return { service, findFirstIndicador, createCooperado };
}

const BASE_DATA = {
  nomeCompleto: 'Smoke Indicador',
  telefone: '5527999999999',
  indicadorId: 'indicador-1',
  cooperativaId: 'tenant-A',
};

describe('Hardening Lateral — preCadastroProxy.indicadorId tenant validation', () => {
  it('indicador no mesmo tenant → cria cooperado', async () => {
    const { service, findFirstIndicador, createCooperado } = setup();
    findFirstIndicador.mockResolvedValue({ id: 'indicador-1' });
    const r = await service.preCadastroProxy(BASE_DATA);
    expect(findFirstIndicador).toHaveBeenCalledWith({
      where: { id: 'indicador-1', cooperativaId: 'tenant-A' },
      select: { id: true },
    });
    expect(createCooperado).toHaveBeenCalled();
    expect(r.cooperadoId).toBe('novo-cooperado-1');
  });

  it('indicador de OUTRO tenant → NotFoundException + NÃO cria cooperado', async () => {
    const { service, findFirstIndicador, createCooperado } = setup();
    findFirstIndicador.mockResolvedValue(null); // não acha no tenant-A
    await expect(service.preCadastroProxy(BASE_DATA)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(createCooperado).not.toHaveBeenCalled();
  });

  it('indicador inexistente → NotFoundException (anti-enumeração: mesma resposta)', async () => {
    const { service, findFirstIndicador, createCooperado } = setup();
    findFirstIndicador.mockResolvedValue(null);
    await expect(
      service.preCadastroProxy({ ...BASE_DATA, indicadorId: 'indicador-inventado' }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(createCooperado).not.toHaveBeenCalled();
  });
});
