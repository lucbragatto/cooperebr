// D-novo-BR F0.3 MA3 — cooperativaId removido do DTO (vem do JWT no controller).
export class CreatePrestadorDto {
  nome: string;
  telefone?: string;
  email?: string;
  documento?: string;
  cooperadoId?: string;
  especialidade?: string;
}
