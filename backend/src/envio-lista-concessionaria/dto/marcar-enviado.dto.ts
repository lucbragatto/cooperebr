import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export enum CanalEnvio {
  email = 'email',
  portal = 'portal',
  fisico = 'fisico',
}

export class MarcarEnviadoDto {
  @IsEnum(CanalEnvio, { message: 'canalEnvio deve ser email, portal ou fisico.' })
  canalEnvio!: CanalEnvio;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  observacoes?: string;
}
