import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CancelarRepasseDto {
  @IsString()
  @IsNotEmpty({ message: 'motivo do cancelamento é obrigatório.' })
  @MaxLength(500)
  motivo!: string;
}
