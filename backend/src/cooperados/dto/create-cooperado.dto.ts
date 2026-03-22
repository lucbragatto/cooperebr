import { IsEmail, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateCooperadoDto {
  @IsString()
  @IsNotEmpty()
  nomeCompleto!: string;

  @IsString()
  @IsNotEmpty()
  cpf!: string;

  @IsEmail()
  email!: string;

  @IsOptional()
  @IsString()
  telefone?: string;
}
