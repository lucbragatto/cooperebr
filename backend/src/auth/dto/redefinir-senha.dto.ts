import { IsString, MinLength } from 'class-validator';

export class RedefinirSenhaDto {
  @IsString()
  access_token!: string;

  @IsString()
  @MinLength(8)
  novaSenha!: string;
}
