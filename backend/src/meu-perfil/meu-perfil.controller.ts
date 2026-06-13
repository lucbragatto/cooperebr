import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  Post,
  Put,
  Req,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../auth/current-user.decorator';
import { Roles } from '../auth/roles.decorator';
import { PerfilUsuario } from '../auth/perfil.enum';
import { PinCooperadoService } from '../cooperados/pin-cooperado.service';
import { DefinirPinDto } from './dto/definir-pin.dto';
import { UpdateDadosBancariosDto } from './dto/update-dados-bancarios.dto';
import { isPinFraco } from './pin-fraco.helper';
// Sprint Clube P1 — F6 Bloco C.0 (13/06/2026): cadastro PIX com PIN.
import { DadosBancariosService } from './dados-bancarios.service';

/**
 * F1 (09/06/2026) — Endpoints "meu" do cooperado autenticado.
 *
 * Estado: PIN — apenas cadastro inicial pelo portal logado (JWT prova
 * identidade; sem OTP nesta camada). Bloqueia se ja existe PIN — Luciano
 * orientado a usar /alterar-pin (rota futura). cooperadoId + cooperativaId
 * vem SEMPRE do JWT (anti-IDOR multi-tenant — nunca do body).
 */
@Controller('meu-perfil')
@Roles(PerfilUsuario.COOPERADO)
export class MeuPerfilController {
  constructor(
    private readonly pinCooperadoService: PinCooperadoService,
    private readonly dadosBancariosService: DadosBancariosService,
  ) {}

  @Get('pin-status')
  async pinStatus(@CurrentUser() usuario: any): Promise<{ temPin: boolean }> {
    const { cooperadoId, cooperativaId } = this.exigirContextoCooperado(usuario);
    const temPin = await this.pinCooperadoService.temPin({
      cooperadoId,
      cooperativaId,
    });
    return { temPin };
  }

  // Anti-enumeracao: cap igual ao /auth/trocar-contexto (10/min por IP).
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  @HttpCode(200)
  @Post('definir-pin')
  async definirPin(
    @CurrentUser() usuario: any,
    @Body() dto: DefinirPinDto,
  ): Promise<{ sucesso: true }> {
    const { cooperadoId, cooperativaId } = this.exigirContextoCooperado(usuario);

    if (dto.pin !== dto.pinConfirmacao) {
      throw new BadRequestException(
        'PIN e confirmacao nao conferem. Digite o mesmo numero nos dois campos.',
      );
    }

    if (isPinFraco(dto.pin)) {
      throw new BadRequestException(
        'PIN fraco. Evite 6 digitos iguais (ex: 111111) ou sequencias (ex: 123456 / 987654).',
      );
    }

    const jaTem = await this.pinCooperadoService.temPin({
      cooperadoId,
      cooperativaId,
    });

    if (jaTem) {
      throw new ConflictException(
        'Voce ja tem um PIN cadastrado. Use a rota de alterar PIN.',
      );
    }

    await this.pinCooperadoService.definirPin({
      cooperadoId,
      pin: dto.pin,
      cooperativaId,
    });

    return { sucesso: true };
  }

  // ═════════════════════════════════════════════════════════════════════
  // F6 Bloco C.0 (13/06/2026) — Cadastro/atualização da chave PIX
  //
  // REFORÇO ANTI-FRAUDE Luciano: trocar a chave PIX exige PIN — porque
  // a chave É a âncora anti-fraude do resgate F6. Sessão sequestrada sem
  // PIN ≠ chave alterada.
  // ═════════════════════════════════════════════════════════════════════

  @Get('dados-bancarios')
  async getDadosBancarios(@CurrentUser() usuario: any) {
    const { cooperadoId, cooperativaId } = this.exigirContextoCooperado(usuario);
    return this.dadosBancariosService.getStatus({ cooperadoId, cooperativaId });
  }

  // Anti-enumeração/brute-force: cap apertado (5/min por IP). PIN tem
  // lockout próprio no PinCooperadoService, mas Throttle adiciona camada
  // antes de chegar lá.
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @HttpCode(200)
  @Put('dados-bancarios')
  async atualizarDadosBancarios(
    @CurrentUser() usuario: any,
    @Body() dto: UpdateDadosBancariosDto,
    @Req() req: any,
  ): Promise<{ sucesso: true; pixUltimaAlteracaoEm: Date }> {
    const { cooperadoId, cooperativaId } = this.exigirContextoCooperado(usuario);
    return this.dadosBancariosService.atualizar({
      cooperadoId,
      cooperativaId,
      pin: dto.pin,
      pixTipo: dto.pixTipo,
      pixChave: dto.pixChave,
      usuarioId: usuario?.id ?? usuario?.sub ?? 'desconhecido',
      usuarioPerfil: usuario?.perfil ?? PerfilUsuario.COOPERADO,
      ip: (req?.ip ?? req?.headers?.['x-forwarded-for'] ?? null) as string | null,
      userAgent: (req?.headers?.['user-agent'] ?? null) as string | null,
    });
  }

  private exigirContextoCooperado(usuario: any): {
    cooperadoId: string;
    cooperativaId: string;
  } {
    const cooperadoId = usuario?.cooperadoId;
    const cooperativaId = usuario?.cooperativaId;
    if (!cooperadoId || !cooperativaId) {
      throw new ForbiddenException(
        'Contexto cooperado obrigatorio. Selecione "Cooperado" no seletor de contexto.',
      );
    }
    return { cooperadoId, cooperativaId };
  }
}
