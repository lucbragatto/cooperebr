import { IsBoolean, IsIn, IsObject, IsOptional, IsString, MinLength } from 'class-validator';

/**
 * Body do POST /gateways-pagamento.
 *
 * Validacao em 2 camadas:
 *   1. class-validator (DTO) — formato basico (string, in [SANDBOX|PRODUCAO], object)
 *   2. zod (registry) — validacao tipada das `credenciais` por tipo de gateway
 *
 * O service usa `getDescriptor(tipo).schemaCredenciais.parse(credenciais)`
 * pra validar o shape, depois encripta os campos secretos antes de persistir.
 */
export class CriarGatewayDto {
  @IsString()
  @IsIn(['ASAAS', 'BANESTES'])
  tipo!: 'ASAAS' | 'BANESTES';

  @IsString()
  @IsIn(['SANDBOX', 'PRODUCAO'])
  ambiente!: 'SANDBOX' | 'PRODUCAO';

  /** Shape varia por tipo — validado por Zod no service. */
  @IsObject()
  credenciais!: Record<string, unknown>;

  @IsOptional()
  @IsBoolean()
  ativo?: boolean;

  /** Token de webhook (opcional). Armazenado em coluna propria do schema. */
  @IsOptional()
  @IsString()
  @MinLength(8)
  webhookToken?: string;

  /**
   * SUPER_ADMIN pode passar cooperativaId pra atuar como tenant especifico.
   * ADMIN ignora — sempre usa o cooperativaId do JWT.
   */
  @IsOptional()
  @IsString()
  cooperativaId?: string;
}
