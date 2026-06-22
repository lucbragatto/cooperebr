/**
 * Sprint Funil M48 (22/06/2026) — Camada 1: Motor backend do roteador A/B/C.
 */
import { Module } from '@nestjs/common';
import { RoteamentoCadastroService } from './roteamento-cadastro.service';
import { PrismaService } from '../prisma.service';

@Module({
  providers: [RoteamentoCadastroService, PrismaService],
  exports: [RoteamentoCadastroService],
})
export class RoteamentoCadastroModule {}
