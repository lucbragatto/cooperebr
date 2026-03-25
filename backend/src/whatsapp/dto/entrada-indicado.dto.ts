import { IsNotEmpty, IsString, Matches, MinLength, MaxLength } from 'class-validator';

export class EntradaIndicadoDto {
  @IsString()
  @IsNotEmpty({ message: 'Telefone é obrigatório' })
  @Matches(/^\d{10,13}$/, { message: 'Telefone deve conter entre 10 e 13 dígitos numéricos' })
  telefone!: string;

  @IsString()
  @IsNotEmpty({ message: 'Código de referência é obrigatório' })
  @MinLength(3, { message: 'Código de referência muito curto' })
  @MaxLength(20, { message: 'Código de referência muito longo' })
  codigoRef!: string;
}
