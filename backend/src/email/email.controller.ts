import { Controller, Post, Get, Param, Query, Body } from '@nestjs/common';
import { EmailService } from './email.service';
import { Roles } from '../auth/roles.decorator';
import { PerfilUsuario } from '../auth/perfil.enum';
import { PrismaService } from '../prisma.service';

@Controller('email')
export class EmailController {
  constructor(
    private emailService: EmailService,
    private prisma: PrismaService,
  ) {}

  @Post('reenviar/:cooperadoId')
  @Roles(PerfilUsuario.SUPER_ADMIN, PerfilUsuario.ADMIN, PerfilUsuario.OPERADOR)
  async reenviar(@Param('cooperadoId') cooperadoId: string) {
    const cooperado = await this.prisma.cooperado.findUnique({
      where: { id: cooperadoId },
      select: { id: true, nomeCompleto: true, email: true, cooperativaId: true },
    });
    if (!cooperado) return { sucesso: false, mensagem: 'Cooperado não encontrado' };
    if (!cooperado.email) return { sucesso: false, mensagem: 'Cooperado não possui e-mail cadastrado' };

    // Buscar última cobrança pendente ou a_vencer
    const cobranca = await this.prisma.cobranca.findFirst({
      where: { contrato: { cooperadoId }, status: { in: ['PENDENTE', 'A_VENCER'] } },
      orderBy: { createdAt: 'desc' },
    });

    if (cobranca) {
      const ok = await this.emailService.enviarFatura(cooperado, cobranca);
      return { sucesso: ok, tipo: 'fatura', cooperadoId };
    }

    // Se não há cobrança, reenvia boas-vindas
    const ok = await this.emailService.enviarBoasVindas(cooperado);
    return { sucesso: ok, tipo: 'boas-vindas', cooperadoId };
  }

  @Get('logs')
  @Roles(PerfilUsuario.SUPER_ADMIN, PerfilUsuario.ADMIN)
  async logs(@Query('page') page?: string, @Query('limit') limit?: string) {
    return this.emailService.buscarLogs(Number(page) || 1, Number(limit) || 20);
  }

  @Post('testar')
  @Roles(PerfilUsuario.SUPER_ADMIN, PerfilUsuario.ADMIN)
  async testar(@Body('email') email?: string) {
    const destino = email || process.env.EMAIL_USER || 'contato@cooperebr.com';
    const ok = await this.emailService.enviarTeste(destino);
    return { sucesso: ok, destino };
  }
}
