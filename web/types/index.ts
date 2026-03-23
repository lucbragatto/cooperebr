export type PerfilUsuario = 'SUPER_ADMIN' | 'ADMIN' | 'OPERADOR' | 'COOPERADO';

export type StatusCooperado = 'PENDENTE' | 'ATIVO' | 'SUSPENSO' | 'ENCERRADO';

export type StatusContrato = 'PENDENTE_ATIVACAO' | 'EM_APROVACAO' | 'AGUARDANDO_ASSINATURA' | 'ASSINATURA_SOLICITADA' | 'APROVADO' | 'ATIVO' | 'SUSPENSO' | 'ENCERRADO' | 'LISTA_ESPERA';

export type StatusCobranca = 'PENDENTE' | 'PAGO' | 'VENCIDO' | 'CANCELADO';

export type StatusOcorrencia = 'ABERTA' | 'EM_ANDAMENTO' | 'RESOLVIDA' | 'CANCELADA';

export type TipoOcorrencia =
  | 'FALTA_ENERGIA'
  | 'MEDICAO_INCORRETA'
  | 'PROBLEMA_FATURA'
  | 'SOLICITACAO'
  | 'OUTROS';

export type PrioridadeOcorrencia = 'BAIXA' | 'MEDIA' | 'ALTA' | 'CRITICA';

export interface Usuario {
  id: string;
  nome: string;
  email: string;
  cpf: string | null;
  telefone: string | null;
  perfil: PerfilUsuario;
  fotoFacialUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Cooperado {
  id: string;
  nomeCompleto: string;
  cpf: string;
  email: string;
  telefone: string | null;
  status: StatusCooperado;
  createdAt: string;
  updatedAt: string;
}

export interface UC {
  id: string;
  numero: string;
  endereco: string;
  cidade: string;
  estado: string;
  cooperadoId: string;
  cooperado?: Cooperado;
  createdAt: string;
  updatedAt: string;
}

export type StatusUsina = 'CADASTRADA' | 'AGUARDANDO_HOMOLOGACAO' | 'HOMOLOGADA' | 'EM_PRODUCAO' | 'SUSPENSA';

export interface Usina {
  id: string;
  nome: string;
  potenciaKwp: number;
  capacidadeKwh?: number | null;
  producaoMensalKwh?: number | null;
  cidade: string;
  estado: string;
  statusHomologacao: StatusUsina;
  dataHomologacao?: string | null;
  dataInicioProducao?: string | null;
  observacoes?: string | null;
  distribuidora?: string | null;
  cooperativaId?: string | null;
  proprietarioNome?: string | null;
  proprietarioCpfCnpj?: string | null;
  proprietarioTelefone?: string | null;
  proprietarioEmail?: string | null;
  proprietarioTipo?: string;
  proprietarioCooperadoId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Contrato {
  id: string;
  numero: string;
  cooperadoId: string;
  cooperado?: Cooperado;
  ucId: string;
  uc?: UC;
  usinaId: string;
  usina?: Usina;
  dataInicio: string;
  dataFim: string | null;
  percentualDesconto: number;
  status: StatusContrato;
  kwhContratoAnual?: number | null;
  kwhContratoMensal?: number | null;
  kwhContrato?: number | null;
  percentualUsina?: number | null;
  descontoOverride?: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface Cobranca {
  id: string;
  contratoId: string;
  contrato?: Contrato;
  mesReferencia: number;
  anoReferencia: number;
  valorBruto: number;
  percentualDesconto: number;
  valorDesconto: number;
  valorLiquido: number;
  status: StatusCobranca;
  dataVencimento: string;
  dataPagamento: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Ocorrencia {
  id: string;
  cooperadoId: string;
  cooperado?: Cooperado;
  ucId: string | null;
  uc?: UC;
  tipo: TipoOcorrencia;
  descricao: string;
  status: StatusOcorrencia;
  prioridade: PrioridadeOcorrencia;
  resolucao: string | null;
  createdAt: string;
  updatedAt: string;
}

export type TipoNotificacao =
  | 'DOCUMENTO_ENVIADO'
  | 'DOCUMENTO_APROVADO'
  | 'DOCUMENTO_REPROVADO'
  | 'TODOS_DOCS_APROVADOS'
  | 'CONTRATO_ASSINADO'
  | 'DOCUMENTO_PENDENTE';

export interface Notificacao {
  id: string;
  tipo: TipoNotificacao | string;
  titulo: string;
  mensagem: string;
  lida: boolean;
  cooperadoId: string | null;
  cooperado?: { nomeCompleto: string } | null;
  adminId: string | null;
  link: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AuthResponse {
  token: string;
  usuario: Usuario;
}

export type ModeloCobranca = 'FIXO_MENSAL' | 'CREDITOS_COMPENSADOS' | 'CREDITOS_DINAMICO';
export type TipoCampanha = 'PADRAO' | 'CAMPANHA';
export type EscopoModelo = 'COOPERATIVA' | 'USINA';
export type BaseCalculo = 'TUSD_TE' | 'TOTAL_FATURA' | 'CONFIGURAVEL';

export interface ModeloCobrancaConfig {
  id: string;
  nome: string;
  descricao: string | null;
  tipo: ModeloCobranca;
  ativo: boolean;
  escopo: EscopoModelo;
  usinaId: string | null;
  descontoBase: number;
  descontoMinimo: number | null;
  descontoMaximo: number | null;
  temPromocao: boolean;
  descontoPromocional: number | null;
  promocaoInicio: string | null;
  promocaoFim: string | null;
  temProgressivo: boolean;
  descontoProgressivo: number | null;
  progressivoAteCap: number | null;
  baseCalculo: BaseCalculo;
  createdAt: string;
  updatedAt: string;
}

// ─── Asaas ─────────────────────────────────────────────────

export type StatusAsaasCobranca =
  | 'PENDING'
  | 'RECEIVED'
  | 'CONFIRMED'
  | 'OVERDUE'
  | 'REFUNDED'
  | 'CANCELLED';

export interface AsaasConfig {
  id: string;
  cooperativaId: string;
  apiKey: string | null;
  apiKeyDefinida: boolean;
  ambiente: string;
  webhookToken: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AsaasCobranca {
  id: string;
  cobrancaId: string | null;
  cooperadoId: string;
  asaasId: string;
  status: StatusAsaasCobranca;
  valor: number;
  vencimento: string;
  linkPagamento: string | null;
  boletoUrl: string | null;
  pixQrCode: string | null;
  pixCopiaECola: string | null;
  nossoNumero: string | null;
  formaPagamento: string;
  createdAt: string;
  updatedAt: string;
}

export interface Plano {
  id: string;
  nome: string;
  descricao: string | null;
  modeloCobranca: ModeloCobranca;
  descontoBase: number;
  temPromocao: boolean;
  descontoPromocional: number | null;
  mesesPromocao: number | null;
  publico: boolean;
  ativo: boolean;
  tipoCampanha: TipoCampanha;
  dataInicioVigencia: string | null;
  dataFimVigencia: string | null;
  createdAt: string;
  updatedAt: string;
}
