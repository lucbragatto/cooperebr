import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { ToolRegistryService } from '../common/tools/tool-registry.service';
import { SentinelaService } from './sentinela.service';

/**
 * SentinelaModule — Prioridade A do Módulo IAG
 *
 * Camada de inteligência sobre gaps regulatórios (especialmente tratamento de Fio B em GD II/III).
 *
 * Abordagem: enquanto o core permanece neutro (por litígio ou por decisão de produto),
 * o Sentinela atua como camada de observação + simulação, gerando visibilidade e
 * recomendações governadas (L0/L1 por padrão).
 */
@Module({
  imports: [],
  providers: [
    PrismaService,
    ToolRegistryService,
    SentinelaService,
  ],
  exports: [SentinelaService],
})
export class SentinelaModule {}
