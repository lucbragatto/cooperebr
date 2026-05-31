import { Controller, Post, Get, Param, Query, Body, Req } from '@nestjs/common';
import { EmailService } from './email.service';
import { Roles } from '../auth/roles.decorator';
import { TenantResource } from '../auth/tenant-resource.decorator';
import { PerfilUsuario } from '../auth/perfil.enum';
import { PrismaService } from '../prisma.service';

@Controller('email')
export class EmailController {
  constructor(
    private emailService: EmailService,
    private prisma: PrismaService,
  ) {}

  /**
   * D-novo-BR F1.2 A8 (31/05/2026) — Guard valida que :cooperadoId pertence
   * ao tenant. Service complementar abaixo também filtra a cobrança por
   * cooperativaId (defesa em profundidade — sem isso, mesmo com Guard, a
   * 2ª query findFirst da cobrança não tinha filtro de tenant).
   */
  @TenantResource({ model: 'cooperado', idParam: 'cooperadoId' })
  @Post('reenviar/:cooperadoId')
  @Roles(PerfilUsuario.SUPER_ADMIN, PerfilUsuario.ADMIN, PerfilUsuario.OPERADOR)
  async reenviar(@Param('cooperadoId') cooperadoId: string, @Req() req: any) {
    // Após o Guard, cooperadoId já é garantidamente do tenant (ou SA bypass).
    const perfil = req.user?.perfil;
    const cooperativaIdGuard = perfil === PerfilUsuario.SUPER_ADMIN
      ? null
      : (req.user?.cooperativaId ?? null);

    const cooperado = await this.prisma.cooperado.findUnique({
      where: { id: cooperadoId },
      select: { id: true, nomeCompleto: true, email: true, cooperativaId: true },
    });
    if (!cooperado) return { sucesso: false, mensagem: 'Cooperado não encontrado' };
    if (!cooperado.email) return { sucesso: false, mensagem: 'Cooperado não possui e-mail cadastrado' };

    // F1.2 A8 fix complementar — filtrar cobrança também por cooperativaId pra
    // garantir que mesmo se Guard fosse removido, não busque cobrança de outro tenant.
    const cobrancaWhere: any = {
      contrato: { cooperadoId },
      status: { in: ['PENDENTE', 'A_VENCER'] },
    };
    if (cooperativaIdGuard) {
      cobrancaWhere.contrato.cooperativaId = cooperativaIdGuard;
    }

    const cobranca = await this.prisma.cobranca.findFirst({
      where: cobrancaWhere,
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

  // M7 cat-3 (defer F1.5): EmailLog sem cooperativaId → schema add + filtro
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
