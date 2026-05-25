import { IsBoolean, IsIn, IsObject, IsOptional, IsString, MinLength } from 'class-validator';

/**
 * Body do PATCH /gateways-pagamento/:id.
 *
 * Todos os campos opcionais — patch parcial. Se `credenciais` vem,
 * substitui o conteudo INTEIRO (nao merge — evita confusao com chaves
 * antigas que ficariam orfas).
 */
export class AtualizarGatewayDto {
  @IsOptional()
  @IsString()
  @IsIn(['SANDBOX', 'PRODUCAO'])
  ambiente?: 'SANDBOX' | 'PRODUCAO';

  /** Substituicao completa (nao merge). Validacao Zod no service. */
  @IsOptional()
  @IsObject()
  credenciais?: Record<string, unknown>;

  @IsOptional()
  @IsBoolean()
  ativo?: boolean;

  @IsOptional()
  @IsString()
  @MinLength(8)
  webhookToken?: string;
}
