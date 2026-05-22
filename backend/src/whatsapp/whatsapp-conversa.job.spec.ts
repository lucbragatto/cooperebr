import { WhatsappConversaJob } from './whatsapp-conversa.job';

describe('WhatsappConversaJob', () => {
  let job: WhatsappConversaJob;
  const conversaFindMany = jest.fn();
  const conversaUpdate = jest.fn();
  const conversaUpdateMany = jest.fn();
  const enviarMensagem = jest.fn();

  const prismaMock: any = {
    conversaWhatsapp: {
      findMany: conversaFindMany,
      update: conversaUpdate,
      updateMany: conversaUpdateMany,
    },
  };
  const senderMock: any = { enviarMensagem };

  beforeEach(() => {
    jest.clearAllMocks();
    job = new WhatsappConversaJob(prismaMock, senderMock);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  // ============================================================
  // Bloco 1.b Etapa B (22/05) — processarRetornosAgendados()
  // Cron @EVERY_HOUR escaneia conversas AGENDADO_RETORNO com
  // retornarEm <= agora e dentro do horario comercial 08-18h.
  // Transiciona pra MENU_COOPERADO (com cooperadoId) ou INICIAL
  // (lead) + envia mensagem curta de retorno.
  // ============================================================
  describe('processarRetornosAgendados()', () => {
    it('Fora do horario comercial (hora < 8): no-op, nao consulta banco', async () => {
      jest.useFakeTimers().setSystemTime(new Date(2026, 4, 22, 7, 30, 0));
      await job.processarRetornosAgendados();
      expect(conversaFindMany).not.toHaveBeenCalled();
      expect(conversaUpdate).not.toHaveBeenCalled();
      expect(enviarMensagem).not.toHaveBeenCalled();
    });

    it('Fora do horario comercial (hora >= 18): no-op', async () => {
      jest.useFakeTimers().setSystemTime(new Date(2026, 4, 22, 18, 0, 0));
      await job.processarRetornosAgendados();
      expect(conversaFindMany).not.toHaveBeenCalled();
    });

    it('Limite 08:00 dentro — consulta banco', async () => {
      jest.useFakeTimers().setSystemTime(new Date(2026, 4, 22, 8, 0, 0));
      conversaFindMany.mockResolvedValueOnce([]);
      await job.processarRetornosAgendados();
      expect(conversaFindMany).toHaveBeenCalledTimes(1);
    });

    it('Limite 17:59 dentro — consulta banco', async () => {
      jest.useFakeTimers().setSystemTime(new Date(2026, 4, 22, 17, 59, 0));
      conversaFindMany.mockResolvedValueOnce([]);
      await job.processarRetornosAgendados();
      expect(conversaFindMany).toHaveBeenCalledTimes(1);
    });

    it('Dentro do horario sem conversas AGENDADO_RETORNO: query feita, no-op', async () => {
      jest.useFakeTimers().setSystemTime(new Date(2026, 4, 22, 14, 0, 0));
      conversaFindMany.mockResolvedValueOnce([]);
      await job.processarRetornosAgendados();
      expect(conversaFindMany).toHaveBeenCalledWith({
        where: { estado: 'AGENDADO_RETORNO' },
      });
      expect(conversaUpdate).not.toHaveBeenCalled();
      expect(enviarMensagem).not.toHaveBeenCalled();
    });

    it('Conversa com retornarEm no FUTURO: nao processa', async () => {
      jest.useFakeTimers().setSystemTime(new Date(2026, 4, 22, 14, 0, 0));
      conversaFindMany.mockResolvedValueOnce([
        {
          id: 'c1',
          telefone: '+5527981341348',
          cooperadoId: 'coop-luciano',
          estado: 'AGENDADO_RETORNO',
          dadosTemp: {
            retornarEm: new Date(2026, 4, 23, 14, 0, 0).toISOString(),
          },
        },
      ]);
      await job.processarRetornosAgendados();
      expect(conversaUpdate).not.toHaveBeenCalled();
      expect(enviarMensagem).not.toHaveBeenCalled();
    });

    it('Conversa com retornarEm no PASSADO + cooperadoId: transiciona pra MENU_COOPERADO + envia msg', async () => {
      jest.useFakeTimers().setSystemTime(new Date(2026, 4, 22, 14, 0, 0));
      conversaFindMany.mockResolvedValueOnce([
        {
          id: 'c1',
          telefone: '+5527981341348',
          cooperadoId: 'coop-luciano',
          estado: 'AGENDADO_RETORNO',
          dadosTemp: {
            retornarEm: new Date(2026, 4, 21, 14, 0, 0).toISOString(),
          },
        },
      ]);
      await job.processarRetornosAgendados();
      expect(conversaUpdate).toHaveBeenCalledWith({
        where: { id: 'c1' },
        data: {
          estado: 'MENU_COOPERADO',
          dadosTemp: {},
        },
      });
      expect(enviarMensagem).toHaveBeenCalledWith(
        '+5527981341348',
        expect.stringMatching(/voltei|combinado/i),
      );
    });

    it('Conversa com retornarEm no PASSADO SEM cooperadoId (lead): transiciona pra INICIAL', async () => {
      jest.useFakeTimers().setSystemTime(new Date(2026, 4, 22, 14, 0, 0));
      conversaFindMany.mockResolvedValueOnce([
        {
          id: 'c2',
          telefone: '+5527000000000',
          cooperadoId: null,
          estado: 'AGENDADO_RETORNO',
          dadosTemp: {
            retornarEm: new Date(2026, 4, 20, 14, 0, 0).toISOString(),
          },
        },
      ]);
      await job.processarRetornosAgendados();
      const args = conversaUpdate.mock.calls[0][0];
      expect(args.where).toEqual({ id: 'c2' });
      expect(args.data.estado).toBe('INICIAL');
    });

    it('Preserva outros campos de dadosTemp ao limpar retornarEm', async () => {
      jest.useFakeTimers().setSystemTime(new Date(2026, 4, 22, 14, 0, 0));
      conversaFindMany.mockResolvedValueOnce([
        {
          id: 'c1',
          telefone: '+5527981341348',
          cooperadoId: 'coop-luciano',
          estado: 'AGENDADO_RETORNO',
          dadosTemp: {
            retornarEm: new Date(2026, 4, 21, 14, 0, 0).toISOString(),
            algumOutroCampo: 'preservar',
          },
        },
      ]);
      await job.processarRetornosAgendados();
      const dadosTempLimpo = conversaUpdate.mock.calls[0][0].data.dadosTemp;
      expect(dadosTempLimpo).not.toHaveProperty('retornarEm');
      expect(dadosTempLimpo).toEqual({ algumOutroCampo: 'preservar' });
    });

    it('Conversa sem dadosTemp.retornarEm: pula defensivo (sem update, sem envio)', async () => {
      jest.useFakeTimers().setSystemTime(new Date(2026, 4, 22, 14, 0, 0));
      conversaFindMany.mockResolvedValueOnce([
        {
          id: 'c1',
          telefone: '+5527981341348',
          cooperadoId: 'coop-luciano',
          estado: 'AGENDADO_RETORNO',
          dadosTemp: {},
        },
      ]);
      await job.processarRetornosAgendados();
      expect(conversaUpdate).not.toHaveBeenCalled();
      expect(enviarMensagem).not.toHaveBeenCalled();
    });

    it('Processa multiplas conversas vencidas independentemente', async () => {
      jest.useFakeTimers().setSystemTime(new Date(2026, 4, 22, 14, 0, 0));
      const passado = new Date(2026, 4, 21, 14, 0, 0).toISOString();
      conversaFindMany.mockResolvedValueOnce([
        {
          id: 'c1',
          telefone: '+5527111111111',
          cooperadoId: 'coop-A',
          estado: 'AGENDADO_RETORNO',
          dadosTemp: { retornarEm: passado },
        },
        {
          id: 'c2',
          telefone: '+5527222222222',
          cooperadoId: 'coop-B',
          estado: 'AGENDADO_RETORNO',
          dadosTemp: { retornarEm: passado },
        },
      ]);
      await job.processarRetornosAgendados();
      expect(conversaUpdate).toHaveBeenCalledTimes(2);
      expect(enviarMensagem).toHaveBeenCalledTimes(2);
    });
  });

  // ============================================================
  // Regressao Bloco 1.b — resetarConversasInativas() exclui
  // AGENDADO_RETORNO explicitamente (guard defensivo conforme
  // prompt Luciano).
  // ============================================================
  describe('resetarConversasInativas() — exclusao explicita de AGENDADO_RETORNO', () => {
    it('Where bloqueia explicitamente AGENDADO_RETORNO via notIn', async () => {
      jest.useFakeTimers().setSystemTime(new Date(2026, 4, 22, 14, 0, 0));
      conversaUpdateMany.mockResolvedValueOnce({ count: 0 });
      await job.resetarConversasInativas();

      const where = conversaUpdateMany.mock.calls[0][0].where;
      // Aceita 2 formatos: AND-array ou notIn direto no estado.
      const whereStr = JSON.stringify(where);
      expect(whereStr).toContain('AGUARDANDO_');
      expect(whereStr).toMatch(/AGENDADO_RETORNO/);
    });

    it('Comportamento original preservado: reseta AGUARDANDO_* > 24h pra INICIAL', async () => {
      jest.useFakeTimers().setSystemTime(new Date(2026, 4, 22, 14, 0, 0));
      conversaUpdateMany.mockResolvedValueOnce({ count: 3 });
      await job.resetarConversasInativas();

      const args = conversaUpdateMany.mock.calls[0][0];
      const whereStr = JSON.stringify(args.where);
      expect(whereStr).toContain('AGUARDANDO_');
      expect(args.data.estado).toBe('INICIAL');
    });
  });
});
