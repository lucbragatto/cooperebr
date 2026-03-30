import { Type } from 'class-transformer';
import { IsArray, IsDateString, IsEmail, IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, Min, Max, ValidateNested } from 'class-validator';
import { StatusCooperado, TipoCooperado } from '@prisma/client';

export class UcDto {
  @IsString() @IsNotEmpty() numero!: string;
  @IsString() @IsNotEmpty() endereco!: string;
  @IsString() @IsNotEmpty() cidade!: string;
  @IsString() @IsNotEmpty() estado!: string;
  @IsOptional() @IsString() cep?: string;
  @IsOptional() @IsString() bairro?: string;
  @IsOptional() @IsString() numeroUC?: string;
  @IsOptional() @IsString() distribuidora?: string;
  @IsOptional() @IsString() classificacao?: string;
  @IsOptional() @IsString() codigoMedidor?: string;
}

export class ContratoDto {
  @IsString() @IsNotEmpty() usinaId!: string;
  @IsOptional() @IsString() planoId?: string;
  @IsDateString() @IsNotEmpty() dataInicio!: string;
  @IsNumber() percentualDesconto!: number;
  @IsOptional() @IsNumber() kwhContrato?: number;
  @IsOptional() @IsNumber() kwhContratoAnual?: number;
}

export class CadastroCompletoDto {
  // ── Cooperado ──
  @IsString() @IsNotEmpty() nomeCompleto!: string;
  @IsString() @IsNotEmpty() cpf!: string;
  @IsEmail() email!: string;
  @IsOptional() @IsString() telefone?: string;
  @IsOptional() @IsEnum(StatusCooperado) status?: StatusCooperado;
  @IsOptional() @IsEnum(TipoCooperado) tipoCooperado?: TipoCooperado;
  @IsOptional() @IsString() tipoPessoa?: string;
  @IsOptional() @IsString() representanteLegalNome?: string;
  @IsOptional() @IsString() representanteLegalCpf?: string;
  @IsOptional() @IsString() representanteLegalCargo?: string;
  @IsOptional() @IsString() cooperativaId?: string;
  @IsOptional() @IsString() preferenciaCobranca?: string;
  @IsOptional() @IsNumber() cotaKwhMensal?: number;

  // ── UC (opcional) ──
  @IsOptional() @ValidateNested() @Type(() => UcDto) uc?: UcDto;

  // ── Contrato (opcional — só se tem usina) ──
  @IsOptional() @ValidateNested() @Type(() => ContratoDto) contrato?: ContratoDto;

  // ── Lista de espera ──
  @IsOptional() listaEspera?: boolean;
}
