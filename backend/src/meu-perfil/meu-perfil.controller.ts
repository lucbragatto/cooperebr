import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  Post,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../auth/current-user.decorator';
import { Roles } from '../auth/roles.decorator';
import { PerfilUsuario } from '../auth/perfil.enum';
import { PinCooperadoService } from '../cooperados/pin-cooperado.service';
import { DefinirPinDto } from './dto/definir-pin.dto';
import { isPinFraco } from './pin-fraco.helper';

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
  constructor(private readonly pinCooperadoService: PinCooperadoService) {}

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
