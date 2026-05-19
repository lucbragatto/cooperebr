import { ArrayMinSize, ArrayNotEmpty, IsArray, IsString } from 'class-validator';

export class AplicarAlocacaoDto {
  @IsArray()
  @ArrayNotEmpty({ message: 'contratoIds deve conter pelo menos 1 ID.' })
  @ArrayMinSize(1)
  @IsString({ each: true })
  contratoIds!: string[];
}
