import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Req,
  BadRequestException,
} from '@nestjs/common';
import { CooperTokenService } from './cooper-token.service';
import { Roles } from '../auth/roles.decorator';
import { PerfilUsuario } from '../auth/perfil.enum';
import { CooperTokenTipo } from '@prisma/client';

const { SUPER_ADMIN, ADMIN, OPERADOR, COOPERADO } = PerfilUsuario;

@Controller('cooper-token')
export class CooperTokenController {
  constructor(private readonly cooperTokenService: CooperTokenService) {}

  @Roles(COOPERADO, ADMIN, SUPER_ADMIN, OPERADOR)
  @Get('saldo')
  async getSaldo(@Req() req: any) {
    const cooperadoId = req.user?.cooperadoId;
    if (!cooperadoId) {
      throw new BadRequestException('Cooperado não identificado');
    }
    return this.cooperTokenService.getSaldo(cooperadoId);
  }

  @Roles(COOPERADO, ADMIN, SUPER_ADMIN, OPERADOR)
  @Get('extrato')
  async getExtrato(
    @Req() req: any,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const cooperadoId = req.user?.cooperadoId;
    if (!cooperadoId) {
      throw new BadRequestException('Cooperado não identificado');
    }
    return this.cooperTokenService.getExtrato(
      cooperadoId,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
    );
  }

  @Roles(ADMIN, SUPER_ADMIN)
  @Get('admin/consolidado')
  async getConsolidado(@Req() req: any) {
    const cooperativaId = req.user?.cooperativaId;
    if (!cooperativaId) {
      throw new BadRequestException('Cooperativa não identificada');
    }
    return this.cooperTokenService.getConsolidado(cooperativaId);
  }

  @Roles(ADMIN, SUPER_ADMIN)
  @Post('admin/creditar-manual')
  async creditarManual(
    @Req() req: any,
    @Body()
    body: {
      cooperadoId: string;
      quantidade: number;
      descricao?: string;
    },
  ) {
    const cooperativaId = req.user?.cooperativaId;
    if (!cooperativaId) {
      throw new BadRequestException('Cooperativa não identificada');
    }
    if (!body.cooperadoId || !body.quantidade || body.quantidade <= 0) {
      throw new BadRequestException(
        'cooperadoId e quantidade (> 0) são obrigatórios',
      );
    }

    return this.cooperTokenService.creditar({
      cooperadoId: body.cooperadoId,
      cooperativaId,
      tipo: CooperTokenTipo.GERACAO_EXCEDENTE,
      quantidade: body.quantidade,
      descricao: body.descricao,
    } as any);
  }
}
