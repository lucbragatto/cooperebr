import { IsArray, ArrayMinSize, IsString } from 'class-validator';

export class CreateRascunhoDto {
  @IsString()
  usinaId!: string;

  @IsArray()
  @ArrayMinSize(1, { message: 'Selecione pelo menos 1 cooperado.' })
  @IsString({ each: true })
  cooperadoIds!: string[];
}
