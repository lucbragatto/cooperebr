import { IsBoolean, IsEmail, IsEnum, IsOptional, IsString } from 'class-validator';

export class AtualizarUsuarioDto {
  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  nome?: string;

  @IsOptional()
  @IsEnum(['SUPER_ADMIN', 'ADMIN', 'OPERADOR', 'COOPERADO'])
  perfil?: 'SUPER_ADMIN' | 'ADMIN' | 'OPERADOR' | 'COOPERADO';

  @IsOptional()
  @IsBoolean()
  ativo?: boolean;
}
