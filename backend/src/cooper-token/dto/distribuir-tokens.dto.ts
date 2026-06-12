/**
 * Sprint Clube P1 — F3 Bloco B (12/06/2026).
 *
 * DTO de distribuição em LOTE/INDIVIDUAL pela empresa-PJ pra funcionários
 * (MEMBRO_ATIVO do convênio).
 *
 * Multi-tenant: cooperativaId e remetente (cooperadoId da empresa) vêm
 * SEMPRE do JWT — NUNCA do body (anti-IDOR). Body declara apenas
 * convenioId + destinatários + valores + natureza/CLT.
 */
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class DistribuicaoItemDto {
  /** Cooperado destinatário (funcionário = MEMBRO_ATIVO do convênio). */
  @IsString()
  destinatarioCooperadoId: string;

  /** Quantidade de tokens pra este destinatário (não centavos). */
  @IsNumber()
  @Min(0.0001)
  quantidade: number;
}

export class DistribuirTokensDto {
  /** Convênio (ContratoConvenio.id) — empresa-PJ deve ser a `conveniada`. */
  @IsString()
  convenioId: string;

  /**
   * Idempotência por lote (UUID v4 recomendado). Service usa como
   * `referenciaId` + `referenciaTabela='MASS_WRITE_DISTRIBUICAO'` no
   * primeiro ledger entry.
   */
  @IsString()
  clientRequestId: string;

  /** PIN da empresa-PJ (6 dígitos numéricos). Validado contra Cooperado.pinHash. */
  @IsString()
  @Matches(/^\d{6}$/, { message: 'PIN deve ter exatamente 6 dígitos numéricos.' })
  pin: string;

  /** PREVIEW = dry-run (retorna resumo + alertas sem tocar saldo); CONFIRM = grava. */
  @IsIn(['PREVIEW', 'CONFIRM'])
  modo: 'PREVIEW' | 'CONFIRM';

  /**
   * Lista de destinatários. Cap default 200 (helper mass-write).
   * 1 item = INDIVIDUAL; >1 = LOTE. Quantidades podem ser iguais OU
   * diferentes — backend não discrimina os 4 modos (UI controla).
   */
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => DistribuicaoItemDto)
  distribuicoes: DistribuicaoItemDto[];

  /**
   * Natureza jurídica da distribuição (defesa CLT auditável):
   *  - ORIGEM_REGULAMENTO: prevista no regulamento; CLT 458 §2º cumprido por regulamento.
   *  - VOLUNTARIA:         exige empresaDeclaraTetoClt=true (CLT 458 §2º — empresa declara
   *                        respeito ao teto 50% remuneração).
   *  - PREMIACAO:          prêmio por meta (CLT 457 §2º); exige descricao com motivo/meta.
   */
  @IsIn(['ORIGEM_REGULAMENTO', 'VOLUNTARIA', 'PREMIACAO'])
  naturezaDistribuicao: 'ORIGEM_REGULAMENTO' | 'VOLUNTARIA' | 'PREMIACAO';

  /**
   * Declaração de que respeitou o teto de 50% da remuneração (CLT 458 §2º).
   * OBRIGATÓRIO `true` quando `naturezaDistribuicao=VOLUNTARIA`.
   * Ignorado nas outras naturezas.
   */
  @IsOptional()
  @IsBoolean()
  empresaDeclaraTetoClt?: boolean;

  /**
   * Descrição livre (texto humano) — vai pro ledger.descricao e
   * TokenTransacao.descricao. OBRIGATÓRIA quando
   * `naturezaDistribuicao=PREMIACAO` (motivo/meta da premiação).
   */
  @IsOptional()
  @IsString()
  descricao?: string;
}
