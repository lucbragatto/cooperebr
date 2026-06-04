/**
 * Sprint Portal Empresa 9.0 (04/06/2026) — Módulo do portal da empresa
 * conveniada. Reusa ConveniosModule (que já exporta os serviços usados).
 */
import { Module, forwardRef } from '@nestjs/common';
import { PortalEmpresaController } from './portal-empresa.controller';
import { PortalEmpresaService } from './portal-empresa.service';
import { PrismaService } from '../../prisma.service';
import { ConveniosModule } from '../convenios.module';

@Module({
  imports: [forwardRef(() => ConveniosModule)],
  controllers: [PortalEmpresaController],
  providers: [PortalEmpresaService, PrismaService],
  exports: [PortalEmpresaService],
})
export class PortalEmpresaModule {}
