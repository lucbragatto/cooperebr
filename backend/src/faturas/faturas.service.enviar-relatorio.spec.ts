/**
 * Corretiva de segurança 2026-07-16 — Achado 2 (revisão do Luciano).
 *
 * O bug estava em FaturasService.enviarRelatorioAposAprovacao, que chamava
 * `fetch('http://localhost:3002/api/send', ...)` diretamente. Como o
 * endpoint não existia (a rota real é POST /send-message), o transporte
 * retornava 404 mas o service NÃO checava `res.ok` — logava
 * "WA relatório enviado" e seguia adiante. A falha ficava invisível.
 *
 * O fix roteia via WhatsappSenderService (fachada única). Este spec amarra
 * o comportamento: qualquer regressão que reintroduza `fetch` direto ao
 * :3002 vai fazer o assert de `waSender.enviarMensagem toHaveBeenCalled`
 * cair.
 *
 * Regra contatos de teste (Luciano 14/05): jest unitário puro, com o
 * transporte mockado. Nenhum WhatsApp real é enviado por este spec.
 */
import { FaturasService } from './faturas.service';

describe('FaturasService.enviarRelatorioAposAprovacao — Achado 2 (fachada obrigatória)', () => {
  let service: FaturasService;
  let waSender: { enviarMensagem: jest.Mock };
  let logger: { log: jest.Mock; warn: jest.Mock; error: jest.Mock };
  let prismaMock: any;
  let emailService: { enviarEmail: jest.Mock };
  let relatorioService: { gerarRelatorioByFaturaId: jest.Mock; renderHtml: jest.Mock };

  const TELEFONE_WHITELIST = '5527981341348'; // whitelist dev — Luciano

  beforeEach(() => {
    waSender = { enviarMensagem: jest.fn() };
    logger = { log: jest.fn(), warn: jest.fn(), error: jest.fn() };
    prismaMock = {
      faturaProcessada: { findUnique: jest.fn() },
    };
    emailService = { enviarEmail: jest.fn().mockResolvedValue(undefined) };
    relatorioService = {
      gerarRelatorioByFaturaId: jest.fn(),
      renderHtml: jest.fn().mockReturnValue('<html>relatorio</html>'),
    };

    service = new FaturasService(
      prismaMock,
      {} as any, // notificacoes
      {} as any, // configTenant
      emailService as any,
      relatorioService as any,
      {} as any, // cooperTokenService
      waSender as any,
    );
    (service as any).logger = logger;

    prismaMock.faturaProcessada.findUnique.mockResolvedValue({
      id: 'fat-1',
      cooperado: {
        id: 'coop-1',
        cooperativaId: 'tenant-A',
        nomeCompleto: 'Luciano Teste',
        telefone: TELEFONE_WHITELIST,
        // email vazio → skip email path (foco no WA)
      },
    });
    relatorioService.gerarRelatorioByFaturaId.mockResolvedValue({
      economia: { economiaReais: 42.5, economiaPercentual: 15 },
      periodo: { mesLabel: 'Julho/2026' },
    });
  });

  it('transporte OK → passa pela fachada (WhatsappSenderService) e loga sucesso', async () => {
    waSender.enviarMensagem.mockResolvedValue({ enviado: true });

    await service.enviarRelatorioAposAprovacao('fat-1');

    // Prova cirúrgica do fix: a fachada FOI usada. Se alguém reintroduzir
    // `fetch(:3002/api/send)` bypassando o sender, este assert cai.
    expect(waSender.enviarMensagem).toHaveBeenCalledTimes(1);
    expect(waSender.enviarMensagem).toHaveBeenCalledWith(
      TELEFONE_WHITELIST,
      expect.stringContaining('economizou R$42.50'),
      expect.objectContaining({
        tipoDisparo: 'RELATORIO_POS_APROVACAO',
        disparoId: 'fat-1',
      }),
    );
    // "Sucesso" só é logado quando enviado=true.
    const sucessoLogs = logger.log.mock.calls.filter(([msg]) =>
      typeof msg === 'string' && msg.includes('WA relatório enviado'),
    );
    expect(sucessoLogs.length).toBe(1);
  });

  it('transporte falha (equivalente ao 404 histórico) → não loga sucesso; falha fica visível', async () => {
    // O que a fachada lançaria hoje ao receber non-2xx do whatsapp-service.
    waSender.enviarMensagem.mockRejectedValue(
      new Error('Erro ao enviar mensagem WhatsApp: 404 Cannot POST /api/send'),
    );

    await service.enviarRelatorioAposAprovacao('fat-1');

    // Fachada foi chamada — não houve bypass silencioso.
    expect(waSender.enviarMensagem).toHaveBeenCalledTimes(1);
    // "Sucesso" NUNCA é logado — regressão do Achado 2 quebra aqui.
    const sucessoLogs = logger.log.mock.calls.filter(([msg]) =>
      typeof msg === 'string' && msg.includes('WA relatório enviado'),
    );
    expect(sucessoLogs.length).toBe(0);
    // A falha aparece no warn (visibilidade — nenhum silêncio).
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Falha ao enviar WA'),
    );
  });

  it('fachada reporta enviado=false (whitelist dev, número protegido) → não loga sucesso', async () => {
    waSender.enviarMensagem.mockResolvedValue({ enviado: false, motivo: 'whitelist-dev' });

    await service.enviarRelatorioAposAprovacao('fat-1');

    expect(waSender.enviarMensagem).toHaveBeenCalledTimes(1);
    const sucessoLogs = logger.log.mock.calls.filter(([msg]) =>
      typeof msg === 'string' && msg.includes('WA relatório enviado'),
    );
    expect(sucessoLogs.length).toBe(0);
    // Loga NÃO enviado com motivo (rastreabilidade — não silêncio).
    expect(logger.log).toHaveBeenCalledWith(
      expect.stringContaining('NÃO enviado'),
    );
  });
});
