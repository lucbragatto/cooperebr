import { IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';

export class CriarUsuarioDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  senha!: string;

  @IsEnum(['ADMIN', 'OPERADOR', 'COOPERADO'])
  perfil!: 'ADMIN' | 'OPERADOR' | 'COOPERADO';

  @IsString()
  @IsNotEmpty()
  nome!: string;

  @IsOptional()
  @IsString()
  cooperativaId?: string;
}
