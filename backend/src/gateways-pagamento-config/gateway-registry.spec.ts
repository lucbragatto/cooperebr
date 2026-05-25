import {
  GATEWAY_REGISTRY,
  TIPOS_GATEWAY_SUPORTADOS,
  isTipoGatewaySuportado,
  getDescriptor,
  getDescriptorPublico,
} from './gateway-registry';

describe('GatewayRegistry', () => {
  describe('TIPOS_GATEWAY_SUPORTADOS', () => {
    it('lista canonica suportada hoje: ASAAS + BANESTES', () => {
      expect([...TIPOS_GATEWAY_SUPORTADOS].sort()).toEqual(['ASAAS', 'BANESTES']);
    });

    it('SICOOB e BB nao estao no registry (decisao 5 Fase 1)', () => {
      expect(TIPOS_GATEWAY_SUPORTADOS).not.toContain('SICOOB' as any);
      expect(TIPOS_GATEWAY_SUPORTADOS).not.toContain('BB' as any);
    });

    it('registry e Readonly (Object.freeze) — tentativa de mutacao falha em strict mode', () => {
      expect(Object.isFrozen(GATEWAY_REGISTRY)).toBe(true);
    });
  });

  describe('isTipoGatewaySuportado()', () => {
    it.each(['ASAAS', 'BANESTES'])('aceita tipo suportado: %s', (tipo) => {
      expect(isTipoGatewaySuportado(tipo)).toBe(true);
    });

    it.each(['SICOOB', 'BB', 'ITAU', 'asaas', 'banestes', ''])(
      'rejeita tipo nao-suportado: %s',
      (tipo) => {
        expect(isTipoGatewaySuportado(tipo)).toBe(false);
      },
    );
  });

  describe('getDescriptor()', () => {
    it('retorna descriptor ASAAS com schema Zod + camposSecret', () => {
      const d = getDescriptor('ASAAS');
      expect(d.tipo).toBe('ASAAS');
      expect(d.camposSecret).toContain('apiKey');
      expect(d.camposMetadados).toContain('webhookToken');
      expect(d.suporta.boleto).toBe(true);
      expect(d.suporta.pix).toBe(true);
      expect(d.suporta.webhook).toBe(true);
    });

    it('retorna descriptor BANESTES com 4 campos secretos', () => {
      const d = getDescriptor('BANESTES');
      expect(d.tipo).toBe('BANESTES');
      expect([...d.camposSecret].sort()).toEqual(
        ['chavePix', 'clientId', 'clientSecret', 'pfxSenha'].sort(),
      );
      expect(d.camposMetadados).toContain('pfxPath');
      expect(d.suporta.pix).toBe(true);
      expect(d.suporta.boleto).toBe(false);
      expect(d.suporta.cancelarCobranca).toBe(false); // stub M26
      expect(d.suporta.webhook).toBe(false); // D-novo-AH pendente
    });

    it('throw pra tipo nao-suportado', () => {
      expect(() => getDescriptor('SICOOB' as any)).toThrow(/SICOOB/);
    });
  });

  describe('schema Zod ASAAS', () => {
    it('aceita payload valido', () => {
      const d = getDescriptor('ASAAS');
      const r = d.schemaCredenciais.safeParse({
        apiKey: '$aact_YTU5YTE0M2M2N2I4MTliNzk0YTI5N2U5MzdjNWZmNDNlOTcxNzdmMzZkNTk5MGNkOGQ3ZA',
      });
      expect(r.success).toBe(true);
    });

    it('rejeita apiKey curta (<20 chars)', () => {
      const d = getDescriptor('ASAAS');
      const r = d.schemaCredenciais.safeParse({ apiKey: 'curta' });
      expect(r.success).toBe(false);
    });

    it('aceita webhookToken opcional ausente', () => {
      const d = getDescriptor('ASAAS');
      const r = d.schemaCredenciais.safeParse({
        apiKey: '$aact_YTU5YTE0M2M2N2I4MTliNzk0YTI5N2U5',
      });
      expect(r.success).toBe(true);
    });
  });

  describe('schema Zod BANESTES', () => {
    const payloadValido = {
      pfxPath: '/opt/certs/cooperebr-sandbox.pfx',
      pfxSenha: 'senha-do-pfx',
      clientId: 'client-id-fake',
      clientSecret: 'client-secret-fake',
      chavePix: '12345678901',
    };

    it('aceita payload valido', () => {
      const d = getDescriptor('BANESTES');
      const r = d.schemaCredenciais.safeParse(payloadValido);
      expect(r.success).toBe(true);
    });

    it('rejeita pfxPath relativo (deve ser absoluto)', () => {
      const d = getDescriptor('BANESTES');
      const r = d.schemaCredenciais.safeParse({
        ...payloadValido,
        pfxPath: 'certs/sandbox.pfx',
      });
      expect(r.success).toBe(false);
    });

    it('rejeita campos obrigatorios faltando', () => {
      const d = getDescriptor('BANESTES');
      const r = d.schemaCredenciais.safeParse({
        pfxPath: '/opt/certs/x.pfx',
        // pfxSenha + clientId + clientSecret + chavePix faltando
      });
      expect(r.success).toBe(false);
    });

    it('rejeita chavePix muito curta (<8 chars)', () => {
      const d = getDescriptor('BANESTES');
      const r = d.schemaCredenciais.safeParse({
        ...payloadValido,
        chavePix: '1234',
      });
      expect(r.success).toBe(false);
    });
  });

  describe('getDescriptorPublico() — versao serializavel pro frontend', () => {
    it('retorna ASAAS sem schema Zod, com campos enumerados', () => {
      const pub = getDescriptorPublico('ASAAS');
      expect(pub.tipo).toBe('ASAAS');
      expect(pub.nome).toBe('Asaas');
      expect((pub as any).schemaCredenciais).toBeUndefined();

      const apiKeyField = pub.campos.find((c) => c.nome === 'apiKey');
      expect(apiKeyField).toBeDefined();
      expect(apiKeyField!.secret).toBe(true);
      expect(apiKeyField!.tipo).toBe('password');
      expect(apiKeyField!.obrigatorio).toBe(true);

      const webhookField = pub.campos.find((c) => c.nome === 'webhookToken');
      expect(webhookField!.secret).toBe(false);
      expect(webhookField!.obrigatorio).toBe(false);
    });

    it('retorna BANESTES com 5 campos (4 secretos + 1 metadado)', () => {
      const pub = getDescriptorPublico('BANESTES');
      expect(pub.campos).toHaveLength(5);
      const secretos = pub.campos.filter((c) => c.secret).map((c) => c.nome);
      expect(secretos.sort()).toEqual(['chavePix', 'clientId', 'clientSecret', 'pfxSenha'].sort());
      const naoSecreto = pub.campos.find((c) => !c.secret);
      expect(naoSecreto!.nome).toBe('pfxPath');
    });

    it('expoe operacoes suportadas (suporta.*) inalterado', () => {
      const pub = getDescriptorPublico('BANESTES');
      expect(pub.suporta.pix).toBe(true);
      expect(pub.suporta.boleto).toBe(false);
    });
  });
});
