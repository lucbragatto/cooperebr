import { IsDateString, IsOptional, IsString, MaxLength } from 'class-validator';

export class RegistrarProtocoloDto {
  @IsString()
  @MaxLength(200)
  numeroProtocoloConcessionaria!: string;

  @IsOptional()
  @IsDateString()
  dataProtocolo?: string;
}
