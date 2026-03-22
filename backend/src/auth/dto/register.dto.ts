import { IsEmail, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';

export class RegisterDto {
  @IsString()
  @IsNotEmpty()
  nome!: string;

  @IsEmail()
  email!: string;

  @IsOptional()
  @IsString()
  cpf?: string;

  @IsOptional()
  @IsString()
  telefone?: string;

  @IsString()
  @MinLength(8)
  senha!: string;
}
