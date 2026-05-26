import { Module } from '@nestjs/common';
import { ProprietarioService } from './proprietario.service';
import { ProprietarioController } from './proprietario.controller';
import { PrismaService } from '../prisma.service';

/**
 * Sub-Sprint F Sessao 1 MVP+ Etapa D (M30, 2026-05-26).
 *
 * Module dedicado ao Portal Proprietario. Standalone — nao depende de
 * outros modules. Helper calcularRepasse e funcao pura importada
 * diretamente, sem injecao.
 */
@Module({
  controllers: [ProprietarioController],
  providers: [ProprietarioService, PrismaService],
  exports: [ProprietarioService],
})
export class ProprietarioModule {}
