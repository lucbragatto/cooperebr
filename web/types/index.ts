export type PerfilUsuario = 'SUPER_ADMIN' | 'ADMIN' | 'OPERADOR' | 'COOPERADO';

export type StatusCooperado = 'PENDENTE' | 'ATIVO' | 'SUSPENSO' | 'ENCERRADO';

export type StatusContrato = 'ATIVO' | 'SUSPENSO' | 'ENCERRADO';

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

export interface Usina {
  id: string;
  nome: string;
  potenciaKwp: number;
  cidade: string;
  estado: string;
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

export interface AuthResponse {
  token: string;
  usuario: Usuario;
}

export type ModeloCobranca = 'FIXO_MENSAL' | 'CREDITOS_COMPENSADOS' | 'CREDITOS_DINAMICO';
export type TipoCampanha = 'PADRAO' | 'CAMPANHA';

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
