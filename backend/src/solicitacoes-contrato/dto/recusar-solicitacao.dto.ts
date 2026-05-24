import { IsString, MinLength } from 'class-validator';

export class RecusarSolicitacaoDto {
  @IsString()
  @MinLength(3, { message: 'observacoesEquipe deve ter ao menos 3 caracteres' })
  observacoesEquipe!: string;
}
