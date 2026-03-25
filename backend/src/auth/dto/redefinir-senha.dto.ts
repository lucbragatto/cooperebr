import { IsString, MinLength, IsOptional } from 'class-validator';

export class RedefinirSenhaDto {
  @IsString()
  @IsOptional()
  access_token?: string;

  @IsString()
  @IsOptional()
  token?: string;

  @IsString()
  @MinLength(8)
  novaSenha!: string;
}
