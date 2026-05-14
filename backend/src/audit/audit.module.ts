import { Global, Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { PrismaService } from '../prisma.service';
import { AuditService } from './audit.service';
import { AuditLogInterceptor } from './audit-log.interceptor';

@Global()
@Module({
  providers: [
    PrismaService,
    AuditService,
    { provide: APP_INTERCEPTOR, useClass: AuditLogInterceptor },
  ],
  exports: [AuditService],
})
export class AuditModule {}
