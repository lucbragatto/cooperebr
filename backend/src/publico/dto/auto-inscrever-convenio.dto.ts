import {
  IsEmail,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Matches,
  Min,
} from 'class-validator';

/**
 * Sprint Convite-Convênio Fatia 2c (03/06/2026) — DTO refatorado.
 *
 * NOVO DESIGN: body NÃO carrega mais `cooperativaId` nem `convenioId` —
 * ambos resolvidos do convite a partir do `token`. Remove a superfície de
 * spoof de tenant (cliente não escolhe pra qual convênio se inscrever; o
 * convite gerado pela empresa já tem ambos travados).
 *
 * `token` precisa ter sido EMITIDO pela empresa (Fatia 2a) E ter o `otpValidadoEm`
 * setado (Fatia 2b) dentro da janela de 30min antes do auto-inscrever.
 *
 * Telefone opcional: usuário pode informar outro contato (ex.: WhatsApp pessoal
 * vs corporativo). OTP já provou posse do telefone original (do convite).
 */
export class AutoInscreverConvenioDto {
  @IsString()
  @IsNotEmpty()
  @Length(64, 64)
  @Matches(/^[0-9a-f]{64}$/, { message: 'token inválido' })
  token!: string;

  @IsString()
  @IsNotEmpty()
  @Length(2, 200)
  nome!: string;

  @IsString()
  @IsNotEmpty()
  @Length(11, 14) // CPF 11 dígitos ou formatado xxx.xxx.xxx-xx
  cpf!: string;

  @IsEmail()
  email!: string;

  @IsOptional()
  @IsString()
  telefone?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  consumoMedioKwh?: number;
}
