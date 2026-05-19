import { WhatsappFluxoMotorService } from './whatsapp-fluxo-motor.service';

describe('WhatsappFluxoMotorService — isolamento multi-tenant em runtime', () => {
  let service: WhatsappFluxoMotorService;
  const etapaFindFirst = jest.fn();
  const modeloFindFirst = jest.fn();
  const conversaUpdate = jest.fn();
  const enviarMensagem = jest.fn();
  const incrementarUso = jest.fn();

  const prismaMock: any = {
    fluxoEtapa: { findFirst: etapaFindFirst },
    modeloMensagem: { findFirst: modeloFindFirst, findUnique: jest.fn() },
    conversaWhatsapp: { update: conversaUpdate },
  };
  const modeloMensagemMock: any = { incrementarUso };
  const senderMock: any = { enviarMensagem };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new WhatsappFluxoMotorService(prismaMock, modeloMensagemMock, senderMock);
  });

  describe('avaliarGatilhos() — função pura', () => {
    it('Match case-insensitive', () => {
      const r = service.avaliarGatilhos('ok', [{ resposta: 'OK', proximoEstado: 'X' }]);
      expect(r).toBe('X');
    });

    it('Wildcard * casa qualquer texto não-vazio', () => {
      const r = service.avaliarGatilhos('qualquer', [{ resposta: '*', proximoEstado: 'X' }]);
      expect(r).toBe('X');
    });

    it('Wildcard * NÃO casa texto vazio', () => {
      const r = service.avaliarGatilhos('', [{ resposta: '*', proximoEstado: 'X' }]);
      expect(r).toBeNull();
    });

    it('Retorna null quando nenhum gatilho bate', () => {
      const r = service.avaliarGatilhos('xyz', [{ resposta: 'OK', proximoEstado: 'X' }]);
      expect(r).toBeNull();
    });
  });

  describe('renderizarTemplate() — função pura', () => {
    it('Substitui variáveis simples', () => {
      const r = service.renderizarTemplate('Oi {{nome}}!', { nome: 'João' });
      expect(r).toBe('Oi João!');
    });

    it('Mesma variável aparece múltiplas vezes', () => {
      const r = service.renderizarTemplate('{{x}}-{{x}}', { x: 'A' });
      expect(r).toBe('A-A');
    });
  });

  describe('processarComFluxoDinamico() — propaga cooperativaId', () => {
    it('Conversa COM cooperativaId → buscarEtapa usa OR [tenant + null]', async () => {
      etapaFindFirst.mockResolvedValueOnce(null); // simula sem etapa, retorna false rápido

      const conversa = {
        id: 'c1',
        telefone: '5527981341348',
        estado: 'MENU',
        cooperativaId: 'coop-A',
      };
      await service.processarComFluxoDinamico(
        { telefone: conversa.telefone, tipo: 'texto', corpo: 'oi' },
        conversa,
      );

      const where = etapaFindFirst.mock.calls[0][0].where;
      expect(where).toMatchObject({
        estado: 'MENU',
        ativo: true,
        OR: [{ cooperativaId: 'coop-A' }, { cooperativaId: null }],
      });
    });

    it('Conversa SEM cooperativaId → buscarEtapa filtra cooperativaId: null (NÃO retorna qualquer etapa)', async () => {
      etapaFindFirst.mockResolvedValueOnce(null);

      const conversa = {
        id: 'c1',
        telefone: '5527981341348',
        estado: 'MENU',
        cooperativaId: null,
      };
      await service.processarComFluxoDinamico(
        { telefone: conversa.telefone, tipo: 'texto', corpo: 'oi' },
        conversa,
      );

      const where = etapaFindFirst.mock.calls[0][0].where;
      expect(where).toMatchObject({
        estado: 'MENU',
        ativo: true,
        cooperativaId: null,
      });
      expect(where).not.toHaveProperty('OR');
    });

    it('Modelo de mensagem do próximo estado também respeita escopo tenant', async () => {
      // 1ª chamada: encontra etapa atual com gatilho
      etapaFindFirst.mockResolvedValueOnce({
        id: 'e1',
        cooperativaId: 'coop-A',
        gatilhos: [{ resposta: 'OK', proximoEstado: 'PROXIMO' }],
        modeloMensagemId: null,
      });
      // 2ª chamada: encontra próxima etapa
      etapaFindFirst.mockResolvedValueOnce({
        id: 'e2',
        cooperativaId: 'coop-A',
        modeloMensagemId: 'm1',
        gatilhos: [],
        acaoAutomatica: null,
      });
      modeloFindFirst.mockResolvedValueOnce({
        id: 'm1',
        conteudo: 'mensagem',
        cooperativaId: 'coop-A',
      });
      conversaUpdate.mockResolvedValueOnce({});

      await service.processarComFluxoDinamico(
        { telefone: '+5527981341348', tipo: 'texto', corpo: 'OK' },
        { id: 'c1', telefone: '+5527981341348', estado: 'MENU', cooperativaId: 'coop-A' },
      );

      // modelo deve ser buscado com filtro tenant
      const where = modeloFindFirst.mock.calls[0][0].where;
      expect(where).toMatchObject({
        id: 'm1',
        OR: [{ cooperativaId: 'coop-A' }, { cooperativaId: null }],
      });
      expect(enviarMensagem).toHaveBeenCalled();
    });
  });
});
