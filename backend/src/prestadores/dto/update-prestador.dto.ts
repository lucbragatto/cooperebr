// D-novo-BR F0.3 AA7 — cooperativaId removido (não permite tenant-hopping).
export class UpdatePrestadorDto {
  nome?: string;
  telefone?: string;
  email?: string;
  documento?: string;
  cooperadoId?: string;
  especialidade?: string;
  ativo?: boolean;
}
