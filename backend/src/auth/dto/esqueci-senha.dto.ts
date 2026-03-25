import { IsString, IsNotEmpty, IsOptional, IsEmail } from 'class-validator';

export class EsqueciSenhaDto {
  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  identificador?: string;
}
