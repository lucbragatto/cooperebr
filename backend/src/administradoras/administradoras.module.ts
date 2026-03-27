import { Module } from '@nestjs/common';
import { AdministradorasController } from './administradoras.controller';
import { AdministradorasService } from './administradoras.service';
import { PrismaService } from '../prisma.service';

@Module({
  controllers: [AdministradorasController],
  providers: [AdministradorasService, PrismaService],
  exports: [AdministradorasService],
})
export class AdministradorasModule {}
