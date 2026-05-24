import { IsString, MinLength } from 'class-validator';

export class RecusarConfirmacaoDto {
  @IsString()
  @MinLength(3, { message: 'observacoesEquipe deve ter ao menos 3 caracteres' })
  observacoesEquipe!: string;
}
