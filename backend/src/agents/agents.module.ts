import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { PolicyEngineService } from './common/policy/policy-engine.service';
import { ToolRegistryService } from './common/tools/tool-registry.service';
import { AgentsService } from './agents.service';
import { SentinelaModule } from './sentinela/sentinela.module';
import { RepassesDespesasModule } from './repasses-despesas/repasses-despesas.module';
import { CobrancaModule } from './cobranca/cobranca.module';

/**
 * AgentsModule (IAG) — Módulo isolado do CoopereBR/SISGD.
 *
 * Princípio: dependência unidirecional.
 * - Este módulo pode importar services do core.
 * - O core NUNCA deve importar este módulo (a menos que explicitamente desejado).
 *
 * Status atual: Fase 2 inicial — infraestrutura + estrutura de domínios.
 * Próximo: implementar Tools L0/L1 reais dentro de cada sub-módulo.
 */
@Module({
  imports: [
    SentinelaModule,
    RepassesDespesasModule,
    CobrancaModule,
  ],
  controllers: [],
  providers: [
    PrismaService,
    PolicyEngineService,
    ToolRegistryService,
    AgentsService,
  ],
  exports: [
    AgentsService,
    PolicyEngineService,
    ToolRegistryService,
  ],
})
export class AgentsModule {}
