import { IsNotEmpty, IsObject, IsInt, Min, Max, IsOptional, IsString } from 'class-validator';

export class FaturaMensalDto {
  @IsObject()
  @IsNotEmpty()
  dadosOcr!: Record<string, unknown>;

  @IsInt()
  @Min(1)
  @Max(12)
  mesReferencia!: number;

  @IsInt()
  @Min(2020)
  anoReferencia!: number;

  @IsOptional()
  @IsString()
  ucId?: string;

  @IsOptional()
  @IsString()
  arquivoUrl?: string;
}
