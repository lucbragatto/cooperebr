import { WhatsappFluxoMotorService } from './whatsapp-fluxo-motor.service';

describe('WhatsappFluxoMotorService - isolamento multi-tenant em runtime', () => {
  let service: WhatsappFluxoMotorService;
  const etapaFindFirst = jest.fn();
  const modeloFindFirst = jest.fn();
  const conversaUpdate = jest.fn();
  const cooperativaFindUnique = jest.fn();
  const cooperadoFindUnique = jest.fn();
  const cooperadoUpdate = jest.fn();
  // Etapa C Bloco 4 (22/05): updateMany aceita filtros nao-unique (cooperativaId)
  // no where -> defense in depth multi-tenant em 1 query.
  const cooperadoUpdateMany = jest.fn();
  const enviarMensagem = jest.fn();
  const incrementarUso = jest.fn();

  // Bloco 3 (21/05): mocks adicionais pras 2 acoes novas (saldo creditos +
  // proxima fatura). Sao redeclarados pra ficar disponiveis ao describe inteiro.
  const contratoFindMany = jest.fn();
  const faturaProcessadaFindFirst = jest.fn();
  const cobrancaFindFirst = jest.fn();
  const asaasCobrancaFindFirst = jest.fn();
  // Bloco 7 Etapa B (23/05): mock pra acao REGISTRAR_NPS persistir nota.
  const npsRespostaCreate = jest.fn();
  // Bloco 6 Etapa B/C (23/05): mocks pra fluxo Cadastro Proxy.
  const cooperadoCreate = jest.fn();
  const indicacaoCreate = jest.fn();
  const extrairOcrMock = jest.fn();
  const motorPropostaCalcularMock = jest.fn();
  // Bloco 5 Etapa B (24/05): mocks pra fluxo Atualizar Contrato.
  const contratoFindFirst = jest.fn();
  const solicitacaoContratoCreate = jest.fn();
  const cobrancaCount = jest.fn();
  const usinaFindUnique = jest.fn();
  const contratoAggregateUsina = jest.fn();
  const notificacaoCriarMock = jest.fn();
  // Bloco 8 (24/05): mocks pro fluxo Menu Fatura.
  const cobrancaFindMany = jest.fn();
  const solicitacaoConfirmacaoPagamentoCreate = jest.fn();

  const prismaMock: any = {
    fluxoEtapa: { findFirst: etapaFindFirst },
    modeloMensagem: { findFirst: modeloFindFirst, findUnique: jest.fn() },
    conversaWhatsapp: { update: conversaUpdate, findUnique: jest.fn() },
    cooperativa: { findUnique: cooperativaFindUnique, findMany: jest.fn() },
    cooperado: {
      findUnique: cooperadoFindUnique,
      update: cooperadoUpdate,
      updateMany: cooperadoUpdateMany,
      create: cooperadoCreate,
      // Sprint "Qual cadastro?" Fix 2 — VERIFICAR_COOPERADO + ESCOLHER_*
      findMany: jest.fn(),
    },
    indicacao: { create: indicacaoCreate },
    contrato: {
      findMany: contratoFindMany,
      findFirst: contratoFindFirst,
      aggregate: contratoAggregateUsina,
    },
    faturaProcessada: { findFirst: faturaProcessadaFindFirst },
    cobranca: { findFirst: cobrancaFindFirst, count: cobrancaCount, findMany: cobrancaFindMany },
    asaasCobranca: { findFirst: asaasCobrancaFindFirst },
    npsResposta: { create: npsRespostaCreate },
    solicitacaoAlteracaoContrato: { create: solicitacaoContratoCreate },
    solicitacaoConfirmacaoPagamento: { create: solicitacaoConfirmacaoPagamentoCreate },
    usina: { findUnique: usinaFindUnique },
  };
  const modeloMensagemMock: any = { incrementarUso };
  const senderMock: any = { enviarMensagem };
  // Etapa C Bloco 4 (22/05): CepService injetado pra acao ATUALIZAR_CEP_COOPERADO.
  // Cada teste que usa CEP mocka cepConsultar.mockResolvedValueOnce(...).
  const cepConsultar = jest.fn();
  const cepServiceMock: any = { consultar: cepConsultar };
  // Bloco 6 Etapa C (23/05): FaturasService injetado pra acao
  // PROCESSAR_OCR_PROXY. extrairOcrMock retorna DadosExtraidos.
  const faturasServiceMock: any = { extrairOcr: extrairOcrMock };
  // Bloco 5 Etapa B (24/05): NotificacoesService injetado pras acoes
  // SALVAR_SOLICITACAO_* notificarem equipe via Notificacao persistente.
  const notificacoesServiceMock: any = { criar: notificacaoCriarMock };
  // Sprint Token-WA Fase 1 (07/06/2026): CooperTokenService injetado pras
  // 3 acoes novas (CONSULTAR_SALDO_TOKENS + CONSULTAR_EXTRATO_TOKENS +
  // EXTRATO_TOKENS_PAGINAR). Cada teste mocka getSaldo/getExtrato conforme.
  const getSaldoMock = jest.fn();
  const getExtratoMock = jest.fn();
  const cooperTokenServiceMock: any = {
    getSaldo: getSaldoMock,
    getExtrato: getExtratoMock,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // F2.12: isolar testes do env DEFAULT_TENANT_ID (setado no .env do projeto).
    // Cada suite que precisa do fallback re-seta no proprio bloco.
    delete process.env.DEFAULT_TENANT_ID;
    // findMany default vazio pra fallback "única cooperativa" não disparar
    // por acidente (suites específicas mockam o que precisam).
    prismaMock.cooperativa.findMany.mockReset();
    prismaMock.cooperativa.findMany.mockResolvedValue([]);
    service = new WhatsappFluxoMotorService(
      prismaMock,
      modeloMensagemMock,
      senderMock,
      cepServiceMock,
      faturasServiceMock,
      notificacoesServiceMock,
      cooperTokenServiceMock,
    );
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
    // F2.11 (08/06/2026) — defensivo "**" no nome cooperativa.
    it('Variavel vazia entre asteriscos -> remove asteriscos orfaos', () => {
      const r = service.renderizarTemplate(
        'Olá! Sou o assistente da *{{parceiro}}*.',
        { parceiro: '' },
      );
      expect(r).toBe('Olá! Sou o assistente da.');
      expect(r).not.toContain('**');
    });
    it('Variavel vazia entre asteriscos no meio do texto - elimina ** patologico', () => {
      const r = service.renderizarTemplate(
        'Olá, *{{nome}}*! Bem-vindo.',
        { nome: '' },
      );
      expect(r).not.toContain('**');
      expect(r).not.toContain('*!');
    });
    it('Variavel preenchida entre asteriscos mantem o bold WA', () => {
      const r = service.renderizarTemplate(
        'Olá, *{{nome}}*!',
        { nome: 'Luciano' },
      );
      expect(r).toBe('Olá, *Luciano*!');
    });
    it('Variavel vazia SEM asteriscos so colapsa espaco duplo', () => {
      const r = service.renderizarTemplate(
        'Oi  {{nome}}  pessoal!',
        { nome: '' },
      );
      // Não exigimos colapso perfeito; foco é nao deixar lacuna estranha "  ".
      expect(r).not.toMatch(/   /);
    });
  });

  // ============================================================
  // F2.12 (08/06/2026) — resolverTenantDefault + carregarContextoCooperativa
  // ============================================================
  describe('resolverTenantDefault() + carregarContextoCooperativa()', () => {
    const ENV_ORIGINAL = process.env.DEFAULT_TENANT_ID;
    afterEach(() => {
      if (ENV_ORIGINAL === undefined) delete process.env.DEFAULT_TENANT_ID;
      else process.env.DEFAULT_TENANT_ID = ENV_ORIGINAL;
    });

    it('Conversa COM cooperativaId -> usa esse, ignora env', async () => {
      process.env.DEFAULT_TENANT_ID = 'env-tenant';
      cooperativaFindUnique.mockResolvedValueOnce({ nome: 'Tenant Explícito' });
      const ctx = await (service as any).carregarContextoCooperativa('explicit-id');
      expect(ctx?.nome).toBe('Tenant Explícito');
      expect(cooperativaFindUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'explicit-id' } }),
      );
    });

    it('SEM cooperativaId + env DEFAULT_TENANT_ID setado -> usa env', async () => {
      process.env.DEFAULT_TENANT_ID = 'env-tenant';
      cooperativaFindUnique.mockResolvedValueOnce({ nome: 'CoopereBR via env' });
      const ctx = await (service as any).carregarContextoCooperativa(undefined);
      expect(ctx?.nome).toBe('CoopereBR via env');
      expect(cooperativaFindUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'env-tenant' } }),
      );
    });

    it('SEM cooperativaId + SEM env + 1 cooperativa ativa -> fallback', async () => {
      delete process.env.DEFAULT_TENANT_ID;
      prismaMock.cooperativa.findMany.mockResolvedValueOnce([{ id: 'unica-coop' }]);
      cooperativaFindUnique.mockResolvedValueOnce({ nome: 'Única Ativa' });
      const ctx = await (service as any).carregarContextoCooperativa(undefined);
      expect(ctx?.nome).toBe('Única Ativa');
      expect(cooperativaFindUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'unica-coop' } }),
      );
    });

    it('SEM cooperativaId + SEM env + 2 cooperativas ativas -> NULL (sem chute)', async () => {
      delete process.env.DEFAULT_TENANT_ID;
      prismaMock.cooperativa.findMany.mockResolvedValueOnce([
        { id: 'coop-A' },
        { id: 'coop-B' },
      ]);
      const ctx = await (service as any).carregarContextoCooperativa(undefined);
      expect(ctx).toBeNull();
      expect(cooperativaFindUnique).not.toHaveBeenCalled();
    });

    it('SEM cooperativaId + SEM env + 0 cooperativas -> NULL', async () => {
      delete process.env.DEFAULT_TENANT_ID;
      prismaMock.cooperativa.findMany.mockResolvedValueOnce([]);
      const ctx = await (service as any).carregarContextoCooperativa(undefined);
      expect(ctx).toBeNull();
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

    // ===========================================================
    // Bloco 0 v2 (21/05) — {{historico}} populado de dadosTemp.historicoConsumo
    // ===========================================================
    it('Bloco 0 v2: {{historico}} vazio quando dadosTemp.historicoConsumo ausente (simulador sem OCR)', () => {
      const vars = service.extrairVariaveis({ dadosTemp: {} });
      expect(vars.historico).toBe('');
    });

    it('Bloco 0 v2: {{historico}} formatado quando historicoConsumo presente (mesAno: NNN kWh - R$ X,XX)', () => {
      const vars = service.extrairVariaveis({
        dadosTemp: {
          historicoConsumo: [
            { mesAno: '01/26', consumoKwh: 320, valorRS: 287.50 },
            { mesAno: '02/26', consumoKwh: 350, valorRS: 295.10 },
            { mesAno: '03/26', consumoKwh: 280, valorRS: 240.00 },
          ],
        },
      });
      expect(vars.historico).toBe(
        '01/26: 320 kWh - R$ 287,50\n02/26: 350 kWh - R$ 295,10\n03/26: 280 kWh - R$ 240,00',
      );
    });

    it('Bloco 0 v2: {{historico}} sem valorRS (=0) omite hifen-valor', () => {
      const vars = service.extrairVariaveis({
        dadosTemp: {
          historicoConsumo: [
            { mesAno: '01/26', consumoKwh: 320, valorRS: 0 },
          ],
        },
      });
      expect(vars.historico).toBe('01/26: 320 kWh');
    });

    it('Bloco 0 v2: {{historico}} ignora itens invalidos (sem mesAno ou consumoKwh<=0)', () => {
      const vars = service.extrairVariaveis({
        dadosTemp: {
          historicoConsumo: [
            { mesAno: '01/26', consumoKwh: 320, valorRS: 100 },
            { mesAno: '', consumoKwh: 350, valorRS: 200 }, // sem mesAno
            { mesAno: '03/26', consumoKwh: 0, valorRS: 0 }, // kWh zero
            null, // item nulo
          ],
        },
      });
      expect(vars.historico).toBe('01/26: 320 kWh - R$ 100,00');
    });

    it('Bloco 0 v2: historicoConsumo nao-array -> {{historico}} vazio (defensivo)', () => {
      expect(service.extrairVariaveis({ dadosTemp: { historicoConsumo: 'string-errada' } }).historico).toBe('');
      expect(service.extrairVariaveis({ dadosTemp: { historicoConsumo: null } }).historico).toBe('');
      expect(service.extrairVariaveis({ dadosTemp: { historicoConsumo: undefined } }).historico).toBe('');
    });

    it('Bloco 2 (21/05): {{telefone}} populado a partir de dadosTemp.telefone', () => {
      expect(
        service.extrairVariaveis({ dadosTemp: { telefone: '27999999999' } }).telefone,
      ).toBe('27999999999');
    });

    it('Bloco 2: {{telefone}} vazio quando dadosTemp.telefone ausente', () => {
      expect(service.extrairVariaveis({ dadosTemp: {} }).telefone).toBe('');
      expect(service.extrairVariaveis({ dadosTemp: { telefone: null } }).telefone).toBe('');
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
      // Bloco 1.a (21/05): rodape anexado em toda etapa renderizada.
      expect(enviarMensagem).toHaveBeenCalledWith(
        '+5527981341348',
        expect.stringContaining('Oi Luciano, bem-vindo a CoopereBR!'),
      );
      expect(enviarMensagem.mock.calls[0][1]).toContain('digite MENU, INÍCIO ou SAIR');
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
      expect(enviarMensagem).toHaveBeenCalledWith(
        '+5527981341348',
        expect.stringContaining('Oi Anonimo, fale com '),
      );
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

      expect(enviarMensagem).toHaveBeenCalledWith(
        '+5527981341348',
        expect.stringContaining('Oi Teste, parceiro: '),
      );
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

    it('Sub-debito UX: etapaAtual com modeloMensagemId -> mensagemEtapaAtual renderizada (com rodape Bloco 1.a porque eh menu)', async () => {
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

      // Etapa tem gatilho (menu) -> rodape anexado pelo Bloco 1.a
      expect(r.mensagemEtapaAtual).toBe(
        'Bem-vindo a CoopereBR, cooperado!\n\n_A qualquer momento: digite MENU, INÍCIO ou SAIR._',
      );
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
      expect(r.mensagensEnviadas[0].texto).toContain('Oi Luciano, bem-vindo a CoopereBR de Vitoria!');
      expect(r.mensagensEnviadas[0].texto).toContain('digite MENU, INÍCIO ou SAIR');
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
      expect(r.mensagensEnviadas[0].texto).toContain('Oi Anonimo, parceiro: []');
      expect(r.mensagensEnviadas[0].texto).toContain('digite MENU, INÍCIO ou SAIR');
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
      expect(rA.mensagensEnviadas[0].texto).toContain('Parceiro: CoopereBR');

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
      expect(rB.mensagensEnviadas[0].texto).toContain('Parceiro: Hangar Academia');
      expect(rB.mensagensEnviadas[0].texto).not.toContain('CoopereBR');
    });
  });

  // ============================================================
  // Bloco 1.a (21/05) — Comandos Universais de Navegacao (INICIO/SAIR/MENU)
  // ============================================================
  describe('detectarComandoUniversal() - funcao pura', () => {
    it('INICIO + sinonimos (case-insensitive)', () => {
      expect(service.detectarComandoUniversal('INICIO')).toBe('INICIO');
      expect(service.detectarComandoUniversal('inicio')).toBe('INICIO');
      expect(service.detectarComandoUniversal('Início')).toBe('INICIO');
      expect(service.detectarComandoUniversal('começar')).toBe('INICIO');
      expect(service.detectarComandoUniversal('comecar')).toBe('INICIO');
      expect(service.detectarComandoUniversal('Menu Inicial')).toBe('INICIO');
    });

    it('SAIR + sinonimos', () => {
      expect(service.detectarComandoUniversal('sair')).toBe('SAIR');
      expect(service.detectarComandoUniversal('SAIR')).toBe('SAIR');
      expect(service.detectarComandoUniversal('parar')).toBe('SAIR');
      expect(service.detectarComandoUniversal('encerrar')).toBe('SAIR');
    });

    it('MENU + sinonimos', () => {
      expect(service.detectarComandoUniversal('menu')).toBe('MENU');
      expect(service.detectarComandoUniversal('MENU')).toBe('MENU');
      expect(service.detectarComandoUniversal('voltar')).toBe('MENU');
    });

    it('Palavra exata e isolada — texto com mais palavras NAO aciona', () => {
      expect(service.detectarComandoUniversal('quero sair daqui')).toBeNull();
      expect(service.detectarComandoUniversal('menu principal por favor')).toBeNull();
      expect(service.detectarComandoUniversal('voltar pra casa')).toBeNull();
    });

    it('Trim aplicado — espacos extras nao bloqueiam', () => {
      expect(service.detectarComandoUniversal('  SAIR  ')).toBe('SAIR');
      expect(service.detectarComandoUniversal('\nmenu\n')).toBe('MENU');
    });

    it('Texto livre comum NAO aciona comando universal (importante pra wildcard *)', () => {
      expect(service.detectarComandoUniversal('joão')).toBeNull();
      expect(service.detectarComandoUniversal('27999999999')).toBeNull();
      expect(service.detectarComandoUniversal('lucbragatto@gmail.com')).toBeNull();
      expect(service.detectarComandoUniversal('')).toBeNull();
    });
  });

  describe('resolverEstadoComandoUniversal() - funcao pura', () => {
    it('INICIO sempre vai pro estado INICIAL', () => {
      expect(service.resolverEstadoComandoUniversal('INICIO', { cooperadoId: null })).toBe('INICIAL');
      expect(service.resolverEstadoComandoUniversal('INICIO', { cooperadoId: 'coop-1' })).toBe('INICIAL');
    });

    it('SAIR retorna null (sinal de encerramento)', () => {
      expect(service.resolverEstadoComandoUniversal('SAIR', { cooperadoId: null })).toBeNull();
      expect(service.resolverEstadoComandoUniversal('SAIR', { cooperadoId: 'coop-1' })).toBeNull();
    });

    it('MENU com cooperadoId -> MENU_COOPERADO', () => {
      expect(service.resolverEstadoComandoUniversal('MENU', { cooperadoId: 'coop-1' })).toBe('MENU_COOPERADO');
    });

    it('MENU sem cooperadoId -> INICIAL (aquisicao)', () => {
      expect(service.resolverEstadoComandoUniversal('MENU', { cooperadoId: null })).toBe('INICIAL');
      expect(service.resolverEstadoComandoUniversal('MENU', {})).toBe('INICIAL');
    });
  });

  describe('anexarRodape() - funcao pura (rodape em TODA etapa apos correcao 21/05)', () => {
    const RODAPE = '\n\n_A qualquer momento: digite MENU, INÍCIO ou SAIR._';

    it('Etapa COM gatilhos (menu) -> rodape anexado', () => {
      const etapa: any = {
        gatilhos: [{ resposta: '1', proximoEstado: 'X' }],
      };
      expect(service.anexarRodape('Olá!', etapa)).toBe('Olá!' + RODAPE);
    });

    it('Etapa SEM gatilhos (terminal/coleta) -> RODAPE TAMBEM ANEXADO (era bug pre-21/05)', () => {
      // Correcao 21/05: rodape em TODA etapa ativa. Antes deixava etapa terminal
      // (AGUARDANDO_ATENDENTE) sem rodape — justo onde cooperado fica preso.
      const etapa: any = { gatilhos: [] };
      expect(service.anexarRodape('Sua mensagem foi recebida.', etapa)).toBe(
        'Sua mensagem foi recebida.' + RODAPE,
      );
    });

    it('Etapa com gatilhos null/undefined -> rodape anexado (defensivo, sem crash)', () => {
      expect(service.anexarRodape('Texto', { gatilhos: null } as any)).toBe('Texto' + RODAPE);
      expect(service.anexarRodape('Texto', { gatilhos: undefined } as any)).toBe('Texto' + RODAPE);
    });

    it('Sem parametro etapa tambem funciona (rodape sempre presente)', () => {
      expect(service.anexarRodape('Texto')).toBe('Texto' + RODAPE);
    });
  });

  describe('processarComFluxoDinamico() — Bloco 1.a comandos universais (bot real)', () => {
    it('SAIR persiste estado=ENCERRADO + envia despedida + NAO avalia gatilhos', async () => {
      // Etapa atual tem gatilho "1" — comando SAIR deve ter PRECEDENCIA, motor nao deve nem buscar etapa
      const ok = await service.processarComFluxoDinamico(
        { telefone: '+5527981341348', tipo: 'texto', corpo: 'SAIR' },
        { id: 'c1', telefone: '+5527981341348', estado: 'MENU_COOPERADO', cooperativaId: 'coop-A', cooperadoId: 'coop-luciano' },
      );

      expect(ok).toBe(true);
      // Update da conversa pra ENCERRADO
      expect(conversaUpdate).toHaveBeenCalledWith({
        where: { id: 'c1' },
        data: { estado: 'ENCERRADO' },
      });
      // Mensagem de despedida enviada
      expect(enviarMensagem).toHaveBeenCalledWith(
        '+5527981341348',
        expect.stringMatching(/Tchau/),
      );
      // Motor NAO buscou etapa (curto-circuito antes)
      expect(etapaFindFirst).not.toHaveBeenCalled();
    });

    it('INICIO transiciona pra INICIAL + renderiza modelo da etapa-destino + rodape', async () => {
      // Etapa INICIAL existe ATIVA com modelo
      etapaFindFirst.mockResolvedValueOnce({
        id: 'e-inicial', cooperativaId: 'coop-A', estado: 'INICIAL',
        gatilhos: [{ resposta: '1', proximoEstado: 'X' }],
        modeloMensagemId: 'm-inicial', acaoAutomatica: null,
      });
      modeloFindFirst.mockResolvedValueOnce({
        id: 'm-inicial', nome: 'menu_inicial', conteudo: 'Bem-vindo!', cooperativaId: null,
      });
      cooperativaFindUnique.mockResolvedValueOnce({
        nome: 'CoopereBR', email: null, telefone: null,
        cidade: null, estado: null, tipoParceiro: 'COOPERATIVA',
      });

      await service.processarComFluxoDinamico(
        { telefone: '+5527981341348', tipo: 'texto', corpo: 'inicio' },
        { id: 'c1', telefone: '+5527981341348', estado: 'AGUARDANDO_FOTO_FATURA', cooperativaId: 'coop-A', cooperadoId: null },
      );

      expect(conversaUpdate).toHaveBeenCalledWith({
        where: { id: 'c1' },
        data: { estado: 'INICIAL' },
      });
      // Texto enviado tem o conteudo do modelo + rodape (etapa eh menu)
      const textoEnviado = enviarMensagem.mock.calls[0][1] as string;
      expect(textoEnviado).toContain('Bem-vindo!');
      expect(textoEnviado).toContain('digite MENU, INÍCIO ou SAIR');
    });

    it('MENU com cooperadoId -> MENU_COOPERADO', async () => {
      etapaFindFirst.mockResolvedValueOnce({
        id: 'e-menu', cooperativaId: 'coop-A', estado: 'MENU_COOPERADO',
        gatilhos: [{ resposta: '1', proximoEstado: 'X' }],
        modeloMensagemId: null, acaoAutomatica: null,
      });

      await service.processarComFluxoDinamico(
        { telefone: '+5527981341348', tipo: 'texto', corpo: 'menu' },
        { id: 'c1', telefone: '+5527981341348', estado: 'ATUALIZACAO_CONTRATO', cooperativaId: 'coop-A', cooperadoId: 'coop-luciano' },
      );

      expect(conversaUpdate).toHaveBeenCalledWith({
        where: { id: 'c1' },
        data: { estado: 'MENU_COOPERADO' },
      });
    });

    it('MENU sem cooperadoId -> INICIAL', async () => {
      etapaFindFirst.mockResolvedValueOnce({
        id: 'e-inicial', cooperativaId: 'coop-A', estado: 'INICIAL',
        gatilhos: [], modeloMensagemId: null, acaoAutomatica: null,
      });

      await service.processarComFluxoDinamico(
        { telefone: '+5527981341348', tipo: 'texto', corpo: 'voltar' },
        { id: 'c1', telefone: '+5527981341348', estado: 'AGUARDANDO_FOTO_FATURA', cooperativaId: 'coop-A', cooperadoId: null },
      );

      expect(conversaUpdate).toHaveBeenCalledWith({
        where: { id: 'c1' },
        data: { estado: 'INICIAL' },
      });
    });

    it('PRECEDENCIA: SAIR vence gatilho "1" da etapa atual', async () => {
      // Mesmo que a etapa tenha gatilho "1" -> X, "SAIR" tem precedencia
      // (motor curto-circuita ANTES de buscar etapa)
      await service.processarComFluxoDinamico(
        { telefone: '+5527981341348', tipo: 'texto', corpo: 'SAIR' },
        { id: 'c1', telefone: '+5527981341348', estado: 'MENU_PRINCIPAL', cooperativaId: 'coop-A', cooperadoId: null },
      );

      expect(conversaUpdate).toHaveBeenCalledWith({
        where: { id: 'c1' },
        data: { estado: 'ENCERRADO' },
      });
      expect(etapaFindFirst).not.toHaveBeenCalled(); // confirmacao do curto-circuito
    });

    it('Texto NAO-comando ("joão") segue fluxo normal — comando NAO captura wildcard', async () => {
      // Etapa com gatilho "*" (espera texto livre tipo nome)
      etapaFindFirst.mockResolvedValueOnce({
        id: 'e-nome', cooperativaId: 'coop-A', estado: 'AGUARDANDO_NOME',
        gatilhos: [{ resposta: '*', proximoEstado: 'PROX' }],
        modeloMensagemId: null, acaoAutomatica: null,
      });
      etapaFindFirst.mockResolvedValueOnce(null).mockResolvedValueOnce(null);

      await service.processarComFluxoDinamico(
        { telefone: '+5527981341348', tipo: 'texto', corpo: 'joão' },
        { id: 'c1', telefone: '+5527981341348', estado: 'AGUARDANDO_NOME', cooperativaId: 'coop-A', cooperadoId: null },
      );

      // "joão" NAO acionou comando universal; gatilho "*" capturou; transicionou pra PROX
      expect(conversaUpdate).toHaveBeenCalledWith({
        where: { id: 'c1' },
        data: { estado: 'PROX' },
      });
    });
  });

  describe('simular() — Bloco 1.a comandos universais no simulador', () => {
    it('Ping sintetico __simulador_ping__ NAO aciona comando universal', async () => {
      etapaFindFirst.mockResolvedValueOnce({
        id: 'e1', cooperativaId: 'coop-A', nome: 'Entrada', estado: 'INICIAL',
        gatilhos: [], modeloMensagemId: null, acaoAutomatica: null,
      });

      const r = await service.simular({
        mensagem: '__simulador_ping__', cooperativaId: 'coop-A', estadoInicial: 'INICIAL',
      });

      expect(r.comandoUniversalAplicado).toBeNull();
      expect(r.transicionou).toBe(false); // gatilho nao casou, fallback normal
    });

    it('SAIR no simulador -> transicionou: true + estadoFinal=ENCERRADO_VIA_SAIR + aviso + comandoUniversalAplicado=SAIR', async () => {
      etapaFindFirst.mockResolvedValueOnce({
        id: 'e1', cooperativaId: 'coop-A', nome: 'Menu', estado: 'MENU_COOPERADO',
        gatilhos: [{ resposta: '1', proximoEstado: 'X' }],
        modeloMensagemId: null, acaoAutomatica: null,
      });

      const r = await service.simular({
        mensagem: 'SAIR', cooperativaId: 'coop-A', estadoInicial: 'MENU_COOPERADO',
      });

      expect(r.transicionou).toBe(true);
      expect(r.estadoFinal).toBe('ENCERRADO_VIA_SAIR');
      expect(r.comandoUniversalAplicado).toBe('SAIR');
      expect(r.avisoTransicao).toContain('SAIR');
      expect(r.mensagensEnviadas).toEqual([]);
    });

    it('INICIO no simulador -> resolve etapa-destino + renderiza com rodape (se menu) + comandoUniversalAplicado=INICIO', async () => {
      // etapaAtual (estado declarado pelo cliente)
      etapaFindFirst.mockResolvedValueOnce({
        id: 'e-atual', cooperativaId: 'coop-A', nome: 'Atual', estado: 'AGUARDANDO_FOTO_FATURA',
        gatilhos: [], modeloMensagemId: null, acaoAutomatica: null,
      });
      // etapa-destino INICIAL (buscar apos comando)
      etapaFindFirst.mockResolvedValueOnce({
        id: 'e-inicial', cooperativaId: 'coop-A', nome: 'Menu Inicial', estado: 'INICIAL',
        gatilhos: [{ resposta: '1', proximoEstado: 'X' }],
        modeloMensagemId: 'm-inicial', acaoAutomatica: null,
      });
      modeloFindFirst.mockResolvedValueOnce({
        id: 'm-inicial', nome: 'menu_inicial', conteudo: 'Bem-vindo!', cooperativaId: null,
      });
      cooperativaFindUnique.mockResolvedValueOnce({
        nome: 'CoopereBR', email: null, telefone: null,
        cidade: null, estado: null, tipoParceiro: 'COOPERATIVA',
      });

      const r = await service.simular({
        mensagem: 'inicio', cooperativaId: 'coop-A', estadoInicial: 'AGUARDANDO_FOTO_FATURA',
      });

      expect(r.comandoUniversalAplicado).toBe('INICIO');
      expect(r.transicionou).toBe(true);
      expect(r.estadoFinal).toBe('INICIAL');
      expect(r.etapaProxima?.nome).toBe('Menu Inicial');
      expect(r.mensagensEnviadas).toHaveLength(1);
      expect(r.mensagensEnviadas[0].texto).toContain('Bem-vindo!');
      expect(r.mensagensEnviadas[0].texto).toContain('digite MENU, INÍCIO ou SAIR'); // rodape
    });

    it('MENU no simulador resolve contexto via cooperadoId em dadosTemp', async () => {
      etapaFindFirst.mockResolvedValueOnce({
        id: 'e-atual', cooperativaId: 'coop-A', estado: 'AGUARDANDO_FOTO_FATURA',
        gatilhos: [], modeloMensagemId: null, acaoAutomatica: null,
      });
      etapaFindFirst.mockResolvedValueOnce({
        id: 'e-menu-coop', cooperativaId: 'coop-A', nome: 'Menu Coop', estado: 'MENU_COOPERADO',
        gatilhos: [], modeloMensagemId: null, acaoAutomatica: null,
      });

      const r = await service.simular({
        mensagem: 'MENU', cooperativaId: 'coop-A', estadoInicial: 'AGUARDANDO_FOTO_FATURA',
        dadosTemp: { cooperadoId: 'coop-luciano' },
      });

      expect(r.comandoUniversalAplicado).toBe('MENU');
      expect(r.estadoFinal).toBe('MENU_COOPERADO');
    });

    it('PRECEDENCIA: SAIR no simulador vence gatilho da etapa atual', async () => {
      // Etapa atual tem gatilho "SAIR" inutil (NAO eh comum, mas garante precedencia)
      etapaFindFirst.mockResolvedValueOnce({
        id: 'e1', cooperativaId: 'coop-A', nome: 'X', estado: 'MENU_COOPERADO',
        gatilhos: [{ resposta: 'SAIR', proximoEstado: 'GATILHO_BATEU' }],
        modeloMensagemId: null, acaoAutomatica: null,
      });

      const r = await service.simular({
        mensagem: 'sair', cooperativaId: 'coop-A', estadoInicial: 'MENU_COOPERADO',
      });

      // Comando universal venceu — estado destino eh sintetico, NAO eh GATILHO_BATEU
      expect(r.estadoFinal).toBe('ENCERRADO_VIA_SAIR');
      expect(r.comandoUniversalAplicado).toBe('SAIR');
    });

    it('Texto livre ("joão") NAO aciona comando universal — gatilho "*" captura normal', async () => {
      etapaFindFirst.mockResolvedValueOnce({
        id: 'e-nome', cooperativaId: 'coop-A', estado: 'AGUARDANDO_NOME',
        gatilhos: [{ resposta: '*', proximoEstado: 'PROX' }],
        modeloMensagemId: null, acaoAutomatica: null,
      });
      etapaFindFirst.mockResolvedValueOnce({
        id: 'e-prox', cooperativaId: 'coop-A', estado: 'PROX',
        gatilhos: [], modeloMensagemId: null, acaoAutomatica: null,
      });

      const r = await service.simular({
        mensagem: 'joão', cooperativaId: 'coop-A', estadoInicial: 'AGUARDANDO_NOME',
      });

      expect(r.comandoUniversalAplicado).toBeNull();
      expect(r.transicionou).toBe(true);
      expect(r.estadoFinal).toBe('PROX');
    });
  });

  // ============================================================
  // R5 (20/05) — Acao ENVIAR_LINK_INDICACAO (Convidar amigo)
  // Testada via processarComFluxoDinamico() (acao roda na transicao para
  // etapa com acaoAutomatica='ENVIAR_LINK_INDICACAO').
  // ============================================================
  describe('executarAcao(ENVIAR_LINK_INDICACAO) - via processarComFluxoDinamico', () => {
    const baseConversa = (over: Record<string, unknown> = {}) => ({
      id: 'conv-1',
      telefone: '+5527981341348',
      estado: 'MENU',
      cooperativaId: 'coop-A',
      ...over,
    });

    const setupTransicaoParaEnvioConvite = () => {
      // etapa atual MENU com gatilho "4" -> ENVIAR_CONVITE
      etapaFindFirst.mockResolvedValueOnce({
        id: 'e-menu', cooperativaId: 'coop-A',
        gatilhos: [{ resposta: '4', proximoEstado: 'ENVIAR_CONVITE' }],
        modeloMensagemId: null,
      });
      // proxima etapa ENVIAR_CONVITE com acaoAutomatica
      etapaFindFirst.mockResolvedValueOnce({
        id: 'e-convite', cooperativaId: null,
        gatilhos: [], modeloMensagemId: null,
        acaoAutomatica: 'ENVIAR_LINK_INDICACAO',
      });
      conversaUpdate.mockResolvedValueOnce({});
    };

    // OBS 1 (hardening): mock substituido — findFirst no lugar de findUnique
    const mockCooperadoFindFirst = () => cooperadoFindFirstAux;
    const cooperadoFindFirstAux = jest.fn();

    beforeEach(() => {
      // re-mockar findFirst do prisma.cooperado a cada teste do describe
      cooperadoFindFirstAux.mockReset();
      prismaMock.cooperado.findFirst = cooperadoFindFirstAux;
    });

    it('R5 SEM cooperadoId -> manda mensagem de cadastro, nao busca cooperado, nao gera codigo', async () => {
      setupTransicaoParaEnvioConvite();
      await service.processarComFluxoDinamico(
        { telefone: '+5527981341348', tipo: 'texto', corpo: '4' },
        baseConversa({ cooperadoId: null }),
      );

      expect(enviarMensagem).toHaveBeenCalledWith(
        '+5527981341348',
        expect.stringContaining('precisa ser cooperado'),
      );
      expect(mockCooperadoFindFirst()).not.toHaveBeenCalled();
      expect(cooperadoUpdate).not.toHaveBeenCalled();
    });

    it('OBS 1: COM cooperadoId + cooperativaId -> findFirst filtra por AMBOS (multi-tenant)', async () => {
      setupTransicaoParaEnvioConvite();
      cooperadoFindFirstAux.mockResolvedValueOnce({
        id: 'coop-luciano', codigoIndicacao: 'ABCD1234', nomeCompleto: 'Luciano',
        cooperativaId: 'coop-A',
      });

      const envBackup = process.env.FRONTEND_URL;
      process.env.FRONTEND_URL = 'https://app.cooperebr.com.br';
      try {
        await service.processarComFluxoDinamico(
          { telefone: '+5527981341348', tipo: 'texto', corpo: '4' },
          baseConversa({ cooperadoId: 'coop-luciano' }),
        );
      } finally {
        if (envBackup === undefined) delete process.env.FRONTEND_URL;
        else process.env.FRONTEND_URL = envBackup;
      }

      // Hardening confirmado: filtra por id + cooperativaId
      expect(cooperadoFindFirstAux).toHaveBeenCalledWith({
        where: { id: 'coop-luciano', cooperativaId: 'coop-A' },
        select: { id: true, codigoIndicacao: true, nomeCompleto: true, cooperativaId: true },
      });
      expect(cooperadoUpdate).not.toHaveBeenCalled();
      // OBS 2: mensagem unica e sucinta (modelo da etapa ja avisou)
      expect(enviarMensagem).toHaveBeenCalledTimes(1);
      const enviado = enviarMensagem.mock.calls[0][1];
      expect(enviado).toContain('https://app.cooperebr.com.br/entrar?ref=ABCD1234');
      // Texto NAO repete "Seu link de indicacao personalizado" (modelo da etapa ja diz isso)
      expect(enviado).not.toMatch(/link de indicacao personalizado/i);
    });

    it('OBS 1: COM cooperadoId + SEM cooperativaId na conversa -> findFirst so por id (defesa em profundidade nao quebra)', async () => {
      setupTransicaoParaEnvioConvite();
      cooperadoFindFirstAux.mockResolvedValueOnce({
        id: 'coop-luciano', codigoIndicacao: 'WXYZ9999', nomeCompleto: 'Luciano',
        cooperativaId: 'coop-A',
      });

      await service.processarComFluxoDinamico(
        { telefone: '+5527981341348', tipo: 'texto', corpo: '4' },
        baseConversa({ cooperadoId: 'coop-luciano', cooperativaId: null }),
      );

      const where = cooperadoFindFirstAux.mock.calls[0][0].where;
      expect(where).toEqual({ id: 'coop-luciano' });
      expect(where).not.toHaveProperty('cooperativaId');
    });

    it('OBS 1 ISOLAMENTO: cooperadoId de outro tenant -> findFirst retorna null, NAO envia link', async () => {
      setupTransicaoParaEnvioConvite();
      cooperadoFindFirstAux.mockResolvedValueOnce(null);

      await service.processarComFluxoDinamico(
        { telefone: '+5527981341348', tipo: 'texto', corpo: '4' },
        baseConversa({ cooperadoId: 'cooperado-de-coop-B', cooperativaId: 'coop-A' }),
      );

      expect(cooperadoFindFirstAux).toHaveBeenCalledWith({
        where: { id: 'cooperado-de-coop-B', cooperativaId: 'coop-A' },
        select: { id: true, codigoIndicacao: true, nomeCompleto: true, cooperativaId: true },
      });
      expect(enviarMensagem).not.toHaveBeenCalled();
      expect(cooperadoUpdate).not.toHaveBeenCalled();
    });

    it('R5 COM cooperadoId + codigoIndicacao null -> gera 8 chars A-Z0-9, persiste, envia link', async () => {
      setupTransicaoParaEnvioConvite();
      cooperadoFindFirstAux.mockResolvedValueOnce({
        id: 'coop-luciano', codigoIndicacao: null, nomeCompleto: 'Luciano',
        cooperativaId: 'coop-A',
      });

      await service.processarComFluxoDinamico(
        { telefone: '+5527981341348', tipo: 'texto', corpo: '4' },
        baseConversa({ cooperadoId: 'coop-luciano' }),
      );

      expect(cooperadoUpdate).toHaveBeenCalledTimes(1);
      const updateCall = cooperadoUpdate.mock.calls[0][0];
      expect(updateCall.where).toEqual({ id: 'coop-luciano' });
      expect(typeof updateCall.data.codigoIndicacao).toBe('string');
      expect(updateCall.data.codigoIndicacao).toMatch(/^[A-Z0-9]{8}$/);

      // link enviado contem o codigo recem-gerado
      const codigoGerado = updateCall.data.codigoIndicacao as string;
      expect(enviarMensagem).toHaveBeenCalledWith(
        '+5527981341348',
        expect.stringContaining(`/entrar?ref=${codigoGerado}`),
      );
    });

    it('R5 cooperadoId aponta pra cooperado inexistente -> NAO envia, loga warn', async () => {
      setupTransicaoParaEnvioConvite();
      cooperadoFindFirstAux.mockResolvedValueOnce(null);

      await service.processarComFluxoDinamico(
        { telefone: '+5527981341348', tipo: 'texto', corpo: '4' },
        baseConversa({ cooperadoId: 'cooperado-zumbi' }),
      );

      expect(enviarMensagem).not.toHaveBeenCalled();
      expect(cooperadoUpdate).not.toHaveBeenCalled();
    });

    it('R5 ZERO SIDE EFFECT em simular(): acao reportada mas NAO executada', async () => {
      // simular() retorna acaoAutomatica no output mas nao chama executarAcao
      etapaFindFirst.mockResolvedValueOnce({
        id: 'e1', cooperativaId: 'coop-A',
        gatilhos: [{ resposta: '4', proximoEstado: 'ENVIAR_CONVITE' }],
        modeloMensagemId: null, acaoAutomatica: null,
      });
      etapaFindFirst.mockResolvedValueOnce({
        id: 'e2', cooperativaId: null, nome: 'Convite', estado: 'ENVIAR_CONVITE',
        gatilhos: [], modeloMensagemId: null,
        acaoAutomatica: 'ENVIAR_LINK_INDICACAO',
      });

      const r = await service.simular({
        mensagem: '4', cooperativaId: 'coop-A', estadoInicial: 'INICIAL',
      });

      expect(r.acaoAutomatica).toBe('ENVIAR_LINK_INDICACAO');
      // simular nao chama executarAcao -> nao busca cooperado, nao envia, nao persiste
      expect(cooperadoFindUnique).not.toHaveBeenCalled();
      expect(cooperadoUpdate).not.toHaveBeenCalled();
      expect(enviarMensagem).not.toHaveBeenCalled();
    });
  });

  // ============================================================
  // Bloco 3 (21/05) — CONSULTAR_SALDO_CREDITOS via processarComFluxoDinamico
  // ============================================================
  describe('executarAcao(CONSULTAR_SALDO_CREDITOS) — via processarComFluxoDinamico', () => {
    const baseConversa = (over: Record<string, unknown> = {}) => ({
      id: 'conv-1',
      telefone: '+5527981341348',
      estado: 'MENU_COOPERADO',
      cooperativaId: 'coop-A',
      cooperadoId: 'coop-luciano',
      ...over,
    });

    const setupTransicaoParaSaldo = () => {
      // etapa MENU_COOPERADO com gatilho "1" -> VER_SALDO_CREDITOS
      etapaFindFirst.mockResolvedValueOnce({
        id: 'e-menu',
        cooperativaId: 'coop-A',
        gatilhos: [{ resposta: '1', proximoEstado: 'VER_SALDO_CREDITOS' }],
        modeloMensagemId: null,
      });
      // etapa VER_SALDO_CREDITOS (sem modelo, com acaoAutomatica)
      etapaFindFirst.mockResolvedValueOnce({
        id: 'e-saldo',
        cooperativaId: null,
        gatilhos: [],
        modeloMensagemId: null,
        acaoAutomatica: 'CONSULTAR_SALDO_CREDITOS',
      });
      conversaUpdate.mockResolvedValueOnce({});
    };

    beforeEach(() => {
      contratoFindMany.mockReset();
      faturaProcessadaFindFirst.mockReset();
      modeloFindFirst.mockReset();
    });

    it('SEM cooperadoId -> manda mensagem de cadastro, NAO consulta plano/saldo, NAO renderiza modelo', async () => {
      setupTransicaoParaSaldo();
      await service.processarComFluxoDinamico(
        { telefone: '+5527981341348', tipo: 'texto', corpo: '1' },
        baseConversa({ cooperadoId: null }),
      );

      expect(enviarMensagem).toHaveBeenCalledWith(
        '+5527981341348',
        expect.stringContaining('precisa ser cooperado'),
      );
      expect(contratoFindMany).not.toHaveBeenCalled();
      expect(faturaProcessadaFindFirst).not.toHaveBeenCalled();
      expect(modeloFindFirst).not.toHaveBeenCalled();
    });

    it('MULTI-TENANT: contratos + faturas filtrados por cooperativaId quando conhecida', async () => {
      setupTransicaoParaSaldo();
      contratoFindMany.mockResolvedValueOnce([
        { kwhContratoMensal: 20 },
        { kwhContratoMensal: 10 },
      ]);
      faturaProcessadaFindFirst.mockResolvedValueOnce({
        saldoKwhAtual: 320,
        validadeCreditos: new Date('2030-12-15'),
        mesReferencia: '04/2026',
        createdAt: new Date('2026-04-15'),
      });
      modeloFindFirst.mockResolvedValueOnce({
        id: 'm-saldo',
        nome: 'saldo_creditos_resultado',
        conteudo: '⚡ Plano: {{kwhContratoMensal}} kWh/mês\n{{linha_saldo}}{{linha_validade}}{{linha_ultima_fatura}}',
        cooperativaId: null,
      });

      await service.processarComFluxoDinamico(
        { telefone: '+5527981341348', tipo: 'texto', corpo: '1' },
        baseConversa(),
      );

      // Contrato: filtra cooperadoId + status ATIVO + cooperativaId (defesa)
      expect(contratoFindMany).toHaveBeenCalledWith({
        where: {
          cooperadoId: 'coop-luciano',
          status: 'ATIVO',
          cooperativaId: 'coop-A',
        },
        select: { kwhContratoMensal: true },
      });
      // FaturaProcessada: filtra cooperadoId + status APROVADA + cooperativaId
      expect(faturaProcessadaFindFirst).toHaveBeenCalledWith({
        where: {
          cooperadoId: 'coop-luciano',
          status: 'APROVADA',
          cooperativaId: 'coop-A',
        },
        orderBy: { createdAt: 'desc' },
        select: {
          saldoKwhAtual: true,
          validadeCreditos: true,
          mesReferencia: true,
          createdAt: true,
        },
      });
    });

    it('MULTI-TENANT: SEM cooperativaId na conversa -> queries sem cooperativaId (nao quebra)', async () => {
      setupTransicaoParaSaldo();
      contratoFindMany.mockResolvedValueOnce([]);
      faturaProcessadaFindFirst.mockResolvedValueOnce(null);
      modeloFindFirst.mockResolvedValueOnce({
        id: 'm-saldo',
        nome: 'saldo_creditos_resultado',
        conteudo: 'Plano: {{kwhContratoMensal}} kWh\n{{linha_ultima_fatura}}',
        cooperativaId: null,
      });

      await service.processarComFluxoDinamico(
        { telefone: '+5527981341348', tipo: 'texto', corpo: '1' },
        baseConversa({ cooperativaId: null }),
      );

      const whereContrato = contratoFindMany.mock.calls[0][0].where;
      expect(whereContrato).toEqual({ cooperadoId: 'coop-luciano', status: 'ATIVO' });
      expect(whereContrato).not.toHaveProperty('cooperativaId');

      const whereFatura = faturaProcessadaFindFirst.mock.calls[0][0].where;
      expect(whereFatura).toEqual({ cooperadoId: 'coop-luciano', status: 'APROVADA' });
      expect(whereFatura).not.toHaveProperty('cooperativaId');
    });

    it('CASO COMPLETO: plano + saldo + validade -> renderiza todas as linhas', async () => {
      setupTransicaoParaSaldo();
      contratoFindMany.mockResolvedValueOnce([{ kwhContratoMensal: 25 }]);
      faturaProcessadaFindFirst.mockResolvedValueOnce({
        saldoKwhAtual: 320,
        validadeCreditos: new Date('2030-12-15'),
        mesReferencia: '04/2026',
        createdAt: new Date('2026-04-15'),
      });
      modeloFindFirst.mockResolvedValueOnce({
        id: 'm-saldo',
        nome: 'saldo_creditos_resultado',
        conteudo:
          '⚡ Plano: {{kwhContratoMensal}} kWh\n' +
          '{{linha_saldo}}{{linha_validade}}{{linha_ultima_fatura}}',
        cooperativaId: null,
      });

      await service.processarComFluxoDinamico(
        { telefone: '+5527981341348', tipo: 'texto', corpo: '1' },
        baseConversa(),
      );

      const enviado = enviarMensagem.mock.calls[0][1] as string;
      expect(enviado).toContain('Plano: 25 kWh');
      expect(enviado).toContain('Saldo na distribuidora: 320 kWh');
      expect(enviado).toContain('Validade dos créditos: 12/2030');
      expect(enviado).toContain('Última fatura registrada: 04/2026');
      // Rodape universal sempre anexado
      expect(enviado).toContain('digite MENU');
    });

    it('FALLBACK: saldoKwhAtual=null -> linha do saldo SOME', async () => {
      setupTransicaoParaSaldo();
      contratoFindMany.mockResolvedValueOnce([{ kwhContratoMensal: 20 }]);
      faturaProcessadaFindFirst.mockResolvedValueOnce({
        saldoKwhAtual: null,
        validadeCreditos: new Date('2030-12-15'),
        mesReferencia: '04/2026',
        createdAt: new Date('2026-04-15'),
      });
      modeloFindFirst.mockResolvedValueOnce({
        id: 'm-saldo',
        nome: 'saldo_creditos_resultado',
        conteudo:
          'Plano: {{kwhContratoMensal}} kWh\n' +
          '{{linha_saldo}}{{linha_validade}}{{linha_ultima_fatura}}',
        cooperativaId: null,
      });

      await service.processarComFluxoDinamico(
        { telefone: '+5527981341348', tipo: 'texto', corpo: '1' },
        baseConversa(),
      );

      const enviado = enviarMensagem.mock.calls[0][1] as string;
      expect(enviado).not.toContain('Saldo na distribuidora');
      expect(enviado).toContain('Validade dos créditos: 12/2030');
      expect(enviado).toContain('Última fatura registrada: 04/2026');
    });

    it('FALLBACK: validadeCreditos=null -> linha da validade SOME', async () => {
      setupTransicaoParaSaldo();
      contratoFindMany.mockResolvedValueOnce([{ kwhContratoMensal: 20 }]);
      faturaProcessadaFindFirst.mockResolvedValueOnce({
        saldoKwhAtual: 100,
        validadeCreditos: null,
        mesReferencia: '04/2026',
        createdAt: new Date('2026-04-15'),
      });
      modeloFindFirst.mockResolvedValueOnce({
        id: 'm-saldo',
        nome: 'saldo_creditos_resultado',
        conteudo: '{{linha_saldo}}{{linha_validade}}{{linha_ultima_fatura}}',
        cooperativaId: null,
      });

      await service.processarComFluxoDinamico(
        { telefone: '+5527981341348', tipo: 'texto', corpo: '1' },
        baseConversa(),
      );

      const enviado = enviarMensagem.mock.calls[0][1] as string;
      expect(enviado).toContain('Saldo na distribuidora: 100 kWh');
      expect(enviado).not.toContain('Validade');
    });

    it('FALLBACK: nenhuma FaturaProcessada -> CTA pra enviar fatura', async () => {
      setupTransicaoParaSaldo();
      contratoFindMany.mockResolvedValueOnce([{ kwhContratoMensal: 20 }]);
      faturaProcessadaFindFirst.mockResolvedValueOnce(null);
      modeloFindFirst.mockResolvedValueOnce({
        id: 'm-saldo',
        nome: 'saldo_creditos_resultado',
        conteudo: 'Plano: {{kwhContratoMensal}}\n{{linha_saldo}}{{linha_validade}}{{linha_ultima_fatura}}',
        cooperativaId: null,
      });

      await service.processarComFluxoDinamico(
        { telefone: '+5527981341348', tipo: 'texto', corpo: '1' },
        baseConversa(),
      );

      const enviado = enviarMensagem.mock.calls[0][1] as string;
      expect(enviado).not.toContain('Saldo na distribuidora');
      expect(enviado).not.toContain('Validade');
      expect(enviado).toContain('Nenhuma fatura registrada');
      expect(enviado).toContain('envie a sua pelo bot');
    });

    it('Modelo saldo_creditos_resultado nao encontrado -> NAO envia mensagem, loga warn', async () => {
      setupTransicaoParaSaldo();
      contratoFindMany.mockResolvedValueOnce([{ kwhContratoMensal: 20 }]);
      faturaProcessadaFindFirst.mockResolvedValueOnce(null);
      modeloFindFirst.mockResolvedValueOnce(null);

      await service.processarComFluxoDinamico(
        { telefone: '+5527981341348', tipo: 'texto', corpo: '1' },
        baseConversa(),
      );

      expect(enviarMensagem).not.toHaveBeenCalled();
      expect(incrementarUso).not.toHaveBeenCalled();
    });

    it('Soma kwhContratoMensal de MULTIPLOS contratos ATIVOS', async () => {
      setupTransicaoParaSaldo();
      contratoFindMany.mockResolvedValueOnce([
        { kwhContratoMensal: 20 },
        { kwhContratoMensal: 15.5 },
        { kwhContratoMensal: 10 },
      ]);
      faturaProcessadaFindFirst.mockResolvedValueOnce(null);
      modeloFindFirst.mockResolvedValueOnce({
        id: 'm-saldo',
        nome: 'saldo_creditos_resultado',
        conteudo: '{{kwhContratoMensal}} kWh',
        cooperativaId: null,
      });

      await service.processarComFluxoDinamico(
        { telefone: '+5527981341348', tipo: 'texto', corpo: '1' },
        baseConversa(),
      );

      const enviado = enviarMensagem.mock.calls[0][1] as string;
      // 20 + 15.5 + 10 = 45.5
      expect(enviado).toContain('45,5 kWh');
    });

    it('ZERO SIDE EFFECT em simular(): retorna acaoAutomatica mas NAO consulta dados', async () => {
      etapaFindFirst.mockResolvedValueOnce({
        id: 'e1',
        cooperativaId: 'coop-A',
        gatilhos: [{ resposta: '1', proximoEstado: 'VER_SALDO_CREDITOS' }],
        modeloMensagemId: null,
        acaoAutomatica: null,
      });
      etapaFindFirst.mockResolvedValueOnce({
        id: 'e2',
        cooperativaId: null,
        nome: 'Ver Saldo',
        estado: 'VER_SALDO_CREDITOS',
        gatilhos: [],
        modeloMensagemId: null,
        acaoAutomatica: 'CONSULTAR_SALDO_CREDITOS',
      });

      const r = await service.simular({
        mensagem: '1',
        cooperativaId: 'coop-A',
        estadoInicial: 'MENU_COOPERADO',
        dadosTemp: { cooperadoId: 'coop-luciano' },
      });

      expect(r.acaoAutomatica).toBe('CONSULTAR_SALDO_CREDITOS');
      expect(contratoFindMany).not.toHaveBeenCalled();
      expect(faturaProcessadaFindFirst).not.toHaveBeenCalled();
      expect(enviarMensagem).not.toHaveBeenCalled();
    });
  });

  // ============================================================
  // Bloco 3 (21/05) — CONSULTAR_PROXIMA_FATURA via processarComFluxoDinamico
  // ============================================================
  describe('executarAcao(CONSULTAR_PROXIMA_FATURA) — via processarComFluxoDinamico', () => {
    const baseConversa = (over: Record<string, unknown> = {}) => ({
      id: 'conv-1',
      telefone: '+5527981341348',
      estado: 'MENU_COOPERADO',
      cooperativaId: 'coop-A',
      cooperadoId: 'coop-luciano',
      ...over,
    });

    const setupTransicaoParaFatura = () => {
      etapaFindFirst.mockResolvedValueOnce({
        id: 'e-menu',
        cooperativaId: 'coop-A',
        gatilhos: [{ resposta: '2', proximoEstado: 'VER_PROXIMA_FATURA' }],
        modeloMensagemId: null,
      });
      etapaFindFirst.mockResolvedValueOnce({
        id: 'e-fatura',
        cooperativaId: null,
        gatilhos: [],
        modeloMensagemId: null,
        acaoAutomatica: 'CONSULTAR_PROXIMA_FATURA',
      });
      conversaUpdate.mockResolvedValueOnce({});
    };

    beforeEach(() => {
      cobrancaFindFirst.mockReset();
      asaasCobrancaFindFirst.mockReset();
      modeloFindFirst.mockReset();
    });

    it('SEM cooperadoId -> manda mensagem de cadastro, NAO consulta cobranca', async () => {
      setupTransicaoParaFatura();
      await service.processarComFluxoDinamico(
        { telefone: '+5527981341348', tipo: 'texto', corpo: '2' },
        baseConversa({ cooperadoId: null }),
      );

      expect(enviarMensagem).toHaveBeenCalledWith(
        '+5527981341348',
        expect.stringContaining('precisa ser cooperado'),
      );
      expect(cobrancaFindFirst).not.toHaveBeenCalled();
      expect(asaasCobrancaFindFirst).not.toHaveBeenCalled();
    });

    it('BUG D-novo-U: query usa status [A_VENCER, VENCIDO] (NAO PENDENTE)', async () => {
      setupTransicaoParaFatura();
      cobrancaFindFirst.mockResolvedValueOnce(null);
      modeloFindFirst.mockResolvedValueOnce({
        id: 'm-fat',
        nome: 'proxima_fatura_resultado',
        conteudo: '{{bloco_fatura}}{{link_pagamento}}',
        cooperativaId: null,
      });

      await service.processarComFluxoDinamico(
        { telefone: '+5527981341348', tipo: 'texto', corpo: '2' },
        baseConversa(),
      );

      const where = cobrancaFindFirst.mock.calls[0][0].where;
      expect(where.status).toEqual({ in: ['A_VENCER', 'VENCIDO'] });
      // Defensivo: NAO usa PENDENTE (bug do hardcoded D-novo-U)
      expect(where.status.in).not.toContain('PENDENTE');
    });

    it('MULTI-TENANT: where.contrato filtra cooperadoId + cooperativaId', async () => {
      setupTransicaoParaFatura();
      cobrancaFindFirst.mockResolvedValueOnce(null);
      modeloFindFirst.mockResolvedValueOnce({
        id: 'm-fat',
        nome: 'proxima_fatura_resultado',
        conteudo: '{{bloco_fatura}}',
        cooperativaId: null,
      });

      await service.processarComFluxoDinamico(
        { telefone: '+5527981341348', tipo: 'texto', corpo: '2' },
        baseConversa(),
      );

      const where = cobrancaFindFirst.mock.calls[0][0].where;
      expect(where.contrato).toEqual({
        cooperadoId: 'coop-luciano',
        cooperativaId: 'coop-A',
      });
    });

    it('MULTI-TENANT: SEM cooperativaId na conversa -> where.contrato so com cooperadoId', async () => {
      setupTransicaoParaFatura();
      cobrancaFindFirst.mockResolvedValueOnce(null);
      modeloFindFirst.mockResolvedValueOnce({
        id: 'm-fat',
        nome: 'proxima_fatura_resultado',
        conteudo: '{{bloco_fatura}}',
        cooperativaId: null,
      });

      await service.processarComFluxoDinamico(
        { telefone: '+5527981341348', tipo: 'texto', corpo: '2' },
        baseConversa({ cooperativaId: null }),
      );

      const where = cobrancaFindFirst.mock.calls[0][0].where;
      expect(where.contrato).toEqual({ cooperadoId: 'coop-luciano' });
      expect(where.contrato).not.toHaveProperty('cooperativaId');
    });

    it('NENHUMA cobranca pendente -> mensagem "voce nao tem faturas em aberto"', async () => {
      setupTransicaoParaFatura();
      cobrancaFindFirst.mockResolvedValueOnce(null);
      modeloFindFirst.mockResolvedValueOnce({
        id: 'm-fat',
        nome: 'proxima_fatura_resultado',
        conteudo: '📄 *Sua próxima fatura:*\n\n{{bloco_fatura}}{{link_pagamento}}',
        cooperativaId: null,
      });

      await service.processarComFluxoDinamico(
        { telefone: '+5527981341348', tipo: 'texto', corpo: '2' },
        baseConversa(),
      );

      const enviado = enviarMensagem.mock.calls[0][1] as string;
      expect(enviado).toContain('não tem faturas em aberto');
      // Quando nao tem cobranca, NAO busca AsaasCobranca
      expect(asaasCobrancaFindFirst).not.toHaveBeenCalled();
    });

    it('Cobranca A_VENCER COM AsaasCobranca + linkPagamento -> inclui link no texto', async () => {
      setupTransicaoParaFatura();
      cobrancaFindFirst.mockResolvedValueOnce({
        id: 'cob-1',
        status: 'A_VENCER',
        valorLiquido: 350,
        valorBruto: 400,
        // Date local (mes 0-indexed) — evita shift UTC->BRT que daria 04/06 ao inves de 05/06.
        dataVencimento: new Date(2026, 5, 5),
        mesReferencia: 5,
        anoReferencia: 2026,
      });
      asaasCobrancaFindFirst.mockResolvedValueOnce({
        linkPagamento: 'https://asaas.com/i/abc123',
        pixCopiaECola: null,
      });
      modeloFindFirst.mockResolvedValueOnce({
        id: 'm-fat',
        nome: 'proxima_fatura_resultado',
        conteudo: '{{bloco_fatura}}{{link_pagamento}}',
        cooperativaId: null,
      });

      await service.processarComFluxoDinamico(
        { telefone: '+5527981341348', tipo: 'texto', corpo: '2' },
        baseConversa(),
      );

      const enviado = enviarMensagem.mock.calls[0][1] as string;
      expect(enviado).toContain('Valor: R$ 350,00');
      expect(enviado).toContain('Vencimento: 05/06/2026');
      expect(enviado).toContain('Status: A vencer');
      expect(enviado).toContain('https://asaas.com/i/abc123');
    });

    it('Cobranca SEM AsaasCobranca -> NAO inventa link', async () => {
      setupTransicaoParaFatura();
      cobrancaFindFirst.mockResolvedValueOnce({
        id: 'cob-1',
        status: 'VENCIDO',
        valorLiquido: 280,
        valorBruto: 320,
        dataVencimento: new Date('2026-05-10'),
        mesReferencia: 4,
        anoReferencia: 2026,
      });
      asaasCobrancaFindFirst.mockResolvedValueOnce(null);
      modeloFindFirst.mockResolvedValueOnce({
        id: 'm-fat',
        nome: 'proxima_fatura_resultado',
        conteudo: '{{bloco_fatura}}{{link_pagamento}}',
        cooperativaId: null,
      });

      await service.processarComFluxoDinamico(
        { telefone: '+5527981341348', tipo: 'texto', corpo: '2' },
        baseConversa(),
      );

      const enviado = enviarMensagem.mock.calls[0][1] as string;
      expect(enviado).toContain('Status: Vencida');
      expect(enviado).not.toContain('Pague aqui');
      expect(enviado).not.toContain('http');
    });

    it('Cobranca com valorLiquido null -> usa valorBruto como fallback', async () => {
      setupTransicaoParaFatura();
      cobrancaFindFirst.mockResolvedValueOnce({
        id: 'cob-1',
        status: 'A_VENCER',
        valorLiquido: null,
        valorBruto: 500,
        dataVencimento: new Date('2026-06-01'),
        mesReferencia: 5,
        anoReferencia: 2026,
      });
      asaasCobrancaFindFirst.mockResolvedValueOnce(null);
      modeloFindFirst.mockResolvedValueOnce({
        id: 'm-fat',
        nome: 'proxima_fatura_resultado',
        conteudo: '{{bloco_fatura}}',
        cooperativaId: null,
      });

      await service.processarComFluxoDinamico(
        { telefone: '+5527981341348', tipo: 'texto', corpo: '2' },
        baseConversa(),
      );

      const enviado = enviarMensagem.mock.calls[0][1] as string;
      expect(enviado).toContain('Valor: R$ 500,00');
    });

    it('Modelo proxima_fatura_resultado nao encontrado -> NAO envia mensagem', async () => {
      setupTransicaoParaFatura();
      cobrancaFindFirst.mockResolvedValueOnce({
        id: 'cob-1',
        status: 'A_VENCER',
        valorLiquido: 100,
        valorBruto: 100,
        dataVencimento: new Date('2026-06-01'),
        mesReferencia: 5,
        anoReferencia: 2026,
      });
      modeloFindFirst.mockResolvedValueOnce(null);

      await service.processarComFluxoDinamico(
        { telefone: '+5527981341348', tipo: 'texto', corpo: '2' },
        baseConversa(),
      );

      expect(enviarMensagem).not.toHaveBeenCalled();
      expect(incrementarUso).not.toHaveBeenCalled();
    });

    it('Rodape universal sempre anexado na resposta', async () => {
      setupTransicaoParaFatura();
      cobrancaFindFirst.mockResolvedValueOnce(null);
      modeloFindFirst.mockResolvedValueOnce({
        id: 'm-fat',
        nome: 'proxima_fatura_resultado',
        conteudo: '{{bloco_fatura}}',
        cooperativaId: null,
      });

      await service.processarComFluxoDinamico(
        { telefone: '+5527981341348', tipo: 'texto', corpo: '2' },
        baseConversa(),
      );

      const enviado = enviarMensagem.mock.calls[0][1] as string;
      expect(enviado).toContain('digite MENU, INÍCIO ou SAIR');
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

  // ============================================================
  // Etapa A do Bloco 4 (Sprint Bot Autoatendimento, 22/05): mudanca arquitetural
  // FUNDACIONAL pra Blocos 4 a 8 (todos fluxos de 2 turnos).
  //
  // - Gatilho.acao passa a ser PROCESSADO pelo motor (era ignorado desde 20/05).
  // - executarAcao() ganha 4o parametro `corpo` (texto digitado pelo cooperado).
  // - Quando gatilho.acao existe, motor DELEGA controle TOTAL pra acao:
  //   nao transiciona estado, nao renderiza modelo de destino, nao dispara
  //   acaoAutomatica. Acao cuida de validar/atualizar/responder/transicionar.
  // - Quando gatilho.acao NAO existe, comportamento atual preservado
  //   (transicao automatica + render modelo + dispara acaoAutomatica).
  // ============================================================
  describe('Etapa A Bloco 4 - avaliarGatilhoMatch() retorna gatilho completo', () => {
    it('Match exato sem acao retorna gatilho com acao: null', () => {
      const r = service.avaliarGatilhoMatch('ok', [
        { resposta: 'OK', proximoEstado: 'X' },
      ]);
      expect(r).toMatchObject({ proximoEstado: 'X', acao: null });
    });

    it('Match exato com acao retorna gatilho com acao preservada', () => {
      const r = service.avaliarGatilhoMatch('Joao Silva', [
        { resposta: '*', proximoEstado: 'MENU_COOPERADO', acao: 'ATUALIZAR_NOME_COOPERADO' },
      ]);
      expect(r).toMatchObject({
        proximoEstado: 'MENU_COOPERADO',
        acao: 'ATUALIZAR_NOME_COOPERADO',
      });
    });

    it('Sem match retorna null', () => {
      const r = service.avaliarGatilhoMatch('xyz', [
        { resposta: 'OK', proximoEstado: 'X' },
      ]);
      expect(r).toBeNull();
    });

    it('Wildcard NAO casa texto vazio (mesmo com acao definida)', () => {
      const r = service.avaliarGatilhoMatch('', [
        { resposta: '*', proximoEstado: 'X', acao: 'ACAO_QUALQUER' },
      ]);
      expect(r).toBeNull();
    });

    it('Lista vazia ou nula retorna null', () => {
      expect(service.avaliarGatilhoMatch('ok', [])).toBeNull();
      expect(service.avaliarGatilhoMatch('ok', null as any)).toBeNull();
    });
  });

  describe('Etapa A Bloco 4 - processarComFluxoDinamico() processa Gatilho.acao', () => {
    it('Gatilho COM acao: motor chama executarAcao(acao, conversa, dadosTemp, corpo)', async () => {
      etapaFindFirst.mockResolvedValueOnce({
        id: 'aguardando-novo-nome',
        cooperativaId: 'coop-A',
        nome: 'Aguardando novo nome',
        ordem: 52,
        estado: 'AGUARDANDO_NOVO_NOME',
        gatilhos: [
          {
            resposta: '*',
            proximoEstado: 'MENU_COOPERADO',
            acao: 'ATUALIZAR_NOME_COOPERADO',
          },
        ],
        modeloMensagemId: null,
        acaoAutomatica: null,
        ativo: true,
      });

      const executarAcaoSpy = jest
        .spyOn(service as any, 'executarAcao')
        .mockResolvedValue(undefined);

      await service.processarComFluxoDinamico(
        { telefone: '+5527981341348', tipo: 'texto', corpo: 'Joao Silva Da Cunha' },
        {
          id: 'c1',
          telefone: '+5527981341348',
          estado: 'AGUARDANDO_NOVO_NOME',
          cooperativaId: 'coop-A',
          cooperadoId: 'coop-luciano',
          dadosTemp: { foo: 'bar' },
        } as any,
      );

      expect(executarAcaoSpy).toHaveBeenCalledTimes(1);
      expect(executarAcaoSpy).toHaveBeenCalledWith(
        'ATUALIZAR_NOME_COOPERADO',
        expect.objectContaining({
          id: 'c1',
          cooperadoId: 'coop-luciano',
          cooperativaId: 'coop-A',
        }),
        { foo: 'bar' },
        'Joao Silva Da Cunha',
        undefined, // Bloco 6 Etapa B: 5o param media (undefined sem midia)
      );

      // Motor NAO transicionou estado (acao cuida disso)
      expect(conversaUpdate).not.toHaveBeenCalled();

      executarAcaoSpy.mockRestore();
    });

    it('Gatilho COM acao: motor NAO renderiza modelo nem busca etapa-destino', async () => {
      etapaFindFirst.mockResolvedValueOnce({
        id: 'aguardando-novo-nome',
        cooperativaId: 'coop-A',
        nome: 'Aguardando novo nome',
        ordem: 52,
        estado: 'AGUARDANDO_NOVO_NOME',
        gatilhos: [
          {
            resposta: '*',
            proximoEstado: 'MENU_COOPERADO',
            acao: 'ATUALIZAR_NOME_COOPERADO',
          },
        ],
        modeloMensagemId: null,
        acaoAutomatica: null,
        ativo: true,
      });

      const executarAcaoSpy = jest
        .spyOn(service as any, 'executarAcao')
        .mockResolvedValue(undefined);

      await service.processarComFluxoDinamico(
        { telefone: '+5527981341348', tipo: 'texto', corpo: 'Joao' },
        {
          id: 'c1',
          telefone: '+5527981341348',
          estado: 'AGUARDANDO_NOVO_NOME',
          cooperativaId: 'coop-A',
          cooperadoId: 'coop-luciano',
        } as any,
      );

      // Motor nao chamou modelo (acao envia mensagem propria)
      expect(modeloFindFirst).not.toHaveBeenCalled();
      // Motor so buscou a etapa atual (1 query), nao a destino
      expect(etapaFindFirst).toHaveBeenCalledTimes(1);

      executarAcaoSpy.mockRestore();
    });

    it('Gatilho SEM acao: comportamento ATUAL preservado (transicao + modelo + acaoAutomatica)', async () => {
      // Etapa atual
      etapaFindFirst.mockResolvedValueOnce({
        id: 'menu-cooperado',
        cooperativaId: 'coop-A',
        nome: 'Menu Cooperado',
        ordem: 1,
        estado: 'MENU_COOPERADO',
        gatilhos: [
          // SEM acao - comportamento atual
          { resposta: '1', proximoEstado: 'VER_SALDO_CREDITOS' },
        ],
        modeloMensagemId: null,
        acaoAutomatica: null,
        ativo: true,
      });
      // Etapa destino com modelo + acaoAutomatica
      etapaFindFirst.mockResolvedValueOnce({
        id: 'ver-saldo',
        cooperativaId: 'coop-A',
        nome: 'Ver saldo',
        ordem: 50,
        estado: 'VER_SALDO_CREDITOS',
        gatilhos: [],
        modeloMensagemId: null,
        acaoAutomatica: 'CONSULTAR_SALDO_CREDITOS',
        ativo: true,
      });

      const executarAcaoSpy = jest
        .spyOn(service as any, 'executarAcao')
        .mockResolvedValue(undefined);

      await service.processarComFluxoDinamico(
        { telefone: '+5527981341348', tipo: 'texto', corpo: '1' },
        {
          id: 'c1',
          telefone: '+5527981341348',
          estado: 'MENU_COOPERADO',
          cooperativaId: 'coop-A',
          cooperadoId: 'coop-luciano',
        } as any,
      );

      // Motor transiciona estado via prisma (comportamento atual)
      expect(conversaUpdate).toHaveBeenCalledWith({
        where: { id: 'c1' },
        data: { estado: 'VER_SALDO_CREDITOS' },
      });
      // Motor dispara acaoAutomatica da etapa-destino, agora com 4o param corpo
      // e 5o param media (undefined nesse caso, sem midia)
      expect(executarAcaoSpy).toHaveBeenCalledWith(
        'CONSULTAR_SALDO_CREDITOS',
        expect.objectContaining({ id: 'c1' }),
        undefined,
        '1',
        undefined,
      );

      executarAcaoSpy.mockRestore();
    });
  });

  describe('Etapa A Bloco 4 - executarAcao() aceita 4o parametro corpo', () => {
    it('Acao desconhecida cai no default (logger.warn) - assinatura aceita corpo string', async () => {
      const warnSpy = jest.spyOn(service['logger'], 'warn').mockImplementation();

      await (service as any).executarAcao(
        'ACAO_QUE_NAO_EXISTE',
        { id: 'c1', telefone: '+5527981341348', cooperadoId: null, cooperativaId: null },
        {},
        'texto digitado pelo cooperado',
      );

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Acao desconhecida'),
      );
      warnSpy.mockRestore();
    });
  });

  // ============================================================
  // Etapa C Bloco 4 (22/05): 3 acoes ATUALIZAR_*_COOPERADO ligadas no motor.
  // Reusa as validacoes do bot hardcoded (whatsapp-bot.service.ts:3752-3852)
  // mas com defense in depth multi-tenant via cooperativaId no updateMany.
  //
  // - ATUALIZAR_NOME_COOPERADO: trim, length >= 3, updateMany defense, retry no fluxo
  // - ATUALIZAR_EMAIL_COOPERADO: regex, toLowerCase, P2002 -> sugere +suffix, retry
  // - ATUALIZAR_CEP_COOPERADO: delega CepService.consultar; ENCONTRADO autopopula
  //   endereco; NAO_ENCONTRADO ou CEP_INVALIDO -> retry; FORA_DO_AR -> degradacao
  //   graciosa salva so o CEP digitado e transiciona.
  //
  // TELEFONE NAO entra (decisao Luciano 22/05: risco operacional de quebrar
  // proxima sessao do bot).
  // ============================================================
  describe('Etapa C Bloco 4 - executarAcao(ATUALIZAR_NOME_COOPERADO)', () => {
    const TELEFONE = '+5527981341348';

    const invocar = (conversa: any, corpo: string) =>
      (service as any).executarAcao('ATUALIZAR_NOME_COOPERADO', conversa, {}, corpo);

    it('SEM cooperadoId: envia mensagem de cadastro e NAO atualiza nada', async () => {
      await invocar(
        { id: 'c1', telefone: TELEFONE, cooperadoId: null, cooperativaId: null },
        'Joao Silva',
      );
      expect(enviarMensagem).toHaveBeenCalledWith(
        TELEFONE,
        expect.stringContaining('cooperado'),
      );
      expect(cooperadoUpdateMany).not.toHaveBeenCalled();
      expect(conversaUpdate).not.toHaveBeenCalled();
    });

    it('Nome com menos de 3 chars: pede de novo + NAO transiciona (retry)', async () => {
      await invocar(
        { id: 'c1', telefone: TELEFONE, cooperadoId: 'coop-luciano', cooperativaId: 'coop-A' },
        'Jo',
      );
      expect(enviarMensagem).toHaveBeenCalledWith(
        TELEFONE,
        expect.stringContaining('muito curto'),
      );
      expect(cooperadoUpdateMany).not.toHaveBeenCalled();
      expect(conversaUpdate).not.toHaveBeenCalled();
    });

    it('Nome valido: updateMany defense in depth + confirma + transiciona pra MENU_COOPERADO', async () => {
      cooperadoUpdateMany.mockResolvedValueOnce({ count: 1 });
      await invocar(
        { id: 'c1', telefone: TELEFONE, cooperadoId: 'coop-luciano', cooperativaId: 'coop-A' },
        '  Joao Silva Da Cunha  ',
      );
      expect(cooperadoUpdateMany).toHaveBeenCalledWith({
        where: { id: 'coop-luciano', cooperativaId: 'coop-A' },
        data: { nomeCompleto: 'Joao Silva Da Cunha' },
      });
      expect(enviarMensagem).toHaveBeenCalledWith(
        TELEFONE,
        expect.stringContaining('Joao Silva Da Cunha'),
      );
      expect(conversaUpdate).toHaveBeenCalledWith({
        where: { id: 'c1' },
        data: { estado: 'MENU_COOPERADO' },
      });
    });

    it('Sem cooperativaId conhecida: where soh com id (global)', async () => {
      cooperadoUpdateMany.mockResolvedValueOnce({ count: 1 });
      await invocar(
        { id: 'c1', telefone: TELEFONE, cooperadoId: 'coop-luciano', cooperativaId: null },
        'Maria Silva',
      );
      const where = cooperadoUpdateMany.mock.calls[0][0].where;
      expect(where).toEqual({ id: 'coop-luciano' });
      expect(where).not.toHaveProperty('cooperativaId');
    });

    it('updateMany retorna count=0 (cross-tenant bloqueado): erro generico + NAO transiciona', async () => {
      cooperadoUpdateMany.mockResolvedValueOnce({ count: 0 });
      await invocar(
        { id: 'c1', telefone: TELEFONE, cooperadoId: 'coop-luciano', cooperativaId: 'coop-A' },
        'Joao Silva',
      );
      expect(enviarMensagem).toHaveBeenCalledWith(
        TELEFONE,
        expect.stringContaining('atualizar'),
      );
      expect(conversaUpdate).not.toHaveBeenCalled();
    });
  });

  describe('Etapa C Bloco 4 - executarAcao(ATUALIZAR_EMAIL_COOPERADO)', () => {
    const TELEFONE = '+5527981341348';

    const invocar = (conversa: any, corpo: string) =>
      (service as any).executarAcao('ATUALIZAR_EMAIL_COOPERADO', conversa, {}, corpo);

    it('SEM cooperadoId: mensagem de cadastro + nao atualiza', async () => {
      await invocar(
        { id: 'c1', telefone: TELEFONE, cooperadoId: null, cooperativaId: null },
        'novo@email.com',
      );
      expect(enviarMensagem).toHaveBeenCalledWith(
        TELEFONE,
        expect.stringContaining('cooperado'),
      );
      expect(cooperadoUpdateMany).not.toHaveBeenCalled();
    });

    it('Email com regex invalido: pede de novo + NAO transiciona (retry)', async () => {
      await invocar(
        { id: 'c1', telefone: TELEFONE, cooperadoId: 'coop-luciano', cooperativaId: 'coop-A' },
        'sem-arroba.com',
      );
      expect(enviarMensagem).toHaveBeenCalledWith(
        TELEFONE,
        expect.stringContaining('inv'),
      );
      expect(cooperadoUpdateMany).not.toHaveBeenCalled();
      expect(conversaUpdate).not.toHaveBeenCalled();
    });

    it('Email valido: normaliza (lowercase + trim) + atualiza + confirma + transiciona', async () => {
      cooperadoUpdateMany.mockResolvedValueOnce({ count: 1 });
      await invocar(
        { id: 'c1', telefone: TELEFONE, cooperadoId: 'coop-luciano', cooperativaId: 'coop-A' },
        '  NOVO@Email.COM  ',
      );
      expect(cooperadoUpdateMany).toHaveBeenCalledWith({
        where: { id: 'coop-luciano', cooperativaId: 'coop-A' },
        data: { email: 'novo@email.com' },
      });
      expect(conversaUpdate).toHaveBeenCalledWith({
        where: { id: 'c1' },
        data: { estado: 'MENU_COOPERADO' },
      });
    });

    it('P2002 unique violation: mensagem com sugestao +suffix + NAO transiciona (retry)', async () => {
      // Prisma erro P2002
      const p2002 = Object.assign(new Error('Unique constraint failed'), {
        code: 'P2002',
      });
      cooperadoUpdateMany.mockRejectedValueOnce(p2002);
      await invocar(
        { id: 'c1', telefone: TELEFONE, cooperadoId: 'coop-luciano', cooperativaId: 'coop-A' },
        'duplicado@email.com',
      );
      expect(enviarMensagem).toHaveBeenCalledWith(
        TELEFONE,
        expect.stringContaining('+CoopereBR'),
      );
      expect(conversaUpdate).not.toHaveBeenCalled();
    });

    it('Outro erro Prisma: mensagem generica + NAO transiciona', async () => {
      cooperadoUpdateMany.mockRejectedValueOnce(new Error('Connection lost'));
      await invocar(
        { id: 'c1', telefone: TELEFONE, cooperadoId: 'coop-luciano', cooperativaId: 'coop-A' },
        'novo@email.com',
      );
      expect(enviarMensagem).toHaveBeenCalledWith(
        TELEFONE,
        expect.stringContaining('atualizar'),
      );
      expect(conversaUpdate).not.toHaveBeenCalled();
    });
  });

  describe('Etapa C Bloco 4 - executarAcao(ATUALIZAR_CEP_COOPERADO)', () => {
    const TELEFONE = '+5527981341348';

    const invocar = (conversa: any, corpo: string) =>
      (service as any).executarAcao('ATUALIZAR_CEP_COOPERADO', conversa, {}, corpo);

    it('SEM cooperadoId: mensagem de cadastro + nao consulta ViaCEP', async () => {
      await invocar(
        { id: 'c1', telefone: TELEFONE, cooperadoId: null, cooperativaId: null },
        '01310100',
      );
      expect(enviarMensagem).toHaveBeenCalledWith(
        TELEFONE,
        expect.stringContaining('cooperado'),
      );
      expect(cepConsultar).not.toHaveBeenCalled();
      expect(cooperadoUpdateMany).not.toHaveBeenCalled();
    });

    it('CEP_INVALIDO: pede de novo + NAO transiciona (retry)', async () => {
      cepConsultar.mockResolvedValueOnce({ status: 'CEP_INVALIDO' });
      await invocar(
        { id: 'c1', telefone: TELEFONE, cooperadoId: 'coop-luciano', cooperativaId: 'coop-A' },
        '123',
      );
      expect(enviarMensagem).toHaveBeenCalledWith(
        TELEFONE,
        expect.stringContaining('inv'),
      );
      expect(cooperadoUpdateMany).not.toHaveBeenCalled();
      expect(conversaUpdate).not.toHaveBeenCalled();
    });

    it('CEP ENCONTRADO: autopopula endereco completo + transiciona', async () => {
      cepConsultar.mockResolvedValueOnce({
        status: 'ENCONTRADO',
        endereco: {
          cep: '01310-100',
          logradouro: 'Avenida Paulista',
          bairro: 'Bela Vista',
          cidade: 'Sao Paulo',
          estado: 'SP',
        },
      });
      cooperadoUpdateMany.mockResolvedValueOnce({ count: 1 });

      await invocar(
        { id: 'c1', telefone: TELEFONE, cooperadoId: 'coop-luciano', cooperativaId: 'coop-A' },
        '01310-100',
      );

      expect(cooperadoUpdateMany).toHaveBeenCalledWith({
        where: { id: 'coop-luciano', cooperativaId: 'coop-A' },
        data: {
          cep: '01310-100',
          logradouro: 'Avenida Paulista',
          bairro: 'Bela Vista',
          cidade: 'Sao Paulo',
          estado: 'SP',
        },
      });
      // Mensagem deve mencionar partes do endereco
      expect(enviarMensagem).toHaveBeenCalledWith(
        TELEFONE,
        expect.stringContaining('Avenida Paulista'),
      );
      expect(conversaUpdate).toHaveBeenCalledWith({
        where: { id: 'c1' },
        data: { estado: 'MENU_COOPERADO' },
      });
    });

    it('CEP NAO_ENCONTRADO: pede de novo + NAO transiciona (retry)', async () => {
      cepConsultar.mockResolvedValueOnce({ status: 'NAO_ENCONTRADO' });
      await invocar(
        { id: 'c1', telefone: TELEFONE, cooperadoId: 'coop-luciano', cooperativaId: 'coop-A' },
        '00000000',
      );
      expect(enviarMensagem).toHaveBeenCalledWith(
        TELEFONE,
        expect.stringContaining('encontrado'),
      );
      expect(cooperadoUpdateMany).not.toHaveBeenCalled();
      expect(conversaUpdate).not.toHaveBeenCalled();
    });

    it('ViaCEP FORA_DO_AR: salva so o CEP digitado + mensagem de degradacao + transiciona', async () => {
      cepConsultar.mockResolvedValueOnce({ status: 'FORA_DO_AR' });
      cooperadoUpdateMany.mockResolvedValueOnce({ count: 1 });

      await invocar(
        { id: 'c1', telefone: TELEFONE, cooperadoId: 'coop-luciano', cooperativaId: 'coop-A' },
        '01310-100',
      );

      // Salva so o CEP normalizado, NAO mexe em logradouro/bairro/cidade/estado
      expect(cooperadoUpdateMany).toHaveBeenCalledWith({
        where: { id: 'coop-luciano', cooperativaId: 'coop-A' },
        data: { cep: '01310-100' },
      });
      expect(enviarMensagem).toHaveBeenCalledWith(
        TELEFONE,
        expect.stringContaining('01310-100'),
      );
      // Transicao acontece mesmo com ViaCEP fora — nao trava o cooperado
      expect(conversaUpdate).toHaveBeenCalledWith({
        where: { id: 'c1' },
        data: { estado: 'MENU_COOPERADO' },
      });
    });

    it('CEP de cidade sem logradouro/bairro: monta mensagem so com cidade-UF', async () => {
      cepConsultar.mockResolvedValueOnce({
        status: 'ENCONTRADO',
        endereco: {
          cep: '29900-000',
          logradouro: '',
          bairro: '',
          cidade: 'Linhares',
          estado: 'ES',
        },
      });
      cooperadoUpdateMany.mockResolvedValueOnce({ count: 1 });

      await invocar(
        { id: 'c1', telefone: TELEFONE, cooperadoId: 'coop-luciano', cooperativaId: 'coop-A' },
        '29900000',
      );

      expect(enviarMensagem).toHaveBeenCalledWith(
        TELEFONE,
        expect.stringContaining('Linhares'),
      );
    });

    it('Sem cooperativaId conhecida: where soh com id', async () => {
      cepConsultar.mockResolvedValueOnce({
        status: 'ENCONTRADO',
        endereco: {
          cep: '01310-100',
          logradouro: 'Av Paulista',
          bairro: 'Bela Vista',
          cidade: 'Sao Paulo',
          estado: 'SP',
        },
      });
      cooperadoUpdateMany.mockResolvedValueOnce({ count: 1 });

      await invocar(
        { id: 'c1', telefone: TELEFONE, cooperadoId: 'coop-luciano', cooperativaId: null },
        '01310100',
      );

      const where = cooperadoUpdateMany.mock.calls[0][0].where;
      expect(where).toEqual({ id: 'coop-luciano' });
      expect(where).not.toHaveProperty('cooperativaId');
    });
  });

  // ============================================================
  // Etapa A Bloco 1.b (22/05) — 4o comando universal CHAMAR_DEPOIS
  // Completa a familia INICIO/SAIR/MENU/CHAMAR_DEPOIS. Persiste
  // dadosTemp.retornarEm (+24h, postergado pra 08:00 se cair fora
  // de 08-18h) e transiciona conversa pra estado AGENDADO_RETORNO.
  // O retorno em si fica a cargo do WhatsappConversaJob (Etapa B).
  //
  // Decisoes Luciano 22/05 (travadas no prompt da Fase 2):
  //  1. +24h FIXO (sem sub-menu de prazos)
  //  2. Ao retornar volta pro MENU_COOPERADO — NAO precisa persistir
  //     estadoAnterior
  //  3. Respeitar horario comercial 08-18h
  //
  // CUIDADO sinonimos: "DEPOIS" sozinho NAO entra (falso positivo).
  // ============================================================
  describe('Etapa A Bloco 1.b - detectarComandoUniversal() reconhece CHAMAR_DEPOIS', () => {
    it('"ME CHAME DEPOIS" retorna CHAMAR_DEPOIS', () => {
      expect(service.detectarComandoUniversal('ME CHAME DEPOIS')).toBe('CHAMAR_DEPOIS');
    });

    it('"me chame depois" (lowercase) retorna CHAMAR_DEPOIS', () => {
      expect(service.detectarComandoUniversal('me chame depois')).toBe('CHAMAR_DEPOIS');
    });

    it('"CHAME DEPOIS" retorna CHAMAR_DEPOIS', () => {
      expect(service.detectarComandoUniversal('CHAME DEPOIS')).toBe('CHAMAR_DEPOIS');
    });

    it('"OUTRA HORA" retorna CHAMAR_DEPOIS', () => {
      expect(service.detectarComandoUniversal('OUTRA HORA')).toBe('CHAMAR_DEPOIS');
    });

    it('"MAIS TARDE" retorna CHAMAR_DEPOIS', () => {
      expect(service.detectarComandoUniversal('MAIS TARDE')).toBe('CHAMAR_DEPOIS');
    });

    it('"ME LIGA DEPOIS" retorna CHAMAR_DEPOIS', () => {
      expect(service.detectarComandoUniversal('ME LIGA DEPOIS')).toBe('CHAMAR_DEPOIS');
    });

    it('"DEPOIS" sozinho NAO casa — evita falso positivo dentro de fluxos', () => {
      expect(service.detectarComandoUniversal('depois')).toBeNull();
      expect(service.detectarComandoUniversal('DEPOIS')).toBeNull();
    });

    it('Frase com palavras a mais NAO casa — match eh por igualdade exata', () => {
      expect(service.detectarComandoUniversal('vou pensar mais tarde')).toBeNull();
      expect(service.detectarComandoUniversal('me chame depois por favor')).toBeNull();
    });
  });

  describe('Etapa A Bloco 1.b - resolverEstadoComandoUniversal() trata CHAMAR_DEPOIS', () => {
    it('CHAMAR_DEPOIS retorna null (caminho proprio, igual SAIR)', () => {
      const r = service.resolverEstadoComandoUniversal(
        'CHAMAR_DEPOIS' as any,
        { cooperadoId: 'coop-luciano' },
      );
      expect(r).toBeNull();
    });

    it('CHAMAR_DEPOIS retorna null inclusive sem cooperadoId', () => {
      const r = service.resolverEstadoComandoUniversal(
        'CHAMAR_DEPOIS' as any,
        { cooperadoId: null },
      );
      expect(r).toBeNull();
    });
  });

  describe('Etapa A Bloco 1.b - calcularRetornarEm() postergacao horario comercial', () => {
    afterEach(() => {
      jest.useRealTimers();
    });

    it('Dentro do horario comercial (14:00): +24h cai em 14:00 amanha, mantem', () => {
      jest.useFakeTimers().setSystemTime(new Date(2026, 4, 22, 14, 0, 0));
      const r: Date = (service as any).calcularRetornarEm();
      expect(r.getDate()).toBe(23);
      expect(r.getMonth()).toBe(4);
      expect(r.getFullYear()).toBe(2026);
      expect(r.getHours()).toBe(14);
      expect(r.getMinutes()).toBe(0);
    });

    it('Madrugada (02:00): +24h cai em 02:00 amanha, posterga pra 08:00 amanha', () => {
      jest.useFakeTimers().setSystemTime(new Date(2026, 4, 22, 2, 0, 0));
      const r: Date = (service as any).calcularRetornarEm();
      expect(r.getDate()).toBe(23);
      expect(r.getHours()).toBe(8);
      expect(r.getMinutes()).toBe(0);
    });

    it('Noite (19:00): +24h cai em 19:00 amanha (>=18), posterga pra 08:00 do dia seguinte (D+2)', () => {
      jest.useFakeTimers().setSystemTime(new Date(2026, 4, 22, 19, 0, 0));
      const r: Date = (service as any).calcularRetornarEm();
      expect(r.getDate()).toBe(24);
      expect(r.getHours()).toBe(8);
    });

    it('Limite 18:00 — fora do horario comercial (>=18) -> posterga', () => {
      jest.useFakeTimers().setSystemTime(new Date(2026, 4, 22, 18, 0, 0));
      const r: Date = (service as any).calcularRetornarEm();
      expect(r.getDate()).toBe(24);
      expect(r.getHours()).toBe(8);
    });

    it('Limite 08:00 — dentro do horario (>=8 e <18) -> mantem', () => {
      jest.useFakeTimers().setSystemTime(new Date(2026, 4, 22, 8, 0, 0));
      const r: Date = (service as any).calcularRetornarEm();
      expect(r.getDate()).toBe(23);
      expect(r.getHours()).toBe(8);
      expect(r.getMinutes()).toBe(0);
    });

    it('Comportamento aceito: +24h pode cair em sabado/domingo (sem logica de fim de semana)', () => {
      // Sexta 22/05/2026, 14:00 -> sabado 23/05/2026 14:00.
      // Nao posterga (decisao Luciano: filtro horario do dia, nao do dia da semana).
      jest.useFakeTimers().setSystemTime(new Date(2026, 4, 22, 14, 0, 0));
      const r: Date = (service as any).calcularRetornarEm();
      expect(r.getDay()).toBe(6); // sabado
      expect(r.getHours()).toBe(14);
    });
  });

  describe('Etapa A Bloco 1.b - executarComandoUniversalReal(CHAMAR_DEPOIS)', () => {
    const TELEFONE = '+5527981341348';

    beforeEach(() => {
      // Trava data pra que retornarEm seja determinístico nos asserts.
      jest.useFakeTimers().setSystemTime(new Date(2026, 4, 22, 14, 0, 0));
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    const invocar = (conversa: any) =>
      (service as any).executarComandoUniversalReal(
        'CHAMAR_DEPOIS',
        { telefone: TELEFONE, tipo: 'texto', corpo: 'me chame depois' },
        conversa,
      );

    it('Atualiza estado pra AGENDADO_RETORNO e persiste dadosTemp.retornarEm', async () => {
      await invocar({
        id: 'c1',
        telefone: TELEFONE,
        estado: 'MENU_COOPERADO',
        cooperadoId: 'coop-luciano',
        cooperativaId: 'coop-A',
        dadosTemp: { algumOutroCampo: 'preservado' },
      });

      expect(conversaUpdate).toHaveBeenCalledTimes(1);
      const args = conversaUpdate.mock.calls[0][0];
      expect(args.where).toEqual({ id: 'c1' });
      expect(args.data.estado).toBe('AGENDADO_RETORNO');
      // Preserva dadosTemp existente + adiciona retornarEm (ISO string).
      expect(args.data.dadosTemp.algumOutroCampo).toBe('preservado');
      expect(typeof args.data.dadosTemp.retornarEm).toBe('string');
      const retornoEm = new Date(args.data.dadosTemp.retornarEm);
      expect(retornoEm.getDate()).toBe(23);
      expect(retornoEm.getHours()).toBe(14);
    });

    it('Envia mensagem de confirmacao hardcoded', async () => {
      await invocar({
        id: 'c1',
        telefone: TELEFONE,
        estado: 'MENU_COOPERADO',
        cooperadoId: 'coop-luciano',
        cooperativaId: 'coop-A',
      });
      expect(enviarMensagem).toHaveBeenCalledWith(
        TELEFONE,
        expect.stringMatching(/amanh/i),
      );
    });

    it('NAO persiste estadoAnterior — decisao Luciano: volta pro menu, contexto perdido', async () => {
      await invocar({
        id: 'c1',
        telefone: TELEFONE,
        estado: 'AGUARDANDO_NOVO_EMAIL',
        cooperadoId: 'coop-luciano',
        cooperativaId: 'coop-A',
      });
      const dadosTempPersistido = conversaUpdate.mock.calls[0][0].data.dadosTemp;
      expect(dadosTempPersistido).not.toHaveProperty('estadoAnterior');
    });

    it('dadosTemp ausente (null) na conversa: persiste apenas retornarEm', async () => {
      await invocar({
        id: 'c1',
        telefone: TELEFONE,
        estado: 'MENU_COOPERADO',
        cooperadoId: 'coop-luciano',
        cooperativaId: 'coop-A',
        // sem dadosTemp
      });
      const dadosTempPersistido = conversaUpdate.mock.calls[0][0].data.dadosTemp;
      expect(Object.keys(dadosTempPersistido)).toEqual(['retornarEm']);
    });

    it('Retorna true (sinal de que motor tratou — fluxo dinamico encerra)', async () => {
      const ok = await invocar({
        id: 'c1',
        telefone: TELEFONE,
        estado: 'MENU_COOPERADO',
        cooperadoId: 'coop-luciano',
        cooperativaId: 'coop-A',
      });
      expect(ok).toBe(true);
    });
  });

  // ============================================================
  // Bloco 7 Etapa B (23/05) — acao REGISTRAR_NPS no motor.
  //
  // Reusa o padrao Bloco 4 (gatilho wildcard '*' com acao -> motor delega
  // controle pra acao via Gatilho.acao). A acao valida parseInt 0-10,
  // persiste em NpsResposta com cooperativaId, renderiza modelo nps_recebido
  // do banco com vars e transiciona pra MENU_COOPERADO. Retry inline se
  // nota invalida (mantem em NPS_AGUARDANDO_NOTA).
  //
  // Decisoes Luciano 23/05 (Fase 2 Bloco 7):
  //  - cooperativaId vem da sessao (multi-tenant)
  //  - comentario sempre null neste bloco (pre-pago no schema)
  //  - estado pos-NPS = MENU_COOPERADO (consistente Blocos 4/1.b)
  //  - hardcoded handleNpsNota preservado como fallback (debt catalogado)
  // ============================================================
  // ============================================================
  // Bloco 6 Etapa B (23/05) — Extensao do motor pra receber MIDIA.
  //
  // CAVEAT da Fase 1 resolvido: o motor era text-only. executarAcao
  // recebia (acao, conversa, dados, corpo) — sem mediaBase64/mimeType.
  // Etapa AGUARDANDO_FATURA_PROXY exige receber foto/PDF e disparar OCR.
  //
  // Mudancas:
  // 1. avaliarGatilhoMatch ganha 3o parametro opcional `temMidia`.
  //    Wildcard '*' casa se (corpo nao-vazio) OU (temMidia=true).
  //    Mantem comportamento texto: corpo vazio sem midia ainda nao casa.
  // 2. executarAcao ganha 5o parametro opcional `media?: { base64, mimeType,
  //    nomeArquivo? }`. Acoes que NAO usam midia ignoram (compatibilidade).
  //    Acoes tipo PROCESSAR_OCR_* usam.
  // 3. processarComFluxoDinamico detecta mensagem com tipo='imagem'|'documento'
  //    + mediaBase64 e propaga pra executarAcao via 5o param. Wildcard com
  //    midia casa mesmo sem corpo de texto.
  //
  // Decisao Luciano 23/05 #1 = (A) estender motor (vs deixar OCR no hardcoded).
  // Pre-paga qualquer fluxo futuro com imagem/PDF (cadastro inicial, comprovante
  // de pagamento, etc).
  //
  // Decisao TECNICA orquestrador: aceitaMidia POR HEURISTICA (corpo do wildcard
  // ou ação) — SEM campo novo no schema FluxoEtapa. Justificativa: menos
  // invasivo, melhor reuso. Etapa que precisa de midia simplesmente tem gatilho
  // wildcard + acao apropriada.
  // ============================================================
  describe('Bloco 6 Etapa B - avaliarGatilhoMatch() aceita midia', () => {
    it('Wildcard com corpo vazio + temMidia=true: casa', () => {
      const r = service.avaliarGatilhoMatch(
        '',
        [{ resposta: '*', proximoEstado: 'X', acao: 'PROCESSAR_OCR_PROXY' }],
        true,
      );
      expect(r).toMatchObject({ proximoEstado: 'X', acao: 'PROCESSAR_OCR_PROXY' });
    });

    it('Wildcard com corpo vazio + temMidia=false: NAO casa (compat texto)', () => {
      const r = service.avaliarGatilhoMatch(
        '',
        [{ resposta: '*', proximoEstado: 'X' }],
        false,
      );
      expect(r).toBeNull();
    });

    it('Wildcard com corpo vazio sem 3o param: NAO casa (default false — compat)', () => {
      const r = service.avaliarGatilhoMatch(
        '',
        [{ resposta: '*', proximoEstado: 'X' }],
      );
      expect(r).toBeNull();
    });

    it('Wildcard com corpo nao-vazio + temMidia=false: casa (compat texto)', () => {
      const r = service.avaliarGatilhoMatch(
        'qualquer texto',
        [{ resposta: '*', proximoEstado: 'X' }],
        false,
      );
      expect(r).toMatchObject({ proximoEstado: 'X' });
    });

    it('Gatilho exato com temMidia=true: NAO confunde com midia (match exato vence)', () => {
      const r = service.avaliarGatilhoMatch(
        '1',
        [{ resposta: '1', proximoEstado: 'X' }],
        true,
      );
      expect(r).toMatchObject({ proximoEstado: 'X' });
    });
  });

  describe('Bloco 6 Etapa B - processarComFluxoDinamico() propaga midia pra executarAcao', () => {
    it('Mensagem com tipo=imagem + mediaBase64: passa media pra executarAcao', async () => {
      etapaFindFirst.mockResolvedValueOnce({
        id: 'f-proxy-fatura',
        cooperativaId: null,
        nome: 'Aguardando Fatura Proxy',
        ordem: 15,
        estado: 'AGUARDANDO_FATURA_PROXY',
        gatilhos: [
          {
            resposta: '*',
            proximoEstado: 'CONFIRMAR_PROXY',
            acao: 'PROCESSAR_OCR_PROXY',
          },
        ],
        modeloMensagemId: null,
        acaoAutomatica: null,
        ativo: true,
      });

      const executarAcaoSpy = jest
        .spyOn(service as any, 'executarAcao')
        .mockResolvedValue(undefined);

      await service.processarComFluxoDinamico(
        {
          telefone: '+5527981341348',
          tipo: 'imagem',
          mediaBase64: 'BASE64FAKE',
          mimeType: 'image/jpeg',
          corpo: '',
        },
        {
          id: 'c1',
          telefone: '+5527981341348',
          estado: 'AGUARDANDO_FATURA_PROXY',
          cooperativaId: 'coop-A',
          cooperadoId: 'coop-luciano',
          dadosTemp: { proxyNome: 'Joao' },
        } as any,
      );

      expect(executarAcaoSpy).toHaveBeenCalledWith(
        'PROCESSAR_OCR_PROXY',
        expect.objectContaining({ id: 'c1' }),
        { proxyNome: 'Joao' },
        '',
        expect.objectContaining({
          base64: 'BASE64FAKE',
          mimeType: 'image/jpeg',
        }),
      );

      executarAcaoSpy.mockRestore();
    });

    it('Mensagem com tipo=documento (PDF): passa media com mimeType correto', async () => {
      etapaFindFirst.mockResolvedValueOnce({
        id: 'f-proxy-fatura',
        cooperativaId: null,
        nome: 'Aguardando Fatura Proxy',
        ordem: 15,
        estado: 'AGUARDANDO_FATURA_PROXY',
        gatilhos: [
          {
            resposta: '*',
            proximoEstado: 'CONFIRMAR_PROXY',
            acao: 'PROCESSAR_OCR_PROXY',
          },
        ],
        modeloMensagemId: null,
        acaoAutomatica: null,
        ativo: true,
      });

      const executarAcaoSpy = jest
        .spyOn(service as any, 'executarAcao')
        .mockResolvedValue(undefined);

      await service.processarComFluxoDinamico(
        {
          telefone: '+5527981341348',
          tipo: 'documento',
          mediaBase64: 'PDFBASE64',
          mimeType: 'application/pdf',
          corpo: '',
        },
        {
          id: 'c1',
          telefone: '+5527981341348',
          estado: 'AGUARDANDO_FATURA_PROXY',
          cooperativaId: 'coop-A',
          cooperadoId: 'coop-luciano',
        } as any,
      );

      const call = executarAcaoSpy.mock.calls[0];
      expect(call[4]).toMatchObject({
        base64: 'PDFBASE64',
        mimeType: 'application/pdf',
      });

      executarAcaoSpy.mockRestore();
    });

    it('Mensagem texto puro (sem midia): media param eh undefined', async () => {
      etapaFindFirst.mockResolvedValueOnce({
        id: 'menu',
        cooperativaId: null,
        nome: 'Menu',
        ordem: 1,
        estado: 'MENU_COOPERADO',
        gatilhos: [{ resposta: '1', proximoEstado: 'VER_SALDO_CREDITOS' }],
        modeloMensagemId: null,
        acaoAutomatica: null,
        ativo: true,
      });
      etapaFindFirst.mockResolvedValueOnce({
        id: 'ver-saldo',
        cooperativaId: null,
        nome: 'Ver saldo',
        ordem: 50,
        estado: 'VER_SALDO_CREDITOS',
        gatilhos: [],
        modeloMensagemId: null,
        acaoAutomatica: 'CONSULTAR_SALDO_CREDITOS',
        ativo: true,
      });

      const executarAcaoSpy = jest
        .spyOn(service as any, 'executarAcao')
        .mockResolvedValue(undefined);

      await service.processarComFluxoDinamico(
        { telefone: '+5527981341348', tipo: 'texto', corpo: '1' },
        {
          id: 'c1',
          telefone: '+5527981341348',
          estado: 'MENU_COOPERADO',
          cooperativaId: 'coop-A',
          cooperadoId: 'coop-luciano',
        } as any,
      );

      // executarAcao chamado, 5o param eh undefined (sem midia)
      const call = executarAcaoSpy.mock.calls[0];
      expect(call[4]).toBeUndefined();

      executarAcaoSpy.mockRestore();
    });

    it('Mensagem com midia em etapa SEM gatilho wildcard: motor nao trata (retorna false)', async () => {
      etapaFindFirst.mockResolvedValueOnce({
        id: 'menu',
        cooperativaId: null,
        nome: 'Menu',
        ordem: 1,
        estado: 'MENU_COOPERADO',
        gatilhos: [{ resposta: '1', proximoEstado: 'X' }],
        modeloMensagemId: null,
        acaoAutomatica: null,
        ativo: true,
      });

      const r = await service.processarComFluxoDinamico(
        {
          telefone: '+5527981341348',
          tipo: 'imagem',
          mediaBase64: 'X',
          mimeType: 'image/jpeg',
          corpo: '',
        },
        {
          id: 'c1',
          telefone: '+5527981341348',
          estado: 'MENU_COOPERADO',
          cooperativaId: 'coop-A',
          cooperadoId: 'coop-luciano',
        } as any,
      );

      // Nenhum gatilho casou (corpo vazio + sem wildcard) → motor retorna false
      expect(r).toBe(false);
    });
  });

  // ============================================================
  // Bloco 6 Etapa C (23/05) — 4 acoes do fluxo Cadastro Proxy.
  //
  // Padrao Bloco 4/7 (acao de turno): guard cooperadoId/dadosTemp + validar
  // input + persistir + transicionar OU retry inline se invalido.
  //
  // Fluxo:
  //  - SALVAR_PROXY_NOME: valida length 3+, dadosTemp.proxyNome, transiciona
  //    pra CADASTRO_PROXY_TELEFONE.
  //  - SALVAR_PROXY_TELEFONE: valida 10-13 digitos, prefixa 55, persiste,
  //    transiciona pra AGUARDANDO_FATURA_PROXY.
  //  - PROCESSAR_OCR_PROXY: recebe media (Bloco 6 Etapa B), envia
  //    "Analisando...", chama extrairOcr sincrono, valida consumoAtualKwh>0,
  //    renderiza modelo proxy_confirmar (vars {{titular}}, {{telefone}}),
  //    transiciona pra CONFIRMAR_PROXY.
  //  - CRIAR_COOPERADO_PROXY: cria Cooperado PENDENTE_ASSINATURA +
  //    cooperadoIndicadorId + cooperativaId + Indicacao formal status
  //    PENDENTE + JWT 7d + envia WA pro amigo + notifica indicador +
  //    transiciona MENU_COOPERADO.
  //
  // Decisoes Luciano 23/05:
  //  - cooperativaId herda do indicador (dadosTemp.cooperativaId)
  //  - Indicacao formal criada AGORA (vs so listener futuro) — defense in
  //    depth + queries simples
  //  - Modelo proxy_confirmar mapeia {{titular}}<-proxyNome, {{telefone}}<-
  //    proxyTelefone (decisao tecnica)
  // ============================================================
  describe('Bloco 6 Etapa C - executarAcao(SALVAR_PROXY_NOME)', () => {
    const TELEFONE = '+5527981341348';

    const invocar = (conversa: any, corpo: string) =>
      (service as any).executarAcao('SALVAR_PROXY_NOME', conversa, conversa.dadosTemp ?? {}, corpo);

    it('Nome valido: persiste proxyNome em dadosTemp + transiciona CADASTRO_PROXY_TELEFONE', async () => {
      await invocar(
        {
          id: 'c1',
          telefone: TELEFONE,
          cooperadoId: 'coop-luciano',
          cooperativaId: 'coop-A',
          dadosTemp: { indicadorId: 'coop-luciano', cooperativaId: 'coop-A' },
        },
        'Joao Silva',
      );

      expect(conversaUpdate).toHaveBeenCalledWith({
        where: { id: 'c1' },
        data: {
          estado: 'CADASTRO_PROXY_TELEFONE',
          dadosTemp: expect.objectContaining({
            indicadorId: 'coop-luciano',
            cooperativaId: 'coop-A',
            proxyNome: 'Joao Silva',
          }),
        },
      });
      // Envia confirmacao breve com proximo passo
      expect(enviarMensagem).toHaveBeenCalled();
    });

    it('Nome com espaco em volta: trim + persiste', async () => {
      await invocar(
        {
          id: 'c1',
          telefone: TELEFONE,
          cooperadoId: 'coop-luciano',
          cooperativaId: 'coop-A',
          dadosTemp: {},
        },
        '  Maria  ',
      );
      const data = conversaUpdate.mock.calls[0][0].data;
      expect(data.dadosTemp.proxyNome).toBe('Maria');
    });

    it('Nome com menos de 3 chars: erro + NAO transiciona (retry)', async () => {
      await invocar(
        {
          id: 'c1',
          telefone: TELEFONE,
          cooperadoId: 'coop-luciano',
          cooperativaId: 'coop-A',
          dadosTemp: {},
        },
        'Jo',
      );
      expect(enviarMensagem).toHaveBeenCalledWith(
        TELEFONE,
        expect.stringMatching(/nome.*completo/i),
      );
      expect(conversaUpdate).not.toHaveBeenCalled();
    });

    it('dadosTemp ausente: cria novo com proxyNome', async () => {
      await invocar(
        {
          id: 'c1',
          telefone: TELEFONE,
          cooperadoId: 'coop-luciano',
          cooperativaId: 'coop-A',
        },
        'Pedro',
      );
      const data = conversaUpdate.mock.calls[0][0].data;
      expect(data.dadosTemp).toEqual({ proxyNome: 'Pedro' });
    });
  });

  describe('Bloco 6 Etapa C - executarAcao(SALVAR_PROXY_TELEFONE)', () => {
    const TELEFONE = '+5527981341348';

    const invocar = (conversa: any, corpo: string) =>
      (service as any).executarAcao('SALVAR_PROXY_TELEFONE', conversa, conversa.dadosTemp ?? {}, corpo);

    it('11 digitos sem prefixo 55: prefixa + persiste + transiciona AGUARDANDO_FATURA_PROXY', async () => {
      await invocar(
        {
          id: 'c1',
          telefone: TELEFONE,
          cooperadoId: 'coop-luciano',
          cooperativaId: 'coop-A',
          dadosTemp: { proxyNome: 'Joao' },
        },
        '27999991234',
      );
      const data = conversaUpdate.mock.calls[0][0].data;
      expect(data.estado).toBe('AGUARDANDO_FATURA_PROXY');
      expect(data.dadosTemp.proxyTelefone).toBe('5527999991234');
    });

    it('13 digitos ja com 55: mantem prefixo', async () => {
      await invocar(
        {
          id: 'c1',
          telefone: TELEFONE,
          cooperadoId: 'coop-luciano',
          cooperativaId: 'coop-A',
          dadosTemp: { proxyNome: 'Joao' },
        },
        '5527999991234',
      );
      const data = conversaUpdate.mock.calls[0][0].data;
      expect(data.dadosTemp.proxyTelefone).toBe('5527999991234');
    });

    it('Texto com simbolos: replace /\\D/g + valida', async () => {
      await invocar(
        {
          id: 'c1',
          telefone: TELEFONE,
          cooperadoId: 'coop-luciano',
          cooperativaId: 'coop-A',
          dadosTemp: { proxyNome: 'Joao' },
        },
        '(27) 99999-1234',
      );
      const data = conversaUpdate.mock.calls[0][0].data;
      expect(data.dadosTemp.proxyTelefone).toBe('5527999991234');
    });

    it('Menos de 10 digitos: erro + NAO transiciona', async () => {
      await invocar(
        {
          id: 'c1',
          telefone: TELEFONE,
          cooperadoId: 'coop-luciano',
          cooperativaId: 'coop-A',
          dadosTemp: { proxyNome: 'Joao' },
        },
        '999',
      );
      expect(enviarMensagem).toHaveBeenCalledWith(
        TELEFONE,
        expect.stringMatching(/inv|DDD/i),
      );
      expect(conversaUpdate).not.toHaveBeenCalled();
    });

    it('Mais de 13 digitos: erro + NAO transiciona', async () => {
      await invocar(
        {
          id: 'c1',
          telefone: TELEFONE,
          cooperadoId: 'coop-luciano',
          cooperativaId: 'coop-A',
          dadosTemp: { proxyNome: 'Joao' },
        },
        '12345678901234',
      );
      expect(conversaUpdate).not.toHaveBeenCalled();
    });
  });

  describe('Bloco 6 Etapa C - executarAcao(PROCESSAR_OCR_PROXY)', () => {
    const TELEFONE = '+5527981341348';
    const MIDIA_OK = { base64: 'BASE64FAKE', mimeType: 'image/jpeg' };

    const invocar = (conversa: any, midia?: any) =>
      (service as any).executarAcao('PROCESSAR_OCR_PROXY', conversa, conversa.dadosTemp ?? {}, '', midia);

    const modeloProxyConfirmar = {
      id: 'm-proxy-confirmar',
      nome: 'proxy_confirmar',
      categoria: 'BOT',
      conteudo: 'Confere:\n👤 {{titular}}\n📱 {{telefone}}\n\n1️⃣ Cadastrar\n2️⃣ Corrigir',
      cooperativaId: null,
    };

    it('Sem midia (param undefined): erro + NAO transiciona (pede foto de novo)', async () => {
      await invocar({
        id: 'c1',
        telefone: TELEFONE,
        cooperadoId: 'coop-luciano',
        cooperativaId: 'coop-A',
        dadosTemp: { proxyNome: 'Joao', proxyTelefone: '5527999991234' },
      });
      expect(enviarMensagem).toHaveBeenCalledWith(
        TELEFONE,
        expect.stringMatching(/foto|PDF/i),
      );
      expect(extrairOcrMock).not.toHaveBeenCalled();
      expect(conversaUpdate).not.toHaveBeenCalled();
    });

    it('OCR sucesso + consumoAtualKwh>0: persiste dados + renderiza modelo proxy_confirmar com vars + transiciona CONFIRMAR_PROXY', async () => {
      extrairOcrMock.mockResolvedValueOnce({
        consumoAtualKwh: 280,
        totalAPagar: 350,
        distribuidora: 'EDP-ES',
        numeroUC: '12345',
        mesReferencia: '01/2026',
      });
      modeloFindFirst.mockResolvedValueOnce(modeloProxyConfirmar);

      await invocar(
        {
          id: 'c1',
          telefone: TELEFONE,
          cooperadoId: 'coop-luciano',
          cooperativaId: 'coop-A',
          dadosTemp: { proxyNome: 'Joao Silva', proxyTelefone: '5527999991234' },
        },
        MIDIA_OK,
      );

      expect(extrairOcrMock).toHaveBeenCalledWith('BASE64FAKE', 'imagem');
      // Renderizou modelo com vars {{titular}}/{{telefone}}
      expect(enviarMensagem).toHaveBeenCalledWith(
        TELEFONE,
        expect.stringContaining('Joao Silva'),
      );
      const callsTexto = enviarMensagem.mock.calls.map((c: any[]) => c[1]).join('\n');
      expect(callsTexto).toContain('5527999991234');
      expect(conversaUpdate).toHaveBeenCalledWith({
        where: { id: 'c1' },
        data: expect.objectContaining({ estado: 'CONFIRMAR_PROXY' }),
      });
    });

    it('OCR retorna consumoAtualKwh=0: erro "nao parece fatura" + NAO transiciona', async () => {
      extrairOcrMock.mockResolvedValueOnce({
        consumoAtualKwh: 0,
        totalAPagar: 0,
      });

      await invocar(
        {
          id: 'c1',
          telefone: TELEFONE,
          cooperadoId: 'coop-luciano',
          cooperativaId: 'coop-A',
          dadosTemp: { proxyNome: 'Joao', proxyTelefone: '5527999991234' },
        },
        MIDIA_OK,
      );

      expect(enviarMensagem).toHaveBeenCalledWith(
        TELEFONE,
        expect.stringMatching(/fatura|energia/i),
      );
      expect(conversaUpdate).not.toHaveBeenCalled();
    });

    it('OCR throw: erro generico + NAO transiciona (retry)', async () => {
      extrairOcrMock.mockRejectedValueOnce(new Error('Claude AI timeout'));

      await invocar(
        {
          id: 'c1',
          telefone: TELEFONE,
          cooperadoId: 'coop-luciano',
          cooperativaId: 'coop-A',
          dadosTemp: { proxyNome: 'Joao', proxyTelefone: '5527999991234' },
        },
        MIDIA_OK,
      );

      expect(enviarMensagem).toHaveBeenCalled();
      expect(conversaUpdate).not.toHaveBeenCalled();
    });

    it('Mimetype invalido (video): erro + NAO chama OCR', async () => {
      await invocar(
        {
          id: 'c1',
          telefone: TELEFONE,
          cooperadoId: 'coop-luciano',
          cooperativaId: 'coop-A',
          dadosTemp: { proxyNome: 'Joao', proxyTelefone: '5527999991234' },
        },
        { base64: 'VIDEO', mimeType: 'video/mp4' },
      );

      expect(extrairOcrMock).not.toHaveBeenCalled();
      expect(conversaUpdate).not.toHaveBeenCalled();
    });
  });

  describe('Bloco 6 Etapa C - executarAcao(CRIAR_COOPERADO_PROXY)', () => {
    const TELEFONE = '+5527981341348';

    const invocar = (conversa: any) =>
      (service as any).executarAcao('CRIAR_COOPERADO_PROXY', conversa, conversa.dadosTemp ?? {}, '1');

    const dadosTempBase = {
      proxyNome: 'Joao Silva',
      proxyTelefone: '5527999991234',
      indicadorId: 'coop-luciano',
      indicadorNome: 'Luciano Teste',
      cooperativaId: 'coop-A',
    };

    beforeEach(() => {
      // Garante JWT_SECRET pra testes (jsonwebtoken precisa)
      process.env.JWT_SECRET = 'test-secret';
    });

    it('Caminho feliz: cria Cooperado + Indicacao + JWT + envia WA amigo + notifica indicador + transiciona MENU_COOPERADO', async () => {
      cooperadoCreate.mockResolvedValueOnce({
        id: 'novo-proxy-1',
        nomeCompleto: 'Joao Silva',
      });
      cooperadoUpdate.mockResolvedValueOnce({ id: 'novo-proxy-1' });
      indicacaoCreate.mockResolvedValueOnce({ id: 'ind-1' });

      await invocar({
        id: 'c1',
        telefone: TELEFONE,
        cooperadoId: 'coop-luciano',
        cooperativaId: 'coop-A',
        dadosTemp: dadosTempBase,
      });

      // Cooperado novo PENDENTE_ASSINATURA + cooperadoIndicadorId + cooperativaId
      expect(cooperadoCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          nomeCompleto: 'Joao Silva',
          telefone: '5527999991234',
          status: 'PENDENTE_ASSINATURA',
          cooperadoIndicadorId: 'coop-luciano',
          cooperativaId: 'coop-A',
        }),
      });

      // Indicacao formal criada com status PENDENTE
      expect(indicacaoCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          cooperativaId: 'coop-A',
          cooperadoIndicadorId: 'coop-luciano',
          cooperadoIndicadoId: 'novo-proxy-1',
          status: 'PENDENTE',
        }),
      });

      // JWT update no Cooperado novo
      expect(cooperadoUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'novo-proxy-1' },
          data: expect.objectContaining({
            tokenAssinatura: expect.any(String),
          }),
        }),
      );

      // WA pro amigo (proxyTelefone) + notificacao pro indicador (TELEFONE)
      const destinos = enviarMensagem.mock.calls.map((c: any[]) => c[0]);
      expect(destinos).toContain('5527999991234'); // proxy
      expect(destinos).toContain(TELEFONE); // indicador

      // Transicao
      expect(conversaUpdate).toHaveBeenCalledWith({
        where: { id: 'c1' },
        data: { estado: 'MENU_COOPERADO' },
      });
    });

    it('Sem dadosTemp.indicadorId: erro generico + NAO cria nada', async () => {
      await invocar({
        id: 'c1',
        telefone: TELEFONE,
        cooperadoId: 'coop-luciano',
        cooperativaId: 'coop-A',
        dadosTemp: { proxyNome: 'Joao', proxyTelefone: '5527999991234' }, // sem indicadorId
      });
      expect(cooperadoCreate).not.toHaveBeenCalled();
      expect(indicacaoCreate).not.toHaveBeenCalled();
      expect(enviarMensagem).toHaveBeenCalledWith(
        TELEFONE,
        expect.stringMatching(/erro|tente/i),
      );
    });

    it('Sem dadosTemp.proxyNome ou proxyTelefone: erro generico', async () => {
      await invocar({
        id: 'c1',
        telefone: TELEFONE,
        cooperadoId: 'coop-luciano',
        cooperativaId: 'coop-A',
        dadosTemp: { indicadorId: 'coop-luciano', cooperativaId: 'coop-A' },
      });
      expect(cooperadoCreate).not.toHaveBeenCalled();
    });

    it('Erro Prisma na criacao do Cooperado: mensagem generica + NAO transiciona', async () => {
      cooperadoCreate.mockRejectedValueOnce(new Error('Connection lost'));
      await invocar({
        id: 'c1',
        telefone: TELEFONE,
        cooperadoId: 'coop-luciano',
        cooperativaId: 'coop-A',
        dadosTemp: dadosTempBase,
      });
      expect(indicacaoCreate).not.toHaveBeenCalled();
      expect(conversaUpdate).not.toHaveBeenCalled();
    });

    it('Erro ao enviar WA pro amigo: log warn mas continua (notifica indicador + transiciona mesmo assim)', async () => {
      cooperadoCreate.mockResolvedValueOnce({ id: 'novo-proxy-1', nomeCompleto: 'Joao' });
      cooperadoUpdate.mockResolvedValueOnce({ id: 'novo-proxy-1' });
      indicacaoCreate.mockResolvedValueOnce({ id: 'ind-1' });
      // Primeira chamada (pro amigo) falha; segunda (indicador) OK
      enviarMensagem
        .mockRejectedValueOnce(new Error('Numero invalido'))
        .mockResolvedValueOnce(undefined);

      await invocar({
        id: 'c1',
        telefone: TELEFONE,
        cooperadoId: 'coop-luciano',
        cooperativaId: 'coop-A',
        dadosTemp: dadosTempBase,
      });

      // Cooperado e Indicacao criados, transicao acontece mesmo com erro de WA
      expect(cooperadoCreate).toHaveBeenCalled();
      expect(indicacaoCreate).toHaveBeenCalled();
      expect(conversaUpdate).toHaveBeenCalledWith({
        where: { id: 'c1' },
        data: { estado: 'MENU_COOPERADO' },
      });
    });
  });

  describe('Bloco 6 Etapa B - executarAcao() aceita 5o parametro media', () => {
    it('Acao desconhecida com media: cai no default sem crash (assinatura compativel)', async () => {
      const warnSpy = jest.spyOn(service['logger'], 'warn').mockImplementation();

      await (service as any).executarAcao(
        'ACAO_INEXISTENTE',
        { id: 'c1', telefone: '+5527981341348', cooperadoId: null, cooperativaId: null },
        {},
        '',
        { base64: 'X', mimeType: 'image/jpeg' },
      );

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Acao desconhecida'),
      );
      warnSpy.mockRestore();
    });

    it('Acao chamada SEM 5o param (compat): nao crasha', async () => {
      const warnSpy = jest.spyOn(service['logger'], 'warn').mockImplementation();

      // Chamada estilo antigo (4 params) deve continuar funcionando
      await (service as any).executarAcao(
        'ACAO_INEXISTENTE',
        { id: 'c1', telefone: '+5527981341348', cooperadoId: null, cooperativaId: null },
        {},
        'algum corpo',
      );

      expect(warnSpy).toHaveBeenCalled();
      warnSpy.mockRestore();
    });
  });

  describe('Bloco 7 Etapa B - executarAcao(REGISTRAR_NPS)', () => {
    const TELEFONE = '+5527981341348';

    const invocar = (conversa: any, corpo: string) =>
      (service as any).executarAcao('REGISTRAR_NPS', conversa, {}, corpo);

    const modeloNpsRecebido = {
      id: 'm-nps',
      nome: 'nps_recebido',
      categoria: 'BOT',
      conteudo:
        'Muito obrigado pela sua avaliação! 🙏\nSua opinião ajuda a {{parceiro}} a melhorar.',
      cooperativaId: null,
    };

    const cooperativaCtx = {
      nome: 'CoopereBR',
      email: null,
      telefone: null,
      cidade: null,
      estado: null,
      tipoParceiro: 'COOPERATIVA',
    };

    it('SEM cooperadoId: envia mensagem amigavel e NAO persiste NPS', async () => {
      await invocar(
        { id: 'c1', telefone: TELEFONE, cooperadoId: null, cooperativaId: null },
        '8',
      );
      expect(enviarMensagem).toHaveBeenCalledWith(
        TELEFONE,
        expect.stringContaining('cooperado'),
      );
      expect(npsRespostaCreate).not.toHaveBeenCalled();
      expect(conversaUpdate).not.toHaveBeenCalled();
    });

    it('Nota INVALIDA (texto): erro + NAO transiciona (retry no fluxo)', async () => {
      await invocar(
        { id: 'c1', telefone: TELEFONE, cooperadoId: 'coop-luciano', cooperativaId: 'coop-A' },
        'oito',
      );
      expect(enviarMensagem).toHaveBeenCalledWith(
        TELEFONE,
        expect.stringMatching(/0.*10/),
      );
      expect(npsRespostaCreate).not.toHaveBeenCalled();
      expect(conversaUpdate).not.toHaveBeenCalled();
    });

    it('Nota INVALIDA (negativa): erro + NAO transiciona', async () => {
      await invocar(
        { id: 'c1', telefone: TELEFONE, cooperadoId: 'coop-luciano', cooperativaId: 'coop-A' },
        '-1',
      );
      expect(enviarMensagem).toHaveBeenCalledWith(
        TELEFONE,
        expect.stringMatching(/0.*10/),
      );
      expect(npsRespostaCreate).not.toHaveBeenCalled();
    });

    it('Nota INVALIDA (acima de 10): erro + NAO transiciona', async () => {
      await invocar(
        { id: 'c1', telefone: TELEFONE, cooperadoId: 'coop-luciano', cooperativaId: 'coop-A' },
        '11',
      );
      expect(enviarMensagem).toHaveBeenCalledWith(
        TELEFONE,
        expect.stringMatching(/0.*10/),
      );
      expect(npsRespostaCreate).not.toHaveBeenCalled();
    });

    it('Nota 0 (limite inferior): persiste + envia modelo + transiciona MENU_COOPERADO', async () => {
      modeloFindFirst.mockResolvedValueOnce(modeloNpsRecebido);
      cooperativaFindUnique.mockResolvedValueOnce(cooperativaCtx);
      npsRespostaCreate.mockResolvedValueOnce({ id: 'nps-1', nota: 0 });

      await invocar(
        { id: 'c1', telefone: TELEFONE, cooperadoId: 'coop-luciano', cooperativaId: 'coop-A' },
        '0',
      );

      expect(npsRespostaCreate).toHaveBeenCalledWith({
        data: {
          cooperadoId: 'coop-luciano',
          cooperativaId: 'coop-A',
          telefone: TELEFONE,
          nota: 0,
          comentario: null,
          canal: 'WHATSAPP',
        },
      });
      expect(conversaUpdate).toHaveBeenCalledWith({
        where: { id: 'c1' },
        data: { estado: 'MENU_COOPERADO' },
      });
    });

    it('Nota 10 (limite superior): persiste + transiciona', async () => {
      modeloFindFirst.mockResolvedValueOnce(modeloNpsRecebido);
      cooperativaFindUnique.mockResolvedValueOnce(cooperativaCtx);
      npsRespostaCreate.mockResolvedValueOnce({ id: 'nps-2', nota: 10 });

      await invocar(
        { id: 'c1', telefone: TELEFONE, cooperadoId: 'coop-luciano', cooperativaId: 'coop-A' },
        '10',
      );

      const dadosCriados = npsRespostaCreate.mock.calls[0][0].data;
      expect(dadosCriados.nota).toBe(10);
      expect(conversaUpdate).toHaveBeenCalledWith({
        where: { id: 'c1' },
        data: { estado: 'MENU_COOPERADO' },
      });
    });

    it('Nota intermediaria (8) com trim + multi-tenant: persiste + renderiza modelo com vars', async () => {
      modeloFindFirst.mockResolvedValueOnce(modeloNpsRecebido);
      cooperativaFindUnique.mockResolvedValueOnce(cooperativaCtx);
      npsRespostaCreate.mockResolvedValueOnce({ id: 'nps-3', nota: 8 });

      await invocar(
        { id: 'c1', telefone: TELEFONE, cooperadoId: 'coop-luciano', cooperativaId: 'coop-A' },
        '  8  ',
      );

      expect(npsRespostaCreate).toHaveBeenCalled();
      // Modelo renderizado e enviado
      expect(enviarMensagem).toHaveBeenCalledWith(
        TELEFONE,
        expect.stringContaining('CoopereBR'),
      );
      expect(incrementarUso).toHaveBeenCalledWith('m-nps');
    });

    it('Sem cooperativaId (lead conhecido como cooperado mas sem tenant): persiste cooperativaId null', async () => {
      modeloFindFirst.mockResolvedValueOnce(modeloNpsRecebido);
      cooperativaFindUnique.mockResolvedValueOnce(null);
      npsRespostaCreate.mockResolvedValueOnce({ id: 'nps-4', nota: 7 });

      await invocar(
        { id: 'c1', telefone: TELEFONE, cooperadoId: 'coop-luciano', cooperativaId: null },
        '7',
      );

      const dadosCriados = npsRespostaCreate.mock.calls[0][0].data;
      expect(dadosCriados.cooperativaId).toBeNull();
      expect(dadosCriados.cooperadoId).toBe('coop-luciano');
    });

    it('Modelo nps_recebido NAO encontrado: fallback hardcoded curto + transiciona mesmo assim', async () => {
      modeloFindFirst.mockResolvedValueOnce(null);
      cooperativaFindUnique.mockResolvedValueOnce(cooperativaCtx);
      npsRespostaCreate.mockResolvedValueOnce({ id: 'nps-5', nota: 9 });

      await invocar(
        { id: 'c1', telefone: TELEFONE, cooperadoId: 'coop-luciano', cooperativaId: 'coop-A' },
        '9',
      );

      // Persiste mesmo sem modelo (registro do NPS eh prioritario)
      expect(npsRespostaCreate).toHaveBeenCalled();
      // Mensagem foi enviada (fallback hardcoded)
      expect(enviarMensagem).toHaveBeenCalled();
      // Transiciona mesmo assim
      expect(conversaUpdate).toHaveBeenCalledWith({
        where: { id: 'c1' },
        data: { estado: 'MENU_COOPERADO' },
      });
    });

    it('Erro Prisma (banco off): envia mensagem generica e NAO transiciona (retry)', async () => {
      npsRespostaCreate.mockRejectedValueOnce(new Error('Connection refused'));

      await invocar(
        { id: 'c1', telefone: TELEFONE, cooperadoId: 'coop-luciano', cooperativaId: 'coop-A' },
        '8',
      );

      expect(enviarMensagem).toHaveBeenCalledWith(
        TELEFONE,
        expect.stringMatching(/registrar|tente/i),
      );
      expect(conversaUpdate).not.toHaveBeenCalled();
    });
  });

  describe('Etapa A Bloco 1.b - executarComandoUniversalSimulado(CHAMAR_DEPOIS)', () => {
    afterEach(() => {
      jest.useRealTimers();
    });

    it('Retorna estadoFinal AGENDADO_RETORNO + comandoUniversalAplicado + avisoTransicao', async () => {
      jest.useFakeTimers().setSystemTime(new Date(2026, 4, 22, 14, 0, 0));
      etapaFindFirst.mockResolvedValueOnce({
        id: 'menu',
        cooperativaId: 'coop-A',
        nome: 'Menu',
        ordem: 1,
        estado: 'MENU_COOPERADO',
        gatilhos: [],
        modeloMensagemId: null,
        acaoAutomatica: null,
        ativo: true,
      });

      const r = await service.simular({
        estadoInicial: 'MENU_COOPERADO',
        cooperativaId: 'coop-A',
        mensagem: 'me chame depois',
      });

      expect(r.estadoFinal).toBe('AGENDADO_RETORNO');
      expect(r.comandoUniversalAplicado).toBe('CHAMAR_DEPOIS');
      expect(r.transicionou).toBe(true);
      expect(r.avisoTransicao).toMatch(/24h|amanh/i);
    });

    it('ZERO SIDE EFFECT — nao persiste conversaUpdate nem chama enviarMensagem', async () => {
      jest.useFakeTimers().setSystemTime(new Date(2026, 4, 22, 14, 0, 0));
      etapaFindFirst.mockResolvedValueOnce({
        id: 'menu',
        cooperativaId: 'coop-A',
        nome: 'Menu',
        ordem: 1,
        estado: 'MENU_COOPERADO',
        gatilhos: [],
        modeloMensagemId: null,
        acaoAutomatica: null,
        ativo: true,
      });

      await service.simular({
        estadoInicial: 'MENU_COOPERADO',
        cooperativaId: 'coop-A',
        mensagem: 'ME CHAME DEPOIS',
      });

      expect(conversaUpdate).not.toHaveBeenCalled();
      expect(enviarMensagem).not.toHaveBeenCalled();
    });
  });

  // ============================================================
  // Bloco 5 Etapa B1 (24/05) — Acoes do fluxo Atualizar Contrato (KWH).
  //
  // Decisao Luciano modelo (B): bot NUNCA altera contrato direto; cria
  // SolicitacaoAlteracaoContrato PENDENTE; equipe aprova pela tela admin.
  //
  // Acoes desta parte (3 das 7 totais do Bloco 5):
  //  - INICIAR_SOLICITACAO_AUMENTAR_KWH: gatilho '1' do ATUALIZACAO_CONTRATO.
  //  - INICIAR_SOLICITACAO_DIMINUIR_KWH: gatilho '2'. Analogo, mensagem diz "menor que X".
  //  - SALVAR_SOLICITACAO_KWH: wildcard em AGUARDANDO_NOVO_KWH. Valida +
  //    pre-valida capacidade da usina (decisao 4) + cria solicitacao +
  //    notifica equipe + envia WA `criada` ao cooperado + transiciona MENU.
  // ============================================================
  describe('Bloco 5 Etapa B1 - executarAcao(INICIAR_SOLICITACAO_AUMENTAR_KWH)', () => {
    const TELEFONE = '+5527981341348';
    const invocar = (conversa: any) =>
      (service as any).executarAcao('INICIAR_SOLICITACAO_AUMENTAR_KWH', conversa, conversa.dadosTemp ?? {}, '');

    it('SEM cooperadoId: erro amigavel + NAO transiciona', async () => {
      await invocar({
        id: 'c1',
        telefone: TELEFONE,
        cooperadoId: null,
        cooperativaId: null,
      });
      expect(enviarMensagem).toHaveBeenCalled();
      expect(contratoFindFirst).not.toHaveBeenCalled();
      expect(conversaUpdate).not.toHaveBeenCalled();
    });

    it('Sem contrato ATIVO: erro + volta pra MENU_COOPERADO', async () => {
      contratoFindFirst.mockResolvedValueOnce(null);
      await invocar({
        id: 'c1',
        telefone: TELEFONE,
        cooperadoId: 'coop-luciano',
        cooperativaId: 'coop-A',
      });
      expect(enviarMensagem).toHaveBeenCalledWith(
        TELEFONE,
        expect.stringMatching(/contrato/i),
      );
      expect(conversaUpdate).toHaveBeenCalledWith({
        where: { id: 'c1' },
        data: { estado: 'MENU_COOPERADO' },
      });
    });

    it('Contrato ATIVO: persiste dadosTemp + transiciona AGUARDANDO_NOVO_KWH', async () => {
      contratoFindFirst.mockResolvedValueOnce({
        id: 'contrato-1',
        kwhContratoMensal: 200,
        usinaId: 'usina-1',
      });
      await invocar({
        id: 'c1',
        telefone: TELEFONE,
        cooperadoId: 'coop-luciano',
        cooperativaId: 'coop-A',
      });
      expect(conversaUpdate).toHaveBeenCalledWith({
        where: { id: 'c1' },
        data: {
          estado: 'AGUARDANDO_NOVO_KWH',
          dadosTemp: expect.objectContaining({
            contratoId: 'contrato-1',
            tipoAlteracao: 'AUMENTAR_KWH',
            kwhAtual: 200,
            usinaId: 'usina-1',
          }),
        },
      });
      expect(enviarMensagem).toHaveBeenCalledWith(
        TELEFONE,
        expect.stringContaining('200'),
      );
      expect(enviarMensagem).toHaveBeenCalledWith(
        TELEFONE,
        expect.stringMatching(/maior/i),
      );
    });

    it('Multi-tenant: contratoFindFirst filtra por cooperadoId + cooperativaId + status ATIVO', async () => {
      contratoFindFirst.mockResolvedValueOnce(null);
      await invocar({
        id: 'c1',
        telefone: TELEFONE,
        cooperadoId: 'coop-luciano',
        cooperativaId: 'coop-A',
      });
      const where = contratoFindFirst.mock.calls[0][0].where;
      expect(where.cooperadoId).toBe('coop-luciano');
      expect(where.cooperativaId).toBe('coop-A');
      expect(where.status).toBe('ATIVO');
    });
  });

  describe('Bloco 5 Etapa B1 - executarAcao(INICIAR_SOLICITACAO_DIMINUIR_KWH)', () => {
    const TELEFONE = '+5527981341348';
    const invocar = (conversa: any) =>
      (service as any).executarAcao('INICIAR_SOLICITACAO_DIMINUIR_KWH', conversa, conversa.dadosTemp ?? {}, '');

    it('Contrato ATIVO: persiste tipoAlteracao=DIMINUIR_KWH + mensagem diz "menor que"', async () => {
      contratoFindFirst.mockResolvedValueOnce({
        id: 'contrato-1',
        kwhContratoMensal: 300,
        usinaId: 'usina-1',
      });
      await invocar({
        id: 'c1',
        telefone: TELEFONE,
        cooperadoId: 'coop-luciano',
        cooperativaId: 'coop-A',
      });
      const data = conversaUpdate.mock.calls[0][0].data;
      expect(data.estado).toBe('AGUARDANDO_NOVO_KWH');
      expect(data.dadosTemp.tipoAlteracao).toBe('DIMINUIR_KWH');
      expect(enviarMensagem).toHaveBeenCalledWith(
        TELEFONE,
        expect.stringMatching(/menor/i),
      );
    });
  });

  describe('Bloco 5 Etapa B1 - executarAcao(SALVAR_SOLICITACAO_KWH)', () => {
    const TELEFONE = '+5527981341348';
    const invocar = (conversa: any, corpo: string) =>
      (service as any).executarAcao('SALVAR_SOLICITACAO_KWH', conversa, conversa.dadosTemp ?? {}, corpo);

    const dadosTempBase = {
      contratoId: 'contrato-1',
      tipoAlteracao: 'AUMENTAR_KWH',
      kwhAtual: 200,
      usinaId: 'usina-1',
    };

    it('Valor invalido (texto): erro + NAO transiciona (retry)', async () => {
      await invocar(
        {
          id: 'c1',
          telefone: TELEFONE,
          cooperadoId: 'coop-luciano',
          cooperativaId: 'coop-A',
          dadosTemp: dadosTempBase,
        },
        'abc',
      );
      expect(enviarMensagem).toHaveBeenCalled();
      expect(solicitacaoContratoCreate).not.toHaveBeenCalled();
      expect(conversaUpdate).not.toHaveBeenCalled();
    });

    it('AUMENTAR com valor MENOR que kwhAtual: erro "deve ser maior"', async () => {
      await invocar(
        {
          id: 'c1',
          telefone: TELEFONE,
          cooperadoId: 'coop-luciano',
          cooperativaId: 'coop-A',
          dadosTemp: { ...dadosTempBase, tipoAlteracao: 'AUMENTAR_KWH', kwhAtual: 200 },
        },
        '150',
      );
      expect(enviarMensagem).toHaveBeenCalledWith(
        TELEFONE,
        expect.stringMatching(/maior/i),
      );
      expect(solicitacaoContratoCreate).not.toHaveBeenCalled();
    });

    it('DIMINUIR com valor MAIOR que kwhAtual: erro "deve ser menor"', async () => {
      await invocar(
        {
          id: 'c1',
          telefone: TELEFONE,
          cooperadoId: 'coop-luciano',
          cooperativaId: 'coop-A',
          dadosTemp: { ...dadosTempBase, tipoAlteracao: 'DIMINUIR_KWH', kwhAtual: 200 },
        },
        '250',
      );
      expect(enviarMensagem).toHaveBeenCalledWith(
        TELEFONE,
        expect.stringMatching(/menor/i),
      );
      expect(solicitacaoContratoCreate).not.toHaveBeenCalled();
    });

    it('AUMENTAR ACIMA da capacidade da usina: recusa amigavel + NAO cria solicitacao', async () => {
      // Pre-validacao decisao 4: bot recusa antes de criar.
      // Usina capacidade 10000; ja somam 9800 ativos (outros cooperados);
      // cooperado pede 500 (era 200) -> total seria 10000+(500-200)=10100 > 10000.
      usinaFindUnique.mockResolvedValueOnce({
        id: 'usina-1',
        capacidadeKwh: 10000,
      });
      contratoAggregateUsina.mockResolvedValueOnce({
        _sum: { kwhContratoMensal: 10000 }, // soma TODOS contratos ativos da usina (inclui o do cooperado)
      });

      await invocar(
        {
          id: 'c1',
          telefone: TELEFONE,
          cooperadoId: 'coop-luciano',
          cooperativaId: 'coop-A',
          dadosTemp: { ...dadosTempBase, tipoAlteracao: 'AUMENTAR_KWH', kwhAtual: 200 },
        },
        '500',
      );

      expect(enviarMensagem).toHaveBeenCalledWith(
        TELEFONE,
        expect.stringMatching(/capacidade|disponive|excede/i),
      );
      expect(solicitacaoContratoCreate).not.toHaveBeenCalled();
      expect(notificacaoCriarMock).not.toHaveBeenCalled();
    });

    it('SUCESSO AUMENTAR: cria solicitacao PENDENTE + notifica equipe + WA criada + transiciona MENU', async () => {
      usinaFindUnique.mockResolvedValueOnce({
        id: 'usina-1',
        capacidadeKwh: 10000,
      });
      contratoAggregateUsina.mockResolvedValueOnce({
        _sum: { kwhContratoMensal: 5000 },
      });
      solicitacaoContratoCreate.mockResolvedValueOnce({ id: 'sol-1' });
      modeloFindFirst.mockResolvedValueOnce({
        id: 'm-criada',
        nome: 'solicitacao_contrato_criada',
        categoria: 'BOT',
        conteudo: 'Recebemos sua solicitação de {{tipo}}.',
        cooperativaId: null,
      });
      notificacaoCriarMock.mockResolvedValueOnce({ id: 'notif-1' });

      await invocar(
        {
          id: 'c1',
          telefone: TELEFONE,
          cooperadoId: 'coop-luciano',
          cooperativaId: 'coop-A',
          dadosTemp: { ...dadosTempBase, tipoAlteracao: 'AUMENTAR_KWH', kwhAtual: 200 },
        },
        '350',
      );

      expect(solicitacaoContratoCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          cooperadoId: 'coop-luciano',
          cooperativaId: 'coop-A',
          contratoId: 'contrato-1',
          tipoAlteracao: 'AUMENTAR_KWH',
          valorPropostoKwh: 350,
          status: 'PENDENTE',
        }),
      });
      expect(notificacaoCriarMock).toHaveBeenCalledWith(
        expect.objectContaining({
          tipo: 'SOLICITACAO_ALTERACAO_CONTRATO',
          cooperativaId: 'coop-A',
        }),
      );
      expect(enviarMensagem).toHaveBeenCalledWith(
        TELEFONE,
        expect.stringContaining('Recebemos'),
      );
      expect(conversaUpdate).toHaveBeenCalledWith({
        where: { id: 'c1' },
        data: { estado: 'MENU_COOPERADO' },
      });
    });

    it('SUCESSO DIMINUIR: cria solicitacao sem pre-validar capacidade (nao se aplica)', async () => {
      solicitacaoContratoCreate.mockResolvedValueOnce({ id: 'sol-2' });
      modeloFindFirst.mockResolvedValueOnce(null); // fallback hardcoded
      notificacaoCriarMock.mockResolvedValueOnce({ id: 'notif-2' });

      await invocar(
        {
          id: 'c1',
          telefone: TELEFONE,
          cooperadoId: 'coop-luciano',
          cooperativaId: 'coop-A',
          dadosTemp: { ...dadosTempBase, tipoAlteracao: 'DIMINUIR_KWH', kwhAtual: 200 },
        },
        '100',
      );

      expect(usinaFindUnique).not.toHaveBeenCalled();
      expect(contratoAggregateUsina).not.toHaveBeenCalled();
      expect(solicitacaoContratoCreate).toHaveBeenCalled();
      expect(conversaUpdate).toHaveBeenCalledWith({
        where: { id: 'c1' },
        data: { estado: 'MENU_COOPERADO' },
      });
    });

    it('Erro Prisma na criacao da solicitacao: mensagem generica + NAO transiciona', async () => {
      usinaFindUnique.mockResolvedValueOnce({ capacidadeKwh: 10000 });
      contratoAggregateUsina.mockResolvedValueOnce({ _sum: { kwhContratoMensal: 1000 } });
      solicitacaoContratoCreate.mockRejectedValueOnce(new Error('Connection lost'));

      await invocar(
        {
          id: 'c1',
          telefone: TELEFONE,
          cooperadoId: 'coop-luciano',
          cooperativaId: 'coop-A',
          dadosTemp: { ...dadosTempBase, tipoAlteracao: 'AUMENTAR_KWH', kwhAtual: 200 },
        },
        '300',
      );
      expect(notificacaoCriarMock).not.toHaveBeenCalled();
      expect(conversaUpdate).not.toHaveBeenCalled();
    });
  });

  // ============================================================
  // Bloco 5 Etapa B2 (24/05) — Acoes SUSPENDER + ENCERRAR.
  //
  // Continuacao da Etapa B1 (KWH). 4 acoes restantes:
  //  - INICIAR_SOLICITACAO_SUSPENDER: gatilho '3'. Pre-valida cobrança em
  //    aberto (decisao 4); persiste dadosTemp; transiciona pra
  //    AGUARDANDO_MOTIVO_SUSPENSAO; motor renderiza modelo da etapa.
  //  - SALVAR_SOLICITACAO_SUSPENDER: wildcard em AGUARDANDO_MOTIVO_SUSPENSAO.
  //    Cria solicitacao + notifica + WA cooperado + transiciona MENU.
  //  - INICIAR_SOLICITACAO_ENCERRAR: gatilho '4'. Pre-valida cobrança;
  //    transiciona pra CONFIRMAR_ENCERRAMENTO ("tem certeza?").
  //  - SALVAR_SOLICITACAO_ENCERRAR: wildcard em AGUARDANDO_MOTIVO_ENCERRAMENTO.
  //    Motivo opcional (decisao 5 B — "PULAR" -> null). Cria solicitacao.
  // ============================================================
  describe('Bloco 5 Etapa B2 - executarAcao(INICIAR_SOLICITACAO_SUSPENDER)', () => {
    const TELEFONE = '+5527981341348';
    const invocar = (conversa: any) =>
      (service as any).executarAcao('INICIAR_SOLICITACAO_SUSPENDER', conversa, conversa.dadosTemp ?? {}, '');

    it('Sem contrato ATIVO: erro + volta MENU', async () => {
      contratoFindFirst.mockResolvedValueOnce(null);
      await invocar({
        id: 'c1',
        telefone: TELEFONE,
        cooperadoId: 'coop-luciano',
        cooperativaId: 'coop-A',
      });
      expect(conversaUpdate).toHaveBeenCalledWith({
        where: { id: 'c1' },
        data: { estado: 'MENU_COOPERADO' },
      });
    });

    it('Cobranca em aberto bloqueia: recusa + NAO transiciona pra fluxo de motivo', async () => {
      contratoFindFirst.mockResolvedValueOnce({ id: 'contrato-1', kwhContratoMensal: 200 });
      cobrancaCount.mockResolvedValueOnce(2); // 2 cobranças em aberto

      await invocar({
        id: 'c1',
        telefone: TELEFONE,
        cooperadoId: 'coop-luciano',
        cooperativaId: 'coop-A',
      });
      expect(enviarMensagem).toHaveBeenCalledWith(
        TELEFONE,
        expect.stringMatching(/aberto|quitar|fatura/i),
      );
      // NAO transiciona pra AGUARDANDO_MOTIVO_SUSPENSAO
      expect(conversaUpdate).not.toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ estado: 'AGUARDANDO_MOTIVO_SUSPENSAO' }),
        }),
      );
    });

    it('Sem cobrança aberta: persiste dadosTemp + transiciona AGUARDANDO_MOTIVO_SUSPENSAO', async () => {
      contratoFindFirst.mockResolvedValueOnce({ id: 'contrato-1', kwhContratoMensal: 200 });
      cobrancaCount.mockResolvedValueOnce(0);

      await invocar({
        id: 'c1',
        telefone: TELEFONE,
        cooperadoId: 'coop-luciano',
        cooperativaId: 'coop-A',
      });
      expect(conversaUpdate).toHaveBeenCalledWith({
        where: { id: 'c1' },
        data: {
          estado: 'AGUARDANDO_MOTIVO_SUSPENSAO',
          dadosTemp: expect.objectContaining({
            contratoId: 'contrato-1',
            tipoAlteracao: 'SUSPENDER',
          }),
        },
      });
      // Pede motivo
      expect(enviarMensagem).toHaveBeenCalledWith(
        TELEFONE,
        expect.stringMatching(/motivo/i),
      );
    });
  });

  describe('Bloco 5 Etapa B2 - executarAcao(SALVAR_SOLICITACAO_SUSPENDER)', () => {
    const TELEFONE = '+5527981341348';
    const invocar = (conversa: any, corpo: string) =>
      (service as any).executarAcao('SALVAR_SOLICITACAO_SUSPENDER', conversa, conversa.dadosTemp ?? {}, corpo);

    const dadosTempBase = {
      contratoId: 'contrato-1',
      tipoAlteracao: 'SUSPENDER',
    };

    it('Sucesso: cria solicitacao SUSPENDER com motivo + notifica + WA + transiciona MENU', async () => {
      solicitacaoContratoCreate.mockResolvedValueOnce({ id: 'sol-sus-1' });
      modeloFindFirst.mockResolvedValueOnce({
        id: 'm-criada',
        nome: 'solicitacao_contrato_criada',
        conteudo: 'Recebemos sua solicitação de {{tipo}}.',
        cooperativaId: null,
      });
      notificacaoCriarMock.mockResolvedValueOnce({ id: 'notif-sus-1' });

      await invocar(
        {
          id: 'c1',
          telefone: TELEFONE,
          cooperadoId: 'coop-luciano',
          cooperativaId: 'coop-A',
          dadosTemp: dadosTempBase,
        },
        'Viagem prolongada de 3 meses',
      );

      expect(solicitacaoContratoCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          cooperadoId: 'coop-luciano',
          cooperativaId: 'coop-A',
          contratoId: 'contrato-1',
          tipoAlteracao: 'SUSPENDER',
          motivo: 'Viagem prolongada de 3 meses',
          status: 'PENDENTE',
        }),
      });
      expect(notificacaoCriarMock).toHaveBeenCalledWith(
        expect.objectContaining({
          tipo: 'SOLICITACAO_ALTERACAO_CONTRATO',
          cooperativaId: 'coop-A',
        }),
      );
      expect(conversaUpdate).toHaveBeenCalledWith({
        where: { id: 'c1' },
        data: { estado: 'MENU_COOPERADO' },
      });
    });

    it('Motivo vazio (so espaços): aceita como motivo null', async () => {
      solicitacaoContratoCreate.mockResolvedValueOnce({ id: 'sol-sus-2' });
      modeloFindFirst.mockResolvedValueOnce(null);
      notificacaoCriarMock.mockResolvedValueOnce({});

      await invocar(
        {
          id: 'c1',
          telefone: TELEFONE,
          cooperadoId: 'coop-luciano',
          cooperativaId: 'coop-A',
          dadosTemp: dadosTempBase,
        },
        '   ',
      );

      const data = solicitacaoContratoCreate.mock.calls[0][0].data;
      expect(data.motivo).toBeNull();
    });
  });

  describe('Bloco 5 Etapa B2 - executarAcao(INICIAR_SOLICITACAO_ENCERRAR)', () => {
    const TELEFONE = '+5527981341348';
    const invocar = (conversa: any) =>
      (service as any).executarAcao('INICIAR_SOLICITACAO_ENCERRAR', conversa, conversa.dadosTemp ?? {}, '');

    it('Cobrança em aberto bloqueia: recusa + NAO transiciona', async () => {
      contratoFindFirst.mockResolvedValueOnce({ id: 'contrato-1' });
      cobrancaCount.mockResolvedValueOnce(1);

      await invocar({
        id: 'c1',
        telefone: TELEFONE,
        cooperadoId: 'coop-luciano',
        cooperativaId: 'coop-A',
      });
      expect(enviarMensagem).toHaveBeenCalledWith(
        TELEFONE,
        expect.stringMatching(/aberto|quitar|fatura/i),
      );
      expect(conversaUpdate).not.toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ estado: 'CONFIRMAR_ENCERRAMENTO' }),
        }),
      );
    });

    it('Sem cobrança aberta: persiste dadosTemp + transiciona CONFIRMAR_ENCERRAMENTO', async () => {
      contratoFindFirst.mockResolvedValueOnce({ id: 'contrato-1' });
      cobrancaCount.mockResolvedValueOnce(0);

      await invocar({
        id: 'c1',
        telefone: TELEFONE,
        cooperadoId: 'coop-luciano',
        cooperativaId: 'coop-A',
      });
      expect(conversaUpdate).toHaveBeenCalledWith({
        where: { id: 'c1' },
        data: {
          estado: 'CONFIRMAR_ENCERRAMENTO',
          dadosTemp: expect.objectContaining({
            contratoId: 'contrato-1',
            tipoAlteracao: 'ENCERRAR',
          }),
        },
      });
      expect(enviarMensagem).toHaveBeenCalledWith(
        TELEFONE,
        expect.stringMatching(/certeza|nao pode ser desfeit/i),
      );
    });
  });

  describe('Bloco 5 Etapa B2 - executarAcao(SALVAR_SOLICITACAO_ENCERRAR)', () => {
    const TELEFONE = '+5527981341348';
    const invocar = (conversa: any, corpo: string) =>
      (service as any).executarAcao('SALVAR_SOLICITACAO_ENCERRAR', conversa, conversa.dadosTemp ?? {}, corpo);

    const dadosTempBase = {
      contratoId: 'contrato-1',
      tipoAlteracao: 'ENCERRAR',
    };

    it('Motivo "PULAR": cria solicitacao com motivo null (decisao 5 B opcional)', async () => {
      solicitacaoContratoCreate.mockResolvedValueOnce({ id: 'sol-enc-1' });
      modeloFindFirst.mockResolvedValueOnce(null);
      notificacaoCriarMock.mockResolvedValueOnce({});

      await invocar(
        {
          id: 'c1',
          telefone: TELEFONE,
          cooperadoId: 'coop-luciano',
          cooperativaId: 'coop-A',
          dadosTemp: dadosTempBase,
        },
        'PULAR',
      );

      const data = solicitacaoContratoCreate.mock.calls[0][0].data;
      expect(data.tipoAlteracao).toBe('ENCERRAR');
      expect(data.motivo).toBeNull();
    });

    it('Motivo "pular" (lowercase): tambem aceita', async () => {
      solicitacaoContratoCreate.mockResolvedValueOnce({ id: 'sol-enc-2' });
      modeloFindFirst.mockResolvedValueOnce(null);

      await invocar(
        {
          id: 'c1',
          telefone: TELEFONE,
          cooperadoId: 'coop-luciano',
          cooperativaId: 'coop-A',
          dadosTemp: dadosTempBase,
        },
        'pular',
      );

      const data = solicitacaoContratoCreate.mock.calls[0][0].data;
      expect(data.motivo).toBeNull();
    });

    it('Motivo válido: persiste como dado', async () => {
      solicitacaoContratoCreate.mockResolvedValueOnce({ id: 'sol-enc-3' });
      modeloFindFirst.mockResolvedValueOnce(null);

      await invocar(
        {
          id: 'c1',
          telefone: TELEFONE,
          cooperadoId: 'coop-luciano',
          cooperativaId: 'coop-A',
          dadosTemp: dadosTempBase,
        },
        'Mudei pra outro estado',
      );

      const data = solicitacaoContratoCreate.mock.calls[0][0].data;
      expect(data.motivo).toBe('Mudei pra outro estado');
    });

    it('Notifica equipe + transiciona MENU mesmo sem modelo do banco (fallback hardcoded)', async () => {
      solicitacaoContratoCreate.mockResolvedValueOnce({ id: 'sol-enc-4' });
      modeloFindFirst.mockResolvedValueOnce(null);
      notificacaoCriarMock.mockResolvedValueOnce({});

      await invocar(
        {
          id: 'c1',
          telefone: TELEFONE,
          cooperadoId: 'coop-luciano',
          cooperativaId: 'coop-A',
          dadosTemp: dadosTempBase,
        },
        'PULAR',
      );

      expect(notificacaoCriarMock).toHaveBeenCalled();
      expect(enviarMensagem).toHaveBeenCalled();
      expect(conversaUpdate).toHaveBeenCalledWith({
        where: { id: 'c1' },
        data: { estado: 'MENU_COOPERADO' },
      });
    });
  });

  // ============================================================
  // Bloco 8 (24/05) — Menu Fatura (ultimo bloco do Sprint Bot Autoatendimento)
  //
  // 5 acoes do fluxo "Menu Fatura" no motor dinamico:
  //  - VER_FATURA_ATUAL: lê cobranca A_VENCER/VENCIDO + asaasCobrancas[0]
  //    cache local, monta resposta com valor + venc + PIX/boleto/portal.
  //  - VER_HISTORICO_PAGAMENTOS: ultimas N cobrancas (qualquer status),
  //    formata lista compacta data|valor|status.
  //  - SOLICITAR_CONFIRMACAO_PAGAMENTO: entry "ja paguei" — pergunta forma
  //    de pagamento, transiciona AGUARDANDO_FORMA_PAGAMENTO.
  //  - SALVAR_CONFIRMACAO_PAGAMENTO: cria SolicitacaoConfirmacaoPagamento
  //    PENDENTE + NotificacoesService.criar + WA + MENU_COOPERADO.
  //  - SOLICITAR_NEGOCIACAO_HUMANA: fallback negociar — "vou te conectar
  //    com a equipe" + Notificacoes + MENU_COOPERADO.
  // ============================================================

  describe('Bloco 8 - executarAcao(VER_FATURA_ATUAL)', () => {
    const TELEFONE = '+5527981341348';
    const invocar = (conversa: any) =>
      (service as any).executarAcao('VER_FATURA_ATUAL', conversa, conversa.dadosTemp ?? {}, '');

    it('Sem cooperadoId: orienta cadastro', async () => {
      await invocar({ id: 'c1', telefone: TELEFONE });
      expect(enviarMensagem).toHaveBeenCalledWith(
        TELEFONE,
        expect.stringMatching(/cooperado|cadastro/i),
      );
    });

    it('Sem fatura em aberto: avisa que esta em dia', async () => {
      cobrancaFindFirst.mockResolvedValueOnce(null);
      await invocar({
        id: 'c1',
        telefone: TELEFONE,
        cooperadoId: 'coop-luciano',
        cooperativaId: 'coop-A',
      });
      expect(enviarMensagem).toHaveBeenCalledWith(
        TELEFONE,
        expect.stringMatching(/em dia|nenhuma fatura|tudo certo/i),
      );
    });

    it('Com fatura: envia valor + vencimento + PIX + boleto', async () => {
      cobrancaFindFirst.mockResolvedValueOnce({
        id: 'cob-1',
        status: 'A_VENCER',
        valorLiquido: 200,
        valorBruto: 250,
        dataVencimento: new Date('2026-06-10'),
        mesReferencia: 5,
        anoReferencia: 2026,
      });
      asaasCobrancaFindFirst.mockResolvedValueOnce({
        pixCopiaECola: '00020101021226PIX',
        linkPagamento: 'https://asaas.com/pay/abc',
        boletoUrl: 'https://asaas.com/boleto/abc',
      });

      await invocar({
        id: 'c1',
        telefone: TELEFONE,
        cooperadoId: 'coop-luciano',
        cooperativaId: 'coop-A',
      });

      const where = cobrancaFindFirst.mock.calls[0][0].where;
      expect(where.contrato.cooperadoId).toBe('coop-luciano');
      expect(where.contrato.cooperativaId).toBe('coop-A');
      expect(enviarMensagem).toHaveBeenCalled();
      const ultima = (enviarMensagem.mock.calls.at(-1) as any[])[1] as string;
      expect(ultima).toMatch(/200|PIX|asaas\.com/i);
    });
  });

  describe('Bloco 8 - executarAcao(VER_HISTORICO_PAGAMENTOS)', () => {
    const TELEFONE = '+5527981341348';
    const invocar = (conversa: any) =>
      (service as any).executarAcao(
        'VER_HISTORICO_PAGAMENTOS',
        conversa,
        conversa.dadosTemp ?? {},
        '',
      );

    it('Sem cooperadoId: orienta cadastro', async () => {
      await invocar({ id: 'c1', telefone: TELEFONE });
      expect(enviarMensagem).toHaveBeenCalledWith(
        TELEFONE,
        expect.stringMatching(/cooperado|cadastro/i),
      );
    });

    it('Sem cobrancas: avisa que nao ha historico', async () => {
      cobrancaFindMany.mockResolvedValueOnce([]);
      await invocar({
        id: 'c1',
        telefone: TELEFONE,
        cooperadoId: 'coop-luciano',
        cooperativaId: 'coop-A',
      });
      expect(enviarMensagem).toHaveBeenCalledWith(
        TELEFONE,
        expect.stringMatching(/sem historico|nenhuma cobran|ainda nao tem/i),
      );
    });

    it('Lista formato compacto + multi-tenant', async () => {
      cobrancaFindMany.mockResolvedValueOnce([
        { id: 'c1', valorLiquido: 100, status: 'PAGO', dataVencimento: new Date('2026-01-10'), mesReferencia: 1, anoReferencia: 2026 },
        { id: 'c2', valorLiquido: 150, status: 'A_VENCER', dataVencimento: new Date('2026-06-10'), mesReferencia: 5, anoReferencia: 2026 },
      ]);
      await invocar({
        id: 'c1',
        telefone: TELEFONE,
        cooperadoId: 'coop-luciano',
        cooperativaId: 'coop-A',
      });
      const where = cobrancaFindMany.mock.calls[0][0].where;
      expect(where.contrato.cooperadoId).toBe('coop-luciano');
      expect(where.contrato.cooperativaId).toBe('coop-A');
      const msg = (enviarMensagem.mock.calls.at(-1) as any[])[1] as string;
      expect(msg).toMatch(/100|150/);
      expect(msg).toMatch(/PAGO|A_VENCER|Pago|A vencer/i);
    });
  });

  describe('Bloco 8 - executarAcao(SOLICITAR_CONFIRMACAO_PAGAMENTO)', () => {
    const TELEFONE = '+5527981341348';
    const invocar = (conversa: any) =>
      (service as any).executarAcao(
        'SOLICITAR_CONFIRMACAO_PAGAMENTO',
        conversa,
        conversa.dadosTemp ?? {},
        '',
      );

    it('Sem cobranca em aberto: avisa', async () => {
      cobrancaFindFirst.mockResolvedValueOnce(null);
      await invocar({
        id: 'c1',
        telefone: TELEFONE,
        cooperadoId: 'coop-luciano',
        cooperativaId: 'coop-A',
      });
      expect(enviarMensagem).toHaveBeenCalledWith(
        TELEFONE,
        expect.stringMatching(/nenhuma fatura|em dia|nao encontramos/i),
      );
      expect(conversaUpdate).toHaveBeenCalledWith({
        where: { id: 'c1' },
        data: { estado: 'MENU_COOPERADO' },
      });
    });

    it('Com cobranca: pergunta forma de pagamento + transiciona AGUARDANDO_FORMA_PAGAMENTO', async () => {
      cobrancaFindFirst.mockResolvedValueOnce({
        id: 'cob-1',
        status: 'VENCIDO',
        valorLiquido: 200,
      });
      await invocar({
        id: 'c1',
        telefone: TELEFONE,
        cooperadoId: 'coop-luciano',
        cooperativaId: 'coop-A',
      });
      expect(conversaUpdate).toHaveBeenCalledWith({
        where: { id: 'c1' },
        data: expect.objectContaining({
          estado: 'AGUARDANDO_FORMA_PAGAMENTO',
          dadosTemp: expect.objectContaining({ cobrancaId: 'cob-1' }),
        }),
      });
      expect(enviarMensagem).toHaveBeenCalledWith(
        TELEFONE,
        expect.stringMatching(/forma.*pagamento|pix.*transfer/i),
      );
    });
  });

  describe('Bloco 8 - executarAcao(SALVAR_CONFIRMACAO_PAGAMENTO)', () => {
    const TELEFONE = '+5527981341348';
    const invocar = (conversa: any, corpo: string) =>
      (service as any).executarAcao(
        'SALVAR_CONFIRMACAO_PAGAMENTO',
        conversa,
        conversa.dadosTemp ?? {},
        corpo,
      );

    const dadosTempBase = { cobrancaId: 'cob-1' };

    it('Sessao incompleta: avisa + sem create', async () => {
      await invocar(
        {
          id: 'c1',
          telefone: TELEFONE,
          cooperadoId: 'coop-luciano',
          cooperativaId: 'coop-A',
          dadosTemp: {},
        },
        'PIX',
      );
      expect(solicitacaoConfirmacaoPagamentoCreate).not.toHaveBeenCalled();
      expect(enviarMensagem).toHaveBeenCalledWith(
        TELEFONE,
        expect.stringMatching(/sessao|volte ao menu/i),
      );
    });

    it('Sucesso: cria solicitacao + notifica + WA + MENU', async () => {
      solicitacaoConfirmacaoPagamentoCreate.mockResolvedValueOnce({ id: 'sol-cp-1' });
      notificacaoCriarMock.mockResolvedValueOnce({});

      await invocar(
        {
          id: 'c1',
          telefone: TELEFONE,
          cooperadoId: 'coop-luciano',
          cooperativaId: 'coop-A',
          dadosTemp: dadosTempBase,
        },
        'PIX',
      );

      expect(solicitacaoConfirmacaoPagamentoCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          cooperadoId: 'coop-luciano',
          cooperativaId: 'coop-A',
          cobrancaId: 'cob-1',
          formaPagamentoReclamada: 'PIX',
          status: 'PENDENTE',
        }),
      });
      expect(notificacaoCriarMock).toHaveBeenCalledWith(
        expect.objectContaining({
          tipo: 'SOLICITACAO_CONFIRMACAO_PAGAMENTO',
          cooperativaId: 'coop-A',
        }),
      );
      expect(conversaUpdate).toHaveBeenCalledWith({
        where: { id: 'c1' },
        data: { estado: 'MENU_COOPERADO' },
      });
    });

    it('Aceita texto livre como forma (ex: "transferi do meu banco")', async () => {
      solicitacaoConfirmacaoPagamentoCreate.mockResolvedValueOnce({ id: 'sol-cp-2' });
      await invocar(
        {
          id: 'c1',
          telefone: TELEFONE,
          cooperadoId: 'coop-luciano',
          cooperativaId: 'coop-A',
          dadosTemp: dadosTempBase,
        },
        'transferi do meu banco ontem',
      );
      const data = solicitacaoConfirmacaoPagamentoCreate.mock.calls[0][0].data;
      expect(data.formaPagamentoReclamada).toBe('transferi do meu banco ontem');
    });

    it('Tenant ausente: aborta sem create', async () => {
      await invocar(
        {
          id: 'c1',
          telefone: TELEFONE,
          cooperadoId: 'coop-luciano',
          cooperativaId: null,
          dadosTemp: dadosTempBase,
        },
        'PIX',
      );
      expect(solicitacaoConfirmacaoPagamentoCreate).not.toHaveBeenCalled();
    });
  });

  describe('Bloco 8 - executarAcao(SOLICITAR_NEGOCIACAO_HUMANA)', () => {
    const TELEFONE = '+5527981341348';
    const invocar = (conversa: any) =>
      (service as any).executarAcao(
        'SOLICITAR_NEGOCIACAO_HUMANA',
        conversa,
        conversa.dadosTemp ?? {},
        '',
      );

    it('Notifica equipe + responde + MENU', async () => {
      notificacaoCriarMock.mockResolvedValueOnce({});
      await invocar({
        id: 'c1',
        telefone: TELEFONE,
        cooperadoId: 'coop-luciano',
        cooperativaId: 'coop-A',
      });
      expect(notificacaoCriarMock).toHaveBeenCalledWith(
        expect.objectContaining({
          tipo: 'NEGOCIACAO_HUMANA',
          cooperadoId: 'coop-luciano',
          cooperativaId: 'coop-A',
        }),
      );
      expect(enviarMensagem).toHaveBeenCalledWith(
        TELEFONE,
        expect.stringMatching(/equipe|contat/i),
      );
      expect(conversaUpdate).toHaveBeenCalledWith({
        where: { id: 'c1' },
        data: { estado: 'MENU_COOPERADO' },
      });
    });
  });

  // ============================================================
  // Sprint Token-WA Fase 1 (07/06/2026) — Consultas read-only de CooperTokens
  // ============================================================
  describe('CONSULTAR_SALDO_TOKENS - getSaldo do CooperTokenService', () => {
    const TELEFONE = '5527981341348';
    const COOPERADO_ID = 'coop-luc';

    it('Cooperado válido com saldo → mostra disponível + valor estimado + disclaimer', async () => {
      getSaldoMock.mockResolvedValueOnce({
        saldoDisponivel: 1500,
        saldoPendente: 0,
        valorAtualEstimado: 675,
      });
      modeloFindFirst.mockResolvedValueOnce({
        id: 'mod-1',
        conteudo:
          'Saldo: *{{saldo_disponivel}} CooperTokens*{{saldo_pendente}}\nValor: {{valor_estimado}}',
      });

      await (service as any).executarConsultarSaldoTokens({
        id: 'c1',
        telefone: TELEFONE,
        cooperadoId: COOPERADO_ID,
        cooperativaId: 'coop-A',
      });

      expect(getSaldoMock).toHaveBeenCalledWith(COOPERADO_ID);
      expect(enviarMensagem).toHaveBeenCalledWith(
        TELEFONE,
        expect.stringContaining('1.500 CooperTokens'),
      );
      expect(enviarMensagem).toHaveBeenCalledWith(
        TELEFONE,
        expect.stringContaining('R$ 675,00'),
      );
      expect(incrementarUso).toHaveBeenCalledWith('mod-1');
    });

    it('Cooperado com saldo pendente → linha extra aparece', async () => {
      getSaldoMock.mockResolvedValueOnce({
        saldoDisponivel: 100,
        saldoPendente: 50,
        valorAtualEstimado: 45,
      });
      modeloFindFirst.mockResolvedValueOnce({
        id: 'mod-1',
        conteudo: '{{saldo_disponivel}}{{saldo_pendente}}',
      });

      await (service as any).executarConsultarSaldoTokens({
        id: 'c1',
        telefone: TELEFONE,
        cooperadoId: COOPERADO_ID,
        cooperativaId: 'coop-A',
      });

      const msg = enviarMensagem.mock.calls[0][1];
      expect(msg).toMatch(/Pendentes.*50.*CooperTokens/);
    });

    it('Saldo zero → não mostra linha pendentes, valor R$ 0,00', async () => {
      getSaldoMock.mockResolvedValueOnce({
        saldoDisponivel: 0,
        saldoPendente: 0,
        valorAtualEstimado: 0,
      });
      modeloFindFirst.mockResolvedValueOnce({
        id: 'mod-1',
        conteudo: 'D[{{saldo_disponivel}}]P[{{saldo_pendente}}]V[{{valor_estimado}}]',
      });

      await (service as any).executarConsultarSaldoTokens({
        id: 'c1',
        telefone: TELEFONE,
        cooperadoId: COOPERADO_ID,
      });

      const msg = enviarMensagem.mock.calls[0][1];
      expect(msg).toMatch(/D\[0\]P\[\]V\[R/);
    });

    it('Sem cooperadoId → mensagem CTA cadastro, NÃO chama getSaldo', async () => {
      await (service as any).executarConsultarSaldoTokens({
        id: 'c1',
        telefone: TELEFONE,
        cooperadoId: null,
      });
      expect(getSaldoMock).not.toHaveBeenCalled();
      expect(enviarMensagem).toHaveBeenCalledWith(
        TELEFONE,
        expect.stringContaining('cooperado'),
      );
    });

    it('Modelo "saldo_tokens_resultado" ausente → log warn, ação aborta', async () => {
      getSaldoMock.mockResolvedValueOnce({
        saldoDisponivel: 100,
        saldoPendente: 0,
        valorAtualEstimado: 45,
      });
      modeloFindFirst.mockResolvedValueOnce(null);

      await (service as any).executarConsultarSaldoTokens({
        id: 'c1',
        telefone: TELEFONE,
        cooperadoId: COOPERADO_ID,
      });
      expect(enviarMensagem).not.toHaveBeenCalled();
    });
  });

  describe('CONSULTAR_EXTRATO_TOKENS - getExtrato + paginação', () => {
    const TELEFONE = '5527981341348';
    const COOPERADO_ID = 'coop-luc';

    it('Extrato vazio página 1 → mensagem orientativa', async () => {
      getExtratoMock.mockResolvedValueOnce({ items: [], total: 0, page: 1, limit: 10 });

      await (service as any).executarConsultarExtratoTokens(
        { id: 'c1', telefone: TELEFONE, cooperadoId: COOPERADO_ID },
        1,
      );

      expect(getExtratoMock).toHaveBeenCalledWith(COOPERADO_ID, 1, 10);
      expect(enviarMensagem).toHaveBeenCalledWith(
        TELEFONE,
        expect.stringContaining('ainda não tem transações'),
      );
      expect(conversaUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { dadosTemp: { extratoPagina: 1 } },
        }),
      );
    });

    it('Extrato com 10 itens página 1 + total > 10 → mostra "Digite MAIS"', async () => {
      const items = Array.from({ length: 10 }, (_, i) => ({
        id: `t${i}`,
        createdAt: new Date('2026-06-01'),
        operacao: 'CREDITO',
        quantidade: 100 + i,
        descricao: `Transação ${i}`,
      }));
      getExtratoMock.mockResolvedValueOnce({
        items,
        total: 25,
        page: 1,
        limit: 10,
      });

      await (service as any).executarConsultarExtratoTokens(
        { id: 'c1', telefone: TELEFONE, cooperadoId: COOPERADO_ID },
        1,
      );

      const msg = enviarMensagem.mock.calls[0][1];
      expect(msg).toMatch(/página 1\/3/);
      expect(msg).toMatch(/Digite \*MAIS\*/);
      // 10 linhas + cabeçalho + rodapé < 4096 chars (limite WA)
      expect(msg.length).toBeLessThan(4096);
    });

    it('Última página → mostra "Fim do extrato"', async () => {
      getExtratoMock.mockResolvedValueOnce({
        items: [
          {
            id: 't1',
            createdAt: new Date('2026-06-01'),
            operacao: 'DEBITO',
            quantidade: -50,
            descricao: 'Resgate',
          },
        ],
        total: 11,
        page: 2,
        limit: 10,
      });

      await (service as any).executarConsultarExtratoTokens(
        { id: 'c1', telefone: TELEFONE, cooperadoId: COOPERADO_ID },
        2,
      );

      const msg = enviarMensagem.mock.calls[0][1];
      expect(msg).toMatch(/página 2\/2/);
      expect(msg).toMatch(/Fim do extrato/);
      expect(msg).not.toMatch(/Digite \*MAIS\*/);
    });

    it('Sem cooperadoId → mensagem CTA, NÃO chama getExtrato', async () => {
      await (service as any).executarConsultarExtratoTokens(
        { id: 'c1', telefone: TELEFONE, cooperadoId: null },
        1,
      );
      expect(getExtratoMock).not.toHaveBeenCalled();
    });
  });

  describe('EXTRATO_TOKENS_PAGINAR - resposta "MAIS"', () => {
    const TELEFONE = '5527981341348';
    const COOPERADO_ID = 'coop-luc';

    it('Entrada "MAIS" → avança página armazenada em dadosTemp', async () => {
      (prismaMock.conversaWhatsapp.findUnique as jest.Mock).mockResolvedValueOnce({
        dadosTemp: { extratoPagina: 1 },
      });
      getExtratoMock.mockResolvedValueOnce({
        items: [
          {
            id: 't2',
            createdAt: new Date('2026-06-02'),
            operacao: 'CREDITO',
            quantidade: 200,
            descricao: 'Bônus',
          },
        ],
        total: 12,
        page: 2,
        limit: 10,
      });

      await (service as any).executarExtratoTokensPaginar(
        { id: 'c1', telefone: TELEFONE, cooperadoId: COOPERADO_ID },
        'MAIS',
      );

      // Chamou getExtrato com página 2 (1 + 1)
      expect(getExtratoMock).toHaveBeenCalledWith(COOPERADO_ID, 2, 10);
    });

    it('Entrada qualquer outra (não-MAIS) → NÃO chama getExtrato', async () => {
      await (service as any).executarExtratoTokensPaginar(
        { id: 'c1', telefone: TELEFONE, cooperadoId: COOPERADO_ID },
        'qualquer',
      );
      expect(getExtratoMock).not.toHaveBeenCalled();
    });

    it('Sem página prévia em dadosTemp → começa em página 2', async () => {
      (prismaMock.conversaWhatsapp.findUnique as jest.Mock).mockResolvedValueOnce({
        dadosTemp: null,
      });
      getExtratoMock.mockResolvedValueOnce({
        items: [],
        total: 0,
        page: 2,
        limit: 10,
      });

      await (service as any).executarExtratoTokensPaginar(
        { id: 'c1', telefone: TELEFONE, cooperadoId: COOPERADO_ID },
        'mais',
      );
      // 1 (default) + 1 = 2
      expect(getExtratoMock).toHaveBeenCalledWith(COOPERADO_ID, 2, 10);
    });
  });

  // ============================================================
  // Sprint "Qual cadastro?" Fix 2 (08/06/2026)
  // VERIFICAR_COOPERADO + ESCOLHER_CADASTRO_COOPERADO + TROCAR_CADASTRO
  // ============================================================
  describe('VERIFICAR_COOPERADO — 1 cadastro vs >1 cadastros', () => {
    const TELEFONE = '5527981341348';

    function mockBuscarEtapaMenuCoop() {
      // Não força modelo — cai no fallback hardcoded (menu 8 opções).
      etapaFindFirst.mockResolvedValue(null);
    }

    it('1 cadastro -> popula cooperadoId + transiciona MENU_COOPERADO', async () => {
      mockBuscarEtapaMenuCoop();
      prismaMock.cooperado.findMany.mockResolvedValueOnce([
        { id: 'coop1', nomeCompleto: 'Luciano', cooperativaId: 'tenantA', tipoPessoa: 'PF', razaoSocial: null },
      ]);

      await (service as any).executarVerificarCooperado({
        id: 'conv1',
        telefone: TELEFONE,
      });

      const updateCall = conversaUpdate.mock.calls.find(
        (c: any[]) => c[0].data?.estado === 'MENU_COOPERADO',
      );
      expect(updateCall).toBeTruthy();
      expect(updateCall[0].data).toMatchObject({
        estado: 'MENU_COOPERADO',
        cooperadoId: 'coop1',
        cooperativaId: 'tenantA',
      });
    });

    it('>1 cadastros -> transiciona MENU_ESCOLHA_CADASTRO + persiste candidatos', async () => {
      prismaMock.cooperado.findMany.mockResolvedValueOnce([
        { id: 'coop1', nomeCompleto: 'Luciano', cooperativaId: 'tenantA', tipoPessoa: 'PF', razaoSocial: null },
        { id: 'coop2', nomeCompleto: 'SISGD', cooperativaId: 'tenantA', tipoPessoa: 'PJ', razaoSocial: 'SISGDSOLAR' },
      ]);

      await (service as any).executarVerificarCooperado({
        id: 'conv1',
        telefone: TELEFONE,
      });

      const updateCall = conversaUpdate.mock.calls.find(
        (c: any[]) => c[0].data?.estado === 'MENU_ESCOLHA_CADASTRO',
      );
      expect(updateCall).toBeTruthy();
      const candidatos = updateCall[0].data.dadosTemp.candidatosCadastro;
      expect(candidatos).toHaveLength(2);
      expect(candidatos[0].id).toBe('coop1');
      expect(candidatos[1].id).toBe('coop2');

      const msg = enviarMensagem.mock.calls[0][1] as string;
      expect(msg).toContain('mais de um cadastro');
      expect(msg).toContain('Luciano (PF)');
      expect(msg).toContain('SISGDSOLAR (PJ)');
    });

    it('0 cadastros -> mensagem de não encontrado, sem update', async () => {
      prismaMock.cooperado.findMany.mockResolvedValueOnce([]);
      await (service as any).executarVerificarCooperado({
        id: 'conv1',
        telefone: TELEFONE,
      });
      const updateMenu = conversaUpdate.mock.calls.find(
        (c: any[]) =>
          c[0].data?.estado === 'MENU_COOPERADO' ||
          c[0].data?.estado === 'MENU_ESCOLHA_CADASTRO',
      );
      expect(updateMenu).toBeUndefined();
      expect((enviarMensagem.mock.calls[0][1] as string)).toContain('Não encontrei');
    });
  });

  describe('ESCOLHER_CADASTRO_COOPERADO — anti-IDOR', () => {
    const TELEFONE = '5527981341348';
    const CANDIDATOS = [
      { id: 'coop1', nomeCompleto: 'Luciano', cooperativaId: 'tenantA', tipoPessoa: 'PF', razaoSocial: null },
      { id: 'coop2', nomeCompleto: 'SISGD', cooperativaId: 'tenantA', tipoPessoa: 'PJ', razaoSocial: 'SISGDSOLAR' },
    ];

    it('Índice válido -> popula cooperadoId do candidato salvo (não confia em payload)', async () => {
      prismaMock.conversaWhatsapp.findUnique.mockResolvedValueOnce({
        dadosTemp: { candidatosCadastro: CANDIDATOS },
      });
      etapaFindFirst.mockResolvedValue(null);

      await (service as any).executarEscolherCadastroCooperado(
        { id: 'conv1', telefone: TELEFONE, dadosTemp: { candidatosCadastro: CANDIDATOS } },
        '2',
      );

      const updateCall = conversaUpdate.mock.calls.find(
        (c: any[]) => c[0].data?.estado === 'MENU_COOPERADO',
      );
      expect(updateCall[0].data).toMatchObject({
        estado: 'MENU_COOPERADO',
        cooperadoId: 'coop2', // SISGD (índice 2 = posição 1)
      });
    });

    it('Sem candidatos em dadosTemp -> mensagem de sessão expirada, não cria cooperadoId', async () => {
      prismaMock.conversaWhatsapp.findUnique.mockResolvedValueOnce({ dadosTemp: {} });
      await (service as any).executarEscolherCadastroCooperado(
        { id: 'conv1', telefone: TELEFONE, dadosTemp: {} },
        '1',
      );
      const updateMenu = conversaUpdate.mock.calls.find(
        (c: any[]) => c[0].data?.estado === 'MENU_COOPERADO',
      );
      expect(updateMenu).toBeUndefined();
      expect((enviarMensagem.mock.calls[0][1] as string)).toContain('expirou');
    });

    it('Índice inválido (fora do range) -> reenvia opções, não cria cooperadoId', async () => {
      prismaMock.conversaWhatsapp.findUnique.mockResolvedValueOnce({
        dadosTemp: { candidatosCadastro: CANDIDATOS },
      });
      await (service as any).executarEscolherCadastroCooperado(
        { id: 'conv1', telefone: TELEFONE, dadosTemp: { candidatosCadastro: CANDIDATOS } },
        '99',
      );
      const updateMenu = conversaUpdate.mock.calls.find(
        (c: any[]) => c[0].data?.estado === 'MENU_COOPERADO',
      );
      expect(updateMenu).toBeUndefined();
      expect((enviarMensagem.mock.calls[0][1] as string)).toContain('Opção inválida');
    });

    it('Índice não-numérico -> reenvia opções', async () => {
      prismaMock.conversaWhatsapp.findUnique.mockResolvedValueOnce({
        dadosTemp: { candidatosCadastro: CANDIDATOS },
      });
      await (service as any).executarEscolherCadastroCooperado(
        { id: 'conv1', telefone: TELEFONE, dadosTemp: { candidatosCadastro: CANDIDATOS } },
        'abc',
      );
      expect((enviarMensagem.mock.calls[0][1] as string)).toContain('Opção inválida');
    });
  });

  describe('detectarComandoUniversal — TROCAR CADASTRO', () => {
    it('Reconhece "TROCAR CADASTRO"', () => {
      expect(service.detectarComandoUniversal('TROCAR CADASTRO')).toBe('TROCAR_CADASTRO');
    });
    it('Reconhece "trocar de cadastro" (case-insensitive)', () => {
      expect(service.detectarComandoUniversal('trocar de cadastro')).toBe('TROCAR_CADASTRO');
    });
    it('Reconhece "outro cadastro"', () => {
      expect(service.detectarComandoUniversal('OUTRO CADASTRO')).toBe('TROCAR_CADASTRO');
    });
    it('Não confunde com "cadastro" sozinho (palavra parcial)', () => {
      expect(service.detectarComandoUniversal('cadastro')).toBeNull();
    });
  });
});
