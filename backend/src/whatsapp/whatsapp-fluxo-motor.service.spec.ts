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
  // Fase 1 - Funcoes puras
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
  // Fase 1 - Isolamento via cooperativaId no buscarEtapa
  // ============================================================
  describe('processarComFluxoDinamico() - propaga cooperativaId', () => {
    it('Conversa COM cooperativaId -> buscarEtapa busca tenant primeiro com filtro exato', async () => {
      // 2 queries: 1a tenant (retorna null), 2a global (tambem null)
      etapaFindFirst.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
      await service.processarComFluxoDinamico(
        { telefone: '5527981341348', tipo: 'texto', corpo: 'oi' },
        { id: 'c1', telefone: '5527981341348', estado: 'MENU', cooperativaId: 'coop-A' },
      );
      // 1a chamada: filtra cooperativaId exato do tenant (sem OR)
      const whereTenant = etapaFindFirst.mock.calls[0][0].where;
      expect(whereTenant).toMatchObject({
        estado: 'MENU',
        ativo: true,
        cooperativaId: 'coop-A',
      });
      expect(whereTenant).not.toHaveProperty('OR');
      // 2a chamada (fallback): filtra cooperativaId null
      const whereGlobal = etapaFindFirst.mock.calls[1][0].where;
      expect(whereGlobal).toMatchObject({
        estado: 'MENU',
        ativo: true,
        cooperativaId: null,
      });
    });

    it('Conversa SEM cooperativaId -> buscarEtapa filtra cooperativaId: null direto (1 query)', async () => {
      etapaFindFirst.mockResolvedValueOnce(null);
      await service.processarComFluxoDinamico(
        { telefone: '5527981341348', tipo: 'texto', corpo: 'oi' },
        { id: 'c1', telefone: '5527981341348', estado: 'MENU', cooperativaId: null },
      );
      expect(etapaFindFirst).toHaveBeenCalledTimes(1);
      const where = etapaFindFirst.mock.calls[0][0].where;
      expect(where).toMatchObject({ estado: 'MENU', ativo: true, cooperativaId: null });
      expect(where).not.toHaveProperty('OR');
    });

    it('REGRESSION D-novo-Q: tenant com ordem alta vence global com ordem baixa', async () => {
      // Cenario do bug em producao (19/05): "Receber fatura" global ordem=1 ativa 0 gatilhos
      // venceria "Entrada Dinamica" tenant ordem=28 ativa 3 gatilhos no OR antigo + orderBy asc.
      // Com 2 queries explicitas, tenant SEMPRE vence se existir.
      etapaFindFirst.mockResolvedValueOnce({
        id: 'entrada-dinamica',
        cooperativaId: 'coop-A',
        nome: 'Entrada Dinamica',
        ordem: 28,
        estado: 'INICIAL',
        gatilhos: [{ resposta: '1', proximoEstado: 'MENU_COOPERADO' }],
        modeloMensagemId: null,
        ativo: true,
      });

      await service.processarComFluxoDinamico(
        { telefone: '+5527981341348', tipo: 'texto', corpo: '1' },
        { id: 'c1', telefone: '+5527981341348', estado: 'INICIAL', cooperativaId: 'coop-A' },
      );

      // Etapa atual: 1 query tenant (achou). Proxima etapa MENU_COOPERADO: 2 queries (tenant vazio + global vazio).
      // Total = 3 chamadas. O ponto chave do teste e a 1a query: deve ser tenant, sem OR.
      expect(etapaFindFirst).toHaveBeenCalled();
      const whereTenant = etapaFindFirst.mock.calls[0][0].where;
      expect(whereTenant.cooperativaId).toBe('coop-A');
      expect(whereTenant).not.toHaveProperty('OR');
      expect(conversaUpdate).toHaveBeenCalledWith({
        where: { id: 'c1' },
        data: { estado: 'MENU_COOPERADO' },
      });
    });

    it('Quando tenant NAO tem etapa para o estado, fallback global ativa', async () => {
      // 1a query (tenant): vazio
      etapaFindFirst.mockResolvedValueOnce(null);
      // 2a query (global): etapa template padrao
      etapaFindFirst.mockResolvedValueOnce({
        id: 'global-1',
        cooperativaId: null,
        nome: 'Template Padrao',
        ordem: 1,
        estado: 'MENU',
        gatilhos: [{ resposta: 'OK', proximoEstado: 'X' }],
        modeloMensagemId: null,
        ativo: true,
      });
      // 3a/4a queries da proxima etapa
      etapaFindFirst.mockResolvedValueOnce(null).mockResolvedValueOnce(null);

      await service.processarComFluxoDinamico(
        { telefone: '+5527981341348', tipo: 'texto', corpo: 'OK' },
        { id: 'c1', telefone: '+5527981341348', estado: 'MENU', cooperativaId: 'coop-A' },
      );

      expect(etapaFindFirst.mock.calls[0][0].where.cooperativaId).toBe('coop-A');
      expect(etapaFindFirst.mock.calls[1][0].where.cooperativaId).toBe(null);
      expect(conversaUpdate).toHaveBeenCalled();
    });

    it('Modelo do proximo estado tambem respeita escopo tenant', async () => {
      etapaFindFirst.mockResolvedValueOnce({
        id: 'e1', cooperativaId: 'coop-A',
        gatilhos: [{ resposta: 'OK', proximoEstado: 'PROXIMO' }],
        modeloMensagemId: null,
      });
      etapaFindFirst.mockResolvedValueOnce({
        id: 'e2', cooperativaId: 'coop-A', modeloMensagemId: 'm1',
        gatilhos: [], acaoAutomatica: null,
      });
      modeloFindFirst.mockResolvedValueOnce({ id: 'm1', conteudo: 'mensagem', cooperativaId: 'coop-A' });
      cooperativaFindUnique.mockResolvedValueOnce({
        nome: 'CoopereBR', email: null, telefone: null,
        cidade: null, estado: null, tipoParceiro: 'COOPERATIVA',
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
  // (+ Fase 6 adendo: tipo_membro / tipo_membro_plural)
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
      // Fase 6 - sem tipo, fallback "membro"/"membros"
      expect(vars.tipo_membro).toBe('membro');
      expect(vars.tipo_membro_plural).toBe('membros');
    });

    it('Cooperativa undefined (parametro omitido) tambem cai em fallback vazio', () => {
      const vars = service.extrairVariaveis({ dadosTemp: {} });
      expect(vars.parceiro).toBe('');
      expect(vars.cidade).toBe('');
      expect(vars.tipo_membro).toBe('membro');
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
      // Fase 6 - tipo_membro derivado do tipoParceiro
      expect(vars.tipo_membro).toBe('cooperado');
      expect(vars.tipo_membro_plural).toBe('cooperados');
    });

    // Fase 6 - mapeamento explicito para cada tipoParceiro do helper
    it.each([
      ['COOPERATIVA', 'cooperado', 'cooperados'],
      ['CONSORCIO', 'consorciado', 'consorciados'],
      ['ASSOCIACAO', 'associado', 'associados'],
      ['CONDOMINIO', 'condômino', 'condôminos'],
      ['DESCONHECIDO', 'membro', 'membros'],
    ])('tipo_membro / tipo_membro_plural para tipoParceiro=%s -> %s / %s', (tipo, singular, plural) => {
      const vars = service.extrairVariaveis(
        { dadosTemp: {} },
        {
          nome: 'X', email: null, telefone: null,
          cidade: null, estado: null, tipoParceiro: tipo,
        },
      );
      expect(vars.tipo_membro).toBe(singular);
      expect(vars.tipo_membro_plural).toBe(plural);
    });

    it('Campos opcionais null da Cooperativa viram string vazia (nao literal "null")', () => {
      const vars = service.extrairVariaveis(
        { dadosTemp: {} },
        {
          nome: 'Cooperativa X', email: null, telefone: null,
          cidade: null, estado: null, tipoParceiro: 'CONSORCIO',
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
        { nome: 'CoopereBR', email: null, telefone: null, cidade: 'Vitoria', estado: 'ES', tipoParceiro: 'COOPERATIVA' },
      );
      const textoA = service.renderizarTemplate(template, varsTenantA);
      expect(textoA).toBe('Ola Joao, fale com CoopereBR!');

      const varsTenantB = service.extrairVariaveis(
        { dadosTemp: { titular: 'Maria' } },
        { nome: 'Hangar Academia', email: null, telefone: null, cidade: 'Vila Velha', estado: 'ES', tipoParceiro: 'ASSOCIACAO' },
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
        id: 'e1', cooperativaId: 'coop-A',
        gatilhos: [{ resposta: 'OK', proximoEstado: 'PROX' }],
        modeloMensagemId: null,
      });
      etapaFindFirst.mockResolvedValueOnce({
        id: 'e2', cooperativaId: 'coop-A', modeloMensagemId: 'm1',
        gatilhos: [], acaoAutomatica: null,
      });
      modeloFindFirst.mockResolvedValueOnce({
        id: 'm1', conteudo: 'Oi {{nome}}, bem-vindo a {{parceiro}}!', cooperativaId: null,
      });
      cooperativaFindUnique.mockResolvedValueOnce({
        nome: 'CoopereBR', email: null, telefone: null,
        cidade: null, estado: null, tipoParceiro: 'COOPERATIVA',
      });
      conversaUpdate.mockResolvedValueOnce({});

      await service.processarComFluxoDinamico(
        { telefone: '+5527981341348', tipo: 'texto', corpo: 'OK' },
        { id: 'c1', telefone: '+5527981341348', estado: 'MENU', cooperativaId: 'coop-A', dadosTemp: { titular: 'Luciano' } },
      );

      expect(cooperativaFindUnique).toHaveBeenCalledTimes(1);
      expect(cooperativaFindUnique).toHaveBeenCalledWith({
        where: { id: 'coop-A' },
        select: expect.objectContaining({
          nome: true, email: true, telefone: true,
          cidade: true, estado: true, tipoParceiro: true,
        }),
      });
      expect(enviarMensagem).toHaveBeenCalledWith('+5527981341348', 'Oi Luciano, bem-vindo a CoopereBR!');
    });

    it('Conversa SEM cooperativaId -> nao carrega cooperativa; {{parceiro}} vazio', async () => {
      etapaFindFirst.mockResolvedValueOnce({
        id: 'e1', cooperativaId: null,
        gatilhos: [{ resposta: 'OK', proximoEstado: 'PROX' }],
        modeloMensagemId: null,
      });
      etapaFindFirst.mockResolvedValueOnce({
        id: 'e2', cooperativaId: null, modeloMensagemId: 'm1',
        gatilhos: [], acaoAutomatica: null,
      });
      modeloFindFirst.mockResolvedValueOnce({
        id: 'm1', conteudo: 'Oi {{nome}}, fale com {{parceiro}}', cooperativaId: null,
      });
      conversaUpdate.mockResolvedValueOnce({});

      await service.processarComFluxoDinamico(
        { telefone: '+5527981341348', tipo: 'texto', corpo: 'OK' },
        { id: 'c1', telefone: '+5527981341348', estado: 'MENU', cooperativaId: null, dadosTemp: { titular: 'Anonimo' } },
      );

      expect(cooperativaFindUnique).not.toHaveBeenCalled();
      expect(enviarMensagem).toHaveBeenCalledWith('+5527981341348', 'Oi Anonimo, fale com ');
    });

    it('Cooperativa referenciada nao existe -> fallback vazio, motor nao crasha', async () => {
      etapaFindFirst.mockResolvedValueOnce({
        id: 'e1', cooperativaId: 'coop-zumbi',
        gatilhos: [{ resposta: 'OK', proximoEstado: 'PROX' }],
        modeloMensagemId: null,
      });
      etapaFindFirst.mockResolvedValueOnce({
        id: 'e2', cooperativaId: 'coop-zumbi', modeloMensagemId: 'm1',
        gatilhos: [], acaoAutomatica: null,
      });
      modeloFindFirst.mockResolvedValueOnce({
        id: 'm1', conteudo: 'Oi {{nome}}, parceiro: {{parceiro}}', cooperativaId: null,
      });
      cooperativaFindUnique.mockResolvedValueOnce(null);
      conversaUpdate.mockResolvedValueOnce({});

      await expect(
        service.processarComFluxoDinamico(
          { telefone: '+5527981341348', tipo: 'texto', corpo: 'OK' },
          { id: 'c1', telefone: '+5527981341348', estado: 'MENU', cooperativaId: 'coop-zumbi', dadosTemp: { titular: 'Teste' } },
        ),
      ).resolves.toBe(true);

      expect(enviarMensagem).toHaveBeenCalledWith('+5527981341348', 'Oi Teste, parceiro: ');
    });
  });

  // ============================================================
  // Fase 3 - Simulacao in-memory (zero side effect)
  // ============================================================
  describe('simular() - preview de fluxo sem disparar Baileys', () => {
    it('Sem etapa para estado inicial -> transicionou=false + motivoFallback', async () => {
      etapaFindFirst.mockResolvedValueOnce(null);
      const r = await service.simular({
        mensagem: 'oi', cooperativaId: 'coop-A', estadoInicial: 'ESTADO_INEXISTENTE',
      });
      expect(r.transicionou).toBe(false);
      expect(r.estadoFinal).toBe('ESTADO_INEXISTENTE');
      expect(r.gatilhoAvaliado).toBeNull();
      expect(r.motivoFallback).toContain('Nenhuma etapa dinamica');
      expect(r.mensagensEnviadas).toEqual([]);
    });

    it('Nenhum gatilho bateu -> transicionou=false + motivoFallback', async () => {
      etapaFindFirst.mockResolvedValueOnce({
        id: 'e1', cooperativaId: 'coop-A',
        gatilhos: [{ resposta: 'OK', proximoEstado: 'P' }],
        modeloMensagemId: null,
      });
      const r = await service.simular({
        mensagem: 'xyz', cooperativaId: 'coop-A', estadoInicial: 'MENU',
      });
      expect(r.transicionou).toBe(false);
      expect(r.motivoFallback).toContain('Nenhum gatilho');
    });

    it('Fase A: simulacao expoe etapaAtual com nome+escopo+gatilhos no output (TENANT)', async () => {
      etapaFindFirst.mockResolvedValueOnce({
        id: 'e-tenant', cooperativaId: 'coop-A', nome: 'Entrada Dinamica', estado: 'INICIAL',
        gatilhos: [{ resposta: 'XYZ', proximoEstado: 'P' }],
        modeloMensagemId: null, acaoAutomatica: null,
      });
      const r = await service.simular({
        mensagem: 'naotem', cooperativaId: 'coop-A', estadoInicial: 'INICIAL',
      });
      expect(r.transicionou).toBe(false);
      expect(r.etapaAtual).toMatchObject({
        id: 'e-tenant', nome: 'Entrada Dinamica', estado: 'INICIAL', escopo: 'TENANT',
        gatilhos: [{ resposta: 'XYZ', proximoEstado: 'P' }],
      });
      expect(r.etapaProxima).toBeNull();
    });

    it('Sub-debito UX: etapaAtual com modeloMensagemId -> mensagemEtapaAtual renderizada', async () => {
      etapaFindFirst.mockResolvedValueOnce({
        id: 'e1', cooperativaId: 'coop-A', nome: 'Entrada', estado: 'INICIAL',
        gatilhos: [{ resposta: '1', proximoEstado: 'P' }],
        modeloMensagemId: 'm-entrada', acaoAutomatica: null,
      });
      modeloFindFirst.mockResolvedValueOnce({
        id: 'm-entrada', nome: 'msg-entrada',
        conteudo: 'Bem-vindo a {{parceiro}}, {{tipo_membro}}!',
        cooperativaId: null,
      });
      cooperativaFindUnique.mockResolvedValueOnce({
        nome: 'CoopereBR', email: null, telefone: null,
        cidade: null, estado: null, tipoParceiro: 'COOPERATIVA',
      });

      const r = await service.simular({
        mensagem: 'naotem', cooperativaId: 'coop-A', estadoInicial: 'INICIAL',
      });

      expect(r.mensagemEtapaAtual).toBe('Bem-vindo a CoopereBR, cooperado!');
      expect(r.transicionou).toBe(false); // gatilho 'naotem' nao casa com '1'
    });

    it('Sub-debito UX: etapaAtual SEM modeloMensagemId -> mensagemEtapaAtual=null', async () => {
      etapaFindFirst.mockResolvedValueOnce({
        id: 'e1', cooperativaId: 'coop-A', nome: 'Entrada', estado: 'INICIAL',
        gatilhos: [{ resposta: '1', proximoEstado: 'P' }],
        modeloMensagemId: null, acaoAutomatica: null,
      });

      const r = await service.simular({
        mensagem: 'xx', cooperativaId: 'coop-A', estadoInicial: 'INICIAL',
      });

      expect(r.mensagemEtapaAtual).toBeNull();
      expect(modeloFindFirst).not.toHaveBeenCalled(); // sem modelo, sem query
    });

    it('Sub-debito UX: sem etapaAtual -> mensagemEtapaAtual=null', async () => {
      etapaFindFirst.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
      const r = await service.simular({
        mensagem: 'oi', cooperativaId: 'coop-A', estadoInicial: 'INEXISTENTE',
      });
      expect(r.etapaAtual).toBeNull();
      expect(r.mensagemEtapaAtual).toBeNull();
    });

    it('Fase A: simulacao expoe etapaAtual com escopo GLOBAL quando nao ha tenant', async () => {
      // sem cooperativaId -> motor busca cooperativaId=null direto
      etapaFindFirst.mockResolvedValueOnce({
        id: 'e-global', cooperativaId: null, nome: 'Receber Fatura', estado: 'INICIAL',
        gatilhos: [], modeloMensagemId: null, acaoAutomatica: null,
      });
      const r = await service.simular({ mensagem: 'oi', estadoInicial: 'INICIAL' });
      expect(r.etapaAtual).toMatchObject({
        nome: 'Receber Fatura', escopo: 'GLOBAL',
      });
    });

    it('Fase A: simulacao com transicao expoe etapaAtual E etapaProxima', async () => {
      etapaFindFirst.mockResolvedValueOnce({
        id: 'e1', cooperativaId: 'coop-A', nome: 'Entrada', estado: 'INICIAL',
        gatilhos: [{ resposta: '1', proximoEstado: 'MENU' }],
        modeloMensagemId: null, acaoAutomatica: null,
      });
      etapaFindFirst.mockResolvedValueOnce({
        id: 'e2', cooperativaId: 'coop-A', nome: 'Menu Principal', estado: 'MENU',
        gatilhos: [], modeloMensagemId: null, acaoAutomatica: null,
      });
      const r = await service.simular({
        mensagem: '1', cooperativaId: 'coop-A', estadoInicial: 'INICIAL',
      });
      expect(r.transicionou).toBe(true);
      expect(r.etapaAtual?.nome).toBe('Entrada');
      expect(r.etapaProxima?.nome).toBe('Menu Principal');
      expect(r.etapaAtual?.escopo).toBe('TENANT');
      expect(r.etapaProxima?.escopo).toBe('TENANT');
    });

    it('Fase A: sem etapa para estado inicial -> etapaAtual=null E etapaProxima=null', async () => {
      etapaFindFirst.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
      const r = await service.simular({
        mensagem: 'oi', cooperativaId: 'coop-A', estadoInicial: 'INEXISTENTE',
      });
      expect(r.etapaAtual).toBeNull();
      expect(r.etapaProxima).toBeNull();
    });

    it('Simulacao bem-sucedida -> sequencia com texto renderizado + variaveis tenant Fase 2', async () => {
      etapaFindFirst.mockResolvedValueOnce({
        id: 'e1', cooperativaId: 'coop-A',
        gatilhos: [{ resposta: 'OK', proximoEstado: 'PROX' }],
        modeloMensagemId: null,
      });
      etapaFindFirst.mockResolvedValueOnce({
        id: 'e2', cooperativaId: 'coop-A', modeloMensagemId: 'm1',
        gatilhos: [], acaoAutomatica: 'CRIAR_LEAD',
      });
      modeloFindFirst.mockResolvedValueOnce({
        id: 'm1', nome: 'boas_vindas',
        conteudo: 'Oi {{nome}}, bem-vindo a {{parceiro}} de {{cidade}}!',
        cooperativaId: null,
      });
      cooperativaFindUnique.mockResolvedValueOnce({
        nome: 'CoopereBR', email: null, telefone: null,
        cidade: 'Vitoria', estado: 'ES', tipoParceiro: 'COOPERATIVA',
      });

      const r = await service.simular({
        mensagem: 'OK', cooperativaId: 'coop-A', estadoInicial: 'MENU',
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
        id: 'e1', cooperativaId: 'coop-A',
        gatilhos: [{ resposta: 'OK', proximoEstado: 'PROX' }],
        modeloMensagemId: null,
      });
      etapaFindFirst.mockResolvedValueOnce({
        id: 'e2', cooperativaId: 'coop-A', modeloMensagemId: 'm1',
        gatilhos: [], acaoAutomatica: null,
      });
      modeloFindFirst.mockResolvedValueOnce({
        id: 'm1', nome: 'msg', conteudo: 'Oi {{nome}}', cooperativaId: 'coop-A',
      });
      cooperativaFindUnique.mockResolvedValueOnce({
        nome: 'CoopereBR', email: null, telefone: null,
        cidade: null, estado: null, tipoParceiro: 'COOPERATIVA',
      });

      await service.simular({
        mensagem: 'OK', cooperativaId: 'coop-A', estadoInicial: 'MENU',
        dadosTemp: { titular: 'X' },
      });

      expect(conversaUpdate).not.toHaveBeenCalled();
      expect(enviarMensagem).not.toHaveBeenCalled();
      expect(incrementarUso).not.toHaveBeenCalled();
    });

    it('ISOLAMENTO: simular sem cooperativaId -> nao carrega cooperativa; variaveis tenant vazias', async () => {
      etapaFindFirst.mockResolvedValueOnce({
        id: 'e1', cooperativaId: null,
        gatilhos: [{ resposta: 'OK', proximoEstado: 'PROX' }],
        modeloMensagemId: null,
      });
      etapaFindFirst.mockResolvedValueOnce({
        id: 'e2', cooperativaId: null, modeloMensagemId: 'm1',
        gatilhos: [], acaoAutomatica: null,
      });
      modeloFindFirst.mockResolvedValueOnce({
        id: 'm1', nome: 'msg', conteudo: 'Oi {{nome}}, parceiro: [{{parceiro}}]', cooperativaId: null,
      });

      const r = await service.simular({
        mensagem: 'OK', estadoInicial: 'MENU', dadosTemp: { titular: 'Anonimo' },
      });

      expect(cooperativaFindUnique).not.toHaveBeenCalled();
      expect(r.mensagensEnviadas[0].texto).toBe('Oi Anonimo, parceiro: []');
      const where = etapaFindFirst.mock.calls[0][0].where;
      expect(where).toMatchObject({ cooperativaId: null });
    });

    // ============================================================
    // R4 (20/05) — avisoTransicao para estado destino sem etapa ativa
    // ============================================================
    it('R4: transicionou para estado SEM etapa ativa -> avisoTransicao preenchido', async () => {
      // etapaAtual TEM gatilho "1" -> ESTADO_ORFAO
      etapaFindFirst.mockResolvedValueOnce({
        id: 'e1', cooperativaId: 'coop-A', nome: 'Entrada', estado: 'INICIAL',
        gatilhos: [{ resposta: '1', proximoEstado: 'ESTADO_ORFAO' }],
        modeloMensagemId: null, acaoAutomatica: null,
      });
      // buscarEtapa(ESTADO_ORFAO, coop-A): tenant null + global null = sem etapa
      etapaFindFirst.mockResolvedValueOnce(null).mockResolvedValueOnce(null);

      const r = await service.simular({
        mensagem: '1', cooperativaId: 'coop-A', estadoInicial: 'INICIAL',
      });

      expect(r.transicionou).toBe(true);
      expect(r.estadoFinal).toBe('ESTADO_ORFAO');
      expect(r.etapaProxima).toBeNull();
      expect(r.mensagensEnviadas).toEqual([]);
      expect(r.avisoTransicao).toContain('ESTADO_ORFAO');
      expect(r.avisoTransicao).toContain('fluxo hardcoded');
    });

    it('R4: transicionou para estado COM etapa ativa -> avisoTransicao=null', async () => {
      etapaFindFirst.mockResolvedValueOnce({
        id: 'e1', cooperativaId: 'coop-A', nome: 'Entrada', estado: 'INICIAL',
        gatilhos: [{ resposta: '1', proximoEstado: 'MENU' }],
        modeloMensagemId: null, acaoAutomatica: null,
      });
      etapaFindFirst.mockResolvedValueOnce({
        id: 'e2', cooperativaId: 'coop-A', nome: 'Menu', estado: 'MENU',
        gatilhos: [], modeloMensagemId: null, acaoAutomatica: null,
      });

      const r = await service.simular({
        mensagem: '1', cooperativaId: 'coop-A', estadoInicial: 'INICIAL',
      });

      expect(r.transicionou).toBe(true);
      expect(r.etapaProxima?.nome).toBe('Menu');
      expect(r.avisoTransicao).toBeNull();
    });

    it('R4: nao-transicao (gatilho nao casa) -> avisoTransicao=null', async () => {
      etapaFindFirst.mockResolvedValueOnce({
        id: 'e1', cooperativaId: 'coop-A', nome: 'Entrada', estado: 'INICIAL',
        gatilhos: [{ resposta: '1', proximoEstado: 'MENU' }],
        modeloMensagemId: null, acaoAutomatica: null,
      });
      const r = await service.simular({
        mensagem: 'xyz', cooperativaId: 'coop-A', estadoInicial: 'INICIAL',
      });
      expect(r.transicionou).toBe(false);
      expect(r.avisoTransicao).toBeNull();
    });

    // ============================================================
    // R3 (20/05) — etapaIdForcado resolve etapa exata por id
    // ============================================================
    it('R3: etapaIdForcado resolve etapa exata por id (bypassa buscarEtapa por estado)', async () => {
      // findFirst com id+ativo+OR retorna a etapa especifica
      etapaFindFirst.mockResolvedValueOnce({
        id: 'etapa-forcada-id', cooperativaId: 'coop-A',
        nome: 'Etapa Especifica', estado: 'INICIAL', ordem: 28,
        gatilhos: [{ resposta: '1', proximoEstado: 'MENU' }],
        modeloMensagemId: null, acaoAutomatica: null,
      });
      // proxima etapa (estado=MENU): tenant null + global null
      etapaFindFirst.mockResolvedValueOnce(null).mockResolvedValueOnce(null);

      const r = await service.simular({
        mensagem: '1', cooperativaId: 'coop-A', estadoInicial: 'INICIAL',
        etapaIdForcado: 'etapa-forcada-id',
      });

      // 1a query foi por ID (com OR tenant+null), nao por estado
      const whereForcado = etapaFindFirst.mock.calls[0][0].where;
      expect(whereForcado).toMatchObject({
        id: 'etapa-forcada-id',
        ativo: true,
        OR: [{ cooperativaId: 'coop-A' }, { cooperativaId: null }],
      });
      expect(r.etapaAtual?.nome).toBe('Etapa Especifica');
      expect(r.transicionou).toBe(true);
    });

    it('R3 ISOLAMENTO: etapaIdForcado de outro tenant retorna null + motivoFallback', async () => {
      // findFirst com OR vai bloquear: id existe mas coop-B != coop-A nem null
      etapaFindFirst.mockResolvedValueOnce(null);

      const r = await service.simular({
        mensagem: 'oi', cooperativaId: 'coop-A', estadoInicial: 'INICIAL',
        etapaIdForcado: 'id-de-coop-B',
      });

      expect(r.etapaAtual).toBeNull();
      expect(r.motivoFallback).toContain('Etapa forcada');
      expect(r.transicionou).toBe(false);
    });

    it('R3: transicoes SEGUINTES nao usam etapaIdForcado (so a 1a resolucao)', async () => {
      // 1a chamada (id forcado): retorna etapa com gatilho 1
      etapaFindFirst.mockResolvedValueOnce({
        id: 'forcada', cooperativaId: 'coop-A',
        nome: 'Forcada', estado: 'INICIAL', ordem: 28,
        gatilhos: [{ resposta: '1', proximoEstado: 'MENU' }],
        modeloMensagemId: null, acaoAutomatica: null,
      });
      // 2a chamada (proximaEtapa=MENU): buscarEtapa tenant
      etapaFindFirst.mockResolvedValueOnce({
        id: 'menu', cooperativaId: 'coop-A', nome: 'Menu', estado: 'MENU',
        gatilhos: [], modeloMensagemId: null, acaoAutomatica: null,
      });

      await service.simular({
        mensagem: '1', cooperativaId: 'coop-A', estadoInicial: 'INICIAL',
        etapaIdForcado: 'forcada',
      });

      // 2a query NAO usa id forcado — usa estado+cooperativaId
      const whereProxima = etapaFindFirst.mock.calls[1][0].where;
      expect(whereProxima).toMatchObject({
        estado: 'MENU', ativo: true, cooperativaId: 'coop-A',
      });
      expect(whereProxima).not.toHaveProperty('id');
    });

    it('R3: etapaIdForcado=null (omitido) -> comportamento atual via buscarEtapa(estado)', async () => {
      etapaFindFirst.mockResolvedValueOnce({
        id: 'e-normal', cooperativaId: 'coop-A', nome: 'Normal', estado: 'INICIAL',
        gatilhos: [{ resposta: 'X', proximoEstado: 'Y' }],
        modeloMensagemId: null, acaoAutomatica: null,
      });

      await service.simular({
        mensagem: 'xx', cooperativaId: 'coop-A', estadoInicial: 'INICIAL',
        etapaIdForcado: null,
      });

      // 1a query foi por estado (sem id, sem OR — eh o filtro tenant exato do buscarEtapa)
      const where = etapaFindFirst.mock.calls[0][0].where;
      expect(where).toMatchObject({ estado: 'INICIAL', ativo: true, cooperativaId: 'coop-A' });
      expect(where).not.toHaveProperty('id');
    });

    it('ISOLAMENTO: simular como tenant A NAO renderiza variaveis de tenant B', async () => {
      // Tenant A simula primeiro
      etapaFindFirst.mockResolvedValueOnce({
        id: 'e1', cooperativaId: 'coop-A',
        gatilhos: [{ resposta: 'OK', proximoEstado: 'PROX' }], modeloMensagemId: null,
      });
      etapaFindFirst.mockResolvedValueOnce({
        id: 'e2', cooperativaId: 'coop-A', modeloMensagemId: 'm1',
        gatilhos: [], acaoAutomatica: null,
      });
      modeloFindFirst.mockResolvedValueOnce({
        id: 'm1', nome: 'msg', conteudo: 'Parceiro: {{parceiro}}', cooperativaId: null,
      });
      cooperativaFindUnique.mockResolvedValueOnce({
        nome: 'CoopereBR', email: null, telefone: null,
        cidade: null, estado: null, tipoParceiro: 'COOPERATIVA',
      });

      const rA = await service.simular({
        mensagem: 'OK', cooperativaId: 'coop-A', estadoInicial: 'MENU',
      });
      expect(rA.mensagensEnviadas[0].texto).toBe('Parceiro: CoopereBR');

      // Tenant B simula em seguida - vars devem ser de B, nunca de A
      etapaFindFirst.mockResolvedValueOnce({
        id: 'e3', cooperativaId: 'coop-B',
        gatilhos: [{ resposta: 'OK', proximoEstado: 'PROX' }], modeloMensagemId: null,
      });
      etapaFindFirst.mockResolvedValueOnce({
        id: 'e4', cooperativaId: 'coop-B', modeloMensagemId: 'm2',
        gatilhos: [], acaoAutomatica: null,
      });
      modeloFindFirst.mockResolvedValueOnce({
        id: 'm2', nome: 'msg', conteudo: 'Parceiro: {{parceiro}}', cooperativaId: null,
      });
      cooperativaFindUnique.mockResolvedValueOnce({
        nome: 'Hangar Academia', email: null, telefone: null,
        cidade: null, estado: null, tipoParceiro: 'ASSOCIACAO',
      });

      const rB = await service.simular({
        mensagem: 'OK', cooperativaId: 'coop-B', estadoInicial: 'MENU',
      });
      expect(rB.mensagensEnviadas[0].texto).toBe('Parceiro: Hangar Academia');
      expect(rB.mensagensEnviadas[0].texto).not.toContain('CoopereBR');
    });
  });

  // ============================================================
  // Fase C - Preview isolado de modelo (sem fluxo)
  // ============================================================
  describe('previewModelo() - preview isolado de modelo de mensagem', () => {
    it('Modelo nao encontrado -> encontrado=false + texto=null', async () => {
      modeloFindFirst.mockResolvedValueOnce(null);
      const r = await service.previewModelo({
        modeloId: 'modelo-inexistente',
        cooperativaId: 'coop-A',
      });
      expect(r.encontrado).toBe(false);
      expect(r.texto).toBeNull();
      expect(r.modeloNome).toBeNull();
      expect(r.escopo).toBeNull();
    });

    it('Modelo TENANT encontrado -> renderiza com variaveis do tenant', async () => {
      modeloFindFirst.mockResolvedValueOnce({
        id: 'm1',
        nome: 'Boas-vindas',
        categoria: 'BOT',
        conteudo: 'Ola {{nome}}, bem-vindo a {{parceiro}}!',
        cooperativaId: 'coop-A',
      });
      cooperativaFindUnique.mockResolvedValueOnce({
        nome: 'CoopereBR', email: null, telefone: null,
        cidade: null, estado: null, tipoParceiro: 'COOPERATIVA',
      });

      const r = await service.previewModelo({
        modeloId: 'm1',
        cooperativaId: 'coop-A',
        dadosTemp: { titular: 'Joao' },
      });

      expect(r.encontrado).toBe(true);
      expect(r.texto).toBe('Ola Joao, bem-vindo a CoopereBR!');
      expect(r.modeloNome).toBe('Boas-vindas');
      expect(r.categoria).toBe('BOT');
      expect(r.escopo).toBe('TENANT');
      expect(r.variaveisUsadas.parceiro).toBe('CoopereBR');
    });

    it('Modelo GLOBAL (cooperativaId=null) -> escopo=GLOBAL', async () => {
      modeloFindFirst.mockResolvedValueOnce({
        id: 'm-global',
        nome: 'Template Generico',
        categoria: 'BOT',
        conteudo: 'Mensagem padrao',
        cooperativaId: null,
      });

      const r = await service.previewModelo({
        modeloId: 'm-global',
      });

      expect(r.encontrado).toBe(true);
      expect(r.escopo).toBe('GLOBAL');
      expect(r.texto).toBe('Mensagem padrao');
    });

    it('ISOLAMENTO: query usa OR [tenant + null] (nao deixa ver modelo de outro tenant)', async () => {
      modeloFindFirst.mockResolvedValueOnce(null);
      await service.previewModelo({ modeloId: 'm-de-outro-tenant', cooperativaId: 'coop-A' });
      const where = modeloFindFirst.mock.calls[0][0].where;
      expect(where).toMatchObject({
        id: 'm-de-outro-tenant',
        OR: [{ cooperativaId: 'coop-A' }, { cooperativaId: null }],
      });
    });

    it('ZERO SIDE EFFECT: previewModelo nao incrementa uso nem persiste nada', async () => {
      modeloFindFirst.mockResolvedValueOnce({
        id: 'm1', nome: 'X', categoria: 'BOT', conteudo: 'oi', cooperativaId: 'coop-A',
      });
      cooperativaFindUnique.mockResolvedValueOnce({
        nome: 'C', email: null, telefone: null,
        cidade: null, estado: null, tipoParceiro: 'COOPERATIVA',
      });
      await service.previewModelo({ modeloId: 'm1', cooperativaId: 'coop-A' });

      expect(incrementarUso).not.toHaveBeenCalled();
      expect(conversaUpdate).not.toHaveBeenCalled();
      expect(enviarMensagem).not.toHaveBeenCalled();
    });
  });
});
