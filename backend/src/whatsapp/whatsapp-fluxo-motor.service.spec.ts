import { WhatsappFluxoMotorService } from './whatsapp-fluxo-motor.service';

describe('WhatsappFluxoMotorService - isolamento multi-tenant em runtime', () => {
  let service: WhatsappFluxoMotorService;
  const etapaFindFirst = jest.fn();
  const modeloFindFirst = jest.fn();
  const conversaUpdate = jest.fn();
  const cooperativaFindUnique = jest.fn();
  const enviarMensagem = jest.fn();
  const incrementarUso = jest.fn();

  const prismaMock: any = {
    fluxoEtapa: { findFirst: etapaFindFirst },
    modeloMensagem: { findFirst: modeloFindFirst, findUnique: jest.fn() },
    conversaWhatsapp: { update: conversaUpdate },
    cooperativa: { findUnique: cooperativaFindUnique },
  };
  const modeloMensagemMock: any = { incrementarUso };
  const senderMock: any = { enviarMensagem };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new WhatsappFluxoMotorService(prismaMock, modeloMensagemMock, senderMock);
  });

  // ============================================================
  // Funcoes puras (Fase 1)
  // ============================================================
  describe('avaliarGatilhos() - funcao pura', () => {
    it('Match case-insensitive', () => {
      const r = service.avaliarGatilhos('ok', [{ resposta: 'OK', proximoEstado: 'X' }]);
      expect(r).toBe('X');
    });

    it('Wildcard * casa qualquer texto nao-vazio', () => {
      const r = service.avaliarGatilhos('qualquer', [{ resposta: '*', proximoEstado: 'X' }]);
      expect(r).toBe('X');
    });

    it('Wildcard * NAO casa texto vazio', () => {
      const r = service.avaliarGatilhos('', [{ resposta: '*', proximoEstado: 'X' }]);
      expect(r).toBeNull();
    });

    it('Retorna null quando nenhum gatilho bate', () => {
      const r = service.avaliarGatilhos('xyz', [{ resposta: 'OK', proximoEstado: 'X' }]);
      expect(r).toBeNull();
    });
  });

  describe('renderizarTemplate() - funcao pura', () => {
    it('Substitui variaveis simples', () => {
      const r = service.renderizarTemplate('Oi {{nome}}!', { nome: 'Joao' });
      expect(r).toBe('Oi Joao!');
    });

    it('Mesma variavel aparece multiplas vezes', () => {
      const r = service.renderizarTemplate('{{x}}-{{x}}', { x: 'A' });
      expect(r).toBe('A-A');
    });
  });

  // ============================================================
  // Isolamento Fase 1 - propagacao de cooperativaId em buscarEtapa
  // ============================================================
  describe('processarComFluxoDinamico() - propaga cooperativaId', () => {
    it('Conversa COM cooperativaId -> buscarEtapa usa OR [tenant + null]', async () => {
      etapaFindFirst.mockResolvedValueOnce(null);

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

    it('Conversa SEM cooperativaId -> buscarEtapa filtra cooperativaId: null (NAO retorna qualquer etapa)', async () => {
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

    it('Modelo de mensagem do proximo estado tambem respeita escopo tenant', async () => {
      etapaFindFirst.mockResolvedValueOnce({
        id: 'e1',
        cooperativaId: 'coop-A',
        gatilhos: [{ resposta: 'OK', proximoEstado: 'PROXIMO' }],
        modeloMensagemId: null,
      });
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
      cooperativaFindUnique.mockResolvedValueOnce({
        nome: 'CoopereBR',
        email: null,
        telefone: null,
        cidade: null,
        estado: null,
        tipoParceiro: 'COOPERATIVA',
      });
      conversaUpdate.mockResolvedValueOnce({});

      await service.processarComFluxoDinamico(
        { telefone: '+5527981341348', tipo: 'texto', corpo: 'OK' },
        { id: 'c1', telefone: '+5527981341348', estado: 'MENU', cooperativaId: 'coop-A' },
      );

      const where = modeloFindFirst.mock.calls[0][0].where;
      expect(where).toMatchObject({
        id: 'm1',
        OR: [{ cooperativaId: 'coop-A' }, { cooperativaId: null }],
      });
      expect(enviarMensagem).toHaveBeenCalled();
    });
  });

  // ============================================================
  // Fase 2 - Variaveis de tenant em templates
  // ============================================================
  describe('extrairVariaveis() - variaveis de tenant', () => {
    it('Sem cooperativa carregada -> variaveis de tenant retornam string vazia (sem crash)', () => {
      const vars = service.extrairVariaveis({ dadosTemp: { titular: 'Joao' } }, null);
      expect(vars.parceiro).toBe('');
      expect(vars.cooperativa).toBe('');
      expect(vars.cidade).toBe('');
      expect(vars.estado_parceiro).toBe('');
      expect(vars.email_suporte).toBe('');
      expect(vars.telefone_suporte).toBe('');
      expect(vars.tipo_parceiro).toBe('');
      expect(vars.site).toBe('');
      expect(vars.nome).toBe('Joao');
    });

    it('Cooperativa undefined (parametro omitido) tambem cai em fallback vazio', () => {
      const vars = service.extrairVariaveis({ dadosTemp: {} });
      expect(vars.parceiro).toBe('');
      expect(vars.cidade).toBe('');
    });

    it('Cooperativa carregada -> variaveis de tenant populadas corretamente', () => {
      const vars = service.extrairVariaveis(
        { dadosTemp: { titular: 'Maria' } },
        {
          nome: 'CoopereBR',
          email: 'contato@cooperebr.com.br',
          telefone: '27999999999',
          cidade: 'Vitoria',
          estado: 'ES',
          tipoParceiro: 'COOPERATIVA',
        },
      );
      expect(vars.parceiro).toBe('CoopereBR');
      expect(vars.cooperativa).toBe('CoopereBR');
      expect(vars.cidade).toBe('Vitoria');
      expect(vars.estado_parceiro).toBe('ES');
      expect(vars.email_suporte).toBe('contato@cooperebr.com.br');
      expect(vars.telefone_suporte).toBe('27999999999');
      expect(vars.tipo_parceiro).toBe('COOPERATIVA');
    });

    it('Campos opcionais null da Cooperativa viram string vazia (nao literal "null")', () => {
      const vars = service.extrairVariaveis(
        { dadosTemp: {} },
        {
          nome: 'Cooperativa X',
          email: null,
          telefone: null,
          cidade: null,
          estado: null,
          tipoParceiro: 'CONSORCIO',
        },
      );
      expect(vars.parceiro).toBe('Cooperativa X');
      expect(vars.cidade).toBe('');
      expect(vars.email_suporte).toBe('');
      expect(vars.telefone_suporte).toBe('');
      expect(vars.cidade).not.toBe('null');
      expect(vars.email_suporte).not.toBe('null');
    });

    it('ISOLAMENTO: {{parceiro}} de tenant A NUNCA aparece em template renderizado pra tenant B', () => {
      const template = 'Ola {{nome}}, fale com {{parceiro}}!';

      const varsTenantA = service.extrairVariaveis(
        { dadosTemp: { titular: 'Joao' } },
        {
          nome: 'CoopereBR',
          email: null,
          telefone: null,
          cidade: 'Vitoria',
          estado: 'ES',
          tipoParceiro: 'COOPERATIVA',
        },
      );
      const textoA = service.renderizarTemplate(template, varsTenantA);
      expect(textoA).toBe('Ola Joao, fale com CoopereBR!');

      const varsTenantB = service.extrairVariaveis(
        { dadosTemp: { titular: 'Maria' } },
        {
          nome: 'Hangar Academia',
          email: null,
          telefone: null,
          cidade: 'Vila Velha',
          estado: 'ES',
          tipoParceiro: 'ASSOCIACAO',
        },
      );
      const textoB = service.renderizarTemplate(template, varsTenantB);
      expect(textoB).toBe('Ola Maria, fale com Hangar Academia!');

      expect(varsTenantB.parceiro).not.toContain('CoopereBR');
      expect(varsTenantA.parceiro).not.toContain('Hangar');
    });
  });

  describe('processarComFluxoDinamico() - carregamento de cooperativa', () => {
    it('Conversa COM cooperativaId -> carrega cooperativa 1x e injeta nas variaveis renderizadas', async () => {
      etapaFindFirst.mockResolvedValueOnce({
        id: 'e1',
        cooperativaId: 'coop-A',
        gatilhos: [{ resposta: 'OK', proximoEstado: 'PROX' }],
        modeloMensagemId: null,
      });
      etapaFindFirst.mockResolvedValueOnce({
        id: 'e2',
        cooperativaId: 'coop-A',
        modeloMensagemId: 'm1',
        gatilhos: [],
        acaoAutomatica: null,
      });
      modeloFindFirst.mockResolvedValueOnce({
        id: 'm1',
        conteudo: 'Oi {{nome}}, bem-vindo a {{parceiro}}!',
        cooperativaId: null,
      });
      cooperativaFindUnique.mockResolvedValueOnce({
        nome: 'CoopereBR',
        email: null,
        telefone: null,
        cidade: null,
        estado: null,
        tipoParceiro: 'COOPERATIVA',
      });
      conversaUpdate.mockResolvedValueOnce({});

      await service.processarComFluxoDinamico(
        { telefone: '+5527981341348', tipo: 'texto', corpo: 'OK' },
        {
          id: 'c1',
          telefone: '+5527981341348',
          estado: 'MENU',
          cooperativaId: 'coop-A',
          dadosTemp: { titular: 'Luciano' },
        },
      );

      expect(cooperativaFindUnique).toHaveBeenCalledTimes(1);
      expect(cooperativaFindUnique).toHaveBeenCalledWith({
        where: { id: 'coop-A' },
        select: expect.objectContaining({
          nome: true,
          email: true,
          telefone: true,
          cidade: true,
          estado: true,
          tipoParceiro: true,
        }),
      });
      expect(enviarMensagem).toHaveBeenCalledWith(
        '+5527981341348',
        'Oi Luciano, bem-vindo a CoopereBR!',
      );
    });

    it('Conversa SEM cooperativaId -> nao carrega cooperativa; {{parceiro}} renderiza vazio (fallback)', async () => {
      etapaFindFirst.mockResolvedValueOnce({
        id: 'e1',
        cooperativaId: null,
        gatilhos: [{ resposta: 'OK', proximoEstado: 'PROX' }],
        modeloMensagemId: null,
      });
      etapaFindFirst.mockResolvedValueOnce({
        id: 'e2',
        cooperativaId: null,
        modeloMensagemId: 'm1',
        gatilhos: [],
        acaoAutomatica: null,
      });
      modeloFindFirst.mockResolvedValueOnce({
        id: 'm1',
        conteudo: 'Oi {{nome}}, fale com {{parceiro}}',
        cooperativaId: null,
      });
      conversaUpdate.mockResolvedValueOnce({});

      await service.processarComFluxoDinamico(
        { telefone: '+5527981341348', tipo: 'texto', corpo: 'OK' },
        {
          id: 'c1',
          telefone: '+5527981341348',
          estado: 'MENU',
          cooperativaId: null,
          dadosTemp: { titular: 'Anonimo' },
        },
      );

      expect(cooperativaFindUnique).not.toHaveBeenCalled();
      expect(enviarMensagem).toHaveBeenCalledWith(
        '+5527981341348',
        'Oi Anonimo, fale com ',
      );
    });

    it('Cooperativa referenciada nao existe (id quebrado) -> fallback vazio, motor nao crasha', async () => {
      etapaFindFirst.mockResolvedValueOnce({
        id: 'e1',
        cooperativaId: 'coop-zumbi',
        gatilhos: [{ resposta: 'OK', proximoEstado: 'PROX' }],
        modeloMensagemId: null,
      });
      etapaFindFirst.mockResolvedValueOnce({
        id: 'e2',
        cooperativaId: 'coop-zumbi',
        modeloMensagemId: 'm1',
        gatilhos: [],
        acaoAutomatica: null,
      });
      modeloFindFirst.mockResolvedValueOnce({
        id: 'm1',
        conteudo: 'Oi {{nome}}, parceiro: {{parceiro}}',
        cooperativaId: null,
      });
      cooperativaFindUnique.mockResolvedValueOnce(null);
      conversaUpdate.mockResolvedValueOnce({});

      await expect(
        service.processarComFluxoDinamico(
          { telefone: '+5527981341348', tipo: 'texto', corpo: 'OK' },
          {
            id: 'c1',
            telefone: '+5527981341348',
            estado: 'MENU',
            cooperativaId: 'coop-zumbi',
            dadosTemp: { titular: 'Teste' },
          },
        ),
      ).resolves.toBe(true);

      expect(enviarMensagem).toHaveBeenCalledWith(
        '+5527981341348',
        'Oi Teste, parceiro: ',
      );
    });
  });

  // ============================================================
  // Fase 3 - Simulacao in-memory (zero side effect)
  // ============================================================
  describe('simular() - preview de fluxo sem disparar Baileys', () => {
    it('Sem etapa para estado inicial -> retorna transicionou=false + motivoFallback', async () => {
      etapaFindFirst.mockResolvedValueOnce(null);

      const r = await service.simular({
        mensagem: 'oi',
        cooperativaId: 'coop-A',
        estadoInicial: 'ESTADO_INEXISTENTE',
      });

      expect(r.transicionou).toBe(false);
      expect(r.estadoFinal).toBe('ESTADO_INEXISTENTE');
      expect(r.gatilhoAvaliado).toBeNull();
      expect(r.motivoFallback).toContain('Nenhuma etapa dinamica');
      expect(r.mensagensEnviadas).toEqual([]);
    });

    it('Nenhum gatilho bateu -> transicionou=false + motivoFallback', async () => {
      etapaFindFirst.mockResolvedValueOnce({
        id: 'e1',
        cooperativaId: 'coop-A',
        gatilhos: [{ resposta: 'OK', proximoEstado: 'P' }],
        modeloMensagemId: null,
      });

      const r = await service.simular({
        mensagem: 'xyz',
        cooperativaId: 'coop-A',
        estadoInicial: 'MENU',
      });

      expect(r.transicionou).toBe(false);
      expect(r.motivoFallback).toContain('Nenhum gatilho');
    });

    it('Simulacao bem-sucedida -> retorna sequencia com texto renderizado + variaveis tenant da Fase 2', async () => {
      etapaFindFirst.mockResolvedValueOnce({
        id: 'e1',
        cooperativaId: 'coop-A',
        gatilhos: [{ resposta: 'OK', proximoEstado: 'PROX' }],
        modeloMensagemId: null,
      });
      etapaFindFirst.mockResolvedValueOnce({
        id: 'e2',
        cooperativaId: 'coop-A',
        modeloMensagemId: 'm1',
        gatilhos: [],
        acaoAutomatica: 'CRIAR_LEAD',
      });
      modeloFindFirst.mockResolvedValueOnce({
        id: 'm1',
        nome: 'boas_vindas',
        conteudo: 'Oi {{nome}}, bem-vindo a {{parceiro}} de {{cidade}}!',
        cooperativaId: null,
      });
      cooperativaFindUnique.mockResolvedValueOnce({
        nome: 'CoopereBR',
        email: null,
        telefone: null,
        cidade: 'Vitoria',
        estado: 'ES',
        tipoParceiro: 'COOPERATIVA',
      });

      const r = await service.simular({
        mensagem: 'OK',
        cooperativaId: 'coop-A',
        estadoInicial: 'MENU',
        dadosTemp: { titular: 'Luciano' },
      });

      expect(r.transicionou).toBe(true);
      expect(r.estadoFinal).toBe('PROX');
      expect(r.gatilhoAvaliado).toBe('OK');
      expect(r.mensagensEnviadas).toHaveLength(1);
      expect(r.mensagensEnviadas[0].texto).toBe('Oi Luciano, bem-vindo a CoopereBR de Vitoria!');
      expect(r.mensagensEnviadas[0].modeloId).toBe('m1');
      expect(r.mensagensEnviadas[0].modeloNome).toBe('boas_vindas');
      expect(r.acaoAutomatica).toBe('CRIAR_LEAD');
    });

    it('ZERO side effect: nao chama conversaWhatsapp.update, nao chama sender, nao incrementa uso', async () => {
      etapaFindFirst.mockResolvedValueOnce({
        id: 'e1',
        cooperativaId: 'coop-A',
        gatilhos: [{ resposta: 'OK', proximoEstado: 'PROX' }],
        modeloMensagemId: null,
      });
      etapaFindFirst.mockResolvedValueOnce({
        id: 'e2',
        cooperativaId: 'coop-A',
        modeloMensagemId: 'm1',
        gatilhos: [],
        acaoAutomatica: null,
      });
      modeloFindFirst.mockResolvedValueOnce({
        id: 'm1',
        nome: 'msg',
        conteudo: 'Oi {{nome}}',
        cooperativaId: 'coop-A',
      });
      cooperativaFindUnique.mockResolvedValueOnce({
        nome: 'CoopereBR',
        email: null,
        telefone: null,
        cidade: null,
        estado: null,
        tipoParceiro: 'COOPERATIVA',
      });

      await service.simular({
        mensagem: 'OK',
        cooperativaId: 'coop-A',
        estadoInicial: 'MENU',
        dadosTemp: { titular: 'X' },
      });

      // Garantias criticas: nada de side effect
      expect(conversaUpdate).not.toHaveBeenCalled();
      expect(enviarMensagem).not.toHaveBeenCalled();
      expect(incrementarUso).not.toHaveBeenCalled();
    });

    it('ISOLAMENTO: simular sem cooperativaId -> nao carrega cooperativa; variaveis tenant ficam vazias', async () => {
      etapaFindFirst.mockResolvedValueOnce({
        id: 'e1',
        cooperativaId: null,
        gatilhos: [{ resposta: 'OK', proximoEstado: 'PROX' }],
        modeloMensagemId: null,
      });
      etapaFindFirst.mockResolvedValueOnce({
        id: 'e2',
        cooperativaId: null,
        modeloMensagemId: 'm1',
        gatilhos: [],
        acaoAutomatica: null,
      });
      modeloFindFirst.mockResolvedValueOnce({
        id: 'm1',
        nome: 'msg',
        conteudo: 'Oi {{nome}}, parceiro: [{{parceiro}}]',
        cooperativaId: null,
      });

      const r = await service.simular({
        mensagem: 'OK',
        estadoInicial: 'MENU',
        dadosTemp: { titular: 'Anonimo' },
      });

      expect(cooperativaFindUnique).not.toHaveBeenCalled();
      expect(r.mensagensEnviadas[0].texto).toBe('Oi Anonimo, parceiro: []');
      // E o filtro de etapa usou cooperativaId: null (so globais)
      const where = etapaFindFirst.mock.calls[0][0].where;
      expect(where).toMatchObject({ cooperativaId: null });
    });

    it('ISOLAMENTO: simular como tenant A NAO renderiza variaveis de tenant B', async () => {
      // Tenant A simula primeiro
      etapaFindFirst.mockResolvedValueOnce({
        id: 'e1',
        cooperativaId: 'coop-A',
        gatilhos: [{ resposta: 'OK', proximoEstado: 'PROX' }],
        modeloMensagemId: null,
      });
      etapaFindFirst.mockResolvedValueOnce({
        id: 'e2',
        cooperativaId: 'coop-A',
        modeloMensagemId: 'm1',
        gatilhos: [],
        acaoAutomatica: null,
      });
      modeloFindFirst.mockResolvedValueOnce({
        id: 'm1',
        nome: 'msg',
        conteudo: 'Parceiro: {{parceiro}}',
        cooperativaId: null,
      });
      cooperativaFindUnique.mockResolvedValueOnce({
        nome: 'CoopereBR',
        email: null,
        telefone: null,
        cidade: null,
        estado: null,
        tipoParceiro: 'COOPERATIVA',
      });

      const rA = await service.simular({
        mensagem: 'OK',
        cooperativaId: 'coop-A',
        estadoInicial: 'MENU',
      });
      expect(rA.mensagensEnviadas[0].texto).toBe('Parceiro: CoopereBR');

      // Tenant B simula em seguida — vars devem ser de B, nunca de A
      etapaFindFirst.mockResolvedValueOnce({
        id: 'e3',
        cooperativaId: 'coop-B',
        gatilhos: [{ resposta: 'OK', proximoEstado: 'PROX' }],
        modeloMensagemId: null,
      });
      etapaFindFirst.mockResolvedValueOnce({
        id: 'e4',
        cooperativaId: 'coop-B',
        modeloMensagemId: 'm2',
        gatilhos: [],
        acaoAutomatica: null,
      });
      modeloFindFirst.mockResolvedValueOnce({
        id: 'm2',
        nome: 'msg',
        conteudo: 'Parceiro: {{parceiro}}',
        cooperativaId: null,
      });
      cooperativaFindUnique.mockResolvedValueOnce({
        nome: 'Hangar Academia',
        email: null,
        telefone: null,
        cidade: null,
        estado: null,
        tipoParceiro: 'ASSOCIACAO',
      });

      const rB = await service.simular({
        mensagem: 'OK',
        cooperativaId: 'coop-B',
        estadoInicial: 'MENU',
      });
      expect(rB.mensagensEnviadas[0].texto).toBe('Parceiro: Hangar Academia');
      expect(rB.mensagensEnviadas[0].texto).not.toContain('CoopereBR');
    });
  });
});
