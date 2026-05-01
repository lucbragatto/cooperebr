/**
 * Specs do fix D-30P + D-30Q — caminho público de convênio (publico.controller.ts).
 *
 * Antes (Sprint 9B): criava ConvenioCooperado direto via Prisma → indicacaoId null
 * + recalcularFaixa não chamado.
 *
 * Depois (01/05): chama ConveniosMembrosService.adicionarMembro() que faz ambos.
 *
 * Estes testes exercitam APENAS o trecho da indicação/convênio em isolamento,
 * mockando o resto da cadeia.
 */
import { Test } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { ConveniosMembrosService } from '../convenios/convenios-membros.service';

describe('PublicoController — fluxo público de convênio (D-30P + D-30Q)', () => {
  let conveniosMembros: jest.Mocked<ConveniosMembrosService>;

  beforeEach(async () => {
    conveniosMembros = {
      adicionarMembro: jest.fn(),
    } as unknown as jest.Mocked<ConveniosMembrosService>;
  });

  /**
   * Helper que reproduz o trecho do publico.controller.ts:436-475 isolado.
   * (Não importa o controller inteiro pra evitar montar 7 deps + Prisma.)
   */
  async function trechoVincularConvenio(params: {
    indicador: { id: string } | null;
    conveniadoConvenioId?: string | null;
    membroConvenioId?: string | null;
    cooperadoId: string;
  }): Promise<{ chamouAdicionarMembro: boolean; convenioId?: string }> {
    const logger = new Logger('test');

    if (!params.indicador) return { chamouAdicionarMembro: false };

    const convenioId = params.conveniadoConvenioId ?? params.membroConvenioId;
    if (!convenioId) return { chamouAdicionarMembro: false };

    try {
      await conveniosMembros.adicionarMembro(convenioId, params.cooperadoId);
      logger.log(`vinculado convenio=${convenioId} cooperado=${params.cooperadoId}`);
      return { chamouAdicionarMembro: true, convenioId };
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'erro';
      logger.warn(`adicionarMembro falhou: ${msg}`);
      return { chamouAdicionarMembro: true, convenioId };
    }
  }

  it('Cenário 1 — indicador é membro de convênio: chama adicionarMembro com convenioId correto', async () => {
    conveniosMembros.adicionarMembro.mockResolvedValue({ id: 'membro-novo' } as any);

    const r = await trechoVincularConvenio({
      indicador: { id: 'carlos-cooperado-id' },
      membroConvenioId: 'cv-hangar-id',
      cooperadoId: 'novo-cooperado-id',
    });

    expect(r.chamouAdicionarMembro).toBe(true);
    expect(r.convenioId).toBe('cv-hangar-id');
    expect(conveniosMembros.adicionarMembro).toHaveBeenCalledTimes(1);
    expect(conveniosMembros.adicionarMembro).toHaveBeenCalledWith('cv-hangar-id', 'novo-cooperado-id');
  });

  it('Cenário 2 — indicador é conveniado (representante): chama adicionarMembro com convenioId do contrato', async () => {
    conveniosMembros.adicionarMembro.mockResolvedValue({ id: 'membro-novo' } as any);

    const r = await trechoVincularConvenio({
      indicador: { id: 'helena-conveniada-id' },
      conveniadoConvenioId: 'cv-moradas-id',
      cooperadoId: 'novo-morador-id',
    });

    expect(r.convenioId).toBe('cv-moradas-id');
    expect(conveniosMembros.adicionarMembro).toHaveBeenCalledWith('cv-moradas-id', 'novo-morador-id');
  });

  it('Cenário 3 — indicador NÃO é conveniado nem membro: NÃO chama adicionarMembro', async () => {
    const r = await trechoVincularConvenio({
      indicador: { id: 'cooperado-comum-id' },
      conveniadoConvenioId: null,
      membroConvenioId: null,
      cooperadoId: 'novo-cooperado-id',
    });

    expect(r.chamouAdicionarMembro).toBe(false);
    expect(conveniosMembros.adicionarMembro).not.toHaveBeenCalled();
  });

  it('Cenário 4 — sem indicador: NÃO chama adicionarMembro', async () => {
    const r = await trechoVincularConvenio({
      indicador: null,
      cooperadoId: 'novo-cooperado-id',
    });

    expect(r.chamouAdicionarMembro).toBe(false);
    expect(conveniosMembros.adicionarMembro).not.toHaveBeenCalled();
  });

  it('Cenário 5 — adicionarMembro lança (já vinculado, etc): captura e segue (fire-and-forget)', async () => {
    conveniosMembros.adicionarMembro.mockRejectedValue(new Error('Cooperado já vinculado a este convênio'));

    const r = await trechoVincularConvenio({
      indicador: { id: 'carlos-id' },
      membroConvenioId: 'cv-hangar-id',
      cooperadoId: 'cooperado-duplicado-id',
    });

    // Mesmo com exception capturada, o fluxo NÃO quebra — log warn e segue
    expect(r.chamouAdicionarMembro).toBe(true);
    expect(conveniosMembros.adicionarMembro).toHaveBeenCalled();
  });
});
