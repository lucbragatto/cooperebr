import { IsDateString, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export enum StatusHomologacaoInput {
  HOMOLOGADO = 'HOMOLOGADO',
  REJEITADO = 'REJEITADO',
}

export class RegistrarHomologacaoDto {
  @IsEnum(StatusHomologacaoInput, {
    message: 'statusIndividual deve ser HOMOLOGADO ou REJEITADO.',
  })
  statusIndividual!: StatusHomologacaoInput;

  @IsOptional()
  @IsDateString()
  dataHomologacao?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  observacao?: string;
}
