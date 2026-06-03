import { ArrayMinSize, ArrayUnique, IsArray, IsEnum } from 'class-validator';
import { TipoDocumento } from '@prisma/client';

/**
 * Sprint Convite-Convênio Fatia 3 (03/06/2026) — Admin solicita docs.
 * Lista de tipos do enum existente TipoDocumento.
 */
export class SolicitarDocumentacaoDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @IsEnum(TipoDocumento, { each: true })
  tipos!: TipoDocumento[];
}
