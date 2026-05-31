import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

export class EstornarRepasseDto {
  @IsString()
  @IsNotEmpty({ message: 'motivo do estorno é obrigatório.' })
  @MinLength(10, { message: 'motivo deve ter no mínimo 10 caracteres (auditoria contábil).' })
  @MaxLength(500)
  motivo!: string;
}
