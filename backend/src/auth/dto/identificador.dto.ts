import { IsString, IsNotEmpty } from 'class-validator';

export class IdentificadorDto {
  @IsString()
  @IsNotEmpty()
  identificador!: string;
}
