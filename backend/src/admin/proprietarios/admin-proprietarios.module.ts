import { Module } from '@nestjs/common';
import { AdminProprietariosController } from './admin-proprietarios.controller';
import { AdminProprietariosService } from './admin-proprietarios.service';
import { PrismaService } from '../../prisma.service';

/**
 * Sub-Sprint F.5a (M33, 2026-05-27 noite).
 * Module dedicado pro Dashboard Hierárquico Super Admin (Portal Proprietário).
 */
@Module({
  controllers: [AdminProprietariosController],
  providers: [AdminProprietariosService, PrismaService],
  exports: [AdminProprietariosService],
})
export class AdminProprietariosModule {}
