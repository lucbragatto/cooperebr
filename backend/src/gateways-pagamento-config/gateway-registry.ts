import { z } from 'zod';

/**
 * GatewayRegistry — definicao declarativa dos tipos de gateway suportados
 * pelo SISGD/CoopereBR.
 *
 * Sub-Sprint Gateways de Pagamento — Fatia F1 Etapa C (M27, 2026-05-26).
 *
 * Cada entrada documenta:
 *   - schema Zod das credenciais (validacao no controller + frontend dinamico)
 *   - lista de campos secretos (CredentialsEncryptor cifra ANTES de persistir)
 *   - lista de campos metadados (texto puro, podem ir pra UI sem decrypt)
 *   - operacoes suportadas (UI desabilita botoes incompativeis)
 *
 * Decisao 5 (relatorio Fase 1): Sicoob/BB FORA do registry ate o adapter
 * real existir. Adicionar entry novo aqui sem adapter = quebra runtime.
 */

export type TipoGateway = 'ASAAS' | 'BANESTES';

export interface GatewayDescriptor {
  tipo: TipoGateway;
  nome: string;
  descricao: string;
  ambientes: ReadonlyArray<'SANDBOX' | 'PRODUCAO'>;
  /** Schema Zod das credenciais (input). Campos secretos + nao-secretos juntos. */
  schemaCredenciais: z.ZodTypeAny;
  /** Quais chaves do schemaCredenciais sao secretas (CredentialsEncryptor cifra). */
  camposSecret: ReadonlyArray<string>;
  /** Quais chaves vao em texto puro pra exibir na UI sem decrypt. */
  camposMetadados: ReadonlyArray<string>;
  /** Operacoes vivas. UI usa isso pra desabilitar botoes incompativeis. */
  suporta: {
    boleto: boolean;
    pix: boolean;
    cartao: boolean;
    cancelarCobranca: boolean;
    webhook: boolean;
  };
}

// ─── ASAAS ──────────────────────────────────────────────────────────

const asaasSchema = z.object({
  apiKey: z.string().min(20, 'apiKey Asaas deve ter no minimo 20 caracteres'),
  webhookToken: z.string().optional(),
});

const ASAAS: GatewayDescriptor = {
  tipo: 'ASAAS',
  nome: 'Asaas',
  descricao: 'Boleto, PIX e cartao de credito via Asaas (gateway full-service).',
  ambientes: ['SANDBOX', 'PRODUCAO'],
  schemaCredenciais: asaasSchema,
  camposSecret: ['apiKey'],
  camposMetadados: ['webhookToken'],
  suporta: {
    boleto: true,
    pix: true,
    cartao: true,
    cancelarCobranca: true,
    webhook: true,
  },
};

// ─── BANESTES (Cenario Minimo M26) ─────────────────────────────────

const banestesSchema = z.object({
  pfxPath: z
    .string()
    .min(1, 'pfxPath obrigatorio')
    .refine((v) => v.startsWith('/'), 'pfxPath deve ser caminho absoluto'),
  pfxSenha: z.string().min(1, 'pfxSenha obrigatoria'),
  clientId: z.string().min(1, 'clientId OAuth obrigatorio'),
  clientSecret: z.string().min(1, 'clientSecret OAuth obrigatorio'),
  chavePix: z.string().min(8, 'chavePix recebedora obrigatoria (CPF/CNPJ/email/aleatoria)'),
});

const BANESTES: GatewayDescriptor = {
  tipo: 'BANESTES',
  nome: 'Banestes',
  descricao: 'PIX cobranca imediata via Banestes (mTLS .pfx + OAuth2 Client Credentials).',
  ambientes: ['SANDBOX', 'PRODUCAO'],
  schemaCredenciais: banestesSchema,
  camposSecret: ['pfxSenha', 'clientId', 'clientSecret', 'chavePix'],
  camposMetadados: ['pfxPath'],
  suporta: {
    boleto: false,
    pix: true,
    cartao: false,
    cancelarCobranca: false, // stub NotImplementedException no adapter (M26 Cenario Minimo)
    webhook: false, // D-novo-AH pendente (M26)
  },
};

// ─── Registry ──────────────────────────────────────────────────────

export const GATEWAY_REGISTRY: Readonly<Record<TipoGateway, GatewayDescriptor>> = Object.freeze({
  ASAAS,
  BANESTES,
});

export const TIPOS_GATEWAY_SUPORTADOS: ReadonlyArray<TipoGateway> = Object.freeze([
  'ASAAS',
  'BANESTES',
]);

export function isTipoGatewaySuportado(tipo: string): tipo is TipoGateway {
  return TIPOS_GATEWAY_SUPORTADOS.includes(tipo as TipoGateway);
}

export function getDescriptor(tipo: TipoGateway): GatewayDescriptor {
  const desc = GATEWAY_REGISTRY[tipo];
  if (!desc) {
    throw new Error(`Tipo de gateway nao suportado: "${tipo}". Suportados: ${TIPOS_GATEWAY_SUPORTADOS.join(', ')}`);
  }
  return desc;
}

/**
 * Versao serializavel pra frontend renderizar form dinamico.
 * Substitui schema Zod por estrutura JSON-friendly.
 */
export interface GatewayDescriptorPublico {
  tipo: TipoGateway;
  nome: string;
  descricao: string;
  ambientes: ReadonlyArray<'SANDBOX' | 'PRODUCAO'>;
  campos: ReadonlyArray<{
    nome: string;
    label: string;
    tipo: 'string' | 'password';
    obrigatorio: boolean;
    secret: boolean;
    descricao?: string;
  }>;
  suporta: GatewayDescriptor['suporta'];
}

/**
 * Constroi a descricao publica (sem Zod schema, formato JSON-friendly)
 * inferindo metadados do registry.
 */
export function getDescriptorPublico(tipo: TipoGateway): GatewayDescriptorPublico {
  const d = getDescriptor(tipo);
  const fieldDescriptions: Record<string, { label: string; descricao?: string }> = {
    // ASAAS
    apiKey: { label: 'API Key', descricao: 'Token de acesso gerado no painel Asaas (Conta > Integracoes).' },
    webhookToken: { label: 'Webhook Token (opcional)', descricao: 'Validacao HMAC de webhooks. Configurar no painel Asaas.' },
    // BANESTES
    pfxPath: { label: 'Caminho do .pfx no servidor', descricao: 'Caminho absoluto. Ex: /opt/certs/cooperebr-sandbox.pfx (permissao 0600)' },
    pfxSenha: { label: 'Senha do certificado .pfx' },
    clientId: { label: 'OAuth Client ID' },
    clientSecret: { label: 'OAuth Client Secret' },
    chavePix: { label: 'Chave PIX recebedora', descricao: 'CPF/CNPJ/email/aleatoria cadastrada no Banestes.' },
  };

  // Extrai shape do schema Zod
  // z.object retorna shape via .shape
  const shape = (d.schemaCredenciais as any).shape ?? {};
  const camposNomes = Object.keys(shape);

  const campos = camposNomes.map((nome) => {
    const def = shape[nome];
    const meta = fieldDescriptions[nome] ?? { label: nome };
    const secret = d.camposSecret.includes(nome);
    const obrigatorio = !def.isOptional?.();
    return {
      nome,
      label: meta.label,
      tipo: (secret ? 'password' : 'string') as 'string' | 'password',
      obrigatorio,
      secret,
      descricao: meta.descricao,
    };
  });

  return {
    tipo: d.tipo,
    nome: d.nome,
    descricao: d.descricao,
    ambientes: d.ambientes,
    campos,
    suporta: d.suporta,
  };
}
