import { IsNotEmpty, IsString, Length, Matches } from 'class-validator';

/**
 * Sprint Convite-Convênio Fatia 2b (03/06/2026).
 *
 * DTO do POST /publico/convites/:token/validar-otp. Código numérico 6 dígitos
 * (ex: "043812"). Validação class-validator é primeira camada; service faz
 * comparação constant-time contra hash.
 */
export class ValidarOtpConviteDto {
  @IsString()
  @IsNotEmpty()
  @Length(6, 6)
  @Matches(/^\d{6}$/, { message: 'codigo deve conter 6 dígitos numéricos' })
  codigo!: string;
}
