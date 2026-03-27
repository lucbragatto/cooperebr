import { Controller, Get, Post, Delete, Body, Param, Req, Query, ForbiddenException } from '@nestjs/common';
import { ObservadorService } from './observador.service';
import { Roles } from '../auth/roles.decorator';
import { PerfilUsuario } from '../auth/perfil.enum';

const { SUPER_ADMIN, ADMIN } = PerfilUsuario;

@Controller('observador')
export class ObservadorController {
  constructor(private readonly service: ObservadorService) {}

  @Post()
  @Roles(SUPER_ADMIN, ADMIN)
  async ativar(@Body() body: any, @Req() req: any) {
    const user = req.user;
    const perfil = user.perfil;

    // OPERADOR e COOPERADO não podem ativar
    if (perfil === 'OPERADOR' || perfil === 'COOPERADO') {
      throw new ForbiddenException('Sem acesso ao Modo Observador');
    }

    // ADMIN só pode observar da própria cooperativa
    if (perfil === 'ADMIN' && body.cooperativaId && body.cooperativaId !== user.cooperativaId) {
      throw new ForbiddenException('Admin só pode observar na própria cooperativa');
    }

    const dto = {
      observadorId: user.id,
      observadoId: body.observadoId || null,
      observadoTelefone: body.observadoTelefone ? body.observadoTelefone.replace(/\D/g, '') : null,
      observadorTelefone: body.observadorTelefone || user.telefone,
      escopo: body.escopo || 'WHATSAPP_TOTAL',
      expiresAt: body.expiresAt ? new Date(body.expiresAt) : undefined,
      motivo: body.motivo || null,
      cooperativaId: perfil === 'SUPER_ADMIN' ? (body.cooperativaId || user.cooperativaId) : user.cooperativaId,
    };

    return this.service.ativar(dto, perfil);
  }

  @Delete(':id')
  @Roles(SUPER_ADMIN, ADMIN)
  async encerrar(@Param('id') id: string, @Req() req: any) {
    return this.service.encerrar(id, req.user.id);
  }

  @Get()
  @Roles(SUPER_ADMIN, ADMIN)
  async listarAtivas(@Req() req: any) {
    const user = req.user;
    return this.service.listarAtivas(user.cooperativaId, user.id, user.perfil);
  }

  @Get('historico')
  @Roles(SUPER_ADMIN, ADMIN)
  async historico(@Req() req: any) {
    return this.service.historico(req.user.cooperativaId, req.user.perfil);
  }

  /** Busca cooperados/usuarios para autocomplete na modal de ativação */
  @Get('buscar-usuarios')
  @Roles(SUPER_ADMIN, ADMIN)
  async buscarUsuarios(@Query('q') q: string, @Req() req: any) {
    if (!q || q.length < 2) return [];

    const user = req.user;
    const where: any = {
      OR: [
        { nomeCompleto: { contains: q, mode: 'insensitive' } },
        { cpf: { contains: q } },
        { telefone: { contains: q } },
      ],
    };

    if (user.perfil !== 'SUPER_ADMIN') {
      where.cooperativaId = user.cooperativaId;
    }

    return this.service['prisma'].cooperado.findMany({
      where,
      select: { id: true, nomeCompleto: true, cpf: true, telefone: true, cooperativaId: true },
      take: 10,
    });
  }
}
