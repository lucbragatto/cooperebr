/**
 * Sprint Convênio FUNDAÇÃO (21/06/2026) — E1 inline.
 *
 * Specs do removerMembro pra premissa E1: tokens FICAM com o funcionário
 * no desligamento. removerMembro NÃO toca saldo + dispara WA informando.
 *
 * Cobertura:
 *  1. Desligamento commita sem tocar saldo (zero call em cooperTokenSaldo.update)
 *  2. WA dispara após commit com texto E1 ("seus tokens continuam seus")
 *  3. Saldo > 0: mostra quantidade + valor R$ na mensagem
 *  4. Saldo 0 ou ausente: mensagem alternativa "caso receba tokens..."
 *  5. Sem telefone: skip + log warn
 *  6. Já desligado: BadRequest (regressão guard existente)
 *  7. Vínculo inexistente: NotFoundException (regressão guard)
 *  8. Falha de WA não derruba o desligamento (best-effort)
 *  9. Multi-tenant: cooperado.findFirst filtra cooperativaId do convênio
 */
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ConveniosMembrosService } from './convenios-membros.service';

describe('ConveniosMembrosService.removerMembro — E1 desligamento (tokens ficam)', () => {
  const vinculoFindUnique = jest.fn();
  const vinculoUpdate = jest.fn();
  const convenioFindUnique = jest.fn();
  const cooperadoFindFirst = jest.fn();
  const saldoFindUnique = jest.fn();
  const saldoUpdate = jest.fn();
  const configFindUnique = jest.fn();
  const recalcularFaixa = jest.fn();
  const waEnviarMensagem = jest.fn();

  const prismaMock = {
    convenioCooperado: { findUnique: vinculoFindUnique, update: vinculoUpdate },
    contratoConvenio: { findUnique: convenioFindUnique },
    cooperado: { findFirst: cooperadoFindFirst },
    cooperTokenSaldo: { findUnique: saldoFindUnique, update: saldoUpdate },
    configCooperToken: { findUnique: configFindUnique },
  } as any;

  const progressaoMock = { recalcularFaixa } as any;
  const waMock = { enviarMensagem: waEnviarMensagem } as any;

  const service = new ConveniosMembrosService(prismaMock, progressaoMock, waMock);

  beforeEach(() => {
    jest.clearAllMocks();
    vinculoFindUnique.mockResolvedValue({
      id: 'vinculo-1', ativo: true, convenioId: 'conv-1', cooperadoId: 'coop-1',
    });
    vinculoUpdate.mockResolvedValue({ id: 'vinculo-1', ativo: false });
    convenioFindUnique.mockResolvedValue({
      cooperativaId: 'tenant-A', empresaNome: 'ACME Ltda',
    });
    cooperadoFindFirst.mockResolvedValue({
      telefone: '5527999998888', nomeCompleto: 'Funcionário Teste',
    });
    recalcularFaixa.mockResolvedValue(undefined);
    waEnviarMensagem.mockResolvedValue({ enviado: true });
    configFindUnique.mockResolvedValue({ valorTokenReais: 0.45 });
  });

  it('1) commita desligamento sem tocar saldo de token', async () => {
    saldoFindUnique.mockResolvedValue({ saldoDisponivel: 100 });

    await service.removerMembro('conv-1', 'coop-1');

    expect(vinculoUpdate).toHaveBeenCalledWith({
      where: { id: 'vinculo-1' },
      data: {
        ativo: false,
        status: 'MEMBRO_DESLIGADO',
        dataDesligamento: expect.any(Date),
      },
    });
    expect(saldoUpdate).not.toHaveBeenCalled(); // saldo NÃO mexe
  });

  it('2) WA dispara após commit com texto E1', async () => {
    saldoFindUnique.mockResolvedValue({ saldoDisponivel: 100 });

    await service.removerMembro('conv-1', 'coop-1');

    expect(waEnviarMensagem).toHaveBeenCalledTimes(1);
    const [telefone, texto, opcoes] = waEnviarMensagem.mock.calls[0];
    expect(telefone).toBe('5527999998888');
    expect(texto).toContain('Desligamento do convênio');
    expect(texto).toContain('ACME Ltda');
    expect(texto).toContain('Funcionário Teste');
    expect(opcoes).toMatchObject({
      tipoDisparo: 'CONVENIO_DESLIGAMENTO_E1',
      disparoId: 'conv-1:coop-1',
      cooperadoId: 'coop-1',
      cooperativaId: 'tenant-A',
    });
  });

  it('3) Saldo > 0: mostra quantidade + valor R$ ("continuam seus")', async () => {
    saldoFindUnique.mockResolvedValue({ saldoDisponivel: 100 });

    await service.removerMembro('conv-1', 'coop-1');

    const texto = waEnviarMensagem.mock.calls[0][1];
    expect(texto).toContain('100');
    expect(texto).toContain('R$');
    expect(texto).toContain('CONTINUAM SEUS');
  });

  it('4a) Saldo null (cooperado nunca recebeu tokens): mensagem alternativa "caso receba tokens..."', async () => {
    saldoFindUnique.mockResolvedValue(null);

    await service.removerMembro('conv-1', 'coop-1');

    const texto = waEnviarMensagem.mock.calls[0][1];
    expect(texto).toContain('Caso receba tokens no futuro');
    expect(texto).not.toContain('CONTINUAM SEUS');
  });

  it('4b) Saldo 0 explícito (cooperado já gastou tudo): mesma mensagem alternativa — P3-B code-reviewer 21/06', async () => {
    saldoFindUnique.mockResolvedValue({ saldoDisponivel: 0 });

    await service.removerMembro('conv-1', 'coop-1');

    const texto = waEnviarMensagem.mock.calls[0][1];
    expect(texto).toContain('Caso receba tokens no futuro');
    expect(texto).not.toContain('CONTINUAM SEUS');
  });

  it('5) Sem telefone: skip + log warn (sem chamar WA)', async () => {
    saldoFindUnique.mockResolvedValue({ saldoDisponivel: 50 });
    cooperadoFindFirst.mockResolvedValue({
      telefone: null, nomeCompleto: 'Sem Telefone',
    });

    await service.removerMembro('conv-1', 'coop-1');

    expect(vinculoUpdate).toHaveBeenCalled(); // desligamento aconteceu
    expect(waEnviarMensagem).not.toHaveBeenCalled();
  });

  it('6) Já desligado: BadRequestException (regressão guard)', async () => {
    vinculoFindUnique.mockResolvedValue({
      id: 'vinculo-1', ativo: false, convenioId: 'conv-1', cooperadoId: 'coop-1',
    });

    await expect(service.removerMembro('conv-1', 'coop-1')).rejects.toThrow(BadRequestException);
    expect(vinculoUpdate).not.toHaveBeenCalled();
    expect(waEnviarMensagem).not.toHaveBeenCalled();
  });

  it('7) Vínculo inexistente: NotFoundException (regressão guard)', async () => {
    vinculoFindUnique.mockResolvedValue(null);

    await expect(service.removerMembro('conv-1', 'coop-1')).rejects.toThrow(NotFoundException);
    expect(waEnviarMensagem).not.toHaveBeenCalled();
  });

  it('8) Falha de WA não derruba o desligamento (best-effort)', async () => {
    saldoFindUnique.mockResolvedValue({ saldoDisponivel: 100 });
    waEnviarMensagem.mockRejectedValue(new Error('WA offline'));

    const result = await service.removerMembro('conv-1', 'coop-1');

    expect(result).toEqual({ id: 'vinculo-1', ativo: false }); // desligamento OK
  });

  it('9) Multi-tenant: cooperado.findFirst filtra cooperativaId do convênio', async () => {
    saldoFindUnique.mockResolvedValue({ saldoDisponivel: 100 });

    await service.removerMembro('conv-1', 'coop-1');

    expect(cooperadoFindFirst).toHaveBeenCalledWith({
      where: { id: 'coop-1', cooperativaId: 'tenant-A' },
      select: { telefone: true, nomeCompleto: true },
    });
  });

  it('10) valorTokenReais vem do ConfigCooperToken do tenant (não hardcode 0.45) — P2-A multitenant review', async () => {
    saldoFindUnique.mockResolvedValue({ saldoDisponivel: 200 });
    configFindUnique.mockResolvedValue({ valorTokenReais: 0.60 }); // tenant diferente

    await service.removerMembro('conv-1', 'coop-1');

    expect(configFindUnique).toHaveBeenCalledWith({
      where: { cooperativaId: 'tenant-A' },
      select: { valorTokenReais: true },
    });
    const texto = waEnviarMensagem.mock.calls[0][1];
    // 200 × 0.60 = R$ 120,00 (não R$ 90,00 que seria com hardcode 0.45)
    expect(texto).toContain('R$ 120,00');
  });

  it('11) ConfigCooperToken null → fallback 0.45 (cooperativa não configurou ainda)', async () => {
    saldoFindUnique.mockResolvedValue({ saldoDisponivel: 100 });
    configFindUnique.mockResolvedValue(null);

    await service.removerMembro('conv-1', 'coop-1');

    const texto = waEnviarMensagem.mock.calls[0][1];
    // 100 × 0.45 = R$ 45,00 (fallback)
    expect(texto).toContain('R$ 45,00');
  });
});
