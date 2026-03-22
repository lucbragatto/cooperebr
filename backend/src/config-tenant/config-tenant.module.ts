import { Module } from '@nestjs/common';
import { ConfigTenantService } from './config-tenant.service';
import { ConfigTenantController } from './config-tenant.controller';
import { PrismaService } from '../prisma.service';

@Module({
  controllers: [ConfigTenantController],
  providers: [ConfigTenantService, PrismaService],
  exports: [ConfigTenantService],
})
export class ConfigTenantModule {}
