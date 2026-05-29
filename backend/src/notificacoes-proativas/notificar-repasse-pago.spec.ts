import { Logger } from '@nestjs/common';
import { NotificacoesProativasService } from './notificacoes-proativas.service';

/**
 * D-novo-AN AN.4 (M42, 30/05/2026) — Specs específicos de notificarRepassePago.
 *
 * Cobre só o método novo do sprint. Demais métodos do service mantêm
 * cobertura via specs históricos do BH.
 */
describe('NotificacoesProativasService.notificarRepassePago', () => {
  const repasseFindUnique = jest.fn();
  const enviarEmail = jest.fn();
  const enviarMensagem = jest.fn();

  const prismaMock = {
    repasseProprietario: { findUnique: repasseFindUnique },
  } as any;
  const emailServiceMock = { enviarEmail } as any;
  const whatsappSenderMock = { enviarMensagem } as any;

  // Outros 4 deps (cooperado, usuario, despesas, contaAPagar) não são usados
  // por notificarRepassePago — passamos stubs vazios.
  let svc: NotificacoesProativasService;

  beforeEach(() => {
    jest.clearAllMocks();
    enviarEmail.mockResolvedValue(undefined);
    enviarMensagem.mockResolvedValue(undefined);
    const configTenantMock = {} as any;
    svc = new NotificacoesProativasService(
      prismaMock,
      configTenantMock,
      emailServiceMock,
      whatsappSenderMock,
    );
    // silenciar Logger do nest
    (svc as any).logger = new Logger('test');
  });

  it('Envia email + WA quando repasse PAGO e proprietarioUsuario completo', async () => {
    repasseFindUnique.mockResolvedValueOnce({
      id: 'r1',
      cooperativaId: 'coop-A',
      valorLiquido: 800,
      periodoFim: new Date('2026-04-30'),
      status: 'PAGO',
      metodoPagamento: 'PIX',
      dataPagamento: new Date('2026-05-05'),
      comprovante: '/uploads/repasses/coop-A/2026/05/c.pdf',
      usina: { id: 'u1', nome: 'Solar A', proprietarioEmail: null },
      proprietarioUsuario: {
        id: 'usr-1',
        nome: 'Dono',
        email: 'dono@x.com',
        telefone: '27999999999',
      },
    });

    await svc.notificarRepassePago('r1');

    expect(enviarEmail).toHaveBeenCalledTimes(1);
    expect(enviarEmail).toHaveBeenCalledWith(
      'dono@x.com',
      expect.stringContaining('Repasse pago'),
      expect.stringContaining('800'),
      undefined,
      'coop-A',
    );
    expect(enviarMensagem).toHaveBeenCalledTimes(1);
    expect(enviarMensagem).toHaveBeenCalledWith(
      '27999999999',
      expect.stringContaining('💰'),
      expect.objectContaining({ tipoDisparo: 'REPASSE_PAGO', disparoId: 'r1' }),
    );
  });

  it('Fallback Caminho B: usa usina.proprietarioEmail quando proprietarioUsuario.email ausente', async () => {
    repasseFindUnique.mockResolvedValueOnce({
      id: 'r1',
      cooperativaId: 'coop-A',
      valorLiquido: 500,
      periodoFim: new Date('2026-04-30'),
      status: 'PAGO',
      metodoPagamento: 'TED',
      dataPagamento: new Date('2026-05-05'),
      comprovante: null,
      usina: { id: 'u1', nome: 'Solar B', proprietarioEmail: 'dono-b@x.com' },
      proprietarioUsuario: null,
    });

    await svc.notificarRepassePago('r1');

    expect(enviarEmail).toHaveBeenCalledWith(
      'dono-b@x.com',
      expect.any(String),
      expect.any(String),
      undefined,
      'coop-A',
    );
    expect(enviarMensagem).not.toHaveBeenCalled(); // sem telefone
  });

  it('NÃO envia quando status !== PAGO (proteção)', async () => {
    repasseFindUnique.mockResolvedValueOnce({
      id: 'r1',
      cooperativaId: 'coop-A',
      valorLiquido: 500,
      periodoFim: new Date('2026-04-30'),
      status: 'PENDENTE',
      usina: { id: 'u1', nome: 'Solar A', proprietarioEmail: 'x@y.com' },
      proprietarioUsuario: null,
    });

    await svc.notificarRepassePago('r1');

    expect(enviarEmail).not.toHaveBeenCalled();
    expect(enviarMensagem).not.toHaveBeenCalled();
  });

  it('Sem destinatário (email e telefone null) → warn e retorna sem disparar', async () => {
    repasseFindUnique.mockResolvedValueOnce({
      id: 'r1',
      cooperativaId: 'coop-A',
      valorLiquido: 500,
      periodoFim: new Date('2026-04-30'),
      status: 'PAGO',
      metodoPagamento: 'PIX',
      dataPagamento: new Date('2026-05-05'),
      comprovante: null,
      usina: { id: 'u1', nome: 'Solar A', proprietarioEmail: null },
      proprietarioUsuario: null,
    });

    await svc.notificarRepassePago('r1');

    expect(enviarEmail).not.toHaveBeenCalled();
    expect(enviarMensagem).not.toHaveBeenCalled();
  });

  it('Repasse inexistente → return sem erro', async () => {
    repasseFindUnique.mockResolvedValueOnce(null);

    await expect(svc.notificarRepassePago('r-inex')).resolves.toBeUndefined();
    expect(enviarEmail).not.toHaveBeenCalled();
  });
});
